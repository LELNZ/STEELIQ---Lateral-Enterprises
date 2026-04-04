# SteelIQ — Phase 4C Governance Hardening Forensic Report

**Report Date**: 4 April 2026  
**Author**: Automated Forensic Agent  
**Scope**: Post-hardening verification of LL pricing governance stack  
**Environment**: Replit development (PostgreSQL + Express + React)  
**Login Verified**: `admin` / `Password1234`  
**Commit Under Review**: `ec1d1d9a` — "Improve pricing profile activation and estimate creation security"

---

## 1. Executive Summary

This report provides enterprise-grade forensic verification of the three hardening fixes applied after the Phase 4C implementation:

1. **Partial unique index moved into Drizzle schema** — the `idx_ll_pricing_profiles_single_active` constraint is now defined in `shared/schema.ts` and confirmed present in the live database, ensuring it survives schema pushes.
2. **Activation SQL hardened** — the activate handler now includes `WHERE status = 'approved' AND division_key = 'LL'` with `rowCount === 1` validation, preventing phantom activations.
3. **Approval dialog race condition fixed** — the confirmation dialog now captures action parameters as mutation variables before the dialog closes, preventing null-reference crashes.

Additionally, a fourth defect was discovered during this forensic investigation and remediated:

4. **PricingSettingsViewer crash on incomplete settings** — the admin UI's settings viewer crashed with `Cannot read properties of undefined (reading 'o2PricePerLitre')` when profiles had incomplete `llPricingSettingsJson` data. Null guards added to all settings sections.

**Verdict**: All critical governance hardening is verified complete. The system is **ready for GitHub push and next implementation phase**.

---

## 2. Scope Under Review

| Area | Description |
|------|-------------|
| Tables | `ll_pricing_profiles`, `ll_pricing_audit_log`, traceability columns on `laser_estimates` and `quotes` |
| Endpoints | 9 LL pricing profile REST endpoints + estimate POST/PATCH + quote create |
| UI Surfaces | `/ll-pricing-profiles` admin page, `/laser-estimate/new` builder badge |
| Hardening | Server-side stamping, DB single-active index, transactional activation, row-count validation |
| Isolation | LJ joinery + LE engineering surfaces must be unaffected |

---

## 3. Architectural Position

```
┌──────────────────────────────────────────────────────────────────┐
│                    SteelIQ Architecture                          │
│                                                                  │
│  ┌──────────────┐    ┌───────────────────────────────────────┐   │
│  │  React SPA   │    │         Express API Server            │   │
│  │              │    │                                       │   │
│  │ Profile List ├───►│ GET /api/ll-pricing-profiles          │   │
│  │ Profile CRUD ├───►│ POST/PATCH /api/ll-pricing-profiles/* │   │
│  │ Builder Badge├───►│ GET /api/ll-pricing-profiles/active   │   │
│  │              │    │                                       │   │
│  │ Estimate     ├───►│ POST /api/laser-estimates             │   │
│  │ Builder      │    │   ↓ Server resolves active profile    │   │
│  │ (NO pricing  │    │   ↓ Stamps pricingProfileId/Label     │   │
│  │  fields sent)│    │   ↓ Client fields IGNORED (Zod strip) │   │
│  └──────────────┘    └───────────────┬───────────────────────┘   │
│                                      │                           │
│                      ┌───────────────▼───────────────────────┐   │
│                      │        PostgreSQL                     │   │
│                      │                                       │   │
│                      │ ll_pricing_profiles                   │   │
│                      │   UNIQUE INDEX (division_key)         │   │
│                      │   WHERE status='active'               │   │
│                      │                                       │   │
│                      │ ll_pricing_audit_log                  │   │
│                      │ laser_estimates (traceability cols)   │   │
│                      │ quotes (traceability cols)            │   │
│                      └───────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

**Key architectural decision**: Estimate and quote pricing is stamped **server-side only**. The client never sends `pricingProfileId`, `pricingProfileLabel`, or `pricedAt`. These fields are stripped by Zod schema parsing (default behavior: unknown keys dropped) and overwritten by server-resolved active profile data. This is the correct, enterprise-grade approach.

---

## 4. Files Inspected

| File | Purpose | Lines |
|------|---------|-------|
| `shared/schema.ts` | Data model, Drizzle table definitions, partial unique index | ~1015 |
| `server/routes.ts` | All API endpoints, server-side stamping, transactional activation | ~6886 |
| `server/storage.ts` | Storage interface + DatabaseStorage CRUD | ~2500+ |
| `client/src/pages/ll-pricing-profiles.tsx` | Admin governance UI | ~780 |
| `client/src/pages/laser-quote-builder.tsx` | Builder with profile badge | ~900+ |
| `client/src/App.tsx` | Route registration | ~140 |
| `client/src/lib/queryClient.ts` | API request utility | ~58 |

---

## 5. Files Changed Since Prior Phase (Phase 4B/4C baseline)

Based on commit `ec1d1d9a`:

| File | Change | Reason |
|------|--------|--------|
| `shared/schema.ts` | Added `uniqueIndex("idx_ll_pricing_profiles_single_active")` to `llPricingProfiles` table definition | Schema durability — index now survives `db:push` |
| `server/routes.ts` | Hardened activate UPDATE with `WHERE status = 'approved' AND division_key = 'LL'` + `rowCount` validation; transactional BEGIN/COMMIT/ROLLBACK | Prevent phantom activation, atomic supersede |
| `client/src/pages/ll-pricing-profiles.tsx` | Fixed AlertDialog race condition by capturing action as mutation variable; added null guards to PricingSettingsViewer | UI stability |
| `client/src/pages/laser-quote-builder.tsx` | Removed `pricingProfileId`, `pricingProfileLabel`, `pricedAt` from client mutation payloads | Server-side trust only |
| `reports/phase-4c-forensic-report.md` | Created Phase 4C forensic report | Documentation |

---

## 6. Live Data Model Verification

### 6.1 `ll_pricing_profiles` Table — VERIFIED IN LIVE DB

```
       column_name        |          data_type          | is_nullable |  column_default
