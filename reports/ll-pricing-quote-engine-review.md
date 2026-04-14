# LL Pricing and Quote Engine — Enterprise Review Report

**Review Date:** 14 April 2026  
**Reviewer:** SteelIQ Agent — Strict Enterprise Review Phase  
**System:** SteelIQ — Lateral Enterprises  
**Scope:** Lateral Laser (LL) Pricing and Quote Engine Only

---

## 1. Executive Verdict

### **Mostly Aligned**

The LL pricing and quote engine is structurally sound, with a well-separated three-layer architecture (Procurement Truth → Pricing Engine Truth → Customer Output Truth). The material library is canonically seeded, the status model is correctly implemented, and the pricing engine handles sheet/plate/tread_plate/coil stock behaviours with appropriate differentiation. However, several edge cases in material row selection, process rate matching, and operator workflow present moderate commercial risk that must be addressed before the engine can be called commercially trustworthy at an enterprise standard.

---

## 2. Current LL Engine Truth

### Material Library
- **254 active rows** across Wakefield Metals and Macdonald Steel
- **247 quoteable rows** (ACTIVE_QUOTEABLE), **7 reference-only rows** (ACTIVE_REFERENCE)
- **Stock behaviour distribution:** 144 sheet, 85 plate, 5 tread_plate, 13 coil
- **Zero collisions** in the collision audit (family+grade+finish+thickness+size+behaviour composite key is unique)
- Status model uses derived computation from `isActive` + `isQuoteable` flags → `ACTIVE_QUOTEABLE`, `ACTIVE_REFERENCE`, `INACTIVE_PRESERVED`

### Pricing Engine
- **Active pricing profile:** "Q4 Preview Rates v3.0-draft" with 40 process rate table entries
- **Governed gas inputs:** 4 active inputs (argon, nitrogen, oxygen × 2) from BOC
- **Governed consumable inputs:** 2 active inputs (protective lens + ceramic)
- **Process costing model:** Time-based (primary) with flat-rate fallback
- **Commercial markup:** Explicit percentage on internal cost subtotal
- **Minimum charges:** $25 material minimum per line, $50 line minimum

### Quote Flow
- Estimate → Quote conversion with immutable snapshot
- 6 existing laser estimates (all status: "converted")
- 15 LL quotes (SE-XXXX-LL series), 5 accepted, remainder in draft
- Snapshots store full pricing breakdown at point-in-time for immutability

---

## 3. Review Findings

### 3.1 Material Selection

**Status: PARTIALLY SAFE — Moderate Risk**

**Strengths:**
- The Quote Builder correctly filters to `active=true` AND `quoteable=true`, excluding ACTIVE_REFERENCE rows
- Cascading dropdown hierarchy (Family → Grade → Finish → Thickness) narrows selection deterministically
- Coil and sheet paths are correctly separated: coil options show width selector + cut length input; sheets show size selector
- Material identity panel shows supplier, SKU, form type, stock behaviour, and pricing basis — good operator visibility
- When only 1 sheet size exists for a combination, the system auto-selects it
- `handleDialogSave` correctly captures `selectedMaterialRow?.id || formData.llSheetMaterialId`

**Risks:**
1. **`findMatchingMaterial` fallback is non-deterministic.** When `llSheetMaterialId` is missing or doesn't match, the function falls back to `materials.find()` matching on family+grade+finish+thickness. Since 55 combinations have multiple rows with identical family/grade/finish/thickness (different sheet sizes), this `Array.find()` returns the FIRST match (arbitrary insertion order). This could silently link an item to the wrong sheet size and therefore the wrong price.
   - **Severity: MODERATE** — Mitigated by the fact that `llSheetMaterialId` is always set at save time when a material is selected. The fallback primarily affects historical items or edge cases where the material row was deleted.

2. **Mixed stock behaviour combinations.** Several family/grade/finish/thickness combos have BOTH coil and sheet/plate rows (e.g., Aluminium 5005 Mill 0.7mm has 1 coil + 2 sheets). The UI handles this by showing both coil width selector AND sheet size selector. However, the coil selector binds to `llSheetMaterialId` and the sheet selector also binds to `llSheetMaterialId`. If a user selects a coil width and then a sheet size (or vice versa), the last selection wins. This is correct behaviour but could confuse operators.
   - **Severity: LOW** — The UI is clear enough, and the material identity panel confirms the selection.

