# Phase 6B — LL Workflow Visibility and UX Corrections Report

## 1. Scope
This pass implements 7 corrective FIX NOW items for the LL (Laser) division workflow:
- F1: Unit Cost visibility in LL estimate line items
- F2: Remove duplicate Open Quote CTA on converted LL estimate
- F3: Quotes list worklist UX consistency
- F4: Customer state truthfulness on accepted LL quote
- F5: Lightweight LL workflow/lifecycle visibility strip
- F6: Job page action surface deduplication
- F7: LL quote creation must not auto-create CRM customers

No schema changes. No LJ/LE modifications. No lifecycle engine redesign.

---

## 2. Fix Now Items Implemented

### F1: Unit Cost Column in LL Estimate Line Items
- Added explicit "Unit Cost" column header and data cell to the line items table
- Unit Cost is derived from `pricing.internalCostSubtotal / quantity` (same pricing engine basis already used)
- The Unit Sell column now shows markup percentage below instead of the old cost+markup combined indicator
- Column order: #, Ref, Title, Qty, Material, Thickness, L×W, **Unit Cost**, Unit Sell, Line Total
- ColSpan for expanded pricing breakdown updated from 10 to 11

### F2: Remove Duplicate Open Quote CTA
- Removed the "Open Quote" button from the green converted banner
- Banner now shows only informational text: "This estimate has been converted to quote [number]"
- Single canonical "Open Quote" button remains in the header area
- Converted status message preserved

### F3: Quotes List Worklist Consistency
- **Already compliant** — the Quotes list already uses `PageShell`, `PageHeader`, `WorklistBody`, standardised `bg-muted/50` headers, `hover:bg-muted/30` rows, `py-2.5` padding, `text-xs font-semibold uppercase tracking-wider` header typography, `rounded-lg border bg-card overflow-hidden` table wrapper, and FlaskConical/amber demo badges
- No changes required

### F4: Customer State Truthfulness
- Added visual distinction between text customer name and actual CRM linkage on quote detail header
- When customer is CRM-linked: shows green "linked" indicator next to customer name
- When accepted quote has text name but no CRM link: shows amber "text only" indicator
- `CustomerProjectSection` already properly shows "Not linked" with actionable CTAs
- `WorkflowProgress` correctly shows Customer step as incomplete when not linked
- No false "customer created" toasts exist in the system

### F5: Lightweight LL Lifecycle Visibility Strip
- Created reusable `LLLifecycleStrip` component (`client/src/components/ll-lifecycle-strip.tsx`)
- Displays 7-stage workflow: Estimate → Quote → Accepted → Customer → Project → Job → Invoice
- Stage state derived from actual linked records (not manual flags or new schema)
- Current/next stage highlighted in blue with ring indicator
- Completed stages shown in green with checkmark
- Unavailable stages shown in muted state
- Integrated on:
  - **LL Estimate detail** — via `LLLifecycleStripFromEstimate` (fetches linked quote chain data)
  - **LL Quote detail** — via `LLLifecycleStripFromQuote` (only renders for `divisionId === "LL"`)
  - **LL Job detail** — via `LLLifecycleStripFromJob` (only renders for `divisionId === "LL"`)
- No new schema, no new API endpoints, no changes to LJ/LE

### F6: Job Action Surface Deduplication
- Removed duplicate "Change" button from Current Status section (was opening same `startEdit()` as header Edit button)
- Header "Edit" button remains as single canonical edit entry point
- Measurement section "Set Now" renamed to "Set Measurement" for clarity
- Measurement section button hidden for cancelled jobs (matching header Edit logic)
- All editing functionality preserved (title, status, notes, measurement, dimension source)

### F7: LL Quote Generation Customer Handling
- Removed auto-creation of CRM customer records during LL estimate → quote generation
- Previously: if estimate had `customer_name` but no `customer_id`, server would search for matching CRM customer and **create one if not found**
- Now: only pre-existing `customer_id` from the estimate is carried forward; text-only customer names remain as display text (`quote.customer` field) without false CRM linkage
- Customer creation/linking remains explicitly available on the accepted quote page via `CustomerProjectSection` CTAs
- Existing functionality for linking existing customers or creating new ones on accepted quotes is preserved

---

## 3. Deferred Items — NOT Implemented

