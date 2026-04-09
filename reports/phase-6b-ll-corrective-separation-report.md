# Phase 6B — LL Corrective Separation Report

## Scope Boundary
This phase addresses 6 corrective UX/completeness items identified in the current LL and system-wide UI. No architectural changes, schema modifications, lifecycle redesign, or new automation were introduced.

---

## 1. EXECUTIVE SUMMARY

### Fixed Now
1. **Unit Cost column** added to LL estimate line item table — each row now clearly shows Unit Cost, Unit Sell, and Line Total
2. **Duplicate "Open Quote" button removed** from converted estimate banner — only the header button remains; banner shows informational text only
3. **Quotes page consistency** — verified already compliant with standardised worklist UX (PageShell, PageHeader, WorklistBody, bg-muted/50 headers, hover:bg-muted/30 rows, py-2.5 padding, demo badges). No changes needed.
4. **Customer handling honesty** — verified already operationally honest. Accepted quotes clearly show "Not linked" when no customer exists, with actionable CTAs. No false "customer created" toasts. No changes needed.
5. **Job action clarity** — removed duplicate "Change" button from Current Status section; consolidated all editing through the header "Edit" button. Renamed measurement section CTA from "Set Now" to "Set Measurement" for clarity.
6. **Governance activity readability** — improved Record column display with business-facing identifiers in monospaced font, human-readable names alongside IDs, and reduced reliance on truncated UUIDs

### Intentionally Deferred
- Full LJ-style lifecycle visibility across the LL chain
- Full workflow/lifecycle panel at all stages
- Automatic chain-propagated CRM/customer creation
- Larger lifecycle redesign or template unification

---

## 2. FILES CHANGED

| File | Purpose |
|------|---------|
| `client/src/pages/laser-quote-builder.tsx` | Added Unit Cost column header and data cell; removed duplicate Open Quote button from banner; updated colSpan for expanded breakdown |
| `client/src/pages/op-job-detail.tsx` | Removed duplicate "Change" status button; renamed "Set Now" to "Set Measurement" for measurement section CTA |
| `client/src/pages/settings.tsx` | Enhanced governance audit Record column with better identifier display and styling |

### Files Inspected But Not Changed (Already Compliant)
| File | Reason |
|------|--------|
| `client/src/pages/quotes-list.tsx` | Already uses standardised worklist UX pattern (PageShell, PageHeader, WorklistBody, correct table styling) |
| `client/src/pages/quote-detail.tsx` | Customer handling already operationally honest — shows "Not linked", provides CTAs, no false success states |

---

## 3. BEHAVIOUR CHANGES

### Before → After

**LL Estimate Line Items:**
- Before: Table showed #, Ref, Title, Qty, Material, Thickness, L×W, Unit Sell (with cost hint below), Line Total
- After: Table shows #, Ref, Title, Qty, Material, Thickness, L×W, **Unit Cost**, Unit Sell (with markup % below), Line Total

**Converted Estimate Banner:**
- Before: Green banner had informational text AND an "Open Quote" button (duplicate of header button)
- After: Green banner shows informational text only; single "Open Quote" button in header area

**Job Detail Actions:**
- Before: Header had "Edit" button; Status section had separate "Change" button (both called startEdit); Measurement section had "Set Now" button
- After: Header has single "Edit" button; Status section has no separate button; Measurement section shows "Set Measurement" (when incomplete) or "Edit" (when complete)

**Governance Activity Records:**
- Before: Record column showed first available identifier or truncated UUID in plain text
- After: Business IDs (estimate numbers, quote numbers, job numbers) shown in monospaced bold font; human names alongside IDs when both available; only falls back to truncated UUID when no identifier exists

---

## 4. TEST EVIDENCE

### LL Corrective Tests

| # | Test | Result |
|---|------|--------|
| 1 | Open existing LL estimate — verify Unit Cost column visible | PASS |
| 2 | Converted LL estimate — verify only one Open Quote action | PASS |
| 3 | Quotes page — verify unified worklist styling | PASS (already compliant) |
| 4 | Accepted quote — verify customer state truthfulness | PASS (already honest) |
| 5 | Job detail — verify no overlapping action buttons | PASS |
| 6 | Governance — verify readable record identifiers | PASS |

### Regression Checks

| # | Test | Result |
|---|------|--------|
| 7 | Demo flag badges still render on estimates/quotes | PASS |
| 8 | LL estimate → quote → project → job workflow | NOT BLOCKED (existing flow preserved) |

### E2E Test
Automated Playwright-based e2e test executed covering all 6 fixes: **PASS**

---

## 5. DEFERRED / NEXT LIFECYCLE PHASE

The following items were explicitly NOT implemented in this phase:

### A) Full LJ-style Lifecycle Visibility Across LL Chain
- End-to-end lifecycle surfaces from estimate → quote → acceptance → commercial setup → project → job → invoice → completion/closeout
- This requires dedicated phase with proper design and implementation scope

### B) Full Workflow/Lifecycle Panel at All Stages
- Lifecycle panel in estimation, quote, project, job, invoice, and completion stages
- Stage locking/unlock rules across full chain
- Cross-stage progress visualisation

### C) Automatic CRM/Customer Creation
- No automatic customer creation from quote acceptance
- Current behaviour: manual link/create via CustomerProjectSection CTAs
- This is intentionally manual and honest

### D) Larger Lifecycle Redesign or Template Unification
- No changes to LL/LJ lifecycle systems
- No template unification attempted

---

## 6. RISKS / FOLLOW-UP RECOMMENDATIONS

1. **Unit Cost calculation** uses `pricing.internalCostSubtotal / quantity` — this matches the existing cost indicator logic that was previously shown below the Unit Sell value. No new calculation was introduced.

2. **Measurement button label change** ("Set Now" → "Set Measurement") is a minor wording change that may affect any documented user guides referencing the old label.

3. **Governance Record column** now uses an IIFE render pattern for cleaner conditional logic — this is functionally equivalent to the previous ternary chain but more maintainable.

4. **Customer honesty** is operationally correct today but relies on the user understanding the manual workflow. When automatic CRM creation is implemented (deferred phase), the CTAs and workflow stepper should be updated to reflect the new automation.
