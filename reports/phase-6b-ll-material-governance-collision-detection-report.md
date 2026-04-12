# Phase 6B — LL Material Governance Collision Detection Report

**Date:** 2026-04-12
**Pass type:** Bounded governance hardening — detection and visibility only
**Author:** SteelIQ Agent

---

## 1. Scope

### What this pass was asked to implement

A narrowly scoped governance hardening mechanism to **detect same-key collisions** in LL sheet materials and surface them in a controlled, reviewable way for admin/governance review.

This pass was triggered by the pattern of three sequential manual defect discoveries:
1. PE Protected vs Fibre PE misclassification (10 Aluminium records)
2. Stucco vs Mill collision (1 Aluminium record)
3. Stainless 304 sub-finish grade conflation (43 Stainless Steel records)

The governance gap: operator-risk collisions could enter the LL material library and remain invisible until manually discovered.

### What was out of scope

- Full LL materials cleanup
- Supplier harmonization across all grades/finishes
- Broad taxonomy redesign
- Source-import pipeline rewrite
- Pricing engine changes
- Lifecycle or workflow changes
- Page redesign
- Broad admin IA changes
- Publishing to live
- Broad automatic correction of detected issues

---

## 2. Current Operator Selection Key

### Exact fields used by LL Add Item

The LL Estimate "Add Item" modal uses a cascading filter path to select a sheet material:

| Step | Field | Source column |
|------|-------|-------------|
| 1 | Material Family | `material_family` |
| 2 | Grade | `grade` |
| 3 | Finish | `finish` |
| 4 | Thickness | `thickness` |
| 5 | Sheet Size | `sheet_length` × `sheet_width` |

When a user selects values through steps 1–4, the sheet size dropdown shows all records matching that combination. If more than one record shares the exact same 6-field key, the user sees duplicate entries that are indistinguishable — this is a **same-key collision**.

### Why this defines the collision-risk key

The Add Item cascade is the sole operator-facing selection path for LL sheet materials. Any two active records sharing all 6 fields appear as duplicate/ambiguous entries in the final sheet size selector. The operator has no way to distinguish them — the difference is carried only in product description and/or price, which are not shown in the selection cascade.

The collision key for this governance pass is therefore:
```
(material_family, grade, finish, thickness, sheet_length, sheet_width)
```

This exactly matches the operator-facing selection path in `client/src/pages/laser-quote-builder.tsx`.

---

## 3. Governance Detection Logic

### Exact collision key used

```
material_family | grade | finish | thickness | sheet_length | sheet_width
```

All 6 fields are joined to form a composite key. Any group of 2+ active records sharing this key is flagged as a collision group.

### Active-only by default

The endpoint defaults to scanning active records only (`is_active = true`), matching the operator-facing dataset. An optional `?active=false` parameter scans all records including inactive.

### Fields returned for each collision group

For each collision group, the endpoint returns:
- `collisionKey`: the 6 operator-facing fields
- `recordCount`: number of records sharing the key
- `records[]`: for each record:
  - `id`
  - `supplierName`
  - `productDescription`
  - `pricePerSheetExGst`

### Envelope fields

The response envelope includes:
- `auditType`: "ll-sheet-material-collision-check"
- `scope`: "active-only" or "all-records"
- `totalRecordsScanned`: count of records evaluated
- `collisionGroupCount`: number of collision groups found
- `status`: "CLEAN" or "COLLISIONS_DETECTED"

### Why this is the smallest safe hardening step

This mechanism:
- Uses existing storage interface (`getLlSheetMaterials`) — no new DB queries
- Performs in-memory grouping — no schema changes
- Is read-only — no data modification
- Is a single GET endpoint — no new infrastructure
- Defaults to active-only — matches operator risk surface
- Returns structured JSON — human-reviewable and machine-parseable
- Is surfaced as a governance badge in the Library UI — immediate admin visibility without workflow disruption

---

## 4. Current Dataset Audit Result

### Collision groups currently exist: **NONE**

| Metric | Value |
|--------|-------|
| Total active records scanned | 257 |
| Collision groups found | 0 |
| Status | **CLEAN** |

All three prior defect classes have been successfully resolved:
- PE/Fibre PE: 10 records reclassified (finish field)
- Stucco/Mill: 1 record reclassified (finish field)
- SS 304 sub-finish: 43 records reclassified (grade field)

**Zero same-key collisions remain in the active LL sheet materials dataset.**

### Verification query

```sql
SELECT material_family, grade, finish, thickness, sheet_length, sheet_width,
  COUNT(*) as record_count
FROM ll_sheet_materials
WHERE is_active = true
GROUP BY material_family, grade, finish, thickness, sheet_length, sheet_width
HAVING COUNT(*) > 1
```

Result: **0 rows** — confirmed clean.

---

## 5. Files Changed

| File | Change |
|------|--------|
| `server/routes.ts` | Added `GET /api/ll-sheet-materials/audit/collision-check` endpoint (37 lines) |
| `client/src/pages/library.tsx` | Added collision audit query and governance status badge/banner to SheetMaterialsSection (imports: 2 icons; logic: ~35 lines) |
| `reports/phase-6b-ll-material-governance-collision-detection-report.md` | This report (created) |

