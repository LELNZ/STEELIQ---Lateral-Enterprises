/**
 * LL (Laser) Pricing Engine — Phase 4A Time-Based Process Costing
 *
 * Bounded manual-entry pricing model for Lateral Laser division.
 * This is NOT DXF automation, nesting optimisation, or machine integration.
 *
 * THREE-LAYER SEPARATION:
 *   A. Procurement Truth — supplier-linked sheet material row
 *   B. Pricing Engine Truth — derived costs, commercial rule, sell result
 *   C. Customer Output Truth — sell totals only, no internal cost leakage
 *
 * MATERIAL COST — YIELD-BASED ALLOCATION (Phase 4A → corrected Phase 5):
 *   Uses rectangular packing to determine parts-per-sheet, then allocates
 *   material cost per unit based on yield:
 *     1. Effective part size = (partLength + kerfWidth) × (partWidth + kerfWidth)
 *     2. Parts per sheet = best of two orientations on usable sheet area
 *     3. Material cost per unit = sheetPrice / partsPerSheet
 *     4. Material cost total = materialCostPerUnit × quantity
 *   Sheets required (ceil) is retained as an informational procurement field.
 *   Falls back to area-based model when part dimensions are not set.
 *   Minimum material charge ($25) is applied per line item, not per unit.
 *
 * PROCESS COST — TIME-BASED MODEL (Phase 4A):
 *   Uses processRateTables (material+thickness → cutSpeed, pierceTime) and
 *   machine hourly rate to compute actual machine time cost:
 *     1. Cutting time = (cutLengthPerUnit × qty) / cutSpeedMmPerMin
 *     2. Pierce time = (piercesPerUnit × qty × pierceTimeSec) / 60
 *     3. Machine cost = totalTimeHours × machineHourlyRate
 *     4. Gas cost = totalTimeMinutes × gasConsumptionLPerMin × gasPricePerL
 *     5. Consumables = totalTimeHours × consumableCostPerHour
 *   Falls back to flat $/mm rate if no matching process table entry.
 *
 * COMMERCIAL RULE:
 *   Explicit percentage markup on internal cost subtotal.
 *
 * SETTINGS-DRIVEN:
 *   All rates read from LLPricingSettings passed as parameter.
 *   LL_PRICING_DEFAULTS retained as fallback for safety only.
 */

import type { LLPricingSettings, LLGasCostInput, LLConsumablesCostInput } from "@shared/schema";

export interface LLMaterialTruth {
  id: string;
  supplierName: string;
  materialFamily: string;
  grade: string;
  finish: string;
  thickness: number;
  sheetLength: number;
  sheetWidth: number;
  pricePerSheetExGst: number;
  stockBehaviour: string;
  pricePerKg: number;
  densityKgM3: number;
}

export interface LLPricingInputs {
  material: LLMaterialTruth | null;
  partLengthMm: number;
  partWidthMm: number;
  quantity: number;
  cutLengthMm: number;
  pierceCount: number;
  setupMinutes: number;
  handlingMinutes: number;
  markupPercent: number;
  utilisationFactor: number;
  coilLengthMm?: number;
}

export interface LLGovernedInputs {
  gasInputs?: LLGasCostInput[];
  consumableInputs?: LLConsumablesCostInput[];
}

export interface LLPricingBreakdown {
  sheetAreaMm2: number;
  partAreaMm2: number;
  totalNetPartArea: number;
  usableSheetArea: number;
  estimatedSheets: number;
  partsPerSheet: number;
  materialCostPerUnit: number;
  materialCostTotal: number;

  cutCost: number;
  pierceCost: number;
  gasCost: number;
  consumablesCost: number;
  machineTimeCost: number;
  machineTimeMinutes: number;
  processCostPerUnit: number;
  processCostTotal: number;
  processMode: "time-based" | "flat-rate";

  setupHandlingCost: number;

  internalCostSubtotal: number;
  minimumLineChargeApplied: boolean;

  markupPercent: number;
  markupAmount: number;
  sellTotal: number;
  unitCost: number;
  unitSell: number;

  utilisationFactor: number;
  ratePerMmCut: number;
  ratePerPierce: number;
  shopRatePerHour: number;

