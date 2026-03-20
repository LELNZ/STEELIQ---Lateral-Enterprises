import type { Pool } from "pg";

/**
 * Idempotent deduplication of reference / configuration data.
 *
 * Root-cause: the ref-data migration uses ON CONFLICT (id) DO UPDATE, which
 * deduplicates only by primary key. When production was originally seeded with
 * different UUIDs for the same business records, the migration inserted all dev
 * UUIDs as NEW rows, doubling every existing library entry.
 *
 * Deduplication rules:
 *
 *   frame_type       → grouped by data->>'value'; keep the one with the most
 *                       frame_configurations children (or smallest id if tied)
 *
 *   other lib types  → grouped by (type, business_key) where business_key is
 *                       COALESCE(data->>'name', data->>'combo', data->>'label',
 *                                data->>'value');  keep smallest id per group.
 *                       Skips direct_profile / direct_accessory (stable UUIDs).
 *
 *   frame_configs    → grouped by (frame_type_id, name); keep smallest id;
 *                       deletes orphaned profiles/accessories/labor first.
 *
 * Safe to run on every boot: exits immediately when no duplicates exist.
 */
export async function runDedupMigration(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    // ── fast exit if no duplicates exist ────────────────────────────────────
    const leCheck = await client.query<{ cnt: string }>(`
      SELECT count(*)::text AS cnt
      FROM (
        SELECT 1 FROM library_entries
        WHERE type = 'frame_type'
        GROUP BY data->>'value'
        HAVING count(*) > 1
        LIMIT 1
      ) x
    `);
    const cfgCheck = await client.query<{ cnt: string }>(`
      SELECT count(*)::text AS cnt
      FROM (
        SELECT 1 FROM frame_configurations
        GROUP BY frame_type_id, name
        HAVING count(*) > 1
        LIMIT 1
      ) x
    `);
    if (leCheck.rows[0]?.cnt === "0" && cfgCheck.rows[0]?.cnt === "0") {
      console.log("[dedup-migration] No duplicates found – skipping.");
      return;
    }

    await client.query("BEGIN");

    // ── 1. Deduplicate library_entries: frame_type ───────────────────────────
    // Business key: data->>'value'   (e.g. "ES52-Window")
    // Canonical:    most frame_configurations children; ties → smallest id
    const delFrameTypes = await client.query(`
      WITH ranked AS (
        SELECT
          le.id,
          le.data->>'value' AS biz_key,
          ROW_NUMBER() OVER (
            PARTITION BY le.data->>'value'
            ORDER BY
              (SELECT count(*) FROM frame_configurations fc WHERE fc.frame_type_id = le.id) DESC,
              le.id ASC
          ) AS rn
        FROM library_entries le
        WHERE le.type = 'frame_type'
      )
      DELETE FROM library_entries
      WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
      RETURNING id
    `);

    // ── 2. Deduplicate library_entries: all other managed types ───────────────
    // Business key: COALESCE(data->>'name', data->>'combo',
    //                        data->>'label', data->>'value')
    // Canonical:    smallest id
    // Excluded:     frame_type (handled above)
    //               direct_profile, direct_accessory (stable UUIDs – never dup)
    const delOtherEntries = await client.query(`
      WITH ranked AS (
        SELECT
          id,
          type,
          COALESCE(
            data->>'name',
            data->>'combo',
            data->>'label',
            data->>'value'
          ) AS biz_key,
          ROW_NUMBER() OVER (
            PARTITION BY
              type,
              COALESCE(
                data->>'name',
                data->>'combo',
                data->>'label',
                data->>'value'
              )
            ORDER BY id ASC
          ) AS rn
        FROM library_entries
        WHERE type NOT IN ('frame_type', 'direct_profile', 'direct_accessory')
          AND COALESCE(
            data->>'name',
            data->>'combo',
            data->>'label',
            data->>'value'
          ) IS NOT NULL
      )
      DELETE FROM library_entries
      WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
      RETURNING id
    `);

    // ── 3. Deduplicate frame_configurations ───────────────────────────────────
    // Business key: (frame_type_id, name)
    // Canonical:    smallest id
    // Must delete children before deleting parents (FK constraint)

    const canonicalConfigsQuery = `
      SELECT DISTINCT ON (frame_type_id, name) id
      FROM frame_configurations
      ORDER BY frame_type_id, name, id ASC
    `;

    const delLabor = await client.query(`
      DELETE FROM configuration_labor
      WHERE configuration_id NOT IN (${canonicalConfigsQuery})
      RETURNING id
    `);

    const delAccessories = await client.query(`
      DELETE FROM configuration_accessories
      WHERE configuration_id NOT IN (${canonicalConfigsQuery})
      RETURNING id
    `);

    const delProfiles = await client.query(`
      DELETE FROM configuration_profiles
      WHERE configuration_id NOT IN (${canonicalConfigsQuery})
      RETURNING id
    `);

    const delConfigs = await client.query(`
      DELETE FROM frame_configurations
      WHERE id NOT IN (${canonicalConfigsQuery})
      RETURNING id
    `);

    await client.query("COMMIT");

    const ftDel = delFrameTypes.rowCount ?? 0;
    const oeDel = delOtherEntries.rowCount ?? 0;
    const cfgDel = delConfigs.rowCount ?? 0;
    const profDel = delProfiles.rowCount ?? 0;
    const accDel = delAccessories.rowCount ?? 0;
    const labDel = delLabor.rowCount ?? 0;

    console.log(
      `[dedup-migration] Done. Removed: ${ftDel} duplicate frame_types, ` +
      `${oeDel} duplicate library_entries (other types), ` +
      `${cfgDel} duplicate frame_configurations ` +
      `(+${profDel} profiles, +${accDel} accessories, +${labDel} labor rows).`
    );
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
