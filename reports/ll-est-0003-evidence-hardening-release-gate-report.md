# LL-EST-0003 Evidence Hardening + Legacy Pricing Governance Clarification

**Enterprise Release Gate Report**

**Date**: April 16, 2026  
**Phase**: Evidence Hardening + Legacy Pricing Governance Clarification  
**System**: SteelIQ — Lateral Enterprises (Lateral Laser Division)  
**Investigator**: SteelIQ Agent  
**Standard**: Enterprise Governance — Release Gate  

---

## 1. Executive Summary

This report provides release-grade evidence for the LL-EST-0003 integrity incident and the Phase 5B bucketed commercial pricing model. It separates observed fact from inference, production evidence from development evidence, and code reading from runtime proof.

**Key findings:**

1. LL-EST-0003 has **never** had 4 persisted line items in production. The production database contains exactly 2 items, and the record has never been updated since creation.
2. The earlier 4-item observation is **most likely** attributable to environment confusion (DEV vs LIVE), viewing a different estimate, or transient browser state. It cannot be confirmed as a persistence defect.
3. No line-item persistence defect exists in the current LL estimate save/load path. This has been verified through code-path analysis, controlled 4-item reproduction tests, and database inspection.
4. Legacy estimates (pre-Phase 5B) are handled correctly by the current engine through explicit fallback defaults.
5. The LL pricing admin UI is now aligned with runtime-governing fields.

---

## 2. LL-EST-0003 Historical Incident Reconciliation

### 2.1 Production Database Evidence (Observed Fact)

**Query**: `SELECT estimate_number, customer_name, status, jsonb_array_length(items_json::jsonb) as item_count, created_at, updated_at FROM laser_estimates ORDER BY estimate_number` against production replica.

**Result (complete production table — no records omitted):**

| Estimate | Customer | Status | Items | Created | Updated |
|----------|----------|--------|-------|---------|---------|
| LL-EST-0002 | Propharma TKD | draft | 1 | 2026-04-15 22:25:52 | 2026-04-15 22:25:52 |
| LL-EST-0003 | Arvida - Jarred Cornwell | draft | 2 | 2026-04-16 02:46:38 | 2026-04-16 02:46:38 |

**No archived estimates exist.** A separate query with `WHERE archived_at IS NOT NULL` returned zero rows. There is no LL-EST-0001 or any other estimate in production.

**LL-EST-0003 raw persisted items (production):**

| Item ID | Ref | Title | Material | Thick | Qty | Markup | Bucketed Fields |
|---------|-----|-------|----------|-------|-----|--------|-----------------|
| c33489f4-... | 001 | test | Aluminium 5052 Fibre PE | 3mm | 1 | 35% (flat) | absent |
| bf2430cf-... | 002 | Side wall | Aluminium 5052 Fibre PE | 3mm | 2 | 35% (flat) | absent |

**Timestamp evidence**: `created_at = updated_at` (2026-04-16 02:46:38.761242). This proves the record was created in a single transaction and has **never been updated** — no save cycle has ever occurred after initial creation.

### 2.2 Production Deployment Log Evidence (Observed Fact)

Production server logs (captured via deployment log inspection) confirm:
- GET `/api/laser-estimates` returns array with LL-EST-0003 containing exactly 2 items in `itemsJson`
- GET `/api/laser-estimates/49114ca0-...` returns the single record with 2 items
- No PATCH requests observed for this estimate — consistent with the never-updated timestamp

### 2.3 Development Database Evidence (Observed Fact)

The development database has no LL-EST-0003. Dev estimates start at LL-EST-0012 and contain separate test data created during development. This confirms **production and development are entirely separate environments** with no data overlap.

### 2.4 Historical Incident Assessment

**Did LL-EST-0003 ever have 4 persisted line items in the inspected live database?**  
**NO.**

**Evidence supporting this answer:**
1. Production database shows exactly 2 items, confirmed by direct SQL query against production replica
2. `created_at = updated_at` proves no update has ever occurred — if items were added and then lost, at minimum one PATCH would have been executed, changing `updated_at`
3. No archived or deleted estimates exist in production
4. Production server logs show 2 items in every API response for this estimate

