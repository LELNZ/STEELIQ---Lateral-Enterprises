# Phase 5D — Final Corrective Closure Report

**Date**: 2026-04-07  
**Phase**: 5D Final Corrective Closure Pass  
**Author**: Agent (automated)

---

## 1. Scope & Objectives

Phase 5D aimed to resolve all remaining closure blockers:

1. **Persisted Project IDs** — Replace client-side index-based project display IDs with server-side persisted `PRJ-XXXX` numbers.
2. **LL Laser Estimate Governance Parity** — Bring LL Laser Estimates fully into the demo/test governance model (schema, PATCH endpoint, badge, toggle, settings panel, governance archive/delete).
3. **UI Standardisation** — Harmonise table padding, containers, headers, and spacing across all 8 list pages.
4. **Badge & Toast Consistency** — Unified FlaskConical/amber badge and "Demo flag updated" toast wording across all entity types.
5. **Dead Code Cleanup** — Remove orphaned `useDemoToggle` and `DemoToggle` exports from `platform-layout.tsx`.
6. **Forensic Closure Report** — This document.

---

## 2. Persisted Project ID

| Item | Status |
|------|--------|
| `projectNumber` column added to `projects` table | YES |
| Unique constraint on `projectNumber` | YES |
| `getNextProjectNumber()` server-side sequence | YES |
| `createProject()` auto-assigns `PRJ-XXXX` | YES |
| Backfill of 5 existing projects (PRJ-0001..PRJ-0005) | YES |
| `projects-list.tsx` displays `p.projectNumber` (not index) | YES |
| Search filter includes project number | YES |
| Column is nullable (backward-compatible) | YES |

**Implementation**: `projectNumber` is a `text` column with a unique constraint. `getNextProjectNumber()` queries the highest existing `PRJ-XXXX` and increments. All 5 pre-existing projects were backfilled via raw SQL migration. The UI displays the persisted project number directly.

---

## 3. LL Laser Estimate Governance Parity

| Item | Status |
|------|--------|
| `isDemoRecord` boolean added to `laser_estimates` schema | YES |
| `getDemoLaserEstimates()` storage method | YES |
| `updateLaserEstimateDemoFlag()` storage method | YES |
| `PATCH /api/laser-estimates/:id/demo-flag` endpoint | YES |
| Audit log on flag toggle | YES |
| FlaskConical/amber badge on `laser-estimates-list.tsx` | YES |
| Toggle button on `laser-estimates-list.tsx` | YES |
| Governance summary includes laser estimates | YES |
| Governance summary `totalFlagged` includes laser estimates count | YES |
| `GovernanceEntityType` includes `laserEstimate` | YES |
| `formatGovernanceEntityType` maps `laserEstimate` → "Estimate (LL)" | YES |
| Settings panel shows LL Laser Estimates section | YES |
| Governance archive route handles `laserEstimate` | YES |
| Governance delete route handles `laserEstimate` | YES |
| `archiveLaserEstimate()` storage method | YES |
| `deleteLaserEstimate()` storage method | YES |

**Implementation**: Full parity with all other entity types. Laser estimates can be flagged, unflagged, archived, and deleted through the governance system. The Settings governance panel includes an LL Laser Estimates section with the same expand/collapse/archive/delete pattern as all other entity types.

---

## 4. UI Standardisation (All 8 List Pages)

### Standard Pattern Applied

| Property | Value |
|----------|-------|
| Container | `rounded-lg border bg-card overflow-hidden` |
| Header row | `bg-muted/50` |
| Header cells | `text-xs font-semibold uppercase tracking-wider text-muted-foreground` |
| Row hover | `hover:bg-muted/30` |
| Row padding | `py-2.5` |
| Demo badge | FlaskConical icon, amber colors: `text-[10px] px-1.5 py-0 border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30` |

### Pages Verified

| Page | File | `py-3` in data rows | Standard badge | Standard toast |
|------|------|---------------------|----------------|----------------|
| Jobs | `jobs-list.tsx` | NO | YES | YES |
| Quotes | `quotes-list.tsx` | NO | YES | YES |
| Op-Jobs | `op-jobs-list.tsx` | NO | YES | YES |
| Projects | `projects-list.tsx` | NO | YES | YES |
| Invoices | `invoices.tsx` | NO | YES | YES |
| Customers | `customers.tsx` | NO (1 in expanded detail panel — appropriate) | YES | YES |
| Contacts | `contacts.tsx` | NO | YES | YES |
| Laser Estimates | `laser-estimates-list.tsx` | NO | YES | YES |

---

## 5. Demo Badge & Toast Consistency

### Toast Wording

All 9 demo-flag toggle locations use `title: "Demo flag updated"`:

1. `jobs-list.tsx` — YES
2. `quotes-list.tsx` — YES
3. `quote-detail.tsx` — YES
4. `op-job-detail.tsx` — YES
5. `project-detail.tsx` — YES
6. `invoices.tsx` — YES
7. `customers.tsx` — YES (with additional description)
8. `contacts.tsx` — YES
9. `laser-estimates-list.tsx` — YES

### Button Title Wording

All toggle buttons use consistent title text: "Remove demo flag" (when flagged) / "Flag as demo" (when not flagged).

---

## 6. Dead Code Cleanup

| Item | Status |
|------|--------|
| `useDemoToggle` removed from `platform-layout.tsx` | YES |
| `DemoToggle` component removed from `platform-layout.tsx` | YES |
| `useAuth` unused import removed from `platform-layout.tsx` | YES |
| No references to `useDemoToggle` anywhere in `client/src` | YES |
| No references to `DemoToggle` anywhere in `client/src` | YES |

