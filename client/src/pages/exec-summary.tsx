import { useState, useMemo, useCallback, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type QuoteItem, type JobItem, type ConfigurationProfile, type ConfigurationAccessory, type ConfigurationLabor, type FrameConfiguration, type LibraryEntry } from "@shared/schema";
import { calculatePricing, calcRakedPerimeterM, type PricingBreakdown } from "@/lib/pricing";
import { deriveConfigSignature } from "@/lib/config-signature";
import { getGlassPrice, getGlassRValue } from "@shared/glass-library";
import { LINER_TYPES, DOOR_CATEGORIES, getHandlesForCategory, getHandleTypeForCategory, getLocksForCategory, getLockTypeForCategory, HANDLE_CATEGORIES, LOCK_CATEGORIES, WANZ_BAR_DEFAULTS, WINDOW_CATEGORIES, isDoorCategory } from "@shared/item-options";
import { useSettings } from "@/lib/settings-context";
import { routes } from "@/lib/routes";
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeftCircle, ChevronDown, ChevronRight, FileText, Image, ClipboardList, ArrowRight, Clock, Download, HardHat, ExternalLink, Package, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { EstimateSnapshot } from "@shared/estimate-snapshot";
import DrawingCanvas from "@/components/drawing-canvas";
import LifecyclePanel from "@/components/lifecycle-panel";
import { generateSubcontractorPdf, type SubcontractorPdfItem, type SubcontractorPdfOptions, type ScopeFields, type ItemFilter, type DocumentPurpose } from "@/lib/subcontractor-pdf";
import { svgToPngBlob } from "@/lib/export-png";

function calcSqm(width: number, height: number, quantity: number, item?: any): number {
  if (item && item.category === "raked-fixed") {
    const lh = item.rakedLeftHeight || item.height || height;
    const rh = item.rakedRightHeight || item.height || height;
    return (width * ((lh + rh) / 2) * quantity) / 1_000_000;
  }
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
  "raked-fixed": "Raked/Triangular Fixed",
};

interface JobData {
  id: string;
  name: string;
  address?: string;
  date?: string;
  siteType?: string | null;
  installationEnabled?: boolean;
  installationOverride?: number | null;
  installationMarkup?: number | null;
  deliveryEnabled?: boolean;
  deliveryMethod?: string | null;
  deliveryAmount?: number | null;
  deliveryMarkup?: number | null;
  removalEnabled?: boolean;
  removalOverride?: number | null;
  removalMarkup?: number | null;
  rubbishEnabled?: boolean;
  rubbishTonnage?: number | null;
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
  const [removalEnabled, setRemovalEnabled] = useState(false);
  const [removalOverride, setRemovalOverride] = useState<string>("");
  const [removalMarkup, setRemovalMarkup] = useState<string>("15");
  const [rubbishEnabled, setRubbishEnabled] = useState(false);
  const [rubbishTonnage, setRubbishTonnage] = useState<string>("");
  const [initialized, setInitialized] = useState(false);
  const [disabledInstallLines, setDisabledInstallLines] = useState<Set<number>>(new Set());
  const [disabledRemovalLines, setDisabledRemovalLines] = useState<Set<number>>(new Set());

  const [subconDialogOpen, setSubconDialogOpen] = useState(false);
  const [subconScopeMode, setSubconScopeMode] = useState<"renovation" | "new_build">("renovation");
  const [subconWorkPackage, setSubconWorkPackage] = useState<"install_only" | "removal_disposal_install">("removal_disposal_install");
  const [subconIncludeDrawings, setSubconIncludeDrawings] = useState(true);
  const [subconIncludeSitePhotos, setSubconIncludeSitePhotos] = useState(true);
  const [subconIncludePricingReturn, setSubconIncludePricingReturn] = useState(true);
  const [subconItemFilter, setSubconItemFilter] = useState<ItemFilter>("all");
  const [subconDocPurpose, setSubconDocPurpose] = useState<DocumentPurpose>("install_scope");
  const [subconGenerating, setSubconGenerating] = useState(false);
  const [subconProgress, setSubconProgress] = useState("");
  const [subconScopeFields, setSubconScopeFields] = useState<ScopeFields>({
    sealant: "included",
    flashings: "included",
    wanzBars: "excluded",
    siteCleanup: "included",
    makingGood: "by_others",
    accessCondition: "standard",
    includeVariationChecklist: true,
  });

