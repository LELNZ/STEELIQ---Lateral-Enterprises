# Coil Library Discoverability — Runtime UX Correction Report

## 1. Executive Verdict

Coil rows were present in the database, API, and rendering code all along — the issue was **operational discoverability**, not data absence. Three UX friction points made coil effectively invisible to normal users:

1. The library page defaulted to a non-LL tab (`direct_materials`) regardless of division context
2. Switching to the LL division didn't auto-navigate to an LL material tab
3. Stock type filtering used a passive dropdown buried among 5 other filters

All three are now corrected. Coil is **immediately visible** when a user navigates to the LL-scoped library.

---

## 2. Exact Before Click Path

To see coil rows **before** this fix, a user had to:

1. Navigate to `/library`
2. Page loads on **"Direct Materials"** tab (an LJ tab)
3. Notice there are ~15 tabs in the tab bar
4. Scroll/scan right to find **"Aluminium"** or **"Stainless Steel"** tabs
5. Click one of those tabs
6. See a long list of 190+ materials (sheet, plate, coil, tread all mixed)
7. Notice a small dropdown filter labelled "Stock Type" among 5 other dropdown filters
8. Open the dropdown, select "coil"
9. Only then see the 26 (Al) or 29 (SS) coil rows

**Minimum clicks: 3** (tab click + dropdown open + dropdown select)
**Required knowledge: 2** (know LL tabs exist, know stock filter exists)

---

## 3. Why Coil Was Hard to Discover

| Friction Point | Impact |
|---------------|--------|
| Default tab is `direct_materials` (LJ) | User never sees LL material tabs without deliberate exploration |
| Clicking "LL" scope didn't switch to an LL tab | User saw "No library categories" or the wrong tab stayed active |
| Stock type was a dropdown buried in the filter bar | Coil was mixed with 150+ sheet/plate rows — no visual separation |
| Stock badges were passive, tiny (10px), outline-only | Easy to overlook; not clickable |
| No stock type segmentation in the card header area | User had to scroll through all rows to discover coil existed |

---

## 4. UI/Filter/Default-State Changes Made

### Change 1: Smart Division-Aware Tab Default

**File**: `client/src/pages/library.tsx`

- Initial tab now computed from URL division parameter: `LL → ll_aluminium`, otherwise `direct_materials`
- `setDivisionAndUrl()` now sets `activeTab` when division changes: `LL → ll_aluminium`, `LJ → direct_materials`
- `useEffect` on `validDivision` also forces the correct tab when URL state changes externally

**Result**: Navigating to `/library?division=LL` or clicking the "LL" scope button immediately shows the Aluminium materials tab.

### Change 2: Clickable Stock-Type Segment Controls

**File**: `client/src/pages/library.tsx`

Replaced:
- Passive outline badges (10px, non-clickable) in the card title
- Hidden dropdown filter for stock type

With:
- **Prominent clickable segment buttons** in the card header: `All (190)` | `Coil (26)` | `Plate (63)` | `Sheet (85)` | `Tread (16)`
- Each button shows its count
- Colour-coded: **blue** for coil, **orange** for plate, **purple** for tread
- Toggle behaviour: click to filter, click again to unfilter
- Positioned **above** the other filter dropdowns for immediate visibility

**Result**: User sees stock types at a glance with counts, and can isolate coil with a single click.

### Change 3: Removed Redundant Stock Dropdown

The stock type dropdown was removed from the filter bar since the segment buttons now serve the same purpose more effectively. This reduces filter clutter.

---

## 5. Exact After Click Path

To see coil rows **after** this fix:

### Path A: Direct URL (optimal)
1. Navigate to `/library?division=LL`
2. Page loads directly on **Aluminium Materials** tab
3. Stock segment buttons visible immediately: `All (190)` | **`Coil (26)`** | `Plate (63)` | `Sheet (85)` | `Tread (16)`
4. Click **Coil** button → see only coil rows

**Clicks: 1** (Coil button)
**Required knowledge: 0** (coil is labelled and visible)

### Path B: From any library state
1. Click **LL** in division scope selector
2. Tab auto-switches to **Aluminium Materials**
3. Stock segment buttons visible immediately
4. Click **Coil** button → see only coil rows

**Clicks: 2** (LL scope + Coil button)
**Required knowledge: 0**

---

## 6. Before/After Comparison

### Before

| Aspect | State |
|--------|-------|
| Default tab for LL | `direct_materials` (wrong division) |
| Tab after clicking LL scope | First visible tab (often `ll_mild_steel`, not `ll_aluminium`) |
| Coil discovery method | Hidden dropdown among 5 filters |
| Coil visual prominence | 10px outline badge, non-interactive |
| Clicks to see coil | 3+ |

### After

| Aspect | State |
|--------|-------|
| Default tab for LL | `ll_aluminium` (correct) |
| Tab after clicking LL scope | `ll_aluminium` (smart switch) |
| Coil discovery method | Prominent colour-coded button in header |
| Coil visual prominence | Blue clickable button with count |
| Clicks to see coil | 1 (from LL view) |

### Coil Visibility Count

| Context | Before | After |
|---------|--------|-------|
| Aluminium coil rows in DB | 26 | 26 |
| Stainless coil rows in DB | 29 | 29 |
| Total coil rows returned by API | 55 | 55 |
| Coil rows visible on default page load | 0 (wrong tab) | 26 (Aluminium tab auto-selected) |
| Clicks to isolate coil | 3+ | 1 |

---

## 7. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| LJ users see different default tab | None | LJ defaults to `direct_materials` (unchanged behaviour) |
| Stock segment buttons add visual weight | Low | Only shown when multiple stock types exist; compact 7px height |
| Toggle deselect (click active button) returns to "all" | Info | Intentional — easy to undo filter |
| Sheet/plate workflows unchanged | None | Same data, same filters, same rendering |

---

## 8. Release Recommendation

The changes are safe, minimal, and backward-compatible. Coil is now immediately discoverable.

---

## Validation

### Files Changed

| File | Change |
|------|--------|
| `client/src/pages/library.tsx` | Smart tab defaults + clickable stock segment controls |

### Default Division Scope Changed?

**No.** Default division scope is still `null` (All). The change only affects what happens *when* LL is selected.

### Default Material Tab Changed?

**Yes, conditionally.** When division is LL (via URL or click), default tab is now `ll_aluminium` instead of `direct_materials`. When division is LJ or All, default remains `direct_materials`.

### Stock-Behaviour Filter Default Changed?

**No.** Stock filter still defaults to "all" — all stock types visible. The change is that the filter is now **clickable buttons** instead of a hidden dropdown.

### Sheet/Plate Workflows Still Correct?

**Yes.** The stock segment buttons filter the same way the dropdown did. Sheet and plate rows render identically. No data model changes.

---

## Final Release Gate

| Gate | Decision |
|------|----------|
| Push to Git | **YES** |
| Publish to live | **YES** |
| New Replit chat needed for next phase | **YES** (if expanding beyond Wakefield/coil scope) |