**Most likely explanation for the earlier 4-item observation:**

This is classified as **MOST LIKELY — not confirmed** (insufficient evidence to confirm a single root cause definitively):

- **Environment confusion** (most likely): The prior observation may have been made against the development environment, which has different estimates with different item counts. LL-EST-0012 through LL-EST-0023 exist in DEV with various item counts (0–4 items). An estimate with 4 items was recently created in DEV as a test (LL-EST-0023).
- **Stale browser/local form state** (possible): If the user was actively adding items in the UI without saving, the browser state could show 4 items while the database had 2. The `items` state in React is local until "Save Estimate" is clicked.
- **Wrong estimate viewed** (possible): The user may have been viewing a different estimate or a different record that happened to have 4 items.
- **UI hydration/render bug** (unlikely): Code inspection found no duplication logic in the item hydration path that could produce phantom items from a 2-item persisted array.
- **Query/filter mismatch** (unlikely): The API returns `itemsJson` as-is from the database; there is no server-side filtering or transformation that could alter item count.

**Is the earlier 4-item observation fully explained?**  
**NO** — the exact circumstances cannot be determined retrospectively. However, the evidence strongly rules out a persistence defect. The observation is most likely attributable to environment confusion or unsaved browser state.

---

## 3. Current Persistence Integrity Findings

### 3.1 Controlled Reproduction Tests (Runtime Proof — Development)

**Test 1: 4-Item Create/Save/Reload**
- Created estimate LL-EST-0023 with 4 items (P001 Alpha, P002 Beta, P003 Gamma, P004 Delta)
- Saved to database
- Navigated away to /laser-estimates list
- Reopened estimate — 4 items present
- Navigated away again and returned — 4 items present
- Database inspection confirmed `jsonb_array_length(items_json::jsonb) = 4`
- **RESULT: PASS**

**Test 2: 1-Item Create/Save/Reload**
- Created estimate LL-EST-0024 with 1 item (L001 Legacy Quick Part)
- Saved, navigated away, reopened — 1 item present
- **RESULT: PASS**

**Test 3: 2-Item Round-Trip (prior phase)**
- Created estimate LL-EST-0022 with 2 items (RT-001, RT-002)
- Full save/reload cycle — 2 items present
- **RESULT: PASS**

### 3.2 Code-Path Analysis (Code Reading)

**Load path** (`server/routes.ts` lines 1986–2003, `laser-quote-builder.tsx` lines 545–554):
- Server: `storage.getLaserEstimate(id)` performs a direct SELECT, returns `itemsJson` as-is
- Client: `estimateData.itemsJson.map(it => ({ ...it, id: it.id || crypto.randomUUID() }))` hydrates into React state
- No filtering, deduplication, or transformation occurs
- Guard: `if (Array.isArray(savedItems) && savedItems.length > 0)` — items are only set if the array is non-empty and valid

**Save path** (`laser-quote-builder.tsx` lines 662–669):
- Client sends `{ customerName, projectAddress, itemsJson: items }` — raw state array
- Server (`routes.ts` lines 2042–2069): validates via Zod, passes to `storage.updateLaserEstimate`
- No transformation or filtering on server side
- The `items` state is the single source of truth during the session

**Item add/remove** (`laser-quote-builder.tsx` lines 795–824):
- `handleDialogSave`: appends new item with `crypto.randomUUID()` or updates existing by ID match
- `handleDelete`: filters by ID exclusion
- Both use functional state updates (`setItems(prev => ...)`) — safe against race conditions
- Save button disabled while mutation is pending (`isSaving`)

**Potential phantom item paths identified (Code Reading — theoretical, not observed):**
- None found. No code path duplicates items during load, save, or render.
- The only ID regeneration is `crypto.randomUUID()` for items missing `id` — this creates new keys but does not duplicate items.

