import type { Pool } from "pg";
import { DEV_LIBRARY_ENTRY_IDS } from "./ref-data-migration";

/**
 * Idempotent deduplication of reference / configuration data.
 *
 * ROOT CAUSE
 * ----------
 * The ref-data migration uses ON CONFLICT (id) DO UPDATE, which deduplicates
 * only by primary-key UUID.  When production was seeded with different UUIDs
 * for the same business records, the migration inserted all dev UUIDs as NEW
 * rows, creating business-key duplicates.
 *
 * On every subsequent boot the ref-data migration re-inserts any dev UUID that
 * was previously removed — so the dedup MUST also run on every boot.
 *
 * CANONICALIZATION STRATEGY (stable convergence)
 * -----------------------------------------------
 * For each duplicate group the canonical record chosen is:
 *   1. The UUID that is in DEV_LIBRARY_ENTRY_IDS  (= what the ref-data
 *      migration uses), so future ref-data re-inserts are ON CONFLICT → update
 *      (no new rows).
 *   2. If multiple or zero dev UUIDs in the group, keep the smallest UUID.
 *
 * This makes the system stable: after the first dedup pass, production holds
 * only dev UUIDs, and every subsequent ref-data run is a pure no-op update.
 *
 * BUSINESS KEYS (type-specific, confirmed from live data)
 * -------------------------------------------------------
 *   frame_type       → data->>'value'  e.g. "ES52-Window"
 *   glass            → data->>'combo'  e.g. "Clear // EnergySaver"
 *   labour_operation → data->>'name'   e.g. "glazing"
 *   frame_color      → data->>'label'  e.g. "Dulux Black"
 *   glazing_band     → data->>'label'  e.g. "small"
 *   delivery_rate    → data->>'name'
 *   installation_rate→ data->>'name'
 *   removal_rate     → data->>'name'
 *   general_waste    → data->>'name'
 *   profile_role     → data->>'code'
 *   handle/lock types→ data->>'value'  (has both label+value)
 *   wanz_bar         → data->>'name'
 *   liner_type       → data->>'name'
 *   All above are covered by:
 *     COALESCE(data->>'name', data->>'combo', data->>'label', data->>'value')
 *   direct_profile / direct_accessory: SKIPPED (stable shared UUIDs, never dup)
 *
 * FAST PATH
 * ---------
 * Checks ALL managed types before deciding to skip.  This prevents the previous
 * bug where frame_type was clean but glass/labour still had duplicates.
 */
export async function runDedupMigration(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    // ── broad fast-path: check EVERY managed type ─────────────────────────────
    const anyDups = await client.query<{ cnt: string }>(`
      SELECT count(*)::text AS cnt FROM (
        SELECT 1 FROM library_entries
          WHERE type = 'frame_type'
          GROUP BY data->>'value'
          HAVING count(*) > 1
        UNION ALL
        SELECT 1 FROM library_entries
          WHERE type NOT IN ('frame_type','direct_profile','direct_accessory')
            AND COALESCE(
              data->>'name', data->>'combo',
              data->>'label', data->>'value'
            ) IS NOT NULL
          GROUP BY type,
            COALESCE(data->>'name', data->>'combo', data->>'label', data->>'value')
          HAVING count(*) > 1
        UNION ALL
        SELECT 1 FROM frame_configurations
          GROUP BY frame_type_id, name
          HAVING count(*) > 1
        LIMIT 1
      ) x
    `);

    if (anyDups.rows[0]?.cnt === "0") {
      console.log("[dedup-migration] No duplicates found – skipping.");
      return;
    }

    // Build a temp table of dev IDs so Postgres can use them efficiently
    const devIds = Array.from(DEV_LIBRARY_ENTRY_IDS);

    await client.query("BEGIN");

    // ── helper: build the dev-ids temp table inside the transaction ───────────
    await client.query("CREATE TEMP TABLE _dev_ids (id text) ON COMMIT DROP");
    // Insert in batches of 500 to stay within param limits
    for (let i = 0; i < devIds.length; i += 500) {
      const batch = devIds.slice(i, i + 500);
      const placeholders = batch.map((_, j) => `($${j + 1})`).join(",");
      await client.query(`INSERT INTO _dev_ids VALUES ${placeholders}`, batch);
    }

    // ── 1. Deduplicate frame_type ─────────────────────────────────────────────
    // Business key: data->>'value'
    // Canonical: dev UUID if present; else UUID with most frame_configuration
    //            children; else smallest UUID.
    const delFrameTypes = await client.query(`
      WITH ranked AS (
        SELECT
          le.id,
          le.data->>'value' AS biz_key,
          ROW_NUMBER() OVER (
            PARTITION BY le.data->>'value'
            ORDER BY
              CASE WHEN le.id IN (SELECT id FROM _dev_ids) THEN 0 ELSE 1 END,
              (SELECT count(*) FROM frame_configurations fc
               WHERE fc.frame_type_id = le.id) DESC,
              le.id ASC
          ) AS rn
        FROM library_entries le
        WHERE le.type = 'frame_type'
      )
      DELETE FROM library_entries
      WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
      RETURNING id
    `);

    // ── 2. Deduplicate all other managed library_entry types ──────────────────
    // Business key: COALESCE(name, combo, label, value)
    // Canonical: dev UUID if present in group; else smallest UUID.
    // Skips: direct_profile, direct_accessory (stable UUIDs, never duplicated)
    const delOtherEntries = await client.query(`
      WITH ranked AS (
        SELECT
          id,
          type,
          COALESCE(
            data->>'name', data->>'combo',
            data->>'label', data->>'value'
          ) AS biz_key,
          ROW_NUMBER() OVER (
            PARTITION BY
              type,
              COALESCE(data->>'name', data->>'combo', data->>'label', data->>'value')
            ORDER BY
              CASE WHEN id IN (SELECT id FROM _dev_ids) THEN 0 ELSE 1 END,
              id ASC
          ) AS rn
        FROM library_entries
        WHERE type NOT IN ('frame_type','direct_profile','direct_accessory')
          AND COALESCE(
            data->>'name', data->>'combo',
            data->>'label', data->>'value'
          ) IS NOT NULL
      )
      DELETE FROM library_entries
      WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
      RETURNING id
    `);

    // ── 3. Deduplicate frame_configurations ───────────────────────────────────
    // Business key: (frame_type_id, name)
    // Canonical: smallest UUID (all frame_config IDs are dev UUIDs — production
    //            had 0 configs before migration, so no original-prod IDs exist)
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

    const ftDel  = delFrameTypes.rowCount   ?? 0;
    const oeDel  = delOtherEntries.rowCount  ?? 0;
    const cfgDel = delConfigs.rowCount      ?? 0;
    const prDel  = delProfiles.rowCount     ?? 0;
    const acDel  = delAccessories.rowCount  ?? 0;
    const laDel  = delLabor.rowCount        ?? 0;

    console.log(
      `[dedup-migration] Done. Removed: ${ftDel} frame_types, ` +
      `${oeDel} other library_entries, ` +
      `${cfgDel} frame_configurations ` +
      `(+${prDel} profiles, +${acDel} accessories, +${laDel} labor).`
    );
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
