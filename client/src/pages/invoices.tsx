import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Invoice } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ReceiptText, Search, CheckCircle2, Send, RotateCcw, FileCheck, ArrowRight } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

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

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "approved") return "default";
  if (status === "returned_to_draft") return "destructive";
  if (status === "ready_for_xero") return "outline";
  return "secondary";
}

function InvoiceActions({ inv, onMutate }: { inv: EnrichedInvoice; onMutate: (id: string) => void }) {
  const { toast } = useToast();

  const patchMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/invoices/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    },
    onError: (err: Error) => toast({ title: "Action failed", description: err.message, variant: "destructive" }),
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

  if (actions.length === 0) return null;
  return <div className="flex items-center gap-1 flex-wrap">{actions}</div>;
}

export default function InvoicesPage() {
  const [search, setSearch] = useState("");

  const { data: invoices = [], isLoading } = useQuery<EnrichedInvoice[]>({
    queryKey: ["/api/invoices"],
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

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ReceiptText className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold tracking-tight">Invoices</h1>
          {!isLoading && (
            <span className="text-sm text-muted-foreground">({invoices.length})</span>
          )}
        </div>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Search invoices…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-invoices-search"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {search ? "No invoices match your search." : "No invoices yet. Invoices are created from accepted quotes."}
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Xero #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Project</TableHead>
                <TableHead className="text-right">Excl. GST</TableHead>
                <TableHead className="text-right">Incl. GST</TableHead>
                <TableHead>Quote</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inv) => (
                <TableRow key={inv.id} data-testid={`row-invoice-${inv.id}`}>
                  <TableCell className="font-mono text-sm font-medium" data-testid={`text-invoice-number-${inv.id}`}>
                    {inv.number}
                  </TableCell>
                  <TableCell className="text-sm">{INVOICE_TYPE_LABELS[inv.type] || inv.type}</TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <Badge variant={statusVariant(inv.status)} className="text-xs" data-testid={`badge-status-${inv.id}`}>
                        {INVOICE_STATUS_LABELS[inv.status] || inv.status}
                      </Badge>
                      {inv.xeroStatus && (
                        <p className="text-[10px] text-muted-foreground font-mono" data-testid={`text-xero-status-${inv.id}`}>
                          Xero: {inv.xeroStatus}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground" data-testid={`text-xero-number-${inv.id}`}>
                    {inv.xeroInvoiceNumber ?? <span className="opacity-40">—</span>}
                  </TableCell>
                  <TableCell className="text-sm" data-testid={`text-customer-${inv.id}`}>
                    {inv.customerName ?? <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm" data-testid={`text-project-${inv.id}`}>
                    {inv.projectName ?? <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    ${(inv.amountExclGst ?? 0).toLocaleString("en-NZ", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    ${(inv.amountInclGst ?? 0).toLocaleString("en-NZ", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-sm">
                    {inv.quoteId ? (
                      <Link href={`/quote/${inv.quoteId}`} className="text-primary underline underline-offset-2 hover:no-underline text-xs" data-testid={`link-quote-${inv.id}`}>
                        View quote
                      </Link>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <InvoiceActions inv={inv} onMutate={() => {}} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
