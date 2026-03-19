// ─── SteelIQ Global Lifecycle Framework ─────────────────────────────────────
// Phase 1 — Foundation types shared between server and client.
// Phase 2 — Adds template-defined stage tasks and per-instance task state.
// This is the single shared type surface for the global lifecycle engine.
// Division-specific templates are layered on top of this structure.

// ─── Master Stage Keys ───────────────────────────────────────────────────────
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

// ─── Phase 2: Task Template Types ────────────────────────────────────────────
// Tasks are template-defined operational checkpoints within a stage.
// Task definitions belong to the template; task COMPLETION STATE belongs to
// the lifecycle instance (stored in lifecycleTaskStates table).
export interface LifecycleTaskTemplate {
  key: string;           // stable identifier within the stage (e.g. "order_frames")
  label: string;         // display label
  description?: string;  // optional help text shown on hover/expand
  required: boolean;     // required tasks gate stage completion for no-signal stages
  ownerRole?: OwnerRole; // override stage-level owner if different
  sortOrder: number;
}

// ─── Template-Level Types ─────────────────────────────────────────────────────
// Stored in the DB as lifecycleTemplates.templateJson.
export interface LifecycleStageTemplate {
  key: string;            // division-specific stage key (e.g. "site_measure")
  label: string;          // display label shown in UI
  masterKey: MasterStageKey;
  order: number;
  ownerRole: OwnerRole;
  responsibility: ResponsibilityType;
  description: string;
  tasks?: LifecycleTaskTemplate[];  // Phase 2: optional checklist items for this stage
}

export interface LifecycleTemplateConfig {
  divisionCode: string;
  name: string;
  stages: LifecycleStageTemplate[];
}

// ─── Phase 2: Computed Task State ────────────────────────────────────────────
// Merged from template definition + stored completion state (if instance exists).
export interface ComputedTaskState {
  key: string;
  label: string;
  description?: string;
  required: boolean;
  ownerRole?: OwnerRole;
  sortOrder: number;
  completed: boolean;
  completedAt: string | null;       // ISO8601
  completedByUserId: string | null;
  completedByName: string | null;   // display name if available
  note: string | null;
  editable: boolean;                // false when no lifecycle instance exists (pre-acceptance)
}

// ─── Computed / Derived Types (returned by API) ───────────────────────────────
// Computed at request time from existing system signals + task state.
// NEVER stored — only the template assignment (lifecycleInstance) is stored.
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
  completedAt: string | null;
  sourceNote: string | null;
  tasks: ComputedTaskState[];           // Phase 2: empty array if stage has no tasks
  requiredTasksComplete: boolean;       // Phase 2: true when all required tasks are done
  taskDriven: boolean;                  // Phase 2: true for stages with no system signal
}

export interface ComputedLifecycleState {
  templateKey: string;
  templateVersion: number;
  divisionCode: string;
  currentStageKey: string | null;
  stages: ComputedStageState[];
  overallStatus: "active" | "complete" | "blocked" | "not_started";
  instanceId: string | null;
  assignedAt: string | null;
}
