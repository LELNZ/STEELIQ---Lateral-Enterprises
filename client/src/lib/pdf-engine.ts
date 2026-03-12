import { jsPDF } from "jspdf";
import type { QuoteRenderModel, RenderScheduleItem, RenderTotalsLine, RenderSpecEntry } from "./quote-renderer";
import { isSectionVisible, LOGO_SCALE_PRESETS, COMPANY_MASTER_TEMPLATE } from "./quote-template";
import { parseRichText, isAllBold, tokensToPlainText, type InlineToken } from "./rich-text-parser";
import type { QuoteTemplate, ScheduleLayoutVariant, TotalsLayoutVariant } from "./quote-template";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const LEFT_MARGIN = 15;
const RIGHT_MARGIN = 15;
const TOP_MARGIN = 18;
const BOTTOM_MARGIN = 18;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN;
const MAX_Y = PAGE_HEIGHT - BOTTOM_MARGIN;

const FONT_NORMAL = "helvetica";

let T: QuoteTemplate;
let COLOR_BLACK: string;
let COLOR_MUTED: string;
let COLOR_ACCENT: string;
let COLOR_BORDER: string;
let COLOR_BG_MUTED: string;

let SECTION_GAP: number;
let ITEM_GAP: number;
let INNER_PAD: number;
let PHOTO_MAX_SIZE: number;
let DRAWING_MAX_W_PCT: number;
let SCHEDULE_LAYOUT: ScheduleLayoutVariant;
let TOTALS_LAYOUT: TotalsLayoutVariant;

let DENSITY_DRAWING_MAX_H: number;
let DENSITY_SPEC_ROW_H: number;
let DENSITY_ITEM_HEADER_H: number;
let DENSITY_PHOTO_ROW_H: number;

const SIZE_MAP: Record<string, number> = {
  xs: 7,
  sm: 8.5,
  base: 10,
  lg: 12,
  xl: 16,
  "2xl": 18,
};

function mmSize(key: string): number {
  return SIZE_MAP[key] ?? 10;
}

function applyTemplate(template: QuoteTemplate) {
  T = template;
  COLOR_BLACK = T.colors.bodyText;
  COLOR_MUTED = T.colors.headingMuted;
  COLOR_ACCENT = T.colors.accent;
  COLOR_BORDER = T.colors.border;
  COLOR_BG_MUTED = T.colors.bgMuted;

  SECTION_GAP = T.spacing.sectionGapMm;
  ITEM_GAP = T.spacing.itemGapMm;
  INNER_PAD = T.spacing.innerPaddingMm;
  PHOTO_MAX_SIZE = T.itemLayout.photoMaxSizeMm;
  DRAWING_MAX_W_PCT = T.itemLayout.drawingMaxWidthPercent;
  SCHEDULE_LAYOUT = T.itemLayout.scheduleLayoutVariant;
  TOTALS_LAYOUT = T.itemLayout.totalsLayoutVariant;

  DENSITY_DRAWING_MAX_H = T.density.drawingMaxH;
  DENSITY_SPEC_ROW_H = T.density.specRowH;
  DENSITY_ITEM_HEADER_H = T.density.itemHeaderH;
  DENSITY_PHOTO_ROW_H = T.density.photoRowH;
  INNER_PAD = T.density.itemCardPadMm;
  ITEM_GAP = T.density.itemGapMm;
}

type Pdf = jsPDF;

function ensureSpace(pdf: Pdf, y: number, needed: number): number {
  if (y + needed > MAX_Y) {
    pdf.addPage();
    return TOP_MARGIN;
  }
  return y;
}

function drawLine(pdf: Pdf, y: number, x1?: number, x2?: number) {
  pdf.setDrawColor(COLOR_BORDER);
  pdf.setLineWidth(0.3);
  pdf.line(x1 ?? LEFT_MARGIN, y, x2 ?? (LEFT_MARGIN + CONTENT_WIDTH), y);
}

function wrapText(pdf: Pdf, text: string, maxWidth: number): string[] {
  return pdf.splitTextToSize(text, maxWidth) as string[];
}

function renderInlineTokensPdf(
  pdf: Pdf,
  tokens: InlineToken[],
  x: number,
  y: number,
  maxX: number,
  fontSize: number,
  color: string,
  lineH: number,
): { y: number; x: number } {
  let curX = x;
  let curY = y;

  for (const token of tokens) {
    const style =
      token.bold && token.italic ? "bolditalic" :
      token.bold ? "bold" :
      token.italic ? "italic" :
      "normal";
    pdf.setFont(FONT_NORMAL, style);
    pdf.setFontSize(fontSize);
    pdf.setTextColor(color);

    const words = token.text.split(" ");
    for (let wi = 0; wi < words.length; wi++) {
      const word = words[wi];
      if (!word) { if (wi < words.length - 1) curX += pdf.getTextWidth(" "); continue; }

      const wordW = pdf.getTextWidth(word);
      const spaceW = wi < words.length - 1 ? pdf.getTextWidth(" ") : 0;

      if (curX + wordW > maxX && curX > x) {
        curY += lineH;
        curX = x;
      }

      pdf.text(word, curX, curY);

      if (token.underline) {
        pdf.setDrawColor(color);
        pdf.setLineWidth(0.2);
        pdf.line(curX, curY + 0.6, curX + wordW, curY + 0.6);
      }

      curX += wordW + spaceW;
    }
  }

  return { y: curY, x: curX };
}

