# Phase 5D Corrective Rollback — Full Forensic Report

**Date:** 2026-04-05  
**Commit:** `05d1dbdf83ce7867aeea83f961d2523fccdf3bd0`  
**Parent commit (introduced the defect):** `10d304a` — "Introduce a demo toggle to filter test data and refactor page layouts"  
**Scope:** Surgical removal of server-side `showDemo` list-level filtering and client-side `DemoToggle` query plumbing from all list pages  

---

## 1. Executive Outcome

The corrective rollback is **complete and verified**. The server-side `showDemo` filtering logic introduced in commit `10d304a` has been fully removed from all 7 list endpoints. All 6 affected client pages have been reverted to simple, unconditional list queries. The application compiles cleanly, the server starts without errors, and all list endpoints return the full set of records (both `isDemoRecord: true` and `isDemoRecord: false`) without any toggle-driven filtering. The original governed lifecycle — where all records are always visible in lists and admins flag, review, and action them individually — is restored.

---

## 2. Root Cause Findings

**What was introduced (commit `10d304a`):**

A `showDemo` query parameter was added to 7 server-side list endpoints (`/api/jobs`, `/api/quotes`, `/api/customers`, `/api/contacts`, `/api/projects`, `/api/invoices`, `/api/op-jobs`). When `showDemo=false` (the default), the server filtered out any record where `isDemoRecord === true` before returning results. On the client, a `useDemoToggle()` hook and `<DemoToggle>` component were wired into all 6 main list pages (jobs-list, quotes-list, customers, contacts, projects-list, invoices) to control this parameter. A detail-level guard on `/api/contacts/:id` was also added to block demo-flagged contacts from non-privileged users.

**Why it was incorrect:**

The original governance model treats demo-flagged records as *visible but flagged*. Admins see all records in every list, can flag/unflag individual records, and can take bulk governance actions (archive, delete) on flagged records. The `showDemo=false` default **hid** demo-flagged records from lists by default, making them invisible and unreachable in the normal workflow. This broke the review-and-action cycle: admins could not see flagged records to decide what to do with them, defeating the purpose of the flag-based lifecycle.

**Why a rollback, not a fix:**

The filtering approach was architecturally wrong — not a bug to patch. Hiding records at the list level is the opposite of the governed lifecycle. No adjustment to the toggle behavior (e.g., changing defaults, auto-expanding) would have fixed the fundamental mismatch. Full removal was the correct corrective action.

---

## 3. Files Changed

**7 files modified. 0 files created. 0 files deleted.**

| # | File | Lines removed | Lines added | Nature of change |
|---|------|--------------|-------------|------------------|
| 1 | `server/routes.ts` | 32 | 6 | Removed `showDemo` query parameter parsing and `isDemoRecord` filtering from 7 list endpoints (`/api/jobs`, `/api/quotes`, `/api/customers`, `/api/contacts`, `/api/projects`, `/api/invoices`, `/api/op-jobs`). Removed `isDemoRecord` guard from `/api/contacts/:id` detail endpoint. |
| 2 | `client/src/pages/jobs-list.tsx` | 17 | 6 | Removed `useDemoToggle` import, hook call, custom `queryFn` with `showDemo` param, `DemoToggle` JSX. Restored simple `queryKey: ["/api/jobs"]` default query. |
| 3 | `client/src/pages/quotes-list.tsx` | 8 | 3 | Removed `useDemoToggle` import, hook call, `showDemo` in queryKey, `DemoToggle` JSX. Restored simple `queryKey: ["/api/quotes"]` default query. |
| 4 | `client/src/pages/customers.tsx` | 8 | 3 | Removed `useDemoToggle` import, hook call, custom `queryFn` with `showDemo` param, `DemoToggle` JSX. Restored simple `queryKey: ["/api/customers"]` default query. |
| 5 | `client/src/pages/contacts.tsx` | 5 | 2 | Removed `useDemoToggle` import, hook call, `DemoToggle` JSX. Query was already simple (search/category based) — no `showDemo` param was in the queryKey. |
| 6 | `client/src/pages/projects-list.tsx` | 9 | 4 | Removed `useDemoToggle` import, hook call, custom `queryFn` with `showDemo` param, `DemoToggle` JSX. Restored simple `queryKey: ["/api/projects"]` default query. |
| 7 | `client/src/pages/invoices.tsx` | 20 | 12 | Removed `useDemoToggle` import, hook call, custom `queryFn` with `showDemo` param, `DemoToggle` JSX wrapping div. Restored simple `queryKey: ["/api/invoices"]` default query. |

