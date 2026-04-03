import { useState, useEffect, useMemo, Fragment } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
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
import { Plus, Pencil, Trash2, Save, Eye, ArrowLeft, Loader2, ChevronDown, ChevronRight, Calculator } from "lucide-react";
import type { LaserQuoteItem } from "@shared/schema";
import type { LaserSnapshotItem } from "@shared/estimate-snapshot";
import {
  computeLLPricing,
  LL_PRICING_DEFAULTS,
  type LLMaterialTruth,
  type LLPricingBreakdown,
} from "@/lib/ll-pricing";

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
}

const EMPTY_ITEM: Omit<LaserQuoteItem, "id"> = {
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
  cutLengthMm: 0,
  pierceCount: 0,
  setupMinutes: LL_PRICING_DEFAULTS.DEFAULT_SETUP_MINUTES,
  handlingMinutes: LL_PRICING_DEFAULTS.DEFAULT_HANDLING_MINUTES,
  markupPercent: LL_PRICING_DEFAULTS.DEFAULT_MARKUP_PERCENT,
  utilisationFactor: LL_PRICING_DEFAULTS.DEFAULT_UTILISATION_FACTOR,
};

function findMatchingMaterial(
  materials: SheetMaterialRef[],
  item: { materialType: string; materialGrade: string; finish: string; thickness: number; llSheetMaterialId: string }
): SheetMaterialRef | undefined {
  if (item.llSheetMaterialId) {
    const byId = materials.find(m => m.id === item.llSheetMaterialId);
    if (byId) return byId;
  }
  return materials.find(
    m =>
      m.materialFamily === item.materialType &&
      m.grade === item.materialGrade &&
      m.finish === item.finish &&
      parseFloat(m.thickness) === item.thickness
  );
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
  };
}

function computeItemPricing(
  item: Omit<LaserQuoteItem, "id"> | LaserQuoteItem,
  materials: SheetMaterialRef[]
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
  });
}

function itemToSnapshotItem(
  item: LaserQuoteItem,
  index: number,
  materials: SheetMaterialRef[]
): LaserSnapshotItem {
  const pricing = computeItemPricing(item, materials);
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
    pierceCount: item.pierceCount,
    setupMinutes: item.setupMinutes,
    handlingMinutes: item.handlingMinutes,
    markupPercent: item.markupPercent,
    utilisationFactor: item.utilisationFactor,
    materialCostTotal: pricing.materialCostTotal,
    processCostTotal: pricing.processCostTotal,
    setupHandlingCost: pricing.setupHandlingCost,
    internalCostSubtotal: pricing.internalCostSubtotal,
    markupAmount: pricing.markupAmount,
    sellTotal: pricing.sellTotal,
  };
}

function snapshotItemToItem(si: LaserSnapshotItem): LaserQuoteItem {
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
    pierceCount: si.pierceCount ?? 0,
    setupMinutes: si.setupMinutes ?? LL_PRICING_DEFAULTS.DEFAULT_SETUP_MINUTES,
    handlingMinutes: si.handlingMinutes ?? LL_PRICING_DEFAULTS.DEFAULT_HANDLING_MINUTES,
    markupPercent: si.markupPercent ?? LL_PRICING_DEFAULTS.DEFAULT_MARKUP_PERCENT,
    utilisationFactor: si.utilisationFactor ?? LL_PRICING_DEFAULTS.DEFAULT_UTILISATION_FACTOR,
  };
}

