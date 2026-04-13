# Phase 6B — LL Stucco vs Mill Reconciliation Report

---

## 1. Scope

### What this pass was asked to investigate

This pass was tasked with determining whether Aluminium Stucco embossed and standard Mill sheet products are being collapsed into the same filter/display bucket in LL Add Item and, if so, fixing only that defect class.

The exact case investigated:

- **Material family**: Aluminium
- **Grade**: 5005
- **Thickness**: 0.9mm
- **Sheet size**: 2400×1200
- **Suspected collision**: standard mill sheet (`0.9X1200X2400 5005H32 AL SHT`) and stucco embossed sheet (`0.9X1200X2400 5005 AL SHT STUCCO`) both classified under `finish = "Mill"`

### What was explicitly out of scope

- Full LL materials audit
- Supplier harmonization across all grades and finishes
- Broad taxonomy cleanup
- Source-import pipeline rewrite
- Pricing engine changes
- Lifecycle or workflow changes
- Page redesign or admin IA changes
- Publishing to live
- Unrelated bug fixes found during investigation

---

## 2. Supplier-Source Truth

### Source document

**File**: `attached_assets/Wakefield_Metals_Aluminium_&_Stainless_Steel_Pricing_42A2_01-_1775973960728.xlsx`
**Sheet**: `Pricing 42A2`

### Relevant source rows for Aluminium 5005 / 0.9mm / 2400×1200

| # | Item # | Form Type & Film | Product Description | Width | Length | Price/EA |
|---|--------|-----------------|---------------------|-------|--------|----------|
| 1 | 0000470 | Sheet | 0.9X1200X2400 5005H32 AL SHT | 1200 | 2400 | $58.65 |
| 2 | 0019175 | Sheet | 0.9X1200X2400 5005 AL SHT STUCCO | 1200 | 2400 | $58.73 |
| 3 | 0014742 | Sheet PE | 0.9X1200X2400 5005H32 AL SHTPE | 1200 | 2400 | $53.53 |

### Classification of each row

| # | Source Form Type | Surface Treatment | Physical Difference |
|---|-----------------|-------------------|---------------------|
| 1 | Sheet (plain, no film) | Standard smooth mill finish | Smooth flat aluminium sheet |
| 2 | Sheet (plain, no film) | Stucco embossed | Mechanically textured/embossed surface pattern |
| 3 | Sheet PE (PE protective film) | PE Protected | Standard sheet with polyethylene protective film |

Row 1 and Row 2 are physically different products. Standard mill has a smooth surface; stucco has a mechanically embossed decorative pattern. They serve different applications. The Wakefield source classifies both under the same Form Type ("Sheet") — unlike the PE vs Fibre PE case where the supplier used distinct form types ("Sheet PE" vs "Sheet FPE"). The distinction is carried only in the product description ("AL SHT" vs "AL SHT STUCCO").

---

## 3. Imported Active LL Library Truth

### Pre-fix database state

Both records existed in `ll_sheet_materials` as active records, both classified under `finish = "Mill"`:

| DB ID (prefix) | Product Description | Finish | Thickness | Sheet Size | Price | Active |
|-----------------|---------------------|--------|-----------|------------|-------|--------|
| `366df663` | 0.9X1200X2400 5005H32 AL SHT | Mill | 0.9 | 2400×1200 | $58.65 | Yes |
| `fb0de8cf` | 0.9X1200X2400 5005 AL SHT STUCCO | Mill | 0.9 | 2400×1200 | $58.73 | Yes |

Both records shared the same composite key path: `Aluminium / 5005 / Mill / 0.9mm / 2400×1200`.

### Scope of collision

This is the **only** stucco record in the entire `ll_sheet_materials` table. No other grades, thicknesses, or sheet sizes have a stucco variant imported. The collision is limited to this single record.

### Post-fix database state

| DB ID (prefix) | Product Description | Finish | Thickness | Sheet Size | Price | Active |
|-----------------|---------------------|--------|-----------|------------|-------|--------|
| `366df663` | 0.9X1200X2400 5005H32 AL SHT | Mill | 0.9 | 2400×1200 | $58.65 | Yes |
| `fb0de8cf` | 0.9X1200X2400 5005 AL SHT STUCCO | **Stucco** | 0.9 | 2400×1200 | $58.73 | Yes |

### Aluminium finish distribution after fix

| Finish | Count |
|--------|-------|
| Fibre PE | 10 |
| Mill | 38 |
| PE Protected | 38 |
| Stucco | 1 |
| **Total** | **87** |

---

## 4. Add Item UI Truth

### Pre-fix UI behaviour

When the operator selected `Aluminium → 5005 → Mill → 0.9mm`, the sheet size selector showed **2 entries** for the 2400×1200 sheet size:

- `2400mm x 1200mm — $58.65 (Wakefield Metals)` (standard mill)
- `2400mm x 1200mm — $58.73 (Wakefield Metals)` (stucco embossed)

These two entries were **indistinguishable to the operator** in the UI. Both showed the same dimensions and supplier. The only visible difference was an $0.08 price difference, which provided no meaningful signal about which product is which. The operator had no way to know that one entry was a smooth mill sheet and the other was a stucco embossed sheet.