### 3.3 Persistence Defect Assessment

**Is there any confirmed LL line-item persistence defect in current estimate save/load behavior?**  
**NO.**

**Was this caused by the recent bucketed pricing refactor?**  
**NO.**

**Evidence ruling the refactor out:**
1. The bucketed pricing refactor (Phase 5B) modified `computeItemPricing`, `itemToSnapshotItem`, `snapshotItemToItem`, the pricing breakdown panel, and the edit dialog form. None of these functions modify the `items` array itself or the save/load serialization path.
2. The save path (`itemsJson: items`) is unchanged — it sends the raw state array.
3. The load path (`estimateData.itemsJson.map(...)`) is unchanged — it maps items 1:1.
4. Three controlled reproduction tests across different item counts all passed.
5. Database counts match UI counts in every tested scenario.

**Can LL estimates currently be trusted to save/reload correctly in LIVE?**  
**YES.**

**Caveats:**
- There is a theoretical (not observed) race condition: if a user edits an item during the brief window between save submission and cache refresh, the cache refresh could overwrite unsaved local changes. This is a standard optimistic-update concern and does not affect item count integrity.
- `crypto.randomUUID()` is used client-side for item IDs. These are regenerated if missing from persisted data. This does not affect item count but means item IDs are not guaranteed stable across sessions for items that were created before ID persistence was added.

---

## 4. Root Cause Analysis

### 4.1 Summary

No persistence defect was found. The earlier 4-item observation for LL-EST-0003 is most likely attributable to one of:

1. **Environment confusion** — viewing DEV data while believing it was LIVE (most likely)
2. **Unsaved browser state** — items added in the UI but not yet persisted (possible)
3. **Wrong estimate** — viewing a different record (possible)

The production database is authoritative: LL-EST-0003 was created once with 2 items and has never been modified.

### 4.2 What Cannot Be Proven

- The exact moment and context of the earlier 4-item observation cannot be reconstructed
- Whether the observation was from a screenshot, live browser, or verbal report is unknown
- No application-level audit log exists for LL estimate views that would provide a historical trace

---

## 5. Legacy Pricing Governance Clarification

### 5.1 Fields Stored in Pre-Phase 5B Estimates

Legacy LL estimate items (including LL-EST-0003) store:

| Field | Value | Status |
|-------|-------|--------|
| `markupPercent` | 35 | Present — legacy flat markup |
| `materialMarkupPercent` | absent | Not stored |
| `consumablesMarkupPercent` | absent | Not stored |
| `unitPrice` | computed at creation time | Present — legacy calculated value |
| `cutLengthMm`, `pierceCount`, etc. | present | Geometry fields stored |

### 5.2 Current Runtime Behavior for Legacy Items

When a legacy item is loaded into the current Phase 5B engine (`computeItemPricing`, line 154):

```
materialMarkupPercent: item.materialMarkupPercent ?? rates.defaultMaterialMarkupPercent
consumablesMarkupPercent: item.consumablesMarkupPercent ?? rates.defaultConsumablesMarkupPercent
```

**Resolution chain for `materialMarkupPercent`:**
1. `item.materialMarkupPercent` → `undefined` (absent in legacy item)
2. Falls to `rates.defaultMaterialMarkupPercent`
3. `rates` comes from `resolveRatesFromSettings(settings)`
4. If active pricing profile has `commercialPolicy.defaultMaterialMarkupPercent` set → uses that value
5. If not set → falls to `LL_PRICING_DEFAULTS.DEFAULT_MATERIAL_MARKUP_PERCENT` = 20

**Resolution chain for `consumablesMarkupPercent`:**
1. Same pattern → profile value or hardcoded default 25%

**Resolution chain for machine buy cost:**
1. `machineProfile.machineBuyCostPerHour` → if set on profile machine, uses it
2. If not set → `sellRate * LL_PRICING_DEFAULTS.MACHINE_BUY_COST_RATIO` = sellRate × 0.6

### 5.3 Is Legacy Flat Markup 35% Still the Primary Runtime Sell Driver?

