// Phase 5H.9E — LL Pricing Helper Decoupling.
// Neutral LL-only library module that owns the reusable row-pricing helper
// (computeRowPricing) and the pure helper/type closure it depends on. Both the
// LL Quote Builder page and the LL Estimates List page import from here, so the
// list no longer imports pricing helpers from the builder page.
//
// This is a code-ownership move ONLY: every function below is the exact same
// logic that previously lived in client/src/pages/laser-quote-builder.tsx. No
// pricing math, field names, or runtime branches were changed.
import type {
  LaserQuoteItem,
  LLPricingSettings,
  LLPricingOverrideMode,
  LLManualProcedureType,
  AttachedManualProcedure,
} from "@shared/schema";
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

export interface SheetMaterialRef {
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

// Phase 5E hardening — gate that decides whether a regular LL laser item is
// commercially quote-ready. Until ready:
//   * final calculated/override sell must NOT be presented as a quoteable value
//   * minimum-line-charge / setup-handling labour must NOT be billed as final
//   * commercial override must NOT be enabled
//   * Save/Add must be blocked
// Manual procedure rows are exempt (they bypass material/process pricing).
export interface LLItemReadiness {
  ready: boolean;
  isManualProcedure: boolean;
  missing: string[];
}

export function isItemQuoteReady(
  item: Pick<LaserQuoteItem, "itemRef" | "title" | "quantity" | "materialType" | "materialGrade" | "finish" | "thickness" | "length" | "width" | "cutLengthMm" | "llSheetMaterialId" | "coilLengthMm" | "isManualProcedure" | "procedureType" | "manualUnitCost" | "manualUnitSell" | "manualTargetMarginPercent">,
  materials: SheetMaterialRef[],
): LLItemReadiness {
  if (item.isManualProcedure) {
    const missing: string[] = [];
    if (!item.itemRef?.trim()) missing.push("Item reference");
    if (!item.title?.trim()) missing.push("Title");
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) missing.push("Quantity > 0");
    if (!item.procedureType) missing.push("Procedure type");
    const proc = computeManualProcedureFinal(item);
    if (proc.invalid) missing.push("Valid unit sell or target margin");
    return { ready: missing.length === 0, isManualProcedure: true, missing };
  }
  const missing: string[] = [];
  if (!item.itemRef?.trim()) missing.push("Item reference");
  if (!item.title?.trim()) missing.push("Title");
  if (!Number.isFinite(item.quantity) || item.quantity <= 0) missing.push("Quantity > 0");
  const matched = findMatchingMaterial(materials, item);
  if (!matched) {
    missing.push("Material selection (family / grade / finish / thickness / sheet)");
  } else {
    const isCoil = (matched.stockBehaviour || "sheet") === "coil";
    if (isCoil) {
      if (!Number.isFinite(item.coilLengthMm) || (item.coilLengthMm ?? 0) <= 0) {
        missing.push("Coil cut length (mm)");
      }
    } else {
      if (!Number.isFinite(item.length) || item.length <= 0) missing.push("Part length (mm)");
      if (!Number.isFinite(item.width) || item.width <= 0) missing.push("Part width (mm)");
    }
    if (!Number.isFinite(item.cutLengthMm) || item.cutLengthMm <= 0) {
      missing.push("Cut length (mm)");
    }
  }
  return { ready: missing.length === 0, isManualProcedure: false, missing };
}

export function buildOverrideInputs(item: Pick<LaserQuoteItem, "pricingOverrideEnabled" | "pricingOverrideMode" | "manualSellPrice" | "targetMarginPercent" | "markupOnCostPercent">): LLOverrideInputs {
  return {
    enabled: !!item.pricingOverrideEnabled,
    mode: (item.pricingOverrideMode ?? "none") as LLPricingOverrideMode,
    manualSellPrice: item.manualSellPrice,
    targetMarginPercent: item.targetMarginPercent,
    markupOnCostPercent: item.markupOnCostPercent,
  };
}