--------------------------+-----------------------------+-------------+-------------------
 id                       | character varying           | NO          | gen_random_uuid()
 division_key             | text                        | NO          | 'LL'::text
 profile_name             | text                        | NO          |
 version_label            | text                        | NO          |
 status                   | text                        | NO          | 'draft'::text
 effective_from           | timestamp without time zone | YES         |
 notes                    | text                        | YES         | ''::text
 ll_pricing_settings_json | jsonb                       | NO          |
 created_by               | character varying           | YES         |
 created_at               | timestamp without time zone | YES         | now()
 updated_at               | timestamp without time zone | YES         | now()
 approved_by              | character varying           | YES         |
 approved_at              | timestamp without time zone | YES         |
 activated_by             | character varying           | YES         |
 activated_at             | timestamp without time zone | YES         |
```

**15 columns** — all lifecycle fields present. Schema matches `shared/schema.ts` definition.

### 6.2 Partial Unique Index — VERIFIED IN LIVE DB

```sql
               indexname               |                                    indexdef
---------------------------------------+--------------------------------------------------------------
 idx_ll_pricing_profiles_single_active | CREATE UNIQUE INDEX idx_ll_pricing_profiles_single_active
                                       |   ON public.ll_pricing_profiles USING btree (division_key)
                                       |   WHERE (status = 'active'::text)
 ll_pricing_profiles_pkey              | CREATE UNIQUE INDEX ll_pricing_profiles_pkey
                                       |   ON public.ll_pricing_profiles USING btree (id)
```

**Two indexes confirmed**: primary key + partial unique on `division_key WHERE status = 'active'`.

**Schema durability**: The index is now defined in `shared/schema.ts` at line 396:
```typescript
uniqueIndex("idx_ll_pricing_profiles_single_active")
  .on(table.divisionKey)
  .where(sql`status = 'active'`)
```
This means `db:push` will recreate it if the database is rebuilt.

### 6.3 `ll_pricing_audit_log` Table — VERIFIED IN LIVE DB

```
    column_name     |          data_type          | is_nullable |  column_default
--------------------+-----------------------------+-------------+-------------------
 id                 | character varying           | NO          | gen_random_uuid()
 profile_id         | character varying           | NO          |
 event_type         | text                        | NO          |
 actor_user_id      | character varying           | YES         |
 actor_display_name | text                        | YES         |
 summary            | text                        | NO          |
 metadata_json      | jsonb                       | YES         |
 created_at         | timestamp without time zone | YES         | now()
```

**8 columns** — fully functional audit trail. Verified with runtime data (8 entries from lifecycle test).

### 6.4 Traceability Columns — VERIFIED IN LIVE DB

**`laser_estimates`**:
```
      column_name      |          data_type
