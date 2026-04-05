# SteelIQ – Lateral Enterprises

## Overview
SteelIQ is a professional quotation and estimating platform designed for the window and door industry. It automates and optimizes the quotation workflow by offering features such as item configuration, real-time visual representation via live SVG drawings, precise pricing, and efficient document generation. The platform includes comprehensive estimate and quote lifecycle management, detailed pricing breakdowns, and a flexible template-driven PDF engine. It supports organizational and division-specific settings, dynamic specification displays, and a project-centric CRM workflow. SteelIQ aims to enhance accuracy, streamline operations, and provide a competitive advantage for businesses in the window and door sector. It also supports a complete quote workflow for the Laser division, including manual item entry, snapshot persistence, and domain-specific preview and PDF rendering with a dedicated pricing engine.

## User Preferences
I want iterative development.
Ask before making major changes.
I prefer detailed explanations.
Do not make changes to the folder `shared` EXCEPT shared/schema.ts and shared/estimate-snapshot.ts (approved).

## System Architecture
**Frontend**: Built with React and TypeScript, utilizing Shadcn UI for a responsive, mobile-first user experience.
**Backend**: Developed using Express.js, with a PostgreSQL database managed via Drizzle ORM and node-postgres.
**Drawing Engine**: Employs SVG for real-time technical drawing rendering and supports PNG export. Server-side drawing repair/regeneration (SVG to PNG) is handled without a browser DOM.
**State Management**: React state manages UI components, while TanStack Query handles API data fetching and caching. Global settings use React Context and localStorage.
**Routing**: Client-side navigation is managed by Wouter with a centralized route helper.
**Export Capabilities**: Supports SVG to PNG conversion and multi-page, vector-text selectable PDF generation using jsPDF, including specialized features for Subcontractor PDFs.
**Storage**: Item photos and drawing PNGs are stored in PostgreSQL (`bytea`), with an in-memory cache and filesystem mirror. Division logos are stored as base64 data URLs in PostgreSQL.
**Multi-Division Architecture**: Supports organizational and division-specific settings, including `domainType` to drive conditional UI behavior and domain-aware contracts for the quote/item/snapshot/render pipeline.
**Spec Dictionary System**: Provides configurable entries for dynamic display and override of specifications.
**Laser Division Workflow**: Supports a complete quote workflow for the Laser division, including manual item entry, snapshot persistence, and domain-specific preview and PDF rendering. It incorporates a `ll_sheet_materials` table for supplier-linked material master data and a separate Laser pricing engine. The Laser pricing engine uses time-based process costing based on configurable `llPricingSettingsJson` for machine profiles, process rate tables, gas costs, consumable costs, labour rates, setup/handling defaults, commercial policy, and nesting defaults. Pricing profiles are versioned with an enterprise approval workflow, stored in `ll_pricing_profiles`, and provide server-side estimate stamping, DB-level single-active enforcement, and transactional activation. Governed gas and consumables cost inputs are managed via `ll_gas_cost_inputs` and `ll_consumables_cost_inputs` tables, offering supplier traceability and governance lifecycle. A 4-tier precedence model (Commercial Inputs > Pricing Profile > Materials Library > Profile fallback values) determines pricing. The LL admin interface provides 4 canonical tabs (Library, Source Costs, Pricing Model, Audit Trail) with full-width layout (`max-w-6xl`), status filters, lifecycle guidance, and operational workflow documentation. Compressed air is supported as a governed gas type with provisional/manual entry capability.
**Library Category Ownership Model**: Defines explicit ownership of library categories by division (LJ, LL, LE) to ensure data relevance and prevent cross-contamination.
**Quote Management**: Features a comprehensive lifecycle (Draft, Review, Sent, Accepted/Declined, Archived) with atomic sequential numbering, immutable revision history, and server-side status enforcement. Each quote includes an `EstimateSnapshot` for immutable revision data.
**Pricing System**: Calculates material, labor, glass, liner, and handle costs, providing net cost, sale price, and margin. Supports manual price override, removal/rubbish fees, markup application, GOS charges, and geometry-aware pricing.
**Pane-Level Glass Selection**: Allows per-pane glass selectors for items meeting specific criteria, with data stored in `paneGlassSpecs` and validated through an integrity system.
**Configuration & Drawing**: Dedicated database tables for frame configurations, profiles, accessories, and labor. Features auto-detection of configurations, dynamic opening indicators, and support for various window/door types.
**Master Library Systems**: Centralized libraries for direct materials, manufacturing labor, installation labor, and delivery methods, with controls for active status and default designations.
**CRM Workflow**: Project-centric CRM with automatic customer linking from quotes, project creation linked to quotes, and sub-query endpoints.
**Invoice Management**: Manages invoices with detailed line items, full CRUD operations, automated status demotion, and Xero integration.
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
- **Xero**: Accounting software integration for payment visibility and status readback.