import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertQuoteItemSchema, type InsertQuoteItem, type QuoteItem, type CustomColumn, type EntranceDoorRow, type JobItem, type FrameConfiguration, type ConfigurationProfile, type ConfigurationAccessory, type ConfigurationLabor } from "@shared/schema";
import { getGlassCombos, getAvailableThicknesses, getGlassPrice, getGlassRValue } from "@shared/glass-library";
import { FRAME_COLORS, FLASHING_SIZES, WIND_ZONES, LINER_TYPES, DOOR_CATEGORIES, WINDOW_CATEGORIES, WANZ_BAR_DEFAULTS, getFrameTypesForCategory, getHandlesForCategory, getHandleTypeForCategory, getLockTypeForCategory, getLocksForCategory, isDoorCategory } from "@shared/item-options";
import type { LibraryEntry, SpecDictionaryEntry, DivisionSettings } from "@shared/schema";
import { resolvePresetsForDivision, type JobTypePresetsConfig } from "@/lib/site-visit-presets";
import { calculatePricing, calcRakedPerimeterM, type PricingBreakdown, type ItemGeometry, type GlazingBandEntry } from "@/lib/pricing";
import { deriveConfigSignature, findMatchingConfiguration, deriveGroupedGeometryMetrics, type ConfigSignature } from "@/lib/config-signature";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import DrawingCanvas, { getFrameSize } from "@/components/drawing-canvas";
import { MediaViewer } from "@/components/media-viewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Trash2, Pencil, Copy, Ruler, LayoutGrid, ChevronDown, ChevronRight, ChevronUp, ArrowLeft, ArrowRight, Save, Download, Camera, X, ArrowLeftCircle, AlertTriangle, FileText, MoreVertical, Eye, Wrench, List, Package, Shield } from "lucide-react";
import { useSettings } from "@/lib/settings-context";
import { useNavigationGuard } from "@/lib/navigation-guard";
import { useToast } from "@/hooks/use-toast";
import { useRoute, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { downloadPng, compressImage, compressImageToBlob, svgToPngBlob, downloadBlob, sanitizeFilename } from "@/lib/export-png";
import { jsPDF } from "jspdf";

function useIsLargeScreen() {
  const [isLarge, setIsLarge] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true
  );
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsLarge(mql.matches);
    mql.addEventListener("change", onChange);
    setIsLarge(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isLarge;
}

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
  { value: "raked-fixed", label: "Raked / Triangular Fixed" },
];

function getCategoryLabel(cat: string) {
  return CATEGORY_OPTIONS.find((c) => c.value === cat)?.label || cat;
}

type OpeningDirectionValue = "open-in" | "open-out" | "sliding-left" | "sliding-right" | "fold-left" | "fold-right" | "none";

function getOpeningDirectionOptions(category: string): { value: OpeningDirectionValue; label: string }[] {
  if (["entrance-door", "hinge-door", "french-door"].includes(category)) {
    return [
      { value: "open-in", label: "Open In" },
      { value: "open-out", label: "Open Out" },
    ];
  }
  if (["sliding-window", "sliding-door"].includes(category)) {
    return [
      { value: "sliding-left", label: "Sliding Left" },
      { value: "sliding-right", label: "Sliding Right" },
    ];
  }
  if (category === "bifold-door") {
    return [
      { value: "fold-left", label: "Fold Left" },
      { value: "fold-right", label: "Fold Right" },
    ];
  }
  if (category === "stacker-door") {
    return [
      { value: "sliding-left", label: "Sliding Left" },
      { value: "sliding-right", label: "Sliding Right" },
    ];
  }
  return [];
}

function hasOpeningDirection(category: string, windowType?: string): boolean {
  if (category === "windows-standard") {
    return windowType !== "fixed";
  }
  return getOpeningDirectionOptions(category).length > 0;
}

function getOpeningDirectionOptionsForWindow(category: string, windowType?: string): { value: OpeningDirectionValue; label: string }[] {
  if (category === "windows-standard" && windowType && windowType !== "fixed") {
    return [
      { value: "open-in", label: "Open In" },
      { value: "open-out", label: "Open Out" },
    ];
  }
  return getOpeningDirectionOptions(category);
}

function getOpeningDirectionLabel(value: string): string {
  const map: Record<string, string> = {
    "open-in": "Open In",
    "open-out": "Open Out",
    "sliding-left": "Sliding Left",
    "sliding-right": "Sliding Right",
    "fold-left": "Fold Left",
    "fold-right": "Fold Right",
  };
  return map[value] || "";
}

function getDefaultOpeningDirection(category: string, windowType?: string): OpeningDirectionValue {
  if (category === "windows-standard") {
    return windowType && windowType !== "fixed" ? "open-out" : "none";
  }
  if (category === "entrance-door") return "open-in";
  if (["hinge-door", "french-door"].includes(category)) return "open-out";
  if (["sliding-window", "sliding-door", "stacker-door"].includes(category)) return "sliding-right";
  if (category === "bifold-door") return "fold-left";
  return "none";
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
  if (cat === "windows-standard") {
    const wt = config.windowType;
    if (wt === "awning") return "Awning";
    if (wt === "french-left") return "French (Left)";
    if (wt === "french-right") return "French (Right)";
    if (wt === "french-pair") return "French Pair";
    return "Fixed";
  }
  if (cat === "sliding-window" || cat === "sliding-door") return "Fixed + Sliding";
  if (cat === "entrance-door") {
    if (!config.sidelightEnabled) return "Door (No Sidelight)";
    const side = config.sidelightSide === "both" ? "Both Sidelights" : config.sidelightSide === "left" ? "Left Sidelight" : "Right Sidelight";
    return `Door + ${side}`;
  }
  if (cat === "hinge-door") return `${config.hingeSide === "left" ? "Left" : "Right"} Hinge`;
  if (cat === "french-door") return "Double Door";
  if (cat === "bifold-door") return `${config.panels} Leaves`;
  if (cat === "stacker-door") {
    const panelRows = config.panelRows || [];
    if (panelRows.length > 0) {
      let awning = 0, fixed = 0, sliding = 0;
      for (const panel of panelRows) {
        for (const row of panel) {
          if (row.type === "awning") awning++;
          else if (row.type === "sliding") sliding++;
          else fixed++;
        }
      }
      const parts: string[] = [];
      if (sliding > 0) parts.push(`${sliding} SLD`);
      if (awning > 0) parts.push(`${awning} AWN`);
      if (fixed > 0) parts.push(`${fixed} FIX`);
      return `${config.panels} Panels (${parts.join(" + ") || "FIX"})`;
    }
    return `${config.panels} Panels`;
  }
  if (cat === "bay-window") {
    const angle = (config as any).bayAngle || 135;
    const depth = (config as any).bayDepth || 0;
    return `Bay (3 Panel)${angle !== 135 ? ` · ${angle}°` : ""}${depth > 0 ? ` · ${depth}mm` : ""}`;
  }
  if (cat === "raked-fixed") {
    const lh = (config as any).rakedLeftHeight || 0;
    const rh = (config as any).rakedRightHeight || 0;
    if (lh > rh) return "Left Rake";
    if (rh > lh) return "Right Rake";
    return "Raked Fixed";
  }
  return "Standard";
}

function makeDefaultColumns(count: number): CustomColumn[] {
  return Array.from({ length: count }, () => ({
    width: 0,
    rows: [{ height: 0, type: "fixed" as const, slideDirection: "right" as const, hingeSide: "left" as const, openDirection: "out" as const }],
  }));
}

const defaultEntranceDoorRows: EntranceDoorRow[] = [{ height: 0, type: "fixed", slideDirection: "right" }];

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
  rakedLeftHeight: 0,
  rakedRightHeight: 0,
  rakedSplitEnabled: false,
  rakedSplitPosition: 0,
  layout: "standard",
  windowType: "fixed",
  hingeSide: "left",
  openDirection: "out",
  openingDirection: "none",
  halfSolid: false,
  panels: 3,
  sidelightWidth: 400,
  sidelightEnabled: true,
  sidelightSide: "right",
  doorSplit: false,
  doorSplitHeight: 0,
  bifoldLeftCount: 0,
  centerWidth: 0,
  bayAngle: 135,
  bayDepth: 0,
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
  paneGlassSpecs: [],
  wanzBar: false,
  wanzBarSource: "",
  wanzBarSize: "",
  wallThickness: 0,
  heightFromFloor: null as number | null,
  handleType: "",
  lockType: "",
  configurationId: "",
  cachedWeightKg: 0,
  overrideMode: "none",
  overrideValue: null,
  fulfilmentSource: "in-house",
  gosRequired: false,
  gosChargeNzd: null,
  catDoorEnabled: false,
  outsourcedCostNzd: null,
  outsourcedSellNzd: null,
};

interface ItemPhotoRef {
  key: string;
  isPrimary?: boolean;
  includeInCustomerPdf?: boolean;
  caption?: string;
  takenAt?: string;
}

interface ItemWithPhoto {
  uiId: string;
  item: QuoteItem;
  photo?: string | null;
  photos?: ItemPhotoRef[];
  dbId?: string;
}

function getPrimaryPhotoSrc(iwp: ItemWithPhoto): string | null {
  if (iwp.photos && iwp.photos.length > 0) {
    const primary = iwp.photos.find(p => p.isPrimary) || iwp.photos[0];
    return `/api/item-photos/${primary.key}`;
  }
  if (iwp.photo && iwp.photo.startsWith("data:image/")) {
    return iwp.photo;
  }
  return null;
}

function ensureConfigId(config: any): QuoteItem {
  return { ...config, id: config?.id ?? crypto.randomUUID() };
}

