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
  lockCostNzd: number;
  wanzBarCostNzd: number;
  totalWeightKg: number;
  laborHours: number;
  netCostNzd: number;
  actualCostPerSqm: number;
  salePriceNzd: number;
  marginNzd: number;
  marginPercent: number;
  labourBreakdown: LabourLineBreakdown[];
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
  lockPriceEach?: number | null;
  openingPanelCount?: number;
  wanzBar?: WanzBarPricingInput;
  salePriceOverride?: number | null;
}

export interface ItemGeometry {
  mullionCount: number;
  transomCount: number;
  paneCount: number;
  widthMm: number;
  heightMm: number;
}

export interface GlazingBandEntry {
  label: string;
  maxAreaSqm: number;
  minutesPerPane: number;
}

export interface LabourLineBreakdown {
  taskName: string;
  driverType: string;
  driverQuantity: number;
  setupMinutes: number;
  driverMinutes: number;
  totalMinutes: number;
  costNzd: number;
  isAutoInjected?: boolean;
}

// Fallback glazing bands — aligned with installation rate bands (0–1 / 1–2 / 2–3 / 3+).
// These are used only when no glazing_band library entries exist in the DB.
// Staff can override these thresholds in Library → Manufacturing Labour → Glazing Time Bands.
const DEFAULT_GLAZING_BANDS: GlazingBandEntry[] = [
  { label: "small",       maxAreaSqm: 1.0,     minutesPerPane: 10 },
  { label: "medium",      maxAreaSqm: 2.0,     minutesPerPane: 15 },
  { label: "large",       maxAreaSqm: 3.0,     minutesPerPane: 20 },
  { label: "extra_large", maxAreaSqm: Infinity, minutesPerPane: 25 },
];

function resolveGlazingMinutesPerPane(
  paneAreaSqm: number,
  bands: GlazingBandEntry[]
): number {
  const sorted = [...bands].sort((a, b) => a.maxAreaSqm - b.maxAreaSqm);
  const band = sorted.find((b) => paneAreaSqm <= b.maxAreaSqm);
  return band ? band.minutesPerPane : (sorted[sorted.length - 1]?.minutesPerPane ?? 15);
}

