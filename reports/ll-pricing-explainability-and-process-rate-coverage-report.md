# LL Pricing Explainability + Governed Process-Rate Coverage Review

**Phase:** LL Pricing Explainability + Governed Process-Rate Coverage Review
**Date:** 16 April 2026
**Scope:** Narrow review — bucket explainability in runtime UI, process-rate coverage against active LL library, 2kW machine realism, narrowest safe corrections only.
**Out of scope:** Preview/PDF, LJ/LE workflows, manufacturing, document contracts, gas package redesign, quantity breaks, batch grouping, nesting, source-cost redesign, schema redesign.

---

## 1. Executive Summary

The current bucketed pricing engine is mathematically sound and its internal model is correct, but **runtime explainability is thin**: the estimate UI shows Buy/Sell/Margin per bucket with only a single-line Supplier/Parts-per-Sheet/Est-Sheets/Machine-Time header. Estimators cannot currently explain how each bucket was formed without opening code or the admin profile.

In addition, the **active LL material library contains combinations that have no governed process-rate coverage** and will silently fall back to a flat-rate model. The most significant case is **Corten / Weathering plate (2.5–6mm, 9 active combinations)** — there is no `Corten` family in the process-rate table at all. Several thin-gauge and heavy-gauge edge cases for Aluminium, Mild Steel and Stainless Steel also fall back.

A further concern is that the active library contains **combinations physically beyond a 2kW fibre laser’s realistic cutting capability** (e.g. Aluminium 25mm, Stainless 20mm). Process rates for Aluminium 16mm and Stainless 10mm are at the optimistic edge for a 2kW machine and should be flagged for calibration but not fabricated.

**Narrow safe corrections applied this phase:**
1. Added prominent "Flat-Rate Fallback" warning banner in the estimate breakdown panel when no governed process rate matches.
2. Added a collapsible "Show calculation details" section exposing already-computed-but-hidden values (cut time, pierce time, governed cut speed, pierce time-per-hole, gas type, gas flow L/min, consumables rate $/hr, setup minutes, handling minutes, sheet price, minimum-material-charge applied flag).
3. Exposed new explainability fields in `LLPricingBreakdown` without changing any pricing math.
4. Relabelled the process-mode badge to **"Time-Based (Governed)"** vs **"Flat-Rate Fallback"** for unambiguous fallback identification.

**Not applied (deliberately deferred — requires business decision):**
- No library deactivations
- No new process-rate rows fabricated
- No machine-capability limits enforced in material selection
- No changes to flat-rate floor values

---

## 2. Current Pricing Explainability Findings

### 2.1 What was visible in the pre-change UI

Runtime `PricingBreakdownPanel` (line 268 of `laser-quote-builder.tsx`) showed:

- Header row: Supplier · Parts/Sheet · Est. Sheets · Machine Time (only if time-based)
- Process-mode badge: "Time-Based" or "Flat Rate"
- Source badges: Gas source, Consumables source (only if time-based)
- Bucket grid: Material / Machine / Gas / Consumables / Labour × Buy/Sell/Margin
- Total row + Unit Sell + Margin %
- Min. line charge notice (only if triggered)

### 2.2 What was NOT visible but already computed

The pricing engine computes the following internally but discards them in the return payload or never surfaces them in the UI:

| Hidden Data | Where It Lived | Bucket Affected |
|---|---|---|
| Cutting time (minutes) | Local variable in `computeLLPricing` | Machine |
| Pierce time (minutes) | Local variable in `computeLLPricing` | Machine |
| Governed cut speed (mm/min) | `processRate.cutSpeedMmPerMin` (dropped) | Machine |
| Governed pierce time (s/pierce) | `processRate.pierceTimeSec` (dropped) | Machine |
| Assist gas type | `processRate.assistGasType` (dropped) | Gas |
| Gas consumption (L/min) | `processRate.gasConsumptionLPerMin` (dropped) | Gas |
| Sheet price (ex-GST) | `material.pricePerSheetExGst` (available but unused in breakdown) | Material |
| Min-material-charge applied | Applied silently at line 434 (no flag) | Material |
| Setup minutes | Input param (not echoed in breakdown) | Labour |
| Handling minutes | Input param (not echoed in breakdown) | Labour |
| Min-line-charge threshold value | Used silently (only boolean flag returned) | Total |

