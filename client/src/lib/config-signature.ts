import type { QuoteItem, CustomColumn, EntranceDoorRow } from "@shared/schema";
import type { FrameConfiguration } from "@shared/schema";

export interface GroupedGeometryMetrics {
  outerFramePerimeterMm: number;
  paneCount: number;
  mullionCount: number;
  mullionTotalLengthMm: number;
  transomCount: number;
  transomTotalLengthMm: number;
  jointEndCount: number;
  cutCycleCount: number;
  gluePointCount: number;
  memberCount: number;
  perPaneDimensions: { widthMm: number; heightMm: number }[];
  totalGlassAreaSqm: number;
  avgPaneAreaSqm: number;
  hasUnequalHeights: boolean;
  geometryClass: string;
}

export interface ConfigSignature {
  signature: string;
  label: string;
  awningCount: number;
  fixedCount: number;
  slidingCount: number;
  hingeCount: number;
  mullionCount: number;
  transomCount: number;
  geometryClass: string;
}

function countPanelTypes(columns: CustomColumn[]): { awning: number; fixed: number; sliding: number; hinge: number } {
  let awning = 0, fixed = 0, sliding = 0, hinge = 0;
  for (const col of columns) {
    for (const row of col.rows) {
      switch (row.type) {
        case "awning": awning++; break;
        case "fixed": fixed++; break;
        case "sliding": sliding++; break;
        case "hinge": hinge++; break;
      }
    }
  }
  return { awning, fixed, sliding, hinge };
}

function countStackerRowTypes(panelRows: EntranceDoorRow[][]): { awning: number; fixed: number; sliding: number } {
  let awning = 0, fixed = 0, sliding = 0;
  for (const panel of panelRows) {
    for (const row of panel) {
      if (row.type === "awning") awning++;
      else if (row.type === "sliding") sliding++;
      else fixed++;
    }
  }
  return { awning, fixed, sliding };
}

function countTransoms(columns: CustomColumn[]): number {
  let transoms = 0;
  for (const col of columns) {
    if (col.rows.length > 1) {
      transoms += col.rows.length - 1;
    }
  }
  return transoms;
}

function buildLabel(
  counts: { awning: number; fixed: number; sliding: number; hinge: number },
  mullionCount?: number,
  transomCount?: number
): string {
  const parts: string[] = [];
  if (counts.awning > 0) parts.push(`${counts.awning} Awning`);
  if (counts.fixed > 0) parts.push(`${counts.fixed} Fixed`);
  if (counts.sliding > 0) parts.push(`${counts.sliding} Sliding`);
  if (counts.hinge > 0) parts.push(`${counts.hinge} Hinge`);
  let label = parts.join(" + ") || "Fixed";

  const extras: string[] = [];
  if (mullionCount && mullionCount > 0) extras.push(`${mullionCount} Mullion`);
  if (transomCount && transomCount > 0) extras.push(`${transomCount} Transom`);
  if (extras.length > 0) label += ", " + extras.join(", ");

  return label;
}

function extractPanelPart(label: string): string {
  const commaIdx = label.indexOf(",");
  return commaIdx >= 0 ? label.substring(0, commaIdx).trim() : label.trim();
}

function stripGeometryTag(label: string): string {
  return label.replace(/\s*\[G:[^\]]*\]$/, "").trim();
}

