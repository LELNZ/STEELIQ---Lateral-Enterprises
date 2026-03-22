# SteelIQ – Lateral Enterprises

## Overview
SteelIQ is a professional quotation and estimating platform specifically designed for the window and door industry. Its core purpose is to automate and optimize the entire quotation workflow, encompassing item configuration, real-time visual representation, accurate pricing, and efficient document generation. The platform aims to be a leading solution by providing live SVG technical drawings, comprehensive estimate and quote lifecycle management, detailed pricing breakdowns, and a flexible template-driven PDF engine. It offers robust tools for managing organizational and division-specific settings, dynamic specification displays, and a project-centric CRM workflow.

## User Preferences
I want iterative development.
Ask before making major changes.
I prefer detailed explanations.
Do not make changes to the folder `shared` EXCEPT shared/schema.ts and shared/estimate-snapshot.ts (approved).

## System Architecture
**Frontend**: Built with React and TypeScript, utilizing Shadcn UI for a responsive, mobile-first user experience.
**Backend**: An Express.js application interacting with a PostgreSQL database, managed through Drizzle ORM and node-postgres.
**Drawing Engine**: Employs SVG for real-time technical drawing rendering and PNG export.
**State Management**: React state manages UI components, while TanStack Query handles API data fetching and caching.
**Global Settings**: Managed via React Context and persisted in localStorage.
**Routing**: Client-side navigation is handled by Wouter.
**Export Capabilities**: Supports SVG to PNG conversion and multi-page, vector-text selectable PDF generation using jsPDF.
**Storage**: Item photos are stored in PostgreSQL (`bytea`) with an in-memory cache, drawing PNGs on the filesystem, and division logos as base64 data URLs in PostgreSQL.
**Multi-Division Architecture**: The system supports organizational and division-specific settings, including `division_scope` for library entries.
**Spec Dictionary System**: Configurable `spec_dictionary` entries allow for dynamic display and override of specifications.
**Quote Management**: Features a comprehensive lifecycle (Draft, Review, Sent, Accepted/Declined, Archived), atomic sequential numbering, immutable revision history, and server-side status transition enforcement. Quotes include an `EstimateSnapshot` for immutable revision data.
**Pricing System**: Calculates material, labor, glass, liner, and handle costs, providing net cost, sale price, and margin, including configurable GST. It supports manual price override and includes removal/rubbish fees.
**Configuration & Drawing**: Dedicated database tables for frame configurations, profiles, accessories, and labor, with auto-detection of configurations and dynamic opening indicators. Supports various window types, including French windows and hardened stacker door logic.
**Master Library Systems**: Centralized libraries manage direct materials, manufacturing labor, installation labor, and delivery methods.
**CRM Workflow (Projects-First)**: A project-centric CRM with automatic customer linking from quotes, project creation linked to quotes, and sub-query endpoints for project-related data. Enforces customer linkage for invoicing.
**Invoice Allocation Control**: Prevents over-invoicing with deposit caps and invoiceable ceiling caps.
**Variations Commercial Model**: Manages project-level variations with a defined lifecycle (draft → sent → approved → invoiced).
**Retention Commercial Model**: Supports optional percentage-based retention withheld from the base contract.
**UI/UX**: Features responsive tables, polished spec row formatting in PDFs, project dashboard guidance, and customer relink safeguards. The enterprise app shell organizes navigation into workflow-domain groups.
**Governance and Data Integrity**: Includes robust features for environment clarity, test data governance, and shielding of demo/test records from standard users. This includes mechanisms for archiving, clearing Xero links for demo invoices, and ensuring data integrity during quote deletions.

## External Dependencies
- **PostgreSQL**: Primary relational database.
- **Drizzle ORM**: Object-Relational Mapper for database interactions.
- **node-postgres**: PostgreSQL client for Node.js.
- **React**: JavaScript library for building user interfaces.
- **TypeScript**: Superset of JavaScript for static typing.
- **Shadcn UI**: UI component library.
- **TanStack Query**: Data fetching, caching, and state management library.
- **Wouter**: Small routing library for React.
- **jsPDF**: Client-side JavaScript PDF generation library.
- **multer**: Middleware for handling `multipart/form-data`, primarily for file uploads.