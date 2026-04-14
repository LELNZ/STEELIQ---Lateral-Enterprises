import { useState, useEffect, useMemo, Fragment } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { LLLifecycleStripFromEstimate } from "@/components/ll-lifecycle-strip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Plus, Pencil, Trash2, Save, Eye, ArrowLeft, ArrowRightCircle, Loader2, ChevronDown, ChevronRight, Calculator, ShieldCheck, AlertTriangle, FlaskConical } from "lucide-react";
import type { LaserQuoteItem, LLPricingSettings, DivisionSettings, LLPricingProfile } from "@shared/schema";
import type { LaserSnapshotItem } from "@shared/estimate-snapshot";
import {
  computeLLPricing,
  resolveRatesFromSettings,
  type LLMaterialTruth,
  type LLPricingBreakdown,
  type LLGovernedInputs,
} from "@/lib/ll-pricing";
import type { LLGasCostInput, LLConsumablesCostInput } from "@shared/schema";

interface SheetMaterialRef {
  id: string;
  supplierName: string;
  materialFamily: string;
  grade: string;
  finish: string;
  thickness: string;
  sheetLength: string;
  sheetWidth: string;
  pricePerSheetExGst: string;
  pricePerKg: string | null;
  supplierSku: string;
  supplierCategory: string;
  formType: string;
  stockBehaviour: string;
  densityKgM3: string | null;
}

function makeEmptyItem(settings: LLPricingSettings | null | undefined): Omit<LaserQuoteItem, "id"> {
  const rates = resolveRatesFromSettings(settings);
  return {
    itemRef: "",
    title: "",
    quantity: 1,
    materialType: "",
    materialGrade: "",
    thickness: 0,
    length: 0,
    width: 0,
    finish: "",
    customerNotes: "",
    internalNotes: "",
    unitPrice: 0,
    llSheetMaterialId: "",
    coilLengthMm: 0,
    cutLengthMm: 0,
    pierceCount: 0,
    setupMinutes: rates.defaultSetupMinutes,
    handlingMinutes: rates.defaultHandlingMinutes,
    markupPercent: rates.defaultMarkupPercent,
    utilisationFactor: rates.defaultUtilisationFactor,
    geometrySource: "manual",
  };
}

function findMatchingMaterial(
  materials: SheetMaterialRef[],
  item: { materialType: string; materialGrade: string; finish: string; thickness: number; llSheetMaterialId: string }
): SheetMaterialRef | undefined {
  if (item.llSheetMaterialId) {
    const byId = materials.find(m => m.id === item.llSheetMaterialId);
    if (byId) return byId;
  }
  const candidates = materials.filter(
    m =>
      m.materialFamily === item.materialType &&
      m.grade === item.materialGrade &&
      m.finish === item.finish &&
      parseFloat(m.thickness) === item.thickness
  );
  if (candidates.length === 1) return candidates[0];
  return undefined;
}

function materialToTruth(m: SheetMaterialRef): LLMaterialTruth {
  return {
    id: m.id,
    supplierName: m.supplierName,
    materialFamily: m.materialFamily,
    grade: m.grade,
    finish: m.finish,
    thickness: parseFloat(m.thickness),
    sheetLength: parseFloat(m.sheetLength),
    sheetWidth: parseFloat(m.sheetWidth),
    pricePerSheetExGst: parseFloat(m.pricePerSheetExGst),
    stockBehaviour: m.stockBehaviour || "sheet",
    pricePerKg: parseFloat(m.pricePerKg || "0"),
    densityKgM3: parseFloat(m.densityKgM3 || "0"),
  };
}

function computeItemPricing(
  item: Omit<LaserQuoteItem, "id"> | LaserQuoteItem,
  materials: SheetMaterialRef[],
  settings?: LLPricingSettings | null,
  governed?: LLGovernedInputs,
): LLPricingBreakdown {
  const matched = findMatchingMaterial(materials, item);
  return computeLLPricing({
    material: matched ? materialToTruth(matched) : null,
    partLengthMm: item.length,
    partWidthMm: item.width,
    quantity: item.quantity,
    cutLengthMm: item.cutLengthMm,
    pierceCount: item.pierceCount,
    setupMinutes: item.setupMinutes,
    handlingMinutes: item.handlingMinutes,
    markupPercent: item.markupPercent,
    utilisationFactor: item.utilisationFactor,
    coilLengthMm: item.coilLengthMm || 0,
  }, settings, governed);
}

function itemToSnapshotItem(
  item: LaserQuoteItem,
  index: number,
  materials: SheetMaterialRef[],
  settings?: LLPricingSettings | null,
  governed?: LLGovernedInputs,
): LaserSnapshotItem {
  const pricing = computeItemPricing(item, materials, settings, governed);
  const matched = findMatchingMaterial(materials, item);
  const matTruth = matched ? materialToTruth(matched) : null;
  return {
    itemNumber: index + 1,
    itemRef: item.itemRef,
    title: item.title,
    quantity: item.quantity,
    materialType: item.materialType,
    materialGrade: item.materialGrade,
    thickness: item.thickness,
    length: item.length,
    width: item.width,
    finish: item.finish,
    customerNotes: item.customerNotes,
    internalNotes: item.internalNotes,
    unitPrice: pricing.unitSell,
    photos: [],
    llSheetMaterialId: item.llSheetMaterialId,
    supplierName: matTruth?.supplierName || "",
    sheetLength: matTruth?.sheetLength || 0,
    sheetWidth: matTruth?.sheetWidth || 0,
    pricePerSheetExGst: matTruth?.pricePerSheetExGst || 0,
    cutLengthMm: item.cutLengthMm,
    coilLengthMm: item.coilLengthMm ?? 0,
    stockBehaviour: matTruth?.stockBehaviour || "sheet",
    pricePerKg: matTruth?.pricePerKg || 0,
    densityKgM3: matTruth?.densityKgM3 || 0,
    pierceCount: item.pierceCount,
    setupMinutes: item.setupMinutes,
    handlingMinutes: item.handlingMinutes,
    markupPercent: item.markupPercent,
    utilisationFactor: item.utilisationFactor,
    estimatedSheets: pricing.estimatedSheets,
    materialCostTotal: pricing.materialCostTotal,
    processCostTotal: pricing.processCostTotal,
    setupHandlingCost: pricing.setupHandlingCost,
    internalCostSubtotal: pricing.internalCostSubtotal,
    markupAmount: pricing.markupAmount,
    sellTotal: pricing.sellTotal,
    geometrySource: item.geometrySource ?? "manual",
    operations: [{ type: "laser" as const, enabled: true, costTotal: pricing.internalCostSubtotal }],
  };
}

