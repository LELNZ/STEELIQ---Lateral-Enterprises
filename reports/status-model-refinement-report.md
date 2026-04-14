# LL Material Library — Status Model Refinement Report

## 1. Executive Summary

This pass introduces a first-class material status model that cleanly separates the three operational states that previously existed as an implicit combination of `is_active` and `is_quoteable` boolean flags. The model is implemented as a **derived computed field** — no database schema changes, no migration risk, full backward compatibility.

| Status | Count | Visible in Library | Selectable in Quote Builder |
|--------|-------|--------------------|-----------------------------|
| **ACTIVE_QUOTEABLE** | 247 | Yes | Yes |
| **ACTIVE_REFERENCE** | 7 | Yes | No |
| **INACTIVE_PRESERVED** | 140 | Hidden by default | No |
| **Total** | **394** | | |

**Key outcomes**:
- The library UI now shows clear status labels: "Quoteable", "Reference", "Preserved"
- Reference rows (1×1 per-kg pricing) are visually distinct with amber badges
- Coil stock remains live and quoteable (13 active coil rows) — no separate status needed
- Quote Builder behavior unchanged (only ACTIVE_QUOTEABLE rows exposed)
- Zero schema migration — computed field added to API response only

---

## 2. Status Model Implemented

### Three-State Model

| Status | `is_active` | `is_quoteable` | Meaning |
|--------|-------------|----------------|---------|
| `active_quoteable` | `true` | `true` | Live stock, selectable in Quote Builder |
| `active_reference` | `true` | `false` | Visible reference pricing, not selectable |
| `inactive_preserved` | `false` | any | Preserved canonical row, hidden by default |

### Derivation Function

```typescript
function deriveMaterialStatus(isActive: boolean, isQuoteable: boolean): MaterialStatus {
  if (!isActive) return "inactive_preserved";
  if (!isQuoteable) return "active_reference";
  return "active_quoteable";
}
```

### Coil Handling

Coil stock uses `ACTIVE_QUOTEABLE` + `stockBehaviour = "coil"`. No separate `ACTIVE_COIL` status is needed because:
1. Coil is a **stock behavior** (how the material is stored/cut), not a **lifecycle state** (what the row represents operationally)
2. Coil rows follow the same quoting pathway as other quoteable materials, just with different pricing logic (per-kg × weight instead of per-sheet)
3. Adding a fourth status would complicate filtering, increase maintenance burden, and provide no additional operational clarity
4. The library UI already shows a "Coil" badge alongside "Quoteable" for visual distinction

---

## 3. Why This Model Was Chosen

### Alternative Considered: New Database Column

A `material_status` enum column was considered but rejected:
- **Sync risk**: A new column creates a dual-source-of-truth problem with the existing `is_active` + `is_quoteable` booleans
- **Migration risk**: Schema changes require database migration, which can fail or corrupt data
- **Query risk**: All existing queries using `is_active`/`is_quoteable` would need updating
- **No new information**: The existing booleans already encode the three states perfectly

### Chosen Approach: Derived Computed Field

- **Zero migration**: No database changes
- **Single source of truth**: `is_active` + `is_quoteable` remain the storage layer; `materialStatus` is always computed from them
- **Full backward compatibility**: All existing API consumers continue to work unchanged
- **New consumers get richer data**: The `materialStatus` field is included in every API response

---

## 4. Exact Mapping Rules From Existing Rows to New Statuses

| Current State | New Status | Count | Example |
|---------------|-----------|-------|---------|
| `is_active=true`, `is_quoteable=true` | `active_quoteable` | 247 | 0000475: 0.7X1200X2400 5005H32 AL SHT |
| `is_active=true`, `is_quoteable=false` | `active_reference` | 7 | 0012540: 3.00MM AL SHT FG 5052 |
| `is_active=false`, `is_quoteable=true` | `inactive_preserved` | 137 | 0000519: 0.7X1200 5005H34 AL COIL STUCCO |
| `is_active=false`, `is_quoteable=false` | `inactive_preserved` | 3 | (non-quoteable hidden rows) |

---

## 5. Counts Before and After

### By Supplier × Status

| Supplier | ACTIVE_QUOTEABLE | ACTIVE_REFERENCE | INACTIVE_PRESERVED | Total |
|----------|------------------|------------------|--------------------|-------|
| Macdonald Steel | 105 | 0 | 0 | 105 |
| Wakefield Metals | 142 | 7 | 140 | 289 |
| **Total** | **247** | **7** | **140** | **394** |

### By Stock Behaviour × Status

| Stock Type | ACTIVE_QUOTEABLE | ACTIVE_REFERENCE | INACTIVE_PRESERVED | Total |
|------------|------------------|------------------|--------------------|-------|
| Sheet | 144 | 1 | 53 | 198 |
| Plate | 85 | 5 | 35 | 125 |
| Coil | 13 | 0 | 42 | 55 |
| Tread Plate | 5 | 1 | 10 | 16 |
| **Total** | **247** | **7** | **140** | **394** |

### Quoteable vs Non-Quoteable

