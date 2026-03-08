export interface TemplateSectionDef {
  key: string;
  visible: boolean;
}

export interface TemplateTypography {
  tradingNameSize: "lg" | "xl" | "2xl";
  legalLineSize: "xs" | "sm";
  sectionHeadingSize: "xs" | "sm";
  bodyTextSize: "sm" | "base";
  specLabelSize: "xs";
  specValueSize: "sm";
  itemTitleSize: "sm" | "base";
  totalsLabelSize: "sm";
  totalsBoldSize: "base" | "lg";
}

export interface TemplateSpacing {
  sectionGapMm: number;
  itemGapMm: number;
  innerPaddingMm: number;
}

export interface TemplateItemLayout {
  drawingPosition: "left";
  specsPosition: "right";
  drawingMaxWidthPercent: number;
  photosPosition: "below";
  photoMaxSizeMm: number;
}

export interface TemplateAcceptanceBlock {
  visible: boolean;
  fields: string[];
}

export interface TemplateColors {
  headingMuted: string;
  bodyText: string;
  border: string;
  bgMuted: string;
  accent: string;
}

export interface QuoteTemplate {
  id: string;
  name: string;
  sections: TemplateSectionDef[];
  typography: TemplateTypography;
  spacing: TemplateSpacing;
  itemLayout: TemplateItemLayout;
  acceptance: TemplateAcceptanceBlock;
  colors: TemplateColors;
}

export const COMPANY_MASTER_TEMPLATE: QuoteTemplate = {
  id: "company_master_v1",
  name: "Lateral Enterprises — Master Quote Template",
  sections: [
    { key: "header", visible: true },
    { key: "disclaimer", visible: true },
    { key: "customerProject", visible: true },
    { key: "totals", visible: true },
    { key: "legal", visible: true },
    { key: "schedule", visible: true },
    { key: "acceptance", visible: true },
  ],
  typography: {
    tradingNameSize: "2xl",
    legalLineSize: "sm",
    sectionHeadingSize: "xs",
    bodyTextSize: "sm",
    specLabelSize: "xs",
    specValueSize: "sm",
    itemTitleSize: "base",
    totalsLabelSize: "sm",
    totalsBoldSize: "lg",
  },
  spacing: {
    sectionGapMm: 6,
    itemGapMm: 4,
    innerPaddingMm: 4,
  },
  itemLayout: {
    drawingPosition: "left",
    specsPosition: "right",
    drawingMaxWidthPercent: 50,
    photosPosition: "below",
    photoMaxSizeMm: 30,
  },
  acceptance: {
    visible: true,
    fields: ["Signature", "Name", "Date"],
  },
  colors: {
    headingMuted: "#6b7280",
    bodyText: "#1a1a1a",
    border: "#d1d5db",
    bgMuted: "#f3f4f6",
    accent: "#374151",
  },
};

export const SYSTEM_TEMPLATE = COMPANY_MASTER_TEMPLATE;

export interface DivisionOverrides {
  accentColor?: string | null;
  scheduleLayoutVariant?: string;
  totalsLayoutVariant?: string;
}

export function resolveQuoteTemplate(
  overrides?: DivisionOverrides | null,
): QuoteTemplate {
  if (!overrides) return COMPANY_MASTER_TEMPLATE;

  const resolved = { ...COMPANY_MASTER_TEMPLATE };

  if (overrides.accentColor) {
    resolved.colors = {
      ...COMPANY_MASTER_TEMPLATE.colors,
      accent: overrides.accentColor,
    };
  }

  return resolved;
}

export function isSectionVisible(template: QuoteTemplate, key: string): boolean {
  const section = template.sections.find(s => s.key === key);
  return section ? section.visible : true;
}

export function getSectionOrder(template: QuoteTemplate): string[] {
  return template.sections.filter(s => s.visible).map(s => s.key);
}
