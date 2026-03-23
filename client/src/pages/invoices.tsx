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
import { ReceiptText, Search, CheckCircle2, Send, RotateCcw, FileCheck, AlertTriangle, LinkIcon, FlaskConical } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
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

const INVOICE_TYPE_COLORS: Record<string, string> = {
  deposit: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
  progress: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800",
  variation: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800",
  final: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800",
  retention_release: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
  credit_note: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800",
};

const INVOICE_TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  progress: "Progress",
  variation: "Variation",
  final: "Final",
  retention_release: "Retention Release",
  credit_note: "Credit Note",
};

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "approved") return "default";
  if (status === "returned_to_draft") return "destructive";
  if (status === "ready_for_xero") return "outline";
  return "secondary";
}

class MissingCustomerError extends Error {
  quoteId: string | null;
  constructor(message: string, quoteId: string | null) {
    super(message);
    this.quoteId = quoteId;
  }
}

function InvoiceActions({ inv, onMutate }: { inv: EnrichedInvoice; onMutate: (id: string) => void }) {
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
      <Button
        key="mark-ready"
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        disabled={isPending}
        onClick={() => patchMutation.mutate({ id: inv.id, status: "ready_for_xero" })}
        data-testid={`button-mark-ready-${inv.id}`}
      >
        <FileCheck className="h-3 w-3 mr-1" /> Mark Ready
      </Button>
    );
  }

  if (inv.status === "ready_for_xero") {
    actions.push(
      <Button
        key="push-xero"
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        disabled={isPending}
        onClick={() => pushToXeroMutation.mutate(inv.id)}
        data-testid={`button-push-xero-${inv.id}`}
      >
        <Send className="h-3 w-3 mr-1" /> Push to Xero
      </Button>
    );
    actions.push(
      <Button
        key="back-draft"
        size="sm"
        variant="ghost"
        className="h-7 text-xs text-muted-foreground"
        disabled={isPending}
        onClick={() => patchMutation.mutate({ id: inv.id, status: "draft" })}
        data-testid={`button-back-draft-${inv.id}`}
      >
        <RotateCcw className="h-3 w-3 mr-1" /> Back to Draft
      </Button>
    );
  }

  if (inv.status === "pushed_to_xero_draft") {
    actions.push(
      <Button
        key="approve"
        size="sm"
        variant="outline"
        className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950/30"
        disabled={isPending}
        onClick={() => patchMutation.mutate({ id: inv.id, status: "approved" })}
        data-testid={`button-approve-${inv.id}`}
      >
        <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
      </Button>
    );
    actions.push(
      <Button
        key="return-draft"
        size="sm"
        variant="ghost"
        className="h-7 text-xs text-muted-foreground"
        disabled={isPending}
        onClick={() => returnToDraftMutation.mutate(inv.id)}
        data-testid={`button-return-draft-${inv.id}`}
      >
        <RotateCcw className="h-3 w-3 mr-1" /> Return to Draft
      </Button>
    );
  }

  if (inv.status === "approved") {
    actions.push(
      <Button
        key="return-draft"
        size="sm"
        variant="ghost"
        className="h-7 text-xs text-muted-foreground"
        disabled={isPending}
        onClick={() => returnToDraftMutation.mutate(inv.id)}
        data-testid={`button-return-draft-approved-${inv.id}`}
      >
        <RotateCcw className="h-3 w-3 mr-1" /> Return to Draft
      </Button>
    );
  }

  if (inv.status === "returned_to_draft") {
    actions.push(
      <Button
        key="mark-ready"
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        disabled={isPending}
        onClick={() => patchMutation.mutate({ id: inv.id, status: "ready_for_xero" })}
        data-testid={`button-mark-ready-rtd-${inv.id}`}
      >
        <FileCheck className="h-3 w-3 mr-1" /> Mark Ready
      </Button>
    );
    actions.push(
      <Button
        key="back-draft"
        size="sm"
        variant="ghost"
        className="h-7 text-xs text-muted-foreground"
        disabled={isPending}
        onClick={() => patchMutation.mutate({ id: inv.id, status: "draft" })}
        data-testid={`button-to-draft-rtd-${inv.id}`}
      >
        <RotateCcw className="h-3 w-3 mr-1" /> Back to Draft
      </Button>
    );
  }

  if (actions.length === 0 && !missingCustomerQuoteId) return null;
  return (
    <div className="space-y-2">
      {missingCustomerQuoteId && (
        <Alert data-testid={`alert-missing-customer-${inv.id}`}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            No customer linked — required for Xero.{" "}
            <Link href={`/quote/${missingCustomerQuoteId}`} className="underline font-medium">
              Link a customer on the quote
            </Link>
            .
          </AlertDescription>
        </Alert>
      )}
      {actions.length > 0 && <div className="flex items-center gap-1 flex-wrap">{actions}</div>}
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
      INVOICE_TYPE_LABELS[inv.type]?.toLowerCase().includes(q) ||
      INVOICE_STATUS_LABELS[inv.status]?.toLowerCase().includes(q)
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
            <TableHead className="w-[110px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Number</TableHead>
            <TableHead className="hidden md:table-cell w-[110px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
            <TableHead className="hidden xl:table-cell w-[110px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Xero #</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer</TableHead>
            <TableHead className="hidden lg:table-cell text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project</TableHead>
            <TableHead className="text-right w-[120px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Excl. GST</TableHead>
            <TableHead className="hidden xl:table-cell text-right w-[120px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Incl. GST</TableHead>
            <TableHead className="hidden lg:table-cell w-[90px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quote</TableHead>
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((inv) => (
            <TableRow key={inv.id} className="hover:bg-muted/30" data-testid={`row-invoice-${inv.id}`}>
              <TableCell className="font-mono text-sm font-semibold py-3" data-testid={`text-invoice-number-${inv.id}`}>
                <div className="flex items-center gap-1.5">
                  <Link href={`/invoices/${inv.id}`} className="text-primary underline underline-offset-2 hover:no-underline" data-testid={`link-invoice-detail-${inv.id}`}>
                    {inv.number}
                  </Link>
                  {isAdmin && inv.isDemoRecord && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 shrink-0 font-sans" data-testid={`badge-demo-invoice-${inv.id}`}>
                      <FlaskConical className="h-2.5 w-2.5 mr-0.5" />Demo
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell py-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${INVOICE_TYPE_COLORS[inv.type] ?? "bg-muted text-muted-foreground border-border"}`}>
                  {INVOICE_TYPE_LABELS[inv.type] || inv.type}
                </span>
              </TableCell>
              <TableCell className="py-3">
                <div className="space-y-0.5">
                  <Badge variant={statusVariant(inv.status)} className="text-xs" data-testid={`badge-status-${inv.id}`}>
                    {INVOICE_STATUS_LABELS[inv.status] || inv.status}
                  </Badge>
                  {inv.xeroStatus && (
                    <p className="text-[10px] text-muted-foreground font-mono" data-testid={`text-xero-status-${inv.id}`}>
                      Xero: {inv.xeroStatus}
                    </p>
                  )}
                  {inv.xeroInvoiceId && (inv as any).xeroAmountPaid != null && (() => {
                    const paid = (inv as any).xeroAmountPaid ?? 0;
                    const due = (inv as any).xeroAmountDue ?? 0;
                    if (due <= 0 && paid > 0) {
                      return <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium" data-testid={`text-payment-status-${inv.id}`}>Paid</span>;
                    }
                    if (paid > 0 && due > 0) {
                      return <span className="text-[10px] text-amber-600 dark:text-amber-400" data-testid={`text-payment-status-${inv.id}`}>Partial</span>;
                    }
                    if (due > 0) {
                      return <span className="text-[10px] text-muted-foreground" data-testid={`text-payment-status-${inv.id}`}>Unpaid</span>;
                    }
                    return null;
                  })()}
                </div>
              </TableCell>
              <TableCell className="hidden xl:table-cell font-mono text-xs text-muted-foreground py-3" data-testid={`text-xero-number-${inv.id}`}>
                {inv.xeroInvoiceNumber ?? <span className="opacity-40">—</span>}
              </TableCell>
              <TableCell className="text-sm py-3" data-testid={`text-customer-${inv.id}`}>
                {inv.customerName ? (
                  <span className="font-medium">{inv.customerName}</span>
                ) : (
                  <div className="space-y-0.5">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 gap-1">
                      <LinkIcon className="h-2.5 w-2.5" /> Unlinked
                    </Badge>
                    {inv.quoteId && (
                      <div>
                        <Link href={`/quote/${inv.quoteId}`} className="text-[10px] text-primary underline underline-offset-2 hover:no-underline" data-testid={`link-repair-customer-${inv.id}`}>
                          Link customer →
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </TableCell>
              <TableCell className="hidden lg:table-cell text-sm py-3" data-testid={`text-project-${inv.id}`}>
                {inv.projectName ? (
                  <span className="font-medium">{inv.projectName}</span>
                ) : (
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-muted-foreground italic">No project</span>
                    {inv.quoteId && (
                      <div>
                        <Link href={`/quote/${inv.quoteId}`} className="text-[10px] text-primary underline underline-offset-2 hover:no-underline" data-testid={`link-repair-project-${inv.id}`}>
                          Review record →
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-right py-3">
                <span className="font-mono text-sm font-semibold tabular-nums">
                  ${(inv.amountExclGst ?? 0).toLocaleString("en-NZ", { minimumFractionDigits: 2 })}
                </span>
              </TableCell>
              <TableCell className="hidden xl:table-cell text-right py-3">
                <span className="font-mono text-sm font-medium text-muted-foreground tabular-nums">
                  ${(inv.amountInclGst ?? 0).toLocaleString("en-NZ", { minimumFractionDigits: 2 })}
                </span>
              </TableCell>
              <TableCell className="hidden lg:table-cell py-3">
                {inv.quoteId ? (
                  <Link href={`/quote/${inv.quoteId}`} className="text-primary underline underline-offset-2 hover:no-underline text-xs" data-testid={`link-quote-${inv.id}`}>
                    View quote
                  </Link>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </TableCell>
              <TableCell className="py-3">
                <div className="flex items-center gap-1">
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-7 px-2 text-xs ${inv.isDemoRecord ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}
                      onClick={() => demoFlagMutation.mutate({ id: inv.id, isDemoRecord: !inv.isDemoRecord })}
                      disabled={demoFlagMutation.isPending}
                      data-testid={`button-toggle-demo-invoice-${inv.id}`}
                      title={inv.isDemoRecord ? "Remove demo/test flag" : "Flag as demo/test"}
                    >
                      <FlaskConical className="w-3 h-3" />
                    </Button>
                  )}
                  <InvoiceActions inv={inv} onMutate={() => {}} />
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
