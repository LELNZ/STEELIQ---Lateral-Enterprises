# Phase 6B — LL Material Filter Parity Report

## Scope

Investigate and correct the mismatch between LL source/library material records (governed supplier truth) and the LL Estimate "Add Item" filter results. Specifically: Aluminium / PE coated sheets / 3mm returning 6 items instead of the expected truthful result set.

## Current Verified Truth

### Data path
- **Add Item surface**: queries `GET /api/ll-sheet-materials?active=true`, then filters client-side in `laser-quote-builder.tsx` via cascading `useMemo` hooks (Material Family → Grade → Finish → Thickness → Sheet Size).
- **Governed library truth**: the `ll_sheet_materials` table, seeded from `server/ll-seed-data.ts` which was derived from the Wakefield Metals Aluminium & Stainless Steel Pricing sheet (42A2) and Macdonald Steel price list.
- **Both surfaces query the same underlying dataset** (`ll_sheet_materials` with `is_active = true`). The mismatch was caused by incorrect finish classification in the data, not a divergent query path.

### Supplier Source Analysis
- **Wakefield Metals source** (xlsx): Column D "FORM TYPE & FILM" distinguishes two PE coating types:
  - `Sheet PE` — standard PE protective film (product descriptions contain "AL SHTPE" or "AL PLTPE")
  - `Sheet FPE` — Fibre PE protective film (product descriptions contain "AL SHT FIBRE PE")
- **Macdonald Steel source** (PDF): Has no Aluminium records. Contains Stainless Steel, Mild Steel, Galvanised Steel, and Corten only. Not affected by this defect.

## Root Cause

### Classification error during seed data creation

10 Aluminium records from Wakefield with `Sheet FPE` (Fibre PE) form type were incorrectly classified with `finish = "PE Protected"` in the seed data. This is the same finish value used for standard `Sheet PE` products.

Meanwhile, all Stainless Steel `Sheet FPE` records were correctly classified with `finish = "Fibre PE"`. The inconsistency was Aluminium-specific.

### Why this caused the 6 vs expected-fewer mismatch

When an operator selects Aluminium → 5052 → PE Protected → 3mm in the Add Item filter:
- **Before fix**: 6 records returned (4 standard PE + 2 Fibre PE, mixed together)
- **After fix**: 4 records for "PE Protected" (standard PE only), 2 records for "Fibre PE" (properly separated)

The two extra items were:
1. `a3a6aa9d` — 3.0×1200×2400 5052H32 AL SHT FIBRE PE ($195.56) — Fibre PE, not standard PE
2. `052694d7` — 3.0×1500×3000 5052H32 AL SHT FIBRE PE ($305.56) — Fibre PE, not standard PE

### Supplier/source origin
All affected records are **Wakefield Metals** sourced. No Macdonald Steel records are affected. No cross-supplier contamination exists.

## Files Changed

1. `server/ll-seed-data.ts` — 10 lines changed: `finish: "PE Protected"` → `finish: "Fibre PE"` for all Aluminium records where `productDescription` contains "FIBRE PE"

## Before/After Behaviour

### Before
| Filter combination | Count |
|---|---|
| Aluminium / 5052 / PE Protected / 3mm | 6 records |
| Aluminium / 5005 / PE Protected / 3mm | 4 records |
| Aluminium / 5052 / Fibre PE / 3mm | (filter option did not exist for Aluminium) |

### After
| Filter combination | Count |
|---|---|
| Aluminium / 5052 / PE Protected / 3mm | 4 records |
| Aluminium / 5005 / PE Protected / 3mm | 2 records |
| Aluminium / 5052 / Fibre PE / 3mm | 2 records |
| Aluminium / 5005 / Fibre PE / 3mm | 2 records |

### Database change
- 10 records updated: `UPDATE ll_sheet_materials SET finish = 'Fibre PE' WHERE material_family = 'Aluminium' AND product_description LIKE '%FIBRE PE%' AND finish = 'PE Protected'`
- Total Aluminium finish distribution after fix: Mill (39), PE Protected (38), Fibre PE (10)

## Exact Mismatch Case Investigated

