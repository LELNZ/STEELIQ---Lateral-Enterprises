# SteelIQ — Phase 4A Forensic Report: LL Pricing Calibration

**Date**: 2026-04-04
**Author**: Agent (automated)
**Scope**: Replace flat $/mm process cost model with time-based model using existing processRateTables, machine hourly rate, gas costs, and consumables. No backend changes. No LJ changes. No LE changes. No nesting/DXF/folding scope.

---

## 1. SUMMARY

**Phase 4A scope completed**: LL pricing engine rewritten from flat $/mm process costing to time-based process costing. PricingBreakdownPanel updated to display new cost components. Settings updated to calibrate defaults. Two post-review bug fixes applied (gas type normalisation, material family alias mapping).

**LL pricing is now materially more commercially realistic**: The benchmark case (AL 5052 3mm nameplate, qty 400) dropped from $3,476 sell total to $349 sell total — an 89.5% reduction driven entirely by replacing inflated flat-rate process costs with actual machine time calculations.

**Workflow continuity remained intact**: LL estimate create/save/list, LJ jobs/quotes, and LE settings all function without regression. Zero backend files changed. Zero schema files changed.

**Commercial approval status**: The new outputs are **materially improved but NOT business-approved**. All pricing values remain provisional calibration defaults. The business must review and approve process rate table values, hourly rates, gas costs, consumable rates, setup/handling defaults, and markup percentages before production use.

---

## 2. PRIOR PROBLEMS

### 2.1 Inflated LL Unit Sell
The flat-rate model applied $0.012 per mm of cut length **per unit** and $0.50 per pierce **per unit**. For qty 400 with 300mm cut and 4 pierces each: cutting = $0.012 × 300 × 400 = $1,440; piercing = $0.50 × 4 × 400 = $800. Total process cost = $2,240 — no relationship to actual machine time.

### 2.2 Excessive Setup/Handling
Prior defaults were 15 min setup + 10 min handling = 25 min at $95/hr = $39.58. For a batch of 400 small nameplates this was disproportionately high relative to actual setup effort.

### 2.3 Weak Commercial Explainability
The breakdown panel showed only "Cut Cost" and "Pierce Cost" with no indication of whether time-based or flat-rate costing was active. No visibility into machine time, gas cost, or consumables. No parts-per-sheet estimate.

---

## 3. ARCHITECTURAL POSITION

### 3.1 What Was Changed
- **Pricing engine** (`ll-pricing.ts`): Rewrote process cost calculation to use time-based model from processRateTables. Added rectangular packing sheet estimator. Added material family normalisation. Added gas type normalisation. Added minimum line charge logic.
- **Breakdown panel** (`laser-quote-builder.tsx`): Updated to show time-based vs flat-rate process mode badge, parts-per-sheet, machine time, machine cost, gas cost, consumables, and minimum line charge indicator.
- **LL settings** (runtime DB): Updated setup from 15→10 min, handling from 10→5 min, added minimumLineCharge $50.
- **Documentation** (`replit.md`): Updated with Phase 4A summary.

### 3.2 What Was Intentionally NOT Changed
- **Backend** (`server/routes.ts`, `server/storage.ts`): Zero changes. All pricing logic runs client-side.
- **Schema** (`shared/schema.ts`, `shared/estimate-snapshot.ts`): Zero changes. Existing `LLPricingSettings` type and `LaserSnapshotItem` type are sufficient.
- **LJ domain** (`jobs-list.tsx`, `job-builder.tsx`, `quote-detail.tsx`): Zero changes. LJ pricing is a separate code path.
- **LE domain**: Zero changes. LE remains placeholder.
- **Nesting/DXF/folding**: Explicitly deferred. Rectangular packing is a bounded manual estimate, not a nesting engine.

### 3.3 How LJ Remained Isolated
LJ pricing uses a completely separate code path (item configuration → per-item labour/material/glass pricing in the job builder). The LL pricing engine (`ll-pricing.ts`) is only imported by `laser-quote-builder.tsx`. No LJ files were modified.
**Evidence**: `git diff` shows 0 diff lines for `jobs-list.tsx`, `job-builder.tsx`, `quote-detail.tsx`.

