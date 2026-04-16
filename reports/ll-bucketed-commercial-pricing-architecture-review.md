# LL Bucketed Commercial Pricing Architecture Review

**Date**: 16 April 2026  
**Phase**: LL Bucketed Commercial Pricing Architecture Review  
**Author**: SteelIQ Agent  
**Type**: Architecture review and recommendation — no code changes  

---

## 1. Executive Summary

The LL pricing engine has most of its required data buckets in place but operates with a **blended single-markup commercial model** that applies a uniform 35% markup across all cost components without distinguishing between buy costs and sell rates.

This review traces every pricing bucket from data source through calculation to sell output, identifies the key architectural ambiguity (machine and labour rates are treated as buy costs but may already embed sell-side margin), and recommends the narrowest safe next implementation phase.

**Key finding**: The current model is commercially functional but architecturally ambiguous. The `hourlyMachineRate` ($85/hr) and `shopRatePerHour` ($95/hr) are marked up again by 35%, which is either correct (if these are buy costs) or double-markup (if these are sell rates). This ambiguity must be resolved by business decision before structural changes are made.

**No code changes in this phase.** This is the architectural bridge between first-layer pricing and the next commercial maturity layer.

---

## 2. Current LL Pricing Bucket Truth

### Bucket 1: Material

| Attribute | Value |
|---|---|
| **Data source** | `ll_sheet_materials` table (394 rows, Wakefield Metals + Macdonald Steel) |
| **Rate type** | Buy cost — supplier `pricePerSheetExGst` |
| **Allocation model** | Yield-based: `sheetPrice / partsPerSheet × qty` (corrected Phase 5) |
| **Minimum charge** | $25 per line item (`commercialPolicy.minimumMaterialCharge`) |
| **Engine treatment** | Pure buy cost → pooled into blended subtotal → single markup |
| **Markup** | None (implicit via blended 35% on subtotal) |
| **Source traceability** | Full — supplier name, SKU, sheet size, price all stamped |

**Assessment**: Material is correctly modelled as buy cost. The yield-based allocation is commercially sound. No separate material markup exists — it receives its share of the blended 35%.

### Bucket 2: Machine

| Attribute | Value |
|---|---|
| **Data source** | `machineProfiles[].hourlyMachineRate` in pricing profile |
| **Current value** | $85/hr (DEV), $150/hr (LIVE) |
| **Rate type** | **AMBIGUOUS** — labelled "hourly machine rate" but semantics unclear |
| **Time calculation** | `(cutLength × qty / cutSpeedMmPerMin + pierceCount × qty × pierceTimeSec / 60) / 60 × hourlyMachineRate` |
| **Engine treatment** | Treated as cost → pooled into processCostTotal → blended subtotal → single markup |
| **Buy rate** | **NOT DEFINED** — no `machineBuyCostPerHour` field exists |

**Assessment**: Machine rate is the single largest ambiguity. If $85/hr is the true cost of running the laser (power + depreciation + maintenance), the 35% markup is correct. If $85/hr already includes margin, the 35% is double-markup. The DEV/LIVE disparity ($85 vs $150) suggests LIVE may already be at a sell rate.

### Bucket 3: Gas

| Attribute | Value |
|---|---|
| **Data source** | Governed `ll_gas_cost_inputs` table (4 active: O2 cyl, O2 MCP, N2 MCP, Ar cyl) |
| **Rate type** | Buy cost — supplier-derived `derivedCostPerLitre` |
| **Consumption source** | PRT `gasConsumptionLPerMin` × machine time |
| **Engine treatment** | Pure buy cost → pooled into processCostTotal → blended subtotal → single markup |
| **Markup** | None (implicit via blended 35%) |
| **Source traceability** | Full — supplier, agreement ref, package type, derived rate |
| **Selection logic** | Governed inputs preferred; selects minimum cost among matching gas type; falls back to pricing profile `gasCosts` |

**Assessment**: Gas is correctly modelled as governed buy cost with full traceability. The blended markup means gas recovery is not explicitly tracked — gas margin is hidden inside the 35%.

### Bucket 4: Consumables

