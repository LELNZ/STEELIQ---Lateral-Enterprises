---
name: LL line-policy legacy-safety contract
description: How new optional per-line LL pricing policies must default so existing estimates/quotes never drift.
---

# LL per-line pricing policy: engine must never read profile default for missing line fields

When adding a new optional per-line policy to the LL laser pricing engine (`computeLLPricing` in `client/src/lib/ll-pricing.ts`), a line whose new field is **undefined/missing must resolve to the legacy behaviour INSIDE THE ENGINE** — the engine must NOT fall back to the active profile's default for that field.

**Why:** Estimates live-recompute against the active LL profile (only quote *snapshots* are frozen). If the engine read a profile default for a missing line field, activating a profile that sets a non-legacy default would silently change every existing estimate's totals. Release blockers (e.g. benchmark estimates that must stay within $0.01 with no manual edit) would break on profile activation, not on a code change. Missing-field == legacy is the safety signal; never backfill estimates.

**How to apply:**
- Engine: resolve `policy = input.x === "<nonLegacyValue>" ? "<nonLegacy>" : "<legacy>"`. Undefined always means legacy. Do not consult `settings.default*` in the engine.
- Profile `default*` fields seed ONLY brand-new line items in the builder (`makeEmptyItem`), and are seeded to the legacy value on profile create/duplicate (`POST /api/ll-pricing-profiles`) so activation never changes quoting.
- `openEditDialog` / form load must preserve stored line values as-is (including undefined) — never substitute the profile default when opening an existing line.
- Internal breakdown/UI only; do not touch customer Preview/PDF/snapshot/LJ/LE.

This is the same pattern used by the 5H.x material-allocation and setup/handling work.
