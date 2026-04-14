# LL Dev-vs-Live Environment Parity Review

**Date:** April 14, 2026
**System:** SteelIQ — Lateral Enterprises
**Scope:** Resolve dev/live discrepancy in LL Add Item material selection (Aluminium 5052 finish options)

---

## 1. Executive Summary

A dev-vs-live data drift was confirmed in the LL material library. The root cause is a **seed reconciliation gap** — the startup seed logic adds missing rows and backfills specific fields (formType, stockBehaviour, densityKgM3) but did **not** update `grade` or `finish` fields on existing rows. The seed data was updated during development with corrected supplier categorizations (adding "Fibre PE", "Stucco" finishes, and corrected Stainless Steel grade names), but the LIVE database retained its original values because it was never fully re-seeded.

A targeted fix was applied: a **grade/finish drift correction step** was added to the seed reconciliation logic. On next LIVE deployment, this will automatically correct all drifted rows to match the canonical seed data without purging or disrupting existing records.

---

## 2. Exact Dev vs Live Comparison Results

### Mandatory Test Path: Aluminium -> 5052 -> Finish Dropdown

| Finish | DEV | LIVE |
|---|---|---|
| **Fibre PE** | YES (3 rows) | **NO** |
| Mill | YES (12 rows) | YES (12 rows) |
| PE Protected | YES (12 rows) | YES (15 rows) |
| Tread | YES (5 rows) | YES (5 rows) |

**DEV total Aluminium 5052 quoteable rows:** 32
**LIVE total Aluminium 5052 quoteable rows:** 32

Row counts match, but 3 rows that DEV classifies as "Fibre PE" are still classified as "PE Protected" in LIVE.

### Additional Test Path: Aluminium -> 5005 -> Finish Dropdown

| Finish | DEV | LIVE |
|---|---|---|
| **Fibre PE** | YES (2 rows) | **NO** |
| Mill | YES (16 rows) | YES (17 rows) |
| PE Protected | YES (22 rows) | YES (24 rows) |
| **Stucco** | YES (1 row) | **NO** |

Same pattern — rows in DEV have corrected finishes; LIVE retains original values.

### Stainless Steel Grade Drift

| Grade | DEV Rows | LIVE Rows |
|---|---|---|
| 304 | 0 | 27 |
| 304 2B | 6 | 2 |
| 304 BA | 3 | 0 |
| 304 No.4 | 5 | 1 |
| 304L | 24 | 24 |
| 304L 2B | 13 | 0 |
| 304L No.1 | 3 | 0 |
| 316 | 15 | 15 |
| 316 2B | 1 | 1 |
| 316L | 11 | 11 |
| 445M2 | 1 | 1 |

The 27 LIVE rows under grade "304" are split in DEV into "304 2B" (6), "304 BA" (3), "304 No.4" (5) etc. — reflecting corrected supplier categorization from the Wakefield price list.

### Aggregate Totals

| Metric | DEV | LIVE | Match? |
|---|---|---|---|
| Total materials | 394 | 394 | YES |
| Active quoteable | 247 | 247 | YES |
| Active reference | 7 | 7 | YES |
| Inactive preserved | 140 | 140 | YES |
| Suppliers | 2 | 2 | YES |
| Material families | 5 | 5 | YES |
| Grade/finish values | CORRECT | DRIFTED | NO |

---

## 3. Root Cause Analysis

### Cause: Seed Reconciliation Gap

The startup seed logic in `server/routes.ts` (function at line ~7640) operates in three modes:

1. **Full re-seed** — when DB is empty or has demo supplier data (NZ Steel, Vulcan Steel, Ullrich Aluminium)
2. **Incremental reconciliation** — adds rows missing from the canonical seed by composite key (`supplierName|||productDescription|||thickness`)
3. **Field backfill** — updates `formType`, `stockBehaviour`, `densityKgM3`, `isQuoteable`, `isActive`, `pricePerKg` on existing rows when those fields are empty

**The gap:** Mode 3 backfills specific fields but does NOT update `grade` or `finish`. When the seed data was corrected (e.g., Wakefield 5052 "PE Protected" rows reclassified as "Fibre PE" based on supplier price list review), DEV got the correct values via a full re-seed (likely after a database reset), while LIVE retained the original values because its data matched by composite key and the backfill didn't touch grade/finish.

### Classification:

| Possible Cause | Actual? |
|---|---|
| Stale published frontend bundle | NO — frontend code is identical |
| Stale live backend code | PARTIAL — backend code is identical, but the reconciliation logic didn't cover grade/finish |
| Dev/live DB drift | YES — primary cause |
| Status/activation drift | NO — isActive/isQuoteable flags are identical |
| Cached client state | NO — server-side data differs |
| Query/filter logic difference | NO — identical API endpoints and filters |
| **Seed reconciliation gap** | **YES — root cause** |

---

## 4. Exact Correction Made

### File Changed: `server/routes.ts`