| Quoteable | Active | Inactive | Total |
|-----------|--------|----------|-------|
| Yes | 247 | 137 | 384 |
| No | 0 (but 7 ACTIVE_REFERENCE) | 3 | 10 |

Note: ACTIVE_REFERENCE rows have `is_quoteable=false` but `is_active=true`. The status model makes this semantically clear rather than hiding it behind two unrelated booleans.

---

## 6. Exact Counts

| Metric | Count |
|--------|-------|
| Active quoteable rows (ACTIVE_QUOTEABLE) | **247** |
| Active reference rows (ACTIVE_REFERENCE) | **7** |
| Inactive preserved rows (INACTIVE_PRESERVED) | **140** |
| Active coil rows (ACTIVE_QUOTEABLE + coil) | **13** |
| Total canonical rows | **394** |

### Active Reference Rows (7)

| SKU | Description | Family |
|-----|-------------|--------|
| 0012540 | 3.00MM AL SHT FG 5052 | Aluminium |
| 0012541 | 4.00MM AL PLT FG 5083 | Aluminium |
| 0012552 | 4.00MM AL PLT FG 5052 | Aluminium |
| 0012557 | 4.00MM AL TREAD PLT FG 5052 | Aluminium |
| 0012631 | 6.00MM AL PLT FG 5083 | Aluminium |
| 0012632 | 16.0MM AL PLT FG 5083 | Aluminium |
| 0012778 | 10.0MM AL PLT FG 5083 | Aluminium |

### Active Coil Rows (13)

| SKU | Description | Family |
|-----|-------------|--------|
| 0000498 | 3.0X1200 5005H32 AL COIL | Aluminium |
| 0000508 | 1.2X1200 5005H32 AL COIL | Aluminium |
| 0000513 | 0.7X1200 5005H32 AL COIL | Aluminium |
| 0000521 | 3.0X1500 5052H32 AL COIL | Aluminium |
| 0000524 | 2.0X1200 5052H32 AL COIL | Aluminium |
| 0023234 | 2.0X1500 5005H32 AL COIL | Aluminium |
| 0026200 | 0.9X1200 5005H32 AL COIL | Aluminium |
| 0031170 | 1.6X1200 5005H32 AL COIL PE | Aluminium |
| 0013694 | 0.7X1219 3042B SS COIL FIBRE PE | Stainless Steel |
| 0013696 | 0.55X1219 3162B SS COIL | Stainless Steel |
| 0026439 | 0.9X1219 304/4 SS COIL FIBRE PE | Stainless Steel |
| 0027520 | 0.9X1219 304L2B SS COIL FIBRE PE | Stainless Steel |
| 0030289 | 0.55X1219 445M2 2DR SS COIL PI | Stainless Steel |

---

## 7. Library / UI Impact

### Status Badges

| Status | Badge Label | Badge Style | Row Style |
|--------|------------|-------------|-----------|
| ACTIVE_QUOTEABLE | "Quoteable" | Default (filled) | Normal |
| ACTIVE_REFERENCE | "Reference" | Secondary + amber border/text | `bg-muted/30` background |
| INACTIVE_PRESERVED | "Preserved" | Secondary + gray border/text | `opacity-50` |

### Additional Coil Badge

Active quoteable coil rows show a second "Coil" badge (blue outline) alongside the "Quoteable" badge, providing visual distinction without requiring a separate status.

### Toggle Label

The "Show N inactive" checkbox label has been updated to "Show N preserved" to match the status model terminology.

### Empty State Message

Updated to: "No active materials found. N preserved materials hidden — tick 'Show preserved' to reveal."

### Tab Counts (Library UI)

| Tab | Active (visible) | Total | Preserved (hidden) |
|-----|-----------------|-------|-------------------|
| Aluminium | 102 | 190 | 88 |
| Stainless Steel | 82 | 134 | 52 |
| Mild Steel | 38 | 38 | 0 |
| Galvanised Steel | 23 | 23 | 0 |
| Corten | 9 | 9 | 0 |

Note: "Active" includes both ACTIVE_QUOTEABLE and ACTIVE_REFERENCE rows. The toggle controls only INACTIVE_PRESERVED visibility.

---

## 8. Quote Builder / Add Item Impact

| Aspect | Before | After |
|--------|--------|-------|
| API call | `?active=true&quoteable=true` | Same (unchanged) |
| Materials available | 247 | 247 (ACTIVE_QUOTEABLE only) |
| Reference rows included | No | No (correctly excluded) |
| Preserved rows included | No | No (correctly excluded) |
| Coil materials available | 13 | 13 (unchanged) |
| Cascading dropdown behavior | Family → Grade → Finish → Thickness → Size/Coil | Same (unchanged) |

**No changes to Quote Builder code were needed.** The existing `?active=true&quoteable=true` filter already correctly selects only ACTIVE_QUOTEABLE rows.

---

## 9. Runtime Verification Using Admin Login

### Login

- **Credentials**: admin / Password1234
- **Result**: Login successful

### API Response Verification

