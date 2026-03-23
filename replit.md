# SteelIQ – Lateral Enterprises

## Overview
SteelIQ is a professional quotation and estimating platform tailored for the window and door industry. It automates and optimizes the quotation workflow, offering item configuration, real-time visual representation, accurate pricing, and efficient document generation. The platform aims to provide live SVG technical drawings, comprehensive estimate and quote lifecycle management, detailed pricing breakdowns, and a flexible template-driven PDF engine. It includes tools for managing organizational and division-specific settings, dynamic specification displays, and a project-centric CRM workflow. SteelIQ's vision is to streamline operations, enhance accuracy, and provide a competitive edge for businesses in the window and door sector.

## User Preferences
I want iterative development.
Ask before making major changes.
I prefer detailed explanations.
Do not make changes to the folder `shared` EXCEPT shared/schema.ts and shared/estimate-snapshot.ts (approved).

## System Architecture
**Frontend**: React and TypeScript with Shadcn UI for a responsive, mobile-first experience.
**Backend**: Express.js with PostgreSQL database, managed via Drizzle ORM and node-postgres.
**Drawing Engine**: SVG for real-time technical drawing rendering and PNG export.
**State Management**: React state for UI components; TanStack Query for API data fetching and caching. Global settings managed via React Context and localStorage.
**Routing**: Client-side navigation handled by Wouter.
**Export Capabilities**: SVG to PNG conversion and multi-page, vector-text selectable PDF generation using jsPDF, including a specialized Subcontractor Install Scope PDF.
**Storage**: Item photos in PostgreSQL (`bytea`), drawing PNGs on filesystem, division logos as base64 data URLs in PostgreSQL.
**Multi-Division Architecture**: Supports organizational and division-specific settings.
**Spec Dictionary System**: Configurable entries for dynamic display and override of specifications.
**Quote Management**: Comprehensive lifecycle (Draft, Review, Sent, Accepted/Declined, Archived) with atomic sequential numbering, immutable revision history, and server-side status transition enforcement. Quotes include an `EstimateSnapshot` for immutable revision data.
**Pricing System**: Calculates material, labor, glass, liner, and handle costs, providing net cost, sale price, and margin. Supports manual price override, removal/rubbish fees, and markup application to derive sell prices. Installation and removal pricing support `per_item`, `per_m2`, `per_lm` bases, targeting specific categories or "all" items. Geometry-aware pricing utilizes grouped geometry metrics (e.g., mullion/transom lengths, glass area) for accurate cost calculations and labor drivers. Master-library-resolved auto profiles fetch material data from a central library. Item isolation and pricing stability are ensured through deep copying of item data. Deterministic reopen: `savedItemBaselineRef` tracks each item's signature and configurationId when loaded for editing; the config matching useEffect honors the saved configId when the signature hasn't changed, preventing heuristic fallback from swapping configs on reselection.
**Configuration & Drawing**: Dedicated database tables for frame configurations, profiles, accessories, and labor. Features auto-detection of configurations, dynamic opening indicators, and support for various window/door types (e.g., French windows, stacker doors, entrance doors with auto-calculated sidelights). Custom layouts support per-pane height overrides. Geometry-aware auto-configuration uses a `geometryClass` field and adds transom profiles when detected.
**Master Library Systems**: Centralized libraries for direct materials, manufacturing labor, installation labor, and delivery methods.
**CRM Workflow (Projects-First)**: Project-centric CRM with automatic customer linking from quotes, project creation linked to quotes, and sub-query endpoints.
**Invoice Management**: Features `invoice_lines` table for detailed line item management with full CRUD operations. Header totals are reconciled from line items. Automated status demotion and conflict detection prevent inconsistent data. Invoice detail page provides a dense operational layout with status badges, amount cards, relationship cards, and Xero integration status. Invoice list page offers a consolidated view with key information and actions.
**Xero Integration**: Supports Xero payment visibility and status readback, including `xeroStatus`, `xeroAmountPaid`, `xeroAmountDue`. Provides a "Sync from Xero" button to update invoice data. Includes a "Xero Link Reset / Reissue Workflow" for handling deleted or voided Xero invoices, allowing re-issuance.
**Job/Quote/Invoice Linkage**: Invoice detail and list pages resolve job name and variation title through linked records. Invoice creation auto-populates `reference` from the source job name.
**Variations Commercial Model**: Manages project-level variations through a defined lifecycle.
**Retention Commercial Model**: Supports optional percentage-based retention.
**UI/UX**: Responsive tables, polished spec row formatting in PDFs, project dashboard guidance, customer relink safeguards, and an enterprise app shell with workflow-domain grouped navigation. Accepted quote workflow progress panel guides users through project, job, and invoice creation.
**Governance and Data Integrity**: Features for environment clarity, test data governance, and shielding of demo/test records from standard users, including archiving, Xero link clearing for demo invoices, and chain-aware linked-record cleanup.

## External Dependencies
- **PostgreSQL**: Primary relational database.
- **Drizzle ORM**: Object-Relational Mapper.
- **node-postgres**: PostgreSQL client.
- **React**: UI library.
- **TypeScript**: Statically typed JavaScript.
- **Shadcn UI**: UI component library.
- **TanStack Query**: Data fetching and caching.
- **Wouter**: Routing library.
- **jsPDF**: Client-side PDF generation.
- **multer**: Middleware for `multipart/form-data`.