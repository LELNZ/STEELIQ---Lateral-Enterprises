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
import { Plus, Pencil, Trash2, Save, Eye, ArrowLeft, ArrowRightCircle, Loader2, ChevronDown, ChevronRight, Calculator, ShieldCheck, AlertTriangle, FlaskConical, Info, DollarSign, Wrench } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { LaserQuoteItem, LLPricingSettings, DivisionSettings, LLPricingProfile, LLPricingOverrideMode, LLManualProcedureType } from "@shared/schema";
import { LL_MANUAL_PROCEDURE_TYPES } from "@shared/schema";
import type { LaserSnapshotItem } from "@shared/estimate-snapshot";
import {
  computeLLPricing,
  resolveRatesFromSettings,
  applyCommercialOverride,
  type LLMaterialTruth,
  type LLPricingBreakdown,
  type LLGovernedInputs,
  type LLCommercialResult,
  type LLOverrideInputs,
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
    materialMarkupPercent: rates.defaultMaterialMarkupPercent,
    consumablesMarkupPercent: rates.defaultConsumablesMarkupPercent,
    utilisationFactor: rates.defaultUtilisationFactor,
    geometrySource: "manual",
    pricingOverrideEnabled: false,
    pricingOverrideMode: "none",
    isManualProcedure: false,
  };
}

function makeEmptyManualProcedure(): Omit<LaserQuoteItem, "id"> {
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
    setupMinutes: 0,
    handlingMinutes: 0,
    markupPercent: 0,
    materialMarkupPercent: 0,
    consumablesMarkupPercent: 0,
    utilisationFactor: 0.75,
    geometrySource: "manual",
    isManualProcedure: true,
    procedureType: "Folding",
    procedureDescription: "",
    manualUnitCost: 0,
    manualUnitSell: 0,
    manualNotes: "",
  };
}

function buildOverrideInputs(item: Pick<LaserQuoteItem, "pricingOverrideEnabled" | "pricingOverrideMode" | "manualSellPrice" | "targetMarginPercent">): LLOverrideInputs {
  return {
    enabled: !!item.pricingOverrideEnabled,
    mode: (item.pricingOverrideMode ?? "none") as LLPricingOverrideMode,
    manualSellPrice: item.manualSellPrice,
    targetMarginPercent: item.targetMarginPercent,
  };
}

function computeManualProcedureFinal(item: Pick<LaserQuoteItem, "manualUnitCost" | "manualUnitSell" | "manualTargetMarginPercent" | "quantity">): {
  unitCost: number;
  unitSell: number;
  lineSell: number;
  lineMargin: number;
  marginPercent: number;
  invalid: boolean;
  warning?: string;
} {
  const qtyRaw = Number(item.quantity ?? 0);
  const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? Math.max(1, Math.floor(qtyRaw)) : 1;
  const unitCostRaw = Number(item.manualUnitCost ?? 0);
  const unitCost = Number.isFinite(unitCostRaw) && unitCostRaw > 0 ? unitCostRaw : 0;
  const unitSellRaw = Number(item.manualUnitSell ?? 0);
  let unitSell = Number.isFinite(unitSellRaw) && unitSellRaw > 0 ? unitSellRaw : 0;
  let warning: string | undefined;
  let invalid = false;
  const tmRaw = item.manualTargetMarginPercent;
  if (tmRaw != null) {
    const tm = Number(tmRaw);
    if (!Number.isFinite(tm)) {
      invalid = true;
      warning = "Target margin % is not a valid number. Using manual unit sell instead.";
    } else if (tm < 0 || tm >= 100) {
      invalid = true;
      warning = "Target margin % must be between 0 and 100. Using manual unit sell instead.";
    } else if (unitCost > 0) {
      unitSell = unitCost / (1 - tm / 100);
    } else {
      invalid = true;
      warning = "Cannot apply target margin: unit cost is zero.";
    }
  }
  if (!Number.isFinite(unitSell) || unitSell <= 0) {
    invalid = true;
    unitSell = Number.isFinite(unitSell) && unitSell > 0 ? unitSell : 0;
    warning = warning ?? "Manual unit sell must be greater than zero.";
  }
  const lineSell = unitSell * qty;
  const lineMargin = lineSell - unitCost * qty;
  const marginPercent = lineSell > 0 ? (lineMargin / lineSell) * 100 : 0;
  return { unitCost, unitSell, lineSell, lineMargin, marginPercent, invalid, warning };
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
  const rates = resolveRatesFromSettings(settings);
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
    materialMarkupPercent: item.materialMarkupPercent ?? rates.defaultMaterialMarkupPercent,
    consumablesMarkupPercent: item.consumablesMarkupPercent ?? rates.defaultConsumablesMarkupPercent,
    utilisationFactor: item.utilisationFactor,
    coilLengthMm: item.coilLengthMm || 0,
  }, settings, governed);
}

// Phase 5E — final commercial pricing per row.
// Manual procedure rows bypass the bucketed pricing engine entirely.
// Laser-cut rows use computeLLPricing then apply the optional commercial override.
export interface LLRowPricing {
  isManualProcedure: boolean;
  breakdown: LLPricingBreakdown | null;
  commercial: LLCommercialResult | null;
  manual: ReturnType<typeof computeManualProcedureFinal> | null;
  finalUnitSell: number;
  finalLineSell: number;
  finalLineCost: number;
  finalMarginAmount: number;
  finalMarginPercent: number;
}

function computeRowPricing(
  item: Omit<LaserQuoteItem, "id"> | LaserQuoteItem,
  materials: SheetMaterialRef[],
  settings?: LLPricingSettings | null,
  governed?: LLGovernedInputs,
): LLRowPricing {
  if (item.isManualProcedure) {
    const m = computeManualProcedureFinal(item);
    const qty = Math.max(item.quantity || 0, 1);
    return {
      isManualProcedure: true,
      breakdown: null,
      commercial: null,
      manual: m,
      finalUnitSell: m.unitSell,
      finalLineSell: m.lineSell,
      finalLineCost: m.unitCost * qty,
      finalMarginAmount: m.lineMargin,
      finalMarginPercent: m.marginPercent,
    };
  }
  const breakdown = computeItemPricing(item, materials, settings, governed);
  const commercial = applyCommercialOverride(breakdown, item.quantity, buildOverrideInputs(item));
  return {
    isManualProcedure: false,
    breakdown,
    commercial,
    manual: null,
    finalUnitSell: commercial.finalUnitSell,
    finalLineSell: commercial.finalSellPrice,
    finalLineCost: commercial.calculatedBuyCost,
    finalMarginAmount: commercial.finalMarginAmount,
    finalMarginPercent: commercial.finalMarginPercent,
  };
}