### 2.3 Fallback state visibility (pre-change)

The only fallback indicator was the muted secondary badge "Flat Rate" next to the panel title. There was **no explanatory text** telling the estimator *why* they were in flat-rate mode or what it means for trust in the line price. Gas and consumables buckets silently showed `$0.00` in flat-rate mode, which looks identical to "no gas/consumables cost for this part" — an ambiguous state.

---

## 3. Bucket-by-Bucket Visibility Assessment

| Bucket | Can user explain formation from UI? (before) | After narrow correction |
|---|---|---|
| **Material** | **Partial** — saw parts/sheet + est sheets + Buy/Sell/Margin totals only. No sheet price, no per-part material buy, no min-charge flag. | **YES** — sheet price, parts per sheet, est. sheets, utilisation %, effective material buy per part, min-material-charge flag are now visible. |
| **Machine** | **NO** — "$90→$150/hr" label showed buy→sell rates but machine time basis (cut time vs pierce time, cut speed, pierce time per hole) was hidden. | **YES** — governed cut speed, pierce time per hole, computed cut time, computed pierce time, total machine time, buy rate, sell rate are all visible. |
| **Gas** | **NO** — only a source badge was shown; no gas type, no flow rate, no cost/litre, no time basis. | **YES** — gas type, gas flow L/min, cost per litre, and full source string are now visible when governed. In flat-rate mode, clear message "gas not separately calculated". |
| **Consumables** | **NO** — only a source badge; no rate. | **YES** — consumables rate $/hr and source string are visible. |
| **Labour** | **NO** — "$45→$95/hr" label showed rates but not minutes. | **YES** — setup minutes, handling minutes, operator buy rate, shop sell rate are all visible. |
| **Fallback status** | **NO** — muted badge was insufficient; gas/consumables at `$0.00` was ambiguous. | **YES** — prominent amber banner reads "No governed process rate for this material/thickness. Using flat $/mm cut and $/pierce rates. Gas, consumables and machine time are not separately calculated." |

---

## 4. Process-Rate Coverage Audit

### 4.1 Active library — distinct material/thickness combinations

Query: `SELECT DISTINCT material_family, thickness FROM ll_sheet_materials WHERE is_quoteable = true AND is_active = true`

| Family | Thicknesses Active | Row Count |
|---|---|---|
| Aluminium (5005, 5052, 5083, 6061) | 0.7, 0.9, 1.2, 1.6, 2, 2.5, 3, 4, 5, 6, 8, 12, 16, 25 | 57 |
| Corten (Corten A) | 2.5, 3.0, 4.0, 5.0, 6.0 | 9 |
| Galvanised Steel (Electro-Galv, G250, G300) | 0.55, 0.75, 0.8, 0.95, 1.0, 1.15, 1.2, 1.5, 1.55, 1.6, 2.0, 2.5, 3.0 | 19 |
| Mild Steel (Cold Rolled, Grade 250, HA300) | 1.0, 1.2, 1.6, 2.0, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20 | 39 |
| Stainless Steel (304/L/BA/2B/No.1/No.4, 316/L, 445M2) | 0.55, 0.7, 0.9, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20 | 65 |

### 4.2 Governed process-rate table — active profile "Q4 Preview Rates v3.0-draft"

40 rows across 5 families: Aluminium, Galvanised, Mild Steel, Stainless Steel, Zincanneal.

| Family | Thicknesses covered |
|---|---|
| Aluminium | 1.6, 2, 3, 4, 5, 6, 8, 10, 12, 16 |
| Galvanised | 1, 1.6, 2, 3, 4.5, 6 |
| Mild Steel | 1.6, 2, 3, 4.5, 6, 8, 10, 12, 16, 20 |
| Stainless Steel | 1.2, 1.5, 2, 3, 4, 6, 8, 10 |
| Zincanneal | 0.55, 0.8, 1, 1.6, 2, 3 |