A new **grade/finish drift correction** step was added to the seed reconciliation function, positioned after the existing field backfill logic and before the Wakefield activation policy enforcement:

```typescript
const seedLookupForDrift = new Map(LL_SEED_MATERIALS.map(m => 
  [`${m.supplierName}|||${m.productDescription}|||${m.thickness}`, m]
));
let gradeFinishCorrected = 0;
for (const row of existing) {
  const seed = seedLookupForDrift.get(
    `${row.supplierName}|||${row.productDescription}|||${row.thickness}`
  );
  if (seed && (row.grade !== seed.grade || row.finish !== seed.finish)) {
    await storage.updateLlSheetMaterial(row.id, {
      grade: seed.grade,
      finish: seed.finish,
    });
    gradeFinishCorrected++;
  }
}
if (gradeFinishCorrected > 0) {
  console.log(`[ll-material-seed] Corrected grade/finish drift on ${gradeFinishCorrected} existing rows`);
}
```

This correction:
- Uses the same composite key matching as existing reconciliation
- Only updates rows where grade OR finish differ from seed truth
- Logs the number of corrections for audit visibility
- Is idempotent — runs on every startup but only modifies drifted rows
- Does NOT affect Macdonald Steel rows (they have no drift — their data was correct from first seed)

---

## 5. Runtime Verification After Correction

### DEV (post-restart, verified):
- Aluminium 5052 finishes: **Fibre PE, Mill, PE Protected, Tread** — CORRECT
- Aluminium 5005 finishes: **Fibre PE, Mill, PE Protected, Stucco** — CORRECT
- Stainless Steel grades: **304 2B, 304 BA, 304 No.4, 304L, 304L 2B, 304L No.1, 316, 316 2B, 316L, 445M2** — CORRECT
- Total quoteable: **247** — UNCHANGED
- No non-quoteable rows leaked to Quote Builder — VERIFIED

### LIVE (pre-deployment, current state):
- Aluminium 5052 finishes: Mill, PE Protected, Tread — DRIFTED (missing Fibre PE)
- Aluminium 5005 finishes: Mill, PE Protected — DRIFTED (missing Fibre PE, Stucco)
- Stainless Steel grades: 304, 304 2B, 304 No.4, 304L — DRIFTED (coarse grouping)

### LIVE (expected post-deployment):
- The grade/finish drift correction will run on startup
- All drifted Wakefield rows will be corrected to match seed data
- Expected log message: `[ll-material-seed] Corrected grade/finish drift on N existing rows`
- DEV and LIVE will then match exactly

---

## 6. Phase 1–4 Gate Assessment

### Can the Phase 1–4 gate now be closed?

**YES, once the deployment is published.** The dev/live parity issue was the sole blocker identified in the gate review screenshot. The root cause has been identified (seed reconciliation gap), a targeted fix applied (grade/finish drift correction), and DEV verified. LIVE will be corrected on next deployment.

The fix is narrowly scoped, idempotent, and does not affect:
- Row counts (394 total, 247 quoteable)
- Pricing data (prices unchanged)
- Status model (isActive/isQuoteable unchanged)
- Quote engine logic (no code changes)
- Validation guards (no code changes)
- Snapshot integrity (no historical data affected)

---

## 7. Release Recommendation

Deploy the fix immediately. The grade/finish drift correction will run automatically on LIVE startup and bring the production database into parity with the canonical seed data. No manual intervention is needed beyond publishing.

---

## Required Answers

| # | Question | Answer |
|---|---|---|
| 1 | Do dev and live have the same active LL material dataset? | **NO** — same row counts (394/247/7/140) but different grade/finish values on ~35+ Wakefield rows |
| 2 | Do dev and live expose the same Finish options for Aluminium -> 5052? | **NO** — DEV shows Fibre PE, Mill, PE Protected, Tread; LIVE shows only Mill, PE Protected, Tread |
| 3 | If NO, exactly why? | Seed data was updated with corrected supplier categorizations. DEV was fully re-seeded; LIVE was only incrementally reconciled, and the reconciliation logic did not update grade/finish on existing rows. |
| 4 | What is the cause? | **Dev/live DB drift** caused by a **seed reconciliation gap** — the backfill logic updated formType/stockBehaviour/densityKgM3 but not grade/finish. |
| 5 | What exact correction was made? | Added a grade/finish drift correction step to `server/routes.ts` seed reconciliation function. It compares every existing row's grade and finish against the canonical seed data (by composite key) and updates any drifted values. |
| 6 | After correction, do dev and live match? | **DEV: YES (verified). LIVE: Will match after deployment.** |

---

## Files Changed

| File | Change |
|---|---|
| `server/routes.ts` | Added grade/finish drift correction logic (~15 lines) after existing field backfill, before Wakefield activation enforcement |

---

## Final Release Gate

| Item | Decision |
|---|---|
| Push to Git | **YES** |
| Publish to live | **YES** — required to correct LIVE grade/finish drift |
| New Replit chat needed for next phase | **YES** — Phase 5 should begin after confirming LIVE parity post-deployment |