  gasSource?: string;
  gasCostPerLitre?: number;
  consumablesSource?: string;
  consumablesCostPerHourRate?: number;

  stockBehaviour?: string;
  coilLengthMm?: number;
  coilWidthMm?: number;
  coilWeightKg?: number;
  coilPricePerKg?: number;
}

export const LL_PRICING_DEFAULTS = {
  RATE_PER_MM_CUT: 0.012,
  RATE_PER_PIERCE: 0.50,
  SHOP_RATE_PER_HOUR: 95.00,
  DEFAULT_UTILISATION_FACTOR: 0.75,
  DEFAULT_MARKUP_PERCENT: 35,
  DEFAULT_SETUP_MINUTES: 10,
  DEFAULT_HANDLING_MINUTES: 5,
  MINIMUM_MATERIAL_CHARGE: 25.00,
  MINIMUM_LINE_CHARGE: 50.00,
} as const;

export interface LLResolvedRates {
  ratePerMmCut: number;
  ratePerPierce: number;
  shopRatePerHour: number;
  minimumMaterialCharge: number;
  minimumLineCharge: number;
  defaultSetupMinutes: number;
  defaultHandlingMinutes: number;
  defaultMarkupPercent: number;
  defaultUtilisationFactor: number;
}

export function resolveRatesFromSettings(settings: LLPricingSettings | null | undefined): LLResolvedRates {
  if (!settings) {
    return {
      ratePerMmCut: LL_PRICING_DEFAULTS.RATE_PER_MM_CUT,
      ratePerPierce: LL_PRICING_DEFAULTS.RATE_PER_PIERCE,
      shopRatePerHour: LL_PRICING_DEFAULTS.SHOP_RATE_PER_HOUR,
      minimumMaterialCharge: LL_PRICING_DEFAULTS.MINIMUM_MATERIAL_CHARGE,
      minimumLineCharge: LL_PRICING_DEFAULTS.MINIMUM_LINE_CHARGE,
      defaultSetupMinutes: LL_PRICING_DEFAULTS.DEFAULT_SETUP_MINUTES,
      defaultHandlingMinutes: LL_PRICING_DEFAULTS.DEFAULT_HANDLING_MINUTES,
      defaultMarkupPercent: LL_PRICING_DEFAULTS.DEFAULT_MARKUP_PERCENT,
      defaultUtilisationFactor: LL_PRICING_DEFAULTS.DEFAULT_UTILISATION_FACTOR,
    };
  }

  return {
    ratePerMmCut: settings.commercialPolicy.defaultRatePerMmCut ?? LL_PRICING_DEFAULTS.RATE_PER_MM_CUT,
    ratePerPierce: settings.commercialPolicy.defaultRatePerPierce ?? LL_PRICING_DEFAULTS.RATE_PER_PIERCE,
    shopRatePerHour: settings.labourRates.shopRatePerHour,
    minimumMaterialCharge: settings.commercialPolicy.minimumMaterialCharge,
    minimumLineCharge: settings.commercialPolicy.minimumLineCharge ?? LL_PRICING_DEFAULTS.MINIMUM_LINE_CHARGE,
    defaultSetupMinutes: settings.setupHandlingDefaults.defaultSetupMinutes,
    defaultHandlingMinutes: settings.setupHandlingDefaults.defaultHandlingMinutes,
    defaultMarkupPercent: settings.commercialPolicy.defaultMarkupPercent,
    defaultUtilisationFactor: settings.nestingDefaults.defaultUtilisationFactor,
  };
}

interface ProcessRateEntry {
  materialFamily: string;
  thickness: number;
  cutSpeedMmPerMin: number;
  pierceTimeSec: number;
  assistGasType: string;
  gasConsumptionLPerMin: number;
}

const FAMILY_ALIASES: Record<string, string> = {
  "galvanised steel": "galvanised",
  "galvanized steel": "galvanised",
  "galvanized": "galvanised",
  "aluminum": "aluminium",
  "al": "aluminium",
  "ms": "mild steel",
  "ss": "stainless steel",
};

function normaliseFamilyName(family: string): string {
  const lower = family.toLowerCase().trim();
  return FAMILY_ALIASES[lower] ?? lower;
}

