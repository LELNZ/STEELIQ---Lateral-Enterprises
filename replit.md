# SteelIQ – Lateral Enterprises

## Overview
SteelIQ is a professional quotation and estimating platform tailored for the window and door industry. It offers a robust and user-friendly system for configuring window and door items, generating live SVG technical drawings, and managing estimates and quotes. The platform's primary goal is to streamline the entire quotation process, from configuration and visualization to pricing and export, ensuring accurate and visually rich outputs. Key features include real-time drawing previews, comprehensive estimate and quote lifecycle management, item photo capture, detailed pricing breakdowns, and a template-driven PDF engine for professional document generation. The project aims to be a leading solution for efficient and accurate quoting within the industry.

## User Preferences
I want iterative development.
Ask before making major changes.
I prefer detailed explanations.
Do not make changes to the folder `shared` EXCEPT shared/schema.ts and shared/estimate-snapshot.ts (approved).

## System Architecture
**Frontend**: Built with React, TypeScript, and Shadcn UI components, emphasizing a responsive mobile-first design.
**Backend**: Implemented using Express.js with PostgreSQL, Drizzle ORM, and node-postgres.
**Drawing Engine**: Utilizes SVG for rendering with PNG export capabilities and integrated real-time drawing previews.
**State Management**: React state manages UI components, while TanStack Query handles API data fetching and caching.
**Global Settings**: Managed via React Context and persisted in localStorage.
**Routing**: Wouter is used for client-side navigation.
**Export Capabilities**: Supports SVG to PNG conversion and multi-page, vector-text selectable PDF generation using jsPDF.
**Storage**: Item photos are stored in PostgreSQL (`bytea` column) with an in-memory cache, and drawing PNGs are stored on the filesystem.
**Multi-Division Architecture**: The system supports organizational and division-specific settings, including `division_scope` for library entries.
**Spec Dictionary System**: Features configurable `spec_dictionary` entries for dynamic specification display and override functionality.
**Quote Management**: Includes a comprehensive lifecycle (Draft, Review, Sent, Accepted/Declined, Archived), atomic sequential numbering, immutable revision history, and server-side status transition enforcement. Quotes include an `EstimateSnapshot` for immutable revision data.
**Pricing System**: A utility calculates material, labor, glass, liner, and handle costs, providing net cost, sale price, and margin, including configurable GST.
**Configuration & Drawing**: Utilizes dedicated tables for frame configurations, profiles, accessories, and labor, with features like auto-detection of configurations, standard frame sizes, and dynamic opening indicators.
**Master Library Systems**: Centralized libraries are maintained for direct materials, manufacturing labor, installation labor, and delivery methods.
**Site Visit Mode**: A client-only `siteType` state for jobs enables preset defaults for "renovation" and "new_build" contexts.
**Mobile Architecture**: Optimized for mobile with `native-scroll`, sticky action bars, enhanced item cards, and a collapsible header.
**Quote Document Model**: Defines `PreviewData` (API response shape), `QuoteDocumentModel` (normalized rendering contract), and `buildQuoteDocumentModel()` (mapper).
**Quote Renderer**: Defines `QuoteRenderModel` (presentation-ready structure) and `buildQuoteRenderModel()` (pure mapper from `QuoteDocumentModel`). The preview page renders from `QuoteRenderModel` via decomposed section components.
**Lifecycle Service**: Centralized handling for archive, soft-delete, hard-delete, cascade operations, orphan detection, and development cleanup routines.
**Global Lifecycle Platform (Phase 1 + Foundation Tightening)**: Template-driven, read-only lifecycle visibility for all quotes and operational jobs. Key files: `shared/lifecycle.ts` (framework types), `server/lifecycle-templates.ts` (LJ template v1 + seeder), `server/lifecycle-service.ts` (derivation from system signals — accepts `template: LifecycleTemplateConfig` directly as parameter, no hardcoded constant), `client/src/components/lifecycle-panel.tsx` (UI). LJ division has 10 lifecycle stages (Estimate → Closeout) derived from quote status, invoice state, and opJob status. Template version locked at quote acceptance via `lifecycle_instances` table. `lifecycle_templates` and `lifecycle_instances` DB tables added (unique index on `lifecycle_instances.quote_id`). API: `GET /api/quotes/:id/lifecycle`, `GET /api/op-jobs/:id/lifecycle`. Template loading is now DB-driven: post-acceptance routes load by `instance.templateId` (locked version); pre-acceptance routes load the active template by division code. Blocked-state derivation: `site_measure` is blocked when `commercial_setup` is active (quote accepted, no processed invoice, no opJob). Panel shows three footer states: "Preview" (pre-acceptance), "Active template (accepted pre-tracking)" (accepted, no instance), "Template locked {date}" (accepted with locked instance). Panel shown on quote-detail and op-job-detail pages. Storage method `getLifecycleTemplateById` added.

## External Dependencies
- **PostgreSQL**: Primary database for the application.
- **Drizzle ORM**: Used for object-relational mapping with PostgreSQL.
- **node-postgres**: PostgreSQL client for Node.js.
- **React**: Frontend UI library.
- **TypeScript**: Used for static typing across the codebase.
- **Shadcn UI**: Component library for React.
- **TanStack Query**: For data fetching and caching.
- **Wouter**: Client-side routing library.
- **jsPDF**: JavaScript library for generating PDFs.
- **multer**: Middleware for handling `multipart/form-data` for file uploads.