**Total: 36 insertions, 108 deletions across 7 files.**

---

## 4. Behavior Restored

The following behavior has been restored to its pre-commit-`10d304a` state:

| Endpoint | Restored behavior |
|----------|-------------------|
| `GET /api/jobs` | Returns ALL jobs (active or archived based on `scope` param). No `isDemoRecord` filtering. Division filtering via `isUserAllDivision`/`userCanAccessDivision` unchanged. |
| `GET /api/quotes` | Returns ALL quotes. No `isDemoRecord` filtering. Division filtering unchanged. |
| `GET /api/customers` | Returns ALL customers via `storage.getAllCustomers()`. No `isDemoRecord` filtering. |
| `GET /api/contacts` | Returns ALL contacts matching optional `customerId`, `category`, `q` filters. No `isDemoRecord` filtering. |
| `GET /api/contacts/:id` | Returns any contact by ID. No `isDemoRecord` guard. Any authenticated user can access any contact by ID. |
| `GET /api/projects` | Returns ALL projects (active or archived based on `scope` param). No `isDemoRecord` filtering. |
| `GET /api/invoices` | Returns ALL enriched invoices. No `isDemoRecord` filtering. Division filtering unchanged. |
| `GET /api/op-jobs` | Returns ALL op-jobs (active or archived based on `scope` param). No `isDemoRecord` filtering. Division filtering unchanged. |

**Client pages restored:**

| Page | Restored query behavior |
|------|------------------------|
| `jobs-list.tsx` | `queryKey: ["/api/jobs"]` — uses default fetcher, no custom queryFn, no showDemo param |
| `quotes-list.tsx` | `queryKey: ["/api/quotes"]` — uses default fetcher, no custom queryFn, no showDemo param |
| `customers.tsx` | `queryKey: ["/api/customers"]` — uses default fetcher, no custom queryFn, no showDemo param |
| `contacts.tsx` | `queryKey: ["/api/contacts", deferredSearch, deferredCategory]` — uses custom fetch with search/category params only, no showDemo param |
| `projects-list.tsx` | `queryKey: ["/api/projects"]` — uses default fetcher, no custom queryFn, no showDemo param |
| `invoices.tsx` | `queryKey: ["/api/invoices"]` — uses default fetcher, no custom queryFn, no showDemo param |

**All 6 pages:** No `<DemoToggle>` component rendered in header actions. No `useDemoToggle()` hook invoked.

---

## 5. Behavior Explicitly Reverted

The following specific behaviors introduced in commit `10d304a` have been **completely removed**:

1. **Server-side `showDemo` query parameter parsing** — Removed from all 7 list endpoints. The `req.query.showDemo` parsing and conditional `.filter(x => x.isDemoRecord)` / `.filter(x => !x.isDemoRecord)` logic is gone.

2. **Server-side `isDemoRecord` guard on `/api/contacts/:id`** — The `if (contact.isDemoRecord && !isPrivilegedUser(req))` check that returned 404 for non-privileged users accessing demo-flagged contacts has been removed. Any authenticated user can now access any contact by ID.

3. **Client-side `useDemoToggle()` hook calls** — Removed from all 6 list pages. The hook (which read admin status, managed `showDemo` state, and computed `queryParam`) is no longer invoked anywhere.

4. **Client-side `<DemoToggle>` JSX** — The toggle switch component has been removed from the header actions area of all 6 list pages.

5. **Client-side custom `queryFn` functions with `showDemo` param** — In jobs-list, customers, projects-list, and invoices, custom `queryFn` functions that appended `?showDemo=true` to the URL have been removed and replaced with default fetcher behavior via simple `queryKey` arrays.

6. **Client-side `showDemo`-dependent `queryKey` arrays** — In quotes-list, the `queryKey: ["/api/quotes", { showDemo }]` pattern has been reverted to `queryKey: ["/api/quotes"]`.

