# SteelIQ – Lateral Enterprises

## Overview
SteelIQ is a professional quotation and estimating platform for the window and door industry. Its primary goal is to streamline the entire quotation process, from configuration and visualization to pricing and export, by offering a robust system for configuring items, generating live SVG technical drawings, and managing estimates and quotes. Key capabilities include real-time drawing previews, comprehensive estimate and quote lifecycle management, detailed pricing breakdowns, and a template-driven PDF engine for professional document generation. The platform aims to be a leading solution for efficient and accurate quoting within the industry.

## User Preferences
I want iterative development.
Ask before making major changes.
I prefer detailed explanations.
Do not make changes to the folder `shared` EXCEPT shared/schema.ts and shared/estimate-snapshot.ts (approved).

## System Architecture
**Frontend**: React, TypeScript, Shadcn UI for a responsive, mobile-first design.
**Backend**: Express.js with PostgreSQL, Drizzle ORM, and node-postgres.
**Drawing Engine**: SVG for rendering with real-time previews and PNG export.
**State Management**: React state for UI components; TanStack Query for API data.
**Global Settings**: Managed via React Context and localStorage.
**Routing**: Wouter for client-side navigation.
**Export Capabilities**: SVG to PNG conversion and multi-page, vector-text selectable PDF generation using jsPDF.
**Storage**: Item photos in PostgreSQL (`bytea`) with in-memory cache; drawing PNGs on filesystem. Division logos are stored as base64 data URLs in PostgreSQL.
**Multi-Division Architecture**: Supports organizational and division-specific settings, including `division_scope` for library entries.
**Spec Dictionary System**: Configurable `spec_dictionary` entries for dynamic specification display and override.
**Quote Management**: Comprehensive lifecycle (Draft, Review, Sent, Accepted/Declined, Archived), atomic sequential numbering, immutable revision history, and server-side status transition enforcement. Quotes include an `EstimateSnapshot` for immutable revision data.
**Pricing System**: Utility calculates material, labor, glass, liner, and handle costs, providing net cost, sale price, and margin, including configurable GST. Features manual price override and includes removal/rubbish fees.
**Configuration & Drawing**: Dedicated tables for frame configurations, profiles, accessories, and labor, with auto-detection of configurations, standard frame sizes, and dynamic opening indicators. Supports various window types, including French windows and hardened stacker door logic.
**Master Library Systems**: Centralized libraries for direct materials, manufacturing labor, installation labor, and delivery methods.
**Site Visit Mode**: Client-only `siteType` state for jobs to apply "renovation" and "new_build" defaults.
**Mobile Architecture**: Optimized with `native-scroll`, sticky action bars, enhanced item cards, and a collapsible header.
**Quote Document Model**: `PreviewData` (API response), `QuoteDocumentModel` (normalized rendering contract), and `buildQuoteDocumentModel()` (mapper).
**Quote Renderer**: `QuoteRenderModel` (presentation-ready structure) and `buildQuoteRenderModel()` (pure mapper from `QuoteDocumentModel`) for preview page rendering.
**Lifecycle Service**: Centralized handling for archive, soft-delete, hard-delete, cascade operations, orphan detection, and development cleanup routines. Template-driven, read-only lifecycle visibility for all quotes and operational jobs, with template locking upon quote acceptance.
**CRM Workflow (Projects-First)**: Project-centric CRM with automatic customer linking from quotes, project creation linked to quotes, and sub-query endpoints for project-related data (quotes, jobs, invoices). Enforces customer linkage for invoicing.
**Invoice Allocation Control**: Prevents over-invoicing with deposit caps (50% of accepted value, base contract only) and invoiceable ceiling caps. The invoiceable ceiling = accepted contract value + total approved variation amounts. Provides a detailed invoice allocation state via API including variation breakdown.
**Variations Commercial Model**: Project-level variations table (`draft → sent → approved → invoiced`). Variations link to both `projectId` and `quoteId`. Approved variations expand the invoiceable ceiling on the linked quote. Variation invoices must be linked to a specific approved variation record and cannot exceed its remaining value. The `getVariationsForAllocation` storage method fetches variations by quoteId plus project-level variations (no quoteId), ensuring backward compatibility.
**UI/UX Enhancements**: Improved table responsiveness for quotes and invoices lists, collapsing secondary columns on smaller viewports. PDF generation includes polished spec row formatting to handle wrapped lines cleanly. Project dashboard includes guidance text and links to related entities. Customer relink safeguard with confirmation dialog if invoices exist. Measurement logic on `op_jobs` table for `measurementRequirement` and `dimensionSource`.

## External Dependencies
- **PostgreSQL**: Primary database.
- **Drizzle ORM**: ORM for PostgreSQL.
- **node-postgres**: PostgreSQL client.
- **React**: Frontend UI library.
- **TypeScript**: For static typing.
- **Shadcn UI**: Component library.
- **TanStack Query**: Data fetching and caching.
- **Wouter**: Client-side routing.
- **jsPDF**: PDF generation.
- **multer**: File uploads.