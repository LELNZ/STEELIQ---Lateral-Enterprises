# LL Material Library — Supplier-Visibility Activation Report

## 1. Executive Summary

The Wakefield Metals workbook delivered to the user contains an **active AutoFilter** that hides 144 of its 290 categorized data rows in the supplier-controlled view. This pass applies the business rule: _if a row is present in the raw workbook data but NOT visible in the supplier-delivered workbook view, it must default to inactive in the app._

**137 additional Wakefield rows** have been deactivated (beyond the 14 reference-only rows deactivated in the previous pass). All 394 canonical rows are preserved. The Quote Builder now exposes 243 materials (105 Macdonald + 138 Wakefield).

| Metric | Before | After |
|--------|--------|-------|
| Total canonical rows | 394 | 394 |
| Active rows | 380 | 243 |
| Inactive rows | 14 | 151 |
| Newly deactivated | — | 137 |
| Quote Builder materials | 380 | 243 |

---

## 2. Supplier-Visibility Rule Applied

> **Rule**: The supplier-delivered Excel workbook view is the operational availability surface. If a row exists in the raw workbook data but is NOT visible when the workbook is opened as delivered, that row must be preserved canonically but set INACTIVE in the app by default.

This rule captures a real business signal: the supplier controls which products appear in their operational price list view. Hidden rows may be discontinued, non-stocked, special-order-only, or reserved for different customer tiers. The conservative default is to keep them in the canonical library but not expose them as live stock.

---

## 3. How Supplier-Visible vs Supplier-Non-Visible Was Determined

### Method

The Wakefield xlsx file (`Wakefield_Metals_Aluminium_&_Stainless_Steel_Pricing_42A2_01-_1775973960728.xlsx`) was read using the SheetJS library with `cellStyles: true` and `raw: true` options, which exposes per-row metadata including the `hidden` attribute.

### Key Findings

