# SteelIQ – Lateral Enterprises

## Overview
SteelIQ is a professional quotation and estimating platform designed for the window and door industry. It provides a robust, user-friendly system for configuring window and door items, generating live SVG technical drawings, and managing estimates and quotes. The platform streamlines the entire quotation process from configuration and visualization to pricing and export, ensuring accurate and visually rich outputs. Key capabilities include real-time drawing previews, comprehensive estimate and quote lifecycle management, item photo capture, detailed pricing breakdowns, and a template-driven PDF engine for professional document generation.

## User Preferences
I want iterative development.
Ask before making major changes.
I prefer detailed explanations.
Do not make changes to the folder `shared` EXCEPT shared/schema.ts and shared/estimate-snapshot.ts (approved).

## Completed Milestones
- **Auth Phase 3** (current): `mustChangePassword` boolean on users. Creating/resetting a user sets it `true`. `POST /api/auth/change-password` endpoint clears flag. `AppShell` shows `ChangePasswordScreen` if flag is true (forced password change on first login). Users page updated: role descriptions collapsible "Role Guide", post-create `OnboardingDialog` (login URL, username, step-by-step instructions, copy button), `mustChangePassword` indicator in table. Division-scoped filtering on `GET /api/invoices` and `GET /api/quotes/:id/invoices`. Admin reset-password also sets `mustChangePassword=true`.
- **Auth System Phase 2**: Users admin page at `/users` (admin/owner-only). Full CRUD for users: list, create dialog, edit dialog (displayName/email/role/division/isActive), password reset dialog. New API: `PATCH /api/auth/users/:id`, `POST /api/auth/users/:id/reset-password`. Global `apiAuthGuard` middleware in `server/index.ts` — all `/api/*` routes protected except login/logout/me. Sidebar "Users" entry visible to admin/owner only. Test mode (NODE_ENV=test) preserved: mock admin injected without session.
- **Auth System Phase 1 + Commercial Foundations**: Full auth (`crypto.scrypt`, 7-day cookie sessions), login/logout/me endpoints, `AuthContext`+`useAuth`, login page, `AppShell` auth guard. Customers page at `/customers` with expandable contacts. Quote accept endpoint (`POST /api/quotes/:id/accept`) locks commercial state. Invoice foundations with deposit dialog, Xero warning passthrough. DB tables: `users` (expanded), `user_sessions`, `customers`, `customer_contacts`, `projects`, `invoices`. Default admin seeded on first startup (`admin` / `SteelIQ2025!`).
- **Rich-Text Content Blocks**: `rich-text-parser.ts`, `RichTextEditor`, `RichTextRenderer`, `renderRichTextPdf`; all settings textareas use rich text; disclaimer section upgraded.
- **Quote Template Engine**: Multi-page PDF with smart pagination, company master template v2, template builder with granular controls (logo, header, schedule density, photo size). Division settings with editable job-type presets backed by library options. Spec dictionary system, profile role dictionary, reference images.

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