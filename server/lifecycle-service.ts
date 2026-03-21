// ─── Lifecycle Derivation Service ────────────────────────────────────────────
// Computes lifecycle state from existing system signals (quote, invoices, op-job)
// plus Phase 2 task state (per-instance task completion records).
//
// ARCHITECTURE: deriveLifecycleState accepts the template and task states as
// parameters. The caller (route) is responsible for loading both from DB.
//
// Stage derivation rules:
//   - Signal-driven stages (estimate/quote/acceptance/commercial_setup/site_measure/
//     invoicing/closeout): system signals govern status; tasks are informational.
//   - No-signal stages (procurement/manufacture/delivery_install): task completion
//     governs status when a lifecycle instance exists.
//
// Task state safety: tasks never mutate quote/invoice/opJob records.
// Historical financial records remain immutable.

import {
  ComputedLifecycleState,
  ComputedStageState,
  ComputedTaskState,
  LifecycleTemplateConfig,
  LifecycleStageTemplate,
  LifecycleTaskTemplate,
  StageStatus,
} from "@shared/lifecycle";
import { type Quote, type Invoice, type OpJob, type LifecycleInstance, type LifecycleTaskState } from "@shared/schema";

// ─── Next Action Text ─────────────────────────────────────────────────────────
function nextActionText(stageKey: string, quote: Quote): string {
  switch (stageKey) {
    case "estimate":
      return "Complete estimate and create quote";
    case "quote":
      if (quote.status === "draft") return "Finalise quote and send to client";
      if (quote.status === "review") return "Review quote internally and send to client";
      if (quote.status === "sent") return "Awaiting client review and acceptance";
      return "Review quote status";
    case "acceptance":
      return "Awaiting client acceptance";
    case "commercial_setup":
      return "Create deposit invoice and convert quote to job";
    case "site_measure":
      return "Schedule and complete site measure; finalise design";
    case "procurement":
      return "Order materials and confirm lead times with suppliers";
    case "manufacture":
      return "Begin manufacture of windows and doors";
    case "delivery_install":
      return "Schedule delivery and arrange installation";
    case "invoicing":
      return "Issue final invoice and collect payment";
    case "closeout":
      return "Close job and archive all records";
    default:
      return "Complete this stage";
  }
}

// ─── Task-Driven Stages ───────────────────────────────────────────────────────
// These stages have no system signal in Phase 1. Phase 2 task completion drives them.
const TASK_DRIVEN_STAGE_KEYS = new Set(["procurement", "manufacture", "delivery_install"]);

// ─── Compute Task States for a Stage ─────────────────────────────────────────
function computeTaskStates(
  stageDef: LifecycleStageTemplate,
  storedStates: LifecycleTaskState[],
  instanceId: string | null,
  userDisplayMap: Map<string, string>,
): { tasks: ComputedTaskState[]; requiredTasksComplete: boolean } {
  const tasks: ComputedTaskState[] = (stageDef.tasks ?? [])
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((taskDef: LifecycleTaskTemplate) => {
      const stored = storedStates.find(
        (s) => s.stageKey === stageDef.key && s.taskKey === taskDef.key,
      );
      return {
        key: taskDef.key,
        label: taskDef.label,
        description: taskDef.description,
        required: taskDef.required,
        ownerRole: taskDef.ownerRole,
        sortOrder: taskDef.sortOrder,
        completed: stored?.completed ?? false,
        completedAt: stored?.completedAt?.toISOString?.() ?? null,
        completedByUserId: stored?.completedByUserId ?? null,
        completedByName: stored?.completedByUserId
          ? (userDisplayMap.get(stored.completedByUserId) ?? null)
          : null,
        note: stored?.note ?? null,
        editable: !!instanceId,
      };
    });

  const requiredTasks = tasks.filter((t) => t.required);
  const requiredTasksComplete =
    requiredTasks.length === 0 || requiredTasks.every((t) => t.completed);

  return { tasks, requiredTasksComplete };
}

