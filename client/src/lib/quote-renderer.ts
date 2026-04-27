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
  // Phase 5F — attached-procedure visual grouping. `displayNumber` is the
  // human-readable schedule number used in Preview/PDF (e.g. "001" for a
  // parent). After the Phase 5F polish pass, attached children are NOT
  // emitted as their own RenderScheduleItem cards — they are collapsed into
  // their parent's `attachedOperations` array and rendered as compact rows
  // inside the parent card. `isAttachedChild` therefore only stays `true`
  // for orphan attached rows whose parent could not be resolved (defensive
  // fallback so they still render).
  displayNumber: string;
  isAttachedChild: boolean;
  parentDisplayNumber?: string;
  // Phase 5F polish — compact attached operation rows nested inside the
  // parent card. Empty when there are no attached procedures.
  attachedOperations: RenderAttachedOperation[];
  // Phase 5F manual blank preview — populated only for LL (laser) items
  // that have valid length + width but no uploaded drawing. Used by
  // Preview/PDF to render a simple proportional rectangle outline plus
  // dimension caption in the left visual area, so the customer sees an
  // indicative shape instead of a large blank space. Never carries
  // internal cost / margin / supplier / drawing-import data.
  manualBlankPreview: { lengthMm: number; widthMm: number } | null;
  // Phase 5F.1 — grouped commercial pricing table. Populated for LL
  // (laser) parent items only. Carries everything the renderer needs to
  // draw a single Description / Qty / Unit Price / Line Total table that
  // groups the parent laser-blank row with all attached-operation rows
  // and a bold Item Total footer (parent line total + sum of operation
  // line totals). Numeric fields are ALWAYS populated so the Item Total
  // can be summed even when label visibility is off; label/column
  // visibility is governed by the existing per-revision toggles
  // (showLineUnitPrice / showLineTotal / showOperationPricing). Pulled
  // OUT of visibleSpecs so the spec table stays clean and readable.
  // Customer-safe: only the toggled unit price / line total labels are
  // surfaced, never cost / margin / supplier / bucket data.
  pricingDisplay: RenderPricingDisplay | null;
}

// Phase 5F.1 — grouped commercial pricing block for an LL parent item.
// Numeric fields are always populated (used to compute the Item Total
// footer regardless of toggle state). Label/column visibility flags
// mirror the per-revision Quote Display Settings toggles.
export interface RenderPricingDisplay {
  description: string;             // e.g. "Laser cut blank"
  quantity: number;                // parent quantity
  unitPrice: number;               // parent unit sell (always populated)
  lineTotal: number;               // parent line sell (always populated)
  unitPriceLabel: string | null;   // formatted when showLineUnitPrice
  lineTotalLabel: string | null;   // formatted when showLineTotal
  showUnitPriceColumn: boolean;    // mirrors showLineUnitPrice
  showLineTotalColumn: boolean;    // mirrors showLineTotal
}

