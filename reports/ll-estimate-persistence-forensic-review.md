# LL Estimate Persistence Forensic Review — LIVE

**Date:** April 15, 2026
**System:** SteelIQ — Lateral Enterprises
**Scope:** Investigate and resolve LL estimate disappearance in LIVE
**Classification:** Operational governance issue (not a persistence defect)

---

## 1. Executive Summary

LL estimates in LIVE are **persisting correctly**. The reported disappearance was caused by the user explicitly deleting the estimate via the UI delete action, not by a database, filter, or workflow bug. Production deployment logs prove the exact sequence: the estimate was created (201), persisted for 12+ minutes, returned correctly on multiple list and detail fetches, and then the user triggered a DELETE request which was confirmed with `{"ok":true}`.

The underlying issue is that the DELETE endpoint performed a **hard delete** (permanent row removal) rather than a **soft delete** (archive). This has been corrected: the DELETE endpoint now archives the estimate (sets `archivedAt` + `status = "archived"`) instead of permanently removing it. The estimate disappears from the list as before (same UI behavior), but the data row is preserved in the database for audit and recovery.

---

## 2. Reproduction Result

### LIVE Deployment Log Evidence (Exact Timestamps)

| Timestamp | Event | Evidence |
|---|---|---|
| **9:47:00 PM** | `GET /api/laser-estimates` | 304 → `[]` (empty list, no estimates exist yet) |
| **9:50:04 PM** | `POST /api/laser-estimates` | **201 Created** → `LL-EST-0001` (Propharma TKD, 1 item, Aluminium 5052 3mm nameplate) |
| **9:50:04 PM** | `GET /api/laser-estimates/:id` | **200** → estimate returned correctly with all fields |
| **9:50:10 PM** | `GET /api/laser-estimates` | **200** → `[LL-EST-0001]` (estimate appears in list) |
| **10:02:02 PM** | `GET /api/laser-estimates` | **304** → `[LL-EST-0001]` (still in list, 12 minutes later) |
| **10:02:06 PM** | `GET /api/laser-estimates/:id` | **304** → estimate still accessible |
| **10:02:29 PM** | `DELETE /api/laser-estimates/:id` | **200** → `{"ok":true}` — **user explicitly deleted the estimate** |
| **10:02:29 PM** | `GET /api/laser-estimates` | **200** → `[]` (list is empty again) |
| **12:20:45 AM** | `GET /api/laser-estimates` | **304** → `[]` (confirmed empty, 2+ hours later) |

### Current LIVE Database State

| Metric | Value |
|---|---|
| `laser_estimates` row count | **0** (all rows were hard-deleted before fix) |
| `laser_estimates` with `archived_at` set | **0** |
| Quotes linked to laser estimates | **0** (no `source_laser_estimate_id` references) |
| Total quotes in LIVE | 24 (all LJ division) |
| LL quotes in LIVE | 0 |

### DEV Database State (for comparison)

| Metric | Value |
|---|---|
| `laser_estimates` row count | 10 (8 visible + 2 archived from testing) |
| Estimates with status `converted` | 6 |
| Estimates with status `draft` | 2 |
| Estimates with status `archived` | 2 (test records) |
| Linked LL quotes | 6 |

---

## 3. Persistence Path Analysis

### Write Path (POST /api/laser-estimates)

| Step | Implementation | Status |
|---|---|---|
| Request validation | Zod schema validates customerName (required), projectAddress, itemsJson, notes | WORKING |
| Division access check | `userCanAccessDivision(req, "LL")` — admin/owner gets full access | WORKING |
| Estimate number sequence | `getNextLaserEstimateNumber()` from `number_sequences` table | WORKING |
| Pricing profile stamping | Active LL pricing profile auto-attached | WORKING |
| Database INSERT | `storage.createLaserEstimate()` → `db.insert(laserEstimates).values(data).returning()` | WORKING |
| Response | 201 with full estimate object | WORKING |

**Verdict: Write path is fully functional.** The LIVE deployment log confirms a 201 response with complete data.

### Read Path (GET /api/laser-estimates)

| Step | Implementation | Status |
|---|---|---|
| Division access check | `userCanAccessDivision(req, "LL")` | WORKING |
| Query | `db.select().from(laserEstimates).where(isNull(laserEstimates.archivedAt)).orderBy(desc(createdAt))` | WORKING |
| Quote enrichment | Finds linked quotes for converted estimates | WORKING |
| Response | Array of enriched estimates | WORKING |

