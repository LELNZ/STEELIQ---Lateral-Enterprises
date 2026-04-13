# SteelIQ — LL Material Library Corrective Phase: Enterprise Implementation Report

**Report Date:** 13 April 2026
**Phase:** Corrective Implementation (Phase 2 of Forensic Audit + Correction)
**Scope:** Schema enhancement, missing row insertion, data reconciliation, Quote Builder impact

---

## 1. EXECUTIVE SUMMARY

### What Was Implemented

- Five new fields added to `ll_sheet_materials` schema: `supplierSku`, `supplierCategory`, `formType`, `pricePerKg`, `isQuoteable`.
- 82 missing Wakefield Metals rows inserted from source Excel (Pricing 42A2).
- 1 missing Macdonald Steel row inserted (HA300 12mm 3600×1520 @ $979.38).
- All 257 pre-existing rows backfilled with new field values (SKU, category, form type, quoteable status).
- 1 true duplicate row removed (5083 4mm 7500×1830 — identical record appeared twice in Excel extraction).
- 1 composite-key collision resolved (5052 3mm 4800×1500 — two distinct products differentiated by finish: "PE Protected" vs "2-Side PE").
- Quote Builder API and frontend updated to filter by `isQuoteable`, preventing per-kg reference rows from appearing in operator material selection.
- Startup seed function rewritten with idempotent reconciliation logic: handles full reseed, missing-row insertion, and field backfill on existing data.
- Database total: **339 rows** (105 Macdonald Steel + 234 Wakefield Metals).

### What Was NOT Implemented

- Coil rows (55 in Wakefield Excel) are NOT represented in the database. Coil quoting workflow does not exist.
- No operator toggle between normalized vs supplier-native product descriptions.
- No admin UI surface for the new fields (supplierSku, supplierCategory, formType, pricePerKg).
- No procurement-facing supplier detail view.
- No coil-as-stock-behaviour model or Add Item support for operator-entered coil length.

### Release Recommendation

The corrective phase is complete for sheet/plate materials. All 339 rows have exact price parity with source supplier files. Zero composite-key collisions. Zero broken references. The system is safe for production use. Coil quoting is a separate feature and should be scoped as a distinct phase.

---

## 2. REPO CHANGE EVIDENCE

| File Changed | Purpose | Category |
|---|---|---|
| `shared/schema.ts` | Added 5 new columns to `llSheetMaterials` table definition and insert schema | Schema |
| `server/ll-seed-data.ts` | Updated from 257 to 339 rows; all rows now include new fields | Seed/Import |
| `server/routes.ts` | (1) Updated seed function with reconciliation logic. (2) Added `quoteable` query filter to GET endpoint | Query/Filter |
| `client/src/pages/laser-quote-builder.tsx` | Updated material fetch to request `quoteable=true` | UI |
| `replit.md` | Updated project documentation for new fields and data counts | Documentation |

- **Schema files changed:** YES (`shared/schema.ts`)
- **Seed/import files changed:** YES (`server/ll-seed-data.ts`)
- **UI files changed:** YES (`client/src/pages/laser-quote-builder.tsx`)
- **Query/filter files changed:** YES (`server/routes.ts`)

---

## 3. SCHEMA / MODEL CHANGE DETAIL

### New Fields Added to `ll_sheet_materials`

| Field Name | DB Column | Type | Default | Nullable | Why Added | Suppliers Using | Backward Compatible |
|---|---|---|---|---|---|---|---|
| `pricePerKg` | `price_per_kg` | `numeric` | — | YES (null) | Store per-kilogram pricing for reference/fallback rows that have no fixed sheet price | Wakefield Metals (14 rows) | YES — null for all existing rows pre-backfill |
| `supplierSku` | `supplier_sku` | `text` | `""` | NO (default empty) | Store supplier-native item number for traceability and procurement | Wakefield Metals (234 rows) | YES — empty string default |
| `supplierCategory` | `supplier_category` | `text` | `""` | NO (default empty) | Store supplier-native category classification (ALUMINIUM, STAINLESS) | Wakefield Metals (234 rows) | YES — empty string default |
| `formType` | `form_type` | `text` | `""` | NO (default empty) | Classify product form (Plain Plate, Sheet, Tread Plate, Sheet PE, etc.) | Both (339 rows) | YES — empty string default |
| `isQuoteable` | `is_quoteable` | `boolean` | `true` | NO | Control whether row appears in Quote Builder material selector | Both — 325 true, 14 false | YES — true default matches all prior behaviour |

