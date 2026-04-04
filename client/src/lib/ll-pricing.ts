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
 * MATERIAL COST — RECTANGULAR PACKING MODEL (Phase 4A):
 *   Sheet count uses rectangular packing with kerf allowance when possible:
 *     1. Effective part size = (partLength + kerfWidth) × (partWidth + kerfWidth)
 *     2. Parts per sheet = best of two orientations on usable sheet area
 *     3. Sheets required = ceil(quantity / partsPerSheet)
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

import type { LLPricingSettings } from "@shared/schema";

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
  unitSell: number;

  utilisationFactor: number;
  ratePerMmCut: number;
  ratePerPierce: number;
  shopRatePerHour: number;
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
  if (bestMatch && bestDist <= thickness * 0.5) return bestMatch;
  return null;
}

function getGasPricePerLitre(settings: LLPricingSettings | null | undefined, gasType: string): number {
  if (!settings?.gasCosts) return 0;
  const gc = settings.gasCosts as { n2PricePerLitre: number; o2PricePerLitre: number; compressedAirPricePerLitre: number };
  const gt = gasType.toLowerCase().replace(/[_\s-]/g, "");
  if (gt === "n2" || gt === "nitrogen") return gc.n2PricePerLitre;
  if (gt === "o2" || gt === "oxygen") return gc.o2PricePerLitre;
  if (gt === "air" || gt === "compressedair") return gc.compressedAirPricePerLitre;
  return 0;
}

function getConsumableCostPerHour(settings: LLPricingSettings | null | undefined): number {
  if (!settings?.consumableCosts) return 8.5;
  return (settings.consumableCosts as { consumableCostPerMachineHour: number }).consumableCostPerMachineHour;
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

export function computeLLPricing(inputs: LLPricingInputs, settings?: LLPricingSettings | null): LLPricingBreakdown {
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
  } = inputs;

  const safeQty = Math.max(quantity, 1);
  const safeUtilisation = Math.max(utilisationFactor, 0.1);

  const sheetAreaMm2 = material ? material.sheetLength * material.sheetWidth : 0;
  const partAreaMm2 = partLengthMm * partWidthMm;
  const totalNetPartArea = partAreaMm2 * safeQty;
  const usableSheetArea = sheetAreaMm2 * safeUtilisation;

  const kerfMm = (settings?.nestingDefaults as any)?.kerfWidthMm ?? 0.3;
  const edgeTrimMm = (settings?.nestingDefaults as any)?.edgeTrimMm ?? 10;

  let estimatedSheets = 0;
  let materialCostTotal = 0;
  let partsPerSheet = 0;

  if (material && partLengthMm > 0 && partWidthMm > 0) {
    partsPerSheet = estimatePartsPerSheet(
      material.sheetLength, material.sheetWidth,
      partLengthMm, partWidthMm,
      kerfMm, edgeTrimMm,
    );

    if (partsPerSheet > 0) {
      estimatedSheets = Math.ceil(safeQty / partsPerSheet);
    } else if (usableSheetArea > 0 && totalNetPartArea > 0) {
      estimatedSheets = Math.ceil(totalNetPartArea / usableSheetArea);
    }

    materialCostTotal = estimatedSheets * material.pricePerSheetExGst;
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

  if (processRate && (cutLengthMm > 0 || pierceCount > 0)) {
    processMode = "time-based";

    const totalCutLengthMm = cutLengthMm * safeQty;
    const cuttingTimeMin = processRate.cutSpeedMmPerMin > 0 ? totalCutLengthMm / processRate.cutSpeedMmPerMin : 0;

    const totalPierces = pierceCount * safeQty;
    const pierceTimeMin = (totalPierces * processRate.pierceTimeSec) / 60;

    machineTimeMinutes = cuttingTimeMin + pierceTimeMin;
    const machineTimeHours = machineTimeMinutes / 60;

    machineTimeCost = machineTimeHours * machineHourlyRate;

    const gasPricePerL = getGasPricePerLitre(settings, processRate.assistGasType);
    gasCost = machineTimeMinutes * processRate.gasConsumptionLPerMin * gasPricePerL;

    const consumableRate = getConsumableCostPerHour(settings);
    consumablesCost = machineTimeHours * consumableRate;

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
    unitSell,
    utilisationFactor: safeUtilisation,
    ratePerMmCut,
    ratePerPierce,
    shopRatePerHour,
  };
}