| Check | Expected | Observed | Status |
|-------|----------|----------|--------|
| `materialStatus` field in response | Present on all rows | Present on all 394 rows | **PASS** |
| `active_quoteable` count | 247 | 247 | **PASS** |
| `active_reference` count | 7 | 7 | **PASS** |
| `inactive_preserved` count | 140 | 140 | **PASS** |

### Library UI Verification (Aluminium Tab)

| Check | Expected | Observed | Status |
|-------|----------|----------|--------|
| Default view count | 102 of 190 | 102 of 190 | **PASS** |
| "Show 88 preserved" checkbox | Present, unchecked | Present, unchecked | **PASS** |
| "Quoteable" badges on normal rows | Yes | Yes | **PASS** |
| "Reference" badges on ref-only rows | Yes, amber colored | Yes, amber colored | **PASS** |
| "Coil" badge on active coil rows | Yes, blue outline | Yes, blue outline | **PASS** |
| Reference rows have muted background | Yes | Yes | **PASS** |
| After ticking: 190 rows visible | Yes | Yes | **PASS** |
| "Preserved" badges on hidden rows | Yes, gray | Yes, gray | **PASS** |
| Preserved rows have opacity-50 | Yes | Yes | **PASS** |

### Library UI Verification (Stainless Steel Tab)

| Check | Expected | Observed | Status |
|-------|----------|----------|--------|
| Count | 82 of 134 | 82 of 134 | **PASS** |
| "Show 52 preserved" | Present | Present | **PASS** |

### Library UI Verification (Macdonald-Only Tabs)

| Tab | Expected | Observed | Status |
|-----|----------|----------|--------|
| Mild Steel | 38 of 38 | 38 of 38 | **PASS** |
| Galvanised Steel | 23 of 23 | 23 of 23 | **PASS** |
| Corten | 9 of 9 | 9 of 9 | **PASS** |

---

## 10. Risks / Deferred Items

| Risk | Severity | Notes |
|------|----------|-------|
| Settings page filter uses `m.isActive !== false` | None | Still works correctly — ACTIVE_REFERENCE has `isActive=true` so passes the filter |
| Quote Builder uses `?active=true&quoteable=true` | None | Still works correctly — ACTIVE_REFERENCE has `isQuoteable=false` so is excluded |
| Existing estimate snapshots reference `llSheetMaterialId` | None | No impact — snapshots store the material ID, not the status |
| `materialStatus` is computed, not stored | Low | Acceptable trade-off for zero-migration safety. If DB-level querying by status is needed later, a generated column can be added |
| Admin can still edit `isActive`/`isQuoteable` directly | Low | The status is derived, so any manual change to the booleans is immediately reflected in the computed status |

### Deferred

- **Status filter dropdown in library**: Could add a filter to show only "Quoteable" or only "Reference" rows. Not needed for this pass.
- **Admin status editor**: Could add a status selector in the edit dialog instead of raw boolean toggles. Deferred.
- **Audit log for status changes**: Not in scope.

---

## 11. Release Recommendation

The status model is fully implemented and verified. It cleanly separates the three operational states without any database changes or migration risk. All existing functionality continues to work unchanged. The library UI now provides clear, distinguishable status labels for operators.

**Recommended for release.**

---

## VALIDATION

### Exact Files Changed

| File | Change |
|------|--------|
| `shared/schema.ts` | Added `MATERIAL_STATUS` constants, `MaterialStatus` type, `deriveMaterialStatus()` function, `MATERIAL_STATUS_LABELS` map, `LlSheetMaterialWithStatus` type |
| `server/routes.ts` | Added `deriveMaterialStatus` import; GET `/api/ll-sheet-materials` now returns `materialStatus` computed field on every row |
| `client/src/pages/library.tsx` | Added imports for status model; updated status badges to show "Quoteable"/"Reference"/"Preserved" with color-coded styling; added "Coil" companion badge for active coil rows; updated toggle label and empty state message to use "preserved" terminology |

### Exact Status Counts After Implementation

| Status | Count |
|--------|-------|
| ACTIVE_QUOTEABLE | 247 |
| ACTIVE_REFERENCE | 7 |
| INACTIVE_PRESERVED | 140 |
| Total | 394 |

### Are Visible Reference Rows Now Visible But Non-Quoteable?

**YES** — 7 reference rows are `isActive=true`, `isQuoteable=false`, status = `active_reference`. They appear in the library with an amber "Reference" badge and muted background. They are excluded from Quote Builder by the `?quoteable=true` filter.

### Does Coil Remain Live and Quoteable?

**YES** — 13 coil rows are `isActive=true`, `isQuoteable=true`, `stockBehaviour=coil`, status = `active_quoteable`. They appear in the Quote Builder material selector and support the coil pricing pathway (per-kg × weight).

### Do Non-Screenshot Wakefield Rows Remain Preserved But Not Live?

**YES** — 140 Wakefield rows are `isActive=false`, status = `inactive_preserved`. They are hidden from the default library view and excluded from Quote Builder. They remain canonical in the database and can be viewed by ticking the "Show preserved" checkbox.

---

## FINAL RELEASE GATE

| Gate | Decision |
|------|----------|
| Push to Git | **YES** |
| Publish to live | **YES** |
| New Replit chat needed for next phase | **YES** |