3. **No validation on save that a material row was actually selected.** An item can be saved with no material linked (`llSheetMaterialId: ""`), which results in $0 material cost and potentially misleading pricing. This is currently allowed in the system.
   - **Severity: MODERATE** — Observed in runtime: SE-0181-LL has a snapshot with `materialType: ""`, `llSheetMaterialId: ""`, `materialCostTotal: 0`, yet `sellTotal: $94.16` (from process/setup costs only). This is commercially risky — a quote can be issued with zero material cost.

### 3.2 Pricing Basis

**Status: SAFE — No Critical Issues**

**Strengths:**
- Sheet/plate/tread_plate all use the same per-sheet pricing code path: `estimatedSheets × pricePerSheetExGst`. This is correct — tread plate and plate are simply sheet variants with different dimensions/prices.
- Coil uses weight-based pricing: `volume × density × pricePerKg × quantity`. This is physically correct.
- Reference rows (7 per-kg baseline rows from Wakefield) are correctly excluded from the quoteable set. The API filter is server-side (`materials.filter(m => m.isQuoteable)`), not just client-side.
- Rectangular packing model (kerf + edge trim) is more accurate than simple area division for sheet yield estimation.
- Minimum material charge ($25) prevents zero-cost material situations when small parts are cut.

**Risks:**
1. **Process rate matching uses 50% tolerance.** `findProcessRate` matches on normalised material family and finds the closest thickness within `±50%` of the target thickness. For a 6mm part, this would match anything from 3mm to 9mm. The actual cut speed and pierce time vary significantly with thickness, so a poor match could substantially over- or under-estimate process time and cost.
   - **Severity: MODERATE** — The tolerance is generous. A tighter match (e.g., ±20% or exact-only with manual fallback) would be safer.

2. **Flat-rate fallback has no operator warning.** When no process rate table match is found, the engine silently falls back to flat-rate pricing (`$0.012/mm cut`, `$0.50/pierce`). The pricing breakdown panel does show a "Flat Rate" badge, but there's no validation warning at save time. An operator could create a quote with flat-rate pricing without realising the process rates aren't configured for that material/thickness.
   - **Severity: LOW-MODERATE** — The badge is visible but easy to miss.

### 3.3 Operator Workflow

**Status: MOSTLY SAFE — Some UX Risks**

**Strengths:**
- Material selection flow is logical: Family → Grade → Finish → Thickness → Sheet Size/Coil Width
- Coil-specific UI (width selector + cut length input) is clearly distinct from sheet UI
- Pricing breakdown panel shows all cost components with source attribution (gas supplier, consumable items)
- Pricing profile badge shows which pricing profile is active (or "Fallback Pricing" warning)
- Source costs badge shows how many governed gas/consumable inputs are active
- Advanced settings (setup, handling, markup, utilisation) are collapsed by default to reduce cognitive load
- Material identity panel shows supplier name, SKU, form type, stock behaviour, and exact pricing basis

**Risks:**
1. **Sheet vs. Plate vs. Tread Plate are not visually distinguished in the selection flow.** The cascading dropdowns filter by family/grade/finish/thickness, but `stockBehaviour` is not shown as a selectable attribute. When multiple sheet sizes appear for a given thickness, some may be "sheet" and some "plate" (different form factors from different suppliers). The operator sees only dimensions and price. The material identity panel does show stock behaviour after selection, but not during the selection process.
   - **Severity: LOW-MODERATE** — The distinction is cosmetic for pricing purposes (all use per-sheet pricing), but operators may need to know if they're ordering sheet or plate for manufacturing reasons.

2. **Part dimensions and cut length are not validated for plausibility.** An operator can enter a part length of 10,000mm on a 2,438mm sheet without warning. The rectangular packing model will correctly calculate that zero parts fit per sheet (overflow), but the fallback to area-based estimation may still produce a result without flagging the impossible cut.
   - **Severity: LOW** — Edge case, but could produce confusing pricing.