---

## 7. Governance System — Complete Entity Coverage

### 8 PATCH Demo-Flag Endpoints

| Entity Type | Endpoint | Status |
|-------------|----------|--------|
| Estimate (LJ) | `PATCH /api/jobs/:id/demo-flag` | YES |
| Quote | `PATCH /api/quotes/:id/demo-flag` | YES |
| Op-Job | `PATCH /api/op-jobs/:id/demo-flag` | YES |
| Project | `PATCH /api/projects/:id/demo-flag` | YES |
| Invoice | `PATCH /api/invoices/:id/demo-flag` | YES |
| Customer | `PATCH /api/customers/:id/demo-flag` | YES |
| Contact | `PATCH /api/customer-contacts/:id/demo-flag` | YES |
| Laser Estimate (LL) | `PATCH /api/laser-estimates/:id/demo-flag` | YES |

### Governance Archive Route (`POST /api/admin/governance/archive`)

Handles: `estimate`, `quote`, `opJob`, `project`, `invoice`, `customer`, `contact`, `laserEstimate` — **8 entity types, all covered**.

### Governance Delete Route (`DELETE /api/admin/governance/record/:entityType/:entityId`)

Handles: `estimate`, `quote`, `opJob`, `project`, `invoice`, `customer`, `contact`, `laserEstimate` — **8 entity types, all covered**.

### Governance Summary (`GET /api/admin/governance/summary`)

Returns flagged records for all 8 entity types including laser estimates with chain analysis where applicable.

---

## 8. Settings Panel — Governance Sections

The Settings governance panel includes sections for all 8 entity types:

1. LJ Estimates
2. Quotes
3. Op-Jobs
4. Projects
5. Invoices
6. Customers
7. Contacts
8. LL Laser Estimates

Each section shows flagged count, expand/collapse, individual archive/delete with chain-aware guards, and Xero-link protection where applicable.

---

## 9. Demo Visibility Model

**Model**: All records are always visible in all views. The demo flag is purely a visual label. There is no server-side filtering based on the flag.

**Settings text**: "Flagged records remain visible in all views."

This is consistent across all entity types including the newly added laser estimates.

---

## 10. Schema Changes Summary

### `projects` Table
- Added: `projectNumber` (text, unique, nullable)

### `laser_estimates` Table
- Added: `isDemoRecord` (boolean, default false)

### Storage Interface (`IStorage`)
- Added: `getNextProjectNumber()`
- Added: `getDemoLaserEstimates()`
- Added: `updateLaserEstimateDemoFlag(id, isDemoRecord)`
- Added: `archiveLaserEstimate(id)`
- Added: `deleteLaserEstimate(id)`

---

## 11. Files Modified

| File | Changes |
|------|---------|
| `shared/schema.ts` | `projectNumber` on projects, `isDemoRecord` on laser_estimates |
| `server/storage.ts` | New methods for project numbering, laser estimate governance |
| `server/routes.ts` | PATCH laser-estimates demo-flag, governance archive/delete for laserEstimate |
| `client/src/pages/projects-list.tsx` | Display persisted `projectNumber` |
| `client/src/pages/laser-estimates-list.tsx` | Demo badge + toggle button |
| `client/src/pages/settings.tsx` | LL Laser section, `formatGovernanceEntityType` updated |
| `client/src/pages/contacts.tsx` | `py-3` → `py-2.5` in data rows |
| `client/src/pages/customers.tsx` | `py-3` → `py-2.5` in data rows, toast standardised |
| `client/src/pages/jobs-list.tsx` | Button title standardised |
| `client/src/pages/quotes-list.tsx` | Button title standardised |
| `client/src/components/ui/platform-layout.tsx` | Dead code removed (useDemoToggle, DemoToggle, unused import) |

---

## 12. Known Limitations & Out-of-Scope

- **Phase 5C supplier governance** was not touched (out of scope).
- **LJ/LE/PDF/numbering/lifecycle semantics** were not modified (out of scope).
- **`projectNumber` is nullable** — existing records created before the backfill migration could theoretically have null values, but all 5 existing records were backfilled. New records auto-assign via `getNextProjectNumber()`.
- **Laser estimate governance** does not include chain analysis (no downstream linked records) because laser estimates are standalone entities without quote/invoice chains.

---

## 13. Final Sign-Off Checklist

| # | Verification Point | Status |
|---|-------------------|--------|
| 1 | Persisted Project ID (`projectNumber`) in schema | YES |
| 2 | Server-side sequence (`getNextProjectNumber`) | YES |
| 3 | Backfill of existing projects | YES |
| 4 | Projects list displays persisted project number | YES |
| 5 | `isDemoRecord` on `laser_estimates` schema | YES |
| 6 | PATCH endpoint for laser estimate demo flag | YES |
| 7 | Laser estimate demo badge (FlaskConical/amber) | YES |
| 8 | Laser estimate toggle button | YES |
| 9 | Governance summary includes laser estimates | YES |
| 10 | Governance archive handles `laserEstimate` | YES |
| 11 | Governance delete handles `laserEstimate` | YES |
| 12 | Settings panel shows LL Laser section | YES |
| 13 | All 8 list pages use `py-2.5` in data rows | YES |
| 14 | All toast messages say "Demo flag updated" | YES |
| 15 | Dead code (`useDemoToggle`/`DemoToggle`) removed | YES |
| 16 | No `py-3` in any list page data rows | YES |
| 17 | 8 PATCH demo-flag endpoints operational | YES |
| 18 | `formatGovernanceEntityType` covers all types | YES |

**All 18 verification points: YES**

---

*End of Phase 5D Final Corrective Closure Report*