interface RichTextPdfOptions {
  fontSize: number;
  color: string;
  boldColor?: string;
  leftMargin: number;
  contentWidth: number;
  lineH: number;
  paragraphGap: number;
  bulletIndent?: number;
  boldHeadings?: boolean;
}

function renderRichTextPdf(pdf: Pdf, y: number, text: string | null, opts: RichTextPdfOptions): number {
  if (!text) return y;
  const blocks = parseRichText(text);
  if (blocks.length === 0) return y;

  const {
    fontSize,
    color,
    boldColor,
    leftMargin,
    contentWidth,
    lineH,
    paragraphGap,
    bulletIndent = 4,
    boldHeadings = false,
  } = opts;

  const maxX = leftMargin + contentWidth;

  for (const block of blocks) {
    if (block.type === "spacer") {
      y += paragraphGap;
      continue;
    }

    y = ensureSpace(pdf, y, lineH + 2);

    if (block.type === "bullet") {
      const bColor = color;
      pdf.setFont(FONT_NORMAL, "normal");
      pdf.setFontSize(fontSize);
      pdf.setTextColor(bColor);
      const bulletX = leftMargin;
      const textX = leftMargin + bulletIndent;
      pdf.text("•", bulletX, y);
      const { y: newY } = renderInlineTokensPdf(pdf, block.tokens, textX, y, maxX, fontSize, bColor, lineH);
      y = newY + lineH;
      continue;
    }

    if (block.type === "numbered") {
      const bColor = color;
      const labelW = bulletIndent;
      pdf.setFont(FONT_NORMAL, "normal");
      pdf.setFontSize(fontSize);
      pdf.setTextColor(bColor);
      pdf.text(`${block.n}.`, leftMargin, y);
      const textX = leftMargin + labelW;
      const { y: newY } = renderInlineTokensPdf(pdf, block.tokens, textX, y, maxX, fontSize, bColor, lineH);
      y = newY + lineH;
      continue;
    }

    if (block.type === "paragraph") {
      const allBold = boldHeadings && isAllBold(block.tokens);
      const pColor = allBold && boldColor ? boldColor : color;

      if (allBold) {
        y += 1.5;
      }

      const { y: newY } = renderInlineTokensPdf(
        pdf,
        block.tokens,
        leftMargin,
        y,
        maxX,
        fontSize,
        pColor,
        lineH,
      );
      y = newY + lineH;
      continue;
    }
  }

  return y;
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size < 100) return null;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function getImageDimensions(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 100, h: 100 });
    img.src = dataUrl;
  });
}

async function preloadPhotos(photos: { url: string; key: string }[]): Promise<Map<string, string>> {
  const loaded = new Map<string, string>();
  await Promise.all(
    photos.map(async (p) => {
      const data = await loadImageAsDataUrl(p.url);
      if (data) loaded.set(p.key, data);
    }),
  );
  return loaded;
}

export async function generateQuotePdf(
  model: QuoteRenderModel,
  onProgress?: (status: string) => void,
): Promise<void> {
  onProgress?.("Initializing PDF...");

  applyTemplate(model.resolvedTemplate ?? COMPANY_MASTER_TEMPLATE);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = TOP_MARGIN;

  if (isSectionVisible(T, "header")) {
    y = await renderHeader(pdf, y, model);
    y = renderSeparator(pdf, y);
  }

  y = renderQuotationTitle(pdf, y);

  if (isSectionVisible(T, "disclaimer")) {
    y = renderDisclaimer(pdf, y, model.disclaimerText);
  }

  if (isSectionVisible(T, "customerProject")) {
    y = renderCustomerProject(pdf, y, model);
  }

  if (isSectionVisible(T, "totals")) {
    y = renderTotals(pdf, y, model);
  }

  if (isSectionVisible(T, "schedule")) {
    onProgress?.("Rendering schedule...");
    y = await renderSchedule(pdf, y, model, onProgress);
  }

  if (isSectionVisible(T, "legal")) {
    onProgress?.("Rendering terms...");
    y = renderLegal(pdf, y, model);
  }

  if (isSectionVisible(T, "acceptance")) {
    onProgress?.("Rendering acceptance...");
    y = renderAcceptance(pdf, y, model);
  }

  renderPageNumbers(pdf);

  const safeName = (model.header.quoteNumber || "quote").replace(/[^a-zA-Z0-9-_]/g, "_");
  onProgress?.("Saving...");
  pdf.save(`${safeName}.pdf`);
}

