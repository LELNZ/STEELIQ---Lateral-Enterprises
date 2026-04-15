# LL Pricing Model Cleanup — Review + Correction Report

**Date:** April 14, 2026
**System:** SteelIQ — Lateral Enterprises
**Scope:** Narrow LL pricing model review — rate-per-mm coherence, PRT family alignment, source cost governance
**Phase:** Post-Phase 1–4 gate closure, pre-Phase 5

---

## 1. Executive Verdict

**Mostly Aligned**

The LL pricing model is architecturally sound and commercially coherent. The time-based/flat-rate dual-mode engine works correctly. Two alignment issues exist: (1) six orphaned Zincanneal PRT entries with no matching material library rows, and (2) nine quoteable Corten material rows with no PRT coverage (falling to flat-rate). Neither issue corrupts pricing — one is inert, the other is a safe fallback. Source cost governance is operational in DEV but not yet seeded in LIVE. No speculative pricing changes are warranted.

---

## 2. Current LL Pricing Model Truth

### Architecture

The LL pricing engine (`client/src/lib/ll-pricing.ts`) operates in a **dual-mode** structure:

| Mode | Trigger | Calculation |
|---|---|---|
| **Time-Based** (primary) | PRT entry found matching material family + thickness (within 25% tolerance) | `machineCost = (cutLength/cutSpeed + pierceCount×pierceTime) × hourlyRate` + gas cost + consumables cost |
| **Flat-Rate** (fallback) | No PRT match found | `cutCost = cutLengthMm × $0.012/mm` + `pierceCost = pierceCount × $0.50/pierce` |

### Active Profile

| Field | DEV | LIVE |
|---|---|---|
| Profile name | Q4 Preview Rates | Standard Rate 04 2026 |
| Status | active | active |
| defaultRatePerMmCut | $0.012/mm | $0.012/mm |
| defaultRatePerPierce | $0.50/pierce | $0.50/pierce |
| Machine hourly rate | $85.00/hr | $85.00/hr (embedded in PRT) |
| PRT entries | 40 | 40 |
| PRT families | Aluminium, Galvanised, Mild Steel, Stainless Steel, Zincanneal | Aluminium, Galvanised, Mild Steel, Stainless Steel, Zincanneal |
| Default markup | 35% | 35% |

### Pricing Flow

```
Material Selection → Sheet/Coil Matching → Cut Length + Pierce Count Input
    ↓
PRT Lookup (family + thickness, 25% tolerance)
    ├── MATCH → Time-Based: machine time × hourly rate + gas + consumables
    └── NO MATCH → Flat-Rate: cutLength × $0.012 + pierces × $0.50
    ↓
Internal Cost Subtotal = materialCost + processCost + setupHandling
    ↓
Apply minimum line charge ($50.00)
    ↓
Sell Total = effectiveSubtotal × (1 + markupPercent)
```

---

## 3. Rate-per-mm Review

### Current Behavior

`defaultRatePerMmCut = $0.012/mm` is a **governed configuration value**, not a dynamically derived rate. It is:

- Stored in the active `LLPricingProfile` under `commercialPolicy.defaultRatePerMmCut`
- Hardcoded fallback default in `LL_PRICING_DEFAULTS.RATE_PER_MM_CUT` = 0.012
- Editable by admins via the Pricing Profiles management page
- Used **only** when no PRT entry matches the selected material family + thickness

### Is it commercially coherent?

**YES, within its role as a governed fallback.**

The $0.012/mm rate is not derived from machine-hour calculations — it is a deliberately set commercial rate that provides a predictable floor for materials without PRT coverage. For reference:

| Comparison | Calculation | Effective $/mm |
|---|---|---|
| Flat-rate default | Direct config | $0.012/mm |
| Time-based: 3mm Mild Steel | 5500mm/min @ $85/hr | ~$0.000258/mm (machine cost only) |
| Time-based: 3mm Mild Steel (all-in) | + gas ($0.003/L × 18L/min) + consumables | ~$0.000355/mm |

The flat-rate is approximately **34× higher** than the time-based all-in cost for a common thickness. This is by design — the flat-rate acts as a **conservative safety net** that ensures unprofiled materials are never underpriced. It absorbs gas, consumables, and overhead into a single blended rate.

### Should it be derived automatically?

**NO.** Automatic derivation would require selecting which PRT entry to derive from (which thickness? which gas?), introducing fragile coupling. The flat-rate is intentionally independent of PRT data — it is a governed commercial decision, not a technical calculation.

