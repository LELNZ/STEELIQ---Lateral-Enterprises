---
name: TypeScript release-gate (npm run check)
description: Non-obvious root causes when restoring `npm run check` to zero errors in this repo
---

# TypeScript release-gate restoration

`npm run check` runs bare `tsc` (no flags) against `tsconfig.json`. Vite/tsx do NOT type-check at runtime, so type errors accumulate silently until `npm run check` is run.

## Root causes that are NOT obvious from the code

- **Missing `target` → TS2802 / TS1252 flood.** `tsconfig.json` had no `compilerOptions.target`. Without it, downlevel iteration of `Map`/`Set` (`for...of`, spread) errors en masse. Fix: set `"target": "ES2020"`. This alone cleared ~19 errors.
  **Why:** the default target is too low for the Map/Set iteration used throughout; ES2020 matches the runtime (Node + modern browsers) already in use.
- **Stale incremental cache hides/repeats errors.** After changing tsconfig, delete `node_modules/typescript/tsbuildinfo` before re-running `tsc`, or counts are stale.
- **drizzle-zod widens jsonb `.$type<T>()` to loose types.** A column declared `jsonb(...).$type<LLPricingSettings>()` infers strict on `table.$inferInsert`, but `InsertX = z.infer<createInsertSchema(...)>` widens the jsonb field (array element → `unknown`). So passing `InsertX` to `.values()/.set()` errors. Fix at the boundary: `.values(data as typeof table.$inferInsert)` / `.set({...data} as Partial<typeof table.$inferInsert>)`. Pure type assertion — JSON payload unchanged. Applies to `llPricingProfiles`, `laserEstimates`.
- **Express 5 `ParamsDictionary` widening.** `req.params.x` is typed `string | string[]` (string-index of ParamsDictionary), so untyped handlers need `req.params.x as string` where the value is used as a string.
- **Optional fields with zod `.default()`.** `z.infer` (output type) makes `.default()` fields REQUIRED. Object literals reconstructing `InsertQuoteItem` must include them (e.g. `paneGlassSpecs: []`, `heightOverride: 0`) even though the running schema would fill them. Use the schema's own default value so runtime is unchanged.

## Behaviour-safety rule for this gate
LL pricing benchmarks (LL-EST-0036 ≈ $16,868.63 excl; LL-EST-0037 ≈ $920.04 excl) are computed by `client/src/lib/ll-pricing.ts` + `ll-estimate-totals.ts`. Never touch those to satisfy a type error. All gate fixes must be type-level assertions, schema-default-aligned literals, or sibling-pattern fallbacks — never a change to pricing/formula code.
