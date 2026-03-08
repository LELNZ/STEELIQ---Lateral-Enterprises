# SteelIQ – Lateral Enterprises

## Current Milestone
T017 complete — QuoteDocument integration into preview. Quote preview renders entirely from QuoteDocumentModel. Next: T018 (QuoteRenderer architecture).

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
- **Tabs** (primary organizer): Active, Renovations, New Builds, Tenders, Archived.
- **Search**: By quote number or customer name.
- **Sort**: By updated date, created date, customer, value, quote number.
- **Filters**: Division, status, customer (dropdown from unique names), quote type, date range (from/to on createdAt).
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
**Storage**: Item photos and drawing PNGs are uploaded to designated folders (`uploads/item-photos/`, `uploads/drawing-images/`) and referenced in the database.
**Multi-Division Architecture**: Supports organizational and division-specific settings, with `division_scope` for library entries.
**Spec Dictionary System**: Configurable `spec_dictionary` entries for dynamic specification display and override functionality in quotes.
**Quote Management**: Full lifecycle management (Draft, Review, Sent, Accepted/Declined, Archived) with atomic sequential numbering, immutable revision history, and server-side status transition enforcement. Quotes include `EstimateSnapshot` for immutable revision data.
**Pricing System**: Comprehensive utility calculates material, labor, glass, liner, and handle costs, providing net cost, sale price, and margin. Includes cost/sell separation, configurable GST, and detailed financial summaries.
**Configuration & Drawing**: Utilizes dedicated tables for frame configurations, profiles, accessories, and labor. Features include auto-detection and generation of configurations, standard frame sizes, and dynamic opening indicators.
**Master Library Systems**: Centralized libraries for direct materials, manufacturing labor, installation labor, and delivery methods to ensure consistency.
**Site Visit Mode**: Client-only `siteType` state for jobs, allowing preset defaults for "renovation" and "new_build" contexts. Includes features like wind zone auto-fill and height-from-floor warnings.
**Mobile Architecture**: Optimized for mobile with `native-scroll` for specific components, sticky action bars, enhanced item cards, and a collapsible header.
**Quote Document Model**: `client/src/lib/quote-document.ts` defines `PreviewData` (API response shape), `QuoteDocumentModel` (normalized rendering contract), and `buildQuoteDocumentModel()` (mapper). The preview page (`quote-preview.tsx`) renders exclusively from `QuoteDocumentModel` — raw preview data is only used as input to the builder. The API endpoint `GET /api/quotes/:id/preview-data` provides all data including `projectAddress` (resolved from linked job), so no secondary queries are needed for rendering.
**Division Logo Upload**: Reuses existing image upload endpoint, storing logo URLs in division settings.
**Lifecycle Service**: `server/quote-lifecycle.ts` centralizes archive, soft-delete, hard-delete, cascade handling, orphan detection, and dev cleanup.

## Testing
- **Lifecycle regression tests**: `tests/lifecycle-regression.ts` — 6 scenario groups / 33 assertions covering archive/delete/unarchive semantics, orphan detection, cascade behavior, defensive guards, and input validation. Run with `npx tsx tests/lifecycle-regression.ts`.
- **Filter UI tests**: `tests/quote-filters-e2e.ts` — browser-driven Playwright test plan for quote page filters (customer, quote type, date range, clear filters, control visibility). Exports `QUOTE_FILTERS_TEST_PLAN` and `QUOTE_FILTERS_TECHNICAL_DOCS` constants for use with the Playwright testing framework.

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