export function computeManualProcedureFinal(item: Pick<LaserQuoteItem, "manualUnitCost" | "manualUnitSell" | "manualTargetMarginPercent" | "quantity">): {
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

// Phase 5E (Attached Manual Procedures) — price a single attached procedure.
// Identical math to standalone manual procedure pricing. The procedure carries
// its own quantity (defaults to parent quantity at creation time).
export interface AttachedProcedurePricing {
  procedureId: string;
  procedureType: LLManualProcedureType;
  description: string;
  quantity: number;
  unitCost: number;
  unitSell: number;
  lineSell: number;
  lineCost: number;
  lineMargin: number;
  marginPercent: number;
  invalid: boolean;
  warning?: string;
}

export function computeAttachedProcedureFinal(
  proc: AttachedManualProcedure,
  parentQuantity: number,
): AttachedProcedurePricing {
  const qtyRaw = Number(proc.quantity ?? parentQuantity ?? 0);
  const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? Math.max(1, Math.floor(qtyRaw)) : 1;
  const unitCostRaw = Number(proc.unitCost ?? 0);
  const unitCost = Number.isFinite(unitCostRaw) && unitCostRaw > 0 ? unitCostRaw : 0;
  let unitSell = Number(proc.unitSell ?? 0);
  if (!Number.isFinite(unitSell) || unitSell < 0) unitSell = 0;
  let warning: string | undefined;
  let invalid = false;
  const tmRaw = proc.targetMarginPercent;
  if (tmRaw != null) {
    const tm = Number(tmRaw);
    if (!Number.isFinite(tm) || tm < 0 || tm >= 100) {
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
    warning = warning ?? "Unit sell must be greater than zero.";
    unitSell = 0;
  }
  const lineSell = unitSell * qty;
  const lineCost = unitCost * qty;
  const lineMargin = lineSell - lineCost;
  const marginPercent = lineSell > 0 ? (lineMargin / lineSell) * 100 : 0;
  return {
    procedureId: proc.id,
    procedureType: proc.procedureType,
    description: proc.description ?? "",
    quantity: qty,
    unitCost,
    unitSell,
    lineSell,
    lineCost,
    lineMargin,
    marginPercent,
    invalid,
    warning,
  };
}

export interface AttachedProceduresRollup {
  pricings: AttachedProcedurePricing[];
  totalSell: number;
  totalCost: number;
  totalMargin: number;
  anyInvalid: boolean;
  count: number;
}

export function rollupAttachedProcedures(
  item: Pick<LaserQuoteItem, "attachedManualProcedures" | "quantity">,
): AttachedProceduresRollup {
  const list = item.attachedManualProcedures ?? [];
  const pricings = list.map(p => computeAttachedProcedureFinal(p, item.quantity || 1));
  const totalSell = pricings.reduce((s, p) => s + p.lineSell, 0);
  const totalCost = pricings.reduce((s, p) => s + p.lineCost, 0);
  const totalMargin = totalSell - totalCost;
  const anyInvalid = pricings.some(p => p.invalid);
  return { pricings, totalSell, totalCost, totalMargin, anyInvalid, count: pricings.length };
}

export function findMatchingMaterial(
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

export function materialToTruth(m: SheetMaterialRef): LLMaterialTruth {
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

export function computeItemPricing(
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
    // Phase 5H.9A — LEGACY-SAFE: pass the line's stored mode straight through.
    // Undefined stays undefined so the engine resolves it to "whole-sheets".
    // The profile default is NEVER substituted here — it only seeds new lines.
    materialAllocationMode: item.materialAllocationMode,
    yieldMinimumSheetChargePercent: item.yieldMinimumSheetChargePercent,
    recoverableRemnantPercent: item.recoverableRemnantPercent,
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
  // Laser-base final values (after commercial override). Excludes attached procedures.
  laserFinalLineSell: number;
  laserFinalLineCost: number;
  // Attached manual procedures rollup (Phase 5E). Empty for manual-procedure rows.
  attachedRollup: AttachedProceduresRollup;
  // Combined values: laser-base + attached procedures. These are what feeds
  // the parent line total in the items table and the estimate subtotal.
  finalUnitSell: number;
  finalLineSell: number;
  finalLineCost: number;
  finalMarginAmount: number;
  finalMarginPercent: number;
}

export function computeRowPricing(
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
      laserFinalLineSell: m.lineSell,
      laserFinalLineCost: m.unitCost * qty,
      attachedRollup: { pricings: [], totalSell: 0, totalCost: 0, totalMargin: 0, anyInvalid: false, count: 0 },
      finalUnitSell: m.unitSell,
      finalLineSell: m.lineSell,
      finalLineCost: m.unitCost * qty,
      finalMarginAmount: m.lineMargin,
      finalMarginPercent: m.marginPercent,
    };
  }
  const breakdown = computeItemPricing(item, materials, settings, governed);
  const commercial = applyCommercialOverride(breakdown, item.quantity, buildOverrideInputs(item));
  const readiness = isItemQuoteReady(item, materials);
  // Attached procedures: priced INDEPENDENTLY of the laser bucketed engine.
  // Commercial override applies only to the laser base, not to procedures.
  const attachedRollup = rollupAttachedProcedures(item);
  // Defensive: if a regular laser item is not quote-ready (legacy data, etc.),
  // do NOT report a final commercial sell. Final values are zero so subtotal
  // and quote totals never absorb non-quoteable diagnostic numbers. Attached
  // procedures are still reported so the operator sees their value separately.
  if (!readiness.ready) {
    const qty = Math.max(item.quantity || 0, 1);
    return {
      isManualProcedure: false,
      breakdown,
      commercial,
      manual: null,
      laserFinalLineSell: 0,
      laserFinalLineCost: 0,
      attachedRollup,
      finalUnitSell: attachedRollup.totalSell / qty,
      finalLineSell: attachedRollup.totalSell,
      finalLineCost: attachedRollup.totalCost,
      finalMarginAmount: attachedRollup.totalMargin,
      finalMarginPercent: attachedRollup.totalSell > 0 ? (attachedRollup.totalMargin / attachedRollup.totalSell) * 100 : 0,
    };
  }
  const laserFinalLineSell = commercial.finalSellPrice;
  const laserFinalLineCost = commercial.calculatedBuyCost;
  const combinedLineSell = laserFinalLineSell + attachedRollup.totalSell;
  const combinedLineCost = laserFinalLineCost + attachedRollup.totalCost;
  const combinedMargin = combinedLineSell - combinedLineCost;
  const combinedMarginPercent = combinedLineSell > 0 ? (combinedMargin / combinedLineSell) * 100 : 0;
  const qty = Math.max(item.quantity || 0, 1);
  return {
    isManualProcedure: false,
    breakdown,
    commercial,
    manual: null,
    laserFinalLineSell,
    laserFinalLineCost,
    attachedRollup,
    finalUnitSell: combinedLineSell / qty,
    finalLineSell: combinedLineSell,
    finalLineCost: combinedLineCost,
    finalMarginAmount: combinedMargin,
    finalMarginPercent: combinedMarginPercent,
  };
}