| Attribute | Value |
|-----------|-------|
| Worksheet | Pricing 42A2 |
| AutoFilter range | B5:O953 |
| Total rows in sheet | 953 |
| Rows with `hidden: true` in metadata | **802** |
| Data rows (with ITEM#) | 359 |
| Data rows with CATEGORY (real products) | 290 |
| Categorized data rows hidden | **144** |
| Categorized data rows visible | **146** |
| Placeholder rows (no CATEGORY) | 69 (all hidden) |

### Previous vs Current Analysis

In the initial forensic verification pass, SheetJS was used with **default options** which did NOT expose the `hidden` row attribute. The `!rows` metadata appeared empty, leading to the conclusion "0 hidden rows." This was incorrect — the default parsing mode strips hidden-state metadata.

With `cellStyles: true` mode, SheetJS correctly reads the `<row hidden="1">` attributes from the underlying XML, revealing 802 hidden rows saved as part of the workbook's AutoFilter state.

### Is This User-Applied or Supplier-Controlled?

The hidden state is **embedded in the saved workbook file** — it is part of the file as delivered by Wakefield Metals. When a user opens this file in Excel, the AutoFilter on columns B-O is active with specific filter criteria, and 802 rows are hidden. This is the supplier's intended presentation to the customer.

A user could clear all filters to see all rows, but the default view when opening the file shows only the 146 visible categorized rows. This is the supplier-controlled operational view.

---

## 4. Counts Before and After

### Wakefield Metals

| Metric | Before This Pass | After This Pass |
|--------|-----------------|-----------------|
| Total canonical Wakefield rows | 289 | 289 |
| Active Wakefield rows | 275 | 138 |
| Inactive Wakefield rows | 14 | 151 |
| Rows newly deactivated | — | 137 |

### By Supplier (All)

| Supplier | Active Before | Active After | Inactive Before | Inactive After |
|----------|--------------|--------------|-----------------|----------------|
| Macdonald Steel | 105 | 105 | 0 | 0 |
| Wakefield Metals | 275 | 138 | 14 | 151 |
| **Total** | **380** | **243** | **14** | **151** |

### By Stock Behaviour

| Stock Type | Active Before | Active After | Inactive After |
|------------|--------------|--------------|----------------|
| Sheet | 196 | 153 | 45 |
| Plate | 114 | 85 | 40 |
| Coil | 55 | 0 | 55 |
| Tread Plate | 15 | 5 | 11 |
| **Total** | **380** | **243** | **151** |

### By Material Family (Wakefield only)

| Family | Active Before | Active After | Inactive After |
|--------|--------------|--------------|----------------|
| Aluminium | 176 | 93 | 97 |
| Stainless Steel | 99 | 45 | 54 |

### UI Tab Counts (including Macdonald)

| Tab | Total | Active | Inactive | "Show N inactive" |
|-----|-------|--------|----------|-------------------|
| Aluminium | 190 | 93 | 97 | Show 97 inactive |
| Stainless Steel | 134 | 80 | 54 | Show 54 inactive |
| Mild Steel | 38 | 38 | 0 | _(hidden)_ |
| Galvanised Steel | 23 | 23 | 0 | _(hidden)_ |
| Corten | 9 | 9 | 0 | _(hidden)_ |

---

## 5. Exact List of Rows Newly Made Inactive

### Summary by Category

| # | Category | Count |
|---|----------|-------|
| 1 | Aluminium Coil (all coils are supplier-hidden) | 26 |
| 2 | Stainless Steel Coil (all coils are supplier-hidden) | 29 |
| 3 | Aluminium Sheet (supplier-hidden) | 26 |
| 4 | Aluminium Plate (supplier-hidden) | 21 |
| 5 | Aluminium Tread Plate (supplier-hidden) | 10 |
| 6 | Stainless Steel Sheet (supplier-hidden) | 15 |
| 7 | Stainless Steel Plate (supplier-hidden) | 8 |
| 8 | Stainless Steel Sheet (supplier-hidden, 2 more) | 2 |
| | **Total newly deactivated** | **137** |

### Notable: All 55 Coil Rows Are Supplier-Hidden

Every coil row in the Wakefield workbook (26 Aluminium + 29 Stainless Steel) is hidden in the supplier-delivered view. This likely indicates coil stock is managed via a separate ordering channel or is not part of the standard price-list offering.

### Full Row List (137 newly deactivated)

#### Aluminium Coil (26 rows)

| SKU | Description | Thickness | Width |
|-----|-------------|-----------|-------|
| 0000513 | 0.7X1200 5005H32 AL COIL | 0.7mm | 1200mm |
| 0000519 | 0.7X1200 5005H34 AL COIL STUCCO | 0.7mm | 1200mm |
| 0026011 | 0.9X510 5052H34 AL COIL | 0.9mm | 510mm |
| 0018373 | 0.9X610 5005H34 AL COIL | 0.9mm | 610mm |
| 0014699 | 0.9X940 5052H36 AL COIL 1MT | 0.9mm | 940mm |
| 0018332 | 0.9X940 5052H34 AL COIL 1MT | 0.9mm | 940mm |
| 0014231 | 0.9X1200 5005H32 AL COIL 1MT | 0.9mm | 1200mm |
| 0021750 | 0.9X1200 5005H32 AL COIL PE 1MT | 0.9mm | 1200mm |
| 0026200 | 0.9X1200 5005H32 AL COIL | 0.9mm | 1200mm |
| 0022589 | 0.9X1200 5005H34 AL COIL STUCCO | 0.9mm | 1200mm |
| 0015106 | 0.9X1220 5052H36 AL COIL 1MT | 0.9mm | 1220mm |
| 0018333 | 0.9X1220 5052H34 AL COIL 1MT | 0.9mm | 1220mm |
| 0000508 | 1.2X1200 5005H32 AL COIL | 1.2mm | 1200mm |
| 0000505 | 1.6X1200 5005H32 AL COIL | 1.6mm | 1200mm |
| 0031170 | 1.6X1200 5005H32 AL COIL PE | 1.6mm | 1200mm |
| 0023661 | 1.6X1500 5005H32 AL COIL | 1.6mm | 1500mm |
| 0000501 | 2.0X1200 5005H32 AL COIL | 2.0mm | 1200mm |
| 0000524 | 2.0X1200 5052H32 AL COIL | 2.0mm | 1200mm |
| 0000525 | 2.0X1500 5052H32 AL COIL | 2.0mm | 1500mm |
| 0023234 | 2.0X1500 5005H32 AL COIL | 2.0mm | 1500mm |
| 0000522 | 2.5X1200 5052H32 AL COIL | 2.5mm | 1200mm |
| 0000500 | 2.5X1200 5005H32 AL COIL | 2.5mm | 1200mm |
| 0000498 | 3.0X1200 5005H32 AL COIL | 3.0mm | 1200mm |
| 0016585 | 3.0X1500 5005H32 AL COIL | 3.0mm | 1500mm |
| 0000496 | 4.0X1200 5052H32 AL COIL | 4.0mm | 1200mm |
| 0000495 | 5.0X1200 5052H32 AL COIL | 5.0mm | 1200mm |

#### Stainless Steel Coil (29 rows)

| SKU | Description | Thickness | Width |
|-----|-------------|-----------|-------|
| 0028991 | 0.55X1219 304/4 SS COIL PE | 0.55mm | 1219mm |
| 0030289 | 0.55X1219 445M2 2DR SS COIL PI | 0.55mm | 1219mm |
| 0027760 | 0.7X1500 316L2B SS COIL PE | 0.7mm | 1500mm |
| 0002940 | 0.9X1219 304/4 SS COIL PE | 0.9mm | 1219mm |
| 0002924 | 0.9X1219 3042B SS COIL | 0.9mm | 1219mm |
| 0013474 | 0.9X1219 430/4 SS COIL PE | 0.9mm | 1219mm |
| 0002845a | 1.2X914 3042B SS COIL | 1.2mm | 914mm |
| 0002942 | 1.2X914 304/4 SS COIL FIBRE PE | 1.2mm | 914mm |
| 0002909 | 1.2X1219 3042B SS COIL | 1.2mm | 1219mm |
| 0002935 | 1.2X1219 304/4 SS COIL FIBRE PE | 1.2mm | 1219mm |
| 0002836 | 1.2X1524 3042B SS COIL | 1.2mm | 1524mm |
| 0027231 | 1.2X1524 304/4 SS COIL FIBRE PE | 1.2mm | 1524mm |
| 0002908 | 1.5X1219 3042B SS COIL | 1.5mm | 1219mm |
| 0002929 | 1.5X1219 304/4 SS COIL FIBRE PE | 1.5mm | 1219mm |
| 0002835 | 1.5X1524 3042B SS COIL | 1.5mm | 1524mm |
| 0044df4a | 1.5X1524 3042B SS COIL FIBRE PE | 1.5mm | 1524mm |
| 0027232 | 1.5X1524 304/4 SS COIL FIBRE PE | 1.5mm | 1524mm |
| 0002906 | 2.0X1219 3042B SS COIL | 2.0mm | 1219mm |
| 0002926 | 2.0X1219 304/4 SS COIL FIBRE PE | 2.0mm | 1219mm |
| 0002834 | 2.0X1524 3042B SS COIL | 2.0mm | 1524mm |
| 0027253 | 2.0X1524 304/4 SS COIL FIBRE PE | 2.0mm | 1524mm |
| 0002833 | 2.5X1524 3042B SS COIL | 2.5mm | 1524mm |
| 0002904 | 3.0X1219 3042B SS COIL | 3.0mm | 1219mm |
| 0002832 | 3.0X1524 3042B SS COIL | 3.0mm | 1524mm |
| 0024909 | 0.9X1219 316L2B SS COIL FIBRE PE | 0.9mm | 1219mm |
| 0027174 | 0.9X1219 430/4 SS COIL | 0.9mm | 1219mm |
| 0002880 | 1.2X1219 3162B SS COIL PI | 1.2mm | 1219mm |
| 0025931a | 1.5X1219 316L2B SS COIL FIBRE PE | 1.5mm | 1219mm |
| 0002878 | 2.0X1219 3162B SS COIL PI | 2.0mm | 1219mm |

#### Aluminium Sheet — supplier-hidden (26 rows)

| SKU | Description | Thickness | Dimensions |
|-----|-------------|-----------|------------|
| 0000467 | 1.2X1200X3600 5005H32 AL SHT | 1.2mm | 1200×3600 |
| 0000460 | 1.6X1200X3600 5005H32 AL SHT PI | 1.6mm | 1200×3600 |
| 0000449 | 2.5X1200X2400 5005H32 AL SHT | 2.5mm | 1200×2400 |
| 0016937 | 3.0X1200X2400 5005H32 AL SHT FIBRE PE | 3.0mm | 1200×2400 |
| ... | _(22 more aluminium sheet rows)_ | | |

#### Aluminium Plate — supplier-hidden (21 rows)

Includes 5052, 5083, and 6061 grade plates in various thicknesses (3–25mm).

#### Aluminium Tread Plate — supplier-hidden (10 rows)

Various 5052 tread plates from 2.5–6mm thickness.

#### Stainless Steel Sheet — supplier-hidden (17 rows)

304 and 316 grade sheets in various finishes (PI, PE, FPE).

#### Stainless Steel Plate — supplier-hidden (8 rows)

304 and 316 grade plates from 5–20mm thickness.

---

## 6. Runtime Verification Using Admin Login

### Login

- **Credentials**: admin / Password1234
- **Result**: Login successful, redirected to dashboard

### Library — Aluminium Tab (/library?division=LL)

| Check | Expected | Observed | Status |
|-------|----------|----------|--------|
| Default view count | 93 of 190 | 93 of 190 | PASS |
| "Show 97 inactive" checkbox | Present, unchecked | Present, unchecked | PASS |
| No "Inactive" badges visible | True | True | PASS |
| After ticking checkbox | 190 rows visible | 190 rows visible | PASS |
| Inactive rows have opacity-50 | True | True | PASS |

### Library — Stainless Steel Tab

| Check | Expected | Observed | Status |
|-------|----------|----------|--------|
| Default view count | 80 of 134 | 80 of 134 | PASS |
| "Show 54 inactive" checkbox | Present, unchecked | Present, unchecked | PASS |

_(Note: 80 active = 45 Wakefield + 35 Macdonald; 134 total = 99 Wakefield + 35 Macdonald)_

### Library — Macdonald-Only Tabs

| Tab | Expected | Observed | Status |
|-----|----------|----------|--------|
| Mild Steel | 38 of 38 | 38 of 38 | PASS |
| Galvanised Steel | 23 of 23 | 23 of 23 | PASS |
| Corten | 9 of 9 | 9 of 9 | PASS |

### Quote Builder

| Check | Expected | Status |
|-------|----------|--------|
| Total materials available | 243 | PASS |
| No supplier-hidden materials exposed | True | PASS |
| API call uses ?active=true&quoteable=true | True | PASS |

---

## 7. UI/Operational Impact

### Quote Builder (Operator View)

| Metric | Before | After |
|--------|--------|-------|
| Available material families | 5 | 5 |
| Available materials | 380 | 243 |
| Aluminium options | 176 | 93 |
| Stainless Steel options | 99+35=134 | 45+35=80 |
| Coil options | 55 | 0 |

**Key impact**: Operators will no longer see coil stock in the Quote Builder, nor any of the supplier-hidden sheet/plate/tread rows. This matches the supplier's own operational presentation.

### Library Admin View

| Feature | Before | After |
|---------|--------|-------|
| Default view | Shows all 394 rows | Shows 243 active rows |
| "Show inactive" toggle | Shows count per tab | Shows count per tab |
| Inactive row appearance | opacity-50 + "Inactive" badge | Same |
| Edit/activate path | Click edit → tick "Active" | Same |

---

## 8. Risks / Edge Cases

| Risk | Severity | Mitigation |
|------|----------|------------|
| All coil rows now inactive — coil quoting requires manual activation | Medium | By design: coils were hidden in supplier view. Activate specific coils as needed |
| Supplier may update workbook filters — new file would need re-analysis | Low | The visible SKU set is embedded in seed code. Update when new workbook is received |
| 7 ref-only rows are supplier-VISIBLE but inactive | None | These remain correctly inactive — they have 1×1 placeholder dims and can't be quoted regardless of supplier visibility |
| Manual activation of a supplier-hidden row won't be overridden on restart | Low | The drift guard only deactivates rows; it never re-activates manually activated rows. To re-check, re-run the visibility analysis |
| Macdonald rows are unaffected by this rule | None | Macdonald has no workbook-based visibility state. All 105 rows remain active |

### Edge Case: Supplier-Visible but Non-Quoteable

7 rows are visible in the supplier's workbook but marked `is_quoteable = false` (they have 1×1 placeholder dimensions). These remain inactive because the `resolveWakefieldActivation()` function checks `isQuoteable` first — non-quoteable rows are always inactive regardless of workbook visibility.

| SKU | Description | Workbook | App State |
|-----|-------------|----------|-----------|
| 0012540 | 3.00MM AL SHT FG 5052 | Visible | Inactive (non-quoteable) |
| 0012552 | 4.00MM AL PLT FG 5052 | Visible | Inactive (non-quoteable) |
| 0012632 | 16.0MM AL PLT FG 5083 | Visible | Inactive (non-quoteable) |
| 0012631 | 6.00MM AL PLT FG 5083 | Visible | Inactive (non-quoteable) |
| 0012541 | 4.00MM AL PLT FG 5083 | Visible | Inactive (non-quoteable) |
| 0012778 | 10.0MM AL PLT FG 5083 | Visible | Inactive (non-quoteable) |
| 0012557 | 4.00MM AL TREAD PLT FG 5052 | Visible | Inactive (non-quoteable) |

---

## 9. Release Recommendation

The supplier-visibility activation rule is fully applied. All 394 canonical rows are preserved. The operational library now reflects the supplier's own workbook presentation. Manual activation remains available for any row the business wants to bring live.

---

## Validation

### Exact Files Changed

| File | Change |
|------|--------|
| `server/routes.ts` | Added `WAKEFIELD_SUPPLIER_VISIBLE_SKUS` set (145 SKUs); added `resolveWakefieldActivation()` function; updated seed/reconcile/backfill/drift-guard to use supplier-visibility policy |
| `client/src/pages/library.tsx` | _(unchanged in this pass — previous pass changes still in effect)_ |
| Database (`ll_sheet_materials`) | 137 rows updated: `is_active` changed from `true` to `false` |

### Before/After Active Counts

| Metric | Before | After |
|--------|--------|-------|
| Total canonical rows | 394 | 394 |
| Active rows | 380 | 243 |
| Inactive rows | 14 | 151 |
| Newly deactivated | — | 137 |

### Supplier-Visible vs Supplier-Non-Visible Wakefield Rows

| Visibility | Count |
|------------|-------|
| Supplier-visible (in workbook view) | 145 |
| Supplier-non-visible (hidden in workbook) | 144 |
| **Total unique categorized** | **289** |

### Canonical Row Count Unchanged?

**YES** — 394 before, 394 after.

### Were Previously Visible Active Rows Reduced by This Rule?

**YES** — 137 Wakefield rows that were previously active have been set inactive because they are hidden in the supplier-delivered workbook view.

---

## Final Release Gate

| Gate | Decision |
|------|----------|
| Push to Git | **YES** |
| Publish to live | **YES** |
| New Replit chat needed for next phase | **YES** |
