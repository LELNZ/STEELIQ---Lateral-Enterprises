---
name: LL markup field disambiguation
description: commercialPolicy has two markup fields that are easily confused; material markup ≠ defaultMarkupPercent
---

# LL pricing: two distinct markup fields in commercialPolicy

`LLPricingSettings.commercialPolicy` carries **two** separate markup fields — do not conflate them:

- `defaultMarkupPercent` — the **general / overall** markup-on-cost (constant `DEFAULT_MARKUP_PERCENT = 35`). Seeded to 35 in real profiles.
- `defaultMaterialMarkupPercent` — the **material** markup (constant `DEFAULT_MATERIAL_MARKUP_PERCENT = 20`). Frequently **absent (null)** in stored profile JSON.

When `defaultMaterialMarkupPercent` is absent, every consumer falls back to the 20 constant:
- Settings viewer/editor render `defaultMaterialMarkupPercent ?? 20`.
- Engine (`ll-pricing.ts`) resolves `defaultMaterialMarkupPercent ?? DEFAULT_MATERIAL_MARKUP_PERCENT`.
- New line items + Add Item modal seed from the resolved `defaultMaterialMarkupPercent`.

So the UI legitimately shows **Material Markup: 20%** even though the JSON has `defaultMarkupPercent: 35`.

**Why:** A prior V8→V9 verification report read `defaultMarkupPercent` (35) and mislabeled it "material markup", creating a false discrepancy with the UI's 20%. There was no stale/hidden 35% material field.

**How to apply:** When verifying or reporting LL "material markup", read `commercialPolicy.defaultMaterialMarkupPercent` (and its 20 fallback), NOT `defaultMarkupPercent`. Same line-item split exists: line `markupPercent` (35) vs `materialMarkupPercent` (20).
