# Pro-Quote CAD Generator

## Overview
The Pro-Quote CAD Generator is a professional quotation tool designed for the window and door industry. It enables users to configure window and door items, generate live SVG technical drawings with dimensions and opening indicators, and manage these items within "Jobs." The system aims to streamline the quotation process, from configuration and visualization to pricing and export. Key capabilities include real-time drawing previews, comprehensive job management, photo capture for items, and detailed pricing breakdowns. The project's ambition is to provide a robust, user-friendly platform for generating accurate and visually rich quotes, enhancing efficiency for businesses in the window and door market.

## User Preferences
I want iterative development.
Ask before making major changes.
I prefer detailed explanations.
Do not make changes to the folder `shared` EXCEPT shared/schema.ts and shared/estimate-snapshot.ts (approved).

## System Architecture
**Frontend**: React with TypeScript and Shadcn UI components.
**Backend**: Express.js with PostgreSQL, utilizing Drizzle ORM and a node-postgres adapter.
**Drawing Engine**: SVG-based rendering within `client/src/components/drawing-canvas.tsx`, supporting PNG export.
**State Management**: Client-side React state is used for UI, complemented by TanStack Query for API data fetching and caching.
**Global Settings**: Managed via a React Context (`client/src/lib/settings-context.tsx`) with localStorage for persistence.
**Navigation**: A collapsible sidebar facilitates navigation between Jobs, Library, and Settings. Sidebar has nested "Estimates" group with "LJ – Estimates" sub-item.
**Routing**: Wouter is used for client-side routing, defining paths for job management, library access, settings, and quote preview.
**Export Capabilities**: Supports client-side SVG to PNG conversion (at 3x resolution) and multi-page PDF generation via jsPDF.
**Item Photo Storage**: Multi-photo per job item. Photos uploaded as JPEG to `uploads/item-photos/{uuid}.jpg` via POST /api/item-photos, served via GET /api/item-photos/:key with path traversal protection. DB stores `photos` JSONB array on job_items: `[{ key, isPrimary?, includeInCustomerPdf?, caption?, takenAt? }]`. Legacy `photo` field (base64) is read-only/display-only. Client compresses to 1600px long edge JPEG before upload. Gallery modal supports Set Primary, Toggle PDF flag, Delete. Snapshot captures photos[] at revision time for immutability. Deletion safety: photo files referenced by quote revision snapshots are preserved when jobs are deleted.
**Drawing Image Storage**: Drawing PNGs uploaded via POST /api/drawing-images, stored in `uploads/drawing-images/{uuid}.png`, served via GET /api/drawing-images/:key with path traversal protection.

