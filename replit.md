# SteelIQ – Lateral Enterprises

## Overview
SteelIQ is a professional quotation and estimating platform designed for the window and door industry. It provides a robust, user-friendly system for configuring window and door items, generating live SVG technical drawings, and managing estimates and quotes. The platform streamlines the entire quotation process from configuration and visualization to pricing and export, ensuring accurate and visually rich outputs. Key capabilities include real-time drawing previews, comprehensive estimate and quote lifecycle management, item photo capture, detailed pricing breakdowns, and a template-driven PDF engine for professional document generation. The project aims to provide a leading solution for efficient and accurate quoting in the industry.

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
## Completed Milestones
- **Phase 4 — Invoice Lifecycle Hardening**: `VALID_INVOICE_TRANSITIONS` added to `shared/schema.ts` with full draft→ready_for_xero→pushed_to_xero_draft→approved→returned_to_draft chain. `POST /api/invoices` now gates on `quote.status === "accepted"` and auto-inherits `customerId`, `projectId`, `quoteRevisionId` from the accepted quote. `PATCH /api/invoices/:id` enforces transition rules (400 + message on invalid transitions). New `POST /api/invoices/:id/push-to-xero` route: validates `ready_for_xero` status, blocks double-push, runs scaffold mode when Xero env vars absent (stores mock `xeroInvoiceId`/`xeroInvoiceNumber`, advances status to `pushed_to_xero_draft`, returns `xeroMode:"scaffold"`). `InvoiceSection` in quote-detail.tsx updated: now receives and passes `customerId`/`projectId`/`acceptedRevisionId`; adds "Mark Ready" (draft/returned_to_draft), "Unmark" + "Push to Xero" (ready_for_xero) action buttons; Xero number displayed under status badge. New `/invoices` standalone list page (search, status/type/xero columns, quote link). Sidebar "Invoices" entry added (ReceiptText icon). E2E 10/10 passed.
- **Foundation Alignment Phase 3.1 — Legacy Route Retirement**: `PATCH /api/quotes/:id/customer` retired (removed). Audit confirmed zero callers in client or server code. Route was unvalidated and bypassed Phase 3 mismatch checks. Canonical safe route is now exclusively `PATCH /api/quotes/:id/link`. TypeScript clean. UI behavior unchanged.
- **Foundation Alignment Phase 3 — Relationship Hardening**: Backend mismatch validation added to `PATCH /api/quotes/:id/link` — if `projectId` submitted, route fetches the project and returns 400 if `project.customerId !== customerId`, or if `projectId` provided without `customerId`. Frontend `CustomerProjectSection` (quote-detail.tsx): project Select is now `disabled` when no customer selected, placeholder reads "Select a customer first". All other Phase 3 surfaces were already in place: CustomerProjectSection display (customer/project/not-linked), op-job detail "Source Relationships" grid (customer/project/source-quote/division), op-jobs list (customer/project/division columns), customers page projects section per-customer, quote→job conversion inheriting customerId/projectId/divisionId/sourceQuoteId/acceptedRevisionId. LJ estimator/quote/preview/PDF pipeline unchanged. E2E all passed.
- **Foundation Alignment Phase 2.1 — Contacts Correction**: `customer_contacts` refined: `name`+`role` replaced with `firstName`, `lastName`, `roleTitle`. Existing record migrated safely. `contactBodySchema` updated. `listContacts` backend search covers firstName, lastName, email, phone, mobile, AND customer name (via subquery). `contactDisplayName(contact)` utility in `client/src/lib/contact-utils.ts`. Contacts page is backend-driven (no client-side filter layer). All create/edit dialogs updated. E2E 27/27 passed.
- **Foundation Alignment Phase 2 — Contacts Foundation**: Global Contacts page at `/contacts` (sidebar). `customer_contacts` extended with category/mobile/notes/archivedAt. CONTACT_CATEGORIES exported. Storage: listContacts/getContact/archiveContact. Routes: GET/PATCH /api/contacts. Customers page ContactRow enhanced. E2E passed.
- **Foundation Alignment Phase 1.1**: Preview/PDF parity restored. Quote detail status card. E2E 9/9 passed.
- **Foundation Alignment Phase 1**: Branding (Pro-Quote → STEELIQ), businessDisplayName+documentLabel, configurable numbering, sidebar rewrite with Admin collapsible. E2E passed.
