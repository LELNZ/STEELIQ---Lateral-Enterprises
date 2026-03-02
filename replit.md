# Pro-Quote CAD Generator

## Overview
A professional window and door quotation tool with live SVG technical drawings. Users configure items via a side panel and see an instant preview with dimension lines, labels, and opening indicators. Items are organized into Jobs which persist to a PostgreSQL database.

## Architecture
- **Frontend**: React + TypeScript with Shadcn UI components
- **Backend**: Express.js with PostgreSQL (Drizzle ORM, node-postgres adapter)
- **Drawing Engine**: SVG-based rendering in `client/src/components/drawing-canvas.tsx` with forwardRef for PNG export
- **State Management**: Client-side React state + TanStack Query for API data fetching
- **Settings**: Global app settings via React context (`client/src/lib/settings-context.tsx`) with localStorage persistence
- **Navigation**: Collapsible sidebar (shadcn Sidebar component) with Jobs, Library, Settings links
- **Routing**: Wouter — `/` = Jobs List, `/job/new` = New Job, `/job/:id` = Edit Job, `/job/:id/summary` = Quote Summary, `/library` = Item Library, `/settings` = Settings
- **Export**: Client-side SVG→Canvas→PNG at 3x resolution + jsPDF for multi-page PDF export (`client/src/lib/export-png.ts`)
- **Photo Storage**: Base64 JPEG data URLs compressed client-side (max 1200px, 80% quality), stored in database `job_items.photo` column

## Key Files
- `shared/schema.ts` - Zod schemas for QuoteItem, Drizzle tables for jobs + job_items
- `server/storage.ts` - DatabaseStorage class with PostgreSQL CRUD via Drizzle
- `server/routes.ts` - REST API routes for jobs and job items (includes totalSqm calculation)
- `client/src/components/drawing-canvas.tsx` - SVG drawing component with forwardRef
- `client/src/pages/quote-builder.tsx` - Main page with config form, drawing preview, quote items table, job header
- `client/src/pages/jobs-list.tsx` - Jobs listing page with m² badges
- `client/src/pages/settings.tsx` - Global settings page (legend default, quote list position)
- `client/src/lib/settings-context.tsx` - Settings context provider with localStorage
- `client/src/lib/export-png.ts` - PNG export, PDF export, image compression, filename sanitization utilities
- `client/src/pages/quote-summary.tsx` - Quote Summary page with pricing breakdown
- `client/src/pages/library.tsx` - Library CRUD page (glass, frame types, colors, handles, liners)
- `client/src/components/app-sidebar.tsx` - Sidebar navigation component (Jobs, Library, Settings)
- `shared/glass-library.ts` - Glass pricing library (EnergySaver + LightBridge IGU data) — fallback/seed data
- `shared/item-options.ts` - Frame types, colors, handles, flashing, wind zones, liner types — fallback/seed data
- `client/src/App.tsx` - Route setup with SidebarProvider + SettingsProvider wrapper

## Database Tables
- `jobs`: id (uuid PK), name (text, required), address (text), date (text), created_at (timestamp)
- `job_items`: id (uuid PK), job_id (varchar FK), config (jsonb — full QuoteItem), photo (text, nullable — base64), sort_order (integer)
- `library_entries`: id (uuid PK), type (text — "glass", "frame_type", "frame_color", "awning_handle", "sliding_window_handle", "entrance_door_handle", "hinge_door_handle", "sliding_door_handle", "bifold_door_handle", "stacker_door_handle", "liner_type"), data (jsonb), sort_order (integer). Auto-seeded per value on first run; new entries are inserted individually if missing (preserves existing IDs to avoid FK breakage).
- `users`: id (uuid PK), username (text), password (text) — boilerplate, not currently used

## API Routes
- `POST /api/jobs` — create job (validated with insertJobSchema)
- `GET /api/jobs` — list jobs with item counts + totalSqm (calculated from item configs)
- `GET /api/jobs/:id` — get job with items (ordered by sort_order)
- `PATCH /api/jobs/:id` — update job metadata (validated with insertJobSchema.partial())
- `DELETE /api/jobs/:id` — delete job + all items
- `POST /api/jobs/:id/items` — add item (validated with quoteItemSchema + photo + sortOrder)
- `PATCH /api/jobs/:id/items/:itemId` — update item
- `DELETE /api/jobs/:id/items/:itemId` — delete item
- `GET /api/library?type=X` — get library entries (optional type filter)
- `POST /api/library` — create library entry
- `PATCH /api/library/:id` — update library entry
- `DELETE /api/library/:id` — delete library entry
- `POST /api/library/seed` — reset library to hardcoded defaults

