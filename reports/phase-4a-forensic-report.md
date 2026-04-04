# Phase 4A Forensic Report: LL Pricing Calibration

**Date**: 2026-04-04
**Scope**: Replace flat $/mm process cost model with time-based model using processRateTables, machine hourly rate, gas costs, and consumables.

## Problem Statement

The LL (Lateral Laser) pricing engine used a flat-rate model producing commercially unrealistic results:

| Cost Component | Flat-Rate Model | Time-Based Model |
|---|---|---|
| Material | $175.17 | $175.17 |
| Process (cut + pierce) | $2,360.00 | $59.94 |
| Setup/Handling | $39.58 | $23.75 |
| Subtotal | $2,574.75 | $258.86 |
| Markup (35%) | $901.16 | $90.60 |
| **Sell Total** | **$3,475.91** | **$349.47** |
| **Unit Price** | **$8.69** | **$0.87** |

**Benchmark case**: AL 5052, 3mm PE Protected, 100×50mm nameplate, qty 400, 2400×1200 sheet @$175.17

The flat-rate model ($0.012/mm cut × 300mm × 400 = $1,440 cutting; $0.50/pierce × 4 × 400 = $800 piercing) produced a process cost 39× higher than the time-based model.

## Root Cause

- Flat rate of $0.012/mm applied per unit per mm of cut length, scaling linearly with quantity
- Flat rate of $0.50/pierce applied per unit per pierce, scaling linearly with quantity
- No relationship to actual machine time, gas consumption, or consumables
- The processRateTables were already seeded in settings but unused by the pricing engine

## Solution: Time-Based Process Costing

### Files Modified

1. **`client/src/lib/ll-pricing.ts`** — Core pricing engine rewritten
2. **`client/src/pages/laser-quote-builder.tsx`** — PricingBreakdownPanel updated

### Pricing Engine Changes (`ll-pricing.ts`)

#### New Functions
- `findProcessRate(settings, materialFamily, thickness)` — Looks up cut speed (mm/min), pierce time (sec), gas type, gas consumption from processRateTables. Matches by materialFamily + nearest thickness within 50% tolerance.
- `getGasPricePerLitre(settings, gasType)` — Returns gas price per litre (N2, O2, Air)
- `getConsumableCostPerHour(settings)` — Returns consumable cost per machine hour (default $8.50)
- `getMachineHourlyRate(settings)` — Returns default machine hourly rate from machineProfiles
- `estimatePartsPerSheet(sheetL, sheetW, partL, partW, kerf, edgeTrim)` — Rectangular packing in two orientations

#### Process Cost Calculation (Time-Based Mode)
When a matching processRateTable entry exists:
1. Cutting time = (cutLengthPerUnit × qty) / cutSpeedMmPerMin
2. Pierce time = (piercesPerUnit × qty × pierceTimeSec) / 60
3. Machine cost = totalTimeHours × machineHourlyRate
4. Gas cost = totalTimeMinutes × gasConsumptionLPerMin × gasPricePerL
5. Consumables = totalTimeHours × consumableCostPerHour
6. Process total = machine + gas + consumables

Falls back to flat $/mm rate if no matching process table entry.

#### Sheet Estimation (Rectangular Packing)
When part dimensions are set:
1. Effective part size = (partLength + kerfWidth) × (partWidth + kerfWidth)
2. Usable sheet area = (sheetLength - 2×edgeTrim) × (sheetWidth - 2×edgeTrim)
3. Parts per sheet = best of two orientations
4. Sheets required = ceil(qty / partsPerSheet)

Falls back to area-based utilisation model when part dimensions are 0.

#### Commercial Rules
- **Minimum material charge**: $25 per line item
- **Minimum line charge**: $50 per line item (applied to internal subtotal before markup)
- **Markup**: Applied to effective subtotal (after minimum line charge)

#### Default Changes
- Setup: 15 → 10 min
- Handling: 10 → 5 min

### Breakdown Panel Changes (`laser-quote-builder.tsx`)

New `LLPricingBreakdown` fields displayed:
- `processMode` badge: "Time-Based" (default) or "Flat Rate" (fallback)
- `partsPerSheet`: from rectangular packing estimate
- `machineTimeMinutes`: total machine time
- `machineTimeCost`: machine hourly rate × time
- `gasCost`: gas consumption × gas price × time
- `consumablesCost`: consumable rate × machine hours

Panel dynamically shows time-based rows (Machine Time, Machine Cost, Gas Cost, Consumables) or flat-rate rows (Cut Cost, Pierce Cost) based on process mode.

## Validation

### Benchmark Case Verification

**Inputs**: AL 5052, 3mm, 100×50mm, qty 400, 2400×1200 sheet @$175.17

| Step | Calculation | Result |
|---|---|---|
| Parts/Sheet | max(floor(2380/100.3)×floor(1180/50.3), floor(2380/50.3)×floor(1180/100.3)) | 529 (23×23) |
| Sheets | ceil(400/529) | 1 |
| Material | 1 × $175.17 | $175.17 |
| Cut time | (300mm × 400) / 6000mm/min | 20.0 min |
| Pierce time | (4 × 400 × 0.5s) / 60 | 13.3 min |
| Machine time | 20.0 + 13.3 | 33.3 min |
| Machine cost | 0.556hr × $85/hr | $47.22 |
| Gas cost | 33.3min × 30L/min × $0.008/L | $8.00 |
| Consumables | 0.556hr × $8.50/hr | $4.72 |
| Process total | $47.22 + $8.00 + $4.72 | $59.94 |
| Setup/Handling | (10+5)/60 × $95/hr | $23.75 |
| Subtotal | $175.17 + $59.94 + $23.75 | $258.86 |
| Markup (35%) | $258.86 × 0.35 | $90.60 |
| **Sell Total** | | **$349.47** |
| **Unit Sell** | $349.47 / 400 | **$0.87** |

### Process Rate Table Coverage
- 40 entries covering: Mild Steel, Stainless Steel, Aluminium, Galvanised, Zincanneal
- All standard thicknesses covered per material family
- Material families match between sheet materials table and process rate tables

### Settings Updated
- `setupHandlingDefaults.defaultSetupMinutes`: 15 → 10
- `setupHandlingDefaults.defaultHandlingMinutes`: 10 → 5
- `commercialPolicy.minimumLineCharge`: added at $50

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Process rate table gaps for exotic materials | Flat-rate fallback retained; badge clearly indicates mode |
| Rectangular packing overestimates nesting | Conservative: no rotation mixing, kerf+edge trim applied |
| minimumLineCharge could mask zero-cost items | Only applies before markup; transparent in breakdown |
| `z.any()` schema for llPricingSettingsJson | Pre-existing; not introduced by Phase 4A |

## Summary

Phase 4A replaces the flat $/mm process cost model with time-based costing that uses existing processRateTables, machine hourly rate, gas costs, and consumables. The benchmark case shows an 89.5% reduction in quoted price ($3,475.91 → $349.47), bringing LL pricing to commercially realistic levels. The flat-rate model is retained as a fallback for materials without process rate table entries.
