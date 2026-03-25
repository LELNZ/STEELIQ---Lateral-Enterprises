import { jsPDF } from "jspdf";

const PW = 210;
const PH = 297;
const LM = 18;
const RM = 18;
const TM = 20;
const BM = 20;
const CW = PW - LM - RM;
const MAX_Y = PH - BM;

const FONT = "helvetica";
const CLR = "#1a1a1a";
const CLR_MUTED = "#666666";
const CLR_ACCENT = "#1d4ed8";
const CLR_BORDER = "#d1d5db";
const CLR_BG = "#f3f4f6";

type ScopeMode = "renovation" | "new_build";
type WorkPackage = "install_only" | "removal_disposal_install";
type ThreeWay = "included" | "excluded" | "price_separately";
type FlashingOption = "included" | "excluded" | "supplied_by_others" | "price_separately";
type MakingGoodOption = "by_others" | "included" | "excluded";
type AccessCondition = "standard" | "restricted" | "upper_level" | "scaffold_required";
type TwoWay = "included" | "excluded";

export interface ScopeFields {
  sealant: ThreeWay;
  flashings: FlashingOption;
  wanzBars: ThreeWay;
  siteCleanup: TwoWay;
  makingGood: MakingGoodOption;
  accessCondition: AccessCondition;
  includeVariationChecklist: boolean;
}

export interface SubcontractorPdfItem {
  name: string;
  category: string;
  location?: string;
  width: number;
  height: number;
  quantity: number;
  layout?: string;
  notes?: string;
  drawingDataUrl?: string | null;
  photoDataUrls?: string[];
  fulfilmentSource?: "in-house" | "outsourced";
  rakedLeftHeight?: number;
  rakedRightHeight?: number;
}

export type ItemFilter = "all" | "outsourced_only" | "in_house_only";
export type DocumentPurpose = "install_scope" | "supply_rfq";

export interface SubcontractorPdfOptions {
  scopeMode: ScopeMode;
  workPackage: WorkPackage;
  scopeFields: ScopeFields;
  documentPurpose?: DocumentPurpose;
  projectName: string;
  siteAddress?: string;
  clientName?: string;
  dateIssued: string;
  preparedBy?: string;
  items: SubcontractorPdfItem[];
  itemFilter?: ItemFilter;
  includeDrawings: boolean;
  includeSitePhotos: boolean;
  includePricingReturn: boolean;
  sitePhotoDataUrls?: string[];
}

let pageCountRef = { count: 0 };
let activePurpose: DocumentPurpose = "install_scope";

function ensureSpace(pdf: jsPDF, y: number, needed: number): number {
  if (y + needed > MAX_Y) {
    pdf.addPage();
    drawFooter(pdf);
    return TM;
  }
  return y;
}

