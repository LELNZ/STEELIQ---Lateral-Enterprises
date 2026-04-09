# Phase 5B Forensic Report — LL Source Cost Truth Hardening + Operational Admin UX

**Date:** 2026-04-05
**Phase:** 5B
**Status:** Complete (T001–T012)

---

## Summary

Phase 5B hardened the LL division's source-cost truth, clarified admin tab purposes, improved UX layout/width, made operational flows obvious, verified compressed air support, and maintained governance and auditability throughout.

---

## Changes by Task

### T001: Full-width LL division admin UX
- **File:** settings.tsx
- **Change:** LL division settings use `max-w-6xl` (was `max-w-3xl`). Other divisions retain `max-w-3xl`.
- **Rationale:** LL admin content (tables, cards, process rate tables) needs horizontal space to avoid cramped layouts.

### T002: LL Library tab → real LL-scoped table view
- **File:** settings.tsx
- **Change:** LLLibraryTab rewritten as a read-only table showing LL-scoped materials with family filter. Links to `/library?division=LL` for full CRUD.
- **Rationale:** Settings tab provides quick reference; full editing remains in the Library page.

### T003: Fix "Open Full Library" behavior
- **File:** settings.tsx
- **Change:** Button routes to `/library?division=LL` instead of bare `/library`.

### T004: Source Costs lifecycle clarity + history
- **Files:** settings.tsx, ll-commercial-inputs.tsx
- **Changes:**
  - Source Costs header expanded with 3 info cards: Record Lifecycle, Package Selection, Required Coverage
  - Status filter (active/draft/approved/superseded/archived) with live counts added to gas and consumable list panels
  - Default filter: "active" — shows only active records; switch to "superseded" for audit history

### T005: Harden gas source-cost coverage
- **File:** ll-commercial-inputs.tsx
- **Changes:**
  - Label maps: `gasTypeLabels` (O₂, N₂, Ar, Compressed Air, CO₂), `packageTypeLabels` (Cylinder/Bottle, MCP, Bulk, Other), `sourceTypeLabels` (Supplier Agreement, Invoice, Manual/Provisional)
  - Gas list items show proper labels instead of raw codes
  - "Provisional" badge for `manual_adjustment` source type
  - GasInputDetail rewritten: 2-column card layout (Supplier & Source + Package Identity & Pricing), improved field labels with block-level headings, derived cost formula explanation

### T006: Compressed Air governed source-cost support
- **Files:** ll-commercial-inputs.tsx, ll-pricing.ts (verified, no changes needed)
- **Changes:**
  - `compressed_air` already present in gas type dropdown, process rate tables (Zincanneal ≤1.6mm)
  - Pricing engine normalises "compressed_air" via `normaliseGasName()` and resolves it in `getGasPricePerLitre()` with same governed → fallback precedence
  - Create Gas dialog shows contextual notice when compressed air is selected, guiding provisional entry
- **Verification:** Precedence confirmed at ll-pricing.ts:226-241 — governed gasInputs checked first, fallback to `compressedAirPricePerLitre` in profile

### T007: O₂ J15 governed correction readiness
- **File:** ll-commercial-inputs.tsx (verified: server/routes.ts activation SQL)
- **Changes:**
  - Red discrepancy banner shown when O₂ J15 is active at $200 delivered price
  - Banner explains: BOC agreement reportedly shows $550, management must confirm before correction through governed lifecycle
  - Activation SQL verified: `UPDATE ... SET status = 'superseded' WHERE gas_type = $2 AND package_code IS NOT DISTINCT FROM $3` correctly targets matching records
- **Discrepancy status:** OPEN — management decision required before any data correction

### T008: Source Costs forms UX improvement
- **File:** ll-commercial-inputs.tsx
- **Changes:**
  - CreateGasDialog rewritten with fieldsets: Gas Identity, Source & Traceability, Pricing & Capacity
  - Every field has help text explaining its purpose
  - Derived cost preview shows calculated value before submission
  - Source type distinction: supplier-backed vs manual/provisional with contextual placeholders and helper text
  - Compressed air + provisional combo shows dedicated notice about pending hardware installation

### T009: Pricing Model workflow clarity
- **Files:** settings.tsx, ll-pricing-profiles.tsx
- **Changes:**
  - Settings.tsx header expanded to 3 guidance cards: Workflow, Machines, Gas Control
  - ll-pricing-profiles.tsx shows inline workflow steps banner when embedded

### T010: Machine management clarity
- **File:** ll-pricing-profiles.tsx
- **Changes:**
  - Machine profiles: editable name field, active checkbox, 5-column layout (hourly rate, bed L/W, usable L/W)
  - "Add Machine Profile" button
  - Explanatory note about machine purpose

### T011: Material-to-gas relationship clarity
- **File:** ll-pricing-profiles.tsx
- **Changes:**
  - Process Rate Table: assist gas type displayed as Badge, sticky header, hover row highlight
  - Column header changed from "Gas" to "Assist Gas Type"
  - Explanatory note: "The gas type here determines which gas source cost is used during pricing"

### T012: Verify source-cost precedence
- **File:** ll-pricing.ts (verified, no changes needed)
- **Verification:**
  - `getGasPricePerLitre()` at line 219: checks governed `gasInputs` first (Source Costs)
  - Falls back to pricing profile `gasCosts` only if no governed match
  - `compressed_air` normalisation at line 213 confirmed
  - Fallback labels preserved for provenance badge visibility

---

## Open Items Carried Forward

| Item | Detail | Required Action |
|------|--------|----------------|
| O₂ J15 price discrepancy | Code/DB shows $200.00; BOC agreement reportedly shows $550.00 | Management must confirm correct value, then create corrected record through governed lifecycle |
| Ar G cylinder capacity | 8,600L unconfirmed by BOC | Business must verify against BOC specifications |
| Lens expected life | 200hr estimate | Business must confirm based on actual replacement frequency |
| Ceramic expected life | 500hr estimate | Business must confirm based on actual replacement frequency |

---

## Protected Boundaries (Unchanged)

- No nesting engine, DXF parser, or shop-floor MES built
- No creative license taken with pricing logic
- No silent data corrections — all changes through governed lifecycle
- Seed data and activation SQL remain auditable
- Source-cost precedence unchanged: governed Source Costs → pricing profile fallback

---

## Files Modified in Phase 5B

| File | Changes |
|------|---------|
| `client/src/pages/settings.tsx` | Full-width LL layout, Source Costs header (lifecycle/package/coverage cards), Pricing Model header (workflow/machine/gas cards), LLLibraryTab table view |
| `client/src/pages/ll-commercial-inputs.tsx` | Status filter, label maps, GasInputDetail rewrite, CreateGasDialog rewrite, O₂ J15 discrepancy notice, compressed air provisional guidance |
| `client/src/pages/ll-pricing-profiles.tsx` | Workflow steps banner, machine profiles (editable name, add button, active toggle, usable dimensions), process rate table improvements |
| `reports/phase-5b-forensic-report.md` | This report |
