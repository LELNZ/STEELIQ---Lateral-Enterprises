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

export type ScheduleLayoutVariant = "image_left_specs_right_v1" | "specs_only_v1" | "image_top_specs_below_v1";
export type TotalsLayoutVariant = "totals_block_v1" | "totals_inline_v1";

export interface TemplateItemLayout {
  drawingPosition: "left";
  specsPosition: "right";
  drawingMaxWidthPercent: number;
  photosPosition: "below";
  photoMaxSizeMm: number;
  scheduleLayoutVariant: ScheduleLayoutVariant;
  totalsLayoutVariant: TotalsLayoutVariant;
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
    { key: "schedule", visible: true },
    { key: "legal", visible: true },
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
    scheduleLayoutVariant: "image_left_specs_right_v1",
    totalsLayoutVariant: "totals_block_v1",
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

export type SpacingPreset = "compact" | "standard" | "spacious";
export type TypographyPreset = "small" | "standard" | "large";
export type PhotoSizePreset = "small" | "medium" | "large";

export interface CompanyTemplateConfig {
  sections?: TemplateSectionDef[];
  spacingPreset?: SpacingPreset;
  typographyPreset?: TypographyPreset;
  photoSizePreset?: PhotoSizePreset;
  accentColor?: string;
  scheduleLayoutVariant?: ScheduleLayoutVariant;
  totalsLayoutVariant?: TotalsLayoutVariant;
}

const SPACING_PRESETS: Record<SpacingPreset, TemplateSpacing> = {
  compact: { sectionGapMm: 4, itemGapMm: 2, innerPaddingMm: 3 },
  standard: { sectionGapMm: 6, itemGapMm: 4, innerPaddingMm: 4 },
  spacious: { sectionGapMm: 10, itemGapMm: 6, innerPaddingMm: 6 },
};

const TYPOGRAPHY_PRESETS: Record<TypographyPreset, Partial<TemplateTypography>> = {
  small: { tradingNameSize: "lg", bodyTextSize: "sm", itemTitleSize: "sm", totalsBoldSize: "base" },
  standard: {},
  large: { tradingNameSize: "2xl", bodyTextSize: "base", itemTitleSize: "base", totalsBoldSize: "lg" },
};

const PHOTO_SIZE_PRESETS: Record<PhotoSizePreset, number> = {
  small: 20,
  medium: 30,
  large: 45,
};

export function applyCompanyConfig(config: CompanyTemplateConfig): QuoteTemplate {
  const base = { ...COMPANY_MASTER_TEMPLATE };

  if (config.sections && config.sections.length > 0) {
    base.sections = config.sections;
  }

  if (config.spacingPreset && SPACING_PRESETS[config.spacingPreset]) {
    base.spacing = SPACING_PRESETS[config.spacingPreset];
  }

  if (config.typographyPreset && TYPOGRAPHY_PRESETS[config.typographyPreset]) {
    base.typography = { ...COMPANY_MASTER_TEMPLATE.typography, ...TYPOGRAPHY_PRESETS[config.typographyPreset] };
  }

  if (config.photoSizePreset && PHOTO_SIZE_PRESETS[config.photoSizePreset]) {
    base.itemLayout = { ...base.itemLayout, photoMaxSizeMm: PHOTO_SIZE_PRESETS[config.photoSizePreset] };
  }

  if (config.accentColor) {
    base.colors = { ...COMPANY_MASTER_TEMPLATE.colors, accent: config.accentColor };
  }

  if (config.scheduleLayoutVariant) {
    base.itemLayout = { ...base.itemLayout, scheduleLayoutVariant: config.scheduleLayoutVariant };
  }

  if (config.totalsLayoutVariant) {
    base.itemLayout = { ...base.itemLayout, totalsLayoutVariant: config.totalsLayoutVariant };
  }

  return base;
}

export interface DivisionOverrides {
  accentColor?: string | null;
  scheduleLayoutVariant?: string;
  totalsLayoutVariant?: string;
}

export function resolveQuoteTemplate(
  overrides?: DivisionOverrides | null,
  companyConfig?: CompanyTemplateConfig | null,
): QuoteTemplate {
  const base = companyConfig ? applyCompanyConfig(companyConfig) : { ...COMPANY_MASTER_TEMPLATE };

  if (!overrides) return base;

  const resolved = { ...base };

  if (overrides.accentColor) {
    resolved.colors = { ...resolved.colors, accent: overrides.accentColor };
  }

  const slv = overrides.scheduleLayoutVariant as ScheduleLayoutVariant | undefined;
  const tlv = overrides.totalsLayoutVariant as TotalsLayoutVariant | undefined;
  if (slv || tlv) {
    resolved.itemLayout = {
      ...resolved.itemLayout,
      ...(slv ? { scheduleLayoutVariant: slv } : {}),
      ...(tlv ? { totalsLayoutVariant: tlv } : {}),
    };
  }

  return resolved;
}

export function getSpacingPresetFromConfig(config?: CompanyTemplateConfig | null): SpacingPreset {
  return config?.spacingPreset || "standard";
}

export function getTypographyPresetFromConfig(config?: CompanyTemplateConfig | null): TypographyPreset {
  return config?.typographyPreset || "standard";
}

export function getPhotoSizePresetFromConfig(config?: CompanyTemplateConfig | null): PhotoSizePreset {
  return config?.photoSizePreset || "medium";
}

export function isSectionVisible(template: QuoteTemplate, key: string): boolean {
  const section = template.sections.find(s => s.key === key);
  return section ? section.visible : true;
}

export function getSectionOrder(template: QuoteTemplate): string[] {
  return template.sections.filter(s => s.visible).map(s => s.key);
}
