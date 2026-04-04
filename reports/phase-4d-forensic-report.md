# Phase 4D — LL Commercial Inputs Governance: Forensic Report

**Date**: 4 April 2026
**Phase**: 4D — Governed Gas & Consumables Cost Inputs + Supplier Traceability

---

## 1. Objective

Implement governed gas and consumables cost inputs with:
- Supplier traceability (BOC gas agreement, Bodor invoice)
- Cost conversion/normalisation layer
- Admin UI for governance lifecycle
- Builder integration with enhanced pricing breakdown

---

## 2. Schema & Tables Created

### `ll_gas_cost_inputs`
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID PK | |
| division_key | varchar | Always "LL" |
| source_type | varchar | agreement / invoice / manual_adjustment |
| supplier_name | varchar | e.g. "BOC" |
| source_reference | varchar | e.g. "NZ11352442" |
| source_document_name | varchar | PDF filename |
| source_date | varchar | ISO date string |
| source_notes | text | |
| gas_type | varchar | oxygen / nitrogen / argon / compressed_air / co2 |
| package_type | varchar | cylinder / mcp / bulk / other |
| package_code | varchar | e.g. "100G2" |
| description | varchar | |
| delivered_price_ex_gst | numeric | $/package delivered |
| daily_service_charge_ex_gst | numeric | $/day |
| unit_capacity_value | numeric | Litres at STP |
| unit_capacity_uom | varchar | "litres" |
| usable_fraction | numeric | 0.95 = 95% usable |
| surcharge_policy_json | jsonb | Future: ETS/surcharge rules |
| derived_cost_per_litre | numeric | Server-computed: price / (capacity × fraction) |
| derived_assumptions_json | jsonb | Traceability notes |
| status | varchar | draft→approved→active→superseded→archived |
| effective_from/to | timestamp | |
| created_by/approved_by/activated_by | UUID FK | Actor tracking |
| created_at/approved_at/activated_at/updated_at | timestamp | |

**Partial unique index**: `(division_key, gas_type) WHERE status='active'` — one active input per gas type.

### `ll_consumables_cost_inputs`
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID PK | |
| division_key | varchar | Always "LL" |
| source_type | varchar | agreement / invoice / manual_adjustment |
| supplier_name | varchar | e.g. "Laser Machines Limited" |
| source_reference | varchar | e.g. "INV-0226" |
| sku | varchar | Supplier SKU |
| description | varchar | |
| machine_family/model | varchar | e.g. "Bodor" / "15KW Fiber Laser" |
| consumable_category | varchar | lens / ceramic / nozzle / filter / other |
| purchase_cost_ex_gst | numeric | Total purchase price |
| quantity_purchased | integer | Units in purchase |
| unit_cost_ex_gst | numeric | Per-unit cost |
| life_model_type | varchar | hours / pierces / metres_cut / sheets / manual |
| expected_life_value | numeric | e.g. 200 hours |
| derived_cost_per_hour | numeric | Server-computed: unitCost / expectedLife |
| derived_assumptions_json | jsonb | Traceability notes |
| status | varchar | Same lifecycle as gas inputs |

**Partial unique index**: `(division_key, sku) WHERE status='active'` — one active input per SKU.

---

## 3. API Endpoints

### Gas Cost Inputs
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /api/ll-gas-cost-inputs | Privileged | List all (admin) |
| GET | /api/ll-gas-cost-inputs/active | Authenticated | Active only (builder) |
| GET | /api/ll-gas-cost-inputs/:id | Privileged | Single record (admin) |
| POST | /api/ll-gas-cost-inputs | Privileged | Create draft |
| PATCH | /api/ll-gas-cost-inputs/:id | Privileged | Edit draft only |
| POST | /api/ll-gas-cost-inputs/:id/approve | Privileged | draft → approved |
| POST | /api/ll-gas-cost-inputs/:id/activate | Privileged | approved → active (transactional) |
| POST | /api/ll-gas-cost-inputs/:id/archive | Privileged | Archive (not active) |

### Consumables Cost Inputs
Same pattern as gas, at `/api/ll-consumables-cost-inputs/*`.

### Seed
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /api/ll-commercial-inputs/seed | Privileged | One-time seed (idempotent — returns 409 if data exists) |

---

## 4. Seed Data

### BOC Gas Agreement (NZ11352442)
- **Account**: 100593891
- **Commencement**: 31 March 2026, 1-year minimum, prices fixed 12 months
- **Oxygen G2**: $50.00/cylinder, 8,600L capacity, 95% usable → **$0.006120/L**
- **Nitrogen MP15 MCP**: $500.00/pack, ~50,000L capacity (estimate), 95% usable → **$0.010526/L**
- **Argon G**: $65.00/cylinder, 8,600L capacity, 95% usable → **$0.007956/L**

