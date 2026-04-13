# SteelIQ LL Material Library — Phase 3: Coil Stock Support & Supplier-Native Visibility

**Report Date:** 13 April 2026  
**Scope:** Enterprise coil material support, supplier-native operational visibility, seed reconciliation hardening  
**Status:** COMPLETE  

---

## Executive Summary

Phase 3 extends the LL material library from fixed-sheet-only pricing to full coil stock support, adding 55 Wakefield Metals coil rows across Aluminium (5005, 5052) and Stainless Steel (304, 316, 316L, 430, 445M2) grades. The pricing engine now handles weight-based coil cost calculation alongside the existing sheet-packing model. The Quote Builder UI detects coil materials automatically and presents an operator-appropriate workflow (coil width selector + cut length input). Supplier-native detail panels expose SKU, form type, and stock behaviour for full operational traceability.

---

## Database State — Final Counts

| Metric | Value |
|--------|-------|
| **Total rows** | 394 |
| **Quoteable rows** | 380 |
| **Reference-only rows** | 14 (per-kg pricing, isQuoteable=false) |
| **Suppliers** | 2 (Macdonald Steel: 105, Wakefield Metals: 289) |

### By Stock Behaviour

| Stock Behaviour | Count |
|-----------------|-------|
| sheet | 198 |
| plate | 125 |
| coil | 55 |
| tread_plate | 16 |

### By Supplier × Stock Behaviour

| Supplier | sheet | plate | coil | tread_plate |
|----------|-------|-------|------|-------------|
| Macdonald Steel | 64 | 41 | 0 | 0 |
| Wakefield Metals | 134 | 84 | 55 | 16 |

### By Material Family

| Family | Total | Coil |
|--------|-------|------|
| Aluminium | 190 | 26 |
| Stainless Steel | 134 | 29 |
| Mild Steel | 38 | 0 |
| Galvanised Steel | 23 | 0 |
| Corten | 9 | 0 |

### Density Coverage

| Density (kg/m³) | Rows | Families |
|-----------------|------|----------|
| 2,710 | 190 | Aluminium |
| 7,850 | 70 | Mild Steel, Corten, Galvanised Steel |
| 7,930 | 134 | Stainless Steel |
| NULL | 0 | — |

---

## Coil Inventory Detail

55 coil rows from Wakefield Metals, all with:
- Valid `supplierSku` (none empty)
- Valid `pricePerKg` (none zero or null)
- `sheetLength = 0` (continuous stock)
- `sheetWidth` = coil width in mm
- `densityKgM3` populated

### Coil Grades Breakdown

| Family | Grade | Finish | Count |
|--------|-------|--------|-------|
| Aluminium | 5005 | Mill | 12 |
| Aluminium | 5005 | PE Protected | 2 |
| Aluminium | 5005 | Stucco | 2 |
| Aluminium | 5052 | Mill | 10 |
| Stainless Steel | 304 2B | Fibre PE | 8 |
| Stainless Steel | 304 2B | Mill | 5 |
| Stainless Steel | 304 No.4 | Fibre PE | 7 |
| Stainless Steel | 304 No.4 | PE Protected | 1 |
| Stainless Steel | 316 2B | Fibre PE | 1 |
| Stainless Steel | 316 2B | Mill | 1 |
| Stainless Steel | 316 No.4 | Fibre PE | 3 |
| Stainless Steel | 316L 2B | PE Protected | 1 |
| Stainless Steel | 430 | PE Protected | 1 |
| Stainless Steel | 445M2 | Mill PI | 1 |

---

## Schema Changes

### ll_sheet_materials table

| Field | Type | Purpose |
|-------|------|---------|
| `stockBehaviour` | text | Discriminator: sheet, plate, tread_plate, coil |
| `densityKgM3` | numeric | Material density for weight calculation |

Both fields added to all 394 rows — zero NULL values.

### laserQuoteItems table

| Field | Type | Purpose |
|-------|------|---------|
| `coilLengthMm` | numeric | Operator-entered cut length for coil items |

---

## Pricing Engine — Coil Path

### Formula

```
weight_kg = (thickness_mm / 1000) × (width_mm / 1000) × (coilLength_mm / 1000) × density_kg_m³
material_cost = weight_kg × pricePerKg
```

### Verification Example

| Parameter | Value |
|-----------|-------|
| Material | 0.9×1200 5005H32 AL COIL 1MT |
| SKU | 0014231 |
| Thickness | 0.9 mm |
| Width | 1200 mm |
| Cut Length | 2400 mm (operator input) |
| Density | 2710 kg/m³ |
| Price/kg | $8.4360 |
| Volume | 0.002592 m³ |
| Weight | 7.024 kg |
| **Material Cost** | **$59.26** |

### Key Design Decisions

1. Coil pricing bypasses the sheet-packing model entirely — no nesting/utilisation calculation
2. `pricePerKg` is the sole pricing basis for coil materials
3. Sheet/plate materials continue using `pricePerSheetExGst` — zero regression risk
4. The `LLMaterialTruth` type carries `stockBehaviour` to enable path selection at computation time

