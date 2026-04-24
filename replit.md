# SteelIQ – Lateral Enterprises

## Overview
SteelIQ is a professional quotation and estimating platform for the window and door industry. It automates and optimizes the quotation workflow with features such as item configuration, real-time visual representation via live SVG drawings, precise pricing, and efficient document generation. The platform includes comprehensive estimate and quote lifecycle management, detailed pricing breakdowns, and a flexible template-driven PDF engine. It supports organizational and division-specific settings, dynamic specification displays, and a project-centric CRM workflow, aiming to enhance accuracy and streamline operations. SteelIQ also supports a complete quote workflow for the Laser division, including manual item entry, snapshot persistence, and domain-specific preview and PDF rendering with a dedicated pricing engine.

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
**Laser Division Workflow**: Supports a complete quote workflow for the Laser division, including manual item entry, snapshot persistence, and domain-specific preview and PDF rendering. It incorporates a detailed sheet materials library, a separate Laser pricing engine using time-based process costing (Phase 5B Bucketed Commercial Pricing), and a system for manual pricing overrides and provisional lines (Phase 5E). Pricing profiles are versioned, and source cost inputs are governed. A 4-tier precedence model determines pricing. Laser line items can also carry attached manual procedures (Folding/Deburring/Tapping/Other) priced manually/provisionally — these display as indented child sub-rows in the items table and as flattened sub-lines in the snapshot for PDF/Preview, while parent commercial overrides apply only to the laser base. Customer-facing Preview/PDF render manual + attached procedure pseudo-rows with labelled spec rows (Type / Procedure / Description / Attached To). Two optional per-revision Display-Settings toggles ("Item Unit Price" and "Item Line Total", LL only, default OFF) surface per-line sell-side pricing inside the existing item spec table without exposing cost / margin / supplier / internal notes.
**Quote Management**: Features a comprehensive lifecycle (Draft, Review, Sent, Accepted/Declined, Archived) with atomic sequential numbering, immutable revision history, and server-side status enforcement. Each quote includes an `EstimateSnapshot` for immutable revision data.
**Pricing System**: Calculates material, labor, glass, liner, and handle costs, providing net cost, sale price, and margin. Supports manual price override, removal/rubbish fees, markup application, GOS charges, and geometry-aware pricing.
**Master Library Systems**: Centralized libraries for direct materials, manufacturing labor, installation labor, and delivery methods, with controls for active status and default designations.
**CRM Workflow**: Project-centric CRM with automatic customer linking from quotes, project creation linked to quotes, and sub-query endpoints. Projects have persisted `projectNumber` (PRJ-XXXX format) auto-assigned via server-side sequence on creation. Accepted LL quotes auto-match or auto-create CRM customers and include a 4-step delivery workflow stepper. A lightweight 7-stage workflow strip (Estimate → Quote → Accepted → Customer → Project → Job → Invoice) is integrated across detail pages for visibility.
**Invoice Management**: Manages invoices with detailed line items, full CRUD operations, automated status demotion, and Xero integration.
**UI/UX**: Features responsive tables, polished spec row formatting in PDFs, project dashboard guidance, customer relink safeguards, and an enterprise app shell with workflow-domain grouped navigation. Standardized list page headers, row styling, and `max-w-7xl` width for settings/users pages. Governance systems support archive/delete with chain-aware safety guards, and audit activity tables use business-facing identifiers.

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