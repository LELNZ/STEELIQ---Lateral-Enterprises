import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";

interface LLLifecycleStripProps {
  estimateId?: string | null;
  estimateStatus?: string | null;
  quoteId?: string | null;
  quoteStatus?: string | null;
  customerId?: string | null;
  projectId?: string | null;
  jobId?: string | null;
  hasInvoices?: boolean;
}

const STAGES = [
  { key: "estimate", label: "Estimate" },
  { key: "quote", label: "Quote" },
  { key: "accepted", label: "Accepted" },
  { key: "customer", label: "Customer" },
  { key: "project", label: "Project" },
  { key: "job", label: "Job" },
  { key: "invoice", label: "Invoice" },
] as const;

function resolveStages(props: LLLifecycleStripProps) {
  const {
    estimateId,
    estimateStatus,
    quoteId,
    quoteStatus,
    customerId,
    projectId,
    jobId,
    hasInvoices,
  } = props;

  const done: Record<string, boolean> = {};
  let currentKey: string | null = null;

  done.estimate = !!estimateId;
  done.quote = !!quoteId;
  done.accepted = quoteStatus === "accepted";
  done.customer = !!customerId;
  done.project = !!projectId;
  done.job = !!jobId;
  done.invoice = !!hasInvoices;

  if (!done.estimate) currentKey = "estimate";
  else if (!done.quote) currentKey = estimateStatus === "converted" ? "quote" : "estimate";
  else if (!done.accepted) currentKey = "quote";
  else if (!done.customer) currentKey = "customer";
  else if (!done.project) currentKey = "project";
  else if (!done.job) currentKey = "job";
  else if (!done.invoice) currentKey = "invoice";

  return STAGES.map((stage) => ({
    ...stage,
    done: done[stage.key] ?? false,
    current: stage.key === currentKey,
  }));
}

export function LLLifecycleStrip(props: LLLifecycleStripProps) {
  const stages = resolveStages(props);
  const allDone = stages.every((s) => s.done);

  return (
    <div
      className="rounded-lg border bg-card px-4 py-3 space-y-2"
      data-testid="ll-lifecycle-strip"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          LL Workflow
        </span>
        {allDone && (
          <Badge
            variant="outline"
            className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-700"
          >
            Complete
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-0.5 flex-wrap">
        {stages.map((stage, i) => (
          <div key={stage.key} className="flex items-center gap-0.5">
            <div
              className={[
                "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors",
                stage.done
                  ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                  : stage.current
                    ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 ring-1 ring-blue-300 dark:ring-blue-600"
                    : "bg-muted/50 text-muted-foreground",
              ].join(" ")}
              data-testid={`ll-stage-${stage.key}`}
            >
              {stage.done ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <Circle className="h-3 w-3" />
              )}
              {stage.label}
            </div>
            {i < stages.length - 1 && (
              <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function LLLifecycleStripFromEstimate({
  estimateId,
  estimateStatus,
  linkedQuote,
}: {
  estimateId: string;
  estimateStatus: string;
  linkedQuote?: { id: string; number: string; status: string } | null;
}) {
  const quoteId = linkedQuote?.id ?? null;
  const quoteStatus = linkedQuote?.status ?? null;

  const { data: quoteDetail } = useQuery<any>({
    queryKey: ["/api/quotes", quoteId],
    enabled: !!quoteId,
    staleTime: 15_000,
  });

  const customerId = quoteDetail?.customerId ?? null;
  const projectId = quoteDetail?.projectId ?? null;

  const { data: linkedJob } = useQuery<any>({
    queryKey: ["/api/op-jobs", "by-quote", quoteId],
    queryFn: async () => {
      const res = await fetch(`/api/op-jobs?quoteId=${quoteId}`, { credentials: "include" });
      const jobs = await res.json();
      return (jobs as any[]).find((j) => j.sourceQuoteId === quoteId) ?? null;
    },
    enabled: !!quoteId && !!projectId,
    staleTime: 15_000,
  });

  const { data: invoices = [] } = useQuery<any[]>({
    queryKey: ["/api/quotes", quoteId, "invoices"],
    queryFn: () =>
      fetch(`/api/quotes/${quoteId}/invoices`, { credentials: "include" }).then((r) => r.json()),
    enabled: !!quoteId,
    staleTime: 15_000,
  });

  return (
    <LLLifecycleStrip
      estimateId={estimateId}
      estimateStatus={estimateStatus}
      quoteId={quoteId}
      quoteStatus={quoteStatus}
      customerId={customerId}
      projectId={projectId}
      jobId={linkedJob?.id ?? null}
      hasInvoices={invoices.length > 0}
    />
  );
}

export function LLLifecycleStripFromQuote({
  quoteId,
  quoteStatus,
  customerId,
  projectId,
  sourceLaserEstimateId,
}: {
  quoteId: string;
  quoteStatus: string;
  customerId?: string | null;
  projectId?: string | null;
  sourceLaserEstimateId?: string | null;
}) {
  const { data: linkedJob } = useQuery<any>({
    queryKey: ["/api/op-jobs", "by-quote", quoteId],
    queryFn: async () => {
      const res = await fetch(`/api/op-jobs?quoteId=${quoteId}`, { credentials: "include" });
      const jobs = await res.json();
      return (jobs as any[]).find((j) => j.sourceQuoteId === quoteId) ?? null;
    },
    enabled: !!projectId,
    staleTime: 15_000,
  });

  const { data: invoices = [] } = useQuery<any[]>({
    queryKey: ["/api/quotes", quoteId, "invoices"],
    queryFn: () =>
      fetch(`/api/quotes/${quoteId}/invoices`, { credentials: "include" }).then((r) => r.json()),
    staleTime: 15_000,
  });

  return (
    <LLLifecycleStrip
      estimateId={sourceLaserEstimateId}
      estimateStatus="converted"
      quoteId={quoteId}
      quoteStatus={quoteStatus}
      customerId={customerId}
      projectId={projectId}
      jobId={linkedJob?.id ?? null}
      hasInvoices={invoices.length > 0}
    />
  );
}

export function LLLifecycleStripFromJob({
  jobId,
  sourceQuoteId,
  customerId,
  projectId,
}: {
  jobId: string;
  sourceQuoteId?: string | null;
  customerId?: string | null;
  projectId?: string | null;
}) {
  const { data: sourceQuote } = useQuery<any>({
    queryKey: ["/api/quotes", sourceQuoteId],
    enabled: !!sourceQuoteId,
    staleTime: 15_000,
  });

  const { data: invoices = [] } = useQuery<any[]>({
    queryKey: ["/api/quotes", sourceQuoteId, "invoices"],
    queryFn: () =>
      fetch(`/api/quotes/${sourceQuoteId}/invoices`, { credentials: "include" }).then((r) =>
        r.json()
      ),
    enabled: !!sourceQuoteId,
    staleTime: 15_000,
  });

  const sourceLaserEstimateId = sourceQuote?.sourceLaserEstimateId ?? null;

  return (
    <LLLifecycleStrip
      estimateId={sourceLaserEstimateId}
      estimateStatus={sourceLaserEstimateId ? "converted" : null}
      quoteId={sourceQuoteId}
      quoteStatus={sourceQuote?.status ?? "accepted"}
      customerId={customerId}
      projectId={projectId}
      jobId={jobId}
      hasInvoices={invoices.length > 0}
    />
  );
}
