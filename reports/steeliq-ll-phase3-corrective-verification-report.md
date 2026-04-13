# SteelIQ LL Material Library — Phase 3 Corrective Verification Report

**Report Date:** 13 April 2026  
**Scope:** Corrective verification of disputed Aluminium rows, collision groups, $0.00 rows, 0×dimension rows, and library presentation  
**Status:** COMPLETE — all disputed rows verified, presentation corrected  

---

## 1. Executive Verdict

All disputed rows are **legitimate supplier-backed data**. The problems were purely presentation/governance issues in the library admin UI, not data quality issues. Corrections have been applied:

- $0.00 rows were coil records displaying `pricePerSheetExGst` instead of `pricePerKg` — now display correct per-kg pricing
- 0×1200 rows were coil records showing `sheetLength×sheetWidth` — now display as "1200mm wide" with coil stock badge
- 0.5mm Aluminium rows are real Wakefield Metals products with valid SKUs
- 3 collision groups are legitimate temper variants with distinct supplier SKUs
- Collision warnings removed from operator view, retained in admin API for governance
- Stock behaviour filter and badges added to library table

---

## 2. Disputed Rows — Source Evidence

### 2a. 0.5mm Aluminium Rows

**Verdict: VALID — real supplier-backed rows**

| Product Description | Supplier | SKU | Grade | Finish | Dims | Price | Stock | Quoteable |
|---|---|---|---|---|---|---|---|---|
| 0.5X1200X2400 5005H32 AL SHT | Wakefield Metals | 0000476 | 5005 | Mill | 2400×1200 | $38.88/sht | sheet | Yes |
| 0.5X595X1060 5005H34 AL SHT | Wakefield Metals | 0018982 | 5005 | Mill | 1060×595 | $6.24/sht | sheet | Yes |

Both rows:
- Have valid Wakefield Metals supplier SKUs
- Have non-zero sheet prices
- Are standard sheet stock (not coil)
- Are quoteable
- Source: Wakefield Metals price list, ingested in `server/ll-seed-data.ts`

### 2b. 0×1200 Dimension Rows (sheetLength = 0)

**Verdict: VALID — these are coil records, not malformed sheets**

All 55 rows with `sheetLength = 0` have `stockBehaviour = "coil"`. Coils are continuous stock — they have no fixed length. The `sheetLength` field stores 0 intentionally.

Example rows:

| Description | SKU | Thickness | Width | Price/kg | Stock |
|---|---|---|---|---|---|
| 0.9X1200 5005H32 AL COIL 1MT | 0014231 | 0.9mm | 1200mm | $8.4360 | coil |
| 0.55X1219 304/4 SS COIL PE | 0028991 | 0.55mm | 1219mm | $5.3946 | coil |
| 1.2X1219 3042B SS COIL FIBRE PE | 0013168 | 1.2mm | 1219mm | $5.1615 | coil |

**Root cause of confusing display:** The library table rendered `{sheetLength}×{sheetWidth}` for ALL rows including coils, showing `0×1200`. Now coil rows display as `1200mm wide` with a blue "coil" stock badge.

### 2c. $0.00 Price Rows

**Verdict: Two distinct categories, both legitimate**

#### Category 1: Coil rows (55 rows) — `isQuoteable = true`
- `pricePerSheetExGst = 0` because coils don't have a per-sheet price
- `pricePerKg` is populated (e.g., $8.4360/kg, $5.1615/kg)
- The library was displaying `pricePerSheetExGst` for all rows, showing $0.00 for coils
- **Fix:** Coil rows now display `pricePerKg` with `/kg` suffix

#### Category 2: Reference-only rows (14 rows) — `isQuoteable = false`
- These are per-kg reference data with `1×1` dimensions
- `pricePerSheetExGst = 0`, `pricePerKg` is populated (e.g., $8.30/kg for 5052 plate)
- Already excluded from Quote Builder via `isQuoteable = false`
- **Fix:** Reference rows now display `pricePerKg` with `/kg` suffix and "Ref Only" badge, with muted row background

| Category | Count | Quoteable | Price Display (before) | Price Display (after) |
|---|---|---|---|---|
| Coil | 55 | Yes | $0.00 | $X.XXXX/kg |
| Reference-only plate | 11 | No | $0.00 | $X.XX/kg |
| Reference-only sheet | 2 | No | $0.00 | $X.XX/kg |
| Reference-only tread_plate | 1 | No | $0.00 | $X.XX/kg |

---

## 3. Collision Group Evidence and Assessment

### Collision Detection Key Change

**Before:** `(materialFamily, grade, finish, thickness, sheetLength, sheetWidth)` — 6-field key  
**After:** `(materialFamily, grade, finish, thickness, sheetLength, sheetWidth, stockBehaviour)` — 7-field key

Adding `stockBehaviour` prevents false collisions between coil and sheet rows that share other properties. The 3 remaining collision groups are all within coil stock:

### Collision Group 1: Aluminium 5005 Mill 0.9mm 1200mm-wide coil

| SKU | Description | Price/kg | Form Type | Assessment |
|---|---|---|---|---|
| 0014231 | 0.9X1200 5005H32 AL COIL 1MT | $8.4360 | Coil | Min-order 1 metric ton |
| 0026200 | 0.9X1200 5005H32 AL COIL | $8.4360 | Coil | Standard order (no min) |

