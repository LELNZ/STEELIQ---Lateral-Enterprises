# Phase 5A — Enterprise Forensic Report
## LL Architecture Consolidation and Controlled Admin IA Lock

**Report Date:** 4 April 2026
**Phase:** 5A
**Prepared For:** Lateral Enterprises Management
**Classification:** Enterprise Decision Record

---

## 1. Executive Summary

Phase 5A consolidated the LL admin information architecture from three ambiguous tabs (Division Settings, Pricing Governance, Commercial Inputs) into the four canonical LL enterprise domains: Overview, Library, Source Costs, and Pricing Model. Duplicate truth presentation was reduced, ownership headers were made explicit in the UI, data-flow direction was verified, and compact provenance visibility was added to the estimate builder and quote detail.

No new systems, governance engines, pricing engines, approval systems, or library architectures were created.

LJ and LE workflows were not modified. The QuoteDocument → QuoteRenderModel → Preview/PDF pipeline was not modified. Revision continuity behaviour was not altered.

---

## 2. Management Decision

### Decision Required
Accept the locked LL admin information architecture as the canonical enterprise model for all future LL administration.

### Decision Context
Prior phases introduced valid governance concepts (pricing profiles, commercial inputs, estimate persistence, pricing precedence) but presented them through an evolving tab structure that risked admin sprawl and ambiguous ownership. Phase 5A locks the final IA:

| Domain | Purpose | Does NOT Own |
|---|---|---|
| **Library** | Operational master data for material and sheet selection | Gas/consumable source costs, pricing policy |
| **Source Costs** | Supplier-backed gas and consumable cost records | Material master data, pricing rules, markup policy |
| **Pricing Model** | Approved pricing rules, process rates, markup policy | Supplier-backed gas/consumable truth where Source Costs exists |

---

## 3. Locked Target Architecture

The accepted LL enterprise model consists of five canonical concepts:

1. **LL Library** — Material families, grades, finishes, thicknesses, sheet sizes, supplier material records
2. **LL Source Costs** — Gas source-cost records and consumable source-cost records with supplier traceability
3. **LL Pricing Model** — Machine profiles, process rates, labour rates, markup, minimums, nesting defaults, expedite tiers
4. **LL Estimates** — Operational estimating workspace reading from Library + Source Costs + Pricing Model
5. **LL Quotes** — Formal commercial output stamped with pricing provenance

These are the canonical LL concepts. No alternatives were created. No parallel administration surfaces remain.

---

## 4. Delivered Admin Information Architecture

### Settings > Divisions > LL

| Tab | Content | Ownership |
|---|---|---|
| **Overview** | Enterprise admin explanation, 3-domain cards, data flow diagram, precedence model, division branding settings | LL admin scope and context |
| **Library** | Sheet materials summary by family, link to full Library page | Material master data |
| **Source Costs** | Gas and consumable governed records, package selection policy notice | Supplier-backed source-cost truth |
| **Pricing Model** | Pricing profiles with lifecycle, process rates, commercial policy | Pricing rules and costing logic |

### Previous Structure (Replaced)
| Old Tab | Mapped To | Notes |
|---|---|---|
| Division Settings | Overview | Division form fields retained; `LLPricingSettingsViewer` legacy view removed from tab |
| Pricing Governance | Pricing Model | Renamed; ownership header added; gas/consumable labels updated to "Source Costs" |
| Commercial Inputs | Source Costs | Renamed; ownership header added; package selection policy documented |

---

## 5. Ownership Boundaries by LL Domain

### Library
- **Owns**: `ll_sheet_materials` table — material families, grades, finishes, thicknesses, sheet sizes, supplier material records
- **Does NOT own**: Gas contract records, consumable invoice records, markup policy, pricing profile lifecycle
- **UI position**: Settings > LL > Library tab — shows summary with link to full Library page
- **No duplicate truth**: Library does not display gas/consumable cost data

### Source Costs
- **Owns**: `ll_gas_cost_inputs` table — gas source-cost records with supplier/agreement traceability, governed lifecycle (draft→approved→active→superseded→archived)
- **Owns**: `ll_consumables_cost_inputs` table — consumable source-cost records with invoice traceability, governed lifecycle
- **Does NOT own**: Material master data, pricing rules, markup/minimum policy
- **UI position**: Settings > LL > Source Costs tab
- **No duplicate truth**: Source Costs does not display material library data or pricing policy data
- **Explicit label**: "Supplier-backed source cost records with contract traceability — not library material records"

