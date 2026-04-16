# LL Bucketed Commercial Pricing — Phase 5B Implementation Report

**Date**: 16 April 2026
**Author**: SteelIQ Agent
**Phase**: 5B — Bucketed Commercial Pricing Layer 1
**Status**: IMPLEMENTED AND RUNTIME VERIFIED

---

## 1. Executive Summary

Phase 5B implements the first true bucketed commercial pricing layer for Lateral Laser (LL). The old blended subtotal markup model has been **removed**. Sell totals are now derived from five explicit buy/sell pricing buckets: Material, Machine, Gas, Consumables, and Labour. Each bucket has its own cost origin, sell treatment, and visible margin. The implementation is narrow, backward-compatible, and fully auditable.

Key outcomes:
- Material buy is yield-based supplier cost; sell is buy × (1 + materialMarkupPercent)
- Labour uses operatorRatePerHour (buy) and shopRatePerHour (sell)
- Machine uses machineBuyCostPerHour (buy) and hourlyMachineRate (sell)
- Consumables use governed source cost (buy) and buy × (1 + consumablesMarkupPercent) (sell)
- Gas remains governed pass-through at cost (interim treatment)
- Total sell = sum of per-bucket sell amounts, with minimum line charge ($50) as floor
- Existing saved estimates and quotes are unchanged (all new snapshot fields are optional with defaults)

---

## 2. Scope Implemented

### In Scope (Completed)
- ✅ Separated material markup (materialMarkupPercent, default 20%)
- ✅ Labour buy/sell treatment (operatorRatePerHour / shopRatePerHour)
- ✅ Machine buy/sell treatment (machineBuyCostPerHour / hourlyMachineRate)
- ✅ Consumables markup/recovery (consumablesMarkupPercent, default 25%)
- ✅ Gas treatment defined and preserved (pass-through at governed cost)
- ✅ LL pricing computation fully rewritten
- ✅ LL pricing breakdown data model updated (LLPricingBreakdown interface)
- ✅ LL pricing breakdown UI replaced (Buy/Sell/Margin grid per bucket)
- ✅ Existing saved pricing snapshots preserved (backward-compatible optional fields)
- ✅ Form UI updated (Material Markup % and Consumables Markup % inputs)
- ✅ Enterprise implementation report delivered

### Out of Scope (Not Touched)
- ❌ No quantity-break implementation
- ❌ No batch/setup grouping implementation
- ❌ No per-sheet cycle costing implementation
- ❌ No gas advanced pricing redesign
- ❌ No supplier library changes
- ❌ No Part Import work
- ❌ No LJ changes
- ❌ No broad UI redesign

---

## 3. Bucket Model Implemented

| Bucket | Buy Source | Sell Treatment | Margin Visibility |
|---|---|---|---|
| **Material** | Yield-based supplier cost (sheetPrice / partsPerSheet × qty), min $25 | buy × (1 + materialMarkupPercent/100) | ✅ Explicit |
| **Machine** | machineTimeHours × machineBuyCostPerHour | machineTimeHours × hourlyMachineRate | ✅ Explicit |
| **Gas** | machineTimeMinutes × gasConsumptionLPerMin × gasPricePerLitre | Pass-through (gasSellCost = gasBuyCost) | N/A (at cost) |
| **Consumables** | machineTimeHours × consumableCostPerHour | buy × (1 + consumablesMarkupPercent/100) | ✅ Explicit |
| **Labour** | (setup + handling minutes / 60) × operatorRatePerHour | (setup + handling minutes / 60) × shopRatePerHour | ✅ Explicit |

**Sell Total** = materialSell + machineSell + gasSell + consumablesSell + labourSell
**Minimum Line Charge** = max(sellTotal, $50)

---

## 4. Exact Field / Schema / Config Changes

### shared/schema.ts