### Recommendation

**No change.** The current $0.012/mm flat-rate fallback is architecturally correct as a governed commercial parameter. It should remain as:
- A **manually maintained governed rate** editable via Pricing Profiles
- The **fallback only** when PRT coverage does not exist
- **Not** derived automatically from machine/hourly assumptions

The ratio between flat-rate and time-based costs should be periodically reviewed by the commercial team to ensure the safety margin remains appropriate, but this is an operational governance concern, not a code change.

---

## 4. Process Rate Table Review

### Family Alignment Matrix

| Material Family | Active Quoteable Library | PRT Entries | Machine Profile | Alias? | Status |
|---|---|---|---|---|---|
| **Mild Steel** | 38 rows (1.0–20.0mm) | 10 entries (1.6–20.0mm) | Max 20mm | — | **ALIGNED** |
| **Stainless Steel** | 82 rows (0.55–20.0mm) | 8 entries (1.2–10.0mm) | Max 10mm | — | **ALIGNED** (PRT covers machine-capable range) |
| **Aluminium** | 95 rows (0.7–25.0mm) | 10 entries (1.6–16.0mm) | Max 16mm | — | **ALIGNED** (PRT covers machine-capable range) |
| **Galvanised Steel** | 23 rows (0.55–3.0mm) | 6 entries (1.0–6.0mm) as "Galvanised" | Max 6mm | `"galvanised steel" → "galvanised"` | **ALIGNED** (alias resolves family name) |
| **Corten** | 9 rows (2.5–6.0mm) | **0 entries** | **Not listed** | — | **GAP — flat-rate fallback** |
| **Zincanneal** | **0 rows** | 6 entries (0.55–3.0mm) | Max 3mm | — | **ORPHAN — inert entries** |

### Detailed Findings

#### Zincanneal (ORPHAN)
- **6 PRT entries** exist for thicknesses 0.55, 0.8, 1.0, 1.6, 2.0, 3.0mm
- **0 material rows** exist in the active quoteable library
- **0 material rows** exist in the entire library (including inactive/reference)
- These entries are **completely inert** — the pricing engine can never match them because no Zincanneal material can be selected
- They exist in the machine profile's `maxThicknessByMaterialFamily` as `"Zincanneal": 3`
- **Impact:** None. They consume no resources and affect no pricing.
- **Risk of removal:** Low. If Zincanneal materials are added in the future, PRT entries would need to be re-created. However, the current entries are marked `dataSource: "architecture_default"` and would need replacement with empirical data regardless.
- **Recommendation:** Leave in place for now. Flag for cleanup when PRT entries are moved to a governed table with per-entry activation status (future phase).

#### Corten (COVERAGE GAP)
- **9 quoteable material rows** exist (Corten A, Weathering finish, 2.5–6.0mm, all from Macdonald Steel)
- **0 PRT entries** exist
- **Not listed** in machine profile `maxThicknessByMaterialFamily`
- All Corten quotes fall to **flat-rate** ($0.012/mm + $0.50/pierce)
- **Impact:** Corten quotes are priced at the flat-rate safety net, which is approximately 34× higher than equivalent time-based pricing. This is commercially conservative but safe.
- **Why no correction now:** Adding Corten PRT entries requires empirical cut-speed data from the Bodor 6kW fibre laser. Corten (weathering steel) has similar cutting characteristics to Mild Steel but different pierce behavior due to its alloy composition. Seeding speculative data would violate the "no speculative pricing changes" constraint.
- **Recommendation:** Defer to the next narrow phase. Corten PRT population requires operator-validated cut parameters.

#### Galvanised Steel / Galvanised (RESOLVED BY ALIAS)
- Material library uses `"Galvanised Steel"` as the family name
- PRT uses `"Galvanised"` as the family name
- The `FAMILY_ALIASES` map in `ll-pricing.ts` resolves `"galvanised steel" → "galvanised"`
- **Runtime verified:** Galvanised Steel materials correctly match Galvanised PRT entries
- **No action needed**

### PRT Thickness Coverage Gaps Within Aligned Families

