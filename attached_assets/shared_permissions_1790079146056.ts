// shared/permissions.ts
//
// SteelIQ RBAC — central permission matrix. Single source of truth for who can do
// what. server/authorize.ts enforces this on every request. The client may use it
// to hide/show UI, but the server check is what actually protects data — never
// trust a client-side check alone.
//
// Destination in the repo: shared/permissions.ts (new file, alongside schema.ts)

export const ROLES = [
  "owner",            // Director — full access, every division
  "admin",            // Same access as owner today; kept distinct in case that changes later
  "qs",               // Quantity Surveyor — estimates, quotes, customers/projects
  "project_manager",  // Projects, jobs, customer-facing coordination
  "workshop_manager", // Production/job status, no pricing
  "site_supervisor",  // Field/mobile — assigned jobs, photos, no pricing
  "client",           // Client portal (not yet built) — view-only, own records only
] as const;

export type Role = (typeof ROLES)[number];

// shared/schema.ts's USER_ROLES already defines SIX values today:
// "owner", "admin", "estimator", "finance", "production", "viewer" — and
// "finance"/"production" are live values used as lifecycle-task owners in
// server/lifecycle-templates.ts, not unused options.
//
// No route currently checks anything beyond admin/owner, so "estimator",
// "finance", "production", and "viewer" all have IDENTICAL real access today.
// Alias all four to "qs" so this phase changes nothing about their access —
// deciding real distinct permissions for finance/production/viewer is a
// separate, explicit follow-up phase, not something to assume here.
const ROLE_ALIASES: Record<string, Role> = {
  estimator: "qs",
  finance: "qs",
  production: "qs",
  viewer: "qs",
};

export function normalizeRole(role: string | null | undefined): Role {
  if (!role) return "client"; // no role on record -> most restrictive, never most permissive
  if ((ROLES as readonly string[]).includes(role)) return role as Role;
  return ROLE_ALIASES[role] ?? "client";
}

export const RESOURCES = [
  "estimates",          // LJ + LL estimates/quotes, including pricing and margin
  "invoices",
  "customers_projects",
  "jobs_production",
  "library_pricing",    // master library, pricing profiles, source costs
  "settings_users",     // org/division settings, user management
  "site_capture",       // photos, site-visit data entry
] as const;

export type Resource = (typeof RESOURCES)[number];

// "full" implies edit; "edit" implies view. A role with no entry for a resource
// has no access to it at all.
export type Action = "view" | "edit" | "full";

const MATRIX: Record<Role, Partial<Record<Resource, Action>>> = {
  owner: {
    estimates: "full", invoices: "full", customers_projects: "full",
    jobs_production: "full", library_pricing: "full", settings_users: "full",
    site_capture: "full",
  },
  admin: {
    estimates: "full", invoices: "full", customers_projects: "full",
    jobs_production: "full", library_pricing: "full", settings_users: "full",
    site_capture: "full",
  },
  qs: {
    estimates: "full", invoices: "view", customers_projects: "edit",
    jobs_production: "view", library_pricing: "view", site_capture: "view",
  },
  project_manager: {
    estimates: "view", invoices: "view", customers_projects: "full",
    jobs_production: "full", site_capture: "view",
  },
  workshop_manager: {
    jobs_production: "full", site_capture: "view",
  },
  site_supervisor: {
    jobs_production: "edit", site_capture: "edit",
  },
  client: {
    estimates: "view", invoices: "view", // further scoped to *their own* records only —
    // enforced in the query layer (WHERE customerId = req.user's linked customer),
    // this matrix only says the resource type is reachable at all
  },
};

const LEVEL_RANK: Record<Action, number> = { view: 1, edit: 2, full: 3 };

export function can(
  role: string | null | undefined,
  resource: Resource,
  required: Action = "view"
): boolean {
  const granted = MATRIX[normalizeRole(role)]?.[resource];
  if (!granted) return false;
  return LEVEL_RANK[granted] >= LEVEL_RANK[required];
}

// Roles that must never receive cost/margin/internal-pricing detail in a response
// payload, even for a resource they can otherwise "view". Enforce by stripping
// those fields server-side before responding — do not rely on the client to hide them.
export const HIDES_FINANCIALS: Role[] = ["workshop_manager", "site_supervisor", "client"];

export function canSeeFinancials(role: string | null | undefined): boolean {
  return !HIDES_FINANCIALS.includes(normalizeRole(role));
}
