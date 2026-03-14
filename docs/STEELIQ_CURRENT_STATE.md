> Protected document: Do not modify this file unless the user explicitly requests a documentation update.

<!-- PROTECTED DOCUMENT — Do not modify unless the user explicitly requests a documentation update. -->

# STEELIQ CURRENT STATE

Last Updated: 2026-03-08
Current Priority: Monday-ready site-visit quoting workflow + future quote engine / settings preset architecture

---

## 1. Current Development Status

The recent mobile Quote Builder/site-visit implementation phase was completed in Replit.

Completed tasks:

- T001 — Fix Quote Builder viewport height and scroll architecture
- T002 — Fix mobile Config tab scroll to use a single scroll layer
- T003 — Verify Preview and Items tabs function as full workspaces
- T004 — Add Site Type / Workflow Preset selector (Renovation / New Build)
- T005 — Implement Renovation preset defaults
- T006 — Implement New Build preset defaults
- T007 — Add wind zone auto-fill rule based on ES52 frame types
- T008 — Add height-from-floor safety glazing warning (<800mm)

These changes were focused primarily in:
- `client/src/pages/quote-builder.tsx`
- `client/src/App.tsx` only if minor main flex/scroll adjustment was needed

---

## 2. What This Means Functionally

The app should now support:

- mobile Quote Builder tabs:
  - Config
  - Preview
  - Items
- site type selector:
  - Renovation
  - New Build
- renovation-based new item defaults
- minimal new build defaults
- wind zone auto-fill from ES52 frame type
- non-blocking warning under 800mm from floor
- preserved photo workflow
- desktop layout unchanged

---

## 3. Current Immediate Goal

The current goal is no longer broad architecture planning.

The current goal is:

Get the system to a reliable, professional, customer-facing site-visit quoting workflow.

The user must be able to:
1. open LJ – Estimates
2. create a new estimate
3. choose Renovation or New Build
4. add items quickly
5. enter dimensions and key specs
6. view the drawing immediately
7. capture and attach photos
8. review items
9. generate/open a customer-facing quote preview
10. print/save/export the quote

---

## 4. Current Most Important Active Topics

Two major follow-on features are currently under discussion and need to be preserved in new chats:

### A. Customer-Facing Quote Generator Engine
Need:
- design/styling control
- template support
- division branding
- professional quote output
- structured rendering model
- future PDF/print strength

Critical design direction:
- quote engine should render from a Quote Document Model
- not directly from scattered live Quote Builder state

### B. Site Type Presets Moving into LJ Settings
Current state:
- presets are temporary/local in Quote Builder

Future direction:
- move Renovation/New Build defaults into LJ division settings
- keep defaults editable and reusable
- preserve "defaults only" behavior
- support future multi-division expansion

---

## 5. Most Recent Replit Plan That Was Executed

Objective:
Fix the mobile Quote Builder so Config/Preview/Items tabs are true full-workspace views, then add Site Visit Mode enhancements (Renovation/New Build presets, wind zone auto-fill, height-from-floor warning), with no backend/schema/API/pricing/snapshot changes.

Recent plan included:
- viewport/scroll fix
- single scroll layer
- verify Preview/Items
- add site type selector
- implement renovation defaults
- implement new build defaults
- implement wind zone auto-fill
- add height warning

This plan is complete.

---

## 6. What Is Next

The next work should not repeat T001–T008.

The next work should focus on either or both of:

### Track 1 — Monday Readiness / Workflow Polish
- polish Quote Builder item cards
- improve photo workflow visibility/speed
- improve estimate header usability
- improve quote preview professionalism
- verify estimate-to-quote workflow end-to-end
- stabilize any remaining UI issues

### Track 2 — Architecture for Upcoming Features
- define customer-facing Quote Generator Engine properly
- define Quote Document Model
- define how presets move into LJ Settings
- ensure both support future multi-division LJ/LE/LL quoting

---

## 7. Recommended Immediate Next Discussion in New Chat

The next chat should be brought up to speed specifically on:
1. customer-facing quote engine architecture
2. moving site-type defaults into LJ settings architecture

This prevents losing the most important design discussions that happened after T001–T008.

---

## 8. Known Constraints

Do not casually modify:
- backend APIs
- pricing logic
- snapshot/revision logic
- database schema
- photo storage system
- desktop layout baseline

Current work should stay UI/architecture/planning focused unless explicitly told otherwise.

---

## 9. High-Priority Next Tasks

Recommended next tasks after T001–T008:

1. Quote engine architecture and Quote Document Model definition
2. Customer-facing quote layout/styling/template requirements
3. LJ settings-based preset architecture
4. end-to-end quote workflow polish
5. mobile item/photo UX polish
6. customer-facing preview and PDF quality improvements

---

## 10. Current Definition of Success

Short-term success:
- a reliable site-visit quoting workflow
- a professional-looking customer-facing quote

Medium-term success:
- a proper quote rendering engine
- settings-managed presets for LJ
- cleaner path to multi-division support

---

## 11. Bootstrap Prompt

Read the attached SteelIQ project documentation carefully:
- STEELIQ_PROJECT_MEMORY.md
- STEELIQ_ARCHITECTURE.md
- STEELIQ_CURRENT_STATE.md

These files are the authoritative project context.

Do not redesign the system unless explicitly instructed.

First:
1. summarize your understanding of the current state
2. confirm what was just completed
3. confirm the next logical development work

Then continue from there.