1. Full LL lifecycle engine parity with LJ across every stage
2. Deep checklist/task system for estimate, acceptance, procurement, manufacture, install, invoicing, closeout
3. Automatic downstream job/invoice creation
4. Demo/test chain propagation across related records
5. Full project operational dashboard
6. Cross-entity lifecycle orchestration framework
7. New schema for lifecycle templates or workflow definitions
8. Procurement/manufacture/install stage execution tooling
9. Complete invoice lifecycle automation
10. Closeout automation

---

## 4. Files Changed

| File | Purpose |
|------|---------|
| `client/src/components/ll-lifecycle-strip.tsx` | **New** — Reusable LL lifecycle strip component with estimate, quote, and job variants |
| `client/src/pages/laser-quote-builder.tsx` | Added Unit Cost column; removed banner Open Quote button; integrated lifecycle strip on estimate detail |
| `client/src/pages/quote-detail.tsx` | Added LL lifecycle strip for LL quotes; added customer linked/text-only indicator |
| `client/src/pages/op-job-detail.tsx` | Removed duplicate Change button; integrated lifecycle strip for LL jobs |
| `server/routes.ts` | Removed auto-creation of CRM customers during LL quote generation |

### Files Inspected But Not Changed
| File | Reason |
|------|--------|
| `client/src/pages/quotes-list.tsx` | Already uses standardised worklist UX |
| `client/src/pages/settings.tsx` | Governance improvements from previous pass intact |

---

## 5. UI Surfaces Changed

- **LL Estimate Detail**: Unit Cost column added, lifecycle strip added, duplicate CTA removed
- **LL Quote Detail**: Lifecycle strip added, customer linked/text-only indicator added
- **LL Job Detail**: Lifecycle strip added, duplicate Change button removed
- **Server**: LL quote generation no longer auto-creates CRM customers

---

## 6. Behaviour Preserved

- LL estimate creation and save
- LL quote generation from estimate
- LL quote send/review/accept
- Accepted quote → create customer → create project → create job workflow
- Demo/test flagging and governance
- LJ and LE pages untouched
- All existing filters, tabs, sorting, and actions on Quotes page
- Xero integration unchanged
- Numbering formats unchanged

---

## 7. Test Scenarios

| # | Scenario | Result |
|---|----------|--------|
| 1 | LL estimate line item shows unit cost | PASS |
| 2 | Converted LL estimate shows only one Open Quote action | PASS |
| 3 | LL quote list uses unified worklist/table styling and remains functional | PASS |
| 4 | LL estimate → quote path preserves text customer without falsely linking CRM customer | PASS |
| 5 | Accepted LL quote shows truthful customer/project state | PASS |
| 6 | Accepted LL quote still allows create customer / link customer / create project / create job | PASS |
| 7 | LL workflow visibility appears on estimate | PASS |
| 8 | LL workflow visibility appears on quote | PASS |
| 9 | LL workflow visibility appears on job | PASS |
| 10 | Job page action surfaces simplified without loss of function | PASS |
| 11 | No regression to LJ pages | PASS (LJ pages not modified) |
| 12 | No regression to LE pages | PASS (LE pages not modified) |
| 13 | No regression to demo/test governance | PASS |
| 14 | No regression to quotes filters/actions | PASS |
| 15 | No regression to LL quote generation | PASS |

---

## 8. Known Gaps

1. The lifecycle strip is **read-only visibility**. It does not provide inline CTAs for each stage (those already exist in `WorkflowProgress` and `CustomerProjectSection` for the accepted quote flow).
2. The lifecycle strip on the estimate page fetches linked quote chain data via additional API queries. This is lightweight but involves 2-3 extra requests for converted estimates.
3. The "text only" customer indicator on the quote header only appears for accepted quotes (since pre-acceptance it's expected to be text-only).

---

## 9. Conclusion

All 7 FIX NOW items are implemented and verified in the running UI:
- Unit Cost is visible on LL estimate line items
- Converted estimates show exactly one Open Quote action
- Quotes list is consistent with the standardised worklist pattern
- Customer state is truthfully and explicitly represented
- LL workflow visibility strip appears on estimate, quote, and job pages
- Job actions are simplified without losing functionality
- LL quote generation no longer silently creates CRM customers

No deferred lifecycle items were implemented. No schema changes were made. No LJ/LE behaviour was modified. The system is operationally ready.