function computeDriverResult(
  driverType: string,
  minutesPerDriver: number,
  geo: ItemGeometry,
  glazingBands: GlazingBandEntry[]
): { driverQuantity: number; driverMinutes: number } {
  const allEnds = geo.mullionCount * 2 + geo.transomCount * 2;
  const memberCount = 4 + geo.mullionCount + geo.transomCount;
  const panes = geo.paneCount > 0 ? geo.paneCount : 1;

  switch (driverType) {
    case "per_item":
      return { driverQuantity: 1, driverMinutes: minutesPerDriver };
    case "per_cut_cycle":
      return { driverQuantity: memberCount, driverMinutes: memberCount * minutesPerDriver };
    case "per_hole":
      return { driverQuantity: 16, driverMinutes: 16 * minutesPerDriver };
    case "per_slot":
      return { driverQuantity: 2, driverMinutes: 2 * minutesPerDriver };
    case "per_end":
      return { driverQuantity: allEnds, driverMinutes: allEnds * minutesPerDriver };
    case "per_screw": {
      const screws = 16 + allEnds * 2;
      return { driverQuantity: screws, driverMinutes: screws * minutesPerDriver };
    }
    case "per_corner":
      return { driverQuantity: 4, driverMinutes: 4 * minutesPerDriver };
    case "per_joint":
      return { driverQuantity: allEnds, driverMinutes: allEnds * minutesPerDriver };
    case "per_glue_point": {
      const gluePoints = 4 + allEnds;
      return { driverQuantity: gluePoints, driverMinutes: gluePoints * minutesPerDriver };
    }
    case "per_pane":
      return { driverQuantity: panes, driverMinutes: panes * minutesPerDriver };
    case "per_pane_area_band": {
      const paneAreaSqm = geo.widthMm > 0 && geo.heightMm > 0
        ? (geo.widthMm * geo.heightMm) / (panes * 1_000_000)
        : 0;
      const minsPerPane = glazingBands.length > 0
        ? resolveGlazingMinutesPerPane(paneAreaSqm, glazingBands)
        : minutesPerDriver;
      return { driverQuantity: panes, driverMinutes: panes * minsPerPane };
    }
    default:
      return { driverQuantity: 1, driverMinutes: minutesPerDriver };
  }
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
  masterData?: MasterData,
  geometry?: ItemGeometry,
  glazingBands?: GlazingBandEntry[]
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

  const geo: ItemGeometry = geometry ?? {
    mullionCount: 0,
    transomCount: 0,
    paneCount: 1,
    widthMm,
    heightMm,
  };
  const bands = glazingBands && glazingBands.length > 0 ? glazingBands : DEFAULT_GLAZING_BANDS;

  let laborCostNzd = 0;
  let laborHours = 0;
  const labourBreakdown: LabourLineBreakdown[] = [];

  for (const l of laborTasks) {
    const master = masterLabourMap.get(l.taskName);
    const configCostOverride = parseFloat(l.costNzd || "0") || 0;
    const rate = master ? (parseFloat(master.ratePerHour) || 0) : 0;

    if (configCostOverride > 0) {
      const costTotal = configCostOverride * quantity;
      const minsTotal = rate > 0 ? (configCostOverride / rate) * 60 : 0;
      laborHours += (minsTotal / 60) * quantity;
      laborCostNzd += costTotal;
      labourBreakdown.push({
        taskName: l.taskName,
        driverType: "manual_override",
        driverQuantity: 0,
        setupMinutes: 0,
        driverMinutes: minsTotal,
        totalMinutes: minsTotal,
        costNzd: costTotal,
      });
      continue;
    }

    if (!master) continue;

    if (master.driverType) {
      const setupMins = parseFloat(master.setupMinutes) || 0;
      const minsPerDriver = parseFloat(master.minutesPerDriver) || 0;
      const { driverQuantity, driverMinutes } = computeDriverResult(
        master.driverType, minsPerDriver, geo, bands
      );
      const totalMins = setupMins + driverMinutes;
      const cost = (totalMins / 60) * rate * quantity;
      laborHours += (totalMins / 60) * quantity;
      laborCostNzd += cost;
      labourBreakdown.push({
        taskName: l.taskName,
        driverType: master.driverType,
        driverQuantity,
        setupMinutes: setupMins,
        driverMinutes,
        totalMinutes: totalMins,
        costNzd: cost,
      });
    } else {
      const timeMins = parseFloat(master.timeMinutes) || 0;
      const cost = (timeMins / 60) * rate * quantity;
      laborHours += (timeMins / 60) * quantity;
      laborCostNzd += cost;
      labourBreakdown.push({
        taskName: l.taskName,
        driverType: "flat",
        driverQuantity: 1,
        setupMinutes: timeMins,
        driverMinutes: 0,
        totalMinutes: timeMins,
        costNzd: cost,
      });
    }
  }

  // ── Auto-inject glue ──────────────────────────────────────────────────────
  // Glue is applied to all outer frame corners and mullion/transom joints.
  // If the configuration already has an explicit "glue" labour row, skip
  // auto-injection to avoid double-counting.
  const hasExplicitGlue = laborTasks.some((l) => l.taskName === "glue");
  const glueMaster = masterLabourMap.get("glue");
  if (!hasExplicitGlue && glueMaster && glueMaster.driverType === "per_glue_point") {
    const setupMins = parseFloat(glueMaster.setupMinutes) || 0;
    const minsPerDriver = parseFloat(glueMaster.minutesPerDriver) || 1;
    const glueRate = parseFloat(glueMaster.ratePerHour) || 45;
    const { driverQuantity, driverMinutes } = computeDriverResult(
      "per_glue_point", minsPerDriver, geo, bands
    );
    const totalMins = setupMins + driverMinutes;
    const cost = (totalMins / 60) * glueRate * quantity;
    laborHours += (totalMins / 60) * quantity;
    laborCostNzd += cost;
    labourBreakdown.push({
      taskName: "glue",
      driverType: "per_glue_point",
      driverQuantity,
      setupMinutes: setupMins,
      driverMinutes,
      totalMinutes: totalMins,
      costNzd: cost,
      isAutoInjected: true,
    });
  }

  const glassPricePerSqm = extras?.glassPricePerSqm ?? null;
  const glassCostNzd = glassPricePerSqm != null ? glassPricePerSqm * sqm : 0;

  const linerPricePerM = extras?.linerPricePerM ?? null;
  const linerCostNzd = linerPricePerM != null ? linerPricePerM * perimeterM * quantity : 0;

  const handlePriceEach = extras?.handlePriceEach ?? null;
  const openingPanelCount = extras?.openingPanelCount ?? 1;
  const handleCostNzd = handlePriceEach != null ? handlePriceEach * openingPanelCount * quantity : 0;

  const lockPriceEach = extras?.lockPriceEach ?? null;
  const lockCostNzd = lockPriceEach != null ? lockPriceEach * quantity : 0;

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
  const netCostNzd = profilesCostNzd + accessoriesCostNzd + laborCostNzd + glassCostNzd + linerCostNzd + handleCostNzd + lockCostNzd + wanzBarCostNzd;
  const actualCostPerSqm = sqm > 0 ? netCostNzd / sqm : 0;
  const salePriceNzd = (extras?.salePriceOverride != null && extras.salePriceOverride > 0)
    ? extras.salePriceOverride
    : salePricePerSqm * sqm;
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
    lockCostNzd,
    wanzBarCostNzd,
    totalWeightKg,
    laborHours,
    netCostNzd,
    actualCostPerSqm,
    salePriceNzd,
    marginNzd,
    marginPercent,
    labourBreakdown,
  };
}
