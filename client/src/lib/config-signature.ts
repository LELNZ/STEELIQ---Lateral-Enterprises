import type { QuoteItem, CustomColumn } from "@shared/schema";
import type { FrameConfiguration } from "@shared/schema";

export interface ConfigSignature {
  signature: string;
  label: string;
  awningCount: number;
  fixedCount: number;
  slidingCount: number;
  hingeCount: number;
  mullionCount: number;
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

function buildLabel(counts: { awning: number; fixed: number; sliding: number; hinge: number }): string {
  const parts: string[] = [];
  if (counts.awning > 0) parts.push(`${counts.awning} Awning`);
  if (counts.fixed > 0) parts.push(`${counts.fixed} Fixed`);
  if (counts.sliding > 0) parts.push(`${counts.sliding} Sliding`);
  if (counts.hinge > 0) parts.push(`${counts.hinge} Hinge`);
  return parts.join(" + ") || "Fixed";
}

export function deriveConfigSignature(item: QuoteItem): ConfigSignature {
  const cat = item.category;

  if (cat === "windows-standard" || cat === "bay-window") {
    if (item.layout === "custom" && item.customColumns && item.customColumns.length > 0) {
      const counts = countPanelTypes(item.customColumns);
      const totalCols = item.customColumns.length;
      const mullionCount = Math.max(0, totalCols - 1);
      const label = buildLabel(counts);
      return {
        signature: `window:${label}`,
        label,
        awningCount: counts.awning,
        fixedCount: counts.fixed,
        slidingCount: counts.sliding,
        hingeCount: counts.hinge,
        mullionCount,
      };
    }
    const wt = item.windowType || "fixed";
    const label = wt === "awning" ? "Awning" : "Fixed";
    return {
      signature: `window:${label}`,
      label,
      awningCount: wt === "awning" ? 1 : 0,
      fixedCount: wt === "fixed" ? 1 : 0,
      slidingCount: 0,
      hingeCount: 0,
      mullionCount: 0,
    };
  }

  if (cat === "sliding-window" || cat === "sliding-door" || cat === "stacker-door") {
    if (item.layout === "custom" && item.customColumns && item.customColumns.length > 0) {
      const counts = countPanelTypes(item.customColumns);
      const totalCols = item.customColumns.length;
      const mullionCount = Math.max(0, totalCols - 1);
      const label = buildLabel(counts);
      return {
        signature: `sliding:${label}`,
        label,
        ...counts,
        mullionCount,
      };
    }
    const panels = item.panels || 2;
    const fixedCount = Math.ceil(panels / 2);
    const slidingCount = panels - fixedCount;
    const label = buildLabel({ awning: 0, fixed: fixedCount, sliding: slidingCount, hinge: 0 });
    return {
      signature: `sliding:${label}`,
      label,
      awningCount: 0,
      fixedCount,
      slidingCount,
      hingeCount: 0,
      mullionCount: Math.max(0, panels - 1),
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
  };
}

export function findMatchingConfiguration(
  sig: ConfigSignature,
  configurations: FrameConfiguration[]
): FrameConfiguration | null {
  if (configurations.length === 0) return null;

  const sigLower = sig.label.toLowerCase();

  for (const c of configurations) {
    const nameLower = c.name.toLowerCase();
    if (nameLower === sigLower) return c;
  }

  for (const c of configurations) {
    const nameLower = c.name.toLowerCase();
    if (sigLower === "awning" && nameLower.includes("awning") && !nameLower.includes("+")) return c;
    if (sigLower === "fixed" && nameLower.includes("fixed") && !nameLower.includes("+")) return c;
    if (sigLower === "standard" && nameLower.includes("standard")) return c;
  }

  const awningPatterns: Record<string, RegExp> = {
    "1 Awning + 1 Fixed": /1\s*a\w*\s*\+?\s*1\s*f/i,
    "2 Awning + 1 Fixed": /2\s*a\w*\s*\+?\s*1\s*f/i,
    "1 Awning + 2 Fixed": /1\s*a\w*\s*\+?\s*2\s*f/i,
    "2 Awning + 2 Fixed": /2\s*a\w*\s*\+?\s*2\s*f/i,
  };

  for (const c of configurations) {
    for (const [patLabel, regex] of Object.entries(awningPatterns)) {
      if (sigLower === patLabel.toLowerCase() && regex.test(c.name)) return c;
    }
  }

  for (const c of configurations) {
    const nameLower = c.name.toLowerCase();
    if (sigLower.includes("awning") && nameLower.includes("awning")) return c;
    if (sigLower.includes("sliding") && nameLower.includes("sliding")) return c;
    if (sigLower.includes("hinge") && nameLower.includes("hinge")) return c;
  }

  return null;
}
