> Protected document: Do not modify this file unless the user explicitly requests a documentation update.

<!-- PROTECTED DOCUMENT — Do not modify unless the user explicitly requests a documentation update. -->

# STEELIQ ARCHITECTURE

Last Updated: 2026-03-08

---

## 1. Architecture Overview

SteelIQ currently follows a client/server web application structure.

High-level application shell:

- Sidebar
- Header
- Main content area

Main content hosts routed pages such as:
- LJ – Estimates
- Quotes
- Quote Builder
- Quote Preview
- Library
- Settings

Current key frontend focus:
- `client/src/pages/quote-builder.tsx`

---

## 2. Frontend Architecture

### App Shell
Primary shell lives in:
- `client/src/App.tsx`

Pattern:
- sidebar navigation
- header
- `<main className="flex-1 overflow-auto">`

Important shell rule:
- shell should not be broadly redesigned during workflow polish work
- only minimal scroll/flex safety adjustments should be made when proven necessary

### Key Pages
- `quote-builder.tsx` — core estimating workflow
- `jobs-list.tsx` — product-facing "Estimates" list
- `quotes-list.tsx` — quote list
- `quote-detail.tsx` — quote detail workflow
- `quote-preview.tsx` — customer-facing quote preview
- `library.tsx` — master data / library management
- `settings.tsx` — organizational and division settings

---

## 3. Quote Builder Architecture

Quote Builder is the highest-risk, most important frontend file.

It currently owns or coordinates:
- job/estimate header fields
- form state
- item creation/editing
- preview drawing visibility
- item list rendering
- mobile tabs
- photo actions
- summary/exec-summary entry points
- download actions

### Desktop Layout
Desktop layout is multi-panel and is the stable baseline.

### Mobile Layout
Mobile layout uses three full-workspace tabs:
- Config
- Preview
- Items

Important rule:
Mobile and desktop builder trees should not be duplicate-mounted if that causes duplicate expensive components or state collisions.

---

## 4. Scroll Architecture

A key recent issue was mobile nested scroll fighting.

Root cause:
- Quote Builder root used `h-[100dvh]`
- but it lived inside shell `<main className="flex-1 overflow-auto">`
- header height caused overflow
- resulting in outer main scroll + inner form scroll conflict

Current architecture intention:
- Quote Builder should use the available shell content height correctly
- only one meaningful scroll layer should exist per active mobile tab
- Config tab may scroll through form content
- Preview tab should show drawing immediately
- Items tab should scroll item cards

Important shell rule:
Do not change `<main>` overflow behavior broadly unless there is a proven need after page-level fixes.

---

## 5. Site Type Preset Architecture

### Current Implementation
Site Type preset is client-only/local state inside Quote Builder:
- `renovation`
- `new_build`

It is estimate-level in current behavior and affects future new items only.

### Current Behavior Rules
- selecting preset does not modify existing items
- preset values are defaults only
- fields remain editable
- no backend persistence yet

### Long-Term Architecture
This preset system should move into Settings and become division-specific.

Likely target:
- LJ settings manage LJ site presets
- future LE/LL presets can exist independently

Presets should reference existing product/library option values rather than inventing a second product data source.

---

## 6. Renovation / New Build Defaulting Model

### Renovation
Current architectural intention:
- ES52-related frame default
- EnergySaver-related glazing defaults
- 19mm mitercut grooved liner default
- category-appropriate handle default
- wall thickness default
- wind zone default from frame type

### New Build
Current intention:
- minimal Phase 1 defaults
- guaranteed wall thickness default
- structure ready for refinement later

---

## 7. Wind Zone Auto-Fill Rule

Wind zone is derived locally from frame type in current design.

Initial local rule:
- ES52 variants => Extra High

Important behavior rules:
- auto-fill only when empty or still equal to previous auto value
- never override a deliberate user edit
- remain editable at all times

Long-term:
- this may become a cleaner rules/data-driven system rather than local UI logic

---

## 8. Height-from-Floor Warning Rule

Rule:
- if height from floor is > 0 and < 800mm
- show a warning that safety glazing / toughening may be required

Important:
- warning only
- non-blocking
- do not auto-change glass selection yet

Long-term:
- may evolve into a more complete compliance guidance engine

---

## 9. Photo Architecture

Current photo system already exists and must be preserved.

Behavior:
- item-level photo capture/upload
- gallery modal
- photo attachment actions from item UI

Important architecture rule:
- mobile UI changes must not break photo actions
- hidden inputs, dialogs, refs, and mutation handlers may need to live outside tab content if necessary to stay accessible

---

## 10. Quote Engine Architecture Direction

This is critical.

### Do NOT build the quote engine directly from live Quote Builder UI state.
That creates duplication, inconsistent rendering, and hard-to-maintain template logic.

### Recommended architecture:
Create or evolve toward a normalized **Quote Document Model** that contains:

- metadata
- customer
- project
- items[]
- totals
- notes
- branding
- drawings
- photos
- terms/exclusions/scope sections where applicable

### Then:
- Quote Builder prepares/feeds data
- Quote Preview renders from the Quote Document
- PDF/print generator renders from the Quote Document
- Template engine styles the Quote Document

Important principle:
The quote engine should be a renderer of structured quote data, not a second copy of the Quote Builder.

---

## 11. Customer-Facing Quote Engine Requirements

The quote engine must eventually support:
- division branding
- company details
- legal/trading name presentation
- layout styling
- typography
- section ordering
- totals formatting
- item schedule layout
- optional drawings/photos
- multiple templates for LJ / LE / LL

This is a major upcoming architecture area.

---

## 12. Settings Architecture Direction

Settings already exist in the system.

Long-term target for site presets:
- site presets move from Quote Builder local state into Settings
- starting with LJ division
- presets should reference existing option values from library / known option sets
- settings must support multiple presets and future expansion

Important separation of concerns:
- Library stores master data/options
- Settings stores workflow defaults/presets
- Quote Builder consumes them

---

## 13. Architecture Principles to Preserve

1. Desktop layout is stable baseline.
2. Mobile can adapt to workflow needs.
3. Presets prefill only, never lock.
4. Existing items are never silently mutated by preset changes.
5. Quote engine must be decoupled from live builder UI state.
6. Division-specific behavior should be supported by settings/templates, not duplicated systems.
7. Avoid duplicate mounting of expensive stateful UI structures.

---

## 14. Files Most Likely to Change Next

- `client/src/pages/quote-builder.tsx`
- `client/src/pages/quote-preview.tsx`
- `client/src/pages/settings.tsx` (future preset-management work)
- maybe a quote engine/template rendering layer later

---

## 15. Files That Should Not Change Lightly

- schema/backend routes
- pricing/snapshot systems
- photo storage internals
- broad shell architecture