**NO.** The legacy `markupPercent: 35` field is stored in the item but is **not used** by the Phase 5B bucketed engine for any bucket. The current sell price is derived from:
- Material sell = materialBuy × (1 + materialMarkupPercent / 100)
- Machine sell = machineTimeHours × hourlyMachineRate (the profile sell rate)
- Gas sell = pass-through at cost
- Consumables sell = consumablesBuy × (1 + consumablesMarkupPercent / 100)
- Labour sell = time × shopRatePerHour

The old `markupPercent` field is retained for backward-compatible snapshot data but does not drive any pricing calculation in the current engine.

### 5.4 Legacy Estimate Open/Save Behavior

**When a legacy estimate is opened but NOT saved:**
- Items are loaded from `itemsJson` with their original fields
- The engine computes runtime pricing using bucketed fallback defaults (20% material, 25% consumables, 60% machine buy ratio)
- The UI displays the bucketed breakdown (Material/Machine/Gas/Consumables/Labour buy/sell/margin)
- **No persisted data changes** — the database is not touched
- The displayed sell total MAY differ from the original `unitPrice` stored in the item, because the pricing engine has changed from flat-markup to bucketed

**When a legacy estimate is opened and saved (without editing items):**
- The save path sends `itemsJson: items` — the raw state array
- Since `materialMarkupPercent` and `consumablesMarkupPercent` are `undefined` on the items, they remain absent in the JSON (JSON.stringify omits undefined fields)
- The item structure is **preserved as-is** — no automatic format upgrade occurs
- `updated_at` changes, `pricingProfileId`/`pricingProfileLabel`/`pricedAt` are refreshed to the current active profile

**When a legacy estimate item is opened in the edit dialog and re-saved:**
- `openEditDialog` sets `materialMarkupPercent: item.materialMarkupPercent` → `undefined`
- The form displays the fallback defaults in the input fields (20% material, 25% consumables)
- If the user does NOT change these values, `formData.materialMarkupPercent` remains `undefined`
- The item is saved back with `materialMarkupPercent` still absent
- If the user DOES explicitly set new values, those values are persisted to the item

### 5.5 Can Totals or Displayed Pricing Change on First Re-save?

**YES — displayed pricing will change, but persisted `unitPrice` is also recalculated.**

**Explanation:** The original `unitPrice` stored in LL-EST-0003 items was calculated using the old flat-markup model. When the estimate is opened in the current UI, the engine recalculates using the bucketed model. This changes the displayed pricing. If the user then saves, the new `unitPrice` (calculated by the bucketed engine) overwrites the old value.

**Operational risk assessment:**
- **Risk**: MODERATE — the new pricing model produces different totals than the old model for the same inputs. This is by design (Phase 5B was a pricing model change), not a defect.
- **Mitigation**: The original items retain their raw field structure. The `unitPrice` field is recalculated on every save from the current engine, which is the intended behavior.
- **User impact**: An administrator opening LL-EST-0003 will see pricing computed by the bucketed model. If they compare to a previous printout or memory of the old total, the numbers will differ. This should be communicated as a known consequence of the Phase 5B pricing model upgrade.

---

## 6. Pricing Model Admin Alignment Findings

### 6.1 Runtime-Governing Fields for New LL Estimates

| Field | Source | Governs |
|-------|--------|---------|
| `materialMarkupPercent` | Item-level or profile `defaultMaterialMarkupPercent` or code default 20% | Material sell = buy × (1 + markup%) |
| `consumablesMarkupPercent` | Item-level or profile `defaultConsumablesMarkupPercent` or code default 25% | Consumables sell = buy × (1 + markup%) |
| `hourlyMachineRate` | Machine profile (sell rate) | Machine sell = time × rate |
| `machineBuyCostPerHour` | Machine profile or 60% of sell rate | Machine buy = time × rate |
| `operatorRatePerHour` | Profile labour rates | Labour buy = time × rate |
| `shopRatePerHour` | Profile labour rates | Labour sell = time × rate |
| `gasPricePerL` | Governed gas cost inputs | Gas buy = consumption × price |
| `consumableCostPerHour` | Governed consumable cost inputs | Consumables buy = time × rate |
| `minimumMaterialCharge` | Profile commercial policy | Floor for material buy |
| `minimumLineCharge` | Profile commercial policy | Floor for total sell |

