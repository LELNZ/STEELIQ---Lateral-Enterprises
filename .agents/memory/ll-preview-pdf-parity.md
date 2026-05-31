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

## UPDATE (Phase 5H.9E) — shared LL row-pricing helper now in a neutral lib
The reusable LL row-pricing closure (`computeRowPricing`, `SheetMaterialRef`, and their pure helper/type dependencies) now lives in `client/src/lib/ll-estimate-totals.ts`, NOT the builder page. Both `laser-quote-builder.tsx` and `laser-estimates-list.tsx` import from there. The builder has NO non-component export (only its default component), which keeps React Fast Refresh working for that file. **Why:** removed page-to-page import coupling and the dev-only Fast Refresh breakage. **How to apply:** any future surface needing the canonical LL estimate value should import `computeRowPricing` from `@/lib/ll-estimate-totals` and never re-derive a formula or import pricing helpers from a page component. Keep that lib UI-free (imports only `@shared/schema` + `@/lib/ll-pricing`).

## UPDATE (Phase 5H.9F) — manual-blank Preview placeholder must FIT the schedule image column
`ManualBlankPreviewSvg` sizes its rounded rect from absolute part mm, capped only by module constants (`MANUAL_BLANK_PREVIEW_MAX_W_PX=130` / `_H_PX=80`). The LL hybrid schedule Image column is ~22/180mm (~88px) with `overflow:hidden`, so wide blanks grew past the column and were CLIPPED into a thin sliver ("only a line") — NOT matching the PDF, which scales its placeholder to fit a ~19x22mm box. Fix: added optional `maxWidthPx`/`maxHeightPx` props (default to the 130/80 constants → all other callers incl. LJ unchanged); LL schedule call site passes `maxWidthPx={64} maxHeightPx={68}` so SVG total ≤72x76px fits the cell and renders a clean centred rounded rect. Border = `template.colors.border` (#d1d5db) == PDF `COLOR_BORDER`. **Why:** parity is about FIT, not just text-suppression — a correctly-shaped SVG still fails if the cell clips it. **How to apply:** when a shared preview SVG renders inside a fixed/narrow table cell, constrain its px size to the cell; don't rely on the component's global max caps.

## UPDATE — canonical LL customer wording is built ONCE in the renderer (not at render sites)
The LL customer schedule row label/description strings are now composed in `buildQuoteRenderModel`'s row extractor (`client/src/lib/quote-renderer.ts`), NOT at the Preview/PDF call sites. Specifically: the manual-blank item description is the literal **"Fibre laser cut component"** (spelt "Fibre", not "Fiber"), and the operations summary is pre-baked WITH its prefix — **"Additional operation: <Name>"** (singular, 1 op) or **"Additional operations: <A>, <B>"** (plural, 2+) via a `friendlyOpName` helper. `opsSummaryPdf === opsSummaryPreview` (string identity → parity by construction). **Why:** previously each render site prepended its own `"Ops: "` (and used different separators), which silently diverged Preview vs PDF wording. **How to apply:** render sites (`LaserScheduleTable` in quote-preview.tsx, `renderLaserScheduleTable`/line ~1266 in pdf-engine.ts) must emit `row.title` / `row.opsSummary*` VERBATIM — never re-add an "Ops:"-style prefix or re-title-case. `friendlyOpName` only normalizes `_` and `-` to spaces + title-cases when the name has no existing uppercase; it does NOT split on `/` or `.` (non-blocking). Empirically verified by generating the real jsPDF byte stream and extracting text with pdf-parse v2: SE-0209-LL → "Fibre laser cut component" + "Additional operation: Folding"; SE-0208-LL → "Fibre laser cut component", no ops line. Totals invariant ($16,868.63/$19,398.92 and $920.04/$1,058.05).