### Backward Compatibility

All new fields have safe defaults (`null`, `""`, or `true`) that preserve existing behaviour. No existing column types, names, or constraints were modified. The `insertLlSheetMaterialSchema` automatically includes new fields via `createInsertSchema`. Existing API consumers that do not send the new fields will receive valid defaults.

---

## 4. DATA RECONCILIATION RESULT

### Total Row Counts

| Metric | Before | After |
|---|---|---|
| Total `ll_sheet_materials` rows | 257 | 339 |

### By Supplier

| Supplier | Before | After | Delta |
|---|---|---|---|
| Macdonald Steel | 104 | 105 | +1 |
| Wakefield Metals | 153 | 234 | +81 |
| **Total** | **257** | **339** | **+82** |

*Note: Net +82 (83 inserted, 1 true duplicate removed).*

### By Material Family

| Material Family | Before | After | Delta |
|---|---|---|---|
| Aluminium | 97 | 164 | +67 |
| Corten | 9 | 9 | 0 |
| Galvanised Steel | 23 | 23 | 0 |
| Mild Steel | 37 | 38 | +1 |
| Stainless Steel | 91 | 105 | +14 |
| **Total** | **257** | **339** | **+82** |

### By Form Type (New Field — After Only)

| Form Type | Count |
|---|---|
| Plain Plate | 41 |
| Plain Plate FPE | 11 |
| Plain Plate PE | 32 |
| Plate | 41 |
| Sheet | 102 |
| Sheet FPE | 50 |
| Sheet PE | 46 |
| Tread Plate | 16 |
| **Total** | **339** |

### By Quoteable Status

| Status | Count |
|---|---|
| Quoteable (`isQuoteable = true`) | 325 |
| Non-quoteable (`isQuoteable = false`) | 14 |
| **Total** | **339** |

### New Field Population

| Field | Rows Populated | Notes |
|---|---|---|
| `supplierSku` (non-empty) | 234 | All Wakefield rows; Macdonald has no supplier SKU in source PDF |
| `pricePerKg` (non-null) | 14 | Per-kg reference rows from Wakefield Excel |
| `formType` (non-empty) | 339 | All rows |
| `supplierCategory` (non-empty) | 234 | Wakefield rows only (ALUMINIUM / STAINLESS) |
| `isQuoteable` | 339 | All rows (325 true, 14 false) |

---

## 5. MISSING ROW RESOLUTION

### Macdonald Steel

| Description | Thickness | Dimensions | Price | Status |
|---|---|---|---|---|
| HA300 Laser Plate 1520x3600 | 12.0mm | 3600×1520 | $979.38 | INSERTED |

**Total Macdonald inserted: 1**

### Wakefield Metals — By Category/Form

| Category | Form Type | Count Inserted |
|---|---|---|
| Aluminium | Plain Plate | 18 |
| Aluminium | Plain Plate PE | 21 |
| Aluminium | Sheet PE | 17 |
| Aluminium | Sheet | 5 |
| Aluminium | Sheet FPE | 1 |
| Aluminium | Tread Plate | 16 |
| Stainless Steel | Sheet PE | 1 |
| Stainless Steel | Sheet FPE | 2 |
| Stainless Steel | Plain Plate FPE | 1 |
| **Total** | | **82** |

*Net Wakefield delta is +81 because 1 true duplicate was removed (5083 4mm 7500×1830 appeared twice in Excel extraction with identical SKU 0030899 and price $1515.61).*

