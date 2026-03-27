import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import DrawingCanvas from "@/components/drawing-canvas";
import type { InsertQuoteItem } from "@shared/schema";

const CANONICAL_DRAWING_FIELDS = [
  "customColumns",
  "entranceDoorRows",
  "entranceSidelightRows",
  "entranceSidelightLeftRows",
  "hingeDoorRows",
  "frenchDoorLeftRows",
  "frenchDoorRightRows",
  "panelRows",
] as const;

const COMPLEX_CATEGORIES = [
  "entrance-door",
  "hinge-door",
  "french-door",
  "bifold-door",
  "stacker-door",
];

export type DrawingClassification = "exact" | "approximate" | "basic";

export function classifySnapshotDrawingSupport(
  item: { category?: string; specValues?: Record<string, any> }
): DrawingClassification {
  const sv = item.specValues || {};
  const cat = item.category || sv.itemCategory || "windows-standard";

  const needsCustomColumns = sv.layout === "custom" && !COMPLEX_CATEGORIES.includes(cat);
  if (needsCustomColumns) {
    const cols = sv.customColumns;
    if (!Array.isArray(cols) || cols.length === 0) return "approximate";
    return "exact";
  }

  if (COMPLEX_CATEGORIES.includes(cat)) {
    const fieldMap: Record<string, string[]> = {
      "entrance-door": ["entranceDoorRows"],
      "hinge-door": ["hingeDoorRows"],
      "french-door": ["frenchDoorLeftRows", "frenchDoorRightRows"],
      "bifold-door": ["panelRows"],
      "stacker-door": ["panelRows"],
    };
    const required = fieldMap[cat] || [];
    for (const field of required) {
      const val = sv[field];
      if (!Array.isArray(val) || val.length === 0) return "approximate";
      const hasData = val.some((r: any) =>
        typeof r === "object" && r !== null && (r.height > 0 || r.type)
      );
      if (!hasData) return "approximate";
    }
    return "exact";
  }

  return "exact";
}

