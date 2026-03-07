# Pro-Quote CAD Generator

## Overview
The Pro-Quote CAD Generator is a professional quotation tool for the window and door industry. It enables users to configure window and door items, generate live SVG technical drawings with dimensions and opening indicators, and manage these items within "Jobs" and "Quotes." The system aims to streamline the quotation process from configuration and visualization to pricing and export, providing a robust, user-friendly platform for accurate and visually rich quotes. Key capabilities include real-time drawing previews, comprehensive job and quote management, item photo capture, and detailed pricing breakdowns. The project targets enhanced efficiency for businesses in the window and door market.

## User Preferences
I want iterative development.
Ask before making major changes.
I prefer detailed explanations.
Do not make changes to the folder `shared` EXCEPT shared/schema.ts and shared/estimate-snapshot.ts (approved).

## System Architecture
**Frontend**: React with TypeScript and Shadcn UI components, utilizing a responsive mobile-first design approach.
**Backend**: Express.js with PostgreSQL, Drizzle ORM, and node-postgres.
**Drawing Engine**: SVG-based rendering (`client/src/components/drawing-canvas.tsx`) with PNG export capabilities (3x resolution).
**State Management**: React state for UI, TanStack Query for API data fetching and caching.
**Global Settings**: Managed via React Context (`client/src/lib/settings-context.tsx`) with localStorage for persistence.
**Routing**: Wouter for client-side navigation.
**Export Capabilities**: SVG to PNG conversion and multi-page PDF generation via jsPDF.
**Item Photo Storage**: Multi-photo per job item, uploaded as JPEG to `uploads/item-photos/`, stored as JSONB array in DB with keys.
**Drawing Image Storage**: Drawing PNGs uploaded to `uploads/drawing-images/`.
**Multi-Division Architecture**: Supports organizational (`org_settings`) and division-specific settings (`division_settings`), with `division_scope` for library entries. Seeded with "LJ," "LE," and "LL" divisions.
**Spec Dictionary System**: `spec_dictionary` table with configurable entries, enabling dynamic specification display and override functionality in quotes.
**Quote Management**: Full lifecycle management (Draft, Review, Sent, Accepted/Declined, Archived) with atomic sequential numbering, immutable revision history (`snapshot_json`), and server-side status transition enforcement. Quotes include `EstimateSnapshot` for immutable revision data.
**Pricing System**: Comprehensive `pricing.ts` utility calculates material, labor, glass, liner, and handle costs, providing net cost, sale price, and margin. Includes cost/sell separation for installation and delivery, configurable GST, and detailed financial summaries.
**Configuration & Drawing**: Utilizes dedicated tables for frame configurations, profiles, accessories, and labor. Features include `deriveConfigSignature` for auto-detection and generation of configurations, standard frame sizes (52mm, 70mm, 127mm), and dynamic opening indicators.
**Master Library Systems**: Centralized libraries for direct materials, manufacturing labor, installation labor (tiered rates), and delivery methods to ensure consistency.

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

## Site Visit Mode (Quote Builder)
- **Site Type Selector**: Client-only `siteType` state (`"renovation"` | `"new_build"` | `null`) in job header fields, visible on both desktop and mobile. Resets on page reload (Phase 1).
- **Preset Defaults**: When a site type is active, new item form resets use preset-specific defaults instead of empty defaults. Presets only apply on `form.reset()` for new items, never retroactively to existing items or during edits.
  - **Renovation**: ES52 frame type, EnergySaver IGU, Clear glass combo, first thickness, MiterCut liner, first available handle, wallThickness=90, windZone="Extra High"
  - **New Build**: wallThickness=140 only (Phase 1, easily extensible via `NEW_BUILD_DEFAULTS` placeholder)
- **Wind Zone Auto-fill**: When `frameType` starts with "ES52", windZone auto-fills to "Extra High" if empty or still matching the last auto-set value. Uses `lastAutoWindZone` ref to track. User edits are never overridden. Editing existing items clears the ref to prevent unexpected changes.
- **Height-from-floor Warning**: Non-blocking amber warning below the height-from-floor input when value is 1-799mm. Text: "Height under 800mm — safety glazing / toughening may be required." Uses AlertTriangle icon. Visible on both desktop and mobile.
- **Preset Foundation**: Typed `SiteVisitPreset` model exists in `client/src/lib/site-visit-presets.ts` with seed data for LJ division (renovation + new_build). Read-only display in Settings division tab. Quote builder still uses its own hardcoded `getPresetDefaults()` — migration to settings-backed presets is a future step (requires backend CRUD for presets).

## Mobile Scroll Architecture
- Quote Builder root uses `h-full` (not `h-[100dvh]`) to fill `<main>` without overflow.
- App.tsx `<main>` has `min-h-0` for flex shrinking. Still uses `overflow-auto` for other pages.
- Config tab on mobile uses `ScrollArea` with `native-scroll` CSS class that forces `-webkit-overflow-scrolling: touch` and hides custom Radix scrollbars. Desktop retains standard `ScrollArea`.
- Items tab on mobile uses plain `<div className="overflow-y-auto">` — no Radix ScrollArea.
- Tab switching (`mobileTab` state) does NOT reinitialize the form — form state is preserved across Config/Preview/Items switches.

