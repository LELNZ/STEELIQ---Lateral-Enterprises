import type { QuoteItem, CustomColumn, EntranceDoorRow } from "@shared/schema";
import type { FrameConfiguration } from "@shared/schema";

export interface ConfigSignature {
  signature: string;
  label: string;
  awningCount: number;
  fixedCount: number;
  slidingCount: number;
  hingeCount: number;
  mullionCount: number;
  transomCount: number;
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

export function deriveConfigSignature(item: QuoteItem): ConfigSignature {
  const cat = item.category;

  if (cat === "windows-standard" || cat === "bay-window") {
    if (item.layout === "custom" && item.customColumns && item.customColumns.length > 0) {
      const counts = countPanelTypes(item.customColumns);
      const totalCols = item.customColumns.length;
      const mullionCount = Math.max(0, totalCols - 1);
      const transomCount = countTransoms(item.customColumns);
      const label = buildLabel(counts, mullionCount, transomCount);
      return {
        signature: `window:${label}`,
        label,
        awningCount: counts.awning,
        fixedCount: counts.fixed,
        slidingCount: counts.sliding,
        hingeCount: counts.hinge,
        mullionCount,
        transomCount,
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
    };
  }

  if (cat === "sliding-window" || cat === "sliding-door") {
    if (item.layout === "custom" && item.customColumns && item.customColumns.length > 0) {
      const counts = countPanelTypes(item.customColumns);
      const totalCols = item.customColumns.length;
      const mullionCount = Math.max(0, totalCols - 1);
      const transomCount = countTransoms(item.customColumns);
      const label = buildLabel(counts, mullionCount, transomCount);
      return {
        signature: `sliding:${label}`,
        label,
        awningCount: counts.awning,
        fixedCount: counts.fixed,
        slidingCount: counts.sliding,
        hingeCount: counts.hinge,
        mullionCount,
        transomCount,
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
  };
}

export function findMatchingConfiguration(
  sig: ConfigSignature,
  configurations: FrameConfiguration[]
): FrameConfiguration | null {
  if (configurations.length === 0) return null;

  const sigLower = sig.label.toLowerCase();
  const sigPanelPart = extractPanelPart(sig.label).toLowerCase();

  for (const c of configurations) {
    const nameLower = c.name.toLowerCase();
    if (nameLower === sigLower) return c;
  }

  for (const c of configurations) {
    const nameLower = c.name.toLowerCase();
    const namePanelPart = extractPanelPart(c.name).toLowerCase();
    if (namePanelPart === sigPanelPart && sigPanelPart !== sigLower) return c;
  }

  for (const c of configurations) {
    const nameLower = c.name.toLowerCase();
    if (sigPanelPart === "awning" && nameLower.includes("awning") && !nameLower.includes("+")) return c;
    if (sigPanelPart === "fixed" && nameLower.includes("fixed") && !nameLower.includes("+")) return c;
    if (sigPanelPart === "standard" && nameLower.includes("standard")) return c;
    if ((sigPanelPart === "french left" || sigPanelPart === "french right") && nameLower.includes("hinge") && !nameLower.includes("+")) return c;
    if (sigPanelPart === "french pair" && (nameLower.includes("french") || (nameLower.includes("hinge") && nameLower.includes("2")))) return c;
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
    const namePanelPart = extractPanelPart(c.name).toLowerCase();
    for (const [patLabel, regex] of Object.entries(awningPatterns)) {
      if (sigPanelPart === patLabel && regex.test(namePanelPart)) return c;
    }
  }

  return null;
}