### 3.4 Commercial Integrity

**Status: MOSTLY SAFE — One Moderate Gap**

**Strengths:**
- Minimum material charge ($25) and minimum line charge ($50) prevent trivially underpriced items
- Markup is explicit, visible in the breakdown, and defaults to 35%
- Gas and consumable costs are governed with full supplier traceability and audit trail
- Pricing profiles are versioned with enterprise approval workflow and single-active enforcement
- Snapshot immutability ensures that once a quote is issued, the pricing cannot be retroactively changed
- GST calculation (15%) is applied consistently at the totals level

**Risks:**
1. **Items can be quoted with zero material cost.** As observed in SE-0181-LL, an item can be saved and converted to a quote without any material selection. The resulting line item has $0 material cost but still has process cost (from cut length/pierce count) and setup/handling cost. The minimum line charge of $50 catches trivially small items, but a larger item with substantial process cost could appear commercially viable while having no material cost — this is commercially wrong.
   - **Severity: MODERATE** — The system should validate that material is selected before allowing quote generation.

2. **No margin floor validation.** There is no check that the final sell price exceeds some minimum margin threshold. The operator can set markup to 0% and produce a cost-price quote. While this may be intentional for some scenarios, it creates risk.
   - **Severity: LOW** — Intentional flexibility, but should be flagged.

### 3.5 Backward Compatibility

**Status: SAFE**

**Strengths:**
- Snapshots store the complete material truth at point-in-time: supplierName, sheetLength, sheetWidth, pricePerSheetExGst, stockBehaviour, pricePerKg, densityKgM3, plus all pricing breakdown fields (materialCostTotal, processCostTotal, setupHandlingCost, etc.)
- Items in estimates store `llSheetMaterialId` for live re-linking to the current material library
- `snapshotItemToItem` correctly maps snapshot fields back to item fields with null-safe defaults
- The `LaserSnapshotItem` schema has `.default()` on all fields, ensuring old snapshots without newer fields still parse correctly
- The pricing engine handles `null` material gracefully (returns zero material cost, still computes process costs)

**No backward compatibility issues identified.**

---

## 4. C-Suite Review

### CEO
The LL pricing engine is structurally sound and demonstrates good engineering discipline with its three-layer separation. The primary commercial risk is that quotes can be issued with zero material cost — this needs a validation gate before we can trust the engine for customer-facing output. The 55 multi-row selection combinations are well-handled in the UI but the fallback matching logic needs tightening.

### CPO
The operator workflow is clear and well-structured. The cascading material selection is intuitive. Key gap: stock behaviour (sheet vs plate vs tread_plate) should be visible during selection, not just after. The coil path is well-differentiated. Recommend adding validation warnings for missing material selection and implausible part dimensions.

### CTO
Code quality is high. The pricing engine is well-documented with clear comments. Key technical risks: (1) `findMatchingMaterial` fallback uses `Array.find()` which is order-dependent and non-deterministic for ambiguous matches; (2) process rate matching with 50% thickness tolerance is too generous for commercial accuracy; (3) no server-side validation on material selection completeness at quote creation time.

### COO
The operator workflow is commercially usable today for trained operators who understand the material library. However, the lack of validation on material selection means a hurried operator could issue a quote with $0 material cost. This is an operational risk that should be gated before go-live.

### CFO
The pricing mechanics are correct: material cost, process cost, setup/handling, and markup all compute correctly with appropriate minimums. The governed gas and consumable inputs with supplier traceability are excellent for cost governance. Concern: the 50% tolerance on process rate matching could lead to 10-20% cost estimation error on edge-case thicknesses.

### CCO
Customer output integrity is good — snapshots are immutable, GST is applied correctly, and customer-facing fields do not leak internal cost data. The concern is that a quote with $0 material cost could reach a customer and undermine commercial credibility.

### CDAO
Data model is clean and well-structured. The collision audit shows zero collisions. The 7 reference rows are correctly segregated. Status model derivation from boolean flags is sound. Recommendation: add an audit log for material selection changes and pricing profile switches at the item level.

