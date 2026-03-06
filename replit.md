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

## Mobile Scroll Architecture
- Quote Builder root uses `h-full` (not `h-[100dvh]`) to fill `<main>` without overflow.
- App.tsx `<main>` has `min-h-0` for flex shrinking. Still uses `overflow-auto` for other pages.
- Config tab uses single `<ScrollArea>` — no nested scroll layers.
- Tab switching (`mobileTab` state) does NOT reinitialize the form — form state is preserved across Config/Preview/Items switches.