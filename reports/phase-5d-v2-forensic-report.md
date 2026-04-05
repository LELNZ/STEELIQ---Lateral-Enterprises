# Phase 5D Corrective V2 – Forensic Report

**Date**: 2026-04-05
**Scope**: Corrective rollback of incorrect server-side demo filtering, full UI standardisation across all 6 worklist pages, demo governance verification

---

## 1. Executive Summary

Phase 5D V2 addressed two categories of issues:

1. **Corrective rollback** (completed prior): Removed incorrect server-side `showDemo` list filtering from all 7 API endpoints and reverted all 6 client pages to simple queries. Demo/test records are now always returned by the API and always visible in the UI.

2. **UI standardisation** (this session): Fixed concrete visual inconsistencies across all 6 worklist pages — table containers, header patterns, demo badge icons/text, row padding, and missing data columns.

**Result**: All 6 worklist pages now share a unified visual language. Demo governance (flag toggling) verified end-to-end via automated Playwright tests.

---

## 2. Corrective Rollback (Prior Session — Preserved)

### Server-side changes (server/routes.ts)
All 7 list endpoints stripped of `showDemo` filtering logic:

| Endpoint | Change |
|----------|--------|
| `GET /api/jobs` | Removed `showDemo` query param parsing and SQL WHERE clause |
| `GET /api/quotes` | Same |
| `GET /api/customers` | Same |
| `GET /api/contacts` | Same |
| `GET /api/projects` | Same |
| `GET /api/invoices` | Same |
| `GET /api/contacts/:id` | Removed demo guard redirect |

### Client-side changes
All 6 client pages reverted:
- Removed `useDemoToggle()` hook calls
- Removed custom `queryFn` with `showDemo` query param
- Reverted to simple `queryKey: ['/api/endpoint']` patterns
- Removed `DemoToggle` JSX from page headers

### Preserved
- All 7 `PATCH /api/:entity/:id/demo-flag` endpoints remain intact
- `isDemoRecord` column and per-row toggle buttons remain functional
- `DemoToggle` component and `useDemoToggle` hook remain in `platform-layout.tsx` (unused but available for future use)

---

## 3. UI Standardisation — Table Containers (T001)

### Unified pattern
All 6 worklist tables now use:

```
Container: <div className="rounded-lg border bg-card overflow-hidden">
Header row: <TableRow className="bg-muted/50">
Header cells: <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
Row padding: py-2.5 (data rows), py-3 (customers/contacts with avatars)
Row hover: hover:bg-muted/30
```

### Pages updated

| Page | Container | Header bg | Header text | Overflow |
|------|-----------|-----------|-------------|----------|
| `jobs-list.tsx` | `rounded-lg border bg-card overflow-hidden` | `bg-muted/50` | `text-xs font-semibold uppercase` | `overflow-hidden` |
| `quotes-list.tsx` | `rounded-lg border bg-card overflow-hidden` | `bg-muted/50` | `text-xs font-semibold uppercase` | `overflow-hidden` |
| `projects-list.tsx` | `rounded-lg border bg-card overflow-hidden` | `bg-muted/50` | `text-xs font-semibold uppercase` | `overflow-hidden` |
| `customers.tsx` | `rounded-lg border bg-card overflow-hidden` | `bg-muted/50` | `text-xs font-semibold uppercase` | `overflow-hidden` |
| `contacts.tsx` | `rounded-lg border bg-card overflow-hidden` | `bg-muted/50` | `text-xs font-semibold uppercase` | `overflow-hidden` |
| `invoices.tsx` | `rounded-lg border bg-card overflow-hidden` | `bg-muted/50` | `text-xs font-semibold uppercase` | `overflow-hidden` |

### Specific fixes
- **customers.tsx**: Container changed from `rounded-md border` → `rounded-lg border bg-card overflow-hidden`
- **contacts.tsx**: Container changed from `rounded-md border` → `rounded-lg border bg-card overflow-hidden`
- **invoices.tsx**: Header cells changed from `text-[10px]` → `text-xs`; container added `overflow-hidden`
- **jobs-list.tsx archived table**: Header row added `bg-muted/50` class
- **projects-list.tsx**: Converted raw `<table>` to shadcn `<Table>` components (prior session)

---

## 4. UI Standardisation — Demo Badge (T002)

### Unified pattern
All demo badges now use:

```html
<Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 shrink-0">
  <FlaskConical className="h-2.5 w-2.5 mr-0.5" />Demo
</Badge>
```

### Changes made

| Page | Before | After |
|------|--------|-------|
| `customers.tsx` (row badge) | `<Flag />` icon, "Test/Demo" text, `text-xs` | `<FlaskConical />` icon, "Demo" text, `text-[10px]` |
| `customers.tsx` (governance section) | `<Flag />` icon | `<FlaskConical />` icon |
| `contacts.tsx` (row badge) | `<Flag />` icon, "Test/Demo" text, `text-xs` | `<FlaskConical />` icon, "Demo" text, `text-[10px]` |
| `contacts.tsx` (flag button) | `<Flag />` icon, "Flag as test/demo" title | `<FlaskConical />` icon, "Flag as demo" title |
| `jobs-list.tsx` | Already correct | No change |
| `quotes-list.tsx` | Already correct | No change |
| `invoices.tsx` | Already correct | No change |

### Import changes
- `customers.tsx`: `Flag` → `FlaskConical` in lucide-react import
- `contacts.tsx`: `Flag` → `FlaskConical` in lucide-react import

---

## 5. Customer Column in Jobs List (T003)

### Change
Added a "Customer" column to the LJ Estimates table (`jobs-list.tsx`):