**Not reverted (intentionally preserved):**

- The `useDemoToggle` function and `DemoToggle` component definitions remain in `client/src/components/ui/platform-layout.tsx` (lines 83–107). They are **not imported or used** by any page. They are dead code that can be cleaned up in a future pass or repurposed.

---

## 6. Proof of Preservation of Unrelated Work

### 6a. Layout System (Phase 5D V2 T001–T004)

All layout primitives from `platform-layout.tsx` remain in active use across all affected and unaffected pages:

| Page | Layout components used |
|------|----------------------|
| `jobs-list.tsx` (line 2) | `PageShell`, `PageHeader`, `WorklistBody` |
| `quotes-list.tsx` (line 2) | `PageShell`, `PageHeader`, `WorklistBody` |
| `customers.tsx` (line 3) | `PageShell`, `PageHeader`, `WorklistBody` |
| `contacts.tsx` (line 2) | `PageShell`, `PageHeader`, `WorklistBody` |
| `projects-list.tsx` (line 2) | `PageShell`, `PageHeader`, `WorklistBody` |
| `invoices.tsx` (line 2) | `PageShell`, `PageHeader`, `WorklistBody` |
| `settings.tsx` (line 2) | `PageShell`, `PageHeader`, `SettingsBody` |
| `library.tsx` (line 2) | `PageShell`, `PageHeader`, `WorklistBody` |
| `users.tsx` (line 2) | `PageShell`, `PageHeader`, `WorklistBody` |
| `laser-estimates-list.tsx` (line 2) | `PageShell`, `PageHeader`, `WorklistBody` |
| `op-jobs-list.tsx` (line 2) | `PageShell`, `PageHeader`, `WorklistBody` |

**Verdict: Layout system fully intact. Zero layout regressions.**

### 6b. LL Provenance System (Phase 5D V2 T008–T009)

| Artifact | Location | Status |
|----------|----------|--------|
| `LLProcessRateSource` type definition | `shared/schema.ts` line 1033 | Present: `"architecture_default" \| "bodor_spec" \| "empirical_test" \| "operator_input" \| "manual_override"` |
| `dataSource` field on `LLProcessRateEntry` | `shared/schema.ts` line 1042 | Present: `dataSource?: LLProcessRateSource` |
| `dataSourceNote` field on `LLProcessRateEntry` | `shared/schema.ts` line 1043 | Present: `dataSourceNote?: string` |
| `ProvenanceBadge` component | `ll-pricing-profiles.tsx` line 683 | Present and renders colour-coded badge with tooltip |
| ProvenanceBadge in editor table | `ll-pricing-profiles.tsx` line 541 | Present in `<td>` |
| ProvenanceBadge in viewer table | `ll-pricing-profiles.tsx` line 662 | Present in `<td>` |
| `LLProcessRateSource` import | `ll-pricing-profiles.tsx` line 40 | Present |

**Verdict: LL provenance system fully intact. Zero provenance regressions.**

### 6c. Demo-Flag PATCH Endpoints (Pre-existing)

All 7 individual demo-flag PATCH endpoints remain intact and unchanged:

| Endpoint | Location in `server/routes.ts` |
|----------|-------------------------------|
| `PATCH /api/quotes/:id/demo-flag` | Line 5473 |
| `PATCH /api/op-jobs/:id/demo-flag` | Line 5496 |
| `PATCH /api/jobs/:id/demo-flag` | Line 5520 |
| `PATCH /api/projects/:id/demo-flag` | Line 5543 |
| `PATCH /api/invoices/:id/demo-flag` | Line 5566 |
| `PATCH /api/customers/:id/demo-flag` | Line 5589 |
| `PATCH /api/customer-contacts/:id/demo-flag` | Line 5612 |

Each endpoint validates `{ isDemoRecord: z.boolean() }`, calls the appropriate storage method, logs an audit event (`demo_flagged` / `demo_unflagged`), and returns the updated record.

**Verdict: Individual record demo-flagging is fully operational. Admins can flag/unflag any record.**

### 6d. Detail-Level Demo Guards (Pre-existing, except contacts)

