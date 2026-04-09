# Phase 5D Forensic Report — Platform Layout Standardization + LL Governance

**Date:** 2026-04-05
**Phase:** 5D
**Status:** Complete

---

## 1. Objectives

| # | Objective | Status |
|---|-----------|--------|
| 1 | Standardize page headers across all list/detail pages | Complete |
| 2 | Apply `max-w-7xl` enterprise width to Settings and Users | Complete |
| 3 | Clean junk/demo/test data via `isDemoRecord` flagging | Complete |
| 4 | LL process rate governance — explicit empty state + assist gas clarity | Complete |
| 5 | Dead code removal (`LLPricingSettingsViewer`, `page-layout.tsx`) | Complete |
| 6 | Preserve LJ/LE/PDF/numbering boundaries | Verified |

---

## 2. Header Standardization Spec

All list pages now follow this consistent header contract:

```
<header className="border-b px-4 sm:px-6 py-3 flex items-center justify-between gap-3 bg-card shrink-0">
  <div className="flex items-center gap-3">
    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary shrink-0">
      <Icon className="w-4 h-4 text-primary-foreground" />
    </div>
    <div>
      <h1 className="text-base font-semibold tracking-tight">Title</h1>
      <p className="text-[11px] text-muted-foreground leading-tight">Subtitle</p>
    </div>
  </div>
  <!-- Action buttons -->
</header>
```

### Pages Updated

| Page | File | Icon | Changes |
|------|------|------|---------|
| Settings | `settings.tsx` | `SettingsIcon` | `max-w-7xl mx-auto` (was `max-w-3xl`/`max-w-6xl` conditional) |
| Users | `users.tsx` | `User` | `max-w-7xl` (was `max-w-5xl`) |
| Library | `library.tsx` | `BookOpen` | Icon `w-9→w-8`, title `text-lg→text-base`, subtitle `text-xs→text-[11px]` |
| LL Estimates | `laser-estimates-list.tsx` | `FileText` | Added icon badge, `bg-background`, `<header>` tag, `sm:p-6` content padding |
| LL Pricing Profiles | `ll-pricing-profiles.tsx` | `Shield` | Non-embedded header standardized to match contract |

### Pages Already Conforming (No Changes Needed)

| Page | File | Notes |
|------|------|-------|
| LJ Estimates | `jobs-list.tsx` | Already correct |
| Projects | `projects-list.tsx` | Already correct |
| Quotes | `quotes-list.tsx` | Already correct |
| Invoices | `invoices.tsx` | Already correct |
| Customers | `customers.tsx` | Already correct |
| Contacts | `contacts.tsx` | Already correct |

---

## 3. Junk Data Cleanup

### Records Flagged as `is_demo_record = true`

| Entity | Count | Names/IDs |
|--------|-------|-----------|
| Jobs | 5 | "sdfa", "unusual test", "teste", "test test", "adfasdf" |
| Customers | 5 | "sesdset", "asdfasdf", "dfsadf", "test", "Test Customer 1773308841566" |
| Projects | 2 | "adfasdf", "test test" |
| Quotes | 6 | SE-0162-LJ, SE-0164-LJ, SE-0156-LJ, SE-0163-LJ, SE-0166-LJ, SE-0165-LJ |
| Invoices | 1 | INV-0023 |

**Method:** Direct SQL `UPDATE ... SET is_demo_record = true` via database tool. Non-privileged users cannot see records with `isDemoRecord = true` (server-side filter).

### Records Intentionally NOT Flagged

| Entity | Name | Reason |
|--------|------|--------|
| Job | Bittoo | Real customer (Facebook lead) |
| Job | Tekuramea | Real customer (Facebook marketplace) |
| Job | Fasiuddin | Real customer |
| Customer | Lino | Real customer |
| Customer | Dylan Ravarua | Real customer |
| Customer | Bittoo - Facebook | Real customer |
| Customer | Paul Melia | Real customer |
| Customer | Jane Doe | Placeholder but used in demos |
| Customer | NZ Construction Ltd | Placeholder but used in demos |
| Project | Lino | Linked to real customer |
| Project | Dilz - Window Project Test | Linked to real customer |
| Project | 23 Main St Renovation | Demo/reference project |

---

## 4. LL Process Rate Governance

### Active Profile State

- **Profile:** "Q4 Preview Rates" (ID: `9d313dcf-...`)
- **Status:** `active`
- **Process Rate Entries:** 40 (across 5 material families)

### UI Changes

| Change | Description |
|--------|-------------|
| Explicit empty state | When `processRateTables` is empty/missing, viewer now shows orange warning box explaining the profile cannot produce accurate estimates |
| Assist gas badges | Viewer table now shows `Badge` components for gas type; `compressed_air` → `Air` label |
| Gas clarification | Footer note: "Assist gas type per row determines which source gas cost is applied during pricing" |

### Archived Profiles

| Profile | Status | Process Rates |
|---------|--------|---------------|
| test1 | archived | 40 entries |
| test | archived | 40 entries |

---

## 5. Dead Code Removal

| Item | Location | Action |
|------|----------|--------|
| `LLPricingSettingsViewer` | `settings.tsx` lines 1333-1529 | Removed (was defined but never rendered since Phase 5A) |
| `page-layout.tsx` | `client/src/components/ui/page-layout.tsx` | Removed (created but never imported/adopted; standardization done inline) |

---

## 6. Boundary Verification

| Boundary | Status | Evidence |
|----------|--------|----------|
| LJ estimate logic | Preserved | No changes to `jobs-list.tsx` logic, `job-estimate.tsx`, or LJ pricing |
| LE (Engineering) | Preserved | No LE-related files modified |
| PDF generation | Preserved | No changes to PDF templates, rendering, or download flows |
| Quote numbering | Preserved | `NumberingTab` in settings unchanged; prefix/suffix logic intact |
| Invoice numbering | Preserved | No changes to invoice numbering flows |
| Job numbering | Preserved | No changes to job creation/numbering |
| Supplier governance (5C) | Preserved | `supplierName` unique index, activation SQL, filter UI all untouched |

---

## 7. Files Modified

| File | Type | Summary |
|------|------|---------|
| `client/src/pages/settings.tsx` | Modified | `max-w-7xl`, removed `LLPricingSettingsViewer` dead code (~200 lines) |
| `client/src/pages/users.tsx` | Modified | `max-w-7xl` (was `max-w-5xl`) |
| `client/src/pages/library.tsx` | Modified | Header icon/title sizing standardized |
| `client/src/pages/laser-estimates-list.tsx` | Modified | Full header restructure to match contract |
| `client/src/pages/ll-pricing-profiles.tsx` | Modified | Non-embedded header standardized; viewer explicit empty state + gas badges |
| `client/src/components/ui/page-layout.tsx` | Deleted | Unused shared layout file removed |

---

## 8. Known Open Items

| Item | Priority | Notes |
|------|----------|-------|
| O₂ J15 price discrepancy | Medium | $200 recorded vs $550 reported BOC agreement — red banner still shown |
| `compressed_air` gas label | Low | Editor shows raw badge `compressed_air`; viewer shows `Air` — consider normalizing editor too |
