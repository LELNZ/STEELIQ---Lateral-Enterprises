import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Clock,
  User,
  Users,
  ExternalLink,
  Loader2,
  Square,
  CheckSquare,
  Lock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type {
  ComputedLifecycleState,
  ComputedStageState,
  ComputedTaskState,
  StageStatus,
  ResponsibilityType,
  OwnerRole,
} from "@shared/lifecycle";

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
      return <Circle className="h-4 w-4 text-muted-foreground/30 shrink-0" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground/25 shrink-0" />;
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

function formatCompletedAt(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: ComputedTaskState;
  stageKey: string;
  instanceId: string;
  pendingKey: string | null;
  onToggle: (stageKey: string, taskKey: string, completed: boolean) => void;
  previewMode?: boolean;
}

function TaskRow({ task, stageKey, instanceId: _instanceId, pendingKey, onToggle, previewMode = false }: TaskRowProps) {
  const isPending = pendingKey === `${stageKey}:${task.key}`;
  const isDisabled = !task.editable || isPending;

  return (
    <div
      data-testid={`lifecycle-task-${stageKey}-${task.key}`}
      className={[
        "flex items-start gap-2.5 py-1.5 px-1 rounded transition-colors",
        task.editable && !isPending ? "hover:bg-muted/40 cursor-pointer" : "cursor-default",
        task.completed ? "opacity-80" : "",
      ].join(" ")}
      onClick={() => {
        if (!isDisabled) onToggle(stageKey, task.key, !task.completed);
      }}
    >
      {/* Checkbox icon */}
      <div className="mt-0.5 shrink-0">
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : !task.editable ? (
          task.completed
            ? <CheckSquare className="h-4 w-4 text-muted-foreground/40" />
            : <Square className="h-4 w-4 text-muted-foreground/25" />
        ) : task.completed ? (
          <CheckSquare className="h-4 w-4 text-emerald-600" />
        ) : (
          <Square className="h-4 w-4 text-muted-foreground/50" />
        )}
      </div>

      {/* Task content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={[
            "text-xs leading-snug",
            task.completed ? "line-through text-muted-foreground" : "text-foreground",
          ].join(" ")}>
            {task.label}
          </span>
          {task.required && (
            <span className={[
              "text-[10px] font-medium shrink-0",
              previewMode
                ? "text-muted-foreground/40"
                : "text-rose-600 dark:text-rose-400",
            ].join(" ")}>
              Required
            </span>
          )}
          {task.ownerRole && (
            <span className="text-[10px] text-muted-foreground/60 shrink-0">
              · {OWNER_ROLE_LABELS[task.ownerRole] ?? task.ownerRole}
            </span>
          )}
        </div>

        {/* Completion attribution */}
        {task.completed && (task.completedAt || task.completedByName) && (
          <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground/70">
            <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
            {task.completedByName && <span>{task.completedByName}</span>}
            {task.completedAt && <span>· {formatCompletedAt(task.completedAt)}</span>}
          </div>
        )}

        {/* Description tooltip-style help text */}
        {task.description && !task.completed && (
          <div className="text-[10px] text-muted-foreground/50 mt-0.5 italic">{task.description}</div>
        )}
      </div>
    </div>
  );
}

// ─── Task Checklist ───────────────────────────────────────────────────────────

interface TaskChecklistProps {
  stage: ComputedStageState;
  instanceId: string | null;
  pendingKey: string | null;
  onToggle: (stageKey: string, taskKey: string, completed: boolean) => void;
}