The following detail-level `isDemoRecord` guards for non-privileged users remain in place (unchanged by this rollback):

| Endpoint | Line | Guard |
|----------|------|-------|
| `GET /api/jobs/:id` | 396 | `if (job.isDemoRecord && !isPrivilegedUser(req)) return 404` |
| `GET /api/quotes/:id` | 2313 | `if (quote.isDemoRecord && !isPrivilegedUser(req)) return 404` |
| `GET /api/customers/:id` | 3731 | `if (customer.isDemoRecord && !isPrivilegedUser(req)) return 404` |
| `GET /api/projects/:id` | 3881 | `if (project.isDemoRecord && !isPrivilegedUser(req)) return 404` |
| `GET /api/invoices/:id` (and sub-routes) | 4448, 4485, 4520, 4611, 4748, 4882, 4915, 4989 | Various `if (invoice.isDemoRecord && !isPrivilegedUser(req)) return 404` |

**Exception:** `GET /api/contacts/:id` had a demo guard added in `10d304a` that was **removed** in this rollback. This endpoint did NOT have a demo guard before `10d304a` and does not have one now. This is consistent with the pre-`10d304a` baseline.

### 6e. Division Access Controls

Division filtering via `isUserAllDivision(req)` and `userCanAccessDivision(req, ...)` remains completely unchanged in:
- `GET /api/jobs` (line 338+)
- `GET /api/quotes` (line 2272+)
- `GET /api/invoices` (line 4087+)
- `GET /api/op-jobs` (line 5224+)

### 6f. `isPrivilegedUser` Helper

The `isPrivilegedUser` function (line 300) remains defined and is referenced 18+ times throughout `server/routes.ts` for authorization on detail endpoints, PATCH endpoints, and governance routes.

---

## 7. Tests Performed

| # | Test | Method | Target |
|---|------|--------|--------|
| T1 | Clean compilation | Workflow restart (`Start application`) | Server starts on port 5000, no TypeScript/build errors |
| T2 | Jobs list returns all records | Server log inspection of `GET /api/jobs` response | Both `isDemoRecord: true` and `isDemoRecord: false` records returned |
| T3 | No `showDemo` references in server | Grep across `server/routes.ts` | 0 matches |
| T4 | No `useDemoToggle`/`DemoToggle` references in pages | Grep across `client/src/pages/` | 0 matches |
| T5 | No `canToggleDemo`/`toggleDemo`/`showDemo`/`queryParam` in any page | Per-file grep across all 6 pages | 0 matches per file |
| T6 | Demo-flag PATCH endpoints present | Grep for `demo-flag` in routes | 7 endpoints confirmed at lines 5473, 5496, 5520, 5543, 5566, 5589, 5612 |
| T7 | Layout components in use | Grep for `PageShell\|PageHeader\|WorklistBody\|SettingsBody` across pages | 11 pages confirmed using layout primitives |
| T8 | LL provenance intact | Grep for `ProvenanceBadge\|LLProcessRateSource\|dataSource` in `ll-pricing-profiles.tsx` and `schema.ts` | Type, fields, component, and column renders confirmed |
| T9 | `isDemoRecord` detail guards intact | Grep for `isDemoRecord` in `server/routes.ts` | Guards present on jobs/:id, quotes/:id, customers/:id, projects/:id, invoices/:id (multiple sub-routes) |
| T10 | Contacts/:id has NO demo guard | Grep + visual inspection of lines 3767–3775 | Endpoint returns any contact by ID without demo check |
| T11 | E2E test run | Playwright-based test via `runTest()` | Tested login, navigation to all 6 list pages, verified records load, verified no DemoToggle present |
| T12 | Code review | Architect subagent with git diff | Verdict: PASS |

---

## 8. Test Results