**Verdict: Read path is fully functional.** The listing query correctly filters by `archivedAt IS NULL` and does not erroneously hide records.

---

## 4. List/Query Visibility Analysis

The `getAllLaserEstimates()` storage method applies a single filter: `isNull(laserEstimates.archivedAt)`. This means:

| Status | archivedAt | Visible in list? |
|---|---|---|
| draft | NULL | YES |
| ready | NULL | YES |
| converted | NULL | YES |
| archived | timestamp | NO |

There is no hidden filtering by status, demo flag, division, user, or any other field. The only way an estimate disappears from the list is if:
1. `archivedAt` is set (soft delete / archive)
2. The row is hard-deleted from the database

In the LIVE incident, **option 2 occurred** — the row was permanently removed by the DELETE endpoint.

---

## 5. Estimate-to-Quote Transition Analysis

When an estimate is converted to a quote via `POST /api/quotes` with `sourceLaserEstimateId`:

| Step | What happens to the estimate |
|---|---|
| Quote created | New quote row with `source_laser_estimate_id` referencing the estimate |
| Estimate status update | `UPDATE laser_estimates SET status = 'converted'` |
| Estimate visibility | **REMAINS VISIBLE** in the list (archivedAt stays NULL) |
| Estimate deletability | **BLOCKED** — `if (existing.status === "converted") return 400` |

**Verdict: Quote conversion preserves the estimate.** Converted estimates remain visible and are protected from deletion. This path was NOT involved in the LIVE disappearance.

---

## 6. Root Cause

| # | Possible Cause | Actual? | Evidence |
|---|---|---|---|
| 1 | Database persistence failure | **NO** | LIVE logs show 201 Created with full data returned |
| 2 | Wrong save path | **NO** | Correct table, correct schema, correct response |
| 3 | Incorrect status transition | **NO** | Status correctly set to "draft" on creation |
| 4 | List/query/filter issue | **NO** | List returned the estimate correctly on multiple fetches |
| 5 | Soft-delete/archive behavior | **NO** | `archivedAt` was NULL — estimate was visible |
| 6 | Quote-conversion behavior | **NO** | No LL quote was created — conversion path not triggered |
| 7 | Environment-specific DB issue | **NO** | Database table exists with correct schema |
| 8 | **User explicitly deleted the estimate** | **YES** | `DELETE /api/laser-estimates/:id → 200 {"ok":true}` at 10:02:29 PM |

### Root Cause Statement

The user created LL-EST-0001 in LIVE at 9:50 PM and explicitly deleted it at 10:02 PM via the UI delete action (confirmed by deployment log showing DELETE request returning 200). The DELETE endpoint performed a **hard delete** (permanent row removal from the database), making the estimate unrecoverable. The UI shows a confirmation dialog before deletion ("Are you sure you want to delete estimate LL-EST-0001? This action cannot be undone."), so the user confirmed the action.

The root cause is **not a persistence defect** — it is a **governance gap** where the DELETE endpoint permanently destroys data instead of soft-deleting (archiving) it.

---

## 7. Exact Correction Made

### File Changed: `server/routes.ts`

**Before (hard delete):**
```typescript
await storage.deleteLaserEstimate(req.params.id);
```

**After (soft delete / archive):**
```typescript
if (existing.status === "archived") {
  return res.status(400).json({ error: "Estimate is already archived" });
}
await storage.archiveLaserEstimate(req.params.id);
console.log(`[ll-estimate] Archived laser estimate ${existing.estimateNumber} (${req.params.id}) — soft-delete`);
```

### Behavioral Change

| Aspect | Before | After |
|---|---|---|
| DELETE response | `{"ok":true}` | `{"ok":true}` (unchanged — backward compatible) |
| UI behavior | Estimate disappears from list | Estimate disappears from list (unchanged) |
| Database row | **Permanently deleted** | **Preserved** with `status = "archived"`, `archivedAt = NOW()` |
| Recovery | **Impossible** | Possible via direct DB query or future admin UI |
| Audit trail | **Lost** | **Preserved** |
| Converted estimates | Already protected (400 error) | Already protected (400 error, unchanged) |
| Already-archived estimates | Would fail silently | Returns 400 error ("Estimate is already archived") |
| Server log | None | `[ll-estimate] Archived laser estimate LL-EST-XXXX — soft-delete` |

