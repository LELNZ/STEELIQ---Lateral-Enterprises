# LL Material Library — Activation-State Governance Report

## 1. Executive Summary

All 394 canonical supplier-truth rows are preserved in the LL material library. An activation-state policy has been implemented that separates operational stock (active, available in quoting workflows) from reference-preserved stock (inactive, visible only to admins).

**14 rows** have been set to `is_active = false`. These are all Wakefield Metals reference-only entries with placeholder 1×1 dimensions, zero sheet pricing, and per-kg reference pricing only. They were already non-quoteable (`is_quoteable = false`) and excluded from the Quote Builder. The activation-state change formalizes this exclusion and ensures they are also hidden from the default library view.

**380 rows** remain `is_active = true` — all standard operational stock with proper dimensions and pricing.

No rows were deleted. No data was modified except the `is_active` flag on 14 rows.

---

## 2. Activation Policy Adopted

### Three-Tier Classification

| Tier | `is_active` | `is_quoteable` | Visible In | Count |
|------|-------------|----------------|------------|-------|
| **Active Quoteable Stock** | `true` | `true` | Quote Builder + Library (default) | 380 |
| **Inactive Preserved Stock** | `false` | `false` | Library (admin toggle only) | 14 |
| **Reference-Only Non-Quoteable** | Governed by policy | `false` | Subset of Tier 2 | 14 |

### Policy Rule

> Any row where `is_quoteable = false` MUST have `is_active = false`.

This rule is enforced:
- At seed time (initial and reconciliation inserts)
- At backfill time (field migration path)
- At server startup (drift guard — self-healing reconciliation)

### Conservative Default

All 380 quoteable rows remain active. The policy only deactivates rows that are demonstrably non-operational:
- No usable dimensions (1mm × 1mm placeholder)
- No sheet pricing ($0.00 per sheet)
- Per-kg reference pricing only
- Already excluded from quoting by `is_quoteable = false`

---

## 3. Classification Logic

Each of the 394 rows was evaluated against these criteria:

| Criterion | Active? | Rows Matching |
|-----------|---------|---------------|
| Has proper sheet/coil dimensions (length > 1 or coil stock) | Yes | 380 |
| Has usable pricing (per-sheet > 0 or per-kg for coil) | Yes | 380 |
| Is quoteable (`is_quoteable = true`) | Yes | 380 |
| Has placeholder 1×1 dimensions | No | 14 |
| Has zero sheet price with per-kg reference only | No | 14 |
| Is non-quoteable (`is_quoteable = false`) | No | 14 |

The 14 deactivated rows are a perfect overlap: every row that has placeholder dimensions also has zero sheet pricing and is non-quoteable. There are no edge cases or ambiguous rows.

---

## 4. Counts Before and After

### Total Canonical Rows

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Total canonical rows | 394 | 394 | 0 |

### Active vs Inactive

| State | Before | After | Change |
|-------|--------|-------|--------|
| Active (`is_active = true`) | 394 | 380 | -14 |
| Inactive (`is_active = false`) | 0 | 14 | +14 |

### Reference-Only

| State | Before | After | Change |
|-------|--------|-------|--------|
| Quoteable | 380 | 380 | 0 |
| Non-quoteable (ref-only) | 14 | 14 | 0 |

### By Supplier

| Supplier | Active Before | Active After | Inactive After |
|----------|--------------|--------------|----------------|
| Macdonald Steel | 105 | 105 | 0 |
| Wakefield Metals | 289 | 275 | 14 |
| **Total** | **394** | **380** | **14** |

### By Stock Behaviour

| Stock Type | Active Before | Active After | Inactive After |
|------------|--------------|--------------|----------------|
| Sheet | 198 | 196 | 2 |
| Plate | 125 | 114 | 11 |
| Coil | 55 | 55 | 0 |
| Tread Plate | 16 | 15 | 1 |
| **Total** | **394** | **380** | **14** |

### By Material Family

| Family | Active Before | Active After | Inactive After |
|--------|--------------|--------------|----------------|
| Mild Steel | 38 | 38 | 0 |
| Aluminium | 190 | 176 | 14 |
| Stainless Steel | 134 | 134 | 0 |
| Galvanised Steel | 23 | 23 | 0 |
| Corten | 9 | 9 | 0 |
| **Total** | **394** | **380** | **14** |