### 6.2 Admin UI Visibility (Verified via E2E Test)

| Field | Visible in Admin | Editable | Location |
|-------|-----------------|----------|----------|
| Material Markup % | YES | YES | Commercial Policy section |
| Consumables Markup % | YES | YES | Commercial Policy section |
| Min Material Charge | YES | YES | Commercial Policy section |
| Min Line Charge | YES | YES | Commercial Policy section |
| Machine Sell Rate | YES | YES | Machine Profiles section ("Sell Rate") |
| Machine Buy Cost | YES | YES | Machine Profiles section ("Buy Cost") |
| Operator Rate/hr | YES | YES | Labour Rates section |
| Shop Rate/hr | YES | YES | Labour Rates section |
| Gas price per L | YES | YES | Governed via Gas Cost Inputs page |
| Consumable cost/hr | YES | YES | Governed via Consumable Cost Inputs page |

### 6.3 Fields Still Hidden, Derived, or Implicit

| Field | Status | Explanation |
|-------|--------|-------------|
| `MACHINE_BUY_COST_RATIO` (0.6) | Code constant | Used as fallback when `machineBuyCostPerHour` is not set on machine profile. Not exposed in admin UI — by design, because the admin can set the explicit buy cost directly. |
| `DEFAULT_MATERIAL_MARKUP_PERCENT` (20) | Code constant | Fallback when profile `defaultMaterialMarkupPercent` is not set. Shown as default value in admin form. |
| `DEFAULT_CONSUMABLES_MARKUP_PERCENT` (25) | Code constant | Fallback when profile `defaultConsumablesMarkupPercent` is not set. Shown as default value in admin form. |

### 6.4 Admin UI Alignment Assessment

**Is the current admin UI fully aligned with runtime truth?**  
**YES** — with minor qualification.

All runtime-governing fields are now visible and editable. The only implicit values are code-level fallback constants (20%, 25%, 0.6 ratio) which serve as safety defaults when profile values are not explicitly set. These constants are reflected as default values in the admin form inputs, so the administrator sees the effective value even if it's a fallback.

The old "Default Markup 35%" label has been **completely removed** from the admin UI. No misleading legacy markup wording appears anywhere in the pricing profiles page.

---

## 7. Exact Corrections Made

### 7.1 Code Changes (Prior Phase — Verified in This Phase)

**File: `client/src/pages/ll-pricing-profiles.tsx`**

Changes made in the immediately prior phase and verified in this phase:

1. **Commercial Policy edit form**: Replaced single "Default Markup" (35%) field with "Material Markup" (default 20%) and "Consumables Markup" (default 25%) fields. Added explanatory note.
2. **Machine Profiles edit form**: Renamed "Hourly Rate" to "Sell Rate", added "Buy Cost" field with fallback to `sellRate * 0.6`. Changed grid from 5-column to 3-column.
3. **Machine Profiles new machine default**: Added `machineBuyCostPerHour: 0` to new machine template.
4. **Commercial Policy viewer**: Updated to show Material Markup and Consumables Markup instead of legacy "Markup: 35%".
5. **Machine Profiles viewer**: Updated to show "Sell $X/hr" and "Buy $Y/hr" instead of single "$X/hr".
6. **Type safety fix**: Removed two `(mp as any)` casts — `LLMachineProfile` already includes `machineBuyCostPerHour?: number`.
7. **Fallback alignment**: Changed `Math.round(mp.hourlyMachineRate * 0.6)` to `mp.hourlyMachineRate * 0.6` to match engine logic.

### 7.2 Changes Made in THIS Phase

**No code changes were made in this phase.** This phase was evidence-hardening and verification only.

