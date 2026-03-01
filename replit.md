# Pro-Quote CAD Generator

## Overview
A professional window and door quotation tool with live SVG technical drawings. Users configure items via a side panel and see an instant preview with dimension lines, labels, and opening indicators. Items are organized into Jobs which persist to a PostgreSQL database.

## Architecture
- **Frontend**: React + TypeScript with Shadcn UI components
- **Backend**: Express.js with PostgreSQL (Drizzle ORM, node-postgres adapter)
- **Drawing Engine**: SVG-based rendering in `client/src/components/drawing-canvas.tsx` with forwardRef for PNG export
- **State Management**: Client-side React state + TanStack Query for API data fetching
- **Settings**: Global app settings via React context (`client/src/lib/settings-context.tsx`) with localStorage persistence
- **Routing**: Wouter — `/` = Jobs List, `/job/new` = New Job, `/job/:id` = Edit Job, `/settings` = Settings
- **PNG Export**: Client-side SVG→Canvas→PNG at 3x resolution (`client/src/lib/export-png.ts`)
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
- `client/src/lib/export-png.ts` - PNG export + image compression utilities
- `client/src/App.tsx` - Route setup with SettingsProvider wrapper

## Database Tables
- `jobs`: id (uuid PK), name (text, required), address (text), date (text), created_at (timestamp)
- `job_items`: id (uuid PK), job_id (varchar FK), config (jsonb — full QuoteItem), photo (text, nullable — base64), sort_order (integer)
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
- **PNG Export**: Download drawings as high-res PNG (3x scale). Available per-item and for the current drawing view
- **Site Photos**: Capture photos per item via camera (mobile) or file upload (desktop). Compressed to JPEG, shown as thumbnails in items list, expandable in modal
- **Quote Item Actions**: Download PNG, Take Photo, Edit, Duplicate, Delete
- **Save Job**: Validates job name required + at least one item. Persists all items with photos to database
- **Unsaved Changes Warning**: beforeunload browser prompt + in-app dialog (Cancel/Discard/Save & Leave) when navigating away with unsaved changes
- **Square Meters**: Per-item m² (width × height × qty / 1,000,000) in items table + total m² in section header + m² badge on job cards
- **Expand/Collapse Items**: Toggle between 1/3 height (33vh) and 1/2 height (50vh) for the quote items section
- **Settings Page**: Global preferences stored in localStorage — legend default on/off, quote list position (bottom or right side)
- **Custom Grid Layout**: Column-based system available for all categories except Entrance Door and Hinge Door
- **Drawing Legend**: Positioned to the LEFT of the height dimension line, toggleable on/off. Shows frame size, window/door type info
- **Item ID / Reference**: Combobox with room dropdown (14 rooms: KIT, LNG, DIN, BED, MBR, ENS, BTH, WC, LDY, GAR, HWY, STD, RMP, ENT). Floor selector (G, 1, 2, 3, B). Auto-generates CODE-FLOOR## format

## Settings (localStorage: proquote-settings)
- `showLegendDefault` (boolean, default true) — whether legend is shown by default on new items
- `quoteListPosition` ("bottom" | "right", default "bottom") — where items list renders relative to drawing

## Data Model
- `quoteItemSchema` fields: name, quantity, category, width, height, layout, windowType, hingeSide, openDirection, halfSolid, panels, sidelightWidth, sidelightEnabled, sidelightSide, doorSplit, doorSplitHeight, bifoldLeftCount, centerWidth, entranceDoorRows, entranceSidelightRows, entranceSidelightLeftRows, hingeDoorRows, frenchDoorLeftRows, frenchDoorRightRows, panelRows, showLegend, customColumns
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