| Attribute | Value |
|---|---|
| **Data source** | Governed `ll_consumables_cost_inputs` table (2 active: lens $0.225/hr, ceramic $0.078/hr) |
| **Rate type** | Buy cost — supplier-derived `derivedCostPerHour` |
| **Calculation** | Sum of all active consumable rates × machine time hours |
| **Current effective rate** | $0.303/hr (governed) vs $8.50/hr (pricing profile fallback — legacy, unused) |
| **Engine treatment** | Pure buy cost → pooled into processCostTotal → blended subtotal → single markup |
| **Markup** | None (implicit via blended 35%) |

**Assessment**: Consumables are correctly modelled as governed buy cost. The user requirement is that consumables should eventually have their own markup/recovery rule. Currently they receive their share of the blended 35%.

### Bucket 5: Setup / Handling (Labour)

| Attribute | Value |
|---|---|
| **Data source** | `setupHandlingDefaults` (times) + `labourRates.shopRatePerHour` (rate) |
| **Current values** | Setup: 10 min, Handling: 5 min, Shop rate: $95/hr |
| **Calculation** | `(setupMinutes + handlingMinutes) / 60 × shopRatePerHour` |
| **Engine treatment** | Treated as cost → added to subtotal → single markup |
| **Operator rate** | `operatorRatePerHour: $45/hr` — **EXISTS IN DATA MODEL BUT IS NOT USED ANYWHERE** |

**Assessment**: Labour has the clearest buy/sell separation already available in the data model (`operatorRatePerHour` = $45 buy, `shopRatePerHour` = $95 sell), but the engine ignores the buy rate entirely and uses the sell rate as a cost input, then marks it up again by 35%. If $95 is truly a sell rate, this is double-markup. The $45 operator rate exists purely as metadata.

### Bucket 6: Markup / Commercial

| Attribute | Value |
|---|---|
| **Data source** | `commercialPolicy.defaultMarkupPercent` (profile) / per-item `markupPercent` |
| **Current value** | 35% default, editable per item |
| **Base** | `max(materialCostTotal + processCostTotal + setupHandlingCost, minimumLineCharge)` |
| **Model** | Single blended percentage on entire internal cost subtotal |
| **Minimum line charge** | $50 (`commercialPolicy.minimumLineCharge`) |
| **Expedite tiers** | Defined in data model (Standard 0%, Priority 15%, Urgent 35%, Emergency 75%) — **NOT YET WIRED INTO ENGINE** |

**Assessment**: The markup model is the simplest possible first-layer approach. It works, but provides no visibility into margin by component. Material margin, machine margin, and labour margin are all invisible — only the aggregate 35% is tracked.

---

## 3. Current Commercial Calculation Truth

### Order of Operations

```
1. MATERIAL ALLOCATION
   sheetPrice / partsPerSheet × qty
   → floor at minimumMaterialCharge ($25)
   → materialCostTotal

2. PROCESS COST (time-based path)
   a. Machine:  machineTimeHours × hourlyMachineRate     → machineTimeCost
   b. Gas:      machineTimeMinutes × gasL/min × $/L      → gasCost
   c. Consumables: machineTimeHours × consumable$/hr     → consumablesCost
   d. Total:    machineTimeCost + gasCost + consumables   → processCostTotal

   (flat-rate fallback: cutLength × $/mm + pierceCount × $/pierce)

3. SETUP / HANDLING
   (setupMinutes + handlingMinutes) / 60 × shopRatePerHour
   → setupHandlingCost

4. INTERNAL COST SUBTOTAL
   materialCostTotal + processCostTotal + setupHandlingCost
   → floor at minimumLineCharge ($50)
   → effectiveSubtotal

5. MARKUP
   effectiveSubtotal × markupPercent / 100
   → markupAmount

6. SELL TOTAL
   effectiveSubtotal + markupAmount
   → sellTotal
```

### Markup Model Classification

The current model is **BLENDED SUBTOTAL MARKUP** — a single percentage applied uniformly to the entire internal cost pool. This is NOT:
- Component-based markup (different % per bucket)
- Buy/sell rate separation (no per-bucket sell rates)
- Cost-plus-fee (no fixed fees per component)

### Proof from Runtime

Test case: Aluminium 5052 Fibre PE 3mm, 430×156, qty=1, cut=1200mm, pierce=1