function TaskChecklist({ stage, instanceId, pendingKey, onToggle }: TaskChecklistProps) {
  const tasks = stage.tasks;
  if (tasks.length === 0) return null;

  const requiredTasks = tasks.filter((t) => t.required);
  const completedRequired = requiredTasks.filter((t) => t.completed).length;
  const totalRequired = requiredTasks.length;
  const allRequired = totalRequired > 0 && completedRequired === totalRequired;
  const hasInstance = !!instanceId;

  return (
    <div className="mt-1.5 ml-1 border-l-2 border-border/60 pl-3 space-y-0">
      {/* Pre-acceptance read-only notice */}
      {!hasInstance && (
        <div className="flex items-center gap-1.5 py-1 text-[10px] text-muted-foreground/60 italic">
          <Lock className="h-3 w-3 shrink-0" />
          Tasks become active when this quote is accepted
        </div>
      )}

      {/* Task rows */}
      {tasks.map((task) => (
        <TaskRow
          key={task.key}
          task={task}
          stageKey={stage.key}
          instanceId={instanceId ?? ""}
          pendingKey={pendingKey}
          onToggle={onToggle}
          previewMode={!hasInstance}
        />
      ))}

      {/* Progress summary for task-driven stages */}
      {stage.taskDriven && totalRequired > 0 && (
        <div className={[
          "flex items-center gap-1.5 pt-1.5 pb-0.5 text-[10px]",
          allRequired ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
        ].join(" ")}>
          <div className="flex-1 h-0.5 rounded-full bg-border overflow-hidden">
            <div
              className={[
                "h-full rounded-full transition-all",
                allRequired ? "bg-emerald-500" : "bg-blue-400",
              ].join(" ")}
              style={{ width: `${totalRequired > 0 ? (completedRequired / totalRequired) * 100 : 0}%` }}
            />
          </div>
          <span className="shrink-0 tabular-nums">
            {completedRequired}/{totalRequired} required
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Stage Row ────────────────────────────────────────────────────────────────

interface StageRowProps {
  stage: ComputedStageState;
  isLast: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  instanceId: string | null;
  pendingKey: string | null;
  onToggleTask: (stageKey: string, taskKey: string, completed: boolean) => void;
  previewMode?: boolean;
}

function StageRow({ stage, isLast, isExpanded, onToggleExpand, instanceId, pendingKey, onToggleTask, previewMode = false }: StageRowProps) {
  const isActive = !previewMode && stage.status === "active";
  const isComplete = !previewMode && stage.status === "complete";
  const isNA = !previewMode && stage.status === "not_applicable";
  const isNotStarted = !previewMode && stage.status === "not_started";
  const isBlocked = !previewMode && stage.status === "blocked";
  const hasTasks = stage.tasks.length > 0;

  return (
    <div
      data-testid={`lifecycle-stage-${stage.key}`}
      className={[
        "rounded-md transition-colors",
        previewMode ? "border border-dashed border-border/60 opacity-70" : "",
        !previewMode && isActive ? "bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30" : "",
        !previewMode && isBlocked ? "bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30" : "",
        !previewMode && (isNA || isNotStarted) ? "opacity-50" : "",
      ].join(" ")}
    >
      {/* Stage header — only this div toggles expand; task body is outside */}
      <div
        className={[
          "flex gap-3 py-2.5 px-3",
          hasTasks ? "cursor-pointer select-none" : "",
        ].join(" ")}
        onClick={hasTasks ? onToggleExpand : undefined}
      >
        {/* Left — status icon */}
        <div className="flex flex-col items-center gap-0.5 pt-0.5">
          {statusIcon(stage.status)}
          {!isLast && !isExpanded && (
            <div className={[
              "w-px flex-1 min-h-[12px]",
              isComplete ? "bg-emerald-300 dark:bg-emerald-700" : "bg-border",
            ].join(" ")} />
          )}
        </div>

        {/* Right — label and meta */}
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                data-testid={`lifecycle-stage-label-${stage.key}`}
                className={[
                  "text-sm font-medium leading-snug",
                  previewMode ? "text-muted-foreground" : "",
                  !previewMode && isActive ? "text-blue-800 dark:text-blue-200" : "",
                  !previewMode && isComplete ? "text-emerald-800 dark:text-emerald-200" : "",
                  !previewMode && isBlocked ? "text-amber-800 dark:text-amber-200" : "",
                  !previewMode && (isNA || isNotStarted) ? "text-muted-foreground" : "",
                  !previewMode && !isActive && !isComplete && !isBlocked && !isNA && !isNotStarted ? "text-foreground" : "",
                ].join(" ")}
              >
                {stage.label}
              </span>
              {hasTasks && !previewMode && (
                <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                  {stage.tasks.filter((t) => t.completed).length}/{stage.tasks.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {previewMode
                ? <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground/50 border-dashed border-muted-foreground/30">planned</Badge>
                : statusBadge(stage.status)}
              {hasTasks && (
                isExpanded
                  ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                  : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
              )}
            </div>
          </div>

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

          {!previewMode && isActive && stage.nextAction && (
            <div
              data-testid={`lifecycle-next-action-${stage.key}`}
              className="flex items-start gap-1 mt-1 text-xs text-blue-700 dark:text-blue-300"
            >
              <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{stage.nextAction}</span>
            </div>
          )}

          {!previewMode && stage.status === "blocked" && stage.blockedReason && (
            <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              {stage.blockedReason}
            </div>
          )}

          {stage.sourceNote && !isNotStarted && (
            <div className="text-xs text-muted-foreground/60 italic mt-0.5">
              {stage.sourceNote}
            </div>
          )}
        </div>
      </div>

      {/* Task body — OUTSIDE the clickable header so task interactions don't collapse the stage */}
      {hasTasks && isExpanded && (
        <div
          className="px-3 pb-2.5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="ml-7">
            <TaskChecklist
              stage={stage}
              instanceId={instanceId}
              pendingKey={pendingKey}
              onToggle={onToggleTask}
            />
          </div>
          {!isLast && (
            <div className={[
              "ml-[11px] w-px mt-1 min-h-[12px]",
              isComplete ? "bg-emerald-300 dark:bg-emerald-700" : "bg-border",
            ].join(" ")} />
          )}
        </div>
      )}

      {/* Connector line when collapsed */}
      {(!hasTasks || !isExpanded) && !isLast && (
        <div className="ml-[23px] flex flex-col items-center">
          <div className={[
            "w-px min-h-[4px]",
            isComplete ? "bg-emerald-300 dark:bg-emerald-700" : "bg-border",
          ].join(" ")} />
        </div>
      )}
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
      return <Badge variant="secondary">Not Started</Badge>;
  }
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface LifecyclePanelProps {
  quoteId?: string;
  jobId?: string;
}

export default function LifecyclePanel({ quoteId, jobId }: LifecyclePanelProps) {
  const { toast } = useToast();
  const endpoint = jobId
    ? `/api/op-jobs/${jobId}/lifecycle`
    : quoteId
    ? `/api/quotes/${quoteId}/lifecycle`
    : null;

  const { data: lifecycle, isLoading, isError, error } = useQuery<ComputedLifecycleState>({
    queryKey: endpoint ? [endpoint] : ["lifecycle-none"],
    enabled: !!endpoint,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  // Track which stages are expanded
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  // Track which task toggle is in-flight: "stageKey:taskKey"
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  // Default-expand only the currently active stage when lifecycle loads or current stage changes.
  // Non-active stages default closed so the panel doesn't flood open on load.
  useEffect(() => {
    if (!lifecycle) return;
    setExpandedStages((_prev) => {
      const next = new Set<string>();
      for (const stage of lifecycle.stages) {
        if (stage.tasks.length > 0 && stage.status === "active") {
          next.add(stage.key);
        }
      }
      return next;
    });
  }, [lifecycle?.currentStageKey, lifecycle?.instanceId]);

  const toggleExpand = (key: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Task toggle mutation
  const toggleTaskMutation = useMutation({
    mutationFn: async ({
      instanceId,
      stageKey,
      taskKey,
      completed,
    }: {
      instanceId: string;
      stageKey: string;
      taskKey: string;
      completed: boolean;
    }) => {
      setPendingKey(`${stageKey}:${taskKey}`);
      await apiRequest("PATCH", `/api/lifecycle-instances/${instanceId}/tasks`, {
        stageKey,
        taskKey,
        completed,
      });
    },
    onSuccess: () => {
      setPendingKey(null);
      if (endpoint) {
        queryClient.invalidateQueries({ queryKey: [endpoint] });
      }
      // Also invalidate the sibling view (quote panel when on job page and vice versa)
      if (quoteId) {
        queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quoteId}/lifecycle`] });
      }
      if (jobId) {
        queryClient.invalidateQueries({ queryKey: [`/api/op-jobs/${jobId}/lifecycle`] });
      }
    },
    onError: (e: any) => {
      setPendingKey(null);
      // Parse structured error from the API (format: "400: {json}")
      let message = "Failed to update task. Please try again.";
      try {
        const match = e?.message?.match(/^\d+:\s*(\{[\s\S]*\})$/);
        if (match) {
          const body = JSON.parse(match[1]);
          if (body?.error) message = body.error;
        } else if (e?.message) {
          message = e.message;
        }
      } catch {
        if (e?.message) message = e.message;
      }
      toast({
        title: "Task blocked",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleToggleTask = (stageKey: string, taskKey: string, completed: boolean) => {
    if (!lifecycle?.instanceId) return;
    toggleTaskMutation.mutate({
      instanceId: lifecycle.instanceId,
      stageKey,
      taskKey,
      completed,
    });
  };

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
      {/* Panel header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Lifecycle</span>
          <span className="text-xs text-muted-foreground">
            v{lifecycle.templateVersion} · {lifecycle.divisionCode}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {lifecycle.instanceId && (
            <span className="text-xs text-muted-foreground" data-testid="lifecycle-progress">
              {completedCount}/{totalCount} stages
            </span>
          )}
          {lifecycle.instanceId
            ? <OverallStatusBadge status={lifecycle.overallStatus} />
            : <Badge variant="outline" className="text-[10px] border-dashed text-muted-foreground/60">Preview</Badge>
          }
        </div>
      </div>

      {/* Pre-acceptance preview notice — panel level */}
      {!lifecycle.instanceId && (
        <div className="flex items-start gap-2 rounded-md bg-muted/40 border border-border/50 px-3 py-2" data-testid="lifecycle-preview-notice">
          <Lock className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground/70 italic">
            This shows the planned lifecycle template. Tasks unlock and become editable once the quote is accepted.
          </p>
        </div>
      )}

      {/* Current stage summary */}
      {currentStage && lifecycle.instanceId && (
        <div
          data-testid="lifecycle-current-stage-summary"
          className="flex items-center gap-2 text-sm rounded-md bg-muted/50 px-3 py-2"
        >
          <ChevronRight className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="text-muted-foreground">Current:</span>
          <span className="font-medium text-foreground">{currentStage.label}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground capitalize">
            {RESPONSIBILITY_LABELS[currentStage.responsibility]}
          </span>
        </div>
      )}

      <Separator />

      {/* Stage list */}
      <div className={["space-y-1", !lifecycle.instanceId ? "opacity-90" : ""].join(" ")}>
        {lifecycle.stages.map((stage, idx) => (
          <StageRow
            key={stage.key}
            stage={stage}
            isLast={idx === lifecycle.stages.length - 1}
            isExpanded={expandedStages.has(stage.key)}
            onToggleExpand={() => toggleExpand(stage.key)}
            instanceId={lifecycle.instanceId}
            pendingKey={pendingKey}
            onToggleTask={handleToggleTask}
            previewMode={!lifecycle.instanceId}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="text-xs text-muted-foreground/60 pt-1 border-t border-border/50">
        {lifecycle.instanceId && lifecycle.assignedAt ? (
          <>
            Template locked{" "}
            {new Date(lifecycle.assignedAt).toLocaleDateString("en-NZ", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
            {" · "}{lifecycle.divisionCode} v{lifecycle.templateVersion}
          </>
        ) : lifecycle.stages.find((s) => s.key === "acceptance")?.status === "complete" ? (
          <>{lifecycle.divisionCode} v{lifecycle.templateVersion} · Active template (accepted pre-tracking)</>
        ) : (
          <>Preview — template locks at acceptance · {lifecycle.divisionCode} v{lifecycle.templateVersion}</>
        )}
      </div>
    </div>
  );
}