-----------------------+-----------------------------
 pricing_profile_id    | character varying
 pricing_profile_label | text
 priced_at             | timestamp without time zone
```

**`quotes`**:
```
      column_name      |          data_type
-----------------------+-----------------------------
 pricing_profile_id    | character varying
 pricing_profile_label | text
 priced_at             | timestamp without time zone
```

Both tables carry identical traceability columns. Schema-DB alignment confirmed.

---

## 7. Governance Hardening Verification

### 7.1 Server-Side Estimate Stamping (Critical Decision Point)

**STATUS: CONFIRMED SERVER-SIDE ONLY**

This is the most critical governance decision. Evidence:

**Zod Schema (server/routes.ts lines 1408–1415)**:
```typescript
const body = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  projectAddress: z.string().optional().default(""),
  itemsJson: z.array(z.any()).optional().default([]),
  notes: z.string().optional().default(""),
  customerId: z.string().optional(),
  contactId: z.string().optional(),
}).parse(req.body);
```

The Zod schema does **not** include `pricingProfileId`, `pricingProfileLabel`, or `pricedAt`. Zod's default parsing behavior strips unknown keys — any client-sent pricing fields are silently discarded.

**Server-side resolution (server/routes.ts lines 1417–1432)**:
```typescript
const activeProfile = await storage.getActiveLLPricingProfile();
// ...
pricingProfileId: activeProfile?.id || null,
pricingProfileLabel: activeProfile ? `${activeProfile.profileName} (${activeProfile.versionLabel})` : null,
pricedAt: activeProfile ? now : null,
```

The server independently resolves the active pricing profile and stamps the estimate. This applies to both POST (create) and PATCH (update) endpoints.

**Runtime proof — hostile client payload test**:
```
Client sent:     pricingProfileId: "HOSTILE_CLIENT_ID"
                 pricingProfileLabel: "HOSTILE_CLIENT_LABEL"
                 pricedAt: "1999-01-01T00:00:00.000Z"

Server persisted: pricingProfileId: "27f700db-0c96-42f5-bfab-3c785b92ef17"
                  pricingProfileLabel: "Q3 Updated Rates (v2.0)"
                  pricedAt: "2026-04-04T10:43:57.903Z"

DB verification:  pricing_profile_id = 27f700db-... (matches active profile)
                  pricing_profile_label = "Q3 Updated Rates (v2.0)"
                  priced_at = 2026-04-04 10:43:58.009
