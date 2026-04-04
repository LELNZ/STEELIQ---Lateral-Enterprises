# Phase 4E — Enterprise Forensic Report
## LL Governance Consolidation + Commercial Truth Correction

**Report Date:** 4 April 2026
**Phase:** 4E
**Prepared For:** Lateral Enterprises Management
**Classification:** Enterprise Decision Record

---

## 1. Executive Summary

Phase 4E corrected commercially significant gas capacity assumptions, introduced discrete package-level gas records, relocated LL-only governance administration into proper enterprise placement, established hard precedence rules between governance layers, and aligned the pricing profile interface to eliminate ambiguity about the source of gas and consumable cost truth.

**Key outcomes:**
- Nitrogen MP15 pack volume corrected from ~50,000L placeholder to operator-confirmed 187,300L (15 × 12.49 m³), reducing derived cost from $0.010526/L to $0.002810/L — a **73.3% reduction**
- Oxygen J15 Manpack added as a new discrete record: 154,000L (15 bottles, 154 m³), derived cost $0.001367/L
- Four active gas records now maintained (O₂ G2, O₂ J15, N₂ MP15, Ar G) — each discrete per package code
- LL Pricing Governance and Commercial Inputs moved from generic top-level sidebar links into Settings > Divisions > LL sub-tabs
- Hard precedence rules implemented and visible in admin UI
- Daily service charge treatment explicitly documented as excluded from per-litre derivation

---

## 2. Management Decision

### Decision Required
Accept the corrected gas capacity volumes and the resulting derived cost model as the commercially governing truth for LL laser cutting quotations.

### Decision Context
The original Phase 4D deployment used a placeholder estimate of ~50,000L for the Nitrogen MP15 Manpack. This was explicitly flagged as unconfirmed. The operator has now confirmed the actual pack specification:

| Gas Package | Previous Assumption | Confirmed Volume | Source |
|---|---|---|---|
| N₂ MP15 | ~50,000 L (estimate) | 187,300 L (15 × 12.49 m³) | Operator-confirmed |
| O₂ J15 | Not previously tracked | 154,000 L (15 bottles, 154 m³) | Operator-confirmed |

### Cost Impact

| Gas | Previous $/L | Corrected $/L | Change |
|---|---|---|---|
| Nitrogen (MP15) | $0.010526 | $0.002810 | −73.3% |
| Oxygen (J15 Manpack) | N/A (new) | $0.001367 | New record |
| Oxygen (G2 Cylinder) | $0.006120 | $0.006120 | No change |
| Argon (G Cylinder) | $0.007956 | $0.007956 | No change |

**Implication:** All nitrogen-assist cuts (stainless steel, aluminium) will now price with a significantly lower gas cost component. This directly impacts quote competitiveness for these material families. Management should validate that the resulting quotes remain commercially acceptable.

---

## 3. Enterprise Information Architecture Decision

### Why Pricing Governance and Commercial Inputs Are Separate

**Pricing Governance** (profiles) defines *how* Lateral Laser prices work:
- Machine hourly rates
- Process rate tables (cut speeds, pierce times, gas consumption by material/thickness)
- Commercial policy (markup %, minimums, expedite tiers)
- Labour rates (operator, shop)
- Nesting defaults (kerf, gap, utilisation)
- Setup and handling standards

**Commercial Inputs** defines *what things cost* from suppliers:
- Gas delivered price per pack, with contract/agreement traceability
- Consumable unit cost per item, with invoice traceability
- Capacity assumptions and derived per-unit costs
- Supplier identity, source document, dates

These are fundamentally different concerns:
- A pricing profile can change without any supplier cost changing (e.g., markup policy review)
- A gas contract can renew at new prices without any pricing policy changing
- Different actors own each: commercial/procurement owns supplier negotiations; operations/management owns pricing policy

### Why They Should Not Be Ordinary Library Items

The Materials Library governs **operational master data**:
- Material families, sheet sizes, finishes, thicknesses
- Supplier material records (who sells what sheet at what cost)
- This is reference data that changes infrequently and has no lifecycle governance