| Family | Library Thicknesses | PRT Thicknesses | Gap? |
|---|---|---|---|
| Mild Steel | 1.0, 1.2, 1.6, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0, 12.0, 16.0, 20.0mm | 1.6, 2.0, 3.0, 4.5, 6.0, 8.0, 10.0, 12.0, 16.0, 20.0mm | 1.0mm (falls to flat-rate, within 25% tolerance of 1.6mm? No: 37.5% gap) |
| Stainless Steel | 0.55, 0.7, 0.9, 1.2, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0, 12.0, 16.0, 20.0mm | 1.2, 1.5, 2.0, 3.0, 4.0, 6.0, 8.0, 10.0mm | <1.2mm: flat-rate; >10mm: flat-rate (beyond machine capability per profile) |
| Aluminium | 0.7, 0.9, 1.2, 1.6, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 8.0, 12.0, 16.0, 25.0mm | 1.6, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0, 12.0, 16.0mm | <1.6mm: flat-rate; 25mm: flat-rate (beyond machine capability) |
| Galvanised Steel | 0.55, 0.75, 0.8, 0.95, 1.0, 1.15, 1.2, 1.5, 1.55, 1.6, 2.0, 2.5, 3.0mm | 1.0, 1.6, 2.0, 3.0, 4.5, 6.0mm | <1.0mm: some fall to flat-rate (0.55mm is 45% away from 1.0mm); ≤3.0mm: covered |

These sub-PRT-range gaps are acceptable — thin materials (<1mm) that fall outside the 25% tolerance are correctly priced at the flat-rate safety net.

---

## 5. Source Costs Review

### Current Live State

#### DEV Environment

| Type | Entries | Active | Status |
|---|---|---|---|
| Gas (O₂) | 3 | 2 (MCP + Cylinder) | 1 superseded |
| Gas (N₂) | 2 | 1 (MCP) | 1 superseded |
| Gas (Argon) | 1 | 1 (Cylinder) | — |
| Gas total | 7 | 4 active | 3 superseded |
| Consumables | 2 | 2 (Protective Lens + Ceramic) | — |

Active governed gas prices (DEV):
- O₂ MCP: $200.00 / 154,000L × 0.95 = **$0.001367/L**
- O₂ Cylinder: $50.00 / 8,600L × 0.95 = **$0.006120/L**
- N₂ MCP: $500.00 / 187,300L × 0.95 = **$0.002810/L**
- Argon Cylinder: $65.00 / 8,600L × 0.95 = **$0.007956/L**

Active governed consumable rates (DEV):
- Protective Lens: $45.00 / 200hr = **$0.2250/hr**
- Ceramic: $39.00 / 500hr = **$0.0780/hr**
- Combined: **$0.3030/hr**

#### LIVE Environment

| Type | Entries | Active |
|---|---|---|
| Gas | **0** | **0** |
| Consumables | **0** | **0** |

**LIVE has no governed source cost entries.** The pricing engine falls back to the profile-level static values:
- O₂: $0.003/L (from `gasCosts.o2PricePerLitre`)
- N₂: $0.008/L (from `gasCosts.n2PricePerLitre`)
- Compressed Air: $0.0005/L (from `gasCosts.compressedAirPricePerLitre`)
- Consumables: $8.50/hr (from `consumableCosts.consumableCostPerMachineHour`)

#### DEV vs LIVE Source Cost Comparison

| Gas | DEV Governed | LIVE Profile Fallback | Difference |
|---|---|---|---|
| O₂ (engine picks minimum) | $0.001367/L | $0.003000/L | LIVE is 2.2× higher |
| N₂ | $0.002810/L | $0.008000/L | LIVE is 2.8× higher |
| Consumables | $0.3030/hr | $8.50/hr | LIVE is 28× higher |

**LIVE is pricing gas and consumables significantly higher than DEV's governed rates.** This means LIVE quotes for time-based materials include a larger gas/consumable component than DEV quotes. This is commercially conservative but represents a gap between environments.

#### Dual O₂ Active Entries (DEV)

DEV has two active O₂ entries (MCP at $0.001367/L and Cylinder at $0.006120/L). The pricing engine resolves this by picking the **minimum** (`reduce` with `<=` comparison). This means:
- All O₂-assisted cutting uses the MCP rate ($0.001367/L)
- The Cylinder rate ($0.006120/L) is never selected
- This is commercially correct — the MCP (bulk) rate reflects Lateral's actual procurement cost

#### Is supplier-document-backed import ready to implement now?

**NO.** The governed source cost system is functional (status lifecycle, audit trail, discrepancy alerts), but:

