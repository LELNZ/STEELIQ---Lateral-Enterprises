// ─── SteelIQ Global Lifecycle Framework ─────────────────────────────────────
// Phase 1 — Foundation types shared between server and client.
// This is the single shared type surface for the global lifecycle engine.
// Division-specific templates are layered on top of this structure.

// ─── Master Stage Keys ───────────────────────────────────────────────────────
// The canonical shared manufacturing master workflow.
// Division templates map their stage keys to one of these master keys.
export const MASTER_STAGE_KEYS = [
  "ESTIMATE",
  "QUOTE",
  "ACCEPTANCE",
  "COMMERCIAL_SETUP",
  "DESIGN_REVIEW",
  "PROCUREMENT",
  "PRODUCTION_PLANNING",
  "MANUFACTURE",
  "QA_COMPLIANCE",
  "DISPATCH",
  "INVOICING",
  "CLOSEOUT",
] as const;

export type MasterStageKey = typeof MASTER_STAGE_KEYS[number];

// ─── Status / Classification Types ───────────────────────────────────────────
export type StageStatus =
  | "not_started"
  | "active"
  | "blocked"
  | "complete"
  | "not_applicable";

export type ResponsibilityType = "internal" | "client" | "external";

export type OwnerRole =
  | "estimator"
  | "admin"
  | "finance"
  | "production"
  | "project_manager"
  | "viewer";

// ─── Template-Level Types ─────────────────────────────────────────────────────
// Stored in the DB as lifecycleTemplates.templateJson.
// Phase 1: tasks within a stage are not modelled (Phase 2+).
export interface LifecycleStageTemplate {
  key: string;            // division-specific stage key (e.g. "site_measure")
  label: string;          // display label shown in UI
  masterKey: MasterStageKey;  // maps to shared master workflow
  order: number;          // sort order within template
  ownerRole: OwnerRole;
  responsibility: ResponsibilityType;
  description: string;    // what this stage covers
}

export interface LifecycleTemplateConfig {
  divisionCode: string;
  name: string;
  stages: LifecycleStageTemplate[];
}

// ─── Computed / Derived Types (returned by API) ───────────────────────────────
// These are computed at request time from existing system signals.
// They are NEVER stored — only the template assignment (lifecycleInstance) is stored.
export interface ComputedStageState {
  key: string;
  label: string;
  masterKey: MasterStageKey;
  order: number;
  ownerRole: OwnerRole;
  responsibility: ResponsibilityType;
  description: string;
  status: StageStatus;
  nextAction: string | null;
  blockedReason: string | null;
  completedAt: string | null;   // ISO8601 if known from existing system signal
  sourceNote: string | null;    // what system signal drove this state (for transparency)
}

export interface ComputedLifecycleState {
  templateKey: string;       // divisionCode + version identifier
  templateVersion: number;
  divisionCode: string;
  currentStageKey: string | null;
  stages: ComputedStageState[];
  overallStatus: "active" | "complete" | "blocked" | "not_started";
  instanceId: string | null;   // null before quote acceptance (template not yet assigned)
  assignedAt: string | null;   // when template version was locked to this quote
}
