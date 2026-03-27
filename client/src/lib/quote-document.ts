import type { OrgSettings, DivisionSettings, Quote, QuoteRevision, SpecDictionaryEntry } from "@shared/schema";
import type { EstimateSnapshot, SnapshotItem } from "@shared/estimate-snapshot";

export interface TotalsDisplayConfig {
  showItemsSubtotal: boolean;
  showInstallation: boolean;
  showDelivery: boolean;
  showRemoval: boolean;
  showRubbish: boolean;
  showSubtotal: boolean;
  showGst: boolean;
  showCommercialRemarks: boolean;
}

export const DEFAULT_TOTALS_DISPLAY_CONFIG: TotalsDisplayConfig = {
  showItemsSubtotal: true,
  showInstallation: true,
  showDelivery: true,
  showRemoval: true,
  showRubbish: true,
  showSubtotal: true,
  showGst: true,
  showCommercialRemarks: true,
};

export interface PreviewData {
  orgSettings: OrgSettings;
  divisionSettings: DivisionSettings;
  quote: Quote;
  currentRevision: QuoteRevision;
  snapshot: EstimateSnapshot;
  templateKey: string;
  specDictionaryGrouped: Record<string, SpecDictionaryEntry[]>;
  effectiveSpecDisplayKeys: string[];
  totalsDisplayConfig: TotalsDisplayConfig | null;
  commercialRemarks: string | null;
  projectAddress: string | null;
  companyTemplateConfig?: Record<string, unknown> | null;
}

export interface QuoteDocumentMetadata {
  quoteId: string;
  quoteNumber: string;
  revisionId: string;
  revisionVersion: number;
  templateKey: string;
  status: string;
  createdAt: string | null;
  validUntil: string | null;
  validityDays: number;
}

export interface QuoteDocumentBranding {
  tradingName: string;
  legalLine: string;
  logoUrl: string | null;
  fontFamily: string | null;
  accentColor: string | null;
  logoPosition: string | null;
  headerVariant: string | null;
  scheduleLayoutVariant: string;
  totalsLayoutVariant: string;
}

export interface QuoteDocumentOrg {
  legalName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  gstNumber: string | null;
  nzbn: string | null;
  bankDetails: string | null;
  documentLabel: string;
}

export interface QuoteDocumentCustomer {
  name: string;
}

export interface QuoteDocumentProject {
  address: string;
  sourceJobId: string | null;
}

export interface QuoteDocumentItemPhoto {
  key: string;
  isPrimary?: boolean;
  includeInCustomerPdf?: boolean;
  caption?: string;
  takenAt?: string;
}

export interface QuoteDocumentItem {
  itemNumber: number;
  itemRef: string;
  title: string;
  quantity: number;
  width: number;
  height: number;
  category?: string;
  rakedLeftHeight?: number;
  rakedRightHeight?: number;
  openingDirection?: string;
  gosRequired?: boolean;
  gosChargeNzd?: number;
  catDoorEnabled?: boolean;
  drawingImageKey?: string;
  photos: QuoteDocumentItemPhoto[];
  paneGlassSpecs?: { paneIndex: number; iguType: string; glassType: string; glassThickness: string }[];
  specValues: Record<string, unknown>;
  resolvedSpecs: Record<string, string>;
}

export interface QuoteDocumentTotals {
  itemsSubtotal: number;
  installationTotal: number;
  deliveryTotal: number;
  removalTotal: number;
  rubbishTotal: number;
  subtotalExclGst: number;
  gstAmount: number;
  totalInclGst: number;
  legacySell: number | null;
  legacyCost: number | null;
  legacyGrossProfit: number | null;
  legacyGrossMargin: number | null;
}

export interface QuoteDocumentContent {
  headerNotes: string | null;
  exclusions: string | null;
  terms: string | null;
  paymentTerms: string | null;
  additionalCapabilities: string | null;
  commercialRemarks: string | null;
}

export interface QuoteDocumentSpecDisplay {
  effectiveKeys: string[];
  specDictionaryGrouped: Record<string, SpecDictionaryEntry[]>;
}

export interface QuoteDocumentModel {
  metadata: QuoteDocumentMetadata;
  branding: QuoteDocumentBranding;
  org: QuoteDocumentOrg;
  customer: QuoteDocumentCustomer;
  project: QuoteDocumentProject;
  items: QuoteDocumentItem[];
  totals: QuoteDocumentTotals;
  totalsDisplayConfig: TotalsDisplayConfig;
  content: QuoteDocumentContent;
  specDisplay: QuoteDocumentSpecDisplay;
  companyTemplateConfig?: Record<string, unknown> | null;
}

function computeExpiryDate(createdAt: Date | string | null, validityDays: number): string | null {
  if (!createdAt) return null;
  const d = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  if (isNaN(d.getTime())) return null;
  return new Date(d.getTime() + validityDays * 24 * 60 * 60 * 1000).toISOString();
}

