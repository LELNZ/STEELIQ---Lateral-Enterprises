# SteelIQ – Lateral Enterprises

## Overview
SteelIQ is a professional quotation and estimating platform for the window and door industry. Its primary goal is to streamline the entire quotation process, from configuration and visualization to pricing and export, by offering a robust system for configuring items, generating live SVG technical drawings, and managing estimates and quotes. The platform aims to be a leading solution for efficient and accurate quoting within the industry by providing real-time drawing previews, comprehensive estimate and quote lifecycle management, detailed pricing breakdowns, and a template-driven PDF engine.

## User Preferences
I want iterative development.
Ask before making major changes.
I prefer detailed explanations.
Do not make changes to the folder `shared` EXCEPT shared/schema.ts and shared/estimate-snapshot.ts (approved).

## System Architecture
**Frontend**: React, TypeScript, Shadcn UI for a responsive, mobile-first design.
**Backend**: Express.js with PostgreSQL, Drizzle ORM, and node-postgres.
**Drawing Engine**: SVG for real-time rendering and PNG export.
**State Management**: React state for UI components; TanStack Query for API data.
**Global Settings**: Managed via React Context and localStorage.
**Routing**: Wouter for client-side navigation.
**Export Capabilities**: SVG to PNG conversion and multi-page, vector-text selectable PDF generation using jsPDF.
**Storage**: Item photos in PostgreSQL (`bytea`) with in-memory cache; drawing PNGs on filesystem; division logos as base64 data URLs in PostgreSQL.
**Multi-Division Architecture**: Supports organizational and division-specific settings, including `division_scope` for library entries.
**Spec Dictionary System**: Configurable `spec_dictionary` entries for dynamic specification display and override.
**Quote Management**: Comprehensive lifecycle (Draft, Review, Sent, Accepted/Declined, Archived), atomic sequential numbering, immutable revision history, and server-side status transition enforcement. Quotes include an `EstimateSnapshot` for immutable revision data.
**Pricing System**: Calculates material, labor, glass, liner, and handle costs, providing net cost, sale price, and margin, including configurable GST. Features manual price override and includes removal/rubbish fees.
**Configuration & Drawing**: Dedicated tables for frame configurations, profiles, accessories, and labor, with auto-detection of configurations, standard frame sizes, and dynamic opening indicators. Supports various window types, including French windows and hardened stacker door logic.
**Master Library Systems**: Centralized libraries for direct materials, manufacturing labor, installation labor, and delivery methods.
**Site Visit Mode**: Client-only `siteType` state for jobs to apply "renovation" and "new_build" defaults.
**Mobile Architecture**: Optimized with `native-scroll`, sticky action bars, enhanced item cards, and a collapsible header.
**Quote Document Model**: `PreviewData` (API response), `QuoteDocumentModel` (normalized rendering contract), and `buildQuoteDocumentModel()` (mapper).
**Quote Renderer**: `QuoteRenderModel` (presentation-ready structure) and `buildQuoteRenderModel()` (pure mapper from `QuoteDocumentModel`) for preview page rendering.
**Lifecycle Service**: Centralized handling for archive, soft-delete, hard-delete, cascade operations, orphan detection, and development cleanup routines. Template-driven, read-only lifecycle visibility for all quotes and operational jobs, with template locking upon quote acceptance.
**CRM Workflow (Projects-First)**: Project-centric CRM with automatic customer linking from quotes, project creation linked to quotes, and sub-query endpoints for project-related data (quotes, jobs, invoices). Enforces customer linkage for invoicing.
**Invoice Allocation Control**: Prevents over-invoicing with deposit caps (50% of accepted value, base contract only) and invoiceable ceiling caps. The invoiceable ceiling = accepted contract value + total approved variation amounts. Provides a detailed invoice allocation state via API including variation breakdown.
**Variations Commercial Model**: Project-level variations table (`draft → sent → approved → invoiced`). Variations link to both `projectId` and `quoteId`. Approved variations expand the invoiceable ceiling on the linked quote. Variation invoices must be linked to a specific approved variation record and cannot exceed its remaining value.
**Retention Commercial Model**: Optional percentage-based retention withheld from the base contract only (not variations). `retentionPercentage` and `retentionHeldValue` stored on the `quotes` table. Standard invoice ceiling = `(acceptedValue − retentionHeld) + approvedVariations`. Retention released via a dedicated `retention_release` invoice type, capped at remaining unreleased retention.
**UI/UX Enhancements**: Improved table responsiveness for quotes and invoices lists, collapsing secondary columns on smaller viewports. PDF generation includes polished spec row formatting to handle wrapped lines cleanly. Project dashboard includes guidance text and links to related entities. Customer relink safeguard with confirmation dialog if invoices exist. Measurement logic on `op_jobs` table for `measurementRequirement` and `dimensionSource`.
**Detail Page Commercial Standardization**: Quote detail shows the full 9-row commercial hierarchy (Base Contract → +Variations → =Total Contract → −Retention → Std.Invoiced → +RetentionReleased → =TotalInvoiced → Std.Remaining). Color-coded invoice type pill badges consistent across quote-detail, project-detail, and op-job-detail surfaces.
**Enterprise App Shell / Navigation Architecture**: Sidebar restructured into 6 workflow-domain groups: Sales, Delivery, Finance, Master Data, Platform Roadmap (disabled placeholders), System. A "+ New" quick-access dropdown is added to the top header bar with domain-grouped quick actions.
**UI Standardization Phase 1 (Page Shell & Layout)**: Quote Builder `itemsExpanded` now defaults to `true`. Estimates (`jobs-list.tsx`) converted to a proper operational table. Op-Jobs list removed `max-w-5xl mx-auto` constraint and applied full-width Library shell. Projects, Invoices, Customers, Contacts migrated to the Library benchmark shell.
**UI/UX Hardening Phase 2 (Workflow Honesty + Estimator Polish + Data-State Clarity)**: Global + New menu pruned to "New Estimate", "New Customer", "New Contact". Quote Builder desktop polish includes "Quote Schedule" heading, secondary metrics, and improved toggle labels. Invoice unlinked-state clarity shows "Unlinked" badges and repair links. Settings + Users shell standardized. Quotes list (`quotes-list.tsx`) migrated to Library shell.
**Environment Clarity + Test Data Governance**: Replaced system-mode selector in Settings with environment info panel. True invoice archive with `archivedAt` column on `invoices` table. `isDemoRecord boolean` added to `customers` and `customer_contacts` for CRM governance, with storage methods and flag endpoints for management.
**UI/UX Hardening Phase 3 (Interior Page Maturity + Enterprise Density)**: Applied enterprise table density improvements across 8 pages, including Invoices, Projects-list, Op-Jobs-list, Customers, Contacts, Settings, Users, and Quote Builder. Enhancements include updated table headers, financial column formatting, avatar circles, and theme-aware backgrounds.
**Production Workflow Hardening (Phase 5)**: InvoiceSection mutations invalidate relevant API endpoints. Accepted-quote-without-project shows "Next Step: Create Project" CTA banner. InvoiceSection header shows invoice count and dynamic button labels; empty state replaced with instructional card; "Returned to Draft" invoices show re-queue note. Lifecycle panel only auto-expands the active stage and moved in `op-job-detail.tsx`. Customer-facing Details in quote-detail `defaultOpen={true}`. Invoice Numbering card added to Settings with prefix input and live preview.
**M&D Lifecycle Enforcement (Phase 7B)**: Server-side guard on PATCH /api/lifecycle-instances/:instanceId/tasks blocks site_measure task completion when M&D fields are missing. Structured 400 error with field-specific messaging. Frontend surfaces errors via destructive toast. UI readiness banners in both M&D section and lifecycle section of op-job-detail.
**Governance Surface Consolidation (Phase 8A)**: Removed duplicate "Demo / Test Data Cleanup" and misleading "Reset Demo Environment" controls from Admin > Users page. Removed legacy `/api/admin/reset-demo-environment` and `/api/admin/demo-stats` routes. Settings > System is now the single canonical location for all demo/test data governance, environment truth, and bulk archive actions. User Management page is now focused solely on user/role/account management.
**Governance Demo/Test Flag UI Parity (Phase 8B)**: Added direct demo/test flag toggle UI to the three entity surfaces that previously lacked it: estimates (jobs-list.tsx — per-row flask icon toggle + amber badge), projects (project-detail.tsx — admin section with toggle button + blue banner), invoices (invoices.tsx — per-row flask icon toggle + amber badge). All controls are role-gated to owner/admin. Uses existing PATCH demo-flag endpoints. No new routes or schema added.
**Governance Bulk Archive Parity (Phase 8C)**: Extended `POST /api/admin/cleanup-demo` to archive all 7 entity types (estimates, quotes, op-jobs, projects, invoices, customers, contacts). Includes Xero-linked protection (skips invoices with `xeroInvoiceId`, customers with `xeroContactId`) and live-data safety checks (skips customers/contacts shared with non-demo operational data). Returns per-entity breakdown with archived/skipped counts and skip reasons. UI updated to show expanded scope, Xero protection notes, and detailed result summary.
**Truth Reconciliation Audit**: Confirmed system operates as SINGLE LIVE ENVIRONMENT + ADMIN-ONLY GOVERNANCE CONTROLS. No separate dev/demo/prod runtime or database switch exists. All governance routes enforce admin/owner role (403 for others). Known gap: operational list routes do not filter `isDemoRecord` for standard users — flagged records remain visible to all until archived. Governance explanation banner updated to truthfully communicate this behavior. Full audit report at `.local/audit-report-truth-reconciliation.md`.

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