// ─── Stage Status Derivation ──────────────────────────────────────────────────
function deriveStageStatus(
  stage: LifecycleStageTemplate,
  quote: Quote,
  invoices: Invoice[],
  opJob: OpJob | null,
  computedPrev: Map<string, StageStatus>,
  taskState: { tasks: ComputedTaskState[]; requiredTasksComplete: boolean },
  hasInstance: boolean,
): {
  status: StageStatus;
  completedAt: string | null;
  sourceNote: string | null;
  blockedReason: string | null;
} {
  const { tasks, requiredTasksComplete } = taskState;

  // Helper: apply task-driven status for stages with no system signal
  function taskDrivenStatus(): {
    status: StageStatus;
    completedAt: string | null;
    sourceNote: string | null;
    blockedReason: string | null;
  } {
    if (!hasInstance) {
      return {
        status: "not_started",
        completedAt: null,
        sourceNote: "Manual tracking — available after quote acceptance",
        blockedReason: null,
      };
    }
    if (tasks.length === 0) {
      return { status: "not_started", completedAt: null, sourceNote: null, blockedReason: null };
    }
    const anyDone = tasks.some((t) => t.completed);
    if (requiredTasksComplete) {
      const lastDoneAt = tasks
        .filter((t) => t.required && t.completedAt)
        .map((t) => t.completedAt!)
        .sort()
        .pop() ?? null;
      return {
        status: "complete",
        completedAt: lastDoneAt,
        sourceNote: `${tasks.filter((t) => t.completed).length}/${tasks.length} tasks complete`,
        blockedReason: null,
      };
    }
    if (anyDone) {
      const remaining = tasks.filter((t) => t.required && !t.completed).length;
      return {
        status: "active",
        completedAt: null,
        sourceNote: `${remaining} required task${remaining !== 1 ? "s" : ""} remaining`,
        blockedReason: null,
      };
    }
    return {
      status: "not_started",
      completedAt: null,
      sourceNote: null,
      blockedReason: null,
    };
  }

  switch (stage.key) {
    case "estimate": {
      if (quote.sourceJobId) {
        return {
          status: "complete",
          completedAt: null,
          sourceNote: `Linked estimate: ${quote.sourceJobId}`,
          blockedReason: null,
        };
      }
      return {
        status: "not_applicable",
        completedAt: null,
        sourceNote: "No linked estimate — created directly",
        blockedReason: null,
      };
    }

    case "quote": {
      if (quote.status === "accepted") {
        return {
          status: "complete",
          completedAt: quote.acceptedAt?.toISOString?.() ?? null,
          sourceNote: `Quote ${quote.number} accepted`,
          blockedReason: null,
        };
      }
      if (["archived", "declined"].includes(quote.status)) {
        return {
          status: "not_applicable",
          completedAt: null,
          sourceNote: `Quote ${quote.number} is ${quote.status}`,
          blockedReason: null,
        };
      }
      return {
        status: "active",
        completedAt: null,
        sourceNote: `Quote ${quote.number} status: ${quote.status}`,
        blockedReason: null,
      };
    }

    case "acceptance": {
      if (quote.status === "accepted") {
        return {
          status: "complete",
          completedAt: quote.acceptedAt?.toISOString?.() ?? null,
          sourceNote: `Accepted${quote.acceptedAt ? " " + new Date(quote.acceptedAt).toLocaleDateString("en-NZ") : ""}`,
          blockedReason: null,
        };
      }
      if (["sent", "review"].includes(quote.status)) {
        return {
          status: "active",
          completedAt: null,
          sourceNote: "Quote issued — awaiting client acceptance",
          blockedReason: null,
        };
      }
      return { status: "not_started", completedAt: null, sourceNote: null, blockedReason: null };
    }

    case "commercial_setup": {
      if (quote.status !== "accepted") {
        return { status: "not_started", completedAt: null, sourceNote: null, blockedReason: null };
      }
      const processedInvoice = invoices.find((inv) =>
        ["approved", "pushed_to_xero_draft", "returned_to_draft"].includes(inv.status ?? ""),
      );
      if (processedInvoice) {
        return {
          status: "complete",
          completedAt: processedInvoice.createdAt?.toISOString?.() ?? null,
          sourceNote: `Deposit invoice ${processedInvoice.number} — ${processedInvoice.status}`,
          blockedReason: null,
        };
      }
      const draftInvoice = invoices.find((inv) => inv.status === "draft" || inv.status === "ready_for_xero");
      if (draftInvoice) {
        return {
          status: "active",
          completedAt: null,
          sourceNote: `Deposit invoice ${draftInvoice.number} — ${draftInvoice.status}`,
          blockedReason: null,
        };
      }
      return {
        status: "active",
        completedAt: null,
        sourceNote: "Quote accepted — deposit invoice not yet created",
        blockedReason: null,
      };
    }

    case "site_measure": {
      // If the job explicitly marks measurement as not required, skip this stage entirely
      if (opJob?.measurementRequirement === "not_required") {
        return {
          status: "not_applicable",
          completedAt: null,
          sourceNote: `Measurement not required — dimensions sourced ${opJob.dimensionSource ? `from ${opJob.dimensionSource.replace(/_/g, " ")}` : "externally"}`,
          blockedReason: null,
        };
      }

      const commercialStatus = computedPrev.get("commercial_setup");
      if (commercialStatus === "active" && !opJob) {
        return {
          status: "blocked",
          completedAt: null,
          sourceNote: "Waiting for commercial setup",
          blockedReason: "Complete commercial setup (deposit invoice) before scheduling site measure",
        };
      }
      if (!opJob) return { status: "not_started", completedAt: null, sourceNote: null, blockedReason: null };
      if (opJob.status === "completed") {
        return {
          status: "complete",
          completedAt: opJob.updatedAt?.toISOString?.() ?? null,
          sourceNote: `Job ${opJob.jobNumber} completed`,
          blockedReason: null,
        };
      }
      return {
        status: "active",
        completedAt: null,
        sourceNote: `Job ${opJob.jobNumber} active — site measure in scope`,
        blockedReason: null,
      };
    }

    // ── Task-driven stages ────────────────────────────────────────────────────
    case "procurement":
      return taskDrivenStatus();

    case "manufacture":
      return taskDrivenStatus();

    case "delivery_install":
      return taskDrivenStatus();

    case "invoicing": {
      // Pre-instance (no lifecycle assigned yet): invoice-signal only.
      if (!hasInstance) {
        if (invoices.length === 0) return { status: "not_started", completedAt: null, sourceNote: null, blockedReason: null };
        const finalised = invoices.filter((inv) =>
          ["approved", "pushed_to_xero_draft"].includes(inv.status ?? ""),
        );
        if (finalised.length > 0) {
          return {
            status: "active",
            completedAt: null,
            sourceNote: `${finalised.length} invoice(s) in Xero or approved`,
            blockedReason: null,
          };
        }
        return {
          status: "active",
          completedAt: null,
          sourceNote: `${invoices.length} invoice(s) present`,
          blockedReason: null,
        };
      }

      // Lifecycle instance exists: task-driven with invoice signals as context.
      // Required tasks: issue_final_invoice + payment_received.
      if (requiredTasksComplete && tasks.length > 0) {
        const lastDoneAt = tasks
          .filter((t) => t.required && t.completedAt)
          .map((t) => t.completedAt!)
          .sort()
          .pop() ?? null;
        return {
          status: "complete",
          completedAt: lastDoneAt,
          sourceNote: `${tasks.filter((t) => t.completed).length}/${tasks.length} invoicing tasks complete`,
          blockedReason: null,
        };
      }

      const anyTaskDone = tasks.some((t) => t.completed);
      if (anyTaskDone || invoices.length > 0) {
        const finalised = invoices.filter((inv) =>
          ["approved", "pushed_to_xero_draft"].includes(inv.status ?? ""),
        );
        const invoiceNote = finalised.length > 0
          ? `${finalised.length} invoice(s) approved or in Xero`
          : invoices.length > 0
          ? `${invoices.length} invoice(s) present`
          : null;
        const remaining = tasks.filter((t) => t.required && !t.completed).length;
        const taskNote = remaining > 0
          ? `${remaining} required task${remaining !== 1 ? "s" : ""} remaining`
          : null;
        return {
          status: "active",
          completedAt: null,
          sourceNote: [invoiceNote, taskNote].filter(Boolean).join(" — ") || null,
          blockedReason: null,
        };
      }

      return { status: "not_started", completedAt: null, sourceNote: null, blockedReason: null };
    }

    case "closeout": {
      if (opJob?.status === "completed") {
        return {
          status: "complete",
          completedAt: opJob.updatedAt?.toISOString?.() ?? null,
          sourceNote: `Job ${opJob.jobNumber} marked completed`,
          blockedReason: null,
        };
      }
      if (opJob?.status === "cancelled") {
        return {
          status: "not_applicable",
          completedAt: null,
          sourceNote: `Job ${opJob.jobNumber} was cancelled`,
          blockedReason: null,
        };
      }
      // No opJob but tasks are all done → allow task-driven closeout
      if (hasInstance && requiredTasksComplete && tasks.length > 0) {
        const lastDoneAt = tasks
          .filter((t) => t.required && t.completedAt)
          .map((t) => t.completedAt!)
          .sort()
          .pop() ?? null;
        return {
          status: "complete",
          completedAt: lastDoneAt,
          sourceNote: "Closed via task checklist",
          blockedReason: null,
        };
      }
      return { status: "not_started", completedAt: null, sourceNote: null, blockedReason: null };
    }

    default:
      return { status: "not_started", completedAt: null, sourceNote: null, blockedReason: null };
  }
}

