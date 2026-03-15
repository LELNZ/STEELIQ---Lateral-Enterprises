import { useQuery } from "@tanstack/react-query";
import type { Invoice } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ReceiptText, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

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

export default function InvoicesPage() {
  const [search, setSearch] = useState("");

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const filtered = invoices.filter((inv) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      inv.number.toLowerCase().includes(q) ||
      (inv.xeroInvoiceNumber ?? "").toLowerCase().includes(q) ||
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
                <TableHead className="text-right">Excl. GST</TableHead>
                <TableHead className="text-right">Incl. GST</TableHead>
                <TableHead>Quote</TableHead>
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
                    <Badge variant={statusVariant(inv.status)} className="text-xs" data-testid={`badge-status-${inv.id}`}>
                      {INVOICE_STATUS_LABELS[inv.status] || inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground" data-testid={`text-xero-number-${inv.id}`}>
                    {inv.xeroInvoiceNumber ?? "—"}
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