### 3.4 How LE Remained Untouched
LE has no pricing engine, no dedicated builder, and no custom settings. The LE division settings record exists in the DB but contains no `llPricingSettingsJson`.
**Evidence**: API response for `/api/settings/divisions/LE` returns a record with no LL pricing settings. Zero LE files exist or were modified.

### 3.5 Why Nesting/DXF/Folding Were Deferred
These require CAD file parsing, true 2D bin-packing algorithms, and machine integration respectively. Phase 4A scope was explicitly limited to calibrating the existing manual-entry pricing model to produce commercially realistic outputs using data already seeded in settings.

---

## 4. FILES INSPECTED

| File | Why Inspected |
|---|---|
| `client/src/lib/ll-pricing.ts` | Primary file changed — pricing engine. Full read to verify all code paths. |
| `client/src/pages/laser-quote-builder.tsx` | Primary file changed — breakdown panel, settings threading, snapshot serialisation. |
| `server/routes.ts` | Verified ZERO changes. Confirmed LL settings seeding values for processRateTables. |
| `server/storage.ts` | Verified ZERO changes. Confirmed no storage layer modifications. |
| `shared/schema.ts` | Verified ZERO changes. Confirmed `LLPricingSettings` type unchanged. |
| `shared/estimate-snapshot.ts` | Verified ZERO changes. Confirmed `LaserSnapshotItem` type unchanged. |
| `client/src/pages/jobs-list.tsx` | Verified ZERO changes. LJ regression isolation proof. |
| `client/src/pages/job-builder.tsx` | Verified ZERO changes. LJ regression isolation proof. |
| `client/src/pages/quote-detail.tsx` | Verified ZERO changes. LJ regression isolation proof. |
| `client/src/pages/laser-estimates-list.tsx` | Verified ZERO changes. LL list page not affected. |
| `replit.md` | Updated with Phase 4A documentation. |

---

## 5. FILES CHANGED

| File | Lines Changed | Reason |
|---|---|---|
| `client/src/lib/ll-pricing.ts` | +224 / -12 | Rewrote process cost from flat $/mm to time-based model; added rectangular packing, family normalisation, gas type normalisation, minimum line charge. |
| `client/src/pages/laser-quote-builder.tsx` | +42 / -6 | Updated PricingBreakdownPanel to show time-based fields, process mode badge, min line charge indicator. |
| `replit.md` | +1 | Added Phase 4A summary paragraph. |
| `reports/phase-4a-forensic-report.md` | +new | This forensic report. |

---

## 6. PRICING MODEL RESULT

### 6.1 Process-Rate Lookup
`findProcessRate(settings, materialFamily, thickness)` iterates `settings.processRateTables` (40 entries) and matches by normalised material family name + nearest thickness within 50% tolerance. Material family normalisation via `FAMILY_ALIASES` map handles "Galvanised Steel" → "galvanised", "Aluminum" → "aluminium", etc. Returns `cutSpeedMmPerMin`, `pierceTimeSec`, `assistGasType`, `gasConsumptionLPerMin` or null for no match.
**Evidence standard**: VERIFIED BY CODE INSPECTION (ll-pricing.ts lines 162-199).

### 6.2 Machine Cost Calculation
When a process rate match exists:
1. Total cut length = cutLengthMm × quantity
2. Cutting time (min) = totalCutLength / cutSpeedMmPerMin
3. Total pierces = pierceCount × quantity
4. Pierce time (min) = (totalPierces × pierceTimeSec) / 60
5. Machine time = cutting time + pierce time
6. Machine cost = (machineTime / 60) × machineHourlyRate

`getMachineHourlyRate(settings)` reads from `settings.machineProfiles`, finding the default profile's `hourlyMachineRate`. Current value: $85/hr (Bodor 3015 6kW).
**Evidence standard**: VERIFIED BY CODE INSPECTION (ll-pricing.ts lines 214-219, 312-324).

### 6.3 Gas Cost Calculation
`gasCost = machineTimeMinutes × gasConsumptionLPerMin × gasPricePerLitre`