function PricingBreakdownPanel({ breakdown, supplierName }: { breakdown: LLPricingBreakdown; supplierName: string }) {
  const rows = [
    { label: "Supplier", value: supplierName || "—" },
    { label: "Sheet Area", value: breakdown.sheetAreaMm2 > 0 ? `${(breakdown.sheetAreaMm2 / 1_000_000).toFixed(3)} m²` : "—" },
    { label: "Part Area", value: breakdown.partAreaMm2 > 0 ? `${(breakdown.partAreaMm2 / 1_000_000).toFixed(4)} m²` : "—" },
    { label: "Utilisation Factor", value: `${(breakdown.utilisationFactor * 100).toFixed(0)}%` },
    { label: "Material Cost", value: `$${breakdown.materialCostTotal.toFixed(2)}` },
    { label: "Cut Cost (per unit)", value: `$${breakdown.cutCost.toFixed(2)}` },
    { label: "Pierce Cost (per unit)", value: `$${breakdown.pierceCost.toFixed(2)}` },
    { label: "Process Cost (total)", value: `$${breakdown.processCostTotal.toFixed(2)}` },
    { label: "Setup/Handling", value: `$${breakdown.setupHandlingCost.toFixed(2)}` },
    { label: "Internal Subtotal", value: `$${breakdown.internalCostSubtotal.toFixed(2)}`, bold: true },
    { label: `Markup (${breakdown.markupPercent}%)`, value: `$${breakdown.markupAmount.toFixed(2)}` },
    { label: "Sell Total", value: `$${breakdown.sellTotal.toFixed(2)}`, bold: true },
    { label: "Unit Sell", value: `$${breakdown.unitSell.toFixed(2)}`, bold: true },
  ];
  return (
    <div className="bg-muted/50 border rounded-md p-3 space-y-1" data-testid="pricing-breakdown-panel">
      <div className="flex items-center gap-1.5 mb-2">
        <Calculator className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Internal Pricing Breakdown</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} className={`flex justify-between text-xs ${r.bold ? 'font-semibold border-t pt-1 mt-1' : 'text-muted-foreground'}`}>
          <span>{r.label}</span>
          <span className="font-mono">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function LaserQuoteBuilder() {
  const params = useParams<{ id?: string }>();
  const quoteId = params.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [items, setItems] = useState<LaserQuoteItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [projectAddress, setProjectAddress] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LaserQuoteItem | null>(null);
  const [formData, setFormData] = useState<Omit<LaserQuoteItem, "id">>(EMPTY_ITEM);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const isEditMode = !!quoteId;

  const { data: sheetMaterials = [] } = useQuery<SheetMaterialRef[]>({
    queryKey: ["/api/ll-sheet-materials", "active"],
    queryFn: () => fetch("/api/ll-sheet-materials?active=true", { credentials: "include" }).then(r => r.json()),
  });

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

  const selectedMaterialRow = useMemo(() => {
    return findMatchingMaterial(sheetMaterials, {
      ...formData,
      llSheetMaterialId: formData.llSheetMaterialId,
    });
  }, [sheetMaterials, formData.materialType, formData.materialGrade, formData.finish, formData.thickness, formData.llSheetMaterialId]);

  const dialogPricing = useMemo(() => {
    return computeItemPricing(formData, sheetMaterials);
  }, [formData, sheetMaterials]);

  const { data: quoteData, isLoading: quoteLoading } = useQuery<any>({
    queryKey: ["/api/quotes", quoteId],
    enabled: isEditMode,
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
            setItems(snapshot.laserItems.map(snapshotItemToItem));
          }
        }
      }
    }
  }, [quoteData, isEditMode]);

  const itemPricings = useMemo(() => {
    const map = new Map<string, LLPricingBreakdown>();
    for (const item of items) {
      map.set(item.id, computeItemPricing(item, sheetMaterials));
    }
    return map;
  }, [items, sheetMaterials]);

  const totalValue = useMemo(() => {
    let total = 0;
    for (const [, p] of itemPricings) {
      total += p.sellTotal;
    }
    return total;
  }, [itemPricings]);

  const buildSnapshot = () => {
    const laserItems = items.map((item, idx) => itemToSnapshotItem(item, idx, sheetMaterials));
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

  const handleSave = () => {
    if (!customerName.trim()) {
      toast({ title: "Required", description: "Customer name is required", variant: "destructive" });
      return;
    }
    if (isEditMode) {
      saveRevisionMutation.mutate();
    } else {
      createQuoteMutation.mutate();
    }
  };

  const openAddDialog = () => {
    setEditingItem(null);
    setFormData({ ...EMPTY_ITEM });
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
    const pricing = computeItemPricing(formData, sheetMaterials);
    const materialId = selectedMaterialRow?.id || formData.llSheetMaterialId;
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

  const isSaving = createQuoteMutation.isPending || saveRevisionMutation.isPending;

  if (isEditMode && quoteLoading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="loading-laser-builder">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const quoteNumber = quoteData?.number || "New Laser Quote";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b px-4 py-3 bg-background" data-testid="laser-builder-header">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/quotes")}
            data-testid="button-back-quotes"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold" data-testid="text-quote-number">{quoteNumber}</h1>
            <p className="text-xs text-muted-foreground">Lateral Laser — Quote Builder</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditMode && (
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
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            data-testid="button-save-quote"
          >
            {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            {isEditMode ? "Save Revision" : "Create Quote"}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
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
                      return (
                        <Fragment key={item.id}>
                          <TableRow data-testid={`row-item-${idx}`}>
                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-mono text-xs" data-testid={`text-item-ref-${idx}`}>{item.itemRef}</TableCell>
                            <TableCell data-testid={`text-item-title-${idx}`}>{item.title}</TableCell>
                            <TableCell className="text-center">{item.quantity}</TableCell>
                            <TableCell className="text-xs">
                              {[item.materialType, item.materialGrade].filter(Boolean).join(" / ") || "—"}
                            </TableCell>
                            <TableCell className="text-right">{item.thickness > 0 ? `${item.thickness}mm` : "—"}</TableCell>
                            <TableCell className="text-right text-xs">
                              {item.length > 0 && item.width > 0 ? `${item.length} x ${item.width}` : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono" data-testid={`text-unit-sell-${idx}`}>
                              <span>${unitSell.toFixed(2)}</span>
                              {pricing && (
                                <span className="block text-[10px] text-muted-foreground" data-testid={`text-cost-indicator-${idx}`}>
                                  cost ${(pricing.internalCostSubtotal / (item.quantity || 1)).toFixed(2)} +{pricing.markupPercent}%
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
                              <TableCell colSpan={10} className="p-2">
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
                  <Select
                    value={formData.thickness ? String(formData.thickness) : ""}
                    onValueChange={(v) => {
                      const t = parseFloat(v) || 0;
                      const matched = sheetMaterials.find(
                        m => m.materialFamily === formData.materialType &&
                          m.grade === formData.materialGrade &&
                          m.finish === formData.finish &&
                          parseFloat(m.thickness) === t
                      );
                      setFormData(prev => ({
                        ...prev,
                        thickness: t,
                        llSheetMaterialId: matched?.id || "",
                      }));
                    }}
                  >
                    <SelectTrigger data-testid="select-thickness">
                      <SelectValue placeholder={formData.materialGrade ? "Select..." : "Select grade first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {thicknessesForSelection.map(t => (
                        <SelectItem key={t} value={t}>{t}mm</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {selectedMaterialRow && (
                <div className="text-xs text-muted-foreground bg-background border rounded px-2 py-1.5 space-y-0.5" data-testid="material-identity-display">
                  <div className="flex justify-between">
                    <span>Supplier: <strong>{selectedMaterialRow.supplierName}</strong></span>
                    <span>Sheet: {selectedMaterialRow.sheetLength}mm x {selectedMaterialRow.sheetWidth}mm</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Price/Sheet: <strong>${parseFloat(selectedMaterialRow.pricePerSheetExGst).toFixed(2)}</strong> ex GST</span>
                    <span className="text-[10px] text-muted-foreground/60 font-mono">ID: {selectedMaterialRow.id.slice(0, 8)}</span>
                  </div>
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