## Supported Categories
- **Windows Standard**: Fixed or Awning (52mm frame) — NO Opening Direction control (awnings always open out)
- **Sliding Window**: Fixed + Sliding panels (127mm frame)
- **Sliding Door**: Fixed + Sliding panels (127mm frame) — same rendering as Sliding Window
- **Entrance Door**: Door + configurable Sidelights with dedicated controls (52mm frame)
- **Hinge Door**: Hinged door with row controls (1-4 rows FIX/AWN) + full-height hinge triangle (52mm frame)
- **French Door**: Two opposite-hinged doors (52mm frame)
- **Bi-folding Door**: 2-8 leaves with configurable fold direction split (70mm frame)
- **Stacker Door**: 3-6 sliding panels (127mm frame)
- **Bay Window**: Center fixed + two side awning panels (52mm frame)

## Features
- **Job System**: Create, save, list, re-open, delete jobs. Each job has name (required), address, date, and a list of quote items with photos
- **Download/Export**: Download button in header offers dropdown: "Current Drawing (PNG)", "All Items (Individual PNGs)", "All Items (PDF)". Per-item download available in items table. Filenames use `{JobName}_{ItemID}.png` for PNGs, `{JobName}.pdf` for PDF
- **Site Photos**: Capture photos per item via camera (mobile) or file upload (desktop). Compressed to JPEG, shown as thumbnails in items list, expandable in modal
- **Quote Item Actions**: Download PNG, Take Photo, Edit, Duplicate, Delete
- **Save Job**: Validates job name required + at least one item. Persists all items with photos to database
- **Unsaved Changes Warning**: beforeunload browser prompt + in-app dialog (Cancel/Discard/Save & Leave) when navigating away with unsaved changes
- **Square Meters**: Live m² badge in item form panel (during creation/editing) + per-item m² in items table + total m² in section header + m² badge on job cards
- **Pricing**: Per-item $/m² rate ($500–$750 slider), item price shown in items table + total price in header, Quote Summary page with full breakdown + average $/m²
- **Item Specifics Tab**: Tab toggle in form panel (Drawing Config / Item Specifics) with: price per m², frame type (filtered by category), frame color (4 Dulux colors), flashing (35–95mm), wind zone, liner/reveal, glass (IGU type → glass combo → thickness with price + R-value display), handle (category-specific: awning, sliding window, entrance/hinge/sliding/bifold/stacker door), wanz bar, wall thickness, height from floor
- **Quote Summary Page**: Separate page at `/job/:id/summary` with items table, pricing breakdown, total items/m²/price, average $/m²
- **Expand/Collapse Items**: Toggle between 1/3 height (33vh) and 1/2 height (50vh) for the quote items section
- **Settings Page**: Global preferences stored in localStorage — legend default on/off, quote list position (bottom or right side)
- **Custom Grid Layout**: Column-based system available for all categories except Entrance Door and Hinge Door
- **Drawing Legend**: Positioned to the LEFT of the height dimension line, toggleable on/off. Shows frame size, window/door type info
- **Item ID / Reference**: Combobox with room dropdown (14 rooms: KIT, LNG, DIN, BED, MBR, ENS, BTH, WC, LDY, GAR, HWY, STD, RMP, ENT). Floor selector (G, 1, 2, 3, B). Auto-generates CODE-FLOOR## format
- **Glass Library**: Full pricing table for EnergySaver™ (R=0.37) and LightBridge™ (R=0.46) IGU types with 16 glass combinations each × 5-6 thickness options. Collapsible by IGU type in Library page
- **Handle Categories**: 7 category-specific handle types (awning_handle, sliding_window_handle, entrance_door_handle, hinge_door_handle, sliding_door_handle, bifold_door_handle, stacker_door_handle) with collapsible UI in Library page. Each maps to a frame model (ES52, ES127, ES70). Quote builder and exec-summary use category-specific lookups with legacy fallback

## Settings (localStorage: proquote-settings)
- `showLegendDefault` (boolean, default true) — whether legend is shown by default on new items
- `quoteListPosition` ("bottom" | "right", default "bottom") — where items list renders relative to drawing

