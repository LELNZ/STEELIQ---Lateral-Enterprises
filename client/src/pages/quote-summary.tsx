import { useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { type QuoteItem, type JobItem, type LibraryEntry } from "@shared/schema";
import { DOOR_CATEGORIES } from "@shared/item-options";
import { useSettings } from "@/lib/settings-context";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeftCircle, FileText, Settings2 } from "lucide-react";

function calcSqm(width: number, height: number, quantity: number): number {
  return (width * height * quantity) / 1_000_000;
}

function calcItemPrice(item: QuoteItem): number {
  return calcSqm(item.width, item.height, item.quantity || 1) * (item.pricePerSqm || 500);
}

function formatPrice(amount: number): string {
  return amount.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

interface JobData {
  id: string;
  name: string;
  address: string | null;
  date: string | null;
  installationEnabled?: boolean;
  installationOverride?: number | null;
  installationMarkup?: number | null;
  deliveryEnabled?: boolean;
  deliveryMethod?: string | null;
  deliveryAmount?: number | null;
  deliveryMarkup?: number | null;
  items: JobItem[];
}

export default function QuoteSummary() {
  const [, params] = useRoute("/job/:id/summary");
  const [, navigate] = useLocation();
  const jobId = params?.id;
  const { gstRate, showAvgPriceOnQuote, updateSetting } = useSettings();

  const { data: job, isLoading } = useQuery<JobData>({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId,
  });

  const fetchLib = (type: string) => async () => {
    const res = await fetch(`/api/library?type=${type}`);
    if (!res.ok) return [];
    return res.json() as Promise<LibraryEntry[]>;
  };
  const { data: installationRates = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "installation_rate"], queryFn: fetchLib("installation_rate") });
  const { data: deliveryRates = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "delivery_rate"], queryFn: fetchLib("delivery_rate") });

  const installSellTotal = useMemo(() => {
    if (!job?.installationEnabled) return 0;
    const overrideVal = job.installationOverride;
    if (overrideVal && overrideVal > 0) {
      const markup = job.installationMarkup ?? 15;
      return Math.round(overrideVal * (1 + markup / 100) * 100) / 100;
    }
    const items = job.items.map((ji) => ji.config as QuoteItem);
    let total = 0;
    for (const item of items) {
      const unitSqm = (item.width * item.height) / 1_000_000;
      const isDoor = DOOR_CATEGORIES.includes(item.category);
      const cat = isDoor ? "door" : "window";
      const tiers = installationRates.filter((r) => (r.data as any).category === cat);
      let sell = 0;
      for (const t of tiers) {
        const d = t.data as any;
        if (unitSqm >= d.minSqm && unitSqm < d.maxSqm) { sell = d.sellPerUnit ?? d.pricePerUnit ?? 0; break; }
      }
      if (sell === 0 && tiers.length > 0) {
        const last = tiers[tiers.length - 1].data as any;
        sell = last.sellPerUnit ?? last.pricePerUnit ?? 0;
      }
      total += sell * (item.quantity || 1);
    }
    return total;
  }, [job, installationRates]);

  const isDeliveryEnabled = useMemo(() => {
    if (!job) return false;
    if (job.deliveryEnabled === true) return true;
    if (job.deliveryEnabled === false) return false;
    return !!job.deliveryMethod || (job.deliveryAmount != null && job.deliveryAmount > 0);
  }, [job]);

  const deliverySellTotal = useMemo(() => {
    if (!job || !isDeliveryEnabled) return 0;
    const customVal = job.deliveryAmount;
    if (customVal && customVal > 0) {
      const markup = job.deliveryMarkup ?? 15;
      return Math.round(customVal * (1 + markup / 100) * 100) / 100;
    }
    if (job.deliveryMethod) {
      const rate = deliveryRates.find((r) => r.id === job.deliveryMethod);
      if (rate) {
        const d = rate.data as any;
        return d.sellNzd ?? d.rateNzd ?? 0;
      }
    }
    return 0;
  }, [job, deliveryRates]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading summary...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Job not found</p>
      </div>
    );
  }

  const items = job.items.map((ji) => ji.config as QuoteItem);
  const totalSqm = items.reduce((sum, item) => sum + calcSqm(item.width, item.height, item.quantity || 1), 0);
  const itemsSubtotal = items.reduce((sum, item) => sum + calcItemPrice(item), 0);
  const hasInstallation = !!job.installationEnabled && installSellTotal > 0;
  const hasDelivery = isDeliveryEnabled && deliverySellTotal > 0;
  const subtotalExGst = itemsSubtotal + (hasInstallation ? installSellTotal : 0) + (hasDelivery ? deliverySellTotal : 0);
  const gstAmount = subtotalExGst * (gstRate / 100);
  const totalIncGst = subtotalExGst + gstAmount;

  return (
    <div className="min-h-full bg-background" data-testid="quote-summary">
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

        <div className="bg-card border rounded-lg p-6 space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Items Subtotal</span>
            <span className="font-medium" data-testid="text-items-subtotal">${formatPrice(itemsSubtotal)}</span>
          </div>
          {hasInstallation && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Installation</span>
              <span className="font-medium" data-testid="text-install-sell">${formatPrice(installSellTotal)}</span>
            </div>
          )}
          {hasDelivery && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Delivery</span>
              <span className="font-medium" data-testid="text-delivery-sell">${formatPrice(deliverySellTotal)}</span>
            </div>
          )}
          {!isDeliveryEnabled && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Delivery</span>
              <span className="text-muted-foreground text-xs" data-testid="text-delivery-supply-only">Supply Only — Customer to Collect</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Subtotal (excl. GST)</span>
            <span className="font-semibold" data-testid="text-subtotal-ex-gst">${formatPrice(subtotalExGst)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">GST ({gstRate}%)</span>
            <span className="font-medium" data-testid="text-gst-amount">${formatPrice(gstAmount)}</span>
          </div>
          <Separator />
          <div className="flex justify-between items-center">
            <span className="text-base font-bold">Total (incl. GST)</span>
            <span className="text-xl font-bold text-primary" data-testid="text-total-inc-gst">${formatPrice(totalIncGst)}</span>
          </div>
        </div>

        <div className="relative">
          <div className={`grid grid-cols-1 ${showAvgPriceOnQuote ? "md:grid-cols-3" : "md:grid-cols-2"} gap-4`}>
            <div className="bg-card border rounded-lg p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Items</p>
              <p className="text-2xl font-bold" data-testid="text-total-items">{items.length}</p>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total m²</p>
              <p className="text-2xl font-bold" data-testid="text-total-sqm">{totalSqm.toFixed(2)}</p>
            </div>
            {showAvgPriceOnQuote && (
              <div className="bg-card border rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg $/m²</p>
                <p className="text-2xl font-bold" data-testid="text-avg-price-sqm">${formatPrice(totalSqm > 0 ? itemsSubtotal / totalSqm : 0)}</p>
              </div>
            )}
          </div>
          <button
            onClick={() => updateSetting("showAvgPriceOnQuote", !showAvgPriceOnQuote)}
            className="absolute -top-1 -right-1 p-1 rounded-md text-muted-foreground/40 hover:text-muted-foreground transition-colors print:hidden"
            title={showAvgPriceOnQuote ? "Hide Avg $/m²" : "Show Avg $/m²"}
            data-testid="toggle-avg-price"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
