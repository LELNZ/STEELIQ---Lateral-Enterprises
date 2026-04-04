# SteelIQ – Lateral Enterprises

## Overview
SteelIQ is a professional quotation and estimating platform tailored for the window and door industry. Its core purpose is to automate and optimize the quotation workflow, offering features such as item configuration, real-time visual representation, precise pricing, and efficient document generation. The platform provides live SVG technical drawings, comprehensive estimate and quote lifecycle management, detailed pricing breakdowns, and a flexible template-driven PDF engine. It includes tools for managing organizational and division-specific settings, dynamic specification displays, and a project-centric CRM workflow. SteelIQ aims to streamline operations, enhance accuracy, and provide a competitive advantage for businesses in the window and door sector.

## User Preferences
I want iterative development.
Ask before making major changes.
I prefer detailed explanations.
Do not make changes to the folder `shared` EXCEPT shared/schema.ts and shared/estimate-snapshot.ts (approved).

## System Architecture
**Frontend**: Built with React and TypeScript, leveraging Shadcn UI for a responsive, mobile-first user experience.
**Backend**: Developed using Express.js, with a PostgreSQL database managed via Drizzle ORM and node-postgres.
**Drawing Engine**: Utilizes SVG for real-time technical drawing rendering and supports PNG export. Server-side drawing repair/regeneration (SVG to PNG) is handled without a browser DOM.
**State Management**: React state manages UI components, while TanStack Query handles API data fetching and caching. Global settings use React Context and localStorage.
**Routing**: Client-side navigation is managed by Wouter with a centralized route helper.
**Export Capabilities**: Supports SVG to PNG conversion and multi-page, vector-text selectable PDF generation using jsPDF, including specialized features for Subcontractor PDFs and performance optimizations.
**Storage**: Item photos and drawing PNGs are stored in PostgreSQL (`bytea`), with an in-memory cache and filesystem mirror. Division logos are stored as base64 data URLs in PostgreSQL.
**Multi-Division Architecture**: Supports organizational and division-specific settings, including `domainType` (joinery/engineering/laser/general) to drive conditional UI behavior and domain-aware contracts for the quote/item/snapshot/render pipeline.
**Spec Dictionary System**: Provides configurable entries for dynamic display and override of specifications.
**Laser Foundation**: Supports a complete quote workflow for the Laser division, including manual item entry, snapshot persistence, and domain-specific preview and PDF rendering. It incorporates a `ll_sheet_materials` table for supplier-linked material master data and a separate Laser pricing engine. Material cost uses a sheet-consumption model: `ceil(totalPartArea / usableSheetArea) × pricePerSheet`, with minimum $25 per line item (not per unit). LL customer documents are domain-aware — joinery-specific wording (e.g., "All joinery is viewed from outside", installation/removal labels) is suppressed in LL preview/PDF output. Display settings are domain-filtered to show only LL-relevant toggles. The quotes list shows "Laser Quote" type label for LL quotes instead of "Unclassified". The laser builder table includes inline internal cost/markup/margin indicators for estimator visibility.
**LL Settings Foundation (Phase 3A)**: LL pricing is now settings-driven via `llPricingSettingsJson` JSONB column on `division_settings`. All rates read from division settings instead of hardcoded `LL_PRICING_DEFAULTS`. The settings structure includes: `machineProfiles` (with bed/usable dimensions, hourly rate, material capability limits), `processRateTables` (material/thickness-specific cut speeds, pierce times, gas types — 40+ entries), `gasCosts` (O2/N2/air $/L), `consumableCosts` ($/machine-hr), `labourRates` (operator + shop rates), `setupHandlingDefaults`, `commercialPolicy` (markup, minimums, expedite tiers), `nestingDefaults` (kerf, gap, edge trim, utilisation). Schema seams anchored: `LaserQuoteItem` and `LaserSnapshotItem` now include optional `operations` array (laser/fold types) and `geometrySource` field (manual/dxf/cam_import) for future folding and DXF import. Read-only LL pricing settings viewer available in Settings > Divisions > LL tab. The `LLPricingSettings` TypeScript interface is defined in `shared/schema.ts`.
**Library Category Ownership Model**: Defines explicit ownership of library categories by division (LJ, LL, LE) to ensure data relevance and prevent cross-contamination.
**Quote Management**: Features a comprehensive lifecycle (Draft, Review, Sent, Accepted/Declined, Archived) with atomic sequential numbering, immutable revision history, and server-side status enforcement. Each quote includes an `EstimateSnapshot` for immutable revision data.
**Pricing System**: Calculates material, labor, glass, liner, and handle costs, providing net cost, sale price, and margin. Supports manual price override, removal/rubbish fees, markup application, GOS charges, and geometry-aware pricing.
**Pane-Level Glass Selection**: Allows per-pane glass selectors for items meeting specific criteria, with data stored in `paneGlassSpecs` and validated through an integrity system.
**Configuration & Drawing**: Dedicated database tables for frame configurations, profiles, accessories, and labor. Features auto-detection of configurations, dynamic opening indicators, and support for various window/door types (e.g., French windows, stacker doors, entrance doors, raked/triangular fixed windows, bay windows).
**Master Library Systems**: Centralized libraries for direct materials, manufacturing labor, installation labor, and delivery methods, with controls for active status and default designations.
**CRM Workflow**: Project-centric CRM with automatic customer linking from quotes, project creation linked to quotes, and sub-query endpoints.
**Invoice Management**: Manages invoices with detailed line items, full CRUD operations, automated status demotion, and Xero integration.
**Xero Integration**: Supports Xero payment visibility and status readback, including a "Sync from Xero" button and a "Xero Link Reset / Reissue Workflow."
**Job/Quote/Invoice Linkage**: Resolves job name and variation title through linked records and auto-populates invoice references from the source job name.
**UI/UX**: Features responsive tables, polished spec row formatting in PDFs, project dashboard guidance, customer relink safeguards, and an enterprise app shell with workflow-domain grouped navigation.

## External Dependencies
- **PostgreSQL**: Primary relational database.
- **Drizzle ORM**: Object-Relational Mapper.
- **node-postgres**: PostgreSQL client.
- **React**: UI library.
- **TypeScript**: Statically typed JavaScript.
- **Shadcn UI**: UI component library.
- **TanStack Query**: Data fetching and caching library.
- **Wouter**: Routing library.
- **jsPDF**: Client-side PDF generation library.
- **multer**: Middleware for handling `multipart/form-data`.
- **sharp**: High-performance image processing for server-side SVG to PNG rendering.