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

export type LogoScale = "small" | "standard" | "large";
export type LegalLinePlacement = "under_logo" | "beside_logo" | "hidden";
export type ContactBlockAlignment = "right" | "stacked_right" | "compact_right";

export interface TemplateHeader {
  logoScale: LogoScale;
  showTradingName: boolean;
  logoWidthMm: number;
  logoMaxHeightMm: number;
  legalLinePlacement: LegalLinePlacement;
  contactBlockAlignment: ContactBlockAlignment;
  headerBottomSpacingMm: number;
}

export type DensityPreset = "comfortable" | "standard" | "compact";

export interface TemplateDensity {
  drawingMaxH: number;
  specRowH: number;
  itemHeaderH: number;
  photoRowH: number;
  itemCardPadMm: number;
  itemGapMm: number;
}

export type DocumentMode = "standard" | "tender";

export interface QuoteTemplate {
  id: string;
  name: string;
  sections: TemplateSectionDef[];
  typography: TemplateTypography;
  spacing: TemplateSpacing;
  itemLayout: TemplateItemLayout;
  acceptance: TemplateAcceptanceBlock;
  colors: TemplateColors;
  header: TemplateHeader;
  density: TemplateDensity;
  documentMode: DocumentMode;
}

export const COMPANY_MASTER_TEMPLATE: QuoteTemplate = {
  id: "company_master_v2",
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
    tradingNameSize: "lg",
    legalLineSize: "xs",
    sectionHeadingSize: "xs",
    bodyTextSize: "sm",
    specLabelSize: "xs",
    specValueSize: "sm",
    itemTitleSize: "sm",
    totalsLabelSize: "sm",
    totalsBoldSize: "base",
  },
  spacing: {
    sectionGapMm: 5,
    itemGapMm: 3,
    innerPaddingMm: 3,
  },
  itemLayout: {
    drawingPosition: "left",
    specsPosition: "right",
    drawingMaxWidthPercent: 50,
    photosPosition: "below",
    photoMaxSizeMm: 25,
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
  header: {
    logoScale: "large",
    showTradingName: false,
    logoWidthMm: 80,
    logoMaxHeightMm: 24,
    legalLinePlacement: "under_logo",
    contactBlockAlignment: "right",
    headerBottomSpacingMm: 4,
  },
  density: {
    drawingMaxH: 38,
    specRowH: 3.5,
    itemHeaderH: 10,
    photoRowH: 20,
    itemCardPadMm: 3,
    itemGapMm: 3,
  },
  documentMode: "standard",
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
  logoScale?: LogoScale;
  showTradingName?: boolean;
  densityPreset?: DensityPreset;
  documentMode?: DocumentMode;
  logoWidthMm?: number;
  logoMaxHeightMm?: number;
  legalLinePlacement?: LegalLinePlacement;
  contactBlockAlignment?: ContactBlockAlignment;
  headerBottomSpacingMm?: number;
  drawingMaxHeightMm?: number;
  photoMaxHeightMm?: number;
  specRowHeightMm?: number;
  itemHeaderHeightMm?: number;
  itemCardPaddingMm?: number;
  itemCardGapMm?: number;
}

const SPACING_PRESETS: Record<SpacingPreset, TemplateSpacing> = {
  compact: { sectionGapMm: 3, itemGapMm: 2, innerPaddingMm: 2 },
  standard: { sectionGapMm: 5, itemGapMm: 3, innerPaddingMm: 3 },
  spacious: { sectionGapMm: 8, itemGapMm: 5, innerPaddingMm: 5 },
};

const TYPOGRAPHY_PRESETS: Record<TypographyPreset, Partial<TemplateTypography>> = {
  small: { tradingNameSize: "lg", bodyTextSize: "sm", itemTitleSize: "sm", totalsBoldSize: "base" },
  standard: {},
  large: { tradingNameSize: "2xl", bodyTextSize: "base", itemTitleSize: "base", totalsBoldSize: "lg" },
};

const PHOTO_SIZE_PRESETS: Record<PhotoSizePreset, number> = {
  small: 18,
  medium: 25,
  large: 40,
};

const LOGO_SCALE_PRESETS: Record<LogoScale, { maxH: number; maxW: number }> = {
  small: { maxH: 8, maxW: 28 },
  standard: { maxH: 14, maxW: 48 },
  large: { maxH: 24, maxW: 80 },
};
export { LOGO_SCALE_PRESETS };

const DENSITY_PRESETS: Record<DensityPreset, TemplateDensity> = {
  comfortable: { drawingMaxH: 50, specRowH: 4.2, itemHeaderH: 12, photoRowH: 28, itemCardPadMm: 4, itemGapMm: 4 },
  standard: { drawingMaxH: 38, specRowH: 3.5, itemHeaderH: 10, photoRowH: 20, itemCardPadMm: 3, itemGapMm: 3 },
  compact: { drawingMaxH: 28, specRowH: 3, itemHeaderH: 8, photoRowH: 16, itemCardPadMm: 2, itemGapMm: 2 },
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

  if (config.logoScale) {
    base.header = { ...base.header, logoScale: config.logoScale };
    const scalePreset = LOGO_SCALE_PRESETS[config.logoScale];
    if (scalePreset && !config.logoWidthMm) {
      base.header.logoWidthMm = scalePreset.maxW;
      base.header.logoMaxHeightMm = scalePreset.maxH;
    }
  }

  if (config.showTradingName !== undefined) {
    base.header = { ...base.header, showTradingName: config.showTradingName };
  }

  if (config.logoWidthMm !== undefined) {
    base.header = { ...base.header, logoWidthMm: config.logoWidthMm };
  }
  if (config.logoMaxHeightMm !== undefined) {
    base.header = { ...base.header, logoMaxHeightMm: config.logoMaxHeightMm };
  }
  if (config.legalLinePlacement) {
    base.header = { ...base.header, legalLinePlacement: config.legalLinePlacement };
  }
  if (config.contactBlockAlignment) {
    base.header = { ...base.header, contactBlockAlignment: config.contactBlockAlignment };
  }
  if (config.headerBottomSpacingMm !== undefined) {
    base.header = { ...base.header, headerBottomSpacingMm: config.headerBottomSpacingMm };
  }

  if (config.densityPreset && DENSITY_PRESETS[config.densityPreset]) {
    base.density = { ...DENSITY_PRESETS[config.densityPreset] };
  }

  if (config.drawingMaxHeightMm !== undefined) {
    base.density = { ...base.density, drawingMaxH: config.drawingMaxHeightMm };
  }
  if (config.photoMaxHeightMm !== undefined) {
    base.density = { ...base.density, photoRowH: config.photoMaxHeightMm };
  }
  if (config.specRowHeightMm !== undefined) {
    base.density = { ...base.density, specRowH: config.specRowHeightMm };
  }
  if (config.itemHeaderHeightMm !== undefined) {
    base.density = { ...base.density, itemHeaderH: config.itemHeaderHeightMm };
  }
  if (config.itemCardPaddingMm !== undefined) {
    base.density = { ...base.density, itemCardPadMm: config.itemCardPaddingMm };
  }
  if (config.itemCardGapMm !== undefined) {
    base.density = { ...base.density, itemGapMm: config.itemCardGapMm };
  }

  if (config.documentMode) {
    base.documentMode = config.documentMode;
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

export function isSectionVisible(template: QuoteTemplate, key: string): boolean {
  const section = template.sections.find(s => s.key === key);
  return section ? section.visible : true;
}

export function getSectionOrder(template: QuoteTemplate): string[] {
  return template.sections.filter(s => s.visible).map(s => s.key);
}
