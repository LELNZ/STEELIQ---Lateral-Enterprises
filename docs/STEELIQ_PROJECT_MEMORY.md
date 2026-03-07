> Protected document: Do not modify this file unless the user explicitly requests a documentation update.

<!-- PROTECTED DOCUMENT — Do not modify unless the user explicitly requests a documentation update. -->

# STEELIQ PROJECT MEMORY

Last Updated: 2026-03-08
Current Primary Division: LJ — Lateral Joinery
Current Development Phase: Mobile-first site-visit quoting MVP

---

## 1. Project Overview

SteelIQ Pro-Quote is a mobile-first estimating and quoting system being built for Lateral Enterprises.

It is intended to support multiple divisions:

- LJ — Lateral Joinery
- LE — Lateral Engineering
- LL — Lateral Laser

The current live focus is LJ.

The system is being designed to let a user perform a site visit, create an estimate, configure window/door items, generate drawings, attach photos, review pricing, and produce a customer-facing quote.

The immediate business purpose is to support real onsite quoting during site visits.

---

## 2. Business Context

SteelIQ is not intended to remain only a quote builder. It is being designed as the foundation of a larger fabrication and operations platform.

Current real-world workflow target:

1. Visit site
2. Create estimate
3. Add each opening/item
4. Enter measurements and key specifications
5. Attach photos
6. Review generated drawing
7. Build customer-facing quote
8. Export / print / save quote

Current business priority:
- working mobile quoting workflow for site visits
- professional customer-facing quote output
- LJ-specific workflow defaults
- no unnecessary backend churn before the quoting flow is stable

---

## 3. Long-Term Platform Vision

SteelIQ is intended to become a full business operating system for fabrication-related divisions.

Planned or envisioned long-term modules include:

- Full Job Management System
- Full Estimation Facility
- Full Workshop Integration
- Full Cut Optimization
- Full Procurement Center
- Full Financial Systems
- Full Field Operations
- Full Integration Hub
- Xero integration for invoicing and timesheets
- future AI-assisted estimation and drawing interpretation

Important: only the estimation / quoting workflow is the current build focus.

---

## 4. Current Development Phase

Current phase:
- MVP / site-ready quoting system
- mobile-first workflow stabilization
- customer-facing quote workflow foundation

This is not the phase for enterprise governance, SOX/TOGAF/COBIT implementation, or deep platform-wide refactoring.

The current stage is:
- get the quoting workflow working end-to-end
- make it usable on phone during site visits
- generate a presentable customer-facing quote

---

## 5. Immediate Objective

The immediate objective is:

Build a working, field-usable quoting workflow for Monday site visits.

Success means a user can:

1. Open LJ – Estimates
2. Create a new estimate
3. Select Renovation or New Build
4. Add items quickly
5. Enter dimensions and key specs
6. See the drawing immediately
7. Capture and attach photos
8. Review items
9. Open a customer-facing quote preview
10. Print / save / export a quote

---

## 6. Technical Stack

Frontend:
- React
- TypeScript
- TailwindCSS
- shadcn/ui
- likely React Hook Form patterns within Quote Builder

Backend:
- Node.js
- Express

Database:
- PostgreSQL

Development environment:
- Replit

Architecture style:
- client/server monorepo
- routed React SPA
- REST-style backend routes

---

## 7. Core Product Principles

1. Mobile usability matters because the app must work on site visits.
2. Desktop layout is the stable baseline and must not be broken casually.
3. Quote Builder is the most critical page.
4. Presets should prefill only, never lock fields.
5. Existing items must never be silently mutated by estimate-level preset changes.
6. The customer-facing quote engine should be driven by a normalized Quote Document Model, not live UI state.
7. Long-term multi-division support must remain possible.

---

## 8. Key User Workflows

### Site Visit Workflow
1. Create estimate
2. Select site type (Renovation / New Build)
3. Add item
4. Enter dimensions and key data
5. Review preview drawing
6. Attach photo(s)
7. Repeat for more items
8. Review quote preview
9. Save / export quote

### Office Refinement Workflow
1. Open existing estimate
2. Adjust item specs
3. Review pricing and details
4. Generate cleaner customer quote
5. Print / export

---

## 9. Core Domain Concepts

### Estimate
A container for a site/job quote-building session. Currently the original "jobs" concept has been renamed in product language to "Estimates".

### Quote Item
A configured item representing a window/door/opening with dimensions, configuration choices, pricing, drawing, and photos.

### Site Type Preset
Estimate-level workflow preset chosen once per estimate:
- Renovation
- New Build

These affect only future new items.

### Quote Document
Future normalized structure used by customer-facing quote rendering.

### Photo Attachment
Photos linked to items for site capture and memory/reference.

---

## 10. Current Important Product Decisions

- Mobile Quote Builder uses tabs:
  - Config
  - Preview
  - Items
- Site Type presets are currently local/client-side in Quote Builder
- Renovation defaults are implemented first
- New Build defaults are minimal placeholder defaults
- Wind zone can be auto-filled from frame type but must remain editable
- Height-from-floor under 800mm should trigger a warning only, not auto-change glass

---

## 11. Quote Engine Direction

The customer-facing quote generator must eventually support:

- company branding
- logo placement
- typography/layout control
- customer details
- quote number/date
- item schedule
- specs
- totals
- notes
- optional drawings
- optional photos
- optional terms / exclusions / scope sections
- multiple division-specific templates

Important architecture rule:
The quote engine must render from a structured Quote Document Model and must not be tightly coupled to live Quote Builder form state.

---

## 12. Site Preset Direction

Current state:
- presets exist locally in Quote Builder

Long-term target:
- presets should move into Settings
- presets should be division-specific
- LJ is the first division to support this
- settings-managed presets should still only prefill values and remain fully editable
- changing a preset should not modify existing items

---

## 13. Multi-Division Direction

Current active product language:
- LJ – Estimates

Future support planned:
- LE – Estimates
- LL – Estimates

Current navigation is being prepared for this, but only LJ is live.

---

## 14. Engineering Constraints

Do not casually change:
- database schema
- backend routes
- pricing logic
- snapshot / quote-revision logic
- shared backend architecture
- photo storage architecture

Quote Builder changes should focus on UI, layout, workflow, and safe client-side behavior unless explicitly instructed otherwise.

---

## 15. Current Strategic Guidance

Right now, prioritize:
- mobile quoting usability
- site visit speed
- customer-facing quote quality
- safe defaults
- workflow polish

Do not prioritize right now:
- enterprise governance frameworks
- broad platform redesign
- large-scale backend re-architecture
- over-engineering settings persistence before Monday readiness

---

## 16. Known Strategic Future Work

- Quote Generator Engine
- Quote Document Model
- Presets moved into LJ Settings
- Better quote templates
- Multi-division quote template support
- Tablet-specific layout refinement
- Field workflow enhancements
- eventual integration work (Xero, etc.)

---

## 17. Bootstrap Context

SteelIQ is currently in a mobile-first LJ quoting workflow phase.
The system already has Quote Builder mobile tabs and site-type presets.
Immediate focus is improving the customer-facing quote engine and moving long-term site defaults toward settings-driven architecture without breaking the current working workflow.