Commercial Inputs are **contract-backed evidence** with:
- Approval and activation lifecycle
- Audit trail showing who approved, when, and why
- Supersession history when contracts are renewed
- Source document traceability (agreement number, invoice number)
- Derived cost calculations with documented assumptions

Storing a BOC gas agreement as an ordinary library material would:
- Lose the governance lifecycle (draft → approved → active → superseded)
- Lose the audit trail
- Blur the distinction between "what sheet sizes exist" and "what does nitrogen cost under our current contract"
- Make it impossible to answer forensic questions like "what was the gas cost basis on this quote from 3 months ago?"

### Why They Must Sit Under LL Division Settings

- Pricing Governance and Commercial Inputs are **LL-specific** concepts
- LJ (joinery) and LE (engineering) have entirely different costing models
- Presenting gas contract governance as a top-level system page implies it applies to all divisions — it does not
- Correct placement: Settings > Divisions > LL > [Pricing Governance | Commercial Inputs]
- This makes the scope immediately clear to any administrator

---

## 4. Scope Delivered

| Task | Description | Status |
|---|---|---|
| T001 | Correct N₂ MP15 to 187,300L, add O₂ J15 at 154,000L | Complete |
| T002 | Discrete records per package code (O₂ G2, O₂ J15, N₂ MP15, Ar G) | Complete |
| T003 | Move LL governance pages into LL division settings sub-tabs | Complete |
| T004 | Enterprise boundary separation (Library / Governance / Commercial) | Complete |
| T005 | Hard precedence rules implemented and visible | Complete |
| T006 | Pricing profile UI aligned — gas/consumable values labelled as fallback | Complete |
| T007 | Daily service charge treatment documented as excluded | Complete |
| T008 | Library relationship maintained without merger | Complete |
| T009 | Runtime verification | Complete |
| T010 | This forensic report | Complete |

---

## 5. Corrected Commercial Source Truth

### Active Gas Cost Inputs (as at report date)

| Gas Type | Package Code | Package Type | Delivered Price | Capacity | Usable Fraction | Derived $/L | Supplier | Agreement |
|---|---|---|---|---|---|---|---|---|
| Oxygen | 100G2 | Cylinder | $50.00 | 8,600 L | 95% | $0.006120 | BOC | NZ11352442 |
| Oxygen | J15 | MCP (Manpack) | $200.00 | 154,000 L | 95% | $0.001367 | BOC | NZ11352442 |
| Nitrogen | 152MP15 | MCP (Manpack) | $500.00 | 187,300 L | 95% | $0.002810 | BOC | NZ11352442 |
| Argon | 130G | Cylinder | $65.00 | 8,600 L | 95% | $0.007956 | BOC | NZ11352442 |

### Active Consumable Cost Inputs

| SKU | Description | Unit Cost | Life Model | Expected Life | Derived $/hr | Supplier | Invoice |
|---|---|---|---|---|---|---|---|
| LM-PLBODOR-37DN | Protective Lens D37-N-15KW | $45.00 | Hours | 200 hr | $0.2250 | Laser Machines Limited | INV-0226 |
| P0571-1051-00001 | KTB2 CON Laser Ceramic 1.5-6KW | $39.00 | Hours | 500 hr | $0.0780 | Laser Machines Limited | INV-0226 |

### Derivation Formula

**Gas:** `derivedCostPerLitre = deliveredPriceExGst ÷ (unitCapacityValue × usableFraction)`

**Consumable:** `derivedCostPerHour = unitCostExGst ÷ expectedLifeValue`

### Correction Audit Trail

| Record | Previous Value | Corrected Value | Reason |
|---|---|---|---|
| N₂ MP15 capacity | ~50,000 L (placeholder) | 187,300 L | Operator confirmed: 15 bottles × 12.49 m³ = 187.30 m³ |
| N₂ MP15 derived cost | $0.010526/L | $0.002810/L | Recalculated from corrected capacity |
| O₂ J15 | Did not exist | 154,000 L at $0.001367/L | New record: operator confirmed 15 bottles, 154 m³ |