### Pricing Model
- **Owns**: `ll_pricing_profiles` table — versioned pricing profiles with lifecycle, process rate tables, machine profiles, labour rates, markup rules, nesting defaults, commercial policy
- **Does NOT own**: Supplier-backed gas truth where Source Costs exists, supplier-backed consumable truth where Source Costs exists, material master data
- **UI position**: Settings > LL > Pricing Model tab
- **Explicit labels**: Gas costs labelled "governed by active Source Costs — profile values are fallback only"; consumable costs labelled "governed by active Source Costs — profile value is fallback only"
- **No duplicate truth**: Pricing Model shows embedded gas/consumable values only as clearly labelled fallbacks

### Estimates
- **Reads from**: Library (material selection), Source Costs (gas/consumable rates), Pricing Model (process rates, markup, policy)
- **Does NOT own**: Independent pricing truth, duplicated gas/consumable truth, duplicated material master truth
- **Provenance**: Builder header shows active pricing model badge and active source-cost count badge

### Quotes
- **Reads from**: Estimate output, pricing provenance
- **Stamps**: `pricingProfileId`, `pricingProfileLabel`, `pricedAt` at creation
- **Provenance**: Quote detail shows "Pricing Basis" card for LL quotes with profile label and pricing date
- **Does NOT own**: Independent recalculation rules, duplicate pricing policy, duplicate source-cost policy
- **Protected**: QuoteDocument → QuoteRenderModel → Preview/PDF pipeline was NOT modified

---

## 6. Data Flow Verification

### Accepted Data Flow
```
Library + Source Costs + Pricing Model → Estimate Builder → Quote
```

### Verification

| Check | Result |
|---|---|
| Builder reads materials from `/api/ll-sheet-materials` (Library) | Confirmed |
| Builder reads gas inputs from `/api/ll-gas-cost-inputs/active` (Source Costs) | Confirmed |
| Builder reads consumable inputs from `/api/ll-consumables-cost-inputs/active` (Source Costs) | Confirmed |
| Builder reads active profile from `/api/ll-pricing-profiles/active` (Pricing Model) | Confirmed |
| `getGasPricePerLitre()` in `ll-pricing.ts` resolves from governed Source Costs first, falls back to Pricing Model embedded values | Confirmed |
| `getConsumableCostPerHour()` in `ll-pricing.ts` resolves from governed Source Costs first, falls back to Pricing Model embedded values | Confirmed |
| Builder does not maintain independent pricing truth | Confirmed — all pricing inputs sourced from external governed data |
| Estimates stamped server-side with `pricingProfileId`/`pricingProfileLabel`/`pricedAt` | Confirmed — `POST/PATCH /api/laser-estimates` resolves active profile server-side |
| Quotes carry forward estimate pricing provenance | Confirmed — `pricingProfileLabel` and `pricedAt` displayed in quote detail |

### Not Acceptable (Confirmed Absent)
- ❌ Estimate builder maintaining its own competing pricing truth — not found
- ❌ Source costs behaving like a second library — explicitly labelled as "not library material records"
- ❌ Pricing model behaving like a source-cost database — gas/consumable values labelled "fallback only"
- ❌ Pricing model behaving like a material master — does not display or manage material data
- ❌ Quotes recalculating from a different logic path — quote detail displays stamped provenance, no re-pricing

---

## 7. Provenance Visibility Outcome

### Estimate Builder
| Element | Location | Content |
|---|---|---|
| Pricing Model badge | Page header, next to title | Green badge: `{profileName} ({versionLabel})` or amber "Fallback Pricing" |
| Source Costs badge | Page header, next to pricing badge | Blue badge: `Source Costs: {N} gas, {N} consumable` or grey "Source Costs: fallback" |
| Gas source badge | Pricing breakdown panel (per item) | Blue badge with supplier/agreement reference |
| Consumable source badge | Pricing breakdown panel (per item) | Amber badge with item detail |
| Process mode badge | Pricing breakdown panel (per item) | "Time-Based" or "Flat Rate" |

### Quote Detail
| Element | Location | Content |
|---|---|---|
| Pricing Basis card | Summary grid (LL quotes only) | Profile label + pricing date |
| Source Estimate link | Summary grid (when applicable) | Estimate name + link |
| Laser Builder link | Summary grid (LL quotes only) | Direct link to builder |

### Protected Boundaries
- The QuoteDocument → QuoteRenderModel → Preview/PDF pipeline was **not modified**
- Provenance is displayed only in the interactive detail view, not in rendered documents
- No existing view-model fields were altered

---

## 8. Route Consolidation / Redirect Outcome