  const SECTION_KEYS = ["financial", "installation", "delivery", "removal", "rubbish", "history", "items", "lifecycle"] as const;
  type SectionKey = typeof SECTION_KEYS[number];
  const [sectionCollapsed, setSectionCollapsed] = useState<Record<SectionKey, boolean>>({
    financial: false, installation: false, delivery: false,
    removal: false, rubbish: false, history: false, items: false, lifecycle: true,
  });
  const toggleSection = (key: SectionKey) => setSectionCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  const expandAll = () => setSectionCollapsed({ financial: false, installation: false, delivery: false, removal: false, rubbish: false, history: false, items: false, lifecycle: false });
  const collapseAll = () => setSectionCollapsed({ financial: true, installation: true, delivery: true, removal: true, rubbish: true, history: true, items: true, lifecycle: true });
  const allCollapsed = SECTION_KEYS.every(k => sectionCollapsed[k]);

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
  const { data: libEntranceDoorLocks = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "entrance_door_lock"], queryFn: fetchLib("entrance_door_lock") });
  const { data: libHingeDoorLocks = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "hinge_door_lock"], queryFn: fetchLib("hinge_door_lock") });
  const { data: libSlidingDoorLocks = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "sliding_door_lock"], queryFn: fetchLib("sliding_door_lock") });
  const { data: libBifoldDoorLocks = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "bifold_door_lock"], queryFn: fetchLib("bifold_door_lock") });
  const { data: libStackerDoorLocks = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "stacker_door_lock"], queryFn: fetchLib("stacker_door_lock") });
  const { data: libFrenchDoorLocks = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "french_door_lock"], queryFn: fetchLib("french_door_lock") });
  const { data: libWanzBars = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "wanz_bar"], queryFn: fetchLib("wanz_bar") });
  const { data: masterProfiles = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "direct_profile"], queryFn: fetchLib("direct_profile") });
  const { data: masterAccessories = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "direct_accessory"], queryFn: fetchLib("direct_accessory") });
  const { data: masterLabour = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "labour_operation"], queryFn: fetchLib("labour_operation") });
  const { data: installationRates = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "installation_rate"], queryFn: fetchLib("installation_rate") });
  const { data: deliveryRates = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "delivery_rate"], queryFn: fetchLib("delivery_rate") });
  const { data: removalRates = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "removal_rate"], queryFn: fetchLib("removal_rate") });
  const { data: generalWasteRates = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "general_waste"], queryFn: fetchLib("general_waste") });

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
      setRemovalEnabled(!!job.removalEnabled);
      setRemovalOverride(job.removalOverride != null ? String(job.removalOverride) : "");
      setRemovalMarkup(job.removalMarkup != null ? String(job.removalMarkup) : "15");
      setRubbishEnabled(!!job.rubbishEnabled);
      setRubbishTonnage(job.rubbishTonnage != null ? String(job.rubbishTonnage) : "");
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

  const locksByType: Record<string, LibraryEntry[]> = {
    entrance_door_lock: libEntranceDoorLocks,
    hinge_door_lock: libHingeDoorLocks,
    sliding_door_lock: libSlidingDoorLocks,
    bifold_door_lock: libBifoldDoorLocks,
    stacker_door_lock: libStackerDoorLocks,
    french_door_lock: libFrenchDoorLocks,
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
  const lookupLockPrice = (lockType: string, cat: string): number | null => {
    if (!lockType) return null;
    if (lockType === "Customer-Supplied" || lockType === "TBC") return 0;
    const catLockType = getLockTypeForCategory(cat);
    const catLocks = locksByType[catLockType] || [];
    if (catLocks.length > 0) {
      const entry = catLocks.find((e) => (e.data as any).value === lockType);
      const dbPrice = entry ? (entry.data as any).priceProvision : null;
      if (dbPrice != null) return dbPrice;
    }
    return getLocksForCategory(cat).find((l) => l.value === lockType)?.priceProvision ?? null;
  };

  const itemPricings: ItemPricingData[] = useMemo(() => {
    if (!job) return [];
    return job.items.map((ji: any) => {
      const item = ji.config as QuoteItem;
      const sqm = calcSqm(item.width, item.height, item.quantity || 1, item);
      const overrideMode = item.overrideMode || "none";
      const overrideVal = item.overrideValue ?? null;
      const salePriceOverride = overrideMode === "total_sell" && overrideVal ? overrideVal
        : overrideMode === "per_sqm" && overrideVal ? overrideVal * sqm
        : null;
      const salePrice = salePriceOverride ?? ((item.pricePerSqm || 500) * sqm);
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
              lockPriceEach: lookupLockPrice(item.lockType || "", item.category),
              openingPanelCount: openingPanels,
              wanzBar: wanzBarInput,
              salePriceOverride: salePriceOverride ?? undefined,
              sqmOverride: item.category === "raked-fixed" ? (((item as any).rakedLeftHeight || item.height || 0) + ((item as any).rakedRightHeight || item.height || 0)) / 2 * item.width / 1_000_000 : undefined,
              perimeterOverrideM: item.category === "raked-fixed" ? calcRakedPerimeterM(item.width, (item as any).rakedLeftHeight || item.height || 0, (item as any).rakedRightHeight || item.height || 0) : undefined,
              gosChargeNzd: item.gosRequired ? (item.gosChargeNzd ?? undefined) : undefined,
            },
            { masterProfiles, masterAccessories, masterLabour }
          );
        }
      }

      return { item, sqm, salePrice, pricing, configName, photos };
    });
  }, [job, configData, configNameMap, usdToNzdRate, libGlass, libLiners, libWindowHandles, libDoorHandles, libAwningHandles, libSlidingWindowHandles, libEntranceDoorHandles, libHingeDoorHandles, libSlidingDoorHandles, libBifoldDoorHandles, libStackerDoorHandles, libEntranceDoorLocks, libHingeDoorLocks, libSlidingDoorLocks, libBifoldDoorLocks, libStackerDoorLocks, libFrenchDoorLocks, libWanzBars, masterProfiles, masterAccessories, masterLabour]);

  const getMatchingRates = useCallback((rates: typeof installationRates, category: string, sqm: number) => {
    const isDoor = DOOR_CATEGORIES.includes(category);
    const itemCat = isDoor ? "door" : "window";
    const matched: Array<{ name: string; cost: number; sell: number; pricingBasis: string }> = [];
    const catGroups = new Map<string, typeof rates>();
    for (const r of rates) {
      const d = r.data as any;
      const rc = d.category || "window";
      if (rc !== itemCat && rc !== "all") continue;
      if (!catGroups.has(rc)) catGroups.set(rc, []);
      catGroups.get(rc)!.push(r);
    }
    for (const [, group] of catGroups) {
      let found = false;
      for (const t of group) {
        const d = t.data as any;
        if (sqm >= d.minSqm && sqm < d.maxSqm) {
          matched.push({ name: d.name, cost: d.costPerUnit ?? (d.pricePerUnit ? d.pricePerUnit * 0.75 : 0), sell: d.sellPerUnit ?? d.pricePerUnit ?? 0, pricingBasis: d.pricingBasis || "per_item" });
          found = true;
          break;
        }
      }
      if (!found && group.length > 0) {
        const last = group[group.length - 1].data as any;
        matched.push({ name: last.name, cost: last.costPerUnit ?? (last.pricePerUnit ? last.pricePerUnit * 0.75 : 0), sell: last.sellPerUnit ?? last.pricePerUnit ?? 0, pricingBasis: last.pricingBasis || "per_item" });
      }
    }
    return matched;
  }, []);

  const deriveBasisQty = useCallback((basis: string, item: { width: number; height: number; quantity: number }) => {
    const qty = item.quantity || 1;
    if (basis === "per_m2") {
      const areaSqm = (item as any).category === "raked-fixed"
        ? calcSqm(item.width, item.height, 1, item as any)
        : (item.width * item.height) / 1_000_000;
      return { basisQty: areaSqm, totalMultiplier: areaSqm * qty, label: `${areaSqm.toFixed(2)} m²` };
    }
    if (basis === "per_lm") {
      const perimeterLm = (item as any).category === "raked-fixed"
        ? calcRakedPerimeterM(item.width, (item as any).rakedLeftHeight || item.height || 0, (item as any).rakedRightHeight || item.height || 0)
        : 2 * (item.width + item.height) / 1000;
      return { basisQty: perimeterLm, totalMultiplier: perimeterLm * qty, label: `${perimeterLm.toFixed(2)} l/m` };
    }
    return { basisQty: 1, totalMultiplier: qty, label: `${qty} item${qty !== 1 ? "s" : ""}` };
  }, []);

  const installationItems = useMemo(() => {
    if (!installEnabled) return [];
    const lines: Array<{
      name: string; category: string; unitSqm: number; qty: number;
      tierName: string; costPerUnit: number; sellPerUnit: number;
      costTotal: number; sellTotal: number;
      pricingBasis: string; basisQtyLabel: string; basisQty: number;
    }> = [];
    for (const ip of itemPricings) {
      const unitSqm = ip.item.category === "raked-fixed"
        ? calcSqm(ip.item.width, ip.item.height, 1, ip.item)
        : (ip.item.width * ip.item.height) / 1_000_000;
      const qty = ip.item.quantity || 1;
      const matched = getMatchingRates(installationRates, ip.item.category, unitSqm);
      if (matched.length === 0) {
        lines.push({
          name: ip.item.name, category: ip.item.category, unitSqm, qty,
          tierName: "—", costPerUnit: 0, sellPerUnit: 0, costTotal: 0, sellTotal: 0,
          pricingBasis: "per_item", basisQtyLabel: `${qty} item${qty !== 1 ? "s" : ""}`, basisQty: qty,
        });
      } else {
        for (const rate of matched) {
          const bq = deriveBasisQty(rate.pricingBasis, ip.item);
          lines.push({
            name: ip.item.name, category: ip.item.category, unitSqm, qty,
            tierName: rate.name, costPerUnit: rate.cost, sellPerUnit: rate.sell,
            costTotal: rate.cost * bq.totalMultiplier, sellTotal: rate.sell * bq.totalMultiplier,
            pricingBasis: rate.pricingBasis, basisQtyLabel: bq.label, basisQty: bq.basisQty,
          });
        }
      }
    }
    return lines;
  }, [installEnabled, itemPricings, installationRates, getMatchingRates, deriveBasisQty]);

  const installationTotals = useMemo(() => {
    const overrideVal = parseFloat(installOverride);
    const rawMarkup = parseFloat(installMarkup);
    const markupPct = Number.isFinite(rawMarkup) ? rawMarkup : 15;
    if (installEnabled && overrideVal > 0) {
      const cost = overrideVal;
      const sell = Math.round(cost * (1 + markupPct / 100) * 100) / 100;
      return { cost, sell, isOverride: true };
    }
    const cost = installationItems.reduce((acc, i, idx) => acc + (disabledInstallLines.has(idx) ? 0 : i.costTotal), 0);
    const sell = Math.round(cost * (1 + markupPct / 100) * 100) / 100;
    return { cost, sell, isOverride: false };
  }, [installEnabled, installOverride, installMarkup, installationItems, disabledInstallLines]);

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

  const removalItems = useMemo(() => {
    if (!removalEnabled) return [];
    const lines: Array<{
      name: string; category: string; unitSqm: number; qty: number;
      tierName: string; costPerUnit: number; sellPerUnit: number;
      costTotal: number; sellTotal: number;
      pricingBasis: string; basisQtyLabel: string; basisQty: number;
    }> = [];
    for (const ip of itemPricings) {
      const unitSqm = ip.item.category === "raked-fixed"
        ? calcSqm(ip.item.width, ip.item.height, 1, ip.item)
        : (ip.item.width * ip.item.height) / 1_000_000;
      const qty = ip.item.quantity || 1;
      const matched = getMatchingRates(removalRates, ip.item.category, unitSqm);
      if (matched.length === 0) {
        lines.push({
          name: ip.item.name, category: ip.item.category, unitSqm, qty,
          tierName: "—", costPerUnit: 0, sellPerUnit: 0, costTotal: 0, sellTotal: 0,
          pricingBasis: "per_item", basisQtyLabel: `${qty} item${qty !== 1 ? "s" : ""}`, basisQty: qty,
        });
      } else {
        for (const rate of matched) {
          const bq = deriveBasisQty(rate.pricingBasis, ip.item);
          lines.push({
            name: ip.item.name, category: ip.item.category, unitSqm, qty,
            tierName: rate.name, costPerUnit: rate.cost, sellPerUnit: rate.sell,
            costTotal: rate.cost * bq.totalMultiplier, sellTotal: rate.sell * bq.totalMultiplier,
            pricingBasis: rate.pricingBasis, basisQtyLabel: bq.label, basisQty: bq.basisQty,
          });
        }
      }
    }
    return lines;
  }, [removalEnabled, itemPricings, removalRates, getMatchingRates, deriveBasisQty]);

  const removalTotals = useMemo(() => {
    const overrideVal = parseFloat(removalOverride);
    const rawMarkup = parseFloat(removalMarkup);
    const markupPct = Number.isFinite(rawMarkup) ? rawMarkup : 15;
    if (removalEnabled && overrideVal > 0) {
      const cost = overrideVal;
      const sell = Math.round(cost * (1 + markupPct / 100) * 100) / 100;
      return { cost, sell, isOverride: true };
    }
    const cost = removalItems.reduce((acc, i, idx) => acc + (disabledRemovalLines.has(idx) ? 0 : i.costTotal), 0);
    const sell = Math.round(cost * (1 + markupPct / 100) * 100) / 100;
    return { cost, sell, isOverride: false };
  }, [removalEnabled, removalOverride, removalMarkup, removalItems, disabledRemovalLines]);

  const rubbishTotals = useMemo(() => {
    if (!rubbishEnabled) return { cost: 0, sell: 0, rateEntry: null as any };
    const rate = generalWasteRates[0];
    if (!rate) return { cost: 0, sell: 0, rateEntry: null as any };
    const d = rate.data as any;
    const tonnes = parseFloat(rubbishTonnage);
    if (!Number.isFinite(tonnes) || tonnes <= 0) return { cost: 0, sell: 0, rateEntry: d };
    const cost = Math.round(d.costPerTonne * tonnes * 100) / 100;
    const sell = Math.round(d.sellPerTonne * tonnes * 100) / 100;
    return { cost, sell, rateEntry: d };
  }, [rubbishEnabled, rubbishTonnage, generalWasteRates]);

  const totals = useMemo(() => {
    let totalSqm = 0;
    let totalManufCost = 0;
    let itemSaleTotal = 0;
    let totalMaterials = 0;
    let totalLabor = 0;
    let totalWeight = 0;
    let totalLaborHours = 0;

    let outsourcedCostTotal = 0;
    let outsourcedSellTotal = 0;
    let outsourcedCount = 0;
    let outsourcedIncompleteCount = 0;
    let gosRevenueTotal = 0;
    let gosItemCount = 0;

    for (const ip of itemPricings) {
      const isOutsourced = (ip.item.fulfilmentSource || "in-house") === "outsourced";
      totalSqm += ip.sqm;

      if (ip.item.gosRequired) {
        gosItemCount++;
      }

      if (isOutsourced) {
        outsourcedCount++;
        const hasCost = ip.item.outsourcedCostNzd != null;
        const hasSell = ip.item.outsourcedSellNzd != null;
        if (hasCost && hasSell) {
          outsourcedCostTotal += ip.item.outsourcedCostNzd!;
          outsourcedSellTotal += ip.item.outsourcedSellNzd!;
          totalManufCost += ip.item.outsourcedCostNzd!;
          itemSaleTotal += ip.item.outsourcedSellNzd!;
        } else {
          outsourcedIncompleteCount++;
        }
      } else {
        itemSaleTotal += ip.pricing?.salePriceNzd ?? ip.salePrice;
        if (ip.pricing) {
          totalManufCost += ip.pricing.netCostNzd;
          totalMaterials += ip.pricing.profilesCostNzd + ip.pricing.accessoriesCostNzd + ip.pricing.glassCostNzd + ip.pricing.linerCostNzd + ip.pricing.handleCostNzd + ip.pricing.wanzBarCostNzd;
          totalLabor += ip.pricing.laborCostNzd;
          totalWeight += ip.pricing.totalWeightKg;
          totalLaborHours += ip.pricing.laborHours;
          if (ip.pricing.gosSellNzd > 0) {
            gosRevenueTotal += ip.pricing.gosSellNzd;
          }
        }
      }
    }

    const installCost = installEnabled ? installationTotals.cost : 0;
    const installSell = installEnabled ? installationTotals.sell : 0;
    const delivCost = deliveryTotals.cost;
    const delivSell = deliveryTotals.sell;
    const removalCost = removalEnabled ? removalTotals.cost : 0;
    const removalSell = removalEnabled ? removalTotals.sell : 0;
    const rubbishCost = rubbishEnabled ? rubbishTotals.cost : 0;
    const rubbishSell = rubbishEnabled ? rubbishTotals.sell : 0;
    const grandTotalCost = totalManufCost + installCost + delivCost + removalCost + rubbishCost;
    const totalSaleExGst = itemSaleTotal + installSell + delivSell + removalSell + rubbishSell;
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
      delivCost, delivSell, removalCost, removalSell, rubbishCost, rubbishSell,
      grandTotalCost, totalSaleExGst, gstAmount, totalSaleIncGst,
      outsourcedCostTotal, outsourcedSellTotal, outsourcedCount, outsourcedIncompleteCount,
      gosRevenueTotal, gosItemCount,
    };
  }, [itemPricings, installEnabled, installationTotals, deliveryTotals, removalEnabled, removalTotals, rubbishEnabled, rubbishTotals, gstRate]);

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
        lockSet: item.lockType || "",
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

      const isRaked = item.category === "raked-fixed";
      const rakedLH = isRaked ? (item.rakedLeftHeight || item.height || 0) : 0;
      const rakedRH = isRaked ? (item.rakedRightHeight || item.height || 0) : 0;

      const resolvedSpecs: Record<string, string> = {
        itemRef: item.name,
        configuration: ip.configName,
        itemCategory: CATEGORY_LABELS[item.category] || item.category,
        overallSize: isRaked ? `${item.width}mm W × ${rakedLH}/${rakedRH}mm H (L/R)` : `${item.width} x ${item.height}mm`,
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
        lockSet: item.lockType || "",
        linerType: item.linerType || "",
        flashingSize: item.flashingSize ? `${item.flashingSize}mm` : "",
        wallThickness: item.wallThickness ? `${item.wallThickness}mm` : "",
        heightFromFloor: item.heightFromFloor ? `${item.heightFromFloor}mm` : "",
        ...(item.category === "bay-window" ? {
          bayAngle: `${item.bayAngle || 135}°`,
          bayDepth: (item.bayDepth || 0) > 0 ? `${item.bayDepth}mm` : "",
        } : {}),
      };

      return {
        itemNumber: idx + 1,
        itemRef: item.name,
        title: ip.configName || item.name,
        quantity: item.quantity || 1,
        width: item.width,
        height: item.height,
        category: item.category,
        ...(isRaked ? { rakedLeftHeight: rakedLH, rakedRightHeight: rakedRH } : {}),
        ...(item.category === "bay-window" ? { bayAngle: item.bayAngle || 135, bayDepth: item.bayDepth || 0 } : {}),
        openingDirection: item.openingDirection || undefined,
        gosRequired: item.gosRequired || false,
        gosChargeNzd: item.gosChargeNzd ?? undefined,
        catDoorEnabled: item.catDoorEnabled || false,
        drawingImageKey,
        photos: ip.photos ?? [],
        specValues,
        resolvedSpecs,
      };
    }));

    const installSell = installEnabled ? installationTotals.sell : 0;
    const delivSell = deliveryTotals.sell;
    const removalSell = removalEnabled ? removalTotals.sell : 0;
    const rubbishSell = rubbishEnabled ? rubbishTotals.sell : 0;
    const itemsSubtotal = totals.itemSaleTotal;
    const subtotalExclGst = totals.totalSaleExGst;
    const gstAmount = totals.gstAmount;
    const totalInclGst = totals.totalSaleIncGst;

    const lockExclusions: string[] = [];
    for (const ip of itemPricings) {
      if (!isDoorCategory(ip.item.category)) continue;
      const lt = ip.item.lockType || "";
      if (!lt || lt === "Customer-Supplied") {
        lockExclusions.push(`${ip.item.name}: Lock not included in supply — Customer Supplied`);
      } else if (lt === "TBC") {
        lockExclusions.push(`${ip.item.name}: Lock selection TBC — not included in current pricing`);
      }
    }

    const snapshot: EstimateSnapshot = {
      divisionCode: "LJ",
      customer: job?.name || "Unknown",
      specDictionaryVersion: 1,
      items: snapshotItems,
      ...(lockExclusions.length > 0 ? { exclusions: lockExclusions } : {}),
      totalsBreakdown: {
        itemsSubtotal,
        installationTotal: installSell,
        deliveryTotal: delivSell,
        removalTotal: removalSell,
        rubbishTotal: rubbishSell,
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
        cost: ip.pricing?.netCostNzd || 0,
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

    const derivedQuoteType = (job?.siteType === "renovation" || job?.siteType === "new_build") ? job.siteType : undefined;

    const res = await apiRequest("POST", "/api/quotes", {
      snapshot,
      sourceJobId: jobId,
      customer: job?.name || "Unknown",
      divisionCode: "LJ",
      mode,
      ...(derivedQuoteType ? { quoteType: derivedQuoteType } : {}),
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

  const handleSubcontractorPdf = async () => {
    if (!job || itemPricings.length === 0 || subconGenerating) return;
    setSubconGenerating(true);
    setSubconProgress("");
    toast({ title: subconDocPurpose === "supply_rfq" ? "Generating Supply / Fabrication RFQ PDF..." : "Generating Subcontractor Install Scope PDF..." });
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50)));
    try {
      const pdfItems: SubcontractorPdfItem[] = [];
      for (let i = 0; i < itemPricings.length; i++) {
        const ip = itemPricings[i];
        setSubconProgress(`Preparing item ${i + 1} of ${itemPricings.length}...`);
        if (i > 0 && i % 2 === 0) {
          await new Promise((r) => setTimeout(r, 0));
        }
        let drawingDataUrl: string | null = null;
        if (subconIncludeDrawings) {
          try {
            const wrapper = document.querySelector(`[data-testid="drawing-svg-${i}"]`);
            const svgEl = wrapper?.querySelector("svg") as SVGSVGElement | null;
            if (svgEl) {
              const blob = await svgToPngBlob(svgEl, 2);
              const bmp = await createImageBitmap(blob);
              const maxEdge = 1200;
              let cw = bmp.width;
              let ch = bmp.height;
              if (Math.max(cw, ch) > maxEdge) {
                const scale = maxEdge / Math.max(cw, ch);
                cw = Math.round(cw * scale);
                ch = Math.round(ch * scale);
              }
              const canvas = document.createElement("canvas");
              canvas.width = cw;
              canvas.height = ch;
              const ctx = canvas.getContext("2d")!;
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, cw, ch);
              ctx.drawImage(bmp, 0, 0, cw, ch);
              drawingDataUrl = canvas.toDataURL("image/jpeg", 0.85);
            }
          } catch { /* skip */ }
        }

        let photoDataUrls: string[] = [];
        if (subconIncludeSitePhotos && ip.photos.length > 0) {
          for (const photo of ip.photos) {
            try {
              const res = await fetch(`/api/item-photos/${photo.key}`);
              if (res.ok) {
                const blob = await res.blob();
                const dataUrl = await new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(blob);
                });
                photoDataUrls.push(dataUrl);
              }
            } catch { /* skip */ }
          }
        }

        const panels = ip.item.panels;
        let layout = "";
        if (panels && Array.isArray(panels) && panels.length > 0) {
          layout = panels.map((p: any) => p.openingDirection || p.type || "").filter(Boolean).join(", ");
        }

        pdfItems.push({
          name: ip.item.name || `Item ${i + 1}`,
          category: ip.item.category || "",
          location: ip.item.location || undefined,
          width: ip.item.width || 0,
          height: ip.item.height || 0,
          quantity: ip.item.quantity || 1,
          layout: layout || undefined,
          notes: ip.item.notes || undefined,
          drawingDataUrl,
          photoDataUrls: photoDataUrls.length > 0 ? photoDataUrls : undefined,
          fulfilmentSource: (ip.item as any).fulfilmentSource || "in-house",
          rakedLeftHeight: ip.item.category === "raked-fixed" ? ((ip.item as any).rakedLeftHeight || ip.item.height || 0) : undefined,
          rakedRightHeight: ip.item.category === "raked-fixed" ? ((ip.item as any).rakedRightHeight || ip.item.height || 0) : undefined,
        });
      }

      const opts: SubcontractorPdfOptions = {
        scopeMode: subconScopeMode,
        workPackage: subconWorkPackage,
        scopeFields: subconScopeFields,
        documentPurpose: subconDocPurpose,
        projectName: job.name || "Untitled Project",
        siteAddress: job.address || undefined,
        clientName: (job as any).clientName || undefined,
        dateIssued: new Date().toLocaleDateString("en-NZ"),
        preparedBy: undefined,
        items: pdfItems,
        itemFilter: subconItemFilter,
        includeDrawings: subconIncludeDrawings,
        includeSitePhotos: subconIncludeSitePhotos,
        includePricingReturn: subconIncludePricingReturn,
      };

      const pdf = await generateSubcontractorPdf(opts, setSubconProgress);
      const purposeLabel = subconDocPurpose === "supply_rfq" ? "SupplyRFQ" : "InstallScope";
      const scopeLabel = subconDocPurpose === "install_scope" ? `_${subconScopeMode === "renovation" ? "Renovation" : "NewBuild"}` : "";
      const filterSuffix = subconItemFilter === "outsourced_only" ? "_Outsourced" : subconItemFilter === "in_house_only" ? "_InHouse" : "";
      const filename = `${(job.name || "Job").replace(/[^a-zA-Z0-9_-]/g, "_")}_${purposeLabel}${scopeLabel}${filterSuffix}.pdf`;
      pdf.save(filename);
      toast({ title: "Subcontractor PDF downloaded successfully" });
      setSubconDialogOpen(false);
    } catch (e) {
      console.error("Subcontractor PDF generation error:", e);
      toast({ title: "Failed to generate Subcontractor PDF", variant: "destructive" });
    } finally {
      setSubconGenerating(false);
    }
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
          <Button variant="ghost" size="icon" onClick={() => navigate(routes.jobDetail(jobId!))} data-testid="button-back-to-job">
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-download-menu">
                <Download className="w-4 h-4 mr-1.5" /> Download <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSubconDialogOpen(true)} disabled={itemPricings.length === 0} data-testid="menu-subcontractor-pdf">
                <HardHat className="w-4 h-4 mr-2" />
                Subcontractor Document (PDF)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {hasExistingQuote && (() => {
        const primaryQuote = existingQuotes.find((q: any) => q.status === "accepted")
          || existingQuotes.find((q: any) => q.status === "sent")
          || existingQuotes.find((q: any) => q.status === "review")
          || existingQuotes.find((q: any) => q.status === "draft")
          || existingQuotes[0];
        return (
          <div className="flex items-center gap-3 rounded-md border bg-card px-3 py-2 print:hidden" data-testid="metadata-linked-quote">
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">Linked Quote:</span>
            <Badge variant="outline" className="text-xs font-mono" data-testid="badge-header-quote-ref">
              {primaryQuote.number || primaryQuote.id?.slice(0, 8)}
            </Badge>
            <Badge variant="secondary" className="text-xs capitalize">
              {primaryQuote.status}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1 ml-auto"
              onClick={() => navigate(routes.quoteDetail(primaryQuote.id))}
              data-testid="button-header-open-quote"
            >
              <ExternalLink className="h-3 w-3" /> Open Quote
            </Button>
          </div>
        );
      })()}

      <Dialog open={subconDialogOpen} onOpenChange={setSubconDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto" data-testid="dialog-subcontractor-config">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HardHat className="h-5 w-5" />
              {subconDocPurpose === "supply_rfq" ? "Supply / Fabrication RFQ" : "Subcontractor Install Scope PDF"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Document Purpose</Label>
              <RadioGroup value={subconDocPurpose} onValueChange={(v) => setSubconDocPurpose(v as DocumentPurpose)} className="flex flex-col gap-1.5">
                <div className={`flex items-center gap-2 rounded-md px-2 py-1.5 border ${subconDocPurpose === "install_scope" ? "border-blue-300 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-950/30" : "border-transparent"}`}>
                  <RadioGroupItem value="install_scope" id="purpose-install" data-testid="radio-purpose-install" />
                  <Label htmlFor="purpose-install" className="cursor-pointer text-sm">Subcontractor Install Scope</Label>
                </div>
                <div className={`flex items-center gap-2 rounded-md px-2 py-1.5 border ${subconDocPurpose === "supply_rfq" ? "border-violet-300 bg-violet-50/50 dark:border-violet-700 dark:bg-violet-950/30" : "border-transparent"}`}>
                  <RadioGroupItem value="supply_rfq" id="purpose-rfq" data-testid="radio-purpose-rfq" />
                  <Label htmlFor="purpose-rfq" className="cursor-pointer text-sm">Supply / Fabrication RFQ</Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                {subconDocPurpose === "supply_rfq"
                  ? "Request for pricing from a supplier or fabricator — supply/manufacture only, no installation"
                  : "Installation pricing scope for a subcontractor — removal, install, and site work"}
              </p>
            </div>

            {subconDocPurpose === "install_scope" && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Scope Type</Label>
                  <RadioGroup value={subconScopeMode} onValueChange={(v) => setSubconScopeMode(v as "renovation" | "new_build")} className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="renovation" id="scope-renovation" data-testid="radio-scope-renovation" />
                      <Label htmlFor="scope-renovation" className="cursor-pointer">Renovation</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="new_build" id="scope-new-build" data-testid="radio-scope-new-build" />
                      <Label htmlFor="scope-new-build" className="cursor-pointer">New Build</Label>
                    </div>
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground">
                    {subconScopeMode === "renovation"
                      ? "Includes removal, disposal, and installation scope"
                      : "Includes installation to prepared openings only"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Work Package</Label>
                  <RadioGroup value={subconWorkPackage} onValueChange={(v) => setSubconWorkPackage(v as "install_only" | "removal_disposal_install")} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="removal_disposal_install" id="wp-rdi" data-testid="radio-wp-removal" />
                      <Label htmlFor="wp-rdi" className="cursor-pointer text-sm">Removal + disposal + install</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="install_only" id="wp-io" data-testid="radio-wp-install-only" />
                      <Label htmlFor="wp-io" className="cursor-pointer text-sm">Install only</Label>
                    </div>
                  </RadioGroup>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Item Filter</Label>
              <RadioGroup value={subconItemFilter} onValueChange={(v) => setSubconItemFilter(v as ItemFilter)} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="all" id="filter-all" data-testid="radio-filter-all" />
                  <Label htmlFor="filter-all" className="cursor-pointer text-sm">All items</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="outsourced_only" id="filter-outsourced" data-testid="radio-filter-outsourced" />
                  <Label htmlFor="filter-outsourced" className="cursor-pointer text-sm">Outsourced items only</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="in_house_only" id="filter-inhouse" data-testid="radio-filter-inhouse" />
                  <Label htmlFor="filter-inhouse" className="cursor-pointer text-sm">In-house items only</Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                {subconItemFilter === "outsourced_only"
                  ? "Only outsourced items will appear in the subcontractor document"
                  : subconItemFilter === "in_house_only"
                    ? "Only in-house items will appear in the document"
                    : "All items will be included regardless of fulfilment source"}
              </p>
            </div>

            {subconDocPurpose === "install_scope" && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Scope Definition</Label>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Sealant</Label>
                  <Select value={subconScopeFields.sealant} onValueChange={(v) => setSubconScopeFields(p => ({ ...p, sealant: v as any }))}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-sealant"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="included">Included</SelectItem>
                      <SelectItem value="excluded">Excluded</SelectItem>
                      <SelectItem value="price_separately">Price separately</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Flashings</Label>
                  <Select value={subconScopeFields.flashings} onValueChange={(v) => setSubconScopeFields(p => ({ ...p, flashings: v as any }))}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-flashings"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="included">Included</SelectItem>
                      <SelectItem value="excluded">Excluded</SelectItem>
                      <SelectItem value="supplied_by_others">Supplied by others</SelectItem>
                      <SelectItem value="price_separately">Price separately</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">WANZ Bars / Support</Label>
                  <Select value={subconScopeFields.wanzBars} onValueChange={(v) => setSubconScopeFields(p => ({ ...p, wanzBars: v as any }))}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-wanz"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="included">Included</SelectItem>
                      <SelectItem value="excluded">Excluded</SelectItem>
                      <SelectItem value="price_separately">Price separately</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Site Clean-up</Label>
                  <Select value={subconScopeFields.siteCleanup} onValueChange={(v) => setSubconScopeFields(p => ({ ...p, siteCleanup: v as any }))}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-cleanup"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="included">Included</SelectItem>
                      <SelectItem value="excluded">Excluded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Repairs to Finishes</Label>
                  <Select value={subconScopeFields.makingGood} onValueChange={(v) => setSubconScopeFields(p => ({ ...p, makingGood: v as any }))}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-making-good"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="by_others">By others</SelectItem>
                      <SelectItem value="included">Included</SelectItem>
                      <SelectItem value="excluded">Excluded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Access Condition</Label>
                  <Select value={subconScopeFields.accessCondition} onValueChange={(v) => setSubconScopeFields(p => ({ ...p, accessCondition: v as any }))}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-access"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="restricted">Restricted</SelectItem>
                      <SelectItem value="upper_level">Upper level / height</SelectItem>
                      <SelectItem value="scaffold_required">Scaffold likely / required</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            )}

            <div className="space-y-3">
              <Label className="text-sm font-semibold">Include in PDF</Label>
              <div className="flex items-center gap-2">
                <Checkbox id="subcon-drawings" checked={subconIncludeDrawings} onCheckedChange={(v) => setSubconIncludeDrawings(!!v)} data-testid="checkbox-include-drawings" />
                <Label htmlFor="subcon-drawings" className="cursor-pointer text-sm">Detailed item drawings</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="subcon-photos" checked={subconIncludeSitePhotos} onCheckedChange={(v) => setSubconIncludeSitePhotos(!!v)} data-testid="checkbox-include-photos" />
                <Label htmlFor="subcon-photos" className="cursor-pointer text-sm">Item photos (where available)</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="subcon-pricing" checked={subconIncludePricingReturn} onCheckedChange={(v) => setSubconIncludePricingReturn(!!v)} data-testid="checkbox-include-pricing" />
                <Label htmlFor="subcon-pricing" className="cursor-pointer text-sm">Pricing return section</Label>
              </div>
              {subconDocPurpose === "install_scope" && <div className="flex items-center gap-2">
                <Checkbox id="subcon-variations" checked={subconScopeFields.includeVariationChecklist} onCheckedChange={(v) => setSubconScopeFields(p => ({ ...p, includeVariationChecklist: !!v }))} data-testid="checkbox-include-variations" />
                <Label htmlFor="subcon-variations" className="cursor-pointer text-sm">Variation checklist</Label>
              </div>}
            </div>
          </div>
          <div className={`rounded-md border p-3 text-xs space-y-1 ${subconDocPurpose === "supply_rfq" ? "bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-800" : "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"}`} data-testid="subcon-purpose-summary">
            <p className={`font-semibold text-sm ${subconDocPurpose === "supply_rfq" ? "text-violet-700 dark:text-violet-400" : "text-blue-700 dark:text-blue-400"}`}>
              {subconDocPurpose === "supply_rfq" ? "Supply / Fabrication RFQ" : "Subcontractor Install Scope"}
            </p>
            <p className="text-muted-foreground">
              {subconDocPurpose === "supply_rfq"
                ? "This document requests pricing from a supplier or fabricator. It does NOT include installation scope, removal, or site work details."
                : `Installation scope document (${subconScopeMode === "renovation" ? "Renovation" : "New Build"}) — ${subconWorkPackage === "removal_disposal_install" ? "removal + disposal + install" : "install only"}. No commercial pricing is disclosed.`}
            </p>
            <p className="text-muted-foreground">
              Items: {subconItemFilter === "outsourced_only" ? "Outsourced only" : subconItemFilter === "in_house_only" ? "In-house only" : "All items"}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSubconDialogOpen(false)} data-testid="button-subcon-cancel">Cancel</Button>
            <Button size="sm" onClick={handleSubcontractorPdf} disabled={subconGenerating} data-testid="button-subcon-generate" className={subconDocPurpose === "supply_rfq" ? "bg-violet-600 hover:bg-violet-700" : ""}>
              <Download className="w-4 h-4 mr-1.5" />
              {subconGenerating ? (subconProgress || "Generating...") : subconDocPurpose === "supply_rfq" ? "Generate Supply RFQ" : "Generate Install Scope PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {totals.gosItemCount > 0 && (
        <div className="order-1 rounded-md border border-green-200 dark:border-green-800 bg-green-50/60 dark:bg-green-950/20 px-4 py-2.5 flex items-center gap-2" data-testid="banner-gos-job">
          <span className="text-sm font-semibold text-green-700 dark:text-green-400">[GOS]</span>
          <span className="text-sm text-green-700 dark:text-green-400">
            This job requires Glaze On Site for {totals.gosItemCount} item{totals.gosItemCount !== 1 ? "s" : ""} — additional revenue ${fmt(totals.gosRevenueTotal)}
          </span>
        </div>
      )}

      <div className="order-1 flex items-center justify-end gap-2 print:hidden" data-testid="section-collapse-controls">
        <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={allCollapsed ? expandAll : collapseAll} data-testid="button-toggle-all-sections">
          {allCollapsed ? "Expand All" : "Collapse All"}
        </Button>
      </div>

      <div className="order-1 md:order-2 rounded-lg border bg-card p-4 space-y-4" data-testid="financial-summary">
        <button
          className="w-full flex items-center justify-between print:hidden"
          onClick={() => toggleSection("financial")}
          data-testid="toggle-financial"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Financial Summary</h2>
          <div className="flex items-center gap-3">
            {sectionCollapsed.financial && (
              <span className="text-sm font-medium text-foreground" data-testid="summary-financial-collapsed">
                Sell: ${fmt(totals.totalSaleExGst)} excl. GST
              </span>
            )}
            {sectionCollapsed.financial ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>
        <h2 className="hidden print:block text-sm font-semibold uppercase tracking-wider text-muted-foreground">Financial Summary</h2>

        {!sectionCollapsed.financial && <div className="space-y-4">
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
              <TableRow className={totals.outsourcedCount > 0 ? "" : "border-b-2"} data-testid="row-manuf-total">
                <TableCell className="text-right text-sm font-semibold">Total</TableCell>
                <TableCell className="text-right text-base font-bold" data-testid="text-total-manuf-cost">${fmt(totals.totalManufCost)}</TableCell>
                <TableCell className="text-right text-base font-bold" data-testid="text-item-sale-total">${fmt(totals.itemSaleTotal)}</TableCell>
              </TableRow>
              {totals.outsourcedCount > 0 && (
                <TableRow className="border-b-2 bg-amber-50/50 dark:bg-amber-950/10" data-testid="row-outsourced-summary">
                  <TableCell className="text-sm font-medium text-amber-700 dark:text-amber-400" colSpan={2}>
                    <div className="flex items-center gap-1"><Package className="h-3.5 w-3.5" />Outsourced ({totals.outsourcedCount} item{totals.outsourcedCount !== 1 ? "s" : ""} incl. above)</div>
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium text-amber-700 dark:text-amber-400" data-testid="text-outsourced-cost">${fmt(totals.outsourcedCostTotal)}</TableCell>
                  <TableCell className="text-right text-sm font-medium text-amber-700 dark:text-amber-400" data-testid="text-outsourced-sell">${fmt(totals.outsourcedSellTotal)}</TableCell>
                </TableRow>
              )}
              {totals.gosItemCount > 0 && (
                <TableRow className="bg-green-50/50 dark:bg-green-950/10" data-testid="row-gos-revenue-total">
                  <TableCell className="text-sm font-medium text-green-700 dark:text-green-400" colSpan={3}>
                    <div className="flex items-center gap-1">[GOS] Glaze On Site — {totals.gosItemCount} item{totals.gosItemCount !== 1 ? "s" : ""} (revenue incl. in Sale Total above)</div>
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium text-green-700 dark:text-green-400" data-testid="text-gos-revenue-total">${fmt(totals.gosRevenueTotal)}</TableCell>
                </TableRow>
              )}
              <TableRow data-testid="row-installation">
                <TableCell className="text-sm font-medium">Installation</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">{installEnabled ? (installationTotals.isOverride ? "Override" : "Per-unit") : "Disabled"}</TableCell>
                <TableCell className="text-right text-sm" data-testid="text-total-install-cost">{installEnabled ? `$${fmt(totals.installCost)}` : "—"}</TableCell>
                <TableCell className="text-right text-sm" data-testid="text-total-install-sell">{installEnabled ? `$${fmt(totals.installSell)}` : "—"}</TableCell>
              </TableRow>
              <TableRow data-testid="row-delivery">
                <TableCell className="text-sm font-medium">Delivery</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">{deliveryEnabled ? (deliveryTotals.isCustom ? "Custom" : deliveryMethodId ? "Standard" : "No method") : "Supply Only"}</TableCell>
                <TableCell className="text-right text-sm" data-testid="text-total-delivery-cost">{deliveryEnabled && totals.delivCost > 0 ? `$${fmt(totals.delivCost)}` : "—"}</TableCell>
                <TableCell className="text-right text-sm" data-testid="text-total-delivery-sell">{deliveryEnabled && totals.delivSell > 0 ? `$${fmt(totals.delivSell)}` : "—"}</TableCell>
              </TableRow>
              <TableRow data-testid="row-removal">
                <TableCell className="text-sm font-medium">Old Item Removal</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">{removalEnabled ? (removalTotals.isOverride ? "Override" : "Per-unit") : "Disabled"}</TableCell>
                <TableCell className="text-right text-sm" data-testid="text-total-removal-cost">{removalEnabled ? `$${fmt(totals.removalCost)}` : "—"}</TableCell>
                <TableCell className="text-right text-sm" data-testid="text-total-removal-sell">{removalEnabled ? `$${fmt(totals.removalSell)}` : "—"}</TableCell>
              </TableRow>
              <TableRow className="border-b-2" data-testid="row-rubbish">
                <TableCell className="text-sm font-medium">Rubbish Removal</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">{rubbishEnabled ? `${rubbishTonnage || "0"}t` : "Disabled"}</TableCell>
                <TableCell className="text-right text-sm" data-testid="text-total-rubbish-cost">{rubbishEnabled && totals.rubbishCost > 0 ? `$${fmt(totals.rubbishCost)}` : "—"}</TableCell>
                <TableCell className="text-right text-sm" data-testid="text-total-rubbish-sell">{rubbishEnabled && totals.rubbishSell > 0 ? `$${fmt(totals.rubbishSell)}` : "—"}</TableCell>
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

          {totals.outsourcedCount > 0 && (
            <div className="rounded-md border border-amber-200 dark:border-amber-800 p-3 bg-amber-50/50 dark:bg-amber-950/10">
              <div className="flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-400 mb-1">
                <Package className="h-3.5 w-3.5" />Outsourced ({totals.outsourcedCount} item{totals.outsourcedCount !== 1 ? "s" : ""} incl. above)
              </div>
              <div className="grid grid-cols-2 gap-1 text-sm">
                <span className="text-muted-foreground">Cost</span>
                <span className="text-right text-amber-700 dark:text-amber-400">${fmt(totals.outsourcedCostTotal)}</span>
                <span className="text-muted-foreground">Sell</span>
                <span className="text-right text-amber-700 dark:text-amber-400">${fmt(totals.outsourcedSellTotal)}</span>
              </div>
            </div>
          )}

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

          <div className="rounded-md border p-3">
            <div className="grid grid-cols-2 gap-1 text-sm">
              <span className="font-medium">Old Item Removal</span>
              <span className="text-right text-muted-foreground">{removalEnabled ? (removalTotals.isOverride ? "Override" : "Per-unit") : "Disabled"}</span>
              <span className="text-muted-foreground">Cost</span>
              <span className="text-right">{removalEnabled ? `$${fmt(totals.removalCost)}` : "—"}</span>
              <span className="text-muted-foreground">Sell</span>
              <span className="text-right">{removalEnabled ? `$${fmt(totals.removalSell)}` : "—"}</span>
            </div>
          </div>

          <div className="rounded-md border p-3">
            <div className="grid grid-cols-2 gap-1 text-sm">
              <span className="font-medium">Rubbish Removal</span>
              <span className="text-right text-muted-foreground">{rubbishEnabled ? `${rubbishTonnage || "0"}t` : "Disabled"}</span>
              <span className="text-muted-foreground">Cost</span>
              <span className="text-right">{rubbishEnabled && totals.rubbishCost > 0 ? `$${fmt(totals.rubbishCost)}` : "—"}</span>
              <span className="text-muted-foreground">Sell</span>
              <span className="text-right">{rubbishEnabled && totals.rubbishSell > 0 ? `$${fmt(totals.rubbishSell)}` : "—"}</span>
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

        {totals.outsourcedIncompleteCount > 0 && (
          <div className="rounded-md border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20 p-3 flex items-start gap-2" data-testid="banner-outsourced-incomplete">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-red-700 dark:text-red-400">Commercially Incomplete</p>
              <p className="text-red-600 dark:text-red-400 text-xs mt-0.5">{totals.outsourcedIncompleteCount} outsourced item{totals.outsourcedIncompleteCount !== 1 ? "s" : ""} missing cost or sell values. Totals, profit, and margin below do not include these items and may be misleading.</p>
            </div>
          </div>
        )}

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
        </div>}
      </div>

      <div className="order-3 rounded-lg border bg-card p-4 space-y-3 print:break-before-page" data-testid="installation-section">
        <div className="flex items-center justify-between">
          <button className="flex items-center gap-2 print:hidden" onClick={() => toggleSection("installation")} data-testid="toggle-installation">
            {sectionCollapsed.installation ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Installation Labour</h2>
            {sectionCollapsed.installation && installEnabled && <span className="text-sm font-medium text-foreground ml-2">${fmt(installationTotals.sell)}</span>}
            {sectionCollapsed.installation && !installEnabled && <span className="text-xs text-muted-foreground ml-2">Disabled</span>}
          </button>
          <h2 className="hidden print:block text-sm font-semibold uppercase tracking-wider text-muted-foreground">Installation Labour</h2>
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
        {!sectionCollapsed.installation && installEnabled && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8 print:hidden"></TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Basis</TableHead>
                  <TableHead className="text-right">Cost/Unit</TableHead>
                  <TableHead className="text-right">Cost Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {installationItems.map((ii, idx) => {
                  const isOff = disabledInstallLines.has(idx);
                  return (
                  <TableRow key={idx} data-testid={`row-install-${idx}`} className={isOff ? "opacity-40" : ""}>
                    <TableCell className="print:hidden">
                      <Checkbox
                        checked={!isOff}
                        onCheckedChange={() => {
                          setDisabledInstallLines(prev => {
                            const next = new Set(prev);
                            next.has(idx) ? next.delete(idx) : next.add(idx);
                            return next;
                          });
                        }}
                        data-testid={`checkbox-install-${idx}`}
                      />
                    </TableCell>
                    <TableCell className="text-sm">{ii.name}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{CATEGORY_LABELS[ii.category] || ii.category}</Badge></TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{ii.tierName}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{ii.basisQtyLabel} × ${fmt(ii.costPerUnit)}</TableCell>
                    <TableCell className="text-right">${fmt(ii.costPerUnit)}</TableCell>
                    <TableCell className="text-right font-medium">{isOff ? "—" : `$${fmt(ii.costTotal)}`}</TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Separator />
            <div className="flex items-center justify-end flex-wrap gap-2">
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
            <div className="flex items-center justify-end gap-4 font-bold text-sm" data-testid="text-installation-total">
              <span>Cost: ${fmt(installationTotals.cost)}</span>
              <span>Sell: ${fmt(installationTotals.sell)}</span>
              {installationTotals.isOverride && <Badge variant="outline">Override</Badge>}
              {!installationTotals.isOverride && <span className="text-xs font-normal text-muted-foreground">(Cost + {installMarkup || "15"}%)</span>}
            </div>
          </>
        )}
        {!sectionCollapsed.installation && !installEnabled && (
          <p className="text-sm text-muted-foreground py-2">Installation pricing is disabled. Toggle to enable per-unit installation costs.</p>
        )}
      </div>

      <div className="order-4 rounded-lg border bg-card p-4 space-y-3" data-testid="delivery-section">
        <div className="flex items-center justify-between">
          <button className="flex items-center gap-2 print:hidden" onClick={() => toggleSection("delivery")} data-testid="toggle-delivery">
            {sectionCollapsed.delivery ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Delivery</h2>
            {sectionCollapsed.delivery && deliveryEnabled && <span className="text-sm font-medium text-foreground ml-2">${fmt(deliveryTotals.sell)}</span>}
            {sectionCollapsed.delivery && !deliveryEnabled && <span className="text-xs text-muted-foreground ml-2">Supply Only</span>}
          </button>
          <h2 className="hidden print:block text-sm font-semibold uppercase tracking-wider text-muted-foreground">Delivery</h2>
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
        {!sectionCollapsed.delivery && deliveryEnabled && (
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
        {!sectionCollapsed.delivery && !deliveryEnabled && (
          <p className="text-sm text-muted-foreground py-2" data-testid="text-delivery-supply-only">Supply Only — Customer to Collect</p>
        )}
      </div>

      <div className="order-4 rounded-lg border bg-card p-4 space-y-3" data-testid="removal-section">
        <div className="flex items-center justify-between">
          <button className="flex items-center gap-2 print:hidden" onClick={() => toggleSection("removal")} data-testid="toggle-removal">
            {sectionCollapsed.removal ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Old Window / Door Removal</h2>
            {sectionCollapsed.removal && removalEnabled && <span className="text-sm font-medium text-foreground ml-2">${fmt(removalTotals.sell)}</span>}
            {sectionCollapsed.removal && !removalEnabled && <span className="text-xs text-muted-foreground ml-2">Not included</span>}
          </button>
          <h2 className="hidden print:block text-sm font-semibold uppercase tracking-wider text-muted-foreground">Old Window / Door Removal</h2>
          <div className="flex items-center gap-2 print:hidden">
            <Label htmlFor="removal-toggle" className="text-sm">Enable</Label>
            <Switch
              id="removal-toggle"
              checked={removalEnabled}
              onCheckedChange={(v) => {
                setRemovalEnabled(v);
                persistJobField("removalEnabled", v);
              }}
              data-testid="switch-removal"
            />
          </div>
        </div>
        {!sectionCollapsed.removal && removalEnabled && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8 print:hidden"></TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Basis</TableHead>
                  <TableHead className="text-right">Cost/Unit</TableHead>
                  <TableHead className="text-right">Cost Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {removalItems.map((ri, idx) => {
                  const isOff = disabledRemovalLines.has(idx);
                  return (
                  <TableRow key={idx} data-testid={`row-removal-${idx}`} className={isOff ? "opacity-40" : ""}>
                    <TableCell className="print:hidden">
                      <Checkbox
                        checked={!isOff}
                        onCheckedChange={() => {
                          setDisabledRemovalLines(prev => {
                            const next = new Set(prev);
                            next.has(idx) ? next.delete(idx) : next.add(idx);
                            return next;
                          });
                        }}
                        data-testid={`checkbox-removal-${idx}`}
                      />
                    </TableCell>
                    <TableCell className="text-sm font-medium">{ri.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground capitalize">{ri.category}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{ri.tierName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{ri.basisQtyLabel} × ${fmt(ri.costPerUnit)}</TableCell>
                    <TableCell className="text-right text-sm">${fmt(ri.costPerUnit)}</TableCell>
                    <TableCell className="text-right text-sm">{isOff ? "—" : `$${fmt(ri.costTotal)}`}</TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4 print:hidden">
              <div className="flex-1">
                <Label className="text-sm">Override Cost ($)</Label>
                <Input
                  type="number"
                  placeholder="Leave blank for rate-based"
                  value={removalOverride}
                  onChange={(e) => {
                    setRemovalOverride(e.target.value);
                    const val = parseFloat(e.target.value);
                    persistJobField("removalOverride", val > 0 ? val : null);
                  }}
                  data-testid="input-removal-override"
                />
              </div>
              <div className="w-24">
                <Label className="text-sm">Markup (%)</Label>
                <Input
                  type="number"
                  value={removalMarkup}
                  onChange={(e) => {
                    setRemovalMarkup(e.target.value);
                    const val = parseFloat(e.target.value);
                    persistJobField("removalMarkup", val >= 0 ? val : null);
                  }}
                  data-testid="input-removal-markup"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-4 font-bold text-sm" data-testid="text-removal-total">
              <span>Cost: ${fmt(removalTotals.cost)}</span>
              <span>Sell: ${fmt(removalTotals.sell)}</span>
              {removalTotals.isOverride && <Badge variant="outline">Override</Badge>}
              {!removalTotals.isOverride && <span className="text-xs font-normal text-muted-foreground">(Cost + {removalMarkup || "15"}%)</span>}
            </div>
          </>
        )}
        {!sectionCollapsed.removal && !removalEnabled && (
          <p className="text-sm text-muted-foreground py-2" data-testid="text-removal-disabled">Not included — existing windows remain in place</p>
        )}
      </div>

      <div className="order-4 rounded-lg border bg-card p-4 space-y-3" data-testid="rubbish-section">
        <div className="flex items-center justify-between">
          <button className="flex items-center gap-2 print:hidden" onClick={() => toggleSection("rubbish")} data-testid="toggle-rubbish">
            {sectionCollapsed.rubbish ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Rubbish / General Waste Removal</h2>
            {sectionCollapsed.rubbish && rubbishEnabled && <span className="text-sm font-medium text-foreground ml-2">{rubbishTonnage || "1"}t · ${fmt(rubbishTotals.sell)}</span>}
            {sectionCollapsed.rubbish && !rubbishEnabled && <span className="text-xs text-muted-foreground ml-2">Not included</span>}
          </button>
          <h2 className="hidden print:block text-sm font-semibold uppercase tracking-wider text-muted-foreground">Rubbish / General Waste Removal</h2>
          <div className="flex items-center gap-2 print:hidden">
            <Label htmlFor="rubbish-toggle" className="text-sm">Enable</Label>
            <Switch
              id="rubbish-toggle"
              checked={rubbishEnabled}
              onCheckedChange={(v) => {
                setRubbishEnabled(v);
                persistJobField("rubbishEnabled", v);
                if (v && (!rubbishTonnage || parseFloat(rubbishTonnage) <= 0)) {
                  setRubbishTonnage("1");
                  persistJobField("rubbishTonnage", 1);
                }
              }}
              data-testid="switch-rubbish"
            />
          </div>
        </div>
        {!sectionCollapsed.rubbish && rubbishEnabled && (
          <>
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:gap-4 print:hidden">
              <div className="flex-1">
                <Label className="text-sm">Estimated Tonnage</Label>
                <Input
                  type="number"
                  placeholder="e.g. 0.5"
                  value={rubbishTonnage}
                  onChange={(e) => {
                    setRubbishTonnage(e.target.value);
                    const val = parseFloat(e.target.value);
                    persistJobField("rubbishTonnage", val > 0 ? val : null);
                  }}
                  data-testid="input-rubbish-tonnage"
                />
              </div>
              {rubbishTotals.rateEntry && (
                <div className="text-sm text-muted-foreground md:pb-2">
                  Rate: Cost ${rubbishTotals.rateEntry.costPerTonne}/t · Sell ${rubbishTotals.rateEntry.sellPerTonne}/t
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-4 font-bold text-sm" data-testid="text-rubbish-total">
              <span>Cost: ${fmt(rubbishTotals.cost)}</span>
              <span>Sell: ${fmt(rubbishTotals.sell)}</span>
            </div>
          </>
        )}
        {!sectionCollapsed.rubbish && !rubbishEnabled && (
          <p className="text-sm text-muted-foreground py-2" data-testid="text-rubbish-disabled">Not included</p>
        )}
      </div>

      {existingQuotes.length > 0 && (
        <div className="order-4 md:order-4 rounded-lg border bg-card p-4 space-y-3 print:hidden" data-testid="quote-history-section">
          <button className="flex items-center gap-2 w-full text-left" onClick={() => toggleSection("history")} data-testid="toggle-quote-history">
            {sectionCollapsed.history ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Quote History</h2>
            {sectionCollapsed.history && <span className="text-xs text-muted-foreground ml-2">{existingQuotes.length} quote{existingQuotes.length !== 1 ? "s" : ""}</span>}
          </button>
          {!sectionCollapsed.history && <Table>
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
          </Table>}
        </div>
      )}

      <div className="order-5 rounded-lg border bg-card p-4 print:hidden" data-testid="section-lifecycle-estimate">
        <div className="flex items-center justify-between w-full cursor-pointer select-none" onClick={() => toggleSection("lifecycle")} role="button" tabIndex={0} data-testid="toggle-lifecycle">
          <div className="flex items-center gap-2">
            {sectionCollapsed.lifecycle ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Workflow & Lifecycle</span>
          </div>
          {existingQuotes.length > 0 && (() => {
            const aq = existingQuotes.find((q: any) => q.status === "accepted")
              || existingQuotes.find((q: any) => q.status === "sent")
              || existingQuotes.find((q: any) => q.status === "review")
              || existingQuotes.find((q: any) => q.status === "draft")
              || existingQuotes[0];
            return (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs" data-testid="badge-lifecycle-quote-ref">
                  {aq.number || aq.id?.slice(0, 8)} · {aq.status ? aq.status.charAt(0).toUpperCase() + aq.status.slice(1) : ""}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={(e) => { e.stopPropagation(); navigate(routes.quoteDetail(aq.id)); }}
                  data-testid="button-open-quote"
                >
                  <ExternalLink className="h-3 w-3" /> Open Quote
                </Button>
              </div>
            );
          })()}
          {existingQuotes.length === 0 && (
            <Badge variant="outline" className="shrink-0 text-xs border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400">
              Planning
            </Badge>
          )}
        </div>
        {!sectionCollapsed.lifecycle && (
          <div className="mt-3 space-y-3">
            {existingQuotes.length > 0 ? (() => {
              const activeQuote = existingQuotes.find((q: any) => q.status === "accepted")
                || existingQuotes.find((q: any) => q.status === "sent")
                || existingQuotes.find((q: any) => q.status === "review")
                || existingQuotes.find((q: any) => q.status === "draft")
                || existingQuotes[0];
              return (
                <>
                  <div className="flex items-start gap-2 rounded-md bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 px-3 py-2" data-testid="banner-estimate-lifecycle-context">
                    <ClipboardList className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      This estimate has {existingQuotes.length === 1 ? "a linked quote" : `${existingQuotes.length} linked quotes`}. The lifecycle below tracks the most relevant quote's workflow progression.
                    </p>
                  </div>
                  <LifecyclePanel quoteId={activeQuote.id} previewOnly />
                </>
              );
            })() : (
              <>
                <div className="flex items-center gap-3 rounded-md bg-muted/50 px-3 py-3" data-testid="banner-estimate-pre-quote">
                  <p className="text-sm text-muted-foreground">
                    This estimate is in the planning and costing stage. No quote has been generated yet.
                  </p>
                </div>
                <div className="flex items-start gap-2 rounded-md bg-muted/30 px-3 py-2" data-testid="banner-estimate-next-step">
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Next step:</span> Review the financial summary and item breakdown, then use <span className="font-medium">Generate Quote</span> above to create the first quote.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="order-6 rounded-lg border bg-card" data-testid="items-breakdown">
        <div className="p-4 border-b flex items-center justify-between">
          <button className="flex items-center gap-2" onClick={() => toggleSection("items")} data-testid="toggle-per-item">
            {sectionCollapsed.items ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Per-Item Breakdown</h2>
            {sectionCollapsed.items && <span className="text-xs text-muted-foreground ml-2">{itemPricings.length} item{itemPricings.length !== 1 ? "s" : ""}</span>}
          </button>
          <h2 className="hidden print:block text-sm font-semibold uppercase tracking-wider text-muted-foreground">Per-Item Breakdown</h2>
        </div>
        {!sectionCollapsed.items && <Table>
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
              const isOutsourced = (ip.item.fulfilmentSource || "in-house") === "outsourced";
              const outsourcedIncomplete = isOutsourced && (ip.item.outsourcedCostNzd == null || ip.item.outsourcedSellNzd == null);
              const hasPricing = (isOutsourced && !outsourcedIncomplete) || !!ip.pricing;
              const netCost = isOutsourced ? (outsourcedIncomplete ? 0 : ip.item.outsourcedCostNzd!) : (ip.pricing?.netCostNzd ?? 0);
              const salePrice = isOutsourced ? (outsourcedIncomplete ? 0 : ip.item.outsourcedSellNzd!) : (ip.pricing?.salePriceNzd ?? ip.salePrice);
              const margin = hasPricing ? salePrice - netCost : 0;
              const marginPct = hasPricing && salePrice > 0 ? (margin / salePrice) * 100 : (isOutsourced ? 0 : (ip.pricing?.marginPercent ?? 0));
              const marginColor = outsourcedIncomplete ? "text-red-600" : (!hasPricing ? "text-muted-foreground" : margin >= 0 ? "text-green-600" : "text-red-600");

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
                          {isOutsourced && <Badge variant="secondary" className="text-[10px] ml-1 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" data-testid={`badge-outsourced-${idx}`}><Package className="h-2.5 w-2.5 mr-0.5" />Outsourced</Badge>}
                          {outsourcedIncomplete && <Badge variant="destructive" className="text-[10px] ml-1" data-testid={`badge-outsourced-incomplete-${idx}`}>Incomplete</Badge>}
                          {ip.item.gosRequired && <Badge variant="secondary" className="text-[10px] ml-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" data-testid={`badge-gos-${idx}`}>GOS</Badge>}
                          {ip.configName && <span className="text-xs text-muted-foreground ml-1.5" data-testid={`text-config-name-${idx}`}>{ip.configName}</span>}
                        </TableCell>
                        <TableCell className="text-right text-xs">{ip.item.width}×{ip.item.height}</TableCell>
                        <TableCell className="text-right">{ip.sqm.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium">{outsourcedIncomplete ? <span className="text-red-500">—</span> : `$${fmt(netCost)}`}</TableCell>
                        <TableCell className="text-right font-medium text-primary">
                          {outsourcedIncomplete ? <span className="text-red-500">—</span> : `$${fmt(salePrice)}`}
                          {!isOutsourced && ip.pricing && ip.pricing.gosSellNzd > 0 && (
                            <span className="block text-[10px] text-green-600 dark:text-green-400 font-normal" data-testid={`text-gos-revenue-${idx}`}>incl. GOS ${fmt(ip.pricing.gosSellNzd)}</span>
                          )}
                        </TableCell>
                        <TableCell className={`text-right font-bold ${marginColor}`}>
                          {outsourcedIncomplete ? "Incomplete" : hasPricing ? `$${fmt(margin)} (${marginPct.toFixed(1)}%)` : "N/A"}
                        </TableCell>
                      </TableRow>
                    </CollapsibleTrigger>
                    <CollapsibleContent asChild>
                      <TableRow className="bg-muted/20" data-testid={`row-item-detail-${idx}`}>
                        <TableCell colSpan={8}>
                          {isOutsourced ? (
                            <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              <div>
                                <span className="text-muted-foreground block">Fulfilment</span>
                                <span className="font-medium text-amber-700 dark:text-amber-400">Outsourced</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block">Cost (NZD)</span>
                                <span className="font-medium">{ip.item.outsourcedCostNzd != null ? `$${fmt(ip.item.outsourcedCostNzd)}` : <span className="text-destructive">Not set</span>}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block">Sell (NZD)</span>
                                <span className="font-medium">{ip.item.outsourcedSellNzd != null ? `$${fmt(ip.item.outsourcedSellNzd)}` : <span className="text-destructive">Not set</span>}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block">Margin</span>
                                {outsourcedIncomplete
                                  ? <span className="font-medium text-destructive">Incomplete — excluded from totals</span>
                                  : <span className={`font-medium ${margin >= 0 ? "text-green-600" : "text-red-600"}`}>${fmt(margin)} ({marginPct.toFixed(1)}%)</span>
                                }
                              </div>
                            </div>
                          ) : ip.pricing ? (
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
                              {ip.pricing.gosSellNzd > 0 && (
                                <div data-testid={`detail-gos-sell-${idx}`}>
                                  <span className="text-muted-foreground block">GOS Revenue (NZD)</span>
                                  <span className="font-medium text-green-600 dark:text-green-400">${fmt(ip.pricing.gosSellNzd)}</span>
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
        </Table>}
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