---

## 6. Pricing Governance Precedence Model

The following hard precedence rules are implemented in the pricing engine and visible in the admin UI:

| Priority | Layer | Governs | Source |
|---|---|---|---|
| 1 (highest) | Active Commercial Inputs | Gas $/L, Consumable $/hr | Supplier agreements and invoices |
| 2 | Active Pricing Profile | Rates, policy, markup, labour, nesting | Governed profile with lifecycle |
| 3 | Materials Library | Material selection, sheet sizes, material cost | Operational master data |
| 4 (fallback) | Pricing Profile JSON values | Gas/consumable costs embedded in profile | Only if no active commercial input exists |

### How Precedence Works in Practice

When the laser quote builder prices a cut:
1. It fetches active commercial inputs for gas costs
2. If an active governed input exists for the required gas type, that derived $/L is used
3. If multiple active inputs exist for the same gas type (e.g., O₂ G2 and O₂ J15), the **lowest-cost** package is selected automatically
4. Only if no active governed input exists does the engine fall back to the pricing profile's embedded gas cost values
5. The same pattern applies for consumables: active commercial inputs override profile values

### Precedence Visibility

- The LL division settings page shows a blue precedence banner explaining the 4-tier model
- The pricing profile page explicitly labels gas and consumable values as "fallback" with a governance notice
- The legacy pricing settings viewer shows badges indicating that gas/consumable values are governed by Commercial Inputs

---

## 7. UI Placement Decision and Rationale

### Before Phase 4E
- "Pricing Profiles" appeared as a standalone sidebar link under System
- "Commercial Inputs" appeared as a standalone sidebar link under System
- Both were presented as generic system-level administration, implying cross-division scope

### After Phase 4E
- Both pages are embedded as sub-tabs within Settings > Divisions > LL
- Three LL-specific tabs: **Division Settings** | **Pricing Governance** | **Commercial Inputs**
- Standalone sidebar links removed
- Direct URL access (/ll-pricing-profiles, /ll-commercial-inputs) redirects to settings with correct tab
- The precedence banner is visible on all LL sub-tabs

### Rationale
- Scoping is immediately clear: these are LL-only governance concepts
- Administrators navigating to LJ or LE division settings will not see pricing governance or commercial inputs
- The conceptual hierarchy matches the enterprise structure:
  - Settings (company-wide)
    - Divisions (per-division)
      - LL (specific division)
        - Division Settings (branding, templates, overrides)
        - Pricing Governance (pricing profiles with lifecycle)
        - Commercial Inputs (supplier-backed cost records)

---

## 8. Runtime Validation Matrix

| Check | Expected | Verified |
|---|---|---|
| N₂ MP15 derived cost | $0.002810/L | Yes — active record confirmed |
| O₂ J15 derived cost | $0.001367/L | Yes — active record confirmed |
| O₂ G2 remains active | $0.006120/L | Yes — separate package code |
| Ar G remains active | $0.007956/L | Yes — unchanged |
| 4 active gas records coexist | O₂ G2, O₂ J15, N₂ MP15, Ar G | Yes — unique index on (division, gas_type, package_code) |
| Old N₂ placeholder superseded | Status = superseded | Yes |
| Settings > LL shows 3 sub-tabs | Division Settings, Pricing Governance, Commercial Inputs | Yes |
| Sidebar no longer shows standalone links | No "Pricing Profiles" or "Commercial Inputs" in sidebar | Yes |
| Pricing profile gas values labelled "fallback" | Yes — with governance notice | Yes |
| Precedence banner visible | Blue info card on all LL tabs | Yes |
| Builder resolves governed gas rates | Picks cheapest active package per gas type | Yes |
| LJ and LE division settings unaffected | No pricing governance tabs | Yes |
| Laser quote builder still functions | Pricing engine resolves from governed inputs | Yes |

---

## 9. Daily Service Charge Treatment

### Rule
Daily service charges are **excluded** from the derived per-litre gas cost.