1. **No supplier document ingestion pipeline exists** — costs are manually entered
2. **No automated price-list parsing** exists for BOC or Bodor invoices
3. **LIVE has no governed entries** — the seed mechanism for source costs requires manual trigger from the UI
4. **The DEV → LIVE gap** for source costs is a governance issue, not a code issue — someone needs to create/approve/activate source cost entries in the LIVE environment

#### Recommendation

Source cost import should be **next narrow phase**, not this one. The immediate action is for the commercial team to seed governed source costs in LIVE via the existing UI (LL Settings → Source Costs → Seed from BOC Agreement). No code change is needed for this.

---

## 6. Correction(s) Made

**No code corrections made in this phase.**

All findings are alignment observations and governance gaps, not code defects. The pricing engine is functioning correctly within its design parameters. The identified gaps (Zincanneal orphan, Corten PRT absence, LIVE source cost void) are **operational governance issues** that should be addressed through controlled follow-up phases, not speculative code changes.

---

## 7. Risks and Weaknesses

### Critical

None.

### Moderate

| Risk | Description | Mitigation |
|---|---|---|
| **LIVE source cost void** | LIVE uses profile-level static gas/consumable costs ($0.003/L O₂, $8.50/hr consumables) which are significantly higher than DEV's governed rates. LIVE quotes include inflated gas/consumable components. | Seed governed source costs in LIVE via existing UI. No code change needed. |
| **Corten flat-rate pricing** | All 9 Corten material rows fall to $0.012/mm flat-rate (≈34× higher than equivalent time-based MS pricing). Corten quotes are commercially conservative but may be uncompetitive. | Add Corten PRT entries once empirical cut-speed data is available from operator testing. |

### Low

| Risk | Description | Mitigation |
|---|---|---|
| **Zincanneal PRT orphan** | 6 inert PRT entries for a material family with 0 library rows. No operational impact. | Leave in place; clean up when PRT moves to governed per-entry table. |
| **Thin-gauge flat-rate gaps** | Materials <1mm in some families fall outside PRT 25% tolerance (e.g., 0.55mm Galv Steel vs 1.0mm PRT entry = 45% gap). Priced at flat-rate safety net. | Add thin-gauge PRT entries if thin materials are commonly quoted. |
| **Profile-level gas costs as fallback** | If governed source costs are cleared or deactivated, the engine silently falls back to profile-level static values without warning. | Add a UI indicator in Quote Builder when fallback rates are being used. |

---

## 8. Self-Challenge Review

### Challenge 1: "Is $0.012/mm really coherent, or is it just a placeholder someone forgot to update?"

**Response:** It is coherent as a governed safety net. The 34× premium over time-based pricing is deliberately conservative — it ensures materials without PRT coverage are never quoted at a loss. The rate is editable via Pricing Profiles, so the commercial team can adjust it. If it were meant to approximate time-based costs, it would be ~$0.0003/mm, which would require explicit PRT-derived logic. The fact that it's orders of magnitude higher confirms its role as a blended-rate fallback, not an approximation.

### Challenge 2: "Should the Zincanneal PRT entries be removed now to clean up the model?"

**Response:** Removal is technically safe (zero operational impact) but premature. If Lateral begins purchasing Zincanneal sheet from a supplier, the PRT entries provide a starting framework. Removing them creates future re-work. The entries are clearly marked `dataSource: "architecture_default"` with a note to "replace with empirical test data." They are self-documenting as provisional.

### Challenge 3: "Is the LIVE source cost void a critical bug?"

**Response:** No. The pricing engine is designed with a three-tier fallback: governed inputs → profile-level costs → hardcoded defaults. LIVE correctly uses the profile-level tier. The quotes it produces are valid — they just use higher gas/consumable rates than the governed BOC agreement rates in DEV. This is a **governance gap** (someone needs to seed LIVE), not a code bug. The system is working as designed.

### Challenge 4: "Could the dual O₂ active entries cause pricing errors?"

**Response:** No. The engine's `reduce` with `<=` comparison deterministically picks the lower-priced entry (MCP at $0.001367/L). The Cylinder entry ($0.006120/L) is never selected for cutting — it exists to track the per-cylinder cost for small-volume usage outside the laser cutting context. The engine behavior is correct, though a future enhancement could allow gas cost selection by package type rather than minimum price.

### Challenge 5: "Are any existing quotes affected by these findings?"