## Configuration & Pricing System
- **Tables**: `frame_configurations` (per frame type), `configuration_profiles` (aluminium profiles), `configuration_accessories` (hardware/seals), `configuration_labor` (cutting/milling/assembly tasks)
- **API**: CRUD at `/api/frame-types/:id/configurations`, `/api/configurations/:id/profiles|accessories|labor`
- **Seed**: POST `/api/frame-types/seed-configurations` — ES52 Window (3 configs), ES52 Hinge Door (1), ES127 Sliding Door (1)
- **Pricing utility**: `client/src/lib/pricing.ts` — `calculatePricing()` returns profiles/accessories/labor/glass/liner/handle costs (NZD), net cost, sale price, margin. Accepts optional `PricingExtras` for glass ($/m²), liner ($/m), handle ($/each)
- **Config signature**: `client/src/lib/config-signature.ts` — `deriveConfigSignature(item)` analyzes drawing layout to produce a signature (e.g., "Awning", "1 Awning + 1 Fixed"). `findMatchingConfiguration(sig, configs[])` matches against existing configurations by name
- **Auto-detect config**: Quote builder auto-detects configuration from drawing layout via signature matching. Shows "Detected: X" badge near Configuration dropdown. Auto-selects matching config when found
- **Auto-generate config**: When no matching configuration exists, an "Auto-generate" button appears. Clones the first config for the frame type, adjusts sash-frame quantities and mullion profiles based on the detected layout
- **USD→NZD rate**: Configurable in Settings (default 1.7), stored in `proquote-settings` localStorage
- **Sale price**: $500–$750/m² in $5 increments, default set by configuration's `defaultSalePricePerSqm`
- **Quote builder integration**: Configuration dropdown auto-populates when frame type selected; pricing breakdown panel shows net cost vs sale price with margin. Glass/liner/handle costs shown as separate line items when selected
- **Executive Summary**: `/job/:id/exec-summary` — job-level financial totals + expandable per-item breakdown (materials incl. glass/liner/handle, labor, margin %, profit)
- **Frame types**: ES52 Window, ES52 Hinge Door (hinge-door only), Entrance Door (entrance-door only), French Door (french-door only), ES70 Bifold, ES127 Sliding Window, ES127 Sliding Door

## Data Model
- `quoteItemSchema` fields: name, quantity, category, width, height, layout, windowType, hingeSide, openDirection, halfSolid, panels, sidelightWidth, sidelightEnabled, sidelightSide, doorSplit, doorSplitHeight, bifoldLeftCount, centerWidth, entranceDoorRows, entranceSidelightRows, entranceSidelightLeftRows, hingeDoorRows, frenchDoorLeftRows, frenchDoorRightRows, panelRows, showLegend, customColumns, pricePerSqm, frameType, frameColor, flashingSize, windZone, linerType, glassIguType, glassType, glassThickness, wanzBar, wallThickness, heightFromFloor, handleType
- `entranceDoorRows` / `entranceSidelightRows` / `entranceSidelightLeftRows`: Arrays of `{ height: number, type: "fixed"|"awning" }`
- `hingeDoorRows`: Array of `{ height: number, type: "fixed"|"awning" }`
- `frenchDoorLeftRows` / `frenchDoorRightRows`: Arrays of `{ height: number, type: "fixed"|"awning" }`
- `panelRows`: Array of arrays `[{ height: number, type: "fixed"|"awning" }][]` for per-panel/leaf row splits
- `customColumns`: Array of `{ width: number, rows: [{ height, type, slideDirection, hingeSide, openDirection }] }`
- Width/height of 0 means auto (even split)

## Business Rules
- Standard windows and doors use 52mm frame
- Bi-folding doors use 70mm frame
- Sliding/Stacker/Sliding doors use 127mm frame
- Custom grid widths/heights default to even distribution when set to 0
- Opening indicator triangle point = hinge location
- ALL awning indicators always show solid line — only hinge triangles respond to open direction setting
- Dashed lines (Open In) on hinge triangles use pronounced pattern (14/6 dash/gap) with 1.5x stroke weight
- JSON body size limit: 10MB (for photo uploads)
- editItem uses skipCategoryResetRef to prevent category-change useEffect from overwriting saved config values