```
Material (yield-based):        $25.00  (52.6% of subtotal, after $25 min)
Machine time:                   $0.30  (0.6%)
Gas (N2 governed):              $0.02  (0.04%)
Consumables (governed):         $0.00  (0.002%)
Setup/Handling (15min @$95):   $23.75  (49.8% — but at sell rate before markup)
───────────────────────────────
Subtotal:                      $49.06  → floored to $50.00
Markup (35%):                  $17.50
Sell Total:                    $67.50
```

For this small part, **setup/handling dominates** ($23.75 of $49.06) and material is secondary ($25 after minimum). Machine time and consumables are negligible. The 35% markup on setup/handling is potentially double-marking labour if $95/hr is already a sell rate.

---

## 4. Recommended Near-Term Bucketed Pricing Architecture

### Architecture Decision: What Each Rate Should Be

| Bucket | Current Rate | Recommended Treatment | Rationale |
|---|---|---|---|
| **Material** | Buy cost (supplier library) | **Buy cost + material markup %** | Material should have its own markup, separate from production |
| **Machine** | Ambiguous ($85–$150/hr) | **Buy cost + sell rate** (or buy + machine markup %) | Machine cost must be explicitly separated from machine sell |
| **Gas** | Buy cost (governed) | **Buy cost → pass-through or grouped with machine** | Gas is a direct production input; margin should be explicit or absorbed |
| **Consumables** | Buy cost (governed) | **Buy cost + consumable markup/recovery %** | User requirement: consumables need own markup |
| **Labour** | Shop rate ($95/hr) | **Buy rate (operator) + sell rate (shop)** | Data model already has both rates; engine should use both |
| **Setup/Handling** | Shop rate × time | **Labour buy rate × time + labour sell fee** | Same as labour — separate buy from sell |
| **Overall markup** | 35% blended | **REMOVE or reduce to "margin catch-all"** | Per-bucket margins make blended markup redundant or reduced |

### Recommended Architecture Model

```
MATERIAL BUCKET
  materialBuyCost = sheetPrice / partsPerSheet × qty
  materialSell    = materialBuyCost × (1 + materialMarkup%)
  materialMargin  = materialSell - materialBuyCost

MACHINE BUCKET  
  machineBuyCost  = machineTimeHours × machineBuyRatePerHour
  machineSell     = machineTimeHours × machineSellRatePerHour
  machineMargin   = machineSell - machineBuyCost

GAS BUCKET
  gasBuyCost      = machineTimeMin × gasL/min × governedGas$/L
  gasSell         = gasBuyCost × (1 + gasRecovery%)  [or pass-through]
  gasMargin       = gasSell - gasBuyCost

CONSUMABLES BUCKET
  consumBuyCost   = machineTimeHours × governedConsum$/hr
  consumSell      = consumBuyCost × (1 + consumMarkup%)
  consumMargin    = consumSell - consumBuyCost

LABOUR BUCKET
  labourBuyCost   = (setupMin + handlingMin) / 60 × operatorRatePerHour
  labourSell      = (setupMin + handlingMin) / 60 × shopRatePerHour
  labourMargin    = labourSell - labourBuyCost

SELL TOTAL
  sellTotal = materialSell + machineSell + gasSell + consumSell + labourSell
  totalBuyCost = materialBuyCost + machineBuyCost + gasBuyCost + consumBuyCost + labourBuyCost
  totalMargin = sellTotal - totalBuyCost
  marginPercent = totalMargin / totalBuyCost × 100
```

### Key Benefit

This model provides **full margin visibility per bucket** while maintaining the same overall sell price. The estimator sees where margin is being made and can adjust per-bucket rates rather than a single blended percentage.

---

## 5. Next Narrow Implementation Phase

### Recommended: Phase 5B — Labour Buy/Sell Separation + Machine Buy/Sell Separation

This is the narrowest viable next slice because:

1. **Labour buy/sell data already exists** — `operatorRatePerHour` ($45) and `shopRatePerHour` ($95) are already in the pricing profile. The engine just needs to use both.

2. **Machine buy/sell requires one new field** — `machineBuyCostPerHour` added to `LLMachineProfile`. The existing `hourlyMachineRate` becomes the sell rate (or is renamed to `machineSellRatePerHour`).

3. **No markup formula change needed** — The engine switches from `blended subtotal × markup%` to `sum of per-bucket sell amounts`. The existing `markupPercent` becomes a margin verification/override tool rather than the primary pricing driver.

### Implementation Steps (Narrow)