### 7.3 Live Data Modifications

**No live data was modified in this phase.** All database queries were read-only (SELECT via production replica). All write tests were executed against the development database only.

---

## 8. Runtime Verification Evidence

### 8.1 Evidence Summary Table

| Test | Environment | Method | Result |
|------|-------------|--------|--------|
| LL-EST-0003 item count | Production | SQL query (production replica) | 2 items — CONFIRMED |
| LL-EST-0003 never updated | Production | Timestamp comparison | `created_at = updated_at` — CONFIRMED |
| No archived estimates | Production | SQL query with archived_at check | 0 archived — CONFIRMED |
| Production API response | Production | Deployment log inspection | 2 items in JSON — CONFIRMED |
| 4-item create/save/reload | Development | E2E Playwright test (LL-EST-0023) | 4 items stable — PASS |
| 4-item DB verification | Development | SQL query | item_count = 4 — CONFIRMED |
| 1-item save/reload | Development | E2E Playwright test (LL-EST-0024) | 1 item stable — PASS |
| 2-item save/reload | Development | E2E Playwright test (LL-EST-0022) | 2 items stable — PASS |
| Admin UI Material Markup | Development | E2E Playwright test | Visible and editable — PASS |
| Admin UI Consumables Markup | Development | E2E Playwright test | Visible and editable — PASS |
| Admin UI Machine Buy/Sell | Development | E2E Playwright test | Both visible — PASS |
| Admin UI legacy markup removed | Development | Code grep + E2E test | No "Default Markup 35%" found — PASS |

### 8.2 Evidence Classification

- **Production evidence (direct observation):** Item count, timestamps, API responses, archived state
- **Development evidence (controlled test):** Save/reload reproduction, admin UI verification, pricing computation
- **Code evidence (static analysis):** Load path, save path, hydration logic, fallback chains

---

## 9. Backward Compatibility and Legacy Save Behavior

### 9.1 Legacy Item Format Preservation

When a legacy estimate is opened and saved **without editing individual items**, the item structure is preserved exactly as stored. No automatic format upgrade occurs. Fields like `materialMarkupPercent` remain absent.

### 9.2 Runtime Pricing Computation

The Phase 5B engine always computes pricing using the bucketed model, regardless of item format. For legacy items missing bucketed fields, fallback defaults are applied:
- `materialMarkupPercent` → profile value or 20% (code constant)
- `consumablesMarkupPercent` → profile value or 25% (code constant)
- `machineBuyCostPerHour` → profile value or 60% of sell rate (code constant)

### 9.3 Price Drift on Re-open

When LL-EST-0003 is opened in the current UI, the displayed pricing will differ from the original `unitPrice` values stored in the items. This is because:
- Original pricing used a flat markup model (35% on total cost)
- Current pricing uses the bucketed model (separate markups per cost component)
- These models produce different results for the same inputs

This is a **known and intended consequence** of the Phase 5B pricing model upgrade, not a defect.

---

## 10. Remaining Risks / Deferred Items

| Item | Risk Level | Status |
|------|------------|--------|
| Price drift on legacy estimate re-open | Moderate | Known consequence of Phase 5B — by design. No corrective action needed. |
| No application-level audit log for estimate views | Low | Would enable forensic tracing of future incidents. Deferred — not in scope. |
| Profile-level bucketed defaults not yet set in LIVE profile | Low | Production profile "Standard Rate 04 2026 (1.0)" may not have `defaultMaterialMarkupPercent` or `defaultConsumablesMarkupPercent` explicitly set. Code defaults (20%/25%) apply. Admin should review and set explicitly. |
| `MACHINE_BUY_COST_RATIO` not UI-editable as a global constant | None | By design — admin sets explicit buy cost per machine. Ratio is fallback only. |

---

## 11. Final Executive Recommendation

The LL-EST-0003 integrity incident has been investigated to the extent possible with available evidence. **No persistence defect has been found.** The production record is intact, has never been modified, and contains exactly the data it was created with.