| Change | Type | Details |
|---|---|---|
| `laserQuoteItemSchema.materialMarkupPercent` | New optional field | `z.number().min(0).default(20).optional()` |
| `laserQuoteItemSchema.consumablesMarkupPercent` | New optional field | `z.number().min(0).default(25).optional()` |
| `LaserItemPayload.materialMarkupPercent` | New optional field | `number?` |
| `LaserItemPayload.consumablesMarkupPercent` | New optional field | `number?` |
| `LLMachineProfile.machineBuyCostPerHour` | New optional field | `number?` |
| `LLCommercialPolicy.defaultMaterialMarkupPercent` | New optional field | `number?` |
| `LLCommercialPolicy.defaultConsumablesMarkupPercent` | New optional field | `number?` |

### shared/estimate-snapshot.ts

12 new optional backward-compatible fields added to `laserSnapshotItemSchema`:

| Field | Type | Default |
|---|---|---|
| `materialMarkupPercent` | `z.number().default(0).optional()` | 0 |
| `consumablesMarkupPercent` | `z.number().default(0).optional()` | 0 |
| `materialBuyCost` | `z.number().default(0).optional()` | 0 |
| `materialSellCost` | `z.number().default(0).optional()` | 0 |
| `labourBuyCost` | `z.number().default(0).optional()` | 0 |
| `labourSellCost` | `z.number().default(0).optional()` | 0 |
| `machineBuyCost` | `z.number().default(0).optional()` | 0 |
| `machineSellCost` | `z.number().default(0).optional()` | 0 |
| `consumablesBuyCost` | `z.number().default(0).optional()` | 0 |
| `consumablesSellCost` | `z.number().default(0).optional()` | 0 |
| `gasBuyCost` | `z.number().default(0).optional()` | 0 |
| `totalBuyCost` | `z.number().default(0).optional()` | 0 |
| `totalMargin` | `z.number().default(0).optional()` | 0 |
| `totalMarginPercent` | `z.number().default(0).optional()` | 0 |

### client/src/lib/ll-pricing.ts

Complete rewrite. Key changes:
- `LLPricingInputs` now requires `materialMarkupPercent` and `consumablesMarkupPercent`
- `LLPricingBreakdown` now exposes 20+ new bucketed fields (buy/sell/margin per bucket)
- `resolveRatesFromSettings()` resolves `defaultMaterialMarkupPercent` and `defaultConsumablesMarkupPercent` from commercial policy
- `getMachineRates()` returns `{ sellRate, buyRate }` — buyRate defaults to 60% of sell when `machineBuyCostPerHour` is not set
- `computeLLPricing()` produces sell total from sum of bucketed sell values, not a blended markup
- Old `markupPercent` output retained as `effectiveMarkupPercent` (derived, for backward compat)

### client/src/pages/laser-quote-builder.tsx

| Function | Change |
|---|---|
| `makeEmptyItem()` | Seeds `materialMarkupPercent` and `consumablesMarkupPercent` from profile defaults |
| `computeItemPricing()` | Passes new fields to `computeLLPricing()` with fallbacks |
| `itemToSnapshotItem()` | Stamps all bucketed fields from pricing result |
| `snapshotItemToItem()` | Reads new fields with profile-default fallbacks |
| `openEditDialog()` | Includes `coilLengthMm`, `geometrySource`, and new markup fields |
| Form UI | Replaced single "Markup %" with "Material Markup %" and "Consumables Markup %" inputs |
| `PricingBreakdownPanel` | Replaced flat row list with Buy/Sell/Margin grid showing all 5 buckets |
| Table display | Shows margin % on unit sell column, +$margin on line total |

---

## 5. Calculation Logic Changes

### Before (Pre-5B)
```
internalCost = materialCost + processCost + setupHandlingCost
sellTotal = max(internalCost × (1 + markupPercent/100), minimumLineCharge)
```
Single blended markup applied to entire internal subtotal. No visibility into per-bucket margin.

### After (Phase 5B)
```
materialSell = materialBuy × (1 + materialMarkupPercent / 100)
machineSell = machineTimeHours × hourlyMachineRate (sell rate)
machineBuy = machineTimeHours × machineBuyCostPerHour (buy rate)
gasSell = gasBuy  (pass-through)
consumablesSell = consumablesBuy × (1 + consumablesMarkupPercent / 100)
labourSell = (setup + handling hours) × shopRatePerHour
labourBuy = (setup + handling hours) × operatorRatePerHour
sellTotal = max(sum of all bucket sells, minimumLineCharge)
totalBuyCost = sum of all bucket buys
totalMargin = sellTotal - totalBuyCost
totalMarginPercent = (totalMargin / totalBuyCost) × 100
```

