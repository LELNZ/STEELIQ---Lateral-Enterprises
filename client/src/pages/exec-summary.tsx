import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { type QuoteItem, type JobItem, type ConfigurationProfile, type ConfigurationAccessory, type ConfigurationLabor, type FrameConfiguration, type LibraryEntry } from "@shared/schema";
import { calculatePricing, type PricingBreakdown } from "@/lib/pricing";
import { deriveConfigSignature } from "@/lib/config-signature";
import { getGlassPrice } from "@shared/glass-library";
import { LINER_TYPES, DOOR_CATEGORIES, getHandlesForCategory, getHandleTypeForCategory, HANDLE_CATEGORIES, WANZ_BAR_DEFAULTS, WINDOW_CATEGORIES } from "@shared/item-options";
import { useSettings } from "@/lib/settings-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ArrowLeftCircle, ChevronDown, ChevronRight, Printer } from "lucide-react";

function calcSqm(width: number, height: number, quantity: number): number {
  return (width * height * quantity) / 1_000_000;
}

function fmt(n: number): string {
  return n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const CATEGORY_LABELS: Record<string, string> = {
  "windows-standard": "Window",
  "sliding-window": "Sliding Window",
  "sliding-door": "Sliding Door",
  "entrance-door": "Entrance Door",
  "hinge-door": "Hinge Door",
  "french-door": "French Door",
  "bifold-door": "Bi-fold Door",
  "stacker-door": "Stacker Door",
  "bay-window": "Bay Window",
};

interface JobData {
  id: string;
  name: string;
  address?: string;
  date?: string;
  items: JobItem[];
}

interface ItemPricingData {
  item: QuoteItem;
  sqm: number;
  salePrice: number;
  pricing: PricingBreakdown | null;
  configName: string;
}

export default function ExecSummary() {
  const [, matchResult] = useRoute("/job/:id/exec-summary");
  const jobId = matchResult?.id;
  const [, navigate] = useLocation();
  const { usdToNzdRate } = useSettings();
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const { data: job, isLoading: jobLoading } = useQuery<JobData>({
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
    return Array.from(ids);
  }, [job]);

  const { data: libFrameTypes = [] } = useQuery<{ id: string; data: { value: string; label: string } }[]>({
    queryKey: ["/api/library", "frame_type"],
    queryFn: async () => {
      const res = await fetch("/api/library?type=frame_type");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: allConfigurations = [] } = useQuery<FrameConfiguration[]>({
    queryKey: ["exec-summary-all-configs", libFrameTypes.map((ft) => ft.id).join(",")],
    queryFn: async () => {
      const results: FrameConfiguration[] = [];
      await Promise.all(libFrameTypes.map(async (ft) => {
        const res = await fetch(`/api/frame-types/${ft.id}/configurations`);
        if (res.ok) {
          const configs = await res.json();
          results.push(...configs);
        }
      }));
      return results;
    },
    enabled: libFrameTypes.length > 0,
  });

  const configNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    allConfigurations.forEach((c) => { m[c.id] = c.name; });
    return m;
  }, [allConfigurations]);

  const configQueries = useQuery<Record<string, { profiles: ConfigurationProfile[]; accessories: ConfigurationAccessory[]; labor: ConfigurationLabor[] }>>({
    queryKey: ["exec-summary-configs", ...configIds],
    queryFn: async () => {
      const result: Record<string, { profiles: ConfigurationProfile[]; accessories: ConfigurationAccessory[]; labor: ConfigurationLabor[] }> = {};
      await Promise.all(configIds.map(async (cid) => {
        const [profiles, accessories, labor] = await Promise.all([
          fetch(`/api/configurations/${cid}/profiles`).then((r) => r.ok ? r.json() : []),
          fetch(`/api/configurations/${cid}/accessories`).then((r) => r.ok ? r.json() : []),
          fetch(`/api/configurations/${cid}/labor`).then((r) => r.ok ? r.json() : []),
        ]);
        result[cid] = { profiles, accessories, labor };
      }));
      return result;
    },
    enabled: configIds.length > 0,
  });

  const configData = configQueries.data || {};

  const fetchLib = (type: string) => async () => {
    const res = await fetch(`/api/library?type=${type}`);
    if (!res.ok) return [];
    return res.json() as Promise<LibraryEntry[]>;
  };
  const { data: libGlass = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "glass"], queryFn: fetchLib("glass") });
  const { data: libLiners = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "liner_type"], queryFn: fetchLib("liner_type") });
  const { data: libWindowHandles = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "window_handle"], queryFn: fetchLib("window_handle") });
  const { data: libDoorHandles = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "door_handle"], queryFn: fetchLib("door_handle") });
  const { data: libAwningHandles = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "awning_handle"], queryFn: fetchLib("awning_handle") });
  const { data: libSlidingWindowHandles = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "sliding_window_handle"], queryFn: fetchLib("sliding_window_handle") });
  const { data: libEntranceDoorHandles = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "entrance_door_handle"], queryFn: fetchLib("entrance_door_handle") });
  const { data: libHingeDoorHandles = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "hinge_door_handle"], queryFn: fetchLib("hinge_door_handle") });
  const { data: libSlidingDoorHandles = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "sliding_door_handle"], queryFn: fetchLib("sliding_door_handle") });
  const { data: libBifoldDoorHandles = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "bifold_door_handle"], queryFn: fetchLib("bifold_door_handle") });
  const { data: libStackerDoorHandles = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "stacker_door_handle"], queryFn: fetchLib("stacker_door_handle") });
  const { data: libWanzBars = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "wanz_bar"], queryFn: fetchLib("wanz_bar") });

  const handlesByType: Record<string, LibraryEntry[]> = {
    awning_handle: libAwningHandles,
    sliding_window_handle: libSlidingWindowHandles,
    entrance_door_handle: libEntranceDoorHandles,
    hinge_door_handle: libHingeDoorHandles,
    sliding_door_handle: libSlidingDoorHandles,
    bifold_door_handle: libBifoldDoorHandles,
    stacker_door_handle: libStackerDoorHandles,
  };

  const lookupGlassPrice = (iguType: string, combo: string, thickness: string): number | null => {
    const entry = libGlass.find((e) => (e.data as any).iguType === iguType && (e.data as any).combo === combo);
    if (entry) return (entry.data as any).prices?.[thickness] ?? null;
    return getGlassPrice(iguType, combo, thickness);
  };
  const lookupLinerPrice = (linerType: string): number | null => {
    if (!linerType) return null;
    const entry = libLiners.find((e) => (e.data as any).value === linerType);
    const dbPrice = entry ? (entry.data as any).priceProvision : null;
    if (dbPrice != null) return dbPrice;
    return LINER_TYPES.find((lt) => lt.value === linerType)?.priceProvision ?? null;
  };
  const lookupHandlePrice = (handleType: string, cat: string): number | null => {
    if (!handleType) return null;
    const catType = getHandleTypeForCategory(cat);
    const catHandles = handlesByType[catType] || [];
    if (catHandles.length > 0) {
      const entry = catHandles.find((e) => (e.data as any).value === handleType);
      const dbPrice = entry ? (entry.data as any).priceProvision : null;
      if (dbPrice != null) return dbPrice;
    }
    const handles = DOOR_CATEGORIES.includes(cat) ? libDoorHandles : libWindowHandles;
    const entry = handles.find((e) => (e.data as any).value === handleType);
    const dbPrice = entry ? (entry.data as any).priceProvision : null;
    if (dbPrice != null) return dbPrice;
    return getHandlesForCategory(cat).find((h) => h.value === handleType)?.priceProvision ?? null;
  };

  const itemPricings: ItemPricingData[] = useMemo(() => {
    if (!job) return [];
    return job.items.map((ji) => {
      const item = ji.config as QuoteItem;
      const sqm = calcSqm(item.width, item.height, item.quantity || 1);
      const salePrice = (item.pricePerSqm || 500) * sqm;
      const cid = item.configurationId;
      let pricing: PricingBreakdown | null = null;
      let configName = cid ? (configNameMap[cid] || "") : "";

      if (cid && configData[cid]) {
        const cd = configData[cid];
        const hasData = cd.profiles.length > 0 || cd.accessories.length > 0 || cd.labor.length > 0;
        if (hasData) {
          const sig = deriveConfigSignature(item);
          const openingPanels = Math.max(1, sig.awningCount + sig.hingeCount + sig.slidingCount);
          const wanzBarInput = (() => {
            if (!item.wanzBar || !item.wanzBarSource || !item.wanzBarSize) return undefined;
            const wbEntry = libWanzBars.find((e) => (e.data as any).value === item.wanzBarSize);
            const d = wbEntry ? (wbEntry.data as any) : WANZ_BAR_DEFAULTS.find((wb) => wb.value === item.wanzBarSize);
            if (!d) return undefined;
            return { enabled: true, source: item.wanzBarSource as "nz-local" | "direct", kgPerMetre: d.kgPerMetre || 0, pricePerKgUsd: d.pricePerKgUsd || 0, priceNzdPerLinM: d.priceNzdPerLinM || 0 };
          })();
          pricing = calculatePricing(
            item.width, item.height, item.quantity || 1,
            cd.profiles, cd.accessories, cd.labor,
            usdToNzdRate, item.pricePerSqm || 500,
            {
              glassPricePerSqm: lookupGlassPrice(item.glassIguType || "", item.glassType || "", item.glassThickness || ""),
              linerPricePerM: lookupLinerPrice(item.linerType || ""),
              handlePriceEach: lookupHandlePrice(item.handleType || "", item.category),
              openingPanelCount: openingPanels,
              wanzBar: wanzBarInput,
            }
          );
        }
      }

      return { item, sqm, salePrice, pricing, configName };
    });
  }, [job, configData, configNameMap, usdToNzdRate, libGlass, libLiners, libWindowHandles, libDoorHandles, libAwningHandles, libSlidingWindowHandles, libEntranceDoorHandles, libHingeDoorHandles, libSlidingDoorHandles, libBifoldDoorHandles, libStackerDoorHandles, libWanzBars]);

  const totals = useMemo(() => {
    let totalSqm = 0;
    let totalNetCost = 0;
    let totalSalePrice = 0;
    let totalMaterials = 0;
    let totalLabor = 0;
    let totalWeight = 0;

    for (const ip of itemPricings) {
      totalSqm += ip.sqm;
      totalSalePrice += ip.pricing?.salePriceNzd ?? ip.salePrice;
      if (ip.pricing) {
        totalNetCost += ip.pricing.netCostNzd;
        totalMaterials += ip.pricing.profilesCostNzd + ip.pricing.accessoriesCostNzd + ip.pricing.glassCostNzd + ip.pricing.linerCostNzd + ip.pricing.handleCostNzd + ip.pricing.wanzBarCostNzd;
        totalLabor += ip.pricing.laborCostNzd;
        totalWeight += ip.pricing.totalWeightKg;
      }
    }

    const totalProfit = totalSalePrice - totalNetCost;
    const grossMarginPct = totalSalePrice > 0 ? (totalProfit / totalSalePrice) * 100 : 0;
    const avgCostPerSqm = totalSqm > 0 ? totalNetCost / totalSqm : 0;
    const avgSalePerSqm = totalSqm > 0 ? totalSalePrice / totalSqm : 0;

    return {
      totalSqm, totalNetCost, totalSalePrice, totalMaterials,
      totalLabor, totalWeight, totalProfit, grossMarginPct,
      avgCostPerSqm, avgSalePerSqm,
    };
  }, [itemPricings]);

  const toggleExpand = (idx: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  if (jobLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading...</p>
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

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 print:p-2 print:space-y-4" data-testid="exec-summary-page">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/job/${jobId}`)} data-testid="button-back-to-job">
            <ArrowLeftCircle className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-job-name">{job.name || "Untitled Job"}</h1>
            <p className="text-sm text-muted-foreground">Executive Summary</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="button-print">
          <Printer className="h-4 w-4 mr-1" /> Print
        </Button>
      </div>

      <div className="print:block hidden mb-4">
        <h1 className="text-xl font-bold">{job.name || "Untitled Job"} — Executive Summary</h1>
        {job.address && <p className="text-sm">{job.address}</p>}
        {job.date && <p className="text-sm">{job.date}</p>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="summary-totals">
        <SummaryCard label="Total m²" value={`${totals.totalSqm.toFixed(2)} m²`} testId="text-total-sqm" />
        <SummaryCard label="Total Weight" value={`${totals.totalWeight.toFixed(1)} kg`} testId="text-total-weight" />
        <SummaryCard label="Total Items" value={String(itemPricings.length)} testId="text-total-items" />
        <SummaryCard label="USD → NZD Rate" value={`${usdToNzdRate}`} testId="text-usd-rate" />
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-3" data-testid="financial-summary">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Financial Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <FinanceRow label="Net Materials (NZD)" value={`$${fmt(totals.totalMaterials)}`} testId="text-total-materials" />
          <FinanceRow label="Net Labor (NZD)" value={`$${fmt(totals.totalLabor)}`} testId="text-total-labor" />
          <FinanceRow label="Total Net Cost" value={`$${fmt(totals.totalNetCost)}`} bold testId="text-total-net-cost" />
          <FinanceRow label="Total Sale Price" value={`$${fmt(totals.totalSalePrice)}`} bold primary testId="text-total-sale-price" />
          <FinanceRow label="Avg Cost/m²" value={`$${fmt(totals.avgCostPerSqm)}`} testId="text-avg-cost-sqm" />
          <FinanceRow label="Avg Sale/m²" value={`$${fmt(totals.avgSalePerSqm)}`} testId="text-avg-sale-sqm" />
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-muted-foreground">Gross Profit</span>
            <p className={`text-2xl font-bold ${totals.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-total-profit">
              ${fmt(totals.totalProfit)}
            </p>
          </div>
          <div className="text-right">
            <span className="text-sm text-muted-foreground">Gross Margin</span>
            <p className={`text-2xl font-bold ${totals.grossMarginPct >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-gross-margin">
              {totals.grossMarginPct.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card" data-testid="items-breakdown">
        <div className="p-4 border-b">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Per-Item Breakdown</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Dims (mm)</TableHead>
              <TableHead className="text-right">m²</TableHead>
              <TableHead className="text-right">Net Cost</TableHead>
              <TableHead className="text-right">Sale Price</TableHead>
              <TableHead className="text-right">Margin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itemPricings.map((ip, idx) => {
              const isExpanded = expandedItems.has(idx);
              const hasPricing = !!ip.pricing;
              const netCost = ip.pricing?.netCostNzd ?? 0;
              const salePrice = ip.pricing?.salePriceNzd ?? ip.salePrice;
              const margin = hasPricing ? salePrice - netCost : 0;
              const marginPct = hasPricing ? (ip.pricing?.marginPercent ?? 0) : 0;
              const marginColor = !hasPricing ? "text-muted-foreground" : margin >= 0 ? "text-green-600" : "text-red-600";

              return (
                <Collapsible key={idx} open={isExpanded} onOpenChange={() => toggleExpand(idx)} asChild>
                  <>
                    <CollapsibleTrigger asChild>
                      <TableRow className="cursor-pointer hover:bg-muted/50" data-testid={`row-item-${idx}`}>
                        <TableCell>
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </TableCell>
                        <TableCell className="font-medium" data-testid={`text-item-name-${idx}`}>{ip.item.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{CATEGORY_LABELS[ip.item.category] || ip.item.category}</Badge>
                          {ip.configName && <span className="text-xs text-muted-foreground ml-1.5" data-testid={`text-config-name-${idx}`}>{ip.configName}</span>}
                        </TableCell>
                        <TableCell className="text-right text-xs">{ip.item.width}×{ip.item.height}</TableCell>
                        <TableCell className="text-right">{ip.sqm.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium">${fmt(netCost)}</TableCell>
                        <TableCell className="text-right font-medium text-primary">${fmt(salePrice)}</TableCell>
                        <TableCell className={`text-right font-bold ${marginColor}`}>
                          {hasPricing ? `$${fmt(margin)} (${marginPct.toFixed(1)}%)` : "N/A"}
                        </TableCell>
                      </TableRow>
                    </CollapsibleTrigger>
                    <CollapsibleContent asChild>
                      <TableRow className="bg-muted/20" data-testid={`row-item-detail-${idx}`}>
                        <TableCell colSpan={8}>
                          {ip.pricing ? (
                            <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              <div>
                                <span className="text-muted-foreground block">Configuration</span>
                                <span className="font-medium">{ip.configName || "—"}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block">Profiles (NZD)</span>
                                <span className="font-medium">${fmt(ip.pricing.profilesCostNzd)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block">Accessories (NZD)</span>
                                <span className="font-medium">${fmt(ip.pricing.accessoriesCostNzd)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block">Labor (NZD)</span>
                                <span className="font-medium">${fmt(ip.pricing.laborCostNzd)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block">Glass (NZD)</span>
                                <span className="font-medium">${fmt(ip.pricing.glassCostNzd)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block">Liner (NZD)</span>
                                <span className="font-medium">${fmt(ip.pricing.linerCostNzd)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block">Handle (NZD)</span>
                                <span className="font-medium">${fmt(ip.pricing.handleCostNzd)}</span>
                              </div>
                              {ip.pricing.wanzBarCostNzd > 0 && (
                                <div>
                                  <span className="text-muted-foreground block">Wanz Bar (NZD)</span>
                                  <span className="font-medium">${fmt(ip.pricing.wanzBarCostNzd)}</span>
                                </div>
                              )}
                              <div>
                                <span className="text-muted-foreground block">Materials Total</span>
                                <span className="font-medium">${fmt(ip.pricing.profilesCostNzd + ip.pricing.accessoriesCostNzd + ip.pricing.glassCostNzd + ip.pricing.linerCostNzd + ip.pricing.handleCostNzd + ip.pricing.wanzBarCostNzd)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block">Actual $/m²</span>
                                <span className="font-medium">${fmt(ip.pricing.actualCostPerSqm)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block">Sale $/m²</span>
                                <span className="font-medium">${ip.item.pricePerSqm || 500}/m²</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block">Weight</span>
                                <span className="font-medium">{ip.pricing.totalWeightKg.toFixed(2)} kg</span>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 text-xs text-muted-foreground">
                              No configuration selected — pricing breakdown unavailable.
                              <br />Sale price: ${fmt(ip.salePrice)} (at ${ip.item.pricePerSqm || 500}/m²)
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              );
            })}
            {itemPricings.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No items in this job
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="rounded-md border bg-card p-3" data-testid={testId}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold mt-1">{value}</p>
    </div>
  );
}

function FinanceRow({ label, value, bold, primary, testId }: { label: string; value: string; bold?: boolean; primary?: boolean; testId: string }) {
  return (
    <div data-testid={testId}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm mt-0.5 ${bold ? "font-bold" : "font-medium"} ${primary ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}
