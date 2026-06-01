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
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import type { LaserQuoteItem, LLPricingSettings, DivisionSettings, LLPricingProfile, LLPricingOverrideMode, LLManualProcedureType, AttachedManualProcedure } from "@shared/schema";
import { LL_MANUAL_PROCEDURE_TYPES } from "@shared/schema";
import type { LaserSnapshotItem } from "@shared/estimate-snapshot";
import {
  resolveRatesFromSettings,
  applyCommercialOverride,
  type LLPricingBreakdown,
  type LLGovernedInputs,
} from "@/lib/ll-pricing";
import type { LLGasCostInput, LLConsumablesCostInput } from "@shared/schema";
// Phase 5H.9E — the reusable LL row-pricing helpers and types now live in a
// neutral LL library module (client/src/lib/ll-estimate-totals.ts) so the LL
// Estimates List can consume them without importing from this page. They are
// re-imported here so the builder's behaviour is byte-for-byte unchanged.
import {
  type SheetMaterialRef,
  type LLItemReadiness,
  type AttachedProcedurePricing,
  type AttachedProceduresRollup,
  type LLRowPricing,
  isItemQuoteReady,
  buildOverrideInputs,
  computeManualProcedureFinal,
  computeAttachedProcedureFinal,
  rollupAttachedProcedures,
  findMatchingMaterial,
  materialToTruth,
  computeItemPricing,
  computeRowPricing,
} from "@/lib/ll-estimate-totals";

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
    setupMinutes: 0,
    handlingMinutes: 0,
    markupPercent: rates.defaultMarkupPercent,
    materialMarkupPercent: rates.defaultMaterialMarkupPercent,
    consumablesMarkupPercent: rates.defaultConsumablesMarkupPercent,
    utilisationFactor: rates.defaultUtilisationFactor,
    geometrySource: "manual",
    pricingOverrideEnabled: false,
    pricingOverrideMode: "none",
    isManualProcedure: false,
    // Phase 5H.9A — seed material allocation from the ACTIVE profile default for
    // NEW lines only. This is the ONLY place the profile default is consulted;
    // the engine never uses it as a fallback for existing lines. Absent profile
    // default → whole-sheets (legacy-safe).
    materialAllocationMode: settings?.defaultMaterialAllocationMode ?? "whole-sheets",
    yieldMinimumSheetChargePercent: settings?.defaultYieldMinimumSheetChargePercent ?? 25,
    recoverableRemnantPercent: settings?.defaultRecoverableRemnantPercent ?? 75,
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
    markupOnCostPercent: item.markupOnCostPercent,
    overrideReason: item.overrideReason,
    calculatedSellPrice: commercial.calculatedSellPrice,
    calculatedBuyCost: commercial.calculatedBuyCost,
    // NOTE: parent snapshot row carries the LASER-BASE final values only
    // (excluding attached procedures). Attached procedures are also flattened
    // into separate snapshot rows immediately after the parent so the customer
    // PDF/Preview can render them inline. Subtotal = sum of all flattened rows.
    finalSellPrice: commercial.finalSellPrice,
    finalMarginAmount: commercial.finalMarginAmount,
    finalMarginPercent: commercial.finalMarginPercent,
    attachedManualProcedures: item.attachedManualProcedures,
  };
}

