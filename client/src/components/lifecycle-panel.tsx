import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  ChevronRight,
  Clock,
  User,
  Users,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { ComputedLifecycleState, ComputedStageState, StageStatus, ResponsibilityType, OwnerRole } from "@shared/lifecycle";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusIcon(status: StageStatus) {
  switch (status) {
    case "complete":
      return <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />;
    case "active":
      return <Circle className="h-4 w-4 text-blue-600 fill-blue-600 shrink-0" />;
    case "blocked":
      return <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />;
    case "not_applicable":
      return <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground/30 shrink-0" />;
  }
}

function statusBadge(status: StageStatus) {
  switch (status) {
    case "complete":
      return (
        <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 text-xs font-normal px-1.5 py-0">
          Complete
        </Badge>
      );
    case "active":
      return (
        <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-50 dark:bg-blue-950/30 text-xs font-normal px-1.5 py-0">
          Active
        </Badge>
      );
    case "blocked":
      return (
        <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-xs font-normal px-1.5 py-0">
          Blocked
        </Badge>
      );
    case "not_applicable":
      return (
        <Badge variant="outline" className="text-muted-foreground border-border text-xs font-normal px-1.5 py-0">
          N/A
        </Badge>
      );
    default:
      return null;
  }
}

const RESPONSIBILITY_LABELS: Record<ResponsibilityType, string> = {
  internal: "Internal",
  client: "Client",
  external: "External",
};

const OWNER_ROLE_LABELS: Record<OwnerRole, string> = {
  estimator: "Estimator",
  admin: "Admin",
  finance: "Finance",
  production: "Production",
  project_manager: "Project Manager",
  viewer: "Viewer",
};

function responsibilityIcon(type: ResponsibilityType) {
  switch (type) {
    case "client":
      return <ExternalLink className="h-3 w-3" />;
    case "external":
      return <Users className="h-3 w-3" />;
    default:
      return <User className="h-3 w-3" />;
  }
}

// ─── Stage Row ────────────────────────────────────────────────────────────────

