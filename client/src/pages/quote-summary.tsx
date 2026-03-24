import { useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { type QuoteItem, type JobItem, type LibraryEntry, type ConfigurationProfile } from "@shared/schema";
import { DOOR_CATEGORIES } from "@shared/item-options";
import { calcRakedPerimeterM } from "@/lib/pricing";
import { useSettings } from "@/lib/settings-context";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeftCircle, FileText, Settings2 } from "lucide-react";

function calcSqm(width: number, height: number, quantity: number, item?: QuoteItem): number {
  if (item && item.category === "raked-fixed") {
    const lh = (item as any).rakedLeftHeight || item.height;
    const rh = (item as any).rakedRightHeight || item.height;
    return (width * ((lh + rh) / 2) * quantity) / 1_000_000;
  }
  return (width * height * quantity) / 1_000_000;
}

function calcItemPrice(item: QuoteItem): number {
  return calcSqm(item.width, item.height, item.quantity || 1, item) * (item.pricePerSqm || 500);
}

function formatPrice(amount: number): string {
  return amount.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcProfileLength(widthMm: number, heightMm: number, formula: string, perimeterOverrideM?: number): number {
  const wM = widthMm / 1000;
  const hM = heightMm / 1000;
  switch (formula) {
    case "perimeter": return perimeterOverrideM != null && perimeterOverrideM > 0 ? perimeterOverrideM : 2 * (wM + hM);
    case "width": return wM;
    case "height": return hM;
    default: return perimeterOverrideM != null && perimeterOverrideM > 0 ? perimeterOverrideM : 2 * (wM + hM);
  }
}

function calcItemWeight(
  item: QuoteItem,
  profiles: ConfigurationProfile[],
  masterProfileMap: Map<string, any>
): number {
  if (!profiles.length) return 0;
  const perimOverride = item.category === "raked-fixed"
    ? calcRakedPerimeterM(item.width, (item as any).rakedLeftHeight || item.height || 0, (item as any).rakedRightHeight || item.height || 0)
    : undefined;
  let totalKg = 0;
  for (const p of profiles) {
    const master = masterProfileMap.get(p.mouldNumber);
    const kgPerM = parseFloat(master?.kgPerMetre ?? p.kgPerMetre) || 0;
    const formula = master?.lengthFormula ?? p.lengthFormula ?? "perimeter";
    const length = calcProfileLength(item.width, item.height, formula, perimOverride);
    const qty = (p.quantityPerSet || 1) * (item.quantity || 1);
    totalKg += length * qty * kgPerM;
  }
  return totalKg;
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
  "raked-fixed": "Raked/Triangular Fixed",
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
  const { gstRate, showPricingOnQuote, updateSetting } = useSettings();

  const { data: job, isLoading } = useQuery<JobData>({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId,
  });

  const configIds = useMemo(() => {
    if (!job) return [];
    const ids = new Set<string>();
    job.items.forEach((ji) => {
      const cid = (ji.config as QuoteItem).configurationId;
      if (cid) ids.add(cid);
    });
    return Array.from(ids).sort();
  }, [job]);

  const { data: configProfilesMap = {} } = useQuery<Record<string, ConfigurationProfile[]>>({
    queryKey: ["quote-summary-config-profiles", ...configIds],
    queryFn: async () => {
      const result: Record<string, ConfigurationProfile[]> = {};
      await Promise.all(configIds.map(async (cid) => {
        const res = await fetch(`/api/configurations/${cid}/profiles`);
        result[cid] = res.ok ? await res.json() : [];
      }));
      return result;
    },
    enabled: configIds.length > 0,
  });

  const fetchLib = (type: string) => async () => {
    const res = await fetch(`/api/library?type=${type}`);
    if (!res.ok) return [];
    return res.json() as Promise<LibraryEntry[]>;
  };
  const { data: masterProfiles = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "direct_profile"], queryFn: fetchLib("direct_profile") });
  const { data: installationRates = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "installation_rate"], queryFn: fetchLib("installation_rate") });
  const { data: deliveryRates = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "delivery_rate"], queryFn: fetchLib("delivery_rate") });

  const masterProfileMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const mp of masterProfiles) {
      const d = mp.data as any;
      if (d.mouldNumber) m.set(d.mouldNumber, d);
    }
    return m;
  }, [masterProfiles]);

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
      const unitSqm = item.category === "raked-fixed"
        ? calcSqm(item.width, item.height, 1, item)
        : (item.width * item.height) / 1_000_000;
      const isDoor = DOOR_CATEGORIES.includes(item.category);
      const itemCat = isDoor ? "door" : "window";
      const catGroups = new Map<string, typeof installationRates>();
      for (const r of installationRates) {
        const d = r.data as any;
        const rc = d.category || "window";
        if (rc !== itemCat && rc !== "all") continue;
        if (!catGroups.has(rc)) catGroups.set(rc, []);
        catGroups.get(rc)!.push(r);
      }
      for (const [, group] of catGroups) {
        let matchedRate: any = null;
        for (const t of group) {
          const d = t.data as any;
          if (unitSqm >= d.minSqm && unitSqm < d.maxSqm) { matchedRate = d; break; }
        }
        if (!matchedRate && group.length > 0) matchedRate = group[group.length - 1].data as any;
        if (matchedRate) {
          const sell = matchedRate.sellPerUnit ?? matchedRate.pricePerUnit ?? 0;
          const basis = matchedRate.pricingBasis || "per_item";
          const qty = item.quantity || 1;
          if (basis === "per_m2") total += sell * unitSqm * qty;
          else if (basis === "per_lm") {
            const perimLm = item.category === "raked-fixed"
              ? calcRakedPerimeterM(item.width, (item as any).rakedLeftHeight || item.height || 0, (item as any).rakedRightHeight || item.height || 0)
              : 2 * (item.width + item.height) / 1000;
            total += sell * perimLm * qty;
          }
          else total += sell * qty;
        }
      }
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

  const itemWeights = useMemo(() => {
    if (!job) return [];
    return job.items.map((ji) => {
      const item = ji.config as QuoteItem;
      const profiles = item.configurationId ? (configProfilesMap[item.configurationId] || []) : [];
      return calcItemWeight(item, profiles, masterProfileMap);
    });
  }, [job, configProfilesMap, masterProfileMap]);

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
  const totalSqm = items.reduce((sum, item) => sum + calcSqm(item.width, item.height, item.quantity || 1, item), 0);
  const totalWeight = itemWeights.reduce((sum, w) => sum + w, 0);
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
                <TableHead className="text-right">Weight</TableHead>
                {showPricingOnQuote && <TableHead className="text-right">$/m²</TableHead>}
                <TableHead className="text-right">Qty</TableHead>
                {showPricingOnQuote && <TableHead className="text-right">Price</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => {
                const sqm = calcSqm(item.width, item.height, item.quantity || 1, item);
                const price = calcItemPrice(item);
                const weightKg = itemWeights[index] || 0;
                return (
                  <TableRow key={item.id || `item-${index}`} data-testid={`summary-row-${index}`}>
                    <TableCell className="text-muted-foreground text-xs">{index + 1}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-sm">{CATEGORY_LABELS[item.category] || item.category}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{item.width} x {item.height}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{sqm.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono text-sm" data-testid={`text-weight-${index}`}>{weightKg > 0 ? `${weightKg.toFixed(1)} kg` : "—"}</TableCell>
                    {showPricingOnQuote && <TableCell className="text-right font-mono text-sm">${item.pricePerSqm || 500}</TableCell>}
                    <TableCell className="text-right">{item.quantity || 1}</TableCell>
                    {showPricingOnQuote && <TableCell className="text-right font-mono text-sm font-semibold">${formatPrice(price)}</TableCell>}
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
          <div className={`grid grid-cols-1 ${showPricingOnQuote ? "md:grid-cols-4" : "md:grid-cols-3"} gap-4`}>
            <div className="bg-card border rounded-lg p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Items</p>
              <p className="text-2xl font-bold" data-testid="text-total-items">{items.length}</p>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total m²</p>
              <p className="text-2xl font-bold" data-testid="text-total-sqm">{totalSqm.toFixed(2)}</p>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Weight</p>
              <p className="text-2xl font-bold" data-testid="text-total-weight">{totalWeight.toFixed(1)} kg</p>
            </div>
            {showPricingOnQuote && (
              <div className="bg-card border rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg $/m²</p>
                <p className="text-2xl font-bold" data-testid="text-avg-price-sqm">${formatPrice(totalSqm > 0 ? itemsSubtotal / totalSqm : 0)}</p>
              </div>
            )}
          </div>
          <button
            onClick={() => updateSetting("showPricingOnQuote", !showPricingOnQuote)}
            className="absolute -top-1 -right-1 p-1 rounded-md text-muted-foreground/40 hover:text-muted-foreground transition-colors print:hidden"
            title={showPricingOnQuote ? "Hide line pricing" : "Show line pricing"}
            data-testid="toggle-pricing"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