function drawFooter(pdf: jsPDF) {
  pageCountRef.count++;
  pdf.setFont(FONT, "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(CLR_MUTED);
  const footerText = activePurpose === "supply_rfq"
    ? "Supply / Fabrication RFQ \u2014 Issued for supplier pricing only. Not a contract or purchase order."
    : "Subcontractor Install Scope \u2014 Issued for pricing only. Not a contract document.";
  pdf.text(footerText, LM, PH - 10);
  pdf.text(`Page ${pageCountRef.count}`, PW - RM, PH - 10, { align: "right" });
}

function drawLine(pdf: jsPDF, y: number) {
  pdf.setDrawColor(CLR_BORDER);
  pdf.setLineWidth(0.3);
  pdf.line(LM, y, PW - RM, y);
}

function wrapText(pdf: jsPDF, text: string, maxW: number): string[] {
  return pdf.splitTextToSize(text, maxW) as string[];
}

const SCOPE_FIELD_LABELS: Record<string, string> = {
  included: "Included",
  excluded: "Excluded",
  price_separately: "Price separately",
  supplied_by_others: "Supplied by others",
  by_others: "By others",
  standard: "Standard (ground level)",
  restricted: "Restricted access",
  upper_level: "Upper level / height work",
  scaffold_required: "Scaffold likely / required",
  install_only: "Install only",
  removal_disposal_install: "Removal + disposal + install",
};

const CATEGORY_LABELS: Record<string, string> = {
  "windows-standard": "Window",
  "sliding-window": "Sliding Window",
  "sliding-door": "Sliding Door",
  "entrance-door": "Entrance Door",
  "hinge-door": "Hinge Door",
  "french-door": "French Door",
  "bifold-door": "Bi-fold Door",
  "stacker-door": "Stacker Door",
  "bay-window": "Bay Window",
  "raked-fixed": "Raked Fixed Window",
};

const MAKING_GOOD_LABELS: Record<string, string> = {
  by_others: "By others (builder)",
  included: "Included",
  excluded: "Excluded",
};

function applyItemFilter(items: SubcontractorPdfItem[], filter: ItemFilter): SubcontractorPdfItem[] {
  if (filter === "outsourced_only") return items.filter(it => (it.fulfilmentSource || "in-house") === "outsourced");
  if (filter === "in_house_only") return items.filter(it => (it.fulfilmentSource || "in-house") === "in-house");
  return items;
}

function formatDimension(item: SubcontractorPdfItem): string {
  if (item.category === "raked-fixed" && item.rakedLeftHeight && item.rakedRightHeight) {
    return `${item.width}W \u00D7 ${item.rakedLeftHeight}/${item.rakedRightHeight}H (L/R)`;
  }
  return `${item.width}\u00D7${item.height}`;
}

export async function generateSubcontractorPdf(opts: SubcontractorPdfOptions): Promise<jsPDF> {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  pageCountRef = { count: 0 };
  const purpose = opts.documentPurpose || "install_scope";
  activePurpose = purpose;

  const filter = opts.itemFilter || "all";
  const filteredOpts = { ...opts, items: applyItemFilter(opts.items, filter) };

  if (purpose === "supply_rfq") {
    let y = renderRfqPageOne(pdf, filteredOpts);
    y = renderRfqRequirements(pdf, filteredOpts, y);
    y = renderItemSchedule(pdf, filteredOpts, y);
    if (filteredOpts.includeDrawings || filteredOpts.includeSitePhotos) {
      await renderDrawingGrid(pdf, filteredOpts);
    }
    if (filteredOpts.includePricingReturn) {
      pdf.addPage();
      drawFooter(pdf);
      renderRfqPricingReturn(pdf, filteredOpts);
    }
  } else {
    let y = renderPageOne(pdf, filteredOpts);
    y = renderScopeDetails(pdf, filteredOpts, y);
    y = renderItemSchedule(pdf, filteredOpts, y);
    if (filteredOpts.includeDrawings || filteredOpts.includeSitePhotos) {
      await renderDrawingGrid(pdf, filteredOpts);
    }
    if (filteredOpts.includePricingReturn) {
      pdf.addPage();
      drawFooter(pdf);
      renderPricingReturn(pdf, filteredOpts);
    }
  }

  return pdf;
}

function renderPageOne(pdf: jsPDF, opts: SubcontractorPdfOptions): number {
  drawFooter(pdf);
  let y = TM;

  pdf.setFont(FONT, "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(CLR_ACCENT);
  pdf.text("SUBCONTRACTOR INSTALL SCOPE", LM, y);
  y += 3;

  pdf.setDrawColor(CLR_ACCENT);
  pdf.setLineWidth(0.8);
  pdf.line(LM, y, LM + 50, y);
  y += 6;

  pdf.setFont(FONT, "italic");
  pdf.setFontSize(7.5);
  pdf.setTextColor(CLR_MUTED);
  pdf.text("Issued for subcontractor installation pricing only. This is not a contract document.", LM, y);
  y += 7;

  const scopeBadge = opts.scopeMode === "renovation" ? "RENOVATION" : "NEW BUILD";
  const scopeBadgeW = pdf.getTextWidth(scopeBadge) + 8;
  pdf.setFillColor(opts.scopeMode === "renovation" ? "#fef3c7" : "#dbeafe");
  pdf.roundedRect(LM, y - 4, scopeBadgeW, 7, 1.5, 1.5, "F");
  pdf.setFont(FONT, "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(opts.scopeMode === "renovation" ? "#92400e" : "#1e40af");
  pdf.text(scopeBadge, LM + 4, y);

  const wpLabel = opts.workPackage === "removal_disposal_install" ? "REMOVAL + DISPOSAL + INSTALL" : "INSTALL ONLY";
  const wpX = LM + scopeBadgeW + 4;
  const wpW = pdf.getTextWidth(wpLabel) + 8;
  pdf.setFillColor("#f0fdf4");
  pdf.roundedRect(wpX, y - 4, wpW, 7, 1.5, 1.5, "F");
  pdf.setTextColor("#166534");
  pdf.text(wpLabel, wpX + 4, y);

  const filter = opts.itemFilter || "all";
  if (filter !== "all") {
    const filterLabel = filter === "outsourced_only" ? "OUTSOURCED ITEMS" : "IN-HOUSE ITEMS";
    const filterX = wpX + wpW + 4;
    const filterW = pdf.getTextWidth(filterLabel) + 8;
    pdf.setFillColor(filter === "outsourced_only" ? "#fef2f2" : "#f0fdf4");
    pdf.roundedRect(filterX, y - 4, filterW, 7, 1.5, 1.5, "F");
    pdf.setTextColor(filter === "outsourced_only" ? "#991b1b" : "#166534");
    pdf.text(filterLabel, filterX + 4, y);
  }
  y += 8;

  const itemCountLabel = filter === "outsourced_only"
    ? `${opts.items.length} outsourced item${opts.items.length !== 1 ? "s" : ""}`
    : filter === "in_house_only"
      ? `${opts.items.length} in-house item${opts.items.length !== 1 ? "s" : ""}`
      : `${opts.items.length} item${opts.items.length !== 1 ? "s" : ""}`;

  const leftFields: [string, string | undefined][] = [
    ["Project", opts.projectName],
    ["Site Address", opts.siteAddress],
    ["Client / Builder", opts.clientName],
  ];
  const rightFields: [string, string | undefined][] = [
    ["Date Issued", opts.dateIssued],
    ["Prepared By", opts.preparedBy],
    ["Items", itemCountLabel],
  ];

  pdf.setFontSize(8);
  const halfW = CW / 2;
  const fieldRowH = 5.5;
  const startFieldY = y;
  for (const [label, value] of leftFields) {
    if (!value) continue;
    pdf.setFont(FONT, "bold");
    pdf.setTextColor(CLR_MUTED);
    pdf.text(`${label}:`, LM, y);
    pdf.setFont(FONT, "normal");
    pdf.setTextColor(CLR);
    const wrapped = wrapText(pdf, value, halfW - 30);
    pdf.text(wrapped[0], LM + 28, y);
    y += fieldRowH;
  }
  let ry = startFieldY;
  const rx = LM + halfW + 4;
  for (const [label, value] of rightFields) {
    if (!value) continue;
    pdf.setFont(FONT, "bold");
    pdf.setTextColor(CLR_MUTED);
    pdf.text(`${label}:`, rx, ry);
    pdf.setFont(FONT, "normal");
    pdf.setTextColor(CLR);
    pdf.text(value, rx + 25, ry);
    ry += fieldRowH;
  }
  y = Math.max(y, ry) + 4;

  drawLine(pdf, y);
  y += 6;

  pdf.setFont(FONT, "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(CLR);
  pdf.text("SCOPE SUMMARY", LM, y);
  y += 5;

  const sf = opts.scopeFields;
  const matrixRows: [string, string][] = [
    ["Scope Type", opts.scopeMode === "renovation" ? "Renovation" : "New Build"],
    ["Work Package", SCOPE_FIELD_LABELS[opts.workPackage]],
    ["Sealant", SCOPE_FIELD_LABELS[sf.sealant]],
    ["Flashings", SCOPE_FIELD_LABELS[sf.flashings]],
    ["WANZ Bars / Support", SCOPE_FIELD_LABELS[sf.wanzBars]],
    ["Site Clean-up", SCOPE_FIELD_LABELS[sf.siteCleanup]],
    ["Repairs to Plaster / Trims / Cladding / Finishes", MAKING_GOOD_LABELS[sf.makingGood] || sf.makingGood],
    ["Access Condition", SCOPE_FIELD_LABELS[sf.accessCondition]],
  ];

  const labelW = 62;
  pdf.setFontSize(7.5);
  for (let i = 0; i < matrixRows.length; i++) {
    if (i % 2 === 0) {
      pdf.setFillColor("#f9fafb");
      pdf.rect(LM, y - 3, CW, 5.5, "F");
    }
    pdf.setFont(FONT, "bold");
    pdf.setTextColor(CLR_MUTED);
    pdf.text(matrixRows[i][0], LM + 2, y);
    pdf.setFont(FONT, "normal");
    pdf.setTextColor(CLR);
    pdf.text(matrixRows[i][1], LM + labelW, y);
    y += 5.5;
  }

  y += 4;
  drawLine(pdf, y);
  y += 5;

  return y;
}

function renderScopeDetails(pdf: jsPDF, opts: SubcontractorPdfOptions, startY: number): number {
  let y = startY;
  const sf = opts.scopeFields;

  pdf.setFont(FONT, "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(CLR);
  pdf.text("SCOPE DETAIL", LM, y);
  y += 5;

  const includes: string[] = [];
  if (opts.workPackage === "removal_disposal_install") {
    includes.push("Careful removal of existing units; disposal of removed units and debris from site");
  }
  if (opts.scopeMode === "renovation") {
    includes.push("Installation into existing openings \u2014 pack, level, fix, and seal");
  } else {
    includes.push("Installation into prepared openings \u2014 pack, level, fix, and seal");
  }
  includes.push("Plumbing, levelling, squaring, and mechanical fixing of all units");
  includes.push("Hardware adjustment, operation check, and final clean");
  if (sf.sealant === "included") includes.push("Perimeter sealing with approved sealant");
  if (sf.flashings === "included") includes.push("Supply and install flashings as required");
  if (sf.wanzBars === "included") includes.push("Supply and install WANZ bars / support systems");
  if (sf.siteCleanup === "included") includes.push("Site cleanup of installation debris on completion");
  if (sf.makingGood === "included") includes.push("Repairs to plaster, trims, cladding, and finishes after installation");
  y = renderBulletList(pdf, y, "Includes", includes);

  const excludes: string[] = [];
  excludes.push("Structural alterations or modifications to openings");
  if (sf.makingGood !== "included") excludes.push("Repairs to plaster, trims, cladding, and finishes (by builder)");
  excludes.push("Electrical work including alarm sensors, blinds wiring, or light fittings");
  if (opts.scopeMode === "renovation") excludes.push("Curtain, blind, or security screen removal and reinstatement");
  if (sf.sealant === "excluded") excludes.push("Sealant \u2014 excluded from this scope");
  if (sf.flashings === "excluded") excludes.push("Flashings \u2014 excluded from this scope");
  if (sf.flashings === "supplied_by_others") excludes.push("Flashings \u2014 supplied by others");
  if (sf.wanzBars === "excluded") excludes.push("WANZ bars / support systems \u2014 excluded");
  if (sf.siteCleanup === "excluded") excludes.push("Site cleanup \u2014 excluded from this scope");
  if (sf.accessCondition !== "standard") excludes.push("Scaffolding, EWP, or crane access (unless specifically noted)");
  excludes.push("Consent applications, building inspections, or work outside scheduled items");
  y = renderBulletList(pdf, y, "Excludes", excludes);

  const assumptions: string[] = [];
  if (opts.scopeMode === "renovation") {
    assumptions.push("Existing openings structurally sound and suitable for new joinery");
    assumptions.push("Builder to complete repairs to plaster, trims, cladding, and finishes after installation");
  } else {
    assumptions.push("All openings prepared to correct dimensions, plumb, level, and square");
    assumptions.push("Builder to coordinate sequencing with other trades");
  }
  assumptions.push("Clear access to all installation locations; power and water available on site");
  assumptions.push("Working hours: standard business hours unless agreed otherwise");
  if (sf.accessCondition === "standard") assumptions.push("All units installed at ground level unless otherwise noted");
  if (sf.sealant === "price_separately") assumptions.push("Sealant \u2014 to be priced separately by subcontractor");
  if (sf.flashings === "price_separately") assumptions.push("Flashings \u2014 to be priced separately by subcontractor");
  if (sf.wanzBars === "price_separately") assumptions.push("WANZ bars / support systems \u2014 to be priced separately");
  y = renderBulletList(pdf, y, "Assumptions", assumptions);

  const variations: string[] = [];
  if (opts.scopeMode === "renovation") {
    variations.push("Unexpected framing defects, rot, or structural damage discovered during removal");
    variations.push("Out-of-square or out-of-plumb openings requiring additional packing or trimming");
    variations.push("Hidden services (electrical, plumbing) requiring relocation");
  } else {
    variations.push("Openings not prepared to specified dimensions or not plumb/level/square");
    variations.push("Hidden services requiring relocation");
  }
  variations.push("Access restrictions requiring alternative methods; additional weatherproofing beyond standard");
  variations.push("Delays caused by other trades or site readiness");
  if (sf.accessCondition !== "standard") variations.push("Height access / scaffold costs to be confirmed");
  y = renderBulletList(pdf, y, "Potential Variations", variations);

  if (sf.accessCondition !== "standard") {
    y = ensureSpace(pdf, y, 16);
    pdf.setFont(FONT, "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(CLR_ACCENT);
    pdf.text("Access Note", LM, y);
    y += 4;
    pdf.setFont(FONT, "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(CLR);
    const accessNote = sf.accessCondition === "restricted"
      ? "Restricted site access noted. Subcontractor to confirm delivery/staging arrangements and allow accordingly."
      : sf.accessCondition === "upper_level"
        ? "Upper-level installation \u2014 height access required. Confirm scaffold/EWP requirements. Height safety compliance is installer\u2019s responsibility."
        : "Scaffold is likely or confirmed required. Include scaffold cost or confirm if supplied by others. Height safety is installer\u2019s responsibility.";
    const lines = wrapText(pdf, accessNote, CW);
    for (const ln of lines) {
      y = ensureSpace(pdf, y, 4);
      pdf.text(ln, LM, y);
      y += 3.8;
    }
    y += 3;
  }

  if (opts.scopeMode === "renovation") {
    y = ensureSpace(pdf, y, 14);
    pdf.setFont(FONT, "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(CLR_ACCENT);
    pdf.text("Renovation Considerations", LM, y);
    y += 4;
    const renoNotes = [
      "Occupied dwelling \u2014 additional care and protection may be required",
      "Maintain existing weather seal between removal and install stages; temp protection if staged",
      "Note and protect existing alarm/sensor wiring during removal",
    ];
    for (const note of renoNotes) {
      y = ensureSpace(pdf, y, 4);
      pdf.setFont(FONT, "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(CLR);
      pdf.text(`\u2022 ${note}`, LM + 2, y);
      y += 3.8;
    }
    y += 3;
  }

  return y;
}

function renderBulletList(pdf: jsPDF, startY: number, heading: string, items: string[]): number {
  let y = ensureSpace(pdf, startY, 8 + items.length * 4);

  pdf.setFont(FONT, "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(CLR_ACCENT);
  pdf.text(heading, LM, y);
  y += 4;

  pdf.setFont(FONT, "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(CLR);

  for (const item of items) {
    y = ensureSpace(pdf, y, 4);
    pdf.text("\u2022", LM + 2, y);
    const lines = wrapText(pdf, item, CW - 8);
    for (const line of lines) {
      y = ensureSpace(pdf, y, 3.8);
      pdf.text(line, LM + 6, y);
      y += 3.6;
    }
  }

  y += 3;
  return y;
}

function renderItemSchedule(pdf: jsPDF, opts: SubcontractorPdfOptions, startY: number): number {
  let y = ensureSpace(pdf, startY, 20);

  pdf.setFont(FONT, "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(CLR);
  pdf.text("ITEM SCHEDULE", LM, y);
  y += 3;
  drawLine(pdf, y);
  y += 5;

  const includePriceCol = opts.includePricingReturn;
  const cols = [
    { label: "#", w: 7 },
    { label: "Item Ref", w: 26 },
    { label: "Location", w: 22 },
    { label: "Category", w: 24 },
    { label: "Layout", w: 18 },
    { label: "W\u00D7H (mm)", w: 22 },
    { label: "Qty", w: 9 },
    ...(includePriceCol ? [
      { label: "Price (excl.)", w: 24 },
      { label: "Notes", w: CW - 7 - 26 - 22 - 24 - 18 - 22 - 9 - 24 },
    ] : [
      { label: "Notes", w: CW - 7 - 26 - 22 - 24 - 18 - 22 - 9 },
    ]),
  ];

  y = ensureSpace(pdf, y, 7);
  pdf.setFillColor(CLR_BG);
  pdf.rect(LM, y - 3, CW, 5.5, "F");
  pdf.setFont(FONT, "bold");
  pdf.setFontSize(6.5);
  pdf.setTextColor(CLR_MUTED);
  let cx = LM;
  for (const col of cols) {
    pdf.text(col.label, cx + 1, y);
    cx += col.w;
  }
  y += 4.5;

  pdf.setFont(FONT, "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(CLR);

  for (let i = 0; i < opts.items.length; i++) {
    y = ensureSpace(pdf, y, 5);
    const item = opts.items[i];
    cx = LM;

    const values = [
      String(i + 1),
      item.name || `Item ${i + 1}`,
      item.location || "\u2014",
      CATEGORY_LABELS[item.category] || item.category,
      item.layout || "\u2014",
      formatDimension(item),
      String(item.quantity || 1),
      ...(includePriceCol ? [""] : []),
      item.notes || "",
    ];

    for (let c = 0; c < cols.length; c++) {
      if (includePriceCol && c === cols.length - 2) {
        pdf.setDrawColor(CLR_BORDER);
        pdf.setLineWidth(0.2);
        pdf.line(cx + 1, y + 0.5, cx + cols[c].w - 1, y + 0.5);
      } else {
        const txt = values[c];
        const maxW = cols[c].w - 2;
        const truncated = pdf.splitTextToSize(txt, maxW)[0] || "";
        pdf.text(truncated, cx + 1, y);
      }
      cx += cols[c].w;
    }

    if (i < opts.items.length - 1) {
      pdf.setDrawColor("#e5e7eb");
      pdf.setLineWidth(0.1);
      pdf.line(LM, y + 2, PW - RM, y + 2);
    }
    y += 4.5;
  }

  y += 2;
  pdf.setFont(FONT, "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(CLR_MUTED);
  pdf.text(`Total: ${opts.items.length} item${opts.items.length !== 1 ? "s" : ""}`, LM, y);
  y += 6;

  return y;
}

function loadImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 300, height: 200 });
    img.src = dataUrl;
  });
}

async function renderDrawingGrid(pdf: jsPDF, opts: SubcontractorPdfOptions) {
  const drawItems: { idx: number; item: SubcontractorPdfItem }[] = [];
  for (let i = 0; i < opts.items.length; i++) {
    const item = opts.items[i];
    const hasDrawing = opts.includeDrawings && item.drawingDataUrl;
    const hasPhotos = opts.includeSitePhotos && item.photoDataUrls && item.photoDataUrls.length > 0;
    if (hasDrawing || hasPhotos) {
      drawItems.push({ idx: i, item });
    }
  }
  if (drawItems.length === 0) return;

  const COLS = 3;
  const cellW = (CW - (COLS - 1) * 4) / COLS;
  const drawH = 36;
  const labelH = 18;
  const cellH = drawH + labelH + 4;
  const gutter = 4;

  pdf.addPage();
  drawFooter(pdf);
  let y = TM;

  pdf.setFont(FONT, "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(CLR);
  pdf.text("ITEM DRAWINGS", LM, y);
  y += 3;
  drawLine(pdf, y);
  y += 5;

  let col = 0;
  for (const { idx, item } of drawItems) {
    if (col === 0) {
      y = ensureSpace(pdf, y, cellH + 2);
    }
    const x = LM + col * (cellW + gutter);

    pdf.setDrawColor(CLR_BORDER);
    pdf.setLineWidth(0.2);
    pdf.rect(x, y, cellW, cellH);

    pdf.setFont(FONT, "bold");
    pdf.setFontSize(6.5);
    pdf.setTextColor(CLR_ACCENT);
    pdf.text(`#${idx + 1}`, x + 2, y + 3.5);
    const nameW = cellW - 12;
    const truncName = pdf.splitTextToSize(item.name || `Item ${idx + 1}`, nameW)[0] || "";
    pdf.setTextColor(CLR);
    pdf.text(truncName, x + 9, y + 3.5);

    pdf.setFont(FONT, "normal");
    pdf.setFontSize(6);
    pdf.setTextColor(CLR_MUTED);
    const catLabel = CATEGORY_LABELS[item.category] || item.category;
    pdf.text(`${catLabel}  ${formatDimension(item)}  Qty: ${item.quantity || 1}`, x + 2, y + 7.5);
    if (item.location) {
      pdf.text(pdf.splitTextToSize(item.location, cellW - 4)[0] || "", x + 2, y + 11);
    }

    const imgY = y + labelH;
    if (opts.includeDrawings && item.drawingDataUrl) {
      try {
        const dims = await loadImageDimensions(item.drawingDataUrl);
        const aspect = dims.width / dims.height;
        const maxImgW = cellW - 4;
        const maxImgH = drawH - 2;
        let iw = maxImgW;
        let ih = iw / aspect;
        if (ih > maxImgH) { ih = maxImgH; iw = ih * aspect; }
        const ix = x + (cellW - iw) / 2;
        const iy = imgY + (drawH - ih) / 2;
        const fmt = item.drawingDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
        pdf.addImage(item.drawingDataUrl, fmt, ix, iy, iw, ih);
      } catch { /* skip drawing */ }
    } else if (opts.includeSitePhotos && item.photoDataUrls && item.photoDataUrls.length > 0) {
      try {
        const photoUrl = item.photoDataUrls[0];
        const fmt = photoUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
        const maxImgW = cellW - 4;
        const maxImgH = drawH - 2;
        pdf.addImage(photoUrl, fmt, x + 2, imgY + 1, maxImgW, maxImgH);
      } catch { /* skip photo */ }
    }

    col++;
    if (col >= COLS) {
      col = 0;
      y += cellH + gutter;
    }
  }

  if (opts.includeSitePhotos) {
    const photoItems = opts.items.filter(it => it.photoDataUrls && it.photoDataUrls.length > 1);
    if (photoItems.length > 0) {
      y = col > 0 ? y + cellH + gutter + 4 : y + 4;
      y = ensureSpace(pdf, y, 40);
      pdf.setFont(FONT, "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(CLR_MUTED);
      pdf.text("ADDITIONAL ITEM PHOTOS", LM, y);
      y += 5;

      const photoW = 42;
      const photoH = 32;
      let px = LM;
      for (const item of photoItems) {
        if (!item.photoDataUrls) continue;
        for (const pUrl of item.photoDataUrls.slice(1, 4)) {
          if (px + photoW > PW - RM) {
            px = LM;
            y += photoH + 4;
            y = ensureSpace(pdf, y, photoH + 4);
          }
          try {
            const fmt = pUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
            pdf.addImage(pUrl, fmt, px, y, photoW, photoH);
          } catch { /* skip */ }
          px += photoW + 3;
        }
      }
    }
  }
}

function renderPricingReturn(pdf: jsPDF, opts: SubcontractorPdfOptions) {
  let y = TM;

  pdf.setFont(FONT, "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(CLR);
  pdf.text("PRICING RETURN", LM, y);
  y += 2;
  pdf.setFont(FONT, "italic");
  pdf.setFontSize(7.5);
  pdf.setTextColor(CLR_MUTED);
  pdf.text("Subcontractor to complete and return this page with their quotation.", LM, y);
  y += 2;
  drawLine(pdf, y);
  y += 6;

  pdf.setFont(FONT, "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(CLR_ACCENT);
  pdf.text("Pricing", LM, y);
  y += 6;

  const pricingFields = [
    "Total Price (excl. GST):",
    "GST:",
    "Total Price (incl. GST):",
    "Lead Time / Availability:",
  ];

  pdf.setFontSize(8.5);
  for (const field of pricingFields) {
    pdf.setFont(FONT, "normal");
    pdf.setTextColor(CLR);
    pdf.text(field, LM, y);
    pdf.setDrawColor(CLR_BORDER);
    pdf.setLineWidth(0.3);
    pdf.line(LM + 55, y + 0.5, PW - RM, y + 0.5);
    y += 7;
  }

  y += 3;
  const contactFields = ["Company:", "Contact:", "Phone:", "Email:"];
  for (const field of contactFields) {
    pdf.setFont(FONT, "normal");
    pdf.setTextColor(CLR);
    pdf.text(field, LM, y);
    pdf.setDrawColor(CLR_BORDER);
    pdf.setLineWidth(0.3);
    pdf.line(LM + 22, y + 0.5, LM + CW / 2, y + 0.5);
    y += 7;
  }

  y += 4;
  pdf.setFont(FONT, "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(CLR_ACCENT);
  pdf.text("Subcontractor Notes", LM, y);
  y += 2;
  pdf.setFont(FONT, "italic");
  pdf.setFontSize(7);
  pdf.setTextColor(CLR_MUTED);
  pdf.text("Note any assumptions, exclusions, or variation risks that may affect your pricing.", LM, y);
  y += 5;

  pdf.setDrawColor(CLR_BORDER);
  pdf.setLineWidth(0.3);
  const boxH = 32;
  pdf.rect(LM, y, CW, boxH);
  y += boxH + 6;

  if (opts.scopeFields.includeVariationChecklist) {
    y = ensureSpace(pdf, y, 70);
    pdf.setFont(FONT, "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(CLR_ACCENT);
    pdf.text("Variation Risk Checklist", LM, y);
    y += 2;
    pdf.setFont(FONT, "italic");
    pdf.setFontSize(7);
    pdf.setTextColor(CLR_MUTED);
    pdf.text("Subcontractor to tick any items that may impact pricing and note accordingly above.", LM, y);
    y += 5;

    const checklist = [
      "Difficult or restricted site access",
      "Height work over 2m / scaffold or EWP required",
      "Structural or framing alterations required",
      "Hidden damage, rot, or deterioration discovered during works",
      "Hazardous materials (e.g. asbestos) encountered",
      "Complex flashing or weatherproofing requirements",
      "WANZ bars / support systems not in base scope",
      "Staging, travel, or split-visit requirements",
      "After-hours or weekend work",
      "Occupied dwelling \u2014 additional protection or coordination",
      "Builder delays or site not ready",
      "Additional sealant beyond standard allowance",
    ];

    pdf.setFontSize(7.5);
    pdf.setTextColor(CLR);
    const checkCols = 2;
    const checkColW = CW / checkCols;
    const perCol = Math.ceil(checklist.length / checkCols);
    for (let ci = 0; ci < checkCols; ci++) {
      let cy = y;
      for (let ri = 0; ri < perCol; ri++) {
        const idx = ci * perCol + ri;
        if (idx >= checklist.length) break;
        const cx = LM + ci * checkColW;
        pdf.setDrawColor(CLR_BORDER);
        pdf.setLineWidth(0.25);
        pdf.rect(cx + 1, cy - 2.5, 3, 3);
        pdf.setFont(FONT, "normal");
        pdf.text(checklist[idx], cx + 6, cy);
        cy += 4.5;
      }
    }
    y += perCol * 4.5 + 4;
  }

  y = ensureSpace(pdf, y, 12);
  pdf.setFont(FONT, "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(CLR_MUTED);
  pdf.text("Signature: ________________________    Date: ________________________", LM, y);
}

function renderRfqPageOne(pdf: jsPDF, opts: SubcontractorPdfOptions): number {
  drawFooter(pdf);
  let y = TM;

  pdf.setFont(FONT, "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(CLR_ACCENT);
  pdf.text("SUPPLY / FABRICATION RFQ", LM, y);
  y += 3;

  pdf.setDrawColor(CLR_ACCENT);
  pdf.setLineWidth(0.8);
  pdf.line(LM, y, LM + 50, y);
  y += 6;

  pdf.setFont(FONT, "italic");
  pdf.setFontSize(7.5);
  pdf.setTextColor(CLR_MUTED);
  pdf.text("Request for quotation \u2014 supply and/or fabrication pricing. This is not a purchase order.", LM, y);
  y += 7;

  pdf.setFont(FONT, "bold");
  pdf.setFontSize(7.5);
  const rfqBadge = "SUPPLY / FABRICATION";
  const rfqBadgeW = pdf.getTextWidth(rfqBadge) + 8;
  pdf.setFillColor("#ede9fe");
  pdf.roundedRect(LM, y - 4, rfqBadgeW, 7, 1.5, 1.5, "F");
  pdf.setTextColor("#5b21b6");
  pdf.text(rfqBadge, LM + 4, y);

  const filter = opts.itemFilter || "all";
  if (filter !== "all") {
    const filterLabel = filter === "outsourced_only" ? "OUTSOURCED ITEMS" : "IN-HOUSE ITEMS";
    const filterX = LM + rfqBadgeW + 4;
    const filterW = pdf.getTextWidth(filterLabel) + 8;
    pdf.setFillColor(filter === "outsourced_only" ? "#fef2f2" : "#f0fdf4");
    pdf.roundedRect(filterX, y - 4, filterW, 7, 1.5, 1.5, "F");
    pdf.setTextColor(filter === "outsourced_only" ? "#991b1b" : "#166534");
    pdf.text(filterLabel, filterX + 4, y);
  }
  y += 8;

  const itemCountLabel = filter === "outsourced_only"
    ? `${opts.items.length} outsourced item${opts.items.length !== 1 ? "s" : ""}`
    : filter === "in_house_only"
      ? `${opts.items.length} in-house item${opts.items.length !== 1 ? "s" : ""}`
      : `${opts.items.length} item${opts.items.length !== 1 ? "s" : ""}`;

  const leftFields: [string, string | undefined][] = [
    ["Project", opts.projectName],
    ["Site Address", opts.siteAddress],
    ["Client / Builder", opts.clientName],
  ];
  const rightFields: [string, string | undefined][] = [
    ["Date Issued", opts.dateIssued],
    ["Prepared By", opts.preparedBy],
    ["Items", itemCountLabel],
  ];

  pdf.setFontSize(8);
  const halfW = CW / 2;
  const fieldRowH = 5.5;
  const startFieldY = y;
  for (const [label, value] of leftFields) {
    if (!value) continue;
    pdf.setFont(FONT, "bold");
    pdf.setTextColor(CLR_MUTED);
    pdf.text(`${label}:`, LM, y);
    pdf.setFont(FONT, "normal");
    pdf.setTextColor(CLR);
    const wrapped = wrapText(pdf, value, halfW - 30);
    pdf.text(wrapped[0], LM + 28, y);
    y += fieldRowH;
  }
  let ry = startFieldY;
  const rx = LM + halfW + 4;
  for (const [label, value] of rightFields) {
    if (!value) continue;
    pdf.setFont(FONT, "bold");
    pdf.setTextColor(CLR_MUTED);
    pdf.text(`${label}:`, rx, ry);
    pdf.setFont(FONT, "normal");
    pdf.setTextColor(CLR);
    pdf.text(value, rx + 25, ry);
    ry += fieldRowH;
  }
  y = Math.max(y, ry) + 4;

  drawLine(pdf, y);
  y += 5;

  return y;
}

function renderRfqRequirements(pdf: jsPDF, opts: SubcontractorPdfOptions, startY: number): number {
  let y = startY;

  pdf.setFont(FONT, "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(CLR);
  pdf.text("REQUEST DETAILS", LM, y);
  y += 5;

  const includes: string[] = [
    "Supply and/or fabrication of joinery items as scheduled below",
    "All items manufactured to specified dimensions and configurations",
    "Quality to meet NZS 4211 or as otherwise specified",
    "Packaging suitable for transport to site or nominated delivery point",
  ];
  y = renderBulletList(pdf, y, "Supplier To Provide", includes);

  const excludes: string[] = [
    "Site installation, fixing, sealing, or commissioning",
    "Site delivery unless specifically included in your quotation",
    "Building consent applications or inspections",
    "On-site measurement \u2014 dimensions as per schedule",
  ];
  y = renderBulletList(pdf, y, "Excludes (Unless Otherwise Agreed)", excludes);

  const responseReqs: string[] = [
    "Unit price per item and total supply price (excl. GST)",
    "Estimated lead time from order confirmation to dispatch",
    "Any minimum order quantities or surcharges",
    "Confirm compliance with specified dimensions and configurations",
    "Note any substitutions, alternatives, or deviations from schedule",
  ];
  y = renderBulletList(pdf, y, "Response Requirements", responseReqs);

  return y;
}

function renderRfqPricingReturn(pdf: jsPDF, opts: SubcontractorPdfOptions) {
  let y = TM;

  pdf.setFont(FONT, "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(CLR);
  pdf.text("SUPPLIER PRICING RETURN", LM, y);
  y += 2;
  pdf.setFont(FONT, "italic");
  pdf.setFontSize(7.5);
  pdf.setTextColor(CLR_MUTED);
  pdf.text("Supplier to complete and return this page with their quotation for supply/fabrication.", LM, y);
  y += 2;
  drawLine(pdf, y);
  y += 6;

  pdf.setFont(FONT, "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(CLR_ACCENT);
  pdf.text("Supply Pricing", LM, y);
  y += 6;

  const pricingFields = [
    "Total Supply Price (excl. GST):",
    "GST:",
    "Total Supply Price (incl. GST):",
    "Lead Time (weeks from order):",
    "Delivery Method / Cost:",
  ];

  pdf.setFontSize(8.5);
  for (const field of pricingFields) {
    pdf.setFont(FONT, "normal");
    pdf.setTextColor(CLR);
    pdf.text(field, LM, y);
    pdf.setDrawColor(CLR_BORDER);
    pdf.setLineWidth(0.3);
    pdf.line(LM + 60, y + 0.5, PW - RM, y + 0.5);
    y += 7;
  }

  y += 3;
  const contactFields = ["Company:", "Contact:", "Phone:", "Email:"];
  for (const field of contactFields) {
    pdf.setFont(FONT, "normal");
    pdf.setTextColor(CLR);
    pdf.text(field, LM, y);
    pdf.setDrawColor(CLR_BORDER);
    pdf.setLineWidth(0.3);
    pdf.line(LM + 22, y + 0.5, LM + CW / 2, y + 0.5);
    y += 7;
  }

  y += 4;
  pdf.setFont(FONT, "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(CLR_ACCENT);
  pdf.text("Supplier Notes", LM, y);
  y += 2;
  pdf.setFont(FONT, "italic");
  pdf.setFontSize(7);
  pdf.setTextColor(CLR_MUTED);
  pdf.text("Note any lead time assumptions, material substitutions, minimum orders, or delivery conditions.", LM, y);
  y += 5;

  pdf.setDrawColor(CLR_BORDER);
  pdf.setLineWidth(0.3);
  const boxH = 32;
  pdf.rect(LM, y, CW, boxH);
  y += boxH + 6;

  y += 4;
  pdf.setFont(FONT, "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(CLR_ACCENT);
  pdf.text("Compliance & Deviations", LM, y);
  y += 2;
  pdf.setFont(FONT, "italic");
  pdf.setFontSize(7);
  pdf.setTextColor(CLR_MUTED);
  pdf.text("Confirm compliance or note any deviations from the item schedule.", LM, y);
  y += 5;

  const complianceChecks = [
    "All items can be manufactured to specified dimensions",
    "Materials and finishes as specified",
    "Hardware as specified (where applicable)",
    "Glass specification as noted (where applicable)",
    "No substitutions required",
  ];

  pdf.setFontSize(7.5);
  pdf.setTextColor(CLR);
  for (const item of complianceChecks) {
    y = ensureSpace(pdf, y, 5);
    const cx = LM;
    pdf.setDrawColor(CLR_BORDER);
    pdf.setLineWidth(0.25);
    pdf.rect(cx + 1, y - 2.5, 3, 3);
    pdf.setFont(FONT, "normal");
    pdf.text(item, cx + 6, y);
    y += 4.5;
  }

  y += 6;
  y = ensureSpace(pdf, y, 12);
  pdf.setFont(FONT, "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(CLR_MUTED);
  pdf.text("Signature: ________________________    Date: ________________________", LM, y);
}
