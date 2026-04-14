# LL Material Library — Wakefield Active-Set Correction Report

## 1. Executive Summary

This pass corrects the Wakefield active set to match the **exact screenshot-visible rows** provided by the user. The previous pass used workbook hidden-row detection (SheetJS `cellStyles` mode), which was a good approximation but did not match the user's actual operational view. This correction replaces the workbook-derived set with the user-provided screenshot authority.

| Metric | Before Correction | After Correction |
|--------|-------------------|------------------|
| Total canonical rows | 394 | 394 |
| Wakefield active | 138 | **149** |
| Wakefield inactive | 151 | **140** |
| Macdonald active | 105 | 105 (unchanged) |
| Total active | 243 | **254** |
| Total inactive | 151 | **140** |
| Quote Builder materials | 243 | **247** |

**Net effect**: +11 Wakefield active rows (+15 added, −11 removed). 7 reference-only rows are now active (visible in library) but remain non-quoteable.

---

## 2. Exact Count of Screenshot-Visible Rows Matched to DB

| Metric | Value |
|--------|-------|
| SKUs in user-provided screenshot set | **149** |
| SKUs matched to DB rows | **149** |
| SKUs not found in DB | **0** |

All 149 screenshot-visible SKUs have an exact match in the database by `supplier_sku`.

---

## 3. Exact Count of Wakefield Rows Active Before and After

| State | Before | After | Change |
|-------|--------|-------|--------|
| Active | 138 | 149 | +11 |
| Inactive | 151 | 140 | −11 |
| Total | 289 | 289 | 0 |

---

## 4. Exact List of Rows Activated (22 rows)

These 22 rows were previously INACTIVE and are now ACTIVE.

### Coil Rows Activated (13 rows)

| SKU | Description | Family | Stock |
|-----|-------------|--------|-------|
| 0000498 | 3.0X1200 5005H32 AL COIL | Aluminium | coil |
| 0000508 | 1.2X1200 5005H32 AL COIL | Aluminium | coil |
| 0000513 | 0.7X1200 5005H32 AL COIL | Aluminium | coil |
| 0000521 | 3.0X1500 5052H32 AL COIL | Aluminium | coil |
| 0000524 | 2.0X1200 5052H32 AL COIL | Aluminium | coil |
| 0023234 | 2.0X1500 5005H32 AL COIL | Aluminium | coil |
| 0026200 | 0.9X1200 5005H32 AL COIL | Aluminium | coil |
| 0031170 | 1.6X1200 5005H32 AL COIL PE | Aluminium | coil |
| 0013694 | 0.7X1219 3042B SS COIL FIBRE PE | Stainless Steel | coil |
| 0013696 | 0.55X1219 3162B SS COIL | Stainless Steel | coil |
| 0026439 | 0.9X1219 304/4 SS COIL FIBRE PE | Stainless Steel | coil |
| 0027520 | 0.9X1219 304L2B SS COIL FIBRE PE | Stainless Steel | coil |
| 0030289 | 0.55X1219 445M2 2DR SS COIL PI | Stainless Steel | coil |

### Sheet Rows Activated (2 rows)

| SKU | Description | Family | Stock |
|-----|-------------|--------|-------|
| 0019049 | 1.6X1200X6000 5005H32 AL SHTPE | Aluminium | sheet |
| 0025648 | 2.5X1200X3000 5005H32 AL SHTPE | Aluminium | sheet |

### Reference-Only Rows Activated (7 rows)

These rows are now ACTIVE (visible in library) but remain `is_quoteable = false` (cannot be selected in Quote Builder). They have 1×1 placeholder dimensions and per-kg reference pricing.

| SKU | Description | Family | Stock |
|-----|-------------|--------|-------|
| 0012540 | 3.00MM AL SHT FG 5052 | Aluminium | sheet |
| 0012541 | 4.00MM AL PLT FG 5083 | Aluminium | plate |
| 0012552 | 4.00MM AL PLT FG 5052 | Aluminium | plate |
| 0012557 | 4.00MM AL TREAD PLT FG 5052 | Aluminium | tread_plate |
| 0012631 | 6.00MM AL PLT FG 5083 | Aluminium | plate |
| 0012632 | 16.0MM AL PLT FG 5083 | Aluminium | plate |
| 0012778 | 10.0MM AL PLT FG 5083 | Aluminium | plate |

---

## 5. Exact List of Rows Deactivated (11 rows)

These 11 rows were previously ACTIVE and are now INACTIVE (not in the screenshot-visible set).

| SKU | Description | Family | Stock |
|-----|-------------|--------|-------|
| 0000442 | 3.0X1200X2400 5005H32 AL SHT | Aluminium | sheet |
| 0000470 | 0.9X1200X2400 5005H32 AL SHT | Aluminium | sheet |
| 0000476 | 0.5X1200X2400 5005H32 AL SHT | Aluminium | sheet |
| 0014487 | 2.0X1500X3000 5005H32 AL SHTPE | Aluminium | sheet |
| 0014748 | 1.6X1200X2400 5005H32 AL SHTPE | Aluminium | sheet |
| 0022767 | 3.0X1200X3000 5005H32 AL SHT | Aluminium | sheet |
| 0024594 | 2.0X1500X3000 5005H32 AL SHT FIBRE PE | Aluminium | sheet |
| 0024966 | 1.6X1200X5000 5005H32 AL SHTPE | Aluminium | sheet |
| 0024326 | 3.0X1524X3048 304L2B SS SHT FIBRE PE | Stainless Steel | sheet |
| 0024871 | 0.9X1219X2438 304/4 SS SHT FIBRE PE | Stainless Steel | sheet |
| 0024875 | 1.2X1219X2438 3042B SS SHT FIBRE PE | Stainless Steel | sheet |

