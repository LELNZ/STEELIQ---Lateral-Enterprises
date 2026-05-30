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
  // Optional ASCII / Latin-1-only override used by the PDF renderer.
  // jsPDF's helvetica encoder is Latin-1 only — characters such as the
  // em-dash (\u2014) render as garbage glyphs (e.g. `!³`). When a spec
  // value contains non-Latin-1 characters intentionally for the
  // browser Preview (which renders unicode fine), populate `pdfValue`
  // with the ASCII-safe equivalent so the PDF stays clean.
  pdfValue?: string;
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

// Phase 5F.2 — compact, supplier-style commercial pricing block for an
// LL parent item. The customer-facing Unit Price / Line Total fields
// are the COMBINED values (parent laser-blank sell + sum of attached
// operation sells). Parent-only values are retained for the optional
// nested operation breakdown that appears under the spec block when
// the showOperationPricing toggle is ON.
//
// Numeric fields are always populated so totals can be summed
// regardless of toggle state. Label / column visibility mirror the
// per-revision Quote Display Settings toggles.
//
// Customer-safe: never carries cost / margin / supplier / bucket /
// internal-notes data. Snapshot subtotal is computed independently in
// quote-document.ts from snapshot.totalsBreakdown — these display
// values do not affect quote totals.
//
// FUTURE: when quantity-break presentation is enabled, an optional
// `quantityBreaks?: { qty: number; unitPrice: number; lineTotal: number }[]`
// field will sit alongside `combinedUnitPrice` / `combinedLineTotal`,
// rendered as a small table in the same compact pricing block. NOT
// implemented in Phase 5F.2 — see replit.md "Quantity-Break Future
// Design" for the planned customer layout.
export interface RenderPricingDisplay {
  description: string;             // e.g. "Laser cut blank"
  quantity: number;                // parent quantity

  // Parent-only values (used for the optional nested op breakdown).
  unitPrice: number;               // parent unit sell (always populated)
  lineTotal: number;               // parent line sell (always populated)
  unitPriceLabel: string | null;   // formatted when showLineUnitPrice
  lineTotalLabel: string | null;   // formatted when showLineTotal

  // Phase 5F.2 — combined customer-facing display values
  // = parent + Σ attached operation sell values.
  // For a parent with no ops these equal the parent values.
  combinedUnitPrice: number;       // = combinedLineTotal / quantity
  combinedLineTotal: number;       // = parent.lineTotal + Σ ops.lineTotal
  combinedUnitPriceLabel: string | null;  // formatted when showLineUnitPrice
  combinedLineTotalLabel: string | null;  // formatted when showLineTotal

  showUnitPriceColumn: boolean;    // mirrors showLineUnitPrice
  showLineTotalColumn: boolean;    // mirrors showLineTotal
  // Phase 5F.2 — controls whether the small nested operation $
  // breakdown ("- Laser cut blank: $945.64", "- Folding: $80.00")
  // is shown under the spec block. Operations themselves still
  // display description + qty even when this is off.
  showOperationPricing: boolean;
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
  // Phase 5F.2 — synthesized operations summary row (added by
  // applyAttachedProcedureNumbering after ops are collapsed into the
  // parent). Renders inside the spec block so attached operations
  // read as part of the item's description, supplier-style.
  operations: "Operations",
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

  // Phase 5F.4 — compact enterprise spec layout for LL parent items:
  // collapse Material / Grade / Thickness / Finish into ONE row
  // ("Aluminium 5052 · 3mm · Fibre PE") and emit a single Dimensions
  // row. Pricing / Detail / Operations rows are appended later by
  // finaliseParentDisplay() so all five rows render through the same
  // spec-table code path on Preview AND PDF (perfect parity).
  //
  // Manual-procedure laser items (rendered as their own card) keep the
  // legacy per-key listing because they don't have material data and
  // their visible fields are intentionally minimal.
  //
  // Non-laser items continue to use the dictionary-driven displayKeys
  // path — unchanged.
  const isLaserParent = isLaser && item.category !== "manual_procedure";

