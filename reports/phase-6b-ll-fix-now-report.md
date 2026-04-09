# Phase 6B — LL FIX NOW Corrective Report

## 1. Scope

Four FIX NOW items for the LL (Laser) division:
- FIX 1: Unit Cost visibility across all LL estimate item surfaces
- FIX 2: Customer auto-link/auto-create from estimate→quote→acceptance flow
- FIX 3: Lifecycle strip reflects auto-linked customer state
- FIX 4: No regression to existing working flows

---

## 2. Root Cause Analysis

### FIX 1 — Unit Cost Visibility
- **Root cause**: The `LLPricingBreakdown` interface had `unitSell` but no `unitCost` field. The pricing breakdown panel showed Internal Subtotal and Unit Sell but required users to mentally divide subtotal by quantity to derive unit cost.
- **Fix**: Added `unitCost` field to the `LLPricingBreakdown` interface, computed as `internalCostSubtotal / quantity` in the pricing engine, and added a "Unit Cost" row to the `PricingBreakdownPanel` component (displayed in both the add-item modal and the expanded row breakdown).

### FIX 2 — Customer Auto-Link/Auto-Create
- **Root cause**: The quote acceptance endpoint (`POST /api/quotes/:id/accept`) did not attempt any CRM customer matching or creation. After acceptance, the operator had to manually create or link a customer via the CustomerProjectSection CTAs before proceeding to project creation.
- **Fix**: Added auto-link/auto-create logic to the acceptance endpoint. After marking the quote as accepted, the system:
  1. Searches existing CRM customers by normalized name match
  2. Falls back to email match using `sentToEmail`
  3. If matched: links the existing customer to the quote (and source estimate)
  4. If no match: creates a new customer record using available quote/estimate data (name, email, address) and links it
  5. Returns the freshly-fetched quote (with `customerId` populated) in the response

### FIX 3 — Lifecycle Strip Honesty
- **Root cause**: No code change needed. The lifecycle strip already derives its state from the quote's `customerId`. Once FIX 2 populates `customerId` on acceptance, the strip automatically shows the Customer stage as completed.
- **Fix**: Verified behavior — lifecycle strip correctly reflects auto-linked customer state without any frontend changes.

### FIX 4 — No Regression
- **Root cause**: N/A — preservation requirement.
- **Fix**: All changes are additive. No existing behavior was modified or removed.

---

## 3. Files Changed

| File | Change |
|------|--------|
| `client/src/lib/ll-pricing.ts` | Added `unitCost` field to `LLPricingBreakdown` interface; computed as `internalCostSubtotal / quantity` in the return object |
| `client/src/pages/laser-quote-builder.tsx` | Added "Unit Cost" row to `PricingBreakdownPanel` between Internal Subtotal and Markup rows |
| `server/routes.ts` | Added auto-link/auto-create customer logic in `POST /api/quotes/:id/accept` after quote is marked accepted; re-fetches quote for response to include `customerId` |

---

## 4. Before/After Behavior

### FIX 1 — Unit Cost Visibility

| Surface | Before | After |
|---------|--------|-------|
| Add-item modal | Shows Internal Subtotal, Markup, Sell Total, Unit Sell | Shows Internal Subtotal, **Unit Cost**, Markup, Sell Total, Unit Sell |
| Expanded pricing breakdown | Shows Internal Subtotal, Markup, Sell Total, Unit Sell | Shows Internal Subtotal, **Unit Cost**, Markup, Sell Total, Unit Sell |
| Estimate line item row | Already shows Unit Cost column (Phase 6B prior) | Unchanged — still shows Unit Cost |

### FIX 2 — Customer Auto-Link/Auto-Create

| Scenario | Before | After |
|----------|--------|-------|
| Accept LL quote (new customer name) | Quote accepted with no `customerId`; blue CTA banner appears requiring manual customer create/link | Customer auto-created from quote data; `customerId` set on quote; no manual step needed |
| Accept LL quote (existing CRM customer name match) | Same manual flow | Customer auto-linked by name match; `customerId` set |
| Accept LL quote (existing CRM customer email match) | Same manual flow | Customer auto-linked by email match if name didn't match |
| Source laser estimate | Not back-linked to customer | `customerId` back-propagated to source estimate |
| Acceptance response | Returns quote without `customerId` | Returns fresh quote with `customerId` populated |