### Post-fix UI behaviour

After the fix, the selection paths are separated:

**Path 1**: `Aluminium → 5005 → Mill → 0.9mm`
- 1 sheet size: 2400×1200 at $58.65 (standard mill sheet)
- No sheet size dropdown required (auto-selected)

**Path 2**: `Aluminium → 5005 → Stucco → 0.9mm`
- 1 sheet size: 2400×1200 at $58.73 (stucco embossed sheet)
- No sheet size dropdown required (auto-selected)

The finish dropdown for `Aluminium → 5005` now shows: Fibre PE, Mill, PE Protected, Stucco.

---

## 5. Root Cause Analysis

### Does a real same-key/operator-facing defect exist?

**YES.** This is a confirmed operator-facing defect.

### Exact cause

During the creation of `server/ll-seed-data.ts`, the stucco embossed record was assigned `finish: "Mill"` — the same value used for standard smooth mill sheets. This collapsed two physically different products into the same filter path.

Unlike the PE vs Fibre PE case, where the Wakefield source provided distinct Form Type values ("Sheet PE" vs "Sheet FPE") that could have guided correct classification, the stucco record shares the same Form Type ("Sheet") as the standard mill record. The only distinguishing marker is the word "STUCCO" in the product description. This made the misclassification easier to overlook during seed data creation.

### Why this is a defect requiring correction

1. **Operator cannot distinguish the products**: Two materially different products (smooth vs embossed) appear as near-identical entries differentiated only by an $0.08 price gap
2. **Wrong material selection risk**: An operator could select the stucco sheet when they intended standard mill, or vice versa, leading to incorrect material on the job
3. **Pricing integrity**: Though the price difference is small ($0.08), the products serve different applications and selecting the wrong one misrepresents the material specification

### Why this is a separate defect class from PE vs Fibre PE

The PE vs Fibre PE defect involved 10 records across two grades (5005, 5052) and multiple thicknesses, where the supplier's distinct Form Type ("Sheet FPE") should have been mapped to a distinct finish but was collapsed into "PE Protected." The stucco defect involves a single record where the supplier uses the same Form Type ("Sheet") for both standard and stucco, with only the product description carrying the distinction. They are separate classification errors with different root causes.

---

## 6. Files Changed

| File | Change |
|------|--------|
| `server/ll-seed-data.ts` | 1 line changed: `finish: "Mill"` → `finish: "Stucco"` for the single Aluminium stucco record |
| `reports/phase-6b-ll-stucco-vs-mill-reconciliation-report.md` | Created — this report |

### Live database change

```sql
UPDATE ll_sheet_materials
SET finish = 'Stucco'
WHERE id = 'fb0de8cf-873f-4dad-8f0b-6313d9dcd655'
  AND finish = 'Mill'
  AND product_description LIKE '%STUCCO%';
-- 1 row affected
```

No schema changes. No new columns. No new tables. No index changes.

---

## 7. Behaviour Impact

**Runtime behaviour changed in this pass.**

- The stucco embossed sheet record is now classified under `finish = "Stucco"` instead of `finish = "Mill"`
- Add Item now shows "Stucco" as a separate finish option for Aluminium / 5005
- The standard Mill path for 5005 / 0.9mm / 2400×1200 now correctly resolves to a single record (no ambiguous dropdown)
- The Stucco path for 5005 / 0.9mm / 2400×1200 correctly resolves to its own single record
- No existing estimates reference the reclassified record (verified by query against `items_json`)
- Material ID `fb0de8cf` is unchanged — only the `finish` value was updated
- Pricing engine does not use the `finish` field — no pricing impact

---

## 8. Evidence and Test Scenarios

### Source and import truth

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Enumerate relevant supplier/source rows for 5005 / 0.9mm / 2400×1200 | **PASS** | Wakefield XLSX parsed: 3 rows at this spec — standard sheet (Item 0000470), stucco sheet (Item 0019175), PE sheet (Item 0014742) |
| 2 | Confirm whether both standard and stucco rows were imported into ll_sheet_materials | **PASS** | Both exist: `366df663` (standard) and `fb0de8cf` (stucco), both active |
| 3 | Confirm whether both imported records are active | **PASS** | Both `is_active = true` |

### Current data classification

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 4 | Confirm pre-fix database classification for both records | **PASS** | Both had: materialFamily=Aluminium, grade=5005, finish=Mill, thickness=0.9, sheetLength=2400, sheetWidth=1200. Only differences: productDescription and price ($58.65 vs $58.73) |
| 5 | Confirm whether both currently share the same finish bucket | **PASS** | Pre-fix: both under `finish = "Mill"`. Post-fix: standard under "Mill", stucco under "Stucco" |

