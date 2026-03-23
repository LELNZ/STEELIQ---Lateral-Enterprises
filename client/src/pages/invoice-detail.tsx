import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Invoice } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, ReceiptText, CheckCircle2, Send, RotateCcw, FileCheck,
  RefreshCw, ExternalLink, DollarSign, CreditCard, Save, X, Pencil,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";

type EnrichedInvoice = Invoice & { customerName: string | null; projectName: string | null };

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

const INVOICE_TYPE_COLORS: Record<string, string> = {
  deposit: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
  progress: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800",
  variation: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800",
  final: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800",
  retention_release: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
  credit_note: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800",
};

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "approved") return "default";
  if (status === "returned_to_draft") return "destructive";
  if (status === "ready_for_xero") return "outline";
  return "secondary";
}

function fmtMoney(val: number | null | undefined): string {
  return `$${(val ?? 0).toLocaleString("en-NZ", { minimumFractionDigits: 2 })}`;
}

function XeroPaymentBadge({ invoice }: { invoice: EnrichedInvoice }) {
  const paid = (invoice as any).xeroAmountPaid ?? 0;
  const due = (invoice as any).xeroAmountDue ?? 0;

  if (!invoice.xeroInvoiceId) return null;
  if ((invoice as any).xeroAmountPaid == null) return null;

  if (due <= 0 && paid > 0) {
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800" data-testid="badge-payment-paid">
        <DollarSign className="h-3 w-3 mr-1" /> Paid in Full
      </Badge>
    );
  }
  if (paid > 0 && due > 0) {
    return (
      <Badge className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800" data-testid="badge-payment-partial">
        <CreditCard className="h-3 w-3 mr-1" /> Partial — {fmtMoney(paid)} paid
      </Badge>
    );
  }
  if (due > 0) {
    return (
      <Badge variant="outline" className="text-muted-foreground" data-testid="badge-payment-unpaid">
        <CreditCard className="h-3 w-3 mr-1" /> Unpaid — {fmtMoney(due)} due
      </Badge>
    );
  }
  return null;
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "owner" || user?.role === "admin";

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editReference, setEditReference] = useState("");

  const { data: invoice, isLoading } = useQuery<EnrichedInvoice>({
    queryKey: ["/api/invoices", id],
    queryFn: async () => {
      const res = await fetch(`/api/invoices/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load invoice");
      return res.json();
    },
    enabled: !!id,
  });

  const patchMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("PATCH", `/api/invoices/${id}`, data);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Update failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setEditingField(null);
      toast({ title: "Invoice updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest("PATCH", `/api/invoices/${id}`, { status });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Status change failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Status updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Status change failed", description: err.message, variant: "destructive" });
    },
  });

  const pushToXeroMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/invoices/${id}/push-to-xero`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Push to Xero failed");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: data.xeroMode === "live" ? "Pushed to Xero" : "Scaffold push complete",
        description: data.xeroMode === "live"
          ? `Xero invoice ${data.xeroInvoiceNumber} created`
          : "Mock identifiers stored for testing",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Xero push failed", description: err.message, variant: "destructive" });
    },
  });

  const returnToDraftMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/invoices/${id}/return-to-draft`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Return to draft failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Returned to draft" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const syncFromXeroMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/invoices/${id}/sync-from-xero`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Sync failed");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Synced from Xero",
        description: `Status: ${data.xeroPayment?.status} — Paid: ${fmtMoney(data.xeroPayment?.amountPaid)} / Due: ${fmtMoney(data.xeroPayment?.amountDue)}`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Xero sync failed", description: err.message, variant: "destructive" });
    },
  });

  const isPushed = invoice?.status === "pushed_to_xero_draft" || invoice?.status === "approved";
  const isDraft = invoice?.status === "draft";
  const isReadyForXero = invoice?.status === "ready_for_xero";
  const isReturnedToDraft = invoice?.status === "returned_to_draft";
  const isPending = patchMutation.isPending || statusMutation.isPending || pushToXeroMutation.isPending || returnToDraftMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-background">
        <header className="border-b px-4 sm:px-6 py-3 flex items-center gap-3 bg-card shrink-0">
          <Link href="/invoices">
            <Button variant="ghost" size="sm" className="h-8 gap-1" data-testid="button-back-invoices">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Loading invoice…</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col h-full bg-background">
        <header className="border-b px-4 sm:px-6 py-3 flex items-center gap-3 bg-card shrink-0">
          <Link href="/invoices">
            <Button variant="ghost" size="sm" className="h-8 gap-1" data-testid="button-back-invoices">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Invoice not found.</p>
        </div>
      </div>
    );
  }

  function startEdit(field: string) {
    if (!invoice) return;
    if (field === "description") setEditDescription(invoice.description ?? "");
    if (field === "notes") setEditNotes(invoice.notes ?? "");
    if (field === "reference") setEditReference((invoice as any).reference ?? "");
    setEditingField(field);
  }

  function cancelEdit() {
    setEditingField(null);
  }

  function saveEdit(field: string) {
    if (field === "description") patchMutation.mutate({ description: editDescription || null });
    if (field === "notes") patchMutation.mutate({ notes: editNotes || null });
    if (field === "reference") patchMutation.mutate({ reference: editReference || null });
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="border-b px-4 sm:px-6 py-3 flex items-center justify-between gap-3 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/invoices">
            <Button variant="ghost" size="sm" className="h-8 gap-1" data-testid="button-back-invoices">
              <ArrowLeft className="h-4 w-4" /> Invoices
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary shrink-0">
              <ReceiptText className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight font-mono" data-testid="text-invoice-number">
                {invoice.number}
              </h1>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {INVOICE_TYPE_LABELS[invoice.type] || invoice.type} Invoice
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDraft && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={isPending}
              onClick={() => statusMutation.mutate("ready_for_xero")}
              data-testid="button-mark-ready"
            >
              <FileCheck className="h-3 w-3 mr-1" /> Mark Ready for Xero
            </Button>
          )}
          {isReadyForXero && (
            <>
              <Button
                size="sm"
                className="h-8 text-xs"
                disabled={isPending}
                onClick={() => pushToXeroMutation.mutate()}
                data-testid="button-push-xero"
              >
                <Send className="h-3 w-3 mr-1" /> Push to Xero
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-muted-foreground"
                disabled={isPending}
                onClick={() => statusMutation.mutate("draft")}
                data-testid="button-back-draft"
              >
                <RotateCcw className="h-3 w-3 mr-1" /> Back to Draft
              </Button>
            </>
          )}
          {invoice.status === "pushed_to_xero_draft" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950/30"
                disabled={isPending}
                onClick={() => statusMutation.mutate("approved")}
                data-testid="button-approve"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-muted-foreground"
                disabled={isPending}
                onClick={() => returnToDraftMutation.mutate()}
                data-testid="button-return-draft"
              >
                <RotateCcw className="h-3 w-3 mr-1" /> Return to Draft
              </Button>
            </>
          )}
          {invoice.status === "approved" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-muted-foreground"
              disabled={isPending}
              onClick={() => returnToDraftMutation.mutate()}
              data-testid="button-return-draft-approved"
            >
              <RotateCcw className="h-3 w-3 mr-1" /> Return to Draft
            </Button>
          )}
          {isReturnedToDraft && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={isPending}
                onClick={() => statusMutation.mutate("ready_for_xero")}
                data-testid="button-mark-ready-rtd"
              >
                <FileCheck className="h-3 w-3 mr-1" /> Mark Ready
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-muted-foreground"
                disabled={isPending}
                onClick={() => statusMutation.mutate("draft")}
                data-testid="button-to-draft-rtd"
              >
                <RotateCcw className="h-3 w-3 mr-1" /> Back to Draft
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Status & Type</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16">Status</span>
                  <Badge variant={statusVariant(invoice.status)} className="text-xs" data-testid="badge-detail-status">
                    {INVOICE_STATUS_LABELS[invoice.status] || invoice.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16">Type</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${INVOICE_TYPE_COLORS[invoice.type] ?? "bg-muted text-muted-foreground border-border"}`}>
                    {INVOICE_TYPE_LABELS[invoice.type] || invoice.type}
                  </span>
                </div>
                {invoice.depositType && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16">Deposit</span>
                    <span className="text-sm">
                      {invoice.depositType === "percentage"
                        ? `${invoice.depositPercentage}% of quote`
                        : "Fixed amount"}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Amounts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Excl. GST</span>
                  <span className="font-mono text-sm font-semibold tabular-nums" data-testid="text-amount-excl">
                    {fmtMoney(invoice.amountExclGst)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">GST</span>
                  <span className="font-mono text-sm tabular-nums text-muted-foreground" data-testid="text-amount-gst">
                    {fmtMoney(invoice.gstAmount)}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Incl. GST</span>
                  <span className="font-mono text-base font-bold tabular-nums" data-testid="text-amount-incl">
                    {fmtMoney(invoice.amountInclGst)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Linkage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Customer</span>
                  <span className="text-sm font-medium" data-testid="text-detail-customer">
                    {invoice.customerName || <span className="text-muted-foreground italic">No customer</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Project</span>
                  <span className="text-sm font-medium" data-testid="text-detail-project">
                    {invoice.projectName || <span className="text-muted-foreground italic">No project</span>}
                  </span>
                </div>
                {invoice.quoteId && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Quote</span>
                    <Link
                      href={`/quote/${invoice.quoteId}`}
                      className="text-sm text-primary underline underline-offset-2 hover:no-underline"
                      data-testid="link-detail-quote"
                    >
                      View quote →
                    </Link>
                  </div>
                )}
                {invoice.divisionCode && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Division</span>
                    <span className="text-sm font-mono">{invoice.divisionCode}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Xero Integration</CardTitle>
                  {invoice.xeroInvoiceId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      disabled={syncFromXeroMutation.isPending}
                      onClick={() => syncFromXeroMutation.mutate()}
                      data-testid="button-sync-xero"
                    >
                      <RefreshCw className={`h-3 w-3 ${syncFromXeroMutation.isPending ? "animate-spin" : ""}`} />
                      Sync
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {invoice.xeroInvoiceId ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Xero #</span>
                      <span className="font-mono text-sm" data-testid="text-xero-number">
                        {invoice.xeroInvoiceNumber}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Xero Status</span>
                      <span className="font-mono text-xs" data-testid="text-xero-status">
                        {invoice.xeroStatus}
                      </span>
                    </div>
                    <XeroPaymentBadge invoice={invoice} />
                    {(invoice as any).xeroAmountPaid != null && (
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Paid</span>
                          <span className="font-mono text-sm text-emerald-600 dark:text-emerald-400 tabular-nums" data-testid="text-xero-paid">
                            {fmtMoney((invoice as any).xeroAmountPaid)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Due</span>
                          <span className="font-mono text-sm tabular-nums" data-testid="text-xero-due">
                            {fmtMoney((invoice as any).xeroAmountDue)}
                          </span>
                        </div>
                      </div>
                    )}
                    {(invoice as any).xeroLastSyncedAt && (
                      <p className="text-[10px] text-muted-foreground">
                        Last synced: {new Date((invoice as any).xeroLastSyncedAt).toLocaleString("en-NZ")}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Not yet pushed to Xero</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">Reference</span>
                  {editingField !== "reference" && !isPushed && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => startEdit("reference")} data-testid="button-edit-reference">
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                  )}
                </div>
                {editingField === "reference" ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editReference}
                      onChange={(e) => setEditReference(e.target.value)}
                      placeholder="e.g. PO-12345, Job ref..."
                      className="h-8 text-sm"
                      data-testid="input-edit-reference"
                    />
                    <Button size="sm" className="h-8" disabled={patchMutation.isPending} onClick={() => saveEdit("reference")} data-testid="button-save-reference">
                      <Save className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={cancelEdit} data-testid="button-cancel-reference">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm" data-testid="text-reference">
                    {(invoice as any).reference || <span className="text-muted-foreground italic">No reference set</span>}
                  </p>
                )}
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">Description</span>
                  {editingField !== "description" && !isPushed && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => startEdit("description")} data-testid="button-edit-description">
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                  )}
                </div>
                {editingField === "description" ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Invoice description…"
                      className="text-sm min-h-[60px]"
                      data-testid="input-edit-description"
                    />
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="h-7" disabled={patchMutation.isPending} onClick={() => saveEdit("description")} data-testid="button-save-description">
                        <Save className="h-3 w-3 mr-1" /> Save
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7" onClick={cancelEdit} data-testid="button-cancel-description">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap" data-testid="text-description">
                    {invoice.description || <span className="text-muted-foreground italic">No description</span>}
                  </p>
                )}
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">Internal Notes</span>
                  {editingField !== "notes" && !isPushed && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => startEdit("notes")} data-testid="button-edit-notes">
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                  )}
                </div>
                {editingField === "notes" ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Internal notes…"
                      className="text-sm min-h-[60px]"
                      data-testid="input-edit-notes"
                    />
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="h-7" disabled={patchMutation.isPending} onClick={() => saveEdit("notes")} data-testid="button-save-notes">
                        <Save className="h-3 w-3 mr-1" /> Save
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7" onClick={cancelEdit} data-testid="button-cancel-notes">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap" data-testid="text-notes">
                    {invoice.notes || <span className="text-muted-foreground italic">No notes</span>}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="text-[10px] text-muted-foreground space-y-0.5 pt-2">
            <p>Created: {invoice.createdAt ? new Date(invoice.createdAt).toLocaleString("en-NZ") : "—"}</p>
            <p>Updated: {invoice.updatedAt ? new Date(invoice.updatedAt).toLocaleString("en-NZ") : "—"}</p>
            {invoice.xeroInvoiceId && (
              <p className="font-mono text-[9px] opacity-60">Xero ID: {invoice.xeroInvoiceId}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