- **Header**: `<TableHead>Customer</TableHead>` positioned after "Name" column
- **Cell**: Displays `job.clientName` with `<Building2>` icon, or `—` dash when no customer
- **Responsive**: Hidden on small screens (`hidden lg:table-cell`)
- **Test ID**: `data-testid={text-job-customer-${job.id}}`

### Data source
The `clientName` field is returned by `GET /api/jobs` from the database. No additional API calls or customer resolution needed — the field is already populated at job creation time.

### Import
Added `Building2` to lucide-react imports in `jobs-list.tsx`.

---

## 6. Project ID Column (T004 — Prior Session)

Added `PRJ-XXXX` display numbers to the projects list table:
- Generated via index: `PRJ-${String(projects.length - idx).padStart(4, "0")}`
- Shown as first column with monospace styling

---

## 7. Demo Governance Model (Verified)

### Current architecture
```
Records always visible in API → Admins can flag/unflag individual records → 
Per-row toggle button (admin/owner only) → Badge displays "Demo" indicator
```

### Endpoints verified (all 7 PATCH routes intact)

| Endpoint | Function |
|----------|----------|
| `PATCH /api/jobs/:id/demo-flag` | Toggle `isDemoRecord` on jobs |
| `PATCH /api/quotes/:id/demo-flag` | Toggle `isDemoRecord` on quotes |
| `PATCH /api/customers/:id/demo-flag` | Toggle `isDemoRecord` on customers |
| `PATCH /api/contacts/:id/demo-flag` | Toggle `isDemoRecord` on contacts |
| `PATCH /api/projects/:id/demo-flag` | Toggle `isDemoRecord` on projects |
| `PATCH /api/invoices/:id/demo-flag` | Toggle `isDemoRecord` on invoices |
| `PATCH /api/laser-estimates/:id/demo-flag` | Toggle `isDemoRecord` on laser estimates |

### E2E test results
Automated Playwright test verified:
- All 6 worklist pages render with correct table styling
- Demo badges display "Demo" text (not "Test/Demo") with FlaskConical icon
- Demo flag toggle button works: toggles badge on → off → on
- All pages accessible via correct routes (/, /quotes, /projects, /customers, /contacts, /invoices)

**Test status**: PASSED

---

## 8. Reusable Layout System (Preserved from Prior Session)

The shared layout component library in `client/src/components/ui/platform-layout.tsx` remains intact:

| Component | Purpose |
|-----------|---------|
| `PageShell` | Full-height flex wrapper |
| `PageHeader` | Standardised header (w-8/h-8 icon, text-base title) |
| `WorklistBody` | Scrollable content (p-4 sm:p-6) |
| `SettingsBody` | Constrained-width content (max-w-7xl mx-auto) |

All 11 pages continue to use this layout system.

---

## 9. LL Provenance System (Preserved)

The LL process-rate provenance system from prior work remains intact:
- `LLProcessRateSource` type in `shared/schema.ts`
- `dataSource` / `dataSourceNote` fields on process rate entries
- `ProvenanceBadge` component in `ll-pricing-profiles.tsx`
- All 5 pricing profiles have `architecture_default` provenance stamps

---

## 10. Boundary Preservation

### Verified untouched
- **LJ logic**: No changes to job lifecycle, numbering, PDF generation, or task management
- **LE logic**: No changes to engineering estimating
- **Phase 5C supplier governance**: `supplierName` in unique index + supersede SQL unchanged
- **PDF generation**: No changes to any PDF template or generation code
- **Numbering sequences**: No changes to job/quote/invoice numbering
- **Authentication**: No changes to auth middleware or user management

---

## 11. Files Changed (This Session)

| File | Nature of change |
|------|-----------------|
| `client/src/pages/jobs-list.tsx` | Added Customer column (header + cell with Building2 icon); archived table header bg-muted/50 |
| `client/src/pages/customers.tsx` | Container `rounded-md` → `rounded-lg bg-card overflow-hidden`; Flag → FlaskConical; "Test/Demo" → "Demo" |
| `client/src/pages/contacts.tsx` | Container `rounded-md` → `rounded-lg bg-card overflow-hidden`; Flag → FlaskConical; "Test/Demo" → "Demo" |
| `client/src/pages/invoices.tsx` | Header cells `text-[10px]` → `text-xs`; container added `overflow-hidden`; demo badge sizing normalised (`text-[9px]` → `text-[10px]`, icon `h-2` → `h-2.5`) |

---

## 12. Known Gaps / Future Work

| Gap | Status |
|-----|--------|
| Bulk demo flag operations | Not implemented — no bulk selection UI or bulk PATCH endpoints |
| Demo data filtering toggle | Rolled back — `DemoToggle` component exists but is not rendered; available for future re-implementation if needed |
| Customer column in archived jobs table | Not added (archived table has different column set) |
| LL process rates | All 200 rates (40 × 5 profiles) are `architecture_default` — none verified against machine specs |

---

## 13. Conclusion

Phase 5D Corrective V2 has achieved full visual consistency across all 6 worklist pages:

1. **Unified table styling**: All tables use `rounded-lg border bg-card overflow-hidden` containers, `bg-muted/50` header rows, and `text-xs font-semibold uppercase` header cells
2. **Consistent demo badges**: All pages use `FlaskConical` icon with "Demo" text in amber color scheme
3. **Complete data columns**: Jobs list now shows Customer column; Projects list shows PRJ-XXXX IDs
4. **Verified governance**: Demo flag toggling works end-to-end, confirmed by automated Playwright tests
5. **No regressions**: All prior work (layout system, provenance badges, rollback) preserved intact
