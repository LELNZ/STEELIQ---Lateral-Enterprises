import { useState, useMemo, useCallback, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type QuoteItem, type JobItem, type ConfigurationProfile, type ConfigurationAccessory, type ConfigurationLabor, type FrameConfiguration, type LibraryEntry } from "@shared/schema";
import { calculatePricing, type PricingBreakdown } from "@/lib/pricing";
import { deriveConfigSignature } from "@/lib/config-signature";
import { getGlassPrice, getGlassRValue } from "@shared/glass-library";
import { LINER_TYPES, DOOR_CATEGORIES, getHandlesForCategory, getHandleTypeForCategory, HANDLE_CATEGORIES, WANZ_BAR_DEFAULTS, WINDOW_CATEGORIES } from "@shared/item-options";
import { useSettings } from "@/lib/settings-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeftCircle, ChevronDown, ChevronRight, Printer, FileText, Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { EstimateSnapshot } from "@shared/estimate-snapshot";
import DrawingCanvas from "@/components/drawing-canvas";

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
  installationEnabled?: boolean;
  installationOverride?: number | null;
  installationMarkup?: number | null;
  deliveryEnabled?: boolean;
  deliveryMethod?: string | null;
  deliveryAmount?: number | null;
  deliveryMarkup?: number | null;
  items: JobItem[];
}

interface ItemPhotoRef {
  key: string;
  isPrimary?: boolean;
  includeInCustomerPdf?: boolean;
  caption?: string;
  takenAt?: string;
}

interface ItemPricingData {
  item: QuoteItem;
  sqm: number;
  salePrice: number;
  pricing: PricingBreakdown | null;
  configName: string;
  photos: ItemPhotoRef[];
}

