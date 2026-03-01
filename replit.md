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
- **Custom Grid Layout**: Column-based system available for all categories except Entrance Door and Hinge Door. Each column independently configurable:
  - Number of columns (1-6)
  - Per-column width in mm (0 = auto even split)
  - Per-column row count (1-6)
  - Per-row height in mm (0 = auto even split within column)
  - Per-pane type toggle (category-specific):
    - Windows (standard, bay): FIX/AWN toggle
    - Sliding (sliding-window, sliding-door, stacker-door): FIX/SLD/AWN three-way cycle + separate L/R direction buttons when SLD
    - French Door: FIX/AWN/HNG cycle + per-pane In/Out + hinge side L/R
- **Entrance Door**: Dedicated controls (no custom grid):
  - Sidelight toggle: on/off (default on)
  - Sidelight position: Left, Right, or Both (default right)
  - Sidelight width in mm (applies to each sidelight)
  - Door panel rows (1-4): FIX/AWN per row, height in mm
  - Sidelight rows (1-4): FIX/AWN per row, height in mm
  - When sidelight position is "Both": independent left and right sidelight row controls
  - ONE full-height hinge triangle spanning entire door column, controlled by hinge side dropdown
  - Hinge side: Left or Right
  - Opening direction: defaults to "In" (dashed) for entrance doors
  - Per-section dimension lines: section widths below main dim; row height labels when multiple rows
- **Drawing Legend**: Positioned to the LEFT of the height dimension line, right-aligned (textAnchor="end"), outside the drawing. Toggleable on/off via "Show Drawing Legend" checkbox. padLeft increases to 0.32*maxDim when legend visible (0.16 when off). Shows per-category info:
  - Always: frame size (e.g. "52mm frame")
  - Windows Standard: window type (Fixed/Awning)
  - Entrance/Hinge Door: hinge side (Left/Right) + door open direction (Open In/Open Out)
  - French Door: door open direction
  - Bifold Door: leaf count
  - Stacker Door: panel count
  - Custom layouts: "Custom Layout" indicator
- **Opening Direction**: In (dashed line, pronounced thick dash) / Out (solid line) — applies ONLY to hinge triangles on doors. Awning indicators are always solid lines regardless of open direction setting
- **Bi-fold Fold Direction**: Configurable left/right split
- **Frame Sizes**: 52mm standard, 70mm bi-fold, 127mm sliding/stacker
- **Dimension Lines**: All drawings show total Width and Height with architectural tick marks
- **Quote Management**: Add, edit, duplicate, delete items in a quote list

## Data Model
- **Item ID / Reference**: Combobox with room dropdown (14 industry-standard rooms: KIT, LNG, DIN, BED, MBR, ENS, BTH, WC, LDY, GAR, HWY, STD, RMP, ENT). Floor level selector (G, 1, 2, 3, B). Auto-generates CODE-FLOOR## format (e.g. BED-G01, KIT-102). Auto-increments sequence number based on existing items. User can also type any custom name.
- `quoteItemSchema` fields: name, quantity, category, width, height, layout, windowType, hingeSide, openDirection, halfSolid, panels, sidelightWidth, sidelightEnabled, sidelightSide, doorSplit, doorSplitHeight, bifoldLeftCount, centerWidth, entranceDoorRows, entranceSidelightRows, entranceSidelightLeftRows, hingeDoorRows, frenchDoorLeftRows, frenchDoorRightRows, panelRows, showLegend, customColumns
- `entranceDoorRows` / `entranceSidelightRows` / `entranceSidelightLeftRows`: Arrays of `{ height: number, type: "fixed"|"awning" }` for entrance door panel/sidelight row splits
- `hingeDoorRows`: Array of `{ height: number, type: "fixed"|"awning" }` for hinge door panel row splits (standard layout)
- `frenchDoorLeftRows` / `frenchDoorRightRows`: Arrays of `{ height: number, type: "fixed"|"awning" }` for french door independent left/right panel row splits
- `panelRows`: Array of arrays `[{ height: number, type: "fixed"|"awning" }][]` for per-panel/leaf row splits on bifold-door and stacker-door; indexed by panel number
- `sidelightSide`: "left" | "right" | "both" — when "both", left sidelight uses entranceSidelightLeftRows, right uses entranceSidelightRows
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
- ALL awning indicators always show solid line (open out) — only hinge triangles respond to open direction setting
- Windows Standard: no opening direction control (awnings always solid)
- Bi-fold V chevron indicates fold direction (< = left, > = right)
- Sliding arrow direction: configurable per pane in custom grid; default right
- French door: no custom grid option; standard layout with independent left/right panel row controls (1-4 rows FIX/AWN each); TWO full-height hinge triangles (left hinges left, right hinges right)
- Bifold door: no custom grid option; standard layout with per-leaf collapsible row controls (1-4 rows FIX/AWN each); bifold chevron overlay per leaf
- Stacker door: no custom grid option; standard layout with per-panel collapsible row controls (1-4 rows FIX/AWN each); sliding arrow overlay per panel
- Entrance door: no custom grid option; layout forced to "standard"; openDirection defaults to "in"; sidelightEnabled defaults to true
- Entrance door hinge: ONE full-height triangle spanning entire door column height, not per-row
- Entrance door: no solid bottom panel, no door split
- Hinge door: no custom grid option; layout forced to "standard"; entrance-door-style row controls (1-4 rows FIX/AWN), ONE full-height hinge triangle, no solid bottom panel
- Dashed lines (Open In) on hinge triangles use pronounced pattern (14/6 dash/gap) with 1.5x stroke weight for clear visual distinction
- `isDoorCategory` = `["french-door"]` only (hinge-door uses FIX/AWN toggle, not FIX/AWN/HNG cycle)
