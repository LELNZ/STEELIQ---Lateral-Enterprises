import { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertQuoteItemSchema, type InsertQuoteItem, type QuoteItem, type CustomColumn, type EntranceDoorRow, type JobItem, type FrameConfiguration, type ConfigurationProfile, type ConfigurationAccessory, type ConfigurationLabor } from "@shared/schema";
import { getGlassCombos, getAvailableThicknesses, getGlassPrice, getGlassRValue } from "@shared/glass-library";
import { FRAME_COLORS, FLASHING_SIZES, WIND_ZONES, LINER_TYPES, DOOR_CATEGORIES, WINDOW_CATEGORIES, WANZ_BAR_DEFAULTS, getFrameTypesForCategory, getHandlesForCategory, getHandleTypeForCategory } from "@shared/item-options";
import type { LibraryEntry } from "@shared/schema";
import { calculatePricing, type PricingBreakdown } from "@/lib/pricing";
import { deriveConfigSignature, findMatchingConfiguration, type ConfigSignature } from "@/lib/config-signature";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import DrawingCanvas, { getFrameSize } from "@/components/drawing-canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Plus, Trash2, Pencil, Copy, Ruler, LayoutGrid, ChevronDown, ChevronRight, ChevronUp, ArrowLeft, ArrowRight, Save, Download, Camera, X, ArrowLeftCircle, AlertTriangle, FileText } from "lucide-react";
import { useSettings } from "@/lib/settings-context";
import { useToast } from "@/hooks/use-toast";
import { useRoute, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { downloadPng, compressImage, svgToPngBlob, downloadBlob, sanitizeFilename } from "@/lib/export-png";
import { jsPDF } from "jspdf";

const CATEGORY_OPTIONS = [
  { value: "windows-standard", label: "Windows Standard" },
  { value: "sliding-window", label: "Sliding Window" },
  { value: "sliding-door", label: "Sliding Door" },
  { value: "entrance-door", label: "Entrance Door" },
  { value: "hinge-door", label: "Hinge Door" },
  { value: "french-door", label: "French Door" },
  { value: "bifold-door", label: "Bi-folding Door" },
  { value: "stacker-door", label: "Stacker Door" },
  { value: "bay-window", label: "Bay Window" },
];

function getCategoryLabel(cat: string) {
  return CATEGORY_OPTIONS.find((c) => c.value === cat)?.label || cat;
}

function getLayoutSummary(config: QuoteItem) {
  if (config.layout === "custom") {
    const cols = config.customColumns || [];
    const colCount = cols.length;
    const rowCounts = cols.map(c => (c.rows || []).length);
    const allSame = rowCounts.every(r => r === rowCounts[0]);
    if (allSame && rowCounts.length > 0) {
      return `Custom ${rowCounts[0]}×${colCount}`;
    }
    return `Custom ${colCount}-col (${rowCounts.join("/")})`;
  }
  const cat = config.category;
  if (cat === "windows-standard") return config.windowType === "awning" ? "Awning" : "Fixed";
  if (cat === "sliding-window" || cat === "sliding-door") return "Fixed + Sliding";
  if (cat === "entrance-door") {
    if (!config.sidelightEnabled) return "Door (No Sidelight)";
    const side = config.sidelightSide === "both" ? "Both Sidelights" : config.sidelightSide === "left" ? "Left Sidelight" : "Right Sidelight";
    return `Door + ${side}`;
  }
  if (cat === "hinge-door") return `${config.hingeSide === "left" ? "Left" : "Right"} Hinge`;
  if (cat === "french-door") return "Double Door";
  if (cat === "bifold-door") return `${config.panels} Leaves`;
  if (cat === "stacker-door") return `${config.panels} Panels`;
  if (cat === "bay-window") return "Bay (3 Panel)";
  return "Standard";
}

function makeDefaultColumns(count: number): CustomColumn[] {
  return Array.from({ length: count }, () => ({
    width: 0,
    rows: [{ height: 0, type: "fixed" as const, slideDirection: "right" as const, hingeSide: "left" as const, openDirection: "out" as const }],
  }));
}

const defaultEntranceDoorRows: EntranceDoorRow[] = [{ height: 0, type: "fixed" }];

const ROOM_OPTIONS = [
  { label: "Kitchen", code: "KIT" },
  { label: "Lounge", code: "LNG" },
  { label: "Dining", code: "DIN" },
  { label: "Bedroom", code: "BED" },
  { label: "Master Bedroom", code: "MBR" },
  { label: "Ensuite", code: "ENS" },
  { label: "Bathroom", code: "BTH" },
  { label: "WC / Toilet", code: "WC" },
  { label: "Laundry", code: "LDY" },
  { label: "Garage", code: "GAR" },
  { label: "Hallway", code: "HWY" },
  { label: "Study", code: "STD" },
  { label: "Rumpus", code: "RMP" },
  { label: "Entrance", code: "ENT" },
];

const FLOOR_OPTIONS = [
  { label: "Ground", code: "G" },
  { label: "1st Floor", code: "1" },
  { label: "2nd Floor", code: "2" },
  { label: "3rd Floor", code: "3" },
  { label: "Basement", code: "B" },
];

const defaultValues: InsertQuoteItem = {
  name: "W-01",
  quantity: 1,
  category: "windows-standard",
  width: 1200,
  height: 1500,
  layout: "standard",
  windowType: "fixed",
  hingeSide: "left",
  openDirection: "out",
  halfSolid: false,
  panels: 3,
  sidelightWidth: 400,
  sidelightEnabled: true,
  sidelightSide: "right",
  doorSplit: false,
  doorSplitHeight: 0,
  bifoldLeftCount: 0,
  centerWidth: 0,
  entranceDoorRows: [...defaultEntranceDoorRows],
  entranceSidelightRows: [...defaultEntranceDoorRows],
  entranceSidelightLeftRows: [...defaultEntranceDoorRows],
  hingeDoorRows: [...defaultEntranceDoorRows],
  frenchDoorLeftRows: [...defaultEntranceDoorRows],
  frenchDoorRightRows: [...defaultEntranceDoorRows],
  panelRows: [],
  showLegend: true,
  customColumns: makeDefaultColumns(2),
  pricePerSqm: 500,
  frameType: "",
  frameColor: "",
  flashingSize: 0,
  windZone: "",
  linerType: "",
  glassIguType: "",
  glassType: "",
  glassThickness: "",
  wanzBar: false,
  wanzBarSource: "",
  wanzBarSize: "",
  wallThickness: 0,
  heightFromFloor: 0,
  handleType: "",
  configurationId: "",
  cachedWeightKg: 0,
};

interface ItemWithPhoto {
  item: QuoteItem;
  photo?: string | null;
  dbId?: string;
}

export default function QuoteBuilder() {
  const [, matchResult] = useRoute("/job/:id");
  const rawId = matchResult?.id;
  const jobId = rawId === "new" ? undefined : rawId;
  const isNewJob = !jobId;
  const [, navigate] = useLocation();

  const [items, setItems] = useState<ItemWithPhoto[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedCols, setExpandedCols] = useState<Set<number>>(new Set([0]));
  const [selectedFloor, setSelectedFloor] = useState("G");
  const [roomDropdownOpen, setRoomDropdownOpen] = useState(false);
  const [roomFilter, setRoomFilter] = useState("");
  const [jobName, setJobName] = useState("");
  const [jobAddress, setJobAddress] = useState("");
  const [jobDate, setJobDate] = useState(new Date().toISOString().split("T")[0]);
  const [savedJobId, setSavedJobId] = useState<string | null>(jobId || null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [itemsExpanded, setItemsExpanded] = useState(false);
  const [formTab, setFormTab] = useState<string>("drawing");
  const { quoteListPosition, usdToNzdRate } = useSettings();
  const roomDropdownRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef<SVGSVGElement>(null);
  const offscreenDrawingRef = useRef<SVGSVGElement>(null);
  const [offscreenConfig, setOffscreenConfig] = useState<InsertQuoteItem | null>(null);
  const skipCategoryResetRef = useRef(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoTargetItemId, setPhotoTargetItemId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: existingJob, isLoading: jobLoading } = useQuery<{
    id: string; name: string; address: string | null; date: string | null; items: JobItem[];
  }>({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId,
  });

  const fetchLib = (type: string) => async () => {
    const res = await fetch(`/api/library?type=${type}`);
    if (!res.ok) throw new Error("Failed");
    return res.json() as Promise<LibraryEntry[]>;
  };
  const { data: libFrameTypes = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "frame_type"], queryFn: fetchLib("frame_type") });
  const { data: libFrameColors = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "frame_color"], queryFn: fetchLib("frame_color") });
  const { data: libGlass = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "glass"], queryFn: fetchLib("glass") });
  const { data: libWindowHandles = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "window_handle"], queryFn: fetchLib("window_handle") });
  const { data: libDoorHandles = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "door_handle"], queryFn: fetchLib("door_handle") });
  const { data: libLiners = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "liner_type"], queryFn: fetchLib("liner_type") });
  const { data: libWanzBars = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "wanz_bar"], queryFn: fetchLib("wanz_bar") });
  const { data: masterProfiles = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "direct_profile"], queryFn: fetchLib("direct_profile") });
  const { data: masterAccessories = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "direct_accessory"], queryFn: fetchLib("direct_accessory") });
  const { data: masterLabour = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "labour_operation"], queryFn: fetchLib("labour_operation") });

  const libFrameTypesForCategory = (cat: string) => {
    const fromDb = libFrameTypes.filter((e) => {
      const d = e.data as any;
      return d.categories?.includes(cat);
    }).map((e) => ({ value: (e.data as any).value, label: (e.data as any).label }));
    if (fromDb.length > 0) return fromDb;
    return getFrameTypesForCategory(cat).map((ft) => ({ value: ft.value, label: ft.label }));
  };
  const libFrameColorOptions = libFrameColors.length > 0
    ? libFrameColors.map((e) => ({ value: (e.data as any).value, label: (e.data as any).label }))
    : FRAME_COLORS.map((fc) => ({ value: fc.value, label: fc.label }));
  const libLinerOptions = libLiners.length > 0
    ? libLiners.map((e) => ({ value: (e.data as any).value, label: (e.data as any).label }))
    : LINER_TYPES.map((lt) => ({ value: lt.value, label: lt.label }));
  const libHandlesForCategoryLegacy = (cat: string) => {
    const handles = DOOR_CATEGORIES.includes(cat) ? libDoorHandles : libWindowHandles;
    if (handles.length > 0) return handles.map((e) => ({ value: (e.data as any).value, label: (e.data as any).label }));
    return getHandlesForCategory(cat).map((h) => ({ value: h.value, label: h.label }));
  };
  const libGlassCombos = (iguType: string) => {
    const fromDb = libGlass.filter((e) => (e.data as any).iguType === iguType).map((e) => (e.data as any).combo as string);
    return fromDb.length > 0 ? fromDb : getGlassCombos(iguType);
  };
  const libGlassThicknesses = (iguType: string, combo: string) => {
    const entry = libGlass.find((e) => (e.data as any).iguType === iguType && (e.data as any).combo === combo);
    if (entry) return Object.keys((entry.data as any).prices || {});
    return getAvailableThicknesses(iguType, combo);
  };
  const libGlassPrice = (iguType: string, combo: string, thickness: string) => {
    const entry = libGlass.find((e) => (e.data as any).iguType === iguType && (e.data as any).combo === combo);
    if (entry) return (entry.data as any).prices?.[thickness] ?? null;
    return getGlassPrice(iguType, combo, thickness);
  };

  const findFrameTypeLibId = (frameTypeValue: string) => {
    return libFrameTypes.find((e) => (e.data as any).value === frameTypeValue)?.id || "";
  };

  useEffect(() => {
    if (existingJob) {
      setJobName(existingJob.name);
      setJobAddress(existingJob.address || "");
      setJobDate(existingJob.date || "");
      setSavedJobId(existingJob.id);
      setItems(existingJob.items.map((ji) => ({
        item: ji.config as QuoteItem,
        photo: ji.photo,
        dbId: ji.id,
      })));
    }
  }, [existingJob]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (roomDropdownRef.current && !roomDropdownRef.current.contains(e.target as Node)) {
        setRoomDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const form = useForm<InsertQuoteItem>({
    resolver: zodResolver(insertQuoteItemSchema),
    defaultValues: { ...defaultValues },
  });

  const w = form.watch();
  const category = w.category;
  const layout = w.layout;
  const frameSize = getFrameSize(category);
  const formIsDirty = form.formState.isDirty;
  const currentHandleType = getHandleTypeForCategory(category || "windows-standard");
  const { data: libCategoryHandles = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", currentHandleType], queryFn: fetchLib(currentHandleType) });

  const currentFrameTypeLibId = findFrameTypeLibId(w.frameType || "");
  const { data: configurations = [] } = useQuery<FrameConfiguration[]>({
    queryKey: ["/api/frame-types", currentFrameTypeLibId, "configurations"],
    queryFn: async () => {
      if (!currentFrameTypeLibId) return [];
      const res = await fetch(`/api/frame-types/${currentFrameTypeLibId}/configurations`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!currentFrameTypeLibId,
  });

  const currentConfigId = w.configurationId || "";
  const { data: configProfiles = [] } = useQuery<ConfigurationProfile[]>({
    queryKey: ["/api/configurations", currentConfigId, "profiles"],
    queryFn: async () => {
      if (!currentConfigId) return [];
      const res = await fetch(`/api/configurations/${currentConfigId}/profiles`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!currentConfigId,
  });
  const { data: configAccessories = [] } = useQuery<ConfigurationAccessory[]>({
    queryKey: ["/api/configurations", currentConfigId, "accessories"],
    queryFn: async () => {
      if (!currentConfigId) return [];
      const res = await fetch(`/api/configurations/${currentConfigId}/accessories`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!currentConfigId,
  });
  const { data: configLabor = [] } = useQuery<ConfigurationLabor[]>({
    queryKey: ["/api/configurations", currentConfigId, "labor"],
    queryFn: async () => {
      if (!currentConfigId) return [];
      const res = await fetch(`/api/configurations/${currentConfigId}/labor`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!currentConfigId,
  });

  const configSignature = deriveConfigSignature(w as QuoteItem);

  const glassPricePerSqm = libGlassPrice(w.glassIguType || "", w.glassType || "", w.glassThickness || "");

  const linerPricePerM = (() => {
    if (!w.linerType) return null;
    const linerEntry = libLiners.find((e) => (e.data as any).value === w.linerType);
    const dbPrice = linerEntry ? (linerEntry.data as any).priceProvision : null;
    if (dbPrice != null) return dbPrice;
    const fallback = LINER_TYPES.find((lt) => lt.value === w.linerType);
    return fallback?.priceProvision ?? null;
  })();

  const handlePriceEach = (() => {
    if (!w.handleType) return null;
    if (libCategoryHandles.length > 0) {
      const catEntry = libCategoryHandles.find((e) => (e.data as any).value === w.handleType);
      const catPrice = catEntry ? (catEntry.data as any).priceProvision : null;
      if (catPrice != null) return catPrice;
    }
    const handles = DOOR_CATEGORIES.includes(w.category || "") ? libDoorHandles : libWindowHandles;
    const handleEntry = handles.find((e) => (e.data as any).value === w.handleType);
    const dbPrice = handleEntry ? (handleEntry.data as any).priceProvision : null;
    if (dbPrice != null) return dbPrice;
    const allHandles = [...getHandlesForCategory(w.category || "windows-standard")];
    const fallback = allHandles.find((h) => h.value === w.handleType);
    return fallback?.priceProvision ?? null;
  })();

  const openingPanelCount = configSignature.awningCount + configSignature.hingeCount + configSignature.slidingCount;

  const wanzBarPricingInput = (() => {
    if (!w.wanzBar || !w.wanzBarSource || !w.wanzBarSize) return undefined;
    const wbEntry = libWanzBars.find((e) => (e.data as any).value === w.wanzBarSize);
    if (!wbEntry) {
      const fallback = WANZ_BAR_DEFAULTS.find((wb) => wb.value === w.wanzBarSize);
      if (!fallback) return undefined;
      return { enabled: true, source: w.wanzBarSource as "nz-local" | "direct", kgPerMetre: fallback.kgPerMetre, pricePerKgUsd: fallback.pricePerKgUsd, priceNzdPerLinM: fallback.priceNzdPerLinM };
    }
    const d = wbEntry.data as any;
    return { enabled: true, source: w.wanzBarSource as "nz-local" | "direct", kgPerMetre: d.kgPerMetre || 0, pricePerKgUsd: d.pricePerKgUsd || 0, priceNzdPerLinM: d.priceNzdPerLinM || 0 };
  })();

  const hasConfigData = currentConfigId && (configProfiles.length > 0 || configAccessories.length > 0 || configLabor.length > 0);
  const currentPricing: PricingBreakdown | null = hasConfigData
    ? calculatePricing(
        w.width || 0, w.height || 0, w.quantity || 1,
        configProfiles, configAccessories, configLabor,
        usdToNzdRate, w.pricePerSqm || 500,
        { glassPricePerSqm, linerPricePerM, handlePriceEach, openingPanelCount: Math.max(1, openingPanelCount), wanzBar: wanzBarPricingInput },
        { masterProfiles, masterAccessories, masterLabour }
      )
    : null;

  useEffect(() => {
    if (formIsDirty) setHasUnsavedChanges(true);
  }, [formIsDirty]);

  useEffect(() => {
    if (skipCategoryResetRef.current) {
      skipCategoryResetRef.current = false;
      return;
    }
    form.setValue("layout", "standard");
    form.setValue("windowType", "fixed");
    form.setValue("hingeSide", "left");
    form.setValue("openDirection", category === "entrance-door" ? "in" : "out");
    form.setValue("halfSolid", false);
    form.setValue("sidelightWidth", 400);
    form.setValue("sidelightEnabled", true);
    form.setValue("sidelightSide", "right");
    form.setValue("doorSplit", false);
    form.setValue("doorSplitHeight", 0);
    form.setValue("centerWidth", 0);
    form.setValue("entranceDoorRows", [...defaultEntranceDoorRows]);
    form.setValue("entranceSidelightRows", [...defaultEntranceDoorRows]);
    form.setValue("entranceSidelightLeftRows", [...defaultEntranceDoorRows]);
    form.setValue("hingeDoorRows", [...defaultEntranceDoorRows]);
    form.setValue("frenchDoorLeftRows", [...defaultEntranceDoorRows]);
    form.setValue("frenchDoorRightRows", [...defaultEntranceDoorRows]);
    form.setValue("panelRows", []);
    form.setValue("customColumns", makeDefaultColumns(2));
    if (category === "bifold-door") {
      form.setValue("panels", 3);
      form.setValue("bifoldLeftCount", 1);
    } else if (category === "stacker-door") {
      form.setValue("panels", 3);
    } else if (category === "sliding-door") {
      form.setValue("panels", 2);
      form.setValue("bifoldLeftCount", 0);
    } else {
      form.setValue("panels", 3);
      form.setValue("bifoldLeftCount", 0);
    }
    const doorCats = ["entrance-door", "hinge-door", "french-door", "bifold-door", "stacker-door", "sliding-door"];
    form.setValue("heightFromFloor", doorCats.includes(category) ? 30 : 800);
    const frameTypes = libFrameTypesForCategory(category);
    if (frameTypes.length > 0) form.setValue("frameType", frameTypes[0].value);
    form.setValue("handleType", "");
    form.setValue("configurationId", "");
  }, [category]);

  useEffect(() => {
    if (configurations.length === 0) return;
    const match = findMatchingConfiguration(configSignature, configurations);
    if (match && match.id !== w.configurationId) {
      form.setValue("configurationId", match.id);
      form.setValue("pricePerSqm", match.defaultSalePricePerSqm || 550);
    } else if (!match && !w.configurationId) {
      form.setValue("configurationId", configurations[0].id);
      form.setValue("pricePerSqm", configurations[0].defaultSalePricePerSqm || 550);
    }
  }, [configurations, configSignature.signature, w.frameType]);

  const isEntrance = category === "entrance-door";
  const isHingeDoor = category === "hinge-door";
  const isFrench = category === "french-door";
  const isBifold = category === "bifold-door";
  const isStacker = category === "stacker-door";
  const noCustomCategories = isEntrance || isHingeDoor || isFrench || isBifold || isStacker;
  const isCustom = layout === "custom" && !noCustomCategories;
  const isSlidingCategory = ["sliding-window", "sliding-door"].includes(category);
  const isDoorCategory = ["french-door"].includes(category);

  const showWindowType = !isCustom && category === "windows-standard";
  const showHingeSide = ["entrance-door", "hinge-door"].includes(category);
  const showSidelightControls = isEntrance && w.sidelightEnabled;
  const showPanels = ["bifold-door", "stacker-door"].includes(category);
  const showBifoldSplit = category === "bifold-door";
  const showCenterWidth = !isCustom && category === "bay-window";
  const showOpenDirection = !isCustom && !["windows-standard", "sliding-window", "sliding-door", "stacker-door"].includes(category);
  const showLayoutSelect = !noCustomCategories;
  const showGrid = isCustom;

  const customColumns: CustomColumn[] = w.customColumns || makeDefaultColumns(2);
  const numColumns = customColumns.length;

  function setColumnCount(count: number) {
    const current = w.customColumns || [];
    const next: CustomColumn[] = Array.from({ length: count }, (_, i) => {
      if (i < current.length) return current[i];
      return { width: 0, rows: [{ height: 0, type: "fixed" as const, slideDirection: "right" as const, hingeSide: "left" as const, openDirection: "out" as const }] };
    });
    form.setValue("customColumns", next);
    setExpandedCols(new Set([0]));
  }

  function setColumnWidth(colIdx: number, width: number) {
    const cols = [...(w.customColumns || [])];
    cols[colIdx] = { ...cols[colIdx], width };
    form.setValue("customColumns", cols);
  }

  function setColumnRowCount(colIdx: number, rowCount: number) {
    const cols = [...(w.customColumns || [])];
    const currentRows = cols[colIdx].rows || [];
    const next = Array.from({ length: rowCount }, (_, i) => {
      if (i < currentRows.length) return currentRows[i];
      return { height: 0, type: "fixed" as const, slideDirection: "right" as const, hingeSide: "left" as const, openDirection: "out" as const };
    });
    cols[colIdx] = { ...cols[colIdx], rows: next };
    form.setValue("customColumns", cols);
  }

  function setRowHeight(colIdx: number, rowIdx: number, height: number) {
    const cols = [...(w.customColumns || [])];
    const rows = [...(cols[colIdx].rows || [])];
    rows[rowIdx] = { ...rows[rowIdx], height };
    cols[colIdx] = { ...cols[colIdx], rows };
    form.setValue("customColumns", cols);
  }

  function toggleRowType(colIdx: number, rowIdx: number) {
    const cols = [...(w.customColumns || [])];
    const rows = [...(cols[colIdx].rows || [])];
    const current = rows[rowIdx].type || "fixed";
    if (isSlidingCategory) {
      const cycle: Record<string, "fixed" | "sliding" | "awning"> = { fixed: "sliding", sliding: "awning", awning: "fixed" };
      rows[rowIdx] = {
        ...rows[rowIdx],
        type: cycle[current] || "fixed",
      };
    } else if (isDoorCategory) {
      const cycle: Record<string, "fixed" | "awning" | "hinge"> = { fixed: "awning", awning: "hinge", hinge: "fixed" };
      rows[rowIdx] = {
        ...rows[rowIdx],
        type: cycle[current] || "fixed",
      };
    } else {
      rows[rowIdx] = {
        ...rows[rowIdx],
        type: current === "awning" ? "fixed" : "awning",
      };
    }
    cols[colIdx] = { ...cols[colIdx], rows };
    form.setValue("customColumns", cols);
  }

  function setSlideDirection(colIdx: number, rowIdx: number, dir: "left" | "right") {
    const cols = [...(w.customColumns || [])];
    const rows = [...(cols[colIdx].rows || [])];
    rows[rowIdx] = { ...rows[rowIdx], slideDirection: dir };
    cols[colIdx] = { ...cols[colIdx], rows };
    form.setValue("customColumns", cols);
  }

  function setRowHingeSide(colIdx: number, rowIdx: number, side: "left" | "right") {
    const cols = [...(w.customColumns || [])];
    const rows = [...(cols[colIdx].rows || [])];
    rows[rowIdx] = { ...rows[rowIdx], hingeSide: side };
    cols[colIdx] = { ...cols[colIdx], rows };
    form.setValue("customColumns", cols);
  }

  function setRowOpenDirection(colIdx: number, rowIdx: number, dir: "in" | "out") {
    const cols = [...(w.customColumns || [])];
    const rows = [...(cols[colIdx].rows || [])];
    rows[rowIdx] = { ...rows[rowIdx], openDirection: dir };
    cols[colIdx] = { ...cols[colIdx], rows };
    form.setValue("customColumns", cols);
  }

  type DoorRowField = "entranceDoorRows" | "entranceSidelightRows" | "entranceSidelightLeftRows" | "hingeDoorRows" | "frenchDoorLeftRows" | "frenchDoorRightRows";

  function setEntranceDoorRowCount(field: DoorRowField, count: number) {
    const current = w[field] || defaultEntranceDoorRows;
    const next: EntranceDoorRow[] = Array.from({ length: count }, (_, i) => {
      if (i < current.length) return current[i];
      return { height: 0, type: "fixed" as const };
    });
    form.setValue(field, next);
  }

  function setEntranceDoorRowHeight(field: DoorRowField, rowIdx: number, height: number) {
    const current = [...(w[field] || defaultEntranceDoorRows)];
    current[rowIdx] = { ...current[rowIdx], height };
    form.setValue(field, current);
  }

  function toggleEntranceDoorRowType(field: DoorRowField, rowIdx: number) {
    const current = [...(w[field] || defaultEntranceDoorRows)];
    current[rowIdx] = { ...current[rowIdx], type: current[rowIdx].type === "awning" ? "fixed" : "awning" };
    form.setValue(field, current);
  }

  function toggleColumnExpanded(colIdx: number) {
    setExpandedCols(prev => {
      const next = new Set(prev);
      if (next.has(colIdx)) next.delete(colIdx);
      else next.add(colIdx);
      return next;
    });
  }

  const [expandedPanels, setExpandedPanels] = useState<Set<number>>(new Set([0]));

  function togglePanelExpanded(panelIdx: number) {
    setExpandedPanels(prev => {
      const next = new Set(prev);
      if (next.has(panelIdx)) next.delete(panelIdx);
      else next.add(panelIdx);
      return next;
    });
  }

  function ensurePanelRows(count: number) {
    const current = w.panelRows || [];
    if (current.length === count) return;
    const next: EntranceDoorRow[][] = Array.from({ length: count }, (_, i) => {
      if (i < current.length) return current[i];
      return [{ height: 0, type: "fixed" as const }];
    });
    form.setValue("panelRows", next);
  }

  function setPanelRowCount(panelIdx: number, count: number) {
    const current = [...(w.panelRows || [])];
    while (current.length <= panelIdx) current.push([{ height: 0, type: "fixed" }]);
    const panelCurrent = current[panelIdx] || [{ height: 0, type: "fixed" }];
    const next: EntranceDoorRow[] = Array.from({ length: count }, (_, i) => {
      if (i < panelCurrent.length) return panelCurrent[i];
      return { height: 0, type: "fixed" as const };
    });
    current[panelIdx] = next;
    form.setValue("panelRows", current);
  }

  function setPanelRowHeight(panelIdx: number, rowIdx: number, height: number) {
    const current = [...(w.panelRows || [])];
    while (current.length <= panelIdx) current.push([{ height: 0, type: "fixed" }]);
    const rows = [...(current[panelIdx] || [{ height: 0, type: "fixed" }])];
    rows[rowIdx] = { ...rows[rowIdx], height };
    current[panelIdx] = rows;
    form.setValue("panelRows", current);
  }

  function togglePanelRowType(panelIdx: number, rowIdx: number) {
    const current = [...(w.panelRows || [])];
    while (current.length <= panelIdx) current.push([{ height: 0, type: "fixed" }]);
    const rows = [...(current[panelIdx] || [{ height: 0, type: "fixed" }])];
    rows[rowIdx] = { ...rows[rowIdx], type: rows[rowIdx].type === "awning" ? "fixed" : "awning" };
    current[panelIdx] = rows;
    form.setValue("panelRows", current);
  }

  function generateRoomCode(roomCode: string, floorCode: string): string {
    const prefix = `${roomCode}-${floorCode}`;
    const existingNums = items
      .filter(iwp => iwp.item.name.startsWith(prefix))
      .map(iwp => {
        const match = iwp.item.name.match(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`));
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0);
    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
    return `${prefix}${String(nextNum).padStart(2, "0")}`;
  }

  function selectRoom(roomCode: string) {
    const code = generateRoomCode(roomCode, selectedFloor);
    form.setValue("name", code);
    setRoomDropdownOpen(false);
    setRoomFilter("");
  }

  async function autoGenerateConfiguration(sig: ConfigSignature): Promise<string | null> {
    if (!currentFrameTypeLibId || configurations.length === 0) return null;
    if (findMatchingConfiguration(sig, configurations)) return null;
    const baseConfig = configurations[0];
    try {
      const baseProfiles = await fetch(`/api/configurations/${baseConfig.id}/profiles`).then((r) => r.ok ? r.json() : []);
      const baseAccessories = await fetch(`/api/configurations/${baseConfig.id}/accessories`).then((r) => r.ok ? r.json() : []);
      const baseLabor = await fetch(`/api/configurations/${baseConfig.id}/labor`).then((r) => r.ok ? r.json() : []);
      const newConfigRes = await apiRequest("POST", `/api/frame-types/${currentFrameTypeLibId}/configurations`, {
        frameTypeId: currentFrameTypeLibId,
        name: sig.label,
        description: `Auto-generated: ${sig.label}`,
        defaultSalePricePerSqm: baseConfig.defaultSalePricePerSqm || 550,
        sortOrder: configurations.length,
      });
      const newConfig = await newConfigRes.json();
      for (const p of baseProfiles) {
        let qty = p.quantityPerSet || 1;
        if (p.role === "sash-frame") qty = Math.max(1, sig.awningCount + sig.hingeCount + sig.slidingCount);
        await apiRequest("POST", `/api/configurations/${newConfig.id}/profiles`, {
          configurationId: newConfig.id, mouldNumber: p.mouldNumber, role: p.role,
          kgPerMetre: p.kgPerMetre, pricePerKgUsd: p.pricePerKgUsd,
          quantityPerSet: qty, lengthFormula: p.lengthFormula, sortOrder: p.sortOrder,
        });
      }
      if (sig.mullionCount > 0) {
        const hasMullion = baseProfiles.some((p: any) => p.role === "mullion");
        if (!hasMullion) {
          await apiRequest("POST", `/api/configurations/${newConfig.id}/profiles`, {
            configurationId: newConfig.id, mouldNumber: "2020250", role: "mullion",
            kgPerMetre: "0.78", pricePerKgUsd: "5.60",
            quantityPerSet: sig.mullionCount, lengthFormula: "height", sortOrder: 99,
          });
        }
      }
      for (const a of baseAccessories) {
        await apiRequest("POST", `/api/configurations/${newConfig.id}/accessories`, {
          configurationId: newConfig.id, name: a.name, code: a.code, colour: a.colour,
          priceUsd: a.priceUsd, quantityPerSet: a.quantityPerSet, scalingType: a.scalingType, sortOrder: a.sortOrder,
        });
      }
      for (const l of baseLabor) {
        await apiRequest("POST", `/api/configurations/${newConfig.id}/labor`, {
          configurationId: newConfig.id, taskName: l.taskName, costNzd: l.costNzd, sortOrder: l.sortOrder,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/frame-types", currentFrameTypeLibId, "configurations"] });
      toast({ title: "Configuration created", description: `"${sig.label}" auto-generated and added to library.` });
      return newConfig.id;
    } catch {
      return null;
    }
  }

  async function onSubmit(data: InsertQuoteItem) {
    const sig = deriveConfigSignature(data as QuoteItem);
    const matchingConfig = findMatchingConfiguration(sig, configurations);
    let finalData = { ...data };
    if (!matchingConfig && configurations.length > 0 && currentFrameTypeLibId) {
      const newConfigId = await autoGenerateConfiguration(sig);
      if (newConfigId) {
        const baseConfig = configurations[0];
        finalData = { ...finalData, configurationId: newConfigId, pricePerSqm: baseConfig?.defaultSalePricePerSqm || finalData.pricePerSqm || 500 };
      }
    }
    const cachedWeightKg = currentPricing?.totalWeightKg ?? 0;
    const itemWithWeight = { ...finalData, cachedWeightKg };
    if (editingId) {
      setItems(items.map((iwp) => (iwp.item.id === editingId ? { ...iwp, item: { ...itemWithWeight, id: editingId } } : iwp)));
      setEditingId(null);
      toast({ title: "Item updated", description: `${finalData.name} has been updated.` });
    } else {
      const newItem: QuoteItem = { ...itemWithWeight, id: crypto.randomUUID() };
      setItems([...items, { item: newItem }]);
      toast({ title: "Item added", description: `${finalData.name} added to quote.` });
    }
    setHasUnsavedChanges(true);
    form.reset({ ...defaultValues });
  }

  function editItem(iwp: ItemWithPhoto) {
    const { id, ...rest } = iwp.item;
    skipCategoryResetRef.current = true;
    form.reset(rest);
    setEditingId(id);
  }

  function duplicateItem(iwp: ItemWithPhoto) {
    const newItem: QuoteItem = { ...iwp.item, id: crypto.randomUUID(), name: `${iwp.item.name} (copy)` };
    setItems([...items, { item: newItem }]);
    setHasUnsavedChanges(true);
    toast({ title: "Item duplicated" });
  }

  function deleteItem(id: string) {
    setItems(items.filter((iwp) => iwp.item.id !== id));
    if (editingId === id) { setEditingId(null); form.reset({ ...defaultValues }); }
    setHasUnsavedChanges(true);
    toast({ title: "Item removed" });
  }

  function cancelEdit() {
    setEditingId(null);
    form.reset({ ...defaultValues });
  }

  async function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !photoTargetItemId) return;
    try {
      const compressed = await compressImage(file);
      setItems(prev => prev.map(iwp =>
        iwp.item.id === photoTargetItemId ? { ...iwp, photo: compressed } : iwp
      ));
      setHasUnsavedChanges(true);
      toast({ title: "Photo added" });
    } catch {
      toast({ title: "Failed to process photo", variant: "destructive" });
    }
    setPhotoTargetItemId(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  function buildFilename(itemName: string, itemId?: string): string {
    const jobPart = sanitizeFilename(jobName || "Job");
    const itemPart = sanitizeFilename(itemName || itemId || "drawing");
    return `${jobPart}_${itemPart}.png`;
  }

  async function handleDownloadPng(config: InsertQuoteItem, itemId?: string) {
    setOffscreenConfig(config);
    setTimeout(async () => {
      if (offscreenDrawingRef.current) {
        try {
          await downloadPng(offscreenDrawingRef.current, buildFilename(config.name || "", itemId));
        } catch {
          toast({ title: "Failed to download PNG", variant: "destructive" });
        }
      }
      setOffscreenConfig(null);
    }, 200);
  }

  async function handleDownloadCurrentPng() {
    if (drawingRef.current) {
      try {
        await downloadPng(drawingRef.current, buildFilename(w.name || ""));
      } catch {
        toast({ title: "Failed to download PNG", variant: "destructive" });
      }
    }
  }

  function renderOffscreenAndCapture(config: InsertQuoteItem): Promise<Blob> {
    return new Promise((resolve, reject) => {
      setOffscreenConfig(config);
      setTimeout(async () => {
        if (offscreenDrawingRef.current) {
          try {
            const blob = await svgToPngBlob(offscreenDrawingRef.current, 3);
            resolve(blob);
          } catch (e) {
            reject(e);
          }
        } else {
          reject(new Error("Offscreen canvas not ready"));
        }
        setOffscreenConfig(null);
      }, 300);
    });
  }

  async function handleDownloadAllPngs() {
    if (items.length === 0) {
      toast({ title: "No items to download", variant: "destructive" });
      return;
    }
    toast({ title: `Downloading ${items.length} item(s)...` });
    for (const iwp of items) {
      try {
        const blob = await renderOffscreenAndCapture(iwp.item);
        downloadBlob(blob, buildFilename(iwp.item.name || "", iwp.item.id));
        await new Promise((r) => setTimeout(r, 100));
      } catch {
        toast({ title: `Failed to download ${iwp.item.name || "item"}`, variant: "destructive" });
      }
    }
  }

  async function handleDownloadPdf() {
    if (items.length === 0) {
      toast({ title: "No items to download", variant: "destructive" });
      return;
    }
    toast({ title: `Generating PDF with ${items.length} item(s)...` });
    try {
      const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < items.length; i++) {
        if (i > 0) pdf.addPage();
        const iwp = items[i];
        const blob = await renderOffscreenAndCapture(iwp.item);
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Image load failed"));
          img.src = dataUrl;
        });

        const imgAspect = img.width / img.height;
        const margin = 20;
        const availW = pageWidth - margin * 2;
        const availH = pageHeight - margin * 2;
        let drawW: number, drawH: number;
        if (imgAspect > availW / availH) {
          drawW = availW;
          drawH = availW / imgAspect;
        } else {
          drawH = availH;
          drawW = availH * imgAspect;
        }
        const x = (pageWidth - drawW) / 2;
        const y = (pageHeight - drawH) / 2;

        pdf.addImage(dataUrl, "PNG", x, y, drawW, drawH);
      }

      const pdfFilename = `${sanitizeFilename(jobName || "Job")}.pdf`;
      pdf.save(pdfFilename);
      toast({ title: "PDF downloaded successfully" });
    } catch {
      toast({ title: "Failed to generate PDF", variant: "destructive" });
    }
  }

  async function saveJob() {
    if (!jobName.trim()) {
      toast({ title: "Job name is required", variant: "destructive" });
      return;
    }
    if (items.length === 0) {
      toast({ title: "Add at least one item before saving", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      let currentJobId = savedJobId;
      if (!currentJobId) {
        const res = await apiRequest("POST", "/api/jobs", {
          name: jobName, address: jobAddress, date: jobDate,
        });
        const job = await res.json();
        currentJobId = job.id;
        setSavedJobId(job.id);
      } else {
        await apiRequest("PATCH", `/api/jobs/${currentJobId}`, {
          name: jobName, address: jobAddress, date: jobDate,
        });
        const existingItems = await fetch(`/api/jobs/${currentJobId}`).then(r => r.json());
        for (const ei of (existingItems.items || [])) {
          await apiRequest("DELETE", `/api/jobs/${currentJobId}/items/${ei.id}`);
        }
      }

      for (let i = 0; i < items.length; i++) {
        await apiRequest("POST", `/api/jobs/${currentJobId}/items`, {
          config: items[i].item,
          photo: items[i].photo || null,
          sortOrder: i,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setHasUnsavedChanges(false);
      toast({ title: "Job saved successfully" });
      if (isNewJob) {
        navigate(`/job/${currentJobId}`, { replace: true });
      }
    } catch (e: any) {
      toast({ title: "Failed to save job", description: e.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!savedJobId || !hasUnsavedChanges || items.length === 0 || !jobName.trim()) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveJob();
    }, 3000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [items, savedJobId, hasUnsavedChanges, jobName, jobAddress, jobDate]);

  function calcSqm(width: number, height: number, quantity: number): string {
    return ((width * height * quantity) / 1_000_000).toFixed(2);
  }

  function calcItemPrice(item: QuoteItem | InsertQuoteItem): number {
    const sqm = (item.width * item.height * (item.quantity || 1)) / 1_000_000;
    return sqm * (item.pricePerSqm || 500);
  }

  function formatPrice(amount: number): string {
    return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const totalSqm = items.reduce((sum, iwp) => {
    return sum + (iwp.item.width * iwp.item.height * (iwp.item.quantity || 1)) / 1_000_000;
  }, 0).toFixed(2);

  const totalPrice = items.reduce((sum, iwp) => sum + calcItemPrice(iwp.item), 0);

  const drawingConfig: InsertQuoteItem = {
    ...w,
    width: w.width || 1200,
    height: w.height || 1500,
    quantity: w.quantity || 1,
    name: w.name || "Untitled",
  };

  if (jobLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading job...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background" data-testid="quote-builder">
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoCapture}
        data-testid="input-photo-capture"
      />

      <header className="border-b px-6 py-3 bg-card shrink-0">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" data-testid="button-back-to-jobs" onClick={() => {
              if (hasUnsavedChanges) { setShowLeaveDialog(true); } else { navigate("/"); }
            }}>
              <ArrowLeftCircle className="w-5 h-5" />
            </Button>
            <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary">
              <LayoutGrid className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight" data-testid="text-app-title">
                Pro-Quote CAD Generator
              </h1>
              <p className="text-xs text-muted-foreground">
                {savedJobId ? "Editing Job" : "New Job"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <Badge variant="secondary" data-testid="badge-item-count">
                {items.length} item{items.length !== 1 ? "s" : ""}
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-download-menu">
                  <Download className="w-4 h-4 mr-1.5" /> Download <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDownloadCurrentPng} data-testid="menu-download-current-png">
                  Current Drawing (PNG)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDownloadAllPngs} disabled={items.length === 0} data-testid="menu-download-all-pngs">
                  All Items (Individual PNGs)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadPdf} disabled={items.length === 0} data-testid="menu-download-pdf">
                  All Items (PDF)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {savedJobId && items.length > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={() => navigate(`/job/${savedJobId}/summary`)} data-testid="button-quote-summary">
                  <FileText className="w-4 h-4 mr-1.5" /> Summary
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate(`/job/${savedJobId}/exec-summary`)} data-testid="button-exec-summary">
                  <FileText className="w-4 h-4 mr-1.5" /> Exec Summary
                </Button>
              </>
            )}
            <Button onClick={saveJob} disabled={isSaving} data-testid="button-save-job">
              <Save className="w-4 h-4 mr-1.5" /> {isSaving ? "Saving..." : "Save Job"}
            </Button>
          </div>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1 min-w-0">
            <Label className="text-xs">Job Name *</Label>
            <Input
              value={jobName}
              onChange={(e) => { setJobName(e.target.value); setHasUnsavedChanges(true); }}
              placeholder="e.g. Smith Residence"
              data-testid="input-job-name"
            />
          </div>
          <div className="flex-1 min-w-0">
            <Label className="text-xs">Address</Label>
            <Input
              value={jobAddress}
              onChange={(e) => { setJobAddress(e.target.value); setHasUnsavedChanges(true); }}
              placeholder="e.g. 123 Main St"
              data-testid="input-job-address"
            />
          </div>
          <div className="w-40 shrink-0">
            <Label className="text-xs">Date</Label>
            <Input
              type="date"
              value={jobDate}
              onChange={(e) => { setJobDate(e.target.value); setHasUnsavedChanges(true); }}
              data-testid="input-job-date"
            />
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <ScrollArea className="w-full lg:w-80 xl:w-96 border-r shrink-0">
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 space-y-4">
            <Tabs value={formTab} onValueChange={setFormTab}>
              <TabsList className="w-full grid grid-cols-2 mb-3">
                <TabsTrigger value="drawing" data-testid="tab-drawing-config">Drawing Config</TabsTrigger>
                <TabsTrigger value="specifics" data-testid="tab-item-specifics">Item Specifics</TabsTrigger>
              </TabsList>

              <TabsContent value="drawing" className="space-y-4 mt-0">
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                <Ruler className="w-3.5 h-3.5" /> Item Details
              </h2>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Item ID / Reference</Label>
                  <div className="relative" ref={roomDropdownRef}>
                    <div className="flex gap-1.5">
                      <div className="relative flex-1">
                        <Input
                          {...form.register("name")}
                          value={w.name || ""}
                          onChange={(e) => {
                            form.setValue("name", e.target.value, { shouldValidate: true });
                            setRoomFilter(e.target.value);
                            if (!roomDropdownOpen) setRoomDropdownOpen(true);
                          }}
                          onFocus={() => setRoomDropdownOpen(true)}
                          placeholder="Type or select room..."
                          data-testid="input-item-name"
                          className="pr-8"
                        />
                        <button
                          type="button"
                          onClick={() => setRoomDropdownOpen(!roomDropdownOpen)}
                          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                          data-testid="button-room-dropdown"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <Select value={selectedFloor} onValueChange={setSelectedFloor}>
                        <SelectTrigger data-testid="select-floor-level" className="w-20 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FLOOR_OPTIONS.map((f) => (
                            <SelectItem key={f.code} value={f.code}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {roomDropdownOpen && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 border rounded-md bg-popover shadow-md max-h-48 overflow-y-auto" data-testid="room-dropdown-list">
                        {ROOM_OPTIONS
                          .filter(r => !roomFilter || r.label.toLowerCase().includes(roomFilter.toLowerCase()) || r.code.toLowerCase().includes(roomFilter.toLowerCase()))
                          .map((room) => (
                            <button
                              key={room.code}
                              type="button"
                              onClick={() => selectRoom(room.code)}
                              className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between"
                              data-testid={`option-room-${room.code}`}
                            >
                              <span>{room.label}</span>
                              <span className="text-xs text-muted-foreground font-mono">{room.code}</span>
                            </button>
                          ))
                        }
                        {ROOM_OPTIONS.filter(r => !roomFilter || r.label.toLowerCase().includes(roomFilter.toLowerCase()) || r.code.toLowerCase().includes(roomFilter.toLowerCase())).length === 0 && (
                          <div className="px-3 py-2 text-xs text-muted-foreground">No matching rooms</div>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Select room or type custom ID. Format: CODE-FLOOR## (e.g. BED-G01)</p>
                </div>
                <div>
                  <Label htmlFor="quantity" className="text-xs">Quantity</Label>
                  <Input id="quantity" type="number" min={1}
                    {...form.register("quantity", { valueAsNumber: true })}
                    data-testid="input-quantity" />
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Type & Dimensions
              </h2>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Category</Label>
                  <Select value={category} onValueChange={(v) => form.setValue("category", v as any)}>
                    <SelectTrigger data-testid="select-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="width" className="text-xs">Width (mm)</Label>
                    <Input id="width" type="number" min={200}
                      {...form.register("width", { valueAsNumber: true })}
                      data-testid="input-width" />
                  </div>
                  <div>
                    <Label htmlFor="height" className="text-xs">Height (mm)</Label>
                    <Input id="height" type="number" min={200}
                      {...form.register("height", { valueAsNumber: true })}
                      data-testid="input-height" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-xs" data-testid="badge-frame-size">
                    {frameSize}mm Frame
                  </Badge>
                  <Badge variant="outline" className="text-xs" data-testid="badge-live-sqm">
                    {calcSqm(w.width || 0, w.height || 0, w.quantity || 1)} m²
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Configuration
              </h2>
              <div className="space-y-3">
                {showLayoutSelect && (
                  <div>
                    <Label className="text-xs">Layout</Label>
                    <Select value={layout} onValueChange={(v) => form.setValue("layout", v as any)}>
                      <SelectTrigger data-testid="select-layout"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="custom">Custom (Grid)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {showWindowType && (
                  <div>
                    <Label className="text-xs">Window Type</Label>
                    <Select value={w.windowType} onValueChange={(v) => form.setValue("windowType", v as any)}>
                      <SelectTrigger data-testid="select-window-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed</SelectItem>
                        <SelectItem value="awning">Awning (Top-Hung)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {showOpenDirection && (
                  <div>
                    <Label className="text-xs">Opening Direction</Label>
                    <Select value={w.openDirection} onValueChange={(v) => form.setValue("openDirection", v as any)}>
                      <SelectTrigger data-testid="select-open-direction"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="out">Out (Solid Line)</SelectItem>
                        <SelectItem value="in">In (Dashed Line)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {showHingeSide && (
                  <div>
                    <Label className="text-xs">Hinge Side</Label>
                    <Select value={w.hingeSide} onValueChange={(v) => form.setValue("hingeSide", v as any)}>
                      <SelectTrigger data-testid="select-hinge-side"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {isEntrance && (
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox id="sidelightEnabled" checked={w.sidelightEnabled}
                      onCheckedChange={(v) => form.setValue("sidelightEnabled", !!v)}
                      data-testid="checkbox-sidelight-enabled" />
                    <Label htmlFor="sidelightEnabled" className="text-xs cursor-pointer">
                      Sidelight
                    </Label>
                  </div>
                )}

                {showSidelightControls && (
                  <>
                    <div>
                      <Label className="text-xs">Sidelight Position</Label>
                      <Select value={w.sidelightSide || "right"} onValueChange={(v) => form.setValue("sidelightSide", v as any)}>
                        <SelectTrigger data-testid="select-sidelight-side"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                          <SelectItem value="both">Both</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="sidelightWidth" className="text-xs">Sidelight Width (mm)</Label>
                      <Input id="sidelightWidth" type="number" min={100}
                        {...form.register("sidelightWidth", { valueAsNumber: true })}
                        data-testid="input-sidelight-width" />
                    </div>
                  </>
                )}

                {isEntrance && (() => {
                  const doorRows: EntranceDoorRow[] = w.entranceDoorRows || defaultEntranceDoorRows;
                  const slSide = w.sidelightSide || "right";
                  const slEnabled = w.sidelightEnabled;
                  const slRows: EntranceDoorRow[] = w.entranceSidelightRows || defaultEntranceDoorRows;
                  const slLeftRows: EntranceDoorRow[] = w.entranceSidelightLeftRows || defaultEntranceDoorRows;

                  function renderRowControls(
                    label: string,
                    rows: EntranceDoorRow[],
                    field: "entranceDoorRows" | "entranceSidelightRows" | "entranceSidelightLeftRows",
                    prefix: string
                  ) {
                    return (
                      <div className="border rounded-md bg-muted/20 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold">{label}</Label>
                          <Select value={String(rows.length)} onValueChange={(v) => setEntranceDoorRowCount(field, parseInt(v))}>
                            <SelectTrigger data-testid={`select-${prefix}-rows`} className="h-7 text-xs w-16">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4].map((n) => (
                                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          {rows.map((row, ri) => {
                            const typeLabel = row.type === "awning" ? "AWN" : "FIX";
                            const isActive = row.type !== "fixed";
                            return (
                              <div key={ri} className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => toggleEntranceDoorRowType(field, ri)}
                                  className={`
                                    shrink-0 rounded-sm text-xs font-mono py-1 px-2 border transition-colors
                                    ${isActive
                                      ? "bg-primary/15 border-primary/30 text-primary"
                                      : "bg-background border-border text-muted-foreground"
                                    }
                                  `}
                                  data-testid={`button-${prefix}-row-type-${ri}`}
                                >
                                  {typeLabel}
                                </button>
                                <Input
                                  type="number"
                                  min={0}
                                  value={row.height || ""}
                                  placeholder="Auto"
                                  onChange={(e) => setEntranceDoorRowHeight(field, ri, parseFloat(e.target.value) || 0)}
                                  data-testid={`input-${prefix}-row-height-${ri}`}
                                  className="h-7 text-xs flex-1"
                                />
                                <span className="text-xs text-muted-foreground shrink-0">mm</span>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground">FIX = Fixed, AWN = Awning. 0 = even split.</p>
                      </div>
                    );
                  }

                  return (
                    <>
                      {renderRowControls("Door Panel", doorRows, "entranceDoorRows", "door")}
                      {slEnabled && slSide !== "both" && renderRowControls("Sidelight", slRows, "entranceSidelightRows", "sl")}
                      {slEnabled && slSide === "both" && (
                        <>
                          {renderRowControls("Left Sidelight", slLeftRows, "entranceSidelightLeftRows", "sl-left")}
                          {renderRowControls("Right Sidelight", slRows, "entranceSidelightRows", "sl-right")}
                        </>
                      )}
                    </>
                  );
                })()}

                {isHingeDoor && (() => {
                  const hingeDoorRows: EntranceDoorRow[] = w.hingeDoorRows || defaultEntranceDoorRows;
                  return (
                    <div className="border rounded-md bg-muted/20 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">Door Panel</Label>
                        <Select value={String(hingeDoorRows.length)} onValueChange={(v) => setEntranceDoorRowCount("hingeDoorRows", parseInt(v))}>
                          <SelectTrigger data-testid="select-hinge-door-rows" className="h-7 text-xs w-16">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4].map((n) => (
                              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        {hingeDoorRows.map((row, ri) => {
                          const typeLabel = row.type === "awning" ? "AWN" : "FIX";
                          const isActive = row.type !== "fixed";
                          return (
                            <div key={ri} className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => toggleEntranceDoorRowType("hingeDoorRows", ri)}
                                className={`
                                  shrink-0 rounded-sm text-xs font-mono py-1 px-2 border transition-colors
                                  ${isActive
                                    ? "bg-primary/15 border-primary/30 text-primary"
                                    : "bg-background border-border text-muted-foreground"
                                  }
                                `}
                                data-testid={`button-hinge-door-row-type-${ri}`}
                              >
                                {typeLabel}
                              </button>
                              <Input
                                type="number"
                                min={0}
                                value={row.height || ""}
                                placeholder="Auto"
                                onChange={(e) => setEntranceDoorRowHeight("hingeDoorRows", ri, parseFloat(e.target.value) || 0)}
                                data-testid={`input-hinge-door-row-height-${ri}`}
                                className="h-7 text-xs flex-1"
                              />
                              <span className="text-xs text-muted-foreground shrink-0">mm</span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">FIX = Fixed, AWN = Awning. 0 = even split.</p>
                    </div>
                  );
                })()}

                {isFrench && (() => {
                  const leftRows: EntranceDoorRow[] = w.frenchDoorLeftRows || defaultEntranceDoorRows;
                  const rightRows: EntranceDoorRow[] = w.frenchDoorRightRows || defaultEntranceDoorRows;

                  function renderFrenchRowControls(
                    label: string,
                    rows: EntranceDoorRow[],
                    field: DoorRowField,
                    prefix: string
                  ) {
                    return (
                      <div className="border rounded-md bg-muted/20 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold">{label}</Label>
                          <Select value={String(rows.length)} onValueChange={(v) => setEntranceDoorRowCount(field, parseInt(v))}>
                            <SelectTrigger data-testid={`select-${prefix}-rows`} className="h-7 text-xs w-16">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4].map((n) => (
                                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          {rows.map((row, ri) => {
                            const typeLabel = row.type === "awning" ? "AWN" : "FIX";
                            const isActive = row.type !== "fixed";
                            return (
                              <div key={ri} className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => toggleEntranceDoorRowType(field, ri)}
                                  className={`
                                    shrink-0 rounded-sm text-xs font-mono py-1 px-2 border transition-colors
                                    ${isActive
                                      ? "bg-primary/15 border-primary/30 text-primary"
                                      : "bg-background border-border text-muted-foreground"
                                    }
                                  `}
                                  data-testid={`button-${prefix}-row-type-${ri}`}
                                >
                                  {typeLabel}
                                </button>
                                <Input
                                  type="number"
                                  min={0}
                                  value={row.height || ""}
                                  placeholder="Auto"
                                  onChange={(e) => setEntranceDoorRowHeight(field, ri, parseFloat(e.target.value) || 0)}
                                  data-testid={`input-${prefix}-row-height-${ri}`}
                                  className="h-7 text-xs flex-1"
                                />
                                <span className="text-xs text-muted-foreground shrink-0">mm</span>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground">FIX = Fixed, AWN = Awning. 0 = even split.</p>
                      </div>
                    );
                  }

                  return (
                    <>
                      {renderFrenchRowControls("Left Panel", leftRows, "frenchDoorLeftRows", "french-left")}
                      {renderFrenchRowControls("Right Panel", rightRows, "frenchDoorRightRows", "french-right")}
                    </>
                  );
                })()}

                {(isBifold || isStacker) && (() => {
                  const currentPanels = w.panels || 3;
                  const pRows = w.panelRows || [];
                  if (pRows.length !== currentPanels) {
                    setTimeout(() => ensurePanelRows(currentPanels), 0);
                  }
                  const panelLabel = isBifold ? "Leaf" : "Panel";

                  return (
                    <div className="space-y-2">
                      {Array.from({ length: currentPanels }).map((_, pi) => {
                        const panelRowDefs: EntranceDoorRow[] = pRows[pi] || [{ height: 0, type: "fixed" }];
                        const isExpanded = expandedPanels.has(pi);
                        return (
                          <div key={pi} className="border rounded-md bg-muted/20 overflow-hidden" data-testid={`panel-config-${pi}`}>
                            <button
                              type="button"
                              onClick={() => togglePanelExpanded(pi)}
                              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/40 transition-colors"
                              data-testid={`button-toggle-panel-${pi}`}
                            >
                              <span>{panelLabel} {pi + 1} ({panelRowDefs.length} row{panelRowDefs.length !== 1 ? "s" : ""})</span>
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>

                            {isExpanded && (
                              <div className="px-3 pb-3 space-y-2 border-t">
                                <div className="pt-2 flex items-center justify-between">
                                  <Label className="text-xs font-semibold">Rows</Label>
                                  <Select value={String(panelRowDefs.length)} onValueChange={(v) => setPanelRowCount(pi, parseInt(v))}>
                                    <SelectTrigger data-testid={`select-panel-rows-${pi}`} className="h-7 text-xs w-16">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {[1, 2, 3, 4].map((n) => (
                                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  {panelRowDefs.map((row, ri) => {
                                    const typeLabel = row.type === "awning" ? "AWN" : "FIX";
                                    const isActive = row.type !== "fixed";
                                    return (
                                      <div key={ri} className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => togglePanelRowType(pi, ri)}
                                          className={`
                                            shrink-0 rounded-sm text-xs font-mono py-1 px-2 border transition-colors
                                            ${isActive
                                              ? "bg-primary/15 border-primary/30 text-primary"
                                              : "bg-background border-border text-muted-foreground"
                                            }
                                          `}
                                          data-testid={`button-panel-row-type-${pi}-${ri}`}
                                        >
                                          {typeLabel}
                                        </button>
                                        <Input
                                          type="number"
                                          min={0}
                                          value={row.height || ""}
                                          placeholder="Auto"
                                          onChange={(e) => setPanelRowHeight(pi, ri, parseFloat(e.target.value) || 0)}
                                          data-testid={`input-panel-row-height-${pi}-${ri}`}
                                          className="h-7 text-xs flex-1"
                                        />
                                        <span className="text-xs text-muted-foreground shrink-0">mm</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <p className="text-xs text-muted-foreground">FIX = Fixed, AWN = Awning. 0 = even split.</p>
                    </div>
                  );
                })()}

                {showPanels && (
                  <div>
                    <Label className="text-xs">
                      {isBifold ? "Number of Leaves" : "Number of Panels"}
                    </Label>
                    <Select value={String(w.panels)} onValueChange={(v) => {
                      const num = parseInt(v);
                      form.setValue("panels", num);
                      if (isBifold) {
                        form.setValue("bifoldLeftCount", Math.floor(num / 2));
                      }
                      ensurePanelRows(num);
                    }}>
                      <SelectTrigger data-testid="select-panels"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(category === "bifold-door"
                          ? [2, 3, 4, 5, 6, 7, 8]
                          : [3, 4, 5, 6]
                        ).map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {showBifoldSplit && (
                  <div>
                    <Label className="text-xs">Fold Left Count</Label>
                    <Select value={String(w.bifoldLeftCount)}
                      onValueChange={(v) => form.setValue("bifoldLeftCount", parseInt(v))}>
                      <SelectTrigger data-testid="select-bifold-left"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: (w.panels || 3) + 1 }, (_, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {i} left, {(w.panels || 3) - i} right
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {showCenterWidth && (
                  <div>
                    <Label htmlFor="centerWidth" className="text-xs">Center Panel Width (mm)</Label>
                    <Input id="centerWidth" type="number" min={0}
                      placeholder="0 = 60% of total"
                      {...form.register("centerWidth", { valueAsNumber: true })}
                      data-testid="input-center-width" />
                    <p className="text-xs text-muted-foreground mt-1">0 = default 60% of total width</p>
                  </div>
                )}

                {showGrid && (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Number of Columns</Label>
                      <Select value={String(numColumns)} onValueChange={(v) => setColumnCount(parseInt(v))}>
                        <SelectTrigger data-testid="select-columns"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6].map((n) => (
                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      {customColumns.map((col, ci) => {
                        const colRows = col.rows || [{ height: 0, type: "fixed" as const }];
                        const isExpanded = expandedCols.has(ci);
                        return (
                          <div key={ci} className="border rounded-md bg-muted/20 overflow-hidden" data-testid={`column-config-${ci}`}>
                            <button
                              type="button"
                              onClick={() => toggleColumnExpanded(ci)}
                              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/40 transition-colors"
                              data-testid={`button-toggle-col-${ci}`}
                            >
                              <span>Column {ci + 1} ({colRows.length} row{colRows.length !== 1 ? "s" : ""})</span>
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>

                            {isExpanded && (
                              <div className="px-3 pb-3 space-y-2 border-t">
                                <div className="pt-2">
                                  <Label className="text-xs">Width (mm)</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={col.width || ""}
                                    placeholder="Auto (even split)"
                                    onChange={(e) => setColumnWidth(ci, parseFloat(e.target.value) || 0)}
                                    data-testid={`input-col-width-${ci}`}
                                    className="h-8 text-xs"
                                  />
                                </div>

                                <div>
                                  <Label className="text-xs">Rows in Column</Label>
                                  <Select value={String(colRows.length)} onValueChange={(v) => setColumnRowCount(ci, parseInt(v))}>
                                    <SelectTrigger data-testid={`select-col-rows-${ci}`} className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {[1, 2, 3, 4, 5, 6].map((n) => (
                                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-1">
                                  {colRows.map((row, ri) => {
                                    const typeLabel = row.type === "awning" ? "AWN" : row.type === "sliding" ? "SLD" : row.type === "hinge" ? "HNG" : "FIX";
                                    const isActive = row.type !== "fixed";
                                    return (
                                      <div key={ri} className="space-y-1" data-testid={`row-config-${ci}-${ri}`}>
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => toggleRowType(ci, ri)}
                                            className={`
                                              shrink-0 rounded-sm text-xs font-mono py-1 px-2 border transition-colors
                                              ${isActive
                                                ? "bg-primary/15 border-primary/30 text-primary"
                                                : "bg-background border-border text-muted-foreground"
                                              }
                                            `}
                                            data-testid={`button-pane-${ci}-${ri}`}
                                          >
                                            {typeLabel}
                                          </button>
                                          {isSlidingCategory && row.type === "sliding" && (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() => setSlideDirection(ci, ri, "left")}
                                                className={`shrink-0 rounded-sm text-xs py-1 px-1.5 border transition-colors ${
                                                  row.slideDirection === "left"
                                                    ? "bg-primary/15 border-primary/30 text-primary"
                                                    : "bg-background border-border text-muted-foreground"
                                                }`}
                                                data-testid={`button-slide-left-${ci}-${ri}`}
                                              >
                                                <ArrowLeft className="w-3 h-3" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setSlideDirection(ci, ri, "right")}
                                                className={`shrink-0 rounded-sm text-xs py-1 px-1.5 border transition-colors ${
                                                  row.slideDirection !== "left"
                                                    ? "bg-primary/15 border-primary/30 text-primary"
                                                    : "bg-background border-border text-muted-foreground"
                                                }`}
                                                data-testid={`button-slide-right-${ci}-${ri}`}
                                              >
                                                <ArrowRight className="w-3 h-3" />
                                              </button>
                                            </>
                                          )}
                                          <Input
                                            type="number"
                                            min={0}
                                            value={row.height || ""}
                                            placeholder="Auto"
                                            onChange={(e) => setRowHeight(ci, ri, parseFloat(e.target.value) || 0)}
                                            data-testid={`input-row-height-${ci}-${ri}`}
                                            className="h-7 text-xs flex-1"
                                          />
                                          <span className="text-xs text-muted-foreground shrink-0">mm</span>
                                        </div>
                                        {isDoorCategory && row.type === "hinge" && (
                                          <div className="flex items-center gap-1.5 pl-1">
                                            <button
                                              type="button"
                                              onClick={() => setRowOpenDirection(ci, ri, row.openDirection === "in" ? "out" : "in")}
                                              className="shrink-0 rounded-sm text-xs font-mono py-0.5 px-2 border border-primary/30 bg-primary/10 text-primary transition-colors"
                                              data-testid={`button-open-dir-${ci}-${ri}`}
                                            >
                                              {row.openDirection === "in" ? "IN" : "OUT"}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setRowHingeSide(ci, ri, "left")}
                                              className={`shrink-0 rounded-sm text-xs py-0.5 px-1.5 border transition-colors ${
                                                row.hingeSide !== "right"
                                                  ? "bg-primary/15 border-primary/30 text-primary"
                                                  : "bg-background border-border text-muted-foreground"
                                              }`}
                                              data-testid={`button-hinge-left-${ci}-${ri}`}
                                            >
                                              <ArrowLeft className="w-3 h-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setRowHingeSide(ci, ri, "right")}
                                              className={`shrink-0 rounded-sm text-xs py-0.5 px-1.5 border transition-colors ${
                                                row.hingeSide === "right"
                                                  ? "bg-primary/15 border-primary/30 text-primary"
                                                  : "bg-background border-border text-muted-foreground"
                                              }`}
                                              data-testid={`button-hinge-right-${ci}-${ri}`}
                                            >
                                              <ArrowRight className="w-3 h-3" />
                                            </button>
                                            <span className="text-xs text-muted-foreground">Hinge</span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {isSlidingCategory
                        ? "FIX / SLD / AWN cycle. Arrow buttons set slide direction. 0 = even split."
                        : isDoorCategory
                        ? "FIX / AWN / HNG cycle. HNG shows open direction & hinge side. 0 = even split."
                        : "FIX = Fixed, AWN = Awning. Leave widths/heights at 0 for even split."
                      }
                    </p>

                    {!isSlidingCategory && !isDoorCategory && (
                      <div>
                        <Label className="text-xs">Opening Direction</Label>
                        <Select value={w.openDirection} onValueChange={(v) => form.setValue("openDirection", v as any)}>
                          <SelectTrigger data-testid="select-custom-open-dir"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="out">Out (Solid Line)</SelectItem>
                            <SelectItem value="in">In (Dashed Line)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            </TabsContent>

              <TabsContent value="specifics" className="space-y-4 mt-0">
                <div>
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Frame & Finish
                  </h2>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Frame Type</Label>
                      <Select value={w.frameType || ""} onValueChange={(v) => { form.setValue("frameType", v); form.setValue("configurationId", ""); }}>
                        <SelectTrigger data-testid="select-frame-type"><SelectValue placeholder="Select frame type" /></SelectTrigger>
                        <SelectContent>
                          {libFrameTypesForCategory(w.category || "windows-standard").map((ft) => (
                            <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs mb-0.5">Configuration</Label>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 whitespace-normal break-words max-w-full mb-1 block w-fit" data-testid="badge-detected-config">
                        {configSignature.label}
                      </Badge>
                      {configurations.length > 0 ? (
                        <Select
                          value={w.configurationId || ""}
                          onValueChange={(v) => {
                            form.setValue("configurationId", v);
                            const cfg = configurations.find((c) => c.id === v);
                            if (cfg) form.setValue("pricePerSqm", cfg.defaultSalePricePerSqm || 550);
                          }}
                        >
                          <SelectTrigger data-testid="select-configuration"><SelectValue placeholder="Select configuration" /></SelectTrigger>
                          <SelectContent>
                            {configurations.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No configurations for this frame type yet</p>
                      )}
                      {configurations.length > 0 && !findMatchingConfiguration(configSignature, configurations) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-1.5 text-xs"
                          data-testid="button-auto-generate-config"
                          onClick={async () => {
                            const newId = await autoGenerateConfiguration(configSignature);
                            if (newId) {
                              form.setValue("configurationId", newId);
                              const baseConfig = configurations[0];
                              if (baseConfig?.defaultSalePricePerSqm) {
                                form.setValue("pricePerSqm", baseConfig.defaultSalePricePerSqm);
                              }
                            } else {
                              toast({ title: "Error", description: "Failed to generate configuration", variant: "destructive" });
                            }
                          }}
                        >
                          <Plus className="w-3 h-3 mr-1" /> Auto-generate
                        </Button>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs">Frame Color</Label>
                      <Select value={w.frameColor || ""} onValueChange={(v) => form.setValue("frameColor", v)}>
                        <SelectTrigger data-testid="select-frame-color"><SelectValue placeholder="Select color" /></SelectTrigger>
                        <SelectContent>
                          {libFrameColorOptions.map((fc) => (
                            <SelectItem key={fc.value} value={fc.value}>{fc.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Flashing (Head)</Label>
                      <Select value={String(w.flashingSize || 0)} onValueChange={(v) => form.setValue("flashingSize", Number(v))}>
                        <SelectTrigger data-testid="select-flashing"><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">None</SelectItem>
                          {FLASHING_SIZES.map((s) => (
                            <SelectItem key={s} value={String(s)}>{s}mm</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Pricing
                  </h2>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Sale Price per m² (${w.pricePerSqm || 500}/m²)</Label>
                      <Slider
                        value={[w.pricePerSqm || 500]}
                        onValueChange={([v]) => form.setValue("pricePerSqm", v)}
                        min={500}
                        max={750}
                        step={5}
                        data-testid="slider-price-per-sqm"
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                        <span>$500</span>
                        <span className="font-medium">
                          Sale: ${((w.pricePerSqm || 500) * parseFloat(calcSqm(w.width || 0, w.height || 0, w.quantity || 1))).toFixed(2)}
                        </span>
                        <span>$750</span>
                      </div>
                    </div>

                    {currentPricing && (
                      <div className="rounded-md border p-3 space-y-2 bg-muted/30" data-testid="pricing-breakdown">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <span className="text-muted-foreground">Profiles (NZD)</span>
                          <span className="text-right font-medium" data-testid="text-profiles-cost">${currentPricing.profilesCostNzd.toFixed(2)}</span>
                          <span className="text-muted-foreground">Accessories (NZD)</span>
                          <span className="text-right font-medium" data-testid="text-accessories-cost">${currentPricing.accessoriesCostNzd.toFixed(2)}</span>
                          <span className="text-muted-foreground">Labor (NZD)</span>
                          <span className="text-right font-medium" data-testid="text-labor-cost">${currentPricing.laborCostNzd.toFixed(2)}</span>
                          {currentPricing.glassCostNzd > 0 && (
                            <>
                              <span className="text-muted-foreground">Glass (NZD)</span>
                              <span className="text-right font-medium" data-testid="text-glass-cost">${currentPricing.glassCostNzd.toFixed(2)}</span>
                            </>
                          )}
                          {currentPricing.linerCostNzd > 0 && (
                            <>
                              <span className="text-muted-foreground">Liner (NZD)</span>
                              <span className="text-right font-medium" data-testid="text-liner-cost">${currentPricing.linerCostNzd.toFixed(2)}</span>
                            </>
                          )}
                          {currentPricing.handleCostNzd > 0 && (
                            <>
                              <span className="text-muted-foreground">Handle (NZD)</span>
                              <span className="text-right font-medium" data-testid="text-handle-cost">${currentPricing.handleCostNzd.toFixed(2)}</span>
                            </>
                          )}
                          {currentPricing.wanzBarCostNzd > 0 && (
                            <>
                              <span className="text-muted-foreground">Wanz Bar (NZD)</span>
                              <span className="text-right font-medium" data-testid="text-wanz-bar-cost">${currentPricing.wanzBarCostNzd.toFixed(2)}</span>
                            </>
                          )}
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <span className="text-muted-foreground font-semibold">Net Cost</span>
                          <span className="text-right font-bold" data-testid="text-net-cost">${currentPricing.netCostNzd.toFixed(2)}</span>
                          <span className="text-muted-foreground">Actual $/m²</span>
                          <span className="text-right font-medium" data-testid="text-actual-cost-sqm">${currentPricing.actualCostPerSqm.toFixed(0)}/m²</span>
                          <span className="text-muted-foreground font-semibold">Sale Price</span>
                          <span className="text-right font-bold text-primary" data-testid="text-sale-price">${currentPricing.salePriceNzd.toFixed(2)}</span>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <span className="text-muted-foreground">Margin</span>
                          <span className={`text-right font-bold ${currentPricing.marginNzd >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-margin">
                            ${currentPricing.marginNzd.toFixed(2)} ({currentPricing.marginPercent.toFixed(1)}%)
                          </span>
                          <span className="text-muted-foreground">Weight</span>
                          <span className="text-right font-medium" data-testid="text-weight">{currentPricing.totalWeightKg.toFixed(2)} kg</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                <div>
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Environment
                  </h2>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Wind Zone</Label>
                      <Select value={w.windZone || ""} onValueChange={(v) => form.setValue("windZone", v)}>
                        <SelectTrigger data-testid="select-wind-zone"><SelectValue placeholder="Select wind zone" /></SelectTrigger>
                        <SelectContent>
                          {WIND_ZONES.map((wz) => (
                            <SelectItem key={wz} value={wz}>{wz}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Wall Thickness (mm)</Label>
                      <Input type="number" min={0}
                        value={w.wallThickness || ""}
                        onChange={(e) => form.setValue("wallThickness", Number(e.target.value) || 0)}
                        data-testid="input-wall-thickness" />
                    </div>
                    <div>
                      <Label className="text-xs">Height from Floor (mm)</Label>
                      <Input type="number" min={0}
                        value={w.heightFromFloor || ""}
                        onChange={(e) => form.setValue("heightFromFloor", Number(e.target.value) || 0)}
                        placeholder={DOOR_CATEGORIES.includes(w.category || "") ? "Default: 30mm" : "Default: 800mm"}
                        data-testid="input-height-from-floor" />
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Liner / Reveal
                  </h2>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Liner Type</Label>
                      <Select value={w.linerType || ""} onValueChange={(v) => form.setValue("linerType", v)}>
                        <SelectTrigger data-testid="select-liner-type"><SelectValue placeholder="Select liner" /></SelectTrigger>
                        <SelectContent>
                          {libLinerOptions.map((lt) => (
                            <SelectItem key={lt.value} value={lt.value}>{lt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Glass
                  </h2>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">IGU Type</Label>
                      <Select value={w.glassIguType || ""} onValueChange={(v) => {
                        form.setValue("glassIguType", v);
                        form.setValue("glassType", "");
                        form.setValue("glassThickness", "");
                      }}>
                        <SelectTrigger data-testid="select-glass-igu"><SelectValue placeholder="Select IGU" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EnergySaver">EnergySaver™ IGU (Entry-level Low-E)</SelectItem>
                          <SelectItem value="LightBridge">LightBridge™ IGU (High Performance Low-E)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {w.glassIguType && (
                      <div>
                        <Label className="text-xs">Glass Type</Label>
                        <Select value={w.glassType || ""} onValueChange={(v) => {
                          form.setValue("glassType", v);
                          form.setValue("glassThickness", "");
                        }}>
                          <SelectTrigger data-testid="select-glass-type"><SelectValue placeholder="Select glass" /></SelectTrigger>
                          <SelectContent>
                            {libGlassCombos(w.glassIguType).map((combo) => (
                              <SelectItem key={combo} value={combo}>{combo}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {w.glassIguType && w.glassType && (
                      <div>
                        <Label className="text-xs">Glass Thickness</Label>
                        <Select value={w.glassThickness || ""} onValueChange={(v) => form.setValue("glassThickness", v)}>
                          <SelectTrigger data-testid="select-glass-thickness"><SelectValue placeholder="Select thickness" /></SelectTrigger>
                          <SelectContent>
                            {libGlassThicknesses(w.glassIguType, w.glassType).map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {w.glassIguType && w.glassType && w.glassThickness && (
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs" data-testid="badge-glass-price">
                          ${libGlassPrice(w.glassIguType, w.glassType, w.glassThickness)?.toFixed(2) ?? "—"}/m²
                        </Badge>
                        <Badge variant="outline" className="text-xs" data-testid="badge-glass-rvalue">
                          R-Value: {getGlassRValue(w.glassIguType) ?? "—"}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                <div>
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Hardware & Components
                  </h2>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Handle</Label>
                      <Select value={w.handleType || ""} onValueChange={(v) => form.setValue("handleType", v)}>
                        <SelectTrigger data-testid="select-handle"><SelectValue placeholder="Select handle" /></SelectTrigger>
                        <SelectContent>
                          {(libCategoryHandles.length > 0
                            ? libCategoryHandles.map((e) => ({ value: (e.data as any).value, label: (e.data as any).label }))
                            : libHandlesForCategoryLegacy(w.category || "windows-standard")
                          ).map((h) => (
                            <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Separator className="my-3" />

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">Wanz Bar (Sill Support)</Label>
                        <div className="flex items-center gap-2">
                          <Checkbox id="wanzBar" checked={w.wanzBar === true}
                            onCheckedChange={(v) => {
                              form.setValue("wanzBar", !!v);
                              if (v && !w.wanzBarSource) form.setValue("wanzBarSource", "nz-local");
                            }}
                            data-testid="checkbox-wanz-bar" />
                          <Label htmlFor="wanzBar" className="text-xs cursor-pointer">Enable</Label>
                        </div>
                      </div>
                      {(w.width || 0) >= 600 && WINDOW_CATEGORIES.includes(w.category || "") && !w.wanzBar && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400" data-testid="text-wanz-bar-required">
                          <AlertTriangle className="w-3 h-3 inline mr-1" />Required: width ≥ 600mm
                        </p>
                      )}
                      {w.wanzBar && (
                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs">Size</Label>
                            <Select value={w.wanzBarSize || ""} onValueChange={(v) => form.setValue("wanzBarSize", v)}>
                              <SelectTrigger data-testid="select-wanz-bar-size"><SelectValue placeholder="Select size" /></SelectTrigger>
                              <SelectContent>
                                {(libWanzBars.length > 0
                                  ? libWanzBars.map((e) => ({ value: (e.data as any).value, label: (e.data as any).label, kgPerMetre: (e.data as any).kgPerMetre }))
                                  : WANZ_BAR_DEFAULTS.map((wb) => ({ value: wb.value, label: wb.label, kgPerMetre: wb.kgPerMetre }))
                                ).map((wb) => (
                                  <SelectItem key={wb.value} value={wb.value}>{wb.label} ({wb.kgPerMetre} kg/m)</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Source</Label>
                            <Select value={w.wanzBarSource || ""} onValueChange={(v) => form.setValue("wanzBarSource", v as any)}>
                              <SelectTrigger data-testid="select-wanz-bar-source"><SelectValue placeholder="Select source" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="nz-local">NZ Local</SelectItem>
                                <SelectItem value="direct">Direct Supplier</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {w.wanzBarSize && w.wanzBarSource && (() => {
                            const wbEntry = libWanzBars.find((e) => (e.data as any).value === w.wanzBarSize);
                            const d = wbEntry ? (wbEntry.data as any) : WANZ_BAR_DEFAULTS.find((wb) => wb.value === w.wanzBarSize);
                            if (!d) return null;
                            return (
                              <div className="text-[10px] text-muted-foreground bg-muted/50 rounded p-2 space-y-0.5" data-testid="text-wanz-bar-info">
                                <div>{d.kgPerMetre} kg/m · Section: {d.sectionNumber || d.value}</div>
                                {w.wanzBarSource === "nz-local" && <div>NZ Price: {d.priceNzdPerLinM ? `$${d.priceNzdPerLinM}/lin.m` : "Not set"}</div>}
                                {w.wanzBarSource === "direct" && <div>Direct Price: {d.pricePerKgUsd ? `$${d.pricePerKgUsd} USD/kg` : "Not set"}</div>}
                                <div className="text-[9px] text-amber-600 dark:text-amber-400 mt-1">Fixings: 10g × 50mm SS, max 300mm centres</div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <Separator />

            <div className="flex gap-2">
              <Button type="submit" className="flex-1" data-testid="button-add-item">
                {editingId ? (
                  <><Pencil className="w-4 h-4 mr-2" /> Update Item</>
                ) : (
                  <><Plus className="w-4 h-4 mr-2" /> Add to Quote</>
                )}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={cancelEdit} data-testid="button-cancel-edit">
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </ScrollArea>

        <div className={`flex-1 flex ${quoteListPosition === "right" ? "flex-row" : "flex-col"} overflow-hidden`}>
          <div className="flex-1 flex items-center justify-center p-4 min-h-0"
            style={{ background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)" }}>
            <div className="w-full h-full max-w-3xl max-h-[600px]" data-testid="drawing-preview">
              <DrawingCanvas ref={drawingRef} config={drawingConfig} />
            </div>
          </div>

          {items.length > 0 && (
            <div className={`${quoteListPosition === "right"
              ? "border-l bg-card flex flex-col shrink-0 overflow-hidden w-80 xl:w-96"
              : `border-t bg-card flex flex-col shrink-0 overflow-hidden ${itemsExpanded ? "max-h-[50vh]" : "max-h-[33vh]"}`
            }`}>
              <div className="px-4 py-2 shrink-0 flex items-center justify-between">
                <h3 className="text-sm font-semibold" data-testid="text-quote-list-title">
                  Quote Items ({items.length}) — {totalSqm} m² — ${formatPrice(totalPrice)}
                </h3>
                {quoteListPosition === "bottom" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setItemsExpanded(!itemsExpanded)}
                    title={itemsExpanded ? "Collapse" : "Expand"}
                    data-testid="button-toggle-items-expand"
                  >
                    {itemsExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </Button>
                )}
              </div>
              <ScrollArea className="flex-1 min-h-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Layout</TableHead>
                      <TableHead>Dimensions</TableHead>
                      <TableHead className="text-center">m²</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-center w-12">Photo</TableHead>
                      <TableHead className="text-right w-36">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((iwp, index) => (
                      <TableRow key={iwp.item.id} data-testid={`row-item-${iwp.item.id}`}>
                        <TableCell className="text-muted-foreground text-xs">{index + 1}</TableCell>
                        <TableCell className="font-medium">{iwp.item.name}</TableCell>
                        <TableCell className="text-sm">{getCategoryLabel(iwp.item.category)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {getLayoutSummary(iwp.item)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{iwp.item.width} x {iwp.item.height}</TableCell>
                        <TableCell className="text-center font-mono text-sm" data-testid={`text-sqm-${iwp.item.id}`}>
                          {calcSqm(iwp.item.width, iwp.item.height, iwp.item.quantity)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm" data-testid={`text-price-${iwp.item.id}`}>
                          ${formatPrice(calcItemPrice(iwp.item))}
                        </TableCell>
                        <TableCell className="text-center">{iwp.item.quantity}</TableCell>
                        <TableCell className="text-center">
                          {iwp.photo ? (
                            <button
                              type="button"
                              onClick={() => setPhotoPreview(iwp.photo!)}
                              className="inline-block"
                              data-testid={`button-view-photo-${iwp.item.id}`}
                            >
                              <img src={iwp.photo} alt="Site photo" className="w-8 h-8 rounded object-cover border" />
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <Button size="icon" variant="ghost" onClick={() => {
                              const { id, ...rest } = iwp.item;
                              handleDownloadPng({ ...rest, width: rest.width || 1200, height: rest.height || 1500, quantity: rest.quantity || 1, name: rest.name || "" }, iwp.item.id);
                            }}
                              title="Download PNG" data-testid={`button-download-${iwp.item.id}`}>
                              <Download className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => {
                              setPhotoTargetItemId(iwp.item.id);
                              photoInputRef.current?.click();
                            }}
                              title="Take Photo" data-testid={`button-photo-${iwp.item.id}`}>
                              <Camera className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => editItem(iwp)}
                              title="Edit" data-testid={`button-edit-${iwp.item.id}`}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => duplicateItem(iwp)}
                              title="Duplicate" data-testid={`button-duplicate-${iwp.item.id}`}>
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => deleteItem(iwp.item.id)}
                              title="Delete" data-testid={`button-delete-${iwp.item.id}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </div>
      </div>

      {offscreenConfig && (
        <div style={{ position: "absolute", left: "-9999px", top: "-9999px", width: "1200px", height: "900px" }}>
          <DrawingCanvas ref={offscreenDrawingRef} config={offscreenConfig} />
        </div>
      )}

      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Unsaved Changes
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground" data-testid="text-unsaved-warning">
            You have unsaved changes. Would you like to save before leaving?
          </p>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowLeaveDialog(false)} data-testid="button-leave-cancel">
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => { setShowLeaveDialog(false); setHasUnsavedChanges(false); navigate("/"); }} data-testid="button-leave-discard">
              Discard
            </Button>
            <Button onClick={async () => { setShowLeaveDialog(false); await saveJob(); if (jobName.trim() && items.length > 0) navigate("/"); }} data-testid="button-leave-save">
              <Save className="w-4 h-4 mr-1.5" /> Save & Leave
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!photoPreview} onOpenChange={() => setPhotoPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Site Photo</DialogTitle>
          </DialogHeader>
          {photoPreview && (
            <img src={photoPreview} alt="Site photo" className="w-full rounded" data-testid="img-photo-preview" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