```
Step 1: Business decision — confirm hourlyMachineRate semantics
        Is $85/hr DEV a buy cost or sell rate?
        Is $150/hr LIVE a buy cost or sell rate?
        → This determines whether to add a new field or rename existing

Step 2: Add machineBuyCostPerHour to LLMachineProfile interface
        Keep hourlyMachineRate as machineSellRatePerHour

Step 3: Update computeLLPricing to calculate:
        - labourBuyCost using operatorRatePerHour
        - labourSellCost using shopRatePerHour
        - machineBuyCost using machineBuyCostPerHour
        - machineSellCost using hourlyMachineRate

Step 4: Update LLPricingBreakdown to expose buy/sell per bucket

Step 5: Update Add Item pricing breakdown UI to show
        buy cost and sell amount per bucket (optional — may defer)

Step 6: Keep blended markup as override/adjustment until all buckets
        have explicit buy/sell
```

### What Should NOT Be in Phase 5B

- Material markup separation (defer to Phase 5C — needs estimator input on desired material margins)
- Consumable markup separation (defer to Phase 5C — relatively tiny amounts, low urgency)
- Gas markup/recovery (defer to Phase 5C — bundled with consumables)
- Quantity-break tiers (defer to Phase 6 — requires bucketed model first)
- Expedite tier wiring (defer — already defined in data model, low priority)

---

## 6. Quantity-Break Readiness Review

### What It Should Be Called

**LL Tiered Quantity Pricing** — a per-tier sell price schedule where unit sell price decreases as quantity increases within defined break points.

### Proposed Tier Structure

| Tier | Range | Expected Behavior |
|---|---|---|
| T1 | 1–5 | Base price (current single-unit price) |
| T2 | 6–10 | Reduced setup amortisation |
| T3 | 11–25 | Further setup amortisation + potential material volume benefit |
| T4 | 26–50 | Reduced per-unit overhead |
| T5 | 51–100 | Volume pricing |
| T6 | 101–200 | High-volume pricing |

### Is the Current Bucket Structure Ready?

**NO** — for the following reasons:

1. **Setup/handling is currently a fixed cost per line item** regardless of quantity. Quantity breaks primarily affect setup amortisation (setup cost ÷ qty reduces per-unit setup). The current model already does this mathematically (setup is fixed, divided by qty for unit cost), but there's no tier-based adjustment to markup or pricing strategy.

2. **The blended markup model cannot differentiate tier-based discounts by component.** Quantity breaks are most meaningful when:
   - Material discount: supplier volume pricing (not yet supported — library has fixed prices)
   - Setup amortisation: fixed cost spread over more units (already works mathematically)
   - Markup reduction: lower margin acceptable at volume (needs per-tier markup support)

3. **No tier definition exists in the data model.** The pricing profile would need a `quantityBreakTiers` section with per-tier markup adjustments or discount percentages.

### What Must Be In Place First

1. ✅ Yield-based material allocation (done)
2. ⬜ Buy/sell separation for machine and labour (Phase 5B)
3. ⬜ Bucketed margin visibility (Phase 5B/5C)
4. ⬜ Tier definition in pricing profile schema (Phase 6)
5. ⬜ Per-tier markup or discount rules (Phase 6)

### Conclusion

Quantity breaks belong in **Phase 6**, after bucketed pricing architecture is in place. Implementing them on top of the current blended model would create a tier system that cannot properly distinguish between setup amortisation benefits and margin adjustments.

---

## 7. Risks / Deferred Items

### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Machine rate semantics are unresolved | Could cause incorrect margin if wrongly classified as buy vs sell | Requires business owner decision before implementation |
| LIVE/DEV rate disparity ($150 vs $85 machine rate) | Suggests different commercial intent in each environment | Needs explicit documentation of intended rate semantics |
| Blended markup removal timing | Changing from blended to bucketed markup will change sell prices | Phase-in gradually — keep blended as override until all buckets have buy/sell |
| Pricing profile migration | Adding new fields to `LLMachineProfile` requires profile data migration | Use defaults for new fields; existing profiles remain valid |

### Deferred Items

| Item | Target Phase | Reason |
|---|---|---|
| Material markup separation | Phase 5C | Needs business input on desired material margins |
| Consumable markup/recovery | Phase 5C | Small amounts, low commercial impact currently |
| Gas markup/recovery | Phase 5C | Grouped with consumables |
| Quantity-break tiers | Phase 6 | Requires bucketed model first |
| Expedite tier wiring | Phase 6+ | Data model exists, no urgency |
| Component-level markup in UI | Phase 5C | Depends on buy/sell separation |
| Multi-machine selection | Future | Only one machine profile currently active |