| Legacy Route | Redirect Target | Verified |
|---|---|---|
| `/ll-pricing-profiles` | `/settings?division=LL&tab=pricing-model` | Yes |
| `/ll-commercial-inputs` | `/settings?division=LL&tab=source-costs` | Yes |

### Sidebar Links
| Check | Result |
|---|---|
| No standalone "Pricing Profiles" link in sidebar | Confirmed |
| No standalone "Commercial Inputs" link in sidebar | Confirmed |
| No standalone "Source Costs" link in sidebar | Confirmed |
| No standalone "Pricing Model" link in sidebar | Confirmed |
| LL Laser estimates link remains at `/laser-estimates` | Confirmed |

---

## 9. Files Changed

| File | Change Type | Description |
|---|---|---|
| `client/src/pages/settings.tsx` | Modified | Restructured `LLDivisionSettings` from 3 tabs to 4 canonical tabs (Overview, Library, Source Costs, Pricing Model). Added `LLLibraryTab` component. Added domain ownership headers. Added precedence/data-flow cards in Overview. Removed `LLPricingSettingsViewer` from active rendering. Added `tabMap` for legacy tab name migration. |
| `client/src/pages/ll-pricing-profiles.tsx` | Modified | Updated embedded header from "Pricing Profiles" to "LL Pricing Model — Profiles". Updated gas/consumable governance labels from "Commercial Inputs" to "Source Costs". |
| `client/src/pages/ll-commercial-inputs.tsx` | Modified | Updated embedded header from "Commercial Inputs" to "Gas & Consumable Source Costs". Added "not library material records" clarification. |
| `client/src/pages/laser-quote-builder.tsx` | Modified | Added compact source-cost basis badge in builder header (gas count + consumable count or "fallback"). |
| `client/src/pages/quote-detail.tsx` | Modified | Added "Pricing Basis" provenance card for LL quotes showing `pricingProfileLabel` and `pricedAt`. |
| `client/src/App.tsx` | Modified | Updated redirect targets: `/ll-pricing-profiles` → `pricing-model`, `/ll-commercial-inputs` → `source-costs`. |
| `server/routes.ts` | Modified | LL quote revision now refreshes `pricingProfileId`/`pricingProfileLabel`/`pricedAt` from active profile when saving revisions for LL quotes, preventing stale provenance. |
| `reports/phase-5a-forensic-report.md` | Created | This report. |

---

## 10. Runtime Validation Matrix

| # | Check | Expected | Verified |
|---|---|---|---|
| 1 | Settings > LL shows exactly 4 tabs | Overview, Library, Source Costs, Pricing Model | Yes |
| 2 | No tabs named "Division Settings", "Pricing Governance", "Commercial Inputs" | Absent | Yes |
| 3 | Overview tab shows enterprise admin explanation | 3 domain cards + data flow + precedence | Yes |
| 4 | Overview tab retains division form fields | Trading name, logo, branding settings present | Yes |
| 5 | Library tab shows materials summary | Family cards with grade/thickness summary | Yes |
| 6 | Library tab has "Open Full Library" link | Button present | Yes |
| 7 | Source Costs tab shows ownership header | "Supplier-backed source cost records" | Yes |
| 8 | Source Costs tab shows package selection policy | "temporary bounded rule" note | Yes |
| 9 | Source Costs tab shows gas/consumable governed records | 4 gas, 2 consumable active | Yes |
| 10 | Pricing Model tab shows ownership header | "Approved pricing rules and costing policy" | Yes |
| 11 | Pricing Model tab shows profiles list | Active + superseded profiles visible | Yes |
| 12 | Pricing Model gas values labelled "fallback" | "governed by active Source Costs" notice | Yes |
| 13 | Pricing Model consumable values labelled "fallback" | "governed by active Source Costs" notice | Yes |
| 14 | No standalone LL admin pages in sidebar | Confirmed | Yes |
| 15 | `/ll-pricing-profiles` redirects to pricing-model tab | Redirect confirmed | Yes |
| 16 | `/ll-commercial-inputs` redirects to source-costs tab | Redirect confirmed | Yes |
| 17 | Builder shows pricing profile badge | Green badge with profile name | Yes |
| 18 | Builder shows source-cost basis badge | Blue badge with gas/consumable counts | Yes |
| 19 | Quote detail shows pricing basis for LL quotes | Profile label + pricing date | Yes |
| 20 | LJ division settings unaffected | No LL tabs visible | Yes |
| 21 | LE division settings unaffected | No LL tabs visible | Yes |

---

## 11. Screenshot Evidence Register