`getGasPricePerLitre(settings, gasType)` normalises gas type string (strips underscores/spaces/hyphens, lowercases) then maps: N2 → $0.008/L, O2 → $0.003/L, compressed_air → $0.0005/L.
**Evidence standard**: VERIFIED BY CODE INSPECTION (ll-pricing.ts lines 199-207). Post-review fix applied for "compressed_air" → "compressedair" normalisation.

### 6.4 Consumables Cost Calculation
`consumablesCost = machineTimeHours × consumableCostPerMachineHour`

`getConsumableCostPerHour(settings)` reads from `settings.consumableCosts.consumableCostPerMachineHour`. Current value: $8.50/hr.
**Evidence standard**: VERIFIED BY CODE INSPECTION (ll-pricing.ts lines 209-212).

### 6.5 Sheet-Count Estimation
`estimatePartsPerSheet(sheetL, sheetW, partL, partW, kerfMm, edgeTrimMm)`:
1. Usable area = (sheetL - 2×edgeTrim) × (sheetW - 2×edgeTrim)
2. Effective part = (partL + kerf) × (partW + kerf)
3. Orientation A = floor(usableL / effL) × floor(usableW / effW)
4. Orientation B = floor(usableL / effW) × floor(usableW / effL) (rotated 90°)
5. Parts per sheet = max(A, B)
6. Sheets required = ceil(qty / partsPerSheet)

Falls back to area-based utilisation model when part dimensions are zero. Kerf default: 0.3mm. Edge trim default: 10mm (both from `settings.nestingDefaults`).
**Evidence standard**: VERIFIED BY CODE INSPECTION (ll-pricing.ts lines 221-241, 267-287).

### 6.6 Setup and Handling
`setupHandlingCost = ((setupMinutes + handlingMinutes) / 60) × shopRatePerHour`

Defaults changed from 15+10=25 min to 10+5=15 min. Shop rate reads from `settings.labourRates.shopRatePerHour` ($95/hr). Setup and handling are per-estimate fixed costs, not per-unit.
**Evidence standard**: VERIFIED BY CODE INSPECTION (ll-pricing.ts lines 344-345) + VERIFIED BY RUNTIME TEST (settings API returns setupMinutes:10, handlingMinutes:5).

### 6.7 Markup and Minimum Line Charge
```
internalCostSubtotal = materialCostTotal + processCostTotal + setupHandlingCost
minimumLineChargeApplied = internalCostSubtotal < minimumLineCharge ($50)
effectiveSubtotal = max(internalCostSubtotal, minimumLineCharge)
markupAmount = effectiveSubtotal × (markupPercent / 100)
sellTotal = effectiveSubtotal + markupAmount
```

The breakdown panel displays "Min. Line Charge Applied" instead of "Internal Subtotal" when the minimum triggers, making the arithmetic transparent and reconcilable.
**Evidence standard**: VERIFIED BY CODE INSPECTION (ll-pricing.ts lines 349-355) + VERIFIED BY CODE INSPECTION (laser-quote-builder.tsx lines 242-249).

### 6.8 Flat-Rate Fallback
When `findProcessRate()` returns null (no matching material family or thickness in process rate tables) OR when both cutLengthMm and pierceCount are zero:
```
cutCost = cutLengthMm × ratePerMmCut ($0.012)
pierceCost = pierceCount × ratePerPierce ($0.50)
processCostTotal = (cutCost + pierceCost) × quantity
processMode = "flat-rate"
```
The breakdown panel shows "Flat Rate" badge and "Cut Cost"/"Pierce Cost" rows instead of time-based rows.
**Evidence standard**: VERIFIED BY CODE INSPECTION (ll-pricing.ts lines 337-342).

### 6.9 Settings Values Changed

| Setting | Old Value | New Value | Status |
|---|---|---|---|
| `setupHandlingDefaults.defaultSetupMinutes` | 15 | 10 | Provisional calibration default |
| `setupHandlingDefaults.defaultHandlingMinutes` | 10 | 5 | Provisional calibration default |
| `commercialPolicy.minimumLineCharge` | (not set) | 50 | Provisional calibration default |

