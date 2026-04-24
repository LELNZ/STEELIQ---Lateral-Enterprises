import type {
  QuoteDocumentModel,
  QuoteDocumentItem,
  QuoteDocumentItemPhoto,
  TotalsDisplayConfig,
} from "./quote-document";
import type { DomainType } from "@shared/schema";
import type { QuoteTemplate } from "./quote-template";
import { resolveQuoteTemplate, type CompanyTemplateConfig } from "./quote-template";

export type PresentationMode =
  | "standard"
  | "cover-page"
  | "renovation-homeowner"
  | "new-build-schedule";

export interface RenderHeader {
  quoteNumber: string;
  dateFormatted: string;
  expiryFormatted: string;
  revisionVersion: number;
  status: string;
  validityDays: number;
}

export interface RenderBranding {
  tradingName: string;
  legalLine: string;
  logoUrl: string | null;
  accentColor: string | null;
}

export interface RenderOrgContact {
  address: string | null;
  phone: string | null;
  email: string | null;
  gstNumber: string | null;
  nzbn: string | null;
  bankDetails: string | null;
}

export interface RenderCustomerProject {
  customerName: string;
  projectAddress: string;
  hasProjectAddress: boolean;
}

export interface RenderTotalsLine {
  label: string;
  amount: number;
  formatted: string;
  emphasis: "normal" | "separator" | "muted" | "bold";
}

export interface RenderTotals {
  hasBreakdown: boolean;
  hasLegacyOnly: boolean;
  lines: RenderTotalsLine[];
  isEmpty: boolean;
}

export interface RenderSpecEntry {
  key: string;
  label: string;
  value: string;
}

export interface RenderItemMedia {
  drawingUrl: string | null;
  drawingKey: string | null;
  drawingLabel: string;
  customerPhotos: {
    url: string;
    caption: string;
    key: string;
  }[];
}

export interface RenderPaneGlassSpec {
  paneIndex: number;
  iguType: string;
  glassType: string;
  glassThickness: string;
}

export interface RenderScheduleItem {
  index: number;
  itemNumber: number;
  itemRef: string;
  title: string;
  dimensionLabel: string;
  quantityLabel: string;
  openingDirectionLabel?: string;
  gosNote?: string;
  catDoorNote?: string;
  visibleSpecs: RenderSpecEntry[];
  paneGlassSpecs: RenderPaneGlassSpec[];
  media: RenderItemMedia;
}

export interface RenderContentSection {
  heading: string;
  body: string;
}

export interface RenderLegalBlock {
  sections: RenderContentSection[];
  hasBankDetails: boolean;
  bankDetails: string | null;
  additionalCapabilities: string | null;
}

export interface QuoteRenderModel {
  domainType: DomainType;
  presentationMode: PresentationMode;
  resolvedTemplate: QuoteTemplate;
  header: RenderHeader;
  branding: RenderBranding;
  orgContact: RenderOrgContact;
  customerProject: RenderCustomerProject;
  totals: RenderTotals;
  scheduleItems: RenderScheduleItem[];
  legal: RenderLegalBlock;
  disclaimerText: string;
  itemCount: number;
  documentLabel: string;
  commercialRemarks: string | null;
}

function formatDateNZ(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" });
}

