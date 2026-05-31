---
name: LL loose setup/handling operationally retired
description: Why per-line setup/handling no longer affects LL pricing and must not be reintroduced.
---

# LL loose per-line setup/handling is operationally retired

Loose per-line `setupMinutes` / `handlingMinutes` are no longer part of the active LL (laser) pricing workflow. The engine (`computeLLPricing` in `client/src/lib/ll-pricing.ts`) emits a $0 labour bucket and zeroes `setupHandlingCost`/`setupMinutes`/`handlingMinutes` in its output — it does not read line setup/handling at all. New LL lines and the schema Zod defaults seed 0/0. No active LL UI exposes setup/handling as a pricing lever (no inputs, no legacy override card, no "clear legacy values" warning).

**Why:** Setup, handling, picking, sorting, stacking, QA, packing and production recovery are governed exclusively by **Production Allowance tiers** (per-profile, qty/sheet-banded). Loose setup/handling created double-counting ambiguity with the allowance tiers. The user decided to fully retire it.

**How to apply:**
- Do not re-add setup/handling consumption to the LL engine or any LL pricing path.
- The schema/inputs/breakdown fields remain only for snapshot/back-compat replay of old data — keep them, but they must stay 0-defaulted, hidden from active LL UI, and ignored by current pricing.
- Production Allowance tiers (`perSheetHandlingMinutes`, `perPartHandlingSeconds`, `perPartHandlingCapMinutes`, `qaPackingMinutes`, `fixedBatchMinutes`, `productionOverheadPercent`) are the canonical mechanism — do not confuse these tier fields with retired loose setup/handling.
- Benchmark invariance: removing engine consumption is a mathematical no-op for any line storing 0/0 (e.g. LL-EST-0036 ≈ $16,868.63 excl, LL-EST-0037 ≈ $920.04 excl — both store 0/0).
- Out of scope / different domain: joinery (LJ) manufacturing-labour `setupMinutes` in the master labour library and `server/routes.ts` seed data are unrelated — never touch them for LL work.