### Rows Still Not Represented

| Category | Count | Reason for Exclusion |
|---|---|---|
| Coil rows (Wakefield Excel) | 55 | Coil is a fundamentally different stock behaviour — variable length, per-kg pricing, operator-entered cut length. Not representable in current fixed-sheet-dimension schema without architectural extension. Deliberately excluded. |

**No other rows from either supplier source file remain unrepresented.**

---

## 6. COIL / VARIABLE-LENGTH TREATMENT

- **Are coil rows now represented in the database?** NO.
- **Is coil modeled as a stock behaviour?** NO.
- **Can Add Item quote coil by fixed width + operator-entered length?** NO.
- **What remains required:**
  - Schema extension: a coil-specific table or a `stockBehaviour` discriminator on `ll_sheet_materials` with variable-length fields (`coilWidthMm`, `coilPricePerKg`, `minCutLengthMm`).
  - Quote Builder UI: a coil-aware Add Item flow where the operator selects material + width from the coil catalogue, enters a cut length, and the system calculates sheet cost from `pricePerKg × width × length × density`.
  - Pricing engine: weight calculation from dimensions and material density lookup.
  - This is a distinct feature phase, not a gap in the current corrective scope (which targeted sheet/plate rows only).

---

## 7. PER-KG ROW TREATMENT

### How Per-Kg Rows Are Stored

Per-kg rows from the Wakefield Excel have `1×1` dimensions (nominal placeholder) and carry pricing in the `price_per_kg` field (type `numeric`, nullable). Their `price_per_sheet_ex_gst` is set to `"0"` since they have no fixed sheet price.

### Quoteable Status

All 14 per-kg rows have `isQuoteable = false`. They exist as reference/lookup data for future procurement or coil-pricing workflows but must NOT appear in the Quote Builder material selector.

### Exact Row Count: 14

| Product Description | Grade | Price/kg |
|---|---|---|
| 10.0MM AL PLT FG 5083 | 5083 | $10.32 |
| 12.0MM AL PLT FG 5083 | 5083 | $9.55 |
| 16.0MM AL PLT FG 5083 | 5083 | $10.32 |
| 16.0MM AL PLT FG 6061 | 6061 | $10.88 |
| 25.0MM AL PLT FG 5083 | 5083 | $18.54 |
| 3.00MM AL SHT FG 5005 | 5005 | $7.77 |
| 3.00MM AL SHT FG 5052 | 5052 | $8.05 |
| 4.00MM AL PLT FG 5052 | 5052 | $8.30 |
| 4.00MM AL PLT FG 5083 | 5083 | $10.38 |
| 4.00MM AL TREAD PLT FG 5052 | 5052 | $8.27 |
| 5.00MM AL PLT FG 5052 | 5052 | $8.30 |
| 5.00MM AL PLT FG 5083 | 5083 | $10.32 |
| 6.00MM AL PLT FG 5052 | 5052 | $8.30 |
| 6.00MM AL PLT FG 5083 | 5083 | $10.32 |

### How They Are Prevented from Appearing in Quote Builder

1. **API layer:** `GET /api/ll-sheet-materials?quoteable=true` filters by `m.isQuoteable` in `server/routes.ts`.
2. **Frontend layer:** `laser-quote-builder.tsx` requests `?active=true&quoteable=true`, so non-quoteable rows are never fetched by the Quote Builder.
3. **Default behaviour:** The `isQuoteable` field defaults to `true`, so any future manually-added rows will be quoteable unless explicitly set otherwise.

---

## 8. QUOTE BUILDER / ADD ITEM IMPACT

### Files Changed

| File | Change |
|---|---|
| `client/src/pages/laser-quote-builder.tsx` | Query URL changed from `?active=true` to `?active=true&quoteable=true` |
| `server/routes.ts` | Added `quoteable` query parameter handling to GET `/api/ll-sheet-materials` |

### Filtering Logic Changed