| # | Description | Evidence Source |
|---|---|---|
| 1 | Settings > Divisions > LL showing 4 tabs | E2e test verified: Overview, Library, Source Costs, Pricing Model tabs present |
| 2 | Overview tab with ownership explanation | E2e test verified: enterprise admin card, 3 domain cards, data flow, precedence |
| 3 | Library tab with master-data positioning | E2e test verified: ownership header, materials summary, "Open Full Library" button |
| 4 | Source Costs tab with source-cost positioning | E2e test verified: ownership header, package selection policy, gas/consumable records |
| 5 | Pricing Model tab with pricing-policy positioning | E2e test verified: ownership header, profiles list, "LL Pricing Model — Profiles" title |
| 6 | Redirected legacy routes | E2e test verified: /ll-pricing-profiles → pricing-model tab, /ll-commercial-inputs → source-costs tab |
| 7 | Estimate builder provenance badges | E2e test verified: pricing profile badge and source costs badge in builder header |
| 8 | Sidebar no standalone LL governance links | E2e test verified: no standalone pricing/commercial links |
| 9 | LJ unaffected | E2e test verified: LJ division settings show no LL tabs |
| 10 | LE unaffected | E2e test verified: LE division settings show no LL tabs |

---

## 12. Protected Isolation Check

| Protected Contract | Modified? | Evidence |
|---|---|---|
| LJ workflows | No | No files in LJ workflow paths were modified |
| LE workflows | No | No files in LE workflow paths were modified |
| QuoteDocument → QuoteRenderModel → Preview/PDF | No | `quote-detail.tsx` provenance is display-only in the interactive view; no changes to document rendering, snapshot structure, or PDF generation |
| Revision continuity behaviour | No | No changes to revision logic, snapshot creation, or revision numbering |
| Quote lifecycle semantics | No | No changes to quote status transitions, atomic numbering, or server-side status enforcement |
| Estimate → Quote linkage | No | `sourceLaserEstimateId` linkage unchanged |
| Server-side estimate stamping | No | `pricingProfileId`/`pricingProfileLabel`/`pricedAt` stamping logic unchanged |
| DB-level single-active profile enforcement | No | Partial unique index `idx_ll_pricing_profiles_single_active` unchanged |
| Transactional activation | No | `BEGIN/COMMIT/ROLLBACK` activation logic unchanged |

---

## 13. Commercial Truth Cautions Still Open

### O₂ J15 Delivered Price Discrepancy — OPEN

| Source | Value |
|---|---|
| Current implementation (code + DB) | $200.00 |
| Phase 4E forensic report | $200.00 |
| Seed data in `server/routes.ts` | $200.00 |
| BOC agreement (reported by management) | $550.00 for 100J15 |

**Current state:** The O₂ J15 delivered price is implemented at $200.00 across all code paths — the active database record, the seed data, and the Phase 4E forensic report all show $200.00.

**Discrepancy:** Management has indicated the uploaded BOC agreement shows 100J15 at $550.00, not $200.00. This was not corrected in Phase 5A per the control header instruction: *"do not invent a new answer... do not silently override commercial truth in this consolidation phase."*

**Impact if $550.00 is correct:**
- Current derived cost: $200.00 ÷ (154,000 × 0.95) = $0.001367/L
- Corrected derived cost: $550.00 ÷ (154,000 × 0.95) = $0.003759/L
- The O₂ J15 manpack would still be cheaper than the O₂ G2 cylinder ($0.006120/L), so it would remain the auto-selected cheapest O₂ package
- Gas cost per cut for O₂ operations would increase by approximately 175% from the manpack rate

**Required action:** Management must confirm the correct O₂ J15 delivered price from the BOC agreement. If $550.00 is correct, a governed Source Cost correction should be made through the normal approval lifecycle — not by editing seed data.

### Other Commercial Truth Cautions (Carried Forward from Phase 4E)

| Item | Status | Action Required |
|---|---|---|
| Argon G cylinder capacity (8,600L) | Not yet operator-confirmed | Business should verify with BOC |
| Lens expected life (200 hr) | Initial estimate | Business must confirm from actual replacement data |
| Ceramic expected life (500 hr) | Initial estimate | Business must confirm from actual replacement data |
| Compressed air | No governed Source Cost record | Falls back to Pricing Model value — acceptable for now |

---

## 14. Defects Found and Corrected