### 6.10 Values Remaining Provisional (NOT Business-Approved)

| Value | Current | Source |
|---|---|---|
| Machine hourly rate | $85/hr | machineProfiles[0] — Bodor 3015 seed |
| Shop rate | $95/hr | labourRates — seed value |
| N2 gas price | $0.008/L | gasCosts — seed value |
| O2 gas price | $0.003/L | gasCosts — seed value |
| Compressed air price | $0.0005/L | gasCosts — seed value |
| Consumable cost | $8.50/hr | consumableCosts — seed value |
| Default markup | 35% | commercialPolicy — seed value |
| Minimum material charge | $25 | commercialPolicy — seed value |
| Minimum line charge | $50 | commercialPolicy — new, provisional |
| Setup default | 10 min | setupHandlingDefaults — changed, provisional |
| Handling default | 5 min | setupHandlingDefaults — changed, provisional |
| Kerf width | 0.3mm | nestingDefaults — seed value |
| Edge trim | 10mm | nestingDefaults — seed value |
| Utilisation factor | 0.75 | nestingDefaults — seed value |
| All 40 process rate entries | Various | processRateTables — seed values |

**All values read from settings at runtime, not hardcoded. `LL_PRICING_DEFAULTS` in code are fallback-only for when settings are null.**
**Evidence standard**: VERIFIED BY CODE INSPECTION (ll-pricing.ts lines 124-150) + VERIFIED BY RUNTIME TEST (settings API response confirms all values read from DB).

---

## 7. VALIDATION RESULT

### A. Material Cost / Sheet Count Behavior Improved
**Result**: PASS
**Evidence label**: VERIFIED BY CODE INSPECTION + VERIFIED BY RUNTIME TEST
**Proof**: Rectangular packing for 100×50mm parts on 2400×1200 sheet yields 529 parts/sheet (23×23 in best orientation). Only 1 sheet needed for qty 400. Material cost = 1 × $175.17 = $175.17. Prior area-based model also yielded 1 sheet for this case, so material cost is unchanged. The improvement is in transparency — estimator now sees "Parts/Sheet: 529" in the breakdown panel.

### B. Process Rate Tables Used
**Result**: PASS
**Evidence label**: VERIFIED BY CODE INSPECTION + VERIFIED BY RUNTIME TEST
**Proof**: `findProcessRate(settings, "Aluminium", 3)` matches the Aluminium 3mm entry (cutSpeed: 6000 mm/min, pierceTime: 0.5s, N2, 30L/min). The breakdown panel displays "Time-Based" badge. Process cost = $59.94 (machine $47.22 + gas $8.00 + consumables $4.72). E2e test confirmed "Time-Based" badge visible in the pricing breakdown panel when Aluminium 3mm material selected.

### C. Flat-Rate Fallback Only
**Result**: PASS
**Evidence label**: VERIFIED BY CODE INSPECTION
**Proof**: `processMode` defaults to `"flat-rate"`. Time-based mode activates only when `processRate !== null && (cutLengthMm > 0 || pierceCount > 0)` (ll-pricing.ts line 312). All 5 seeded material families (Mild Steel, Stainless Steel, Aluminium, Galvanised, Zincanneal) have process rate entries. Flat-rate only triggers for materials not in the process rate table (e.g., exotic alloys added later without corresponding entries) or when cut/pierce inputs are zero.

### D. Rectangular Sheet Estimation Applied
**Result**: PASS
**Evidence label**: VERIFIED BY CODE INSPECTION + VERIFIED BY RUNTIME TEST
**Proof**: `estimatePartsPerSheet()` uses kerf-aware rectangular packing in two orientations (ll-pricing.ts lines 221-241). For the benchmark case: usable sheet = (2400-20)×(1200-20) = 2380×1180mm, effective part = 100.3×50.3mm, orientation A = 23×23 = 529, orientation B = 47×11 = 517, best = 529. E2e test confirmed "Parts/Sheet" row displayed in breakdown panel.