async function renderHeader(pdf: Pdf, y: number, model: QuoteRenderModel): Promise<number> {
  const { branding, orgContact } = model;
  const startY = y;
  const logoMaxW = T.header.logoWidthMm;
  const logoMaxH = T.header.logoMaxHeightMm;

  let logoBottomY = y;
  let brandTextX = LEFT_MARGIN;
  let actualLogoW = 0;

  if (branding.logoUrl) {
    const logoData = await loadImageAsDataUrl(branding.logoUrl);
    if (logoData) {
      try {
        const dims = await getImageDimensions(logoData);
        const scale = Math.min(logoMaxW / dims.w, logoMaxH / dims.h, 1);
        const lw = dims.w * scale;
        const lh = dims.h * scale;
        pdf.addImage(logoData, LEFT_MARGIN, y, lw, lh);
        logoBottomY = y + lh;
        actualLogoW = lw;
        brandTextX = LEFT_MARGIN + lw + 3;
      } catch { /* skip logo */ }
    }
  }

  let textY = startY;

  if (T.header.showTradingName) {
    const nameSize = T.header.logoScale === "large" ? 9 : T.header.logoScale === "small" ? 7 : 8;
    pdf.setFont(FONT_NORMAL, "bold");
    pdf.setFontSize(nameSize);
    pdf.setTextColor(COLOR_BLACK);
    if (T.header.legalLinePlacement === "beside_logo") {
      pdf.text(branding.tradingName, brandTextX, textY + 4);
    } else {
      pdf.text(branding.tradingName, brandTextX, textY + 4);
    }
    textY += 5;
  }

  if (T.header.legalLinePlacement === "beside_logo") {
    pdf.setFont(FONT_NORMAL, "italic");
    pdf.setFontSize(6.5);
    pdf.setTextColor(COLOR_MUTED);
    pdf.text(branding.legalLine, brandTextX, textY + 3.5);
    textY += 5;
  } else if (T.header.legalLinePlacement === "under_logo") {
    const legalY = Math.max(logoBottomY + 1, textY);
    pdf.setFont(FONT_NORMAL, "italic");
    pdf.setFontSize(6.5);
    pdf.setTextColor(COLOR_MUTED);
    pdf.text(branding.legalLine, LEFT_MARGIN, legalY + 3);
    textY = legalY + 5;
  }

  y = Math.max(logoBottomY + 2, textY);

  let rightY = startY + 2;
  const rightX = LEFT_MARGIN + CONTENT_WIDTH;
  pdf.setFont(FONT_NORMAL, "normal");
  const contactFontSize = T.header.contactBlockAlignment === "compact_right" ? 6.5 : T.header.contactBlockAlignment === "stacked_right" ? 7.5 : 7;
  const contactLineH = T.header.contactBlockAlignment === "compact_right" ? 2.5 : T.header.contactBlockAlignment === "stacked_right" ? 3.5 : 3;
  pdf.setFontSize(contactFontSize);
  pdf.setTextColor(COLOR_MUTED);

  const contactLines: string[] = [];
  if (orgContact.address) contactLines.push(orgContact.address);
  if (orgContact.phone) contactLines.push(orgContact.phone);
  if (orgContact.email) contactLines.push(orgContact.email);
  if (orgContact.gstNumber) contactLines.push(`GST: ${orgContact.gstNumber}`);
  if (orgContact.nzbn) contactLines.push(`NZBN: ${orgContact.nzbn}`);

  for (const line of contactLines) {
    rightY += contactLineH;
    pdf.text(line, rightX, rightY, { align: "right" });
  }

  y = Math.max(y, rightY + 2) + T.header.headerBottomSpacingMm;
  return y;
}

function renderSeparator(pdf: Pdf, y: number): number {
  y += 1;
  drawLine(pdf, y);
  y += 3;
  return y;
}

