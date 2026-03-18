// ─── Lifecycle Derivation Service ────────────────────────────────────────────
// Computes lifecycle state from existing system signals (quote, invoices, op-job).
// No stored stage-state — everything is derived at read time.
// This keeps historical records immutable and lifecycle visible immediately.
//
// ARCHITECTURE: deriveLifecycleState accepts the template as a parameter.
// The caller (route) is responsible for loading the correct template from DB:
//   - Pre-acceptance: active template for the quote's division
//   - Post-acceptance: the specific template locked to the lifecycle instance
// This ensures template versioning is materially real, not just schema-declared.

import {
  ComputedLifecycleState,
  ComputedStageState,
  LifecycleTemplateConfig,
  LifecycleStageTemplate,
  StageStatus,
} from "@shared/lifecycle";
import { type Quote, type Invoice, type OpJob, type LifecycleInstance } from "@shared/schema";

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

// ─── Stage Derivation ─────────────────────────────────────────────────────────
// computedPrev: map of already-derived stage statuses (for dependency checks)
function deriveStageStatus(
  stage: LifecycleStageTemplate,
  quote: Quote,
  invoices: Invoice[],
  opJob: OpJob | null,
  computedPrev: Map<string, StageStatus>,
): {
  status: StageStatus;
  completedAt: string | null;
  sourceNote: string | null;
  blockedReason: string | null;
} {
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
      // Blocked if commercial_setup is still active (deposit invoice not processed)
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

    case "procurement":
      return {
        status: "not_started",
        completedAt: null,
        sourceNote: "No system signal available — manual tracking in a future phase",
        blockedReason: null,
      };

    case "manufacture":
      return {
        status: "not_started",
        completedAt: null,
        sourceNote: "No system signal available — manual tracking in a future phase",
        blockedReason: null,
      };

    case "delivery_install":
      return {
        status: "not_started",
        completedAt: null,
        sourceNote: "No system signal available — manual tracking in a future phase",
        blockedReason: null,
      };

    case "invoicing": {
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
      return { status: "not_started", completedAt: null, sourceNote: null, blockedReason: null };
    }

    default:
      return { status: "not_started", completedAt: null, sourceNote: null, blockedReason: null };
  }
}

// ─── Main Derivation Function ─────────────────────────────────────────────────
// template: the LifecycleTemplateConfig to derive from.
//   - Pre-acceptance: caller passes the active template for the division (DB-loaded).
//   - Post-acceptance: caller passes the template locked to the instance (by instance.templateId).
// This makes template versioning materially real: if the template changes after acceptance,
// the locked instance continues to show the original stage structure.
export function deriveLifecycleState(
  quote: Quote,
  invoices: Invoice[],
  opJob: OpJob | null,
  instance: LifecycleInstance | null,
  template: LifecycleTemplateConfig,
): ComputedLifecycleState {
  const divisionCode = template.divisionCode;
  const templateVersion = instance?.templateVersion ?? template.stages.length > 0 ? (instance?.templateVersion ?? 1) : 1;

  // Derive stages in sort order, carrying forward computed statuses for dependency checks
  const sortedStages = [...template.stages].sort((a, b) => a.order - b.order);
  const computedPrev = new Map<string, StageStatus>();
  const stages: ComputedStageState[] = [];

  for (const stageDef of sortedStages) {
    const { status, completedAt, sourceNote, blockedReason } = deriveStageStatus(
      stageDef,
      quote,
      invoices,
      opJob,
      computedPrev,
    );
    computedPrev.set(stageDef.key, status);

    const isActive = status === "active";

    stages.push({
      key: stageDef.key,
      label: stageDef.label,
      masterKey: stageDef.masterKey,
      order: stageDef.order,
      ownerRole: stageDef.ownerRole,
      responsibility: stageDef.responsibility,
      description: stageDef.description,
      status,
      nextAction: isActive ? nextActionText(stageDef.key, quote) : null,
      blockedReason,
      completedAt,
      sourceNote,
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