---

## 5. Exact Categories of Rows Deactivated and Why

All 14 deactivated rows are Wakefield Metals Aluminium reference-only entries.

| # | SKU | Description | Thickness | Grade | Stock Type | Price/kg | Reason |
|---|-----|-------------|-----------|-------|------------|----------|--------|
| 1 | 0012539 | 3.00MM AL SHT FG 5005 | 3mm | 5005 | sheet | $7.77 | Ref-only: 1×1 dims, $0 sheet price |
| 2 | 0012540 | 3.00MM AL SHT FG 5052 | 3mm | 5052 | sheet | $7.52 | Ref-only: 1×1 dims, $0 sheet price |
| 3 | 0012552 | 4.00MM AL PLT FG 5052 | 4mm | 5052 | plate | $8.30 | Ref-only: 1×1 dims, $0 sheet price |
| 4 | 0012557 | 4.00MM AL TREAD PLT FG 5052 | 4mm | 5052 | tread_plate | $8.27 | Ref-only: 1×1 dims, $0 sheet price |
| 5 | 0012560 | 5.00MM AL PLT FG 5083 | 5mm | 5083 | plate | $10.32 | Ref-only: 1×1 dims, $0 sheet price |
| 6 | 0010935 | 5.00MM AL PLT FG 5052 | 5mm | 5052 | plate | $8.30 | Ref-only: 1×1 dims, $0 sheet price |
| 7 | 0012565 | 6.00MM AL PLT FG 5052 | 6mm | 5052 | plate | $8.30 | Ref-only: 1×1 dims, $0 sheet price |
| 8 | 0012631 | 6.00MM AL PLT FG 5083 | 6mm | 5083 | plate | $10.32 | Ref-only: 1×1 dims, $0 sheet price |
| 9 | 0012778 | 10.0MM AL PLT FG 5083 | 10mm | 5083 | plate | $10.32 | Ref-only: 1×1 dims, $0 sheet price |
| 10 | 0012779 | 12.0MM AL PLT FG 5083 | 12mm | 5083 | plate | $9.55 | Ref-only: 1×1 dims, $0 sheet price |
| 11 | 0012632 | 16.0MM AL PLT FG 5083 | 16mm | 5083 | plate | $10.32 | Ref-only: 1×1 dims, $0 sheet price |
| 12 | 0019013 | 16.0MM AL PLT FG 6061 | 16mm | 6061 | plate | $10.88 | Ref-only: 1×1 dims, $0 sheet price |
| 13 | 0000711 | 25.0MM AL PLT FG 5083 | 25mm | 5083 | plate | $18.54 | Ref-only: 1×1 dims, $0 sheet price |
| 14 | 0012541 | 4.00MM AL PLT FG 5083 | 4mm | 5083 | plate | $9.55 | Ref-only: 1×1 dims, $0 sheet price |

**Common characteristics:**
- All Wakefield Metals
- All Aluminium family
- All have 1mm × 1mm placeholder dimensions
- All have $0.00 per-sheet price
- All have per-kg reference pricing only
- All were already `is_quoteable = false`
- These represent Wakefield's per-kg reference prices for grades/thicknesses they can supply on a cut-to-order basis, but without standard stocked sheet sizes

---

## 6. UI/Operational Impact

### Quote Builder (Operator)

**No change in behaviour.** The Quote Builder already fetched materials via `?active=true&quoteable=true`, which excluded the 14 non-quoteable rows. The activation-state change adds a second layer of exclusion but does not alter what operators see.

| State | Before | After |
|-------|--------|-------|
| Materials in Quote Builder selector | 380 | 380 |

### Library Admin View

| Feature | Before | After |
|---------|--------|-------|
| Default view | All 394 rows visible | 380 active rows visible |
| Inactive rows | All shown (with opacity badge) | Hidden by default |
| "Show inactive" toggle | Not present | Checkbox with count: "Show 14 inactive" |
| Stock segment counts | Counted all rows | Counts respect active/inactive toggle |
| Empty state message | "No sheet materials found" | Context-aware: shows "inactive hidden" hint when applicable |

### Library Tab Impact

Only the **Aluminium** tab is affected (all 14 inactive rows are Aluminium):