function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function deriveGroupedGeometryMetrics(
  widthMm: number,
  heightMm: number,
  customColumns: CustomColumn[]
): GroupedGeometryMetrics {
  const W = widthMm;
  const H = heightMm;
  const totalCols = customColumns.length;

  const widthSpecs = customColumns.map(c => c.width || 0);
  const specifiedWidthSum = widthSpecs.reduce((s, v) => s + v, 0);
  const autoWidthCount = widthSpecs.filter(v => v <= 0).length;

  let colWidthsMm: number[];
  if (specifiedWidthSum <= 0) {
    colWidthsMm = widthSpecs.map(() => Math.round(W / totalCols));
  } else {
    const cappedSum = Math.min(specifiedWidthSum, W);
    const remaining = W - cappedSum;
    const autoSize = autoWidthCount > 0 ? remaining / autoWidthCount : 0;
    colWidthsMm = widthSpecs.map(v => v <= 0 ? Math.round(autoSize) : Math.round((v / specifiedWidthSum) * cappedSum));
  }

  const colHeightsMm: number[] = customColumns.map(c =>
    (c.heightOverride && c.heightOverride > 0) ? Math.min(c.heightOverride, H) : H
  );

  const hasUnequalHeights = colHeightsMm.some(h => h !== colHeightsMm[0]);

  const outerFramePerimeterMm = 2 * (W + H);

  const mullionCount = Math.max(0, totalCols - 1);
  const mullionTotalLengthMm = mullionCount > 0
    ? Array.from({ length: mullionCount }, (_, i) => Math.max(colHeightsMm[i], colHeightsMm[i + 1])).reduce((s, v) => s + v, 0)
    : 0;

  let transomCount = 0;
  let transomTotalLengthMm = 0;
  const perPaneDimensions: { widthMm: number; heightMm: number }[] = [];

  for (let ci = 0; ci < totalCols; ci++) {
    const col = customColumns[ci];
    const colW = colWidthsMm[ci];
    const colH = colHeightsMm[ci];
    const rows = col.rows || [{ height: 0, type: "fixed" as const }];
    const rowCount = rows.length;

    if (rowCount > 1) {
      const transoms = rowCount - 1;
      transomCount += transoms;
      transomTotalLengthMm += colW * transoms;
    }

    const rowHeightSpecs = rows.map(r => r.height || 0);
    const specSum = rowHeightSpecs.reduce((s, v) => s + v, 0);
    const autoRowCount = rowHeightSpecs.filter(v => v <= 0).length;
    let rowHeights: number[];
    if (specSum <= 0) {
      rowHeights = rowHeightSpecs.map(() => Math.round(colH / rowCount));
    } else {
      const cappedSum = Math.min(specSum, colH);
      const remaining = colH - cappedSum;
      const autoH = autoRowCount > 0 ? remaining / autoRowCount : 0;
      rowHeights = rowHeightSpecs.map(v => v <= 0 ? Math.round(autoH) : Math.round((v / specSum) * cappedSum));
    }

    for (const rh of rowHeights) {
      perPaneDimensions.push({ widthMm: colW, heightMm: rh });
    }
  }

  const paneCount = perPaneDimensions.length;
  const totalGlassAreaSqm = perPaneDimensions.reduce((s, p) => s + (p.widthMm * p.heightMm) / 1_000_000, 0);
  const avgPaneAreaSqm = paneCount > 0 ? totalGlassAreaSqm / paneCount : 0;

  const memberCount = 4 + mullionCount + transomCount;
  const jointEndCount = mullionCount * 2 + transomCount * 2;
  const cutCycleCount = memberCount;
  const gluePointCount = 4 + jointEndCount;

  const heightsNormalized = colHeightsMm.map(h => roundToNearest(h, 10));
  const geometryClass = hasUnequalHeights
    ? `h:${heightsNormalized.join("-")}`
    : "uniform";

  return {
    outerFramePerimeterMm,
    paneCount,
    mullionCount,
    mullionTotalLengthMm,
    transomCount,
    transomTotalLengthMm,
    jointEndCount,
    cutCycleCount,
    gluePointCount,
    memberCount,
    perPaneDimensions,
    totalGlassAreaSqm,
    avgPaneAreaSqm,
    hasUnequalHeights,
    geometryClass,
  };
}

