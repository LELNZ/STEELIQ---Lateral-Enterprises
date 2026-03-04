import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type Quote, type QuoteRevision, type AuditLog, VALID_STATUS_TRANSITIONS, type QuoteStatus } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeftCircle, Clock, FileText, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QuoteWithRevisions extends Quote {
  revisions: QuoteRevision[];
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  review: "outline",
  sent: "default",
  accepted: "default",
  declined: "destructive",
  archived: "secondary",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  review: "In Review",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  archived: "Archived",
};

const TRANSITION_LABELS: Record<string, string> = {
  review: "Submit for Review",
  sent: "Mark as Sent",
  accepted: "Accept",
  declined: "Decline",
  archived: "Archive",
};

function fmt(n: number): string {
  return n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function QuoteDetail() {
  const [, params] = useRoute("/quote/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const quoteId = params?.id;

  const { data: quote, isLoading } = useQuery<QuoteWithRevisions>({
    queryKey: ["/api/quotes", quoteId],
    enabled: !!quoteId,
  });

  const { data: auditLogs } = useQuery<AuditLog[]>({
    queryKey: ["/api/quotes", quoteId, "audit-log"],
    enabled: !!quoteId,
  });

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await apiRequest("PATCH", `/api/quotes/${quoteId}/status`, { status: newStatus });
      return res.json();
    },
    onSuccess: (_data, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "audit-log"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: `Status updated to "${STATUS_LABELS[newStatus] || newStatus}"` });
    },
    onError: (err: Error) => {
      toast({ title: "Status update failed", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Quote not found</p>
      </div>
    );
  }

  const currentStatus = quote.status as QuoteStatus;
  const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6" data-testid="quote-detail-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/quotes")} data-testid="button-back-to-quotes">
            <ArrowLeftCircle className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-quote-number">{quote.number}</h1>
            <p className="text-sm text-muted-foreground" data-testid="text-quote-customer">{quote.customer}</p>
          </div>
        </div>
        <Badge variant={STATUS_VARIANT[quote.status] || "secondary"} className="text-sm px-3 py-1" data-testid="badge-quote-status">
          {STATUS_LABELS[quote.status] || quote.status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Created</p>
          <p className="text-sm font-medium" data-testid="text-quote-created">
            {quote.createdAt ? new Date(quote.createdAt).toLocaleDateString("en-NZ") : "—"}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Revisions</p>
          <p className="text-sm font-medium" data-testid="text-revision-count">{quote.revisions?.length || 0}</p>
        </div>
        {quote.sourceJobId && (
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">Source Job</p>
            <Button
              variant="link"
              className="p-0 h-auto text-sm"
              onClick={() => navigate(`/job/${quote.sourceJobId}`)}
              data-testid="link-source-job"
            >
              View Job
            </Button>
          </div>
        )}
      </div>

      {allowedTransitions.length > 0 && (
        <div className="flex items-center gap-2">
          {allowedTransitions.map((nextStatus) => (
            <Button
              key={nextStatus}
              variant={nextStatus === "declined" ? "destructive" : "default"}
              size="sm"
              onClick={() => statusMutation.mutate(nextStatus)}
              disabled={statusMutation.isPending}
              data-testid={`button-status-${nextStatus}`}
            >
              {TRANSITION_LABELS[nextStatus] || nextStatus}
            </Button>
          ))}
        </div>
      )}

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Revisions</h2>
        </div>
        {quote.revisions && quote.revisions.length > 0 ? (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Version</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Sell</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {quote.revisions.map((rev) => {
                  const snap = rev.snapshotJson as any;
                  const totals = snap?.totals || {};
                  const isCurrent = rev.id === quote.currentRevisionId;
                  return (
                    <TableRow key={rev.id} className={isCurrent ? "bg-muted/50" : ""} data-testid={`row-revision-${rev.id}`}>
                      <TableCell className="font-mono" data-testid={`text-revision-version-${rev.id}`}>
                        v{rev.versionNumber}
                        {isCurrent && <Badge variant="outline" className="ml-2 text-xs">Current</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString("en-NZ") : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm" data-testid={`text-revision-cost-${rev.id}`}>
                        ${fmt(totals.cost || 0)}
                      </TableCell>
                      <TableCell className="text-right text-sm" data-testid={`text-revision-sell-${rev.id}`}>
                        ${fmt(totals.sell || 0)}
                      </TableCell>
                      <TableCell className="text-right text-sm" data-testid={`text-revision-margin-${rev.id}`}>
                        {(totals.grossMargin || 0).toFixed(1)}%
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No revisions yet.</p>
        )}
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Audit Trail</h2>
        </div>
        {auditLogs && auditLogs.length > 0 ? (
          <div className="space-y-2">
            {auditLogs.map((log) => {
              const meta = log.metadataJson as any;
              return (
                <div key={log.id} className="flex items-start gap-3 text-sm rounded-lg border bg-card p-3" data-testid={`audit-log-${log.id}`}>
                  <div className="flex-1">
                    <span className="font-medium">{formatAction(log.action)}</span>
                    {meta && (
                      <span className="text-muted-foreground ml-2">
                        {formatMeta(log.action, meta)}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {log.createdAt ? new Date(log.createdAt).toLocaleString("en-NZ") : ""}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No audit events recorded.</p>
        )}
      </div>
    </div>
  );
}

function formatAction(action: string): string {
  return action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function formatMeta(action: string, meta: any): string {
  if (action === "status_changed" && meta.from && meta.to) {
    return `${meta.from} → ${meta.to}`;
  }
  if (action === "revision_created" && meta.versionNumber) {
    return `Version ${meta.versionNumber}`;
  }
  if (action === "quote_created" && meta.number) {
    return meta.number;
  }
  return "";
}
