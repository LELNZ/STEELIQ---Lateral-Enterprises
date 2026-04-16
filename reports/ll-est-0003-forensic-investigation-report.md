# LL-EST-0003 Forensic Investigation Report

**Date**: April 16, 2026  
**Investigator**: SteelIQ Agent  
**Estimate**: LL-EST-0003 (Production)  
**Customer**: Wayne  
**Status**: Draft  

---

## 1. Executive Summary

The user reported that LL-EST-0003 may be missing line items and requested a review of pricing model governance alignment with the Phase 5B bucketed commercial pricing model. This forensic investigation confirms:

1. **No items were lost.** LL-EST-0003 was created with exactly 2 line items and has never been updated (`created_at = updated_at`).
2. **Items use pre-Phase 5B format** (flat `markupPercent: 35`) — the engine handles this gracefully via fallback defaults.
3. **Admin UI governance gap identified and corrected** — the pricing profile admin page was missing Material Markup %, Consumables Markup %, and Machine Buy Cost fields.

---

## 2. Production Database Findings

### Estimate Record
| Field | Value |
|-------|-------|
| Estimate Number | LL-EST-0003 |
| Customer | Wayne |
| Status | draft |
| Items Count | 2 |
| Created At | 2025-04-12 05:36:36 |
| Updated At | 2025-04-12 05:36:36 |
| Pricing Profile | Standard Rate 04 2026 (1.0) |

**Key observation**: `created_at = updated_at` — this estimate has **never been edited** after initial creation. No save cycles have occurred that could have dropped items.

### Line Items (from `items_json`)
| Ref | Title | Material | Thickness | Qty | Markup |
|-----|-------|----------|-----------|-----|--------|
| 001 | test | Aluminium 5052 Fibre PE | 3mm | 2 | 35% (flat) |
| 002 | Side wall | Aluminium 5052 Fibre PE | 3mm | 1 | 35% (flat) |

Both items use the **old pricing format** — single `markupPercent: 35` with no `materialMarkupPercent` or `consumablesMarkupPercent` fields. This is expected for estimates created before Phase 5B deployment.

### Production Schema
- `laser_estimates` table exists and is functional
- `laser_quotes` table does **not** exist in production (quotes feature not yet deployed)
- No data loss indicators found

---

## 3. Save/Reload Integrity Verification

A full round-trip test was executed in development:

1. Created a new estimate with 2 items
2. Saved to database
3. Reloaded (navigated away and back)
4. Both items persisted with correct pricing data
5. Bucketed pricing breakdown visible on reload

**Result**: PASS — no item loss during save/reload cycle.

---

## 4. Old Format Backward Compatibility

The Phase 5B engine (`computeItemPricing` in `ll-pricing.ts`) handles old-format items via fallback logic:

- `materialMarkupPercent` → defaults to 20% if missing
- `consumablesMarkupPercent` → defaults to 25% if missing
- `machineBuyCostPerHour` → defaults to 60% of sell rate if missing
- Gas passes through at cost (no markup)

When LL-EST-0003 is opened in the current UI, the engine will apply these defaults and display the bucketed breakdown correctly. The original flat `markupPercent: 35` is preserved in the snapshot but no longer drives sell pricing.

---

## 5. Admin UI Governance Corrections

### Problem
The pricing profile admin page (`ll-pricing-profiles.tsx`) still showed the old single "Default Markup 35%" field and lacked visibility into the Phase 5B bucketed fields. Administrators could not see or configure:
- Material Markup % (default 20%)
- Consumables Markup % (default 25%)
- Machine Buy Cost per hour (default 60% of sell rate)

### Corrections Applied

#### Commercial Policy Section (Edit Form)
- **Removed**: "Default Markup" field (legacy, no longer drives pricing)
- **Added**: "Material Markup" field (default 20%)
- **Added**: "Consumables Markup" field (default 25%)
- **Added**: Explanatory note about bucketed pricing governance

#### Machine Profiles Section (Edit Form)
- **Renamed**: "Hourly Rate" → "Sell Rate" (clarity)
- **Added**: "Buy Cost" field (defaults to 60% of sell rate)
- **Layout**: Changed from 5-column to 3-column grid for better readability

#### Read-Only Viewer
- Commercial Policy now shows Material Markup and Consumables Markup
- Machine Profiles now show both Sell and Buy rates
- Old flat markup percentage removed from display

---

## 6. Conclusion

| Finding | Status |
|---------|--------|
| Missing line items | **Not confirmed** — 2 items created, 2 items present, never updated |
| Save/reload data loss | **Not present** — round-trip test passed |
| Old format compatibility | **Working** — engine applies safe defaults |
| Admin UI governance gap | **Corrected** — bucketed fields now visible in profile admin |
| Production data integrity | **Intact** — no corruption detected |

### Recommendations
1. When LL-EST-0003 is next opened and saved, it will automatically upgrade to the bucketed format with the default markup values.
2. The active production profile should be reviewed to set explicit Material Markup and Consumables Markup values rather than relying on engine defaults.
3. No data migration is needed — the engine handles format evolution gracefully.