function StageRow({ stage, isLast }: { stage: ComputedStageState; isLast: boolean }) {
  const isActive = stage.status === "active";
  const isComplete = stage.status === "complete";
  const isNA = stage.status === "not_applicable";
  const isNotStarted = stage.status === "not_started";

  return (
    <div
      data-testid={`lifecycle-stage-${stage.key}`}
      className={[
        "flex gap-3 py-2.5 px-3 rounded-md transition-colors",
        isActive ? "bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30" : "",
        isNA || isNotStarted ? "opacity-50" : "",
      ].join(" ")}
    >
      {/* Left — status icon + vertical connector */}
      <div className="flex flex-col items-center gap-0.5 pt-0.5">
        {statusIcon(stage.status)}
        {!isLast && (
          <div className={[
            "w-px flex-1 min-h-[12px]",
            isComplete ? "bg-emerald-300 dark:bg-emerald-700" : "bg-border",
          ].join(" ")} />
        )}
      </div>

      {/* Right — content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span
            data-testid={`lifecycle-stage-label-${stage.key}`}
            className={[
              "text-sm font-medium leading-snug",
              isActive ? "text-blue-800 dark:text-blue-200" : "",
              isComplete ? "text-emerald-800 dark:text-emerald-200" : "",
              isNA || isNotStarted ? "text-muted-foreground" : "text-foreground",
            ].join(" ")}
          >
            {stage.label}
          </span>
          {statusBadge(stage.status)}
        </div>

        {/* Meta row — owner role + responsibility */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {OWNER_ROLE_LABELS[stage.ownerRole] ?? stage.ownerRole}
          </span>
          <span className="flex items-center gap-1">
            {responsibilityIcon(stage.responsibility)}
            {RESPONSIBILITY_LABELS[stage.responsibility] ?? stage.responsibility}
          </span>
        </div>

        {/* Next action — shown only for active stage */}
        {isActive && stage.nextAction && (
          <div
            data-testid={`lifecycle-next-action-${stage.key}`}
            className="flex items-start gap-1 mt-1 text-xs text-blue-700 dark:text-blue-300"
          >
            <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{stage.nextAction}</span>
          </div>
        )}

        {/* Blocked reason */}
        {stage.status === "blocked" && stage.blockedReason && (
          <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            {stage.blockedReason}
          </div>
        )}

        {/* Source note — subtle context for non-not-started stages */}
        {stage.sourceNote && !isNotStarted && (
          <div className="text-xs text-muted-foreground/60 italic mt-0.5">
            {stage.sourceNote}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Overall Status Header ────────────────────────────────────────────────────

function OverallStatusBadge({ status }: { status: ComputedLifecycleState["overallStatus"] }) {
  switch (status) {
    case "complete":
      return (
        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-0">
          Complete
        </Badge>
      );
    case "active":
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-0">
          In Progress
        </Badge>
      );
    case "blocked":
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-0">
          Blocked
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          Not Started
        </Badge>
      );
  }
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface LifecyclePanelProps {
  quoteId?: string;
  jobId?: string;
}

export default function LifecyclePanel({ quoteId, jobId }: LifecyclePanelProps) {
  const endpoint = jobId
    ? `/api/op-jobs/${jobId}/lifecycle`
    : quoteId
    ? `/api/quotes/${quoteId}/lifecycle`
    : null;

  const { data: lifecycle, isLoading, isError, error } = useQuery<ComputedLifecycleState>({
    queryKey: endpoint ? [endpoint] : ["lifecycle-none"],
    enabled: !!endpoint,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  if (!endpoint) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading lifecycle…
      </div>
    );
  }

  if (isError) {
    const errMsg = (error as any)?.message ?? "Could not load lifecycle";
    // 404 = no template for this division — silent empty state
    if (errMsg?.includes("No lifecycle template")) return null;
    return (
      <div className="text-sm text-muted-foreground italic px-1 py-2">
        Lifecycle not available for this record.
      </div>
    );
  }

  if (!lifecycle) return null;

  const currentStage = lifecycle.stages.find((s) => s.key === lifecycle.currentStageKey);
  const completedCount = lifecycle.stages.filter((s) => s.status === "complete").length;
  const totalCount = lifecycle.stages.filter((s) => s.status !== "not_applicable").length;

  return (
    <div data-testid="lifecycle-panel" className="space-y-3">
      {/* Panel Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Lifecycle</span>
          <span className="text-xs text-muted-foreground">
            v{lifecycle.templateVersion} · {lifecycle.divisionCode}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground" data-testid="lifecycle-progress">
            {completedCount}/{totalCount} stages
          </span>
          <OverallStatusBadge status={lifecycle.overallStatus} />
        </div>
      </div>

      {/* Current stage summary (shown when there's an active stage) */}
      {currentStage && (
        <div
          data-testid="lifecycle-current-stage-summary"
          className="flex items-center gap-2 text-sm rounded-md bg-muted/50 px-3 py-2"
        >
          <ChevronRight className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="text-muted-foreground">Current stage:</span>
          <span className="font-medium text-foreground">{currentStage.label}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground capitalize">{RESPONSIBILITY_LABELS[currentStage.responsibility]}</span>
        </div>
      )}

      <Separator />

      {/* Stage list */}
      <div className="space-y-0">
        {lifecycle.stages.map((stage, idx) => (
          <StageRow
            key={stage.key}
            stage={stage}
            isLast={idx === lifecycle.stages.length - 1}
          />
        ))}
      </div>

      {/* Footer — template assignment info */}
      {lifecycle.assignedAt && (
        <div className="text-xs text-muted-foreground/60 pt-1 border-t border-border/50">
          Template assigned{" "}
          {new Date(lifecycle.assignedAt).toLocaleDateString("en-NZ", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
          {" · "}Template: {lifecycle.divisionCode} v{lifecycle.templateVersion}
        </div>
      )}
    </div>
  );
}