function mapSnapshotItem(si: SnapshotItem): QuoteDocumentItem {
  return {
    itemNumber: si.itemNumber,
    itemRef: si.itemRef,
    title: si.title,
    quantity: si.quantity,
    width: si.width,
    height: si.height,
    category: si.category,
    rakedLeftHeight: si.rakedLeftHeight,
    rakedRightHeight: si.rakedRightHeight,
    openingDirection: si.openingDirection,
    gosRequired: si.gosRequired,
    gosChargeNzd: si.gosChargeNzd,
    catDoorEnabled: si.catDoorEnabled,
    drawingImageKey: si.drawingImageKey,
    photos: (si.photos || []).map(p => ({
      key: p.key,
      isPrimary: p.isPrimary,
      includeInCustomerPdf: p.includeInCustomerPdf,
      caption: p.caption,
      takenAt: p.takenAt,
    })),
    paneGlassSpecs: si.paneGlassSpecs || [],
    specValues: si.specValues || {},
    resolvedSpecs: si.resolvedSpecs || {},
  };
}

export function buildQuoteDocumentModel(preview: PreviewData): QuoteDocumentModel {
  const { orgSettings: org, divisionSettings: div, quote, currentRevision, snapshot } = preview;
  const validityDays = org.quoteValidityDays || 30;
  const createdAtStr = quote.createdAt ? new Date(quote.createdAt).toISOString() : null;

  const tb = snapshot.totalsBreakdown || { itemsSubtotal: 0, installationTotal: 0, deliveryTotal: 0, subtotalExclGst: 0, gstAmount: 0, totalInclGst: 0 };
  const legacy = snapshot.totals;

  const totalsDisplayConfig: TotalsDisplayConfig = {
    ...DEFAULT_TOTALS_DISPLAY_CONFIG,
    ...(preview.totalsDisplayConfig || {}),
  };

  return {
    metadata: {
      quoteId: quote.id,
      quoteNumber: quote.number,
      revisionId: currentRevision.id,
      revisionVersion: currentRevision.versionNumber,
      templateKey: preview.templateKey,
      status: quote.status,
      createdAt: createdAtStr,
      validUntil: computeExpiryDate(quote.createdAt, validityDays),
      validityDays,
    },
    branding: {
      tradingName: div.tradingName || org.legalName || "SteelIQ",
      legalLine: div.requiredLegalLine || "A trading division of Lateral Engineering Limited",
      logoUrl: div.logoUrl || null,
      fontFamily: div.fontFamily || null,
      accentColor: div.accentColor || null,
      logoPosition: div.logoPosition || null,
      headerVariant: div.headerVariant || null,
      scheduleLayoutVariant: div.scheduleLayoutVariant || "standard",
      totalsLayoutVariant: div.totalsLayoutVariant || "standard",
    },
    org: {
      legalName: org.legalName || "",
      address: org.address || null,
      phone: org.phone || null,
      email: org.email || null,
      gstNumber: org.gstNumber || null,
      nzbn: org.nzbn || null,
      bankDetails: org.bankDetails || null,
      documentLabel: org.documentLabel || "Quote",
    },
    customer: {
      name: quote.customer,
    },
    project: {
      address: preview.projectAddress || "",
      sourceJobId: quote.sourceJobId || null,
    },
    items: (snapshot.items || []).map(mapSnapshotItem),
    totals: {
      itemsSubtotal: tb.itemsSubtotal,
      installationTotal: tb.installationTotal,
      deliveryTotal: tb.deliveryTotal,
      removalTotal: (tb as any).removalTotal ?? 0,
      rubbishTotal: (tb as any).rubbishTotal ?? 0,
      subtotalExclGst: tb.subtotalExclGst || tb.itemsSubtotal,
      gstAmount: tb.gstAmount,
      totalInclGst: tb.totalInclGst,
      legacySell: legacy?.sell ?? null,
      legacyCost: legacy?.cost ?? null,
      legacyGrossProfit: legacy?.grossProfit ?? null,
      legacyGrossMargin: legacy?.grossMargin ?? null,
    },
    totalsDisplayConfig,
    content: {
      headerNotes: div.headerNotesOverrideBlock || org.defaultHeaderNotesBlock || null,
      exclusions: (() => {
        const base = div.exclusionsOverrideBlock || org.defaultExclusionsBlock || "";
        const snapshotExclusions = (snapshot as any).exclusions as string[] | undefined;
        if (!snapshotExclusions || snapshotExclusions.length === 0) return base || null;
        const lockNotes = snapshotExclusions.map(e => `• ${e}`).join("\n");
        return base ? `${base}\n\n${lockNotes}` : lockNotes;
      })(),
      terms: div.termsOverrideBlock || org.defaultTermsBlock || null,
      paymentTerms: org.paymentTermsBlock || null,
      additionalCapabilities: div.additionalCapabilitiesBlock || null,
      commercialRemarks: preview.commercialRemarks || null,
    },
    specDisplay: {
      effectiveKeys: preview.effectiveSpecDisplayKeys,
      specDictionaryGrouped: preview.specDictionaryGrouped,
    },
    companyTemplateConfig: preview.companyTemplateConfig || null,
  };
}
