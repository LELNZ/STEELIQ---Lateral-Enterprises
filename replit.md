# SteelIQ – Lateral Enterprises

## Current Milestone
Master template visual refinement (T049–T055) complete. Template visual application (T043–T047) complete. Division template threading (T038–T042) complete. Photo persistence (T031–T033) complete. Shared template (T034–T037) complete. True PDF engine (T025–T030) complete. Print stabilization (T015–T018) complete. Monday-readiness (T009–T013) complete.
- **Master template visual refinement (T049–T055)**: Quote now reads as a polished professional quotation. Section order: header → "QUOTATION" title → disclaimer → customer/project → "QUOTE SUMMARY" + totals → schedule of items → terms & conditions → remittance/bank details → acceptance. Schedule is the main body; legal/acceptance at the end. Legal no longer forces a new page in PDF — flows naturally after schedule with a separator. Acceptance includes statement text: "I accept the works described in {quoteNumber}...". PDF gets page numbers (Page X of Y) on multi-page documents. Item card headers refined with middot separator and border-bottom. Company defaults explicit: `company_master_v1`, `image_left_specs_right_v1`, `totals_block_v1`. Preview and PDF are in the same visual family with matching hierarchy, headings, and spacing intent.
- **Template visual application (T043–T047)**: PDF engine and preview both fully template-driven. `applyTemplate()` extracts all colors, spacing, typography sizes, layout variants into module vars. `SIZE_MAP` converts typography keys (xs/sm/base/lg/xl/2xl) to pt sizes. Three schedule layout variants: `image_left_specs_right_v1` (default, side-by-side), `specs_only_v1` (no drawing), `image_top_specs_below_v1` (stacked). Two totals layout variants: `totals_block_v1` (bordered bg box, default), `totals_inline_v1` (flat lines). Photo parity: `preloadPhotos()` parallel fetch → `imageCache` map → `renderPhotosFromCache()` with `PHOTO_MAX_SIZE` from template. Preview `ScheduleItemCard` filters failed photos via `loadedPhotos`; "Site Photos" heading only renders when `loadedPhotos.length > 0`. Both renderers share: uppercase muted section headings, template accent colors, striped spec table rows, muted-bg item headers, template-driven acceptance block.
- **Division template threading (T038–T042)**: `COMPANY_MASTER_TEMPLATE` is the canonical template; `resolveQuoteTemplate(overrides)` merges division-specific overrides (accentColor, scheduleLayoutVariant, totalsLayoutVariant). `QuoteRenderModel` includes `resolvedTemplate` field populated by `buildQuoteRenderModel`. PDF engine calls `applyTemplate(model.resolvedTemplate)` at start of generation — all render helpers use module-level mutable template/color vars. Preview page extracts `T` from `renderModel.resolvedTemplate` and passes to all section components as props. No static `SYSTEM_TEMPLATE` usage in rendering pipeline — all template-driven. Settings page clarifies "Company Template" (locked) vs "Division Override" labels.
- **Photo persistence (T031–T033)**: Item photos now stored in PostgreSQL `item_photos` table (bytea column) instead of volatile filesystem. Upload route uses `multer.memoryStorage()` → DB save. Serve route: in-memory cache → DB → filesystem legacy fallback (auto-migrates to DB). Delete cascade clears DB + cache + legacy file. Photos survive workspace restarts.
- **Shared template (T034–T037)**: `client/src/lib/quote-template.ts` defines `QuoteTemplate` and `COMPANY_MASTER_TEMPLATE` — single source of truth for section ordering, typography sizes, spacing, colors, item layout, and acceptance fields. Both `quote-preview.tsx` (HTML) and `pdf-engine.ts` (PDF) use `isSectionVisible()` for section visibility and template fields for acceptance. Acceptance block extracted from LegalSection into standalone `AcceptanceSection` component.
- **PDF engine (T025–T030)**: True document PDF engine at `client/src/lib/pdf-engine.ts`. Generates vector-text selectable PDFs from `QuoteRenderModel` data via jsPDF — no html2canvas/screenshot dependency. Controlled A4 pagination, section rendering (header, customer/project, totals, legal, schedule items with drawings/photos, acceptance block). Quote Detail "Export PDF" fetches preview data and generates directly (no new tab). Preview "Export PDF" uses live schedule items (respects unsaved spec display toggles). Old `pdf-export.ts` (html2canvas approach) removed. Pipeline: QuoteDocumentModel → QuoteRenderModel → PDF Engine → jsPDF → PDF file.
- **Monday-readiness (T009–T013)**: Quote type simplified to Renovation / New Build. Legacy quotes (null/general/tender) display as "Unclassified" (not mislabeled). `POST /api/dev/clear-quotes` requires `ENABLE_DESTRUCTIVE_DEV_TOOLS=true` env var — blocked by default. Persistence audit confirmed: Replit PostgreSQL is persistent; quote disappearances caused by test scripts calling the clear-quotes endpoint.
- **siteType propagation**: `site_type` column on `jobs` table. Quote builder persists/hydrates siteType. Exec summary auto-derives `quoteType` from `job.siteType`. On revisions, existing `quote_type` preserved. Server-side validation: `renovation | new_build | null` via `insertJobSchema`.
- **Quote list audit**: `totalValue` from `snapshot.totals.sell`. Quote type editable on detail page via `PATCH /api/quotes/:id/type`. Backfill endpoint for existing quotes.
- T018: Dedicated renderer layer at `client/src/lib/quote-renderer.ts`. Defines `QuoteRenderModel` (typed presentation model) and `buildQuoteRenderModel()` (pure mapper from `QuoteDocumentModel`). Preview page refactored to render from the render model via decomposed section components (`HeaderSection`, `CustomerProjectSection`, `TotalsSection`, `LegalSection`, `ScheduleItemCard`). `rebuildScheduleItems()` enables live spec display toggling. `PresentationMode` type prepared for future layout variants.

