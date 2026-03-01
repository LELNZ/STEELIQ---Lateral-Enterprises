import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { type QuoteItem, type JobItem } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeftCircle, FileText } from "lucide-react";

function calcSqm(width: number, height: number, quantity: number): number {
  return (width * height * quantity) / 1_000_000;
}

function calcItemPrice(item: QuoteItem): number {
  return calcSqm(item.width, item.height, item.quantity || 1) * (item.pricePerSqm || 500);
}

function formatPrice(amount: number): string {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const CATEGORY_LABELS: Record<string, string> = {
  "windows-standard": "Window",
  "sliding-window": "Sliding Window",
  "sliding-door": "Sliding Door",
  "entrance-door": "Entrance Door",
  "hinge-door": "Hinge Door",
  "french-door": "French Door",
  "bifold-door": "Bifold Door",
  "stacker-door": "Stacker Door",
  "bay-window": "Bay Window",
};

export default function QuoteSummary() {
  const [, params] = useRoute("/job/:id/summary");
  const [, navigate] = useLocation();
  const jobId = params?.id;

  const { data: job, isLoading } = useQuery<{
    id: string; name: string; address: string | null; date: string | null; items: JobItem[];
  }>({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading summary...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Job not found</p>
      </div>
    );
  }

  const items = job.items.map((ji) => ji.config as QuoteItem);
  const totalSqm = items.reduce((sum, item) => sum + calcSqm(item.width, item.height, item.quantity || 1), 0);
  const totalPrice = items.reduce((sum, item) => sum + calcItemPrice(item), 0);
  const avgPricePerSqm = totalSqm > 0 ? totalPrice / totalSqm : 0;

  return (
    <div className="min-h-screen bg-background" data-testid="quote-summary">
      <header className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/job/${jobId}`)} data-testid="button-back-to-job">
              <ArrowLeftCircle className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2" data-testid="text-summary-title">
                <FileText className="w-5 h-5" /> Quote Summary
              </h1>
              <p className="text-sm text-muted-foreground">{job.name}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card border rounded-lg p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Job Name</p>
            <p className="text-lg font-semibold" data-testid="text-job-name">{job.name}</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Address</p>
            <p className="text-lg font-semibold" data-testid="text-job-address">{job.address || "—"}</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Date</p>
            <p className="text-lg font-semibold" data-testid="text-job-date">{job.date || "—"}</p>
          </div>
        </div>

        <Separator />

        <div className="bg-card border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Item ID</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Dimensions</TableHead>
                <TableHead className="text-right">m²</TableHead>
                <TableHead className="text-right">$/m²</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => {
                const sqm = calcSqm(item.width, item.height, item.quantity || 1);
                const price = calcItemPrice(item);
                return (
                  <TableRow key={item.id || `item-${index}`} data-testid={`summary-row-${index}`}>
                    <TableCell className="text-muted-foreground text-xs">{index + 1}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-sm">{CATEGORY_LABELS[item.category] || item.category}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{item.width} x {item.height}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{sqm.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">${item.pricePerSqm || 500}</TableCell>
                    <TableCell className="text-right">{item.quantity || 1}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">${formatPrice(price)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card border rounded-lg p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Items</p>
            <p className="text-2xl font-bold" data-testid="text-total-items">{items.length}</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total m²</p>
            <p className="text-2xl font-bold" data-testid="text-total-sqm">{totalSqm.toFixed(2)}</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg $/m²</p>
            <p className="text-2xl font-bold" data-testid="text-avg-price-sqm">${formatPrice(avgPricePerSqm)}</p>
          </div>
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Price</p>
            <p className="text-2xl font-bold text-primary" data-testid="text-total-price">${formatPrice(totalPrice)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
