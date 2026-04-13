# Wakefield Metals Forensic Verification Report

## 1. Executive Verdict

**The prior report's SKU values were NOT fabricated** — every ITEM# value reported matches the source workbook exactly. All 289 Wakefield source rows are present in the database with correct ITEM# → `supplierSku` mapping. All 55 coil rows are present, active, correctly categorised, and visible in the library UI.

The user's concern that "SKU values do not exist in the supplier workbook" is **not confirmed** by direct inspection. The prior report cited correct ITEM# values from column H of the workbook. However, the prior report may have been unclear about which column they were sourced from, which could have caused confusion.

The user's concern that "coil is not visible in the library" requires clarification — coil rows **are** present in the API response and rendered by the library UI code, but they appear only under the **Aluminium** and **Stainless Steel** tabs (which are LL-division tabs). If the user has a non-LL division selected, or has not clicked into the Aluminium/Stainless Steel tabs, they would not see coil rows.

---

## 2. Workbook Inspection Method

- **File**: `attached_assets/Wakefield_Metals_Aluminium_&_Stainless_Steel_Pricing_42A2_01-_1775973960728.xlsx`
- **Tool**: `xlsx` (SheetJS) library, reading raw cell values
- **Every row inspected programmatically** — no manual sampling

---

## 3. Worksheet(s) Used

| Property | Value |
|----------|-------|
| Workbook sheet count | 1 |
| Sheet name | **Pricing 42A2** |
| Total rows | 953 |
| Header row | Row 5 |
| Data rows start | Row 6 |
| Rows with ITEM# | 359 |
| Rows with valid CATEGORY | 289 (data rows) |
| Rows with blank CATEGORY | 69 (section headers / offcut pricing) |
| Row 3 note | "Price list is valid 30 days from issue date or while stocks last" |
| Row 4 note | "Coil and offcut pricing is per kg" |

### Column Layout (Row 5 Header)

| Column | Header | Purpose |
|--------|--------|---------|
| A | Hidden | Contains ITEM# value (duplicate of col H) |
| B | CATEGORY | ALUMINIUM or STAINLESS |
| C | ALLOY | 5005, 5052, 3042B, 304/4, 430, etc. |
| D | FORM TYPE & FILM | Sheet, Coil, Plain Plate, Tread Plate, etc. |
| E | THICKNESS | mm |
| F | WIDTH | mm |
| G | LENGTH | mm (1 or 0 for coil/ref rows) |
| H | ITEM # | Supplier SKU (7-digit zero-padded) |
| I | ITEM DESCRIPTION | Full product description |
| J | DOH / 3mth | Days on hand |
| K | WEIGHT FACTOR | Weight factor |
| L | SOH | Stock on hand |
| M | PRICE / EA | Price per sheet (or per kg for coil/offcut) |
| N | SPECIALS | Special pricing notes |
| O | NOTES | Additional notes |

**Critical finding**: Column A and Column H contain **identical values** in every data row (zero mismatches across all 359 rows). Both contain the ITEM# supplier SKU.

---

## 4. Exact Disputed-Row Evidence Table — 0.5mm Aluminium

| Excel Row | ITEM# | ITEM DESCRIPTION | Thick | Width | Length | PRICE/EA | Hidden? | DB ID | DB SKU | SKU Match | Stock | Active |
|-----------|-------|------------------|-------|-------|--------|----------|---------|-------|--------|-----------|-------|--------|
| 30 | 0000476 | 0.5X1200X2400 5005H32 AL SHT | 0.5 | 1200 | 2400 | 38.8843 | No | 08e2ebf3… | 0000476 | ✅ MATCH | sheet | YES |
| 178 | 0018982 | 0.5X595X1060 5005H34 AL SHT | 0.5 | 595 | 1060 | 6.2377 | No | 6e2e4e3a… | 0018982 | ✅ MATCH | sheet | YES |

**Verdict**: Both 0.5mm aluminium rows **exist in the source workbook** and are **faithfully represented in the database**.

---

## 5. SKU Mismatch Analysis

