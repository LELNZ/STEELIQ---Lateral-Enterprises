/**
 * LL (Laser) Pricing Engine — Phase 3A Settings-Driven
 *
 * Bounded manual-entry pricing model for Lateral Laser division.
 * This is NOT DXF automation, nesting optimisation, or machine integration.
 *
 * THREE-LAYER SEPARATION:
 *   A. Procurement Truth — supplier-linked sheet material row
 *   B. Pricing Engine Truth — derived costs, commercial rule, sell result
 *   C. Customer Output Truth — sell totals only, no internal cost leakage
 *
 * MATERIAL COST — SHEET CONSUMPTION MODEL (Phase 2B):
 *   Material cost is derived from estimated sheet consumption, NOT per-unit
 *   area pricing. The model calculates:
 *     1. Total net part area = partLength × partWidth × quantity
 *     2. Usable sheet area = sheetLength × sheetWidth × utilisationFactor
 *     3. Estimated sheets required = ceil(totalNetPartArea / usableSheetArea)
 *     4. Material cost = estimatedSheets × pricePerSheet
 *   This is an honest bounded approximation — NOT nesting, NOT remnant
 *   tracking, NOT stock management. The utilisation factor (default 75%)
 *   accounts for kerf, edge trim, and general material waste.
 *   Minimum material charge ($25) is applied per line item, not per unit.
 *
 * PROCESS COST:
 *   Operator-entered cut length (mm) and pierce count, multiplied by
 *   configurable rates. No geometric precision claimed.
 *
 * COMMERCIAL RULE:
 *   Explicit percentage markup on internal cost subtotal.
 *
 * SETTINGS-DRIVEN (Phase 3A):
 *   All rates now read from LLPricingSettings passed as parameter.
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
  materialCostPerUnit: number;
  materialCostTotal: number;

  cutCost: number;
  pierceCost: number;
  processCostPerUnit: number;
  processCostTotal: number;

  setupHandlingCost: number;

  internalCostSubtotal: number;

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
  DEFAULT_SETUP_MINUTES: 15,
  DEFAULT_HANDLING_MINUTES: 10,
  MINIMUM_MATERIAL_CHARGE: 25.00,
} as const;

export interface LLResolvedRates {
  ratePerMmCut: number;
  ratePerPierce: number;
  shopRatePerHour: number;
  minimumMaterialCharge: number;
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
    defaultSetupMinutes: settings.setupHandlingDefaults.defaultSetupMinutes,
    defaultHandlingMinutes: settings.setupHandlingDefaults.defaultHandlingMinutes,
    defaultMarkupPercent: settings.commercialPolicy.defaultMarkupPercent,
    defaultUtilisationFactor: settings.nestingDefaults.defaultUtilisationFactor,
  };
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

  let estimatedSheets = 0;
  let materialCostTotal = 0;

  if (usableSheetArea > 0 && totalNetPartArea > 0 && material) {
    estimatedSheets = Math.ceil(totalNetPartArea / usableSheetArea);
    materialCostTotal = estimatedSheets * material.pricePerSheetExGst;
  }

  if (materialCostTotal > 0 && materialCostTotal < rates.minimumMaterialCharge) {
    materialCostTotal = rates.minimumMaterialCharge;
  }

  const materialCostPerUnit = materialCostTotal / safeQty;

  const ratePerMmCut = rates.ratePerMmCut;
  const ratePerPierce = rates.ratePerPierce;

  const cutCost = cutLengthMm * ratePerMmCut;
  const pierceCost = pierceCount * ratePerPierce;
  const processCostPerUnit = cutCost + pierceCost;
  const processCostTotal = processCostPerUnit * safeQty;

  const shopRatePerHour = rates.shopRatePerHour;
  const setupHandlingCost = ((setupMinutes + handlingMinutes) / 60) * shopRatePerHour;

  const internalCostSubtotal = materialCostTotal + processCostTotal + setupHandlingCost;

  const markupAmount = internalCostSubtotal * (markupPercent / 100);
  const sellTotal = internalCostSubtotal + markupAmount;
  const unitSell = sellTotal / safeQty;

  return {
    sheetAreaMm2,
    partAreaMm2,
    totalNetPartArea,
    usableSheetArea,
    estimatedSheets,
    materialCostPerUnit,
    materialCostTotal,
    cutCost,
    pierceCost,
    processCostPerUnit,
    processCostTotal,
    setupHandlingCost,
    internalCostSubtotal,
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
