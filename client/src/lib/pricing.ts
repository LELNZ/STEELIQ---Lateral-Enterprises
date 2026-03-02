import type { ConfigurationProfile, ConfigurationAccessory, ConfigurationLabor } from "@shared/schema";

export interface PricingBreakdown {
  profilesCostUsd: number;
  profilesCostNzd: number;
  accessoriesCostUsd: number;
  accessoriesCostNzd: number;
  laborCostNzd: number;
  glassCostNzd: number;
  linerCostNzd: number;
  handleCostNzd: number;
  totalWeightKg: number;
  netCostNzd: number;
  actualCostPerSqm: number;
  salePriceNzd: number;
  marginNzd: number;
  marginPercent: number;
}

export interface PricingExtras {
  glassPricePerSqm?: number | null;
  linerPricePerM?: number | null;
  handlePriceEach?: number | null;
  openingPanelCount?: number;
}

function calcProfileLength(
  widthMm: number,
  heightMm: number,
  lengthFormula: string
): number {
  const wM = widthMm / 1000;
  const hM = heightMm / 1000;
  switch (lengthFormula) {
    case "perimeter":
      return 2 * (wM + hM);
    case "width":
      return wM;
    case "height":
      return hM;
    default:
      return 2 * (wM + hM);
  }
}

export function calculatePricing(
  widthMm: number,
  heightMm: number,
  quantity: number,
  profiles: ConfigurationProfile[],
  accessories: ConfigurationAccessory[],
  laborTasks: ConfigurationLabor[],
  usdToNzdRate: number,
  salePricePerSqm: number,
  extras?: PricingExtras
): PricingBreakdown {
  const sqm = (widthMm * heightMm * quantity) / 1_000_000;
  const perimeterM = 2 * (widthMm / 1000 + heightMm / 1000);

  let profilesCostUsd = 0;
  let totalWeightKg = 0;

  for (const p of profiles) {
    const length = calcProfileLength(widthMm, heightMm, p.lengthFormula || "perimeter");
    const qty = (p.quantityPerSet || 1) * quantity;
    const kgPerM = parseFloat(p.kgPerMetre) || 0;
    const pricePerKg = parseFloat(p.pricePerKgUsd) || 0;
    const weight = length * qty * kgPerM;
    totalWeightKg += weight;
    profilesCostUsd += weight * pricePerKg;
  }

  let accessoriesCostUsd = 0;

  for (const a of accessories) {
    const priceUsd = parseFloat(a.priceUsd) || 0;
    const qtyPerSet = parseFloat(a.quantityPerSet || "1") || 0;

    if (a.scalingType === "per-linear-metre") {
      accessoriesCostUsd += priceUsd * qtyPerSet * perimeterM * quantity;
    } else {
      accessoriesCostUsd += priceUsd * qtyPerSet * quantity;
    }
  }

  let laborCostNzd = 0;
  for (const l of laborTasks) {
    laborCostNzd += (parseFloat(l.costNzd || "0") || 0) * quantity;
  }

  const glassPricePerSqm = extras?.glassPricePerSqm ?? null;
  const glassCostNzd = glassPricePerSqm != null ? glassPricePerSqm * sqm : 0;

  const linerPricePerM = extras?.linerPricePerM ?? null;
  const linerCostNzd = linerPricePerM != null ? linerPricePerM * perimeterM * quantity : 0;

  const handlePriceEach = extras?.handlePriceEach ?? null;
  const openingPanelCount = extras?.openingPanelCount ?? 1;
  const handleCostNzd = handlePriceEach != null ? handlePriceEach * openingPanelCount * quantity : 0;

  const profilesCostNzd = profilesCostUsd * usdToNzdRate;
  const accessoriesCostNzd = accessoriesCostUsd * usdToNzdRate;
  const netCostNzd = profilesCostNzd + accessoriesCostNzd + laborCostNzd + glassCostNzd + linerCostNzd + handleCostNzd;
  const actualCostPerSqm = sqm > 0 ? netCostNzd / sqm : 0;
  const salePriceNzd = salePricePerSqm * sqm;
  const marginNzd = salePriceNzd - netCostNzd;
  const marginPercent = salePriceNzd > 0 ? (marginNzd / salePriceNzd) * 100 : 0;

  return {
    profilesCostUsd,
    profilesCostNzd,
    accessoriesCostUsd,
    accessoriesCostNzd,
    laborCostNzd,
    glassCostNzd,
    linerCostNzd,
    handleCostNzd,
    totalWeightKg,
    netCostNzd,
    actualCostPerSqm,
    salePriceNzd,
    marginNzd,
    marginPercent,
  };
}
