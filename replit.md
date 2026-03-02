# Pro-Quote CAD Generator

## Overview
The Pro-Quote CAD Generator is a professional quotation tool designed for the window and door industry. It enables users to configure window and door items, generate live SVG technical drawings with dimensions and opening indicators, and manage these items within "Jobs." The system aims to streamline the quotation process, from configuration and visualization to pricing and export. Key capabilities include real-time drawing previews, comprehensive job management, photo capture for items, and detailed pricing breakdowns. The project's ambition is to provide a robust, user-friendly platform for generating accurate and visually rich quotes, enhancing efficiency for businesses in the window and door market.

## User Preferences
I want iterative development.
Ask before making major changes.
I prefer detailed explanations.
Do not make changes to the folder `shared`.

## System Architecture
**Frontend**: React with TypeScript and Shadcn UI components.
**Backend**: Express.js with PostgreSQL, utilizing Drizzle ORM and a node-postgres adapter.
**Drawing Engine**: SVG-based rendering within `client/src/components/drawing-canvas.tsx`, supporting PNG export.
**State Management**: Client-side React state is used for UI, complemented by TanStack Query for API data fetching and caching.
**Global Settings**: Managed via a React Context (`client/src/lib/settings-context.tsx`) with localStorage for persistence.
**Navigation**: A collapsible sidebar facilitates navigation between Jobs, Library, and Settings.
**Routing**: Wouter is used for client-side routing, defining paths for job management, library access, and settings.
**Export Capabilities**: Supports client-side SVG to PNG conversion (at 3x resolution) and multi-page PDF generation via jsPDF.
**Photo Storage**: Photos are captured as Base64 JPEG data URLs, compressed client-side, and stored in the database.
**UI/UX Decisions**:
- **Color Schemes**: Based on Shadcn UI defaults.
- **Templates**: Various pre-defined categories for windows (Standard, Sliding, Bay), and doors (Sliding, Entrance, Hinge, French, Bi-folding, Stacker).
- **Design Approaches**: Responsive design with a focus on intuitive configuration forms and clear visual feedback.
- **Custom Grid Layout**: A column-based system supports flexible design for most window/door categories.
- **Drawing Legend**: A toggleable legend displays frame size and item type, positioned to the left of the height dimension.
**Technical Implementations**:
- **Configuration & Pricing System**: Utilizes dedicated tables for frame configurations, profiles, accessories, and labor. A `pricing.ts` utility calculates comprehensive costs, including material, labor, glass, liner, and handle expenses, yielding net cost, sale price, and margin.
- **Config Signature**: `deriveConfigSignature` analyzes drawing layouts to generate a unique signature, enabling auto-detection and matching of configurations.
- **Auto-generation**: When no matching configuration is found, the system can auto-generate a new one based on the detected layout.
- **Master Library Systems**: Centralized libraries for direct materials (profiles, accessories), manufacturing labor, installation labor (tiered rates), and delivery methods. These master libraries ensure consistency and propagate changes across configurations.
**Feature Specifications**:
- **Job Management**: Full CRUD operations for jobs, including item photo capture, duplication, and deletion.
- **Download/Export**: Options to download current drawings, all items as individual PNGs, or all items as a single PDF.
- **Pricing**: Live calculation of square meters and pricing with customizable $/m² rates and a detailed quote summary page.
- **Settings**: User-configurable global settings for legend visibility and quote list position.
- **Auto-save**: Automatic saving of existing jobs after item changes.
- **Business Rules**:
    - Frame sizes are standardized: 52mm for standard windows/doors, 70mm for bi-folding, and 127mm for sliding/stacker/sliding doors.
    - Opening indicators reflect hinge locations; awning indicators are always solid.
    - JSON body size limit for uploads is 10MB.

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