function itemToSnapshotItem(
  item: LaserQuoteItem,
  index: number,
  materials: SheetMaterialRef[],
  settings?: LLPricingSettings | null,
  governed?: LLGovernedInputs,
): LaserSnapshotItem {
  // Manual procedure rows: bypass bucketed engine entirely.
  if (item.isManualProcedure) {
    const final = computeManualProcedureFinal(item);
    return {
      itemNumber: index + 1,
      itemRef: item.itemRef,
      title: item.title,
      quantity: item.quantity,
      materialType: "",
      materialGrade: "",
      thickness: 0,
      length: 0,
      width: 0,
      finish: "",
      customerNotes: item.customerNotes,
      internalNotes: item.internalNotes,
      unitPrice: final.unitSell,
      photos: [],
      llSheetMaterialId: "",
      supplierName: "",
      sheetLength: 0,
      sheetWidth: 0,
      pricePerSheetExGst: 0,
      cutLengthMm: 0,
      coilLengthMm: 0,
      stockBehaviour: "manual_procedure",
      pricePerKg: 0,
      densityKgM3: 0,
      pierceCount: 0,
      setupMinutes: 0,
      handlingMinutes: 0,
      markupPercent: 0,
      materialMarkupPercent: 0,
      consumablesMarkupPercent: 0,
      utilisationFactor: 0,
      estimatedSheets: 0,
      materialCostTotal: 0,
      processCostTotal: 0,
      setupHandlingCost: 0,
      internalCostSubtotal: final.unitCost * Math.max(item.quantity || 0, 1),
      markupAmount: final.lineMargin,
      sellTotal: final.lineSell,
      materialBuyCost: 0,
      materialSellCost: 0,
      labourBuyCost: 0,
      labourSellCost: 0,
      machineBuyCost: 0,
      machineSellCost: 0,
      consumablesBuyCost: 0,
      consumablesSellCost: 0,
      gasBuyCost: 0,
      totalBuyCost: final.unitCost * Math.max(item.quantity || 0, 1),
      totalMargin: final.lineMargin,
      totalMarginPercent: final.marginPercent,
      geometrySource: item.geometrySource ?? "manual",
      isManualProcedure: true,
      procedureType: item.procedureType,
      procedureDescription: item.procedureDescription,
      manualUnitCost: final.unitCost,
      manualUnitSell: final.unitSell,
      manualTargetMarginPercent: item.manualTargetMarginPercent,
      manualNotes: item.manualNotes,
      finalSellPrice: final.lineSell,
      finalMarginAmount: final.lineMargin,
      finalMarginPercent: final.marginPercent,
    };
  }

  const pricing = computeItemPricing(item, materials, settings, governed);
  const commercial = applyCommercialOverride(pricing, item.quantity, buildOverrideInputs(item));
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
    // unitPrice and sellTotal in snapshot reflect FINAL commercial values
    // so Preview/PDF and downstream consumers see the agreed sell.
    unitPrice: commercial.finalUnitSell,
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
    markupPercent: pricing.markupPercent,
    materialMarkupPercent: pricing.materialMarkupPercent,
    consumablesMarkupPercent: pricing.consumablesMarkupPercent,
    utilisationFactor: item.utilisationFactor,
    estimatedSheets: pricing.estimatedSheets,
    materialCostTotal: pricing.materialCostTotal,
    processCostTotal: pricing.processCostTotal,
    setupHandlingCost: pricing.setupHandlingCost,
    internalCostSubtotal: pricing.internalCostSubtotal,
    markupAmount: pricing.markupAmount,
    sellTotal: commercial.finalSellPrice,
    materialBuyCost: pricing.materialBuyCost,
    materialSellCost: pricing.materialSellCost,
    labourBuyCost: pricing.labourBuyCost,
    labourSellCost: pricing.labourSellCost,
    machineBuyCost: pricing.machineBuyCost,
    machineSellCost: pricing.machineSellCost,
    consumablesBuyCost: pricing.consumablesBuyCost,
    consumablesSellCost: pricing.consumablesSellCost,
    gasBuyCost: pricing.gasBuyCost,
    totalBuyCost: pricing.totalBuyCost,
    totalMargin: commercial.finalMarginAmount,
    totalMarginPercent: commercial.finalMarginPercent,
    geometrySource: item.geometrySource ?? "manual",
    operations: [{ type: "laser" as const, enabled: true, costTotal: pricing.totalBuyCost }],
    pricingOverrideEnabled: item.pricingOverrideEnabled,
    pricingOverrideMode: item.pricingOverrideMode,
    manualSellPrice: item.manualSellPrice,
    targetMarginPercent: item.targetMarginPercent,
    overrideReason: item.overrideReason,
    calculatedSellPrice: commercial.calculatedSellPrice,
    calculatedBuyCost: commercial.calculatedBuyCost,
    finalSellPrice: commercial.finalSellPrice,
    finalMarginAmount: commercial.finalMarginAmount,
    finalMarginPercent: commercial.finalMarginPercent,
  };
}

function snapshotItemToItem(si: LaserSnapshotItem, settings?: LLPricingSettings | null): LaserQuoteItem {
  const rates = resolveRatesFromSettings(settings);
  const isManualProcedure = !!(si as any).isManualProcedure;
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
    materialMarkupPercent: (si as any).materialMarkupPercent ?? rates.defaultMaterialMarkupPercent,
    consumablesMarkupPercent: (si as any).consumablesMarkupPercent ?? rates.defaultConsumablesMarkupPercent,
    utilisationFactor: si.utilisationFactor ?? rates.defaultUtilisationFactor,
    geometrySource: (si as any).geometrySource ?? "manual",
    pricingOverrideEnabled: (si as any).pricingOverrideEnabled ?? false,
    pricingOverrideMode: ((si as any).pricingOverrideMode as LLPricingOverrideMode | undefined) ?? "none",
    manualSellPrice: (si as any).manualSellPrice,
    targetMarginPercent: (si as any).targetMarginPercent,
    overrideReason: (si as any).overrideReason,
    isManualProcedure,
    procedureType: (si as any).procedureType as LLManualProcedureType | undefined,
    procedureDescription: (si as any).procedureDescription,
    manualUnitCost: (si as any).manualUnitCost,
    manualUnitSell: (si as any).manualUnitSell,
    manualTargetMarginPercent: (si as any).manualTargetMarginPercent,
    manualNotes: (si as any).manualNotes,
  };
}

function BucketRow({ label, buy, sell, margin, bold }: { label: string; buy: string; sell: string; margin?: string; bold?: boolean }) {
  return (
    <div className={`grid grid-cols-[1fr_80px_80px_70px] gap-1 text-[11px] ${bold ? "font-semibold" : ""}`} data-testid={`bucket-row-${label.toLowerCase().replace(/[^a-z]/g, "-")}`}>
      <span className="text-muted-foreground truncate">{label}</span>
      <span className="text-right font-mono">{buy}</span>
      <span className="text-right font-mono">{sell}</span>
      <span className="text-right font-mono text-green-700 dark:text-green-400">{margin || ""}</span>
    </div>
  );
}