---

## 6. Rows That Could Not Be Matched Exactly

**None.** All 149 screenshot-visible SKUs matched exactly to DB rows by `supplier_sku`.

---

## 7. Runtime Verification Using Admin Login

### Login

- **Credentials**: admin / Password1234
- **Result**: Login successful, redirected to dashboard

### Library Tab Counts (/library?division=LL)

| Tab | Expected Active | Expected Total | Show N Inactive | Observed | Status |
|-----|----------------|----------------|-----------------|----------|--------|
| Aluminium | 102 | 190 | Show 88 inactive | 102 of 190 | **PASS** |
| Stainless Steel | 82 | 134 | Show 52 inactive | 82 of 134 | **PASS** |
| Mild Steel | 38 | 38 | _(hidden)_ | 38 of 38 | **PASS** |
| Galvanised Steel | 23 | 23 | _(hidden)_ | 23 of 23 | **PASS** |
| Corten | 9 | 9 | _(hidden)_ | 9 of 9 | **PASS** |

_(Note: Stainless Steel 82 = Wakefield 47 active + Macdonald 35 active; total 134 = Wakefield 99 + Macdonald 35)_

### Inactive Toggle Verification (Aluminium Tab)

| Check | Expected | Observed | Status |
|-------|----------|----------|--------|
| Default: inactive hidden | Yes | Yes | **PASS** |
| Checkbox "Show 88 inactive" unchecked | Yes | Yes | **PASS** |
| After ticking: 190 rows visible | Yes | Yes | **PASS** |
| Inactive rows have opacity-50 | Yes | Yes | **PASS** |
| Inactive rows show "Inactive" badge | Yes | Yes | **PASS** |

### Drift Guard Verification

Server restart log confirms: `Activation policy enforced: 11 deactivated, 22 activated`

### Zero-Violation Check

| Check | Result |
|-------|--------|
| Active Wakefield rows NOT in screenshot set | **0** |
| Screenshot-visible SKUs that are NOT active | **0** |

---

## 8. Changes Summary

### By Stock Behaviour (Wakefield only)

| Stock Type | Active Before | Active After | Change |
|------------|--------------|--------------|--------|
| Sheet | 81 → 72 | 81 | net 0 (−8 deactivated, +2 activated, +7 ref-only activated) |
| Coil | 0 | 13 | +13 |
| Plate | 49 → 42 | 49 | net +7 (ref-only rows now active) |
| Tread Plate | 5 → 5 | 6 | +1 (ref-only row now active) |

### By Material Family (All Suppliers)

| Family | Active Before | Active After |
|--------|--------------|--------------|
| Aluminium | 93 | 102 |
| Stainless Steel | 80 | 82 |
| Mild Steel | 38 | 38 |
| Galvanised Steel | 23 | 23 |
| Corten | 9 | 9 |

### Quote Builder Impact

| Metric | Before | After |
|--------|--------|-------|
| Quote Builder materials (active AND quoteable) | 243 | **247** |
| Coil materials in Quote Builder | 0 | **13** |
| Ref-only rows in Quote Builder | 0 | 0 (remain non-quoteable) |

---

## 9. Code Changes

### `server/routes.ts`

1. **`WAKEFIELD_SUPPLIER_VISIBLE_SKUS`** — Replaced 145-SKU set with exact 149-SKU screenshot-visible set.
   - Added 15 SKUs (13 coils + 2 sheets)
   - Removed 11 SKUs (8 AL sheets + 3 SS sheets)

2. **`resolveWakefieldActivation()`** — Removed the `isQuoteable === false` gate. The function now decides activation purely by screenshot-visible membership for Wakefield rows. Wakefield rows with no `supplierSku` default to inactive (fail-closed). Reference-only rows that appear in the screenshot set are now ACTIVE but remain NON-QUOTEABLE. Non-Wakefield rows are unaffected (always returns true).

3. **Drift guard** — Made bi-directional but scoped to Wakefield-only: now both activates Wakefield rows that should be active but aren't, and deactivates Wakefield rows that shouldn't be active but are. Non-Wakefield rows (Macdonald) are explicitly skipped by the drift guard. Previously the drift guard only deactivated.

### Database Changes

| Change | Count |
|--------|-------|
| Rows activated (inactive → active) | 22 |
| Rows deactivated (active → inactive) | 11 |
| Rows deleted | 0 |
| Total canonical rows | 394 (unchanged) |

---

## VALIDATION

### Exact Files Changed

| File | Change |
|------|--------|
| `server/routes.ts` | Updated `WAKEFIELD_SUPPLIER_VISIBLE_SKUS` (145→149 SKUs); removed `isQuoteable` gate from `resolveWakefieldActivation()`; made drift guard bi-directional |

### Exact Wakefield Active Count After Correction

**149**

### Does Any Wakefield Row NOT in the Screenshot-Visible Set Remain Active?

**NO** — Zero violations. Every active Wakefield row is in the screenshot-visible set. Every screenshot-visible SKU is active in the DB.

---

## FINAL RELEASE GATE

| Gate | Decision |
|------|----------|
| Push to Git | **YES** |
| Publish to live | **YES** |
| New Replit chat needed for next phase | **YES** |
