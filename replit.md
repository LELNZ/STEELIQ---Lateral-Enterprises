# Window & Door Quote Tool

## Overview
A professional window and door quotation tool with live SVG technical drawings. Users configure items via a side panel and see an instant preview of the drawing with dimension lines, labels, and opening indicators.

## Architecture
- **Frontend**: React + TypeScript with Shadcn UI components
- **Drawing Engine**: SVG-based rendering in `client/src/components/drawing-canvas.tsx`
- **State Management**: Client-side React state (no database needed for this tool)
- **Routing**: Wouter

## Key Files
- `shared/schema.ts` - Zod schemas for QuoteItem types
- `client/src/components/drawing-canvas.tsx` - SVG drawing component with all window/door configurations
- `client/src/pages/quote-builder.tsx` - Main page with config form, drawing preview, and quote items table
- `client/src/App.tsx` - Route setup

## Supported Types
- **Window**: Fixed, Awning (top-hung), 2-Pane Vertical (Mullion), 2-Pane Horizontal (Transom)
- **Hinge Door**: Single, Door with Sidelight, Door with Transom
- **Sliding/Stacking Door**: 2, 3, or 4 panels (127mm frame)
- **Entry Door**: Single with optional sidelights (left, right, or both)

## Business Rules
- Standard windows and hinge doors use a 52mm frame
- Sliding/Stacking doors use a 127mm frame
- All dimensions are in mm
- For multi-pane windows, split position of 0 defaults to even split
- Opening indicator triangle point = hinge location