---

## 8. Runtime Verification After Correction

### Test Sequence (DEV, post-fix)

| Step | Action | Result |
|---|---|---|
| 1 | `POST /api/laser-estimates` (create LL-EST-0020) | 201 Created, estimate persisted |
| 2 | `GET /api/laser-estimates` | List shows 9 estimates including LL-EST-0020 |
| 3 | `DELETE /api/laser-estimates/:id` (delete LL-EST-0020) | 200 `{"ok":true}` |
| 4 | `GET /api/laser-estimates` | List shows 8 estimates — LL-EST-0020 removed from list |
| 5 | `GET /api/laser-estimates/:id` (direct fetch) | **200** — returns archived record with `status: "archived"`, `archivedAt: "2026-04-15T05:36:09.274Z"` |
| 6 | Server console log | `[ll-estimate] Archived laser estimate LL-EST-0020 — soft-delete` |

**All tests pass.** The UI behavior is identical (estimate disappears from the list), but the data row is preserved.

---

## 9. Backward Compatibility / Live Safety Check

| Concern | Safe? | Explanation |
|---|---|---|
| Existing quotes affected? | YES | No quotes reference laser estimates in LIVE; DEV quotes are unaffected |
| API response format changed? | NO | DELETE still returns `{"ok":true}` |
| Frontend UI behavior changed? | NO | Estimate still disappears from list; confirmation dialog unchanged |
| Converted estimate protection? | YES | 400 guard unchanged |
| List query behavior? | NO | `isNull(archivedAt)` filter unchanged — archived records correctly excluded |
| Estimate numbering? | YES | Sequence counter unaffected |
| Performance impact? | NONE | Single UPDATE instead of DELETE — negligible difference |

---

## 10. Final Recommendation

**Proceed with deployment.** The correction is narrowly scoped, backward-compatible, and addresses the governance gap that caused the reported issue. No existing data or behavior is altered — only future DELETE actions are changed from hard-delete to soft-delete.

### LJ vs LL Comparison

For reference, LJ (Lateral Joinery) estimates use cascade logic (`handleEstimateDeleteCascade`) that considers linked quotes before deletion. The LL system now has equivalent data protection through soft-delete, ensuring parity between divisions.

---

## 11. Release Gate

| Item | Decision | Rationale |
|---|---|---|
| Push to Git | **YES** | Fix is committed and verified |
| Publish to live | **YES** | Corrects the governance gap that caused data loss |
| New Replit chat needed for next phase | **YES** | Phase 5 should begin in a fresh session |

---

## Validation Answers

| Question | Answer |
|---|---|
| Is the LL estimate DB row persisted in LIVE? | **YES** — deployment logs prove 201 Created with full data returned and persisted for 12+ minutes |
| Is the disappearance caused by deletion or visibility/filter logic? | **DELETION** — the user explicitly called DELETE at 10:02:29 PM, confirmed by `200 {"ok":true}` in deployment logs |
| Is the issue now fixed? | **YES** — DELETE now performs soft-delete (archive) instead of hard-delete; data is preserved |
| Can LL estimates now be trusted to persist in LIVE? | **YES** — estimates are created correctly, listed correctly, and no longer permanently destroyed on deletion |

---

## Mandatory Question Answers

| # | Question | Answer |
|---|---|---|
| 1 | When an LL estimate is created in LIVE, is the DB row actually persisted? | **YES** — confirmed by 201 response and subsequent 200/304 list/detail fetches |
| 2 | Does it later get deleted/archived/hidden/replaced/detached? | **Explicitly deleted by the user** — DELETE endpoint was called and returned 200 |
| 3 | If NO (to persistence), where is the write path failing? | N/A — write path works correctly |
| 4 | Is this issue specific to LL, or does LJ behave differently? | **LL-specific** — LJ uses cascade logic that checks linked quotes; LL had a bare hard-delete |
| 5 | Is the quote creation path persisting correctly while estimate persistence is not? | **Both persist correctly** — no LL quotes were created in LIVE (all 24 quotes are LJ) |
| 6 | Root cause classification | **Application logic issue** — DELETE endpoint performed hard-delete instead of soft-delete |
| 7 | What exact correction is required? | Change DELETE endpoint from `storage.deleteLaserEstimate()` (hard delete) to `storage.archiveLaserEstimate()` (soft delete with `archivedAt` + `status = "archived"`) |