### FIX 3 — Lifecycle Strip

| Scenario | Before | After |
|----------|--------|-------|
| Accepted LL quote with auto-linked customer | Customer stage shown as pending (blue "current") | Customer stage shown as completed (green check) |
| Next action after customer linked | "Link/Create Customer" CTA | "Create Project" becomes next step |

---

## 5. Test Scenarios — PASS/FAIL

| # | Scenario | Result |
|---|----------|--------|
| 1 | Create new LL estimate item — unit cost visible in add-item modal | **PASS** |
| 2 | Save item — unit cost visible in estimate line row | **PASS** |
| 3 | Internal pricing breakdown shows explicit Unit Cost row | **PASS** |
| 4 | Unit Cost, Unit Sell, Subtotal, Sell Total are mathematically consistent | **PASS** |
| 5 | Create LL estimate with new customer name → generate quote → accept → customer auto-creates and links | **PASS** |
| 6 | After auto-create, accepted quote shows linked customer immediately | **PASS** |
| 7 | After auto-link/create, next step = Create Project | **PASS** |
| 8 | Create project from accepted quote — lifecycle advances | **PASS** |
| 9 | No regression to quote PDF preview/export | **PASS** |
| 10 | No regression to demo/test governance markers | **PASS** |
| 11 | No regression to settings page | **PASS** |

### Matching-specific test (scenario 5 variant):
- Existing CRM customer name match: auto-links without creating duplicate — **verified in code logic** (exact normalized name match)
- Email fallback match: auto-links by `sentToEmail` — **verified in code logic**

---

## 6. Acceptance Criteria Summary

| Fix | Status |
|-----|--------|
| FIX 1 — Unit Cost visibility consistent across all surfaces | **PASS** |
| FIX 2 — Customer auto-link/auto-create on acceptance | **PASS** |
| FIX 3 — Lifecycle strip reflects auto-linked state | **PASS** |
| FIX 4 — No regression to existing working flows | **PASS** |

---

## 7. Known Limits

1. **Name matching is exact (case-insensitive, trimmed)**. Fuzzy or partial name matching is not implemented to avoid false positives. If a customer is entered as "Smith Engineering" on the estimate but exists as "Smith Engineering Ltd" in CRM, they will not match — a new customer will be created.

2. **Phone matching is not implemented** in this pass. The laser estimate form does not have a phone field, and the quote does not carry phone data. Phone matching would require schema changes.

3. **Auto-link/create only runs on acceptance**, not on estimate save or quote generation. This is intentional — customer data may change before acceptance.

4. **The auto-created customer** has: name (from quote.customer), email (from quote.sentToEmail if available), address (from source estimate's projectAddress if available). No phone, no notes, no contacts.

5. **Duplicate prevention** is limited to exact name match and email match against existing CRM customers. If a customer was previously created with a slightly different name, a duplicate may be created.

---

## 8. Deferred / Next Lifecycle Phase

1. Fuzzy/partial name matching for customer auto-link
2. Phone-based customer matching
3. Auto-contact creation (customer_contacts) from estimate contact data
4. Full lifecycle panel redesign across all pages
5. Full page redesign from cards to worklist layout
6. Project page redesign
7. Invoice page redesign
8. New schema fields for customer enrichment
9. Cross-division CRM architecture rewrite
10. Auto-job creation from accepted quote
11. Publishing/production deployment
12. Broad CRM activity timeline

---

## 9. Conclusion

All four FIX NOW items pass:
- Unit Cost is visible and mathematically consistent in the add-item modal, expanded pricing breakdown, and line item table row
- Customer auto-link/auto-create eliminates manual friction on the common happy path
- Lifecycle strip automatically reflects the correct customer-linked state
- No existing behavior was broken

No schema changes were made. No LJ behavior was modified. No deferred items were implemented.
