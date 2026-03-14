// WARNING: This test plan calls POST /api/dev/clear-quotes which deletes ALL quotes.
// Requires: ENABLE_DESTRUCTIVE_DEV_TOOLS=true environment variable on the server.
export const QUOTE_FILTERS_TEST_PLAN = `
  Browser-driven test for quote page filters.
  Verifies all filter controls render, work correctly, and reset properly.

  SETUP:
  1. [API] POST /api/dev/clear-quotes to start clean
  2. [API] POST /api/jobs with body {"name":"UIFilter Alpha Co","address":"1 Alpha Rd"} — note job ID as JOB_A
  3. [API] POST /api/jobs with body {"name":"UIFilter Beta Ltd","address":"2 Beta Ave"} — note job ID as JOB_B
  4. [API] POST /api/quotes with body: {"snapshot":{"items":[],"totalsBreakdown":{"itemsSubtotal":1000,"installationTotal":200,"deliveryTotal":100,"subtotalExclGst":1300,"gstAmount":195,"totalInclGst":1495},"totals":{"cost":500,"sell":1000,"grossProfit":500,"grossMargin":50,"gpPerHour":100,"totalLabourHours":5},"customer":"UIFilter Alpha Co","divisionCode":"LJ","lineItems":[],"assemblies":[],"operations":[]},"sourceJobId":"<JOB_A>","customer":"UIFilter Alpha Co","divisionCode":"LJ","mode":"revision"} — note the quote ID as QUOTE_A
  5. [API] POST /api/quotes with body: {"snapshot":{"items":[],"totalsBreakdown":{"itemsSubtotal":2000,"installationTotal":400,"deliveryTotal":200,"subtotalExclGst":2600,"gstAmount":390,"totalInclGst":2990},"totals":{"cost":1000,"sell":2000,"grossProfit":1000,"grossMargin":50,"gpPerHour":200,"totalLabourHours":5},"customer":"UIFilter Beta Ltd","divisionCode":"LJ","lineItems":[],"assemblies":[],"operations":[]},"sourceJobId":"<JOB_B>","customer":"UIFilter Beta Ltd","divisionCode":"LJ","mode":"revision","quoteType":"renovation"} — note the quote ID as QUOTE_B (created with quoteType="renovation")

  Test 1: Verify all filter controls are visible
  7. [New Context] Create a new browser context
  8. [Browser] Navigate to /quotes
  9. [Verify]
     - Customer filter dropdown is visible (data-testid="select-filter-customer")
     - Quote type filter dropdown is visible (data-testid="select-filter-quote-type")
     - Date range filter button is visible (data-testid="button-date-range-filter")
     - Search input is visible (data-testid="input-search-quotes")
     - Sort selector is visible (data-testid="select-sort-quotes")
     - "Clear filters" button is NOT visible (no filters are active)
     - Both "UIFilter Alpha Co" and "UIFilter Beta Ltd" quotes appear in the list

  Test 2: Customer filter works
  10. [Browser] Click the customer filter dropdown (data-testid="select-filter-customer")
  11. [Browser] Select "UIFilter Alpha Co" from the dropdown
  12. [Verify]
      - Only the "UIFilter Alpha Co" quote is visible
      - "UIFilter Beta Ltd" quote is NOT visible
      - "Clear filters" button is now visible (data-testid="button-clear-all-filters")
  13. [Browser] Click the customer filter dropdown again
  14. [Browser] Select "All Customers"
  15. [Verify]
      - Both "UIFilter Alpha Co" and "UIFilter Beta Ltd" quotes are visible again

  Test 3: Quote type filter works
  16. [Browser] Click the quote type filter dropdown (data-testid="select-filter-quote-type")
  17. [Browser] Select "Renovation" from the dropdown
  18. [Verify]
      - Only the "UIFilter Beta Ltd" quote is visible (it has renovation type)
      - "UIFilter Alpha Co" quote is NOT visible
  19. [Browser] Click the quote type filter dropdown again
  20. [Browser] Select "General" from the dropdown
  21. [Verify]
      - Only the "UIFilter Alpha Co" quote is visible (it has null/General type)
      - "UIFilter Beta Ltd" quote is NOT visible
  22. [Browser] Click the quote type filter dropdown again
  23. [Browser] Select "All Types"
  24. [Verify] Both quotes are visible again

  Test 4: Date range filter works
  25. [Browser] Click the date range filter button (data-testid="button-date-range-filter")
  26. [Verify] A popover opens with "From" and "To" date inputs (data-testid="input-date-from" and data-testid="input-date-to")
  27. [Browser] Set the "From" date input to "2030-01-01" (a future date)
  28. [Verify] No quotes are shown — "No quotes match your filters" message appears (data-testid="text-no-quotes-filtered")
  29. [Browser] Click "Clear dates" button (data-testid="button-clear-date-range")
  30. [Verify] Both quotes are visible again

  Test 5: Clear all filters resets everything
  31. [Browser] Click the customer filter dropdown and select "UIFilter Alpha Co"
  32. [Verify]
      - Only Alpha quote shown
      - "Clear filters" button is visible (data-testid="button-clear-all-filters")
  33. [Browser] Click the "Clear filters" button (data-testid="button-clear-all-filters")
  34. [Verify]
      - Both quotes are visible again
      - "Clear filters" button is NOT visible (all filters reset)

  CLEANUP:
  35. [API] DELETE /api/jobs/<JOB_A> with body {"quoteCascade":"delete","confirmPermanent":true}
  36. [API] DELETE /api/jobs/<JOB_B> with body {"quoteCascade":"delete","confirmPermanent":true}
`;

export const QUOTE_FILTERS_TECHNICAL_DOCS = `
  API endpoints:
  - POST /api/jobs — create job/estimate
  - POST /api/quotes — create quote (with snapshot, sourceJobId, customer, divisionCode, mode, optional quoteType: "renovation"|"new_build"|"tender")
  - GET /api/quotes — get all quotes enriched with isOrphaned, linkedEstimateExists
  - DELETE /api/jobs/:id — permanent delete with quoteCascade body param
  - POST /api/dev/clear-quotes — dev cleanup

  Quotes page at /quotes has these filter controls:
  - data-testid="select-filter-customer" — customer dropdown
  - data-testid="select-filter-quote-type" — quote type dropdown (options: All Types, General, Renovation, New Build, Tender)
  - data-testid="button-date-range-filter" — date range popover trigger
  - data-testid="input-date-from" / data-testid="input-date-to" — date inputs inside popover
  - data-testid="button-clear-date-range" — clear dates button inside popover
  - data-testid="button-clear-all-filters" — clear all filters button (only visible when filters are active)
  - data-testid="input-search-quotes" — search input
  - data-testid="select-sort-quotes" — sort selector
  - data-testid="text-no-quotes-filtered" — empty state when filters yield no results

  The customer dropdown is populated from unique customer names in the quote list.
  Quote type filter includes "General" which matches quotes with null quoteType.
  "Clear filters" button only appears when at least one filter (customer, quote type, date range) is active.
`;