| Metric | Count |
|--------|-------|
| Source rows with ITEM# in CATEGORY rows | 289 |
| DB Wakefield Metals rows | 289 |
| Source-to-DB exact SKU matches | **289** |
| SKU mismatches | **0** |
| Source rows missing from DB | **0** |
| DB rows not in source | **0** |

**Verdict**: Every single source ITEM# exactly matches the corresponding DB `supplierSku` value. **Zero fabrication. Zero transformation. Zero reformatting.**

The ITEM# values are 7-digit zero-padded strings (e.g., `0000476`, `0018982`, `0013696`). They are stored in the database exactly as they appear in the workbook column H.

---

## 6. Coil Source Proof

**55 coil rows exist in the source workbook.** Every row is listed below with exact source evidence:

| Excel Row | ITEM# | ITEM DESCRIPTION | Thick | Width | Length | PRICE/EA ($/kg) | Hidden? | DB ID | DB SKU | SKU Match | Stock | Active |
|-----------|-------|------------------|-------|-------|--------|-----------------|---------|-------|--------|-----------|-------|--------|
| 6 | 0000513 | 0.7X1200 5005H32 AL COIL | 0.7 | 1200 | 1 | 8.4360 | No | match | 0000513 | ✅ MATCH | coil | YES |
| 8 | 0000519 | 0.7X1200 5005H34 AL COIL STUCCO | 0.7 | 1200 | 1 | 8.5470 | No | match | 0000519 | ✅ MATCH | coil | YES |
| 9 | 0014231 | 0.9X1200 5005H32 AL COIL 1MT | 0.9 | 1200 | 1 | 8.4360 | No | match | 0014231 | ✅ MATCH | coil | YES |
| 11 | 0022589 | 0.9X1200 5005H34 AL COIL STUCCO | 0.9 | 1200 | 1 | 8.5470 | No | match | 0022589 | ✅ MATCH | coil | YES |
| 12 | 0026200 | 0.9X1200 5005H32 AL COIL | 0.9 | 1200 | 1 | 8.4360 | No | match | 0026200 | ✅ MATCH | coil | YES |
| 13 | 0000508 | 1.2X1200 5005H32 AL COIL | 1.2 | 1200 | 1 | 8.4360 | No | match | 0000508 | ✅ MATCH | coil | YES |
| 15 | 0000505 | 1.6X1200 5005H32 AL COIL | 1.6 | 1200 | 1 | 8.4360 | No | match | 0000505 | ✅ MATCH | coil | YES |
| 16 | 0000501 | 2.0X1200 5005H32 AL COIL | 2 | 1200 | 1 | 8.4360 | No | match | 0000501 | ✅ MATCH | coil | YES |
| 17 | 0018333 | 0.9X1220 5052H34 AL COIL 1MT | 0.9 | 1220 | 1 | 8.3250 | No | match | 0018333 | ✅ MATCH | coil | YES |
| 19 | 0023234 | 2.0X1500 5005H32 AL COIL | 2 | 1500 | 1 | 8.4360 | No | match | 0023234 | ✅ MATCH | coil | YES |
| 20 | 0000498 | 3.0X1200 5005H32 AL COIL | 3 | 1200 | 1 | 8.4360 | No | match | 0000498 | ✅ MATCH | coil | YES |
| 21 | 0016585 | 3.0X1500 5005H32 AL COIL | 3 | 1500 | 1 | 8.4360 | No | match | 0016585 | ✅ MATCH | coil | YES |
| 22 | 0031170 | 1.6X1200 5005H32 AL COIL PE | 1.6 | 1200 | 0 | 8.2695 | No | match | 0031170 | ✅ MATCH | coil | YES |
| 23 | 0021750 | 0.9X1200 5005H32 AL COIL PE 1MT | 0.9 | 1200 | 1 | 8.1141 | No | match | 0021750 | ✅ MATCH | coil | YES |
| 26 | 0000522 | 2.5X1200 5052H32 AL COIL | 2.5 | 1200 | 1 | 8.1252 | No | match | 0000522 | ✅ MATCH | coil | YES |
| 60 | 0000500 | 2.5X1200 5005H32 AL COIL | 2.5 | 1200 | 1 | 8.4360 | No | match | 0000500 | ✅ MATCH | coil | YES |
| 81 | 0002908 | 1.5X1219 3042B SS COIL | 1.5 | 1219 | 1 | 6.6600 | No | match | 0002908 | ✅ MATCH | coil | YES |
| 83 | 0002942 | 1.2X914 304/4 SS COIL FIBRE PE | 1.2 | 914 | 1 | 5.3946 | No | match | 0002942 | ✅ MATCH | coil | YES |
| 85 | 0002944 | 1.2X1524 304/4 SS COIL FIBRE PE | 1.2 | 1524 | 1 | 6.7710 | No | match | 0002944 | ✅ MATCH | coil | YES |
| 87 | 0002946 | 1.5X1219 304/4 SS COIL FIBRE PE | 1.5 | 1219 | 1 | 6.7710 | No | match | 0002946 | ✅ MATCH | coil | YES |
| 91 | 0018332 | 0.9X940 5052H34 AL COIL 1MT | 0.9 | 940 | 1 | 8.3250 | No | match | 0018332 | ✅ MATCH | coil | YES |
| 92 | 0015106 | 0.9X1220 5052H36 AL COIL 1MT | 0.9 | 1220 | 1 | 8.3250 | No | match | 0015106 | ✅ MATCH | coil | YES |
| 97 | 0000520 | 3.0X1200 5052H32 AL COIL | 3 | 1200 | 1 | 8.1252 | No | match | 0000520 | ✅ MATCH | coil | YES |
| 102 | 0000524 | 2.0X1200 5052H32 AL COIL | 2 | 1200 | 1 | 8.1252 | No | match | 0000524 | ✅ MATCH | coil | YES |
| 103 | 0013162 | 0.6X1219 3042B SS COIL (FLUE) | 0.6 | 1219 | 1 | 5.1615 | No | match | 0013162 | ✅ MATCH | coil | YES |
| 104 | 0000525 | 2.0X1500 5052H32 AL COIL | 2 | 1500 | 1 | 8.1252 | No | match | 0000525 | ✅ MATCH | coil | YES |
| 107 | 0013474 | 0.9X1219 430/4 SS COIL PE | 0.9 | 1219 | 1 | 2.5530 | No | match | 0013474 | ✅ MATCH | coil | YES |
| 108 | 0000521 | 3.0X1500 5052H32 AL COIL | 3 | 1500 | 1 | 8.1252 | No | match | 0000521 | ✅ MATCH | coil | YES |
| 134 | 0014699 | 0.9X940 5052H36 AL COIL 1MT | 0.9 | 940 | 1 | 8.9355 | No | match | 0014699 | ✅ MATCH | coil | YES |
| 159 | 0018373 | 0.9X610 5005H34 AL COIL | 0.9 | 610 | 1 | 6.9930 | No | match | 0018373 | ✅ MATCH | coil | YES |
| 195 | 0022295 | 2.0X1219 304L2B SS COIL | 2 | 1219 | 0 | 4.9950 | No | match | 0022295 | ✅ MATCH | coil | YES |
| 202 | 0023661 | 1.6X1500 5005H32 AL COIL | 1.6 | 1500 | 0 | 7.6590 | No | match | 0023661 | ✅ MATCH | coil | YES |
| 204 | 0024124 | 3.0X1219 304L2B SS COIL | 3 | 1219 | 1 | 4.9950 | No | match | 0024124 | ✅ MATCH | coil | YES |
| 214 | 0024867 | 1.2X1219 3042B SS COIL FIBRE PE | 1.2 | 1219 | 1 | 5.2170 | No | match | 0024867 | ✅ MATCH | coil | YES |
| 215 | 0024868 | 1.5X1219 3042B SS COIL FIBRE PE | 1.5 | 1219 | 1 | 5.5167 | No | match | 0024868 | ✅ MATCH | coil | YES |
| 216 | 0024869 | 2.0X1219 304L2B SS COIL FIBRE PE | 2 | 1219 | 1 | 6.6600 | No | match | 0024869 | ✅ MATCH | coil | YES |
| 239 | 0013677 | 0.55X1219 3042B SS COIL | 0.55 | 1219 | 1 | 5.1615 | No | match | 0013677 | ✅ MATCH | coil | YES |
| 241 | 0026439 | 0.9X1219 304/4 SS COIL FIBRE PE | 0.9 | 1219 | 1 | 5.2170 | No | match | 0026439 | ✅ MATCH | coil | YES |
| 242 | 0027702 | 1.2X1219 304/4 SS COIL FIBRE PE | 1.2 | 1219 | 1 | 5.2170 | No | match | 0027702 | ✅ MATCH | coil | YES |
| 247 | 0025757 | 1.5X1524 3042B SS COIL FIBRE PE | 1.5 | 1524 | 1 | 6.6600 | No | match | 0025757 | ✅ MATCH | coil | YES |
| 261 | 0026011 | 0.9X510 5052H34 AL COIL | 0.9 | 510 | 1 | 7.4370 | No | match | 0026011 | ✅ MATCH | coil | YES |
| 263 | 0026114 | 0.9X1524 304L2B SS COIL FIBRE PE | 0.9 | 1524 | 0 | 5.5167 | No | match | 0026114 | ✅ MATCH | coil | YES |
| 266 | 0013694 | 0.7X1219 3042B SS COIL FIBRE PE | 0.7 | 1219 | 1 | 5.1615 | No | match | 0013694 | ✅ MATCH | coil | YES |
| 268 | 0027520 | 0.9X1219 304L2B SS COIL FIBRE PE | 0.9 | 1219 | 0 | 5.6610 | No | match | 0027520 | ✅ MATCH | coil | YES |
| 276 | 0026899 | 1.2X1524 304L2B SS COIL FIBRE PE | 1.2 | 1524 | 1 | 5.5500 | No | match | 0026899 | ✅ MATCH | coil | YES |
| 279 | 0027010 | 2.0X1219 304/4 SS COIL FIBRE PE | 2 | 1219 | 1 | 6.7710 | No | match | 0027010 | ✅ MATCH | coil | YES |
| 284 | 0027232 | 1.5X1524 304/4 SS COIL FIBRE PE | 1.5 | 1524 | 1 | 6.7710 | No | match | 0027232 | ✅ MATCH | coil | YES |
| 296 | 0027796 | 2.0X1219 316L2B SS COIL FIBRE PE | 2 | 1219 | 1 | 8.8800 | No | match | 0027796 | ✅ MATCH | coil | YES |
| 302 | 0028045 | 1.2X1219 316/4 SS COIL FIBRE PE | 1.2 | 1219 | 1 | 7.7700 | No | match | 0028045 | ✅ MATCH | coil | YES |
| 303 | 0028046 | 1.5X1219 316/4 SS COIL FIBRE PE | 1.5 | 1219 | 1 | 9.4350 | No | match | 0028046 | ✅ MATCH | coil | YES |
| 305 | 0028049 | 0.9X1219 316/4 SS COIL FIBRE PE | 0.9 | 1219 | 1 | 8.4138 | No | match | 0028049 | ✅ MATCH | coil | YES |
| 317 | 0028991 | 0.55X1219 304/4 SS COIL PE | 0.55 | 1219 | 1 | 5.3946 | No | match | 0028991 | ✅ MATCH | coil | YES |
| 340 | 0013696 | 0.55X1219 3162B SS COIL | 0.55 | 1219 | 1 | 8.7135 | No | match | 0013696 | ✅ MATCH | coil | YES |
| 341 | 0027760 | 0.7X1500 316L2B SS COIL PE | 0.7 | 1500 | 0 | 8.6580 | No | match | 0027760 | ✅ MATCH | coil | YES |
| 953 | 0030289 | 0.55X1219 445M2 2DR SS COIL PI | 0.55 | 1219 | 1 | 11.6470 | No | match | 0030289 | ✅ MATCH | coil | YES |

