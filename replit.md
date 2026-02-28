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
- **Entrance Door**: Door + Sidelight with configurable width (52mm frame)
- **Hinge Door**: Single hinged door, left/right (52mm frame)
- **French Door**: Two opposite-hinged doors (52mm frame)
- **Bi-folding Door**: 2-8 leaves with configurable fold direction split (70mm frame)
- **Stacker Door**: 3-6 sliding panels (127mm frame)
- **Bay Window**: Center fixed + two side awning panels (52mm frame)

## Features
- **Custom Grid Layout**: Column-based system available for ALL categories. Each column independently configurable:
  - Number of columns (1-6)
  - Per-column width in mm (0 = auto even split)
  - Per-column row count (1-6)
  - Per-row height in mm (0 = auto even split within column)
  - Per-pane type toggle (Fixed or Awning)
  - Example: Column 1 = 1 full-height fixed pane, Column 2 = awning over fixed
- **Opening Direction**: In (dashed line) / Out (solid line) for hinged and awning types
- **Bi-fold Fold Direction**: Configurable left/right split (e.g., 3 left + 3 right for 6 leaves)
- **Frame Sizes**: 52mm standard, 70mm bi-fold, 127mm sliding/stacker
- **Dimension Lines**: All drawings show total Width and Height with architectural tick marks
- **Quote Management**: Add, edit, duplicate, delete items in a quote list

## Data Model (Custom Grid)
- `customColumns`: Array of `{ width: number, rows: [{ height: number, type: "fixed"|"awning" }] }`
- Width/height of 0 means auto (even split)
- Mixed sizing: specified values (>0) treated as absolute mm capped to total; remaining space distributed evenly to auto (0) entries
- If all specified values exceed the total, they are proportionally scaled down to fit
- Mm labels on drawing are rounded and adjusted so they always sum exactly to the total dimension
- Per-section dimension lines: column widths shown below main width dimension; row heights shown as labels centered in each pane for multi-row columns

## Business Rules
- Standard windows and doors use 52mm frame
- Bi-folding doors use 70mm frame
- Sliding/Stacker doors use 127mm frame
- Custom grid widths/heights default to even distribution when set to 0
- Opening indicator triangle point = hinge location
- Bi-fold V chevron indicates fold direction (< = left, > = right)
