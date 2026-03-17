import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { useSystemMode } from "@/hooks/use-system-mode";
import { type Quote, type QuoteRevision, type AuditLog, type Invoice, type Customer, type Project, type OpJob, VALID_STATUS_TRANSITIONS, type QuoteStatus } from "@shared/schema";
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
import { ArrowLeftCircle, Archive, Clock, Download, Eye, FileText, History, Loader2, CheckCircle2, ReceiptText, AlertTriangle, Plus, Briefcase, Building2, FolderOpen, Link2, ExternalLink, Send, Mail, Trash2, RotateCcw, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { buildQuoteDocumentModel } from "@/lib/quote-document";
import type { PreviewData } from "@/lib/quote-document";
import { buildQuoteRenderModel } from "@/lib/quote-renderer";
import { generateQuotePdf, generateQuotePdfBase64 } from "@/lib/pdf-engine";
import { Textarea } from "@/components/ui/textarea";
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
  const { mode: systemMode, isLoading: modeLoading } = useSystemMode();
  const isProduction = !modeLoading && systemMode === "production";
  const showDemoTools = !modeLoading && systemMode !== "production";

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

      <CustomerProjectSection quoteId={quote.id} customerId={quote.customerId} projectId={quote.projectId} />

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Revisions</h2>
        </div>
        {quote.revisions && quote.revisions.length > 0 ? (
          <div className="rounded-lg border bg-card overflow-x-auto">
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

      {quote.sourceJobId && <RelatedQuotes sourceJobId={quote.sourceJobId} currentQuoteId={quote.id} />}

      <Separator />

      <div data-testid="section-lifecycle" className="rounded-lg border bg-card p-4">
        <LifecyclePanel quoteId={quote.id} />
      </div>

      {quote.status === "accepted" && (
        <>
          <Separator />
          <InvoiceSection quoteId={quote.id} acceptedValue={quote.acceptedValue ?? 0} divisionCode={quote.divisionId ?? undefined} customerId={quote.customerId ?? undefined} projectId={quote.projectId ?? undefined} acceptedRevisionId={quote.acceptedRevisionId ?? undefined} />
          <Separator />
          <ConvertToJobSection quoteId={quote.id} />
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

function CustomerProjectSection({ quoteId, customerId, projectId }: { quoteId: string; customerId?: string | null; projectId?: string | null }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [selCustomer, setSelCustomer] = useState(customerId ?? "__none__");
  const [selProject, setSelProject] = useState(projectId ?? "__none__");

  const { data: customers = [] } = useQuery<Customer[]>({ queryKey: ["/api/customers"] });
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["/api/projects"] });

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

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Customer & Project</h3>
        </div>
        {!editing && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
            setSelCustomer(customerId ?? "__none__");
            setSelProject(projectId ?? "__none__");
            setEditing(true);
          }} data-testid="button-edit-linkage">
            <Link2 className="h-3 w-3 mr-1" />
            {customer ? "Change" : "Link"}
          </Button>
        )}
      </div>

      {!editing ? (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Building2 className="h-3 w-3" /> Customer</p>
            {customer ? (
              <p className="text-sm font-medium" data-testid="text-linked-customer">{customer.name}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">Not linked</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><FolderOpen className="h-3 w-3" /> Project</p>
            {project ? (
              <p className="text-sm font-medium" data-testid="text-linked-project">{project.name}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">Not linked</p>
            )}
          </div>
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
    </div>
  );
}

function ConvertToJobSection({ quoteId }: { quoteId: string }) {
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
        <p className="text-sm text-muted-foreground">
          This accepted quote is ready to be converted into an operational job. This creates a traceable job shell linked to the accepted revision.
        </p>
        <Button size="sm" onClick={() => setShowDialog(true)} data-testid="button-convert-to-job">
          <Briefcase className="h-3.5 w-3.5 mr-1.5" /> Convert to Job
        </Button>
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
  const [depositMode, setDepositMode] = useState<"percentage" | "fixed">("percentage");
  const [depositPct, setDepositPct] = useState("50");
  const [depositFixed, setDepositFixed] = useState("");
  const [fixedGstBasis, setFixedGstBasis] = useState<"excl" | "incl">("excl");
  const [xeroWarn, setXeroWarn] = useState<string | null>(null);
  const [xeroReturnInvoice, setXeroReturnInvoice] = useState<Invoice | null>(null);

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/quotes", quoteId, "invoices"],
    queryFn: () => fetch(`/api/quotes/${quoteId}/invoices`).then((r) => r.json()),
  });

  const GST_RATE = 0.15;
  const exclGst = depositMode === "percentage"
    ? (acceptedValue * (parseFloat(depositPct) || 0)) / 100
    : fixedGstBasis === "incl"
      ? (parseFloat(depositFixed) || 0) / (1 + GST_RATE)
      : parseFloat(depositFixed) || 0;
  const gst = exclGst * GST_RATE;
  const inclGst = exclGst + gst;

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/invoices", {
        quoteId,
        divisionCode,
        customerId: customerId ?? null,
        projectId: projectId ?? null,
        quoteRevisionId: acceptedRevisionId ?? null,
        type: "deposit",
        depositType: depositMode,
        depositPercentage: depositMode === "percentage" ? parseFloat(depositPct) : null,
        amountExclGst: exclGst,
        gstAmount: gst,
        amountInclGst: inclGst,
        description: depositMode === "percentage"
          ? `${depositPct}% deposit on accepted quotation`
          : `Deposit invoice — NZD ${inclGst.toFixed(2)} incl. GST (fixed amount)`,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create invoice");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "invoices"] });
      setShowCreate(false);
      toast({ title: "Deposit invoice created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const markReadyMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await apiRequest("PATCH", `/api/invoices/${invoiceId}`, { status: "ready_for_xero" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to mark ready");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "invoices"] });
      toast({ title: "Invoice marked ready for Xero" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
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
      if (data.xeroWarning) setXeroWarn(data.xeroWarning);
      toast({ title: "Invoice returned to draft" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ReceiptText className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Invoices</h2>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowCreate(true)} data-testid="button-create-invoice">
          <Plus className="h-3 w-3 mr-1" /> Create Deposit Invoice
        </Button>
      </div>

      {xeroWarn && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm font-medium">{xeroWarn}</AlertDescription>
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
        <p className="text-sm text-muted-foreground">No invoices yet.</p>
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
                  <TableCell className="text-sm">{INVOICE_TYPE_LABELS[inv.type] || inv.type}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge variant={inv.status === "approved" ? "default" : inv.status === "returned_to_draft" ? "destructive" : inv.status === "ready_for_xero" ? "outline" : "secondary"} className="text-xs">
                        {INVOICE_STATUS_LABELS[inv.status] || inv.status}
                      </Badge>
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
            <DialogTitle>Create Deposit Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
            </div>
            {depositMode === "percentage" ? (
              <div>
                <Label>Deposit Percentage</Label>
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
                  <Label>Amount (NZD)</Label>
                  <div className="flex gap-1 ml-auto">
                    <Button
                      size="sm"
                      variant={fixedGstBasis === "excl" ? "default" : "outline"}
                      onClick={() => setFixedGstBasis("excl")}
                      className="h-6 px-2 text-xs"
                      data-testid="button-gst-basis-excl"
                    >
                      Excl. GST
                    </Button>
                    <Button
                      size="sm"
                      variant={fixedGstBasis === "incl" ? "default" : "outline"}
                      onClick={() => setFixedGstBasis("incl")}
                      className="h-6 px-2 text-xs"
                      data-testid="button-gst-basis-incl"
                    >
                      Incl. GST
                    </Button>
                  </div>
                </div>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={depositFixed}
                  onChange={(e) => setDepositFixed(e.target.value)}
                  placeholder="0.00"
                  data-testid="input-deposit-fixed"
                />
                <p className="text-xs text-muted-foreground">
                  Enter amount {fixedGstBasis === "incl" ? "including" : "excluding"} GST — breakdown shown below.
                </p>
              </div>
            )}
            <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Excl. GST</span>
                <span>${exclGst.toLocaleString("en-NZ", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">GST (15%)</span>
                <span>${gst.toLocaleString("en-NZ", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-1">
                <span>Incl. GST</span>
                <span data-testid="text-deposit-incl-gst">${inclGst.toLocaleString("en-NZ", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || exclGst <= 0}
              data-testid="button-save-invoice"
            >
              {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Create Invoice
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