  const buildLaserParentSpecs = (): RenderSpecEntry[] => {
    const out: RenderSpecEntry[] = [];
    // Material row — combines materialType + materialGrade · thickness · finish.
    // Each part is optional; the row is hidden if everything is missing.
    const mt = (specs.materialType || "").toString().trim();
    const mg = (specs.materialGrade || "").toString().trim();
    const th = (specs.thickness || "").toString().trim();
    const fi = (specs.finish || "").toString().trim();
    const matLeading = mt && mg ? `${mt} ${mg}` : (mt || mg);
    const matParts = [matLeading, th, fi].filter(p => p && p.length > 0);
    if (matParts.length > 0) {
      out.push({ key: "material", label: "Material", value: matParts.join(" \u00B7 ") });
    }
    // Dimensions row — prefer the pre-formatted `dimensions` value;
    // fall back to length/width singletons if only one is present.
    const dims = (specs.dimensions || "").toString().trim();
    if (dims) {
      out.push({ key: "dimensions", label: "Dimensions", value: dims });
    } else if (specs.length || specs.width) {
      const dval = specs.length && specs.width
        ? `${specs.length} x ${specs.width}`
        : (specs.length || specs.width);
      out.push({ key: "dimensions", label: "Dimensions", value: dval });
    }
    // Customer notes (if present) — kept as a separate row so the
    // multi-line content doesn't pollute the compact Material line.
    if (specs.customerNotes) {
      out.push({ key: "customerNotes", label: "Notes", value: specs.customerNotes });
    }
    return out;
  };