### Machine Buy Rate Defaulting Strategy
When `machineBuyCostPerHour` is not set on the machine profile (current state: no profile has it set), the engine defaults to:
```
buyRate = hourlyMachineRate × 0.6 (MACHINE_BUY_COST_RATIO)
```
For DEV ($85/hr sell) → $51/hr buy. For LIVE ($150/hr sell) → $90/hr buy.
This is a **narrow safe default** — conservative, bounded, and explicitly reported. It can be overridden per-profile by setting `machineBuyCostPerHour`.

---

## 6. Runtime Evidence

### Test Case 1: Small Aluminium Part
**Material**: Aluminium / 5052 / Fibre PE / 3mm on 3000×1500 sheet ($305.56)
**Part**: 430×156mm, qty=1, cut length=1200mm, 1 pierce
**Profile**: Q4 Preview Rates v3.0-draft (DEV)

| Bucket | Buy | Sell | Margin |
|---|---|---|---|
| Material (20% mkp) | $25.00 (min charge) | $30.00 | $5.00 |
| Machine ($51→$85/hr) | $0.18 | $0.30 | $0.12 |
| Gas (N2 pass-through) | $0.02 | $0.02 | — |
| Consumables (25% mkp) | $0.00 | $0.00 | $0.00 |
| Labour ($45→$95/hr) | $18.75 | $39.58 | $20.83 |
| **TOTAL** | **$43.95** | **$69.90** | **$25.95** |

- Unit Sell: $69.90
- Margin %: ~59.1%
- Process mode: Time-Based
- Gas source: BOC NZ11352442 (152MP15) governed
- Consumables source: Bodor governed ($0.303/hr combined)
- Parts/sheet: 57
- Min material charge applied (raw yield cost $5.36 < $25)

### Test Case 2: Markup Override Verification
Changed Material Markup from 20% to 30% in UI:
- Material sell changed from $30.00 to $32.50 (confirmed live update)
- Total sell increased accordingly
- All other buckets unchanged

### E2E Test Result: **PASS**
Automated Playwright test confirmed:
- Bucketed Pricing Breakdown panel renders with Buy/Sell/Margin columns
- All 5 bucket rows displayed
- Time-Based badge shown
- Material Markup % and Consumables Markup % form inputs present and defaulted correctly
- Live recalculation on markup change verified

---

## 7. Before vs After Commercial Impact

### Before (Blended Model)
- Single 35% markup on internal subtotal
- No visibility into which component contributes what margin
- No ability to differentiate material recovery from production recovery
- Labour, machine, gas, consumables all lumped together
- Internal cost shown, but margin source opaque

### After (Bucketed Model)
- Material: explicit supplier cost + 20% markup (configurable per item)
- Machine: explicit buy/sell spread (40% default margin on machine time)
- Labour: explicit operator buy vs shop sell (111% default margin)
- Consumables: explicit buy + 25% markup (configurable per item)
- Gas: at-cost pass-through (explicit deferral)
- Total margin and margin % visible in UI
- Per-bucket margin visible in breakdown panel
- Old blended 35% markup: **REMOVED** as primary mechanism

### Typical Impact (Test Case 1 example)
- Old model: ~$43.95 cost × 1.35 = ~$59.33 sell (35% markup)
- New model: $69.90 sell (59.1% effective margin from bucketed sell rates)
- The new model produces higher sell totals because labour sell ($95/hr vs $45/hr buy) and material markup (20%) compound differently than a flat 35%. This is the correct business intent — shop rate recovery should exceed operator cost.

---

## 8. Backward Compatibility Check

| Concern | Status |
|---|---|
| Existing saved estimates parse correctly | ✅ All new snapshot fields are optional with defaults |
| Old snapshots without bucketed fields load in UI | ✅ `snapshotItemToItem()` uses fallbacks from resolved rates |
| Old `markupPercent` field retained | ✅ Retained in schema, now computed as `effectiveMarkupPercent` (derived output) |
| Old `internalCostSubtotal` field retained | ✅ Now maps to `totalBuyCost` |
| Old `materialCostTotal` field retained | ✅ Now maps to `materialBuyCost` |
| Old `processCostTotal` field retained | ✅ Still computed as legacy compat field |
| Database schema unchanged | ✅ No migration needed — all changes are in JSON payload/schema types |
| LJ pricing unchanged | ✅ No LJ code touched |