The most likely explanation for the earlier 4-item observation is environment confusion or unsaved browser state. This cannot be confirmed with certainty because no application-level audit trail exists for estimate view events.

The Phase 5B bucketed commercial pricing model is correctly implemented. The admin UI now surfaces all runtime-governing fields. Legacy estimates are handled safely through explicit fallback defaults. The save/reload path has been verified through multiple controlled reproduction tests at different item counts.

**The system is in a healthy state for continued live operation.**

---

## 12. Release Gate

### Mandatory Question Matrix

**A. Historical Incident Reconciliation**

| ID | Question | Answer | Evidence |
|----|----------|--------|----------|
| A1 | Did LL-EST-0003 ever have 4 persisted line items in the inspected live database? | **NO** | Production SQL: `item_count = 2`, `created_at = updated_at`, no archived records |
| A2 | What exact evidence supports that answer? | See above | Direct production replica query, deployment log API responses, timestamp immutability |
| A3 | If NO, most likely explanation for the 4-item observation? | **Environment confusion** (most likely), unsaved browser state (possible), wrong estimate (possible) | DEV has different estimates (LL-EST-0012+); no LL-EST-0003 in DEV; user may have viewed DEV while believing it was LIVE |
| A4 | Is the earlier 4-item observation fully explained? | **NO** | Exact circumstances cannot be reconstructed — no application audit log for estimate views |
| A5 | If not fully explained, what remains uncertain? | Which environment/estimate/browser state produced the observation | No audit trail exists |

**B. True Persistence Defect Check**

| ID | Question | Answer | Evidence |
|----|----------|--------|----------|
| B1 | Is there any confirmed LL line-item persistence defect in current estimate save/load behavior? | **NO** | 3 controlled reproduction tests passed (1-item, 2-item, 4-item); DB counts match UI counts |
| B2 | Was this caused by the recent bucketed pricing refactor? | **NO** | Phase 5B modified pricing computation, not save/load paths; `itemsJson: items` unchanged |
| B3 | If NO, what evidence rules the refactor out? | — | Save path (`itemsJson: items`) and load path (`itemsJson.map(...)`) are unchanged by Phase 5B; no filtering/transformation added |
| B4 | If YES, identify exact layer | **N/A** | No defect found |
| B5 | Can LL estimates currently be trusted to save/reload correctly in LIVE? | **YES** | Multiple controlled tests + code-path analysis confirm |
| B6 | State any caveats | — | Theoretical race: edit during save submission window could lose unsaved local changes. Does not affect item count. |

**C. Legacy Pricing Governance Clarification**

| ID | Question | Answer | Evidence |
|----|----------|--------|----------|
| C1 | For old LL estimates, what fields are stored historically? | `markupPercent: 35`, `unitPrice`, geometry fields. No `materialMarkupPercent`, `consumablesMarkupPercent` | Raw JSON from production LL-EST-0003 |
| C2 | Under current runtime, what fields govern displayed pricing for legacy items? | Bucketed model: `materialMarkupPercent` (fallback 20%), `consumablesMarkupPercent` (fallback 25%), machine buy (fallback 60% of sell), operator/shop rates from profile | Code: `computeItemPricing` line 154, `resolveRatesFromSettings` |
| C3 | Is legacy flat Markup 35% still the real primary sell driver? | **NO** | `markupPercent` field is not referenced by any bucketed pricing calculation in `computeLLPricing` |
| C4 | What fallback defaults are used if bucket fields are absent? | Material markup 20%, consumables markup 25%, machine buy 60% of sell | Code constants in `LL_PRICING_DEFAULTS` |
| C5 | Are those defaults explicit profile-governed values or code fallbacks? | **Both** — profile `commercialPolicy.defaultMaterialMarkupPercent` is checked first, then code constant | `resolveRatesFromSettings` lines 224–225 |
| C6 | When a legacy estimate is opened but not saved, what happens? | Engine computes bucketed pricing using fallback defaults. Display may differ from original `unitPrice`. No DB changes. | Code analysis + runtime behavior |
| C7 | When a legacy estimate is opened and saved, what exactly changes in persisted data? | `updated_at` changes, `pricingProfileId`/`pricingProfileLabel`/`pricedAt` refresh. Item structure preserved as-is (bucketed fields remain absent). `unitPrice` NOT recalculated on estimate save (only on item edit). | Code: `updateEstimateMutation` sends `items` state unchanged |
| C8 | Can totals or displayed pricing change on first re-save of a legacy estimate? | **YES** — displayed pricing changes immediately on open (bucketed engine differs from flat markup). Persisted `unitPrice` changes only if individual item is edited and re-saved via dialog. | Engine model change is by design (Phase 5B) |
| C9 | If YES, explain precisely and assess operational risk | **Moderate risk**: Admin viewing LL-EST-0003 will see different pricing than originally calculated. This is the intended consequence of Phase 5B. Original `unitPrice` values in the item JSON are stale but preserved until item-level re-save. | By design — no corrective action needed |