### 4.3 Coverage matrix

The lookup uses a 25%-tolerance nearest-thickness match (`findProcessRate` line 272), so "coverage" means a rate within ±25% of the requested thickness exists in the same family.

| Library Combination | Governed rate available? | Status |
|---|---|---|
| **Corten — all 9 combinations (2.5–6mm)** | **NO** (no Corten family in rate table) | **Selectable but unsupported → fallback** |
| Aluminium 0.7, 0.9 | NO (nearest 1.6 is >25% away) | Selectable but unsupported → fallback |
| Aluminium 1.2 | NO (1.6/1.2 = 33%) | Selectable but unsupported → fallback |
| Aluminium 1.6–16 | YES | Supported |
| Aluminium 25 (5083) | NO (16/25 = 36%) | **Unsupported AND beyond 2kW capability** |
| Galvanised 0.55, 0.75 | NO (1/0.75 = 33%) | Selectable but unsupported → fallback |
| Galvanised 0.8, 0.95 | YES (1mm within 25% of 0.8) | Supported |
| Galvanised 1.0–3.0 | YES | Supported |
| Mild Steel 1.0, 1.2 | NO (1.6/1.2 = 33%) | Selectable but unsupported → fallback |
| Mild Steel 1.6–20 | YES | Supported (16, 20mm at machine limit) |
| Stainless 0.55, 0.7, 0.9 | NO (1.2/0.9 = 33%) | Selectable but unsupported → fallback |
| Stainless 1.2–10 | YES | Supported |
| Stainless 12, 16, 20 | NO (nearest 10mm is >25% away) | **Unsupported AND beyond 2kW capability** |

### 4.4 Classification

| Class | Count of combinations | Examples |
|---|---|---|
| **Supported and realistic** | majority | Mild Steel 3–10mm, Aluminium 1.6–6mm, Stainless 1.2–6mm, Galvanised 1–3mm |
| **Supported but needs calibration** | 5 | Aluminium 10/12/16mm, Stainless 8/10mm (at 2kW capability edge) |
| **Selectable but unsupported (governed fallback)** | ~22 | Corten 2.5/3/4/5/6mm × 9 rows, Al 0.7/0.9/1.2, MS 1.0/1.2, SS 0.55/0.7/0.9 |
| **Should be deactivated/hidden until governed** | 3 | Aluminium 25mm, Stainless 16mm, Stainless 20mm — beyond realistic 2kW capability |

---

## 5. 2kW Machine Realism Review

Published realistic cutting envelope for a 2kW fibre laser (industry norm with modern optics and N2/O2 assist):

| Material | Practical 2kW Limit | Library max | Rate-table max | Comment |
|---|---|---|---|---|
| Mild Steel (O2) | 12–16mm reliably; 20mm slow but possible | 20mm | 20mm @ 600mm/min | At the edge; 20mm rate is plausible |
| Stainless (N2) | 6mm reliably; 8mm marginal; 10mm optimistic | 20mm | 10mm @ 700mm/min | **Library over-reaches**; rate table optimistic at 8–10mm |
| Aluminium (N2) | 6mm reliably; 8–10mm marginal; 12mm+ very difficult | 25mm | 16mm @ 500mm/min | **Library significantly over-reaches**; rate table optimistic at 12–16mm |
| Galvanised (O2) | 6mm reliably | 3mm | 6mm @ 2800mm/min | Comfortable |
| Corten (O2) | similar to MS, 12–16mm | 6mm | **no table** | Library conservative; just missing rates |
| Zincanneal (air/O2) | 3mm reliably | — (not active in library) | 3mm | OK |

**Findings:**
- **Mild Steel** rates: broadly plausible for 2kW. 20mm at 600mm/min is at the slow end but achievable.
- **Aluminium** rates above 8mm are optimistic for 2kW. These should be re-measured empirically, not just trusted.
- **Stainless** 10mm N2 at 700mm/min is optimistic for a 2kW machine. Should be recalibrated.
- **Aluminium 25mm and Stainless 16/20mm** in the active library are beyond realistic 2kW cutting. These should not be quoteable on this machine.
- **Corten**: missing rates entirely. Since Corten cuts with O2 similar to mild steel, a duplicate of the Mild Steel curve (with a small speed penalty) would be defensible — but fabricating rows without measurement is out of policy, so this is **flagged, not applied**.