### Bodor Consumables (INV-0226)
- **Supplier**: Laser Machines Limited, 18 Aug 2025
- **Protective Lens D37-N-15KW**: $45.00/unit, 200hr life → **$0.2250/hr**
- **Ceramic KTB2 1.5-6KW**: $39.00/unit, 500hr life → **$0.0780/hr**
- **Total consumable rate**: $0.3030/hr (sum of all active consumable derived rates)

---

## 5. Cost Conversion Layer

### Gas Resolution (`ll-pricing.ts`)
1. Check governed inputs (active gas cost inputs from API) for matching gas type
2. If match found: use `derivedCostPerLitre` from governed input
3. If no match: fall back to pricing profile `gasCosts` JSON
4. Return `{ pricePerLitre, source }` for traceability

### Consumable Resolution (`ll-pricing.ts`)
1. Check governed inputs (active consumable cost inputs from API)
2. Sum all active consumable `derivedCostPerHour` values
3. If total > 0: use governed sum
4. If no governed inputs: fall back to pricing profile `consumableCosts` JSON
5. Return `{ costPerHour, source }` for traceability

### Server-Side Enforcement
- Derived costs are **recomputed server-side** on create and update
- Client-supplied `derivedCostPerLitre` / `derivedCostPerHour` values are stripped from API schemas
- Formula: gas = `price / (capacity × fraction)`, consumable = `unitCost / expectedLife`

---

## 6. Security Hardening (Post-Review)

| Issue | Fix |
|-------|-----|
| Read endpoints accessible to any authenticated user | Hardened: GET list and GET :id require `isPrivilegedUser`; only `/active` endpoint remains open for authenticated builder access |
| Client-supplied derived costs accepted | Removed from Zod schemas; server recomputes on create/update |
| Seed endpoint non-idempotent | Returns 409 if any gas or consumable records already exist |
| Transactional activation | Same pattern as pricing profiles: BEGIN/COMMIT/ROLLBACK with supersede + activate + audit |

---

## 7. Admin UI

**Route**: `/ll-commercial-inputs`
**Access**: Admin/owner users only (sidebar links gated by `canManageUsers`)

### Features
- **Gas Costs tab**: List of all gas inputs with status badges, detail panel showing supplier/source, package pricing, derived cost with assumption warnings, lifecycle dates, audit trail
- **Consumables tab**: Same pattern for consumable inputs with purchase details and life model info
- **Create dialogs**: New Gas Input / New Consumable Input with all fields, auto-derives cost on submit
- **Governance actions**: Approve, Activate, Archive with confirmation dialogs
- **Seed button**: One-time seed from BOC/Bodor (hidden when data exists)

### Sidebar Navigation
- "Pricing Profiles" link → `/ll-pricing-profiles`
- "Commercial Inputs" link → `/ll-commercial-inputs`
- Both visible only to admin/owner users

---

## 8. Builder Integration

- `laser-quote-builder.tsx` fetches active gas and consumable inputs via TanStack Query
- Passes `governedInputs` to `computeItemPricing()` → `computeLLPricing()`
- Pricing breakdown panel enhanced:
  - Gas cost line shows rate per litre when time-based
  - Consumables line shows rate per hour when time-based
  - Source badges show supplier name and reference when governed inputs are active

---

## 9. Known Assumptions / Confirm-With-Business Items

1. **N2 MCP capacity**: ~50,000L is an estimate — business must confirm with BOC
2. **O2/Ar G cylinder capacity**: 8,600L nominal — business must confirm
3. **Usable fraction**: 95% assumed (5% heel/residual) — may vary by gas type
4. **Lens life**: 200 operating hours — initial estimate, must confirm from actual replacement data
5. **Ceramic life**: 500 operating hours — initial estimate, must confirm from actual replacement data
6. **Daily service charges**: Not currently factored into derived $/litre (only delivery price is used)

---

## 10. Files Modified

| File | Changes |
|------|---------|
| `shared/schema.ts` | `llGasCostInputs` + `llConsumablesCostInputs` tables, types, insert schemas |
| `server/storage.ts` | CRUD methods for both tables |
| `server/routes.ts` | Full REST endpoints for both tables + seed endpoint |
| `client/src/lib/ll-pricing.ts` | `LLGovernedInputs` interface, governed gas/consumable resolution, source tracking |
| `client/src/pages/ll-commercial-inputs.tsx` | New admin page with tabs, detail views, create dialogs, governance actions |
| `client/src/pages/laser-quote-builder.tsx` | Governed inputs queries, pricing engine integration, source badges |
| `client/src/components/app-sidebar.tsx` | Sidebar links for Pricing Profiles + Commercial Inputs |
| `client/src/App.tsx` | Route registration for `/ll-commercial-inputs` |
