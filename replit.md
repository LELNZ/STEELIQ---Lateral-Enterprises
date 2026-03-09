# SteelIQ – Lateral Enterprises

## Current Milestone
PDF/Preview Stabilisation Pass (T083–T088) complete. Company Master Template v2 (T077–T082) complete. Template Builder v1.2 (T071–T076) complete.
- **PDF/Preview Stabilisation (T083–T088)**: Strict A4 geometry enforced in PDF engine — `PAGE_WIDTH=210`, `PAGE_HEIGHT=297`, named margin constants (`LEFT_MARGIN=15`, `RIGHT_MARGIN=15`, `TOP_MARGIN=18`, `BOTTOM_MARGIN=18`), `CONTENT_WIDTH=180`, `MAX_Y=279`. All legacy constants (`MARGIN`, `CW`, `PAGE_W`, `PAGE_H`) removed. Preview A4 simulation: fixed-width container at 794px (A4 at 96dpi), white background with generous padding. Page break prevention improved: precise item height estimation using density constants (`DENSITY_ITEM_HEADER_H + max(drawingH, specH) + photoH`). Photo reliability hardened: `renderPhotosFromCache` returns `{y, count}`, `tryRenderPhotos` only renders "SITE PHOTOS" heading after confirming at least one photo was successfully drawn. Architecture guards preserved — no schema/API/lifecycle changes.
- **Company Master Template v2 (T077–T082)**: Professional redesign of the default company quote template. Header redesigned: logo is now the primary brand element (default `large`), trading name off by default (`showTradingName: false`), legal line at 6.5pt/10px italic, logo+text placed side-by-side instead of stacked. Schedule density tightened to professional defaults targeting ~4 items/page: `drawingMaxH=32`, `specRowH=3.8`, `itemHeaderH=10`, `photoRowH=22`, `itemCardPadMm=3`, `itemGapMm=3`. Density presets recalibrated: comfortable(~3/page), standard(~4/page), compact(~5/page). Item card composition refined: single-line header with title left + qty/dims right, tighter padding, cleaner visual hierarchy, smaller photo label text. Photo size presets tightened (18/25/40mm). Spacing presets tightened (compact=3mm, standard=5mm, spacious=8mm). Builder controls relabeled: "Logo Scale" with "(recommended)" on large, "Show Company Name" with guidance about logo-contains-name, density options show items/page estimates. All changes applied to both Preview and PDF with aligned composition logic. Template ID updated to `company_master_v2`. Architecture guards preserved — no schema/API/lifecycle changes.
- **Template Builder v1 (T056–T062)**: Structured config editor for the company master quote template. Persisted via `org_settings.template_config_json` (JSONB). `CompanyTemplateConfig` type defines safe editable fields: sections (visibility toggles), spacingPreset (compact/standard/spacious), typographyPreset (small/standard/large), photoSizePreset (small/medium/large), accentColor, scheduleLayoutVariant, totalsLayoutVariant. Resolution chain: hardcoded COMPANY_MASTER_TEMPLATE defaults → company config (`applyCompanyConfig`) → division overrides (`resolveQuoteTemplate`). Server: `GET/PATCH /api/settings/template` with Zod validation. Preview-data endpoint includes `companyTemplateConfig`. Settings page has new "Template" tab with builder UI: Sections card (7 section visibility toggles), Summary card (totals layout), Schedule card (layout + photo size), Theme/Spacing card (accent color picker, typography/spacing presets). Live schematic preview panel shows section layout, accent color, spacing/type labels. Division settings relabeled "Division Override" with clear reference to Template tab. No drag-and-drop, no freeform editing, no per-customer templates. Architecture guards preserved.

## Overview
SteelIQ is a professional quotation and estimating platform designed for Lateral Enterprises, catering to the window and door industry. It provides a robust, user-friendly system for configuring window and door items, generating live SVG technical drawings, and managing estimates and quotes. The platform streamlines the entire quotation process from configuration and visualization to pricing and export, ensuring accurate and visually rich outputs. Key capabilities include real-time drawing previews, comprehensive estimate and quote lifecycle management, item photo capture, detailed pricing breakdowns, and a template-driven PDF engine for professional document generation.

## User Preferences
I want iterative development.
Ask before making major changes.
I prefer detailed explanations.
Do not make changes to the folder `shared` EXCEPT shared/schema.ts and shared/estimate-snapshot.ts (approved).

## System Architecture
**Frontend**: React with TypeScript and Shadcn UI components, emphasizing a responsive mobile-first design.
**Backend**: Express.js with PostgreSQL, Drizzle ORM, and node-postgres.
**Drawing Engine**: SVG-based rendering with PNG export capabilities, integrated with real-time drawing previews.
**State Management**: React state for UI components and TanStack Query for API data fetching and caching.
**Global Settings**: Managed via React Context and persisted in localStorage.
**Routing**: Wouter for client-side navigation.
**Export Capabilities**: SVG to PNG conversion and multi-page, vector-text selectable PDF generation using jsPDF.
**Storage**: Item photos are stored in PostgreSQL (`bytea` column) with an in-memory cache. Drawing PNGs are stored on the filesystem.
**Multi-Division Architecture**: Supports organizational and division-specific settings, including `division_scope` for library entries.
**Spec Dictionary System**: Configurable `spec_dictionary` entries for dynamic specification display and override functionality.
**Quote Management**: Features a comprehensive lifecycle (Draft, Review, Sent, Accepted/Declined, Archived), atomic sequential numbering, immutable revision history, and server-side status transition enforcement. Quotes include an `EstimateSnapshot` for immutable revision data.
**Pricing System**: A utility calculates material, labor, glass, liner, and handle costs, providing net cost, sale price, and margin, including configurable GST.
**Configuration & Drawing**: Utilizes dedicated tables for frame configurations, profiles, accessories, and labor, with features like auto-detection of configurations, standard frame sizes, and dynamic opening indicators.
**Master Library Systems**: Centralized libraries for direct materials, manufacturing labor, installation labor, and delivery methods.
**Site Visit Mode**: Client-only `siteType` state for jobs, enabling preset defaults for "renovation" and "new_build" contexts.
**Mobile Architecture**: Optimized for mobile with `native-scroll`, sticky action bars, enhanced item cards, and a collapsible header.
**Quote Document Model**: Defines `PreviewData` (API response shape), `QuoteDocumentModel` (normalized rendering contract), and `buildQuoteDocumentModel()` (mapper).
**Quote Renderer**: Defines `QuoteRenderModel` (presentation-ready structure) and `buildQuoteRenderModel()` (pure mapper from `QuoteDocumentModel`). The preview page renders from `QuoteRenderModel` via decomposed section components.
**Lifecycle Service**: Centralized handling for archive, soft-delete, hard-delete, cascade operations, orphan detection, and development cleanup routines.

## External Dependencies
- **PostgreSQL**: Primary database.
- **Drizzle ORM**: Object-Relational Mapper for PostgreSQL.
- **node-postgres**: PostgreSQL client for Node.js.
- **React**: Frontend UI library.
- **TypeScript**: Superset of JavaScript for static typing.
- **Shadcn UI**: Component library for React.
- **TanStack Query**: Data fetching and caching library.
- **Wouter**: Client-side routing library.
- **jsPDF**: JavaScript library for generating PDFs.
- **multer**: Middleware for handling `multipart/form-data` for file uploads.