## Multi-Division Architecture
**org_settings** table: Single-row (id="default") org-level settings (legal name, GST#, NZBN, address, bank details, default notes/terms/exclusions blocks, quote validity days).
**division_settings** table: PK=division_code ("LJ"/"LE"/"LL"). Per-division: trading name, logo, template key, legal line, theme, layout variants, spec display defaults.
**library_entries.division_scope**: TEXT NULL column — NULL=shared, "LJ"/"LE"/"LL"=division-specific. GET /api/library accepts optional divisionCode query param.
**Seeded on startup**: org_settings row, 3 division settings (LJ=Lateral Joinery, LE=Lateral Engineering, LL=Lateral Laser).

## Spec Dictionary System
**spec_dictionary** table: PK=key, with division_scope, group, label, sort_order, input_kind, library_source_key, options_json, customer_visible_allowed, unit, help_text.
**39 LJ entries** seeded across groups: Identification, Dimensions, Performance, FrameFinish, Glazing, Hardware, LinersFlashings, Install, Pricing, Layout, Notes.
**14 default customer-visible keys**: configuration, overallSize, frameSeries, frameColor, windZone, rValue, iguType, glassType, glassThickness, handleSet, linerType, flashingSize, wallThickness, heightFromFloor.
**Builder UI**: Item Specifics tab reorganized into spec-dictionary-driven groups with "Show more specs" toggle. Layout specs remain on Drawing Config tab.
**quote_revisions** additions: spec_display_override_json (jsonb), template_key (text, default "base_v1").

## Enhanced EstimateSnapshot
**shared/estimate-snapshot.ts** enhanced with:
- divisionCode, customer, specDictionaryVersion
- items[] with: itemNumber, itemRef, title, quantity, width, height, drawingImageKey, specValues (raw), resolvedSpecs (display strings)
- totalsBreakdown: itemsSubtotal, installationTotal, deliveryTotal, subtotalExclGst, gstAmount, totalInclGst
- All old fields (division, assemblies, lineItems, operations, totals) kept optional for backward compat

## Customer Quote Preview
**Route**: /quote/:id/preview
**API**: GET /api/quotes/:id/preview-data returns orgSettings, divisionSettings, quote, revision, snapshot, spec dictionary, effective spec display keys.
**Template**: joinery_v1 — Cover (branding, totals), Terms (exclusions, terms, bank), Schedule (per-item drawing + spec table).
**Spec display editing**: PATCH /api/quotes/:id/revisions/:revId/spec-display saves override array.
**Two create modes**: "Create Quote (Revision)" and "Create New Quote Number" buttons on exec summary.

## Settings UI
**Route**: /settings with 3 tabs:
- **Application**: Layout options (quote items list position), Pricing (USD-NZD rate, GST rate). Uses localStorage via settings-context.
- **Organisation**: Company details form (legalName, gstNumber, nzbn, address, phone, email), banking, quote defaults (quoteValidityDays, header/terms/exclusions/payment text blocks). Fetches GET /api/settings/org, saves via PATCH /api/settings/org.
- **Divisions**: Division selector (LJ/LE/LL) with per-division settings — branding (tradingName, logoUrl, requiredLegalLine), template (templateKey readonly, scheduleLayoutVariant, totalsLayoutVariant selects), theme (fontFamily, accentColor, logoPosition, headerVariant), content overrides (terms/header/exclusions textareas), spec display defaults (checkbox list from /api/spec-dictionary?scope={code}, placeholder for LE/LL).

## UI/UX Decisions
- **Color Schemes**: Based on Shadcn UI defaults.
- **Templates**: Various pre-defined categories for windows (Standard, Sliding, Bay), and doors (Sliding, Entrance, Hinge, French, Bi-folding, Stacker).
- **Design Approaches**: Responsive design with a focus on intuitive configuration forms and clear visual feedback.
- **Custom Grid Layout**: A column-based system supports flexible design for most window/door categories.
- **Drawing Legend**: A toggleable legend displays frame size and item type, positioned to the left of the height dimension.

## Technical Implementations
- **Configuration & Pricing System**: Utilizes dedicated tables for frame configurations, profiles, accessories, and labor. A `pricing.ts` utility calculates comprehensive costs, including material, labor, glass, liner, and handle expenses, yielding net cost, sale price, and margin.
- **Config Signature**: `deriveConfigSignature` analyzes drawing layouts to generate a unique signature, enabling auto-detection and matching of configurations.
- **Auto-generation**: When no matching configuration is found, the system can auto-generate a new one based on the detected layout.
- **Master Library Systems**: Centralized libraries for direct materials (profiles, accessories), manufacturing labor, installation labor (tiered rates with cost/sell split), and delivery methods (with cost/sell split). These master libraries ensure consistency and propagate changes across configurations.
- **Financial Model**: Full cost/sell separation for installation and delivery. Installation tiers and delivery methods have independent cost and sell dollar amounts in the library. Subcontractor/custom overrides use a cost input + markup percentage (default 15%) to compute sell. GST rate is configurable in settings (default 15% NZ). Grand Total Cost (COGS) = Manuf + Install Cost + Delivery Cost. Gross Profit = Sale ex GST − COGS. Gross Margin = Gross Profit / Sale ex GST × 100. Gross Profit/hr = Gross Profit / Total Manufacturing Labour Hours. Labor hours tracked via `laborHours` in PricingBreakdown.
- **Delivery Toggle**: On/off toggle like installation. When off, delivery is "Supply Only — Customer to Collect" and excluded from totals.
- **Financial Summary Layout**: Grouped table format — Manufacturing (Materials/Labour/Total), Installation (Cost/Sell), Delivery (Cost/Sell or Supply Only), Grand Total Cost, then Sale totals (ex/inc GST), unit metrics, and profitability row (Gross Profit / Gross Margin / Gross Profit per hour).
- **Customer-Facing Quote Summary**: Shows Items Subtotal, Installation (sell), Delivery (sell or "Supply Only" note), Subtotal excl. GST, GST line, Total incl. GST. No cost data shown. Items table includes Weight column (computed live from config profiles, always visible). Stats cards: Total Items, Total m², Total Weight (always visible) + Avg $/m² (togglable). Unified pricing toggle (`showPricingOnQuote`, default false) controls $/m² column, Price column, and Avg $/m² card together — hidden by default for customer-facing view.
- **Frame Colors**: Each entry has `value`, `label`, `priceProvision`, and `supplierCode` (direct supplier equivalent code, e.g., HYX87838 for Dulux Iron Sand, JL3600 for Dulux Flax Pod). Supplier codes backfilled on app startup for existing entries.
- **Surface Column Removed**: The "Surface" field was removed from Direct Materials profiles library, configuration profiles table/dialog, and auto-generation logic. Surface finish is now tracked via the Frame Color's `supplierCode` field instead. The `surface` column remains in the DB schema but is no longer used in the UI.

## Feature Specifications
- **Job Management**: Full CRUD operations for jobs, including item photo capture, duplication, and deletion.
- **Download/Export**: Options to download current drawings, all items as individual PNGs, or all items as a single PDF.
- **Pricing**: Live calculation of square meters and pricing with customizable $/m² rates and a detailed quote summary page.
- **Settings**: User-configurable global settings for legend visibility and quote list position.
- **Auto-save**: Automatic saving of existing jobs after item changes.
- **Quote Manager**: Full quote lifecycle (Draft→Review→Sent→Accepted/Declined→Archived) with:
    - Atomic sequential numbering via `number_sequences` table (format Q-XXXX)
    - Revision history — immutable `snapshot_json` stored per revision; new revision created instead of updating
    - Duplicate job prevention — if quote already exists for a `source_job_id`, creates a new revision on that quote (mode="revision")
    - New quote number creation via mode="new_quote"
    - Status transitions enforced server-side via `VALID_STATUS_TRANSITIONS` map
    - Audit logging for all quote actions (creation, revision, status changes)
    - EstimateSnapshot contract in `shared/estimate-snapshot.ts` (Zod schema + TypeScript type)
    - Tables: `number_sequences`, `quotes`, `quote_revisions`, `audit_logs`
    - Frontend pages: `/quotes` (list), `/quote/:id` (detail with revisions, status actions, audit trail), `/quote/:id/preview` (customer-facing)
    - "Create Quote (Revision)" and "Create New Quote Number" buttons on Executive Summary
    - Future-proofed for RBAC, multi-tenancy, Xero integration, and procurement (nullable fields)
- **Business Rules**:
    - Frame sizes are standardized: 52mm for standard windows/doors, 70mm for bi-folding, and 127mm for sliding/stacker/sliding doors.
    - Opening indicators reflect hinge locations; awning indicators are always solid.
    - JSON body size limit for uploads is 10MB.
    - Drawing image uploads: multer, max 10MB, PNG only, path traversal protection via ^[a-f0-9-]+\.png$ regex.

## External Dependencies
- **PostgreSQL**: Primary database for storing job data, items, and library entries.
- **Drizzle ORM**: Used for interacting with the PostgreSQL database from the backend.
- **node-postgres**: PostgreSQL client for Node.js, used by Drizzle ORM.
- **React**: Frontend UI library.
- **TypeScript**: Adds static typing to JavaScript for enhanced code quality.
- **Shadcn UI**: Component library for building the user interface.
- **TanStack Query**: For efficient data fetching, caching, and state management of API data.
- **Wouter**: A minimalist React router for client-side navigation.
- **jsPDF**: Library for generating multi-page PDF documents on the client-side.
- **multer**: Multipart form data handling for drawing image uploads.

## API Routes (New)
- GET/PATCH /api/settings/org — Org settings CRUD
- GET /api/settings/divisions — All division settings
- GET/PATCH /api/settings/divisions/:code — Single division CRUD
- GET /api/spec-dictionary?scope=LJ — Spec dictionary filtered by division
- POST /api/item-photos — Upload item photo (JPEG only, 10MB limit)
- GET /api/item-photos/:key — Serve item photo
- POST /api/drawing-images — Upload drawing PNG
- GET /api/drawing-images/:key — Serve drawing PNG
- GET /api/quotes/:id/preview-data — Full preview data bundle
- PATCH /api/quotes/:id/revisions/:revId/spec-display — Update spec display override