function findProcessRate(
  settings: LLPricingSettings | null | undefined,
  materialFamily: string,
  thickness: number,
): ProcessRateEntry | null {
  if (!settings?.processRateTables) return null;
  const table = settings.processRateTables as ProcessRateEntry[];
  const normInput = normaliseFamilyName(materialFamily);
  let bestMatch: ProcessRateEntry | null = null;
  let bestDist = Infinity;
  for (const entry of table) {
    if (normaliseFamilyName(entry.materialFamily) !== normInput) continue;
    const dist = Math.abs(entry.thickness - thickness);
    if (dist < bestDist) {
      bestDist = dist;
      bestMatch = entry;
    }
  }
  if (bestMatch && bestDist <= thickness * 0.25) return bestMatch;
  return null;
}

function normaliseGasName(gasType: string): string {
  const gt = gasType.toLowerCase().replace(/[_\s-]/g, "");
  if (gt === "n2" || gt === "nitrogen") return "nitrogen";
  if (gt === "o2" || gt === "oxygen") return "oxygen";
  if (gt === "air" || gt === "compressedair") return "compressed_air";
  if (gt === "ar" || gt === "argon") return "argon";
  if (gt === "co2" || gt === "carbondioxide") return "co2";
  return gt;
}

function getGasPricePerLitre(
  settings: LLPricingSettings | null | undefined,
  gasType: string,
  governed?: LLGovernedInputs,
): { pricePerLitre: number; source: string } {
  const normGas = normaliseGasName(gasType);

  if (governed?.gasInputs?.length) {
    const matches = governed.gasInputs.filter(g => normaliseGasName(g.gasType) === normGas && g.derivedCostPerLitre != null);
    if (matches.length > 0) {
      const best = matches.reduce((a, b) => (a.derivedCostPerLitre! <= b.derivedCostPerLitre!) ? a : b);
      return {
        pricePerLitre: best.derivedCostPerLitre!,
        source: `${best.supplierName} ${best.sourceReference} (${best.packageCode || best.packageType})`,
      };
    }
  }

  if (!settings?.gasCosts) return { pricePerLitre: 0, source: "fallback" };
  const gc = settings.gasCosts as { n2PricePerLitre: number; o2PricePerLitre: number; compressedAirPricePerLitre: number };
  if (normGas === "nitrogen") return { pricePerLitre: gc.n2PricePerLitre, source: "pricing profile gasCosts" };
  if (normGas === "oxygen") return { pricePerLitre: gc.o2PricePerLitre, source: "pricing profile gasCosts" };
  if (normGas === "compressed_air") return { pricePerLitre: gc.compressedAirPricePerLitre, source: "pricing profile gasCosts" };
  return { pricePerLitre: 0, source: "fallback" };
}

function getConsumableCostPerHour(
  settings: LLPricingSettings | null | undefined,
  governed?: LLGovernedInputs,
): { costPerHour: number; source: string } {
  if (governed?.consumableInputs?.length) {
    let totalPerHour = 0;
    const sources: string[] = [];
    for (const c of governed.consumableInputs) {
      if (c.derivedCostPerHour != null && c.derivedCostPerHour > 0) {
        totalPerHour += c.derivedCostPerHour;
        sources.push(`${c.description} ($${c.derivedCostPerHour.toFixed(4)}/hr)`);
      }
    }
    if (totalPerHour > 0) {
      return { costPerHour: totalPerHour, source: sources.join(" + ") };
    }
  }

  if (!settings?.consumableCosts) return { costPerHour: 8.5, source: "fallback default" };
  const rate = (settings.consumableCosts as { consumableCostPerMachineHour: number }).consumableCostPerMachineHour;
  return { costPerHour: rate, source: "pricing profile consumableCosts" };
}

function getMachineHourlyRate(settings: LLPricingSettings | null | undefined): number {
  if (!settings?.machineProfiles) return 85;
  const profiles = settings.machineProfiles as Array<{ isDefault?: boolean; hourlyMachineRate: number }>;
  const def = profiles.find(p => p.isDefault) || profiles[0];
  return def?.hourlyMachineRate ?? 85;
}

