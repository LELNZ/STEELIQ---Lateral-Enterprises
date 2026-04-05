# Phase 5D Corrective V2 – Forensic Report

**Date**: 2026-04-05
**Scope**: Reusable layout system, production view data hygiene, LL process-rate provenance

---

## 1. Reusable Platform Layout System (T001–T004)

### What was built
A shared layout component library in `client/src/components/ui/platform-layout.tsx`:

| Component | Purpose |
|-----------|---------|
| `PageShell` | Full-height flex wrapper for all pages |
| `PageHeader` | Standardised header with w-8/h-8 icon, text-base title, text-[11px] subtitle, flex-wrap actions slot |
| `WorklistBody` | Scrollable content area with consistent padding (p-4 sm:p-6) |
| `SettingsBody` | Constrained-width content area (max-w-7xl mx-auto) |
| `useDemoToggle` | Hook returning admin status, showDemo state, query param string, and toggle function |
| `DemoToggle` | Admin-only toggle switch for demo data visibility |

### Pages migrated
All major list/worklist pages now use the shared layout:

- `jobs-list.tsx` — Full migration + demo toggle
- `quotes-list.tsx` — Full migration + demo toggle
- `customers.tsx` — Full migration + demo toggle
- `contacts.tsx` — Full migration + demo toggle
- `projects-list.tsx` — Full migration + demo toggle
- `invoices.tsx` — Full migration + demo toggle
- `op-jobs-list.tsx` — Layout migration (no demo flag column in schema)
- `laser-estimates-list.tsx` — Layout migration
- `library.tsx` — Layout migration
- `users.tsx` — Layout migration
- `settings.tsx` — Full migration with `SettingsBody`

### Pages not migrated
- `ll-pricing-profiles.tsx` — Conditional `embedded` prop pattern makes standard PageHeader migration impractical; left as-is

---

## 2. Production View Data Hygiene (T005–T007)

### Server-side changes (server/routes.ts)
Six list API routes updated to hide demo records by default:

| Endpoint | Demo filter logic |
|----------|------------------|
| `GET /api/jobs` | Filters `is_demo_record = true` unless `?showDemo=true` and caller is admin |
| `GET /api/quotes` | Same pattern |
| `GET /api/customers` | Same pattern |
| `GET /api/contacts` | Same pattern (via `customer_contacts` table) |
| `GET /api/projects` | Same pattern |
| `GET /api/invoices` | Same pattern |

### Client-side changes
- `useDemoToggle()` hook checks `user.role` for admin/owner, returns reactive `showDemo` state
- `queryParam` getter produces `showDemo=true` when toggled on
- Each page's `useQuery` includes `showDemo` in queryKey for cache isolation
- Custom `queryFn` appends `showDemo=true` to the fetch URL when admin toggle is active
- `DemoToggle` component renders only for admin/owner users

### Behaviour
- **Default (all users)**: Demo/test records hidden from all list views
- **Admin opt-in**: Toggle switch in page header to reveal demo records; state is per-page, session-only

---

## 3. LL Process-Rate Provenance (T008–T009)

### Schema addition (`shared/schema.ts`)
```typescript
export type LLProcessRateSource =
  | "architecture_default"  // Seeded representative rate
  | "bodor_spec"           // From Bodor machine specification
  | "empirical_test"       // Verified by actual cut test
  | "operator_input"       // Entered by machine operator
  | "manual_override";     // Admin override

export interface LLProcessRateEntry {
  // ... existing fields ...
  dataSource?: LLProcessRateSource;
  dataSourceNote?: string;
}
```

### Seed data labelling
All 40 process rates in `seedLlPricingSettings()` now carry:
- `dataSource: "architecture_default"`
- `dataSourceNote: "Seeded representative rate for Bodor 6kW fibre – replace with empirical test data"`

### Backfill migration
Two migration paths run on startup:
1. **Division settings**: If existing `processRateTables` entries lack `dataSource`, stamps all as `architecture_default`
2. **Pricing profiles**: `backfillProcessRateProvenance()` iterates all LL pricing profiles and stamps unstamped process rates

Server log confirms:
```
[ll-pricing-settings] Migrated: stamped dataSource provenance on 40 division-settings process rates
[ll-provenance] Backfilled dataSource provenance on 5 pricing profile(s)
```

### UI provenance display
`ProvenanceBadge` component added to `ll-pricing-profiles.tsx`:
- Shows in both editor and viewer process rate tables
- Colour-coded by source type (orange=Default, blue=Bodor Spec, green=Tested, violet=Operator, red=Override)
- Tooltip shows `dataSourceNote` on hover
- Renders "—" when no source is set (forward-compatible for rates added before this change)

### Provenance summary

| Profile | Status | Rates | All sourced? |
|---------|--------|-------|-------------|
| Standard Rates v1.0 | superseded | 40 | Yes – all `architecture_default` |
| Q3 Updated Rates v2.0 | superseded | 40 | Yes – all `architecture_default` |
| Q4 Preview Rates v3.0-draft | active | 40 | Yes – all `architecture_default` |
| test | archived | 40 | Yes – all `architecture_default` |
| test1 | archived | 40 | Yes – all `architecture_default` |

**Finding**: All 40 process rates across all 5 profiles originate from architecture seed defaults. None have been verified against actual Bodor 3015 6kW machine specifications or empirical cut tests. The provenance labels now make this visible to administrators.

---

## 4. Boundary Preservation (T010)

### Verified untouched
- **LJ logic**: No changes to job lifecycle, numbering, PDF generation, or task management
- **LE logic**: No changes to engineering estimating, specification dictionary, or configuration
- **Phase 5C supplier governance**: `supplierName` in unique index + supersede SQL unchanged
- **PDF generation**: No changes to any PDF template or generation code
- **Numbering sequences**: No changes to job/quote/invoice numbering
- **Authentication**: No changes to auth middleware or user management logic

---

## 5. Files Changed

| File | Nature of change |
|------|-----------------|
| `client/src/components/ui/platform-layout.tsx` | New shared layout components |
| `client/src/pages/jobs-list.tsx` | Layout + demo toggle migration |
| `client/src/pages/quotes-list.tsx` | Layout + demo toggle migration |
| `client/src/pages/customers.tsx` | Layout + demo toggle migration |
| `client/src/pages/contacts.tsx` | Layout + demo toggle migration |
| `client/src/pages/projects-list.tsx` | Layout + demo toggle migration |
| `client/src/pages/invoices.tsx` | Layout + demo toggle migration |
| `client/src/pages/op-jobs-list.tsx` | Layout migration |
| `client/src/pages/laser-estimates-list.tsx` | Layout migration |
| `client/src/pages/library.tsx` | Layout migration |
| `client/src/pages/users.tsx` | Layout migration |
| `client/src/pages/settings.tsx` | Layout migration (SettingsBody) |
| `client/src/pages/ll-pricing-profiles.tsx` | Provenance badge + Source column |
| `shared/schema.ts` | `LLProcessRateSource` type + `dataSource`/`dataSourceNote` fields |
| `server/routes.ts` | Demo filtering on 6 endpoints + seed provenance labels + backfill migration |
