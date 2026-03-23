import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Invoice, InvoiceLine } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, ReceiptText, CheckCircle2, Send, RotateCcw, FileCheck,
  RefreshCw, DollarSign, CreditCard, Save, X, Pencil,
  Building2, FolderOpen, FileText, Briefcase, Hash, Layers,
  Clock, CircleDot, Lock, Plus, Trash2, AlertCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";

type EnrichedInvoice = Invoice & {
  customerName: string | null;
  projectName: string | null;
  jobName: string | null;
  jobId: string | null;
  variationTitle: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  ready_for_xero: "Ready for Xero",
  pushed_to_xero_draft: "Pushed to Xero",
  approved: "Approved",
  returned_to_draft: "Returned to Draft",
};

const TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  progress: "Progress",
  variation: "Variation",
  final: "Final",
  retention_release: "Retention Release",
  credit_note: "Credit Note",
};

const TYPE_COLORS: Record<string, string> = {
  deposit: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
  progress: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800",
  variation: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800",
  final: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800",
  retention_release: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
  credit_note: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700",
  ready_for_xero: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800",
  pushed_to_xero_draft: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
  returned_to_draft: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800",
};

function fmtMoney(val: number | null | undefined): string {
  return `$${(val ?? 0).toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function PaymentBadge({ invoice }: { invoice: EnrichedInvoice }) {
  const paid = (invoice as any).xeroAmountPaid ?? 0;
  const due = (invoice as any).xeroAmountDue ?? 0;
  if (!invoice.xeroInvoiceId) return null;
  if ((invoice as any).xeroAmountPaid == null) return null;

  if (due <= 0 && paid > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" data-testid="badge-payment-paid">
        <DollarSign className="h-3 w-3" /> Paid
      </span>
    );
  }
  if (paid > 0 && due > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" data-testid="badge-payment-partial">
        <CreditCard className="h-3 w-3" /> Partial
      </span>
    );
  }
  if (due > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" data-testid="badge-payment-unpaid">
        <Clock className="h-3 w-3" /> Unpaid
      </span>
    );
  }
  return null;
}

const XERO_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  AUTHORISED: "Authorised",
  PAID: "Paid",
  VOIDED: "Voided",
  DELETED: "Deleted",
};

const XERO_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  SUBMITTED: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  AUTHORISED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  VOIDED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  DELETED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

type EditingLine = {
  id: string;
  description: string;
  quantity: string;
  unitAmount: string;
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editReference, setEditReference] = useState("");
  const [editingLine, setEditingLine] = useState<EditingLine | null>(null);
  const [addingLine, setAddingLine] = useState(false);
  const [newLine, setNewLine] = useState({ description: "", quantity: "1", unitAmount: "" });

  const { data: invoice, isLoading } = useQuery<EnrichedInvoice>({
    queryKey: ["/api/invoices", id],
    queryFn: async () => {
      const res = await fetch(`/api/invoices/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load invoice");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: lines = [] } = useQuery<InvoiceLine[]>({
    queryKey: ["/api/invoices", id, "lines"],
    queryFn: async () => {
      const res = await fetch(`/api/invoices/${id}/lines`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load lines");
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
      const xStatus = data.xeroPayment?.status;
      const xLabel = XERO_STATUS_LABELS[xStatus] ?? xStatus ?? "Unknown";
      toast({
        title: "Synced from Xero",
        description: `Xero status: ${xLabel} — Paid: ${fmtMoney(data.xeroPayment?.amountPaid)} / Due: ${fmtMoney(data.xeroPayment?.amountDue)}`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Xero sync failed", description: err.message, variant: "destructive" });
    },
  });

  function handleDemotionToast(data: any, action: string) {
    if (data?._demotedToDraft) {
      toast({
        title: `${action} — status returned to Draft`,
        description: "The invoice was in 'Ready for Xero' and has been returned to Draft because line items were changed. Mark it ready again when editing is complete.",
      });
    } else {
      toast({ title: action });
    }
  }

  const addLineMutation = useMutation({
    mutationFn: async (data: { description: string; quantity: number; unitAmount: number | null }) => {
      const res = await apiRequest("POST", `/api/invoices/${id}/lines`, data);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to add line");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", id, "lines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setAddingLine(false);
      setNewLine({ description: "", quantity: "1", unitAmount: "" });
      handleDemotionToast(data, "Line added");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add line", description: err.message, variant: "destructive" });
    },
  });

  const updateLineMutation = useMutation({
    mutationFn: async ({ lineId, data }: { lineId: string; data: Record<string, any> }) => {
      const res = await apiRequest("PATCH", `/api/invoice-lines/${lineId}`, data);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update line");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", id, "lines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setEditingLine(null);
      handleDemotionToast(data, "Line updated");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update line", description: err.message, variant: "destructive" });
    },
  });

  const deleteLineMutation = useMutation({
    mutationFn: async (lineId: string) => {
      const res = await apiRequest("DELETE", `/api/invoice-lines/${lineId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to delete line");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", id, "lines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      handleDemotionToast(data, "Line removed");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to remove line", description: err.message, variant: "destructive" });
    },
  });

  const isPushed = invoice?.status === "pushed_to_xero_draft" || invoice?.status === "approved";
  const isDraft = invoice?.status === "draft";
  const isReadyForXero = invoice?.status === "ready_for_xero";
  const isReturnedToDraft = invoice?.status === "returned_to_draft";
  const isEditable = isDraft || isReadyForXero || isReturnedToDraft;
  const isPending = patchMutation.isPending || statusMutation.isPending || pushToXeroMutation.isPending || returnToDraftMutation.isPending;
  const isLineBusy = addLineMutation.isPending || updateLineMutation.isPending || deleteLineMutation.isPending;

  useEffect(() => {
    if (editingField && !isEditable) {
      setEditingField(null);
    }
    if (!isEditable) {
      setEditingLine(null);
      setAddingLine(false);
    }
  }, [isEditable, editingField]);

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
    if (field === "notes") setEditNotes(invoice.notes ?? "");
    if (field === "reference") setEditReference((invoice as any).reference ?? "");
    setEditingField(field);
  }

  function cancelEdit() { setEditingField(null); }

  function saveEdit(field: string) {
    if (!isEditable) return;
    if (field === "notes") patchMutation.mutate({ notes: editNotes || null });
    if (field === "reference") patchMutation.mutate({ reference: editReference || null });
  }

  function startLineEdit(line: InvoiceLine) {
    setEditingLine({
      id: line.id,
      description: line.description ?? "",
      quantity: String(line.quantity ?? 1),
      unitAmount: line.unitAmount != null ? String(line.unitAmount) : "",
    });
  }

  function saveLineEdit() {
    if (!editingLine) return;
    const qty = parseFloat(editingLine.quantity) || 1;
    const ua = editingLine.unitAmount.trim() ? parseFloat(editingLine.unitAmount) : null;
    updateLineMutation.mutate({
      lineId: editingLine.id,
      data: {
        description: editingLine.description || null,
        quantity: qty,
        unitAmount: ua,
      },
    });
  }

  function submitAddLine() {
    const qty = parseFloat(newLine.quantity) || 1;
    const ua = newLine.unitAmount.trim() ? parseFloat(newLine.unitAmount) : null;
    addLineMutation.mutate({
      description: newLine.description || "",
      quantity: qty,
      unitAmount: ua,
    });
  }

  const xPaid = (invoice as any).xeroAmountPaid;
  const xDue = (invoice as any).xeroAmountDue;
  const xSynced = (invoice as any).xeroLastSyncedAt;

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="border-b px-4 sm:px-6 py-2.5 bg-card shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/invoices">
              <Button variant="ghost" size="sm" className="h-8 gap-1 shrink-0" data-testid="button-back-invoices">
                <ArrowLeft className="h-4 w-4" /> Invoices
              </Button>
            </Link>
            <Separator orientation="vertical" className="h-5" />
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary shrink-0">
                <ReceiptText className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base font-bold tracking-tight font-mono" data-testid="text-invoice-number">
                    {invoice.number}
                  </h1>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${TYPE_COLORS[invoice.type] ?? "bg-muted text-muted-foreground border-border"}`}>
                    {TYPE_LABELS[invoice.type] || invoice.type}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${STATUS_COLORS[invoice.status] ?? "bg-muted text-muted-foreground border-border"}`} data-testid="badge-detail-status">
                    {STATUS_LABELS[invoice.status] || invoice.status}
                  </span>
                  <PaymentBadge invoice={invoice} />
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isDraft && (
              <Button size="sm" variant="outline" className="h-8 text-xs" disabled={isPending}
                onClick={() => statusMutation.mutate("ready_for_xero")} data-testid="button-mark-ready">
                <FileCheck className="h-3 w-3 mr-1" /> Mark Ready
              </Button>
            )}
            {isReadyForXero && (
              <>
                <Button size="sm" className="h-8 text-xs" disabled={isPending}
                  onClick={() => pushToXeroMutation.mutate()} data-testid="button-push-xero">
                  <Send className="h-3 w-3 mr-1" /> Push to Xero
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" disabled={isPending}
                  onClick={() => statusMutation.mutate("draft")} data-testid="button-back-draft">
                  <RotateCcw className="h-3 w-3 mr-1" /> Back to Draft
                </Button>
              </>
            )}
            {invoice.status === "pushed_to_xero_draft" && (
              <>
                <Button size="sm" variant="outline" className="h-8 text-xs text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950/30"
                  disabled={isPending} onClick={() => statusMutation.mutate("approved")} data-testid="button-approve">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" disabled={isPending}
                  onClick={() => returnToDraftMutation.mutate()} data-testid="button-return-draft">
                  <RotateCcw className="h-3 w-3 mr-1" /> Return to Draft
                </Button>
              </>
            )}
            {invoice.status === "approved" && (
              <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" disabled={isPending}
                onClick={() => returnToDraftMutation.mutate()} data-testid="button-return-draft-approved">
                <RotateCcw className="h-3 w-3 mr-1" /> Return to Draft
              </Button>
            )}
            {isReturnedToDraft && (
              <>
                <Button size="sm" variant="outline" className="h-8 text-xs" disabled={isPending}
                  onClick={() => statusMutation.mutate("ready_for_xero")} data-testid="button-mark-ready-rtd">
                  <FileCheck className="h-3 w-3 mr-1" /> Mark Ready
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" disabled={isPending}
                  onClick={() => statusMutation.mutate("draft")} data-testid="button-to-draft-rtd">
                  <RotateCcw className="h-3 w-3 mr-1" /> Back to Draft
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-5xl mx-auto space-y-4">

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 space-y-1">
              <div className="flex items-center gap-2 px-1 mb-1">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium" data-testid="text-detail-customer">
                  {invoice.customerName || <span className="text-muted-foreground italic">No customer linked</span>}
                </span>
              </div>
              {invoice.projectName && (
                <div className="flex items-center gap-2 px-1">
                  <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground" data-testid="text-detail-project">{invoice.projectName}</span>
                </div>
              )}
            </div>
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Reference</span>
                {editingField !== "reference" && isEditable && (
                  <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] gap-0.5 text-muted-foreground hover:text-foreground" onClick={() => startEdit("reference")} data-testid="button-edit-reference">
                    <Pencil className="h-2.5 w-2.5" /> Edit
                  </Button>
                )}
                {isPushed && (
                  <Lock className="h-3 w-3 text-muted-foreground/50" />
                )}
              </div>
              {editingField === "reference" ? (
                <div className="flex items-center gap-1.5">
                  <Input value={editReference} onChange={(e) => setEditReference(e.target.value)}
                    placeholder="PO number, job ref..." className="h-7 text-sm flex-1" data-testid="input-edit-reference" />
                  <Button size="sm" className="h-7 px-2" disabled={patchMutation.isPending} onClick={() => saveEdit("reference")} data-testid="button-save-reference">
                    <Save className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={cancelEdit} data-testid="button-cancel-reference">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <p className="text-sm font-mono" data-testid="text-reference">
                  {(invoice as any).reference || <span className="text-muted-foreground italic font-sans text-xs">No reference set</span>}
                </p>
              )}
            </div>
          </div>

          <Card data-testid="card-invoice-body">
            <CardContent className="p-0">
              <div className="rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Description</TableHead>
                      <TableHead className="w-[80px] text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Qty</TableHead>
                      <TableHead className="w-[120px] text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Unit Amount</TableHead>
                      <TableHead className="w-[120px] text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Line Total</TableHead>
                      {isEditable && <TableHead className="w-[70px]" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line) => {
                      const isEditingThis = editingLine?.id === line.id;
                      const lineTotal = line.lineAmountExclGst ?? ((line.quantity ?? 1) * (line.unitAmount ?? 0));
                      return (
                        <TableRow key={line.id} data-testid={`row-line-item-${line.id}`}>
                          <TableCell className="py-2.5">
                            {isEditingThis ? (
                              <Textarea
                                value={editingLine!.description}
                                onChange={(e) => setEditingLine({ ...editingLine!, description: e.target.value })}
                                placeholder="Line description…"
                                className="text-sm min-h-[50px]"
                                data-testid="input-edit-line-description"
                              />
                            ) : (
                              <div>
                                <p className="text-sm whitespace-pre-wrap" data-testid="text-line-description">
                                  {line.description || <span className="text-muted-foreground italic text-xs">No description</span>}
                                </p>
                                {line.lineType && line.lineType !== "standard" && (
                                  <span className="text-[10px] text-muted-foreground">{TYPE_LABELS[line.lineType] || line.lineType}</span>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center py-2.5">
                            {isEditingThis ? (
                              <Input
                                type="number"
                                value={editingLine!.quantity}
                                onChange={(e) => setEditingLine({ ...editingLine!, quantity: e.target.value })}
                                className="h-8 text-sm text-center w-16 mx-auto"
                                data-testid="input-edit-line-qty"
                                step="any"
                              />
                            ) : (
                              <span className="font-mono text-sm tabular-nums" data-testid="text-line-qty">{line.quantity ?? 1}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right py-2.5">
                            {isEditingThis ? (
                              <Input
                                type="number"
                                value={editingLine!.unitAmount}
                                onChange={(e) => setEditingLine({ ...editingLine!, unitAmount: e.target.value })}
                                className="h-8 text-sm text-right w-28 ml-auto"
                                data-testid="input-edit-line-unit"
                                step="any"
                                placeholder="0.00"
                              />
                            ) : (
                              <span className="font-mono text-sm tabular-nums" data-testid="text-line-unit">{fmtMoney(line.unitAmount)}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right py-2.5">
                            <span className="font-mono text-sm font-semibold tabular-nums" data-testid="text-line-total">
                              {fmtMoney(lineTotal)}
                            </span>
                          </TableCell>
                          {isEditable && (
                            <TableCell className="text-right py-2.5">
                              {isEditingThis ? (
                                <div className="flex items-center gap-1 justify-end">
                                  <Button size="sm" className="h-7 px-2" disabled={updateLineMutation.isPending} onClick={saveLineEdit} data-testid="button-save-line">
                                    <Save className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingLine(null)} data-testid="button-cancel-line">
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 justify-end">
                                  <Button variant="ghost" size="sm" className="h-7 px-1.5 text-muted-foreground hover:text-foreground"
                                    onClick={() => startLineEdit(line)} data-testid={`button-edit-line-${line.id}`}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 px-1.5 text-muted-foreground hover:text-destructive"
                                    disabled={deleteLineMutation.isPending}
                                    onClick={() => deleteLineMutation.mutate(line.id)} data-testid={`button-delete-line-${line.id}`}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}

                    {lines.length === 0 && !addingLine && (
                      <TableRow>
                        <TableCell colSpan={isEditable ? 5 : 4} className="text-center py-6 text-muted-foreground text-sm italic">
                          No line items
                        </TableCell>
                      </TableRow>
                    )}

                    {addingLine && (
                      <TableRow data-testid="row-add-line">
                        <TableCell className="py-2.5">
                          <Textarea
                            value={newLine.description}
                            onChange={(e) => setNewLine({ ...newLine, description: e.target.value })}
                            placeholder="Line description…"
                            className="text-sm min-h-[50px]"
                            data-testid="input-new-line-description"
                          />
                        </TableCell>
                        <TableCell className="text-center py-2.5">
                          <Input
                            type="number"
                            value={newLine.quantity}
                            onChange={(e) => setNewLine({ ...newLine, quantity: e.target.value })}
                            className="h-8 text-sm text-center w-16 mx-auto"
                            data-testid="input-new-line-qty"
                            step="any"
                          />
                        </TableCell>
                        <TableCell className="text-right py-2.5">
                          <Input
                            type="number"
                            value={newLine.unitAmount}
                            onChange={(e) => setNewLine({ ...newLine, unitAmount: e.target.value })}
                            className="h-8 text-sm text-right w-28 ml-auto"
                            data-testid="input-new-line-unit"
                            step="any"
                            placeholder="0.00"
                          />
                        </TableCell>
                        <TableCell className="text-right py-2.5">
                          <span className="font-mono text-sm tabular-nums text-muted-foreground">
                            {fmtMoney((parseFloat(newLine.quantity) || 1) * (parseFloat(newLine.unitAmount) || 0))}
                          </span>
                        </TableCell>
                        <TableCell className="text-right py-2.5">
                          <div className="flex items-center gap-1 justify-end">
                            <Button size="sm" className="h-7 px-2" disabled={addLineMutation.isPending} onClick={submitAddLine} data-testid="button-confirm-add-line">
                              <Save className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setAddingLine(false)} data-testid="button-cancel-add-line">
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {isEditable && !addingLine && (
                  <div className="px-4 py-2 border-t">
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                      disabled={isLineBusy} onClick={() => setAddingLine(true)} data-testid="button-add-line">
                      <Plus className="h-3 w-3" /> Add Line
                    </Button>
                  </div>
                )}

                <div className="border-t bg-muted/30">
                  <div className="max-w-xs ml-auto px-4 py-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Subtotal</span>
                      <span className="font-mono text-sm tabular-nums" data-testid="text-amount-excl">{fmtMoney(invoice.amountExclGst)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">GST (15%)</span>
                      <span className="font-mono text-sm tabular-nums text-muted-foreground" data-testid="text-amount-gst">{fmtMoney(invoice.gstAmount)}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">Total</span>
                      <span className="font-mono text-base font-bold tabular-nums" data-testid="text-amount-incl">{fmtMoney(invoice.amountInclGst)}</span>
                    </div>
                    {xPaid != null && (
                      <>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Amount Paid</span>
                          <span className="font-mono text-sm tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold" data-testid="text-xero-paid">{fmtMoney(xPaid)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">Amount Due</span>
                          <span className="font-mono text-sm tabular-nums font-bold" data-testid="text-xero-due">{fmtMoney(xDue)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {isPushed && (
            <div className="flex items-center gap-2 px-1 text-[10px] text-muted-foreground">
              <Lock className="h-3 w-3" />
              <span>Invoice body is locked — pushed to Xero. Return to draft to make changes.</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="md:col-span-1">
              <CardContent className="pt-4 pb-4">
                <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Linkage</h3>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                    {invoice.quoteId ? (
                      <Link href={`/quote/${invoice.quoteId}`} className="text-xs text-primary hover:underline truncate" data-testid="link-detail-quote">
                        View quote
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground italic" data-testid="link-detail-quote">No quote</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-3 w-3 text-muted-foreground shrink-0" />
                    {invoice.projectId ? (
                      <span className="text-xs truncate" data-testid="text-link-project">{invoice.projectName || "Linked project"}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">No project</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-3 w-3 text-muted-foreground shrink-0" />
                    {invoice.jobName ? (
                      <Link href={`/job/${invoice.jobId}`} className="text-xs text-primary hover:underline truncate" data-testid="link-detail-job">
                        {invoice.jobName}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground italic" data-testid="link-detail-job">No estimate</span>
                    )}
                  </div>
                  {(invoice.type === "variation" || invoice.variationTitle) && (
                    <div className="flex items-center gap-2">
                      <Layers className="h-3 w-3 text-muted-foreground shrink-0" />
                      {invoice.variationTitle ? (
                        <span className="text-xs" data-testid="text-variation-title">{invoice.variationTitle}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No variation</span>
                      )}
                    </div>
                  )}
                  {invoice.divisionCode && (
                    <div className="flex items-center gap-2">
                      <Hash className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-xs font-mono">{invoice.divisionCode}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-1">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Xero Integration</h3>
                  {invoice.xeroInvoiceId && (
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1"
                      disabled={syncFromXeroMutation.isPending}
                      onClick={() => syncFromXeroMutation.mutate()}
                      data-testid="button-sync-xero">
                      <RefreshCw className={`h-3 w-3 ${syncFromXeroMutation.isPending ? "animate-spin" : ""}`} />
                      Sync from Xero
                    </Button>
                  )}
                </div>
                {invoice.xeroInvoiceId ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">Xero Invoice</span>
                      <span className="font-mono text-xs font-medium" data-testid="text-xero-number">{invoice.xeroInvoiceNumber}</span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">SteelIQ Status</span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${STATUS_COLORS[invoice.status] ?? "bg-muted text-muted-foreground border-border"}`} data-testid="text-steeliq-status">
                          {STATUS_LABELS[invoice.status] || invoice.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">Xero Status</span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${XERO_STATUS_COLORS[invoice.xeroStatus ?? ""] ?? "bg-muted text-muted-foreground"}`} data-testid="text-xero-status">
                          {XERO_STATUS_LABELS[invoice.xeroStatus ?? ""] ?? invoice.xeroStatus ?? "Unknown"}
                        </span>
                      </div>
                      {xPaid != null && (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">Payment</span>
                          <span className="text-[10px] font-medium" data-testid="text-xero-payment-summary">
                            {(xDue ?? 0) <= 0 && (xPaid ?? 0) > 0
                              ? <span className="text-emerald-600 dark:text-emerald-400">Paid in full</span>
                              : (xPaid ?? 0) > 0 && (xDue ?? 0) > 0
                                ? <span className="text-amber-600 dark:text-amber-400">Part paid ({fmtMoney(xPaid)})</span>
                                : <span className="text-muted-foreground">Unpaid</span>
                            }
                          </span>
                        </div>
                      )}
                    </div>

                    {invoice.xeroStatus === "AUTHORISED" && invoice.status === "pushed_to_xero_draft" && (
                      <div className="flex items-start gap-1.5 p-2 rounded-md bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800" data-testid="cue-xero-authorised-pending">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-snug">
                          This invoice has been authorised in Xero. Click <strong>Approve</strong> above to confirm the SteelIQ business signoff.
                        </p>
                      </div>
                    )}

                    {xSynced && (
                      <p className="text-[9px] text-muted-foreground">
                        Last synced: {new Date(xSynced).toLocaleString("en-NZ")}
                      </p>
                    )}
                    <p className="text-[8px] font-mono text-muted-foreground/50 truncate">{invoice.xeroInvoiceId}</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                    Not pushed to Xero
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-1">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Internal Notes</h3>
                  {editingField !== "notes" && isEditable && (
                    <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] gap-0.5 text-muted-foreground hover:text-foreground" onClick={() => startEdit("notes")} data-testid="button-edit-notes">
                      <Pencil className="h-2.5 w-2.5" /> Edit
                    </Button>
                  )}
                </div>
                {editingField === "notes" ? (
                  <div className="space-y-1.5">
                    <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Internal notes…" className="text-sm min-h-[50px]" data-testid="input-edit-notes" />
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" className="h-7 text-xs" disabled={patchMutation.isPending} onClick={() => saveEdit("notes")} data-testid="button-save-notes">
                        <Save className="h-3 w-3 mr-1" /> Save
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancelEdit} data-testid="button-cancel-notes">Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs whitespace-pre-wrap" data-testid="text-notes">
                    {invoice.notes || <span className="text-muted-foreground italic">No notes</span>}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
            <div className="flex items-center gap-4">
              <span>Created: {invoice.createdAt ? new Date(invoice.createdAt).toLocaleString("en-NZ") : "—"}</span>
              <span>Updated: {invoice.updatedAt ? new Date(invoice.updatedAt).toLocaleString("en-NZ") : "—"}</span>
            </div>
            {invoice.divisionCode && (
              <span className="font-mono">{invoice.divisionCode}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