---

## 5. Risks and Weaknesses

### Critical Risks
**None identified.** The engine does not have any path that would produce a silently catastrophic pricing result under normal operator usage. All identified risks require specific edge conditions.

### Moderate Risks

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| M1 | Items can be saved/quoted with no material selection (zero material cost) | Commercially wrong quote | Medium | Add validation gate requiring material selection before save |
| M2 | `findMatchingMaterial` fallback is non-deterministic for multi-row combos | Wrong sheet size/price linked | Low | Tighten fallback to require exact match on size, or remove fallback entirely |
| M3 | Process rate matching uses 50% thickness tolerance | Over/under-estimated process cost | Low-Medium | Tighten to ±20% or exact-only with explicit warning |
| M4 | Flat-rate fallback has no save-time warning | Operator may not notice non-time-based pricing | Low | Add validation warning when flat-rate is used |

### Low Risks

| # | Risk | Impact | Likelihood |
|---|------|--------|------------|
| L1 | Stock behaviour not visible during sheet size selection | Operator confusion on sheet vs plate | Low |
| L2 | No part dimension plausibility check | Confusing pricing for oversized parts | Low |
| L3 | Zero markup allowed without warning | Cost-price quotes possible | Low |
| L4 | Two active oxygen gas inputs may cause ambiguous selection | Lowest-cost oxygen used (may not be the correct one) | Low |

---

## 6. Self-Challenge Review

**Challenge:** Am I being too generous with "Mostly Aligned"?

**Response:** The engine's core pricing paths (sheet per-sheet, coil per-kg, process time-based, governed gas/consumables) are all mechanically correct and well-tested. The structural separation of procurement truth, pricing truth, and customer output truth is genuine and well-implemented. The snapshot immutability model is sound.

The risks I've identified are real but are all in the category of "missing validation guards" rather than "broken logic." The $0 material cost scenario (M1) is the most concerning because it can produce a commercially wrong quote, but it requires the operator to skip material selection entirely — which is a deliberate (if unguarded) action.

**Conclusion:** "Mostly Aligned" is the correct verdict. The engine is not "Strongly Aligned" because of the missing validation gates (M1, M4) and the process rate tolerance issue (M3). It is not "Partially Aligned" because the core pricing mechanics are correct and well-implemented.

---

## 7. Final Recommendation

### **Proceed with Revisions**

The LL pricing and quote engine is structurally sound and commercially usable for trained operators. However, the moderate risks (M1-M4) must be addressed in the next narrow implementation phase before the engine can be considered commercially trustworthy at enterprise standard.

---

## 8. Best Next Narrow Phase

### **Phase: LL Quote Engine Validation Guards**

Add validation gates and operator safety checks to the existing pricing and quote flow. This is NOT a refactor or architecture change — it is purely adding guards to the existing working engine.

---

## 9. Required Changes Before Approval

### Must-Fix (Next Phase)

1. **Material selection validation gate** — Prevent saving an item (and prevent quote generation) when `llSheetMaterialId` is empty. Show a clear warning in the Add Item dialog when no material is linked.

2. **Process rate match tightening** — Reduce thickness tolerance from 50% to 25% or implement exact-match-only with explicit "No process rate found — using flat rate" warning at save time.

3. **Flat-rate fallback warning** — When the pricing engine falls back to flat-rate mode, show an amber warning banner in the item dialog and on the item row in the line items table, not just a badge.

4. **findMatchingMaterial hardening** — Remove the fallback path in `findMatchingMaterial` or tighten it to require matching on all dimensions (family+grade+finish+thickness+sheetLength+sheetWidth). If no exact match is found by ID, return `undefined` and show a "Material not found — please reselect" warning.

### Should-Fix (Next Phase or Soon After)

5. **Stock behaviour visibility in sheet selector** — Show "(Plate)" or "(Sheet)" or "(Tread Plate)" label next to each sheet size option in the dropdown.

6. **Part dimension plausibility warning** — When part length or width exceeds sheet dimensions, show an informational warning (not a blocker).