---

## 8. Self-Challenge Review

### Challenge 1: Is the blended model actually wrong, or just unsophisticated?

**Answer**: It's unsophisticated but not necessarily wrong. If `hourlyMachineRate` and `shopRatePerHour` are intended as buy costs (internal cost of operations), the 35% blended markup produces a legitimate sell price. The model becomes wrong only if these rates already embed margin — which creates double-markup. The business owner must clarify this.

### Challenge 2: Does separating buy/sell actually change the sell price?

**Answer**: It CAN but doesn't have to. If calibrated correctly, the bucketed model produces the same sell price as the blended model. The benefit is margin visibility, not necessarily price change. Example:

```
BLENDED:  $50 subtotal × 1.35 = $67.50 sell
BUCKETED: material sell $33.75 + machine sell $0.40 + gas sell $0.02
          + consumables sell $0.00 + labour sell $23.75 = ~$57.92
          + margin adjustment to match = ~$67.50
```

The bucketed model lets the estimator SEE that labour is $23.75 of the $67.50 and decide whether that's appropriate.

### Challenge 3: Is Phase 5B too aggressive?

**Answer**: No — it's the narrowest viable slice. Labour already has both rates in the data model. Machine needs one new field. The engine change is small. The alternative (doing nothing) perpetuates the ambiguity.

### Challenge 4: Should material markup be done first instead?

**Answer**: No. Material is correctly modelled as buy cost. Adding a material markup percentage is straightforward but less urgent than resolving the machine/labour ambiguity, which affects every line item.

---

## 9. Final Recommendation

1. **Do not change code in this phase.** This is an architecture review.

2. **Obtain business decision** on machine rate semantics:
   - Is `hourlyMachineRate` ($85 DEV / $150 LIVE) a buy cost or a sell rate?
   - If sell rate: the engine should use it directly and remove from blended markup base.
   - If buy cost: the engine needs a corresponding sell rate field.

3. **Implement Phase 5B next** — Labour buy/sell separation + Machine buy/sell separation. This is the narrowest, highest-value next step.

4. **Keep blended markup as transitional override** during Phase 5B. Don't remove it until all buckets have explicit buy/sell rates.

5. **Plan Phase 5C** for material/consumable/gas markup separation.

6. **Plan Phase 6** for quantity-break tier implementation.

---

## 10. Release Gate

### Validation Answers

| Question | Answer |
|---|---|
| Does LL already have most of the required pricing buckets? | **YES** — material, machine, gas, consumables, labour, setup/handling, markup all have data sources |
| Is LL currently using a blended markup model? | **YES** — single 35% on entire internal cost subtotal |
| Should material markup be separated from production pricing next? | **NO** — not next; defer to Phase 5C after machine/labour buy/sell is resolved |
| Should labour and machine be moved to buy/sell rate treatment next? | **YES** — this is the recommended Phase 5B scope |
| Should consumables get their own markup/recovery rule next? | **NO** — not next; defer to Phase 5C (low commercial impact currently) |
| Are quantity breaks ready to implement now? | **NO** — requires bucketed pricing architecture first (Phase 6) |

### Final Release Gate

| Gate | Status | Reason |
|---|---|---|
| Push to Git | **YES** | Report only, no code changes |
| Publish to LIVE | **N/A** | No code changes to deploy |
| New Replit chat needed for next phase | **YES** | Phase 5B: Labour + Machine Buy/Sell Separation |

### Required Business Input Before Phase 5B

Before implementing Phase 5B, the business owner must answer:

1. **Is `hourlyMachineRate` a buy cost or sell rate?**
   - DEV: $85/hr — buy cost or sell rate?
   - LIVE: $150/hr — buy cost or sell rate?

2. **Is `shopRatePerHour` a buy cost or sell rate?**
   - $95/hr — is this what labour costs the business, or what the business charges?

3. **Should the 35% blended markup be retained as an additional margin on top of per-bucket sell rates, or should it be replaced entirely by per-bucket margins?**

These answers determine the exact implementation of Phase 5B.

---

*End of report.*
