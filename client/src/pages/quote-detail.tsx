import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { type Quote, type QuoteRevision, type AuditLog, type Invoice, type Customer, type Project, type OpJob, VALID_STATUS_TRANSITIONS, type QuoteStatus, type Variation } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeftCircle, Archive, Clock, Download, Eye, FileText, History, Loader2, CheckCircle2, ReceiptText, AlertTriangle, Plus, Briefcase, Building2, FolderOpen, Link2, ExternalLink, Send, Mail, Trash2, RotateCcw, XCircle, ChevronDown, ChevronUp, MapPin, ShieldCheck, Percent } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, type ReactNode } from "react";
import { buildQuoteDocumentModel, DEFAULT_TOTALS_DISPLAY_CONFIG, type TotalsDisplayConfig } from "@/lib/quote-document";
import type { PreviewData } from "@/lib/quote-document";
import { buildQuoteRenderModel } from "@/lib/quote-renderer";
import { generateQuotePdf, generateQuotePdfBase64 } from "@/lib/pdf-engine";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import LifecyclePanel from "@/components/lifecycle-panel";

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
  cancelled: "destructive",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  review: "In Review",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  archived: "Archived",
  cancelled: "Cancelled",
};

const TRANSITION_LABELS: Record<string, string> = {
  review: "Submit for Review",
  sent: "Mark as Sent",
  accepted: "Accept",
  declined: "Decline",
  archived: "Archive",
  cancelled: "Cancel Quote",
};