| Aluminium Tab | Before | After (default) | After (show inactive) |
|---------------|--------|-----------------|----------------------|
| Total visible | 190 | 176 | 190 |
| Plate visible | 63 | 52 | 63 |
| Sheet visible | 85 | 83 | 85 |
| Coil visible | 26 | 26 | 26 |
| Tread visible | 16 | 15 | 16 |

All other tabs (Mild Steel, Stainless Steel, Galvanised, Corten) are unchanged.

---

## 7. Admin/Manual Activation Path

### Viewing Inactive Rows

1. Navigate to `/library` → select LL division → Aluminium tab
2. Tick the "Show 14 inactive" checkbox in the filter bar
3. Inactive rows appear with:
   - 50% opacity
   - "Inactive" badge (secondary variant)
   - "Ref Only" badge (secondary variant)
   - "per-kg ref" dimension display

### Manually Activating a Row

1. Show inactive rows via the checkbox
2. Click the pencil (edit) icon on the target row
3. In the Edit Material dialog, tick the "Active" checkbox
4. Click "Save"
5. The row immediately becomes active and visible in normal view and Quote Builder

### Bulk Activation via API

```
PATCH /api/ll-sheet-materials/:id
Body: { "isActive": true }
```

### Self-Healing Policy Guard

On every server startup, the seed reconciliation function checks for drift (non-quoteable rows that are active) and automatically deactivates them. This means:
- Manual activation of a ref-only row will persist until next server restart
- To permanently activate a ref-only row, also set `is_quoteable = true` and provide proper dimensions/pricing
- This is the intended conservative behaviour — ref-only rows should not remain active without deliberate data curation

---

## 8. Risks / Deferred Items

| Risk | Severity | Mitigation |
|------|----------|------------|
| Admin manually activates a ref-only row, server restart deactivates it | Low | By design — guard enforces policy. To permanently activate, also set `isQuoteable = true` with proper dims/pricing |
| Future Wakefield import adds new ref-only rows as active | None | Seed logic now sets `isActive = false` for `isQuoteable = false` rows |
| Macdonald rows have no ref-only entries, policy has no effect | None | All Macdonald rows are properly quoteable with correct dimensions |
| Coil rows remain active despite being specialty stock | Low | Coil pricing engine is fully operational; coils have proper per-kg pricing and the Quote Builder supports coil quoting. Conservative to keep active |

### Deferred

- No additional deactivation categories identified at this time
- If the business identifies specific grades, alloys, or stock types that should be inactive by default, the admin can deactivate them manually via the library edit dialog
- Future phase could add batch activation/deactivation controls if needed

---

## 9. Release Recommendation

The activation-state governance is implemented, tested, and self-healing. The policy is conservative (only deactivating rows that are demonstrably non-operational) and preserves all canonical supplier-truth data.

---

## Validation

### Exact Files Changed

| File | Change |
|------|--------|
| `client/src/pages/library.tsx` | Added `showInactive` state, activation filter, "Show inactive" checkbox, context-aware empty state, activation-aware stock segment counts |
| `server/routes.ts` | Seed insert/reconcile/backfill paths set `isActive` based on `isQuoteable`; startup drift guard enforces non-quoteable → inactive |
| Database (`ll_sheet_materials`) | 14 rows updated: `is_active` changed from `true` to `false` |

### Before/After Active Counts

| Metric | Before | After |
|--------|--------|-------|
| Total canonical rows | 394 | 394 |
| Active rows | 394 | 380 |
| Inactive rows | 0 | 14 |

### Canonical Row Count Unchanged?

**YES** — 394 rows before, 394 rows after. Zero deletions.

### Normal Quoting Only Uses Intended Active Rows?

**YES** — Quote Builder fetches `GET /api/ll-sheet-materials?active=true&quoteable=true`, which returns exactly 380 rows. The 14 inactive/non-quoteable rows are excluded by both the `active` and `quoteable` filters.

### Inactive Rows Still Preserved and Manually Activatable?

**YES** — All 14 rows remain in the database with full supplier provenance (SKU, description, pricing, source reference). They are visible in the library admin view via the "Show inactive" toggle and can be manually activated via the edit dialog.

---

## Final Release Gate

| Gate | Decision |
|------|----------|
| Push to Git | **YES** |
| Publish to live | **YES** |
| New Replit chat needed for next phase | **YES** |