// Phase 5F polish — compact, customer-safe view of an attached manual /
// provisional procedure. NEVER carries cost/margin/supplier/internal-notes
// fields. The unit price / line total labels are populated only when the
// existing per-revision pricing toggles (Item Unit Price / Item Line Total)
// are ON, so the same toggle that controls the parent's pricing also
// controls the attached operation's pricing.
export interface RenderAttachedOperation {
  procedureType: string;       // e.g. "Folding"
  description: string;         // e.g. "4 folds per item" — may be empty
  quantity: number;            // e.g. 4
  unitPriceLabel: string | null;  // e.g. "$20.00 ea" or null when hidden
  lineTotalLabel: string | null;  // e.g. "$80.00" or null when hidden
  // Phase 5F.1 — numeric line total ALWAYS populated so the parent's
  // Item Total footer can sum operation values even when their labels
  // are hidden (operation pricing toggle off but item line-total on).
  // Snapshot subtotal is unaffected; this is purely display math.
  lineTotal: number;
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
  totalsCfg?: TotalsDisplayConfig,
): RenderScheduleItem {
  const specs = item.resolvedSpecs || {};

  const isLaser = domainType === "laser";

  // Phase 5F card-tightening — pull unitPrice/lineTotal OUT of the LL
  // spec table so the customer-facing right-hand column stays focused on
  // material/grade/thickness/dimensions/finish. The pricing values are
  // re-emitted in the dedicated `pricingDisplay` field below and rendered
  // in a single compact row beneath the spec table by Preview / PDF.
  const isLaserPricingKey = (k: string) => k === "unitPrice" || k === "lineTotal";

  const visibleSpecs = isLaser
    ? Object.entries(specs)
        .filter(([k, v]) => v && v !== "" && v !== "0" && !isLaserPricingKey(k))
        .map(([key, value]) => ({ key, label: LASER_SPEC_LABELS[key] || key, value }))
    : displayKeys
        .filter(key => specs[key] && specs[key] !== "" && specs[key] !== "0")
        .map(key => ({ key, label: specKeyToLabel[key] || key, value: specs[key] }));

  // Phase 5F.1 — grouped commercial pricing display (LL parent items
  // only; manual procedures that render as their own card are excluded
  // since they don't have a "Laser cut blank" line). Numeric fields are
  // ALWAYS populated so the Item Total footer can be summed even when
  // the operation pricing toggle is off; only the label / column-show
  // flags follow the per-revision Quote Display Settings toggles.
  const sv = (item.specValues || {}) as Record<string, unknown>;
  const isParentLaserItem = isLaser && item.category !== "manual_procedure";
  const showUnit = !!(totalsCfg?.showLineUnitPrice);
  const showLT = !!(totalsCfg?.showLineTotal);
  const parentQty = Math.max(1, Number(item.quantity) || 1);
  const parentSellTotal = Number(sv.sellTotal) || 0;
  const parentUnitPriceRaw = Number(sv.unitPrice);
  const parentUnitPrice = parentUnitPriceRaw > 0
    ? parentUnitPriceRaw
    : (parentSellTotal > 0 ? parentSellTotal / parentQty : 0);
  const parentLineTotal = parentSellTotal > 0 ? parentSellTotal : parentUnitPrice * parentQty;
  const pricingDisplay: RenderPricingDisplay | null = isParentLaserItem
    ? {
        description: "Laser cut blank",
        quantity: parentQty,
        unitPrice: parentUnitPrice,
        lineTotal: parentLineTotal,
        unitPriceLabel: showUnit && parentUnitPrice > 0 ? `$${fmtCurrency(parentUnitPrice)} ea` : null,
        lineTotalLabel: showLT && parentLineTotal > 0 ? `$${fmtCurrency(parentLineTotal)}` : null,
        showUnitPriceColumn: showUnit,
        showLineTotalColumn: showLT,
      }
    : null;

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

  // Phase 5F — displayNumber/isAttachedChild are placeholders here. The
  // canonical values are filled in by buildQuoteRenderModel/rebuildScheduleItems
  // after a single sequential pass that knows the parent context. We default
  // to a zero-padded 3-digit number (e.g. "001") matching the LJ convention.
  const fallbackDisplayNumber = String(item.itemNumber || index + 1).padStart(3, "0");

  // Phase 5F manual blank preview — emit only for LL (laser) items that
  // are NOT manual procedures and that carry valid length + width
  // dimensions, and only when no uploaded drawing exists. The preview /
  // PDF will draw a simple proportional rectangle outline plus a
  // `<L> x <W>mm` caption in the existing left visual area.
  const manualBlankPreview =
    isLaser && !isManualProc && !drawingUrl && item.width > 0 && item.height > 0
      ? { lengthMm: item.width, widthMm: item.height }
      : null;

  return {
    index,
    itemNumber: item.itemNumber || index + 1,
    itemRef: item.itemRef || item.title || `Item ${index + 1}`,
    title: `Item ${fallbackDisplayNumber} — ${item.itemRef || item.title || `Item ${index + 1}`}`,
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
      drawingLabel: `Drawing — Item ${fallbackDisplayNumber}`,
      customerPhotos,
    },
    displayNumber: fallbackDisplayNumber,
    isAttachedChild: false,
    parentDisplayNumber: undefined,
    attachedOperations: [],
    manualBlankPreview,
    pricingDisplay,
  };
}

