import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Invoice } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ReceiptText, Search, CheckCircle2, Send, RotateCcw, FileCheck,
  AlertTriangle, LinkIcon, FlaskConical, DollarSign, CreditCard, Clock,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";

type EnrichedInvoice = Invoice & {
  customerName: string | null;
  projectName: string | null;
  jobName: string | null;
  jobId: string | null;
  variationTitle: string | null;
};

const XERO_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Xero Draft",
  SUBMITTED: "Submitted",
  AUTHORISED: "Authorised",
  PAID: "Paid",
  VOIDED: "Voided",
  DELETED: "Deleted",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  ready_for_xero: "Ready",
  pushed_to_xero_draft: "In Xero",
  approved: "Approved",
  returned_to_draft: "Returned",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700",
  ready_for_xero: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800",
  pushed_to_xero_draft: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
  returned_to_draft: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800",
};

const TYPE_COLORS: Record<string, string> = {
  deposit: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
  progress: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800",
  variation: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800",
  final: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800",
  retention_release: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
  credit_note: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800",
};

const TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  progress: "Progress",
  variation: "Variation",
  final: "Final",
  retention_release: "Retention",
  credit_note: "Credit Note",
};

class MissingCustomerError extends Error {
  quoteId: string | null;
  constructor(message: string, quoteId: string | null) {
    super(message);
    this.quoteId = quoteId;
  }
}

function PaymentIndicator({ inv }: { inv: EnrichedInvoice }) {
  if (!inv.xeroInvoiceId) return null;
  const paid = (inv as any).xeroAmountPaid ?? 0;
  const due = (inv as any).xeroAmountDue ?? 0;
  if ((inv as any).xeroAmountPaid == null) return null;

  if (due <= 0 && paid > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400" data-testid={`text-payment-status-${inv.id}`}>
        <DollarSign className="h-2.5 w-2.5" /> Paid
      </span>
    );
  }
  if (paid > 0 && due > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400" data-testid={`text-payment-status-${inv.id}`}>
        <CreditCard className="h-2.5 w-2.5" /> Partial (${paid.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
      </span>
    );
  }
  if (due > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground" data-testid={`text-payment-status-${inv.id}`}>
        <Clock className="h-2.5 w-2.5" /> Unpaid
      </span>
    );
  }
  return null;
}