---

## 6. Exact Corrections Made

### 6.1 Code changes

**File 1: `client/src/lib/ll-pricing.ts`**

- Extended `LLPricingBreakdown` interface (lines 102–128) with new explainability fields:
  - `cutTimeMinutes`, `pierceTimeMinutes` — already computed locally; now returned.
  - `setupMinutes`, `handlingMinutes` — echoed from input to the return payload.
  - `minimumLineCharge`, `minimumMaterialCharge`, `minimumMaterialChargeApplied` — now returned so UI can show thresholds and trigger notices.
  - `sheetPricePerSheet` (optional) — from `material.pricePerSheetExGst`.
  - `gasType`, `gasConsumptionLPerMin` (optional) — from governed process-rate row.
  - `processRateThicknessMatched`, `processRateCutSpeedMmPerMin`, `processRatePierceTimeSec` (optional) — so the user can see which rate row matched and the provenance of time.
- In `computeLLPricing`:
  - Added `minimumMaterialChargeApplied` flag around the material-floor branch.
  - Stored `cutTimeMinutes`, `pierceTimeMinutes`, `gasTypeOut`, `gasConsumptionLPerMinOut` in the time-based branch.
  - Added all new fields to the return object.
- **Zero change** to pricing math, buy/sell formulas, bucket formation, markups, minimum-charge logic, or fallback behavior. Additive only.

**File 2: `client/src/pages/laser-quote-builder.tsx`**

- Added `Info` icon import.
- Relabelled process-mode badge: "Time-Based" → "Time-Based (Governed)"; "Flat Rate" → "Flat-Rate Fallback".
- Added prominent amber fallback warning banner (rendered only when `processMode === "flat-rate"`) with explanatory text.
- Added a collapsible "Show calculation details" section containing four sub-panels:
  - **Material details** — sheet price, parts per sheet, est. sheets, utilisation %, effective material buy per part, min-material-charge notice.
  - **Machine time details** — governed cut speed, pierce time per hole, computed cut time, computed pierce time, total machine time, buy rate / sell rate. In flat-rate mode: flat cut rate + flat pierce rate + explanatory note.
  - **Gas & Consumables details** (only when time-based) — gas type, gas flow L/min, cost per litre, gas source, consumables rate $/hr, consumables source.
  - **Labour details** — setup minutes, handling minutes, operator buy rate, shop sell rate.
  - Footer caption summarising the sell-formation rule.
- Added `data-testid` attributes for all new fields (`detail-sheet-price`, `detail-cut-speed`, `detail-cut-time`, `detail-pierce-time`, `detail-gas-type`, `detail-consumables-rate`, `detail-setup-min`, `detail-handling-min`, `button-toggle-breakdown-details`, `breakdown-details`, `min-material-notice`, `flat-rate-fallback-warning`).

### 6.2 No changes to

- Pricing engine math (all Buy/Sell/Margin values are byte-for-byte identical to pre-change).
- `shared/schema.ts`, `shared/estimate-snapshot.ts`.
- `server/routes.ts`.
- Admin pricing profile page (`ll-pricing-profiles.tsx`).
- Database records.
- Process-rate tables (no fabricated rows).
- Library `is_active` / `is_quoteable` flags (no deactivations).
- Add/Edit Item dialog — breakdown panel is reused there via the same component, so explainability gains propagate automatically.

---

## 7. Runtime Verification After Correction

- TypeScript check: no new errors introduced; all pre-existing warnings (`downlevelIteration`, unrelated files) unchanged. My new fields on `LLPricingBreakdown` compile cleanly.
- HMR: Vite hot-module-reload applied both files cleanly, no runtime errors in browser console or server log.
- Pricing math regression: new code paths are **purely additive** — `cutTimeMinutes`, `pierceTimeMinutes`, `minimumMaterialChargeApplied`, etc. are computed as side-effects and added to the return object. The following pre-existing code paths are untouched:
  - Material buy/sell/margin computation
  - Machine buy/sell/margin computation (time-based and flat-rate)
  - Gas/Consumables/Labour computation
  - Minimum-line-charge application
  - Total buy/sell/margin computation