function snapshotItemToItem(si: LaserSnapshotItem, settings?: LLPricingSettings | null): LaserQuoteItem {
  const rates = resolveRatesFromSettings(settings);
  return {
    id: crypto.randomUUID(),
    itemRef: si.itemRef,
    title: si.title,
    quantity: si.quantity,
    materialType: si.materialType,
    materialGrade: si.materialGrade,
    thickness: si.thickness,
    length: si.length,
    width: si.width,
    finish: si.finish,
    customerNotes: si.customerNotes,
    internalNotes: si.internalNotes,
    unitPrice: si.unitPrice,
    llSheetMaterialId: si.llSheetMaterialId ?? "",
    cutLengthMm: si.cutLengthMm ?? 0,
    coilLengthMm: si.coilLengthMm ?? 0,
    pierceCount: si.pierceCount ?? 0,
    setupMinutes: si.setupMinutes ?? rates.defaultSetupMinutes,
    handlingMinutes: si.handlingMinutes ?? rates.defaultHandlingMinutes,
    markupPercent: si.markupPercent ?? rates.defaultMarkupPercent,
    utilisationFactor: si.utilisationFactor ?? rates.defaultUtilisationFactor,
    geometrySource: (si as any).geometrySource ?? "manual",
  };
}

function PricingBreakdownPanel({ breakdown, supplierName }: { breakdown: LLPricingBreakdown; supplierName: string }) {
  const isTimeBased = breakdown.processMode === "time-based";
  const rows: Array<{ label: string; value: string; bold?: boolean }> = [
    { label: "Supplier", value: supplierName || "—" },
    { label: "Sheet Area", value: breakdown.sheetAreaMm2 > 0 ? `${(breakdown.sheetAreaMm2 / 1_000_000).toFixed(3)} m²` : "—" },
    { label: "Part Area (each)", value: breakdown.partAreaMm2 > 0 ? `${(breakdown.partAreaMm2 / 1_000_000).toFixed(4)} m²` : "—" },
    { label: "Parts/Sheet", value: breakdown.partsPerSheet > 0 ? `${breakdown.partsPerSheet}` : "—" },
    { label: "Est. Sheets Required", value: breakdown.estimatedSheets > 0 ? `${breakdown.estimatedSheets} sheet${breakdown.estimatedSheets !== 1 ? "s" : ""}` : "—" },
    { label: "Material Cost", value: `$${breakdown.materialCostTotal.toFixed(2)}` },
  ];

  if (isTimeBased) {
    rows.push(
      { label: "Machine Time", value: `${breakdown.machineTimeMinutes.toFixed(1)} min` },
      { label: "Machine Cost", value: `$${breakdown.machineTimeCost.toFixed(2)}` },
      { label: `Gas Cost${breakdown.gasCostPerLitre ? ` @ $${breakdown.gasCostPerLitre.toFixed(6)}/L` : ""}`, value: `$${breakdown.gasCost.toFixed(2)}` },
      { label: `Consumables${breakdown.consumablesCostPerHourRate ? ` @ $${breakdown.consumablesCostPerHourRate.toFixed(2)}/hr` : ""}`, value: `$${breakdown.consumablesCost.toFixed(2)}` },
    );
  } else {
    rows.push(
      { label: "Cut Cost (per unit)", value: `$${breakdown.cutCost.toFixed(2)}` },
      { label: "Pierce Cost (per unit)", value: `$${breakdown.pierceCost.toFixed(2)}` },
    );
  }

  rows.push(
    { label: `Process Cost (${isTimeBased ? "time" : "flat"})`, value: `$${breakdown.processCostTotal.toFixed(2)}` },
    { label: "Setup/Handling", value: `$${breakdown.setupHandlingCost.toFixed(2)}` },
  );

  if (breakdown.minimumLineChargeApplied) {
    rows.push({ label: "Min. Line Charge Applied", value: `$${breakdown.internalCostSubtotal.toFixed(2)}`, bold: true });
  } else {
    rows.push({ label: "Internal Subtotal", value: `$${breakdown.internalCostSubtotal.toFixed(2)}`, bold: true });
  }

  rows.push(
    { label: "Unit Cost", value: `$${breakdown.unitCost.toFixed(2)}`, bold: true },
    { label: `Markup (${breakdown.markupPercent}%)`, value: `$${breakdown.markupAmount.toFixed(2)}` },
    { label: "Sell Total", value: `$${breakdown.sellTotal.toFixed(2)}`, bold: true },
    { label: "Unit Sell", value: `$${breakdown.unitSell.toFixed(2)}`, bold: true },
  );
  return (
    <div className="bg-muted/50 border rounded-md p-3 space-y-1" data-testid="pricing-breakdown-panel">
      <div className="flex items-center gap-1.5 mb-2">
        <Calculator className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Internal Pricing Breakdown</span>
        <Badge variant={isTimeBased ? "default" : "secondary"} className="text-[10px] px-1.5 py-0 h-4 ml-auto" data-testid="process-mode-badge">
          {isTimeBased ? "Time-Based" : "Flat Rate"}
        </Badge>
      </div>
      {isTimeBased && (breakdown.gasSource || breakdown.consumablesSource) && (
        <div className="flex flex-wrap gap-1 mb-1.5" data-testid="governed-source-badges">
          {breakdown.gasSource && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-blue-50 text-blue-700 border-blue-200" data-testid="gas-source-badge">
              Gas: {breakdown.gasSource}
            </Badge>
          )}
          {breakdown.consumablesSource && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-amber-50 text-amber-700 border-amber-200" data-testid="consumables-source-badge">
              Consumables: {breakdown.consumablesSource}
            </Badge>
          )}
        </div>
      )}
      {rows.map((r, i) => (
        <div key={i} className={`flex justify-between text-xs ${r.bold ? 'font-semibold border-t pt-1 mt-1' : 'text-muted-foreground'}`}>
          <span>{r.label}</span>
          <span className="font-mono">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function LaserQuoteBuilder({ estimateMode }: { estimateMode?: boolean } = {}) {
  const params = useParams<{ id?: string }>();
  const quoteId = estimateMode ? undefined : params.id;
  const estimateId = estimateMode ? params.id : undefined;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "owner";

  const [items, setItems] = useState<LaserQuoteItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [projectAddress, setProjectAddress] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LaserQuoteItem | null>(null);
  const [formData, setFormData] = useState<Omit<LaserQuoteItem, "id">>(makeEmptyItem(null));
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const isEditMode = !!quoteId;
  const isEstimateEdit = estimateMode && !!estimateId;

  const { data: llDivisionSettings } = useQuery<DivisionSettings>({
    queryKey: ["/api/settings/divisions", "LL"],
    staleTime: Infinity,
  });

  const { data: activePricingProfile } = useQuery<LLPricingProfile | null>({
    queryKey: ["/api/ll-pricing-profiles", "active"],
    queryFn: () => fetch("/api/ll-pricing-profiles/active", { credentials: "include" }).then(r => r.json()),
    staleTime: 60_000,
  });

  const llPricingSettings = (activePricingProfile?.llPricingSettingsJson ?? llDivisionSettings?.llPricingSettingsJson ?? null) as LLPricingSettings | null;
  const pricingProfileId = activePricingProfile?.id ?? null;
  const pricingProfileLabel = activePricingProfile ? `${activePricingProfile.profileName} (${activePricingProfile.versionLabel})` : null;

  const { data: sheetMaterials = [] } = useQuery<SheetMaterialRef[]>({
    queryKey: ["/api/ll-sheet-materials", "active", "quoteable"],
    queryFn: () => fetch("/api/ll-sheet-materials?active=true&quoteable=true", { credentials: "include" }).then(r => r.json()),
  });

  const { data: activeGasInputs = [] } = useQuery<LLGasCostInput[]>({
    queryKey: ["/api/ll-gas-cost-inputs", "active"],
    queryFn: () => fetch("/api/ll-gas-cost-inputs/active", { credentials: "include" }).then(r => r.json()),
    staleTime: 60_000,
  });

  const { data: activeConsumableInputs = [] } = useQuery<LLConsumablesCostInput[]>({
    queryKey: ["/api/ll-consumables-cost-inputs", "active"],
    queryFn: () => fetch("/api/ll-consumables-cost-inputs/active", { credentials: "include" }).then(r => r.json()),
    staleTime: 60_000,
  });

  const governedInputs: LLGovernedInputs = useMemo(() => ({
    gasInputs: activeGasInputs.length > 0 ? activeGasInputs : undefined,
    consumableInputs: activeConsumableInputs.length > 0 ? activeConsumableInputs : undefined,
  }), [activeGasInputs, activeConsumableInputs]);

  const materialFamilies = useMemo(() =>
    [...new Set(sheetMaterials.map(m => m.materialFamily))].sort(),
    [sheetMaterials]
  );

  const gradesForFamily = useMemo(() => {
    if (!formData.materialType) return [];
    return [...new Set(
      sheetMaterials
        .filter(m => m.materialFamily === formData.materialType)
        .map(m => m.grade)
    )].sort();
  }, [sheetMaterials, formData.materialType]);

  const finishesForSelection = useMemo(() => {
    if (!formData.materialType || !formData.materialGrade) return [];
    return [...new Set(
      sheetMaterials
        .filter(m => m.materialFamily === formData.materialType && m.grade === formData.materialGrade)
        .map(m => m.finish)
    )].sort();
  }, [sheetMaterials, formData.materialType, formData.materialGrade]);

  const thicknessesForSelection = useMemo(() => {
    if (!formData.materialType || !formData.materialGrade) return [];
    return [...new Set(
      sheetMaterials
        .filter(m => m.materialFamily === formData.materialType && m.grade === formData.materialGrade && (!formData.finish || m.finish === formData.finish))
        .map(m => m.thickness)
    )].sort((a, b) => parseFloat(a) - parseFloat(b));
  }, [sheetMaterials, formData.materialType, formData.materialGrade, formData.finish]);

  const matchingMaterialsForThickness = useMemo(() => {
    if (!formData.materialType || !formData.materialGrade || !formData.thickness) return [];
    return sheetMaterials.filter(
      m => m.materialFamily === formData.materialType &&
        m.grade === formData.materialGrade &&
        (!formData.finish || m.finish === formData.finish) &&
        parseFloat(m.thickness) === formData.thickness
    );
  }, [sheetMaterials, formData.materialType, formData.materialGrade, formData.finish, formData.thickness]);

  const sheetSizesForSelection = useMemo(() => {
    return matchingMaterialsForThickness
      .filter(m => m.stockBehaviour !== "coil")
      .sort((a, b) => {
        const areaA = parseFloat(a.sheetLength) * parseFloat(a.sheetWidth);
        const areaB = parseFloat(b.sheetLength) * parseFloat(b.sheetWidth);
        return areaA - areaB;
      });
  }, [matchingMaterialsForThickness]);

  const coilOptionsForSelection = useMemo(() => {
    return matchingMaterialsForThickness
      .filter(m => m.stockBehaviour === "coil")
      .sort((a, b) => parseFloat(a.sheetWidth) - parseFloat(b.sheetWidth));
  }, [matchingMaterialsForThickness]);

  const selectedMaterialRow = useMemo(() => {
    if (formData.llSheetMaterialId) {
      const byId = sheetMaterials.find(m => m.id === formData.llSheetMaterialId);
      if (byId) return byId;
    }
    if (sheetSizesForSelection.length === 1 && coilOptionsForSelection.length === 0) return sheetSizesForSelection[0];
    return undefined;
  }, [sheetMaterials, sheetSizesForSelection, coilOptionsForSelection, formData.llSheetMaterialId]);

  const dialogPricing = useMemo(() => {
    return computeItemPricing(formData, sheetMaterials, llPricingSettings, governedInputs);
  }, [formData, sheetMaterials, llPricingSettings, governedInputs]);

  const { data: quoteData, isLoading: quoteLoading } = useQuery<any>({
    queryKey: ["/api/quotes", quoteId],
    enabled: isEditMode,
  });

  const { data: estimateData, isLoading: estimateLoading } = useQuery<any>({
    queryKey: ["/api/laser-estimates", estimateId],
    enabled: isEstimateEdit,
  });

  const demoToggleMutation = useMutation({
    mutationFn: async (isDemoRecord: boolean) => {
      const res = await apiRequest("PATCH", `/api/laser-estimates/${estimateId}/demo-flag`, { isDemoRecord });
      if (!res.ok) throw new Error("Failed to update demo flag");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/laser-estimates", estimateId] });
      queryClient.invalidateQueries({ queryKey: ["/api/laser-estimates"] });
      toast({ title: "Demo flag updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (quoteData && isEditMode) {
      setCustomerName(quoteData.customer || "");
      const revisions = quoteData.revisions || [];
      const currentRev = revisions.find((r: any) => r.id === quoteData.currentRevisionId) || revisions[revisions.length - 1];
      if (currentRev) {
        const raw = currentRev.snapshotJson;
        const snapshot = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (snapshot) {
          setProjectAddress(snapshot.projectAddress || "");
          if (snapshot.laserItems?.length) {
            setItems(snapshot.laserItems.map((si: LaserSnapshotItem) => snapshotItemToItem(si, llPricingSettings)));
          }
        }
      }
    }
  }, [quoteData, isEditMode]);

  useEffect(() => {
    if (estimateData && isEstimateEdit) {
      setCustomerName(estimateData.customerName || "");
      setProjectAddress(estimateData.projectAddress || "");
      const savedItems = estimateData.itemsJson;
      if (Array.isArray(savedItems) && savedItems.length > 0) {
        setItems(savedItems.map((it: any) => ({ ...it, id: it.id || crypto.randomUUID() })));
      }
    }
  }, [estimateData, isEstimateEdit]);

  const itemPricings = useMemo(() => {
    const map = new Map<string, LLPricingBreakdown>();
    for (const item of items) {
      map.set(item.id, computeItemPricing(item, sheetMaterials, llPricingSettings, governedInputs));
    }
    return map;
  }, [items, sheetMaterials, llPricingSettings, governedInputs]);

  const totalValue = useMemo(() => {
    let total = 0;
    for (const [, p] of itemPricings) {
      total += p.sellTotal;
    }
    return total;
  }, [itemPricings]);

  const buildSnapshot = () => {
    const laserItems = items.map((item, idx) => itemToSnapshotItem(item, idx, sheetMaterials, llPricingSettings, governedInputs));
    return {
      customer: customerName,
      projectAddress,
      items: [],
      laserItems,
      totals: {
        cost: Array.from(itemPricings.values()).reduce((s, p) => s + p.internalCostSubtotal, 0),
        sell: totalValue,
        grossProfit: totalValue - Array.from(itemPricings.values()).reduce((s, p) => s + p.internalCostSubtotal, 0),
        grossMargin: totalValue > 0
          ? ((totalValue - Array.from(itemPricings.values()).reduce((s, p) => s + p.internalCostSubtotal, 0)) / totalValue) * 100
          : 0,
        totalLabourHours: 0,
        gpPerHour: 0,
      },
      totalsBreakdown: {
        itemsSubtotal: totalValue,
        installationTotal: 0,
        deliveryTotal: 0,
        removalTotal: 0,
        rubbishTotal: 0,
        subtotalExclGst: totalValue,
        gstAmount: totalValue * 0.15,
        totalInclGst: totalValue * 1.15,
      },
      specDictionaryVersion: 1,
    };
  };

  const createQuoteMutation = useMutation({
    mutationFn: async () => {
      const snapshot = buildSnapshot();
      const res = await apiRequest("POST", "/api/quotes", {
        snapshot,
        customer: customerName,
        divisionCode: "LL",
        mode: "new_quote",
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Quote created", description: `${data.quote.number} created successfully` });
      navigate(`/laser-quote/${data.quote.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const saveRevisionMutation = useMutation({
    mutationFn: async () => {
      const snapshot = buildSnapshot();
      const res = await apiRequest("POST", `/api/quotes/${quoteId}/revisions`, { snapshot });
      return res.json();
    },
    onSuccess: () => {
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Saved", description: "Quote revision saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const createEstimateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/laser-estimates", {
        customerName: customerName.trim(),
        projectAddress,
        itemsJson: items,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/laser-estimates"] });
      toast({ title: "Estimate saved", description: `${data.estimateNumber} created successfully` });
      navigate(`/laser-estimate/${data.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateEstimateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/laser-estimates/${estimateId}`, {
        customerName: customerName.trim(),
        projectAddress,
        itemsJson: items,
      });
      return res.json();
    },
    onSuccess: () => {
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/laser-estimates", estimateId] });
      queryClient.invalidateQueries({ queryKey: ["/api/laser-estimates"] });
      toast({ title: "Saved", description: "Estimate updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const generateQuoteFromEstimateMutation = useMutation({
    mutationFn: async () => {
      const snapshot = buildSnapshot();
      const res = await apiRequest("POST", "/api/quotes", {
        snapshot,
        sourceLaserEstimateId: estimateId,
        customer: customerName,
        divisionCode: "LL",
        mode: "new_quote",
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/laser-estimates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/laser-estimates", estimateId] });
      toast({ title: "Quote generated", description: `${data.quote.number} created from estimate` });
      navigate(`/laser-quote/${data.quote.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!customerName.trim()) {
      toast({ title: "Required", description: "Customer name is required", variant: "destructive" });
      return;
    }
    if (!estimateMode && items.length > 0) {
      const itemsMissingMaterial = items.filter(i => !i.llSheetMaterialId);
      if (itemsMissingMaterial.length > 0) {
        toast({ title: "Material Required", description: `${itemsMissingMaterial.length} item(s) have no material selected (${itemsMissingMaterial.map(i => i.itemRef || i.title).join(", ")}). Edit each item and select a material before saving.`, variant: "destructive" });
        return;
      }
      const unmatchedItems = items.filter(i => i.llSheetMaterialId && !sheetMaterials.find(m => m.id === i.llSheetMaterialId));
      if (unmatchedItems.length > 0) {
        toast({ title: "Stale Material", description: `${unmatchedItems.length} item(s) reference a material row that no longer exists (${unmatchedItems.map(i => i.itemRef || i.title).join(", ")}). Edit each item and reselect the material.`, variant: "destructive" });
        return;
      }
    }
    if (estimateMode) {
      if (isEstimateEdit) {
        updateEstimateMutation.mutate();
      } else {
        createEstimateMutation.mutate();
      }
    } else if (isEditMode) {
      saveRevisionMutation.mutate();
    } else {
      createQuoteMutation.mutate();
    }
  };

  const handleGenerateQuote = () => {
    if (!customerName.trim()) {
      toast({ title: "Required", description: "Customer name is required", variant: "destructive" });
      return;
    }
    if (items.length === 0) {
      toast({ title: "Required", description: "Add at least one item before generating a quote", variant: "destructive" });
      return;
    }
    const itemsMissingMaterial = items.filter(i => !i.llSheetMaterialId);
    if (itemsMissingMaterial.length > 0) {
      toast({ title: "Material Required", description: `${itemsMissingMaterial.length} item(s) have no material selected (${itemsMissingMaterial.map(i => i.itemRef || i.title).join(", ")}). Edit each item and select a material before generating a quote.`, variant: "destructive" });
      return;
    }
    const unmatchedItems = items.filter(i => i.llSheetMaterialId && !sheetMaterials.find(m => m.id === i.llSheetMaterialId));
    if (unmatchedItems.length > 0) {
      toast({ title: "Stale Material", description: `${unmatchedItems.length} item(s) reference a material row that no longer exists (${unmatchedItems.map(i => i.itemRef || i.title).join(", ")}). Edit each item and reselect the material.`, variant: "destructive" });
      return;
    }
    generateQuoteFromEstimateMutation.mutate();
  };

  const openAddDialog = () => {
    setEditingItem(null);
    setFormData(makeEmptyItem(llPricingSettings));
    setDialogOpen(true);
  };

  const openEditDialog = (item: LaserQuoteItem) => {
    setEditingItem(item);
    setFormData({
      itemRef: item.itemRef,
      title: item.title,
      quantity: item.quantity,
      materialType: item.materialType,
      materialGrade: item.materialGrade,
      thickness: item.thickness,
      length: item.length,
      width: item.width,
      finish: item.finish,
      customerNotes: item.customerNotes,
      internalNotes: item.internalNotes,
      unitPrice: item.unitPrice,
      llSheetMaterialId: item.llSheetMaterialId,
      cutLengthMm: item.cutLengthMm,
      pierceCount: item.pierceCount,
      setupMinutes: item.setupMinutes,
      handlingMinutes: item.handlingMinutes,
      markupPercent: item.markupPercent,
      utilisationFactor: item.utilisationFactor,
    });
    setDialogOpen(true);
  };

  const handleDialogSave = () => {
    if (!formData.itemRef.trim() || !formData.title.trim()) {
      toast({ title: "Required", description: "Item reference and title are required", variant: "destructive" });
      return;
    }
    const materialId = selectedMaterialRow?.id || formData.llSheetMaterialId;
    if (!materialId) {
      toast({ title: "Material Required", description: "A material must be selected before saving. Please choose a material family, grade, finish, thickness, and sheet size or coil width.", variant: "destructive" });
      return;
    }
    const pricing = computeItemPricing(formData, sheetMaterials, llPricingSettings, governedInputs);
    const updatedData = {
      ...formData,
      llSheetMaterialId: materialId,
      unitPrice: pricing.unitSell,
    };
    if (editingItem) {
      setItems(prev => prev.map(i => i.id === editingItem.id ? { ...updatedData, id: editingItem.id } : i));
    } else {
      setItems(prev => [...prev, { ...updatedData, id: crypto.randomUUID() }]);
    }
    setHasUnsavedChanges(true);
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    setHasUnsavedChanges(true);
    setDeleteConfirm(null);
  };

  const toggleItemExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isSaving = createQuoteMutation.isPending || saveRevisionMutation.isPending
    || createEstimateMutation.isPending || updateEstimateMutation.isPending
    || generateQuoteFromEstimateMutation.isPending;

  if ((isEditMode && quoteLoading) || (isEstimateEdit && estimateLoading)) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="loading-laser-builder">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pageTitle = estimateMode
    ? (isEstimateEdit ? (estimateData?.estimateNumber || "Loading…") : "New Laser Estimate")
    : (quoteData?.number || "New Laser Quote");
  const pageSubtitle = estimateMode ? "Lateral Laser — Estimate Builder" : "Lateral Laser — Quote Builder";
  const backPath = estimateMode ? "/laser-estimates" : "/quotes";

  const getSaveLabel = () => {
    if (estimateMode) {
      return isEstimateEdit ? "Save Estimate" : "Save New Estimate";
    }
    return isEditMode ? "Save Revision" : "Create Quote";
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b px-4 py-3 bg-background" data-testid="laser-builder-header">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(backPath)}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold" data-testid="text-page-title">{pageTitle}</h1>
            <p className="text-xs text-muted-foreground">{pageSubtitle}</p>
          </div>
          {activePricingProfile ? (
            <Badge variant="outline" className="ml-2 text-xs bg-green-50 text-green-700 border-green-300" data-testid="badge-pricing-profile">
              <ShieldCheck className="h-3 w-3 mr-1" />
              {activePricingProfile.profileName} ({activePricingProfile.versionLabel})
            </Badge>
          ) : (
            <Badge variant="outline" className="ml-2 text-xs bg-amber-50 text-amber-700 border-amber-300" data-testid="badge-pricing-fallback">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Fallback Pricing
            </Badge>
          )}
          {activeGasInputs.length > 0 || activeConsumableInputs.length > 0 ? (
            <Badge variant="outline" className="ml-1 text-xs bg-blue-50 text-blue-700 border-blue-300" data-testid="badge-source-costs-active">
              Source Costs: {activeGasInputs.length} gas, {activeConsumableInputs.length} consumable
            </Badge>
          ) : (
            <Badge variant="outline" className="ml-1 text-xs bg-gray-50 text-gray-500 border-gray-300" data-testid="badge-source-costs-none">
              Source Costs: fallback
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEditMode && !estimateMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/quote/${quoteId}/preview`)}
              data-testid="button-preview-quote"
            >
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </Button>
          )}
          {isEstimateEdit && estimateData?.status === "converted" && estimateData?.linkedQuote && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/quote/${estimateData.linkedQuote.id}`)}
              data-testid="button-open-linked-quote"
            >
              <Eye className="h-4 w-4 mr-1" />
              Open Quote {estimateData.linkedQuote.number}
            </Button>
          )}
          {isEstimateEdit && estimateData?.status !== "converted" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateQuote}
              disabled={isSaving || items.length === 0}
              data-testid="button-generate-quote"
            >
              {generateQuoteFromEstimateMutation.isPending
                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                : <ArrowRightCircle className="h-4 w-4 mr-1" />}
              Generate Quote
            </Button>
          )}
          {!(estimateMode && estimateData?.status === "converted") && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              data-testid="button-save"
            >
              {isSaving && !generateQuoteFromEstimateMutation.isPending
                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                : <Save className="h-4 w-4 mr-1" />}
              {getSaveLabel()}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {isEstimateEdit && estimateData?.status === "converted" && (
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3 flex items-center gap-2" data-testid="banner-converted">
            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-700 text-xs">Converted</Badge>
            <span className="text-sm text-green-800 dark:text-green-300">
              This estimate has been converted to quote <strong>{estimateData.linkedQuote?.number || "—"}</strong>
            </span>
          </div>
        )}

        {isEstimateEdit && estimateData?.isDemoRecord && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 flex items-center justify-between" data-testid="banner-demo-record">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm text-amber-800 dark:text-amber-300">
                This estimate is marked as <strong>demo/test data</strong> and may be archived or deleted through governance.
              </span>
            </div>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300"
                onClick={() => demoToggleMutation.mutate(false)}
                disabled={demoToggleMutation.isPending}
                title="Remove demo flag"
                data-testid="button-remove-demo-flag"
              >
                <FlaskConical className="h-3.5 w-3.5 mr-1" />
                Remove Demo Flag
              </Button>
            )}
          </div>
        )}

        {isEstimateEdit && isAdmin && !estimateData?.isDemoRecord && estimateData && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => demoToggleMutation.mutate(true)}
              disabled={demoToggleMutation.isPending}
              title="Flag as demo"
              data-testid="button-flag-as-demo"
            >
              <FlaskConical className="h-3.5 w-3.5 mr-1" />
              Flag as Demo
            </Button>
          </div>
        )}

        {isEstimateEdit && estimateData && (
          <LLLifecycleStripFromEstimate
            estimateId={estimateId!}
            estimateStatus={estimateData.status}
            linkedQuote={estimateData.linkedQuote}
          />
        )}

        <Card data-testid="card-quote-details">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Quote Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="customerName">Customer Name *</Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => { setCustomerName(e.target.value); setHasUnsavedChanges(true); }}
                placeholder="Enter customer name"
                data-testid="input-customer-name"
              />
            </div>
            <div>
              <Label htmlFor="projectAddress">Project / Address</Label>
              <Input
                id="projectAddress"
                value={projectAddress}
                onChange={(e) => { setProjectAddress(e.target.value); setHasUnsavedChanges(true); }}
                placeholder="Optional project address"
                data-testid="input-project-address"
              />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-items-table">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Line Items ({items.length})</CardTitle>
            <Button size="sm" variant="outline" onClick={openAddDialog} data-testid="button-add-item">
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {items.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground" data-testid="text-no-items">
                No items yet. Click "Add Item" to start.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Ref</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Thickness</TableHead>
                      <TableHead className="text-right">L x W (mm)</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead className="text-right">Unit Sell</TableHead>
                      <TableHead className="text-right">Line Total</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => {
                      const pricing = itemPricings.get(item.id);
                      const unitSell = pricing?.unitSell || 0;
                      const lineTotal = pricing?.sellTotal || 0;
                      const isExpanded = expandedItems.has(item.id);
                      const matched = findMatchingMaterial(sheetMaterials, item);
                      const isFlatRate = pricing?.processMode === "flat-rate" && (item.cutLengthMm > 0 || item.pierceCount > 0);
                      const isMaterialMissing = !item.llSheetMaterialId || !matched;
                      return (
                        <Fragment key={item.id}>
                          <TableRow data-testid={`row-item-${idx}`} className={isMaterialMissing ? "bg-red-50/50 dark:bg-red-950/20" : isFlatRate ? "bg-amber-50/50 dark:bg-amber-950/20" : undefined}>
                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-mono text-xs" data-testid={`text-item-ref-${idx}`}>
                              <span>{item.itemRef}</span>
                              {isMaterialMissing && (
                                <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0 h-4 bg-red-50 text-red-700 border-red-300" data-testid={`badge-material-missing-${idx}`}>No Material</Badge>
                              )}
                              {isFlatRate && !isMaterialMissing && (
                                <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0 h-4 bg-amber-50 text-amber-700 border-amber-300" data-testid={`badge-flat-rate-${idx}`}>Flat Rate</Badge>
                              )}
                            </TableCell>
                            <TableCell data-testid={`text-item-title-${idx}`}>{item.title}</TableCell>
                            <TableCell className="text-center">{item.quantity}</TableCell>
                            <TableCell className="text-xs">
                              {[item.materialType, item.materialGrade].filter(Boolean).join(" / ") || "—"}
                            </TableCell>
                            <TableCell className="text-right">{item.thickness > 0 ? `${item.thickness}mm` : "—"}</TableCell>
                            <TableCell className="text-right text-xs">
                              {item.length > 0 && item.width > 0 ? `${item.length} x ${item.width}` : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono" data-testid={`text-unit-cost-${idx}`}>
                              {pricing ? (
                                <span>${(pricing.internalCostSubtotal / (item.quantity || 1)).toFixed(2)}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono" data-testid={`text-unit-sell-${idx}`}>
                              <span>${unitSell.toFixed(2)}</span>
                              {pricing && (
                                <span className="block text-[10px] text-muted-foreground" data-testid={`text-markup-indicator-${idx}`}>
                                  +{pricing.markupPercent}%
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono font-medium" data-testid={`text-line-total-${idx}`}>
                              <span>${lineTotal.toFixed(2)}</span>
                              {pricing && (
                                <span className="block text-[10px] text-muted-foreground" data-testid={`text-margin-indicator-${idx}`}>
                                  margin ${(lineTotal - pricing.internalCostSubtotal).toFixed(2)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => toggleItemExpand(item.id)}
                                  data-testid={`button-toggle-breakdown-${idx}`}
                                  title="Toggle pricing breakdown"
                                >
                                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => openEditDialog(item)}
                                  data-testid={`button-edit-item-${idx}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => setDeleteConfirm(item.id)}
                                  data-testid={`button-delete-item-${idx}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExpanded && pricing && (
                            <TableRow>
                              <TableCell colSpan={11} className="p-2">
                                <PricingBreakdownPanel
                                  breakdown={pricing}
                                  supplierName={matched?.supplierName || "—"}
                                />
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
          {items.length > 0 && (
            <div className="border-t px-4 py-3 flex justify-end" data-testid="items-total">
              <div className="text-sm">
                <span className="text-muted-foreground mr-2">Subtotal:</span>
                <span className="font-mono font-semibold" data-testid="text-subtotal">${totalValue.toFixed(2)}</span>
                <span className="text-muted-foreground ml-4 mr-2">Incl. GST:</span>
                <span className="font-mono font-semibold" data-testid="text-total-gst">${(totalValue * 1.15).toFixed(2)}</span>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-item-form">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Item" : "Add Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="itemRef">Item Reference *</Label>
                <Input
                  id="itemRef"
                  value={formData.itemRef}
                  onChange={(e) => setFormData(prev => ({ ...prev, itemRef: e.target.value }))}
                  placeholder="e.g. LC-001"
                  data-testid="input-item-ref"
                />
              </div>
              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  value={formData.quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                  data-testid="input-quantity"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Base plate 200x200"
                data-testid="input-title"
              />
            </div>

            <div className="border rounded-md p-3 space-y-3 bg-muted/20">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Material Selection</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="materialType">Material Family</Label>
                  <Select
                    value={formData.materialType}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, materialType: v, materialGrade: "", finish: "", thickness: 0, llSheetMaterialId: "" }))}
                  >
                    <SelectTrigger data-testid="select-material-type">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {materialFamilies.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="materialGrade">Grade</Label>
                  <Select
                    value={formData.materialGrade}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, materialGrade: v, finish: "", thickness: 0, llSheetMaterialId: "" }))}
                  >
                    <SelectTrigger data-testid="select-material-grade">
                      <SelectValue placeholder={formData.materialType ? "Select grade..." : "Select family first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {gradesForFamily.map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="finish">Finish</Label>
                  <Select
                    value={formData.finish}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, finish: v, thickness: 0, llSheetMaterialId: "" }))}
                  >
                    <SelectTrigger data-testid="select-finish">
                      <SelectValue placeholder={formData.materialGrade ? "Select finish..." : "Select grade first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {finishesForSelection.map(f => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="thickness">Thickness (mm)</Label>
                  {thicknessesForSelection.length > 0 ? (
                    <Select
                      key={`thickness-${formData.materialType}-${formData.materialGrade}-${formData.finish}`}
                      value={formData.thickness > 0 ? String(formData.thickness) : undefined}
                      onValueChange={(v) => {
                        const t = parseFloat(v) || 0;
                        const allMatching = sheetMaterials.filter(
                          m => m.materialFamily === formData.materialType &&
                            m.grade === formData.materialGrade &&
                            (!formData.finish || m.finish === formData.finish) &&
                            parseFloat(m.thickness) === t
                        );
                        const nonCoil = allMatching.filter(m => m.stockBehaviour !== "coil");
                        const coils = allMatching.filter(m => m.stockBehaviour === "coil");
                        const autoId = (allMatching.length === 1) ? allMatching[0].id
                          : (nonCoil.length === 1 && coils.length === 0) ? nonCoil[0].id
                          : "";
                        setFormData(prev => ({
                          ...prev,
                          thickness: t,
                          llSheetMaterialId: autoId,
                        }));
                      }}
                    >
                      <SelectTrigger data-testid="select-thickness">
                        <SelectValue placeholder="Select thickness..." />
                      </SelectTrigger>
                      <SelectContent>
                        {thicknessesForSelection.map(t => (
                          <SelectItem key={t} value={t}>{t}mm</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="h-9 flex items-center px-3 border rounded-md bg-muted/50 text-sm text-muted-foreground" data-testid="select-thickness-disabled">
                      {formData.materialGrade ? "No thicknesses available" : "Select grade first"}
                    </div>
                  )}
                </div>
              </div>
              {formData.thickness > 0 && coilOptionsForSelection.length > 0 && (
                <div className="space-y-2">
                  <div>
                    <Label>Coil Width</Label>
                    <Select
                      key={`coil-${formData.materialType}-${formData.thickness}`}
                      value={formData.llSheetMaterialId || undefined}
                      onValueChange={(v) => {
                        setFormData(prev => ({ ...prev, llSheetMaterialId: v }));
                      }}
                    >
                      <SelectTrigger data-testid="select-coil-width">
                        <SelectValue placeholder="Select coil width..." />
                      </SelectTrigger>
                      <SelectContent>
                        {coilOptionsForSelection.map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.sheetWidth}mm wide — ${parseFloat(m.pricePerKg || "0").toFixed(4)}/kg ({m.supplierName})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{coilOptionsForSelection.length} coil width{coilOptionsForSelection.length !== 1 ? "s" : ""} available</p>
                  </div>
                  <div>
                    <Label htmlFor="coilLengthMm">Required Cut Length (mm)</Label>
                    <Input
                      id="coilLengthMm"
                      type="number"
                      min={0}
                      value={formData.coilLengthMm || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, coilLengthMm: parseFloat(e.target.value) || 0 }))}
                      placeholder="e.g. 2400"
                      data-testid="input-coil-length"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Enter the length of material to cut from the coil</p>
                  </div>
                </div>
              )}
              {formData.thickness > 0 && sheetSizesForSelection.length > 1 && coilOptionsForSelection.length === 0 && (
                <div>
                  <Label>Sheet Size</Label>
                  <Select
                    key={`sheet-${formData.materialType}-${formData.thickness}`}
                    value={formData.llSheetMaterialId || undefined}
                    onValueChange={(v) => {
                      setFormData(prev => ({ ...prev, llSheetMaterialId: v }));
                    }}
                  >
                    <SelectTrigger data-testid="select-sheet-size">
                      <SelectValue placeholder="Select sheet size..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sheetSizesForSelection.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.sheetLength}mm x {m.sheetWidth}mm — ${parseFloat(m.pricePerSheetExGst).toFixed(2)} ({m.supplierName})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{sheetSizesForSelection.length} sheet sizes available for this combination</p>
                </div>
              )}
              {formData.thickness > 0 && sheetSizesForSelection.length > 0 && coilOptionsForSelection.length > 0 && !formData.llSheetMaterialId && (
                <div>
                  <Label>Sheet Size (alternative to coil)</Label>
                  <Select
                    key={`sheet-alt-${formData.materialType}-${formData.thickness}`}
                    value={formData.llSheetMaterialId || undefined}
                    onValueChange={(v) => {
                      setFormData(prev => ({ ...prev, llSheetMaterialId: v, coilLengthMm: 0 }));
                    }}
                  >
                    <SelectTrigger data-testid="select-sheet-size-alt">
                      <SelectValue placeholder="Or select a fixed sheet..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sheetSizesForSelection.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.sheetLength}mm x {m.sheetWidth}mm — ${parseFloat(m.pricePerSheetExGst).toFixed(2)} ({m.supplierName})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {formData.thickness > 0 && sheetSizesForSelection.length === 0 && coilOptionsForSelection.length === 0 && (
                <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-2 py-1.5" data-testid="no-sheets-warning">
                  No valid sheet or coil found for this material/thickness combination. Check the materials library.
                </div>
              )}
              {selectedMaterialRow && (
                <div className="text-xs text-muted-foreground bg-background border rounded px-2 py-1.5 space-y-0.5" data-testid="material-identity-display">
                  <div className="flex justify-between">
                    <span>Supplier: <strong>{selectedMaterialRow.supplierName}</strong></span>
                    {selectedMaterialRow.stockBehaviour === "coil" ? (
                      <span><Badge variant="outline" className="text-[9px] px-1 py-0">Coil</Badge> Width: {selectedMaterialRow.sheetWidth}mm</span>
                    ) : (
                      <span>Sheet: {selectedMaterialRow.sheetLength}mm x {selectedMaterialRow.sheetWidth}mm</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    {selectedMaterialRow.stockBehaviour === "coil" ? (
                      <span>Price/kg: <strong>${parseFloat(selectedMaterialRow.pricePerKg || "0").toFixed(4)}</strong> ex GST</span>
                    ) : (
                      <span>Price/Sheet: <strong>${parseFloat(selectedMaterialRow.pricePerSheetExGst).toFixed(2)}</strong> ex GST</span>
                    )}
                    <span className="text-[10px] text-muted-foreground/60 font-mono">ID: {selectedMaterialRow.id.slice(0, 8)}</span>
                  </div>
                  {selectedMaterialRow.supplierSku && (
                    <div className="flex justify-between text-[10px] text-muted-foreground/70 pt-0.5 border-t border-muted/50">
                      <span>SKU: <span className="font-mono">{selectedMaterialRow.supplierSku}</span></span>
                      <span>{selectedMaterialRow.formType} | {selectedMaterialRow.stockBehaviour}</span>
                    </div>
                  )}
                </div>
              )}
              {formData.thickness > 0 && sheetSizesForSelection.length > 1 && coilOptionsForSelection.length === 0 && !formData.llSheetMaterialId && (
                <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded px-2 py-1.5" data-testid="sheet-size-required-warning">
                  Please select a sheet size to proceed with accurate pricing.
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="length">Part Length (mm)</Label>
                <Input
                  id="length"
                  type="number"
                  min={0}
                  value={formData.length || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, length: parseFloat(e.target.value) || 0 }))}
                  data-testid="input-length"
                />
              </div>
              <div>
                <Label htmlFor="width">Part Width (mm)</Label>
                <Input
                  id="width"
                  type="number"
                  min={0}
                  value={formData.width || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, width: parseFloat(e.target.value) || 0 }))}
                  data-testid="input-width"
                />
              </div>
            </div>

            <div className="border rounded-md p-3 space-y-3 bg-muted/20">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Process / Cutting Drivers</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="cutLengthMm">Total Cut Length (mm)</Label>
                  <Input
                    id="cutLengthMm"
                    type="number"
                    min={0}
                    value={formData.cutLengthMm || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, cutLengthMm: parseFloat(e.target.value) || 0 }))}
                    placeholder="e.g. 800"
                    data-testid="input-cut-length"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Per unit, estimated from drawing</p>
                </div>
                <div>
                  <Label htmlFor="pierceCount">Pierce Count</Label>
                  <Input
                    id="pierceCount"
                    type="number"
                    min={0}
                    value={formData.pierceCount || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, pierceCount: parseInt(e.target.value) || 0 }))}
                    placeholder="e.g. 4"
                    data-testid="input-pierce-count"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Per unit, number of pierce starts</p>
                </div>
              </div>
            </div>

            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-start text-xs text-muted-foreground" data-testid="button-toggle-advanced">
                  <ChevronRight className="h-3 w-3 mr-1" />
                  Setup, Handling &amp; Commercial Settings
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border rounded-md p-3 space-y-3 bg-muted/20 mt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="setupMinutes">Setup Minutes</Label>
                      <Input
                        id="setupMinutes"
                        type="number"
                        min={0}
                        value={formData.setupMinutes}
                        onChange={(e) => setFormData(prev => ({ ...prev, setupMinutes: parseFloat(e.target.value) || 0 }))}
                        data-testid="input-setup-minutes"
                      />
                    </div>
                    <div>
                      <Label htmlFor="handlingMinutes">Handling Minutes</Label>
                      <Input
                        id="handlingMinutes"
                        type="number"
                        min={0}
                        value={formData.handlingMinutes}
                        onChange={(e) => setFormData(prev => ({ ...prev, handlingMinutes: parseFloat(e.target.value) || 0 }))}
                        data-testid="input-handling-minutes"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="markupPercent">Markup %</Label>
                      <Input
                        id="markupPercent"
                        type="number"
                        min={0}
                        step={1}
                        value={formData.markupPercent}
                        onChange={(e) => setFormData(prev => ({ ...prev, markupPercent: parseFloat(e.target.value) || 0 }))}
                        data-testid="input-markup-percent"
                      />
                    </div>
                    <div>
                      <Label htmlFor="utilisationFactor">Utilisation Factor</Label>
                      <Input
                        id="utilisationFactor"
                        type="number"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={formData.utilisationFactor}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setFormData(prev => ({ ...prev, utilisationFactor: Number.isFinite(v) ? Math.max(0.1, Math.min(1, v)) : 0.75 }));
                        }}
                        data-testid="input-utilisation-factor"
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5">Sheet utilisation (0.75 = 75%, bounded rectangular estimate)</p>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {!(selectedMaterialRow?.id || formData.llSheetMaterialId) && (
              <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2" data-testid="warning-no-material">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                <span className="text-sm text-red-800 dark:text-red-300">No material selected. A material must be selected before this item can be saved.</span>
              </div>
            )}

            {dialogPricing.processMode === "flat-rate" && (formData.cutLengthMm > 0 || formData.pierceCount > 0) && (
              <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2" data-testid="warning-flat-rate">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-sm text-amber-800 dark:text-amber-300">No governed process-rate match found for this material and thickness. Flat-rate pricing is being used. Process costs may not reflect actual machine time.</span>
              </div>
            )}

            <PricingBreakdownPanel
              breakdown={dialogPricing}
              supplierName={selectedMaterialRow?.supplierName || ""}
            />

            <div>
              <Label htmlFor="customerNotes">Customer Notes</Label>
              <Textarea
                id="customerNotes"
                value={formData.customerNotes}
                onChange={(e) => setFormData(prev => ({ ...prev, customerNotes: e.target.value }))}
                placeholder="Notes visible to customer..."
                rows={2}
                data-testid="input-customer-notes"
              />
            </div>
            <div>
              <Label htmlFor="internalNotes">Internal Notes</Label>
              <Textarea
                id="internalNotes"
                value={formData.internalNotes}
                onChange={(e) => setFormData(prev => ({ ...prev, internalNotes: e.target.value }))}
                placeholder="Internal notes (not shown on quote)..."
                rows={2}
                data-testid="input-internal-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-item">
              Cancel
            </Button>
            <Button onClick={handleDialogSave} data-testid="button-save-item">
              {editingItem ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent data-testid="dialog-delete-confirm">
          <DialogHeader>
            <DialogTitle>Delete Item</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to remove this item?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} data-testid="button-confirm-delete">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