**55/55 coil rows present in source. 55/55 matched in database. Zero SKU mismatches. All active.**

---

## 7. Coil Database Proof

```sql
SELECT stock_behaviour, COUNT(*) FROM ll_sheet_materials
WHERE supplier_name = 'Wakefield Metals' AND stock_behaviour = 'coil'
GROUP BY stock_behaviour;
```

| stock_behaviour | count |
|-----------------|-------|
| coil | **55** |

### Breakdown by material family:

| Material Family | Coil Count |
|-----------------|------------|
| Aluminium | 26 |
| Stainless Steel | 29 |
| **Total** | **55** |

### All coil rows: `is_active = true` (55/55)

---

## 8. Coil Library Visibility Proof

### Code Path Analysis

1. **API endpoint**: `GET /api/ll-sheet-materials` — returns ALL materials (no `active` or `quoteable` filter applied by library page)
2. **Storage method**: `getLlSheetMaterials(false)` — no filtering, returns all rows ordered by `materialFamily`, `thickness`
3. **Client filter**: `materials.filter(m => m.materialFamily === materialFamily)` — filters by tab family (e.g., "Aluminium")
4. **Stock filter default**: `filterStockType` initialises to `"all"` — coil rows are **included by default**
5. **Coil rendering**: Code at line 4164-4195 explicitly handles `stockBehaviour === 'coil'`:
   - Shows blue badge with text "coil"
   - Shows dimension as `{width}mm wide` instead of `LxW`
   - Shows price as `$X.XXXX/kg` instead of `$X.XX/sht`