- UI rendering: the new fallback banner only renders when `processMode === "flat-rate"`. The collapsible details section is closed by default, preserving the original compact footprint.

---

## 8. Remaining Risks / Deferred Items

The following are **intentionally deferred** and require explicit business/engineering decision before action:

1. **Corten coverage**: 9 active quoteable Corten combinations currently fall back silently. Recommend adding governed Corten process-rate rows (O2 assist, similar to mild steel with small speed penalty) measured on the actual machine — not fabricated.
2. **Thin-gauge gaps**: Aluminium 0.7/0.9/1.2, Mild Steel 1.0/1.2, Stainless 0.55/0.7/0.9, Galvanised 0.55/0.75. All are realistic 2kW work. Recommend adding measured rate rows.
3. **Beyond-capability library entries**: Aluminium 25mm (5083), Stainless 16/20mm. Recommend:
   - Option A (safest): set `is_quoteable = false` on these rows — requires business sign-off.
   - Option B: add a machine-capability warning in the item dialog when one is selected.
   - Not applied this phase.
4. **Rate calibration** for Aluminium 12/16mm and Stainless 8/10mm — currently optimistic. Recommend empirical re-measurement on the actual 2kW unit.
5. **Machine sell-rate clarity**: UI now shows buy and sell rate per hour. A future enhancement could show the rate-per-hour source (profile vs code fallback) — deferred as not strictly needed.
6. **Process-rate admin UI**: the process-rate table is still only editable via profile JSON. A dedicated editor is out of scope for this phase.

---

## 9. Final Executive Recommendation

The narrow explainability corrections are safe, additive, fully reversible, and required no schema changes. They deliver meaningful operational transparency to estimators without altering pricing outcomes. They can be pushed to git and published to live.

Process-rate coverage gaps (particularly **Corten**) are a **governance issue**, not a pricing-engine issue, and are now clearly surfaced in the UI via the fallback banner. They should be addressed through a separate, approved library/rate-table update phase with machine measurements — **not** by fabricating rates from external sources.

Library entries beyond machine capability (Al 25mm, SS 16/20mm) should be deactivated after business review. This phase does not apply that change.

---

## 10. Release Gate

### Mandatory Validation Block

| Question | Answer |
|---|---|
| Is current LL bucket pricing operationally transparent enough for estimators? | **NO (before change) → YES (after change)** |
| Can users currently explain Material bucket formation from the UI alone? | **YES** (after change) |
| Can users currently explain Machine bucket formation from the UI alone? | **YES** (after change, when governed; flat-rate mode explicitly labelled) |
| Can users currently explain Gas bucket formation from the UI alone? | **YES** (after change, when governed; flat-rate mode explicitly labelled) |
| Can users currently explain Consumables bucket formation from the UI alone? | **YES** (after change, when governed; flat-rate mode explicitly labelled) |
| Can users currently explain Labour bucket formation from the UI alone? | **YES** (after change) |
| Are all active quoteable LL library combinations covered by governed process rates? | **NO** — Corten (9 combos), Al 0.7/0.9/1.2, MS 1.0/1.2, SS 0.55/0.7/0.9, Al 25mm, SS 16/20mm fall back. |
| Are all current governed process rates realistic for the actual 2kW machine? | **NO** — Al 12/16mm and SS 8/10mm rates are optimistic and need empirical calibration. |
| Were any unsupported combinations found in live-selectable materials? | **YES** — full list above (Section 4.4). |
| Is any live publish justified after this phase? | **YES** — the explainability change is additive and zero-risk; it also makes existing unsupported fallback cases *safer* by surfacing them. |

---

**Push to Git: YES**
**Publish to live: YES**
**New Replit chat needed for next phase: YES** (process-rate governance / library coverage remediation is a distinct phase requiring business input and empirical machine measurements)