**Verdict:** Same temper (H32), same price, different SKUs. These are distinct Wakefield order lines — one with a 1MT minimum order, one without. Both legitimate.

### Collision Group 2: Aluminium 5052 Mill 0.9mm 940mm-wide coil

| SKU | Description | Price/kg | Form Type | Assessment |
|---|---|---|---|---|
| 0018332 | 0.9X940 5052H34 AL COIL 1MT | $8.3250 | Coil | Temper H34 |
| 0014699 | 0.9X940 5052H36 AL COIL 1MT | $8.9355 | Coil | Temper H36 |

**Verdict:** Different tempers (H34 vs H36) with different prices. The `grade` field normalizes to "5052" — temper is only captured in `productDescription`. Both legitimate.

### Collision Group 3: Aluminium 5052 Mill 0.9mm 1220mm-wide coil

| SKU | Description | Price/kg | Form Type | Assessment |
|---|---|---|---|---|
| 0018333 | 0.9X1220 5052H34 AL COIL 1MT | $8.3250 | Coil | Temper H34 |
| 0015106 | 0.9X1220 5052H36 AL COIL 1MT | $8.3250 | Coil | Temper H36 |

**Verdict:** Different tempers (H34 vs H36), same price, different SKUs. Both legitimate.

### Is temper/detail being lost?

**Yes, partially.** The `grade` field normalizes alloy temper designations:
- `5005H32`, `5005H34` → grade: `5005`
- `5052H34`, `5052H36` → grade: `5052`

The full temper designation is preserved in `productDescription` and distinguishable by `supplierSku`. The Quote Builder exposes `productDescription` in the coil width dropdown so operators can distinguish between temper variants. No data loss — just a normalization trade-off in the structured `grade` field.

---

## 4. UI/Presentation Changes Made

### Library Table (library.tsx)

| Change | Before | After |
|---|---|---|
| Title | "{Family} Sheet Materials" | "{Family} Materials" |
| Collision badge (header) | Red destructive "3 collisions" badge | Removed from operator view |
| Collision detail panel | Red destructive expandable warning | Removed from operator view |
| Stock behaviour column | Not present | New "Stock" column with colour-coded badges (blue=coil, orange=plate, purple=tread_plate) |
| Stock behaviour filter | Not present | New dropdown filter |
| Dimensions column | `{sheetLength}×{sheetWidth}` for all rows | Coil: `{width}mm wide`, Per-kg ref: `per-kg ref` (italic), Sheet: `{length}×{width}` |
| Price column | `${pricePerSheetExGst}` for all rows | Coil: `${pricePerKg}/kg`, Per-kg ref: `${pricePerKg}/kg`, Sheet: `${pricePerSheetExGst}/sht` |
| Status column | Active Yes/No only | "Ref Only" badge for non-quoteable rows + Active/Inactive badge |
| Row styling | Inactive rows opacity only | Reference-only rows also get `bg-muted/30` background |
| Family column | Shown in table | Removed (redundant — table is already scoped to family) |
| Stock type summary | Not present | Badge summary in header showing count per stock type |

### Collision Check API (routes.ts)

| Change | Before | After |
|---|---|---|
| Key fields | 6-field (no stockBehaviour) | 7-field (includes stockBehaviour) |
| Record detail | id, supplierName, productDescription, pricePerSheetExGst | + pricePerKg, supplierSku, stockBehaviour |

### SheetMaterial Interface

Added fields to the component's TypeScript interface: `pricePerKg`, `supplierSku`, `supplierCategory`, `formType`, `stockBehaviour`, `densityKgM3`, `isQuoteable`

---

## 5. Before/After Counts

| Metric | Before | After |
|---|---|---|
| Visible $0.00 price rows | 69 (55 coil + 14 ref) | 0 (all now show correct price basis) |
| Rows showing 0×{width} dimensions | 55 | 0 (all show `{width}mm wide`) |
| Operator-facing collision warnings | 3 (red destructive badges) | 0 (removed from operator view) |
| Stock behaviour filter available | No | Yes |
| Stock type visually differentiated | No | Yes (colour-coded badges) |
| Reference-only rows visually marked | No | Yes ("Ref Only" badge + muted background) |
| Total coil rows visible | 55 | 55 (unchanged — all valid) |

---

## 6. Remaining Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Temper normalization in `grade` field | Low | Operator sees full `productDescription` in Quote Builder dropdown; collision check API available for governance |
| 3 coil collision groups persist | Low | These are legitimate supplier variants — accepted as valid. SKU differentiates them. |
| Collision audit removed from operator view | Acceptable | Retained in `/api/ll-sheet-materials/audit/collision-check` admin API — can be surfaced in a dedicated governance tab if needed |

---

## 7. Files Changed

| File | Changes |
|------|---------|
| `client/src/pages/library.tsx` | SheetMaterial interface extended; stock behaviour filter; table columns updated for coil/sheet/reference display; collision warnings removed from operator view; stock type badges; unused imports cleaned |
| `server/routes.ts` | Collision check API key includes stockBehaviour; enriched collision record detail with pricePerKg, supplierSku, stockBehaviour |

---

## 8. Release Gate

| Gate | Decision |
|------|----------|
| Push to Git | YES |
| Publish to live | YES — presentation-only changes, no schema or data mutations |
| New Replit chat needed for next phase | NO — current session can continue |