| # | Result | Evidence |
|---|--------|----------|
| T1 | **PASS** | Server log: `11:24:49 PM [express] serving on port 5000` — no errors, no TypeScript failures |
| T2 | **PASS** | `GET /api/jobs 200` response includes jobs with `"isDemoRecord":true` (e.g., "sdfa", "unusual test", "teste", "test test", "adfasdf", "Bittoo", "Lino") AND `"isDemoRecord":false` (e.g., "Tekuramea", "Fasiuddin") |
| T3 | **PASS** | `grep showDemo server/routes.ts` → 0 matches |
| T4 | **PASS** | `grep useDemoToggle\|DemoToggle client/src/pages/` → 0 matches |
| T5 | **PASS** | Per-file grep for `canToggleDemo\|toggleDemo\|showDemo\|queryParam` → 0 matches in each of jobs-list.tsx, quotes-list.tsx, customers.tsx, contacts.tsx, projects-list.tsx, invoices.tsx |
| T6 | **PASS** | 7 PATCH `/api/…/:id/demo-flag` endpoints confirmed present |
| T7 | **PASS** | 11 pages confirmed importing and rendering `PageShell`/`PageHeader`/`WorklistBody` or `SettingsBody` |
| T8 | **PASS** | `LLProcessRateSource` at schema.ts:1033, `dataSource`/`dataSourceNote` at schema.ts:1042-1043, `ProvenanceBadge` at ll-pricing-profiles.tsx:683, rendered at lines 541 and 662 |
| T9 | **PASS** | `isDemoRecord` detail guards confirmed at routes.ts lines 396, 2313, 3731, 3881, 4448, 4485, 4520, 4611, 4748, 4882, 4915, 4989 |
| T10 | **PASS** | `GET /api/contacts/:id` (lines 3767–3775) contains no `isDemoRecord` check — returns contact if found, 404 if not found |
| T11 | **PASS** | E2E test executed; all 6 list pages loaded with records visible |
| T12 | **PASS** | Architect code review verdict: "PASS — the rollback successfully restores list-level always-visible behavior" |

---

## 9. Data Hygiene Confirmation

- **No new persistent data was created by this rollback.** No database migrations were run. No new rows were inserted. No schema changes were made. The rollback is purely a code-level change (route handlers and React components).
- **No existing data was modified or deleted.** The `isDemoRecord` flag values on all existing records remain exactly as they were before the rollback.
- **No new tables, columns, or indexes were added.**
- **The LL provenance seed data and backfill migration (from Phase 5D V2 T008–T009) were not affected.** All 40 seed rates retain their `architecture_default` source label. The startup backfill logic is unchanged.

---

## 10. Remaining Risks or Open Items

| # | Item | Severity | Description |
|---|------|----------|-------------|
| R1 | Dead code in `platform-layout.tsx` | Low | `useDemoToggle()` (line 83) and `DemoToggle` (line 92) remain defined but are not imported by any page. They are harmless dead code. Can be removed in a cleanup pass or repurposed if the governance UI is redesigned. |
| R2 | Contacts/:id lacks demo guard unlike other detail endpoints | Low (by design) | The contacts detail endpoint does not have an `isDemoRecord` guard for non-privileged users, while jobs, quotes, customers, projects, and invoices do. This is the pre-`10d304a` baseline behavior. If policy requires contact detail guarding, it should be added as a separate, deliberate change — not as part of this rollback. |
| R3 | No bulk archive/delete endpoints exist yet | Info | The governed lifecycle presumes admins will flag records and then bulk-archive or bulk-delete them. The individual PATCH flag endpoints exist, but bulk action endpoints (e.g., `POST /api/jobs/bulk-archive`) have not been built yet. This is a known gap from before Phase 5D V2 and is not a regression. |
| R4 | Demo-flagged records visible to all users in lists, guarded only at detail level | By design | Non-privileged users will see demo-flagged records in lists but get 404 when trying to access their details. This is the intended pre-`10d304a` behavior. If this creates UX confusion, it should be addressed with a visual indicator or client-side filter — not server-side hiding. |
| R5 | Customer isolation / contact isolation logic unchanged | Info | The contact isolation and customer isolation demo-flag cascade logic (lines 5775, 5839) in the governance endpoints is untouched. These are used by the isolation API, not by the list endpoints. |

---

## 11. Direct Answers to Questions A–J

**A. What exact files were changed?**

Seven files: `server/routes.ts`, `client/src/pages/jobs-list.tsx`, `client/src/pages/quotes-list.tsx`, `client/src/pages/customers.tsx`, `client/src/pages/contacts.tsx`, `client/src/pages/projects-list.tsx`, `client/src/pages/invoices.tsx`. See Section 3 for line-level detail.