**Filter**: Aluminium → 5052 → PE Protected → 3mm

**Before fix (6 records)**:
1. 2400×1200 $175.17 [SHTPE] — standard PE ✓
2. 2400×1200 $195.56 [SHT FIBRE PE] — **Fibre PE, incorrectly included**
3. 3000×1200 $235.44 [SHTPE] — standard PE ✓
4. 3000×1500 $305.56 [SHT FIBRE PE] — **Fibre PE, incorrectly included**
5. 3000×1500 $294.30 [SHTPE] — standard PE ✓
6. 3600×1500 $353.16 [SHTPE] — standard PE ✓

**After fix (4 records)**: Items 1, 3, 5, 6 only. Items 2, 4 now correctly appear under "Fibre PE" finish.

## Test Scenarios

### Core parity test
1. **Reproduce mismatch**: PASS — confirmed 6 records before fix for 5052/PE Protected/3mm
2. **Identify extra records**: PASS — records `a3a6aa9d` and `052694d7` (Fibre PE misclassified as PE Protected)
3. **Apply fix**: PASS — seed data and live DB updated
4. **Re-test same filter**: PASS — 4 records for PE Protected, 2 for Fibre PE
5. **Confirm parity with governed truth**: PASS — Wakefield source "Sheet PE" = DB "PE Protected", "Sheet FPE" = DB "Fibre PE"

### Cross-supplier integrity test
6. **Extra record origin**: PASS — both extra records are Wakefield-derived. Macdonald has no Aluminium records.
7. **Same defect class in other records**: PASS — all 10 Aluminium FIBRE PE records across all grades/thicknesses corrected in one pass

### Rule integrity tests
8. **Exclusion reason verified**: PASS — excluded from PE Protected because they are genuinely a different finish type (Fibre PE)
9. **No valid records lost**: PASS — all 4 standard PE records remain in PE Protected; Fibre PE records moved to their own finish category
10. **Filter variation tests**:
    - Different thickness within same finish: PASS — e.g. 5052/PE Protected/2mm returns correct count
    - Different finish within Aluminium: PASS — Mill, PE Protected, Fibre PE all return correct counts
    - Different category: PASS — Stainless Steel, Mild Steel, etc. unaffected
11. **Material selection/save**: PASS — material IDs unchanged, `llSheetMaterialId` references remain valid
12. **Admin library visibility**: PASS — all records visible in admin view, correctly labelled

### Safety tests
13. **Pricing regression**: PASS — pricing uses `llSheetMaterialId` (unchanged), not finish label
14. **Demo/test governance**: PASS — no demo flags affected
15. **LJ/LE surfaces**: PASS — no changes to LJ/LE code paths

## Known Limits

- Existing estimates (LL-EST-0013, LL-EST-0014) that referenced the reclassified materials retain `finish: "PE Protected"` in their snapshot JSON. This is cosmetic only — pricing uses `llSheetMaterialId` which remains valid. Historical snapshots are not retroactively updated (correct behaviour for immutable snapshots).

## Deferred / Not in this pass

1. **Aluminium 5005 Mill 0.9mm duplicate**: Two records at 2400×1200 — one standard ("AL SHT") and one Stucco ("AL SHT STUCCO") — share the same grade/finish/thickness/dimensions. These are genuinely different surface treatments that should potentially have different finish values. Different defect class.

2. **Stainless Steel 304 Fibre PE sub-grade conflation**: Wakefield 304 records include sub-grades (304/4, 3042B, 304BA, 304L2B) that are different surface finishes within grade 304 but all classified as grade "304" with finish "Fibre PE". This creates same-dimension duplicates (e.g., 3 records at 0.9mm 2438×1219). Different defect class — requires grade or finish granularity refinement.

3. **Stainless Steel grade mismatch between suppliers**: Macdonald uses "304L" and "316L" grades; Wakefield uses "304" and "316". These don't cross-contaminate in filters (different grade values), but represent a normalization opportunity. Not in scope.

4. **Broader supplier import pipeline improvements**: The manual seed data approach that led to this misclassification could be improved with validation rules. Not in scope per control header.

## Release Gate

- Push to Git: YES
- Publish to live: NO