### Rationale
- Daily service charges are a **rental/logistics** charge for having gas equipment on site
- They are not a consumption cost — they accrue regardless of whether gas is used
- Including them in per-litre cost would distort the relationship between gas consumption and cost
- They should be treated as a fixed overhead, not a variable cost per cut

### Current Values
| Package | Daily Service Charge | Treatment |
|---|---|---|
| O₂ G2 (Cylinder) | $0.25/day | Excluded from $/L derivation |
| O₂ J15 (Manpack) | $3.00/day | Excluded from $/L derivation |
| N₂ MP15 (Manpack) | $3.00/day | Excluded from $/L derivation |
| Ar G (Cylinder) | $0.25/day | Excluded from $/L derivation |

### Future Consideration
If management requires daily service charges to be allocated to production, a documented rental allocation method should be defined (e.g., amortise over expected monthly machine hours). This is not currently implemented and would require a separate phase.

---

## 10. Defects Found and Corrected

| # | Defect | Impact | Resolution |
|---|---|---|---|
| 1 | Unique index on gas inputs was (division_key, gas_type) — only one active record per gas type | Could not maintain both O₂ G2 and O₂ J15 as active | Changed to (division_key, gas_type, package_code) |
| 2 | Activation SQL superseded by gas_type only | Activating O₂ J15 incorrectly superseded O₂ G2 | Added package_code to activation WHERE clause |
| 3 | Gas resolution picked first match per type | With multiple packages, selection was arbitrary | Changed to pick lowest-cost active package per gas type |
| 4 | Pricing profile showed gas/consumable values without governance context | Users could not tell whether profile values or commercial inputs governed pricing | Added "fallback" labels and governance notices |
| 5 | LL governance pages presented as system-wide | Administrators could mistakenly believe governance applied to all divisions | Moved into LL division settings sub-tabs |

---

## 11. Remaining Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Argon G cylinder capacity (8,600L) not yet operator-confirmed | Medium | Flagged in assumptions — business should verify with BOC |
| Lens expected life (200 hr) is an initial estimate | Medium | Business must confirm from actual replacement data |
| Ceramic expected life (500 hr) is an initial estimate | Medium | Business must confirm from actual replacement data |
| O₂ J15 delivered price ($200.00) may need verification | Low | Sourced from BOC agreement — confirm with current invoice |
| Builder auto-selects cheapest package per gas type | Low | Correct default behaviour but operator may prefer specific package |
| Daily service charges not yet allocated to production | Low | Documented as excluded — future phase if required |
| Compressed air has no governed commercial input | Low | Falls back to pricing profile value — acceptable for now |

---

## 12. Readiness Decision

### Phase 4E is production-ready with the following conditions:

1. **Confirmed:** N₂ MP15 and O₂ J15 volumes are operator-confirmed and correctly reflected
2. **Confirmed:** Enterprise boundaries are clear and correctly placed
3. **Confirmed:** Precedence rules are implemented, visible, and documented
4. **Confirmed:** No regression to LJ or LE workflows
5. **Action Required:** Business should validate that the N₂ cost reduction (73.3%) produces commercially acceptable quotes for stainless steel and aluminium
6. **Action Required:** Business should confirm Ar G cylinder capacity with BOC
7. **Action Required:** Business should confirm lens and ceramic expected life values from operational data

---

## 13. Recommended Next Phase

### Phase 5 — Operational Maturity

Potential scope:
1. **Compressed air commercial input** — add governed record for compressed air if a supply contract exists
2. **Package selection in builder** — allow operator to specify which gas package applies per quote (G2 cylinder vs J15 manpack) rather than auto-selecting cheapest
3. **Daily service charge allocation** — implement documented rental allocation method if management requires
4. **Contract expiry monitoring** — alert when BOC agreement approaches renewal date (commencement + 1 year)
5. **Actual life tracking** — record actual consumable replacement events to improve life estimates
6. **Multi-machine support** — extend pricing profiles for additional laser machines beyond Bodor 3015
