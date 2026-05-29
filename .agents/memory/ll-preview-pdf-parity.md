---
name: LL customer schedule Preview/PDF parity
description: How the LL (laser) customer schedule keeps the app Preview and the jsPDF output visually identical, and the manual-blank image-cell rule.
---

# LL customer schedule Preview/PDF parity

The LL (laser) customer-facing schedule-of-items has two independent renderers that
MUST stay visually identical:
- Preview (app/React): `LaserScheduleTable` in `client/src/pages/quote-preview.tsx`
- PDF (jsPDF): `renderLaserScheduleTable` in `client/src/lib/pdf-engine.ts`

**Rule:** any change to one renderer's row/cell appearance must be mirrored in the
other, or it silently diverges. Past phases drifted on separators, row-height
constants, and image-cell content.

**Manual-blank image cell (no uploaded drawing):** the PDF draws ONLY a clean
rounded-rectangle outline with NO text inside. The Preview uses
`ManualBlankPreviewSvg`, which by default also draws the `"L x Wmm"` dimension text
*inside* the box — that produced a "size text inside a broken image" look in the
customer Preview. The schedule call site suppresses it via `showDimensionText={false}`
(and `showCaption={false}`). The blank's size belongs ONLY in the Size column
(`row.dimensions`), never in the image cell.

**Why:** `ManualBlankPreviewSvg` is shared with the LJ joinery card, which DOES want
the inner dimension text. So both `showCaption` and `showDimensionText` default to
`true` (LJ behaviour preserved) and the LL schedule opts out explicitly. Do not flip
the defaults — that would change LJ.

**How to apply:** when touching either LL schedule renderer's cells, check the twin
renderer for the same change. For the image cell specifically, keep the manual-blank
render text-free in both surfaces; dimensions stay in the Size column only.

## LL estimate total source (for any non-builder surface)
The authoritative LL estimate value = Σ `computeRowPricing(item, sheetMaterials, llPricingSettings, governedInputs).finalLineSell` over `itemsJson` (== builder `totalValue` / snapshot `subtotalExclGst`). GST: excl×0.15 = gstAmount, excl×1.15 = totalInclGst. Estimates store NO total column — totals are LIVE-recomputed from the ACTIVE pricing profile/sheet-materials/gas/consumable inputs (not the estimate's stored pricingProfileId). Reuse `computeRowPricing` + `SheetMaterialRef` (exported from `laser-quote-builder.tsx`); never re-derive a new formula. **Why:** prevents drift between the estimates list, builder subtotal, and customer Preview/PDF. **Caveat:** exporting non-component fns from the builder page disables React Fast Refresh for that file in dev only (harmless).