// Phase 5F polish — derive a compact RenderAttachedOperation from an
// attached procedure QuoteDocumentItem. Customer-safe; reads only public
// procedure fields and the snapshot sell totals (already governed at
// quote-document.ts level). Pricing labels are emitted only when the
// caller passes the corresponding display flag.
function buildAttachedOperation(
  docItem: QuoteDocumentItem,
  showLineUnitPrice: boolean,
  showLineTotal: boolean,
  showOperationPricing: boolean,
): RenderAttachedOperation {
  const sv = (docItem.specValues || {}) as Record<string, unknown>;
  const procedureType = String(sv.procedureType ?? "").trim() || "Procedure";
  const description = String(sv.procedureDescription ?? "").trim();
  const qty = Math.max(1, Number(docItem.quantity) || 1);
  const sellTotal = Number(sv.sellTotal) || 0;
  const manualUnitSell = Number(sv.manualUnitSell);
  const unitPriceVal = Number.isFinite(manualUnitSell) && manualUnitSell > 0
    ? manualUnitSell
    : (sellTotal > 0 ? sellTotal / qty : 0);
  // Phase 5F card-tightening — operation pricing is gated by BOTH the
  // standard line-pricing toggle (showLineUnitPrice / showLineTotal) AND
  // the new showOperationPricing toggle. When showOperationPricing is
  // false the customer sees the operation description / qty only and the
  // operation value is implicitly absorbed into the parent item / quote
  // subtotal — no math change, just display aggregation.
  return {
    procedureType,
    description,
    quantity: qty,
    unitPriceLabel: showOperationPricing && showLineUnitPrice && unitPriceVal > 0
      ? `$${fmtCurrency(unitPriceVal)} ea`
      : null,
    lineTotalLabel: showOperationPricing && showLineTotal && sellTotal > 0
      ? `$${fmtCurrency(sellTotal)}`
      : null,
    // Phase 5F.1 — numeric line total ALWAYS populated so parent's Item
    // Total can sum operation values regardless of toggle state.
    lineTotal: sellTotal,
  };
}

// Phase 5F — Sub-numbering pass for attached procedures. Mutates each
// schedule item's `displayNumber`, `title`, `media.drawingLabel`,
// `isAttachedChild`, and `parentDisplayNumber` so that:
//   - Each non-attached row receives a fresh zero-padded parent number
//     (001, 002, 003…). Standalone manual procedures with NO parent ref
//     still count as their own top-level row.
//   - Each attached child (category=manual_procedure + attachedToParentRef
//     matching the most recent parent.itemRef) inherits the parent's display
//     number with a suffix letter (a, b, c…). The child counter is reset
//     for every new parent.
// Items are NOT reordered — the snapshot already flattens children
// immediately after their parent. Parent itemNumber is left intact for
// internal references; only the human-readable labels change.
// Phase 5F — proper spreadsheet-style alpha suffix generator.
// 0->"a", 25->"z", 26->"aa", 27->"ab", 51->"az", 52->"ba", 701->"zz",
// 702->"aaa", etc. Used for attached procedure sub-numbering so we never
// emit non-alpha chars when more than 26 procedures are attached.
function toAlphaSuffix(zeroBasedIndex: number): string {
  let n = zeroBasedIndex;
  let s = "";
  while (true) {
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
    if (n < 0) break;
  }
  return s;
}