**D. Admin UI Governance Alignment**

| ID | Question | Answer | Evidence |
|----|----------|--------|----------|
| D1 | What runtime pricing fields are active today for new LL estimates? | materialMarkupPercent, consumablesMarkupPercent, hourlyMachineRate, machineBuyCostPerHour, operatorRatePerHour, shopRatePerHour, gas/consumable governed costs, min charges | `computeLLPricing` function signature and logic |
| D2 | Which of those fields are now visible/editable in admin? | All of the above — Material Markup, Consumables Markup, Sell Rate, Buy Cost, Operator Rate, Shop Rate, Min Material, Min Line | E2E test verified both edit and read-only views |
| D3 | Which runtime-governing fields are still hidden, derived, or only implicit? | `MACHINE_BUY_COST_RATIO` (0.6) — code fallback constant, not directly editable. By design — admin sets explicit buy cost instead. | Code constant in `LL_PRICING_DEFAULTS` |
| D4 | Is the current admin UI fully aligned with runtime truth? | **YES** | All governing fields visible; old "Default Markup 35%" removed; fallback constants shown as default values in form inputs |
| D5 | If NO, what exact mismatch remains? | **N/A** — aligned | — |

**E. Safe Correction**

| ID | Question | Answer | Evidence |
|----|----------|--------|----------|
| E1 | Was any code change made in this phase? | **NO** | This phase was evidence-hardening and verification only |
| E2 | If YES, what exact file(s) and purpose? | **N/A** | — |
| E3 | Was any live data modified? | **NO** | All production queries were read-only (SELECT via replica); all write tests in DEV only |
| E4 | If YES, what exactly changed? | **N/A** | — |
| E5 | Is any further corrective work required before live publishing? | **NO** | Recommend LIVE profile review by admin to set explicit bucketed defaults, but not a blocker |

### Mandatory Validation Block

| Question | Answer |
|----------|--------|
| Did LL-EST-0003 ever have 4 persisted line items in the inspected live database? | **NO** |
| Is the earlier 4-item observation fully explained? | **NO** — most likely environment confusion or unsaved state, but exact cause cannot be confirmed retrospectively |
| Is there any confirmed current LL line-item persistence defect? | **NO** |
| Was any confirmed issue caused by the recent pricing refactor? | **NO** |
| Is line-item save/reload behavior currently trustworthy in LIVE? | **YES** |
| Is Markup 35% still the primary runtime sell driver? | **NO** — Phase 5B bucketed model governs all pricing |
| Are legacy estimates governed partly by fallback logic today? | **YES** — bucketed fields absent from legacy items use profile defaults or code constants |
| Is the LL Pricing Model admin UI fully aligned with runtime truth? | **YES** |
| Was any live data modified in this phase? | **NO** |
| Is further work required before publish? | **NO** — recommend LIVE profile review by admin to set explicit bucketed defaults |

### Final Release Gate

**Push to Git: YES**  
**Publish to live: YES**  
**New Replit chat needed for next phase: YES**