function PricingBreakdownPanel({ breakdown, supplierName }: { breakdown: LLPricingBreakdown; supplierName: string }) {
  const isTimeBased = breakdown.processMode === "time-based";
  const [detailsOpen, setDetailsOpen] = useState(false);
  const infoRows: Array<{ label: string; value: string }> = [
    { label: "Supplier", value: supplierName || "—" },
    { label: "Parts/Sheet", value: breakdown.partsPerSheet > 0 ? `${breakdown.partsPerSheet}` : "—" },
    { label: "Est. Sheets", value: breakdown.estimatedSheets > 0 ? `${breakdown.estimatedSheets}` : "—" },
  ];
  if (isTimeBased) {
    infoRows.push({ label: "Machine Time", value: `${breakdown.machineTimeMinutes.toFixed(1)} min` });
  }
  return (
    <div className="bg-muted/50 border rounded-md p-3 space-y-2" data-testid="pricing-breakdown-panel">
      <div className="flex items-center gap-1.5 mb-1">
        <Calculator className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bucketed Pricing Breakdown</span>
        <Badge variant={isTimeBased ? "default" : "secondary"} className="text-[10px] px-1.5 py-0 h-4 ml-auto" data-testid="process-mode-badge">
          {isTimeBased ? "Time-Based (Governed)" : "Flat-Rate Fallback"}
        </Badge>
      </div>
      {!isTimeBased && (
        <div className="flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-2 py-1.5" data-testid="flat-rate-fallback-warning">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="text-[11px] text-amber-800 dark:text-amber-200 leading-snug">
            <span className="font-semibold">No governed process rate</span> for this material/thickness. Using flat $/mm cut and $/pierce rates. Gas, consumables and machine time are not separately calculated.
          </div>
        </div>
      )}
      {isTimeBased && (breakdown.gasSource || breakdown.consumablesSource) && (
        <div className="flex flex-wrap gap-1 mb-1" data-testid="governed-source-badges">
          {breakdown.gasSource && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800" data-testid="gas-source-badge">
              Gas: {breakdown.gasSource}
            </Badge>
          )}
          {breakdown.consumablesSource && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800" data-testid="consumables-source-badge">
              Consumables: {breakdown.consumablesSource}
            </Badge>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground mb-1">
        {infoRows.map((r, i) => (
          <span key={i}><span className="font-medium">{r.label}:</span> {r.value}</span>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_80px_80px_70px] gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">
        <span>Bucket</span>
        <span className="text-right">Buy</span>
        <span className="text-right">Sell</span>
        <span className="text-right">Margin</span>
      </div>

      <BucketRow
        label={`Material (${breakdown.materialMarkupPercent}% mkp)`}
        buy={`$${breakdown.materialBuyCost.toFixed(2)}`}
        sell={`$${breakdown.materialSellCost.toFixed(2)}`}
        margin={`$${breakdown.materialMargin.toFixed(2)}`}
      />
      <BucketRow
        label={`Machine ($${breakdown.machineBuyRatePerHour.toFixed(0)}→$${breakdown.machineSellRatePerHour.toFixed(0)}/hr)`}
        buy={`$${breakdown.machineBuyCost.toFixed(2)}`}
        sell={`$${breakdown.machineSellCost.toFixed(2)}`}
        margin={`$${breakdown.machineMargin.toFixed(2)}`}
      />
      <BucketRow
        label="Gas (pass-through)"
        buy={`$${breakdown.gasBuyCost.toFixed(2)}`}
        sell={`$${breakdown.gasSellCost.toFixed(2)}`}
      />
      <BucketRow
        label={`Consumables (${breakdown.consumablesMarkupPercent}% mkp)`}
        buy={`$${breakdown.consumablesBuyCost.toFixed(2)}`}
        sell={`$${breakdown.consumablesSellCost.toFixed(2)}`}
        margin={`$${breakdown.consumablesMargin.toFixed(2)}`}
      />
      <BucketRow
        label={`Labour ($${breakdown.operatorRatePerHour.toFixed(0)}→$${breakdown.shopRatePerHour.toFixed(0)}/hr)`}
        buy={`$${breakdown.labourBuyCost.toFixed(2)}`}
        sell={`$${breakdown.labourSellCost.toFixed(2)}`}
        margin={`$${breakdown.labourMargin.toFixed(2)}`}
      />

      <div className="border-t pt-1 mt-1">
        <BucketRow
          label="TOTAL"
          buy={`$${breakdown.totalBuyCost.toFixed(2)}`}
          sell={`$${breakdown.sellTotal.toFixed(2)}`}
          margin={`$${breakdown.totalMargin.toFixed(2)}`}
          bold
        />
      </div>

      {breakdown.minimumLineChargeApplied && (
        <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5" data-testid="min-line-charge-notice">
          Min. line charge applied ($50)
        </div>
      )}

      <div className="flex justify-between text-xs font-semibold border-t pt-1 mt-1">
        <span>Unit Sell</span>
        <span className="font-mono" data-testid="unit-sell-price">${breakdown.unitSell.toFixed(2)}</span>
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>Margin %</span>
        <span className="font-mono text-green-700 dark:text-green-400" data-testid="total-margin-percent">{breakdown.totalMarginPercent.toFixed(1)}%</span>
      </div>

      <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 w-full justify-center text-[10px] font-medium text-muted-foreground hover:text-foreground mt-1 pt-1 border-t"
            data-testid="button-toggle-breakdown-details"
          >
            <Info className="h-3 w-3" />
            {detailsOpen ? "Hide calculation details" : "Show calculation details"}
            {detailsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 mt-2" data-testid="breakdown-details">
          <div className="rounded-md border bg-background/60 p-2 space-y-0.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Material</div>
            {breakdown.sheetPricePerSheet ? (
              <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Sheet price (ex-GST)</span><span className="font-mono" data-testid="detail-sheet-price">${breakdown.sheetPricePerSheet.toFixed(2)}</span></div>
            ) : null}
            <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Parts per sheet</span><span className="font-mono">{breakdown.partsPerSheet || "—"}</span></div>
            <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Estimated sheets</span><span className="font-mono">{breakdown.estimatedSheets || "—"}</span></div>
            <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Sheet utilisation</span><span className="font-mono">{(breakdown.utilisationFactor * 100).toFixed(0)}%</span></div>
            <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Effective material buy / part</span><span className="font-mono">${breakdown.materialCostPerUnit.toFixed(2)}</span></div>
            {breakdown.minimumMaterialChargeApplied && (
              <div className="text-[10px] text-amber-600 dark:text-amber-400" data-testid="min-material-notice">
                Min. material charge applied (${breakdown.minimumMaterialCharge.toFixed(2)})
              </div>
            )}
          </div>

          <div className="rounded-md border bg-background/60 p-2 space-y-0.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Machine Time</div>
            {isTimeBased ? (
              <>
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Cut speed (governed)</span><span className="font-mono" data-testid="detail-cut-speed">{breakdown.processRateCutSpeedMmPerMin?.toLocaleString() ?? "—"} mm/min</span></div>
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Pierce time</span><span className="font-mono">{breakdown.processRatePierceTimeSec?.toFixed(2) ?? "—"} s/pierce</span></div>
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Cut time (line)</span><span className="font-mono" data-testid="detail-cut-time">{breakdown.cutTimeMinutes.toFixed(2)} min</span></div>
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Pierce time (line)</span><span className="font-mono" data-testid="detail-pierce-time">{breakdown.pierceTimeMinutes.toFixed(2)} min</span></div>
                <div className="flex justify-between text-[10px] font-semibold"><span className="text-muted-foreground">Total machine time</span><span className="font-mono">{breakdown.machineTimeMinutes.toFixed(2)} min</span></div>
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Buy rate / Sell rate</span><span className="font-mono">${breakdown.machineBuyRatePerHour.toFixed(0)} / ${breakdown.machineSellRatePerHour.toFixed(0)} /hr</span></div>
              </>
            ) : (
              <>
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Flat cut rate</span><span className="font-mono">${breakdown.ratePerMmCut.toFixed(4)} /mm</span></div>
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Flat pierce rate</span><span className="font-mono">${breakdown.ratePerPierce.toFixed(2)} /pierce</span></div>
                <div className="text-[10px] text-muted-foreground italic">Machine time not computed in flat-rate mode.</div>
              </>
            )}
          </div>

          {isTimeBased && (
            <div className="rounded-md border bg-background/60 p-2 space-y-0.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Gas &amp; Consumables</div>
              <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Assist gas</span><span className="font-mono" data-testid="detail-gas-type">{breakdown.gasType ?? "—"}</span></div>
              <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Gas flow</span><span className="font-mono">{breakdown.gasConsumptionLPerMin?.toFixed(0) ?? "—"} L/min</span></div>
              {breakdown.gasCostPerLitre != null && (
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Gas cost / litre</span><span className="font-mono">${breakdown.gasCostPerLitre.toFixed(4)}</span></div>
              )}
              {breakdown.gasSource && (
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Gas source</span><span className="font-mono text-[9px] text-right truncate max-w-[60%]">{breakdown.gasSource}</span></div>
              )}
              {breakdown.consumablesCostPerHourRate != null && (
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Consumables rate</span><span className="font-mono" data-testid="detail-consumables-rate">${breakdown.consumablesCostPerHourRate.toFixed(2)} /hr</span></div>
              )}
              {breakdown.consumablesSource && (
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Consumables source</span><span className="font-mono text-[9px] text-right truncate max-w-[60%]">{breakdown.consumablesSource}</span></div>
              )}
            </div>
          )}

          <div className="rounded-md border bg-background/60 p-2 space-y-0.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Labour</div>
            <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Setup</span><span className="font-mono" data-testid="detail-setup-min">{(Number(breakdown.setupMinutes) || 0).toFixed(1)} min</span></div>
            <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Handling</span><span className="font-mono" data-testid="detail-handling-min">{(Number(breakdown.handlingMinutes) || 0).toFixed(1)} min</span></div>
            <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Operator buy / Shop sell</span><span className="font-mono">${breakdown.operatorRatePerHour.toFixed(0)} / ${breakdown.shopRatePerHour.toFixed(0)} /hr</span></div>
          </div>

          <div className="text-[9px] text-muted-foreground italic leading-snug px-1">
            Sell = Buy × (1 + bucket markup). Gas passes through at cost. Machine sell uses governed sell rate; machine buy uses governed buy rate.
          </div>
        </CollapsibleContent>
      </Collapsible>
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
  const resolvedRates = useMemo(() => resolveRatesFromSettings(llPricingSettings), [llPricingSettings]);
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

  const dialogCommercial = useMemo(() => {
    return applyCommercialOverride(dialogPricing, formData.quantity, buildOverrideInputs(formData));
  }, [dialogPricing, formData]);

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

  // Calculated bucketed truth per row (used for breakdown panel display + cost rollups).
  // Kept independent of the commercial override layer.
  const itemPricings = useMemo(() => {
    const map = new Map<string, LLPricingBreakdown>();
    for (const item of items) {
      if (item.isManualProcedure) continue;
      map.set(item.id, computeItemPricing(item, sheetMaterials, llPricingSettings, governedInputs));
    }
    return map;
  }, [items, sheetMaterials, llPricingSettings, governedInputs]);

  // Phase 5E — final commercial pricing per row (override + manual procedure aware).
  const itemRowPricings = useMemo(() => {
    const map = new Map<string, LLRowPricing>();
    for (const item of items) {
      map.set(item.id, computeRowPricing(item, sheetMaterials, llPricingSettings, governedInputs));
    }
    return map;
  }, [items, sheetMaterials, llPricingSettings, governedInputs]);

  const totalValue = useMemo(() => {
    let total = 0;
    for (const [, p] of itemRowPricings) {
      total += p.finalLineSell;
    }
    return total;
  }, [itemRowPricings]);

  const totalCost = useMemo(() => {
    let total = 0;
    for (const [, p] of itemRowPricings) {
      total += p.finalLineCost;
    }
    return total;
  }, [itemRowPricings]);

  const buildSnapshot = () => {
    const laserItems = items.map((item, idx) => itemToSnapshotItem(item, idx, sheetMaterials, llPricingSettings, governedInputs));
    return {
      customer: customerName,
      projectAddress,
      items: [],
      laserItems,
      totals: {
        cost: totalCost,
        sell: totalValue,
        grossProfit: totalValue - totalCost,
        grossMargin: totalValue > 0 ? ((totalValue - totalCost) / totalValue) * 100 : 0,
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
      const laserItems = items.filter(i => !i.isManualProcedure);
      const itemsMissingMaterial = laserItems.filter(i => !i.llSheetMaterialId);
      if (itemsMissingMaterial.length > 0) {
        toast({ title: "Material Required", description: `${itemsMissingMaterial.length} item(s) have no material selected (${itemsMissingMaterial.map(i => i.itemRef || i.title).join(", ")}). Edit each item and select a material before saving.`, variant: "destructive" });
        return;
      }
      const unmatchedItems = laserItems.filter(i => i.llSheetMaterialId && !sheetMaterials.find(m => m.id === i.llSheetMaterialId));
      if (unmatchedItems.length > 0) {
        toast({ title: "Stale Material", description: `${unmatchedItems.length} item(s) reference a material row that no longer exists (${unmatchedItems.map(i => i.itemRef || i.title).join(", ")}). Edit each item and reselect the material.`, variant: "destructive" });
        return;
      }
      const invalidProcedures = items.filter(i => i.isManualProcedure && computeManualProcedureFinal(i).invalid);
      if (invalidProcedures.length > 0) {
        toast({ title: "Manual Procedure Invalid", description: `${invalidProcedures.length} manual procedure line(s) need a valid unit sell or target margin.`, variant: "destructive" });
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
    const laserItems = items.filter(i => !i.isManualProcedure);
    const itemsMissingMaterial = laserItems.filter(i => !i.llSheetMaterialId);
    if (itemsMissingMaterial.length > 0) {
      toast({ title: "Material Required", description: `${itemsMissingMaterial.length} item(s) have no material selected (${itemsMissingMaterial.map(i => i.itemRef || i.title).join(", ")}). Edit each item and select a material before generating a quote.`, variant: "destructive" });
      return;
    }
    const unmatchedItems = laserItems.filter(i => i.llSheetMaterialId && !sheetMaterials.find(m => m.id === i.llSheetMaterialId));
    if (unmatchedItems.length > 0) {
      toast({ title: "Stale Material", description: `${unmatchedItems.length} item(s) reference a material row that no longer exists (${unmatchedItems.map(i => i.itemRef || i.title).join(", ")}). Edit each item and reselect the material.`, variant: "destructive" });
      return;
    }
    const invalidProcedures = items.filter(i => i.isManualProcedure && computeManualProcedureFinal(i).invalid);
    if (invalidProcedures.length > 0) {
      toast({ title: "Manual Procedure Invalid", description: `${invalidProcedures.length} manual procedure line(s) need a valid unit sell or target margin.`, variant: "destructive" });
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
    if (item.isManualProcedure) {
      openEditProcedureDialog(item);
      return;
    }
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
      coilLengthMm: item.coilLengthMm || 0,
      cutLengthMm: item.cutLengthMm,
      pierceCount: item.pierceCount,
      setupMinutes: item.setupMinutes,
      handlingMinutes: item.handlingMinutes,
      markupPercent: item.markupPercent,
      materialMarkupPercent: item.materialMarkupPercent,
      consumablesMarkupPercent: item.consumablesMarkupPercent,
      utilisationFactor: item.utilisationFactor,
      geometrySource: item.geometrySource ?? "manual",
      pricingOverrideEnabled: item.pricingOverrideEnabled ?? false,
      pricingOverrideMode: item.pricingOverrideMode ?? "none",
      manualSellPrice: item.manualSellPrice,
      targetMarginPercent: item.targetMarginPercent,
      overrideReason: item.overrideReason,
      isManualProcedure: false,
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
    if (formData.pricingOverrideEnabled && formData.pricingOverrideMode && formData.pricingOverrideMode !== "none") {
      if (formData.pricingOverrideMode === "manual_sell") {
        if (!formData.manualSellPrice || formData.manualSellPrice <= 0) {
          toast({ title: "Override Invalid", description: "Manual sell price must be greater than zero.", variant: "destructive" });
          return;
        }
      } else if (formData.pricingOverrideMode === "target_margin") {
        const tm = formData.targetMarginPercent;
        if (tm == null || !Number.isFinite(tm) || tm < 0 || tm >= 100) {
          toast({ title: "Override Invalid", description: "Target margin % must be between 0 and 100.", variant: "destructive" });
          return;
        }
      }
    }
    const pricing = computeItemPricing(formData, sheetMaterials, llPricingSettings, governedInputs);
    const commercial = applyCommercialOverride(pricing, formData.quantity, buildOverrideInputs(formData));
    const updatedData = {
      ...formData,
      llSheetMaterialId: materialId,
      // unitPrice mirrors the FINAL commercial unit sell so saved estimate JSON
      // always reflects the agreed price (override-aware) for downstream readers.
      unitPrice: commercial.finalUnitSell,
    };
    if (editingItem) {
      setItems(prev => prev.map(i => i.id === editingItem.id ? { ...updatedData, id: editingItem.id } : i));
    } else {
      setItems(prev => [...prev, { ...updatedData, id: crypto.randomUUID() }]);
    }
    setHasUnsavedChanges(true);
    setDialogOpen(false);
  };

  // ---- Manual Procedure dialog state & handlers (Phase 5E) ----
  const [procedureDialogOpen, setProcedureDialogOpen] = useState(false);
  const [editingProcedureItem, setEditingProcedureItem] = useState<LaserQuoteItem | null>(null);
  const [procedureFormData, setProcedureFormData] = useState<Omit<LaserQuoteItem, "id">>(makeEmptyManualProcedure());

  const openAddProcedureDialog = () => {
    setEditingProcedureItem(null);
    setProcedureFormData(makeEmptyManualProcedure());
    setProcedureDialogOpen(true);
  };

  const openEditProcedureDialog = (item: LaserQuoteItem) => {
    setEditingProcedureItem(item);
    setProcedureFormData({
      ...makeEmptyManualProcedure(),
      itemRef: item.itemRef,
      title: item.title,
      quantity: item.quantity,
      customerNotes: item.customerNotes,
      internalNotes: item.internalNotes,
      isManualProcedure: true,
      procedureType: item.procedureType ?? "Folding",
      procedureDescription: item.procedureDescription ?? "",
      manualUnitCost: item.manualUnitCost ?? 0,
      manualUnitSell: item.manualUnitSell ?? 0,
      manualTargetMarginPercent: item.manualTargetMarginPercent,
      manualNotes: item.manualNotes ?? "",
    });
    setProcedureDialogOpen(true);
  };

  const procedureDialogPreview = useMemo(
    () => computeManualProcedureFinal(procedureFormData),
    [procedureFormData],
  );

  const handleProcedureDialogSave = () => {
    if (!procedureFormData.itemRef.trim() || !procedureFormData.title.trim()) {
      toast({ title: "Required", description: "Item reference and title are required", variant: "destructive" });
      return;
    }
    if (!procedureFormData.procedureType) {
      toast({ title: "Required", description: "Procedure type is required", variant: "destructive" });
      return;
    }
    const preview = computeManualProcedureFinal(procedureFormData);
    if (preview.invalid) {
      toast({ title: "Invalid", description: preview.warning ?? "Manual procedure has invalid pricing.", variant: "destructive" });
      return;
    }
    const updatedData: Omit<LaserQuoteItem, "id"> = {
      ...procedureFormData,
      isManualProcedure: true,
      unitPrice: preview.unitSell,
    };
    if (editingProcedureItem) {
      setItems(prev => prev.map(i => i.id === editingProcedureItem.id ? { ...updatedData, id: editingProcedureItem.id } : i));
    } else {
      setItems(prev => [...prev, { ...updatedData, id: crypto.randomUUID() }]);
    }
    setHasUnsavedChanges(true);
    setProcedureDialogOpen(false);
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
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={openAddProcedureDialog} data-testid="button-add-manual-procedure">
                <Wrench className="h-4 w-4 mr-1" />
                Add Manual Procedure
              </Button>
              <Button size="sm" variant="outline" onClick={openAddDialog} data-testid="button-add-item">
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>
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
                      const row = itemRowPricings.get(item.id);
                      const pricing = itemPricings.get(item.id);
                      const isManual = !!item.isManualProcedure;
                      const isExpanded = expandedItems.has(item.id);
                      const matched = isManual ? null : findMatchingMaterial(sheetMaterials, item);
                      const isFlatRate = !isManual && pricing?.processMode === "flat-rate" && (item.cutLengthMm > 0 || item.pierceCount > 0);
                      const isMaterialMissing = !isManual && (!item.llSheetMaterialId || !matched);
                      const isOverridden = !!(row?.commercial?.isOverridden);
                      const overrideInvalid = !!(row?.commercial?.invalid);
                      const procedureInvalid = !!(row?.manual?.invalid);
                      const finalUnitSell = row?.finalUnitSell ?? 0;
                      const finalLineTotal = row?.finalLineSell ?? 0;
                      const finalMargin = row?.finalMarginAmount ?? 0;
                      const finalMarginPercent = row?.finalMarginPercent ?? 0;
                      const calcUnitSell = row?.commercial?.calculatedUnitSell ?? 0;
                      const calcLineTotal = row?.commercial?.calculatedSellPrice ?? 0;
                      const rowClass = isManual
                        ? "bg-blue-50/50 dark:bg-blue-950/20"
                        : isMaterialMissing
                        ? "bg-red-50/50 dark:bg-red-950/20"
                        : isOverridden
                        ? "bg-purple-50/50 dark:bg-purple-950/20"
                        : isFlatRate
                        ? "bg-amber-50/50 dark:bg-amber-950/20"
                        : undefined;
                      return (
                        <Fragment key={item.id}>
                          <TableRow data-testid={`row-item-${idx}`} className={rowClass}>
                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-mono text-xs" data-testid={`text-item-ref-${idx}`}>
                              <div className="flex flex-wrap items-center gap-1">
                                <span>{item.itemRef}</span>
                                {isManual && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/30 dark:text-blue-300" data-testid={`badge-manual-procedure-${idx}`}>
                                    Manual Procedure ({item.procedureType ?? "—"})
                                  </Badge>
                                )}
                                {!isManual && isMaterialMissing && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-red-50 text-red-700 border-red-300" data-testid={`badge-material-missing-${idx}`}>No Material</Badge>
                                )}
                                {!isManual && isFlatRate && !isMaterialMissing && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-amber-50 text-amber-700 border-amber-300" data-testid={`badge-flat-rate-${idx}`}>Flat Rate</Badge>
                                )}
                                {!isManual && isOverridden && !overrideInvalid && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/30 dark:text-purple-300" data-testid={`badge-manual-override-${idx}`}>
                                    Manual Override ({item.pricingOverrideMode === "manual_sell" ? "Sell $" : "Margin %"})
                                  </Badge>
                                )}
                                {!isManual && overrideInvalid && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-orange-50 text-orange-700 border-orange-300" data-testid={`badge-override-invalid-${idx}`}>Override Invalid</Badge>
                                )}
                                {isManual && procedureInvalid && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-orange-50 text-orange-700 border-orange-300" data-testid={`badge-procedure-invalid-${idx}`}>Pricing Invalid</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell data-testid={`text-item-title-${idx}`}>{item.title}</TableCell>
                            <TableCell className="text-center">{item.quantity}</TableCell>
                            <TableCell className="text-xs">
                              {isManual ? <span className="text-muted-foreground italic">—</span> : ([item.materialType, item.materialGrade].filter(Boolean).join(" / ") || "—")}
                            </TableCell>
                            <TableCell className="text-right">{!isManual && item.thickness > 0 ? `${item.thickness}mm` : "—"}</TableCell>
                            <TableCell className="text-right text-xs">
                              {!isManual && item.length > 0 && item.width > 0 ? `${item.length} x ${item.width}` : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono" data-testid={`text-unit-cost-${idx}`}>
                              {isManual ? (
                                <span>${(item.manualUnitCost ?? 0).toFixed(2)}</span>
                              ) : pricing ? (
                                <span>${(pricing.internalCostSubtotal / (item.quantity || 1)).toFixed(2)}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono" data-testid={`text-unit-sell-${idx}`}>
                              <span>${finalUnitSell.toFixed(2)}</span>
                              {!isManual && isOverridden && (
                                <span className="block text-[10px] text-muted-foreground line-through" data-testid={`text-calculated-unit-sell-${idx}`}>
                                  ${calcUnitSell.toFixed(2)}
                                </span>
                              )}
                              {row && (
                                <span className="block text-[10px] text-muted-foreground" data-testid={`text-markup-indicator-${idx}`}>
                                  {finalMarginPercent.toFixed(0)}% margin
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono font-medium" data-testid={`text-line-total-${idx}`}>
                              <span>${finalLineTotal.toFixed(2)}</span>
                              {!isManual && isOverridden && (
                                <span className="block text-[10px] text-muted-foreground line-through" data-testid={`text-calculated-line-total-${idx}`}>
                                  ${calcLineTotal.toFixed(2)}
                                </span>
                              )}
                              {row && (
                                <span className={`block text-[10px] ${finalMargin < 0 ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"}`} data-testid={`text-margin-indicator-${idx}`}>
                                  {finalMargin >= 0 ? "+" : ""}${finalMargin.toFixed(2)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {!isManual && (
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
                                )}
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
                          {isExpanded && !isManual && pricing && (
                            <TableRow>
                              <TableCell colSpan={11} className="p-2">
                                <PricingBreakdownPanel
                                  breakdown={pricing}
                                  supplierName={matched?.supplierName || "—"}
                                />
                                {isOverridden && row?.commercial && (
                                  <div className="mt-2 p-3 rounded-md border border-purple-200 dark:border-purple-800 bg-purple-50/40 dark:bg-purple-950/20" data-testid={`panel-override-summary-${idx}`}>
                                    <div className="flex items-center gap-2 text-xs font-semibold text-purple-800 dark:text-purple-300">
                                      <DollarSign className="h-3.5 w-3.5" /> Commercial Override Active
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs">
                                      <div><span className="text-muted-foreground">Calc unit sell: </span><span className="font-mono">${row.commercial.calculatedUnitSell.toFixed(2)}</span></div>
                                      <div><span className="text-muted-foreground">Final unit sell: </span><span className="font-mono font-semibold">${row.commercial.finalUnitSell.toFixed(2)}</span></div>
                                      <div><span className="text-muted-foreground">Calc margin %: </span><span className="font-mono">{row.commercial.calculatedMarginPercent.toFixed(1)}%</span></div>
                                      <div><span className="text-muted-foreground">Final margin %: </span><span className={`font-mono font-semibold ${row.commercial.finalMarginAmount < 0 ? "text-red-700" : ""}`}>{row.commercial.finalMarginPercent.toFixed(1)}%</span></div>
                                    </div>
                                    {row.commercial.warning && (
                                      <div className="mt-2 text-[11px] text-orange-700 dark:text-orange-400 flex items-start gap-1" data-testid={`text-override-warning-${idx}`}>
                                        <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                        <span>{row.commercial.warning}</span>
                                      </div>
                                    )}
                                    {item.overrideReason && (
                                      <div className="mt-2 text-[11px] text-muted-foreground italic" data-testid={`text-override-reason-${idx}`}>
                                        Reason: {item.overrideReason}
                                      </div>
                                    )}
                                  </div>
                                )}
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
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="materialMarkupPercent">Material Markup %</Label>
                      <Input
                        id="materialMarkupPercent"
                        type="number"
                        min={0}
                        step={1}
                        value={formData.materialMarkupPercent ?? resolvedRates.defaultMaterialMarkupPercent}
                        onChange={(e) => setFormData(prev => ({ ...prev, materialMarkupPercent: parseFloat(e.target.value) || 0 }))}
                        data-testid="input-material-markup-percent"
                      />
                    </div>
                    <div>
                      <Label htmlFor="consumablesMarkupPercent">Consumables Markup %</Label>
                      <Input
                        id="consumablesMarkupPercent"
                        type="number"
                        min={0}
                        step={1}
                        value={formData.consumablesMarkupPercent ?? resolvedRates.defaultConsumablesMarkupPercent}
                        onChange={(e) => setFormData(prev => ({ ...prev, consumablesMarkupPercent: parseFloat(e.target.value) || 0 }))}
                        data-testid="input-consumables-markup-percent"
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
                      <p className="text-[10px] text-muted-foreground mt-0.5">Sheet utilisation (0.75 = 75%)</p>
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

            {/* Phase 5E — Commercial Override Layer */}
            <Collapsible open={!!formData.pricingOverrideEnabled || (formData.pricingOverrideMode != null && formData.pricingOverrideMode !== "none")}>
              <div className="border rounded-md p-3 space-y-3 bg-purple-50/30 dark:bg-purple-950/10 border-purple-200 dark:border-purple-900" data-testid="section-commercial-override">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-purple-700 dark:text-purple-300" />
                    <span className="text-sm font-semibold">Commercial Override</span>
                    <span className="text-[11px] text-muted-foreground">(optional — overrides calculated sell)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="override-toggle" className="text-xs cursor-pointer select-none">Use manual pricing override</Label>
                    <Switch
                      id="override-toggle"
                      checked={!!formData.pricingOverrideEnabled}
                      onCheckedChange={(v) => setFormData(prev => ({
                        ...prev,
                        pricingOverrideEnabled: v,
                        pricingOverrideMode: v ? (prev.pricingOverrideMode && prev.pricingOverrideMode !== "none" ? prev.pricingOverrideMode : "manual_sell") : "none",
                      }))}
                      data-testid="switch-override-enabled"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Calculated unit sell:</span>
                    <span className="font-mono ml-2" data-testid="text-dialog-calculated-unit-sell">${dialogCommercial.calculatedUnitSell.toFixed(2)}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Calculated unit cost:</span>
                    <span className="font-mono ml-2" data-testid="text-dialog-calculated-unit-cost">${dialogCommercial.calculatedUnitCost.toFixed(2)}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Calculated margin %:</span>
                    <span className="font-mono ml-2" data-testid="text-dialog-calculated-margin">{dialogCommercial.calculatedMarginPercent.toFixed(1)}%</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Calculated line sell:</span>
                    <span className="font-mono ml-2" data-testid="text-dialog-calculated-line">${dialogCommercial.calculatedSellPrice.toFixed(2)}</span>
                  </div>
                </div>

                {!!formData.pricingOverrideEnabled && (
                  <CollapsibleContent forceMount asChild>
                    <div className="space-y-3 pt-2 border-t border-purple-200 dark:border-purple-900">
                      <div>
                        <Label className="text-xs">Override Mode</Label>
                        <Select
                          value={formData.pricingOverrideMode ?? "manual_sell"}
                          onValueChange={(v) => setFormData(prev => ({ ...prev, pricingOverrideMode: v as LLPricingOverrideMode }))}
                        >
                          <SelectTrigger data-testid="select-override-mode">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual_sell" data-testid="select-mode-manual-sell">Manual unit sell price</SelectItem>
                            <SelectItem value="target_margin" data-testid="select-mode-target-margin">Target margin %</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {formData.pricingOverrideMode === "manual_sell" && (
                        <div>
                          <Label htmlFor="manual-sell-input" className="text-xs">Manual unit sell price (per unit, ex GST)</Label>
                          <Input
                            id="manual-sell-input"
                            type="number"
                            step="0.01"
                            min={0}
                            value={formData.manualSellPrice ?? ""}
                            onChange={(e) => setFormData(prev => ({ ...prev, manualSellPrice: e.target.value === "" ? undefined : parseFloat(e.target.value) }))}
                            placeholder="0.00"
                            data-testid="input-manual-sell-price"
                          />
                        </div>
                      )}

                      {formData.pricingOverrideMode === "target_margin" && (
                        <div>
                          <Label htmlFor="target-margin-input" className="text-xs">Target margin % (0–99.99)</Label>
                          <Input
                            id="target-margin-input"
                            type="number"
                            step="0.1"
                            min={0}
                            max={99.99}
                            value={formData.targetMarginPercent ?? ""}
                            onChange={(e) => setFormData(prev => ({ ...prev, targetMarginPercent: e.target.value === "" ? undefined : parseFloat(e.target.value) }))}
                            placeholder="35"
                            data-testid="input-target-margin-percent"
                          />
                        </div>
                      )}

                      <div>
                        <Label htmlFor="override-reason-input" className="text-xs">Override reason / notes (recommended)</Label>
                        <Textarea
                          id="override-reason-input"
                          rows={2}
                          value={formData.overrideReason ?? ""}
                          onChange={(e) => setFormData(prev => ({ ...prev, overrideReason: e.target.value }))}
                          placeholder="Why is the calculated price being overridden?"
                          data-testid="input-override-reason"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-purple-200 dark:border-purple-900">
                        <div>
                          <span className="text-muted-foreground">Final unit sell:</span>
                          <span className="font-mono ml-2 font-semibold" data-testid="text-dialog-final-unit-sell">${dialogCommercial.finalUnitSell.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Final line sell:</span>
                          <span className="font-mono ml-2 font-semibold" data-testid="text-dialog-final-line-sell">${dialogCommercial.finalSellPrice.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Final margin %:</span>
                          <span className={`font-mono ml-2 font-semibold ${dialogCommercial.finalMarginAmount < 0 ? "text-red-700" : ""}`} data-testid="text-dialog-final-margin">
                            {dialogCommercial.finalMarginPercent.toFixed(1)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Final margin $:</span>
                          <span className={`font-mono ml-2 font-semibold ${dialogCommercial.finalMarginAmount < 0 ? "text-red-700" : ""}`} data-testid="text-dialog-final-margin-amount">
                            ${dialogCommercial.finalMarginAmount.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {dialogCommercial.warning && (
                        <div className="flex items-start gap-2 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-md px-3 py-2" data-testid="warning-override">
                          <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                          <span className="text-xs text-orange-800 dark:text-orange-300">{dialogCommercial.warning}</span>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                )}
              </div>
            </Collapsible>

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

      {/* Phase 5E — Manual Procedure dialog */}
      <Dialog open={procedureDialogOpen} onOpenChange={setProcedureDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" data-testid="dialog-manual-procedure">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-blue-700 dark:text-blue-300" />
              {editingProcedureItem ? "Edit Manual Procedure" : "Add Manual Procedure"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-md p-2" data-testid="text-procedure-help">
              Manual procedure / provisional lines are not laser-cut items. They bypass the bucketed pricing engine and use the unit cost / unit sell you enter directly.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="proc-itemRef">Item Reference *</Label>
                <Input
                  id="proc-itemRef"
                  value={procedureFormData.itemRef}
                  onChange={(e) => setProcedureFormData(prev => ({ ...prev, itemRef: e.target.value }))}
                  placeholder="e.g. MP-001"
                  data-testid="input-procedure-item-ref"
                />
              </div>
              <div>
                <Label htmlFor="proc-quantity">Quantity</Label>
                <Input
                  id="proc-quantity"
                  type="number"
                  min={1}
                  value={procedureFormData.quantity}
                  onChange={(e) => setProcedureFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                  data-testid="input-procedure-quantity"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="proc-type">Procedure Type *</Label>
                <Select
                  value={procedureFormData.procedureType ?? "Folding"}
                  onValueChange={(v) => setProcedureFormData(prev => ({ ...prev, procedureType: v as LLManualProcedureType }))}
                >
                  <SelectTrigger data-testid="select-procedure-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LL_MANUAL_PROCEDURE_TYPES.map(t => (
                      <SelectItem key={t} value={t} data-testid={`select-procedure-type-${t}`}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="proc-title">Title *</Label>
                <Input
                  id="proc-title"
                  value={procedureFormData.title}
                  onChange={(e) => setProcedureFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Folding — 3 bends"
                  data-testid="input-procedure-title"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="proc-description">Description</Label>
              <Textarea
                id="proc-description"
                rows={2}
                value={procedureFormData.procedureDescription ?? ""}
                onChange={(e) => setProcedureFormData(prev => ({ ...prev, procedureDescription: e.target.value }))}
                placeholder="Optional description visible in internal records"
                data-testid="input-procedure-description"
              />
            </div>

            <div className="border rounded-md p-3 space-y-3 bg-muted/20">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pricing</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="proc-unit-cost" className="text-xs">Unit Cost (ex GST)</Label>
                  <Input
                    id="proc-unit-cost"
                    type="number"
                    step="0.01"
                    min={0}
                    value={procedureFormData.manualUnitCost ?? 0}
                    onChange={(e) => setProcedureFormData(prev => ({ ...prev, manualUnitCost: parseFloat(e.target.value) || 0 }))}
                    data-testid="input-procedure-unit-cost"
                  />
                </div>
                <div>
                  <Label htmlFor="proc-unit-sell" className="text-xs">Unit Sell (ex GST)</Label>
                  <Input
                    id="proc-unit-sell"
                    type="number"
                    step="0.01"
                    min={0}
                    value={procedureFormData.manualUnitSell ?? 0}
                    onChange={(e) => setProcedureFormData(prev => ({ ...prev, manualUnitSell: parseFloat(e.target.value) || 0, manualTargetMarginPercent: undefined }))}
                    data-testid="input-procedure-unit-sell"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="proc-target-margin" className="text-xs">Or use target margin % (overrides unit sell when set, 0–99.99)</Label>
                <Input
                  id="proc-target-margin"
                  type="number"
                  step="0.1"
                  min={0}
                  max={99.99}
                  value={procedureFormData.manualTargetMarginPercent ?? ""}
                  onChange={(e) => setProcedureFormData(prev => ({ ...prev, manualTargetMarginPercent: e.target.value === "" ? undefined : parseFloat(e.target.value) }))}
                  placeholder="e.g. 35"
                  data-testid="input-procedure-target-margin"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t text-xs">
                <div>
                  <span className="text-muted-foreground">Final unit sell:</span>
                  <span className="font-mono ml-2 font-semibold" data-testid="text-procedure-preview-unit-sell">${procedureDialogPreview.unitSell.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Line total:</span>
                  <span className="font-mono ml-2 font-semibold" data-testid="text-procedure-preview-line-total">${procedureDialogPreview.lineSell.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Margin %:</span>
                  <span className={`font-mono ml-2 ${procedureDialogPreview.lineMargin < 0 ? "text-red-700" : ""}`} data-testid="text-procedure-preview-margin">{procedureDialogPreview.marginPercent.toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Margin $:</span>
                  <span className={`font-mono ml-2 ${procedureDialogPreview.lineMargin < 0 ? "text-red-700" : ""}`} data-testid="text-procedure-preview-margin-amount">${procedureDialogPreview.lineMargin.toFixed(2)}</span>
                </div>
              </div>

              {procedureDialogPreview.warning && (
                <div className="flex items-start gap-2 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-md px-3 py-2" data-testid="warning-procedure">
                  <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                  <span className="text-xs text-orange-800 dark:text-orange-300">{procedureDialogPreview.warning}</span>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="proc-notes" className="text-xs">Internal notes</Label>
              <Textarea
                id="proc-notes"
                rows={2}
                value={procedureFormData.manualNotes ?? ""}
                onChange={(e) => setProcedureFormData(prev => ({ ...prev, manualNotes: e.target.value }))}
                placeholder="Internal notes for this procedure (not shown on quote)"
                data-testid="input-procedure-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProcedureDialogOpen(false)} data-testid="button-cancel-procedure">Cancel</Button>
            <Button onClick={handleProcedureDialogSave} data-testid="button-save-procedure">{editingProcedureItem ? "Update" : "Add"}</Button>
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