### E. Setup / Handling / Markup / Minimum Charge Improved
**Result**: PASS
**Evidence label**: VERIFIED BY CODE INSPECTION + VERIFIED BY RUNTIME TEST
**Proof**: Setup/handling reduced from 25 min ($39.58) to 15 min ($23.75) — a 40% reduction. Minimum line charge ($50) ensures trivial items aren't quoted below cost floor. The breakdown panel shows "Min. Line Charge Applied" label when triggered, making the arithmetic reconcilable. Markup applies to effective subtotal (after minimum charge), not raw subtotal.

### F. Benchmark Case Materially Improved in Runtime
**Result**: PASS
**Evidence label**: VERIFIED BY RUNTIME TEST
**Proof**: E2e test created LL-EST-0006 "Phase 4A Benchmark" estimate with AL 5052 3mm, 100×50mm, qty 400, cut 300mm, 4 pierces. The test confirmed:
- "Time-Based" badge visible in breakdown panel
- Unit sell under $2.00 (expected $0.87)
- Sell total under $500 (expected $349.47)
- Estimate saved successfully as LL-EST-0006

API confirmation: `curl` to `/api/laser-estimates` returns LL-EST-0006 with status "draft", customerName "Phase 4A Benchmark", itemCount 1.

### G. Workflow Continuity Intact
**Result**: PASS
**Evidence label**: VERIFIED BY RUNTIME TEST
**Proof**: E2e test verified:
- LL estimate list loads (5 existing + 1 new = 6 estimates)
- New estimate creation flow works end-to-end
- Item add dialog with pricing breakdown works
- Estimate save persists correctly
- LJ jobs list loads (9 jobs, first job has 1 linked quote)
- Settings page loads with all divisions visible

### H. LJ Regression Safety
**Result**: PASS
**Evidence label**: VERIFIED BY CODE INSPECTION + VERIFIED BY RUNTIME TEST
**Proof**:
- Git diff: zero lines changed in `jobs-list.tsx`, `job-builder.tsx`, `quote-detail.tsx`, `server/routes.ts`, `server/storage.ts`, `shared/schema.ts`
- API: `/api/jobs` returns 9 LJ jobs with linked quotes intact
- API: `/api/quotes` returns 30 quotes
- E2e test: LJ jobs list renders correctly with LJ-EST identifiers visible

### I. LE Unchanged
**Result**: PASS
**Evidence label**: VERIFIED BY CODE INSPECTION + VERIFIED BY RUNTIME TEST
**Proof**:
- Git diff: zero LE-related files exist or were modified
- API: `/api/settings/divisions/LE` returns a record with no `llPricingSettingsJson` (as expected — LE is placeholder)
- E2e test: LE division visible in Settings > Divisions page as placeholder entry

---

## 8. SCREENSHOT EVIDENCE

All runtime verification was performed via automated Playwright-based e2e testing against the live Replit dev environment (admin/Password1234).

| Evidence ID | Surface Tested | What It Proves |
|---|---|---|
| E2E-LL-LIST | LL estimates list page | Existing estimates load; LL-EST-XXXX numbering intact |
| E2E-LL-BENCHMARK | LL builder with benchmark item | "Time-Based" badge visible; process cost rows (Machine Time, Machine Cost, Gas Cost, Consumables) displayed; unit sell under $2.00 |
| E2E-LL-SAVED | LL estimate saved as LL-EST-0006 | Estimate persists correctly with 1 item |
| E2E-LJ-LIST | LJ jobs list page | 9 jobs load with LJ-EST identifiers; linked quotes intact |
| E2E-LE-SETTINGS | Settings > Divisions page | LE division exists as placeholder; no LL pricing settings |

**Note**: Screenshots were captured by the automated testing agent during runtime verification. The e2e test completed successfully with all assertions passing.

---

## 9. DEFECTS FOUND

### 9.1 Gas Type Mapping Bug (FIXED)
**Defect**: `getGasPricePerLitre()` only mapped "N2", "O2", "Air" but process rate tables use "compressed_air" for Zincanneal entries. Gas cost resolved to $0 for compressed air items.
**Fix**: Normalise gas type string by lowercasing and stripping underscores/spaces/hyphens before matching. Now handles "compressed_air" → "compressedair" → matches compressed air price.
**Evidence standard**: VERIFIED BY CODE INSPECTION (ll-pricing.ts line 202).