function renderQuotationTitle(pdf: Pdf, y: number): number {
  const title = T.documentMode === "tender" ? "TENDER" : "QUOTATION";
  pdf.setFont(FONT_NORMAL, "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(COLOR_ACCENT);
  pdf.text(title, LEFT_MARGIN, y + 4);
  y += 8;
  return y;
}

function renderPageNumbers(pdf: Pdf) {
  const totalPages = pdf.getNumberOfPages();
  if (totalPages <= 1) return;
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFont(FONT_NORMAL, "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(COLOR_MUTED);
    pdf.text(`Page ${i} of ${totalPages}`, LEFT_MARGIN + CONTENT_WIDTH, PAGE_HEIGHT - 10, { align: "right" });
  }
}

function renderDisclaimer(pdf: Pdf, y: number, text: string): number {
  y = ensureSpace(pdf, y, 8);
  y = renderRichTextPdf(pdf, y, text, {
    fontSize: mmSize(T.typography.legalLineSize),
    color: COLOR_MUTED,
    leftMargin: LEFT_MARGIN,
    contentWidth: CONTENT_WIDTH,
    lineH: 3.5,
    paragraphGap: INNER_PAD,
  });
  y += INNER_PAD;
  return y;
}

function renderCustomerProject(pdf: Pdf, y: number, model: QuoteRenderModel): number {
  const { header, customerProject } = model;
  y = ensureSpace(pdf, y, 30);

  const colW = CONTENT_WIDTH / 2;

  pdf.setFont(FONT_NORMAL, "bold");
  pdf.setFontSize(mmSize(T.typography.sectionHeadingSize));
  pdf.setTextColor(COLOR_MUTED);
  pdf.text("CUSTOMER", LEFT_MARGIN, y + 3);

  pdf.setFont(FONT_NORMAL, "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(COLOR_BLACK);
  pdf.text(customerProject.customerName, LEFT_MARGIN, y + 9);

  let custY = y + 12;
  if (customerProject.hasProjectAddress) {
    pdf.setFont(FONT_NORMAL, "bold");
    pdf.setFontSize(mmSize(T.typography.sectionHeadingSize));
    pdf.setTextColor(COLOR_MUTED);
    pdf.text("PROJECT ADDRESS", LEFT_MARGIN, custY + 3);
    pdf.setFont(FONT_NORMAL, "normal");
    pdf.setFontSize(mmSize(T.typography.bodyTextSize));
    pdf.setTextColor(COLOR_BLACK);
    const addrLines = wrapText(pdf, customerProject.projectAddress, colW - 5);
    pdf.text(addrLines, LEFT_MARGIN, custY + 7);
    custY += 7 + addrLines.length * 3.5;
  }

  const rightX = LEFT_MARGIN + colW + 5;
  let rightY = y;

  const quoteInfoItems = [
    { label: "Quote #", value: header.quoteNumber },
    { label: "Date", value: header.dateFormatted },
    { label: "Valid Until", value: header.expiryFormatted },
  ];

  for (const info of quoteInfoItems) {
    pdf.setFont(FONT_NORMAL, "normal");
    pdf.setFontSize(mmSize(T.typography.sectionHeadingSize));
    pdf.setTextColor(COLOR_MUTED);
    pdf.text(info.label + ":", rightX, rightY + 3, { align: "left" });
    pdf.setFontSize(mmSize(T.typography.bodyTextSize) + 0.5);
    pdf.setTextColor(COLOR_BLACK);
    pdf.setFont(FONT_NORMAL, info.label === "Quote #" ? "bold" : "normal");
    pdf.text(info.value, rightX + 25, rightY + 3);
    pdf.setFont(FONT_NORMAL, "normal");
    rightY += 5;
  }

  y = Math.max(custY, rightY) + SECTION_GAP;
  return y;
}

function renderTotals(pdf: Pdf, y: number, model: QuoteRenderModel): number {
  const { totals } = model;
  if (totals.isEmpty) return y;

  pdf.setFont(FONT_NORMAL, "bold");
  pdf.setFontSize(mmSize(T.typography.sectionHeadingSize));
  pdf.setTextColor(COLOR_MUTED);
  pdf.text("QUOTE SUMMARY", LEFT_MARGIN, y + 3);
  y += SECTION_GAP;

  if (TOTALS_LAYOUT === "totals_inline_v1") {
    return renderTotalsInline(pdf, y, totals);
  }
  return renderTotalsBlock(pdf, y, totals);
}

function renderTotalsBlock(pdf: Pdf, y: number, totals: QuoteRenderModel["totals"]): number {
  const lineH = 6;
  const blockH = totals.lines.length * lineH + 10;
  y = ensureSpace(pdf, y, blockH);

  const boxX = LEFT_MARGIN;
  const boxW = CONTENT_WIDTH;

  pdf.setFillColor(COLOR_BG_MUTED);
  pdf.setDrawColor(COLOR_BORDER);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(boxX, y, boxW, blockH, 2, 2, "FD");

  y += 5;
  const labelX = LEFT_MARGIN + 8;
  const amountX = LEFT_MARGIN + CONTENT_WIDTH - 8;

  for (const line of totals.lines) {
    if (line.emphasis === "separator") {
      drawLine(pdf, y, labelX - 2, amountX + 2);
      y += 3;
      continue;
    }

    if (line.emphasis === "bold") {
      pdf.setFont(FONT_NORMAL, "bold");
      pdf.setFontSize(mmSize(T.typography.totalsBoldSize));
      pdf.setTextColor(COLOR_BLACK);
    } else if (line.emphasis === "muted") {
      pdf.setFont(FONT_NORMAL, "normal");
      pdf.setFontSize(mmSize(T.typography.totalsLabelSize));
      pdf.setTextColor(COLOR_MUTED);
    } else {
      pdf.setFont(FONT_NORMAL, "normal");
      pdf.setFontSize(mmSize(T.typography.totalsLabelSize));
      pdf.setTextColor(COLOR_BLACK);
    }

    pdf.text(line.label, labelX, y + 3);
    pdf.text(line.formatted, amountX, y + 3, { align: "right" });
    y += lineH;
  }

  y += SECTION_GAP;
  pdf.setFont(FONT_NORMAL, "normal");
  return y;
}

function renderTotalsInline(pdf: Pdf, y: number, totals: QuoteRenderModel["totals"]): number {
  const lineH = 5.5;
  const totalH = totals.lines.length * lineH + 4;
  y = ensureSpace(pdf, y, totalH);

  const labelX = LEFT_MARGIN;
  const amountX = LEFT_MARGIN + CONTENT_WIDTH;

  for (const line of totals.lines) {
    if (line.emphasis === "separator") {
      drawLine(pdf, y);
      y += 3;
      continue;
    }

    if (line.emphasis === "bold") {
      pdf.setFont(FONT_NORMAL, "bold");
      pdf.setFontSize(mmSize(T.typography.totalsBoldSize));
      pdf.setTextColor(COLOR_BLACK);
    } else if (line.emphasis === "muted") {
      pdf.setFont(FONT_NORMAL, "normal");
      pdf.setFontSize(mmSize(T.typography.totalsLabelSize));
      pdf.setTextColor(COLOR_MUTED);
    } else {
      pdf.setFont(FONT_NORMAL, "normal");
      pdf.setFontSize(mmSize(T.typography.totalsLabelSize));
      pdf.setTextColor(COLOR_BLACK);
    }

    pdf.text(line.label, labelX, y + 3);
    pdf.text(line.formatted, amountX, y + 3, { align: "right" });
    y += lineH;
  }

  y += SECTION_GAP;
  pdf.setFont(FONT_NORMAL, "normal");
  return y;
}

function renderLegal(pdf: Pdf, y: number, model: QuoteRenderModel): number {
  const { legal } = model;
  const hasContent =
    legal.sections.length > 0 ||
    legal.hasBankDetails ||
    !!legal.additionalCapabilities;
  if (!hasContent) return y;

  const bodyFontSize = mmSize(T.typography.bodyTextSize);
  const bodyLineH = 3.8;
  const paragraphGap = SECTION_GAP;

  const richOpts: RichTextPdfOptions = {
    fontSize: bodyFontSize,
    color: COLOR_BLACK,
    leftMargin: LEFT_MARGIN,
    contentWidth: CONTENT_WIDTH,
    lineH: bodyLineH,
    paragraphGap,
    bulletIndent: 4,
  };

  y = ensureSpace(pdf, y, 30);
  y += SECTION_GAP;
  drawLine(pdf, y);
  y += SECTION_GAP;

  if (legal.additionalCapabilities) {
    pdf.setFont(FONT_NORMAL, "bold");
    pdf.setFontSize(mmSize(T.typography.sectionHeadingSize));
    pdf.setTextColor(COLOR_MUTED);
    pdf.text("ADDITIONAL CAPABILITIES", LEFT_MARGIN, y + 3);
    y += SECTION_GAP;

    y = renderRichTextPdf(pdf, y, legal.additionalCapabilities, {
      ...richOpts,
      boldColor: COLOR_BLACK,
      boldHeadings: true,
      paragraphGap: INNER_PAD,
    });

    y += INNER_PAD;
  }

  if (legal.sections.length > 0) {
    pdf.setFont(FONT_NORMAL, "bold");
    pdf.setFontSize(mmSize(T.typography.itemTitleSize));
    pdf.setTextColor(COLOR_ACCENT);
    pdf.text("TERMS & CONDITIONS", LEFT_MARGIN, y + 4);
    y += 10;

    for (const section of legal.sections) {
      y = ensureSpace(pdf, y, 15);

      pdf.setFont(FONT_NORMAL, "bold");
      pdf.setFontSize(mmSize(T.typography.sectionHeadingSize));
      pdf.setTextColor(COLOR_MUTED);
      pdf.text(section.heading.toUpperCase(), LEFT_MARGIN, y + 3);
      y += SECTION_GAP;

      y = renderRichTextPdf(pdf, y, section.body, richOpts);

      y += INNER_PAD;
    }
  }

  if (legal.hasBankDetails && legal.bankDetails) {
    y = ensureSpace(pdf, y, 20);
    y += INNER_PAD;

    pdf.setFont(FONT_NORMAL, "bold");
    pdf.setFontSize(mmSize(T.typography.sectionHeadingSize));
    pdf.setTextColor(COLOR_MUTED);
    pdf.text("REMITTANCE / BANK DETAILS", LEFT_MARGIN, y + 3);
    y += SECTION_GAP;

    y = renderRichTextPdf(pdf, y, legal.bankDetails, richOpts);

    y += INNER_PAD;
  }

  return y;
}

async function renderSchedule(
  pdf: Pdf,
  y: number,
  model: QuoteRenderModel,
  onProgress?: (status: string) => void,
): Promise<number> {
  if (model.scheduleItems.length === 0) return y;

  onProgress?.("Loading images...");
  const allPhotos = model.scheduleItems.flatMap((item) =>
    item.media.customerPhotos.map((p) => ({ url: p.url, key: p.key })),
  );
  const allDrawings = model.scheduleItems
    .filter((item) => item.media.drawingUrl)
    .map((item) => ({ url: item.media.drawingUrl!, key: `draw-${item.index}` }));
  const imageCache = await preloadPhotos([...allPhotos, ...allDrawings]);

  // Estimate height needed for heading + first item to decide if we can share page 1
  const SCHEDULE_HEADING_H = 10;
  let firstItemEstH = 0;
  if (model.scheduleItems.length > 0) {
    const fi = model.scheduleItems[0];
    const fiDrawH = fi.media.drawingUrl && imageCache.has(`draw-${fi.index}`) ? DENSITY_DRAWING_MAX_H + 2 : 0;
    const fiSpecH = fi.visibleSpecs.length * DENSITY_SPEC_ROW_H;
    const fiPhotoH = fi.media.customerPhotos.filter((p) => imageCache.has(p.key)).length > 0 ? DENSITY_PHOTO_ROW_H + 5 : 0;
    firstItemEstH = DENSITY_ITEM_HEADER_H + Math.max(fiDrawH, fiSpecH) + fiPhotoH + 4;
  }

  const neededOnCurrentPage = SECTION_GAP + SCHEDULE_HEADING_H + firstItemEstH;
  const remainingSpace = MAX_Y - y;

  if (remainingSpace < neededOnCurrentPage) {
    // Not enough room for heading + first item — start schedule on a fresh page
    pdf.addPage();
    y = TOP_MARGIN;
  } else {
    // Enough room — continue on same page after a section gap
    y += SECTION_GAP;
  }

  pdf.setFont(FONT_NORMAL, "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(COLOR_ACCENT);
  pdf.text("SCHEDULE OF ITEMS", LEFT_MARGIN, y + 4);
  y += 8;

  for (let si = 0; si < model.scheduleItems.length; si++) {
    const item = model.scheduleItems[si];
    onProgress?.(`Rendering item ${si + 1} of ${model.scheduleItems.length}...`);

    const loadablePhotoCount = item.media.customerPhotos.filter((p) => imageCache.has(p.key)).length;
    const hasItemDrawing = item.media.drawingUrl && imageCache.has(`draw-${item.index}`);
    const itemSpecH = item.visibleSpecs.length * DENSITY_SPEC_ROW_H;
    const itemDrawH = hasItemDrawing ? DENSITY_DRAWING_MAX_H + 2 : 0;
    const itemPhotoH = loadablePhotoCount > 0 ? DENSITY_PHOTO_ROW_H + 5 : 0;
    const estimatedH = DENSITY_ITEM_HEADER_H + Math.max(itemDrawH, itemSpecH) + itemPhotoH + 4;
    y = ensureSpace(pdf, y, Math.min(estimatedH, MAX_Y - TOP_MARGIN - 5));

    y = await renderScheduleItem(pdf, y, item, imageCache);
    y += ITEM_GAP;
  }

  return y;
}

async function renderScheduleItem(
  pdf: Pdf,
  y: number,
  item: RenderScheduleItem,
  imageCache: Map<string, string>,
): Promise<number> {
  const loadablePhotos = item.media.customerPhotos.filter((p) => imageCache.has(p.key));
  const hasDrawing = item.media.drawingUrl && imageCache.has(`draw-${item.index}`);
  const hasPhotos = loadablePhotos.length > 0;

  const headerH = DENSITY_ITEM_HEADER_H;
  const specH = item.visibleSpecs.length * DENSITY_SPEC_ROW_H;
  const drawingH = hasDrawing ? DENSITY_DRAWING_MAX_H + 2 : 0;
  const photosH = hasPhotos ? DENSITY_PHOTO_ROW_H : 0;
  const minItemH = headerH + Math.max(drawingH, specH) + photosH + SECTION_GAP;

  y = ensureSpace(pdf, y, Math.min(minItemH, MAX_Y - TOP_MARGIN - 5));
  const itemStartPage = pdf.getNumberOfPages();
  const startY = y;

  const pad = INNER_PAD;

  pdf.setFillColor(COLOR_BG_MUTED);
  pdf.roundedRect(LEFT_MARGIN, startY - 2, CONTENT_WIDTH, headerH, 1, 1, "F");

  pdf.setFont(FONT_NORMAL, "bold");
  pdf.setFontSize(mmSize(T.typography.itemTitleSize));
  pdf.setTextColor(COLOR_BLACK);
  pdf.text(item.title, LEFT_MARGIN + pad, y + 3.5);

  const subtitleText = `${item.quantityLabel}  \u00B7  ${item.dimensionLabel}`;
  pdf.setFont(FONT_NORMAL, "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(COLOR_MUTED);
  const subtitleW = pdf.getTextWidth(subtitleText);
  pdf.text(subtitleText, LEFT_MARGIN + CONTENT_WIDTH - pad - subtitleW, y + 3.5);

  y += headerH;

  if (SCHEDULE_LAYOUT === "specs_only_v1") {
    if (item.visibleSpecs.length > 0) {
      y = renderSpecTableNoPageBreak(pdf, y, item.visibleSpecs, LEFT_MARGIN + pad, CONTENT_WIDTH - pad * 2);
    }
  } else if (SCHEDULE_LAYOUT === "image_top_specs_below_v1") {
    if (hasDrawing) {
      const drawingData = imageCache.get(`draw-${item.index}`)!;
      try {
        const dims = await getImageDimensions(drawingData);
        const maxDrawW = CONTENT_WIDTH - pad * 2;
        const maxDrawH = DENSITY_DRAWING_MAX_H;
        const scale = Math.min(maxDrawW / dims.w, maxDrawH / dims.h, 1);
        const dw = dims.w * scale;
        const dh = dims.h * scale;
        const drawX = LEFT_MARGIN + pad + (maxDrawW - dw) / 2;
        pdf.addImage(drawingData, drawX, y, dw, dh);
        y += dh + 3;
      } catch { /* skip */ }
    }
    if (item.visibleSpecs.length > 0) {
      y = renderSpecTableNoPageBreak(pdf, y, item.visibleSpecs, LEFT_MARGIN + pad, CONTENT_WIDTH - pad * 2);
    }
  } else {
    const drawWPct = DRAWING_MAX_W_PCT / 100;
    const leftColW = CONTENT_WIDTH * drawWPct - 2;
    const rightColX = LEFT_MARGIN + CONTENT_WIDTH * drawWPct + 2;
    const rightColW = CONTENT_WIDTH * (1 - drawWPct) - 5;

    let drawingBottomY = y;
    if (hasDrawing) {
      const drawingData = imageCache.get(`draw-${item.index}`)!;
      try {
        const dims = await getImageDimensions(drawingData);
        const maxDrawW = leftColW - pad * 2;
        const maxDrawH = DENSITY_DRAWING_MAX_H;
        const scale = Math.min(maxDrawW / dims.w, maxDrawH / dims.h, 1);
        const dw = dims.w * scale;
        const dh = dims.h * scale;
        const drawX = LEFT_MARGIN + pad + (leftColW - pad * 2 - dw) / 2;
        pdf.addImage(drawingData, drawX, y, dw, dh);
        drawingBottomY = y + dh + 2;
      } catch { /* skip */ }
    }

    let specY = y;
    if (item.visibleSpecs.length > 0) {
      specY = renderSpecTableNoPageBreak(pdf, specY, item.visibleSpecs, rightColX, rightColW);
    }
    y = Math.max(drawingBottomY, specY);
  }

  y += 2;

  if (hasPhotos) {
    const renderedPhotosResult = await tryRenderPhotos(pdf, y, loadablePhotos, imageCache, item.title, pad, startY, itemStartPage);
    if (renderedPhotosResult.rendered) {
      if (renderedPhotosResult.newPage) {
        drawItemBorder(pdf, startY, y, itemStartPage);
        return renderedPhotosResult.y + 2;
      }
      y = renderedPhotosResult.y;
    }
  }

  drawItemBorder(pdf, startY, y, itemStartPage);
  return y + 2;
}

async function tryRenderPhotos(
  pdf: Pdf,
  y: number,
  photos: { url: string; caption: string; key: string }[],
  imageCache: Map<string, string>,
  itemTitle: string,
  pad: number,
  cardStartY: number,
  cardStartPage: number,
): Promise<{ rendered: boolean; y: number; newPage: boolean }> {
  const actuallyLoadable = photos.filter((p) => imageCache.has(p.key));
  if (actuallyLoadable.length === 0) return { rendered: false, y, newPage: false };

  if (y + DENSITY_PHOTO_ROW_H > MAX_Y) {
    drawItemBorder(pdf, cardStartY, y, cardStartPage);
    pdf.addPage();
    y = TOP_MARGIN;
    const photosStartY = y;

    const result = await renderPhotosFromCache(pdf, y + 5, actuallyLoadable, imageCache);
    if (result.count > 0) {
      pdf.setFont(FONT_NORMAL, "bold");
      pdf.setFontSize(mmSize(T.typography.specLabelSize));
      pdf.setTextColor(COLOR_MUTED);
      pdf.text(`${itemTitle} — SITE PHOTOS (continued)`, LEFT_MARGIN + pad, y + 3);
      y = result.y;
    }
    drawItemBorder(pdf, photosStartY - 2, y, pdf.getNumberOfPages());
    return { rendered: result.count > 0, y, newPage: true };
  }

  const headingY = y;
  const result = await renderPhotosFromCache(pdf, y + 5, actuallyLoadable, imageCache);
  if (result.count > 0) {
    pdf.setFont(FONT_NORMAL, "bold");
    pdf.setFontSize(mmSize(T.typography.specLabelSize));
    pdf.setTextColor(COLOR_MUTED);
    pdf.text("SITE PHOTOS", LEFT_MARGIN + pad, headingY + 3);
    y = result.y;
    return { rendered: true, y, newPage: false };
  }
  return { rendered: false, y: headingY, newPage: false };
}

function drawItemBorder(pdf: Pdf, startY: number, endY: number, startPage: number) {
  const currentPage = pdf.getNumberOfPages();
  if (currentPage !== startPage) return;

  pdf.setDrawColor(COLOR_BORDER);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(LEFT_MARGIN, startY - 2, CONTENT_WIDTH, endY - startY + 3, 1, 1, "S");
}

async function renderPhotosFromCache(
  pdf: Pdf,
  y: number,
  photos: { url: string; caption: string; key: string }[],
  imageCache: Map<string, string>,
): Promise<{ y: number; count: number }> {
  let photoX = LEFT_MARGIN + INNER_PAD;
  const photoMaxW = PHOTO_MAX_SIZE;
  const photoMaxH = PHOTO_MAX_SIZE - 5;
  let renderedCount = 0;

  for (const photo of photos) {
    const photoData = imageCache.get(photo.key);
    if (!photoData) continue;

    try {
      const dims = await getImageDimensions(photoData);
      const scale = Math.min(photoMaxW / dims.w, photoMaxH / dims.h, 1);
      const pw = dims.w * scale;
      const ph = dims.h * scale;

      if (photoX + pw > LEFT_MARGIN + CONTENT_WIDTH - INNER_PAD) {
        photoX = LEFT_MARGIN + INNER_PAD;
        y += photoMaxH + 3;
        if (y + photoMaxH > MAX_Y) {
          pdf.addPage();
          y = TOP_MARGIN;
        }
      }

      pdf.addImage(photoData, photoX, y, pw, ph);
      photoX += pw + 3;
      renderedCount++;
    } catch { /* skip */ }
  }

  if (renderedCount > 0) {
    y += photoMaxH + 2;
  }
  return { y, count: renderedCount };
}

function renderSpecTableNoPageBreak(pdf: Pdf, y: number, specs: RenderSpecEntry[], x: number, w: number): number {
  const rowH = DENSITY_SPEC_ROW_H;
  const labelW = w * 0.45;

  for (let i = 0; i < specs.length; i++) {
    if (y + rowH > MAX_Y) break;

    if (i % 2 === 0) {
      pdf.setFillColor(COLOR_BG_MUTED);
      pdf.rect(x, y, w, rowH, "F");
    }

    pdf.setFont(FONT_NORMAL, "normal");
    pdf.setFontSize(mmSize(T.typography.specLabelSize));
    pdf.setTextColor(COLOR_MUTED);

    const labelLines = wrapText(pdf, specs[i].label, labelW - 2);
    pdf.text(labelLines[0] || specs[i].label, x + 2, y + 3.2);

    pdf.setFontSize(mmSize(T.typography.specValueSize));
    pdf.setTextColor(COLOR_BLACK);
    const valLines = wrapText(pdf, specs[i].value, w - labelW - 4);
    pdf.text(valLines[0] || specs[i].value, x + labelW, y + 3.2);

    y += rowH;
  }

  return y;
}

function renderAcceptance(pdf: Pdf, y: number, model: QuoteRenderModel): number {
  y = ensureSpace(pdf, y, 60);

  y += SECTION_GAP;
  drawLine(pdf, y);
  y += SECTION_GAP;

  pdf.setFont(FONT_NORMAL, "bold");
  pdf.setFontSize(mmSize(T.typography.itemTitleSize));
  pdf.setTextColor(COLOR_ACCENT);
  pdf.text("ACCEPTANCE", LEFT_MARGIN, y + 4);
  y += 8;

  pdf.setFont(FONT_NORMAL, "normal");
  pdf.setFontSize(mmSize(T.typography.bodyTextSize));
  pdf.setTextColor(COLOR_BLACK);
  const qRef = model.header.quoteNumber || "this quotation";
  const acceptText = `I accept the works described in ${qRef} and agree to the terms and conditions outlined above.`;
  const acceptLines = wrapText(pdf, acceptText, CONTENT_WIDTH);
  pdf.text(acceptLines, LEFT_MARGIN, y + 3);
  y += acceptLines.length * 3.5 + 6;

  const fields = T.acceptance.fields;
  const fieldW = CONTENT_WIDTH / fields.length;

  for (let i = 0; i < fields.length; i++) {
    const fx = LEFT_MARGIN + i * fieldW;

    pdf.setFont(FONT_NORMAL, "normal");
    pdf.setFontSize(mmSize(T.typography.specLabelSize));
    pdf.setTextColor(COLOR_MUTED);
    pdf.text(fields[i], fx + 2, y + 3);

    pdf.setDrawColor(COLOR_BORDER);
    pdf.setLineDashPattern([1, 1], 0);
    pdf.line(fx + 2, y + 15, fx + fieldW - 4, y + 15);
    pdf.setLineDashPattern([], 0);
  }

  y += 22;
  return y;
}