### Where Coil Rows Appear

Coil rows appear under these library tabs:
- **Aluminium** tab (26 coil rows)
- **Stainless Steel** tab (29 coil rows)

These tabs are **only visible** when:
- Division Scope filter is set to **"All"** (default), OR
- Division Scope filter is set to **"LL"**

If the user has selected division "LJ" or "LE", the Aluminium and Stainless Steel tabs are **hidden** because they are owned by the LL division (`CATEGORY_OWNERSHIP` at line 132-138).

### Possible Reason User Cannot See Coil

The most likely cause is the **Division Scope filter**:
- Default tab on page load is `"direct_materials"` (line 246), not an LL material tab
- If the user's URL has `?division=LJ` or `?division=LE`, the LL tabs (Aluminium, Stainless Steel) won't appear
- The user needs to either set Division Scope to "All" or "LL", then click the "Aluminium" or "Stainless Steel" tab

### Exact Query/Filter Logic

```typescript
// library.tsx line 3971 — family filter
const familyMaterials = materials.filter(m => m.materialFamily === materialFamily);

// library.tsx line 3977 — stock type options derived from data
const stockTypes = [...new Set(familyMaterials.map(m => m.stockBehaviour || "sheet"))].sort();

// library.tsx line 3984 — stock filter (default "all" = no filtering)
if (filterStockType !== "all") filtered = filtered.filter(m => (m.stockBehaviour || "sheet") === filterStockType);

// library.tsx line 3965 — filter defaults to "all"
const [filterStockType, setFilterStockType] = useState<string>("all");
```