## Overview
SteelIQ is a professional quotation and estimating platform built for Lateral Enterprises, serving the window and door industry. It enables users to configure window and door items, generate live SVG technical drawings with dimensions and opening indicators, and manage these items within estimates and quotes. The system streamlines the quotation process from configuration and visualization to pricing and export, providing a robust, user-friendly platform for accurate and visually rich quotes. Key capabilities include real-time drawing previews, comprehensive estimate and quote lifecycle management, item photo capture, and detailed pricing breakdowns.

## User Preferences
I want iterative development.
Ask before making major changes.
I prefer detailed explanations.
Do not make changes to the folder `shared` EXCEPT shared/schema.ts and shared/estimate-snapshot.ts (approved).

## Estimate (Job) Lifecycle
- Backend entity is `job`/`jobs`; UI label is "Estimate".
- **Archive** (`PATCH /api/jobs/:id/archive`): Sets `archivedAt` timestamp. Estimate stays in DB, photos preserved. Can cascade to linked quotes (archive or keep).
- **Unarchive** (`PATCH /api/jobs/:id/unarchive`): Clears `archivedAt`. Estimate returns to active scope. Does NOT automatically unarchive linked quotes.
- **Delete** (`DELETE /api/jobs/:id`): Permanently removes the estimate from the DB. Cleans up unreferenced photos. Can cascade to linked quotes (archive, delete, or keep).
- **Listing**: `GET /api/jobs` returns active estimates; `GET /api/jobs?scope=archived` returns archived estimates.
- **Defensive guards**: Cannot archive an already-archived estimate. Cannot unarchive an active estimate.

## Quote Lifecycle
- Statuses: Draft → Review → Sent → Accepted/Declined. Can also transition to Archived.
- **archivedAt** (timestamp): Canonical archive truth. Set when quote is archived.
- **deletedAt** (timestamp): Canonical soft-delete truth. Soft-deleted quotes are excluded from normal queries.
- **quoteType** (text, nullable): `renovation`, `new_build`, `tender`, or null (General).
- **totalValue** (real, nullable): Cached total for display/sort.
- Hard delete requires `?confirm=permanent` query param.

## Orphan Detection
- Computed (not persisted) by `enrichQuotesWithOrphanState()` in `server/quote-lifecycle.ts`.
- Rule: linked job exists in DB → quote is NOT orphaned. Linked job missing → quote IS orphaned.
- **Archived estimates still exist in DB**, so their linked quotes are NOT orphaned.
- **Deleted estimates are removed from DB**, so their linked quotes ARE orphaned and show "Estimate Removed" badge.

## Quotes Page Filters
- **Tabs** (primary organizer): Active, Archived. (Renovation/New Build/Tender tabs removed — use quoteType filter instead.)
- **Search**: By quote number or customer name.
- **Sort**: By updated date, created date, customer, value, quote number.
- **Filters**: Division, status, customer (dropdown from unique names), quote type, date range (from/to on createdAt).
- **Value column**: Populated from `snapshot.totals.sell` on quote creation and revision update. Backfill endpoint at `POST /api/quotes/backfill-values`.
- **Quote Type editing**: Editable on quote detail page via dropdown. `PATCH /api/quotes/:id/type` updates `quoteType` (null = General).
- Estimator filter deferred until user/identity support is implemented.

## Estimates Page
- Active/Archived tabs.
- Active tab: shows non-archived estimates with Open, Archive, Delete actions.
- Archived tab: shows archived estimates with Unarchive, Delete Permanently actions.
- Archive/Delete dialogs show cascade options when linked quotes exist.