```

**Client-side cleanup confirmed**: `laser-quote-builder.tsx` no longer sends `pricingProfileId`, `pricingProfileLabel`, or `pricedAt` in create/update mutation payloads.

**Mechanism**: Zod strips unknown keys by default parsing (not explicit rejection). The server then overwrites with its own resolved values. Even if a future code change accidentally re-added these client fields, the server-side stamping would overwrite them.

### 7.2 Quote Stamping

**STATUS: CONFIRMED SERVER-SIDE ONLY**

Quote creation (server/routes.ts lines 1634–1647) follows the same pattern:
```typescript
if (divisionCode === "LL") {
  const activeProfile = await storage.getActiveLLPricingProfile();
  if (activeProfile) {
    quotePricingProfileId = activeProfile.id;
    quotePricingProfileLabel = `${activeProfile.profileName} (${activeProfile.versionLabel})`;
  }
}
```

Quotes are stamped server-side during creation with `pricedAt = NOW()`.

### 7.3 DB-Level Single-Active Enforcement

**STATUS: PROVEN COMPLETE**

**Test 1 — INSERT second active profile**:
```sql
INSERT INTO ll_pricing_profiles (id, division_key, profile_name, version_label, status, ll_pricing_settings_json)
VALUES ('test-dupe-active', 'LL', 'Rogue Active', 'v99', 'active', '{"version":"ll-v1"}');
```
**Result**: `ERROR: duplicate key value violates unique constraint "idx_ll_pricing_profiles_single_active"`
`DETAIL: Key (division_key)=(LL) already exists.`

**Test 2 — UPDATE to create second active**:
```sql
UPDATE ll_pricing_profiles SET status = 'active' WHERE id = '495f4b14-...';
```
**Result**: `ERROR: duplicate key value violates unique constraint "idx_ll_pricing_profiles_single_active"`
`DETAIL: Key (division_key)=(LL) already exists.`

**Conclusion**: It is **impossible** at the database level to have two active LL pricing profiles simultaneously. This constraint operates independently of application logic.

### 7.4 Activation Hardening

**STATUS: FULLY VERIFIED**

| Scenario | Expected | Actual | Status |
|----------|----------|--------|--------|
| Activate draft profile | Rejected with "Only approved profiles can be activated" | `"error":"Only approved profiles can be activated. Current status: draft"` | PASS |
| Activate approved profile | Success, status → active | `"status":"active"` | PASS |
| Activate non-existent profile | Rejected with "Profile not found" | `"error":"Profile not found"` | PASS |
| Activate superseded profile | Rejected with status guard | `"error":"Only approved profiles can be activated. Current status: superseded"` | PASS |
| Activation supersedes previous active | Previous → superseded | v1.0 status changed from `active` to `superseded` | PASS |
| Only 1 active after supersede | COUNT = 1 | `SELECT COUNT(*) ... WHERE status = 'active' → 1` | PASS |
| Audit entries written | 7 entries for full lifecycle | 7 entries verified (created, approved, activated, duplicated, approved, superseded, activated) | PASS |
| Row-count validation | `activatedCount !== 1` throws | Code verified at routes.ts:1265 | PASS |

**Activation SQL (server/routes.ts line 1264)**:
```sql
UPDATE ll_pricing_profiles
SET status = 'active', activated_by = $1, activated_at = $2, effective_from = $2, updated_at = $2
WHERE id = $3 AND status = 'approved' AND division_key = 'LL'
```

The SQL includes three guards:
1. `id = $3` — targets the specific profile
2. `status = 'approved'` — prevents activating non-approved profiles at SQL level
3. `division_key = 'LL'` — prevents cross-division activation

If `rowCount !== 1`, the transaction is rolled back with an explicit error.

### 7.5 Transactional Activation

**STATUS: VERIFIED**

The activate endpoint (server/routes.ts lines 1241–1280) uses:
```
pool.connect() → client
client.query("BEGIN")
  1. UPDATE ... SET status = 'superseded' WHERE status = 'active' AND division_key = 'LL'
  2. INSERT audit entry for superseded profile
  3. UPDATE ... SET status = 'active' WHERE id = $3 AND status = 'approved' AND division_key = 'LL'
  4. Validate rowCount === 1
  5. INSERT audit entry for activated profile