function estimatePartsPerSheet(
  sheetLength: number,
  sheetWidth: number,
  partLength: number,
  partWidth: number,
  kerfMm: number,
  edgeTrimMm: number,
): number {
  if (partLength <= 0 || partWidth <= 0 || sheetLength <= 0 || sheetWidth <= 0) return 0;
  const usableL = sheetLength - 2 * edgeTrimMm;
  const usableW = sheetWidth - 2 * edgeTrimMm;
  if (usableL <= 0 || usableW <= 0) return 0;

  const effL = partLength + kerfMm;
  const effW = partWidth + kerfMm;

  const orientA = Math.floor(usableL / effL) * Math.floor(usableW / effW);
  const orientB = Math.floor(usableL / effW) * Math.floor(usableW / effL);

  return Math.max(orientA, orientB, 0);
}

export function computeLLPricing(inputs: LLPricingInputs, settings?: LLPricingSettings | null, governed?: LLGovernedInputs): LLPricingBreakdown {
  const rates = resolveRatesFromSettings(settings);

  const {
    material,
    partLengthMm,
    partWidthMm,
    quantity,
    cutLengthMm,
    pierceCount,
    setupMinutes,
    handlingMinutes,
    markupPercent,
    utilisationFactor,
    coilLengthMm,
  } = inputs;

  const safeQty = Math.max(quantity, 1);
  const safeUtilisation = Math.max(utilisationFactor, 0.1);
  const isCoil = material?.stockBehaviour === "coil";

  const sheetAreaMm2 = material && !isCoil ? material.sheetLength * material.sheetWidth : 0;
  const partAreaMm2 = partLengthMm * partWidthMm;
  const totalNetPartArea = partAreaMm2 * safeQty;
  const usableSheetArea = sheetAreaMm2 * safeUtilisation;

  const kerfMm = (settings?.nestingDefaults as any)?.kerfWidthMm ?? 0.3;
  const edgeTrimMm = (settings?.nestingDefaults as any)?.edgeTrimMm ?? 10;

  let estimatedSheets = 0;
  let materialCostTotal = 0;
  let partsPerSheet = 0;
  let coilWeightKg = 0;
  let coilPricePerKgUsed = 0;
  let coilWidthMm = 0;
  let coilLengthMmUsed = 0;

  if (isCoil && material) {
    coilWidthMm = material.sheetWidth;
    coilPricePerKgUsed = material.pricePerKg || 0;
    coilLengthMmUsed = coilLengthMm || 0;

    if (coilLengthMmUsed > 0 && coilPricePerKgUsed > 0 && material.densityKgM3 > 0) {
      const thicknessM = material.thickness / 1000;
      const widthM = coilWidthMm / 1000;
      const lengthM = coilLengthMmUsed / 1000;
      const volumeM3 = thicknessM * widthM * lengthM;
      coilWeightKg = volumeM3 * material.densityKgM3;
      const costPerUnit = coilWeightKg * coilPricePerKgUsed;
      materialCostTotal = costPerUnit * safeQty;
    }
  } else if (material && partLengthMm > 0 && partWidthMm > 0) {
    partsPerSheet = estimatePartsPerSheet(
      material.sheetLength, material.sheetWidth,
      partLengthMm, partWidthMm,
      kerfMm, edgeTrimMm,
    );

    if (partsPerSheet > 0) {
      estimatedSheets = Math.ceil(safeQty / partsPerSheet);
      materialCostTotal = (material.pricePerSheetExGst / partsPerSheet) * safeQty;
    } else if (usableSheetArea > 0 && totalNetPartArea > 0) {
      estimatedSheets = Math.ceil(totalNetPartArea / usableSheetArea);
      materialCostTotal = estimatedSheets * material.pricePerSheetExGst;
    }
  }

  if (materialCostTotal > 0 && materialCostTotal < rates.minimumMaterialCharge) {
    materialCostTotal = rates.minimumMaterialCharge;
  }

  const materialCostPerUnit = materialCostTotal / safeQty;

  const ratePerMmCut = rates.ratePerMmCut;
  const ratePerPierce = rates.ratePerPierce;
  const machineHourlyRate = getMachineHourlyRate(settings);

  const processRate = material ? findProcessRate(settings, material.materialFamily, material.thickness) : null;

  let cutCost = 0;
  let pierceCost = 0;
  let gasCost = 0;
  let consumablesCost = 0;
  let machineTimeCost = 0;
  let machineTimeMinutes = 0;
  let processCostTotal = 0;
  let processCostPerUnit = 0;
  let processMode: "time-based" | "flat-rate" = "flat-rate";
  let gasSource = "";
  let gasCostPerLitre = 0;
  let consumablesSource = "";
  let consumablesCostPerHourRate = 0;

  if (processRate && (cutLengthMm > 0 || pierceCount > 0)) {
    processMode = "time-based";

    const totalCutLengthMm = cutLengthMm * safeQty;
    const cuttingTimeMin = processRate.cutSpeedMmPerMin > 0 ? totalCutLengthMm / processRate.cutSpeedMmPerMin : 0;

    const totalPierces = pierceCount * safeQty;
    const pierceTimeMin = (totalPierces * processRate.pierceTimeSec) / 60;

    machineTimeMinutes = cuttingTimeMin + pierceTimeMin;
    const machineTimeHours = machineTimeMinutes / 60;

    machineTimeCost = machineTimeHours * machineHourlyRate;

    const gasResult = getGasPricePerLitre(settings, processRate.assistGasType, governed);
    gasCost = machineTimeMinutes * processRate.gasConsumptionLPerMin * gasResult.pricePerLitre;
    gasSource = gasResult.source;
    gasCostPerLitre = gasResult.pricePerLitre;

    const consumableResult = getConsumableCostPerHour(settings, governed);
    consumablesCost = machineTimeHours * consumableResult.costPerHour;
    consumablesSource = consumableResult.source;
    consumablesCostPerHourRate = consumableResult.costPerHour;

    cutCost = cuttingTimeMin > 0 ? (machineTimeCost * (cuttingTimeMin / machineTimeMinutes)) / safeQty : 0;
    pierceCost = pierceTimeMin > 0 ? (machineTimeCost * (pierceTimeMin / machineTimeMinutes)) / safeQty : 0;

    processCostTotal = machineTimeCost + gasCost + consumablesCost;
    processCostPerUnit = processCostTotal / safeQty;
  } else {
    cutCost = cutLengthMm * ratePerMmCut;
    pierceCost = pierceCount * ratePerPierce;
    processCostPerUnit = cutCost + pierceCost;
    processCostTotal = processCostPerUnit * safeQty;
  }

  const shopRatePerHour = rates.shopRatePerHour;
  const setupHandlingCost = ((setupMinutes + handlingMinutes) / 60) * shopRatePerHour;

  const internalCostSubtotal = materialCostTotal + processCostTotal + setupHandlingCost;

  const minimumLineCharge = rates.minimumLineCharge;
  const minimumLineChargeApplied = internalCostSubtotal < minimumLineCharge;
  const effectiveSubtotal = Math.max(internalCostSubtotal, minimumLineCharge);

  const markupAmount = effectiveSubtotal * (markupPercent / 100);
  const sellTotal = effectiveSubtotal + markupAmount;
  const unitSell = sellTotal / safeQty;

  return {
    sheetAreaMm2,
    partAreaMm2,
    totalNetPartArea,
    usableSheetArea,
    estimatedSheets,
    partsPerSheet,
    materialCostPerUnit,
    materialCostTotal,
    cutCost,
    pierceCost,
    gasCost,
    consumablesCost,
    machineTimeCost,
    machineTimeMinutes,
    processCostPerUnit,
    processCostTotal,
    processMode,
    setupHandlingCost,
    internalCostSubtotal: effectiveSubtotal,
    minimumLineChargeApplied,
    markupPercent,
    markupAmount,
    sellTotal,
    unitCost: effectiveSubtotal / safeQty,
    unitSell,
    utilisationFactor: safeUtilisation,
    ratePerMmCut,
    ratePerPierce,
    shopRatePerHour,
    gasSource: gasSource || undefined,
    gasCostPerLitre: gasCostPerLitre || undefined,
    consumablesSource: consumablesSource || undefined,
    consumablesCostPerHourRate: consumablesCostPerHourRate || undefined,
    stockBehaviour: material?.stockBehaviour || "sheet",
    coilLengthMm: coilLengthMmUsed || undefined,
    coilWidthMm: coilWidthMm || undefined,
    coilWeightKg: coilWeightKg || undefined,
    coilPricePerKg: coilPricePerKgUsed || undefined,
  };
}