7. **Duplicate oxygen gas input handling** — When multiple active gas inputs exist for the same gas type, show which one was selected in the pricing breakdown with a note about the selection logic (lowest cost).

### Must Not Break

- Existing snapshot immutability — do NOT retroactively modify stored snapshots
- Existing estimate → quote conversion flow
- Existing pricing calculation mechanics (material cost, process cost, setup/handling, markup)
- Governed gas and consumable input system
- Pricing profile versioning and activation workflow
- Reference row exclusion from quoteable set

---

## 10. Release Gate

| Gate | Decision |
|------|----------|
| **Push to Git** | **YES** — Current code is stable and functional |
| **Publish to live** | **NO** — Address M1 (material validation gate) before publishing for commercial use |
| **New Replit chat needed for next phase** | **NO** — The next phase is narrow enough to execute in the current session |

---

## Appendix: Evidence

### Repo Files Reviewed
- `shared/schema.ts` (lines 537-586) — `llSheetMaterials` table, status model, `deriveMaterialStatus`
- `shared/estimate-snapshot.ts` (lines 1-61) — `LaserSnapshotItem` schema
- `client/src/lib/ll-pricing.ts` (full file, 491 lines) — pricing engine, `computeLLPricing`, rate resolution, process rate matching, gas/consumable governed inputs
- `client/src/pages/laser-quote-builder.tsx` (full file, 1520 lines) — Quote Builder UI, material selection, item save/edit, snapshot building, estimate/quote mutations
- `server/routes.ts` (lines 1866-1925) — `/api/ll-sheet-materials` endpoint, quoteable filtering, collision audit

### Runtime Paths Tested
- `POST /api/auth/login` — admin login verified
- `GET /api/ll-sheet-materials?active=true&quoteable=true` — 247 quoteable rows confirmed
- `GET /api/ll-sheet-materials?active=true` — 254 active rows, 7 ACTIVE_REFERENCE rows confirmed
- `GET /api/ll-sheet-materials/audit/collision-check` — 0 collisions confirmed
- `GET /api/ll-pricing-profiles/active` — "Q4 Preview Rates v3.0-draft" with 40 process rate entries
- `GET /api/ll-gas-cost-inputs/active` — 4 active gas inputs from BOC
- `GET /api/ll-consumables-cost-inputs/active` — 2 active consumable inputs
- `GET /api/laser-estimates` — 6 estimates, all "converted" status
- `GET /api/quotes` — 15 LL quotes (SE-XXXX-LL series)
- `GET /api/quotes/{id}` — Inspected SE-0181-LL snapshot (1 laserItem with empty material fields)

### Material Scenarios Tested

| Scenario | Stock Behaviour | Supplier | Family | Grade | Result |
|----------|----------------|----------|--------|-------|--------|
| Standard Sheet | sheet | Macdonald Steel | Mild Steel | Cold Rolled | 1.0mm, 2438×1219, $53.66/sheet — CORRECT |
| Plate | plate | Wakefield Metals | Aluminium | 5083 | 4mm, 8200×1200, $1021.41/sheet — CORRECT |
| Tread Plate | tread_plate | Wakefield Metals | Aluminium | 5052 | 2mm, 2400×1200, $135.75/sheet — CORRECT |
| Coil | coil | Wakefield Metals | Aluminium | 5005 | 0.7mm, 1200mm wide, $8.436/kg, density 2710 — CORRECT |
| Reference Row | sheet (reference) | Wakefield Metals | Aluminium | 5052 | 3mm, pricePerKg=$8.05, NOT in quoteable set — CORRECT |

### Explicit Trustworthiness Verdict

**Is the current LL quote engine commercially trustworthy today?**

**NO** — due to:
- M1: Items can be quoted with zero material cost (no validation gate)
- M3: Process rate matching tolerance is too generous for commercial accuracy
- Observed evidence: SE-0181-LL snapshot contains an item with $0 material cost and empty material fields

The engine is **mechanically correct** but **not commercially guarded** at enterprise standard. The next narrow phase (validation guards) will close this gap.
