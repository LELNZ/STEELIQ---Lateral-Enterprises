import type { Pool } from "pg";

export async function runInvoiceLinesBackfill(pool: Pool): Promise<void> {
  const tableCheck = await pool.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'invoice_lines'
    ) AS "exists"
  `);
  if (!tableCheck.rows[0]?.exists) {
    console.log("[invoice-lines-backfill] invoice_lines table does not exist yet — skipping");
    return;
  }

  const result = await pool.query(`
    INSERT INTO invoice_lines (id, invoice_id, sort_order, line_type, description, quantity, unit_amount, line_amount_excl_gst, variation_id, source_context, created_at, updated_at)
    SELECT
      gen_random_uuid(),
      i.id,
      0,
      i.type,
      i.description,
      1,
      i.amount_excl_gst,
      i.amount_excl_gst,
      i.variation_id,
      '{"origin":"backfill"}',
      COALESCE(i.created_at, NOW()),
      NOW()
    FROM invoices i
    WHERE NOT EXISTS (
      SELECT 1 FROM invoice_lines il WHERE il.invoice_id = i.id
    )
  `);

  if (result.rowCount === 0) {
    console.log("[invoice-lines-backfill] All invoices already have lines — nothing to do");
  } else {
    console.log(`[invoice-lines-backfill] Backfilled ${result.rowCount} invoice line records`);
  }
}