  const visibleSpecs: RenderSpecEntry[] = isLaserParent
    ? buildLaserParentSpecs()
    : isLaser
      ? Object.entries(specs)
          .filter(([k, v]) => v && v !== "" && v !== "0" && k !== "unitPrice" && k !== "lineTotal")
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
  // Phase 5F.2 — combined values are seeded equal to the parent values
  // here. After applyAttachedProcedureNumbering() collapses ops into the
  // parent, the combined values are recomputed to include op sell totals
  // (combinedLineTotal = parent + Σ ops; combinedUnitPrice = combined /
  // parentQty). Doing it post-collapse keeps the math in one place.
  const showOps = !!(totalsCfg?.showOperationPricing);
  const pricingDisplay: RenderPricingDisplay | null = isParentLaserItem
    ? {
        description: "Fibre laser cut component",
        quantity: parentQty,
        unitPrice: parentUnitPrice,
        lineTotal: parentLineTotal,
        unitPriceLabel: showUnit && parentUnitPrice > 0 ? `$${fmtCurrency(parentUnitPrice)} ea` : null,
        lineTotalLabel: showLT && parentLineTotal > 0 ? `$${fmtCurrency(parentLineTotal)}` : null,
        combinedUnitPrice: parentUnitPrice,
        combinedLineTotal: parentLineTotal,
        combinedUnitPriceLabel: showUnit && parentUnitPrice > 0 ? `$${fmtCurrency(parentUnitPrice)} ea` : null,
        combinedLineTotalLabel: showLT && parentLineTotal > 0 ? `$${fmtCurrency(parentLineTotal)}` : null,
        showUnitPriceColumn: showUnit,
        showLineTotalColumn: showLT,
        showOperationPricing: showOps,
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
      // Phase 5F.2 — finalise the previous parent (if any) BEFORE we
      // advance to a new parent. This rolls combined values for the
      // closed-out parent and pushes its synthesized "Operations" spec
      // row using the ops we just collected for it. Doing this here
      // (rather than after every isAttached push) keeps the work in
      // one place per parent and avoids repeated mutation churn.
      if (parentSchedIndex >= 0) {
        finaliseParentDisplay(scheduleItems[parentSchedIndex], showLineUnitPrice, showLineTotal);
      }
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
  // Phase 5F.2 — finalise the very last parent in the list so its
  // combined values + Operations spec row are populated. Mirrors the
  // finalise-on-new-parent step inside the loop.
  if (parentSchedIndex >= 0) {
    finaliseParentDisplay(scheduleItems[parentSchedIndex], showLineUnitPrice, showLineTotal);
  }
  return collapsedIndices;
}

// Phase 5F.2 — once a parent's full set of attached operations has
// been collected, recompute the combined customer-facing display
// values on its pricingDisplay and synthesize a single "Operations"
// row in its visibleSpecs that summarises the operations as part of
// the description block (e.g. "Folding — 4 folds per item;
// Deburring; Tapping — M6×3"). The summary uses an em-dash for
// Preview readability — the PDF re-renders its own ASCII-safe
// version inline so jsPDF helvetica's Latin-1 encoder cannot mangle
// the dash. Snapshot totals are unaffected.
function finaliseParentDisplay(
  sched: RenderScheduleItem,
  showLineUnitPrice: boolean,
  showLineTotal: boolean,
): void {
  const ops = sched.attachedOperations;
  // Recompute combined values on parent.pricingDisplay (LL only).
  if (sched.pricingDisplay) {
    const pd = sched.pricingDisplay;
    const opsTotal = ops.reduce((s, o) => s + (o.lineTotal || 0), 0);
    const combinedLineTotal = pd.lineTotal + opsTotal;
    const qty = Math.max(1, pd.quantity || 1);
    const combinedUnitPrice = combinedLineTotal / qty;
    pd.combinedLineTotal = combinedLineTotal;
    pd.combinedUnitPrice = combinedUnitPrice;
    pd.combinedUnitPriceLabel = showLineUnitPrice && combinedUnitPrice > 0
      ? `$${fmtCurrency(combinedUnitPrice)} ea`
      : null;
    pd.combinedLineTotalLabel = showLineTotal && combinedLineTotal > 0
      ? `$${fmtCurrency(combinedLineTotal)}`
      : null;
  }
  // Phase 5G — the customer-facing LL surface now uses an enterprise
  // schedule TABLE (see LaserScheduleTable in quote-preview.tsx and
  // renderLaserScheduleTable in pdf-engine.ts). Operations / Pricing /
  // Detail are rendered as dedicated table columns + an optional Detail
  // sub-row, sourced directly from `attachedOperations` and
  // `pricingDisplay` via `extractLaserTableRow()`. Therefore we no
  // longer synthesize Operations / Pricing / Detail spec rows here.
  // The `combinedUnitPrice` / `combinedLineTotal` recompute above is
  // still essential because `extractLaserTableRow()` reads those
  // values directly. `visibleSpecs` for laser parents still carries
  // the compact Material / Dimensions / Notes rows from
  // `buildLaserParentSpecs()` which the table cells consume.
}

// Phase 5G — extract the per-row data needed by the customer-facing
// LL schedule table. Pulls from `visibleSpecs` (Material / Dimensions /
// Notes), `pricingDisplay` (Qty / Unit Price / Line Total / Detail),
// and `attachedOperations` (Operations cell + Detail breakdown).
//
// Two text variants are produced for Operations and Detail because
// Preview renders an em-dash (typographic polish) while the PDF must
// stay strictly ASCII / Latin-1 safe (jsPDF helvetica encoder).
//
// Customer-safe — only sell-side toggle-governed values are surfaced;
// no cost / margin / supplier / bucket / internal-notes data.
export interface LaserTableRow {
  index: number;
  displayNumber: string;
  title: string;
  material: string;
  dimensions: string;
  qty: number;
  qtyLabel: string;
  operationsPreview: string;   // em-dash for Preview (legacy)
  operationsPdf: string;       // ASCII " - " for PDF (legacy)
  hasOperations: boolean;
  unitPriceLabel: string | null;  // null when toggle off
  lineTotalLabel: string | null;  // null when toggle off
  detailPreview: string | null;   // "Included pricing detail: Blank $X - Folding $Y" — null when hidden
  detailPdf: string | null;       // identical text in both surfaces (Phase 5H.1 parity)
  notes: string;
  showOperationPricing: boolean;
  // Phase 5H.0 — hybrid 7-column table additions.
  // `itemRefLine` is the first line of the Item / Description cell
  // ("Item 001 — LC-001"). PDF variant uses ASCII " - " separator.
  itemRefLine: string;
  itemRefLinePdf: string;
  // `materialPrimary` is the leading material+grade ("Aluminium 5052").
  // `materialSecondary` is the joined thickness/finish suffix
  // ("3mm · Fibre PE"). PDF variant uses ASCII " - ".
  materialPrimary: string;
  materialSecondary: string;
  materialSecondaryPdf: string;
  // `opsSummaryPreview` is the third line of the Item / Description cell
  // when operations exist ("Folding, Deburring, Tapping" or
  // "Folding — 4 folds per item, Deburring"). PDF variant uses ASCII.
  // Empty string when no operations.
  opsSummaryPreview: string;
  opsSummaryPdf: string;
}

export function extractLaserTableRow(item: RenderScheduleItem): LaserTableRow {
  const findSpec = (key: string): string =>
    (item.visibleSpecs.find(s => s.key === key)?.value || "").toString();
  const ops = item.attachedOperations;
  const pd = item.pricingDisplay;

  const operationsPreview = ops
    .map(op => op.description ? `${op.procedureType} \u2014 ${op.description}` : op.procedureType)
    .join("; ");
  const operationsPdf = ops
    .map(op => op.description ? `${op.procedureType} - ${op.description}` : op.procedureType)
    .join("; ");

  // Phase 5H.10 — customer-facing operations label for the
  // Item / Description cell. Internal terms ("Ops", procedure
  // descriptions, manual/child/attached) must NOT appear in customer
  // Preview/PDF. We emit a concise, professional single line:
  // "Additional operation: Folding" (singular) or
  // "Additional operations: Folding, Deburring" (plural). Preview and
  // PDF share this exact string so wording parity is guaranteed.
  // Empty string when no ops so callers can branch cleanly.
  const friendlyOpName = (raw: string): string => {
    const s = (raw || "").toString().trim();
    if (!s) return "Operation";
    // A label that already carries an uppercase letter is treated as a
    // friendly display name and used as-is; otherwise fall back to a
    // safe title-cased rendering of the code (e.g. "edge_deburr").
    if (/[A-Z]/.test(s)) return s;
    return s.replace(/[_-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };
  const opNames = ops.map(op => friendlyOpName(op.procedureType));
  const opsSummaryPreview = opNames.length === 0
    ? ""
    : `Additional operation${opNames.length > 1 ? "s" : ""}: ${opNames.join(", ")}`;
  const opsSummaryPdf = opsSummaryPreview;

  const fmtMoney = (n: number) => `$${fmtCurrency(n)}`;
  let detailPreview: string | null = null;
  let detailPdf: string | null = null;
  const showOperationPricing = !!pd?.showOperationPricing;
  if (
    pd && showOperationPricing && ops.length > 0
    && (pd.showUnitPriceColumn || pd.showLineTotalColumn)
  ) {
    const parts = [
      `Blank ${fmtMoney(pd.lineTotal)}`,
      ...ops.map(op => `${op.procedureType} ${fmtMoney(op.lineTotal || 0)}`),
    ];
    // Phase 5H.1 — both surfaces use ASCII " - " between parts to
    // guarantee strict WYSIWYG parity (Preview previously used a
    // typographic middot, PDF used " - "; differing glyphs broke
    // visual parity even when the commercial meaning matched).
    // Phase 5H.1 — label rebranded "Included pricing detail:" so
    // the customer reads it as an explanatory breakdown of the
    // already-charged Unit/Total figures, NOT as additional fees.
    detailPreview = `Included pricing detail: ${parts.join(" - ")}`;
    detailPdf = `Included pricing detail: ${parts.join(" - ")}`;
  }

  // Phase 5H.0 — split the joined Material spec back into a
  // primary line ("Aluminium 5052") and a secondary line
  // ("3mm · Fibre PE") for the two-line Material / Spec cell.
  // The source is `material = matLeading · thickness · finish`
  // (see buildLaserParentSpecs above); splitting on " \u00B7 "
  // preserves single-line behaviour when only one part exists.
  const materialFull = findSpec("material");
  const matSplit = materialFull.split(" \u00B7 ");
  const materialPrimary = matSplit[0] || "";
  const materialSecondary = matSplit.slice(1).join(" \u00B7 ");
  const materialSecondaryPdf = matSplit.slice(1).join(" - ");

  // Phase 5H.0 — Item / Description first line: "Item 001 — LC-001".
  // Falls back to just "Item 001" when no itemRef is present.
  const ref = (item.itemRef || "").toString().trim();
  const itemRefLine = ref
    ? `Item ${item.displayNumber} \u2014 ${ref}`
    : `Item ${item.displayNumber}`;
  const itemRefLinePdf = ref
    ? `Item ${item.displayNumber} - ${ref}`
    : `Item ${item.displayNumber}`;

  // Phase 5H.0 — Item / Description second line is the actual
  // human-readable product description. `item.title` is composed by
  // buildScheduleItem() / applyAttachedProcedureNumbering() as
  // "Item NNN — REF" (i.e. the same content as itemRefLine), so we
  // can NOT use it as the description. The real description lives on
  // `pricingDisplay.description` (e.g. "Fibre laser cut component") for laser
  // parents. Fallback to the customer notes or the bare ref so the
  // cell never collapses to a duplicate identifier.
  const description = (pd?.description || "").toString().trim()
    || findSpec("customerNotes")
    || ref
    || "";

  return {
    index: item.index,
    displayNumber: item.displayNumber,
    title: description,
    material: materialFull,
    dimensions: findSpec("dimensions"),
    qty: pd?.quantity ?? Math.max(1, parseInt(item.quantityLabel.replace(/\D/g, ""), 10) || 1),
    qtyLabel: item.quantityLabel,
    operationsPreview,
    operationsPdf,
    hasOperations: ops.length > 0,
    unitPriceLabel: pd?.combinedUnitPriceLabel ?? null,
    lineTotalLabel: pd?.combinedLineTotalLabel ?? null,
    detailPreview,
    detailPdf,
    notes: findSpec("customerNotes"),
    showOperationPricing,
    itemRefLine,
    itemRefLinePdf,
    materialPrimary,
    materialSecondary,
    materialSecondaryPdf,
    opsSummaryPreview,
    opsSummaryPdf,
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