function InvoiceActions({ inv }: { inv: EnrichedInvoice }) {
  const { toast } = useToast();
  const [missingCustomerQuoteId, setMissingCustomerQuoteId] = useState<string | null>(null);

  const patchMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/invoices/${id}`, { status });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.code === "MISSING_CUSTOMER") {
          throw new MissingCustomerError(body.error ?? "No customer linked", body.quoteId ?? null);
        }
        throw new Error(body.error ?? "Action failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setMissingCustomerQuoteId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    },
    onError: (err: Error) => {
      if (err instanceof MissingCustomerError) {
        setMissingCustomerQuoteId(err.quoteId);
      } else {
        setMissingCustomerQuoteId(null);
        toast({ title: "Action failed", description: err.message, variant: "destructive" });
      }
    },
  });

  const pushToXeroMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/invoices/${id}/push-to-xero`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      if (data?.xeroInvoiceNumber) {
        toast({ title: `Pushed to Xero as ${data.xeroInvoiceNumber}` });
      } else {
        toast({ title: "Pushed to Xero" });
      }
    },
    onError: (err: Error) => toast({ title: "Push to Xero failed", description: err.message, variant: "destructive" }),
  });

  const returnToDraftMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/invoices/${id}/return-to-draft`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      if (data?.xeroWarning) {
        toast({ title: "Returned to draft", description: data.xeroWarning, variant: "destructive" });
      } else {
        toast({ title: "Returned to draft" });
      }
    },
    onError: (err: Error) => toast({ title: "Action failed", description: err.message, variant: "destructive" }),
  });

  const isPending = patchMutation.isPending || pushToXeroMutation.isPending || returnToDraftMutation.isPending;

  const actions: JSX.Element[] = [];

  if (inv.status === "draft") {
    actions.push(
      <Button key="mark-ready" size="sm" variant="outline" className="h-6 text-[10px] px-2" disabled={isPending}
        onClick={() => patchMutation.mutate({ id: inv.id, status: "ready_for_xero" })} data-testid={`button-mark-ready-${inv.id}`}>
        <FileCheck className="h-2.5 w-2.5 mr-0.5" /> Ready
      </Button>
    );
  }
  if (inv.status === "ready_for_xero") {
    actions.push(
      <Button key="push-xero" size="sm" variant="outline" className="h-6 text-[10px] px-2" disabled={isPending}
        onClick={() => pushToXeroMutation.mutate(inv.id)} data-testid={`button-push-xero-${inv.id}`}>
        <Send className="h-2.5 w-2.5 mr-0.5" /> Push
      </Button>
    );
    actions.push(
      <Button key="back-draft" size="sm" variant="ghost" className="h-6 text-[10px] px-1.5 text-muted-foreground" disabled={isPending}
        onClick={() => patchMutation.mutate({ id: inv.id, status: "draft" })} data-testid={`button-back-draft-${inv.id}`}>
        <RotateCcw className="h-2.5 w-2.5" />
      </Button>
    );
  }
  if (inv.status === "pushed_to_xero_draft") {
    actions.push(
      <Button key="approve" size="sm" variant="outline" className="h-6 text-[10px] px-2 text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950/30"
        disabled={isPending} onClick={() => patchMutation.mutate({ id: inv.id, status: "approved" })} data-testid={`button-approve-${inv.id}`}>
        <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Approve
      </Button>
    );
    actions.push(
      <Button key="return-draft" size="sm" variant="ghost" className="h-6 text-[10px] px-1.5 text-muted-foreground" disabled={isPending}
        onClick={() => returnToDraftMutation.mutate(inv.id)} data-testid={`button-return-draft-${inv.id}`}>
        <RotateCcw className="h-2.5 w-2.5" />
      </Button>
    );
  }
  if (inv.status === "approved") {
    actions.push(
      <Button key="return-draft" size="sm" variant="ghost" className="h-6 text-[10px] px-1.5 text-muted-foreground" disabled={isPending}
        onClick={() => returnToDraftMutation.mutate(inv.id)} data-testid={`button-return-draft-approved-${inv.id}`}>
        <RotateCcw className="h-2.5 w-2.5 mr-0.5" /> Return
      </Button>
    );
  }
  if (inv.status === "returned_to_draft") {
    actions.push(
      <Button key="mark-ready" size="sm" variant="outline" className="h-6 text-[10px] px-2" disabled={isPending}
        onClick={() => patchMutation.mutate({ id: inv.id, status: "ready_for_xero" })} data-testid={`button-mark-ready-rtd-${inv.id}`}>
        <FileCheck className="h-2.5 w-2.5 mr-0.5" /> Ready
      </Button>
    );
    actions.push(
      <Button key="back-draft" size="sm" variant="ghost" className="h-6 text-[10px] px-1.5 text-muted-foreground" disabled={isPending}
        onClick={() => patchMutation.mutate({ id: inv.id, status: "draft" })} data-testid={`button-to-draft-rtd-${inv.id}`}>
        <RotateCcw className="h-2.5 w-2.5" />
      </Button>
    );
  }

  if (actions.length === 0 && !missingCustomerQuoteId) return null;
  return (
    <div className="space-y-1">
      {missingCustomerQuoteId && (
        <Alert className="py-1.5 px-2" data-testid={`alert-missing-customer-${inv.id}`}>
          <AlertTriangle className="h-3 w-3" />
          <AlertDescription className="text-[10px]">
            No customer linked.{" "}
            <Link href={`/quote/${missingCustomerQuoteId}`} className="underline font-medium">Fix on quote</Link>
          </AlertDescription>
        </Alert>
      )}
      {actions.length > 0 && <div className="flex items-center gap-0.5 flex-wrap">{actions}</div>}
    </div>
  );
}

export default function InvoicesPage() {
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "owner" || user?.role === "admin";

  const { data: invoices = [], isLoading } = useQuery<EnrichedInvoice[]>({
    queryKey: ["/api/invoices"],
  });

  const demoFlagMutation = useMutation({
    mutationFn: async ({ id, isDemoRecord }: { id: string; isDemoRecord: boolean }) => {
      const res = await apiRequest("PATCH", `/api/invoices/${id}/demo-flag`, { isDemoRecord });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Demo flag updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const filtered = invoices.filter((inv) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      inv.number.toLowerCase().includes(q) ||
      (inv.xeroInvoiceNumber ?? "").toLowerCase().includes(q) ||
      (inv.customerName ?? "").toLowerCase().includes(q) ||
      (inv.projectName ?? "").toLowerCase().includes(q) ||
      ((inv as any).jobName ?? "").toLowerCase().includes(q) ||
      TYPE_LABELS[inv.type]?.toLowerCase().includes(q) ||
      STATUS_LABELS[inv.status]?.toLowerCase().includes(q)
    );
  });

  const tableContent = isLoading ? (
    <div className="text-sm text-muted-foreground p-4">Loading…</div>
  ) : filtered.length === 0 ? (
    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      {search ? "No invoices match your search." : "No invoices yet. Invoices are created from accepted quotes."}
    </div>
  ) : (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[140px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Invoice</TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Customer / Project</TableHead>
            <TableHead className="text-right w-[120px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Amount</TableHead>
            <TableHead className="hidden lg:table-cell text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Xero / Payment</TableHead>
            <TableHead className="w-[120px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((inv) => (
            <TableRow key={inv.id} className="group hover:bg-muted/30" data-testid={`row-invoice-${inv.id}`}>
              <TableCell className="py-2.5" data-testid={`text-invoice-number-${inv.id}`}>
                <Link href={`/invoices/${inv.id}`} className="group/link flex items-center gap-1" data-testid={`link-invoice-detail-${inv.id}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-sm font-bold text-primary group-hover/link:underline underline-offset-2">
                        {inv.number}
                      </span>
                      {isAdmin && inv.isDemoRecord && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 shrink-0 font-sans" data-testid={`badge-demo-invoice-${inv.id}`}>
                          <FlaskConical className="h-2 w-2 mr-0.5" />Demo
                        </Badge>
                      )}
                    </div>
                    <span className={`inline-flex items-center px-1.5 py-0 rounded-full text-[9px] font-medium border mt-0.5 ${TYPE_COLORS[inv.type] ?? "bg-muted text-muted-foreground border-border"}`}>
                      {TYPE_LABELS[inv.type] || inv.type}
                    </span>
                  </div>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/40 group-hover/link:text-primary shrink-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </TableCell>

              <TableCell className="py-2.5">
                <div className="space-y-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_COLORS[inv.status] ?? "bg-muted text-muted-foreground border-border"}`} data-testid={`badge-status-${inv.id}`}>
                    {STATUS_LABELS[inv.status] || inv.status}
                  </span>
                </div>
              </TableCell>

              <TableCell className="py-2.5" data-testid={`text-customer-${inv.id}`}>
                <div className="min-w-0">
                  {inv.customerName ? (
                    <p className="text-sm font-medium truncate">{inv.customerName}</p>
                  ) : (
                    <div className="space-y-0.5">
                      <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 gap-0.5">
                        <LinkIcon className="h-2 w-2" /> Unlinked
                      </Badge>
                      {inv.quoteId && (
                        <div>
                          <Link href={`/quote/${inv.quoteId}`} className="text-[10px] text-primary underline underline-offset-2 hover:no-underline" data-testid={`link-repair-customer-${inv.id}`}>
                            Link customer
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                  {inv.projectName && (
                    <p className="text-[11px] text-muted-foreground truncate" data-testid={`text-project-${inv.id}`}>{inv.projectName}</p>
                  )}
                  {(inv as any).jobName && (
                    <p className="text-[10px] text-muted-foreground/70 truncate">Est: {(inv as any).jobName}</p>
                  )}
                </div>
              </TableCell>

              <TableCell className="text-right py-2.5">
                <div>
                  <span className="font-mono text-sm font-bold tabular-nums">
                    ${(inv.amountExclGst ?? 0).toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <p className="font-mono text-[10px] text-muted-foreground tabular-nums">
                    incl ${(inv.amountInclGst ?? 0).toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </TableCell>

              <TableCell className="hidden lg:table-cell py-2.5">
                <div className="space-y-0.5">
                  {inv.xeroInvoiceNumber ? (
                    <p className="font-mono text-[11px] text-muted-foreground" data-testid={`text-xero-number-${inv.id}`}>{inv.xeroInvoiceNumber}</p>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/50">No Xero</span>
                  )}
                  {inv.xeroStatus && (
                    <p className="text-[9px] text-muted-foreground font-mono" data-testid={`text-xero-status-${inv.id}`}>{XERO_STATUS_LABELS[inv.xeroStatus] ?? inv.xeroStatus}</p>
                  )}
                  {inv.xeroStatus === "AUTHORISED" && inv.status === "pushed_to_xero_draft" && (
                    <p className="text-[8px] text-amber-600 dark:text-amber-400 font-medium" data-testid={`text-xero-approval-hint-${inv.id}`}>Approval pending</p>
                  )}
                  <PaymentIndicator inv={inv} />
                </div>
              </TableCell>

              <TableCell className="py-2.5">
                <div className="flex items-center gap-0.5">
                  {isAdmin && (
                    <Button variant="ghost" size="sm"
                      className={`h-6 w-6 p-0 ${inv.isDemoRecord ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground/40"}`}
                      onClick={() => demoFlagMutation.mutate({ id: inv.id, isDemoRecord: !inv.isDemoRecord })}
                      disabled={demoFlagMutation.isPending}
                      data-testid={`button-toggle-demo-invoice-${inv.id}`}
                      title={inv.isDemoRecord ? "Remove demo flag" : "Flag as demo"}>
                      <FlaskConical className="w-3 h-3" />
                    </Button>
                  )}
                  <InvoiceActions inv={inv} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="border-b px-4 sm:px-6 py-3 flex items-center justify-between gap-3 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary shrink-0">
            <ReceiptText className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold tracking-tight">Invoices</h1>
              {!isLoading && <span className="text-xs text-muted-foreground">({invoices.length})</span>}
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">All invoices across projects and quotes</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm w-56"
            placeholder="Search invoices…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-invoices-search"
          />
        </div>
      </header>
      <div className="flex-1 overflow-auto p-4 sm:p-6">{tableContent}</div>
    </div>
  );
}
