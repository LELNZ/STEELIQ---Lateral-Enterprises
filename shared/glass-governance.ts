import { GLASS_LIBRARY, type GlassEntry, IGU_INFO, IGU_THICKNESS_COLUMNS } from "./glass-library";
import { validatePaneSpec, classifyPaneResolutionState, type PaneGlassSpec, type PaneResolutionStatus } from "./pane-integrity";

export interface GlassComboRecord {
  iguType: string;
  combo: string;
  thicknesses: string[];
  prices: Record<string, number>;
  status: "valid" | "duplicate" | "incomplete";
  duplicateOf?: string;
  missingThicknesses: string[];
}

export interface DuplicateGroup {
  key: string;
  entries: GlassEntry[];
  hasPriceConflict: boolean;
  prices: Record<string, number[]>;
}

export interface LibraryAuditResult {
  totalEntries: number;
  byIgu: Record<string, GlassComboRecord[]>;
  duplicates: DuplicateGroup[];
  duplicateCount: number;
  incompleteCount: number;
  conflictCount: number;
  healthStatus: "clean" | "warnings" | "conflicts";
}

export function auditGlassLibrary(): LibraryAuditResult {
  const byIgu: Record<string, GlassComboRecord[]> = {};
  const keyMap = new Map<string, GlassEntry[]>();

  for (const entry of GLASS_LIBRARY) {
    const key = `${entry.iguType}||${entry.combo}`;
    if (!keyMap.has(key)) keyMap.set(key, []);
    keyMap.get(key)!.push(entry);
  }

  const duplicates: DuplicateGroup[] = [];

  for (const [key, entries] of keyMap) {
    if (entries.length > 1) {
      const prices: Record<string, number[]> = {};
      for (const e of entries) {
        for (const [t, p] of Object.entries(e.prices)) {
          if (!prices[t]) prices[t] = [];
          prices[t].push(p);
        }
      }
      const hasPriceConflict = Object.values(prices).some(
        (arr) => new Set(arr).size > 1
      );
      duplicates.push({ key, entries, hasPriceConflict, prices });
    }
  }

  for (const entry of GLASS_LIBRARY) {
    const iguType = entry.iguType;
    if (!byIgu[iguType]) byIgu[iguType] = [];

    const expectedThicknesses = IGU_THICKNESS_COLUMNS[iguType] || [];
    const actualThicknesses = Object.keys(entry.prices);
    const missingThicknesses = expectedThicknesses.filter(
      (t) => !actualThicknesses.includes(t)
    );

    const key = `${entry.iguType}||${entry.combo}`;
    const isDuplicate = (keyMap.get(key)?.length ?? 0) > 1;

    byIgu[iguType].push({
      iguType,
      combo: entry.combo,
      thicknesses: actualThicknesses,
      prices: entry.prices,
      status: isDuplicate ? "duplicate" : missingThicknesses.length > 0 ? "incomplete" : "valid",
      duplicateOf: isDuplicate ? key : undefined,
      missingThicknesses,
    });
  }

  const incompleteCount = Object.values(byIgu)
    .flat()
    .filter((r) => r.status === "incomplete").length;

  const healthStatus: LibraryAuditResult["healthStatus"] =
    duplicates.some((d) => d.hasPriceConflict) ? "conflicts" :
    duplicates.length > 0 || incompleteCount > 0 ? "warnings" : "clean";

  return {
    totalEntries: GLASS_LIBRARY.length,
    byIgu,
    duplicates,
    duplicateCount: duplicates.length,
    incompleteCount,
    conflictCount: duplicates.filter((d) => d.hasPriceConflict).length,
    healthStatus,
  };
}

export type PricingSourceType = "pane-aware" | "partial-fallback" | "full-fallback" | "default" | "no-glass";

export interface ItemPricingSource {
  type: PricingSourceType;
  label: string;
  explanation: string;
  paneCount: number;
  resolvedCount: number;
  unresolvedCount: number;
}