// Phase 5E (Attached Manual Procedures) — build a pseudo snapshot row that
// represents one attached procedure as its own customer-visible sub-line.
// These rows live in laserItems[] right after their parent. They carry
// `attachedToParentRef` so reload-time loaders can skip them when rebuilding
// the parent's `attachedManualProcedures` array (the array is already on the
// parent snapshot row — these flattened rows exist purely for PDF/Preview).
function attachedProcedureToSnapshotPseudoRow(
  parentItem: LaserQuoteItem,
  proc: AttachedManualProcedure,
  itemNumber: number,
): LaserSnapshotItem {
  const pricing = computeAttachedProcedureFinal(proc, parentItem.quantity || 1);
  const parentRef = parentItem.itemRef || `item-${itemNumber}`;
  const titleBase = proc.description?.trim() || `${proc.procedureType} (manual / provisional)`;
  return {
    itemNumber,
    itemRef: `${parentRef}.${proc.procedureType.charAt(0).toUpperCase()}${(parentItem.attachedManualProcedures ?? []).indexOf(proc) + 1}`,
    title: `${titleBase} — attached to ${parentRef}`,
    quantity: pricing.quantity,
    materialType: "",
    materialGrade: "",
    thickness: 0,
    length: 0,
    width: 0,
    finish: "",
    customerNotes: "",
    internalNotes: proc.notes ?? "",
    unitPrice: pricing.unitSell,
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
    internalCostSubtotal: pricing.lineCost,
    markupAmount: pricing.lineMargin,
    sellTotal: pricing.lineSell,
    materialBuyCost: 0,
    materialSellCost: 0,
    labourBuyCost: 0,
    labourSellCost: 0,
    machineBuyCost: 0,
    machineSellCost: 0,
    consumablesBuyCost: 0,
    consumablesSellCost: 0,
    gasBuyCost: 0,
    totalBuyCost: pricing.lineCost,
    totalMargin: pricing.lineMargin,
    totalMarginPercent: pricing.marginPercent,
    geometrySource: "manual",
    isManualProcedure: true,
    procedureType: proc.procedureType,
    procedureDescription: proc.description,
    manualUnitCost: pricing.unitCost,
    manualUnitSell: pricing.unitSell,
    manualTargetMarginPercent: proc.targetMarginPercent,
    manualNotes: proc.notes,
    finalSellPrice: pricing.lineSell,
    finalMarginAmount: pricing.lineMargin,
    finalMarginPercent: pricing.marginPercent,
    attachedToParentRef: parentRef,
    attachedProcedureId: proc.id,
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
    setupMinutes: si.setupMinutes ?? 0,
    handlingMinutes: si.handlingMinutes ?? 0,
    markupPercent: si.markupPercent ?? rates.defaultMarkupPercent,
    materialMarkupPercent: (si as any).materialMarkupPercent ?? rates.defaultMaterialMarkupPercent,
    consumablesMarkupPercent: (si as any).consumablesMarkupPercent ?? rates.defaultConsumablesMarkupPercent,
    utilisationFactor: si.utilisationFactor ?? rates.defaultUtilisationFactor,
    geometrySource: (si as any).geometrySource ?? "manual",
    pricingOverrideEnabled: (si as any).pricingOverrideEnabled ?? false,
    pricingOverrideMode: ((si as any).pricingOverrideMode as LLPricingOverrideMode | undefined) ?? "none",
    manualSellPrice: (si as any).manualSellPrice,
    targetMarginPercent: (si as any).targetMarginPercent,
    markupOnCostPercent: (si as any).markupOnCostPercent,
    overrideReason: (si as any).overrideReason,
    isManualProcedure,
    procedureType: (si as any).procedureType as LLManualProcedureType | undefined,
    procedureDescription: (si as any).procedureDescription,
    manualUnitCost: (si as any).manualUnitCost,
    manualUnitSell: (si as any).manualUnitSell,
    manualTargetMarginPercent: (si as any).manualTargetMarginPercent,
    manualNotes: (si as any).manualNotes,
    attachedManualProcedures: (si as any).attachedManualProcedures as AttachedManualProcedure[] | undefined,
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

// Phase 5I — Benchmark Calibration (internal only).
// A collapsible, internal-only calibration aid that compares the SteelIQ
// engine-CALCULATED line result against a manually entered supplier/competitor
// benchmark. It changes NO pricing math, totals, snapshots, customer Preview,
// PDF, LJ or LE. Benchmark inputs are LOCAL COMPONENT STATE ONLY (not persisted
// to item JSON, the estimate, or the DB) for this first phase. The panel never
// renders on any customer-facing surface — it lives inside the LL builder's
// internal pricing calculation area.
function BenchmarkCalibrationPanel({
  quantity,
  breakdown,
  attachedTotalSell,
  attachedCount,
}: {
  quantity: number;
  breakdown: LLPricingBreakdown;
  attachedTotalSell: number;
  attachedCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [unitStr, setUnitStr] = useState("");
  const [totalStr, setTotalStr] = useState("");
  const [notes, setNotes] = useState("");
  const [includeChildren, setIncludeChildren] = useState(false);

  const money = (n: number) => `$${n.toFixed(2)}`;
  const qty = Math.max(quantity || 0, 1);

  // SteelIQ calculated result. Uses the engine breakdown sell (pre commercial
  // override) so bucket contributions reconcile cleanly against the line sell.
  const parentSell = breakdown.sellTotal;
  const combinedSell = parentSell + attachedTotalSell;
  const scopeChildren = includeChildren && attachedCount > 0;
  const steelIqLineSell = scopeChildren ? combinedSell : parentSell;
  const steelIqUnitSell = steelIqLineSell / qty;

  // Benchmark inputs. Either value may be blank; the other is derived.
  const unitNum = parseFloat(unitStr);
  const totalNum = parseFloat(totalStr);
  const unitValid = Number.isFinite(unitNum) && unitNum > 0;
  const totalValid = Number.isFinite(totalNum) && totalNum > 0;
  let benchUnit: number | null = null;
  let benchTotal: number | null = null;
  let benchTotalDerived = false;
  let benchUnitDerived = false;
  if (unitValid && totalValid) {
    benchUnit = unitNum;
    benchTotal = totalNum;
  } else if (unitValid) {
    benchUnit = unitNum;
    benchTotal = unitNum * qty;
    benchTotalDerived = true;
  } else if (totalValid) {
    benchTotal = totalNum;
    benchUnit = totalNum / qty;
    benchUnitDerived = true;
  }
  const hasBenchmark = benchUnit != null && benchTotal != null;

  const diffUnit = hasBenchmark ? steelIqUnitSell - (benchUnit as number) : 0;
  const diffTotal = hasBenchmark ? steelIqLineSell - (benchTotal as number) : 0;
  const diffPct = hasBenchmark && (benchTotal as number) !== 0
    ? (diffTotal / (benchTotal as number)) * 100
    : null;

  let status: "below" | "near" | "above" | null = null;
  if (diffPct != null) {
    if (Math.abs(diffPct) <= 5) status = "near";
    else if (diffPct > 5) status = "above";
    else status = "below";
  }

  const buckets: Array<{ key: string; label: string; sell: number }> = [
    { key: "material", label: "Material sell", sell: breakdown.materialSellCost },
    { key: "machine", label: "Machine sell", sell: breakdown.machineSellCost },
    { key: "gas", label: "Gas sell", sell: breakdown.gasSellCost },
    { key: "consumables", label: "Consumables sell", sell: breakdown.consumablesSellCost },
    { key: "allowance", label: "Production allowance labour recovery", sell: breakdown.productionAllowanceSellCost },
    { key: "overhead", label: "Production overhead recovery", sell: breakdown.productionOverheadAmount },
  ];
  // Only contribute the child-procedure bucket when children are in scope, so
  // bucket percentages stay consistent with the SteelIQ line sell denominator.
  if (scopeChildren) {
    buckets.push({ key: "child", label: "Manual child procedure total", sell: attachedTotalSell });
  }
  const bucketPct = (sell: number) =>
    steelIqLineSell > 0 ? (sell / steelIqLineSell) * 100 : 0;

  return (
    <div className="border border-dashed border-sky-300 dark:border-sky-800 rounded-md bg-sky-50/40 dark:bg-sky-950/20" data-testid="benchmark-calibration-panel">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-1.5 px-3 py-2"
        data-testid="button-toggle-benchmark-calibration"
      >
        <FlaskConical className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
        <span className="text-xs font-semibold text-sky-800 dark:text-sky-300 uppercase tracking-wide">
          Benchmark Calibration
        </span>
        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800">
          internal
        </Badge>
        {status && (
          <Badge
            variant="outline"
            className={`text-[9px] px-1.5 py-0 h-4 ${
              status === "near"
                ? "bg-green-50 text-green-700 border-green-300 dark:bg-green-950/30 dark:text-green-300"
                : status === "above"
                  ? "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/30 dark:text-red-300"
                  : "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/30 dark:text-blue-300"
            }`}
            data-testid="badge-benchmark-status-collapsed"
          >
            {status === "near" ? "Near benchmark" : status === "above" ? "Above benchmark" : "Below benchmark"}
          </Badge>
        )}
        <span className="ml-auto">
          {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3" data-testid="benchmark-calibration-body">
          <p className="text-[10px] text-muted-foreground italic leading-snug">
            Internal calibration aid only. Does not change pricing, totals, snapshots, or any customer document. Inputs are not saved.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Benchmark name / source</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Hi-Tech Metals quote 61569"
                className="h-7 text-xs"
                data-testid="input-benchmark-name"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Notes (optional)</Label>
              <Input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional"
                className="h-7 text-xs"
                data-testid="input-benchmark-notes"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Benchmark unit price (ex GST)</Label>
              <Input
                value={unitStr}
                onChange={e => setUnitStr(e.target.value)}
                inputMode="decimal"
                placeholder="e.g. 1.97"
                className="h-7 text-xs font-mono"
                data-testid="input-benchmark-unit-price"
              />
              {benchUnitDerived && (
                <span className="text-[9px] text-muted-foreground" data-testid="text-benchmark-unit-derived">
                  Implied from total ÷ qty
                </span>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Benchmark total (ex GST, optional)</Label>
              <Input
                value={totalStr}
                onChange={e => setTotalStr(e.target.value)}
                inputMode="decimal"
                placeholder="auto = unit × qty"
                className="h-7 text-xs font-mono"
                data-testid="input-benchmark-total"
              />
              {benchTotalDerived && (
                <span className="text-[9px] text-muted-foreground" data-testid="text-benchmark-total-derived">
                  Auto = unit × {qty} qty
                </span>
              )}
            </div>
          </div>

          {attachedCount > 0 && (
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer" data-testid="label-benchmark-include-children">
              <input
                type="checkbox"
                checked={includeChildren}
                onChange={e => setIncludeChildren(e.target.checked)}
                className="h-3.5 w-3.5"
                data-testid="checkbox-benchmark-include-children"
              />
              Include {attachedCount} attached manual child procedure{attachedCount === 1 ? "" : "s"} in comparison
            </label>
          )}
          <div className="flex items-center gap-1.5 text-[10px]" data-testid="text-benchmark-scope">
            <Info className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">
              Comparing: <span className="font-medium text-foreground">
                {scopeChildren ? "Parent laser line + attached manual child procedures" : "Parent laser line only"}
              </span>
              {attachedCount > 0 && !scopeChildren ? " (tick above to include child procedures)" : ""}
            </span>
          </div>

          {/* Comparison */}
          <div className="rounded-md border bg-background/60 p-2 space-y-1">
            <div className="grid grid-cols-[1fr_90px_90px] gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">
              <span></span>
              <span className="text-right">Unit (ex GST)</span>
              <span className="text-right">Line (ex GST)</span>
            </div>
            <div className="grid grid-cols-[1fr_90px_90px] gap-1 text-[11px]">
              <span className="text-muted-foreground">SteelIQ calculated</span>
              <span className="text-right font-mono" data-testid="text-benchmark-steeliq-unit">{money(steelIqUnitSell)}</span>
              <span className="text-right font-mono" data-testid="text-benchmark-steeliq-line">{money(steelIqLineSell)}</span>
            </div>
            <div className="grid grid-cols-[1fr_90px_90px] gap-1 text-[11px]">
              <span className="text-muted-foreground">Benchmark</span>
              <span className="text-right font-mono" data-testid="text-benchmark-unit">{hasBenchmark ? money(benchUnit as number) : "—"}</span>
              <span className="text-right font-mono" data-testid="text-benchmark-total">{hasBenchmark ? money(benchTotal as number) : "—"}</span>
            </div>
            {hasBenchmark && (
              <>
                <div className="grid grid-cols-[1fr_90px_90px] gap-1 text-[11px] border-t pt-1 mt-0.5">
                  <span className="text-muted-foreground">Difference (SteelIQ − benchmark)</span>
                  <span className={`text-right font-mono ${diffUnit > 0 ? "text-red-700 dark:text-red-400" : diffUnit < 0 ? "text-blue-700 dark:text-blue-400" : ""}`} data-testid="text-benchmark-diff-unit">
                    {diffUnit >= 0 ? "+" : "−"}{money(Math.abs(diffUnit))}
                  </span>
                  <span className={`text-right font-mono ${diffTotal > 0 ? "text-red-700 dark:text-red-400" : diffTotal < 0 ? "text-blue-700 dark:text-blue-400" : ""}`} data-testid="text-benchmark-diff-total">
                    {diffTotal >= 0 ? "+" : "−"}{money(Math.abs(diffTotal))}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-muted-foreground">Difference %</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono" data-testid="text-benchmark-diff-percent">
                      {diffPct != null ? `${diffPct >= 0 ? "+" : "−"}${Math.abs(diffPct).toFixed(1)}%` : "—"}
                    </span>
                    {status && (
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1.5 py-0 h-4 ${
                          status === "near"
                            ? "bg-green-50 text-green-700 border-green-300 dark:bg-green-950/30 dark:text-green-300"
                            : status === "above"
                              ? "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/30 dark:text-red-300"
                              : "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/30 dark:text-blue-300"
                        }`}
                        data-testid="badge-benchmark-status"
                      >
                        {status === "near" ? "Near benchmark" : status === "above" ? "Above benchmark" : "Below benchmark"}
                      </Badge>
                    )}
                  </div>
                </div>
              </>
            )}
            {!hasBenchmark && (
              <p className="text-[10px] text-muted-foreground italic pt-1" data-testid="text-benchmark-empty">
                Enter a benchmark unit price or total to see the comparison.
              </p>
            )}
          </div>

          {/* Bucket contribution */}
          <div className="rounded-md border bg-background/60 p-2 space-y-0.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1 mb-1">
              SteelIQ bucket contribution
            </div>
            {buckets.map(b => (
              <div key={b.key} className="grid grid-cols-[1fr_80px_56px] gap-1 text-[10px]" data-testid={`row-benchmark-bucket-${b.key}`}>
                <span className="text-muted-foreground truncate">{b.label}</span>
                <span className="text-right font-mono">{money(b.sell)}</span>
                <span className="text-right font-mono text-muted-foreground">{bucketPct(b.sell).toFixed(1)}%</span>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_80px_56px] gap-1 text-[10px] font-semibold border-t pt-1 mt-1">
              <span>SteelIQ line sell</span>
              <span className="text-right font-mono" data-testid="text-benchmark-bucket-total">{money(steelIqLineSell)}</span>
              <span className="text-right font-mono text-muted-foreground">100%</span>
            </div>
            <p className="text-[9px] text-muted-foreground italic pt-1 leading-snug">
              Bucket sells are the engine-calculated line values (pre commercial override). Percentages are of the SteelIQ line sell shown above.
            </p>
          </div>
        </div>
      )}
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

      <div className="grid grid-cols-[1fr_80px_80px_70px] gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1" title="All bucket values are line totals (buy/sell × quantity)">
        <span>Bucket (line totals)</span>
        <span className="text-right">Line Buy</span>
        <span className="text-right">Line Sell</span>
        <span className="text-right">Margin</span>
      </div>

      <BucketRow
        label={`Material (${breakdown.materialMarkupPercent}% mkp)`}
        buy={`$${breakdown.materialBuyCost.toFixed(2)}`}
        sell={`$${breakdown.materialSellCost.toFixed(2)}`}
        margin={`$${breakdown.materialMargin.toFixed(2)}`}
      />
      {/* Phase 5H.9B — always-visible (no edit modal) internal material allocation
          basis indicator. Line-level wording ("this line"). Not on customer surfaces. */}
      <div className="flex items-center -mt-0.5 mb-0.5 pl-1" data-testid="material-allocation-basis">
        {breakdown.materialAllocationPolicy === "yield-based" && breakdown.yieldApplied ? (
          <span className="inline-flex items-center rounded bg-purple-100 dark:bg-purple-950/40 px-1.5 py-0.5 text-[9px] font-medium text-purple-700 dark:text-purple-300">
            Material allocation: Estimated yield-based (this line)
          </span>
        ) : (
          <span className="inline-flex items-center rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[9px] font-medium text-slate-700 dark:text-slate-300">
            Material allocation: Whole sheet (this line)
          </span>
        )}
      </div>
      <BucketRow
        label={`Machine ($${breakdown.machineBuyRatePerHour.toFixed(0)}→$${breakdown.machineSellRatePerHour.toFixed(0)}/hr)`}
        buy={`$${breakdown.machineBuyCost.toFixed(2)}`}
        sell={`$${breakdown.machineSellCost.toFixed(2)}`}
        margin={`$${breakdown.machineMargin.toFixed(2)}`}
      />
      <BucketRow
        label={
          (breakdown.gasMarkupPercent ?? 0) > 0
            ? `Gas (${breakdown.gasMarkupPercent}% mkp)`
            : "Gas (pass-through)"
        }
        buy={`$${breakdown.gasBuyCost.toFixed(2)}`}
        sell={`$${breakdown.gasSellCost.toFixed(2)}`}
        margin={
          (breakdown.gasMarkupPercent ?? 0) > 0
            ? `$${(breakdown.gasMargin ?? 0).toFixed(2)}`
            : undefined
        }
      />
      <BucketRow
        label={`Consumables (${breakdown.consumablesMarkupPercent}% mkp)`}
        buy={`$${breakdown.consumablesBuyCost.toFixed(2)}`}
        sell={`$${breakdown.consumablesSellCost.toFixed(2)}`}
        margin={`$${breakdown.consumablesMargin.toFixed(2)}`}
      />
      {/* Phase 5H.3 — Production allowance + overhead (internal-only). Only renders when a tier matched. */}
      {breakdown.productionAllowanceTierKey && (
        <div className="border-t pt-1 mt-1 space-y-0.5" data-testid="production-allowance-block">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
            <span className="font-semibold">Production Allowance <span className="font-normal normal-case tracking-normal text-[9px] text-muted-foreground/80">— governed line recovery</span></span>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800" data-testid="allowance-tier-badge">
              Tier: {breakdown.productionAllowanceTierName}
            </Badge>
          </div>
          {/* Phase 5H.8 — main view shows clean commercial summary only.
              The detailed component formula ("X batch + Y per-sheet + …") has
              moved into the Production Allowance & Overhead card inside Show
              calculation details. Values, math, snapshot, and tier badge are
              unchanged — this is a display-only relocation. */}
          <div className="flex justify-between text-[10px] text-muted-foreground" data-testid="allowance-minutes-summary">
            <span>Allowance time</span>
            <span className="font-mono font-semibold">{breakdown.productionAllowanceMinutes.toFixed(0)} min</span>
          </div>
          <BucketRow
            label="Production allowance labour recovery"
            buy={`$${breakdown.productionAllowanceBuyCost.toFixed(2)}`}
            sell={`$${breakdown.productionAllowanceSellCost.toFixed(2)}`}
            margin={`$${(breakdown.productionAllowanceSellCost - breakdown.productionAllowanceBuyCost).toFixed(2)}`}
          />
          {breakdown.productionOverheadPercent > 0 && (
            <>
              <BucketRow
                label="Production overhead recovery"
                buy="$0.00"
                sell={`$${breakdown.productionOverheadAmount.toFixed(2)}`}
                margin={`$${breakdown.productionOverheadAmount.toFixed(2)}`}
              />
              <div className="text-[9px] text-muted-foreground/80 -mt-0.5 pl-1" data-testid="overhead-rate-subtext">
                {breakdown.productionOverheadPercent}% of governed base (see calculation details)
              </div>
            </>
          )}
          {breakdown.productionAllowanceReviewFlagged && (
            <div className="flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-2 py-1 mt-1" data-testid="allowance-review-flag">
              <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <span className="text-[10px] text-amber-800 dark:text-amber-200">Quantity exceeds tier review threshold — review allowance before sending.</span>
            </div>
          )}
        </div>
      )}

      {!breakdown.productionAllowanceTierKey && (
        <div className="border-t pt-1 mt-1 text-[10px] text-muted-foreground italic" data-testid="production-allowance-none">
          No production allowance tier matched for this qty / sheet count.
        </div>
      )}

      {/* Internal-only production recovery summary. Setup, handling, picking,
          sorting, QA, packing and production recovery are governed exclusively
          by Production Allowance tiers — loose per-line setup/handling is retired. */}
      <div className="border-t pt-1 mt-1 rounded-sm bg-purple-50/40 dark:bg-purple-950/20 px-2 py-1.5 space-y-0.5" data-testid="labour-recovery-summary">
        <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Total production recovery <span className="font-normal normal-case tracking-normal text-[9px] text-muted-foreground/80">(internal only)</span></span>
          <span
            className="inline-flex cursor-help flex-shrink-0"
            data-testid="info-labour-recovery"
            aria-label="How labour and production recovery is treated"
            title="Machine time is recovered separately through the machine sell rate. Production allowance recovers governed line handling, QA, packing, touch time, and production overhead. Manual child procedures are priced separately."
          >
            <Info className="h-3 w-3 text-muted-foreground/70" />
          </span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">Production allowance sell <span className="text-[9px]">(canonical)</span></span>
          <span className="font-mono" data-testid="recovery-allowance-sell">${breakdown.productionAllowanceSellCost.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[11px] font-semibold border-t border-purple-200/60 dark:border-purple-800/60 pt-1 mt-1">
          <span>Total production recovery</span>
          <span className="font-mono" data-testid="recovery-total-sell">
            ${breakdown.productionAllowanceSellCost.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Machine sell recovery <span className="text-[9px]">(separate bucket)</span></span>
          <span className="font-mono" data-testid="recovery-machine-sell">${breakdown.machineSellCost.toFixed(2)}</span>
        </div>
      </div>

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

      <div className="flex justify-between text-xs font-semibold border-t pt-1 mt-1" title="Unit Sell = Line Sell ÷ quantity">
        <span>Unit Sell <span className="text-[9px] font-normal text-muted-foreground">(line ÷ qty)</span></span>
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
            <div className="flex items-center justify-between mb-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Material</div>
              {breakdown.materialAllocationPolicy === "yield-based" && breakdown.yieldApplied ? (
                <span className="inline-flex items-center rounded bg-purple-100 dark:bg-purple-950/40 px-1.5 py-0.5 text-[9px] font-medium text-purple-700 dark:text-purple-300" data-testid="badge-material-allocation">Estimated yield-based (line setting)</span>
              ) : (
                <span className="inline-flex items-center rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[9px] font-medium text-slate-700 dark:text-slate-300" data-testid="badge-material-allocation">Whole sheet (legacy/current)</span>
              )}
            </div>
            <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Allocation mode</span><span className="font-mono" data-testid="detail-allocation-mode">{breakdown.materialAllocationPolicy === "yield-based" && breakdown.yieldApplied ? "Estimated yield-based" : "Whole sheet"}</span></div>
            {breakdown.sheetPricePerSheet ? (
              <div className="flex justify-between text-[10px]" title="Supplier buy price per sheet (ex-GST).">
                <span className="text-muted-foreground">Supplier sheet buy (ex-GST)</span>
                <span className="font-mono" data-testid="detail-sheet-price">${breakdown.sheetPricePerSheet.toFixed(2)}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Parts per sheet</span><span className="font-mono">{breakdown.partsPerSheet || "—"}</span></div>
            <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Qty</span><span className="font-mono" data-testid="detail-material-qty">{breakdown.quantity || "—"}</span></div>
            <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Material markup %</span><span className="font-mono">{breakdown.materialMarkupPercent}%</span></div>
            <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Sheet utilisation</span><span className="font-mono">{(breakdown.utilisationFactor * 100).toFixed(0)}%</span></div>

            {breakdown.materialAllocationPolicy === "yield-based" && breakdown.yieldApplied ? (
              <>
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Estimated sheet usage</span><span className="font-mono" data-testid="detail-yield-usage">{breakdown.estimatedSheetUsagePercent != null ? (breakdown.estimatedSheetUsagePercent * 100).toFixed(1) : "—"}%</span></div>
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Minimum sheet charge</span><span className="font-mono">{breakdown.yieldMinimumSheetChargePercent?.toFixed(1) ?? "—"}%</span></div>
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Recoverable remnant</span><span className="font-mono">{breakdown.recoverableRemnantPercent?.toFixed(1) ?? "—"}%</span></div>
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Non-recoverable remnant</span><span className="font-mono">{breakdown.nonRecoverableRemnantPercent?.toFixed(1) ?? "—"}%</span></div>
                <div className="flex justify-between text-[10px] font-medium"><span className="text-muted-foreground">Allocated sheet %</span><span className="font-mono" data-testid="detail-allocated-percent">{breakdown.allocatedSheetPercent?.toFixed(1) ?? "—"}%</span></div>
                <div className="flex justify-between text-[10px] font-medium"><span className="text-muted-foreground">Allocated material buy</span><span className="font-mono" data-testid="detail-allocated-buy">${(breakdown.allocatedMaterialBuy ?? breakdown.materialBuyCost).toFixed(2)}</span></div>
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Material sell</span><span className="font-mono" data-testid="detail-material-sell">${breakdown.materialSellCost.toFixed(2)}</span></div>
                <div className="text-[9px] text-muted-foreground italic leading-snug pt-0.5">
                  Estimated from rectangular blank size, not actual nest geometry.
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Estimated sheets</span><span className="font-mono">{breakdown.estimatedSheets || "—"}</span></div>
                <div className="flex justify-between text-[10px] font-medium"><span className="text-muted-foreground">Allocated sheet basis</span><span className="font-mono" data-testid="detail-allocated-percent">Whole sheet (100%)</span></div>
                <div className="flex justify-between text-[10px] font-medium"><span className="text-muted-foreground">Material buy</span><span className="font-mono" data-testid="detail-allocated-buy">${breakdown.materialBuyCost.toFixed(2)}</span></div>
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Material sell</span><span className="font-mono" data-testid="detail-material-sell">${breakdown.materialSellCost.toFixed(2)}</span></div>
                <div className="text-[9px] text-muted-foreground italic leading-snug pt-0.5">
                  Legacy/current full-sheet recovery — charges the full estimated sheet cost to this line.
                </div>
              </>
            )}
            {breakdown.yieldMultiSheetFallback && (
              <div className="text-[10px] text-amber-600 dark:text-amber-400 leading-snug" data-testid="detail-multi-sheet-fallback">
                Multi-sheet job: yield allocation preserved as whole-sheet (ambiguous without true nest).
              </div>
            )}
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

          {/* Phase 5H.8 — Production Allowance & Overhead detail card. Surfaces
              the per-component allowance breakdown that previously rendered as
              a single long line in the main panel. Values are read-only views
              of the existing breakdown object — no engine refactor. Per-sheet
              and per-part profile rates (e.g. 15 min/sheet, 10 s/part) are not
              exposed in the breakdown object today; they live on the active
              profile's productionAllowanceTiers and would require a breakdown-
              shape change to surface here, so we display the derived per-bucket
              totals only and note the source in the card footer. */}
          {breakdown.productionAllowanceTierKey && (
            <div className="rounded-md border bg-background/60 p-2 space-y-0.5" data-testid="detail-production-allowance-card">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Production Allowance &amp; Overhead</div>
              <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Selected tier</span><span className="font-mono" data-testid="detail-allowance-tier">{breakdown.productionAllowanceTierName}</span></div>
              <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Fixed batch</span><span className="font-mono" data-testid="detail-allowance-batch">{breakdown.productionAllowanceFixedBatchMinutes.toFixed(1)} min</span></div>
              <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Per sheet ({breakdown.estimatedSheets || 0} sheets)</span><span className="font-mono" data-testid="detail-allowance-per-sheet">{breakdown.productionAllowancePerSheetMinutes.toFixed(1)} min</span></div>
              <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Per-part touch time</span><span className="font-mono" data-testid="detail-allowance-per-part">{breakdown.productionAllowancePerPartMinutes.toFixed(1)} min</span></div>
              {breakdown.productionAllowancePerPartCapMinutes != null && breakdown.productionAllowancePerPartCapMinutes > 0 ? (
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Per-part cap applied</span><span className="font-mono" data-testid="detail-allowance-per-part-cap">{breakdown.productionAllowancePerPartCapMinutes.toFixed(0)} min</span></div>
              ) : (
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Per-part cap</span><span className="font-mono italic text-muted-foreground/80" data-testid="detail-allowance-per-part-cap-none">none applied</span></div>
              )}
              <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">QA / Packing</span><span className="font-mono" data-testid="detail-allowance-qa">{breakdown.productionAllowanceQaPackingMinutes.toFixed(1)} min</span></div>
              <div className="flex justify-between text-[10px] font-semibold border-t pt-0.5 mt-0.5"><span className="text-muted-foreground">Total allowance</span><span className="font-mono" data-testid="detail-allowance-total-min">{breakdown.productionAllowanceMinutes.toFixed(1)} min</span></div>
              <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Shop labour sell rate</span><span className="font-mono">${breakdown.shopRatePerHour.toFixed(0)} /hr</span></div>
              <div className="flex justify-between text-[10px] font-semibold"><span className="text-muted-foreground">Production allowance sell</span><span className="font-mono" data-testid="detail-allowance-sell">${breakdown.productionAllowanceSellCost.toFixed(2)}</span></div>
              {breakdown.productionOverheadPercent > 0 && (
                <>
                  <div className="flex justify-between text-[10px] border-t pt-0.5 mt-0.5"><span className="text-muted-foreground">Overhead base <span className="text-[9px] italic">(sell before allowance/overhead)</span></span><span className="font-mono" data-testid="detail-overhead-base">${breakdown.sellBeforeAllowanceAndOverhead.toFixed(2)}</span></div>
                  <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Overhead rate</span><span className="font-mono" data-testid="detail-overhead-rate">{breakdown.productionOverheadPercent}%</span></div>
                  <div className="flex justify-between text-[10px] font-semibold"><span className="text-muted-foreground">Overhead sell</span><span className="font-mono" data-testid="detail-overhead-sell">${breakdown.productionOverheadAmount.toFixed(2)}</span></div>
                </>
              )}
              <div className="text-[9px] text-muted-foreground italic leading-snug pt-0.5">
                Tier rates (per-sheet min, per-part sec, per-part cap, QA/packing min, overhead %) are governed by the active LL pricing profile's Production Allowance Tiers — see Settings → Divisions → LL → Pricing Model.
              </div>
            </div>
          )}

          <div className="text-[9px] text-muted-foreground italic leading-snug px-1">
            Sell = Buy × (1 + bucket markup). Gas passes through at cost. Machine sell uses governed sell rate; machine buy uses governed buy rate.
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// Phase 5E (Attached Manual Procedures) — Secondary Operations editor section
// rendered inside the Add/Edit Item dialog, just below Commercial Override.
// Each procedure prices INDEPENDENTLY of the laser engine and bypasses any
// commercial override applied to the parent. Quantity defaults to the parent
// item quantity when the procedure is added.
function SecondaryOperationsSection({
  formData,
  setFormData,
}: {
  formData: Omit<LaserQuoteItem, "id">;
  setFormData: React.Dispatch<React.SetStateAction<Omit<LaserQuoteItem, "id">>>;
}) {
  const procs = formData.attachedManualProcedures ?? [];
  const updateProc = (id: string, patch: Partial<AttachedManualProcedure>) => {
    setFormData(prev => ({
      ...prev,
      attachedManualProcedures: (prev.attachedManualProcedures ?? []).map(p =>
        p.id === id ? { ...p, ...patch } : p
      ),
    }));
  };
  const removeProc = (id: string) => {
    setFormData(prev => ({
      ...prev,
      attachedManualProcedures: (prev.attachedManualProcedures ?? []).filter(p => p.id !== id),
    }));
  };
  const addProc = () => {
    const newProc: AttachedManualProcedure = {
      id: crypto.randomUUID(),
      procedureType: "Folding",
      description: "",
      quantity: Math.max(1, formData.quantity || 1),
      unitCost: undefined,
      unitSell: undefined,
      targetMarginPercent: undefined,
      notes: "",
    };
    setFormData(prev => ({
      ...prev,
      attachedManualProcedures: [...(prev.attachedManualProcedures ?? []), newProc],
    }));
  };

  const totalSell = procs.reduce((s, p) => {
    const pricing = computeAttachedProcedureFinal(p, formData.quantity || 1);
    return s + pricing.lineSell;
  }, 0);

  return (
    <div
      className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50/30 dark:bg-amber-950/20 p-3 space-y-2"
      data-testid="section-secondary-operations"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-amber-700 dark:text-amber-400" />
          <span className="text-sm font-semibold">Secondary Operations</span>
          <Badge variant="outline" className="text-[10px]" data-testid="badge-secondary-operations-count">
            {procs.length} attached
          </Badge>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addProc}
          data-testid="button-add-attached-procedure"
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add procedure
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground leading-snug">
        Folding, deburring, tapping or other manual operations attached to this part.
        Priced manually (provisional) — independent of the laser pricing engine.
        Manual override on the laser line does not affect these.
      </p>

      {procs.length === 0 && (
        <div className="text-[11px] text-muted-foreground italic" data-testid="text-no-attached-procedures">
          No procedures attached. Click "Add procedure" to attach folding, deburring, tapping, or other manual operations.
        </div>
      )}

      {procs.map((p, idx) => {
        const pricing = computeAttachedProcedureFinal(p, formData.quantity || 1);
        return (
          <div
            key={p.id}
            className="rounded border border-amber-200 dark:border-amber-900 bg-background p-2 space-y-2"
            data-testid={`row-attached-procedure-edit-${idx}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]" data-testid={`badge-attached-procedure-type-${idx}`}>
                  {p.procedureType}
                </Badge>
                <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 dark:text-amber-400">
                  Manual / Provisional
                </Badge>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => removeProc(p.id)}
                data-testid={`button-remove-attached-procedure-${idx}`}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">Type</Label>
                <Select
                  value={p.procedureType}
                  onValueChange={(v) => updateProc(p.id, { procedureType: v as LLManualProcedureType })}
                >
                  <SelectTrigger className="h-8 text-xs" data-testid={`select-attached-procedure-type-${idx}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LL_MANUAL_PROCEDURE_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px]">Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  className="h-8 text-xs"
                  value={p.quantity}
                  onChange={(e) => updateProc(p.id, { quantity: parseInt(e.target.value) || 1 })}
                  data-testid={`input-attached-procedure-qty-${idx}`}
                />
              </div>
            </div>

            <div>
              <Label className="text-[10px]">Description (shown on quote)</Label>
              <Input
                className="h-8 text-xs"
                value={p.description ?? ""}
                onChange={(e) => updateProc(p.id, { description: e.target.value })}
                placeholder={`e.g. ${p.procedureType} — 4 bends per part`}
                data-testid={`input-attached-procedure-description-${idx}`}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-[10px]">Unit cost ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  className="h-8 text-xs"
                  value={p.unitCost ?? ""}
                  onChange={(e) => updateProc(p.id, { unitCost: e.target.value === "" ? undefined : parseFloat(e.target.value) })}
                  data-testid={`input-attached-procedure-unit-cost-${idx}`}
                />
              </div>
              <div>
                <Label className="text-[10px]">Unit sell ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  className="h-8 text-xs"
                  value={p.unitSell ?? ""}
                  onChange={(e) => updateProc(p.id, { unitSell: e.target.value === "" ? undefined : parseFloat(e.target.value) })}
                  data-testid={`input-attached-procedure-unit-sell-${idx}`}
                />
              </div>
              <div>
                <Label className="text-[10px]">Target margin (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min={0}
                  max={99.9}
                  className="h-8 text-xs"
                  value={p.targetMarginPercent ?? ""}
                  onChange={(e) => updateProc(p.id, { targetMarginPercent: e.target.value === "" ? undefined : parseFloat(e.target.value) })}
                  data-testid={`input-attached-procedure-target-margin-${idx}`}
                />
              </div>
            </div>

            <div>
              <Label className="text-[10px]">Notes (internal, optional)</Label>
              <Textarea
                rows={1}
                className="text-xs min-h-[32px]"
                value={p.notes ?? ""}
                onChange={(e) => updateProc(p.id, { notes: e.target.value })}
                data-testid={`input-attached-procedure-notes-${idx}`}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-amber-200 dark:border-amber-900">
              <span className="text-muted-foreground">
                Unit sell <span className="font-mono font-semibold" data-testid={`text-attached-procedure-unit-sell-preview-${idx}`}>${pricing.unitSell.toFixed(2)}</span>
                {" · "}
                Margin <span className="font-mono">{pricing.marginPercent.toFixed(1)}%</span>
              </span>
              <span className="font-semibold">
                Line: <span className="font-mono" data-testid={`text-attached-procedure-line-sell-${idx}`}>${pricing.lineSell.toFixed(2)}</span>
              </span>
            </div>

            {pricing.invalid && pricing.warning && (
              <div className="flex items-start gap-1.5 text-[10px] text-orange-700 dark:text-orange-400" data-testid={`warning-attached-procedure-${idx}`}>
                <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                <span>{pricing.warning}</span>
              </div>
            )}
          </div>
        );
      })}

      {procs.length > 0 && (
        <div className="flex items-center justify-between text-xs pt-1 border-t border-amber-300 dark:border-amber-800">
          <span className="font-semibold">Procedures subtotal</span>
          <span className="font-mono font-semibold" data-testid="text-attached-procedures-subtotal">
            ${totalSell.toFixed(2)}
          </span>
        </div>
      )}
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

  // Phase 5I — attached manual child procedure rollup for the live edit dialog,
  // consumed only by the internal Benchmark Calibration panel. No pricing impact.
  const dialogAttachedRollup = useMemo(() => {
    return rollupAttachedProcedures(formData);
  }, [formData]);

  const dialogReadiness = useMemo(() => {
    const materialId = selectedMaterialRow?.id || formData.llSheetMaterialId;
    return isItemQuoteReady(
      { ...formData, llSheetMaterialId: materialId || formData.llSheetMaterialId },
      sheetMaterials,
    );
  }, [formData, sheetMaterials, selectedMaterialRow]);

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
            // Phase 5E (Attached Manual Procedures): the snapshot may contain
            // flattened pseudo-rows (one per attached procedure right after
            // its parent) so the customer PDF/Preview can render procedures
            // inline. The parent already carries the authoritative
            // `attachedManualProcedures` array, so we skip pseudo-rows on
            // reload to avoid duplicating procedures back into items[].
            const reloaded = (snapshot.laserItems as LaserSnapshotItem[])
              .filter(si => !(si as any).attachedToParentRef)
              .map(si => snapshotItemToItem(si, llPricingSettings));
            setItems(reloaded);
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
    // Phase 5E (Attached Manual Procedures) — flatten parent + attached
    // procedures into a sequential laserItems list. The parent row is emitted
    // first with its laser-base finalSellPrice, then ONE pseudo-row per
    // attached procedure follows immediately. Item numbers are renumbered
    // sequentially across the flattened list. Subtotal stays correct because
    // each procedure's lineSell is on its own row and the parent's sellTotal
    // contains laser-base only — so summing flattened sellTotal == subtotal.
    const flattened: LaserSnapshotItem[] = [];
    let seq = 0;
    items.forEach((item, idx) => {
      const parent = itemToSnapshotItem(item, idx, sheetMaterials, llPricingSettings, governedInputs);
      seq += 1;
      parent.itemNumber = seq;
      flattened.push(parent);
      const procs = item.attachedManualProcedures ?? [];
      for (const proc of procs) {
        seq += 1;
        const child = attachedProcedureToSnapshotPseudoRow(item, proc, seq);
        flattened.push(child);
      }
    });
    const laserItems = flattened;
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

  // Phase 5F — LL Update Existing Quote (creates a NEW revision on the linked
  // quote, preserving full revision history). Mirrors the LJ exec-summary
  // pattern: POST /api/quotes mode=revision with sourceLaserEstimateId. The
  // server now looks up the existing quote by source_laser_estimate_id and
  // appends a new quote_revisions row. Old revisions remain immutable.
  const updateExistingQuoteMutation = useMutation({
    mutationFn: async () => {
      const snapshot = buildSnapshot();
      // Phase 5F (revision target determinism) — pass the explicit linked-quote
      // id so the server revises THIS quote, even if multiple quotes exist for
      // the same estimate (after a prior "Create New Quote"). Falls back to
      // sourceLaserEstimateId only if linkedQuote.id is missing for any reason.
      const linkedQuoteId = (estimateData as any)?.linkedQuote?.id as string | undefined;
      const res = await apiRequest("POST", "/api/quotes", {
        snapshot,
        sourceLaserEstimateId: estimateId,
        sourceQuoteId: linkedQuoteId,
        customer: customerName,
        divisionCode: "LL",
        mode: "revision",
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", data?.quote?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/laser-estimates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/laser-estimates", estimateId] });
      toast({
        title: "Quote updated",
        description: `${data.quote.number} — new revision v${data.revision?.versionNumber ?? "?"} created`,
      });
      navigate(`/quote/${data.quote.id}/preview`);
    },
    onError: (err: Error) => {
      toast({ title: "Error updating quote", description: err.message, variant: "destructive" });
    },
  });

  // Phase 5F — LL Create New Quote (separate quote record, new number,
  // preserves the existing linked quote untouched). Same payload as
  // generateQuoteFromEstimateMutation; both call mode=new_quote on the
  // server (which is idempotent for the laser_estimates.status=converted
  // update). Distinct mutation kept for clearer telemetry / button labelling.
  const createNewQuoteFromEstimateMutation = useMutation({
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
      toast({ title: "New quote created", description: `${data.quote.number} created from estimate (existing quote preserved)` });
      navigate(`/quote/${data.quote.id}/preview`);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Phase 5E (Attached Manual Procedures) — top-level validator that catches
  // pre-existing or imported items whose attached procedures have invalid
  // pricing (e.g. zero unit sell, bad target margin). Item-dialog save also
  // blocks invalid procedures, but this guards persistence at quote/estimate
  // save time so legacy data cannot slip through.
  const findItemsWithInvalidAttachedProcedures = (): { itemRef: string; warning: string }[] => {
    const offenders: { itemRef: string; warning: string }[] = [];
    for (const it of items) {
      if (it.isManualProcedure) continue;
      const rollup = rollupAttachedProcedures(it);
      if (rollup.anyInvalid) {
        const first = rollup.pricings.find(p => p.invalid);
        offenders.push({
          itemRef: it.itemRef || it.title || "(unnamed)",
          warning: first?.warning ?? "invalid procedure pricing",
        });
      }
    }
    return offenders;
  };

  const handleSave = () => {
    if (!customerName.trim()) {
      toast({ title: "Required", description: "Customer name is required", variant: "destructive" });
      return;
    }
    if (!estimateMode && items.length > 0) {
      const notReady = items
        .map(i => ({ item: i, r: isItemQuoteReady(i, sheetMaterials) }))
        .filter(x => !x.r.ready);
      if (notReady.length > 0) {
        toast({
          title: "Items not quote-ready",
          description: `${notReady.length} line(s) are missing required details (${notReady.map(x => x.item.itemRef || x.item.title || "(unnamed)").join(", ")}). Edit each item and complete the required fields before saving.`,
          variant: "destructive",
        });
        return;
      }
      const laserItems = items.filter(i => !i.isManualProcedure);
      const unmatchedItems = laserItems.filter(i => i.llSheetMaterialId && !sheetMaterials.find(m => m.id === i.llSheetMaterialId));
      if (unmatchedItems.length > 0) {
        toast({ title: "Stale Material", description: `${unmatchedItems.length} item(s) reference a material row that no longer exists (${unmatchedItems.map(i => i.itemRef || i.title).join(", ")}). Edit each item and reselect the material.`, variant: "destructive" });
        return;
      }
    }
    // Validate attached procedure pricing on every item (estimates included).
    const procOffenders = findItemsWithInvalidAttachedProcedures();
    if (procOffenders.length > 0) {
      toast({
        title: "Attached procedure pricing invalid",
        description: `${procOffenders.length} item(s) have invalid attached procedure pricing (${procOffenders.map(o => o.itemRef).join(", ")}). Edit each item and fix the procedure pricing before saving.`,
        variant: "destructive",
      });
      return;
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
    const notReady = items
      .map(i => ({ item: i, r: isItemQuoteReady(i, sheetMaterials) }))
      .filter(x => !x.r.ready);
    if (notReady.length > 0) {
      toast({
        title: "Items not quote-ready",
        description: `${notReady.length} line(s) are missing required details (${notReady.map(x => x.item.itemRef || x.item.title || "(unnamed)").join(", ")}). Edit each item and complete the required fields before generating a quote.`,
        variant: "destructive",
      });
      return;
    }
    const laserItems = items.filter(i => !i.isManualProcedure);
    const unmatchedItems = laserItems.filter(i => i.llSheetMaterialId && !sheetMaterials.find(m => m.id === i.llSheetMaterialId));
    if (unmatchedItems.length > 0) {
      toast({ title: "Stale Material", description: `${unmatchedItems.length} item(s) reference a material row that no longer exists (${unmatchedItems.map(i => i.itemRef || i.title).join(", ")}). Edit each item and reselect the material.`, variant: "destructive" });
      return;
    }
    // Phase 5E (Attached Manual Procedures) — guard generation against invalid procedures.
    const procOffenders = findItemsWithInvalidAttachedProcedures();
    if (procOffenders.length > 0) {
      toast({
        title: "Attached procedure pricing invalid",
        description: `${procOffenders.length} item(s) have invalid attached procedure pricing (${procOffenders.map(o => o.itemRef).join(", ")}). Edit each item and fix the procedure pricing before generating a quote.`,
        variant: "destructive",
      });
      return;
    }
    generateQuoteFromEstimateMutation.mutate();
  };

  // Phase 5F — Update existing linked quote (creates a new revision). Reuses
  // all the readiness / stale-material / attached-procedure validations that
  // gate Generate Quote, then dispatches mode=revision.
  const handleUpdateExistingQuote = () => {
    if (!customerName.trim()) {
      toast({ title: "Required", description: "Customer name is required", variant: "destructive" });
      return;
    }
    if (items.length === 0) {
      toast({ title: "Required", description: "Add at least one item before updating the quote", variant: "destructive" });
      return;
    }
    const notReady = items
      .map(i => ({ item: i, r: isItemQuoteReady(i, sheetMaterials) }))
      .filter(x => !x.r.ready);
    if (notReady.length > 0) {
      toast({
        title: "Items not quote-ready",
        description: `${notReady.length} line(s) are missing required details (${notReady.map(x => x.item.itemRef || x.item.title || "(unnamed)").join(", ")}). Edit each item and complete the required fields before updating the quote.`,
        variant: "destructive",
      });
      return;
    }
    const laserItems = items.filter(i => !i.isManualProcedure);
    const unmatchedItems = laserItems.filter(i => i.llSheetMaterialId && !sheetMaterials.find(m => m.id === i.llSheetMaterialId));
    if (unmatchedItems.length > 0) {
      toast({ title: "Stale Material", description: `${unmatchedItems.length} item(s) reference a material row that no longer exists (${unmatchedItems.map(i => i.itemRef || i.title).join(", ")}). Edit each item and reselect the material.`, variant: "destructive" });
      return;
    }
    const procOffenders = findItemsWithInvalidAttachedProcedures();
    if (procOffenders.length > 0) {
      toast({
        title: "Attached procedure pricing invalid",
        description: `${procOffenders.length} item(s) have invalid attached procedure pricing (${procOffenders.map(o => o.itemRef).join(", ")}). Edit each item and fix the procedure pricing before updating the quote.`,
        variant: "destructive",
      });
      return;
    }
    updateExistingQuoteMutation.mutate();
  };

  // Phase 5F — Create a brand-new quote from a converted LL estimate. Same
  // validations; uses mode=new_quote on the server (existing linked quote
  // remains untouched, a separate quote record/number is issued).
  const handleCreateNewQuoteFromEstimate = () => {
    if (!customerName.trim()) {
      toast({ title: "Required", description: "Customer name is required", variant: "destructive" });
      return;
    }
    if (items.length === 0) {
      toast({ title: "Required", description: "Add at least one item before creating a new quote", variant: "destructive" });
      return;
    }
    const notReady = items
      .map(i => ({ item: i, r: isItemQuoteReady(i, sheetMaterials) }))
      .filter(x => !x.r.ready);
    if (notReady.length > 0) {
      toast({
        title: "Items not quote-ready",
        description: `${notReady.length} line(s) are missing required details (${notReady.map(x => x.item.itemRef || x.item.title || "(unnamed)").join(", ")}). Edit each item and complete the required fields before creating a new quote.`,
        variant: "destructive",
      });
      return;
    }
    const laserItems = items.filter(i => !i.isManualProcedure);
    const unmatchedItems = laserItems.filter(i => i.llSheetMaterialId && !sheetMaterials.find(m => m.id === i.llSheetMaterialId));
    if (unmatchedItems.length > 0) {
      toast({ title: "Stale Material", description: `${unmatchedItems.length} item(s) reference a material row that no longer exists (${unmatchedItems.map(i => i.itemRef || i.title).join(", ")}). Edit each item and reselect the material.`, variant: "destructive" });
      return;
    }
    const procOffenders = findItemsWithInvalidAttachedProcedures();
    if (procOffenders.length > 0) {
      toast({
        title: "Attached procedure pricing invalid",
        description: `${procOffenders.length} item(s) have invalid attached procedure pricing (${procOffenders.map(o => o.itemRef).join(", ")}). Edit each item and fix the procedure pricing before creating a new quote.`,
        variant: "destructive",
      });
      return;
    }
    createNewQuoteFromEstimateMutation.mutate();
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
      // Phase 5H.9A — preserve the line's stored allocation policy as-is. Do NOT
      // substitute a profile default here: an existing line with no stored mode
      // stays undefined and the engine resolves it to "whole-sheets" (legacy).
      materialAllocationMode: item.materialAllocationMode,
      yieldMinimumSheetChargePercent: item.yieldMinimumSheetChargePercent,
      recoverableRemnantPercent: item.recoverableRemnantPercent,
      geometrySource: item.geometrySource ?? "manual",
      pricingOverrideEnabled: item.pricingOverrideEnabled ?? false,
      pricingOverrideMode: item.pricingOverrideMode ?? "none",
      manualSellPrice: item.manualSellPrice,
      targetMarginPercent: item.targetMarginPercent,
      markupOnCostPercent: item.markupOnCostPercent,
      overrideReason: item.overrideReason,
      isManualProcedure: false,
      // Phase 5E (Attached Manual Procedures) — preserve existing attached
      // procedures across edits. Cloned so dialog edits do not mutate live state.
      attachedManualProcedures: item.attachedManualProcedures
        ? item.attachedManualProcedures.map(p => ({ ...p }))
        : undefined,
    });
    setDialogOpen(true);
  };

  const handleDialogSave = () => {
    const materialId = selectedMaterialRow?.id || formData.llSheetMaterialId;
    const formForCheck = { ...formData, llSheetMaterialId: materialId || formData.llSheetMaterialId };
    const readiness = isItemQuoteReady(formForCheck, sheetMaterials);
    if (!readiness.ready) {
      toast({
        title: "Item not quote-ready",
        description: `Complete required details before saving: ${readiness.missing.join(", ")}.`,
        variant: "destructive",
      });
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
          toast({ title: "Override Invalid", description: "Target margin % must be between 0 and 100. Use 'Markup % on cost' for uplifts above 100%.", variant: "destructive" });
          return;
        }
      } else if (formData.pricingOverrideMode === "markup_on_cost") {
        // Phase 5F — markup_on_cost has no upper bound (e.g. 200% = 3x cost).
        // The true sell-margin is always < 100% (computed as output).
        const mk = formData.markupOnCostPercent;
        if (mk == null || !Number.isFinite(mk) || mk < 0) {
          toast({ title: "Override Invalid", description: "Markup % on cost must be a non-negative number.", variant: "destructive" });
          return;
        }
      }
    }
    // Phase 5E (Attached Manual Procedures) — block save if any attached
    // procedure has invalid pricing (zero unit sell, bad target margin, etc.).
    // Procedures are optional, so an empty list is fine.
    const attachedRollup = rollupAttachedProcedures(formData);
    if (attachedRollup.anyInvalid) {
      const firstBad = attachedRollup.pricings.find(p => p.invalid);
      toast({
        title: "Attached procedure pricing invalid",
        description: firstBad?.warning
          ?? "Each attached procedure needs a valid unit sell (or unit cost + target margin).",
        variant: "destructive",
      });
      return;
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
    || generateQuoteFromEstimateMutation.isPending
    || updateExistingQuoteMutation.isPending
    || createNewQuoteFromEstimateMutation.isPending;

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
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-4 py-3 bg-background" data-testid="laser-builder-header">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(backPath)}
            data-testid="button-back"
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate" data-testid="text-page-title">{pageTitle}</h1>
            <p className="text-xs text-muted-foreground truncate">{pageSubtitle}</p>
          </div>
          <TooltipProvider delayDuration={150}>
            {/* Phase 5J — responsive header badges. The label text collapses at
                narrower widths (full → "Pricing model"/"Source costs" →
                "Pricing"/"Costs") so the header never forces page-level
                horizontal scroll. The full text stays available via tooltip and
                the native title attribute. Pricing math/data unchanged. */}
            {activePricingProfile ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex max-w-full" tabIndex={0}>
                    <Badge
                      variant="outline"
                      className="text-xs bg-green-50 text-green-700 border-green-300 cursor-default max-w-full"
                      data-testid="badge-pricing-profile"
                      title={`${activePricingProfile.profileName} (${activePricingProfile.versionLabel})`}
                    >
                      <ShieldCheck className="h-3 w-3 mr-1 shrink-0" />
                      <span className="hidden sm:inline">Pricing model</span>
                      <span className="inline sm:hidden">Pricing</span>
                      <Info className="h-3 w-3 ml-1 shrink-0" />
                    </Badge>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs font-medium">{activePricingProfile.profileName} ({activePricingProfile.versionLabel})</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300" data-testid="badge-pricing-fallback" title="Fallback Pricing">
                <AlertTriangle className="h-3 w-3 mr-1 shrink-0" />
                <span className="hidden sm:inline">Fallback Pricing</span>
                <span className="inline sm:hidden">Fallback</span>
              </Badge>
            )}
            {activeGasInputs.length > 0 || activeConsumableInputs.length > 0 ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex max-w-full" tabIndex={0}>
                    <Badge
                      variant="outline"
                      className="text-xs bg-blue-50 text-blue-700 border-blue-300 cursor-default max-w-full"
                      data-testid="badge-source-costs-active"
                      title={`${activeGasInputs.length} gas sources, ${activeConsumableInputs.length} consumable sources active`}
                    >
                      <span className="hidden sm:inline">Source costs</span>
                      <span className="inline sm:hidden">Costs</span>
                      <Info className="h-3 w-3 ml-1 shrink-0" />
                    </Badge>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs font-medium">{activeGasInputs.length} gas sources, {activeConsumableInputs.length} consumable sources active</p>
                  <p className="text-[11px] text-muted-foreground">Active source costs are used by the LL pricing engine where applicable.</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Badge variant="outline" className="text-xs bg-gray-50 text-gray-500 border-gray-300" data-testid="badge-source-costs-none" title="Source Costs: fallback">
                <span className="hidden sm:inline">Source Costs: fallback</span>
                <span className="inline sm:hidden">Costs: fallback</span>
              </Badge>
            )}
          </TooltipProvider>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 min-w-0">
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
          {/* Phase 5F — Converted-LL-estimate action set: Open Quote, Update Existing
              Quote (creates a new revision on the linked quote, preserving history),
              and Create New Quote (separate quote record). Mirrors the LJ
              exec-summary pattern. Save is also re-enabled below so estimate edits
              can be persisted to the LL estimate before pushing to the quote. */}
          {isEstimateEdit && estimateData?.status === "converted" && estimateData?.linkedQuote && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/quote/${estimateData.linkedQuote.id}/preview`)}
              data-testid="button-open-linked-quote"
            >
              <Eye className="h-4 w-4 mr-1" />
              Open Quote {estimateData.linkedQuote.number}
            </Button>
          )}
          {isEstimateEdit && estimateData?.status === "converted" && estimateData?.linkedQuote && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleUpdateExistingQuote}
              disabled={isSaving || items.length === 0}
              data-testid="button-update-existing-quote"
            >
              {updateExistingQuoteMutation.isPending
                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                : <ArrowRightCircle className="h-4 w-4 mr-1" />}
              Update Existing Quote
            </Button>
          )}
          {isEstimateEdit && estimateData?.status === "converted" && estimateData?.linkedQuote && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateNewQuoteFromEstimate}
              disabled={isSaving || items.length === 0}
              data-testid="button-create-new-quote-from-estimate"
            >
              {createNewQuoteFromEstimateMutation.isPending
                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                : <ArrowRightCircle className="h-4 w-4 mr-1" />}
              Create New Quote
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
          {/* Phase 5F — re-enable Save on converted estimates so users can persist
              estimate edits before deciding to update existing quote or create new quote. */}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            data-testid="button-save"
          >
            {isSaving && !generateQuoteFromEstimateMutation.isPending
              && !updateExistingQuoteMutation.isPending
              && !createNewQuoteFromEstimateMutation.isPending
              ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              : <Save className="h-4 w-4 mr-1" />}
            {getSaveLabel()}
          </Button>
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
                          {/* Phase 5E (Attached Manual Procedures) — indented sub-rows under the parent. */}
                          {!isManual && (row?.attachedRollup.pricings.length ?? 0) > 0 && row?.attachedRollup.pricings.map((procPricing, procIdx) => (
                            <TableRow
                              key={`${item.id}-proc-${procPricing.procedureId}`}
                              data-testid={`row-attached-procedure-${idx}-${procIdx}`}
                              className="bg-amber-50/40 dark:bg-amber-950/20"
                            >
                              <TableCell></TableCell>
                              <TableCell className="font-mono text-xs pl-6">
                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="text-muted-foreground">↳ {item.itemRef}.{procIdx + 1}</span>
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] px-1 py-0 h-4 bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300"
                                    data-testid={`badge-attached-procedure-${idx}-${procIdx}`}
                                  >
                                    {procPricing.procedureType} (manual / provisional)
                                  </Badge>
                                  {procPricing.invalid && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-orange-50 text-orange-700 border-orange-300" data-testid={`badge-attached-procedure-invalid-${idx}-${procIdx}`}>Pricing Invalid</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell
                                className="text-xs text-muted-foreground"
                                data-testid={`text-attached-procedure-description-${idx}-${procIdx}`}
                              >
                                {procPricing.description?.trim()
                                  || `${procPricing.procedureType} attached to ${item.itemRef}`}
                              </TableCell>
                              <TableCell className="text-center text-xs" data-testid={`text-attached-procedure-quantity-${idx}-${procIdx}`}>
                                {procPricing.quantity}
                              </TableCell>
                              <TableCell colSpan={3} className="text-xs text-muted-foreground italic">—</TableCell>
                              <TableCell className="text-right font-mono text-xs" data-testid={`text-attached-procedure-unit-cost-${idx}-${procIdx}`}>
                                ${procPricing.unitCost.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs" data-testid={`text-attached-procedure-unit-sell-${idx}-${procIdx}`}>
                                ${procPricing.unitSell.toFixed(2)}
                                <span className="block text-[10px] text-muted-foreground">
                                  {procPricing.marginPercent.toFixed(0)}% margin
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-mono font-medium text-xs" data-testid={`text-attached-procedure-line-total-${idx}-${procIdx}`}>
                                ${procPricing.lineSell.toFixed(2)}
                              </TableCell>
                              <TableCell></TableCell>
                            </TableRow>
                          ))}
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
                  Commercial Settings
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border rounded-md p-3 space-y-3 bg-muted/20 mt-1">
                  <div className="rounded-sm border border-purple-200/70 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/20 px-2 py-1.5 text-[11px] text-muted-foreground leading-snug" data-testid="setup-handling-policy-note">
                    Production Allowance covers setup, handling, picking, sorting, QA, packing, and production recovery. These are not entered separately per line item. Manual procedures (folding, deburring, finishing, etc.) remain separate child items beneath the parent.
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

                  {/* Phase 5H.9A — Material Allocation (internal-only). Not shown
                      on customer Preview/PDF. Controls how the sheet buy cost is
                      apportioned to this line. */}
                  <div className="mt-3 rounded-md border border-border bg-muted/30 p-3 space-y-3" data-testid="section-material-allocation">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Material Allocation (internal)</Label>
                      <span className="text-[10px] text-muted-foreground italic">Not shown to customer</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 items-start">
                      <div>
                        <Label htmlFor="materialAllocationMode" className="text-[11px]">Allocation mode</Label>
                        <Select
                          value={formData.materialAllocationMode ?? "whole-sheets"}
                          onValueChange={(v) => setFormData(prev => ({
                            ...prev,
                            materialAllocationMode: v as "whole-sheets" | "yield-based",
                            // Seed yield params with safe defaults when first switching to yield.
                            yieldMinimumSheetChargePercent: v === "yield-based"
                              ? (prev.yieldMinimumSheetChargePercent ?? 25) : prev.yieldMinimumSheetChargePercent,
                            recoverableRemnantPercent: v === "yield-based"
                              ? (prev.recoverableRemnantPercent ?? 75) : prev.recoverableRemnantPercent,
                          }))}
                        >
                          <SelectTrigger id="materialAllocationMode" className="h-8 text-xs" data-testid="select-material-allocation-mode">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="whole-sheets">Whole sheet</SelectItem>
                            <SelectItem value="yield-based">Estimated yield-based</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end h-full">
                        {(formData.materialAllocationMode ?? "whole-sheets") === "whole-sheets" ? (
                          <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:text-slate-300" data-testid="badge-allocation-mode">
                            Material allocation: Whole sheet (legacy/current)
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-purple-100 dark:bg-purple-950/40 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:text-purple-300" data-testid="badge-allocation-mode">
                            Material allocation: Estimated yield-based (line setting)
                          </span>
                        )}
                      </div>
                    </div>

                    {(formData.materialAllocationMode ?? "whole-sheets") === "whole-sheets" ? (
                      <p className="text-[10px] text-muted-foreground leading-snug" data-testid="help-whole-sheet">
                        Charges the full estimated sheet cost to this line. Use for special-order material, dedicated stock, poor remnant, traceability, uncommon material, or where the job should carry the full sheet.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-[10px] text-muted-foreground leading-snug" data-testid="help-yield-based">
                          Uses rectangular blank size and estimated sheet yield. This is not a true nest. Use for common stocked material where the remaining sheet/remnant is commercially reusable.
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label htmlFor="yieldMinimumSheetChargePercent" className="text-[11px]">Minimum sheet charge %</Label>
                            <Input
                              id="yieldMinimumSheetChargePercent"
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              className="h-8 text-xs"
                              value={formData.yieldMinimumSheetChargePercent ?? 25}
                              onChange={(e) => setFormData(prev => ({ ...prev, yieldMinimumSheetChargePercent: e.target.value === "" ? undefined : Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) }))}
                              data-testid="input-yield-min-sheet-charge"
                            />
                            <p className="text-[9px] text-muted-foreground mt-0.5 leading-snug">Minimum portion of a sheet charged to the job even when estimated usage is lower. Covers handling, stock risk, and remnant management.</p>
                          </div>
                          <div>
                            <Label htmlFor="recoverableRemnantPercent" className="text-[11px]">Recoverable remnant %</Label>
                            <Input
                              id="recoverableRemnantPercent"
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              className="h-8 text-xs"
                              value={formData.recoverableRemnantPercent ?? 75}
                              onChange={(e) => setFormData(prev => ({ ...prev, recoverableRemnantPercent: e.target.value === "" ? undefined : Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) }))}
                              data-testid="input-recoverable-remnant"
                            />
                            <p className="text-[9px] text-muted-foreground mt-0.5 leading-snug">Estimated percentage of the unused sheet/remnant that is commercially reusable. Lower recoverability increases the material portion charged to this job.</p>
                          </div>
                          <div>
                            <Label className="text-[11px]">Calculated allocated sheet %</Label>
                            <div className="h-8 flex items-center font-mono text-xs" data-testid="text-allocated-sheet-percent">
                              {dialogPricing.yieldApplied && dialogPricing.allocatedSheetPercent != null
                                ? `${dialogPricing.allocatedSheetPercent.toFixed(1)}%`
                                : dialogPricing.yieldMultiSheetFallback
                                  ? "Whole sheet (multi-sheet)"
                                  : "—"}
                            </div>
                            {dialogPricing.yieldApplied && dialogPricing.estimatedSheetUsagePercent != null && (
                              <p className="text-[9px] text-muted-foreground mt-0.5">Est. usage {(dialogPricing.estimatedSheetUsagePercent * 100).toFixed(1)}% · non-recoverable {dialogPricing.nonRecoverableRemnantPercent?.toFixed(1)}%</p>
                            )}
                          </div>
                        </div>
                        {dialogPricing.yieldMultiSheetFallback && (
                          <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2 py-1.5" data-testid="notice-multi-sheet-fallback">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <span className="text-[10px] text-amber-800 dark:text-amber-300 leading-snug">Multi-sheet job: estimated yield allocation is ambiguous without true nest geometry. Whole-sheet recovery has been preserved for safety. Use manual judgement where remnant recovery is uncertain.</span>
                          </div>
                        )}
                        <p className="text-[9px] text-muted-foreground italic leading-snug" data-testid="note-yield-estimate">
                          Estimated from rectangular blank size, not actual nest geometry. Adjust recoverable remnant % where remnant recovery is uncertain.
                        </p>
                      </div>
                    )}
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

            {!dialogReadiness.ready && !formData.isManualProcedure && (
              <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-md px-3 py-2" data-testid="banner-not-quote-ready">
                <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <p className="font-semibold">Pricing pending — complete required item details</p>
                  <p>Missing: {dialogReadiness.missing.join(", ")}.</p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">Any preliminary numbers below are diagnostic only and are not a quoteable price.</p>
                </div>
              </div>
            )}

            <div className={!dialogReadiness.ready ? "opacity-60" : ""} data-testid="pricing-breakdown-wrapper">
              <PricingBreakdownPanel
                breakdown={dialogPricing}
                supplierName={selectedMaterialRow?.supplierName || ""}
              />
              {!dialogReadiness.ready && (
                <p className="text-[11px] text-muted-foreground italic mt-1" data-testid="text-non-quoteable-label">
                  Diagnostic only — not a quoteable price until required fields are complete.
                </p>
              )}
            </div>

            {/* Phase 5I — internal-only Benchmark Calibration panel. Lives in the
                LL builder edit dialog beside the live pricing breakdown so the
                comparison updates as allocation mode / inputs change. Never on
                customer Preview/PDF; no pricing/snapshot impact. */}
            {!formData.isManualProcedure && (
              <BenchmarkCalibrationPanel
                quantity={formData.quantity}
                breakdown={dialogPricing}
                attachedTotalSell={dialogAttachedRollup.totalSell}
                attachedCount={dialogAttachedRollup.count}
              />
            )}

            {/* Phase 5E — Commercial Override Layer */}
            <Collapsible open={!!formData.pricingOverrideEnabled || (formData.pricingOverrideMode != null && formData.pricingOverrideMode !== "none")}>
              <div className="border rounded-md p-3 space-y-3 bg-purple-50/30 dark:bg-purple-950/10 border-purple-200 dark:border-purple-900" data-testid="section-commercial-override">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-purple-700 dark:text-purple-300" />
                    <span className="text-sm font-semibold" data-testid="text-commercial-section-title">
                      {formData.pricingOverrideEnabled ? "Commercial Override Active" : "Commercial Pricing Preview"}
                    </span>
                    <span className="text-[11px] text-muted-foreground" data-testid="text-commercial-section-subtitle">
                      {formData.pricingOverrideEnabled
                        ? "(override ON — manual values applied)"
                        : "(override OFF — engine-calculated values shown below)"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="override-toggle" className={`text-xs select-none ${dialogReadiness.ready ? "cursor-pointer" : "cursor-not-allowed text-muted-foreground"}`}>
                      Use manual pricing override
                    </Label>
                    <Switch
                      id="override-toggle"
                      checked={!!formData.pricingOverrideEnabled && dialogReadiness.ready}
                      disabled={!dialogReadiness.ready}
                      onCheckedChange={(v) => {
                        if (!dialogReadiness.ready) return;
                        setFormData(prev => ({
                          ...prev,
                          pricingOverrideEnabled: v,
                          pricingOverrideMode: v ? (prev.pricingOverrideMode && prev.pricingOverrideMode !== "none" ? prev.pricingOverrideMode : "manual_sell") : "none",
                        }));
                      }}
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
                            <SelectItem value="target_margin" data-testid="select-mode-target-margin">Target margin % (sell-margin, &lt; 100)</SelectItem>
                            <SelectItem value="markup_on_cost" data-testid="select-mode-markup-on-cost">Markup % on cost (uplift, no cap)</SelectItem>
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
                          <Label htmlFor="target-margin-input" className="text-xs">Target margin % (0–99.99, sell-margin)</Label>
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
                          <p className="text-[10px] text-muted-foreground mt-1">
                            For uplifts &gt; 100% on cost, use <span className="font-semibold">Markup % on cost</span>.
                          </p>
                        </div>
                      )}

                      {/* Phase 5F — Markup % on cost. Uplift relative to calculated unit
                          cost; no upper cap. The true sell-margin is computed and shown
                          as output below (always &lt; 100% by construction). */}
                      {formData.pricingOverrideMode === "markup_on_cost" && (
                        <div>
                          <Label htmlFor="markup-on-cost-input" className="text-xs">Markup % on cost (uplift, e.g. 200 = cost &times; 3)</Label>
                          <Input
                            id="markup-on-cost-input"
                            type="number"
                            step="0.1"
                            min={0}
                            value={formData.markupOnCostPercent ?? ""}
                            onChange={(e) => setFormData(prev => ({ ...prev, markupOnCostPercent: e.target.value === "" ? undefined : parseFloat(e.target.value) }))}
                            placeholder="100"
                            data-testid="input-markup-on-cost-percent"
                          />
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Final unit sell = calculated unit cost &times; (1 + markup&nbsp;/&nbsp;100). True sell-margin is shown below.
                          </p>
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

            {/* Phase 5E — Attached Manual Procedures (Secondary Operations) */}
            <SecondaryOperationsSection
              formData={formData}
              setFormData={setFormData}
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
            <Button
              onClick={handleDialogSave}
              disabled={!dialogReadiness.ready}
              title={dialogReadiness.ready ? undefined : `Complete required fields: ${dialogReadiness.missing.join(", ")}`}
              data-testid="button-save-item"
            >
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