**No code-level bug prevents coil from displaying.** The issue is navigation: the user must be on the correct division scope and tab.

---

## 9. Corrections Made

**No corrections were required.** The forensic investigation found:

- ✅ All 289 Wakefield source rows faithfully represented in DB
- ✅ All 55 coil ITEM# values exactly match DB `supplierSku`
- ✅ Zero SKU fabrication, transformation, or reformatting
- ✅ All coil rows marked `is_active = true`, `stock_behaviour = 'coil'`
- ✅ Coil rows are returned by the API and rendered by the library UI
- ✅ Price values correctly stored (per-kg in `pricePerKg` for coil, per-sheet in `pricePerSheetExGst` for sheets)
- ✅ 0.5mm aluminium rows exist in source and DB

| Correction | Status |
|------------|--------|
| supplierSku corrections needed | **NONE** |
| Source-reference mapping issues | **NONE** |
| Library visibility code bugs | **NONE** |

### Files Changed in This Pass

**Zero files changed.** No corrections were necessary.

---

## 10. Remaining Risks

| Risk | Severity | Notes |
|------|----------|-------|
| Division scope confusion | Low | User may not realise LL tabs require "All" or "LL" scope |
| Default tab is not an LL tab | Low | Page loads on "direct_materials", not "Aluminium" |
| 14 reference-only rows have per-kg price with $0 per-sheet | Info | By design — these are non-quoteable reference rows |
| 69 blank-category source rows (offcuts) not in DB | Info | Intentionally excluded — these are section headers and offcut pricing rows without standard product structure |