export function getItemPricingSource(
  paneGlassSpecs: PaneGlassSpec[] | null | undefined,
  effectivePaneCount: number,
  hasGlassIguType: boolean
): ItemPricingSource {
  if (!hasGlassIguType) {
    return {
      type: "no-glass",
      label: "No IGU",
      explanation: "No IGU type selected — glass pricing uses the default rate.",
      paneCount: effectivePaneCount,
      resolvedCount: 0,
      unresolvedCount: 0,
    };
  }

  const specs = (paneGlassSpecs || []).filter(
    (s) => s.paneIndex < effectivePaneCount && (s.iguType || s.glassType || s.glassThickness)
  );

  if (specs.length === 0) {
    return {
      type: "default",
      label: "Default",
      explanation: "No pane-level glass overrides — pricing uses the default glass rate.",
      paneCount: effectivePaneCount,
      resolvedCount: 0,
      unresolvedCount: 0,
    };
  }

  const results = specs.map((s) => validatePaneSpec(s));
  const resolvedCount = results.filter((r) => r.isValid && r.priceResolved).length;
  const unresolvedCount = results.filter((r) => !r.isValid).length;

  if (resolvedCount === specs.length) {
    return {
      type: "pane-aware",
      label: "Pane-Aware",
      explanation: `All ${resolvedCount} pane override(s) resolved — pane-aware pricing is active.`,
      paneCount: effectivePaneCount,
      resolvedCount,
      unresolvedCount: 0,
    };
  }

  if (resolvedCount === 0) {
    return {
      type: "full-fallback",
      label: "Full Fallback",
      explanation: `All ${specs.length} pane override(s) failed to resolve — using default glass pricing as fallback.`,
      paneCount: effectivePaneCount,
      resolvedCount: 0,
      unresolvedCount: specs.length,
    };
  }

  return {
    type: "partial-fallback",
    label: "Partial Fallback",
    explanation: `${resolvedCount} of ${specs.length} pane(s) resolved with pane-aware pricing, ${unresolvedCount} pane(s) use default glass pricing as fallback.`,
    paneCount: effectivePaneCount,
    resolvedCount,
    unresolvedCount,
  };
}

export interface BatchIntegrityItem {
  itemId: string;
  itemName: string;
  jobId: string;
  jobName: string;
  category: string;
  heightFromFloor: number | null;
  paneCount: number;
  resolutionState: PaneResolutionStatus;
  pricingSource: ItemPricingSource;
  invalidPaneCount: number;
  totalOverrides: number;
  paneDetails: Array<{
    paneIndex: number;
    isValid: boolean;
    iguType: string;
    glassType: string;
    thickness: string;
    issues: string[];
  }>;
}

export function classifyBatchItem(
  itemId: string,
  itemName: string,
  jobId: string,
  jobName: string,
  category: string,
  heightFromFloor: number | null,
  paneGlassSpecs: PaneGlassSpec[] | null | undefined,
  effectivePaneCount: number,
  hasGlassIguType: boolean
): BatchIntegrityItem | null {
  const specs = (paneGlassSpecs || []).filter(
    (s) => (s.iguType || s.glassType || s.glassThickness)
  );
  if (specs.length === 0) return null;

  const results = specs.map((s) => validatePaneSpec(s));
  const resolutionState = classifyPaneResolutionState(specs, effectivePaneCount);
  const pricingSource = getItemPricingSource(specs, effectivePaneCount, hasGlassIguType);

  return {
    itemId,
    itemName,
    jobId,
    jobName,
    category,
    heightFromFloor,
    paneCount: effectivePaneCount,
    resolutionState,
    pricingSource,
    invalidPaneCount: results.filter((r) => !r.isValid).length,
    totalOverrides: specs.length,
    paneDetails: results.map((r, i) => ({
      paneIndex: specs[i].paneIndex,
      isValid: r.isValid,
      iguType: specs[i].iguType || "",
      glassType: specs[i].glassType || "",
      thickness: specs[i].glassThickness || "",
      issues: r.issues,
    })),
  };
}