// ─── Main Derivation Function ─────────────────────────────────────────────────
export function deriveLifecycleState(
  quote: Quote,
  invoices: Invoice[],
  opJob: OpJob | null,
  instance: LifecycleInstance | null,
  template: LifecycleTemplateConfig,
  taskStates: LifecycleTaskState[] = [],
  userDisplayMap: Map<string, string> = new Map(),
): ComputedLifecycleState {
  const divisionCode = template.divisionCode;
  const templateVersion = instance?.templateVersion ?? 1;
  const hasInstance = !!instance;

  const sortedStages = [...template.stages].sort((a, b) => a.order - b.order);
  const computedPrev = new Map<string, StageStatus>();
  const stages: ComputedStageState[] = [];

  for (const stageDef of sortedStages) {
    const taskState = computeTaskStates(stageDef, taskStates, instance?.id ?? null, userDisplayMap);
    const { status, completedAt, sourceNote, blockedReason } = deriveStageStatus(
      stageDef,
      quote,
      invoices,
      opJob,
      computedPrev,
      taskState,
      hasInstance,
    );
    computedPrev.set(stageDef.key, status);

    stages.push({
      key: stageDef.key,
      label: stageDef.label,
      masterKey: stageDef.masterKey,
      order: stageDef.order,
      ownerRole: stageDef.ownerRole,
      responsibility: stageDef.responsibility,
      description: stageDef.description,
      status,
      nextAction: status === "active" ? nextActionText(stageDef.key, quote) : null,
      blockedReason,
      completedAt,
      sourceNote,
      tasks: taskState.tasks,
      requiredTasksComplete: taskState.requiredTasksComplete,
      taskDriven: TASK_DRIVEN_STAGE_KEYS.has(stageDef.key),
    });
  }

  const currentStage = stages.find((s) => s.status === "active") ?? null;
  const blockedStage = stages.find((s) => s.status === "blocked") ?? null;

  let overallStatus: ComputedLifecycleState["overallStatus"] = "not_started";
  if (blockedStage) overallStatus = "blocked";
  else if (currentStage) overallStatus = "active";
  else if (stages.every((s) => s.status === "complete" || s.status === "not_applicable"))
    overallStatus = "complete";

  return {
    templateKey: `${divisionCode}_v${templateVersion}`,
    templateVersion,
    divisionCode,
    currentStageKey: currentStage?.key ?? null,
    stages,
    overallStatus,
    instanceId: instance?.id ?? null,
    assignedAt: instance?.assignedAt?.toISOString?.() ?? null,
  };
}