function fmt(n: number): string {
  return n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function QuoteDetail() {
  const [, params] = useRoute("/quote/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const quoteId = params?.id;
  const [pdfExporting, setPdfExporting] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const { user } = useAuth();
  const showDemoTools = user?.role === "owner" || user?.role === "admin";

  async function handleExportPdf() {
    if (!quoteId || pdfExporting) return;
    setPdfExporting(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/preview-data`);
      if (!res.ok) throw new Error("Failed to load quote data");
      const preview: PreviewData = await res.json();
      const doc = buildQuoteDocumentModel(preview);
      const renderModel = buildQuoteRenderModel(doc);
      await generateQuotePdf(renderModel);
      toast({ title: "PDF exported successfully" });
    } catch (err: any) {
      toast({ title: "PDF export failed", description: err.message, variant: "destructive" });
    } finally {
      setPdfExporting(false);
    }
  }

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

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/quotes/${quoteId}/accept`, {});
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Acceptance failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "audit-log"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Quote accepted", description: "Acceptance recorded and commercial state preserved." });
    },
    onError: (err: Error) => {
      toast({ title: "Acceptance failed", description: err.message, variant: "destructive" });
    },
  });

  const typeMutation = useMutation({
    mutationFn: async (newType: string) => {
      const quoteType = newType as "renovation" | "new_build";
      const res = await apiRequest("PATCH", `/api/quotes/${quoteId}/type`, { quoteType });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Quote type updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update quote type", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/quotes/${quoteId}?confirm=permanent`, {});
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Delete failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Quote deleted" });
      navigate("/quotes");
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const revertMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/quotes/${quoteId}/revert-to-draft`, {});
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Revert failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Quote reverted to draft" });
    },
    onError: (err: Error) => {
      toast({ title: "Cannot revert", description: err.message, variant: "destructive" });
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/quotes/${quoteId}/unarchive`, {});
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Unarchive failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Quote restored to draft" });
    },
    onError: (err: Error) => {
      toast({ title: "Unarchive failed", description: err.message, variant: "destructive" });
    },
  });

  const demoFlagMutation = useMutation({
    mutationFn: async (isDemoRecord: boolean) => {
      const res = await apiRequest("PATCH", `/api/quotes/${quoteId}/demo-flag`, { isDemoRecord });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId] });
      toast({ title: "Demo flag updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  // Customer-facing Details: quick-edit state
  const currentRevisionForDetails = quote?.revisions?.find(r => r.id === quote?.currentRevisionId);
  const savedDetailsText = (currentRevisionForDetails as any)?.commercialRemarks ?? "";
  const savedDetailsConfig = (currentRevisionForDetails as any)?.totalsDisplayConfigJson as TotalsDisplayConfig | null;
  const savedShowDetails = savedDetailsConfig?.showCommercialRemarks ?? true;

  const [localDetailsText, setLocalDetailsText] = useState<string | null>(null);
  const [localShowDetails, setLocalShowDetails] = useState<boolean | null>(null);

  const detailsRevisionId = currentRevisionForDetails?.id;
  useEffect(() => {
    setLocalDetailsText(null);
    setLocalShowDetails(null);
  }, [detailsRevisionId]);

  const effectiveDetailsText = localDetailsText ?? savedDetailsText;
  const effectiveShowDetails = localShowDetails ?? savedShowDetails;
  const hasUnsavedDetails = localDetailsText !== null || localShowDetails !== null;

  const detailsMutation = useMutation({
    mutationFn: async () => {
      if (!currentRevisionForDetails) throw new Error("No current revision");
      const fullConfig: TotalsDisplayConfig = {
        ...DEFAULT_TOTALS_DISPLAY_CONFIG,
        ...(savedDetailsConfig || {}),
        showCommercialRemarks: effectiveShowDetails,
      };
      const res = await apiRequest("PATCH", `/api/quotes/${quoteId}/revisions/${currentRevisionForDetails.id}/spec-display`, {
        totalsDisplayConfig: fullConfig,
        commercialRemarks: effectiveDetailsText || null,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error || "Save failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId] });
      setLocalDetailsText(null);
      setLocalShowDetails(null);
      toast({ title: "Details saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/quotes")} data-testid="button-back-to-quotes">
            <ArrowLeftCircle className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-quote-number">{quote.number}</h1>
            <p className="text-sm text-muted-foreground" data-testid="text-quote-customer">{quote.customer}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => navigate(`/quote/${quoteId}/preview`)} data-testid="button-preview-quote">
            <Eye className="h-4 w-4 mr-1" /> Customer Preview
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={pdfExporting}
            onClick={handleExportPdf}
            data-testid="button-export-pdf"
          >
            {pdfExporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
            {pdfExporting ? "Exporting..." : "Export PDF"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSendDialogOpen(true)}
            data-testid="button-send-quote"
          >
            <Send className="h-4 w-4 mr-1" /> Send Quote
          </Button>
          {quote.status === "draft" && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteDialogOpen(true)}
              data-testid="button-delete-quote"
            >
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          )}
          <Badge variant={STATUS_VARIANT[quote.status] || "secondary"} className="text-sm px-3 py-1" data-testid="badge-quote-status">
            {STATUS_LABELS[quote.status] || quote.status}
          </Badge>
        </div>
      </div>

      {quote.archivedAt && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30 p-4 flex items-center justify-between gap-4" data-testid="banner-archived">
          <div className="flex items-center gap-2 text-sm">
            <Archive className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
            <span className="text-yellow-800 dark:text-yellow-300">
              This quote was archived on <strong>{new Date(quote.archivedAt).toLocaleDateString("en-NZ")}</strong>. It is hidden from active lists.
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => unarchiveMutation.mutate()}
            disabled={unarchiveMutation.isPending}
            data-testid="button-unarchive-quote"
          >
            {unarchiveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 mr-1" />}
            Unarchive
          </Button>
        </div>
      )}

      {quote.isDemoRecord && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 px-4 py-2 flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300" data-testid="banner-demo-record">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          This quote is flagged as a demo/test record and may be bulk-archived by an administrator.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Quote Type</p>
          <Select
            value={quote.quoteType === "renovation" || quote.quoteType === "new_build" ? quote.quoteType : "__legacy__"}
            onValueChange={(val) => typeMutation.mutate(val)}
            disabled={typeMutation.isPending}
          >
            <SelectTrigger className="h-7 w-[140px] text-sm mt-0.5" data-testid="select-quote-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {quote.quoteType !== "renovation" && quote.quoteType !== "new_build" && (
                <SelectItem value="__legacy__" disabled className="text-muted-foreground italic">Unclassified</SelectItem>
              )}
              <SelectItem value="renovation">Renovation</SelectItem>
              <SelectItem value="new_build">New Build</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {quote.sourceJobId && (
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">Source Job</p>
            <Button
              variant="ghost"
              className="p-0 h-auto text-sm underline"
              onClick={() => navigate(`/job/${quote.sourceJobId}`)}
              data-testid="link-source-job"
            >
              View Job
            </Button>
          </div>
        )}
        {quote.projectId && (
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><FolderOpen className="h-3 w-3" /> Project</p>
            <Button
              variant="ghost"
              className="p-0 h-auto text-sm underline"
              onClick={() => navigate(`/projects/${quote.projectId}`)}
              data-testid="link-header-project"
            >
              View Project
            </Button>
          </div>
        )}
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> Last Sent</p>
          {quote.sentAt ? (
            <div>
              <p className="text-sm font-medium" data-testid="text-sent-at">
                {new Date(quote.sentAt).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}
              </p>
              {quote.sentToEmail && (
                <p className="text-xs text-muted-foreground truncate" data-testid="text-sent-to">{quote.sentToEmail}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic" data-testid="text-not-sent">Not sent</p>
          )}
        </div>
      </div>

      {allowedTransitions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {allowedTransitions.map((nextStatus) => {
            if (nextStatus === "accepted") {
              return (
                <Button
                  key={nextStatus}
                  variant="default"
                  size="sm"
                  onClick={() => acceptMutation.mutate()}
                  disabled={acceptMutation.isPending}
                  data-testid="button-status-accepted"
                >
                  {acceptMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Accept Quote
                </Button>
              );
            }
            return (
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
            );
          })}
        </div>
      )}

      {quote.status === "accepted" && quote.acceptedAt && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <h3 className="text-sm font-semibold">Accepted</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Accepted Date</p>
              <p className="font-medium" data-testid="text-accepted-at">
                {new Date(quote.acceptedAt).toLocaleDateString("en-NZ")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Accepted Value</p>
              <p className="font-medium" data-testid="text-accepted-value">
                ${quote.acceptedValue != null ? quote.acceptedValue.toLocaleString("en-NZ", { minimumFractionDigits: 2 }) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Revision</p>
              <p className="font-medium" data-testid="text-accepted-revision">
                {quote.revisions?.find((r) => r.id === quote.acceptedRevisionId)
                  ? `v${quote.revisions.find((r) => r.id === quote.acceptedRevisionId)!.versionNumber}`
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      <CustomerProjectSection quoteId={quote.id} customerId={quote.customerId} projectId={quote.projectId} quoteStatus={quote.status} sourceJobId={quote.sourceJobId ?? undefined} quoteLabel={quote.customer ?? quote.number} />

      {currentRevisionForDetails && (
        <CollapsibleCard title="Customer-facing Details" defaultOpen={true} data-testid="section-details-quick-edit">
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Shown as a dedicated block below the quote summary in the customer PDF and preview.</p>
              <div className="flex items-center gap-2 shrink-0">
                <Label htmlFor="details-show-toggle" className="text-xs text-muted-foreground">Show</Label>
                <Switch
                  id="details-show-toggle"
                  checked={effectiveShowDetails}
                  onCheckedChange={(v) => setLocalShowDetails(v)}
                  data-testid="switch-details-show"
                />
              </div>
            </div>
            <Textarea
              value={effectiveDetailsText}
              onChange={e => setLocalDetailsText(e.target.value)}
              placeholder="e.g. Price includes supply and installation. Payment: 50% deposit on acceptance, balance on completion."
              rows={4}
              className="text-sm resize-none"
              data-testid="textarea-details-quick-edit"
            />
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground h-7 px-2"
                onClick={() => navigate(`/quote/${quoteId}/preview`)}
                data-testid="link-open-quote-display-settings"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Open Quote Display Settings
              </Button>
              <Button
                size="sm"
                disabled={!hasUnsavedDetails || detailsMutation.isPending}
                onClick={() => detailsMutation.mutate()}
                data-testid="button-save-details"
              >
                {detailsMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </div>
        </CollapsibleCard>
      )}

      <Separator />

      <CollapsibleCard title={`Revisions${quote.revisions && quote.revisions.length > 0 ? ` (${quote.revisions.length})` : ""}`} icon={<History className="h-4 w-4 text-muted-foreground" />} defaultOpen={false} data-testid="section-revisions">
        {quote.revisions && quote.revisions.length > 0 ? (
          <div className="overflow-x-auto">
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
          <p className="text-sm text-muted-foreground p-4">No revisions yet.</p>
        )}
      </CollapsibleCard>

      {quote.sourceJobId && (
        <CollapsibleCard title="Related Quotes" icon={<FileText className="h-4 w-4 text-muted-foreground" />} defaultOpen={false}>
          <div className="p-0">
            <RelatedQuotes sourceJobId={quote.sourceJobId} currentQuoteId={quote.id} />
          </div>
        </CollapsibleCard>
      )}

      {quote.status === "accepted" && (
        <>
          <Separator />
          <InvoiceSection quoteId={quote.id} acceptedValue={quote.acceptedValue ?? 0} divisionCode={quote.divisionId ?? undefined} customerId={quote.customerId ?? undefined} projectId={quote.projectId ?? undefined} acceptedRevisionId={quote.acceptedRevisionId ?? undefined} />
          <Separator />
          <ConvertToJobSection quoteId={quote.id} projectId={quote.projectId} />
          <Separator />
          <div className="rounded-lg border border-dashed p-4 space-y-2" data-testid="section-revert-to-draft">
            <div className="flex items-center gap-2 text-sm font-medium">
              <RotateCcw className="h-4 w-4 text-muted-foreground" /> Revert to Draft
            </div>
            <p className="text-xs text-muted-foreground">
              Available when no invoices have been raised. If a job was created from this quote, it must be cancelled first — the cancelled job record is preserved for auditability.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => setRevertDialogOpen(true)}
              disabled={revertMutation.isPending}
              data-testid="button-revert-to-draft"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Revert to Draft
            </Button>
          </div>
        </>
      )}

      <Separator />

      <div data-testid="section-lifecycle" className="rounded-lg border bg-card p-4">
        <LifecyclePanel quoteId={quote.id} />
      </div>

      <Separator />

      {(user?.role === "admin" || user?.role === "owner") && showDemoTools && (
        <>
          <Separator />
          <div className="rounded-lg border border-dashed p-4 space-y-2" data-testid="section-admin-demo-flag">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Admin: Demo / Test Record</p>
            <p className="text-xs text-muted-foreground">Flag this quote as a demo/test record so it can be bulk-archived from the admin panel without affecting real operational data.</p>
            <div className="flex items-center gap-3">
              <Button
                variant={quote.isDemoRecord ? "secondary" : "outline"}
                size="sm"
                onClick={() => demoFlagMutation.mutate(!quote.isDemoRecord)}
                disabled={demoFlagMutation.isPending}
                data-testid="button-toggle-demo-flag"
              >
                {quote.isDemoRecord ? "✓ Flagged as Demo/Test" : "Mark as Demo/Test"}
              </Button>
              {quote.isDemoRecord && (
                <span className="text-xs text-muted-foreground">This record will be archived by the next demo cleanup.</span>
              )}
            </div>
          </div>
        </>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-confirm-delete">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {quote.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes this draft quote and all its revisions. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
              data-testid="button-confirm-delete"
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={revertDialogOpen} onOpenChange={setRevertDialogOpen}>
        <AlertDialogContent data-testid="dialog-confirm-revert">
          <AlertDialogHeader>
            <AlertDialogTitle>Revert {quote.number} to Draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear the acceptance record and return the quote to draft status. The revision history is preserved. This action cannot be undone if invoices or a job exist.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-revert">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { revertMutation.mutate(); setRevertDialogOpen(false); }}
              data-testid="button-confirm-revert"
            >
              Revert to Draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {sendDialogOpen && (
        <SendQuoteDialog
          quoteId={quote.id}
          quoteNumber={quote.number}
          customerName={quote.customer}
          defaultToEmail=""
          open={sendDialogOpen}
          onClose={() => setSendDialogOpen(false)}
        />
      )}

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

interface SendQuoteDialogProps {
  quoteId: string;
  quoteNumber: string;
  customerName: string;
  defaultToEmail: string;
  open: boolean;
  onClose: () => void;
}

function SendQuoteDialog({ quoteId, quoteNumber, customerName, defaultToEmail, open, onClose }: SendQuoteDialogProps) {
  const { toast } = useToast();
  const [toEmail, setToEmail] = useState(defaultToEmail);
  const [subject, setSubject] = useState(`${quoteNumber} from Lateral Enterprises`);
  const [message, setMessage] = useState(
    `Hello ${customerName},\n\nPlease find attached your quotation ${quoteNumber}.\n\nIf you have any questions or require adjustments, please let us know.\n\nKind regards,\nLateral Enterprises`
  );
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<string>("");

  async function handleSend() {
    if (!toEmail || !subject || !message) return;
    setSending(true);
    setProgress("Loading quote data...");
    try {
      const res = await fetch(`/api/quotes/${quoteId}/preview-data`);
      if (!res.ok) throw new Error("Failed to load quote data");
      const preview: PreviewData = await res.json();
      const doc = buildQuoteDocumentModel(preview);
      const renderModel = buildQuoteRenderModel(doc);

      setProgress("Generating PDF...");
      const pdfBase64 = await generateQuotePdfBase64(renderModel, (s) => setProgress(s));

      setProgress("Sending email...");
      const sendRes = await apiRequest("POST", `/api/quotes/${quoteId}/send`, {
        pdfBase64,
        toEmail,
        subject,
        message,
      });
      if (!sendRes.ok) {
        const body = await sendRes.json().catch(() => ({}));
        throw new Error(body.error || "Send failed");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId] });
      toast({ title: "Quote sent", description: `Email delivered to ${toEmail}` });
      onClose();
    } catch (err: any) {
      toast({ title: "Failed to send quote", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
      setProgress("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !sending) onClose(); }}>
      <DialogContent className="max-w-md" data-testid="dialog-send-quote">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" /> Send Quote
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="send-to-email">To</Label>
            <Input
              id="send-to-email"
              type="email"
              placeholder="customer@example.com"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              disabled={sending}
              data-testid="input-send-to-email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="send-subject">Subject</Label>
            <Input
              id="send-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={sending}
              data-testid="input-send-subject"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="send-message">Message</Label>
            <Textarea
              id="send-message"
              rows={7}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={sending}
              data-testid="input-send-message"
            />
          </div>
          {sending && progress && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span data-testid="text-send-progress">{progress}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending} data-testid="button-cancel-send">
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !toEmail || !subject || !message}
            data-testid="button-confirm-send"
          >
            {sending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Sending...</> : <><Send className="h-4 w-4 mr-1" />Send</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  ready_for_xero: "Ready for Xero",
  pushed_to_xero_draft: "Pushed to Xero",
  approved: "Approved",
  returned_to_draft: "Returned to Draft",
};

const INVOICE_TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  progress: "Progress",
  variation: "Variation",
  final: "Final",
  retention_release: "Retention Release",
  credit_note: "Credit Note",
};

function CollapsibleCard({
  title,
  icon,
  defaultOpen = true,
  children,
  "data-testid": testId,
}: {
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  "data-testid"?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border bg-card" data-testid={testId}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold">{title}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {open && <div className="border-t">{children}</div>}
    </div>
  );
}

function CustomerProjectSection({ quoteId, customerId, projectId, quoteStatus, sourceJobId, quoteLabel }: { quoteId: string; customerId?: string | null; projectId?: string | null; quoteStatus?: string; sourceJobId?: string; quoteLabel?: string }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [selCustomer, setSelCustomer] = useState(customerId ?? "__none__");
  const [selProject, setSelProject] = useState(projectId ?? "__none__");
  const [relinkWarningOpen, setRelinkWarningOpen] = useState(false);

  const { data: customers = [] } = useQuery<Customer[]>({ queryKey: ["/api/customers"] });
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["/api/projects"] });
  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/quotes", quoteId, "invoices"],
    queryFn: () => fetch(`/api/quotes/${quoteId}/invoices`).then((r) => r.json()),
  });

  const customer = customers.find((c) => c.id === customerId);
  const project = projects.find((p) => p.id === projectId);
  const filteredProjects = selCustomer && selCustomer !== "__none__"
    ? projects.filter((p) => p.customerId === selCustomer)
    : projects;

  const linkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/quotes/${quoteId}/link`, {
        customerId: selCustomer === "__none__" ? null : selCustomer,
        projectId: selProject === "__none__" ? null : selProject,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Quote linkage saved" });
      setEditing(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Create Project dialog state
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [cpName, setCpName] = useState("");
  const [cpAddress, setCpAddress] = useState("");
  const [cpDescription, setCpDescription] = useState("");

  // Fetch source job for address prefill (only when creating project)
  const { data: sourceJob } = useQuery<any>({
    queryKey: ["/api/jobs", sourceJobId],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${sourceJobId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!sourceJobId && createProjectOpen,
  });

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/quotes/${quoteId}/create-project`, {
        name: cpName,
        address: cpAddress || null,
        description: cpDescription || null,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create project");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Project created and linked to quote" });
      setCreateProjectOpen(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openCreateProject = () => {
    // Prefill priority: (a) source job/site name, (b) quote label/reference, (c) customer name fallback
    const defaultName = sourceJob?.name
      ? sourceJob.name
      : quoteLabel && quoteLabel !== customer?.name
      ? quoteLabel
      : customer?.name
      ? customer.name
      : "";
    setCpName(defaultName);
    setCpAddress(sourceJob?.address ?? "");
    setCpDescription("");
    setCreateProjectOpen(true);
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Customer & Project</h3>
        </div>
        <div className="flex items-center gap-2">
          {!editing && quoteStatus === "accepted" && !projectId && customerId && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={openCreateProject}
              data-testid="button-create-project-from-quote"
            >
              <Plus className="h-3 w-3 mr-1" /> Create Project
            </Button>
          )}
          {!editing && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
              setSelCustomer(customerId ?? "__none__");
              setSelProject(projectId ?? "__none__");
              if (invoices.length > 0 && (customerId || projectId)) {
                setRelinkWarningOpen(true);
              } else {
                setEditing(true);
              }
            }} data-testid="button-edit-linkage">
              <Link2 className="h-3 w-3 mr-1" />
              {customer ? "Change" : "Link"}
            </Button>
          )}
        </div>
      </div>

      {!editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Building2 className="h-3 w-3" /> Customer</p>
              {customer ? (
                <p className="text-sm font-medium" data-testid="text-linked-customer">{customer.name}</p>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground italic">Not linked</p>
                  {quoteStatus === "accepted" && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Link a customer to enable Xero invoicing</p>
                  )}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><FolderOpen className="h-3 w-3" /> Project</p>
              {project ? (
                <div>
                  <p className="text-sm font-medium" data-testid="text-linked-project">{project.name}</p>
                  <a href={`/projects/${project.id}`} className="text-xs text-muted-foreground hover:underline flex items-center gap-1 mt-0.5" data-testid="link-view-project">
                    <ExternalLink className="h-2.5 w-2.5" /> View project
                  </a>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground italic">Not linked</p>
                  {quoteStatus === "accepted" && !customerId && (
                    <p className="text-xs text-muted-foreground mt-1">Link a customer first to create a project</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {quoteStatus === "accepted" && !projectId && customerId && (
            <div className="rounded-lg border-2 border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-2" data-testid="banner-create-project-cta">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Next Step: Create Project</p>
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                This quote has been accepted. Create a project to start operational delivery — jobs, invoices, and site management all flow from the project.
              </p>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={openCreateProject}
                data-testid="button-create-project-cta"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Project
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Customer</Label>
              <Select value={selCustomer} onValueChange={(v) => { setSelCustomer(v); setSelProject("__none__"); }}>
                <SelectTrigger className="h-8 text-sm" data-testid="select-link-customer"><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Project</Label>
              <Select value={selProject} onValueChange={setSelProject} disabled={!selCustomer || selCustomer === "__none__"}>
                <SelectTrigger className="h-8 text-sm" data-testid="select-link-project">
                  <SelectValue placeholder={selCustomer && selCustomer !== "__none__" ? "Select project" : "Select a customer first"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {filteredProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => linkMutation.mutate()} disabled={linkMutation.isPending} data-testid="button-save-linkage">
              {linkMutation.isPending ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Relink Warning Dialog */}
      <AlertDialog open={relinkWarningOpen} onOpenChange={setRelinkWarningOpen}>
        <AlertDialogContent data-testid="dialog-relink-warning">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Changing Customer or Project
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                This quote has <strong>{invoices.length} invoice{invoices.length !== 1 ? "s" : ""}</strong> already raised.
              </span>
              <span className="block">
                Changing the linked customer or project will <strong>not</strong> update existing invoices — those remain associated with the original customer. This may cause mismatches if you are using Xero.
              </span>
              <span className="block text-muted-foreground">
                Only proceed if you are correcting a data entry error and understand the implications.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-relink">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => { setRelinkWarningOpen(false); setEditing(true); }}
              data-testid="button-confirm-relink"
            >
              I understand — Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Project Dialog */}
      <Dialog open={createProjectOpen} onOpenChange={setCreateProjectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" /> Create Project from Quote
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <Alert>
              <AlertDescription>
                A new project will be created and automatically linked to this quote. The project will be owned by {customer?.name ?? "the linked customer"}.
              </AlertDescription>
            </Alert>
            <div>
              <Label>Project Name</Label>
              <Input
                value={cpName}
                onChange={(e) => setCpName(e.target.value)}
                placeholder="e.g. 23 Main St – Window Package"
                data-testid="input-create-project-name"
              />
            </div>
            <div>
              <Label className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Site Address <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                value={cpAddress}
                onChange={(e) => setCpAddress(e.target.value)}
                placeholder="Site or delivery address"
                data-testid="input-create-project-address"
              />
            </div>
            <div>
              <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                value={cpDescription}
                onChange={(e) => setCpDescription(e.target.value)}
                placeholder="Brief notes about this project"
                data-testid="input-create-project-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateProjectOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createProjectMutation.mutate()}
              disabled={!cpName.trim() || createProjectMutation.isPending}
              data-testid="button-confirm-create-project"
            >
              {createProjectMutation.isPending ? "Creating…" : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConvertToJobSection({ quoteId, projectId }: { quoteId: string; projectId?: string | null }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showDialog, setShowDialog] = useState(false);
  const [jobTitle, setJobTitle] = useState("");
  const [jobNotes, setJobNotes] = useState("");

  const { data: existingJob, isLoading: checkingJob } = useQuery<OpJob | null>({
    queryKey: ["/api/op-jobs", "by-quote", quoteId],
    queryFn: async () => {
      const res = await fetch(`/api/op-jobs?quoteId=${quoteId}`);
      if (!res.ok) return null;
      const jobs: OpJob[] = await res.json();
      return jobs.find((j) => j.sourceQuoteId === quoteId) ?? null;
    },
  });

  const convertMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/quotes/${quoteId}/convert-to-job`, {
        title: jobTitle || undefined,
        notes: jobNotes || undefined,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.jobId) {
          queryClient.invalidateQueries({ queryKey: ["/api/op-jobs", "by-quote", quoteId] });
          throw new Error("A job already exists for this quote.");
        }
        throw new Error(body.error || "Conversion failed");
      }
      return res.json();
    },
    onSuccess: (newJob: OpJob) => {
      queryClient.invalidateQueries({ queryKey: ["/api/op-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/op-jobs", "by-quote", quoteId] });
      if (projectId) queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "jobs"] });
      toast({ title: "Job created", description: `${newJob.jobNumber} — ${newJob.title}` });
      setShowDialog(false);
      navigate(`/op-jobs/${newJob.id}`);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (checkingJob) return null;

  if (existingJob) {
    return (
      <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-green-600" />
            <h3 className="text-sm font-semibold">Converted to Job</h3>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => navigate(`/op-jobs/${existingJob.id}`)} data-testid="button-view-job">
            <ExternalLink className="h-3 w-3 mr-1" /> View Job
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Job Number</p>
            <p className="font-mono font-medium" data-testid="text-job-number">{existingJob.jobNumber}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Title</p>
            <p className="font-medium" data-testid="text-job-title">{existingJob.title}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant="outline" className="text-xs capitalize" data-testid="badge-job-status">{existingJob.status.replace("_", " ")}</Badge>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-dashed p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Convert to Job</h3>
        </div>
        {!projectId ? (
          <>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm font-medium">
                A project must be created first before converting to a job.
                <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                  Use the <strong>Create Project</strong> button in the Customer &amp; Project section above, then return here to convert.
                </span>
              </AlertDescription>
            </Alert>
            <Button size="sm" disabled data-testid="button-convert-to-job">
              <Briefcase className="h-3.5 w-3.5 mr-1.5" /> Convert to Job
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              This accepted quote is ready to be converted into an operational job. This creates a traceable job shell linked to the accepted revision and project.
            </p>
            <Button size="sm" onClick={() => setShowDialog(true)} data-testid="button-convert-to-job">
              <Briefcase className="h-3.5 w-3.5 mr-1.5" /> Convert to Job
            </Button>
          </>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Convert Quote to Job
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <Alert>
              <AlertDescription>
                This will create an operational job shell derived from the accepted revision. The accepted quote history is not modified.
              </AlertDescription>
            </Alert>
            <div>
              <Label>Job Title <span className="text-muted-foreground">(optional — defaults to customer name)</span></Label>
              <Input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. 23 Main St — Window & Door Package"
                data-testid="input-job-title"
              />
            </div>
            <div>
              <Label>Initial Notes <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                value={jobNotes}
                onChange={(e) => setJobNotes(e.target.value)}
                placeholder="Any initial notes for the job team"
                data-testid="input-job-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={() => convertMutation.mutate()} disabled={convertMutation.isPending} data-testid="button-confirm-convert">
              {convertMutation.isPending ? "Creating…" : "Create Job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type InvoiceAllocation = {
  acceptedValueExcl: number;
  acceptedValueIncl: number;
  totalInvoicedExcl: number;
  totalInvoicedIncl: number;
  remainingExcl: number;
  remainingIncl: number;
  depositInvoicedExcl: number;
  depositAllowancePct: number;
  depositAllowanceExcl: number;
  depositAllowanceRemainingExcl: number;
  depositAllowanceFullyUsed: boolean;
  activeInvoiceCount: number;
  // Variation-expanded fields
  approvedVariationTotalExcl?: number;
  approvedVariationTotalIncl?: number;
  totalInvoiceableExcl?: number;
  totalInvoiceableIncl?: number;
  variations?: Variation[];
  variationInvoicedByVariationId?: Record<string, number>;
  // Retention fields
  retentionPercentage?: number | null;
  retentionHeldValue?: number;
  retentionHeldValueIncl?: number;
  retentionReleasedExcl?: number;
  retentionReleasedIncl?: number;
  retentionRemainingExcl?: number;
  retentionRemainingIncl?: number;
  retentionConfigured?: boolean;
  standardCeilingExcl?: number;
  standardInvoicedExcl?: number;
  standardRemainingExcl?: number;
};

function InvoiceSection({
  quoteId,
  acceptedValue,
  divisionCode,
  customerId,
  projectId,
  acceptedRevisionId,
}: {
  quoteId: string;
  acceptedValue: number;
  divisionCode?: string;
  customerId?: string;
  projectId?: string;
  acceptedRevisionId?: string;
}) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [invoiceType, setInvoiceType] = useState<"deposit" | "progress" | "variation" | "final" | "retention_release">("deposit");
  const [depositMode, setDepositMode] = useState<"percentage" | "fixed">("percentage");
  const [depositPct, setDepositPct] = useState("50");
  const [depositFixed, setDepositFixed] = useState("");
  const [fixedGstBasis, setFixedGstBasis] = useState<"excl" | "incl">("excl");
  const [selectedVariationId, setSelectedVariationId] = useState<string>("");
  const [xeroWarn, setXeroWarn] = useState<string | null>(null);
  const [xeroReturnInvoice, setXeroReturnInvoice] = useState<Invoice | null>(null);
  const [showRetentionConfig, setShowRetentionConfig] = useState(false);
  const [retentionPctInput, setRetentionPctInput] = useState("");

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/quotes", quoteId, "invoices"],
    queryFn: () => fetch(`/api/quotes/${quoteId}/invoices`).then((r) => r.json()),
  });

  const { data: allocation } = useQuery<InvoiceAllocation>({
    queryKey: ["/api/quotes", quoteId, "invoice-allocation"],
    queryFn: () => fetch(`/api/quotes/${quoteId}/invoice-allocation`).then((r) => r.json()),
    enabled: !!quoteId,
  });

  // Approved/partially invoiced variations eligible for further invoicing
  const approvedVariations: Variation[] = (allocation?.variations ?? []).filter(
    (v) => ["approved", "partially_invoiced"].includes(v.status)
  );
  // How much of each variation has already been invoiced
  const variationInvoicedMap = allocation?.variationInvoicedByVariationId ?? {};
  // Map for looking up variation title from variationId on invoices
  const allVariationsForMap: Variation[] = allocation?.variations ?? [];
  const variationTitleMap: Record<string, string> = Object.fromEntries(
    allVariationsForMap.map((v) => [v.id, v.title])
  );
  const selectedVariation = approvedVariations.find((v) => v.id === selectedVariationId) ?? null;
  const variationRemainingExcl = selectedVariation
    ? Math.max(0, selectedVariation.amountExclGst - (variationInvoicedMap[selectedVariation.id] ?? 0))
    : 0;

  const GST_RATE = 0.15;

  const retentionConfigureMutation = useMutation({
    mutationFn: async (pct: number | null) => {
      const res = await apiRequest("PATCH", `/api/quotes/${quoteId}/retention`, { retentionPercentage: pct });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "invoice-allocation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId] });
      setShowRetentionConfig(false);
      toast({ title: "Retention configured" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const retentionRemainingExcl = allocation?.retentionRemainingExcl ?? 0;

  const exclGst = (() => {
    if (invoiceType === "deposit") {
      return depositMode === "percentage"
        ? (acceptedValue * (parseFloat(depositPct) || 0)) / 100
        : fixedGstBasis === "incl"
          ? (parseFloat(depositFixed) || 0) / (1 + GST_RATE)
          : parseFloat(depositFixed) || 0;
    }
    if (invoiceType === "variation") {
      if (selectedVariation && depositFixed === "") return variationRemainingExcl;
      return fixedGstBasis === "incl"
        ? (parseFloat(depositFixed) || 0) / (1 + GST_RATE)
        : parseFloat(depositFixed) || 0;
    }
    if (invoiceType === "retention_release" && allocation) {
      // Default to full remaining retention
      return depositFixed === ""
        ? retentionRemainingExcl
        : fixedGstBasis === "incl"
          ? (parseFloat(depositFixed) || 0) / (1 + GST_RATE)
          : parseFloat(depositFixed) || 0;
    }
    if (invoiceType === "final" && allocation) {
      // Final auto-suggests standard remaining (excl. retention) not total remaining
      const standardRemaining = allocation.standardRemainingExcl ?? Math.max(0, (allocation.totalInvoiceableExcl ?? allocation.acceptedValueExcl) - allocation.totalInvoicedExcl);
      return depositFixed === ""
        ? standardRemaining
        : fixedGstBasis === "incl"
          ? (parseFloat(depositFixed) || 0) / (1 + GST_RATE)
          : parseFloat(depositFixed) || 0;
    }
    return fixedGstBasis === "incl"
      ? (parseFloat(depositFixed) || 0) / (1 + GST_RATE)
      : parseFloat(depositFixed) || 0;
  })();

  const gst = exclGst * GST_RATE;
  const inclGst = exclGst + gst;

  const openCreateDialog = () => {
    setInvoiceType("deposit");
    setDepositMode("percentage");
    setDepositPct("50");
    setDepositFixed("");
    setFixedGstBasis("excl");
    setSelectedVariationId("");
    setShowCreate(true);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const isDeposit = invoiceType === "deposit";
      const descriptionMap: Record<string, string> = {
        deposit: depositMode === "percentage"
          ? `${depositPct}% deposit on accepted quotation`
          : `Deposit invoice — NZD ${inclGst.toFixed(2)} incl. GST`,
        progress: `Progress claim — NZD ${inclGst.toFixed(2)} incl. GST`,
        variation: `Variation invoice — NZD ${inclGst.toFixed(2)} incl. GST`,
        final: `Final invoice — NZD ${inclGst.toFixed(2)} incl. GST`,
        retention_release: `Retention release — NZD ${inclGst.toFixed(2)} incl. GST`,
      };
      const res = await apiRequest("POST", "/api/invoices", {
        quoteId,
        divisionCode,
        customerId: customerId ?? null,
        projectId: projectId ?? null,
        quoteRevisionId: acceptedRevisionId ?? null,
        type: invoiceType,
        depositType: isDeposit ? depositMode : null,
        depositPercentage: isDeposit && depositMode === "percentage" ? parseFloat(depositPct) : null,
        amountExclGst: exclGst,
        gstAmount: gst,
        amountInclGst: inclGst,
        description: descriptionMap[invoiceType] ?? "",
        variationId: invoiceType === "variation" && selectedVariationId ? selectedVariationId : null,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create invoice");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "invoice-allocation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      if (projectId) queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "invoices"] });
      setShowCreate(false);
      toast({ title: `${INVOICE_TYPE_LABELS[invoiceType] ?? "Invoice"} created` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const [xeroMissingCustomer, setXeroMissingCustomer] = useState(false);

  const markReadyMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await apiRequest("PATCH", `/api/invoices/${invoiceId}`, { status: "ready_for_xero" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.code === "MISSING_CUSTOMER") {
          const err = new Error(body.error || "No customer linked");
          (err as any).missingCustomer = true;
          throw err;
        }
        throw new Error(body.error || "Failed to mark ready");
      }
      return res.json();
    },
    onSuccess: () => {
      setXeroMissingCustomer(false);
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "invoice-allocation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      if (projectId) queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "invoices"] });
      toast({ title: "Invoice marked ready for Xero" });
    },
    onError: (e: any) => {
      if (e?.missingCustomer) {
        setXeroMissingCustomer(true);
      } else {
        setXeroMissingCustomer(false);
        toast({ title: "Error", description: e.message, variant: "destructive" });
      }
    },
  });

  const unmarkReadyMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await apiRequest("PATCH", `/api/invoices/${invoiceId}`, { status: "draft" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to unmark");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "invoice-allocation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      if (projectId) queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "invoices"] });
      toast({ title: "Invoice returned to draft" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const pushToXeroMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await apiRequest("POST", `/api/invoices/${invoiceId}/push-to-xero`, {});
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Push to Xero failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "invoice-allocation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      if (projectId) queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "invoices"] });
      if (data.xeroMode === "live") {
        toast({
          title: "Pushed to Xero (Live)",
          description: `Invoice created in Xero as ${data.xeroInvoiceNumber}. Status: ${data.xeroStatus}.`,
        });
      } else {
        toast({
          title: "Pushed to Xero (Scaffold)",
          description: "No live Xero credentials — mock identifiers stored for workflow testing.",
        });
      }
    },
    onError: (e: any) => toast({ title: "Push to Xero failed", description: e.message, variant: "destructive" }),
  });

  const returnToDraftMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await apiRequest("POST", `/api/invoices/${invoiceId}/return-to-draft`, {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "invoice-allocation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      if (projectId) queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "invoices"] });
      if (data.xeroWarning) setXeroWarn(data.xeroWarning);
      toast({ title: "Invoice returned to draft" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await apiRequest("PATCH", `/api/invoices/${invoiceId}`, { status: "approved" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Approve failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "invoice-allocation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      if (projectId) queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "invoices"] });
      toast({ title: "Invoice approved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const fmt = (n: number) => `$${n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ReceiptText className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Invoices {invoices.length > 0 && <span className="text-xs font-normal">({invoices.length})</span>}
          </h2>
        </div>
        <Button
          size="sm"
          variant={invoices.length === 0 ? "default" : "outline"}
          className={invoices.length === 0 ? "h-7 text-xs" : "h-7 text-xs"}
          onClick={openCreateDialog}
          data-testid="button-create-invoice"
        >
          <Plus className="h-3 w-3 mr-1" /> {invoices.length === 0 ? "Create First Invoice" : "Create Invoice"}
        </Button>
      </div>

      {allocation && (
        <div className="rounded-lg border bg-card p-3 space-y-3" data-testid="panel-invoice-allocation">
          {/* Commercial hierarchy — 9-row model */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Base Contract</p>
              <p className="text-sm font-semibold" data-testid="text-contract-value">{fmt(allocation.acceptedValueExcl)} excl.</p>
            </div>
            {(allocation.approvedVariationTotalExcl ?? 0) > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">+ Approved Variations</p>
                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400" data-testid="text-variation-total">+{fmt(allocation.approvedVariationTotalExcl!)} excl.</p>
              </div>
            )}
            {(allocation.approvedVariationTotalExcl ?? 0) > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">= Total Contract</p>
                <p className="text-sm font-semibold" data-testid="text-total-contract">
                  {fmt(allocation.acceptedValueExcl + (allocation.approvedVariationTotalExcl ?? 0))} excl.
                </p>
              </div>
            )}
            {allocation.retentionConfigured && (allocation.retentionHeldValue ?? 0) > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">− Retention ({allocation.retentionPercentage}%)</p>
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400" data-testid="text-retention-held">−{fmt(allocation.retentionHeldValue!)} excl.</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Std. Invoiced</p>
              <p className="text-sm font-semibold" data-testid="text-std-invoiced">{fmt(allocation.standardInvoicedExcl ?? allocation.totalInvoicedExcl)} excl.</p>
            </div>
            {(allocation.retentionReleasedExcl ?? 0) > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">+ Retention Released</p>
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400" data-testid="text-retention-released-total">+{fmt(allocation.retentionReleasedExcl!)} excl.</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Total Invoiced</p>
              <p className="text-sm font-semibold" data-testid="text-total-invoiced">
                {fmt((allocation.standardInvoicedExcl ?? allocation.totalInvoicedExcl) + (allocation.retentionReleasedExcl ?? 0))} excl.
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Std. Remaining</p>
              <p className={`text-sm font-semibold ${(allocation.standardRemainingExcl ?? allocation.remainingExcl) <= 0 ? "text-destructive" : "text-green-600 dark:text-green-400"}`} data-testid="text-remaining-value">
                {fmt(Math.max(0, allocation.standardRemainingExcl ?? allocation.remainingExcl))} excl.
              </p>
            </div>
          </div>

          {/* Retention row — shown when retention is configured */}
          {allocation.retentionConfigured && (allocation.retentionHeldValue ?? 0) > 0 && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2 space-y-1" data-testid="panel-retention-summary">
              <div className="flex items-center gap-1.5 mb-1">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Retention — {allocation.retentionPercentage}% of base contract</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Held</p>
                  <p className="font-semibold text-amber-700 dark:text-amber-300" data-testid="text-retention-held-value">{fmt(allocation.retentionHeldValue!)} excl.</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Released</p>
                  <p className="font-semibold" data-testid="text-retention-released">{fmt(allocation.retentionReleasedExcl ?? 0)} excl.</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Remaining to Release</p>
                  <p className={`font-semibold ${(allocation.retentionRemainingExcl ?? 0) > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600"}`} data-testid="text-retention-remaining">
                    {fmt(allocation.retentionRemainingExcl ?? 0)} excl.
                  </p>
                </div>
              </div>
              {(allocation.retentionReleasedExcl ?? 0) > 0 && (
                <p className="text-xs text-muted-foreground pt-0.5">
                  Total incl. retention released: {fmt(allocation.totalInvoicedExcl)} excl.
                </p>
              )}
            </div>
          )}

          {allocation.acceptedValueExcl > 0 && (
            <div className="space-y-1">
              <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                <div
                  className="h-full bg-primary rounded-l-full transition-all"
                  style={{ width: `${Math.min(100, ((allocation.standardInvoicedExcl ?? allocation.totalInvoicedExcl) / (allocation.totalInvoiceableExcl ?? allocation.acceptedValueExcl)) * 100)}%` }}
                />
                {(allocation.retentionReleasedExcl ?? 0) > 0 && (
                  <div
                    className="h-full bg-amber-400 dark:bg-amber-600 transition-all"
                    style={{ width: `${Math.min(100, ((allocation.retentionReleasedExcl ?? 0) / (allocation.totalInvoiceableExcl ?? allocation.acceptedValueExcl)) * 100)}%` }}
                  />
                )}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Deposit: {fmt(allocation.depositInvoicedExcl)} of {fmt(allocation.depositAllowanceExcl)} ({allocation.depositAllowancePct}%)</span>
                <span>{allocation.depositAllowanceFullyUsed
                  ? <span className="text-amber-600 dark:text-amber-400 font-medium">Deposit fully used</span>
                  : <span>{fmt(allocation.depositAllowanceRemainingExcl)} deposit remaining</span>
                }</span>
              </div>
            </div>
          )}

          {/* Retention configuration control */}
          <div className="flex items-center justify-between pt-1 border-t">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              {allocation.retentionConfigured
                ? `Retention: ${allocation.retentionPercentage}% (${fmt(allocation.retentionHeldValue!)} held)`
                : "No retention configured"}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs px-2"
              onClick={() => { setRetentionPctInput(allocation.retentionPercentage?.toString() ?? ""); setShowRetentionConfig(true); }}
              data-testid="button-configure-retention"
            >
              <Percent className="h-3 w-3 mr-1" />
              {allocation.retentionConfigured ? "Edit Retention" : "Set Retention"}
            </Button>
          </div>
        </div>
      )}

      {xeroWarn && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm font-medium">{xeroWarn}</AlertDescription>
        </Alert>
      )}

      {xeroMissingCustomer && (
        <Alert data-testid="alert-xero-missing-customer">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            A customer must be linked to this quote before marking an invoice ready for Xero. Link one in the <strong>Customer &amp; Project</strong> section above.
          </AlertDescription>
        </Alert>
      )}

      <Dialog open={!!xeroReturnInvoice} onOpenChange={(open) => { if (!open) setXeroReturnInvoice(null); }}>
        <DialogContent className="max-w-md" data-testid="dialog-xero-return-warning">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Return to Draft — Xero Invoice Exists
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              This invoice has been pushed to Xero
              {xeroReturnInvoice?.xeroInvoiceNumber && (
                <> as <span className="font-mono font-semibold">{xeroReturnInvoice.xeroInvoiceNumber}</span></>
              )}.
            </p>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>You must delete the corresponding Xero invoice before replacing or reissuing.</strong>{" "}
                Returning to draft here does not remove the invoice from Xero. Failure to delete the Xero invoice first may create accounting inconsistencies.
              </AlertDescription>
            </Alert>
            <p className="text-muted-foreground">
              Only continue if you have already deleted or voided invoice{" "}
              {xeroReturnInvoice?.xeroInvoiceNumber ? (
                <span className="font-mono font-semibold">{xeroReturnInvoice.xeroInvoiceNumber}</span>
              ) : (
                "in Xero"
              )}.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setXeroReturnInvoice(null)} data-testid="button-xero-return-cancel">
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={returnToDraftMutation.isPending}
              onClick={() => {
                if (xeroReturnInvoice) {
                  returnToDraftMutation.mutate(xeroReturnInvoice.id);
                  setXeroReturnInvoice(null);
                }
              }}
              data-testid="button-xero-return-confirm"
            >
              I have deleted the Xero invoice — Return to Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {invoices.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 space-y-1" data-testid="panel-no-invoices">
          <p className="text-sm font-medium">No invoices raised yet</p>
          <p className="text-xs text-muted-foreground">
            Start with a deposit invoice, then raise progress, variation, or final invoices as work progresses.
            Invoices must be marked ready and pushed to Xero for accounting.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Excl. GST</TableHead>
                <TableHead className="text-right">Incl. GST</TableHead>
                <TableHead className="w-[160px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id} data-testid={`row-invoice-${inv.id}`}>
                  <TableCell className="font-mono text-sm" data-testid={`text-invoice-number-${inv.id}`}>{inv.number}</TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        inv.type === "deposit" ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" :
                        inv.type === "progress" ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" :
                        inv.type === "variation" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" :
                        inv.type === "final" ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" :
                        inv.type === "retention_release" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" :
                        inv.type === "credit_note" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" :
                        "bg-muted text-muted-foreground"
                      }`} data-testid={`badge-invoice-type-${inv.id}`}>
                        {INVOICE_TYPE_LABELS[inv.type] || inv.type}
                      </span>
                    </div>
                    {inv.type === "variation" && (inv as any).variationId && variationTitleMap[(inv as any).variationId] && (
                      <div className="text-xs text-muted-foreground truncate max-w-[160px] mt-0.5" data-testid={`text-invoice-variation-source-${inv.id}`}>
                        ↳ {variationTitleMap[(inv as any).variationId]}
                      </div>
                    )}
                    {inv.type === "retention_release" && (
                      <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5" data-testid={`text-invoice-retention-context-${inv.id}`}>
                        ↳ Release of retained funds
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge variant={inv.status === "approved" ? "default" : inv.status === "returned_to_draft" ? "destructive" : inv.status === "ready_for_xero" ? "outline" : "secondary"} className="text-xs">
                        {INVOICE_STATUS_LABELS[inv.status] || inv.status}
                      </Badge>
                      {inv.status === "returned_to_draft" && (
                        <p className="text-xs text-destructive/70" data-testid={`text-returned-to-draft-note-${inv.id}`}>
                          Mark ready to re-queue for Xero
                        </p>
                      )}
                      {inv.xeroInvoiceNumber && (
                        <p className="text-xs font-mono text-muted-foreground" data-testid={`text-xero-number-${inv.id}`}>
                          Xero: {inv.xeroInvoiceNumber}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    ${(inv.amountExclGst ?? 0).toLocaleString("en-NZ", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    ${(inv.amountInclGst ?? 0).toLocaleString("en-NZ", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1 flex-wrap">
                      {["draft", "returned_to_draft"].includes(inv.status) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => markReadyMutation.mutate(inv.id)}
                          disabled={markReadyMutation.isPending}
                          data-testid={`button-mark-ready-${inv.id}`}
                        >
                          Mark Ready
                        </Button>
                      )}
                      {inv.status === "ready_for_xero" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => unmarkReadyMutation.mutate(inv.id)}
                            disabled={unmarkReadyMutation.isPending}
                            data-testid={`button-unmark-ready-${inv.id}`}
                          >
                            Unmark
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => pushToXeroMutation.mutate(inv.id)}
                            disabled={pushToXeroMutation.isPending}
                            data-testid={`button-push-to-xero-${inv.id}`}
                          >
                            Push to Xero
                          </Button>
                        </>
                      )}
                      {inv.status === "pushed_to_xero_draft" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950/30"
                          onClick={() => approveMutation.mutate(inv.id)}
                          disabled={approveMutation.isPending}
                          data-testid={`button-approve-${inv.id}`}
                        >
                          Approve
                        </Button>
                      )}
                      {["pushed_to_xero_draft", "approved"].includes(inv.status) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            if (inv.xeroInvoiceId) {
                              setXeroReturnInvoice(inv);
                            } else {
                              returnToDraftMutation.mutate(inv.id);
                            }
                          }}
                          disabled={returnToDraftMutation.isPending}
                          data-testid={`button-return-to-draft-${inv.id}`}
                        >
                          Return to Draft
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Invoice Type</Label>
              <div className="grid grid-cols-4 gap-1">
                {(["deposit", "progress", "variation", "final"] as const).map((t) => (
                  <Button
                    key={t}
                    size="sm"
                    variant={invoiceType === t ? "default" : "outline"}
                    onClick={() => { setInvoiceType(t); setDepositFixed(""); }}
                    className="text-xs capitalize"
                    data-testid={`button-invoice-type-${t}`}
                  >
                    {t === "deposit" ? "Deposit" : t === "progress" ? "Progress" : t === "variation" ? "Variation" : "Final"}
                  </Button>
                ))}
              </div>
              {allocation?.retentionConfigured && (allocation.retentionRemainingExcl ?? 0) > 0.001 && (
                <Button
                  size="sm"
                  variant={invoiceType === "retention_release" ? "default" : "outline"}
                  onClick={() => { setInvoiceType("retention_release"); setDepositFixed(""); }}
                  className="w-full text-xs border-amber-400 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                  data-testid="button-invoice-type-retention_release"
                >
                  <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                  Retention Release ({fmt(allocation.retentionRemainingExcl ?? 0)} available)
                </Button>
              )}
            </div>

            {invoiceType === "deposit" && allocation && (
              <div className={`rounded-md px-3 py-2 text-xs space-y-0.5 ${allocation.depositAllowanceFullyUsed ? "bg-destructive/10 border border-destructive/30 text-destructive" : "bg-muted/50"}`} data-testid="panel-deposit-allowance">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deposit allowance ({allocation.depositAllowancePct}% of contract)</span>
                  <span className="font-medium">{fmt(allocation.depositAllowanceExcl)} excl.</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Already invoiced (deposit)</span>
                  <span className="font-medium">{fmt(allocation.depositInvoicedExcl)} excl.</span>
                </div>
                <div className="flex justify-between border-t pt-0.5 mt-0.5">
                  <span className={allocation.depositAllowanceFullyUsed ? "text-destructive font-medium" : "text-muted-foreground"}>Remaining deposit allowance</span>
                  <span className={`font-semibold ${allocation.depositAllowanceFullyUsed ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
                    {fmt(allocation.depositAllowanceRemainingExcl)} excl.
                  </span>
                </div>
                {allocation.depositAllowanceFullyUsed && (
                  <p className="text-destructive font-medium pt-1">Deposit allocation already fully used for this quote.</p>
                )}
              </div>
            )}

            {invoiceType === "variation" && (
              <div className="space-y-2" data-testid="panel-variation-selector">
                <Label>Approved Variation <span className="text-destructive">*</span></Label>
                {approvedVariations.length === 0 ? (
                  <p className="text-xs text-destructive rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2">
                    No approved variations for this quote. Go to the linked project to create and approve a variation first.
                  </p>
                ) : (
                  <>
                    <Select value={selectedVariationId} onValueChange={(v) => { setSelectedVariationId(v); setDepositFixed(""); }}>
                      <SelectTrigger data-testid="select-variation">
                        <SelectValue placeholder="Select a variation…" />
                      </SelectTrigger>
                      <SelectContent>
                        {approvedVariations.map((v) => {
                          const remaining = Math.max(0, v.amountExclGst - (variationInvoicedMap[v.id] ?? 0));
                          return (
                            <SelectItem key={v.id} value={v.id} data-testid={`option-variation-${v.id}`}>
                              {v.title} — {fmt(remaining)} excl. remaining
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {selectedVariation && (
                      <div className="rounded-md px-3 py-2 text-xs bg-muted/50 space-y-0.5">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Variation total</span>
                          <span className="font-medium">{fmt(selectedVariation.amountExclGst)} excl.</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Already invoiced</span>
                          <span className="font-medium">{fmt(variationInvoicedMap[selectedVariation.id] ?? 0)} excl.</span>
                        </div>
                        <div className="flex justify-between border-t pt-0.5 mt-0.5">
                          <span className="text-muted-foreground font-medium">Remaining</span>
                          <span className="font-semibold text-green-600 dark:text-green-400">{fmt(variationRemainingExcl)} excl.</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {invoiceType === "final" && allocation && (
              <div className="rounded-md px-3 py-2 text-xs bg-muted/50 space-y-0.5" data-testid="panel-final-remaining">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Standard remaining balance</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    {fmt(Math.max(0, allocation.standardRemainingExcl ?? (allocation.totalInvoiceableExcl ?? allocation.acceptedValueExcl) - allocation.totalInvoicedExcl))} excl.
                  </span>
                </div>
                <p className="text-muted-foreground">Pre-filled with standard remaining balance (excludes retention). Adjust below if needed.</p>
                {allocation.retentionConfigured && (allocation.retentionRemainingExcl ?? 0) > 0 && (
                  <p className="text-amber-600 dark:text-amber-400 font-medium pt-0.5">
                    Retention ({fmt(allocation.retentionRemainingExcl ?? 0)}) is withheld — release separately using "Retention Release" invoice type.
                  </p>
                )}
              </div>
            )}

            {invoiceType === "retention_release" && allocation && (
              <div className="rounded-md px-3 py-2 text-xs bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 space-y-0.5" data-testid="panel-retention-release-info">
                <div className="flex items-center gap-1 mb-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="font-semibold text-amber-700 dark:text-amber-300">Retention Release</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total retention held</span>
                  <span className="font-medium">{fmt(allocation.retentionHeldValue ?? 0)} excl.</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Already released</span>
                  <span className="font-medium">{fmt(allocation.retentionReleasedExcl ?? 0)} excl.</span>
                </div>
                <div className="flex justify-between border-t pt-0.5 mt-0.5">
                  <span className="text-amber-700 dark:text-amber-300 font-medium">Available to release</span>
                  <span className="font-semibold text-amber-700 dark:text-amber-300">{fmt(retentionRemainingExcl)} excl.</span>
                </div>
                <p className="text-muted-foreground pt-0.5">Pre-filled with full remaining retention. Adjust if releasing only part of the retention.</p>
              </div>
            )}

            {invoiceType === "deposit" ? (
              <div className="space-y-2">
                <Label>Deposit Type</Label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={depositMode === "percentage" ? "default" : "outline"}
                    onClick={() => setDepositMode("percentage")}
                    data-testid="button-deposit-percentage"
                  >
                    Percentage
                  </Button>
                  <Button
                    size="sm"
                    variant={depositMode === "fixed" ? "default" : "outline"}
                    onClick={() => setDepositMode("fixed")}
                    data-testid="button-deposit-fixed"
                  >
                    Fixed Amount
                  </Button>
                </div>
                {depositMode === "percentage" ? (
                  <div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        value={depositPct}
                        onChange={(e) => setDepositPct(e.target.value)}
                        className="w-24"
                        data-testid="input-deposit-percentage"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1 ml-auto">
                        <Button size="sm" variant={fixedGstBasis === "excl" ? "default" : "outline"} onClick={() => setFixedGstBasis("excl")} className="h-6 px-2 text-xs" data-testid="button-gst-basis-excl">Excl. GST</Button>
                        <Button size="sm" variant={fixedGstBasis === "incl" ? "default" : "outline"} onClick={() => setFixedGstBasis("incl")} className="h-6 px-2 text-xs" data-testid="button-gst-basis-incl">Incl. GST</Button>
                      </div>
                    </div>
                    <Input type="number" min="0" step="0.01" value={depositFixed} onChange={(e) => setDepositFixed(e.target.value)} placeholder="0.00" data-testid="input-deposit-fixed" />
                  </div>
                )}
              </div>
            ) : invoiceType === "final" ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Amount (NZD)</Label>
                  <div className="flex gap-1">
                    <Button size="sm" variant={fixedGstBasis === "excl" ? "default" : "outline"} onClick={() => setFixedGstBasis("excl")} className="h-6 px-2 text-xs">Excl. GST</Button>
                    <Button size="sm" variant={fixedGstBasis === "incl" ? "default" : "outline"} onClick={() => setFixedGstBasis("incl")} className="h-6 px-2 text-xs">Incl. GST</Button>
                  </div>
                </div>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={depositFixed}
                  onChange={(e) => setDepositFixed(e.target.value)}
                  placeholder={allocation ? (fixedGstBasis === "incl" ? (allocation.remainingExcl * 1.15).toFixed(2) : allocation.remainingExcl.toFixed(2)) : "0.00"}
                  data-testid="input-amount-fixed"
                />
                <p className="text-xs text-muted-foreground">Leave blank to use remaining balance ({allocation ? fmt(allocation.remainingExcl) + " excl." : "—"})</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Amount (NZD)</Label>
                  <div className="flex gap-1">
                    <Button size="sm" variant={fixedGstBasis === "excl" ? "default" : "outline"} onClick={() => setFixedGstBasis("excl")} className="h-6 px-2 text-xs" data-testid="button-gst-basis-excl">Excl. GST</Button>
                    <Button size="sm" variant={fixedGstBasis === "incl" ? "default" : "outline"} onClick={() => setFixedGstBasis("incl")} className="h-6 px-2 text-xs" data-testid="button-gst-basis-incl">Incl. GST</Button>
                  </div>
                </div>
                <Input type="number" min="0" step="0.01" value={depositFixed} onChange={(e) => setDepositFixed(e.target.value)} placeholder="0.00" data-testid="input-amount-fixed" />
              </div>
            )}

            <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Excl. GST</span>
                <span>{fmt(exclGst)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">GST (15%)</span>
                <span>{fmt(gst)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-1">
                <span>Incl. GST</span>
                <span data-testid="text-deposit-incl-gst">{fmt(inclGst)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || exclGst <= 0 || (invoiceType === "deposit" && allocation?.depositAllowanceFullyUsed)}
              data-testid="button-save-invoice"
            >
              {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Create {INVOICE_TYPE_LABELS[invoiceType] ?? "Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Retention configuration dialog */}
      <Dialog open={showRetentionConfig} onOpenChange={setShowRetentionConfig}>
        <DialogContent className="max-w-sm" data-testid="dialog-retention-config">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-600" />
              Configure Retention
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 space-y-1">
              <p className="font-medium">Retention is withheld from the base contract value.</p>
              <p className="text-muted-foreground">Standard invoices (deposit/progress/final/variation) are capped at the contract minus retention held. Retention is released via a separate Retention Release invoice type.</p>
              <p className="text-muted-foreground">Set to 0 or clear to remove retention.</p>
            </div>
            <div className="space-y-2">
              <Label>Retention Percentage (% of base contract)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={retentionPctInput}
                  onChange={(e) => setRetentionPctInput(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-28"
                  data-testid="input-retention-percentage"
                />
                <span className="text-sm text-muted-foreground">%</span>
                {retentionPctInput && parseFloat(retentionPctInput) > 0 && (
                  <span className="text-xs text-muted-foreground">
                    = {fmt(acceptedValue * parseFloat(retentionPctInput) / 100)} excl. held
                  </span>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRetentionConfig(false)}>Cancel</Button>
            <Button
              onClick={() => {
                const pct = parseFloat(retentionPctInput);
                retentionConfigureMutation.mutate(isNaN(pct) || pct <= 0 ? null : pct);
              }}
              disabled={retentionConfigureMutation.isPending}
              data-testid="button-save-retention"
            >
              {retentionConfigureMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Save Retention
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RelatedQuotes({ sourceJobId, currentQuoteId }: { sourceJobId: string; currentQuoteId: string }) {
  const [, navigate] = useLocation();
  const { data: jobQuotes = [] } = useQuery<any[]>({
    queryKey: ["/api/jobs", sourceJobId, "quotes"],
    enabled: !!sourceJobId,
  });

  const related = jobQuotes.filter((q: any) => q.id !== currentQuoteId);

  if (related.length === 0) return null;

  return (
    <>
      <Separator />
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Related Quotes</h2>
        </div>
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quote #</TableHead>
                <TableHead>Revision</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {related.map((q: any) => (
                <TableRow key={q.id} data-testid={`row-related-quote-${q.id}`}>
                  <TableCell className="font-mono font-medium" data-testid={`text-related-quote-number-${q.id}`}>
                    {q.number}
                  </TableCell>
                  <TableCell className="text-sm">v{q.currentRevisionNumber || 1}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[q.status] || "secondary"}>
                      {STATUS_LABELS[q.status] || q.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {q.updatedAt ? new Date(q.updatedAt).toLocaleDateString("en-NZ") : "—"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => navigate(`/quote/${q.id}`)} data-testid={`button-view-related-${q.id}`}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
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