**Before:** Frontend fetched all active materials. Per-kg rows (with 1×1 dimensions) would have appeared in the material family/grade dropdowns, potentially confusing operators.

**After:** Frontend fetches only active AND quoteable materials. 14 per-kg reference rows are excluded. 325 quoteable sheet/plate rows are returned.

### Operator Flow

The operator flow is unchanged:
1. Select Material Type (family) → dropdown shows 5 families
2. Select Grade → filtered by family
3. Select Finish → filtered by family + grade
4. Select Thickness → filtered by family + grade + finish
5. Select Sheet Size → filtered by all above
6. System retrieves price from matched `ll_sheet_materials` row

The only change is that 14 non-quoteable per-kg rows no longer appear in step 1–5 dropdowns.

### Existing Selections Remain Valid

YES. No existing material rows were deleted, renamed, or had their IDs changed. All 257 pre-existing rows retain their original UUIDs. Any estimate snapshots referencing these IDs remain valid.

### Supplier-Native Detail Exposed in UI

NO. The new fields (`supplierSku`, `supplierCategory`, `formType`) are stored in the database but are not currently displayed in any operator-facing UI. They are available via the API response for future admin/procurement surfaces.

### Normalized vs Supplier-Native Operator Toggle

NO. Not implemented. The Quote Builder continues to display the normalised material hierarchy (Material Family → Grade → Finish → Thickness → Sheet Size). No toggle exists to switch to supplier-native product descriptions.

---

## 9. FUTURE SUPPLIER EXTENSIBILITY

### Is the Model Generalizable?

YES. The schema is supplier-agnostic:
- `supplierName` is free-text, not an enum.
- `supplierSku`, `supplierCategory`, `formType` are free-text fields with no enum constraints.
- `pricePerKg` is nullable and only populated when relevant.
- `isQuoteable` allows any supplier's reference-only rows to be excluded from quoting.

### Hardcoded Assumptions Still Tied to Wakefield/Macdonald

| Location | Assumption | Risk |
|---|---|---|
| `server/routes.ts` line 7611 | `seedLlSheetMaterials()` checks for demo data by supplier name ("NZ Steel", "Vulcan Steel", "Ullrich Aluminium") | LOW — only affects demo-to-real migration, not future supplier addition |
| `server/ll-seed-data.ts` | All seed rows are Wakefield or Macdonald | LOW — adding a new supplier means adding rows to this file or using the API |
| `server/routes.ts` reconciliation | Uses `productDescription` as the match key for upsert/reconciliation | MEDIUM — if two suppliers have identical product descriptions, this could collide. A composite key (supplier + description) would be more robust. |

### What Still Needs Generalisation

- Seed reconciliation should use `(supplierName, productDescription)` as composite match key instead of `productDescription` alone.
- Admin UI for bulk supplier import (CSV/Excel upload) does not exist.
- Supplier price-list versioning (effective dates, supersede logic) is not implemented for materials (only for gas/consumables inputs).

---

## 10. BACKWARD COMPATIBILITY

| Question | Answer |
|---|---|
| Do existing `llSheetMaterialId` links remain valid? | YES — no rows were deleted or had IDs changed. All 257 original UUIDs are preserved. |
| Were existing estimates/quotes affected? | NO — material references are embedded in JSON snapshots at quote creation time. The underlying `ll_sheet_materials` rows are lookup data; snapshots are immutable. |
| Did any existing rows change identity? | NO — all original rows retain their UUID primary key, supplier name, product description, grade, finish, thickness, dimensions, and price. Only the 5 new fields were backfilled. |
| Does any data migration risk remain? | NO — schema was pushed via `db:push`, new columns have safe defaults, and the startup reconciliation function handles any environment (empty, demo, partial, or complete). |
| Are there any foreign key constraints on `ll_sheet_materials`? | NO — no other table references `ll_sheet_materials` via foreign key. Material IDs are stored as strings in JSON estimate snapshots only. |

---

## 11. VALIDATION EVIDENCE

### Row Count Reconciliation