function SidelightControls({ totalWidth, sidelightSide, sidelightWidth, onSidelightSideChange, onSidelightWidthChange, onFocus }: {
  totalWidth: number;
  sidelightSide: string;
  sidelightWidth: number;
  onSidelightSideChange: (v: string) => void;
  onSidelightWidthChange: (v: number) => void;
  onFocus: () => void;
}) {
  const isBoth = sidelightSide === "both";
  const derivedDoorW = isBoth ? totalWidth - sidelightWidth * 2 : totalWidth - sidelightWidth;
  const [localDoorWidth, setLocalDoorWidth] = useState<string>(String(derivedDoorW > 0 ? derivedDoorW : totalWidth > 0 ? Math.round(totalWidth * 0.6) : 800));

  useEffect(() => {
    const dw = isBoth ? totalWidth - sidelightWidth * 2 : totalWidth - sidelightWidth;
    if (dw > 0) setLocalDoorWidth(String(dw));
  }, [totalWidth, sidelightWidth, isBoth]);

  const doorW = parseInt(localDoorWidth) || 0;
  const calcSlW = isBoth ? Math.round((totalWidth - doorW) / 2) : totalWidth - doorW;
  const minSl = isBoth ? 100 : 100;
  const isInvalid = totalWidth > 0 && (doorW <= 0 || doorW >= totalWidth || calcSlW < minSl);

  return (
    <>
      <div>
        <Label className="text-xs">Sidelight Position</Label>
        <Select value={sidelightSide} onValueChange={(v) => {
          onSidelightSideChange(v);
          const newIsBoth = v === "both";
          const curDoorW = parseInt(localDoorWidth) || 0;
          if (curDoorW > 0 && totalWidth > 0) {
            const newSlW = newIsBoth ? Math.round((totalWidth - curDoorW) / 2) : totalWidth - curDoorW;
            if (newSlW >= 100) onSidelightWidthChange(newSlW);
          }
        }}>
          <SelectTrigger data-testid="select-sidelight-side"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="right">Right</SelectItem>
            <SelectItem value="both">Both</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="entranceDoorWidth" className="text-xs">Door Width (mm)</Label>
        <Input id="entranceDoorWidth" type="number" inputMode="decimal"
          value={localDoorWidth}
          onChange={(e) => {
            const raw = e.target.value;
            setLocalDoorWidth(raw);
            const dw = parseInt(raw) || 0;
            if (dw > 0 && totalWidth > 0) {
              const newSlW = isBoth ? Math.round((totalWidth - dw) / 2) : totalWidth - dw;
              if (newSlW >= 100) {
                onSidelightWidthChange(newSlW);
              }
            }
          }}
          onFocus={onFocus}
          data-testid="input-door-width" />
        {isInvalid && (
          <p className="text-xs text-destructive mt-0.5" data-testid="text-door-width-error">
            Door width must leave at least {isBoth ? "100mm per sidelight" : "100mm for the sidelight"}
          </p>
        )}
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Sidelight Width (auto)</Label>
        <div className="flex items-center gap-2">
          <Input type="number" readOnly tabIndex={-1}
            value={isInvalid ? "—" : (isBoth ? sidelightWidth : calcSlW > 0 ? calcSlW : sidelightWidth)}
            className="bg-muted/40 text-muted-foreground"
            data-testid="input-sidelight-width-display" />
          {isBoth && <span className="text-xs text-muted-foreground whitespace-nowrap">× 2</span>}
        </div>
        {!isInvalid && (
          <p className="text-xs text-muted-foreground mt-0.5">
            = {totalWidth} total − {doorW} door{isBoth ? ` (÷ 2 = ${sidelightWidth} each)` : ""}
          </p>
        )}
      </div>
    </>
  );
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

  const [extrasOpen, setExtrasOpen] = useState(false);
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [deliveryMethodId, setDeliveryMethodId] = useState<string>("");
  const [deliveryCustom, setDeliveryCustom] = useState<string>("");
  const [deliveryMarkup, setDeliveryMarkup] = useState<string>("15");
  const [installationEnabled, setInstallationEnabled] = useState(false);
  const [removalEnabled, setRemovalEnabled] = useState(false);
  const [removalMarkup, setRemovalMarkup] = useState<string>("15");
  const [rubbishEnabled, setRubbishEnabled] = useState(false);
  const [rubbishTonnage, setRubbishTonnage] = useState<string>("");

  const [galleryItemId, setGalleryItemId] = useState<string | null>(null);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSaveAndLeaving, setIsSaveAndLeaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [pendingNavigateTo, setPendingNavigateTo] = useState<string | null>(null);
  const [itemsExpanded, setItemsExpanded] = useState(true);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const headerFieldsRef = useRef<HTMLDivElement>(null);
  const [formTab, setFormTab] = useState<string>("drawing");
  const [mobileTab, setMobileTab] = useState<"config" | "preview" | "items">("config");
  const [siteType, setSiteType] = useState<"renovation" | "new_build" | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const isLargeScreen = useIsLargeScreen();
  const { quoteListPosition, usdToNzdRate } = useSettings();
  const roomDropdownRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef<SVGSVGElement>(null);
  const offscreenDrawingRef = useRef<SVGSVGElement>(null);
  const [offscreenConfig, setOffscreenConfig] = useState<InsertQuoteItem | null>(null);
  const [downloadGenerating, setDownloadGenerating] = useState(false);
  const skipCategoryResetRef = useRef(false);
  const expectedFrameTypeRef = useRef<string>("");
  const savedItemBaselineRef = useRef<{ signature: string; configurationId: string } | null>(null);
  const hydratedJobRef = useRef(false);
  const didAutoCollapseOnFocusRef = useRef(false);
  const lastAutoWindZone = useRef<string>("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoTargetItemId, setPhotoTargetItemId] = useState<string | null>(null);
  const configScrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: existingJob, isLoading: jobLoading } = useQuery<{
    id: string; name: string; address: string | null; date: string | null; siteType?: string | null; items: JobItem[];
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
  const { data: rawGlazingBands = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "glazing_band"], queryFn: fetchLib("glazing_band") });
  const glazingBands: GlazingBandEntry[] = rawGlazingBands.map((b) => {
    const d = b.data as any;
    return { label: d.label ?? "", maxAreaSqm: parseFloat(d.maxAreaSqm) || 9999, minutesPerPane: parseFloat(d.minutesPerPane) || 10 };
  });
  const { data: deliveryRates = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", "delivery_rate"], queryFn: fetchLib("delivery_rate") });

  const persistJobField = useCallback((field: string, value: any) => {
    if (!savedJobId) return;
    apiRequest("PATCH", `/api/jobs/${savedJobId}`, { [field]: value });
  }, [savedJobId]);

  const { data: specDictionary = [] } = useQuery<SpecDictionaryEntry[]>({
    queryKey: ["/api/spec-dictionary", "LJ"],
    queryFn: async () => {
      const res = await fetch("/api/spec-dictionary?scope=LJ");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
  const { data: divisionSettings } = useQuery<DivisionSettings>({
    queryKey: ["/api/settings/divisions", "LJ"],
    queryFn: async () => {
      const res = await fetch("/api/settings/divisions/LJ");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
  const [showAllSpecs, setShowAllSpecs] = useState(false);
  const defaultSpecKeys = (divisionSettings?.specDisplayDefaultsJson as string[] | null) || [
    "configuration","overallSize","frameSeries","frameColor","windZone","rValue",
    "iguType","glassType","glassThickness","handleSet","lockSet","linerType","flashingSize",
    "wallThickness","heightFromFloor"
  ];

  const specGroups = useMemo(() => {
    const groups: Record<string, SpecDictionaryEntry[]> = {};
    const layoutKeys = new Set(["layout","windowType","hingeSide","openDirection","openingDirection","halfSolid","panels",
      "sidelightEnabled","sidelightSide","sidelightWidth","doorSplit","doorSplitHeight","bifoldLeftCount","showLegend"]);
    for (const spec of specDictionary) {
      if (layoutKeys.has(spec.key)) continue;
      if (!groups[spec.group]) groups[spec.group] = [];
      groups[spec.group].push(spec);
    }
    return groups;
  }, [specDictionary]);

  const isSpecVisible = (key: string) => showAllSpecs || defaultSpecKeys.includes(key);
  const hiddenSpecCount = specDictionary.filter(s => !defaultSpecKeys.includes(s.key) && !["layout","windowType","hingeSide","openDirection","openingDirection","halfSolid","panels","sidelightEnabled","sidelightSide","sidelightWidth","doorSplit","doorSplitHeight","bifoldLeftCount","showLegend"].includes(s.key)).length;

  const libFrameTypesForCategory = useCallback((cat: string) => {
    const fromDb = libFrameTypes.filter((e) => {
      const d = e.data as any;
      return d.categories?.includes(cat);
    }).map((e) => ({ value: (e.data as any).value, label: (e.data as any).label }));
    if (fromDb.length > 0) return fromDb;
    return getFrameTypesForCategory(cat).map((ft) => ({ value: ft.value, label: ft.label }));
  }, [libFrameTypes]);
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
    if (existingJob && !hydratedJobRef.current) {
      hydratedJobRef.current = true;
      setJobName(existingJob.name);
      setJobAddress(existingJob.address || "");
      setJobDate(existingJob.date || "");
      if (existingJob.siteType === "renovation" || existingJob.siteType === "new_build") {
        setSiteType(existingJob.siteType);
      }
      setSavedJobId(existingJob.id);
      setItems(existingJob.items.map((ji: any) => ({
        uiId: ji.id || crypto.randomUUID(),
        item: ensureConfigId(ji.config as QuoteItem),
        photo: ji.photo,
        photos: ji.photos || [],
        dbId: ji.id,
      })));
      const ej = existingJob as any;
      const initDelivery = ej.deliveryEnabled === true ? true : ej.deliveryEnabled === false ? false : !!(ej.deliveryMethod || (ej.deliveryAmount != null && ej.deliveryAmount > 0));
      setDeliveryEnabled(initDelivery);
      setDeliveryMethodId(ej.deliveryMethod || "");
      setDeliveryCustom(ej.deliveryAmount != null ? String(ej.deliveryAmount) : "");
      setDeliveryMarkup(ej.deliveryMarkup != null ? String(ej.deliveryMarkup) : "15");
      setInstallationEnabled(!!ej.installationEnabled);
      setRemovalEnabled(!!ej.removalEnabled);
      setRemovalMarkup(ej.removalMarkup != null ? String(ej.removalMarkup) : "15");
      setRubbishEnabled(!!ej.rubbishEnabled);
      setRubbishTonnage(ej.rubbishTonnage != null ? String(ej.rubbishTonnage) : "");
      setClientName(ej.clientName || "");
      setClientEmail(ej.clientEmail || "");
      setClientPhone(ej.clientPhone || "");
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

  const divisionPresets = useMemo(() => {
    return resolvePresetsForDivision("LJ", divisionSettings?.jobTypePresetsJson as JobTypePresetsConfig | null);
  }, [divisionSettings?.jobTypePresetsJson]);

  const getPresetDefaults = useCallback((preset: "renovation" | "new_build" | null, cat?: string): Partial<InsertQuoteItem> => {
    if (!preset) return {};
    const presetConfig = preset === "renovation" ? divisionPresets.renovation : divisionPresets.new_build;
    if (!presetConfig) return {};

    const result: Partial<InsertQuoteItem> = {};
    const effectiveCat = cat || "windows-standard";

    if (presetConfig.frameType) {
      const frameTypes = libFrameTypesForCategory(effectiveCat);
      const match = frameTypes.find(ft => ft.value.startsWith(presetConfig.frameType!))?.value || frameTypes[0]?.value || "";
      result.frameType = match;
    }

    if (presetConfig.glassIguType) {
      result.glassIguType = presetConfig.glassIguType;
      const combos = libGlassCombos(presetConfig.glassIguType);
      if (presetConfig.glassType) {
        const match = combos.find(c => c.toLowerCase().includes(presetConfig.glassType!.toLowerCase())) || combos[0] || "";
        result.glassType = match;
      } else {
        result.glassType = combos[0] || "";
      }
      const thicknesses = result.glassType ? libGlassThicknesses(presetConfig.glassIguType, result.glassType) : [];
      result.glassThickness = presetConfig.glassThickness || thicknesses[0] || "";
    }

    if (presetConfig.linerType) {
      result.linerType = libLinerOptions.find(lt => lt.value.includes(presetConfig.linerType!))?.value || libLinerOptions[0]?.value || LINER_TYPES[0]?.value || "";
    }

    if (presetConfig.handleType) {
      const handles = DOOR_CATEGORIES.includes(effectiveCat) ? libDoorHandles : libWindowHandles;
      const match = handles.find(h => ((h.data as any).value || "").includes(presetConfig.handleType!));
      result.handleType = match ? (match.data as any).value : (handles.length > 0 ? (handles[0].data as any).value : getHandlesForCategory(effectiveCat)[0]?.value || "");
    }

    if (presetConfig.lockType && isDoorCategory(effectiveCat)) {
      result.lockType = presetConfig.lockType;
    }

    if (presetConfig.wallThickness !== undefined) {
      result.wallThickness = presetConfig.wallThickness;
    }

    if (presetConfig.windZone) {
      result.windZone = presetConfig.windZone;
    }

    return result;
  }, [divisionPresets, libFrameTypes, libGlass, libLiners, libWindowHandles, libDoorHandles]);

  const getNewItemDefaults = useCallback((preset: "renovation" | "new_build" | null): InsertQuoteItem => {
    const presetOverrides = getPresetDefaults(preset);
    return { ...defaultValues, ...presetOverrides };
  }, [getPresetDefaults]);

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
  const currentLockType = getLockTypeForCategory(category || "windows-standard");
  const { data: libCategoryLocks = [] } = useQuery<LibraryEntry[]>({ queryKey: ["/api/library", currentLockType || "__none__"], queryFn: fetchLib(currentLockType || "__none__"), enabled: !!currentLockType });

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
  const { data: configProfiles = [], isFetching: profilesFetching } = useQuery<ConfigurationProfile[]>({
    queryKey: ["/api/configurations", currentConfigId, "profiles"],
    queryFn: async () => {
      if (!currentConfigId) return [];
      const res = await fetch(`/api/configurations/${currentConfigId}/profiles`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!currentConfigId,
  });
  const { data: configAccessories = [], isFetching: accessoriesFetching } = useQuery<ConfigurationAccessory[]>({
    queryKey: ["/api/configurations", currentConfigId, "accessories"],
    queryFn: async () => {
      if (!currentConfigId) return [];
      const res = await fetch(`/api/configurations/${currentConfigId}/accessories`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!currentConfigId,
  });
  const { data: configLabor = [], isFetching: laborFetching } = useQuery<ConfigurationLabor[]>({
    queryKey: ["/api/configurations", currentConfigId, "labor"],
    queryFn: async () => {
      if (!currentConfigId) return [];
      const res = await fetch(`/api/configurations/${currentConfigId}/labor`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!currentConfigId,
  });
  const configDataTransitioning = profilesFetching || accessoriesFetching || laborFetching;

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

  const lockPriceEach = (() => {
    if (!w.lockType) return null;
    const specialNoPriceValues = ["Customer-Supplied", "TBC"];
    if (specialNoPriceValues.includes(w.lockType)) return 0;
    if (libCategoryLocks.length > 0) {
      const catEntry = libCategoryLocks.find((e) => (e.data as any).value === w.lockType);
      const catPrice = catEntry ? (catEntry.data as any).priceProvision : null;
      if (catPrice != null) return catPrice;
    }
    const fallbackLocks = getLocksForCategory(w.category || "");
    const fallback = fallbackLocks.find((l) => l.value === w.lockType);
    return fallback?.priceProvision ?? null;
  })();

  const openingPanelCount = configSignature.awningCount + configSignature.hingeCount + configSignature.slidingCount;

  const effectivePaneCount = useMemo(() => {
    const derived = Math.max(1,
      configSignature.awningCount + configSignature.fixedCount +
      configSignature.hingeCount + configSignature.slidingCount
    );
    if (w.layout === "custom" && w.customColumns && w.customColumns.length > 0) {
      const gm = deriveGroupedGeometryMetrics(w.width || 0, w.height || 0, w.customColumns);
      return gm.paneCount;
    }
    return derived;
  }, [configSignature.awningCount, configSignature.fixedCount, configSignature.hingeCount, configSignature.slidingCount, w.layout, w.customColumns, w.width, w.height]);

  const showPaneGlassSelectors = w.heightFromFloor != null && w.heightFromFloor < 800 && effectivePaneCount > 1;

  useEffect(() => {
    const specs = w.paneGlassSpecs || [];
    if (specs.length === 0) return;
    if (!showPaneGlassSelectors) {
      form.setValue("paneGlassSpecs", [], { shouldDirty: true });
      return;
    }
    const pruned = specs.filter((s: { paneIndex: number }) => s.paneIndex < effectivePaneCount);
    if (pruned.length !== specs.length) {
      form.setValue("paneGlassSpecs", pruned, { shouldDirty: true });
    }
  }, [showPaneGlassSelectors, effectivePaneCount]);

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

  const hasConfigData = currentConfigId && !configDataTransitioning && (configProfiles.length > 0 || configAccessories.length > 0 || configLabor.length > 0);
  const currentPricing: PricingBreakdown | null = useMemo(() => {
    if (!hasConfigData) return null;
    const oMode = w.overrideMode || "none";
    const oVal = w.overrideValue ?? null;
    const sqmForPricing = w.category === "raked-fixed"
      ? calcRakedAreaSqm(w as any)
      : ((w.width || 0) * (w.height || 0) * (w.quantity || 1)) / 1_000_000;
    const salePriceOverride = oMode === "total_sell" && oVal ? oVal
      : oMode === "per_sqm" && oVal ? oVal * sqmForPricing
      : null;
    const derivedPaneCount = Math.max(1,
      configSignature.awningCount + configSignature.fixedCount +
      configSignature.hingeCount + configSignature.slidingCount
    );
    const isCustomLayout = w.layout === "custom" && w.customColumns && w.customColumns.length > 0;
    const geoMetrics = isCustomLayout
      ? deriveGroupedGeometryMetrics(w.width || 0, w.height || 0, w.customColumns!)
      : null;
    const effectivePaneCountForGeo = geoMetrics ? geoMetrics.paneCount : derivedPaneCount;
    const nonCustomPerPaneDims = !geoMetrics && effectivePaneCountForGeo > 0
      ? Array.from({ length: effectivePaneCountForGeo }, () => ({
          widthMm: (w.width || 0) / effectivePaneCountForGeo,
          heightMm: w.height || 0,
        }))
      : undefined;
    const itemGeometry: ItemGeometry = {
      mullionCount: configSignature.mullionCount,
      transomCount: configSignature.transomCount,
      paneCount: effectivePaneCountForGeo,
      widthMm: w.width || 0,
      heightMm: w.height || 0,
      mullionTotalLengthMm: geoMetrics?.mullionTotalLengthMm,
      transomTotalLengthMm: geoMetrics?.transomTotalLengthMm,
      cutCycleCount: geoMetrics?.cutCycleCount,
      jointEndCount: geoMetrics?.jointEndCount,
      gluePointCount: geoMetrics?.gluePointCount,
      perPaneDimensions: geoMetrics?.perPaneDimensions ?? nonCustomPerPaneDims,
      totalGlassAreaSqm: geoMetrics?.totalGlassAreaSqm,
    };
    const paneGlassPricing = (w.paneGlassSpecs || []).map((ps) => ({
      paneIndex: ps.paneIndex,
      pricePerSqm: ps.iguType && ps.glassType && ps.glassThickness
        ? libGlassPrice(ps.iguType, ps.glassType, ps.glassThickness)
        : null as number | null,
    })).filter((pg): pg is { paneIndex: number; pricePerSqm: number } => pg.pricePerSqm != null);

    return calculatePricing(
      w.width || 0, w.height || 0, w.quantity || 1,
      configProfiles, configAccessories, configLabor,
      usdToNzdRate, w.pricePerSqm || 500,
      { glassPricePerSqm, paneGlassPricing: paneGlassPricing.length > 0 ? paneGlassPricing : undefined, linerPricePerM, handlePriceEach, lockPriceEach, openingPanelCount: Math.max(1, openingPanelCount), wanzBar: wanzBarPricingInput, salePriceOverride: salePriceOverride ?? undefined, sqmOverride: w.category === "raked-fixed" ? (((w as any).rakedLeftHeight || w.height || 0) + ((w as any).rakedRightHeight || w.height || 0)) / 2 * (w.width || 0) / 1_000_000 : undefined, perimeterOverrideM: w.category === "raked-fixed" ? calcRakedPerimeterM(w.width || 0, (w as any).rakedLeftHeight || w.height || 0, (w as any).rakedRightHeight || w.height || 0) : undefined, gosChargeNzd: w.gosRequired ? (w.gosChargeNzd ?? undefined) : undefined },
      { masterProfiles, masterAccessories, masterLabour },
      itemGeometry,
      glazingBands
    );
  }, [hasConfigData, w.width, w.height, w.quantity, w.layout, w.customColumns, configProfiles, configAccessories, configLabor, usdToNzdRate, w.pricePerSqm, w.overrideMode, w.overrideValue, glassPricePerSqm, linerPricePerM, handlePriceEach, lockPriceEach, openingPanelCount, wanzBarPricingInput, masterProfiles, masterAccessories, masterLabour, glazingBands, configSignature.mullionCount, configSignature.transomCount, configSignature.awningCount, configSignature.fixedCount, configSignature.hingeCount, configSignature.slidingCount, w.paneGlassSpecs]);

  useEffect(() => {
    if (formIsDirty) setHasUnsavedChanges(true);
  }, [formIsDirty]);

  useEffect(() => {
    if (items.length > 0 && !savedJobId) setHasUnsavedChanges(true);
  }, [items.length, savedJobId]);

  const prevItemCountRef = useRef(items.length);
  useEffect(() => {
    const prev = prevItemCountRef.current;
    prevItemCountRef.current = items.length;
    if (prev === 0 && items.length > 0 && !isLargeScreen && !headerCollapsed) {
      const focusInHeader = headerFieldsRef.current?.contains(document.activeElement);
      if (!focusInHeader) {
        setHeaderCollapsed(true);
      }
    }
  }, [items.length, isLargeScreen]);

  const guardedNavigate = useCallback((to: string) => {
    if (hasUnsavedChanges || formIsDirty) {
      setPendingNavigateTo(to);
      setShowLeaveDialog(true);
    } else {
      navigate(to);
    }
  }, [hasUnsavedChanges, formIsDirty, navigate]);

  const { registerGuard, unregisterGuard } = useNavigationGuard();
  useEffect(() => {
    registerGuard(() => {
      if (hasUnsavedChanges || formIsDirty) {
        return "You have unsaved changes in the quote builder. Leave without saving?";
      }
      return false;
    });
    return () => unregisterGuard();
  }, [hasUnsavedChanges, formIsDirty, registerGuard, unregisterGuard]);

  const handleConfigFieldFocus = useCallback(() => {
    if (!isLargeScreen && !headerCollapsed && !didAutoCollapseOnFocusRef.current) {
      didAutoCollapseOnFocusRef.current = true;
      setHeaderCollapsed(true);
    }
  }, [isLargeScreen, headerCollapsed]);

  useEffect(() => {
    if (skipCategoryResetRef.current) {
      skipCategoryResetRef.current = false;
      return;
    }
    form.setValue("layout", "standard");
    form.setValue("windowType", "fixed");
    form.setValue("hingeSide", "left");
    form.setValue("openDirection", category === "entrance-door" ? "in" : "out");
    form.setValue("openingDirection", getDefaultOpeningDirection(category));
    form.setValue("halfSolid", false);
    form.setValue("sidelightWidth", 400);
    form.setValue("sidelightEnabled", true);
    form.setValue("sidelightSide", "right");
    form.setValue("doorSplit", false);
    form.setValue("doorSplitHeight", 0);
    form.setValue("centerWidth", 0);
    form.setValue("bayAngle", 135);
    form.setValue("bayDepth", 0);
    form.setValue("entranceDoorRows", [...defaultEntranceDoorRows]);
    form.setValue("entranceSidelightRows", [...defaultEntranceDoorRows]);
    form.setValue("entranceSidelightLeftRows", [...defaultEntranceDoorRows]);
    form.setValue("hingeDoorRows", [...defaultEntranceDoorRows]);
    form.setValue("frenchDoorLeftRows", [...defaultEntranceDoorRows]);
    form.setValue("frenchDoorRightRows", [...defaultEntranceDoorRows]);
    form.setValue("panelRows", []);
    form.setValue("customColumns", makeDefaultColumns(2));
    if (category === "raked-fixed") {
      form.setValue("rakedLeftHeight", 1500);
      form.setValue("rakedRightHeight", 1000);
      form.setValue("rakedSplitEnabled", false);
      form.setValue("rakedSplitPosition", 0);
      form.setValue("height", 1500);
      form.setValue("pricePerSqm", 650);
    } else {
      form.setValue("rakedLeftHeight", 0);
      form.setValue("rakedRightHeight", 0);
      form.setValue("rakedSplitEnabled", false);
      form.setValue("rakedSplitPosition", 0);
    }
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
    form.setValue("lockType", "");
    form.setValue("configurationId", "");
  }, [category]);

  const prevWindowTypeRef = useRef(w.windowType);
  useEffect(() => {
    if (skipCategoryResetRef.current) return;
    if (prevWindowTypeRef.current === w.windowType) return;
    prevWindowTypeRef.current = w.windowType;
    if (category === "windows-standard") {
      form.setValue("openingDirection", getDefaultOpeningDirection("windows-standard", w.windowType));
    }
  }, [w.windowType, category]);

  useEffect(() => {
    if (!w.openingDirection || w.openingDirection === "none") return;
    if (w.openingDirection === "open-in" && w.openDirection !== "in") {
      form.setValue("openDirection", "in");
    } else if (w.openingDirection === "open-out" && w.openDirection !== "out") {
      form.setValue("openDirection", "out");
    }
  }, [w.openingDirection]);

  useEffect(() => {
    // When library data arrives, re-validate the current frameType against
    // the (now DB-backed) options for the current category. This handles the
    // race where the category useEffect ran with the static fallback before
    // the server responded, leaving a value that's no longer in the option list.
    const currentCategory = form.getValues("category") || "windows-standard";
    const currentFrameType = form.getValues("frameType");
    const opts = libFrameTypesForCategory(currentCategory);
    const stillValid = currentFrameType && opts.some((o) => o.value === currentFrameType);
    if (!stillValid && opts.length > 0) {
      form.setValue("frameType", opts[0].value);
    }
  }, [libFrameTypes]);

  useEffect(() => {
    const ft = w.frameType || "";
    if (!ft) return;
    const currentWindZone = form.getValues("windZone");
    const isAutoSettable = !currentWindZone || currentWindZone === lastAutoWindZone.current;
    if (ft.startsWith("ES52") && isAutoSettable) {
      form.setValue("windZone", "Extra High");
      lastAutoWindZone.current = "Extra High";
    } else if (!ft.startsWith("ES52") && currentWindZone === lastAutoWindZone.current && lastAutoWindZone.current) {
      form.setValue("windZone", "");
      lastAutoWindZone.current = "";
    }
  }, [w.frameType]);

  useEffect(() => {
    if (!editingId || !expectedFrameTypeRef.current) return;
    if (!w.frameType) {
      form.setValue("frameType", expectedFrameTypeRef.current);
    }
  }, [w.frameType, editingId]);

  useEffect(() => {
    if (configurations.length === 0) return;
    const baseline = savedItemBaselineRef.current;
    if (
      baseline &&
      baseline.configurationId &&
      configSignature.signature === baseline.signature &&
      configurations.some((c) => c.id === baseline.configurationId)
    ) {
      if (w.configurationId !== baseline.configurationId) {
        form.setValue("configurationId", baseline.configurationId);
      }
      return;
    }
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
  const isRaked = category === "raked-fixed";
  const noCustomCategories = isEntrance || isHingeDoor || isFrench || isBifold || isStacker || isRaked;
  const isCustom = layout === "custom" && !noCustomCategories;
  const isSlidingCategory = ["sliding-window", "sliding-door"].includes(category);
  const isFrenchDoorCategory = ["french-door"].includes(category);

  const showWindowType = !isCustom && category === "windows-standard";
  const showHingeSide = ["entrance-door", "hinge-door"].includes(category);
  const showSidelightControls = isEntrance && w.sidelightEnabled;

  const prevWidthForSidelight = useRef(w.width);
  const prevEditingIdForSidelight = useRef(editingId);
  useEffect(() => {
    if (editingId !== prevEditingIdForSidelight.current) {
      prevWidthForSidelight.current = w.width;
      prevEditingIdForSidelight.current = editingId;
      return;
    }
    if (!isEntrance || !w.sidelightEnabled) {
      prevWidthForSidelight.current = w.width;
      return;
    }
    const prevW = prevWidthForSidelight.current;
    const newW = w.width;
    if (prevW && newW && prevW !== newW && newW > 0) {
      const slW = w.sidelightWidth || 400;
      const isBothSl = w.sidelightSide === "both";
      const oldDoorW = isBothSl ? prevW - slW * 2 : prevW - slW;
      if (oldDoorW > 0) {
        const newSlW = isBothSl ? Math.round((newW - oldDoorW) / 2) : newW - oldDoorW;
        if (newSlW >= 100) {
          form.setValue("sidelightWidth", newSlW);
        }
      }
    }
    prevWidthForSidelight.current = newW;
  }, [w.width, isEntrance, w.sidelightEnabled, editingId]);

  const showPanels = ["bifold-door", "stacker-door"].includes(category);
  const showBifoldSplit = category === "bifold-door";
  const showCenterWidth = !isCustom && category === "bay-window";
  const showOpenDirection = !isCustom && !["windows-standard", "sliding-window", "sliding-door", "stacker-door"].includes(category) && !hasOpeningDirection(category, w.windowType);
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

  function setColumnHeightOverride(colIdx: number, heightOverride: number) {
    const cols = [...(w.customColumns || [])];
    cols[colIdx] = { ...cols[colIdx], heightOverride };
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
    } else if (isFrenchDoorCategory) {
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
      return { height: 0, type: "fixed" as const, slideDirection: "right" as const };
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
    const defaultType = isStacker ? "sliding" as const : "fixed" as const;
    const next: EntranceDoorRow[][] = Array.from({ length: count }, (_, i) => {
      if (i < current.length) return current[i];
      return [{ height: 0, type: defaultType, slideDirection: "right" as const }];
    });
    form.setValue("panelRows", next);
  }

  const DEFAULT_PANEL_ROW: EntranceDoorRow = { height: 0, type: isStacker ? "sliding" : "fixed", slideDirection: "right" };

  function setPanelRowCount(panelIdx: number, count: number) {
    const current = [...(w.panelRows || [])];
    while (current.length <= panelIdx) current.push([{ ...DEFAULT_PANEL_ROW }]);
    const panelCurrent = current[panelIdx] || [{ ...DEFAULT_PANEL_ROW }];
    const next: EntranceDoorRow[] = Array.from({ length: count }, (_, i) => {
      if (i < panelCurrent.length) return panelCurrent[i];
      return { ...DEFAULT_PANEL_ROW };
    });
    current[panelIdx] = next;
    form.setValue("panelRows", current);
  }

  function setPanelRowHeight(panelIdx: number, rowIdx: number, height: number) {
    const current = [...(w.panelRows || [])];
    while (current.length <= panelIdx) current.push([{ ...DEFAULT_PANEL_ROW }]);
    const rows = [...(current[panelIdx] || [{ ...DEFAULT_PANEL_ROW }])];
    rows[rowIdx] = { ...rows[rowIdx], height };
    current[panelIdx] = rows;
    form.setValue("panelRows", current);
  }

  function togglePanelRowType(panelIdx: number, rowIdx: number) {
    const current = [...(w.panelRows || [])];
    while (current.length <= panelIdx) current.push([{ ...DEFAULT_PANEL_ROW }]);
    const rows = [...(current[panelIdx] || [{ ...DEFAULT_PANEL_ROW }])];
    const cur = rows[rowIdx].type || "fixed";
    let next: "fixed" | "sliding" | "awning";
    if (isStacker) {
      const cycle: Record<string, "fixed" | "sliding" | "awning"> = { fixed: "sliding", sliding: "awning", awning: "fixed" };
      next = cycle[cur] ?? "fixed";
    } else {
      next = cur === "awning" ? "fixed" : "awning";
    }
    rows[rowIdx] = { ...rows[rowIdx], type: next };
    current[panelIdx] = rows;
    form.setValue("panelRows", current);
  }

  function setPanelRowSlideDirection(panelIdx: number, rowIdx: number, dir: "left" | "right") {
    const current = [...(w.panelRows || [])];
    while (current.length <= panelIdx) current.push([{ ...DEFAULT_PANEL_ROW }]);
    const rows = [...(current[panelIdx] || [{ ...DEFAULT_PANEL_ROW }])];
    rows[rowIdx] = { ...rows[rowIdx], slideDirection: dir };
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

  function resolveMasterProfile(role: string): { mouldNumber: string; kgPerMetre: string; pricePerKgUsd: string; lengthFormula: string } | null {
    const frameTypeEntry = libFrameTypes.find((e) => e.id === currentFrameTypeLibId);
    const frameTypeLabel = frameTypeEntry ? (frameTypeEntry.data as any).label : "";
    if (!frameTypeLabel || masterProfiles.length === 0) return null;

    const candidates = masterProfiles.filter((mp) => {
      const d = mp.data as any;
      if (d.role !== role) return false;
      const fg = d.familyGroup;
      if (Array.isArray(fg)) return fg.includes(frameTypeLabel);
      return fg === frameTypeLabel;
    });
    if (candidates.length === 0) return null;

    const best = candidates[0];
    const d = best.data as any;
    return {
      mouldNumber: d.mouldNumber || "2020250",
      kgPerMetre: String(d.kgPerMetre || "0.78"),
      pricePerKgUsd: String(d.pricePerKgUsd || "5.60"),
      lengthFormula: d.lengthFormula || (role === "mullion" ? "height" : role === "transom" ? "width" : "perimeter"),
    };
  }

  async function autoGenerateConfiguration(sig: ConfigSignature): Promise<string | null> {
    if (!currentFrameTypeLibId || configurations.length === 0) return null;
    if (findMatchingConfiguration(sig, configurations)) return null;
    const baseConfig = configurations[0];
    try {
      const [baseProfiles, baseAccessories, baseLabor] = await Promise.all([
        fetch(`/api/configurations/${baseConfig.id}/profiles`).then((r) => r.ok ? r.json() : []),
        fetch(`/api/configurations/${baseConfig.id}/accessories`).then((r) => r.ok ? r.json() : []),
        fetch(`/api/configurations/${baseConfig.id}/labor`).then((r) => r.ok ? r.json() : []),
      ]);

      const geoDesc = sig.geometryClass !== "uniform"
        ? ` (unequal heights: ${sig.geometryClass.replace("h:", "")})`
        : "";
      const newConfigRes = await apiRequest("POST", `/api/frame-types/${currentFrameTypeLibId}/configurations`, {
        frameTypeId: currentFrameTypeLibId,
        name: sig.label,
        description: `Auto-generated: ${sig.label}${geoDesc}`,
        defaultSalePricePerSqm: baseConfig.defaultSalePricePerSqm || 550,
        sortOrder: configurations.length,
      });
      const newConfig = await newConfigRes.json();

      const openingPanels = Math.max(0, sig.awningCount + sig.hingeCount + sig.slidingCount);
      const neededRoles: { role: string; qty: number; defaultFormula: string }[] = [
        { role: "outer-frame", qty: 1, defaultFormula: "perimeter" },
      ];
      if (openingPanels > 0) {
        neededRoles.push({ role: "sash-frame", qty: openingPanels, defaultFormula: "perimeter" });
      }
      if (sig.mullionCount > 0) {
        neededRoles.push({ role: "mullion", qty: sig.mullionCount, defaultFormula: "height" });
      }
      if (sig.transomCount > 0) {
        neededRoles.push({ role: "transom", qty: sig.transomCount, defaultFormula: "width" });
      }

      const profilePosts: Promise<any>[] = [];
      const coveredRoles = new Set<string>();
      for (let i = 0; i < neededRoles.length; i++) {
        const nr = neededRoles[i];
        coveredRoles.add(nr.role);
        const master = resolveMasterProfile(nr.role);
        const baseMatch = baseProfiles.find((p: any) => p.role === nr.role);
        profilePosts.push(apiRequest("POST", `/api/configurations/${newConfig.id}/profiles`, {
          configurationId: newConfig.id,
          mouldNumber: master?.mouldNumber ?? baseMatch?.mouldNumber ?? "2020250",
          role: nr.role,
          kgPerMetre: master?.kgPerMetre ?? baseMatch?.kgPerMetre ?? "0.78",
          pricePerKgUsd: master?.pricePerKgUsd ?? baseMatch?.pricePerKgUsd ?? "5.60",
          quantityPerSet: nr.qty,
          lengthFormula: master?.lengthFormula ?? baseMatch?.lengthFormula ?? nr.defaultFormula,
          sortOrder: i,
        }));
      }

      const structuralRoles = new Set(["outer-frame", "sash-frame", "mullion", "transom"]);
      const subsidiaryRoles = new Set<string>();
      for (const p of baseProfiles) {
        if (!coveredRoles.has(p.role) && !structuralRoles.has(p.role) && !subsidiaryRoles.has(p.role)) {
          subsidiaryRoles.add(p.role);
          profilePosts.push(apiRequest("POST", `/api/configurations/${newConfig.id}/profiles`, {
            configurationId: newConfig.id,
            mouldNumber: p.mouldNumber, role: p.role,
            kgPerMetre: p.kgPerMetre, pricePerKgUsd: p.pricePerKgUsd,
            quantityPerSet: p.quantityPerSet || 1,
            lengthFormula: p.lengthFormula,
            sortOrder: 50 + subsidiaryRoles.size,
          }));
        }
      }

      const inactiveLabourNames = new Set<string>();
      for (const ml of masterLabour) {
        const d = ml.data as any;
        if (d.name && d.isActive === false) inactiveLabourNames.add(d.name);
      }

      await Promise.all([
        ...profilePosts,
        ...baseAccessories.map((a: any) => apiRequest("POST", `/api/configurations/${newConfig.id}/accessories`, {
          configurationId: newConfig.id, name: a.name, code: a.code, colour: a.colour,
          priceUsd: a.priceUsd, quantityPerSet: a.quantityPerSet, scalingType: a.scalingType, sortOrder: a.sortOrder,
        })),
        ...baseLabor
          .filter((l: any) => !inactiveLabourNames.has(l.taskName))
          .map((l: any) => apiRequest("POST", `/api/configurations/${newConfig.id}/labor`, {
            configurationId: newConfig.id, taskName: l.taskName, costNzd: l.costNzd, sortOrder: l.sortOrder,
          })),
      ]);

      queryClient.invalidateQueries({ queryKey: ["/api/frame-types", currentFrameTypeLibId, "configurations"] });
      toast({ title: "Configuration created", description: `"${sig.label}" auto-generated and added to library.` });
      return newConfig.id;
    } catch {
      return null;
    }
  }

  const immediateAutoSaveRef = useRef(false);
  const saveInProgressRef = useRef(false);

  async function onSubmit(data: InsertQuoteItem) {
    const wasNewJob = !savedJobId;
    const sig = deriveConfigSignature(data as QuoteItem);
    const matchingConfig = findMatchingConfiguration(sig, configurations);
    const cachedWeightKg = currentPricing?.totalWeightKg ?? 0;
    const itemWithWeight = structuredClone({ ...data, cachedWeightKg });

    // ── Optimistic update: add/update item in state immediately so the UI responds
    //    at once. All network work (job creation, config generation) runs in the
    //    background and does not block this path.
    let targetItemId: string;
    const capturedEditingId = editingId;
    if (capturedEditingId) {
      const existing = items.find((i) => i.uiId === capturedEditingId);
      targetItemId = existing?.item.id || crypto.randomUUID();
      setItems((prev) => prev.map((iwp) => {
        if (iwp.uiId !== capturedEditingId) return iwp;
        return { ...iwp, item: ensureConfigId({ ...itemWithWeight, id: iwp.item.id }) };
      }));
      setEditingId(null);
      toast({ title: "Item updated", description: `${data.name} has been updated.` });
    } else {
      targetItemId = crypto.randomUUID();
      const targetUiId = crypto.randomUUID();
      const newItem: QuoteItem = { ...itemWithWeight, id: targetItemId };
      setItems((prev) => [...prev, { uiId: targetUiId, item: newItem }]);
      toast({ title: "Item added", description: `${data.name} added to quote.` });
    }

    savedItemBaselineRef.current = null;
    form.reset(getNewItemDefaults(siteType));
    lastAutoWindZone.current = getPresetDefaults(siteType).windZone || "";

    // For a brand-new job, kick off job creation in the background.
    // The auto-save effect watches savedJobId; once it is set the 0-ms save fires.
    if (wasNewJob && !capturedEditingId) {
      immediateAutoSaveRef.current = true;
      ensureJobExists().catch(() => {});
    }
    setHasUnsavedChanges(true);

    // If no matching config exists, auto-generate one in the background and
    // patch the item's configurationId + pricePerSqm once it is ready.
    if (!matchingConfig && configurations.length > 0 && currentFrameTypeLibId) {
      autoGenerateConfiguration(sig).then((newConfigId) => {
        if (!newConfigId) return;
        const baseConfig = configurations[0];
        const newPricePerSqm = baseConfig?.defaultSalePricePerSqm || data.pricePerSqm || 500;
        setItems((prev) => prev.map((iwp) => {
          if (iwp.item.id !== targetItemId) return iwp;
          return { ...iwp, item: { ...iwp.item, configurationId: newConfigId, pricePerSqm: newPricePerSqm } };
        }));
        setHasUnsavedChanges(true);
      });
    }
  }

  function scrollConfigToTop() {
    requestAnimationFrame(() => {
      const viewport = configScrollRef.current?.querySelector("[data-radix-scroll-area-viewport]");
      if (viewport) viewport.scrollTop = 0;
    });
  }

  function editItem(iwp: ItemWithPhoto) {
    const { id, ...rest } = structuredClone(iwp.item);
    const itemForForm = { ...rest };

    // Guard: if the saved frameType is blank or, once real DB options have loaded,
    // the value isn't valid for the item's category (stale / category mismatch),
    // fall back to the first valid option so the Select never renders blank.
    // We skip the validity check when libFrameTypes hasn't loaded yet to avoid
    // overwriting a value like "ES127-SlidingDoor" (valid in DB) with the static
    // fallback "ES127-StackerDoor" before the library arrives.
    const savedCat = (itemForForm.category as string) || "windows-standard";
    const availOpts = libFrameTypesForCategory(savedCat);
    const dbLoaded = libFrameTypes.length > 0;
    const frameTypeBlank = !itemForForm.frameType;
    const frameTypeMismatch = dbLoaded && !availOpts.some((o) => o.value === itemForForm.frameType);
    if ((frameTypeBlank || frameTypeMismatch) && availOpts.length > 0) {
      itemForForm.frameType = availOpts[0].value;
    }

    skipCategoryResetRef.current = true;
    expectedFrameTypeRef.current = (itemForForm.frameType as string) || "";
    lastAutoWindZone.current = "";
    const baselineSig = deriveConfigSignature(itemForForm as QuoteItem);
    savedItemBaselineRef.current = {
      signature: baselineSig.signature,
      configurationId: iwp.item.configurationId || "",
    };
    form.reset(itemForForm);
    setEditingId(iwp.uiId);
    if (!isLargeScreen) {
      setMobileTab("config");
      scrollConfigToTop();
    }
  }

  function duplicateItem(iwp: ItemWithPhoto) {
    const cloned = structuredClone(iwp.item);
    cloned.id = crypto.randomUUID();
    cloned.name = `${iwp.item.name} (copy)`;
    setItems([...items, { uiId: crypto.randomUUID(), item: cloned }]);
    setHasUnsavedChanges(true);
    toast({ title: "Item duplicated" });
  }

  function deleteItem(id: string) {
    setItems(items.filter((iwp) => iwp.uiId !== id));
    if (editingId === id) { setEditingId(null); savedItemBaselineRef.current = null; form.reset(getNewItemDefaults(siteType)); lastAutoWindZone.current = getPresetDefaults(siteType).windZone || ""; }
    setHasUnsavedChanges(true);
    toast({ title: "Item removed" });
  }

  function resetFormForNewItem() {
    setEditingId(null);
    savedItemBaselineRef.current = null;
    form.reset(getNewItemDefaults(siteType));
    lastAutoWindZone.current = getPresetDefaults(siteType).windZone || "";
  }

  function cancelEdit() {
    resetFormForNewItem();
  }

  function startNewItem() {
    resetFormForNewItem();
    if (!isLargeScreen) {
      setMobileTab("config");
      scrollConfigToTop();
    }
  }

  function handleSiteTypeChange(newType: "renovation" | "new_build" | null) {
    setSiteType(newType);
    setHasUnsavedChanges(true);
    const presetOverrides = getPresetDefaults(newType);
    const currentValues = form.getValues();
    const merged = { ...currentValues, ...presetOverrides };
    form.reset(merged);
    lastAutoWindZone.current = presetOverrides.windZone || "";
  }

  async function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !photoTargetItemId) return;
    try {
      const blob = await compressImageToBlob(file);
      const formData = new FormData();
      formData.append("file", blob, "photo.jpg");
      const uploadRes = await fetch("/api/item-photos", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { key } = await uploadRes.json();
      setItems(prev => prev.map(iwp => {
        if (iwp.uiId !== photoTargetItemId) return iwp;
        const existing = iwp.photos || [];
        const newPhoto: ItemPhotoRef = {
          key,
          isPrimary: existing.length === 0,
          includeInCustomerPdf: false,
          takenAt: new Date().toISOString(),
        };
        return { ...iwp, photos: [...existing, newPhoto] };
      }));
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
    if (items.length === 0 || downloadGenerating) return;
    setDownloadGenerating(true);
    toast({ title: `Downloading ${items.length} item(s)...` });
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50)));
    try {
      for (const iwp of items) {
        try {
          const blob = await renderOffscreenAndCapture(iwp.item);
          downloadBlob(blob, buildFilename(iwp.item.name || "", iwp.item.id));
          await new Promise((r) => setTimeout(r, 100));
        } catch {
          toast({ title: `Failed to download ${iwp.item.name || "item"}`, variant: "destructive" });
        }
      }
    } finally {
      setDownloadGenerating(false);
    }
  }

  async function handleDownloadPdf() {
    if (items.length === 0 || downloadGenerating) return;
    setDownloadGenerating(true);
    toast({ title: `Generating PDF with ${items.length} item(s)...` });
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50)));
    try {
      const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < items.length; i++) {
        if (i > 0) {
          pdf.addPage();
          await new Promise((r) => setTimeout(r, 0));
        }
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
    } finally {
      setDownloadGenerating(false);
    }
  }

  async function saveJob(): Promise<boolean> {
    if (saveInProgressRef.current) {
      return false;
    }
    if (!jobName.trim()) {
      toast({ title: "Job name is required", variant: "destructive" });
      return false;
    }
    if (items.length === 0) {
      toast({ title: "Add at least one item before saving", variant: "destructive" });
      return false;
    }
    saveInProgressRef.current = true;
    setIsSaving(true);
    try {
      const jobMeta: Record<string, any> = {
        name: jobName, address: jobAddress, date: jobDate, siteType: siteType || null,
        clientName: clientName.trim() || null,
        clientEmail: clientEmail.trim() || null,
        clientPhone: clientPhone.trim() || null,
      };

      let currentJobId = savedJobId;
      if (!currentJobId) {
        const res = await apiRequest("POST", "/api/jobs", jobMeta);
        const job = await res.json();
        currentJobId = job.id;
        setSavedJobId(job.id);
      } else {
        await apiRequest("PATCH", `/api/jobs/${currentJobId}`, jobMeta);
      }

      const bulkItems = items.map((iwp, i) => {
        const payload: any = {
          config: ensureConfigId(iwp.item),
          photos: iwp.photos || [],
          sortOrder: i,
        };
        if (iwp.photo && iwp.photo.startsWith("data:image/") && !(iwp.photos?.length)) {
          payload.photo = iwp.photo;
        }
        return payload;
      });
      await apiRequest("PUT", `/api/jobs/${currentJobId}/items`, { items: bulkItems });

      if (clientName.trim()) {
        apiRequest("POST", `/api/jobs/${currentJobId}/link-customer`, {
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim() || null,
          clientPhone: clientPhone.trim() || null,
        }).catch(() => {});
      }

      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setHasUnsavedChanges(false);
      toast({ title: "Job saved successfully" });
      if (isNewJob) {
        navigate(`/job/${currentJobId}`, { replace: true });
      }
      return true;
    } catch (e: any) {
      toast({ title: "Failed to save job", description: e.message, variant: "destructive" });
      return false;
    } finally {
      saveInProgressRef.current = false;
      setIsSaving(false);
    }
  }

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveJobRef = useRef(saveJob);
  saveJobRef.current = saveJob;
  useEffect(() => {
    if (!savedJobId || !hasUnsavedChanges || items.length === 0 || !jobName.trim()) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    const delay = immediateAutoSaveRef.current ? 0 : 3000;
    immediateAutoSaveRef.current = false;
    autoSaveTimerRef.current = setTimeout(() => {
      saveJobRef.current();
    }, delay);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [items, savedJobId, hasUnsavedChanges, jobName, jobAddress, jobDate, siteType]);

  async function ensureJobExists(): Promise<string | null> {
    if (savedJobId) return savedJobId;
    if (!jobName.trim()) {
      toast({ title: "Job name is required", variant: "destructive" });
      return null;
    }
    try {
      const res = await apiRequest("POST", "/api/jobs", {
        name: jobName, address: jobAddress, date: jobDate,
      });
      const job = await res.json();
      setSavedJobId(job.id);
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      return job.id;
    } catch (e: any) {
      toast({ title: "Failed to create job", description: e.message, variant: "destructive" });
      return null;
    }
  }

  function calcRakedAreaSqm(item: QuoteItem | InsertQuoteItem): number {
    if (item.category === "raked-fixed") {
      const lh = (item as any).rakedLeftHeight || item.height;
      const rh = (item as any).rakedRightHeight || item.height;
      return (item.width * ((lh + rh) / 2) * (item.quantity || 1)) / 1_000_000;
    }
    return (item.width * item.height * (item.quantity || 1)) / 1_000_000;
  }

  function calcSqm(width: number, height: number, quantity: number, item?: QuoteItem | InsertQuoteItem): string {
    if (item && item.category === "raked-fixed") {
      return calcRakedAreaSqm(item).toFixed(2);
    }
    return ((width * height * quantity) / 1_000_000).toFixed(2);
  }

  function calcItemPrice(item: QuoteItem | InsertQuoteItem): number {
    if ((item as any).fulfilmentSource === "outsourced") {
      return (item as any).outsourcedSellNzd ?? 0;
    }
    const sqm = calcRakedAreaSqm(item);
    const oMode = (item as any).overrideMode || "none";
    const oVal = (item as any).overrideValue ?? null;
    if (oMode === "total_sell" && oVal) return oVal;
    if (oMode === "per_sqm" && oVal) return oVal * sqm;
    return sqm * (item.pricePerSqm || 500);
  }

  function formatPrice(amount: number): string {
    return amount.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const totalSqm = useMemo(() => items.reduce((sum, iwp) => {
    return sum + calcRakedAreaSqm(iwp.item);
  }, 0).toFixed(2), [items]);

  const totalPrice = useMemo(() => items.reduce((sum, iwp) => sum + calcItemPrice(iwp.item), 0), [items]);

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

      <header className="border-b px-4 lg:px-6 py-3 bg-card shrink-0">
        <div className="flex items-center justify-between gap-2 lg:gap-4 mb-3">
          <div className="flex items-center gap-2 lg:gap-3 min-w-0">
            <Button variant="ghost" size="icon" className="shrink-0" data-testid="button-back-to-jobs" onClick={() => {
              guardedNavigate("/");
            }}>
              <ArrowLeftCircle className="w-5 h-5" />
            </Button>
            <div className="hidden lg:flex items-center justify-center w-9 h-9 rounded-md bg-primary shrink-0">
              <LayoutGrid className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm lg:text-lg font-semibold tracking-tight truncate" data-testid="text-app-title">
                {isLargeScreen ? "LJ Estimator" : (jobName.trim() || (savedJobId ? "Editing" : "New Estimate"))}
              </h1>
              {isLargeScreen ? (
                <p className="text-xs text-muted-foreground">
                  {savedJobId ? "Editing Job" : "New Job"}
                </p>
              ) : (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
                  {jobAddress.trim() && <span className="truncate max-w-[120px]">{jobAddress}</span>}
                  {siteType && <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">{siteType === "renovation" ? "Reno" : "New Build"}</Badge>}
                  {items.length > 0 && <span className="shrink-0">{items.length} item{items.length !== 1 ? "s" : ""}</span>}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {items.length > 0 && (
              <Badge variant="secondary" data-testid="badge-item-count" className="hidden sm:inline-flex">
                {items.length} item{items.length !== 1 ? "s" : ""}
              </Badge>
            )}
            {isLargeScreen ? (
              <>
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
                    <DropdownMenuItem onClick={handleDownloadAllPngs} disabled={items.length === 0 || downloadGenerating} data-testid="menu-download-all-pngs">
                      {downloadGenerating ? "Generating..." : "All Items (Individual PNGs)"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDownloadPdf} disabled={items.length === 0 || downloadGenerating} data-testid="menu-download-pdf">
                      {downloadGenerating ? "Generating..." : "All Items (PDF)"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {savedJobId && items.length > 0 && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => guardedNavigate(`/job/${savedJobId}/summary`)} data-testid="button-quote-summary">
                      <FileText className="w-4 h-4 mr-1.5" /> Summary
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => guardedNavigate(`/job/${savedJobId}/exec-summary`)} data-testid="button-exec-summary">
                      <FileText className="w-4 h-4 mr-1.5" /> Exec Summary
                    </Button>
                  </>
                )}
              </>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" data-testid="button-mobile-more">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleDownloadCurrentPng} data-testid="menu-mobile-download-png">
                    <Download className="w-4 h-4 mr-2" /> Current Drawing (PNG)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownloadAllPngs} disabled={items.length === 0 || downloadGenerating} data-testid="menu-mobile-download-all">
                    <Download className="w-4 h-4 mr-2" /> {downloadGenerating ? "Generating..." : "All Items (PNGs)"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownloadPdf} disabled={items.length === 0 || downloadGenerating} data-testid="menu-mobile-download-pdf">
                    <Download className="w-4 h-4 mr-2" /> {downloadGenerating ? "Generating..." : "All Items (PDF)"}
                  </DropdownMenuItem>
                  {savedJobId && items.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => guardedNavigate(`/job/${savedJobId}/summary`)} data-testid="menu-mobile-summary">
                        <FileText className="w-4 h-4 mr-2" /> Summary
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => guardedNavigate(`/job/${savedJobId}/exec-summary`)} data-testid="menu-mobile-exec-summary">
                        <FileText className="w-4 h-4 mr-2" /> Review & Generate Estimate
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <div className="w-px h-5 bg-border mx-0.5 hidden sm:block shrink-0" />
            <Button onClick={saveJob} disabled={isSaving} size={isLargeScreen ? "default" : "sm"} data-testid="button-save-job">
              <Save className="w-4 h-4 mr-1.5" /> {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
        {isLargeScreen ? (
          <div className="space-y-2">
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
              <div className="w-36 shrink-0">
                <Label className="text-xs">Site Type</Label>
                <Select value={siteType || "__none__"} onValueChange={(v) => handleSiteTypeChange(v === "__none__" ? null : v as "renovation" | "new_build")}>
                  <SelectTrigger data-testid="select-site-type"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    <SelectItem value="renovation">Renovation</SelectItem>
                    <SelectItem value="new_build">New Build</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1 min-w-0">
                <Label className="text-xs">Client Name</Label>
                <Input
                  value={clientName}
                  onChange={(e) => { setClientName(e.target.value); setHasUnsavedChanges(true); }}
                  onBlur={() => persistJobField("clientName", clientName.trim() || null)}
                  placeholder="e.g. John Smith"
                  data-testid="input-client-name"
                />
              </div>
              <div className="flex-1 min-w-0">
                <Label className="text-xs">Client Email</Label>
                <Input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => { setClientEmail(e.target.value); setHasUnsavedChanges(true); }}
                  onBlur={() => persistJobField("clientEmail", clientEmail.trim() || null)}
                  placeholder="e.g. john@example.com"
                  data-testid="input-client-email"
                />
              </div>
              <div className="w-44 shrink-0">
                <Label className="text-xs">Client Phone</Label>
                <Input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => { setClientPhone(e.target.value); setHasUnsavedChanges(true); }}
                  onBlur={() => persistJobField("clientPhone", clientPhone.trim() || null)}
                  placeholder="e.g. 021 123 4567"
                  data-testid="input-client-phone"
                />
              </div>
              <div className="w-36 shrink-0" />
            </div>
          </div>
        ) : (
          headerCollapsed ? (
            <button
              type="button"
              className="w-full flex items-center gap-2 text-left py-1"
              onClick={() => { setHeaderCollapsed(false); didAutoCollapseOnFocusRef.current = false; }}
              data-testid="button-expand-header"
            >
              <span className="text-sm font-medium truncate flex-1 min-w-0">{jobName.trim() || "Untitled"}</span>
              {jobAddress.trim() && <span className="text-xs text-muted-foreground truncate max-w-[100px]">{jobAddress}</span>}
              {siteType && <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">{siteType === "renovation" ? "Reno" : "New"}</Badge>}
              <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">{items.length} item{items.length !== 1 ? "s" : ""}</Badge>
              <Pencil className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            </button>
          ) : (
            <div ref={headerFieldsRef} className="flex flex-col gap-2">
              <div>
                <Label className="text-xs">Job Name *</Label>
                <Input
                  value={jobName}
                  onChange={(e) => { setJobName(e.target.value); setHasUnsavedChanges(true); }}
                  placeholder="e.g. Smith Residence"
                  data-testid="input-job-name"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <Label className="text-xs">Address</Label>
                  <Input
                    value={jobAddress}
                    onChange={(e) => { setJobAddress(e.target.value); setHasUnsavedChanges(true); }}
                    placeholder="e.g. 123 Main St"
                    data-testid="input-job-address"
                  />
                </div>
                <div className="w-32 shrink-0">
                  <Label className="text-xs">Date</Label>
                  <Input
                    type="date"
                    value={jobDate}
                    onChange={(e) => { setJobDate(e.target.value); setHasUnsavedChanges(true); }}
                    data-testid="input-job-date"
                  />
                </div>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label className="text-xs">Site Type</Label>
                  <Select value={siteType || "__none__"} onValueChange={(v) => handleSiteTypeChange(v === "__none__" ? null : v as "renovation" | "new_build")}>
                    <SelectTrigger data-testid="select-site-type-mobile"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      <SelectItem value="renovation">Renovation</SelectItem>
                      <SelectItem value="new_build">New Build</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Client Name</Label>
                <Input
                  value={clientName}
                  onChange={(e) => { setClientName(e.target.value); setHasUnsavedChanges(true); }}
                  onBlur={() => persistJobField("clientName", clientName.trim() || null)}
                  placeholder="e.g. John Smith"
                  data-testid="input-client-name-mobile"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <Label className="text-xs">Email</Label>
                  <Input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => { setClientEmail(e.target.value); setHasUnsavedChanges(true); }}
                    onBlur={() => persistJobField("clientEmail", clientEmail.trim() || null)}
                    placeholder="e.g. john@example.com"
                    data-testid="input-client-email-mobile"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <Label className="text-xs">Phone</Label>
                  <Input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => { setClientPhone(e.target.value); setHasUnsavedChanges(true); }}
                    onBlur={() => persistJobField("clientPhone", clientPhone.trim() || null)}
                    placeholder="e.g. 021 123 4567"
                    data-testid="input-client-phone-mobile"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setHeaderCollapsed(true)} data-testid="button-collapse-header">
                  <ChevronUp className="w-4 h-4 mr-1" /> Done
                </Button>
              </div>
            </div>
          )
        )}
      </header>

      {!isLargeScreen && (
        <div className="flex border-b bg-card shrink-0">
          <button
            type="button"
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium border-b-2 transition-colors ${mobileTab === "config" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
            onClick={() => setMobileTab("config")}
            data-testid="tab-mobile-config"
          >
            <Wrench className="w-4 h-4" /> Config
          </button>
          <button
            type="button"
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium border-b-2 transition-colors ${mobileTab === "preview" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
            onClick={() => setMobileTab("preview")}
            data-testid="tab-mobile-preview"
          >
            <Eye className="w-4 h-4" /> Preview
          </button>
          <button
            type="button"
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium border-b-2 transition-colors ${mobileTab === "items" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
            onClick={() => setMobileTab("items")}
            data-testid="tab-mobile-items"
          >
            <List className="w-4 h-4" /> Items
            {items.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{items.length}</Badge>
            )}
          </button>
        </div>
      )}

      <div className={`flex-1 min-h-0 flex ${isLargeScreen ? "lg:flex-row" : ""} flex-col overflow-hidden`}>
        {(isLargeScreen || mobileTab === "config") && (
        <ScrollArea ref={configScrollRef} className={isLargeScreen ? "w-full lg:w-80 xl:w-96 border-r shrink-0 h-full min-h-0" : "flex-1 min-h-0 native-scroll"}>
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
                  <Input id="quantity" type="number" inputMode="numeric" min={1}
                    {...form.register("quantity", { valueAsNumber: true })}
                    onFocus={handleConfigFieldFocus}
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
                {isRaked ? (
                  <>
                    <div>
                      <Label htmlFor="width" className="text-xs">Overall Width (mm)</Label>
                      <Input id="width" type="number" inputMode="decimal" min={200}
                        {...form.register("width", {
                          valueAsNumber: true,
                          onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                            const v = e.target.value ? parseInt(e.target.value) : 0;
                            if (w.rakedSplitEnabled && w.rakedSplitPosition && v > 0 && w.rakedSplitPosition >= v - 100) {
                              form.setValue("rakedSplitPosition", Math.max(100, Math.round(v / 2)));
                            }
                          }
                        })}
                        onFocus={handleConfigFieldFocus}
                        data-testid="input-width" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Left Height (mm)</Label>
                        <Input type="number" inputMode="decimal" min={1}
                          value={w.rakedLeftHeight || ""}
                          onChange={(e) => {
                            const v = e.target.value ? parseInt(e.target.value) : 0;
                            form.setValue("rakedLeftHeight", v);
                            form.setValue("height", Math.max(v, w.rakedRightHeight || 0));
                          }}
                          onFocus={handleConfigFieldFocus}
                          data-testid="input-raked-left-height" />
                      </div>
                      <div>
                        <Label className="text-xs">Right Height (mm)</Label>
                        <Input type="number" inputMode="decimal" min={1}
                          value={w.rakedRightHeight || ""}
                          onChange={(e) => {
                            const v = e.target.value ? parseInt(e.target.value) : 0;
                            form.setValue("rakedRightHeight", v);
                            form.setValue("height", Math.max(w.rakedLeftHeight || 0, v));
                          }}
                          onFocus={handleConfigFieldFocus}
                          data-testid="input-raked-right-height" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Checkbox id="rakedSplitEnabled" checked={w.rakedSplitEnabled || false}
                        onCheckedChange={(v) => {
                          form.setValue("rakedSplitEnabled", !!v);
                          if (v && !w.rakedSplitPosition) {
                            form.setValue("rakedSplitPosition", Math.round((w.width || 1200) / 2));
                          }
                        }}
                        data-testid="checkbox-raked-split" />
                      <Label htmlFor="rakedSplitEnabled" className="text-xs cursor-pointer">
                        Panel Split
                      </Label>
                    </div>
                    {w.rakedSplitEnabled && (
                      <div>
                        <Label className="text-xs">Split Position from Left (mm)</Label>
                        <Input type="number" inputMode="decimal" min={100} max={(w.width || 1200) - 100}
                          value={w.rakedSplitPosition || ""}
                          onChange={(e) => {
                            const v = e.target.value ? parseInt(e.target.value) : 0;
                            const maxPos = (w.width || 1200) - 100;
                            form.setValue("rakedSplitPosition", Math.min(Math.max(0, v), maxPos));
                          }}
                          onFocus={handleConfigFieldFocus}
                          data-testid="input-raked-split-position" />
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Left panel: {w.rakedSplitPosition || 0}mm · Right panel: {(w.width || 0) - (w.rakedSplitPosition || 0)}mm
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="width" className="text-xs">Width (mm)</Label>
                      <Input id="width" type="number" inputMode="decimal" min={200}
                        {...form.register("width", { valueAsNumber: true })}
                        onFocus={handleConfigFieldFocus}
                        data-testid="input-width" />
                    </div>
                    <div>
                      <Label htmlFor="height" className="text-xs">Height (mm)</Label>
                      <Input id="height" type="number" inputMode="decimal" min={200}
                        {...form.register("height", { valueAsNumber: true })}
                        onFocus={handleConfigFieldFocus}
                        data-testid="input-height" />
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-xs" data-testid="badge-frame-size">
                    {frameSize}mm Frame
                  </Badge>
                  <Badge variant="outline" className="text-xs" data-testid="badge-live-sqm">
                    {calcSqm(w.width || 0, w.height || 0, w.quantity || 1, isRaked ? w as any : undefined)} m²
                  </Badge>
                  {isRaked && (
                    <Badge variant="outline" className="text-xs text-blue-600" data-testid="badge-raked-orientation">
                      {(w.rakedLeftHeight || 0) > (w.rakedRightHeight || 0) ? "Left Rake" : (w.rakedRightHeight || 0) > (w.rakedLeftHeight || 0) ? "Right Rake" : "Level"}
                    </Badge>
                  )}
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
                    <Label className="text-xs">Opening Type <span className="font-normal text-muted-foreground">(Fixed · Awning · French)</span></Label>
                    <Select value={w.windowType} onValueChange={(v) => form.setValue("windowType", v as any)}>
                      <SelectTrigger data-testid="select-window-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed</SelectItem>
                        <SelectItem value="awning">Awning (Top-Hung)</SelectItem>
                        <SelectItem value="french-left">French — Left Hinge</SelectItem>
                        <SelectItem value="french-right">French — Right Hinge</SelectItem>
                        <SelectItem value="french-pair">French Pair (Double)</SelectItem>
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

                {hasOpeningDirection(category, w.windowType) && !isCustom && (
                  <div>
                    <Label className="text-xs">Opening</Label>
                    <Select value={w.openingDirection || "none"} onValueChange={(v) => form.setValue("openingDirection", v as any)}>
                      <SelectTrigger data-testid="select-opening-direction"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {getOpeningDirectionOptionsForWindow(category, w.windowType).map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
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

                {showSidelightControls && <SidelightControls
                  totalWidth={w.width || 0}
                  sidelightSide={w.sidelightSide || "right"}
                  sidelightWidth={w.sidelightWidth || 400}
                  onSidelightSideChange={(v) => form.setValue("sidelightSide", v as any)}
                  onSidelightWidthChange={(v) => form.setValue("sidelightWidth", v)}
                  onFocus={handleConfigFieldFocus}
                />}

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
                        const panelRowDefs: EntranceDoorRow[] = pRows[pi] || [{ ...DEFAULT_PANEL_ROW }];
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
                                    const typeLabel = row.type === "awning" ? "AWN" : row.type === "sliding" ? "SLD" : "FIX";
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
                                        {isStacker && row.type === "sliding" && (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() => setPanelRowSlideDirection(pi, ri, "left")}
                                              className={`shrink-0 rounded-sm text-xs py-0.5 px-1.5 border transition-colors ${
                                                row.slideDirection === "left"
                                                  ? "bg-primary/15 border-primary/30 text-primary"
                                                  : "bg-background border-border text-muted-foreground"
                                              }`}
                                              data-testid={`button-panel-row-slide-left-${pi}-${ri}`}
                                            >
                                              <ArrowLeft className="w-3 h-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setPanelRowSlideDirection(pi, ri, "right")}
                                              className={`shrink-0 rounded-sm text-xs py-0.5 px-1.5 border transition-colors ${
                                                row.slideDirection !== "left"
                                                  ? "bg-primary/15 border-primary/30 text-primary"
                                                  : "bg-background border-border text-muted-foreground"
                                              }`}
                                              data-testid={`button-panel-row-slide-right-${pi}-${ri}`}
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
                      <p className="text-xs text-muted-foreground">
                        {isStacker ? "FIX / SLD / AWN cycle. Arrow buttons set slide direction. 0 = even split." : "FIX = Fixed, AWN = Awning. 0 = even split."}
                      </p>
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
                  <>
                    <div>
                      <Label htmlFor="centerWidth" className="text-xs">Center Panel Width (mm)</Label>
                      <Input id="centerWidth" type="number" min={0}
                        placeholder="0 = 60% of total"
                        {...form.register("centerWidth", { valueAsNumber: true })}
                        data-testid="input-center-width" />
                      <p className="text-xs text-muted-foreground mt-1">0 = default 60% of total width</p>
                    </div>
                    <div>
                      <Label htmlFor="bayAngle" className="text-xs">Bay Angle</Label>
                      <Select
                        value={String(form.watch("bayAngle") || 135)}
                        onValueChange={(v) => form.setValue("bayAngle", Number(v))}
                      >
                        <SelectTrigger data-testid="select-bay-angle"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="90">90°</SelectItem>
                          <SelectItem value="120">120°</SelectItem>
                          <SelectItem value="135">135° (Standard)</SelectItem>
                          <SelectItem value="150">150°</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">Angle between front and side panels</p>
                    </div>
                    <div>
                      <Label htmlFor="bayDepth" className="text-xs">Bay Depth / Projection (mm)</Label>
                      <Input id="bayDepth" type="number" min={0}
                        placeholder="0 = auto from angle"
                        {...form.register("bayDepth", { valueAsNumber: true })}
                        data-testid="input-bay-depth" />
                      <p className="text-xs text-muted-foreground mt-1">How far the bay projects from the wall. 0 = derived from angle and side width.</p>
                    </div>
                  </>
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
                                  <Label className="text-xs">Height Override (mm)</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={col.heightOverride || ""}
                                    placeholder={`Overall (${w.height || 0})`}
                                    onChange={(e) => setColumnHeightOverride(ci, parseFloat(e.target.value) || 0)}
                                    data-testid={`input-col-height-${ci}`}
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
                                        {isFrenchDoorCategory && row.type === "hinge" && (
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
                        : isFrenchDoorCategory
                        ? "FIX / AWN / HNG cycle. HNG shows open direction & hinge side. 0 = even split."
                        : "FIX = Fixed, AWN = Awning. Leave widths/heights at 0 for even split."
                      }
                    </p>

                    {!isSlidingCategory && !isFrenchDoorCategory && (
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

              <TabsContent value="specifics" className="space-y-3 mt-0">
                {(isSpecVisible("frameSeries") || isSpecVisible("frameColor") || isSpecVisible("flashingSize") || isSpecVisible("configurationId")) && (
                <div>
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2" data-testid="spec-group-FrameFinish">
                    Frame & Finish
                  </h2>
                  <div className="space-y-2">
                    {isSpecVisible("frameSeries") && (
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
                    )}
                    {isSpecVisible("configurationId") && (
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
                    )}
                    {isSpecVisible("frameColor") && (
                    <div>
                      <Label className="text-xs">Frame Colour</Label>
                      <Select value={w.frameColor || ""} onValueChange={(v) => form.setValue("frameColor", v)}>
                        <SelectTrigger data-testid="select-frame-color"><SelectValue placeholder="Select color" /></SelectTrigger>
                        <SelectContent>
                          {libFrameColorOptions.map((fc) => (
                            <SelectItem key={fc.value} value={fc.value}>{fc.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    )}
                    {isSpecVisible("flashingSize") && (
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
                    )}
                  </div>
                </div>
                )}

                {(isSpecVisible("frameSeries") || isSpecVisible("flashingSize")) && <Separator />}

                {(isSpecVisible("iguType") || isSpecVisible("glassType") || isSpecVisible("glassThickness") || isSpecVisible("rValue")) && (
                <div>
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2" data-testid="spec-group-Glazing">
                    {showPaneGlassSelectors ? "Default Glazing" : "Glazing"}
                  </h2>
                  {showPaneGlassSelectors && (
                    <p className="text-[10px] text-muted-foreground mb-2" data-testid="text-default-glazing-hint">Used as fallback for panes without an override</p>
                  )}
                  <div className="space-y-2">
                    {isSpecVisible("iguType") && (
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
                          <SelectItem value="VLamThermotech">VLam Thermotech IGU (Laminated Safety)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    )}
                    {isSpecVisible("glassType") && w.glassIguType && (
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
                    {isSpecVisible("glassThickness") && w.glassIguType && w.glassType && (
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
                        {isSpecVisible("rValue") && (
                        <Badge variant="outline" className="text-xs" data-testid="badge-glass-rvalue">
                          R-Value: {getGlassRValue(w.glassIguType) ?? "—"}
                        </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                )}

                <Separator />

                {(isSpecVisible("windZone") || isSpecVisible("wallThickness") || isSpecVisible("heightFromFloor")) && (
                <div>
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2" data-testid="spec-group-Performance">
                    Performance & Install
                  </h2>
                  <div className="space-y-2">
                    {isSpecVisible("windZone") && (
                    <div>
                      <Label className="text-xs">Wind Zone</Label>
                      <Select value={w.windZone || "__none__"} onValueChange={(v) => form.setValue("windZone", v === "__none__" ? "" : v)}>
                        <SelectTrigger data-testid="select-wind-zone"><SelectValue placeholder="Select wind zone" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {WIND_ZONES.map((wz) => (
                            <SelectItem key={wz} value={wz}>{wz}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    )}
                    {isSpecVisible("wallThickness") && (
                    <div>
                      <Label className="text-xs">Wall Thickness (mm)</Label>
                      <Input type="number" inputMode="decimal" min={0}
                        value={w.wallThickness || ""}
                        onChange={(e) => form.setValue("wallThickness", Number(e.target.value) || 0)}
                        onFocus={handleConfigFieldFocus}
                        data-testid="input-wall-thickness" />
                    </div>
                    )}
                    {isSpecVisible("heightFromFloor") && (
                    <div>
                      <Label className="text-xs">Height from Floor (mm)</Label>
                      <Input type="number" inputMode="decimal" min={0}
                        value={w.heightFromFloor ?? ""}
                        onChange={(e) => form.setValue("heightFromFloor", e.target.value === "" ? null : Number(e.target.value))}
                        onFocus={handleConfigFieldFocus}
                        placeholder={DOOR_CATEGORIES.includes(w.category || "") ? "Default: 30mm" : "Default: 800mm"}
                        data-testid="input-height-from-floor" />
                      {w.heightFromFloor != null && w.heightFromFloor < 800 && (
                        <div className="flex items-start gap-1.5 mt-1.5 p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800" data-testid="warning-height-from-floor">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <span className="text-xs text-amber-700 dark:text-amber-300">Height under 800mm — safety glazing / toughening may be required. Check glass selection.</span>
                        </div>
                      )}
                    </div>
                    )}
                  </div>
                </div>
                )}

                {(isSpecVisible("windZone") || isSpecVisible("wallThickness")) && <Separator />}

                {showPaneGlassSelectors && w.glassIguType && (
                <div>
                  <div className="flex items-start gap-1.5 mb-2 p-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800" data-testid="pane-glass-info-banner">
                    <Shield className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-blue-700 dark:text-blue-300">
                      Height from floor is under 800mm with {effectivePaneCount} panes — you can set glazing per pane below.
                    </span>
                  </div>
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2" data-testid="spec-group-PaneGlazing">
                    Pane-Level Glazing
                  </h2>
                  <div className="space-y-3">
                    {Array.from({ length: effectivePaneCount }, (_, pi) => {
                      const existing = (w.paneGlassSpecs || []).find((s) => s.paneIndex === pi);
                      const pIgu = existing?.iguType || w.glassIguType || "";
                      const pGlass = existing?.glassType || "";
                      const pThick = existing?.glassThickness || "";
                      const updatePaneSpec = (field: string, value: string) => {
                        const specs = [...(w.paneGlassSpecs || [])];
                        const idx = specs.findIndex((s) => s.paneIndex === pi);
                        const current = idx >= 0 ? { ...specs[idx] } : { paneIndex: pi, iguType: w.glassIguType || "", glassType: "", glassThickness: "" };
                        if (field === "iguType") {
                          current.iguType = value;
                          current.glassType = "";
                          current.glassThickness = "";
                        } else if (field === "glassType") {
                          current.glassType = value;
                          current.glassThickness = "";
                        } else {
                          current.glassThickness = value;
                        }
                        if (idx >= 0) specs[idx] = current;
                        else specs.push(current);
                        form.setValue("paneGlassSpecs", specs, { shouldDirty: true });
                      };
                      return (
                        <div key={pi} className="p-2 rounded-md border border-border/60 bg-muted/30 space-y-1.5" data-testid={`pane-glass-selector-${pi}`}>
                          <span className="text-xs font-medium text-muted-foreground">Pane {pi + 1}</span>
                          <div className="grid grid-cols-3 gap-1.5">
                            <div>
                              <Label className="text-[10px]">IGU</Label>
                              <Select value={pIgu} onValueChange={(v) => updatePaneSpec("iguType", v)}>
                                <SelectTrigger className="h-7 text-xs" data-testid={`select-pane-igutype-${pi}`}><SelectValue placeholder="IGU" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="EnergySaver">EnergySaver™</SelectItem>
                                  <SelectItem value="LightBridge">LightBridge™</SelectItem>
                                  <SelectItem value="VLamThermotech">VLam Thermotech</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-[10px]">Glass</Label>
                              <Select value={pGlass} onValueChange={(v) => updatePaneSpec("glassType", v)} disabled={!pIgu}>
                                <SelectTrigger className="h-7 text-xs" data-testid={`select-pane-glasstype-${pi}`}><SelectValue placeholder="Glass" /></SelectTrigger>
                                <SelectContent>
                                  {libGlassCombos(pIgu).map((combo) => (
                                    <SelectItem key={combo} value={combo}>{combo}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-[10px]">Thickness</Label>
                              <Select value={pThick} onValueChange={(v) => updatePaneSpec("glassThickness", v)} disabled={!pIgu || !pGlass}>
                                <SelectTrigger className="h-7 text-xs" data-testid={`select-pane-thickness-${pi}`}><SelectValue placeholder="mm" /></SelectTrigger>
                                <SelectContent>
                                  {libGlassThicknesses(pIgu, pGlass).map((t) => (
                                    <SelectItem key={t} value={t}>{t}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                )}

                {showPaneGlassSelectors && w.glassIguType && <Separator />}

                {isSpecVisible("linerType") && (
                <div>
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2" data-testid="spec-group-LinersFlashings">
                    Liner / Reveal
                  </h2>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Liner Type</Label>
                      <Select value={w.linerType || "__none__"} onValueChange={(v) => form.setValue("linerType", v === "__none__" ? "" : v)}>
                        <SelectTrigger data-testid="select-liner-type"><SelectValue placeholder="Select liner" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {libLinerOptions.map((lt) => (
                            <SelectItem key={lt.value} value={lt.value}>{lt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                )}

                {isSpecVisible("linerType") && <Separator />}

                {(isSpecVisible("handleSet") || isSpecVisible("lockSet") || isSpecVisible("wanzBarEnabled") || isSpecVisible("wanzBarSize")) && (
                <div>
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2" data-testid="spec-group-Hardware">
                    Hardware & Components
                  </h2>
                  <div className="space-y-2">
                    {isSpecVisible("handleSet") && (
                    <div>
                      <Label className="text-xs">Handle</Label>
                      <Select value={w.handleType || "__none__"} onValueChange={(v) => form.setValue("handleType", v === "__none__" ? "" : v)}>
                        <SelectTrigger data-testid="select-handle"><SelectValue placeholder="Select handle" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {(libCategoryHandles.length > 0
                            ? libCategoryHandles.map((e) => ({ value: (e.data as any).value, label: (e.data as any).label }))
                            : libHandlesForCategoryLegacy(w.category || "windows-standard")
                          ).map((h) => (
                            <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    )}

                    {isSpecVisible("lockSet") && isDoorCategory(w.category || "") && (
                    <div>
                      <Label className="text-xs">Lock Type</Label>
                      <Select value={w.lockType || "__none__"} onValueChange={(v) => form.setValue("lockType", v === "__none__" ? "" : v)}>
                        <SelectTrigger data-testid="select-lock-type"><SelectValue placeholder="Select lock" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {(libCategoryLocks.length > 0
                            ? libCategoryLocks.map((e) => ({ value: (e.data as any).value, label: (e.data as any).label }))
                            : getLocksForCategory(w.category || "").map((l) => ({ value: l.value, label: l.label }))
                          ).map((l) => (
                            <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {w.lockType === "Custom-Local-Supply" && (
                        <p className="text-[10px] text-muted-foreground mt-1" data-testid="text-lock-custom-note">
                          Manual pricing — price override available in Cost Breakdown
                        </p>
                      )}
                      {(w.lockType === "Customer-Supplied" || w.lockType === "TBC") && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1" data-testid="text-lock-exclusion-note">
                          <AlertTriangle className="w-3 h-3 inline mr-1" />Lock not included in supply scope
                        </p>
                      )}
                    </div>
                    )}

                    {isSpecVisible("wanzBarEnabled") && (
                    <>
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
                          {isSpecVisible("wanzBarSize") && (
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
                          )}
                          {isSpecVisible("wanzBarSource") && (
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
                          )}
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
                    </>
                    )}
                  </div>
                </div>
                )}

                <Separator />

                <div>
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2" data-testid="spec-group-Pricing">
                    Pricing
                  </h2>
                  <div className="space-y-2">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs">Sale Price per m² (${w.pricePerSqm || 500}/m²)</Label>
                        {(w.overrideMode || "none") !== "none" && (
                          <Badge variant="secondary" className="text-[10px] h-4" data-testid="badge-price-override-active">Override Active</Badge>
                        )}
                      </div>
                      <Slider
                        value={[w.pricePerSqm || 500]}
                        onValueChange={([v]) => form.setValue("pricePerSqm", v)}
                        min={500}
                        max={750}
                        step={5}
                        disabled={(w.overrideMode || "none") !== "none"}
                        data-testid="slider-price-per-sqm"
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                        <span>$500</span>
                        <span className="font-medium">
                          {(w.overrideMode || "none") !== "none"
                            ? `Override: $${calcItemPrice(w as any).toFixed(2)}`
                            : `Sale: $${((w.pricePerSqm || 500) * parseFloat(calcSqm(w.width || 0, w.height || 0, w.quantity || 1, isRaked ? w as any : undefined))).toFixed(2)}`
                          }
                        </span>
                        <span>$750</span>
                      </div>
                    </div>

                    <div className="rounded-md border p-2 space-y-2 bg-muted/20" data-testid="price-override-section">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">Manual Price Override</Label>
                        {(w.overrideMode || "none") !== "none" && (
                          <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive hover:text-destructive px-1"
                            onClick={() => { form.setValue("overrideMode", "none"); form.setValue("overrideValue", null); }}
                            data-testid="button-clear-price-override">
                            Clear
                          </Button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Select value={w.overrideMode || "none"} onValueChange={(v) => form.setValue("overrideMode", v as any)}>
                          <SelectTrigger className="h-7 text-xs flex-1" data-testid="select-override-mode"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Override (Slider)</SelectItem>
                            <SelectItem value="per_sqm">Override $/m²</SelectItem>
                            <SelectItem value="total_sell">Override Total Sell</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          className={(w.overrideMode || "none") !== "none" ? "h-7 text-xs w-24" : "h-7 text-xs w-24 invisible pointer-events-none"}
                          placeholder={(w.overrideMode === "per_sqm") ? "$/m²" : "$ total"}
                          value={w.overrideValue ?? ""}
                          onChange={(e) => form.setValue("overrideValue", e.target.value ? parseFloat(e.target.value) : null)}
                          data-testid="input-override-value"
                          aria-hidden={(w.overrideMode || "none") === "none"}
                        />
                      </div>
                    </div>

                    <div className="rounded-md border p-2 space-y-2 bg-amber-50 dark:bg-amber-950/20" data-testid="outsourced-section">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Package className="h-3.5 w-3.5 text-amber-600" />
                          <Label className="text-xs font-semibold">Outsourced Item</Label>
                        </div>
                        <Switch
                          checked={(w.fulfilmentSource || "in-house") === "outsourced"}
                          onCheckedChange={(checked) => {
                            form.setValue("fulfilmentSource", checked ? "outsourced" : "in-house");
                          }}
                          data-testid="switch-outsourced"
                        />
                      </div>
                      {(w.fulfilmentSource || "in-house") === "in-house" && (w.outsourcedCostNzd != null || w.outsourcedSellNzd != null) && (
                        <p className="text-[10px] text-muted-foreground italic">Previous outsourced values retained (Cost: {w.outsourcedCostNzd != null ? `$${w.outsourcedCostNzd}` : "—"}, Sell: {w.outsourcedSellNzd != null ? `$${w.outsourcedSellNzd}` : "—"}). Switch back to outsourced to use them.</p>
                      )}
                      {(w.fulfilmentSource || "in-house") === "outsourced" && (
                        <div className="space-y-2">
                          <p className="text-[10px] text-amber-700 dark:text-amber-400">Cost and sell values override manufacturing pricing for this item.</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-[10px] text-muted-foreground">Cost (NZD)</Label>
                              <Input
                                type="number"
                                className="h-7 text-xs"
                                placeholder="Buy cost"
                                min={0}
                                value={w.outsourcedCostNzd ?? ""}
                                onChange={(e) => form.setValue("outsourcedCostNzd", e.target.value ? parseFloat(e.target.value) : null)}
                                data-testid="input-outsourced-cost"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px] text-muted-foreground">Sell (NZD)</Label>
                              <Input
                                type="number"
                                className="h-7 text-xs"
                                placeholder="Sell price"
                                min={0}
                                value={w.outsourcedSellNzd ?? ""}
                                onChange={(e) => form.setValue("outsourcedSellNzd", e.target.value ? parseFloat(e.target.value) : null)}
                                data-testid="input-outsourced-sell"
                              />
                            </div>
                          </div>
                          {(w.fulfilmentSource === "outsourced") && (w.outsourcedCostNzd == null || w.outsourcedSellNzd == null) && (
                            <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="h-3 w-3" />
                              <span>{w.outsourcedCostNzd == null && w.outsourcedSellNzd == null ? "Enter cost and sell values" : w.outsourcedCostNzd == null ? "Enter cost value" : "Enter sell value"}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="rounded-md border p-2 space-y-2 bg-blue-50 dark:bg-blue-950/20" data-testid="gos-section">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-blue-600" />
                          <Label className="text-xs font-semibold">Glaze On Site (GOS)</Label>
                        </div>
                        <Switch
                          checked={!!w.gosRequired}
                          onCheckedChange={(checked) => {
                            form.setValue("gosRequired", checked);
                            if (!checked) form.setValue("gosChargeNzd", null);
                          }}
                          data-testid="switch-gos"
                        />
                      </div>
                      {w.gosRequired && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] text-blue-700 dark:text-blue-400 italic">Glaze on site due to size and weight</p>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">GOS Charge — Sell (NZD)</Label>
                            <Input
                              type="number"
                              className="h-7 text-xs"
                              placeholder="Customer sell charge"
                              min={0}
                              value={w.gosChargeNzd ?? ""}
                              onChange={(e) => form.setValue("gosChargeNzd", e.target.value ? parseFloat(e.target.value) : null)}
                              data-testid="input-gos-charge"
                            />
                            <p className="text-[10px] text-muted-foreground mt-0.5" data-testid="text-gos-hint">
                              {(w.gosChargeNzd == null || w.gosChargeNzd === 0)
                                ? "⚠ No sell charge entered — GOS flag only, no revenue added."
                                : "This amount is added to the item sell price."}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="rounded-md border p-2 space-y-2 bg-muted/20" data-testid="catdoor-section">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Label className="text-xs font-semibold">Cat Door</Label>
                        </div>
                        <Switch
                          checked={!!w.catDoorEnabled}
                          onCheckedChange={(checked) => form.setValue("catDoorEnabled", checked)}
                          data-testid="switch-catdoor"
                        />
                      </div>
                      {w.catDoorEnabled && (
                        <p className="text-[10px] text-muted-foreground italic">Cat door included. Pricing to be confirmed separately — no default price applied.</p>
                      )}
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
                          {currentPricing.labourBreakdown.length > 0 && (
                            <div className="col-span-2 pl-3 border-l-2 border-muted space-y-0.5" data-testid="labour-breakdown">
                              {currentPricing.labourBreakdown.map((lb) => (
                                <div key={lb.taskName} className="grid grid-cols-2 gap-x-4 text-[10px] text-muted-foreground" data-testid={`labour-line-${lb.taskName}`}>
                                  <span className="capitalize">
                                    {lb.taskName}
                                    {lb.isAutoInjected && <span className="ml-1 text-amber-500">(auto)</span>}
                                    {lb.driverType === "manual_override" && <span className="ml-1 opacity-50">(override)</span>}
                                    {" "}<span className="opacity-60">
                                      {lb.driverQuantity > 0 && lb.driverType !== "manual_override"
                                        ? `${lb.driverQuantity} pts · ${lb.totalMinutes.toFixed(1)} min`
                                        : `${lb.totalMinutes.toFixed(1)} min`}
                                    </span>
                                  </span>
                                  <span className="text-right">${lb.costNzd.toFixed(2)}</span>
                                </div>
                              ))}
                              <div className="grid grid-cols-2 gap-x-4 text-[10px] font-medium text-muted-foreground border-t border-muted pt-0.5 mt-0.5" data-testid="labour-total-minutes">
                                <span>Total labour / item</span>
                                <span className="text-right">
                                  {((currentPricing.laborHours / Math.max(w.quantity || 1, 1)) * 60).toFixed(0)} min
                                  {(w.quantity || 1) > 1 && <span className="ml-1 opacity-60">({(currentPricing.laborHours * 60).toFixed(0)} min × {w.quantity})</span>}
                                </span>
                              </div>
                            </div>
                          )}
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
                          {currentPricing.gosSellNzd > 0 && (
                            <>
                              <span className="text-muted-foreground text-[10px] pl-2">incl. GOS Sell</span>
                              <span className="text-right font-medium text-green-700 dark:text-green-400" data-testid="text-gos-sell">${currentPricing.gosSellNzd.toFixed(2)}</span>
                            </>
                          )}
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

                {isSpecVisible("overallSize") && (
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs" data-testid="badge-overall-size">
                    Size: {w.width || 0} × {w.height || 0}mm
                  </Badge>
                  <Badge variant="outline" className="text-xs" data-testid="badge-live-sqm-specifics">
                    {calcSqm(w.width || 0, w.height || 0, w.quantity || 1, isRaked ? w as any : undefined)} m²
                  </Badge>
                </div>
                )}

                <div className="pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground"
                    onClick={() => setShowAllSpecs(!showAllSpecs)}
                    data-testid="button-toggle-all-specs"
                  >
                    {showAllSpecs ? (
                      <><ChevronUp className="w-3 h-3 mr-1" /> Show fewer specs</>
                    ) : (
                      <><ChevronDown className="w-3 h-3 mr-1" /> Show all specs ({hiddenSpecCount} more)</>
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            {isLargeScreen && (
              <>
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
              </>
            )}
          </form>
          {!isLargeScreen && (
            <div className="sticky bottom-0 bg-card border-t px-3 py-2 flex items-center gap-2 z-10" data-testid="mobile-config-action-bar">
              <Button size="sm" className="flex-1" onClick={form.handleSubmit(onSubmit)} data-testid="button-sticky-submit">
                {editingId ? <><Pencil className="w-3.5 h-3.5 mr-1" /> Update Item</> : <><Plus className="w-3.5 h-3.5 mr-1" /> Add to Quote</>}
              </Button>
              {editingId && (
                <Button size="sm" variant="outline" onClick={cancelEdit} data-testid="button-sticky-cancel">
                  <X className="w-3.5 h-3.5 mr-1" /> Cancel
                </Button>
              )}
              <Button size="icon" variant="ghost" className="shrink-0 h-8 w-8" onClick={() => setMobileTab("preview")} title="Preview" data-testid="button-sticky-preview">
                <Eye className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="shrink-0 h-8 w-8" onClick={() => setMobileTab("items")} title="Items" data-testid="button-sticky-items">
                <List className="w-4 h-4" />
              </Button>
            </div>
          )}
        </ScrollArea>
        )}

        {(isLargeScreen || mobileTab === "preview") && (
        <div className={isLargeScreen
          ? `flex-1 min-h-0 flex flex-col ${quoteListPosition === "right" ? "lg:flex-row" : "lg:flex-col"} overflow-hidden`
          : "flex-1 min-h-0 flex flex-col overflow-hidden"}>
          <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 min-h-0 bg-muted/30 dark:bg-muted/10">
            <div className="w-full flex-1 max-w-3xl max-h-[600px] rounded-lg overflow-hidden shadow-sm ring-1 ring-border/50 bg-background" data-testid="drawing-preview">
              <DrawingCanvas ref={drawingRef} config={drawingConfig} showPaneNumbers={showPaneGlassSelectors && effectivePaneCount > 1} />
            </div>
            {hasOpeningDirection(category, w.windowType) && w.openingDirection && w.openingDirection !== "none" && (
              <p className="mt-2 text-sm font-medium text-muted-foreground" data-testid="text-opening-direction-label">
                Opening: {getOpeningDirectionLabel(w.openingDirection)}
              </p>
            )}
            {w.gosRequired && (
              <p className="mt-1 text-xs font-semibold text-blue-600 dark:text-blue-400" data-testid="text-gos-tag">
                ⚠ GOS — Glaze on site due to size and weight
              </p>
            )}
            {w.catDoorEnabled && (
              <p className="mt-1 text-xs font-medium text-muted-foreground" data-testid="text-catdoor-tag">
                Cat door included
              </p>
            )}
          </div>

          {!isLargeScreen && (
            <div className="px-4 py-3 border-t bg-card shrink-0 space-y-2">
              <div className="flex items-center gap-2">
                <Button size="sm" className="flex-1" onClick={form.handleSubmit(onSubmit)} data-testid="button-preview-submit">
                  {editingId ? <><Pencil className="w-3.5 h-3.5 mr-1" /> Update Item</> : <><Plus className="w-3.5 h-3.5 mr-1" /> Add to Quote</>}
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={startNewItem} data-testid="button-preview-add-next">
                  <Plus className="w-4 h-4 mr-1.5" /> Add Next Item
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0 h-8 w-8"
                  onClick={() => {
                    if (editingId) {
                      setPhotoTargetItemId(editingId);
                      photoInputRef.current?.click();
                    } else {
                      toast({ title: "Add item to quote first, then capture photo" });
                    }
                  }}
                  title="Capture Photo"
                  data-testid="button-preview-photo"
                >
                  <Camera className="w-4 h-4" />
                </Button>
              </div>
              {savedJobId && items.length > 0 && (
                <Button size="sm" variant="outline" className="w-full" onClick={() => guardedNavigate(`/job/${savedJobId}/exec-summary`)} data-testid="button-preview-review-estimate">
                  <FileText className="w-4 h-4 mr-1.5" /> Review & Generate Estimate
                </Button>
              )}
            </div>
          )}

          {isLargeScreen && items.length > 0 && (
            <div className={`${quoteListPosition === "right"
              ? "border-l bg-card flex flex-col shrink-0 overflow-hidden w-80 xl:w-96"
              : `border-t bg-card flex flex-col shrink-0 overflow-hidden ${itemsExpanded ? "h-[55dvh]" : "h-[160px]"}`
            }`}>
              <div className="px-4 py-2.5 border-b bg-muted/30 shrink-0 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <h3 className="text-sm font-semibold shrink-0" data-testid="text-quote-list-title">
                    Quote Schedule
                  </h3>
                  <span className="text-xs text-muted-foreground hidden sm:inline truncate">
                    {items.length} item{items.length !== 1 ? "s" : ""} · {totalSqm} m² · ${formatPrice(totalPrice)}
                  </span>
                </div>
                {quoteListPosition === "bottom" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 gap-1 text-xs text-muted-foreground shrink-0"
                    onClick={() => setItemsExpanded(!itemsExpanded)}
                    title={itemsExpanded ? "Collapse" : "Expand"}
                    data-testid="button-toggle-items-expand"
                  >
                    {itemsExpanded ? <><ChevronDown className="w-3.5 h-3.5" /> Collapse</> : <><ChevronUp className="w-3.5 h-3.5" /> Expand</>}
                  </Button>
                )}
              </div>
              <ScrollArea className="flex-1 min-h-0">
                <div className="w-full overflow-x-auto">
                <div className="min-w-max">
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
                      <TableRow key={iwp.uiId} data-testid={`row-item-${iwp.uiId}`}>
                        <TableCell className="text-muted-foreground text-xs">{index + 1}</TableCell>
                        <TableCell className="font-medium">{iwp.item.name}</TableCell>
                        <TableCell className="text-sm">
                          {getCategoryLabel(iwp.item.category)}
                          {(iwp.item as any).fulfilmentSource === "outsourced" && <Badge variant="secondary" className="text-[9px] ml-1 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" data-testid={`badge-outsourced-${iwp.uiId}`}>Outsourced</Badge>}
                          {iwp.item.gosRequired && <Badge variant="secondary" className="text-[9px] ml-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" data-testid={`badge-gos-${iwp.uiId}`}>GOS</Badge>}
                          {iwp.item.catDoorEnabled && <Badge variant="secondary" className="text-[9px] ml-1 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" data-testid={`badge-catdoor-${iwp.uiId}`}>Cat Door</Badge>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {getLayoutSummary(iwp.item)}
                          {iwp.item.openingDirection && iwp.item.openingDirection !== "none" && hasOpeningDirection(iwp.item.category, iwp.item.windowType) && (
                            <span className="ml-1 text-primary/70">• {getOpeningDirectionLabel(iwp.item.openingDirection)}</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{iwp.item.width} x {iwp.item.height}</TableCell>
                        <TableCell className="text-center font-mono text-sm" data-testid={`text-sqm-${iwp.uiId}`}>
                          {calcSqm(iwp.item.width, iwp.item.height, iwp.item.quantity, iwp.item)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm" data-testid={`text-price-${iwp.uiId}`}>
                          ${formatPrice(calcItemPrice(iwp.item))}
                        </TableCell>
                        <TableCell className="text-center">{iwp.item.quantity}</TableCell>
                        <TableCell className="text-center">
                          {(() => {
                            const src = getPrimaryPhotoSrc(iwp);
                            const photoCount = (iwp.photos || []).length;
                            if (src) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => setGalleryItemId(iwp.uiId)}
                                  className="inline-block relative"
                                  data-testid={`button-view-photo-${iwp.uiId}`}
                                >
                                  <img src={src} alt="Site photo" className="w-8 h-8 rounded object-cover border" />
                                  {photoCount > 1 && (
                                    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center" data-testid={`badge-photo-count-${iwp.uiId}`}>
                                      +{photoCount - 1}
                                    </span>
                                  )}
                                </button>
                              );
                            }
                            return <span className="text-xs text-muted-foreground">-</span>;
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <Button size="icon" variant="ghost" onClick={() => {
                              const { id, ...rest } = iwp.item;
                              handleDownloadPng({ ...rest, width: rest.width || 1200, height: rest.height || 1500, quantity: rest.quantity || 1, name: rest.name || "" }, iwp.uiId);
                            }}
                              title="Download PNG" data-testid={`button-download-${iwp.uiId}`}>
                              <Download className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => {
                              setPhotoTargetItemId(iwp.uiId);
                              photoInputRef.current?.click();
                            }}
                              title="Take Photo" data-testid={`button-photo-${iwp.uiId}`}>
                              <Camera className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => editItem(iwp)}
                              title="Edit" data-testid={`button-edit-${iwp.uiId}`}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => duplicateItem(iwp)}
                              title="Duplicate" data-testid={`button-duplicate-${iwp.uiId}`}>
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => deleteItem(iwp.uiId)}
                              title="Delete" data-testid={`button-delete-${iwp.uiId}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
                </div>
              </ScrollArea>
              {savedJobId && (
                <div className="border-t px-3 py-2 shrink-0">
                  <button
                    className="flex items-center gap-2 w-full text-left"
                    onClick={() => setExtrasOpen(o => !o)}
                    data-testid="button-extras-toggle-lg"
                  >
                    {extrasOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Commercial Extras</span>
                    {!extrasOpen && (
                      <span className="text-xs text-muted-foreground ml-1">
                        {[installationEnabled && "Installation", deliveryEnabled && "Delivery", removalEnabled && "Removal", rubbishEnabled && "Rubbish"].filter(Boolean).join(" · ") || "None"}
                      </span>
                    )}
                  </button>
                  {extrasOpen && (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Installation Labour</Label>
                        <Switch checked={installationEnabled} onCheckedChange={(v) => { setInstallationEnabled(v); persistJobField("installationEnabled", v); }} data-testid="switch-extras-installation-lg" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Delivery</Label>
                        <Switch checked={deliveryEnabled} onCheckedChange={(v) => { setDeliveryEnabled(v); persistJobField("deliveryEnabled", v); }} data-testid="switch-extras-delivery-lg" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Old Window/Door Removal</Label>
                        <Switch checked={removalEnabled} onCheckedChange={(v) => { setRemovalEnabled(v); persistJobField("removalEnabled", v); }} data-testid="switch-extras-removal-lg" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Rubbish / Waste Removal</Label>
                        <Switch checked={rubbishEnabled} onCheckedChange={(v) => { setRubbishEnabled(v); persistJobField("rubbishEnabled", v); if (v && (!rubbishTonnage || parseFloat(rubbishTonnage) <= 0)) { setRubbishTonnage("1"); persistJobField("rubbishTonnage", 1); } }} data-testid="switch-extras-rubbish-lg" />
                      </div>
                      <p className="text-xs text-muted-foreground">Detailed pricing & markup in Exec Summary.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {!isLargeScreen && mobileTab === "items" && (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="p-3 space-y-2">
              {items.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">No items yet. Switch to the Config tab to add items.</p>
                </div>
              ) : (
                <>
                  <div className="text-xs text-muted-foreground font-medium px-1 pb-1" data-testid="text-mobile-items-summary">
                    {items.length} item{items.length !== 1 ? "s" : ""} — {totalSqm} m² — ${formatPrice(totalPrice)}
                  </div>
                  {items.map((iwp, index) => {
                    const cardPhotoCount = (iwp.photos || []).length;
                    const cardPhotoSrc = getPrimaryPhotoSrc(iwp);
                    return (
                    <div key={iwp.uiId} className="border rounded-md bg-card p-3" data-testid={`card-item-${iwp.uiId}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-muted-foreground shrink-0">{index + 1}.</span>
                            <span className="font-medium text-sm truncate">{iwp.item.name}</span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">{getCategoryLabel(iwp.item.category)}</Badge>
                            {(iwp.item as any).fulfilmentSource === "outsourced" && <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">Outsourced</Badge>}
                            {iwp.item.gosRequired && <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">GOS</Badge>}
                            {iwp.item.catDoorEnabled && <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">Cat Door</Badge>}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-sm font-semibold font-mono" data-testid={`text-card-dims-${iwp.uiId}`}>
                            {iwp.item.width} × {iwp.item.height}
                            <span className="text-xs font-normal text-muted-foreground">Qty: {iwp.item.quantity}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                            {iwp.item.frameType && <span data-testid={`text-card-frame-${iwp.uiId}`}>{iwp.item.frameType}</span>}
                            {iwp.item.glassIguType && (
                              <span data-testid={`text-card-glass-${iwp.uiId}`}>
                                {[iwp.item.glassIguType, iwp.item.glassType].filter(Boolean).join(" / ")}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          {cardPhotoSrc ? (
                            <button type="button" onClick={() => setGalleryItemId(iwp.uiId)} className="relative" data-testid={`button-card-photo-${iwp.uiId}`}>
                              <img src={cardPhotoSrc} alt="Photo" className="w-10 h-10 rounded object-cover border" />
                              {cardPhotoCount > 1 && (
                                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">+{cardPhotoCount - 1}</span>
                              )}
                            </button>
                          ) : null}
                          <span className="text-sm font-medium">${formatPrice(calcItemPrice(iwp.item))}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-2 border-t pt-2">
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => editItem(iwp)} data-testid={`button-card-edit-${iwp.uiId}`}>
                          <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => duplicateItem(iwp)} data-testid={`button-card-duplicate-${iwp.uiId}`}>
                          <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => {
                          setPhotoTargetItemId(iwp.uiId);
                          photoInputRef.current?.click();
                        }} data-testid={`button-card-camera-${iwp.uiId}`}>
                          <Camera className="w-3.5 h-3.5 mr-1" /> {cardPhotoCount > 0 ? `Photos (${cardPhotoCount})` : "Photo"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => {
                          const { id, ...rest } = iwp.item;
                          handleDownloadPng({ ...rest, width: rest.width || 1200, height: rest.height || 1500, quantity: rest.quantity || 1, name: rest.name || "" }, iwp.uiId);
                        }} data-testid={`button-card-download-${iwp.uiId}`}>
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-destructive ml-auto" onClick={() => deleteItem(iwp.uiId)} data-testid={`button-card-delete-${iwp.uiId}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    );
                  })}
                  {savedJobId && (
                    <div className="mt-3 rounded-lg border bg-muted/30 p-3 space-y-2">
                      <button
                        className="flex items-center gap-2 w-full text-left"
                        onClick={() => setExtrasOpen(o => !o)}
                        data-testid="button-extras-toggle"
                      >
                        {extrasOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Commercial Extras</span>
                        {!extrasOpen && (
                          <span className="text-xs text-muted-foreground ml-1">
                            {[installationEnabled && "Installation", deliveryEnabled && "Delivery", removalEnabled && "Removal", rubbishEnabled && "Rubbish"].filter(Boolean).join(" · ") || "None"}
                          </span>
                        )}
                      </button>
                      {extrasOpen && (
                        <div className="space-y-3 pt-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium">Installation Labour</Label>
                            <Switch
                              checked={installationEnabled}
                              onCheckedChange={(v) => { setInstallationEnabled(v); persistJobField("installationEnabled", v); }}
                              data-testid="switch-extras-installation"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium">Delivery</Label>
                            <Switch
                              checked={deliveryEnabled}
                              onCheckedChange={(v) => { setDeliveryEnabled(v); persistJobField("deliveryEnabled", v); }}
                              data-testid="switch-extras-delivery"
                            />
                          </div>
                          {deliveryEnabled && (
                            <div className="pl-2 space-y-2">
                              <Select
                                value={deliveryMethodId}
                                onValueChange={(v) => { setDeliveryMethodId(v); setDeliveryCustom(""); persistJobField("deliveryMethod", v); persistJobField("deliveryAmount", null); }}
                              >
                                <SelectTrigger className="h-8 text-xs" data-testid="select-extras-delivery-method">
                                  <SelectValue placeholder="Method" />
                                </SelectTrigger>
                                <SelectContent>
                                  {deliveryRates.map((r) => {
                                    const d = r.data as any;
                                    const sell = d.sellNzd ?? d.rateNzd ?? 0;
                                    return <SelectItem key={r.id} value={r.id}>{d.name}{sell > 0 ? ` ($${sell})` : " (Custom)"}</SelectItem>;
                                  })}
                                </SelectContent>
                              </Select>
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <Label className="text-xs">Custom Cost ($)</Label>
                                  <Input
                                    type="number"
                                    className="h-8 text-xs"
                                    placeholder="—"
                                    value={deliveryCustom}
                                    onChange={(e) => { setDeliveryCustom(e.target.value); const val = parseFloat(e.target.value); persistJobField("deliveryAmount", val > 0 ? val : null); }}
                                    data-testid="input-extras-delivery-custom"
                                  />
                                </div>
                                <div className="w-20">
                                  <Label className="text-xs">Markup (%)</Label>
                                  <Input
                                    type="number"
                                    className="h-8 text-xs"
                                    value={deliveryMarkup}
                                    onChange={(e) => { setDeliveryMarkup(e.target.value); const val = parseFloat(e.target.value); persistJobField("deliveryMarkup", val >= 0 ? val : null); }}
                                    data-testid="input-extras-delivery-markup"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium">Old Window / Door Removal</Label>
                            <Switch
                              checked={removalEnabled}
                              onCheckedChange={(v) => { setRemovalEnabled(v); persistJobField("removalEnabled", v); }}
                              data-testid="switch-extras-removal"
                            />
                          </div>
                          {removalEnabled && (
                            <div className="pl-2">
                              <Label className="text-xs">Markup (%)</Label>
                              <Input
                                type="number"
                                className="h-8 text-xs"
                                value={removalMarkup}
                                onChange={(e) => { setRemovalMarkup(e.target.value); const val = parseFloat(e.target.value); persistJobField("removalMarkup", val >= 0 ? val : null); }}
                                data-testid="input-extras-removal-markup"
                              />
                              <p className="text-xs text-muted-foreground mt-1">Rate is per-item based on window size tier. Detailed breakdown in Exec Summary.</p>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium">Rubbish / Waste Removal</Label>
                            <Switch
                              checked={rubbishEnabled}
                              onCheckedChange={(v) => { setRubbishEnabled(v); persistJobField("rubbishEnabled", v); if (v && (!rubbishTonnage || parseFloat(rubbishTonnage) <= 0)) { setRubbishTonnage("1"); persistJobField("rubbishTonnage", 1); } }}
                              data-testid="switch-extras-rubbish"
                            />
                          </div>
                          {rubbishEnabled && (
                            <div className="pl-2">
                              <Label className="text-xs">Estimated Tonnage</Label>
                              <Input
                                type="number"
                                className="h-8 text-xs"
                                placeholder="e.g. 0.5"
                                value={rubbishTonnage}
                                onChange={(e) => { setRubbishTonnage(e.target.value); const val = parseFloat(e.target.value); persistJobField("rubbishTonnage", val > 0 ? val : null); }}
                                data-testid="input-extras-rubbish-tonnage"
                              />
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground pt-1 border-t">Full pricing detail for all extras is in the Exec Summary.</p>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="pt-2 space-y-2">
                    <Button variant="outline" className="w-full" onClick={startNewItem} data-testid="button-items-add-next">
                      <Plus className="w-4 h-4 mr-1.5" /> Add Next Item
                    </Button>
                    {savedJobId && (
                      <Button className="w-full" onClick={() => guardedNavigate(`/job/${savedJobId}/exec-summary`)} data-testid="button-items-review-estimate">
                        <FileText className="w-4 h-4 mr-1.5" /> Review & Generate Estimate
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {offscreenConfig && (
        <div style={{ position: "absolute", left: "-9999px", top: "-9999px", width: "1200px", height: "900px" }}>
          <DrawingCanvas ref={offscreenDrawingRef} config={offscreenConfig} />
        </div>
      )}

      <Dialog open={showLeaveDialog} onOpenChange={(open) => { if (!open && !isSaveAndLeaving) { setShowLeaveDialog(false); setPendingNavigateTo(null); } }}>
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
            <Button variant="outline" disabled={isSaveAndLeaving} onClick={() => { setShowLeaveDialog(false); setPendingNavigateTo(null); }} data-testid="button-leave-cancel">
              Cancel
            </Button>
            <Button variant="destructive" disabled={isSaveAndLeaving} onClick={() => { const dest = pendingNavigateTo || "/"; setShowLeaveDialog(false); setHasUnsavedChanges(false); setPendingNavigateTo(null); navigate(dest); }} data-testid="button-leave-discard">
              Discard
            </Button>
            <Button disabled={isSaveAndLeaving} onClick={async () => { const dest = pendingNavigateTo || "/"; setIsSaveAndLeaving(true); try { const ok = await saveJob(); if (ok) { setShowLeaveDialog(false); setPendingNavigateTo(null); navigate(dest); } } finally { setIsSaveAndLeaving(false); } }} data-testid="button-leave-save">
              {isSaveAndLeaving ? (<><span className="w-4 h-4 mr-1.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" /> Saving...</>) : (<><Save className="w-4 h-4 mr-1.5" /> Save & Leave</>)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!galleryItemId} onOpenChange={() => setGalleryItemId(null)}>
        <DialogContent className="max-w-2xl" data-testid="dialog-photo-gallery">
          <DialogHeader>
            <DialogTitle>Item Photos</DialogTitle>
          </DialogHeader>
          {galleryItemId && (() => {
            const iwp = items.find(i => i.uiId === galleryItemId);
            if (!iwp) return null;
            const photos = iwp.photos || [];
            const legacySrc = (!photos.length && iwp.photo?.startsWith("data:image/")) ? iwp.photo : null;
            return (
              <div className="space-y-4">
                {legacySrc && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Legacy photo (read-only)</p>
                    <img src={legacySrc} alt="Legacy photo" className="w-full max-h-64 object-contain rounded border" />
                  </div>
                )}
                {photos.length === 0 && !legacySrc && (
                  <p className="text-sm text-muted-foreground text-center py-4">No photos yet. Use the camera button to add photos.</p>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {photos.map((p, idx) => (
                    <div key={p.key} className={`relative rounded-lg border-2 overflow-hidden ${p.isPrimary ? "border-primary" : "border-border"}`} data-testid={`gallery-photo-${idx}`}>
                      <img
                        src={`/api/item-photos/${p.key}`}
                        alt={p.caption || `Photo ${idx + 1}`}
                        className="w-full h-32 object-cover cursor-pointer"
                        onClick={() => {
                          setViewerSrc(`/api/item-photos/${p.key}`);
                          setViewerTitle(p.caption || `Photo ${idx + 1}`);
                        }}
                      />
                      {p.isPrimary && (
                        <Badge className="absolute top-1 left-1 text-[10px] px-1 py-0" data-testid={`badge-primary-${idx}`}>Primary</Badge>
                      )}
                      {p.includeInCustomerPdf && (
                        <Badge variant="secondary" className="absolute top-1 right-1 text-[10px] px-1 py-0" data-testid={`badge-pdf-${idx}`}>PDF</Badge>
                      )}
                      <div className="flex items-center justify-between p-1.5 bg-card">
                        <div className="flex gap-1">
                          {!p.isPrimary && (
                            <Button size="sm" variant="ghost" className="h-6 text-xs px-1.5" data-testid={`button-set-primary-${idx}`}
                              onClick={() => {
                                setItems(prev => prev.map(i => {
                                  if (i.uiId !== galleryItemId) return i;
                                  return { ...i, photos: (i.photos || []).map(ph => ({ ...ph, isPrimary: ph.key === p.key })) };
                                }));
                                setHasUnsavedChanges(true);
                              }}>
                              Set Primary
                            </Button>
                          )}
                          <Button size="sm" variant={p.includeInCustomerPdf ? "secondary" : "ghost"} className="h-6 text-xs px-1.5" data-testid={`button-toggle-pdf-${idx}`}
                            onClick={() => {
                              setItems(prev => prev.map(i => {
                                if (i.uiId !== galleryItemId) return i;
                                return { ...i, photos: (i.photos || []).map(ph => ph.key === p.key ? { ...ph, includeInCustomerPdf: !ph.includeInCustomerPdf } : ph) };
                              }));
                              setHasUnsavedChanges(true);
                            }}>
                            {p.includeInCustomerPdf ? "In PDF" : "Add to PDF"}
                          </Button>
                        </div>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" data-testid={`button-delete-photo-${idx}`}
                          onClick={() => {
                            setItems(prev => prev.map(i => {
                              if (i.uiId !== galleryItemId) return i;
                              let updated = (i.photos || []).filter(ph => ph.key !== p.key);
                              if (updated.length > 0 && p.isPrimary) {
                                updated = updated.map((ph, j) => j === 0 ? { ...ph, isPrimary: true } : ph);
                              }
                              return { ...i, photos: updated };
                            }));
                            setHasUnsavedChanges(true);
                          }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <Button variant="outline" size="sm" data-testid="button-gallery-add-photo"
                    onClick={() => {
                      setPhotoTargetItemId(galleryItemId);
                      photoInputRef.current?.click();
                    }}>
                    <Camera className="w-4 h-4 mr-1.5" /> Add Photo
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setGalleryItemId(null)}>Close</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <MediaViewer
        open={!!viewerSrc}
        onOpenChange={(open) => { if (!open) setViewerSrc(null); }}
        src={viewerSrc || ""}
        alt={viewerTitle}
        title={viewerTitle}
        downloadFilename={`${viewerTitle.replace(/\s+/g, "_")}.png`}
      />
    </div>
  );
}