export function deriveConfigSignature(item: QuoteItem): ConfigSignature {
  const cat = item.category;

  if (cat === "windows-standard" || cat === "bay-window") {
    if (item.layout === "custom" && item.customColumns && item.customColumns.length > 0) {
      const counts = countPanelTypes(item.customColumns);
      const totalCols = item.customColumns.length;
      const mullionCount = Math.max(0, totalCols - 1);
      const transomCount = countTransoms(item.customColumns);

      const geoMetrics = deriveGroupedGeometryMetrics(
        item.width || 0, item.height || 0, item.customColumns
      );
      const geometryClass = geoMetrics.geometryClass;

      let label = buildLabel(counts, mullionCount, transomCount);
      if (geometryClass !== "uniform") {
        label += ` [G:${geometryClass}]`;
      }

      return {
        signature: `window:${label}`,
        label,
        awningCount: counts.awning,
        fixedCount: counts.fixed,
        slidingCount: counts.sliding,
        hingeCount: counts.hinge,
        mullionCount,
        transomCount,
        geometryClass,
      };
    }
    const wt = item.windowType || "fixed";
    let label: string;
    let awningCount = 0, fixedCount = 0, hingeCount = 0, mullionCount = 0;
    if (wt === "awning") {
      label = "Awning";
      awningCount = 1;
    } else if (wt === "french-left") {
      label = "French Left";
      hingeCount = 1;
    } else if (wt === "french-right") {
      label = "French Right";
      hingeCount = 1;
    } else if (wt === "french-pair") {
      label = "French Pair";
      hingeCount = 2;
      mullionCount = 1;
    } else {
      label = "Fixed";
      fixedCount = 1;
    }
    return {
      signature: `window:${label}`,
      label,
      awningCount,
      fixedCount,
      slidingCount: 0,
      hingeCount,
      mullionCount,
      transomCount: 0,
      geometryClass: "uniform",
    };
  }

  if (cat === "stacker-door") {
    const panels = item.panels || 2;
    const mullionCount = Math.max(0, panels - 1);
    const panelRows = item.panelRows || [];
    if (panelRows.length > 0) {
      const { awning, fixed, sliding } = countStackerRowTypes(panelRows);
      const label = buildLabel({ awning, fixed, sliding, hinge: 0 }, mullionCount, 0);
      return {
        signature: `stacker:${label}`,
        label,
        awningCount: awning,
        fixedCount: fixed,
        slidingCount: sliding,
        hingeCount: 0,
        mullionCount,
        transomCount: 0,
        geometryClass: "uniform",
      };
    }
    const fixedCount = Math.ceil(panels / 2);
    const slidingCount = panels - fixedCount;
    const label = buildLabel({ awning: 0, fixed: fixedCount, sliding: slidingCount, hinge: 0 }, mullionCount, 0);
    return {
      signature: `stacker:${label}`,
      label,
      awningCount: 0,
      fixedCount,
      slidingCount,
      hingeCount: 0,
      mullionCount,
      transomCount: 0,
      geometryClass: "uniform",
    };
  }

  if (cat === "sliding-window" || cat === "sliding-door") {
    if (item.layout === "custom" && item.customColumns && item.customColumns.length > 0) {
      const counts = countPanelTypes(item.customColumns);
      const totalCols = item.customColumns.length;
      const mullionCount = Math.max(0, totalCols - 1);
      const transomCount = countTransoms(item.customColumns);

      const geoMetrics = deriveGroupedGeometryMetrics(
        item.width || 0, item.height || 0, item.customColumns
      );
      const geometryClass = geoMetrics.geometryClass;

      let label = buildLabel(counts, mullionCount, transomCount);
      if (geometryClass !== "uniform") {
        label += ` [G:${geometryClass}]`;
      }

      return {
        signature: `sliding:${label}`,
        label,
        awningCount: counts.awning,
        fixedCount: counts.fixed,
        slidingCount: counts.sliding,
        hingeCount: counts.hinge,
        mullionCount,
        transomCount,
        geometryClass,
      };
    }
    const panels = item.panels || 2;
    const fixedCount = Math.ceil(panels / 2);
    const slidingCount = panels - fixedCount;
    const mullionCount = Math.max(0, panels - 1);
    const label = buildLabel({ awning: 0, fixed: fixedCount, sliding: slidingCount, hinge: 0 }, mullionCount, 0);
    return {
      signature: `sliding:${label}`,
      label,
      awningCount: 0,
      fixedCount,
      slidingCount,
      hingeCount: 0,
      mullionCount,
      transomCount: 0,
      geometryClass: "uniform",
    };
  }

  if (cat === "entrance-door") {
    const hasSidelight = item.sidelightEnabled;
    const label = hasSidelight ? "Door + Sidelight" : "Standard";
    return {
      signature: `entrance:${label}`,
      label,
      awningCount: 0,
      fixedCount: hasSidelight ? 1 : 0,
      slidingCount: 0,
      hingeCount: 1,
      mullionCount: hasSidelight ? 1 : 0,
      transomCount: 0,
      geometryClass: "uniform",
    };
  }

  if (cat === "hinge-door") {
    return {
      signature: "hinge:Standard",
      label: "Standard",
      awningCount: 0,
      fixedCount: 0,
      slidingCount: 0,
      hingeCount: 1,
      mullionCount: 0,
      transomCount: 0,
      geometryClass: "uniform",
    };
  }

  if (cat === "french-door") {
    return {
      signature: "french:Standard",
      label: "Standard",
      awningCount: 0,
      fixedCount: 0,
      slidingCount: 0,
      hingeCount: 2,
      mullionCount: 1,
      transomCount: 0,
      geometryClass: "uniform",
    };
  }

  if (cat === "bifold-door") {
    const panels = item.panels || 3;
    const label = `${panels}-Panel Bifold`;
    return {
      signature: `bifold:${panels}`,
      label,
      awningCount: 0,
      fixedCount: 0,
      slidingCount: 0,
      hingeCount: panels,
      mullionCount: Math.max(0, panels - 1),
      transomCount: 0,
      geometryClass: "uniform",
    };
  }

  return {
    signature: `unknown:${cat}`,
    label: "Standard",
    awningCount: 0,
    fixedCount: 0,
    slidingCount: 0,
    hingeCount: 0,
    mullionCount: 0,
    transomCount: 0,
    geometryClass: "uniform",
  };
}