export default function ExecSummary() {
  const [, matchResult] = useRoute("/job/:id/exec-summary");
  const jobId = matchResult?.id;
  const [, navigate] = useLocation();
  const { usdToNzdRate, gstRate } = useSettings();
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [installEnabled, setInstallEnabled] = useState(false);
  const [installOverride, setInstallOverride] = useState<string>("");
  const [installMarkup, setInstallMarkup] = useState<string>("15");
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [deliveryMethodId, setDeliveryMethodId] = useState<string>("");
  const [deliveryCustom, setDeliveryCustom] = useState<string>("");
  const [deliveryMarkup, setDeliveryMarkup] = useState<string>("15");
  const [initialized, setInitialized] = useState(false);

  const { data: job, isLoading: jobLoading } = useQuery<JobData>({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId,
  });

  const { data: existingQuotes = [] } = useQuery<any[]>({
    queryKey: ["/api/jobs", jobId, "quotes"],
    enabled: !!jobId,
  });

  const hasExistingQuote = existingQuotes.length > 0;

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
  const { data: masterProfiles = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "direct_profile"], queryFn: fetchLib("direct_profile") });
  const { data: masterAccessories = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "direct_accessory"], queryFn: fetchLib("direct_accessory") });
  const { data: masterLabour = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "labour_operation"], queryFn: fetchLib("labour_operation") });
  const { data: installationRates = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "installation_rate"], queryFn: fetchLib("installation_rate") });
  const { data: deliveryRates = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "delivery_rate"], queryFn: fetchLib("delivery_rate") });

  useEffect(() => {
    if (job && !initialized) {
      setInstallEnabled(!!job.installationEnabled);
      setInstallOverride(job.installationOverride != null ? String(job.installationOverride) : "");
      setInstallMarkup(job.installationMarkup != null ? String(job.installationMarkup) : "15");
      let initDelivery = false;
      if (job.deliveryEnabled === true) initDelivery = true;
      else if (job.deliveryEnabled === false) initDelivery = false;
      else initDelivery = !!job.deliveryMethod || (job.deliveryAmount != null && job.deliveryAmount > 0);
      setDeliveryEnabled(initDelivery);
      setDeliveryMethodId(job.deliveryMethod || "");
      setDeliveryCustom(job.deliveryAmount != null ? String(job.deliveryAmount) : "");
      setDeliveryMarkup(job.deliveryMarkup != null ? String(job.deliveryMarkup) : "15");
      setInitialized(true);
    }
  }, [job, initialized]);

  const saveJobMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      await apiRequest("PATCH", `/api/jobs/${jobId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
    },
  });

  const persistJobField = useCallback((field: string, value: any) => {
    if (!jobId) return;
    saveJobMutation.mutate({ [field]: value });
  }, [jobId]);

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
    return job.items.map((ji: any) => {
      const item = ji.config as QuoteItem;
      const sqm = calcSqm(item.width, item.height, item.quantity || 1);
      const salePrice = (item.pricePerSqm || 500) * sqm;
      const cid = item.configurationId;
      let pricing: PricingBreakdown | null = null;
      let configName = cid ? (configNameMap[cid] || "") : "";
      const photos: ItemPhotoRef[] = (ji.photos as ItemPhotoRef[]) || [];

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
            },
            { masterProfiles, masterAccessories, masterLabour }
          );
        }
      }

      return { item, sqm, salePrice, pricing, configName, photos };
    });
  }, [job, configData, configNameMap, usdToNzdRate, libGlass, libLiners, libWindowHandles, libDoorHandles, libAwningHandles, libSlidingWindowHandles, libEntranceDoorHandles, libHingeDoorHandles, libSlidingDoorHandles, libBifoldDoorHandles, libStackerDoorHandles, libWanzBars, masterProfiles, masterAccessories, masterLabour]);

  const getInstallationTier = useCallback((category: string, sqm: number): { name: string; cost: number; sell: number } | null => {
    const isDoor = DOOR_CATEGORIES.includes(category);
    const cat = isDoor ? "door" : "window";
    const tiers = installationRates.filter((r) => (r.data as any).category === cat);
    for (const t of tiers) {
      const d = t.data as any;
      if (sqm >= d.minSqm && sqm < d.maxSqm) return { name: d.name, cost: d.costPerUnit ?? d.pricePerUnit * 0.75, sell: d.sellPerUnit ?? d.pricePerUnit };
    }
    if (tiers.length > 0) {
      const last = tiers[tiers.length - 1].data as any;
      return { name: last.name, cost: last.costPerUnit ?? last.pricePerUnit * 0.75, sell: last.sellPerUnit ?? last.pricePerUnit };
    }
    return null;
  }, [installationRates]);

  const installationItems = useMemo(() => {
    if (!installEnabled) return [];
    return itemPricings.map((ip) => {
      const unitSqm = (ip.item.width * ip.item.height) / 1_000_000;
      const tier = getInstallationTier(ip.item.category, unitSqm);
      const qty = ip.item.quantity || 1;
      return {
        name: ip.item.name,
        category: ip.item.category,
        unitSqm,
        qty,
        tierName: tier?.name || "—",
        costPerUnit: tier?.cost || 0,
        sellPerUnit: tier?.sell || 0,
        costTotal: (tier?.cost || 0) * qty,
        sellTotal: (tier?.sell || 0) * qty,
      };
    });
  }, [installEnabled, itemPricings, getInstallationTier]);

  const installationTotals = useMemo(() => {
    const overrideVal = parseFloat(installOverride);
    const rawMarkup = parseFloat(installMarkup);
    const markupPct = Number.isFinite(rawMarkup) ? rawMarkup : 15;
    if (installEnabled && overrideVal > 0) {
      const cost = overrideVal;
      const sell = Math.round(cost * (1 + markupPct / 100) * 100) / 100;
      return { cost, sell, isOverride: true };
    }
    const cost = installationItems.reduce((acc, i) => acc + i.costTotal, 0);
    const sell = installationItems.reduce((acc, i) => acc + i.sellTotal, 0);
    return { cost, sell, isOverride: false };
  }, [installEnabled, installOverride, installMarkup, installationItems]);

  const deliveryTotals = useMemo(() => {
    if (!deliveryEnabled) return { cost: 0, sell: 0, isCustom: false };
    const customVal = parseFloat(deliveryCustom);
    const rawMarkup = parseFloat(deliveryMarkup);
    const markupPct = Number.isFinite(rawMarkup) ? rawMarkup : 15;
    if (customVal > 0) {
      const cost = customVal;
      const sell = Math.round(cost * (1 + markupPct / 100) * 100) / 100;
      return { cost, sell, isCustom: true };
    }
    if (deliveryMethodId) {
      const rate = deliveryRates.find((r) => r.id === deliveryMethodId);
      if (rate) {
        const d = rate.data as any;
        const cost = d.costNzd ?? (d.rateNzd ? d.rateNzd * 0.75 : 0);
        const sell = d.sellNzd ?? d.rateNzd ?? 0;
        return { cost, sell, isCustom: false };
      }
    }
    return { cost: 0, sell: 0, isCustom: false };
  }, [deliveryEnabled, deliveryMethodId, deliveryCustom, deliveryMarkup, deliveryRates]);

  const totals = useMemo(() => {
    let totalSqm = 0;
    let totalManufCost = 0;
    let itemSaleTotal = 0;
    let totalMaterials = 0;
    let totalLabor = 0;
    let totalWeight = 0;
    let totalLaborHours = 0;

    for (const ip of itemPricings) {
      totalSqm += ip.sqm;
      itemSaleTotal += ip.pricing?.salePriceNzd ?? ip.salePrice;
      if (ip.pricing) {
        totalManufCost += ip.pricing.netCostNzd;
        totalMaterials += ip.pricing.profilesCostNzd + ip.pricing.accessoriesCostNzd + ip.pricing.glassCostNzd + ip.pricing.linerCostNzd + ip.pricing.handleCostNzd + ip.pricing.wanzBarCostNzd;
        totalLabor += ip.pricing.laborCostNzd;
        totalWeight += ip.pricing.totalWeightKg;
        totalLaborHours += ip.pricing.laborHours;
      }
    }

    const installCost = installEnabled ? installationTotals.cost : 0;
    const installSell = installEnabled ? installationTotals.sell : 0;
    const delivCost = deliveryTotals.cost;
    const delivSell = deliveryTotals.sell;
    const grandTotalCost = totalManufCost + installCost + delivCost;
    const totalSaleExGst = itemSaleTotal + installSell + delivSell;
    const gstAmount = totalSaleExGst * (gstRate / 100);
    const totalSaleIncGst = totalSaleExGst + gstAmount;
    const grossProfit = totalSaleExGst - grandTotalCost;
    const grossMarginPct = totalSaleExGst > 0 ? (grossProfit / totalSaleExGst) * 100 : 0;
    const grossProfitPerHour = totalLaborHours > 0 ? grossProfit / totalLaborHours : 0;
    const avgCostPerSqm = totalSqm > 0 ? grandTotalCost / totalSqm : 0;
    const avgSalePerSqm = totalSqm > 0 ? totalSaleExGst / totalSqm : 0;

    return {
      totalSqm, totalManufCost, itemSaleTotal, totalMaterials,
      totalLabor, totalWeight, grossProfit, grossMarginPct,
      grossProfitPerHour, totalLaborHours,
      avgCostPerSqm, avgSalePerSqm, installCost, installSell,
      delivCost, delivSell, grandTotalCost, totalSaleExGst,
      gstAmount, totalSaleIncGst,
    };
  }, [itemPricings, installEnabled, installationTotals, deliveryTotals, gstRate]);

  const { toast } = useToast();

  const buildSnapshotAndPost = async (mode: "revision" | "new_quote") => {
    const snapshotItems = await Promise.all(itemPricings.map(async (ip, idx) => {
      const item = ip.item;
      let drawingImageKey: string | undefined;
      try {
        const wrapper = document.querySelector(`[data-testid="drawing-svg-${idx}"]`);
        const svgEl = wrapper?.querySelector("svg") as SVGSVGElement | null;
        if (svgEl) {
          const { svgToPngBlob } = await import("@/lib/export-png");
          const blob = await svgToPngBlob(svgEl, 2);
          const formData = new FormData();
          formData.append("file", blob, "drawing.png");
          const uploadRes = await fetch("/api/drawing-images", { method: "POST", body: formData });
          if (uploadRes.ok) {
            const { key } = await uploadRes.json();
            drawingImageKey = key;
          } else {
            console.warn(`[Snapshot] Drawing upload failed for item ${idx}: HTTP ${uploadRes.status}`);
          }
        } else if (item.width > 0 && item.height > 0) {
          console.warn(`[Snapshot] Drawing SVG not found in DOM for item ${idx} (data-testid="drawing-svg-${idx}")`);
        }
      } catch (e) {
        console.warn(`[Snapshot] Drawing capture error for item ${idx}:`, e);
      }

      const frameTypeEntry = libFrameTypes.find(ft => (ft.data as any).value === item.frameType);
      const frameTypeLabel = frameTypeEntry ? (frameTypeEntry.data as any).label : item.frameType || "";

      const specValues: Record<string, any> = {
        itemRef: item.name,
        configuration: ip.configName,
        itemCategory: item.category,
        width: item.width,
        height: item.height,
        quantity: item.quantity || 1,
        frameSeries: item.frameType || "",
        frameColor: item.frameColor || "",
        windZone: item.windZone || "",
        iguType: item.glassIguType || "",
        glassType: item.glassType || "",
        glassThickness: item.glassThickness || "",
        handleSet: item.handleType || "",
        linerType: item.linerType || "",
        flashingSize: item.flashingSize || 0,
        wallThickness: item.wallThickness || 0,
        heightFromFloor: item.heightFromFloor || 0,
        pricePerSqm: item.pricePerSqm || 500,
        configurationId: item.configurationId || "",
        layout: item.layout || "standard",
        windowType: item.windowType || "",
        hingeSide: item.hingeSide || "",
        openDirection: item.openDirection || "",
        panels: item.panels || 0,
        wanzBarEnabled: item.wanzBar || false,
        wanzBarSize: item.wanzBarSize || "",
        wanzBarSource: item.wanzBarSource || "",
      };

      const resolvedSpecs: Record<string, string> = {
        itemRef: item.name,
        configuration: ip.configName,
        itemCategory: CATEGORY_LABELS[item.category] || item.category,
        overallSize: `${item.width} x ${item.height}mm`,
        quantity: String(item.quantity || 1),
        width: `${item.width}mm`,
        height: `${item.height}mm`,
        frameSeries: frameTypeLabel,
        frameColor: item.frameColor || "",
        windZone: item.windZone || "",
        rValue: (() => {
          try {
            if (item.glassIguType) {
              const rv = getGlassRValue(item.glassIguType);
              return rv ? `R${rv}` : "";
            }
            return "";
          } catch {
            return "";
          }
        })(),
        iguType: item.glassIguType || "",
        glassType: item.glassType || "",
        glassThickness: item.glassThickness || "",
        handleSet: item.handleType || "",
        linerType: item.linerType || "",
        flashingSize: item.flashingSize ? `${item.flashingSize}mm` : "",
        wallThickness: item.wallThickness ? `${item.wallThickness}mm` : "",
        heightFromFloor: item.heightFromFloor ? `${item.heightFromFloor}mm` : "",
      };

      return {
        itemNumber: idx + 1,
        itemRef: item.name,
        title: ip.configName || item.name,
        quantity: item.quantity || 1,
        width: item.width,
        height: item.height,
        drawingImageKey,
        photos: ip.photos ?? [],
        specValues,
        resolvedSpecs,
      };
    }));

    const installSell = installEnabled ? installationTotals.sell : 0;
    const delivSell = deliveryTotals.sell;
    const itemsSubtotal = totals.itemSaleTotal;
    const subtotalExclGst = totals.totalSaleExGst;
    const gstAmount = totals.gstAmount;
    const totalInclGst = totals.totalSaleIncGst;

    const snapshot: EstimateSnapshot = {
      divisionCode: "LJ",
      customer: job?.name || "Unknown",
      specDictionaryVersion: 1,
      items: snapshotItems,
      totalsBreakdown: {
        itemsSubtotal,
        installationTotal: installSell,
        deliveryTotal: delivSell,
        subtotalExclGst,
        gstAmount,
        totalInclGst,
      },
      division: "",
      assemblies: itemPricings.map((ip) => ({
        description: ip.configName,
        width: ip.item.width,
        height: ip.item.height,
        quantity: ip.item.quantity || 1,
        sqm: ip.sqm,
        salePrice: ip.salePrice,
        cost: ip.pricing?.totalCost || 0,
      })),
      lineItems: [],
      operations: [],
      totals: {
        cost: totals.grandTotalCost,
        sell: totals.totalSaleExGst,
        grossProfit: totals.grossProfit,
        grossMargin: totals.grossMarginPct,
        totalLabourHours: totals.totalLaborHours,
        gpPerHour: totals.grossProfitPerHour,
      },
    };

    const res = await apiRequest("POST", "/api/quotes", {
      snapshot,
      sourceJobId: jobId,
      customer: job?.name || "Unknown",
      divisionCode: "LJ",
      mode,
    });
    return res.json();
  };

  const generateQuoteMutation = useMutation({
    mutationFn: () => buildSnapshotAndPost("revision"),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "quotes"] });
      if (data.isNewRevision) {
        toast({ title: `Revision ${data.revision?.versionNumber || ""} added to ${data.quote.number}`.trim() });
      } else {
        toast({ title: `Quote ${data.quote.number} created` });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Failed to generate quote", description: err.message, variant: "destructive" });
    },
  });

  const generateNewQuoteMutation = useMutation({
    mutationFn: () => buildSnapshotAndPost("new_quote"),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "quotes"] });
      toast({ title: `New quote ${data.quote.number} created under this estimate` });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create new quote", description: err.message, variant: "destructive" });
    },
  });

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
    <div className="max-w-5xl mx-auto p-4 sm:p-6 flex flex-col gap-4 sm:gap-6 overflow-x-hidden print:p-2 print:gap-4" data-testid="exec-summary-page">
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
        <div className="flex flex-wrap items-center gap-2">
          {hasExistingQuote ? (
            <>
              <div className="flex flex-col items-start">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => generateQuoteMutation.mutate()}
                  disabled={generateQuoteMutation.isPending || generateNewQuoteMutation.isPending}
                  data-testid="button-generate-quote"
                >
                  <FileText className="h-4 w-4 mr-1" />
                  {generateQuoteMutation.isPending ? "Generating..." : "Update Existing Quote"}
                </Button>
                <span className="text-xs text-muted-foreground mt-0.5 ml-1">Creates a new revision on the selected quote</span>
              </div>
              <div className="flex flex-col items-start">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateNewQuoteMutation.mutate()}
                  disabled={generateQuoteMutation.isPending || generateNewQuoteMutation.isPending}
                  data-testid="button-generate-new-quote"
                >
                  {generateNewQuoteMutation.isPending ? "Creating..." : "Create New Quote"}
                </Button>
                <span className="text-xs text-muted-foreground mt-0.5 ml-1">Creates a separate quote under this estimate</span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-start">
              <Button
                variant="default"
                size="sm"
                onClick={() => generateQuoteMutation.mutate()}
                disabled={generateQuoteMutation.isPending}
                data-testid="button-generate-quote"
              >
                <FileText className="h-4 w-4 mr-1" />
                {generateQuoteMutation.isPending ? "Generating..." : "Generate Quote"}
              </Button>
              <span className="text-xs text-muted-foreground mt-0.5 ml-1">Creates the first quote for this estimate</span>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="button-print">
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
        </div>
      </div>

      <div className="print:block hidden mb-4">
        <h1 className="text-xl font-bold">{job.name || "Untitled Job"} — Executive Summary</h1>
        {job.address && <p className="text-sm">{job.address}</p>}
        {job.date && <p className="text-sm">{job.date}</p>}
      </div>

      <div className="order-1 grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="summary-totals">
        <SummaryCard label="Total m²" value={`${totals.totalSqm.toFixed(2)} m²`} testId="text-total-sqm" />
        <SummaryCard label="Total Weight" value={`${totals.totalWeight.toFixed(1)} kg`} testId="text-total-weight" />
        <SummaryCard label="Total Items" value={String(itemPricings.length)} testId="text-total-items" />
        <SummaryCard label="USD → NZD Rate" value={`${usdToNzdRate}`} testId="text-usd-rate" />
      </div>

      <div className="order-5 md:order-2 rounded-lg border bg-card p-4 space-y-4" data-testid="financial-summary">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Financial Summary</h2>

        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px] text-sm">Category</TableHead>
                <TableHead className="text-right text-sm">Detail</TableHead>
                <TableHead className="text-right text-sm">Cost</TableHead>
                <TableHead className="text-right text-sm">Sell</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow data-testid="row-manuf-materials">
                <TableCell className="text-sm font-medium" rowSpan={3}>Manufacturing</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">Materials</TableCell>
                <TableCell className="text-right text-sm" data-testid="text-total-materials">${fmt(totals.totalMaterials)}</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">—</TableCell>
              </TableRow>
              <TableRow data-testid="row-manuf-labour">
                <TableCell className="text-right text-sm text-muted-foreground">Labour</TableCell>
                <TableCell className="text-right text-sm" data-testid="text-total-labor">${fmt(totals.totalLabor)}</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">—</TableCell>
              </TableRow>
              <TableRow className="border-b-2" data-testid="row-manuf-total">
                <TableCell className="text-right text-sm font-semibold">Total</TableCell>
                <TableCell className="text-right text-base font-bold" data-testid="text-total-manuf-cost">${fmt(totals.totalManufCost)}</TableCell>
                <TableCell className="text-right text-base font-bold" data-testid="text-item-sale-total">${fmt(totals.itemSaleTotal)}</TableCell>
              </TableRow>
              <TableRow data-testid="row-installation">
                <TableCell className="text-sm font-medium">Installation</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">{installEnabled ? (installationTotals.isOverride ? "Override" : "Per-unit") : "Disabled"}</TableCell>
                <TableCell className="text-right text-sm" data-testid="text-total-install-cost">{installEnabled ? `$${fmt(totals.installCost)}` : "—"}</TableCell>
                <TableCell className="text-right text-sm" data-testid="text-total-install-sell">{installEnabled ? `$${fmt(totals.installSell)}` : "—"}</TableCell>
              </TableRow>
              <TableRow className="border-b-2" data-testid="row-delivery">
                <TableCell className="text-sm font-medium">Delivery</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">{deliveryEnabled ? (deliveryTotals.isCustom ? "Custom" : deliveryMethodId ? "Standard" : "No method") : "Supply Only"}</TableCell>
                <TableCell className="text-right text-sm" data-testid="text-total-delivery-cost">{deliveryEnabled && totals.delivCost > 0 ? `$${fmt(totals.delivCost)}` : "—"}</TableCell>
                <TableCell className="text-right text-sm" data-testid="text-total-delivery-sell">{deliveryEnabled && totals.delivSell > 0 ? `$${fmt(totals.delivSell)}` : "—"}</TableCell>
              </TableRow>
              <TableRow className="bg-muted/30" data-testid="row-grand-total-cost">
                <TableCell colSpan={2} className="text-base font-bold">Grand Total Cost (COGS)</TableCell>
                <TableCell className="text-right text-base font-bold" data-testid="text-grand-total">${fmt(totals.grandTotalCost)}</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">—</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="md:hidden space-y-3" data-testid="financial-summary-mobile">
          <div className="rounded-md border p-3 space-y-2">
            <p className="text-sm font-medium">Manufacturing</p>
            <div className="grid grid-cols-2 gap-1 text-sm">
              <span className="text-muted-foreground">Materials</span>
              <span className="text-right" data-testid="text-total-materials-mobile">${fmt(totals.totalMaterials)}</span>
              <span className="text-muted-foreground">Labour</span>
              <span className="text-right" data-testid="text-total-labor-mobile">${fmt(totals.totalLabor)}</span>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-1 text-sm">
              <span className="font-semibold">Total Cost</span>
              <span className="text-right font-bold">${fmt(totals.totalManufCost)}</span>
              <span className="font-semibold">Total Sell</span>
              <span className="text-right font-bold">${fmt(totals.itemSaleTotal)}</span>
            </div>
          </div>

          <div className="rounded-md border p-3">
            <div className="grid grid-cols-2 gap-1 text-sm">
              <span className="font-medium">Installation</span>
              <span className="text-right text-muted-foreground">{installEnabled ? (installationTotals.isOverride ? "Override" : "Per-unit") : "Disabled"}</span>
              <span className="text-muted-foreground">Cost</span>
              <span className="text-right">{installEnabled ? `$${fmt(totals.installCost)}` : "—"}</span>
              <span className="text-muted-foreground">Sell</span>
              <span className="text-right">{installEnabled ? `$${fmt(totals.installSell)}` : "—"}</span>
            </div>
          </div>

          <div className="rounded-md border p-3">
            <div className="grid grid-cols-2 gap-1 text-sm">
              <span className="font-medium">Delivery</span>
              <span className="text-right text-muted-foreground">{deliveryEnabled ? (deliveryTotals.isCustom ? "Custom" : deliveryMethodId ? "Standard" : "No method") : "Supply Only"}</span>
              <span className="text-muted-foreground">Cost</span>
              <span className="text-right">{deliveryEnabled && totals.delivCost > 0 ? `$${fmt(totals.delivCost)}` : "—"}</span>
              <span className="text-muted-foreground">Sell</span>
              <span className="text-right">{deliveryEnabled && totals.delivSell > 0 ? `$${fmt(totals.delivSell)}` : "—"}</span>
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-3">
            <div className="grid grid-cols-2 gap-1">
              <span className="text-base font-bold">Grand Total (COGS)</span>
              <span className="text-right text-base font-bold">${fmt(totals.grandTotalCost)}</span>
            </div>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div data-testid="text-total-sale-ex-gst">
            <p className="text-sm text-muted-foreground">Sale Price (excl. GST)</p>
            <p className="text-lg font-bold text-primary mt-0.5">${fmt(totals.totalSaleExGst)}</p>
          </div>
          <div data-testid="text-gst-amount">
            <p className="text-sm text-muted-foreground">GST ({gstRate}%)</p>
            <p className="text-base font-medium mt-0.5">${fmt(totals.gstAmount)}</p>
          </div>
          <div data-testid="text-total-sale-inc-gst">
            <p className="text-sm text-muted-foreground">Sale Price (incl. GST)</p>
            <p className="text-lg font-bold text-primary mt-0.5">${fmt(totals.totalSaleIncGst)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div data-testid="text-avg-cost-sqm">
            <p className="text-sm text-muted-foreground">Avg Cost/m²</p>
            <p className="text-base font-semibold mt-0.5">${fmt(totals.avgCostPerSqm)}</p>
          </div>
          <div data-testid="text-avg-sale-sqm">
            <p className="text-sm text-muted-foreground">Avg Sale/m²</p>
            <p className="text-base font-semibold mt-0.5">${fmt(totals.avgSalePerSqm)}</p>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div data-testid="text-gross-profit">
            <p className="text-sm text-muted-foreground">Gross Profit</p>
            <p className={`text-2xl font-bold ${totals.grossProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
              ${fmt(totals.grossProfit)}
            </p>
          </div>
          <div data-testid="text-gross-margin">
            <p className="text-sm text-muted-foreground">Gross Margin</p>
            <p className={`text-2xl font-bold ${totals.grossMarginPct >= 0 ? "text-green-600" : "text-red-600"}`}>
              {totals.grossMarginPct.toFixed(1)}%
            </p>
          </div>
          <div data-testid="text-gross-profit-per-hour">
            <p className="text-sm text-muted-foreground">Gross Profit/hr</p>
            <p className={`text-2xl font-bold ${totals.grossProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
              {totals.totalLaborHours > 0 ? `$${fmt(totals.grossProfitPerHour)}/hr` : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="order-3 rounded-lg border bg-card p-4 space-y-3 print:break-before-page" data-testid="installation-section">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Installation Labour</h2>
          <div className="flex items-center gap-2 print:hidden">
            <Label htmlFor="install-toggle" className="text-sm">Enable</Label>
            <Switch
              id="install-toggle"
              checked={installEnabled}
              onCheckedChange={(v) => {
                setInstallEnabled(v);
                persistJobField("installationEnabled", v);
              }}
              data-testid="switch-installation"
            />
          </div>
        </div>
        {installEnabled && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Unit m²</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Cost/Unit</TableHead>
                  <TableHead className="text-right">Sell/Unit</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Cost Total</TableHead>
                  <TableHead className="text-right">Sell Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {installationItems.map((ii, idx) => (
                  <TableRow key={idx} data-testid={`row-install-${idx}`}>
                    <TableCell className="text-sm">{ii.name}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{CATEGORY_LABELS[ii.category] || ii.category}</Badge></TableCell>
                    <TableCell className="text-right">{ii.unitSqm.toFixed(2)}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{ii.tierName}</Badge></TableCell>
                    <TableCell className="text-right">${fmt(ii.costPerUnit)}</TableCell>
                    <TableCell className="text-right">${fmt(ii.sellPerUnit)}</TableCell>
                    <TableCell className="text-right">{ii.qty}</TableCell>
                    <TableCell className="text-right font-medium">${fmt(ii.costTotal)}</TableCell>
                    <TableCell className="text-right font-medium">${fmt(ii.sellTotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Separator />
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-sm">
                <span className="text-muted-foreground">Per-unit cost: </span>
                <span className="font-medium">${fmt(installationItems.reduce((a, i) => a + i.costTotal, 0))}</span>
                <span className="text-muted-foreground ml-3">Per-unit sell: </span>
                <span className="font-medium">${fmt(installationItems.reduce((a, i) => a + i.sellTotal, 0))}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:gap-2 print:hidden">
                <div className="col-span-1">
                  <Label className="text-sm">Override ($)</Label>
                  <Input
                    type="number"
                    className="md:w-28"
                    placeholder="—"
                    value={installOverride}
                    onChange={(e) => {
                      setInstallOverride(e.target.value);
                      const val = parseFloat(e.target.value);
                      persistJobField("installationOverride", val > 0 ? val : null);
                    }}
                    data-testid="input-installation-override"
                  />
                </div>
                <div className="col-span-1">
                  <Label className="text-sm">Markup (%)</Label>
                  <Input
                    type="number"
                    className="md:w-20"
                    value={installMarkup}
                    onChange={(e) => {
                      setInstallMarkup(e.target.value);
                      const val = parseFloat(e.target.value);
                      persistJobField("installationMarkup", val >= 0 ? val : null);
                    }}
                    data-testid="input-installation-markup"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-4 font-bold text-sm">
              <span>Cost: ${fmt(installationTotals.cost)}</span>
              <span>Sell: ${fmt(installationTotals.sell)}</span>
              {installationTotals.isOverride && <Badge variant="outline">Override</Badge>}
            </div>
          </>
        )}
        {!installEnabled && (
          <p className="text-sm text-muted-foreground py-2">Installation pricing is disabled. Toggle to enable per-unit installation costs.</p>
        )}
      </div>

      <div className="order-4 rounded-lg border bg-card p-4 space-y-3" data-testid="delivery-section">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Delivery</h2>
          <div className="flex items-center gap-2 print:hidden">
            <Label htmlFor="delivery-toggle" className="text-sm">Enable</Label>
            <Switch
              id="delivery-toggle"
              checked={deliveryEnabled}
              onCheckedChange={(v) => {
                setDeliveryEnabled(v);
                persistJobField("deliveryEnabled", v);
              }}
              data-testid="switch-delivery"
            />
          </div>
        </div>
        {deliveryEnabled && (
          <>
            <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:gap-4 print:hidden">
              <div className="col-span-2 md:flex-1 md:min-w-[200px]">
                <Label className="text-sm">Delivery Method</Label>
                <Select
                  value={deliveryMethodId}
                  onValueChange={(v) => {
                    setDeliveryMethodId(v);
                    setDeliveryCustom("");
                    persistJobField("deliveryMethod", v);
                    persistJobField("deliveryAmount", null);
                  }}
                >
                  <SelectTrigger data-testid="select-delivery-method"><SelectValue placeholder="Select delivery method" /></SelectTrigger>
                  <SelectContent>
                    {deliveryRates.map((r) => {
                      const d = r.data as any;
                      const sell = d.sellNzd ?? d.rateNzd ?? 0;
                      return <SelectItem key={r.id} value={r.id}>{d.name} {sell > 0 ? `($${sell})` : "(Custom)"}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 md:w-28">
                <Label className="text-sm">Custom Cost ($)</Label>
                <Input
                  type="number"
                  placeholder="—"
                  value={deliveryCustom}
                  onChange={(e) => {
                    setDeliveryCustom(e.target.value);
                    const val = parseFloat(e.target.value);
                    persistJobField("deliveryAmount", val > 0 ? val : null);
                  }}
                  data-testid="input-delivery-custom"
                />
              </div>
              <div className="col-span-1 md:w-20">
                <Label className="text-sm">Markup (%)</Label>
                <Input
                  type="number"
                  value={deliveryMarkup}
                  onChange={(e) => {
                    setDeliveryMarkup(e.target.value);
                    const val = parseFloat(e.target.value);
                    persistJobField("deliveryMarkup", val >= 0 ? val : null);
                  }}
                  data-testid="input-delivery-markup"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-4 font-bold text-sm" data-testid="text-delivery-total">
              <span>Cost: ${fmt(deliveryTotals.cost)}</span>
              <span>Sell: ${fmt(deliveryTotals.sell)}</span>
              {deliveryTotals.isCustom && <Badge variant="outline">Custom</Badge>}
            </div>
          </>
        )}
        {!deliveryEnabled && (
          <p className="text-sm text-muted-foreground py-2" data-testid="text-delivery-supply-only">Supply Only — Customer to Collect</p>
        )}
      </div>

      {existingQuotes.length > 0 && (
        <div className="order-4 md:order-4 rounded-lg border bg-card p-4 space-y-3 print:hidden" data-testid="quote-history-section">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Quote History</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quote #</TableHead>
                <TableHead>Revision</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {existingQuotes.map((q: any) => (
                <TableRow key={q.id} data-testid={`row-quote-history-${q.id}`}>
                  <TableCell className="font-mono font-medium" data-testid={`text-quote-history-number-${q.id}`}>{q.number}</TableCell>
                  <TableCell className="text-sm" data-testid={`text-quote-history-revision-${q.id}`}>v{q.currentRevisionNumber || 1}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" data-testid={`badge-quote-history-status-${q.id}`}>{q.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {q.updatedAt ? new Date(q.updatedAt).toLocaleDateString("en-NZ") : q.createdAt ? new Date(q.createdAt).toLocaleDateString("en-NZ") : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="order-2 md:order-5 rounded-lg border bg-card" data-testid="items-breakdown">
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
              <TableHead className="text-right">Manuf. Cost</TableHead>
              <TableHead className="text-right">Sale Price</TableHead>
              <TableHead className="text-right">Manuf. Margin</TableHead>
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
                          {ip.photos.length > 0 && (
                            <PhotoInclusionControls
                              photos={ip.photos}
                              jobId={jobId!}
                              itemId={(job?.items[idx] as any)?.id}
                              itemIndex={idx}
                            />
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

      <div style={{ position: "absolute", left: "-9999px", top: 0, overflow: "hidden", pointerEvents: "none" }} aria-hidden="true">
        {itemPricings.map((ip, idx) => (
          <div key={idx} data-testid={`drawing-svg-${idx}`} style={{ width: ip.item.width || 600, height: ip.item.height || 600 }}>
            <DrawingCanvas config={ip.item} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PhotoInclusionControls({
  photos,
  jobId,
  itemId,
  itemIndex,
}: {
  photos: ItemPhotoRef[];
  jobId: string;
  itemId: string;
  itemIndex: number;
}) {
  const includedCount = photos.filter((p) => p.includeInCustomerPdf).length;

  const updatePhotoMutation = useMutation({
    mutationFn: async (updatedPhotos: ItemPhotoRef[]) => {
      await apiRequest("PATCH", `/api/jobs/${jobId}/items/${itemId}`, { photos: updatedPhotos });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
    },
  });

  const togglePhoto = (photoKey: string) => {
    const updated = photos.map((p) =>
      p.key === photoKey ? { ...p, includeInCustomerPdf: !p.includeInCustomerPdf } : p
    );
    updatePhotoMutation.mutate(updated);
  };

  return (
    <div className="p-3 border-t space-y-2 print:hidden" data-testid={`photo-controls-${itemIndex}`}>
      <div className="flex items-center gap-2">
        <Image className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Media for Customer Quote</span>
        <span className="text-xs text-muted-foreground ml-auto" data-testid={`text-photo-count-${itemIndex}`}>
          {includedCount} photo{includedCount !== 1 ? "s" : ""} included
        </span>
      </div>
      <div className="flex flex-wrap gap-3">
        {photos.map((photo, pIdx) => (
          <div key={photo.key} className="flex flex-col items-center gap-1">
            <img
              src={`/api/item-photos/${photo.key}`}
              alt={photo.caption || `Photo ${pIdx + 1}`}
              className="h-16 w-16 object-cover rounded border"
              data-testid={`img-photo-thumb-${itemIndex}-${pIdx}`}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <div className="flex items-center gap-1">
              <Checkbox
                id={`photo-include-${itemIndex}-${pIdx}`}
                checked={!!photo.includeInCustomerPdf}
                onCheckedChange={() => togglePhoto(photo.key)}
                data-testid={`checkbox-photo-include-${itemIndex}-${pIdx}`}
              />
              <Label htmlFor={`photo-include-${itemIndex}-${pIdx}`} className="text-xs">Include</Label>
            </div>
          </div>
        ))}
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