client.query("COMMIT")
```

On any error: `client.query("ROLLBACK")` + `client.release()`.

**Atomicity**: Supersede + activate + audit writes are wrapped in a single transaction. Split-brain state (two active, or zero active after failed activation) is impossible.

---

## 8. Runtime Validation Matrix

| Test ID | Scenario | Method | Result | Evidence |
|---------|----------|--------|--------|----------|
| RV-001 | Profile creation (draft) | API POST | PASS | Profile created with status `draft` |
| RV-002 | Profile approval | API POST /:id/approve | PASS | Status changed to `approved` |
| RV-003 | Profile activation | API POST /:id/activate | PASS | Status changed to `active` |
| RV-004 | Profile supersede on activation | API POST (second activate) | PASS | Previous active → `superseded` |
| RV-005 | Activate draft (negative) | API POST | PASS | Error: "Only approved profiles can be activated" |
| RV-006 | Activate non-existent (negative) | API POST | PASS | Error: "Profile not found" |
| RV-007 | Activate superseded (negative) | API POST | PASS | Error: "Only approved profiles can be activated" |
| RV-008 | DB INSERT second active (negative) | Direct SQL | PASS | Constraint violation error |
| RV-009 | DB UPDATE second active (negative) | Direct SQL | PASS | Constraint violation error |
| RV-010 | Hostile client stamping (create) | API POST /laser-estimates | PASS | Server stamped correct profile, hostile fields ignored |
| RV-011 | Hostile client stamping (update) | API PATCH /laser-estimates/:id | PASS | Server re-stamped correct profile |
| RV-012 | DB verification of stamp | Direct SQL SELECT | PASS | Correct profile ID and label in database |
| RV-013 | Audit trail completeness | Direct SQL SELECT | PASS | 7+ entries with correct event types |
| RV-014 | Active profile count | Direct SQL COUNT | PASS | Always exactly 1 |
| RV-015 | Profile list page load | E2E browser test | PASS | Three profiles with correct status badges |
| RV-016 | Draft profile detail view | E2E browser test | PASS | Draft status, settings visible |
| RV-017 | Active profile detail view | E2E browser test | PASS | Active status, timestamps, settings visible |
| RV-018 | Audit trail visible in UI | E2E browser test | PASS | Audit entries rendered |
| RV-019 | Builder active profile badge | E2E browser test | PASS | Badge shows "Q3 Updated Rates (v2.0)" |
| RV-020 | Approval dialog flow (no race) | E2E browser test | PASS | Approve → toast → status updated, no crash |
| RV-021 | Activation dialog flow (no race) | E2E browser test | PASS | Activate → toast → status updated |
| RV-022 | LJ operations page unaffected | E2E browser test | PASS | /op-jobs renders normally |
| RV-023 | LJ endpoints functional | API GET | PASS | 200 responses from /api/op-jobs, /api/quotes, /api/customers |

---

## 9. Screenshot Evidence Register

All screenshots were captured via automated E2E browser testing during this forensic run.

| # | Description | Step | Verification |
|---|-------------|------|-------------|
| SS-01 | Profile list page with 3 profiles (superseded, active, draft) | Step 1 | Confirmed three profiles with correct status badges |
| SS-02 | Draft profile detail pane (Q4 Preview Rates v3.0-draft) | Step 2 | Draft badge visible, Approve button available |
| SS-03 | Active profile detail pane (Q3 Updated Rates v2.0) | Step 3 | Active badge, activated timestamps, settings sections |
| SS-04 | Audit trail entries on active profile | Step 4 | Created, approved, activated, duplicated, superseded entries visible |
| SS-05 | Laser estimate builder with active profile badge | Step 5 | Badge shows active profile name in builder header |
| SS-06 | LJ operations jobs page (/op-jobs) | Step 6 | Page renders normally, no LL governance elements visible |
| SS-07 | Profile after approval (approved status) | Step 7 | Status changed to approved, Activate button available |
| SS-08 | Profile after activation with supersede visible | Step 8 | New profile active, previous profile superseded |

**Note**: Screenshots were captured by the automated testing agent. The E2E test run completed with status `success` and `Verification gaps: None`.

---

## 10. Defects Found

### DEF-001: PricingSettingsViewer Crash on Incomplete Settings (REMEDIATED)

**Severity**: Medium  
**Discovery**: During forensic E2E testing, clicking an active profile with settings JSON that lacked `gasCosts`, `consumableCosts`, etc. fields caused a React crash:
```
Cannot read properties of undefined (reading 'o2PricePerLitre')
```

**Root Cause**: `PricingSettingsViewer` component in `ll-pricing-profiles.tsx` accessed nested properties (`settings.gasCosts.o2PricePerLitre`) without null guards. Profiles created with minimal `llPricingSettingsJson` (e.g., `{"version":"ll-v1","categories":[]}`) triggered the crash.

**Fix Applied**: Added conditional rendering guards to all settings sections:
- `{gas && (<SettingsSection>...)}`
- `{consumables && (<SettingsSection>...)}`
- `{labour && (<SettingsSection>...)}`
- `{setup && (<SettingsSection>...)}`
- `{settings.commercialPolicy && (<SettingsSection>...)}`
- `{settings.nestingDefaults && (<SettingsSection>...)}`
- `{settings.machineProfiles && (<SettingsSection>...)}`
- `{settings.processRateTables && settings.processRateTables.length > 0 && (<SettingsSection>...)}`

**Status**: REMEDIATED. No crash occurs on profiles with partial settings.

### DEF-002: AlertDialog Race Condition (REMEDIATED — prior fix)

**Severity**: High  
**Discovery**: Prior code review identified that Radix `AlertDialogAction` closes the dialog (nullifying the `action` prop) before the mutation's `onSuccess` callback fires, causing `Cannot read properties of null (reading 'type')`.

**Fix Applied**: Action parameters are now captured as mutation variables via `mutation.mutate({ type: action.type, profileId: action.profileId })`, and `onSuccess` reads from the captured variables rather than the (potentially null) prop.

**Status**: REMEDIATED. E2E testing confirms approve/activate/archive dialogs work without errors.

---

## 11. Isolation Proof

### 11.1 LJ Joinery — UNAFFECTED

| Surface | Endpoint | Status |
|---------|----------|--------|
| Operations jobs list | GET /api/op-jobs | 200 OK |
| Quotes list | GET /api/quotes | 200 OK |
| Customers list | GET /api/customers | 200 OK |
| Jobs page (/op-jobs) | E2E browser test | Renders normally |

No LL governance UI elements (profile badges, pricing profile selectors) appear on LJ operational screens. The `/op-jobs` page was screenshot-verified during E2E testing.

### 11.2 LE Engineering — UNAFFECTED

LE remains a placeholder division. No LE-specific routes, UI pages, or data structures have been added or modified. The `division_key` column on `ll_pricing_profiles` defaults to `'LL'` and the partial unique index scopes to `division_key`, meaning LE would not interfere even if profiles were extended in the future.

### 11.3 Code-Level Isolation

- The `ll_pricing_profiles` and `ll_pricing_audit_log` tables are LL-specific (prefixed `ll_`).
- All LL pricing API endpoints are under `/api/ll-pricing-profiles/*`.
- The builder badge resolution queries `/api/ll-pricing-profiles/active` only from the laser estimate/quote builder.
- LJ quote creation does NOT query `getActiveLLPricingProfile()` — only LL division quotes are stamped.

---

## 12. Readiness Decision

### **READY FOR GITHUB PUSH AND NEXT IMPLEMENTATION PHASE**

**Justification**:

| Criterion | Status |
|-----------|--------|
| Server-side estimate stamping | COMPLETE — client fields stripped, server resolves active profile |
| Server-side quote stamping | COMPLETE — LL quotes stamped on creation |
| DB single-active enforcement | COMPLETE — partial unique index in both live DB and Drizzle schema |
| Transactional activation | COMPLETE — BEGIN/COMMIT/ROLLBACK with row-count validation |
| Audit trail | COMPLETE — all lifecycle events logged with actor attribution |
| Admin UI | COMPLETE — split-pane list/detail, editor, status actions, audit display |
| Builder integration | COMPLETE — active profile badge with 60s stale time |
| Negative-case enforcement | VERIFIED — 9 negative scenarios all correctly rejected |
| LJ/LE isolation | VERIFIED — no governance leakage into other divisions |
| UI stability | VERIFIED — race condition fixed, null guards added |
| Schema durability | VERIFIED — index defined in Drizzle schema, survives db:push |

All critical governance hardening is factually complete and runtime-verified.

---

## 13. Open Risks

| # | Risk | Severity | Detail |
|---|------|----------|--------|
| 1 | **No role-based separation of duties** | Medium | Any admin can create, approve, and activate their own profile. A "maker-checker" model (different users for create vs. approve) is recommended for production governance. |
| 2 | **Single-approver model** | Medium | Approval requires only one admin. Multi-approval workflows are not implemented. |
| 3 | **Pricing values remain business-unverified** | Medium | Calibration defaults are developer-seeded. Business stakeholders must review and verify pricing data before production use. |
| 4 | **No profile diff view** | Low | No side-by-side comparison when reviewing a new profile version against the previous one. |
| 5 | **Zod strips unknown keys silently** | Low | Client-sent pricing fields are silently dropped (Zod default behavior), not explicitly rejected with a 400 error. While the server overwrites values anyway, explicit rejection would provide better API hygiene. Not a security risk but a transparency gap. |
| 6 | **No rate-limiting on profile mutations** | Low | Admin endpoints have no rate limiting. Not critical in current single-tenant deployment. |
| 7 | **Fallback mode not fully testable** | Low | To test the "no active profile" fallback state, an admin would need to archive the active profile or directly delete it in the DB. The system correctly prevents accidental removal via the UI (archive is blocked on active profiles). |
| 8 | **No backup/export for profiles** | Low | Profile settings exist only in the database. No export/import functionality for pricing configurations. |

---

## 14. Recommended Next Phase

### Phase 5 Options (in priority order):

1. **LL Estimate Builder Enhancement** — Material database integration, cut-length calculations, proper line-item pricing against process rate tables, and PDF/Excel export.

2. **Quote Lifecycle Completion** — Quote revision management, customer acceptance tracking, and quote-to-job conversion for LL division.

3. **LE Engineering Division Buildout** — Bring LE from placeholder to functional parity with basic estimate/quote capabilities.

4. **Reporting & Analytics** — Dashboard for pricing profile usage, estimate conversion rates, revenue tracking across divisions.

5. **Governance Enhancement** — Maker-checker approval workflow, profile diff view, pricing value validation rules.

---

*End of Phase 4C Governance Hardening Forensic Report*