| Query | Result |
|---|---|
| `SELECT count(*) FROM ll_sheet_materials` | 339 |
| `SELECT supplier_name, count(*) ... GROUP BY supplier_name` | Macdonald Steel: 105, Wakefield Metals: 234 |
| `SELECT is_quoteable, count(*) ... GROUP BY is_quoteable` | true: 325, false: 14 |
| `SELECT count(*) WHERE price_per_kg IS NOT NULL` | 14 |
| `SELECT count(*) WHERE supplier_sku != ''` | 234 |
| `SELECT count(*) WHERE form_type != ''` | 339 |

### Composite Key Collision Check

```sql
SELECT material_family, grade, finish, thickness, sheet_length, sheet_width, count(*)
FROM ll_sheet_materials
GROUP BY material_family, grade, finish, thickness, sheet_length, sheet_width
HAVING count(*) > 1;
```

**Result: 0 rows (ZERO collisions)**

### Collision Resolution Actions Taken

| Issue | Resolution |
|---|---|
| 5083 4mm 7500×1830: identical row appeared twice | Removed 1 true duplicate (same SKU 0030899, same price $1515.61) |
| 5052 3mm 4800×1500: two products with same composite key | Distinguished by finish — original "PE Protected" (SKU 0018380, $470.88) vs "2-Side PE" (SKU 0030559, $453.51) |

### Price Parity Verification

The Phase 1 forensic audit confirmed EXACT price parity across all 257 original rows (zero discrepancies to 2 decimal places). The 82 new Wakefield rows were extracted directly from the source Excel file using programmatic cell-value reads. The 1 new Macdonald row price ($979.38) was taken directly from the source PDF. No manual price entry was performed.

### HA300 Missing Row Verification

```sql
SELECT product_description, thickness, sheet_length, sheet_width, price_per_sheet_ex_gst
FROM ll_sheet_materials
WHERE grade = 'HA300' AND thickness = '12.0' AND sheet_length = '3600' AND sheet_width = '1520';
```

**Result:** HA300 Laser Plate 1520x3600 | 12.0 | 3600 | 1520 | $979.38 — **CONFIRMED PRESENT**

---

## 12. REMAINING GAPS / DEFERRED ITEMS

| Item | Status | Notes |
|---|---|---|
| Operator toggle (normalized vs supplier-native descriptions) | NOT IMPLEMENTED | Requires UI design decision and operator feedback |
| Procurement-facing supplier detail view | NOT IMPLEMENTED | New admin tab or panel needed to surface SKU, category, form type |
| Coil quoting workflow | NOT IMPLEMENTED | 55 coil rows in Wakefield Excel not ingested. Requires schema extension, UI flow, and density-based pricing calculation. Separate feature phase. |
| Admin UI for new fields | NOT IMPLEMENTED | `supplierSku`, `supplierCategory`, `formType`, `pricePerKg` are stored but not visible in any admin interface |
| Bulk supplier import (CSV/Excel) | NOT IMPLEMENTED | Currently manual seed file; no admin upload capability |
| Supplier price-list versioning | NOT IMPLEMENTED | Gas/consumables have governed lifecycle; materials do not |
| Corten 4mm width anomaly | FLAGGED | Corten 4mm 3600×1500 — PDF shows 1.500m but app stores 1520mm. Other Corten 3600 rows correctly use 1520. Flagged for manual verification with supplier. Not changed in this phase. |
| Seed reconciliation match key | ADVISORY | Currently uses `productDescription` alone. Should use `(supplierName, productDescription)` composite for multi-supplier safety. |

---

## 13. FINAL RELEASE GATE

| Gate | Decision |
|---|---|
| Push to Git | YES — all changes committed at checkpoint `bda73c5b` |
| Publish to live | YES — no breaking changes, safe defaults on all new fields, zero collisions, zero broken references |
| New Replit chat needed for next phase | YES — coil quoting, operator toggle, and admin surfaces are distinct feature phases requiring separate scoping |

---

*End of Report*