function fmtCurrency(n: number): string {
  return n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildTotals(doc: QuoteDocumentModel): RenderTotals {
  const t = doc.totals;
  const cfg = doc.totalsDisplayConfig;
  const hasBreakdown = t.itemsSubtotal > 0 || t.installationTotal > 0 || t.deliveryTotal > 0 || (t.removalTotal ?? 0) > 0 || (t.rubbishTotal ?? 0) > 0;
  const hasLegacyOnly = !hasBreakdown && t.legacySell !== null;

  if (!hasBreakdown && !hasLegacyOnly) {
    return { hasBreakdown: false, hasLegacyOnly: false, lines: [], isEmpty: true };
  }

  const lines: RenderTotalsLine[] = [];

  if (hasBreakdown) {
    if (cfg.showItemsSubtotal && t.itemsSubtotal > 0) {
      lines.push({ label: "Items Subtotal", amount: t.itemsSubtotal, formatted: `$${fmtCurrency(t.itemsSubtotal)}`, emphasis: "normal" });
    }
    if (cfg.showInstallation && t.installationTotal > 0) {
      lines.push({ label: "Installation", amount: t.installationTotal, formatted: `$${fmtCurrency(t.installationTotal)}`, emphasis: "normal" });
    }
    if (cfg.showDelivery && t.deliveryTotal > 0) {
      lines.push({ label: "Delivery", amount: t.deliveryTotal, formatted: `$${fmtCurrency(t.deliveryTotal)}`, emphasis: "normal" });
    }
    if (cfg.showRemoval && (t.removalTotal ?? 0) > 0) {
      lines.push({ label: "Removal of Old Windows & Doors", amount: t.removalTotal, formatted: `$${fmtCurrency(t.removalTotal)}`, emphasis: "normal" });
    }
    if (cfg.showRubbish && (t.rubbishTotal ?? 0) > 0) {
      lines.push({ label: "Rubbish Removal", amount: t.rubbishTotal, formatted: `$${fmtCurrency(t.rubbishTotal)}`, emphasis: "normal" });
    }
    lines.push({ label: "", amount: 0, formatted: "", emphasis: "separator" });
    if (cfg.showSubtotal) {
      lines.push({ label: "Subtotal (excl. GST)", amount: t.subtotalExclGst, formatted: `$${fmtCurrency(t.subtotalExclGst)}`, emphasis: "normal" });
    }
    if (cfg.showGst) {
      lines.push({ label: "GST (15%)", amount: t.gstAmount, formatted: `$${fmtCurrency(t.gstAmount)}`, emphasis: "muted" });
    }
    lines.push({ label: "Total (incl. GST)", amount: t.totalInclGst, formatted: `$${fmtCurrency(t.totalInclGst)}`, emphasis: "bold" });
  } else if (hasLegacyOnly) {
    lines.push({ label: "Quoted Price (excl. GST)", amount: t.legacySell!, formatted: `$${fmtCurrency(t.legacySell!)}`, emphasis: "normal" });
  }

  return { hasBreakdown, hasLegacyOnly, lines, isEmpty: false };
}

const LASER_SPEC_LABELS: Record<string, string> = {
  materialType: "Material",
  materialGrade: "Grade",
  thickness: "Thickness",
  dimensions: "Dimensions",
  length: "Length",
  width: "Width",
  finish: "Finish",
  customerNotes: "Notes",
  // Phase 5E hardening — manual / attached procedure labels.
  procedureKind: "Type",
  procedureType: "Procedure",
  description: "Description",
  attachedTo: "Attached To",
  // Phase 5E hardening — line-level pricing (toggleable).
  unitPrice: "Unit Price",
  lineTotal: "Line Total",
};

function buildScheduleItem(
  item: QuoteDocumentItem,
  index: number,
  displayKeys: string[],
  specKeyToLabel: Record<string, string>,
  domainType?: string,
): RenderScheduleItem {
  const specs = item.resolvedSpecs || {};

  const isLaser = domainType === "laser";

  const visibleSpecs = isLaser
    ? Object.entries(specs)
        .filter(([, v]) => v && v !== "" && v !== "0")
        .map(([key, value]) => ({ key, label: LASER_SPEC_LABELS[key] || key, value }))
    : displayKeys
        .filter(key => specs[key] && specs[key] !== "" && specs[key] !== "0")
        .map(key => ({ key, label: specKeyToLabel[key] || key, value: specs[key] }));

  const customerPhotos = (item.photos || [])
    .filter((p: QuoteDocumentItemPhoto) => p.includeInCustomerPdf)
    .map((p: QuoteDocumentItemPhoto, pIdx: number) => ({
      url: `/api/item-photos/${p.key}`,
      caption: p.caption || `Photo ${pIdx + 1} — Item ${index + 1}`,
      key: p.key,
    }));

  const drawingUrl = isLaser ? null : (item.drawingImageKey ? `/api/drawing-images/${item.drawingImageKey}` : null);

  const openingDirMap: Record<string, string> = {
    "open-in": "Open In",
    "open-out": "Open Out",
    "sliding-left": "Sliding Left",
    "sliding-right": "Sliding Right",
    "fold-left": "Fold Left",
    "fold-right": "Fold Right",
  };
  const odVal = item.openingDirection;
  const openingDirectionLabel = isLaser ? undefined : (odVal && odVal !== "none" && openingDirMap[odVal] ? openingDirMap[odVal] : undefined);

  const gosNote = isLaser ? undefined : (item.gosRequired ? "Glaze on site due to size and weight" : undefined);
  const catDoorNote = isLaser ? undefined : (item.catDoorEnabled ? "Cat door included" : undefined);

  // Phase 5E hardening — manual / attached procedure subtitle handling.
  // Procedure pseudo-rows have no physical dimensions, so we substitute a
  // descriptive label so the schedule subtitle "Qty: N · {label}" remains
  // sensible in both Preview and PDF (PDF concatenates with a literal · ).
  const isManualProc = isLaser && item.category === "manual_procedure";
  const dimensionLabel = isLaser
    ? (isManualProc
        ? "Manual / Provisional"
        : (item.width > 0 && item.height > 0 ? `${item.width}mm x ${item.height}mm` : ""))
    : (item.category === "raked-fixed" && item.rakedLeftHeight != null && item.rakedRightHeight != null
      ? `${item.width}mm W × ${item.rakedLeftHeight}/${item.rakedRightHeight}mm H (L/R)`
      : `${item.width}mm x ${item.height}mm`);

  return {
    index,
    itemNumber: item.itemNumber || index + 1,
    itemRef: item.itemRef || item.title || `Item ${index + 1}`,
    title: `Item ${item.itemNumber || index + 1} — ${item.itemRef || item.title || `Item ${index + 1}`}`,
    dimensionLabel,
    quantityLabel: `Qty: ${item.quantity || 1}`,
    openingDirectionLabel,
    gosNote,
    catDoorNote,
    visibleSpecs,
    paneGlassSpecs: isLaser ? [] : (item.paneGlassSpecs || []).filter(p => p.iguType || p.glassType || p.glassThickness),
    media: {
      drawingUrl,
      drawingKey: isLaser ? null : (item.drawingImageKey || null),
      drawingLabel: `Drawing — Item ${item.itemNumber || index + 1}`,
      customerPhotos,
    },
  };
}

function buildLegal(doc: QuoteDocumentModel): RenderLegalBlock {
  const sections: RenderContentSection[] = [];
  if (doc.content.exclusions) sections.push({ heading: "Exclusions", body: doc.content.exclusions });
  if (doc.content.terms) sections.push({ heading: "Terms", body: doc.content.terms });
  if (doc.content.paymentTerms) sections.push({ heading: "Payment Terms", body: doc.content.paymentTerms });

  return {
    sections,
    hasBankDetails: !!doc.org.bankDetails,
    bankDetails: doc.org.bankDetails || null,
    additionalCapabilities: doc.content.additionalCapabilities || null,
  };
}

function buildSpecKeyToLabel(doc: QuoteDocumentModel): Record<string, string> {
  const m: Record<string, string> = {};
  const grouped = doc.specDisplay.specDictionaryGrouped;
  if (grouped) {
    for (const group of Object.values(grouped)) {
      for (const entry of group) {
        m[entry.key] = entry.label;
      }
    }
  }
  return m;
}

export function buildQuoteRenderModel(
  doc: QuoteDocumentModel,
  options?: { presentationMode?: PresentationMode },
): QuoteRenderModel {
  const mode = options?.presentationMode ?? "standard";
  const specKeyToLabel = buildSpecKeyToLabel(doc);

  const resolved = resolveQuoteTemplate(
    {
      accentColor: doc.branding.accentColor,
      scheduleLayoutVariant: doc.branding.scheduleLayoutVariant,
      totalsLayoutVariant: doc.branding.totalsLayoutVariant,
    },
    doc.companyTemplateConfig as CompanyTemplateConfig | null,
  );

  return {
    domainType: doc.domainType,
    presentationMode: mode,
    resolvedTemplate: resolved,
    header: {
      quoteNumber: doc.metadata.quoteNumber,
      dateFormatted: formatDateNZ(doc.metadata.createdAt),
      expiryFormatted: formatDateNZ(doc.metadata.validUntil),
      revisionVersion: doc.metadata.revisionVersion,
      status: doc.metadata.status,
      validityDays: doc.metadata.validityDays,
    },
    branding: {
      tradingName: doc.branding.tradingName,
      legalLine: doc.branding.legalLine,
      logoUrl: doc.branding.logoUrl,
      accentColor: doc.branding.accentColor,
    },
    orgContact: {
      address: doc.org.address,
      phone: doc.org.phone,
      email: doc.org.email,
      gstNumber: doc.org.gstNumber,
      nzbn: doc.org.nzbn,
      bankDetails: doc.org.bankDetails,
    },
    customerProject: {
      customerName: doc.customer.name,
      projectAddress: doc.project.address,
      hasProjectAddress: !!doc.project.address,
    },
    totals: buildTotals(doc),
    scheduleItems: doc.items.map((item, idx) =>
      buildScheduleItem(item, idx, doc.specDisplay.effectiveKeys, specKeyToLabel, doc.domainType)
    ),
    legal: buildLegal(doc),
    disclaimerText: "Preliminary Estimate — subject to final site measure, specification confirmation, and final approval.",
    itemCount: doc.items.length,
    documentLabel: doc.org.documentLabel || "Quote",
    commercialRemarks: (doc.totalsDisplayConfig.showCommercialRemarks !== false && doc.content.commercialRemarks)
      ? doc.content.commercialRemarks
      : null,
  };
}

export function rebuildScheduleItems(
  doc: QuoteDocumentModel,
  effectiveKeys: string[],
): RenderScheduleItem[] {
  const specKeyToLabel = buildSpecKeyToLabel(doc);
  return doc.items.map((item, idx) =>
    buildScheduleItem(item, idx, effectiveKeys, specKeyToLabel, doc.domainType)
  );
}