// Phase 5F polish — single pass that:
//   1. Re-numbers parent schedule items 001/002/003… (standalone manual
//      procedures with no attachedToParentRef count as their own parent
//      and remain rendered as separate cards).
//   2. Collapses each attached child (category=manual_procedure +
//      attachedToParentRef matching the most recent parent.itemRef) into
//      the parent's `attachedOperations` array as a compact row.
//   3. Returns the set of documentItem indices that have been collapsed
//      into their parent so the caller can filter them out of the
//      top-level scheduleItems list (preventing duplicate display while
//      preserving snapshot totals which are computed independently).
//   4. Defensive fallback: an attached row with NO resolvable parent
//      (orphan) keeps rendering as its own card with isAttachedChild=true
//      so we never silently drop billable lines.
// NOTE: snapshot totals (subtotal/GST/total) are computed in
// quote-document.ts from snapshot.totalsBreakdown, NOT from this list, so
// filtering children here cannot change customer-visible totals.
// Phase 5F card-tightening — extra `showOperationPricing` flag is
// threaded through so attached operations can suppress their unit/line
// price labels independently from the parent line-pricing toggles.
function applyAttachedProcedureNumbering(
  scheduleItems: RenderScheduleItem[],
  documentItems: QuoteDocumentItem[],
  showLineUnitPrice: boolean,
  showLineTotal: boolean,
  showOperationPricing: boolean,
): Set<number> {
  const collapsedIndices = new Set<number>();
  let parentCounter = 0;
  let parentRef: string | null = null;
  let parentDisplayNumber = "";
  let parentSchedIndex = -1;

  for (let i = 0; i < scheduleItems.length; i++) {
    const docItem = documentItems[i];
    const sched = scheduleItems[i];
    const isAttached = !!(docItem.isManualProcedure
      && docItem.attachedToParentRef
      && parentRef
      && docItem.attachedToParentRef === parentRef
      && parentSchedIndex >= 0);

    if (isAttached) {
      // Collapse into parent's compact operations block — do NOT emit a
      // separate card, do NOT advance the parent counter, do NOT touch
      // child sched.title (will be filtered out anyway).
      const op = buildAttachedOperation(docItem, showLineUnitPrice, showLineTotal, showOperationPricing);
      scheduleItems[parentSchedIndex].attachedOperations.push(op);
      collapsedIndices.add(i);
    } else {
      parentCounter += 1;
      parentRef = docItem.itemRef || sched.itemRef;
      parentDisplayNumber = String(parentCounter).padStart(3, "0");
      parentSchedIndex = i;
      sched.displayNumber = parentDisplayNumber;
      // Orphan defensive flag: if this row is an attached procedure whose
      // parent could not be resolved (parent missing / out of order), mark
      // isAttachedChild=true so the renderer applies the small fallback
      // indent. The row still renders as its own card so the billable line
      // is never silently dropped.
      sched.isAttachedChild = !!(docItem.isManualProcedure && docItem.attachedToParentRef);
      sched.parentDisplayNumber = undefined;
      sched.title = `Item ${parentDisplayNumber} — ${sched.itemRef}`;
      sched.media = { ...sched.media, drawingLabel: `Drawing — Item ${parentDisplayNumber}` };
    }
  }
  return collapsedIndices;
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
    scheduleItems: (() => {
      const items = doc.items.map((item, idx) =>
        buildScheduleItem(item, idx, doc.specDisplay.effectiveKeys, specKeyToLabel, doc.domainType, doc.totalsDisplayConfig)
      );
      // Phase 5F polish — re-number parents 001/002/003… and collapse
      // attached procedures into their parent's `attachedOperations` block.
      // Children are filtered out of the top-level list so they render as
      // compact rows inside the parent card (Preview + PDF) instead of
      // separate cards. Snapshot totals are unaffected.
      const collapsed = applyAttachedProcedureNumbering(
        items,
        doc.items,
        doc.totalsDisplayConfig.showLineUnitPrice === true,
        doc.totalsDisplayConfig.showLineTotal === true,
        doc.totalsDisplayConfig.showOperationPricing === true,
      );
      return items.filter((_, idx) => !collapsed.has(idx));
    })(),
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
  const items = doc.items.map((item, idx) =>
    buildScheduleItem(item, idx, effectiveKeys, specKeyToLabel, doc.domainType, doc.totalsDisplayConfig)
  );
  // Phase 5F polish — keep parity with buildQuoteRenderModel: collapse
  // attached procedures into parent operations and filter children out
  // so the live preview's spec-display edits stay consistent.
  const collapsed = applyAttachedProcedureNumbering(
    items,
    doc.items,
    doc.totalsDisplayConfig.showLineUnitPrice === true,
    doc.totalsDisplayConfig.showLineTotal === true,
    doc.totalsDisplayConfig.showOperationPricing === true,
  );
  return items.filter((_, idx) => !collapsed.has(idx));
}