---

## 6. Behaviour Impact

### Runtime behaviour changed: YES — governance surface only

| Component | Change | Operator impact |
|-----------|--------|----------------|
| API | New read-only audit endpoint added | None — endpoint is additive, does not modify any existing endpoint |
| Library UI | Governance badge added to each LL sheet material family section header | Admin sees "No collisions" green badge (or red warning if collisions exist) |
| Add Item | No change | Operators unaffected |
| Pricing | No change | No pricing logic touched |
| Estimates | No change | No estimate logic touched |
| LJ/LE | No change | No other division touched |

The runtime change is strictly a **governance visibility surface** — a read-only diagnostic badge on the Library page and a read-only audit API endpoint.

---

## 7. Evidence and Test Scenarios

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Confirm the exact Add Item operator selection key | **PASS** | Verified in `laser-quote-builder.tsx`: cascade filters on material_family → grade → finish → thickness → sheet_length × sheet_width |
| 2 | Confirm governance collision key matches operator path | **PASS** | Endpoint uses identical 6-field key: `material_family\|grade\|finish\|thickness\|sheet_length\|sheet_width` |
| 3 | Audit active ll_sheet_materials for same-key collision groups | **PASS** | `GET /api/ll-sheet-materials/audit/collision-check` returns `{"status":"CLEAN","collisionGroupCount":0,"totalRecordsScanned":257}` |
| 4 | Detection mechanism returns expected fields per collision group | **PASS** | Verified response schema includes collisionKey, recordCount, records[].id/supplierName/productDescription/pricePerSheetExGst |
| 5 | Mechanism defaults to active records only | **PASS** | Default request returns `scope: "active-only"`; `?active=false` returns `scope: "all-records"` |
| 6 | Output is human-reviewable and operationally usable | **PASS** | JSON response is structured with clear envelope and collision group detail; UI badge provides immediate visual governance signal |
| 7 | Zero same-key collisions remain after prior PE/Stucco/SS304 fixes | **PASS** | 0 collision groups across 257 active records |
| 8 | If collisions remain, enumerate them exactly | **N/A** | No collisions exist — confirmed zero |
| 9 | If no collisions remain, explicitly confirm zero | **PASS** | Explicitly confirmed: `collisionGroupCount: 0`, `status: "CLEAN"` |
| 10 | No pricing logic changed | **PASS** | No files in pricing path touched |
| 11 | No workflow/lifecycle logic changed | **PASS** | No workflow or lifecycle files touched |
| 12 | LJ/LE untouched | **PASS** | No LJ or LE routes, pages, or data touched |
| 13 | No schema changes | **PASS** | No schema files modified, no migrations, no new tables |
| 14 | No broad automatic data corrections made | **PASS** | This pass is detection/governance-only — zero data records modified |
| 15 | Pass type: governance-only surface change | **PASS** | Runtime change is strictly additive read-only endpoint + UI badge |

---

## 8. Acceptance Criteria Summary

| Criterion | Result |
|-----------|--------|
| Current Add Item operator-facing selection key explicitly verified | **PASS** |
| Same-key collision detection/governance mechanism implemented | **PASS** |
| Mechanism is operationally usable for admin/governance review | **PASS** |
| Current active LL material dataset explicitly audited against key | **PASS** |
| Remaining collision groups explicitly enumerated or zero confirmed | **PASS** — zero confirmed |
| No schema or architecture drift | **PASS** |
| No unrelated workflow changes | **PASS** |
| No broad automatic data correction | **PASS** |
| Release gate explicit and evidence-based | **PASS** |

---

## 9. Deferred / Not in This Pass

| Issue class | Description | Risk | Recommendation |
|-------------|-------------|------|----------------|
| SS 316 sub-finish conflation | Same grade-collapse pattern as SS 304 exists in 316 family — no current collisions but latent risk | Medium | Investigate in next governance pass |
| Cross-supplier grade harmonization | Macdonald 304L vs Wakefield 304-family grades coexist — no collision but potential confusion | Low | Document and defer to taxonomy design phase |
| Import pipeline validation | No automated collision detection at import time — collisions can still be introduced | High | Implement import-time collision pre-check in future pass |
| Aluminium stucco sizes | Only one stucco record imported; additional stucco sizes exist in supplier data | Low | Defer to next import cycle |
| Automatic collision resolution | This pass detects but does not auto-resolve — human review required | N/A | By design — governance-only pass |
| Admin collision management UI | No ability to resolve collisions from the governance banner (e.g., disable, merge, reclassify) | Medium | Consider in future admin IA pass |

---

## 10. Release Gate

### Push to Git: **YES**

This pass adds a narrowly scoped, read-only governance detection surface. No data was modified. No schema was changed. No existing behaviour was altered. The endpoint and UI badge are additive and safe.

### Publish to live: **NO**

Per control header rules, this pass does not include publishing to live. The governance surface should be reviewed by the project owner before deployment. Additionally, prior data fixes (PE/Stucco/SS304) should be verified in the staging/live environment before this governance layer is published on top.