export function findMatchingConfiguration(
  sig: ConfigSignature,
  configurations: FrameConfiguration[]
): FrameConfiguration | null {
  if (configurations.length === 0) return null;

  const sigLower = sig.label.toLowerCase();
  const sigPanelPart = extractPanelPart(sig.label).toLowerCase();
  const sigBaseLabel = stripGeometryTag(sig.label).toLowerCase();
  const sigBasePanelPart = extractPanelPart(stripGeometryTag(sig.label)).toLowerCase();

  for (const c of configurations) {
    const nameLower = c.name.toLowerCase();
    if (nameLower === sigLower) return c;
  }

  if (sig.geometryClass !== "uniform") {
    for (const c of configurations) {
      const nameLower = c.name.toLowerCase();
      if (nameLower.includes("[g:") && nameLower === sigLower) return c;
    }
  }

  for (const c of configurations) {
    const nameLower = c.name.toLowerCase();
    const namePanelPart = extractPanelPart(c.name).toLowerCase();
    const nameBaseLabel = stripGeometryTag(c.name).toLowerCase();
    const nameBasePanelPart = extractPanelPart(stripGeometryTag(c.name)).toLowerCase();

    if (nameBasePanelPart === sigBasePanelPart && sigBasePanelPart !== sigBaseLabel) {
      if (sig.geometryClass === "uniform" && !nameLower.includes("[g:")) return c;
    }
  }

  for (const c of configurations) {
    const nameLower = stripGeometryTag(c.name).toLowerCase();
    if (sigBasePanelPart === "awning" && nameLower.includes("awning") && !nameLower.includes("+")) return c;
    if (sigBasePanelPart === "fixed" && nameLower.includes("fixed") && !nameLower.includes("+")) return c;
    if (sigBasePanelPart === "standard" && nameLower.includes("standard")) return c;
    if ((sigBasePanelPart === "french left" || sigBasePanelPart === "french right") && nameLower.includes("hinge") && !nameLower.includes("+")) return c;
    if (sigBasePanelPart === "french pair" && (nameLower.includes("french") || (nameLower.includes("hinge") && nameLower.includes("2")))) return c;
  }

  const awningPatterns: Record<string, RegExp> = {
    "1 awning + 1 fixed": /1\s*a\w*\s*\+?\s*1\s*f/i,
    "2 awning + 1 fixed": /2\s*a\w*\s*\+?\s*1\s*f/i,
    "1 awning + 2 fixed": /1\s*a\w*\s*\+?\s*2\s*f/i,
    "2 awning + 2 fixed": /2\s*a\w*\s*\+?\s*2\s*f/i,
    "2 awning + 3 fixed": /2\s*a\w*\s*\+?\s*3\s*f/i,
    "3 awning + 2 fixed": /3\s*a\w*\s*\+?\s*2\s*f/i,
    "3 awning + 3 fixed": /3\s*a\w*\s*\+?\s*3\s*f/i,
    "1 awning + 3 fixed": /1\s*a\w*\s*\+?\s*3\s*f/i,
    "3 awning + 1 fixed": /3\s*a\w*\s*\+?\s*1\s*f/i,
  };

  for (const c of configurations) {
    const namePanelPart = extractPanelPart(stripGeometryTag(c.name)).toLowerCase();
    for (const [patLabel, regex] of Object.entries(awningPatterns)) {
      if (sigBasePanelPart === patLabel && regex.test(namePanelPart)) return c;
    }
  }

  return null;
}