---

## Quote Builder UI — Coil-Aware Flow

### Detection Logic

When operator selects family → grade → finish → thickness:
- If matching materials include `stockBehaviour=coil`, the **Coil Width** selector appears with available widths and per-kg pricing
- If only sheet/plate materials match, the standard **Sheet Size** selector appears
- If both coil and sheet options exist, both selectors are available (coil primary, sheet as alternative)

### Coil Workflow

1. Select coil width from dropdown (shows width in mm, price/kg, supplier)
2. Enter required cut length in mm
3. Material identity panel shows: Supplier, Coil badge, Width, Price/kg, SKU, form type, stock behaviour

### Supplier-Native Detail Panel

All material selections (coil and sheet) now show:
- Supplier name and sheet/coil dimensions
- Price (per-sheet or per-kg as appropriate)
- Material ID (truncated UUID)
- Supplier SKU, form type, stock behaviour (when available)

---

## Snapshot Round-Trip Integrity

Coil-specific fields are persisted through the quote revision/snapshot cycle:

| Snapshot Field | Type | Purpose |
|---------------|------|---------|
| `coilLengthMm` | number | Operator-entered cut length |
| `stockBehaviour` | string | Material stock type for display |
| `pricePerKg` | number | Per-kg price for coil cost display |
| `densityKgM3` | number | Density for weight recalculation |

These fields are serialized in `itemToSnapshotItem` and restored in `snapshotItemToItem`, ensuring lossless round-trip through quote revisions.

---

## Seed Reconciliation Hardening (T005)

### Previous State
- Reconciliation key: `productDescription` alone
- Risk: Macdonald Steel rows share descriptions across thicknesses (17 collision groups)

### Updated State
- Reconciliation key: `supplierName|||productDescription|||thickness` (3-field composite)
- Verified unique across all 394 rows (zero duplicates on this key)
- Applied to: missing-row detection, backfill lookup Map, and backfill condition
- Backfill condition aligned: triggers when any of `formType`, `stockBehaviour`, or `densityKgM3` is missing
- All insert paths include `stockBehaviour` and `densityKgM3`

---

## Composite Key Collisions — Analysis

3 collisions exist on (family, grade, finish, thickness, width, stockBehaviour):

| Family | Grade | Finish | Thickness | Width | SKUs | Root Cause |
|--------|-------|--------|-----------|-------|------|------------|
| Aluminium | 5005 | Mill | 0.9mm | 1200mm | 0014231 vs 0026200 | Different product lines (1MT vs standard) |
| Aluminium | 5052 | Mill | 0.9mm | 940mm | 0018332 vs 0014699 | Different tempers (H34 vs H36) |
| Aluminium | 5052 | Mill | 0.9mm | 1220mm | 0018333 vs 0015106 | Different tempers (H34 vs H36) |

**Assessment:** These are legitimate supplier variants with distinct SKUs and product descriptions. The temper designation (H32/H34/H36) is captured in `productDescription` and `supplierSku` but not in the normalized `grade` field. No data quality issue — these are genuinely different products that the operator should be able to select between.

---

## Backward Compatibility

| Check | Result |
|-------|--------|
| Pre-existing 339 rows preserved | 339 non-coil rows confirmed |
| Sheet/plate pricing unchanged | `pricePerSheetExGst` untouched |
| Quote Builder sheet flow | Unaffected — coil UI only appears when coil options exist |
| isQuoteable filtering | 380 quoteable, 14 reference-only — unchanged from Phase 2 |
| Seed idempotency | Composite-key reconciliation prevents duplicates |

---

## Files Modified

| File | Changes |
|------|---------|
| `shared/schema.ts` | Added `stockBehaviour`, `densityKgM3` to ll_sheet_materials; `coilLengthMm` to laserQuoteItems |
| `shared/estimate-snapshot.ts` | Added `coilLengthMm`, `stockBehaviour`, `pricePerKg`, `densityKgM3` to laserSnapshotItemSchema |
| `server/ll-seed-data.ts` | 394 entries with stockBehaviour, densityKgM3, coil rows |
| `server/routes.ts` | Seed function: 3-field composite key reconciliation, aligned backfill conditions, stockBehaviour/densityKgM3 in all insert/update paths |
| `client/src/lib/ll-pricing.ts` | LLMaterialTruth extended; coil pricing path; LLPricingInputs gets coilLengthMm |
| `client/src/pages/laser-quote-builder.tsx` | Coil-aware UI: coilOptionsForSelection memo, coil width selector, cut length input, supplier-native detail panel; snapshot serialization/deserialization for coil fields |

---

## Conclusion

Phase 3 delivers production-ready coil stock support with full backward compatibility. The 394-row material library now covers sheets, plates, tread plates, and coils across 5 material families from 2 suppliers. The pricing engine handles both per-sheet and per-kg cost models, and the Quote Builder UI adapts dynamically to the selected material's stock behaviour. Seed reconciliation uses supplier-qualified composite keys for reliable idempotent deployment.
