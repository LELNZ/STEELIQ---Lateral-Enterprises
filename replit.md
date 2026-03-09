# SteelIQ – Lateral Enterprises

## Current Milestone
Template Builder v1.3 (T083–T089) complete. Company Master Template v2 (T077–T082) complete. Template Builder v1.2 (T071–T076) complete.
- **Template Builder v1.3 (T083–T089)**: Granular template controls + A4 lock + header/schedule refinement. T083: strict A4 geometry enforced (`PAGE_WIDTH=210`, `PAGE_HEIGHT=297`, named margin constants, `CONTENT_WIDTH=180`, `MAX_Y=279`); preview at 794px fixed-width A4 simulation. T084: granular header controls — `logoWidthMm`, `logoMaxHeightMm` (slider 10–120mm / 5–60mm), `legalLinePlacement` (under_logo/beside_logo/hidden), `contactBlockAlignment` (right/stacked_right/compact_right), `headerBottomSpacingMm` (slider 0–20mm). T085: granular schedule controls — `drawingMaxHeightMm` (slider 15–80mm), `photoMaxHeightMm` (slider 10–60mm), `specRowHeightMm` (slider 2–8mm), `itemCardPaddingMm` (slider 1–10mm), `itemCardGapMm` (slider 1–10mm); these override density presets. T086: density rebalanced — standard drawingMaxH=38 (was 32), specRowH=3.5 (was 3.8), photoRowH=20 (was 22); comfortable drawingMaxH=50 (was 45). T087: Template Builder UI extended with granular controls organized under Header, Schedule, Theme/Spacing cards; sliders with live mm readouts; density preset change clears granular overrides. T088: all controls affect both Preview and PDF; header/schedule parity maintained. T089: tightly scoped — no drag-and-drop, no section reordering, no raw CSS editing. Architecture guards preserved — no schema/lifecycle changes. Server schema extended with bounded Zod validation for all new fields.
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