### UI truth

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 6 | Confirm Add Item finish options shown for Aluminium / 5005 | **PASS** | Post-fix: Fibre PE, Mill, PE Protected, Stucco |
| 7 | Confirm what happens when operator selects Mill → 0.9mm | **PASS** | Post-fix: single record auto-selected (2400×1200, $58.65, standard mill). No ambiguous dropdown |
| 8 | Confirm whether the two records are operator-distinguishable | **PASS** | Post-fix: yes — separated into different finish buckets. Pre-fix: no — indistinguishable except for $0.08 price gap |
| 9 | Confirm whether current UI truth is misleading or acceptable | **PASS** | Post-fix: acceptable. Each product has its own unambiguous path |

### Fix validation

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 10 | Confirm two products are now truthfully separated | **PASS** | Standard mill at finish="Mill", stucco at finish="Stucco" — distinct filter paths |
| 11 | Confirm no valid record is lost | **PASS** | Both records remain active with unchanged IDs. Total Aluminium count remains 87 |
| 12 | Confirm Add Item selection/save still works correctly | **PASS** | Material ID `fb0de8cf` unchanged. Selection by `llSheetMaterialId` (primary key) unaffected. No estimates reference this record |
| 13 | Confirm no regression to pricing result | **PASS** | `finish` field not used in pricing calculations. `pricePerSheetExGst` unchanged. `computeItemPricing` uses `llSheetMaterialId` for material lookup |
| 14 | Confirm LJ/LE untouched | **PASS** | No LJ/LE files modified. `ll_sheet_materials` is LL-scoped. LJ and LE do not query this table |

### Safety check

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 15 | Confirm whether this pass required a runtime change or report-only outcome | **PASS** | Runtime change required and applied: 1 record reclassified from finish="Mill" to finish="Stucco" in both seed data and live database |

---

## 9. Acceptance Criteria Summary

| Criterion | Result | Evidence |
|-----------|--------|----------|
| Supplier/source truth for the exact case is explicitly enumerated | **PASS** | 3 source rows enumerated from Wakefield XLSX with item numbers, form types, descriptions, and prices |
| Imported active LL library truth for the exact case is explicitly enumerated | **PASS** | 2 colliding records mapped by DB ID with full classification values, pre- and post-fix |
| Add Item UI truth for the exact case is explicitly enumerated | **PASS** | Pre-fix: 2 indistinguishable entries in sheet size dropdown. Post-fix: separated into Mill and Stucco finish paths |
| It is explicitly determined whether a real same-key collision exists | **PASS** | Yes — both records shared identical filter key (family/grade/finish/thickness/dimensions). Operator could not distinguish them |
| If a real defect exists, the smallest safe correction is applied | **PASS** | Single record reclassified: `finish = "Mill"` → `finish = "Stucco"`. 1 line in seed data, 1 row in database |
| No schema or architecture drift occurs | **PASS** | No schema changes, no new tables/columns, no API changes, no filter logic changes |
| No unrelated workflow changes occur | **PASS** | No lifecycle, workflow, or page changes |
| Release gate is explicit and evidence-based | **PASS** | See Section 11 |

---

## 10. Deferred / Not in This Pass

### 10.1 Stainless Steel 304 Fibre PE sub-grade conflation

**What**: Multiple SS 304 sub-finishes (304/4, 3042B, 304BA, 304L2B) share the same grade/finish key, creating same-key duplicates similar to this stucco case but at much larger scale.

**Why deferred**: This is a sub-grade granularity defect involving dozens of records across multiple thicknesses. It requires a product taxonomy decision on how to represent sub-finishes (No.4, 2B, BA) and warrants its own investigation pass.

### 10.2 Cross-supplier grade normalization

**What**: Macdonald uses "304L"/"316L" while Wakefield uses "304"/"316" for nominally similar stainless alloys.

**Why deferred**: Not an operator-facing defect — different grade values mean different filter paths. No collision occurs. This is a normalization opportunity, not a filtering defect.

### 10.3 Broader stucco product inclusion

**What**: The Wakefield source contains a stucco coil product (`0.9X1200 5005H34 AL COIL STUCCO`) that was not imported. There may be other stucco sheet sizes at other thicknesses in the source that were also not imported.

**Why deferred**: Whether to import additional stucco products is an operational scope decision, not a data classification defect. The current fix ensures the one imported stucco record is correctly classified.

### 10.4 Import pipeline validation

**What**: No automated validation exists to prevent same-key collisions during seed data creation.

**Why deferred**: Per control header, import pipeline redesign is out of scope.

---

## 11. Release Gate

### Push to Git: YES

**Rationale**: The fix is narrow and bounded — 1 line changed in seed data, 1 row updated in the database. The change corrects a confirmed operator-facing defect where two physically different products (smooth mill vs stucco embossed) were indistinguishable in the Add Item UI. No existing estimates reference the affected record. No schema, API, or filter logic changes. The correction follows the same pattern as the prior PE vs Fibre PE fix (data classification only).

### Publish to live: NO

**Rationale**: Per the control header, publishing to live is explicitly out of scope for this pass.

---

*Report generated from verified evidence: Wakefield XLSX spreadsheet (Pricing 42A2), `server/ll-seed-data.ts` seed data, live database queries against `ll_sheet_materials`, and code-path verification of the Add Item filter cascade in `client/src/pages/laser-quote-builder.tsx`.*
