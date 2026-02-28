# Pro-Quote CAD Generator

## Overview
A professional window and door quotation tool with live SVG technical drawings. Users configure items via a side panel and see an instant preview with dimension lines, labels, and opening indicators.

## Architecture
- **Frontend**: React + TypeScript with Shadcn UI components
- **Drawing Engine**: SVG-based rendering in `client/src/components/drawing-canvas.tsx`
- **State Management**: Client-side React state
- **Routing**: Wouter (single page at `/`)

## Key Files
- `shared/schema.ts` - Zod schemas for QuoteItem types
- `client/src/components/drawing-canvas.tsx` - SVG drawing component with all configurations
- `client/src/pages/quote-builder.tsx` - Main page with config form, drawing preview, quote items table
- `client/src/App.tsx` - Route setup

## Supported Categories
- **Windows Standard**: Fixed or Awning (52mm frame)
- **Sliding Window**: Fixed + Sliding panels (127mm frame)
- **Sliding Door**: Fixed + Sliding panels (127mm frame) — same rendering as Sliding Window
- **Entrance Door**: Door + Sidelight with dedicated controls (52mm frame)
- **Hinge Door**: Single hinged door, left/right (52mm frame)
- **French Door**: Two opposite-hinged doors (52mm frame)
- **Bi-folding Door**: 2-8 leaves with configurable fold direction split (70mm frame)
- **Stacker Door**: 3-6 sliding panels (127mm frame)
- **Bay Window**: Center fixed + two side awning panels (52mm frame)

## Features
- **Custom Grid Layout**: Column-based system available for all categories except Entrance Door. Each column independently configurable:
  - Number of columns (1-6)
  - Per-column width in mm (0 = auto even split)
  - Per-column row count (1-6)
  - Per-row height in mm (0 = auto even split within column)
  - Per-pane type toggle (category-specific):
    - Windows (standard, bay): FIX/AWN toggle
    - Sliding (sliding-window, sliding-door, stacker-door): FIX/SLD toggle + separate L/R direction buttons
    - Doors (hinge-door, french-door, entrance-door): FIX/AWN/HNG cycle + per-pane In/Out + hinge side L/R
- **Entrance Door**: Dedicated controls (no custom grid):
  - Sidelight position: Left or Right (default right)
  - Sidelight width in mm
  - Door split: horizontal split with configurable top height (0 = even)
  - Hinge side: Left or Right
  - Opening direction: defaults to "In" (dashed) for entrance doors
  - Solid bottom panel option
  - Per-section dimension lines: door width + sidelight width below main dim; split heights as dimension lines on the side
- **Sliding Pane Type in Custom Grid**: For sliding-window and stacker-door categories, pane type cycles Fixed/Sliding with direction arrow toggle (left/right)
- **Opening Direction**: In (dashed line) / Out (solid line) for hinged and awning types
- **Bi-fold Fold Direction**: Configurable left/right split
- **Frame Sizes**: 52mm standard, 70mm bi-fold, 127mm sliding/stacker
- **Dimension Lines**: All drawings show total Width and Height with architectural tick marks
- **Quote Management**: Add, edit, duplicate, delete items in a quote list

## Data Model
- `quoteItemSchema` fields: name, quantity, category, width, height, layout, windowType, hingeSide, openDirection, halfSolid, panels, sidelightWidth, sidelightSide, doorSplit, doorSplitHeight, bifoldLeftCount, centerWidth, customColumns
- `customColumns`: Array of `{ width: number, rows: [{ height: number, type: "fixed"|"awning"|"sliding"|"hinge", slideDirection: "left"|"right", hingeSide: "left"|"right", openDirection: "in"|"out" }] }`
- Width/height of 0 means auto (even split)
- Mixed sizing: specified values (>0) treated as absolute mm capped to total; remaining space distributed evenly to auto (0) entries
- Mm labels on drawing are rounded and adjusted so they always sum exactly to the total dimension

## Business Rules
- Standard windows and doors use 52mm frame
- Bi-folding doors use 70mm frame
- Sliding/Stacker/Sliding doors use 127mm frame
- Custom grid widths/heights default to even distribution when set to 0
- Opening indicator triangle point = hinge location
- Bi-fold V chevron indicates fold direction (< = left, > = right)
- Sliding arrow direction: configurable per pane in custom grid; default right
- Entrance door: no custom grid option; layout forced to "standard"; openDirection defaults to "in"
