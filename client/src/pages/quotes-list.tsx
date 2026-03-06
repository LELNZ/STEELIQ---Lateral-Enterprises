import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { type Quote } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FileText, ArrowRight } from "lucide-react";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  review: "outline",
  sent: "default",
  accepted: "default",
  declined: "destructive",
  archived: "secondary",
};

function fmt(n: number): string {
  return n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function QuotesList() {
  const { data: quotes, isLoading } = useQuery<Quote[]>({ queryKey: ["/api/quotes"] });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading quotes...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6" data-testid="quotes-list-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-xl font-bold" data-testid="text-quotes-heading">Quotes</h1>
        </div>
      </div>

      {!quotes || quotes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground" data-testid="text-no-quotes">
          <p>No quotes yet. Generate a quote from a job's Executive Summary.</p>
        </div>
      ) : (
        <>
          <div className="hidden lg:block rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Quote #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[160px]">Created</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((q) => (
                  <TableRow key={q.id} data-testid={`row-quote-${q.id}`}>
                    <TableCell className="font-mono font-medium" data-testid={`text-quote-number-${q.id}`}>
                      {q.number}
                    </TableCell>
                    <TableCell data-testid={`text-quote-customer-${q.id}`}>{q.customer}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[q.status] || "secondary"} data-testid={`badge-quote-status-${q.id}`}>
                        {q.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {q.createdAt ? new Date(q.createdAt).toLocaleDateString("en-NZ") : "—"}
                    </TableCell>
                    <TableCell>
                      <Link href={`/quote/${q.id}`}>
                        <Button variant="ghost" size="icon" data-testid={`button-view-quote-${q.id}`}>
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="block lg:hidden space-y-3">
            {quotes.map((q) => (
              <Link key={q.id} href={`/quote/${q.id}`}>
                <div
                  className="rounded-md border bg-card p-4 hover-elevate active-elevate-2 cursor-pointer"
                  data-testid={`card-quote-${q.id}`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-mono font-medium text-sm" data-testid={`text-quote-number-mobile-${q.id}`}>
                      {q.number}
                    </span>
                    <Badge variant={STATUS_VARIANT[q.status] || "secondary"} data-testid={`badge-quote-status-mobile-${q.id}`}>
                      {q.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm" data-testid={`text-quote-customer-mobile-${q.id}`}>
                    {q.customer}
                  </p>
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <span className="text-xs text-muted-foreground">
                      {q.createdAt ? new Date(q.createdAt).toLocaleDateString("en-NZ") : "—"}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