## System Architecture
**Frontend**: React with TypeScript and Shadcn UI components, utilizing a responsive mobile-first design approach.
**Backend**: Express.js with PostgreSQL, Drizzle ORM, and node-postgres.
**Drawing Engine**: SVG-based rendering (`client/src/components/drawing-canvas.tsx`) with PNG export capabilities.
**State Management**: React state for UI, TanStack Query for API data fetching and caching.
**Global Settings**: Managed via React Context with localStorage for persistence.
**Routing**: Wouter for client-side navigation.
**Export Capabilities**: SVG to PNG conversion and multi-page PDF generation via jsPDF.
**Storage**: Item photos stored in PostgreSQL `item_photos` table (bytea) with in-memory cache (max 200 entries). Filesystem `uploads/item-photos/` kept as legacy fallback only. Drawing PNGs uploaded to `uploads/drawing-images/` (filesystem-only — regenerated on every item save, so persistence is not an issue).
**Multi-Division Architecture**: Supports organizational and division-specific settings, with `division_scope` for library entries.
**Spec Dictionary System**: Configurable `spec_dictionary` entries for dynamic specification display and override functionality in quotes.
**Quote Management**: Full lifecycle management (Draft, Review, Sent, Accepted/Declined, Archived) with atomic sequential numbering, immutable revision history, and server-side status transition enforcement. Quotes include `EstimateSnapshot` for immutable revision data.
**Pricing System**: Comprehensive utility calculates material, labor, glass, liner, and handle costs, providing net cost, sale price, and margin. Includes cost/sell separation, configurable GST, and detailed financial summaries.
**Configuration & Drawing**: Utilizes dedicated tables for frame configurations, profiles, accessories, and labor. Features include auto-detection and generation of configurations, standard frame sizes, and dynamic opening indicators.
**Master Library Systems**: Centralized libraries for direct materials, manufacturing labor, installation labor, and delivery methods to ensure consistency.
**Site Visit Mode**: Client-only `siteType` state for jobs, allowing preset defaults for "renovation" and "new_build" contexts. Includes features like wind zone auto-fill and height-from-floor warnings.
**Mobile Architecture**: Optimized for mobile with `native-scroll` for specific components, sticky action bars, enhanced item cards, and a collapsible header.
**Quote Document Model**: `client/src/lib/quote-document.ts` defines `PreviewData` (API response shape), `QuoteDocumentModel` (normalized rendering contract), and `buildQuoteDocumentModel()` (mapper). The API endpoint `GET /api/quotes/:id/preview-data` provides all data including `projectAddress` (resolved from linked job), so no secondary queries are needed for rendering.
**Quote Renderer**: `client/src/lib/quote-renderer.ts` defines `QuoteRenderModel` (presentation-ready structure) and `buildQuoteRenderModel()` (pure mapper from `QuoteDocumentModel`). The preview page (`quote-preview.tsx`) renders from `QuoteRenderModel` via decomposed section components. Pipeline: `PreviewData → buildQuoteDocumentModel() → buildQuoteRenderModel() → UI`. `rebuildScheduleItems()` enables live spec key toggling. `PresentationMode` type supports future layout variants (cover-page, renovation-homeowner, new-build-schedule).
**Division Logo Upload**: Reuses existing image upload endpoint, storing logo URLs in division settings.
**Lifecycle Service**: `server/quote-lifecycle.ts` centralizes archive, soft-delete, hard-delete, cascade handling, orphan detection, and dev cleanup.

## Testing
- **Lifecycle regression tests**: `tests/lifecycle-regression.ts` — 6 scenario groups / 33 assertions covering archive/delete/unarchive semantics, orphan detection, cascade behavior, defensive guards, and input validation. Run with `npx tsx tests/lifecycle-regression.ts`.
- **Filter UI tests**: `tests/quote-filters-e2e.ts` — browser-driven Playwright test plan for quote page filters (customer, quote type, date range, clear filters, control visibility). Exports `QUOTE_FILTERS_TEST_PLAN` and `QUOTE_FILTERS_TECHNICAL_DOCS` constants for use with the Playwright testing framework.
- **Media rendering tests**: `tests/quote-media-e2e.ts` — browser-driven Playwright test plan for quote media rendering (drawing images, customer photos, fallbacks). Uploads test media, creates quote with snapshot, verifies rendering and exclusion logic.

## External Dependencies
- **PostgreSQL**: Primary database.
- **Drizzle ORM**: PostgreSQL ORM.
- **node-postgres**: PostgreSQL client.
- **React**: Frontend UI.
- **TypeScript**: Static typing.
- **Shadcn UI**: Component library.
- **TanStack Query**: Data fetching and caching.
- **Wouter**: Client-side routing.
- **jsPDF**: PDF generation.
- **multer**: Multipart form data handling for uploads.