export function snapshotItemToDrawingConfig(
  item: { category?: string; width?: number; height?: number; rakedLeftHeight?: number; rakedRightHeight?: number; bayAngle?: number; bayDepth?: number; openingDirection?: string; specValues?: Record<string, any>; itemRef?: string; quantity?: number; gosRequired?: boolean; gosChargeNzd?: number; catDoorEnabled?: boolean }
): InsertQuoteItem {
  const sv = item.specValues || {};
  return {
    name: item.itemRef || sv.itemRef || "",
    width: item.width || sv.width || 600,
    height: item.height || sv.height || 600,
    quantity: item.quantity || sv.quantity || 1,
    category: (item.category || sv.itemCategory || "windows-standard") as any,
    layout: (sv.layout || "standard") as any,
    windowType: (sv.windowType || "fixed") as any,
    hingeSide: (sv.hingeSide || "left") as any,
    openDirection: (sv.openDirection || "out") as any,
    openingDirection: (item.openingDirection || "none") as any,
    panels: Number(sv.panels) || 3,
    halfSolid: Boolean(sv.halfSolid),
    rakedLeftHeight: item.rakedLeftHeight || 0,
    rakedRightHeight: item.rakedRightHeight || 0,
    rakedSplitEnabled: Boolean(sv.rakedSplitEnabled),
    rakedSplitPosition: Number(sv.rakedSplitPosition) || 0,
    sidelightEnabled: sv.sidelightEnabled ?? true,
    sidelightSide: (sv.sidelightSide || "right") as any,
    sidelightWidth: Number(sv.sidelightWidth) || 400,
    bayAngle: Number(item.bayAngle || sv.bayAngle) || 135,
    bayDepth: Number(item.bayDepth || sv.bayDepth) || 0,
    bifoldLeftCount: Number(sv.bifoldLeftCount) || 0,
    centerWidth: Number(sv.centerWidth) || 0,
    doorSplit: Boolean(sv.doorSplit),
    doorSplitHeight: Number(sv.doorSplitHeight) || 0,
    customColumns: Array.isArray(sv.customColumns) ? sv.customColumns : [],
    entranceDoorRows: Array.isArray(sv.entranceDoorRows) ? sv.entranceDoorRows : [{ height: 0, type: "fixed" as const, slideDirection: "right" as const }],
    entranceSidelightRows: Array.isArray(sv.entranceSidelightRows) ? sv.entranceSidelightRows : [{ height: 0, type: "fixed" as const, slideDirection: "right" as const }],
    entranceSidelightLeftRows: Array.isArray(sv.entranceSidelightLeftRows) ? sv.entranceSidelightLeftRows : [{ height: 0, type: "fixed" as const, slideDirection: "right" as const }],
    hingeDoorRows: Array.isArray(sv.hingeDoorRows) ? sv.hingeDoorRows : [{ height: 0, type: "fixed" as const, slideDirection: "right" as const }],
    frenchDoorLeftRows: Array.isArray(sv.frenchDoorLeftRows) ? sv.frenchDoorLeftRows : [{ height: 0, type: "fixed" as const, slideDirection: "right" as const }],
    frenchDoorRightRows: Array.isArray(sv.frenchDoorRightRows) ? sv.frenchDoorRightRows : [{ height: 0, type: "fixed" as const, slideDirection: "right" as const }],
    panelRows: Array.isArray(sv.panelRows) ? sv.panelRows : [],
    showLegend: true,
    pricePerSqm: Number(sv.pricePerSqm) || 500,
    overrideMode: "none" as const,
    overrideValue: null,
    frameType: String(sv.frameSeries || ""),
    frameColor: String(sv.frameColor || ""),
    flashingSize: Number(sv.flashingSize) || 0,
    windZone: String(sv.windZone || ""),
    linerType: String(sv.linerType || ""),
    glassIguType: String(sv.iguType || ""),
    glassType: String(sv.glassType || ""),
    glassThickness: String(sv.glassThickness || ""),
    wanzBar: Boolean(sv.wanzBarEnabled),
    wanzBarSource: (sv.wanzBarSource || "") as any,
    wanzBarSize: String(sv.wanzBarSize || ""),
    wallThickness: Number(sv.wallThickness) || 0,
    heightFromFloor: Number(sv.heightFromFloor) || 0,
    handleType: String(sv.handleSet || ""),
    lockType: String(sv.lockSet || ""),
    configurationId: String(sv.configurationId || ""),
    cachedWeightKg: 0,
    fulfilmentSource: "in-house" as const,
    outsourcedCostNzd: null,
    outsourcedSellNzd: null,
    gosRequired: item.gosRequired || false,
    gosChargeNzd: item.gosChargeNzd ?? null,
    catDoorEnabled: item.catDoorEnabled || false,
  };
}

export async function renderDrawingToPng(config: InsertQuoteItem, scale: number = 2): Promise<Buffer> {
  const element = React.createElement(DrawingCanvas, { config });
  let svgMarkup = renderToStaticMarkup(element);

  if (!svgMarkup.includes('xmlns=')) {
    svgMarkup = svgMarkup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  svgMarkup = svgMarkup.replace(
    /class="[^"]*"/g,
    ''
  );

  if (!svgMarkup.includes('<style')) {
    svgMarkup = svgMarkup.replace(
      '</defs>',
      '</defs><style>text { font-family: Arial, Helvetica, sans-serif; }</style>'
    );
  }

  const viewBoxMatch = svgMarkup.match(/viewBox="([^"]+)"/);
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].split(/\s+/).map(Number);
    const vbW = parts[2] || 600;
    const vbH = parts[3] || 600;
    const pxW = Math.round(vbW * scale);
    const pxH = Math.round(vbH * scale);
    svgMarkup = svgMarkup.replace(
      /viewBox="([^"]+)"/,
      `viewBox="${viewBoxMatch[1]}" width="${pxW}" height="${pxH}"`
    );
  }

  const pngBuffer = await sharp(Buffer.from(svgMarkup))
    .png()
    .toBuffer();

  return pngBuffer;
}