## Mobile Field-Readiness (Phase 1)
- **Edit → Config Tab**: Tapping Edit on a mobile item card auto-switches to Config tab and scrolls to top.
- **Add Next Item**: Available in Items tab and Preview tab. Reuses `resetFormForNewItem()` + tab switch.
- **Sticky Action Bar**: Mobile Config tab has sticky bottom bar with Add/Update, Cancel, Preview, Items actions — always reachable without scrolling.
- **Enhanced Item Cards**: Mobile cards show frame type, glass/IGU summary, photo count, dimensions (font-semibold).
- **Collapsible Header (Phase 3)**: Mobile header auto-collapses after first item is added (respects focus). Collapsed view shows job name, address, site type badge, item count, pencil icon. Manual expand/collapse toggle always available. Desktop header unchanged.
- **Review & Generate Estimate**: Prominent CTA in Items tab and Preview tab navigates to exec-summary. Labels updated throughout (Generate Preliminary Estimate, Create New Estimate, Preview Customer Document).
- **Quote Preview Polish**: Preliminary disclaimer after header, project address in customer info, clean print layout.

## Phase 3: Mobile UX Fixes
- **T001 Mobile Scroll**: Config tab uses `native-scroll` CSS class on mobile; Items tab uses plain div with overflow-y-auto.
- **T002 Duplicate Button**: Inline form submit button hidden on mobile (`isLargeScreen` conditional). Only sticky action bar visible.
- **T003 Preview Submit**: Preview tab footer now has "Add to Quote"/"Update Item" button using same `form.handleSubmit(onSubmit)` path.
- **T004 Unsaved Changes**: `guardedNavigate()` wraps all in-app navigation paths. `pendingNavigateTo` state supports navigating to arbitrary destinations after dialog. Site type changes tracked. Unsaved local items (no savedJobId) tracked. `saveJob()` returns boolean; Save & Leave only navigates on success. Save & Leave dialog stays open during save with loading spinner and disabled buttons (`isSaveAndLeaving` state).
- **T005 First-Item Speed**: Job created on first `onSubmit()` via `ensureJobExists()` (no pre-create effect). Immediate auto-save (0ms delay) after first item on new job to persist item to server right away.
- **T006 Collapsible Header**: `headerCollapsed` state with auto-collapse after first item (focus-aware). Compact summary vs full editable fields. Manual toggle.
- **T007 Exec Summary Layout**: Responsive padding (`p-4 sm:p-6`), spacing (`space-y-4 sm:space-y-6`), `overflow-x-hidden`, `flex-wrap` on action buttons, responsive table header sizing.

## Quote Document Model (Phase 2)
- **Location**: `client/src/lib/quote-document.ts`
- **Purpose**: Normalized, typed model (`QuoteDocumentModel`) that maps raw preview-data API response into clean sections: metadata, branding, org, customer, project, items[], totals, content, specDisplay.
- **Builder**: `buildQuoteDocumentModel(preview: PreviewData)` handles all fallback logic (division overrides → org defaults), date computation, snapshot item mapping.
- **Usage**: `quote-preview.tsx` now uses the document model exclusively — all direct `preview.orgSettings`/`preview.snapshot` references replaced with `doc.*` fields.
- **Additive**: No backend changes, no schema changes. Pure client-side normalization layer.

## Division Logo Upload (Phase 2)
- **Mechanism**: Reuses existing `/api/drawing-images` upload endpoint (accepts PNG). No new API routes or schema changes.
- **Storage**: Uploaded logo key stored in existing `logoUrl` field as `/api/drawing-images/{key}`.
- **UI**: `LogoUploadField` component in settings.tsx — upload button (primary), URL entry (fallback toggle), preview thumbnail with remove button.
- **Client Processing**: Images resized to max 600px dimension and converted to PNG client-side before upload.
- **Quote Preview**: Already renders division logo from `logoUrl` — uploaded logos work automatically.

## Key Files
- `client/src/pages/quote-builder.tsx` — Main quote builder with mobile site visit mode
- `client/src/pages/quote-preview.tsx` — Customer-facing quote document preview (uses QuoteDocumentModel)
- `client/src/pages/exec-summary.tsx` — Executive summary / review & generate estimate page
- `client/src/pages/quote-detail.tsx` — Quote detail management page
- `client/src/pages/settings.tsx` — Org, division, and app settings (includes logo upload + preset display)
- `client/src/lib/quote-document.ts` — QuoteDocumentModel types and builder
- `client/src/lib/navigation-guard.tsx` — NavigationGuardContext for sidebar unsaved-changes protection
- `client/src/lib/site-visit-presets.ts` — SiteVisitPreset types and seed data
- `shared/schema.ts` — Database schema and types
- `shared/estimate-snapshot.ts` — EstimateSnapshot type definitions
- `server/routes.ts` — API routes (includes upload endpoints)

## Remaining Work
- **Full Preset CRUD**: Backend API + DB storage for division-specific site visit presets, then migrate quote-builder from hardcoded `getPresetDefaults()` to settings-backed presets.
- **Quote Engine**: Full document generation pipeline, PDF templates per division, customer delivery flow.
- **Logo Management**: Dedicated logo upload endpoint (currently reuses drawing-images), logo sizing/positioning options per template.