---

## 9. Explicit Deferrals

| Item | Status | Rationale |
|---|---|---|
| Quantity breaks | ❌ Deferred | Not in Phase 5B scope; requires separate tier model |
| Batch/setup grouping | ❌ Deferred | Requires multi-item batch logic; Phase 5C+ |
| Per-sheet cycle costing | ❌ Deferred | Requires nesting integration; later layer |
| Gas markup/recovery | ❌ Deferred | Gas remains pass-through at governed cost; tiny margin contribution makes markup low priority |
| `machineBuyCostPerHour` per-profile data entry | ❌ Deferred | Field exists but no UI for setting it on profiles yet; defaults safely to 60% of sell |
| `defaultMaterialMarkupPercent` and `defaultConsumablesMarkupPercent` per-profile data entry | ❌ Deferred | Fields exist in LLCommercialPolicy but no profile editor UI yet; defaults from LL_PRICING_DEFAULTS |
| Preview/PDF bucketed display | ❌ Deferred | Customer-facing output still shows sell totals only (correct — no internal cost leakage) |

---

## 10. Final Recommendation

Phase 5B is complete and verified. The bucketed commercial pricing layer 1 is operational for all new LL line items. Recommendations for next phases:

1. **Add profile editor UI** for `machineBuyCostPerHour`, `defaultMaterialMarkupPercent`, `defaultConsumablesMarkupPercent` so operators can configure per-profile without code changes
2. **Gas markup** can be added as a small enhancement when business requires it (add gasMarkupPercent, same pattern as consumables)
3. **Quantity breaks** should be the next commercial pricing phase (Phase 5C or 6+)
4. **Batch/setup grouping** and **sheet-cycle costing** can follow after quantity breaks

---

## 11. Release Gate

### Mandatory Questions Answered

| Question | Answer |
|---|---|
| What exact new fields were added? | See Section 4 — 7 schema fields, 14 snapshot fields, 20+ breakdown fields |
| How is material sell now calculated? | materialBuy × (1 + materialMarkupPercent/100) |
| How is labour buy vs sell calculated? | buy = hours × operatorRatePerHour ($45); sell = hours × shopRatePerHour ($95) |
| How is machine buy vs sell calculated? | buy = hours × machineBuyCostPerHour (or 60% of sell); sell = hours × hourlyMachineRate |
| How are consumables sell calculated? | buy × (1 + consumablesMarkupPercent/100) |
| What happens to old blended 35% markup? | **REMOVED** as primary mechanism. Retained only as computed `effectiveMarkupPercent` output for backward compat display. Sell total now comes from bucketed sell values. |
| Are existing saved LL quotes/estimates unchanged? | **YES** — all new fields optional with defaults |
| Are new LL items priced under bucketed model? | **YES** |
| What is deferred? | Quantity breaks, batch/setup grouping, sheet-cycle costing, gas markup, profile editor UI for new fields |

### Validation Checklist

| Statement | Answer |
|---|---|
| Is material markup now separated from production pricing? | **YES** |
| Does labour now use buy and sell rates? | **YES** |
| Does machine now use buy and sell rates? | **YES** |
| Do consumables now use their own markup/recovery logic? | **YES** |
| Is gas still on interim treatment for now? | **YES** |
| Are quantity breaks still deferred? | **YES** |
| Are batch/setup grouping and sheet-cycle costing still deferred? | **YES** |
| Can LL now be considered on bucketed commercial pricing layer 1? | **YES** |

### Final Release Gate

| Gate | Decision |
|---|---|
| Push to Git | **YES** — committed at checkpoint cda36360 |
| Publish to live | **YES** — safe to deploy; backward compatible, no migration needed |
| New Replit chat needed for next phase | **YES** — recommended for quantity breaks or gas markup implementation |
