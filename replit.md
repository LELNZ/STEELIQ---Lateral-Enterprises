# Pro-Quote CAD Generator

## Overview
The Pro-Quote CAD Generator is a professional quotation tool for the window and door industry. It enables users to configure window and door items, generate live SVG technical drawings with dimensions and opening indicators, and manage these items within "Jobs" and "Quotes." The system aims to streamline the quotation process from configuration and visualization to pricing and export, providing a robust, user-friendly platform for accurate and visually rich quotes. Key capabilities include real-time drawing previews, comprehensive job and quote management, item photo capture, and detailed pricing breakdowns. The project targets enhanced efficiency for businesses in the window and door market.

## User Preferences
I want iterative development.
Ask before making major changes.
I prefer detailed explanations.
Do not make changes to the folder `shared` EXCEPT shared/schema.ts and shared/estimate-snapshot.ts (approved).

## System Architecture
**Frontend**: React with TypeScript and Shadcn UI components, utilizing a responsive mobile-first design approach.
**Backend**: Express.js with PostgreSQL, Drizzle ORM, and node-postgres.
**Drawing Engine**: SVG-based rendering (`client/src/components/drawing-canvas.tsx`) with PNG export capabilities.
**State Management**: React state for UI, TanStack Query for API data fetching and caching.
**Global Settings**: Managed via React Context with localStorage for persistence.
**Routing**: Wouter for client-side navigation.
**Export Capabilities**: SVG to PNG conversion and multi-page PDF generation via jsPDF.
**Storage**: Item photos and drawing PNGs are uploaded to designated folders (`uploads/item-photos/`, `uploads/drawing-images/`) and referenced in the database.
**Multi-Division Architecture**: Supports organizational and division-specific settings, with `division_scope` for library entries.
**Spec Dictionary System**: Configurable `spec_dictionary` entries for dynamic specification display and override functionality in quotes.
**Quote Management**: Full lifecycle management (Draft, Review, Sent, Accepted/Declined, Archived) with atomic sequential numbering, immutable revision history, and server-side status transition enforcement. Quotes include `EstimateSnapshot` for immutable revision data.
**Pricing System**: Comprehensive utility calculates material, labor, glass, liner, and handle costs, providing net cost, sale price, and margin. Includes cost/sell separation, configurable GST, and detailed financial summaries.
**Configuration & Drawing**: Utilizes dedicated tables for frame configurations, profiles, accessories, and labor. Features include auto-detection and generation of configurations, standard frame sizes, and dynamic opening indicators.
**Master Library Systems**: Centralized libraries for direct materials, manufacturing labor, installation labor, and delivery methods to ensure consistency.
**Site Visit Mode**: Client-only `siteType` state for jobs, allowing preset defaults for "renovation" and "new_build" contexts. Includes features like wind zone auto-fill and height-from-floor warnings.
**Mobile Architecture**: Optimized for mobile with `native-scroll` for specific components, sticky action bars, enhanced item cards, and a collapsible header.
**Quote Document Model**: Client-side normalized, typed model (`QuoteDocumentModel`) for mapping raw preview data into structured sections for display.
**Division Logo Upload**: Reuses existing image upload endpoint, storing logo URLs in division settings.

## External Dependencies
- **PostgreSQL**: Primary database.
- **Drizzle ORM**: PostgreSQL ORM.
- **node-postgres**: PostgreSQL client.
- **React**: Frontend UI.
- **TypeScript**: Static typing.
- **Shadcn UI**: Component library.
- **TanStack Query**: Data fetching and caching.
- **Wouter**: Client-side routing.
- **jsPDF**: PDF generation.
- **multer**: Multipart form data handling for uploads.