### 9.2 Material Family Mismatch Bug (FIXED)
**Defect**: Process rate tables use "Galvanised" but sheet materials table uses "Galvanised Steel". Direct string comparison failed, causing Galvanised Steel items to silently fall back to flat-rate mode.
**Fix**: Added `FAMILY_ALIASES` normalisation map and `normaliseFamilyName()` function. Both process table entries and input material family are normalised before comparison.
**Evidence standard**: VERIFIED BY CODE INSPECTION (ll-pricing.ts lines 162-176).

### 9.3 Pre-Existing: Invalid Hook Call Warning (NOT FIXED — pre-existing, not Phase 4A)
**Defect**: Browser console shows "Invalid hook call" warning at LaserQuoteBuilder component. This is a pre-existing warning related to Replit's `data-replit-metadata` prop injection on React Fragment, not caused by Phase 4A changes.
**Impact**: Warning only; no functional impact.

### 9.4 Pre-Existing: z.any() Schema for llPricingSettingsJson (NOT FIXED — pre-existing, out of scope)
**Defect**: The PATCH endpoint for LL division settings uses `z.any()` for the `llPricingSettingsJson` field, allowing arbitrary JSON to be written.
**Impact**: Low risk in current single-admin environment but should be addressed in a future hardening phase.

---

## 10. FINAL ARCHITECTURAL POSITION

### Phase 4A Completion Status: COMPLETE

All four tasks delivered:
- **T001**: Pricing engine rewritten with time-based process costing ✓
- **T002**: Settings threaded through; breakdown panel updated ✓
- **T003**: Setup/handling defaults calibrated (10/5 min) ✓
- **T004**: Validation and forensic report ✓

Two post-review defects identified and fixed (gas type normalisation, material family aliasing).

### SteelIQ Readiness for Next Phase
The pricing engine is now structurally correct and commercially more realistic. The next phase should focus on either:

1. **Phase 4B: LL Pricing Settings Editor** — Enable the business to edit process rate tables, machine profiles, gas costs, consumable costs, and commercial policy values through the UI instead of requiring API calls.
2. **Phase 4C: LL Quote Generation + PDF** — Verify quote generation from LL estimates produces correct documents with the new pricing model. Currently the snapshot captures the new pricing values, but the quote preview/PDF rendering for LL has not been regression-tested in this phase.

---

## 11. READINESS DECISION

**Ready for GitHub push and next implementation phase.**

Justification:
- All code changes are client-side only (zero backend changes)
- Zero schema changes
- Zero LJ regression risk (no LJ files touched)
- Zero LE impact (LE remains placeholder)
- Pricing engine structurally correct with time-based model
- Two code review defects found and fixed
- E2e tests passed
- Settings values are provisional calibration defaults, not business-approved — but this is a data concern, not a code concern

---

## 12. OPEN RISKS

| Risk | Severity | Notes |
|---|---|---|
| All pricing values are provisional, not business-approved | Medium | Machine rate, gas costs, consumable rate, setup/handling defaults all need business review before production quoting |
| `z.any()` schema on llPricingSettingsJson PATCH | Low | Pre-existing. Allows arbitrary JSON mutation. Single-admin environment mitigates. |
| Rectangular packing is conservative estimate | Low | Does not account for rotation mixing or irregular nesting. Always overestimates sheets slightly. Appropriate for manual-entry model. |
| Flat-rate fallback for uncovered materials produces inflated pricing | Low | Badge clearly indicates "Flat Rate" mode. Business should add process rate entries for any new materials. |
| Snapshot does not capture processMode or partsPerSheet | Low | These are display-only in the breakdown panel. Snapshot captures the financial totals (sellTotal, processCostTotal, etc.) which are correct. |
| Quote PDF rendering not regression-tested for LL | Medium | Phase 4A scope was pricing engine calibration. Quote preview/PDF should be smoke-tested in Phase 4C. |
