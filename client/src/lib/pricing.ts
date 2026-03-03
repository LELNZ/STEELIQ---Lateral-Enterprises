import type { ConfigurationProfile, ConfigurationAccessory, ConfigurationLabor, LibraryEntry } from "@shared/schema";

export interface PricingBreakdown {
  profilesCostUsd: number;
  profilesCostNzd: number;
  accessoriesCostUsd: number;
  accessoriesCostNzd: number;
  laborCostNzd: number;
  glassCostNzd: number;
  linerCostNzd: number;
  handleCostNzd: number;
  wanzBarCostNzd: number;
  totalWeightKg: number;
  laborHours: number;
  netCostNzd: number;
  actualCostPerSqm: number;
  salePriceNzd: number;
  marginNzd: number;
  marginPercent: number;
}

export interface MasterData {
  masterProfiles?: LibraryEntry[];
  masterAccessories?: LibraryEntry[];
  masterLabour?: LibraryEntry[];
}

export interface WanzBarPricingInput {
  enabled: boolean;
  source: "nz-local" | "direct" | "";
  kgPerMetre: number;
  pricePerKgUsd: number;
  priceNzdPerLinM: number;
}

export interface PricingExtras {
  glassPricePerSqm?: number | null;
  linerPricePerM?: number | null;
  handlePriceEach?: number | null;
  openingPanelCount?: number;
  wanzBar?: WanzBarPricingInput;
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
  extras?: PricingExtras,
  masterData?: MasterData
): PricingBreakdown {
  const sqm = (widthMm * heightMm * quantity) / 1_000_000;
  const perimeterM = 2 * (widthMm / 1000 + heightMm / 1000);

  const masterProfileMap = new Map<string, any>();
  if (masterData?.masterProfiles) {
    for (const mp of masterData.masterProfiles) {
      const d = mp.data as any;
      if (d.mouldNumber) masterProfileMap.set(d.mouldNumber, d);
    }
  }

  const masterAccessoryMap = new Map<string, any>();
  if (masterData?.masterAccessories) {
    for (const ma of masterData.masterAccessories) {
      const d = ma.data as any;
      if (d.code) masterAccessoryMap.set(d.code, d);
    }
  }

  const masterLabourMap = new Map<string, any>();
  if (masterData?.masterLabour) {
    for (const ml of masterData.masterLabour) {
      const d = ml.data as any;
      if (d.name) masterLabourMap.set(d.name, d);
    }
  }

  let profilesCostUsd = 0;
  let totalWeightKg = 0;

  for (const p of profiles) {
    const master = masterProfileMap.get(p.mouldNumber);
    const kgPerM = parseFloat(master?.kgPerMetre ?? p.kgPerMetre) || 0;
    const pricePerKg = parseFloat(master?.pricePerKgUsd ?? p.pricePerKgUsd) || 0;
    const formula = master?.lengthFormula ?? p.lengthFormula ?? "perimeter";
    const length = calcProfileLength(widthMm, heightMm, formula);
    const qty = (p.quantityPerSet || 1) * quantity;
    const weight = length * qty * kgPerM;
    totalWeightKg += weight;
    profilesCostUsd += weight * pricePerKg;
  }

  let accessoriesCostUsd = 0;

  for (const a of accessories) {
    const master = masterAccessoryMap.get(a.code || "");
    const priceUsd = parseFloat(master?.priceUsd ?? a.priceUsd) || 0;
    const scalingType = master?.scalingType ?? a.scalingType;
    const qtyPerSet = parseFloat(a.quantityPerSet || "1") || 0;

    if (scalingType === "per-linear-metre") {
      accessoriesCostUsd += priceUsd * qtyPerSet * perimeterM * quantity;
    } else {
      accessoriesCostUsd += priceUsd * qtyPerSet * quantity;
    }
  }

  let laborCostNzd = 0;
  let laborHours = 0;
  for (const l of laborTasks) {
    const master = masterLabourMap.get(l.taskName);
    const configCost = parseFloat(l.costNzd || "0") || 0;
    if (master && configCost === 0) {
      const timeMins = parseFloat(master.timeMinutes) || 0;
      const rate = parseFloat(master.ratePerHour) || 0;
      laborHours += (timeMins / 60) * quantity;
      laborCostNzd += (timeMins / 60) * rate * quantity;
    } else {
      const rate = master ? (parseFloat(master.ratePerHour) || 0) : 0;
      if (rate > 0) {
        laborHours += (configCost / rate) * quantity;
      }
      laborCostNzd += configCost * quantity;
    }
  }

  const glassPricePerSqm = extras?.glassPricePerSqm ?? null;
  const glassCostNzd = glassPricePerSqm != null ? glassPricePerSqm * sqm : 0;

  const linerPricePerM = extras?.linerPricePerM ?? null;
  const linerCostNzd = linerPricePerM != null ? linerPricePerM * perimeterM * quantity : 0;

  const handlePriceEach = extras?.handlePriceEach ?? null;
  const openingPanelCount = extras?.openingPanelCount ?? 1;
  const handleCostNzd = handlePriceEach != null ? handlePriceEach * openingPanelCount * quantity : 0;

  let wanzBarCostNzd = 0;
  const wb = extras?.wanzBar;
  if (wb && wb.enabled && wb.source) {
    const widthM = widthMm / 1000;
    if (wb.source === "nz-local") {
      wanzBarCostNzd = wb.priceNzdPerLinM * widthM * quantity;
    } else if (wb.source === "direct") {
      wanzBarCostNzd = wb.pricePerKgUsd * wb.kgPerMetre * widthM * usdToNzdRate * quantity;
    }
  }

  const profilesCostNzd = profilesCostUsd * usdToNzdRate;
  const accessoriesCostNzd = accessoriesCostUsd * usdToNzdRate;
  const netCostNzd = profilesCostNzd + accessoriesCostNzd + laborCostNzd + glassCostNzd + linerCostNzd + handleCostNzd + wanzBarCostNzd;
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
    wanzBarCostNzd,
    totalWeightKg,
    laborHours,
    netCostNzd,
    actualCostPerSqm,
    salePriceNzd,
    marginNzd,
    marginPercent,
  };
}