---

## 11. Release Recommendation

The Wakefield data layer is verified clean. No data errors were found.

### Validation Summary

| Metric | Before | After |
|--------|--------|-------|
| Visible coil rows (library) | 55 | 55 (unchanged) |
| SKU mismatches | 0 | 0 (unchanged) |
| Source-to-DB row parity | 289/289 | 289/289 (unchanged) |

### Was the prior report wrong?

**NO.** The prior report's SKU values were correct. The ITEM# values cited (e.g., `0000513`, `0000476`, `0013696`, `0030289`) are all present in source column H and correctly stored in the database. No fabrication occurred.

### Repo Files Changed

None. Zero code or data changes were needed.

### Exact Query/Filter Logic Affecting Library Visibility

- `GET /api/ll-sheet-materials` → `storage.getLlSheetMaterials(false)` → returns ALL rows
- Client filters by `materialFamily` per tab, `filterStockType` defaults to `"all"`
- **Division Scope** controls which tabs are shown — LL material tabs require "All" or "LL" scope

### Before/After Count of Visible Coil Rows

- Before: 55 coil rows in DB, all active, all returned by API
- After: 55 coil rows in DB, all active, all returned by API
- **No change** — no visibility issue exists in the code

### Before/After Count of SKU Mismatches

- Before: 0
- After: 0

### Explicit YES/NO: Was Prior Report Wrong?

**NO** — the prior report's ITEM# / SKU values were correct and sourced from column H of the Wakefield workbook.

---

## Final Release Gate

| Gate | Decision |
|------|----------|
| Push to Git | YES |
| Publish to live | YES |
| New Replit chat needed for next phase | YES (if expanding scope beyond Wakefield verification) |

---

## Appendix: Mandatory Forensic Questions Answered

### Q1: For each disputed Wakefield row, what is the exact source worksheet name and exact source row?

All rows are in worksheet **"Pricing 42A2"**. Exact row numbers are listed in Sections 4 and 6 above.

### Q2: What is the exact ITEM# value shown in the workbook for each disputed row?

Every ITEM# is listed in the evidence tables. They are 7-digit zero-padded strings read directly from column H. Column A contains identical values (zero mismatches across 359 rows).

### Q3: Are the previously reported SKUs correct, incorrect, reformatted, or fabricated?

**Correct.** All SKUs match the source ITEM# values exactly.

### Q4: Do the 0.5mm aluminium rows exist in source?

**Yes.** Two rows: Row 30 (SKU 0000476, 0.5×1200×2400 5005H32) and Row 178 (SKU 0018982, 0.5×595×1060 5005H34). Both are in the database.

### Q5: Do coil rows exist in source?

**Yes.** 55 coil rows across Aluminium (26) and Stainless Steel (29) categories. Full evidence in Section 6.

### Q6: Are coil rows actually present in the database right now?

**Yes.** 55 rows with `stock_behaviour = 'coil'`, all `is_active = true`.

### Q7: Why can the user not currently see coil in the library?

Most likely cause: **Division Scope filter** is set to a non-LL division (e.g., "LJ" or "LE"), which hides the Aluminium and Stainless Steel tabs. Alternatively, the user may be on the default "direct_materials" tab and hasn't navigated to the Aluminium or Stainless Steel tabs.

### Q8: Is coil hidden by filters, UI scope, stock-behavior filtering, query logic, or missing ingestion?

**Not hidden by any of those.** The stock filter defaults to "all", the query returns all rows, and coil rows are present and active. The only factor is the **Division Scope selector** and **tab selection**.

### Q9: Are any supplier SKU values being derived from the wrong column or transformed incorrectly?

**No.** SKU values are derived from column H (ITEM#), which is identical to column A (Hidden). No transformation is applied.

### Q10: Are any source rows still not faithfully represented?

**No.** All 289 categorised source rows are faithfully represented. The 69 blank-category rows (offcuts/headers) are intentionally excluded as they lack standard product structure.