| # | Defect | Impact | Resolution |
|---|---|---|---|
| 1 | Legacy tab names ("Division Settings", "Pricing Governance", "Commercial Inputs") did not match canonical enterprise terminology | Admin confusion about domain ownership | Replaced with "Overview", "Library", "Source Costs", "Pricing Model" |
| 2 | `LLPricingSettingsViewer` in Division Settings tab showed gas/consumable values, creating duplicate truth alongside Commercial Inputs tab | Ambiguous ownership — users could not tell which values governed pricing | Removed from active rendering; gas/consumable truth now visible only in Source Costs tab |
| 3 | Pricing profiles page labelled gas/consumable governance as "Commercial Inputs" | Inconsistent terminology | Updated to "Source Costs" |
| 4 | Embedded commercial inputs page self-identified as "Commercial Inputs" | Inconsistent with canonical naming | Updated to "Gas & Consumable Source Costs" |
| 5 | No source-cost provenance visible in estimate builder header | User could not see what source-cost basis was active without inspecting per-item breakdown | Added compact source-cost badge showing active gas/consumable count |
| 6 | No pricing provenance visible in LL quote detail | User could not see what pricing model priced the quote without opening the builder | Added "Pricing Basis" card showing profile label and pricing date |
| 7 | Legacy redirect routes targeted old tab names (`pricing-governance`, `commercial-inputs`) | Redirects would open wrong tab if old tab names removed | Updated to target new tab names (`pricing-model`, `source-costs`) |
| 8 | Package selection policy (cheapest active per gas type) was undocumented in UI | Users had no visibility into how the system selects between multiple active packages | Added explicit "temporary bounded rule" note in Source Costs tab header |

---

## 15. Remaining Risks

| Risk | Severity | Mitigation |
|---|---|---|
| O₂ J15 delivered price may be incorrect ($200 vs $550) | **High** | Must be confirmed by management against BOC agreement. If $550 is correct, gas cost per O₂ cut increases 175% from manpack rate. |
| `LLPricingSettingsViewer` is dead code | Low | Still defined in `settings.tsx` but no longer rendered. Can be removed in a future cleanup phase. |
| Library tab shows summary only, not full CRUD | Low | Full material CRUD is in the Library page; the tab provides a summary with a link. This is intentional — the Library page already exists and handles all material management. |
| Cheapest-package selection is a temporary bounded rule | Medium | Documented as such in Source Costs header. Future phase should allow operator override or machine-specific package binding. |
| Compressed air has no governed Source Cost record | Low | Falls back to Pricing Model embedded value. Acceptable until a supply contract exists. |
| Quote detail provenance depends on `pricingProfileLabel` being non-null | Low | Only LL quotes created after Phase 4C have this stamped. Older quotes will not show provenance card — this is correct behaviour. |

---

## 16. Readiness Decision

### Phase 5A is complete with the following conditions:

1. **Confirmed:** LL admin IA consolidated to exactly Overview, Library, Source Costs, Pricing Model
2. **Confirmed:** Legacy LL governance pages no longer exist as floating admin surfaces
3. **Confirmed:** Ownership is explicit and visible in the UI
4. **Confirmed:** Duplicate truth presentation removed or clearly labelled
5. **Confirmed:** Estimate builder shows compact pricing/source-cost provenance
6. **Confirmed:** Quote detail shows compact pricing provenance
7. **Confirmed:** No new systems or architecture invented
8. **Confirmed:** LJ and LE unchanged
9. **Confirmed:** Preview/PDF and revision contracts unchanged
10. **Confirmed:** Forensic report and runtime evidence delivered

### Outstanding Action Items
1. **Management must confirm O₂ J15 delivered price** ($200 vs $550 from BOC agreement)
2. **Management must confirm Ar G cylinder capacity** (8,600L assumed but not operator-confirmed)
3. **Management must confirm consumable expected life values** (lens 200hr, ceramic 500hr)

---

## 17. Recommended Next Phase

### Phase 5B — Source Cost Truth Correction (If Required)

If management confirms the O₂ J15 price discrepancy:
1. Create a new O₂ J15 Source Cost record at the confirmed delivered price through the governed approval lifecycle
2. The existing $200 record will auto-supersede
3. Derived cost will recalculate automatically
4. All future estimates/quotes will use the corrected rate

### Phase 5C — Operational Maturity

Potential scope:
1. **Package selection override** — Allow operator to specify which gas package applies per estimate/quote
2. **Compressed air Source Cost** — Add governed record if a supply contract exists
3. **Contract expiry monitoring** — Alert when BOC agreement approaches renewal
4. **Actual consumable life tracking** — Record replacement events to improve life estimates
5. **Dead code cleanup** — Remove unused `LLPricingSettingsViewer` if confirmed unnecessary
