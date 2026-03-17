// ─── Lifecycle Derivation Service ────────────────────────────────────────────
// Computes lifecycle state from existing system signals (quote, invoices, op-job).
// No stored stage-state — everything is derived at read time.
// This keeps historical records immutable and lifecycle visible immediately.

import {
  ComputedLifecycleState,
  ComputedStageState,
  LifecycleTemplateConfig,
  LifecycleStageTemplate,
  StageStatus,
} from "@shared/lifecycle";
import { type Quote, type Invoice, type OpJob, type LifecycleInstance } from "@shared/schema";
import { LJ_LIFECYCLE_TEMPLATE_V1 } from "./lifecycle-templates";

// ─── Template Registry ────────────────────────────────────────────────────────
// Phase 1: LJ only. Future divisions added here when their templates exist.
function getTemplateForDivision(divisionCode: string): LifecycleTemplateConfig | null {
  if (divisionCode === "LJ") return LJ_LIFECYCLE_TEMPLATE_V1;
  return null;
}

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
function deriveStageStatus(
  stage: LifecycleStageTemplate,
  quote: Quote,
  invoices: Invoice[],
  opJob: OpJob | null,
): {
  status: StageStatus;
  completedAt: string | null;
  sourceNote: string | null;
} {
  switch (stage.key) {
    case "estimate": {
      if (quote.sourceJobId) {
        return {
          status: "complete",
          completedAt: null,
          sourceNote: `Linked estimate: ${quote.sourceJobId}`,
        };
      }
      // Quote exists without a linked estimate — estimate stage N/A or implicitly done
      return {
        status: "not_applicable",
        completedAt: null,
        sourceNote: "No linked estimate — created directly",
      };
    }

    case "quote": {
      if (quote.status === "accepted") {
        return {
          status: "complete",
          completedAt: quote.acceptedAt?.toISOString?.() ?? null,
          sourceNote: `Quote ${quote.number} accepted`,
        };
      }
      if (["archived", "declined"].includes(quote.status)) {
        return {
          status: "not_applicable",
          completedAt: null,
          sourceNote: `Quote ${quote.number} is ${quote.status}`,
        };
      }
      // draft, review, sent → active
      return {
        status: "active",
        completedAt: null,
        sourceNote: `Quote ${quote.number} status: ${quote.status}`,
      };
    }

    case "acceptance": {
      if (quote.status === "accepted") {
        return {
          status: "complete",
          completedAt: quote.acceptedAt?.toISOString?.() ?? null,
          sourceNote: `Accepted${quote.acceptedAt ? " " + new Date(quote.acceptedAt).toLocaleDateString("en-NZ") : ""}`,
        };
      }
      if (["sent", "review"].includes(quote.status)) {
        return {
          status: "active",
          completedAt: null,
          sourceNote: "Quote issued — awaiting client acceptance",
        };
      }
      return { status: "not_started", completedAt: null, sourceNote: null };
    }

    case "commercial_setup": {
      if (quote.status !== "accepted") {
        return { status: "not_started", completedAt: null, sourceNote: null };
      }
      // Check if deposit invoice is in a processed state
      const processedInvoice = invoices.find((inv) =>
        ["approved", "pushed_to_xero_draft", "returned_to_draft"].includes(inv.status ?? ""),
      );
      if (processedInvoice) {
        return {
          status: "complete",
          completedAt: processedInvoice.createdAt?.toISOString?.() ?? null,
          sourceNote: `Deposit invoice ${processedInvoice.number} — ${processedInvoice.status}`,
        };
      }
      // Draft deposit invoice exists — in progress
      const draftInvoice = invoices.find((inv) => inv.status === "draft" || inv.status === "ready_for_xero");
      if (draftInvoice) {
        return {
          status: "active",
          completedAt: null,
          sourceNote: `Deposit invoice ${draftInvoice.number} — ${draftInvoice.status}`,
        };
      }
      // Accepted but no invoice yet — needs commercial setup
      return {
        status: "active",
        completedAt: null,
        sourceNote: "Quote accepted — deposit invoice not yet created",
      };
    }

    case "site_measure": {
      if (!opJob) return { status: "not_started", completedAt: null, sourceNote: null };
      if (opJob.status === "completed") {
        return {
          status: "complete",
          completedAt: opJob.updatedAt?.toISOString?.() ?? null,
          sourceNote: `Job ${opJob.jobNumber} completed`,
        };
      }
      return {
        status: "active",
        completedAt: null,
        sourceNote: `Job ${opJob.jobNumber} active — site measure in scope`,
      };
    }

    // Procurement, Manufacture — no system signals yet; remain not_started
    case "procurement":
    case "manufacture":
      return { status: "not_started", completedAt: null, sourceNote: "No system signal available — set manually in a future phase" };

    case "delivery_install":
      return { status: "not_started", completedAt: null, sourceNote: "No system signal available — set manually in a future phase" };

    case "invoicing": {
      if (invoices.length === 0) return { status: "not_started", completedAt: null, sourceNote: null };
      const finalised = invoices.filter((inv) =>
        ["approved", "pushed_to_xero_draft"].includes(inv.status ?? ""),
      );
      if (finalised.length > 0) {
        return {
          status: "active",
          completedAt: null,
          sourceNote: `${finalised.length} invoice(s) in Xero or approved`,
        };
      }
      return {
        status: "active",
        completedAt: null,
        sourceNote: `${invoices.length} invoice(s) present`,
      };
    }

    case "closeout": {
      if (opJob?.status === "completed") {
        return {
          status: "complete",
          completedAt: opJob.updatedAt?.toISOString?.() ?? null,
          sourceNote: `Job ${opJob.jobNumber} marked completed`,
        };
      }
      if (opJob?.status === "cancelled") {
        return {
          status: "not_applicable",
          completedAt: null,
          sourceNote: `Job ${opJob.jobNumber} was cancelled`,
        };
      }
      return { status: "not_started", completedAt: null, sourceNote: null };
    }

    default:
      return { status: "not_started", completedAt: null, sourceNote: null };
  }
}

// ─── Main Derivation Function ─────────────────────────────────────────────────
export function deriveLifecycleState(
  quote: Quote,
  invoices: Invoice[],
  opJob: OpJob | null,
  instance: LifecycleInstance | null,
): ComputedLifecycleState | null {
  const divisionCode = quote.divisionId ?? "LJ";
  const template = getTemplateForDivision(divisionCode);

  if (!template) {
    // No lifecycle template for this division yet
    return null;
  }

  const templateVersion = instance?.templateVersion ?? 1;

  const stages: ComputedStageState[] = template.stages.map((stageDef) => {
    const { status, completedAt, sourceNote } = deriveStageStatus(
      stageDef,
      quote,
      invoices,
      opJob,
    );

    const isActive = status === "active";

    return {
      key: stageDef.key,
      label: stageDef.label,
      masterKey: stageDef.masterKey,
      order: stageDef.order,
      ownerRole: stageDef.ownerRole,
      responsibility: stageDef.responsibility,
      description: stageDef.description,
      status,
      nextAction: isActive ? nextActionText(stageDef.key, quote) : null,
      blockedReason: null,
      completedAt,
      sourceNote,
    };
  });

  // Determine current active stage (first active stage in order)
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
