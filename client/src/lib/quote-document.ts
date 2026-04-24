import type { OrgSettings, DivisionSettings, Quote, QuoteRevision, SpecDictionaryEntry, DomainType } from "@shared/schema";
import { resolveQuoteDomainType } from "@shared/schema";
import type { EstimateSnapshot, SnapshotItem, LaserSnapshotItem } from "@shared/estimate-snapshot";

export interface TotalsDisplayConfig {
  showItemsSubtotal: boolean;
  showInstallation: boolean;
  showDelivery: boolean;
  showRemoval: boolean;
  showRubbish: boolean;
  showSubtotal: boolean;
  showGst: boolean;
  showCommercialRemarks: boolean;
  // Phase 5E hardening — line-level pricing visibility (LL only).
  // Optional, default false (preserves prior behaviour for existing quotes).
  // Customer-safe: shows only unit price and line total — never margin / cost.
  showLineUnitPrice?: boolean;
  showLineTotal?: boolean;
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
  showLineUnitPrice: false,
  showLineTotal: false,
};

export interface PreviewData {
  orgSettings: OrgSettings;
  divisionSettings: DivisionSettings;
  quote: Quote;
  currentRevision: QuoteRevision;
  snapshot: EstimateSnapshot;
  templateKey: string;
  domainType?: DomainType;
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
  domainType: DomainType;
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

function fmtNzd(n: number): string {
  return `$${n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function mapLaserSnapshotItem(li: LaserSnapshotItem, totalsCfg: TotalsDisplayConfig): QuoteDocumentItem {
  const resolvedSpecs: Record<string, string> = {};
  // Phase 5E hardening — manual procedure rendering (standalone OR attached).
  // Detection: isManualProcedure flag set by laser-quote-builder for both
  // standalone manual rows AND attached-procedure pseudo-rows. We emit
  // procedure-specific specs in display order so the renderer (which iterates
  // Object.entries for laser items) shows them in the intended sequence.
  // Customer-safe: never includes cost/margin/internal notes.
  const isProc = (li as any).isManualProcedure === true;
  const attachedToParent = (li as any).attachedToParentRef as string | undefined;

  if (isProc) {
    resolvedSpecs["procedureKind"] = attachedToParent
      ? "Attached Manual / Provisional Procedure"
      : "Manual / Provisional Procedure";
    if ((li as any).procedureType) {
      resolvedSpecs["procedureType"] = String((li as any).procedureType);
    }
    const desc = ((li as any).procedureDescription as string | undefined) || "";
    if (desc.trim()) {
      resolvedSpecs["description"] = desc.trim();
    }
    if (attachedToParent) {
      resolvedSpecs["attachedTo"] = attachedToParent;
    }
  } else {
    if (li.materialType) resolvedSpecs["materialType"] = li.materialType;
    if (li.materialGrade) resolvedSpecs["materialGrade"] = li.materialGrade;
    if (li.thickness) resolvedSpecs["thickness"] = `${li.thickness}mm`;
    if (li.length && li.width) resolvedSpecs["dimensions"] = `${li.length}mm x ${li.width}mm`;
    else if (li.length) resolvedSpecs["length"] = `${li.length}mm`;
    else if (li.width) resolvedSpecs["width"] = `${li.width}mm`;
    if (li.finish) resolvedSpecs["finish"] = li.finish;
    if (li.customerNotes) resolvedSpecs["customerNotes"] = li.customerNotes;
  }

  // Optional line-level pricing (toggled per-revision via Quote Display Settings).
  // For procedures, unitPrice is the manual unit sell. For laser items, it's
  // sellTotal/quantity (line-level unit). Line total is sellTotal in both cases.
  const qty = li.quantity || 1;
  const unitPriceVal = isProc
    ? (((li as any).manualUnitSell as number | undefined) ?? li.unitPrice ?? 0)
    : (li.unitPrice && li.unitPrice > 0 ? li.unitPrice : (li.sellTotal || 0) / qty);
  const lineTotalVal = li.sellTotal || (unitPriceVal * qty);

  if (totalsCfg.showLineUnitPrice && unitPriceVal > 0) {
    resolvedSpecs["unitPrice"] = `${fmtNzd(unitPriceVal)} ea`;
  }
  if (totalsCfg.showLineTotal && lineTotalVal > 0) {
    resolvedSpecs["lineTotal"] = fmtNzd(lineTotalVal);
  }

  return {
    itemNumber: li.itemNumber,
    itemRef: li.itemRef,
    title: li.title,
    quantity: li.quantity,
    width: li.length || 0,
    height: li.width || 0,
    // Tag manual procedures so the renderer can format the subtitle and
    // skip dimensions/photos cleanly. Reused by buildScheduleItem.
    category: isProc ? "manual_procedure" : undefined,
    photos: isProc
      ? []
      : (li.photos || []).map(p => ({
          key: p.key,
          isPrimary: p.isPrimary,
          includeInCustomerPdf: p.includeInCustomerPdf,
          caption: p.caption,
          takenAt: p.takenAt,
        })),
    specValues: {
      materialType: li.materialType,
      materialGrade: li.materialGrade,
      thickness: li.thickness,
      length: li.length,
      width: li.width,
      finish: li.finish,
      customerNotes: li.customerNotes,
      unitPrice: li.unitPrice,
      isManualProcedure: isProc,
      procedureType: (li as any).procedureType,
      procedureDescription: (li as any).procedureDescription,
      attachedToParentRef: attachedToParent,
      sellTotal: li.sellTotal,
    },
    resolvedSpecs,
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

  const domainType = preview.domainType || resolveQuoteDomainType(quote.divisionId);

  return {
    domainType,
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
    items: domainType === "laser" && (snapshot as any).laserItems?.length
      ? ((snapshot as any).laserItems as LaserSnapshotItem[]).map(li => mapLaserSnapshotItem(li, totalsDisplayConfig))
      : (snapshot.items || []).map(mapSnapshotItem),
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