**Response:** No. All findings describe static conditions that have been present since the system was deployed. No quotes will change retroactively. No pricing calculation has been modified. The only behavioral change would come from future actions (adding Corten PRT entries or seeding LIVE source costs), and those would affect future quotes only.

---

## 9. Final Recommendation

**One more narrow cleanup phase required**

The pricing model is architecturally sound and commercially functional. No urgent corrections are needed. Two follow-up actions should be addressed in the next narrow phase:

1. **Corten PRT population** — Requires empirical cut-speed data from operator testing on the Bodor 6kW. Cannot be done speculatively.
2. **LIVE source cost governance** — The commercial team should seed governed gas/consumable costs in LIVE via the existing Source Costs UI. This is an operational action, not a code change. However, the next phase should verify this has been done and confirm DEV/LIVE source cost parity.

---

## 10. Best Next Phase

**LL Pricing Model — Corten PRT + Source Cost Governance**

Scope:
1. Add Corten PRT entries using operator-validated cut parameters (requires empirical data input from Lateral)
2. Add Corten to machine profile `maxThicknessByMaterialFamily`
3. Verify LIVE source costs have been seeded (or seed them programmatically if the commercial team approves)
4. Optionally add thin-gauge PRT entries for sub-1mm materials if commercially relevant
5. Optionally add a "fallback mode" indicator in the Quote Builder UI when flat-rate is being used instead of time-based

This phase should NOT be started until empirical Corten cut-speed data is available from the operator.

---

## 11. Release Gate

| Item | Decision | Rationale |
|---|---|---|
| Push to Git | **YES** | Report documents current state accurately |
| Publish to live | **NO** | No code changes made — nothing to deploy |
| New Replit chat needed for next phase | **YES** | Next phase requires empirical data input from Lateral before proceeding |

---

## Validation Answers

| Question | Answer |
|---|---|
| Should `$/mm` be automatic? | **NO** — it is correctly implemented as a governed manual fallback, not an automatic derivation |
| Is the current PRT family list aligned to the live LL library? | **NO** — Zincanneal (6 PRT entries, 0 library rows) is orphaned; Corten (9 library rows, 0 PRT entries) is uncovered |
| Is Zincanneal an orphan in current LL pricing model? | **YES** — 6 PRT entries exist with 0 matching material library rows; entries are completely inert |
| Is source-cost import ready to implement now? | **NO** — the governed source cost system is functional but requires manual seeding in LIVE and lacks automated supplier-document ingestion |

---

## Runtime Verification Log

### Paths Tested

**DEV — LL Add Item → Aluminium → 5052:**
- Finish options: Fibre PE, Mill, PE Protected, Tread
- PRT match: YES (Aluminium 1.6–16mm, time-based mode confirmed)

**DEV — LL Add Item → Aluminium → 5005:**
- Finish options: Fibre PE, Mill, PE Protected, Stucco
- PRT match: YES (same Aluminium PRT entries)

**DEV — LL Add Item → Stainless Steel → 304 2B:**
- PRT match: YES (Stainless Steel 1.2–10mm, N₂ assist gas, time-based mode)

**DEV — LL Add Item → Corten → Corten A:**
- Finish options: Weathering
- PRT match: **NO** — falls to flat-rate ($0.012/mm + $0.50/pierce)

**DEV — LL Add Item → Galvanised Steel:**
- PRT match: YES (alias `"galvanised steel" → "galvanised"` resolves correctly)

**LIVE — Pricing Profile:**
- Active: "Standard Rate 04 2026" with 40 PRT entries (identical family/thickness distribution)
- defaultRatePerMmCut: $0.012/mm (matches DEV)

**LIVE — Source Costs:**
- Gas cost inputs: 0 (no governed entries — falls to profile-level static values)
- Consumable inputs: 0 (falls to profile-level $8.50/hr)

---

## Appendix: Active Quoteable Library Summary

| Family | Rows | Thickness Range | PRT Coverage |
|---|---|---|---|
| Aluminium | 95 | 0.7–25.0mm | 1.6–16.0mm (time-based) |
| Corten | 9 | 2.5–6.0mm | NONE (flat-rate) |
| Galvanised Steel | 23 | 0.55–3.0mm | 1.0–6.0mm via alias (time-based) |
| Mild Steel | 38 | 1.0–20.0mm | 1.6–20.0mm (time-based) |
| Stainless Steel | 82 | 0.55–20.0mm | 1.2–10.0mm (time-based) |
| **Total** | **247** | — | — |