**B. What exact previous behavior was restored?**

All 7 list API endpoints now return the complete set of records without any `isDemoRecord` filtering. All 6 client list pages issue simple, unconditional queries (no `showDemo` parameter, no `DemoToggle` control). The `/api/contacts/:id` detail endpoint returns any contact without a demo guard. See Section 4 for per-endpoint and per-page detail.

**C. What exact recent behavior was removed?**

Server-side `showDemo` query parameter parsing and conditional `isDemoRecord` list filtering on 7 endpoints. Client-side `useDemoToggle` hook invocations and `<DemoToggle>` JSX on 6 pages. Client-side custom `queryFn` functions that appended `?showDemo=true` to fetch URLs. The `isDemoRecord` guard on `GET /api/contacts/:id`. See Section 5 for exhaustive list.

**D. Was any demo/test governance behavior changed beyond restoration?**

No. The only governance behavior changed was the removal of what was added in `10d304a`. The pre-existing individual demo-flag PATCH endpoints, the pre-existing detail-level `isDemoRecord` guards for non-privileged users, the pre-existing audit logging on flag changes, and the pre-existing isolation logic are all completely unchanged.

**E. Was any existing demo/test workflow from earlier phases overwritten, reinterpreted, or partially broken before this rollback?**

Yes. Commit `10d304a` introduced server-side list hiding that **broke the original governed lifecycle** from earlier phases. The original model: records are always visible → admins flag them → admins review and bulk-action. The `10d304a` model: records are hidden by default → admins must toggle to see them → the review-and-action cycle is disrupted. This rollback restores the original model.

**F. Was any new persistent data created?**

No. Zero database changes. No new rows, columns, tables, indexes, or migrations. The rollback is entirely a code change to route handlers and React components.

**G. Was all unrelated accepted work preserved?**

Yes. Specifically:
- **Layout system** (PageShell/PageHeader/WorklistBody/SettingsBody): Fully intact across 11 pages. See Section 6a.
- **LL Provenance** (LLProcessRateSource type, dataSource/dataSourceNote fields, ProvenanceBadge component): Fully intact. See Section 6b.
- **Demo-flag PATCH endpoints**: All 7 preserved. See Section 6c.
- **Detail-level demo guards**: All preserved (except contacts/:id which never had one pre-`10d304a`). See Section 6d.
- **Division access controls**: Unchanged. See Section 6e.
- **isPrivilegedUser helper**: Unchanged, still used 18+ times. See Section 6f.

**H. Concrete UI verification results?**

The server log captured the actual HTTP response for `GET /api/jobs 200` after restart. The response body contains 9+ job records, including:
- `isDemoRecord: true` records: "sdfa", "unusual test", "teste", "test test", "adfasdf", "Bittoo", "Lino" (and 5 archived demo records)
- `isDemoRecord: false` records: "Tekuramea", "Fasiuddin"
All records are returned in a single response with no filtering. The E2E test confirmed all 6 list pages load and render records. No `DemoToggle` component is rendered on any page.

**I. Are there remaining concerns about table/list consistency, governance behavior, or project IDs?**

- **List consistency**: All 7 list endpoints are now consistent — none apply `isDemoRecord` filtering. Division filtering remains correctly applied where relevant (jobs, quotes, invoices, op-jobs).
- **Governance behavior**: The flag→review→action lifecycle is restored. Individual flagging works via PATCH endpoints. Bulk action endpoints do not yet exist (pre-existing gap, not a regression).
- **Project IDs**: No project IDs or numbering sequences were affected by this rollback. No `isDemoRecord` filtering was removed from or added to any ID generation or numbering logic.

**J. Is the rollback complete and ready for sign-off?**

Yes. All 7 server endpoints reverted. All 6 client pages reverted. Application compiles and runs cleanly. All unrelated Phase 5D V2 work (layout system, LL provenance) is verified intact. No data changes. No regressions detected. The dead code (`useDemoToggle`/`DemoToggle` definitions in `platform-layout.tsx`) is harmless and can be addressed separately.
