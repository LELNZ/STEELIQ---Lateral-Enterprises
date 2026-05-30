import { jsPDF } from "jspdf";
import type { QuoteRenderModel, RenderScheduleItem, RenderTotalsLine, RenderSpecEntry } from "./quote-renderer";
import { extractLaserTableRow } from "./quote-renderer";
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
let DOCUMENT_LABEL: string = "Quote";
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

  for (let ti = 0; ti < tokens.length; ti++) {
    const token = tokens[ti];
    const style =
      token.bold && token.italic ? "bolditalic" :
      token.bold ? "bold" :
      token.italic ? "italic" :
      "normal";
    pdf.setFont(FONT_NORMAL, style);
    pdf.setFontSize(fontSize);
    pdf.setTextColor(color);

    // Inter-token boundary: render an explicit space character when adjacent styled
    // tokens meet without whitespace. Using pdf.text(" ") encodes the space as an
    // actual character in the PDF text stream (not a positioning-only cursor advance),
    // so extractors always detect the word boundary regardless of font metrics.
    if (ti > 0) {
      const prevText = tokens[ti - 1].text;
      const currText = token.text;
      if (
        prevText.length > 0 &&
        !prevText.endsWith(" ") &&
        currText.length > 0 &&
        !currText.startsWith(" ")
      ) {
        // Use the previous token's font so the space character width is correct
        const prevToken = tokens[ti - 1];
        const prevStyle =
          prevToken.bold && prevToken.italic ? "bolditalic" :
          prevToken.bold ? "bold" :
          prevToken.italic ? "italic" :
          "normal";
        pdf.setFont(FONT_NORMAL, prevStyle);
        pdf.text(" ", curX, curY);
        curX += pdf.getTextWidth(" ");
        // Restore current token font for subsequent rendering
        pdf.setFont(FONT_NORMAL, style);
      }
    }

    const words = token.text.split(" ");
    for (let wi = 0; wi < words.length; wi++) {
      const word = words[wi];
      // Empty string from multiple consecutive spaces: render explicit space in stream
      if (!word) {
        if (wi < words.length - 1) {
          pdf.text(" ", curX, curY);
          curX += pdf.getTextWidth(" ");
        }
        continue;
      }

      const wordW = pdf.getTextWidth(word);
      // Trailing space: include as part of the text string so the space character
      // is encoded in the PDF stream, not just implied by cursor position.
      const hasTrailingSpace = wi < words.length - 1;

      if (curX + wordW > maxX && curX > x) {
        curY += lineH;
        curX = x;
      }

      // Render word WITH trailing space (except last word of last token).
      // Including the space in the string encodes it as an actual PDF character.
      const textToRender = hasTrailingSpace ? word + " " : word;
      pdf.text(textToRender, curX, curY);

      if (token.underline) {
        pdf.setDrawColor(color);
        pdf.setLineWidth(0.2);
        pdf.line(curX, curY + 0.6, curX + wordW, curY + 0.6);
      }

      curX += pdf.getTextWidth(textToRender);
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

    const indent = (block.type === "bullet" || block.type === "numbered") ? bulletIndent : 0;
    const measuredW = contentWidth - indent;
    pdf.setFontSize(fontSize);
    const plainText = tokensToPlainText(block.tokens);
    const wrappedLines = plainText.trim()
      ? (pdf.splitTextToSize(plainText, measuredW) as string[])
      : ["x"];
    const blockH = Math.max(1, wrappedLines.length) * lineH + lineH;
    y = ensureSpace(pdf, y, blockH);

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
    if (url.startsWith("data:")) return url;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      console.warn(`[pdf-engine] Image fetch failed: ${url} → HTTP ${res.status}`);
      return null;
    }
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

// Phase 5F.4 — the legacy "compact pricing block" no longer occupies
// any vertical space on the customer-facing PDF. All Pricing / Detail
// / Operations content has moved into the spec table as appended
// RenderSpecEntry rows (added by finaliseParentDisplay() in
// quote-renderer.ts), so it is naturally counted by every place that
// already does `visibleSpecs.length * DENSITY_SPEC_ROW_H`. This
// function is preserved as a stable extension point and now always
// returns 0; drawCompactItemPricing is also a no-op for the same
// reason. Both sides of the engine (Preview and PDF) use the same
// zero-block formula → perfect pagination parity.
function pricingBlockHeightMm(_item: RenderScheduleItem): number {
  return 0;
}

function getImageDimensions(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 100, h: 100 });
    img.src = dataUrl;
  });
}

async function compressImageForPdf(
  dataUrl: string,
  maxPixelW: number,
  maxPixelH: number,
  useJpeg = true,
  quality = 0.82,
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(maxPixelW / img.naturalWidth, maxPixelH / img.naturalHeight, 1);
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(dataUrl); return; }
        if (useJpeg) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
        }
        ctx.drawImage(img, 0, 0, w, h);
        const fmt = useJpeg ? "image/jpeg" : "image/png";
        const compressed = canvas.toDataURL(fmt, quality);
        resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function preloadPhotos(photos: { url: string; key: string }[]): Promise<Map<string, string>> {
  const loaded = new Map<string, string>();
  await Promise.all(
    photos.map(async (p) => {
      const raw = await loadImageAsDataUrl(p.url);
      if (!raw) return;
      const isDrawing = p.key.startsWith("draw-");
      const compressed = await compressImageForPdf(
        raw,
        isDrawing ? 1800 : 1200,
        isDrawing ? 1200 : 900,
        true,
        isDrawing ? 0.88 : 0.80,
      );
      loaded.set(p.key, compressed);
    }),
  );
  return loaded;
}

export async function generateQuotePdf(
  model: QuoteRenderModel,
  onProgress?: (status: string) => void,
): Promise<void> {
  onProgress?.("Initializing PDF...");

  DOCUMENT_LABEL = model.documentLabel || "Quote";
  applyTemplate(model.resolvedTemplate ?? COMPANY_MASTER_TEMPLATE);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
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

  y = renderCommercialRemarks(pdf, y, model);

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

export async function generateQuotePdfBase64(
  model: QuoteRenderModel,
  onProgress?: (status: string) => void,
): Promise<string> {
  onProgress?.("Initializing PDF...");

  DOCUMENT_LABEL = model.documentLabel || "Quote";
  applyTemplate(model.resolvedTemplate ?? COMPANY_MASTER_TEMPLATE);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
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

  y = renderCommercialRemarks(pdf, y, model);

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

  onProgress?.("Encoding...");
  const dataUri = pdf.output("datauristring");
  const base64 = dataUri.split(",")[1];
  return base64;
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
    const logoRaw = await loadImageAsDataUrl(branding.logoUrl);
    if (logoRaw) {
      const logoData = await compressImageForPdf(logoRaw, 800, 400, false);
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
  const title = T.documentMode === "tender" ? "TENDER" : DOCUMENT_LABEL.toUpperCase();
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

function renderCommercialRemarks(pdf: Pdf, y: number, model: QuoteRenderModel): number {
  if (!model.commercialRemarks) return y;
  y = ensureSpace(pdf, y, 20);
  y += SECTION_GAP;

  const PAD_H = 5;
  const PAD_V = 4;
  const innerLeft = LEFT_MARGIN + PAD_H;
  const innerWidth = CONTENT_WIDTH - PAD_H * 2;
  const boxStartY = y;

  // Heading: "DETAILS"
  y += PAD_V;
  pdf.setFont(FONT_NORMAL, "bold");
  pdf.setFontSize(mmSize(6.5));
  pdf.setTextColor(COLOR_MUTED);
  pdf.text("DETAILS", innerLeft, y + 2);
  y += 6;

  // Body text
  const bodyEndY = renderRichTextPdf(pdf, y, model.commercialRemarks, {
    fontSize: 9,
    color: "#374151",
    boldColor: "#111827",
    leftMargin: innerLeft,
    contentWidth: innerWidth,
    lineH: 4.8,
    paragraphGap: 2.5,
  });

  const boxEndY = bodyEndY + PAD_V;

  // Draw border rect around the whole block (stroke only — renders on top without covering text)
  pdf.setDrawColor(COLOR_BORDER);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(LEFT_MARGIN, boxStartY, CONTENT_WIDTH, boxEndY - boxStartY, 2, 2, "S");

  return boxEndY + SECTION_GAP;
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
    // +3 accounts for the baseline offset used above so body starts below the heading
    y += SECTION_GAP + 3;

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
      // +3 accounts for the baseline offset used above so body starts below the heading
      y += SECTION_GAP + 3;

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
    // +3 accounts for the baseline offset used above so body starts below the heading
    y += SECTION_GAP + 3;

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
    if (model.domainType === "laser") {
      // Phase 5H.0 — laser schedules render via renderLaserScheduleTable
      // (7-column hybrid). Per-row footprint is the table header
      // (~7mm) + a single capped image-row (~24mm; bumped from 22mm
      // for the additional Item / Description text line) + an
      // optional ~5mm Pricing detail sub-row. Mirrors the preview's
      // estimateScheduleItemMm laser branch so cross-surface
      // pagination decisions agree.
      const TABLE_HEADER_H = 7;
      const ROW_H = 24;
      const pd = fi.pricingDisplay;
      const detailH =
        pd?.showOperationPricing
        && fi.attachedOperations.length > 0
        && (pd.showUnitPriceColumn || pd.showLineTotalColumn)
          ? 5
          : 0;
      firstItemEstH = TABLE_HEADER_H + ROW_H + detailH + 2;
    } else {
      const fiDrawH = fi.media.drawingUrl && imageCache.has(`draw-${fi.index}`) ? DENSITY_DRAWING_MAX_H + 2 : 0;
      // Phase 5F card-tightening — manual blank placeholder is now a
      // strictly bounded ~22mm tall compact box (max 32mm wide). It no
      // longer borrows the full drawingMaxH (40mm), so the page-1
      // first-item estimator correctly recognises that LL items with
      // bounded blanks fit on page 1 alongside subsequent items.
      const BLANK_PREVIEW_MM = 22;
      const fiBlankH = fi.manualBlankPreview ? BLANK_PREVIEW_MM : 0;
      const fiSpecH = fi.visibleSpecs.length * DENSITY_SPEC_ROW_H;
      const fiPhotoH = fi.media.customerPhotos.filter((p) => imageCache.has(p.key)).length > 0 ? DENSITY_PHOTO_ROW_H + 5 : 0;
      // Phase 5F polish parity — pane specs and attached-operations rows
      // are part of the rendered card but were previously omitted from the
      // first-item start-page estimator. Mirror the preview's
      // estimateScheduleItemMm formula so the page-1 placement decision
      // aligns with where preview actually breaks.
      const fiPaneH = fi.paneGlassSpecs.length > 0 ? 6 + fi.paneGlassSpecs.length * 3.5 : 0;
      // Phase 5F.1 — grouped commercial pricing table replaces the prior
      // separate pricing row + operations block. Same height formula used
      // by Preview's estimateScheduleItemMm so cross-page parity holds.
      const fiPricingBlockH = pricingBlockHeightMm(fi);
      firstItemEstH = DENSITY_ITEM_HEADER_H + Math.max(fiDrawH, fiBlankH, fiSpecH) + fiPricingBlockH + fiPaneH + fiPhotoH + 4;
    }
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

  if (model.domainType !== "laser") {
    pdf.setFont(FONT_NORMAL, "italic");
    pdf.setFontSize(7.5);
    pdf.setTextColor(COLOR_BLACK);
    pdf.text("All joinery is viewed from outside.", LEFT_MARGIN, y + 3);
    y += 6;
  }

  // Phase 5G — laser quotes render the schedule as an enterprise table.
  // Joinery / estimator quotes keep the per-item card path below.
  if (model.domainType === "laser") {
    return await renderLaserScheduleTable(pdf, y, model, imageCache, onProgress);
  }

  for (let si = 0; si < model.scheduleItems.length; si++) {
    const item = model.scheduleItems[si];
    onProgress?.(`Rendering item ${si + 1} of ${model.scheduleItems.length}...`);
    if (si > 0 && si % 2 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }

    const loadablePhotoCount = item.media.customerPhotos.filter((p) => imageCache.has(p.key)).length;
    const hasItemDrawing = item.media.drawingUrl && imageCache.has(`draw-${item.index}`);
    const itemSpecH = item.visibleSpecs.length * DENSITY_SPEC_ROW_H;
    const itemDrawH = hasItemDrawing ? DENSITY_DRAWING_MAX_H + 2 : 0;
    // Phase 5F card-tightening — bounded ~22mm blank box (see comment
    // in firstItemEstH).
    const ITEM_BLANK_PREVIEW_MM = 22;
    const itemBlankH = item.manualBlankPreview ? ITEM_BLANK_PREVIEW_MM : 0;
    const itemPhotoH = loadablePhotoCount > 0 ? DENSITY_PHOTO_ROW_H + 5 : 0;
    const paneSpecH = item.paneGlassSpecs.length > 0 ? 6 + item.paneGlassSpecs.length * 3.5 : 0;
    // Phase 5F.1 — grouped commercial pricing table (parent + ops + footer).
    const itemPricingBlockH = pricingBlockHeightMm(item);
    const estimatedH = DENSITY_ITEM_HEADER_H + Math.max(itemDrawH, itemBlankH, itemSpecH) + itemPricingBlockH + paneSpecH + itemPhotoH + 4;
    y = ensureSpace(pdf, y, Math.min(estimatedH, MAX_Y - TOP_MARGIN - 5));

    y = await renderScheduleItem(pdf, y, item, imageCache);
    y += ITEM_GAP;
  }

  return y;
}

// Phase 5G — enterprise schedule TABLE for the LL customer-facing PDF.
// Mirrors the React `LaserScheduleTable` in quote-preview.tsx so the
// preview and the exported PDF render the same 8-column schedule with
// the same toggle-driven column visibility:
//
//   Image | Item | Material/Spec | Dimensions | Operations | Qty |
//   Unit Price (toggle) | Line Total (toggle).
//
// Pricing values are sourced ONLY from `pricingDisplay` (combined
// labels) which respect `showUnitPriceColumn` / `showLineTotalColumn`.
// No cost / margin / supplier / internal-notes data is ever surfaced.
//
// Pagination: per-row `ensureSpace`. When a page break occurs the
// header row is redrawn at the top of the new page so the customer
// always sees column labels.
//
// All text is run through `sanitizeForPdfText()` because jsPDF's
// helvetica is Latin-1 only.
async function renderLaserScheduleTable(
  pdf: Pdf,
  y: number,
  model: QuoteRenderModel,
  imageCache: Map<string, string>,
  onProgress?: (status: string) => void,
): Promise<number> {
  // Phase 5H.0 — 7-column hybrid: Image · Item / Description ·
  // Material / Spec · Size · Qty · Unit (toggle) · Total (toggle).
  // Operations are nested inside Item / Description as a third
  // stacked text line (see drawWrappedCellLines below).

  // Determine column visibility from the first item that carries
  // pricingDisplay (all laser parents share the same toggles).
  const sampleWithPricing = model.scheduleItems.find(it => !!it.pricingDisplay);
  const showUnit = sampleWithPricing?.pricingDisplay?.showUnitPriceColumn ?? false;
  const showLT = sampleWithPricing?.pricingDisplay?.showLineTotalColumn ?? false;

  // Column widths in mm — total = CONTENT_WIDTH (180mm). Image / Size /
  // Qty are fixed; Unit / Total are gated by toggles. Remaining budget
  // is split 60% Item / Description, 40% Material / Spec — identical
  // to the preview LaserScheduleTable so both surfaces look the same.
  const W_IMAGE = 22;
  const W_SIZE = 24;
  const W_QTY = 8;
  const W_UNIT = showUnit ? 14 : 0;
  const W_TOTAL = showLT ? 18 : 0;
  const remainingForText = CONTENT_WIDTH - W_IMAGE - W_SIZE - W_QTY - W_UNIT - W_TOTAL;
  const W_ITEM = Math.floor(remainingForText * 0.60);
  const W_MATERIAL = remainingForText - W_ITEM;

  // Column x offsets (left edge of each cell).
  const X_IMAGE = LEFT_MARGIN;
  const X_ITEM = X_IMAGE + W_IMAGE;
  const X_MATERIAL = X_ITEM + W_ITEM;
  const X_SIZE = X_MATERIAL + W_MATERIAL;
  const X_QTY = X_SIZE + W_SIZE;
  const X_UNIT = X_QTY + W_QTY;
  const X_TOTAL = X_UNIT + W_UNIT;

  const HEADER_H = 6;
  const ROW_H = 24;       // image-capped row height (Phase 5H.0)
  const DETAIL_H = 4.5;   // optional Pricing detail sub-row height
  const CELL_PAD_X = 1.5;
  const HEADER_FONT = 7;
  const BODY_FONT = 7.5;
  const SMALL_FONT = 6.8;
  const DETAIL_FONT = 6.5;

  const drawHeader = (yy: number): number => {
    pdf.setFillColor(COLOR_BG_MUTED);
    pdf.rect(LEFT_MARGIN, yy, CONTENT_WIDTH, HEADER_H, "F");
    pdf.setDrawColor(COLOR_BORDER);
    pdf.setLineWidth(0.2);
    pdf.line(LEFT_MARGIN, yy + HEADER_H, LEFT_MARGIN + CONTENT_WIDTH, yy + HEADER_H);

    pdf.setFont(FONT_NORMAL, "bold");
    pdf.setFontSize(HEADER_FONT);
    pdf.setTextColor(COLOR_BLACK);
    const baseline = yy + 4;
    pdf.text("Image", X_IMAGE + CELL_PAD_X, baseline);
    pdf.text("Item / Description", X_ITEM + CELL_PAD_X, baseline);
    pdf.text("Material / Spec", X_MATERIAL + CELL_PAD_X, baseline);
    pdf.text("Size", X_SIZE + CELL_PAD_X, baseline);
    // Right-aligned numeric headers.
    const qtyLbl = "Qty";
    pdf.text(qtyLbl, X_QTY + W_QTY - CELL_PAD_X - pdf.getTextWidth(qtyLbl), baseline);
    if (showUnit) {
      const ul = "Unit";
      pdf.text(ul, X_UNIT + W_UNIT - CELL_PAD_X - pdf.getTextWidth(ul), baseline);
    }
    if (showLT) {
      const ll = "Total";
      pdf.text(ll, X_TOTAL + W_TOTAL - CELL_PAD_X - pdf.getTextWidth(ll), baseline);
    }
    return yy + HEADER_H;
  };

  // Initial header row (immediately after the SCHEDULE heading).
  y = drawHeader(y);

  // Helper — draw a single line of text inside a cell at (x, y).
  // Right-aligns numeric values when align==="right".
  const drawLine = (
    text: string,
    x: number,
    w: number,
    yLine: number,
    opts?: { bold?: boolean; italic?: boolean; align?: "left" | "right"; muted?: boolean; font?: number },
  ) => {
    const safe = sanitizeForPdfText(text);
    pdf.setFont(FONT_NORMAL, opts?.italic ? "italic" : (opts?.bold ? "bold" : "normal"));
    pdf.setFontSize(opts?.font ?? BODY_FONT);
    pdf.setTextColor(opts?.muted ? COLOR_MUTED : COLOR_BLACK);
    if (opts?.align === "right") {
      const tw = pdf.getTextWidth(safe);
      pdf.text(safe, x + w - CELL_PAD_X - tw, yLine);
    } else {
      pdf.text(safe, x + CELL_PAD_X, yLine);
    }
  };

  // Helper — draw multiple wrapped lines starting at (x, yStart) and
  // return the number of lines drawn.
  const drawWrappedLines = (
    text: string,
    x: number,
    w: number,
    yStart: number,
    opts?: { bold?: boolean; align?: "left" | "right"; muted?: boolean; maxLines?: number; font?: number },
  ): number => {
    if (!text) return 0;
    const fontSize = opts?.font ?? BODY_FONT;
    pdf.setFont(FONT_NORMAL, opts?.bold ? "bold" : "normal");
    pdf.setFontSize(fontSize);
    pdf.setTextColor(opts?.muted ? COLOR_MUTED : COLOR_BLACK);
    const maxLines = opts?.maxLines ?? 3;
    const innerW = w - CELL_PAD_X * 2;
    const lines = wrapText(pdf, sanitizeForPdfText(text), innerW).slice(0, maxLines);
    const lineSpacingMm = fontSize * 1.15 * 0.352778;
    lines.forEach((ln, i) => {
      const ly = yStart + i * lineSpacingMm;
      if (opts?.align === "right") {
        const tw = pdf.getTextWidth(ln);
        pdf.text(ln, x + w - CELL_PAD_X - tw, ly);
      } else {
        pdf.text(ln, x + CELL_PAD_X, ly);
      }
    });
    return lines.length;
  };

  for (let si = 0; si < model.scheduleItems.length; si++) {
    const item = model.scheduleItems[si];
    onProgress?.(`Rendering item ${si + 1} of ${model.scheduleItems.length}...`);
    if (si > 0 && si % 2 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }

    const row = extractLaserTableRow(item);
    const needsDetail = !!row.detailPdf;
    const totalRowH = ROW_H + (needsDetail ? DETAIL_H : 0);

    // Page-break handling — redraw the header on every new page so the
    // customer always sees column labels above the data.
    if (y + totalRowH > MAX_Y) {
      pdf.addPage();
      y = TOP_MARGIN;
      y = drawHeader(y);
    }

    const rowTopY = y;

    // --- Image cell ---------------------------------------------------
    const hasDrawing = !!item.media.drawingUrl && imageCache.has(`draw-${item.index}`);
    const imgBoxX = X_IMAGE + CELL_PAD_X;
    const imgBoxY = y + 1;
    const imgBoxW = W_IMAGE - CELL_PAD_X * 2;
    const imgBoxH = ROW_H - 2;
    if (hasDrawing) {
      const drawingData = imageCache.get(`draw-${item.index}`)!;
      try {
        const dims = await getImageDimensions(drawingData);
        const scale = Math.min(imgBoxW / dims.w, imgBoxH / dims.h, 1);
        const dw = dims.w * scale;
        const dh = dims.h * scale;
        const dx = imgBoxX + (imgBoxW - dw) / 2;
        const dy = imgBoxY + (imgBoxH - dh) / 2;
        pdf.addImage(drawingData, dx, dy, dw, dh);
      } catch { /* skip */ }
    } else if (item.manualBlankPreview) {
      const lengthMm = item.manualBlankPreview.lengthMm;
      const widthMm = item.manualBlankPreview.widthMm;
      const scale = Math.min(imgBoxW / lengthMm, imgBoxH / widthMm);
      const rectW = Math.max(4, lengthMm * scale * 0.85);
      const rectH = Math.max(3, widthMm * scale * 0.85);
      const rx = imgBoxX + (imgBoxW - rectW) / 2;
      const ry = imgBoxY + (imgBoxH - rectH) / 2;
      pdf.setDrawColor(COLOR_BORDER);
      pdf.setLineWidth(0.25);
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(rx, ry, rectW, rectH, 0.4, 0.4, "FD");
    } else {
      pdf.setFont(FONT_NORMAL, "normal");
      pdf.setFontSize(BODY_FONT);
      pdf.setTextColor(COLOR_MUTED);
      pdf.text("-", imgBoxX + imgBoxW / 2, y + ROW_H / 2 + 1);
    }

    // --- Item / Description cell (3 stacked lines) -------------------
    // Line 1: ref (small, muted) — "Item 001 - LC-001"
    // Line 2: title (bold) — "Fibre laser cut component"
    // Line 3 (optional): "Additional operation(s): <summary>" — the
    // full customer-facing label is built in extractLaserTableRow.
    const itemBaseY = y + 3;
    const refLineSp = SMALL_FONT * 1.15 * 0.352778;
    drawLine(row.itemRefLinePdf, X_ITEM, W_ITEM, itemBaseY, {
      muted: true,
      font: SMALL_FONT,
    });
    const titleY = itemBaseY + refLineSp + 0.5;
    const titleLines = drawWrappedLines(row.title, X_ITEM, W_ITEM, titleY, {
      bold: true,
      maxLines: 2,
    });
    if (row.opsSummaryPdf) {
      const titleSp = BODY_FONT * 1.15 * 0.352778;
      const opsY = titleY + titleLines * titleSp + 0.5;
      drawWrappedLines(row.opsSummaryPdf, X_ITEM, W_ITEM, opsY, {
        font: SMALL_FONT,
        maxLines: 2,
      });
    }

    // --- Material / Spec cell (2 stacked lines) ----------------------
    const matBaseY = y + 3.5;
    drawLine(row.materialPrimary || "-", X_MATERIAL, W_MATERIAL, matBaseY);
    if (row.materialSecondary) {
      const matSp = BODY_FONT * 1.15 * 0.352778;
      drawLine(row.materialSecondaryPdf, X_MATERIAL, W_MATERIAL, matBaseY + matSp + 0.5, {
        muted: true,
        font: SMALL_FONT,
      });
    }

    // --- Size / Qty / Unit / Total -----------------------------------
    drawLine(row.dimensions || "-", X_SIZE, W_SIZE, y + 3.5);
    drawLine(String(row.qty), X_QTY, W_QTY, y + 3.5, { align: "right" });
    if (showUnit) {
      drawLine(row.unitPriceLabel ?? "-", X_UNIT, W_UNIT, y + 3.5, { align: "right" });
    }
    if (showLT) {
      drawLine(row.lineTotalLabel ?? "-", X_TOTAL, W_TOTAL, y + 3.5, {
        align: "right",
        bold: true,
      });
    }

    y += ROW_H;

    // --- Optional Pricing detail sub-row -----------------------------
    if (needsDetail) {
      pdf.setFont(FONT_NORMAL, "italic");
      pdf.setFontSize(DETAIL_FONT);
      pdf.setTextColor(COLOR_MUTED);
      const detailText = sanitizeForPdfText(row.detailPdf!);
      const detailW = CONTENT_WIDTH - W_IMAGE;
      const detailLine = wrapText(pdf, detailText, detailW - CELL_PAD_X * 2)[0] || detailText;
      pdf.text(detailLine, X_ITEM + CELL_PAD_X, y + 2.8);
      y += DETAIL_H;
    }

    // --- Row separator ------------------------------------------------
    pdf.setDrawColor(COLOR_BORDER);
    pdf.setLineWidth(0.15);
    pdf.line(LEFT_MARGIN, y, LEFT_MARGIN + CONTENT_WIDTH, y);

    // TODO Phase 5H — reserved sub-row slot for "Qty Breaks" tier
    // pricing. When data exists, render here directly under the
    // Pricing detail row spanning all columns and advance y by its
    // height. No DB / calc / mock output in this phase.

    // Touch the rowTopY var so lint doesn't trip; also useful for
    // future row-background fills.
    void rowTopY;
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

  // Phase 5F polish — attached procedures now collapse into the parent's
  // `attachedOperations` block (rendered as compact rows inside the parent
  // card). Children no longer render as their own card. We keep a small
  // defensive indent for orphan attached rows whose parent could not be
  // resolved, but we DO NOT prefix the title with the `↳` glyph because
  // jsPDF's helvetica is Latin-1 only and U+21B3 was being mangled into
  // `!³` on export.
  const ATTACHED_INDENT_MM = 6;
  const indent = item.isAttachedChild ? ATTACHED_INDENT_MM : 0;
  const cardLeft = LEFT_MARGIN + indent;
  const cardWidth = CONTENT_WIDTH - indent;

  const headerH = DENSITY_ITEM_HEADER_H;
  const specH = item.visibleSpecs.length * DENSITY_SPEC_ROW_H;
  const drawingH = hasDrawing ? DENSITY_DRAWING_MAX_H + 2 : 0;
  // Phase 5F card-tightening — bounded ~22mm blank box (mirrors the
  // firstItemEstH / estimatedH change so the pre-render minItemH
  // ensureSpace check stays consistent with the bounded box actually
  // drawn in the placeholder branch below).
  const MIN_BLANK_PREVIEW_MM = 22;
  const blankH = item.manualBlankPreview ? MIN_BLANK_PREVIEW_MM : 0;
  const photosH = hasPhotos ? DENSITY_PHOTO_ROW_H : 0;
  const paneH = item.paneGlassSpecs.length > 0 ? 6 + item.paneGlassSpecs.length * 3.5 : 0;
  // Phase 5F.1 — grouped commercial pricing table (parent + ops + footer).
  const pricingBlkH = pricingBlockHeightMm(item);
  const minItemH = headerH + Math.max(drawingH, blankH, specH) + pricingBlkH + paneH + photosH + SECTION_GAP;

  y = ensureSpace(pdf, y, Math.min(minItemH, MAX_Y - TOP_MARGIN - 5));
  const itemStartPage = pdf.getNumberOfPages();
  const startY = y;

  const pad = INNER_PAD;

  pdf.setFillColor(COLOR_BG_MUTED);
  pdf.roundedRect(cardLeft, startY - 2, cardWidth, headerH, 1, 1, "F");

  pdf.setFont(FONT_NORMAL, "bold");
  pdf.setFontSize(mmSize(T.typography.itemTitleSize));
  pdf.setTextColor(COLOR_BLACK);
  // Phase 5F polish — Latin-1-only PDF text. Never inject U+21B3 here.
  pdf.text(item.title, cardLeft + pad, y + 3.5);

  const subtitleText = `${item.quantityLabel}  \u00B7  ${item.dimensionLabel}${item.openingDirectionLabel ? `  \u00B7  ${item.openingDirectionLabel}` : ""}`;
  pdf.setFont(FONT_NORMAL, "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(COLOR_MUTED);
  const subtitleW = pdf.getTextWidth(subtitleText);
  pdf.text(subtitleText, cardLeft + cardWidth - pad - subtitleW, y + 3.5);

  y += headerH;

  if (SCHEDULE_LAYOUT === "specs_only_v1") {
    if (item.visibleSpecs.length > 0) {
      y = renderSpecTableNoPageBreak(pdf, y, item.visibleSpecs, cardLeft + pad, cardWidth - pad * 2);
    }
  } else if (SCHEDULE_LAYOUT === "image_top_specs_below_v1") {
    if (hasDrawing) {
      const drawingData = imageCache.get(`draw-${item.index}`)!;
      try {
        const dims = await getImageDimensions(drawingData);
        const maxDrawW = cardWidth - pad * 2;
        const maxDrawH = DENSITY_DRAWING_MAX_H;
        const scale = Math.min(maxDrawW / dims.w, maxDrawH / dims.h, 1);
        const dw = dims.w * scale;
        const dh = dims.h * scale;
        const drawX = cardLeft + pad + (maxDrawW - dw) / 2;
        pdf.addImage(drawingData, drawX, y, dw, dh);
        y += dh + 3;
      } catch { /* skip */ }
    }
    if (item.visibleSpecs.length > 0) {
      y = renderSpecTableNoPageBreak(pdf, y, item.visibleSpecs, cardLeft + pad, cardWidth - pad * 2);
    }
  } else {
    const drawWPct = DRAWING_MAX_W_PCT / 100;
    // Phase 5F card-tightening — when there's no uploaded drawing but
    // we DO have a manual blank placeholder, narrow the left column to
    // a compact ~35mm so the spec table on the right has the full
    // remaining card width. This restores readability when Unit Price
    // / Line Total / Operations rows widen the spec table content.
    // Items with a real drawing keep the original ~45% column.
    const BLANK_LEFT_COL_MM = 35;
    const useNarrowBlankCol = !hasDrawing && !!item.manualBlankPreview;
    const leftColW = useNarrowBlankCol
      ? BLANK_LEFT_COL_MM
      : cardWidth * drawWPct - 2;
    const rightColX = useNarrowBlankCol
      ? cardLeft + BLANK_LEFT_COL_MM + 2
      : cardLeft + cardWidth * drawWPct + 2;
    const rightColW = useNarrowBlankCol
      ? cardWidth - BLANK_LEFT_COL_MM - pad - 5
      : cardWidth * (1 - drawWPct) - 5;

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
        const drawX = cardLeft + pad + (leftColW - pad * 2 - dw) / 2;
        pdf.addImage(drawingData, drawX, y, dw, dh);
        drawingBottomY = y + dh + 2;
      } catch { /* skip */ }
    } else if (item.manualBlankPreview) {
      // Phase 5F card-tightening — bounded compact blank placeholder.
      // Strict caps ~32mm wide × 14mm tall regardless of the surrounding
      // column so the placeholder never dominates the card. Aspect ratio
      // is preserved within those bounds. Indicative geometry only —
      // never holes, folds, cutouts, or any manufacturing detail.
      // ASCII / Latin-1 only ("x") so jsPDF helvetica cannot mangle it.
      const BLANK_BOX_MAX_W_MM = 32;
      const BLANK_BOX_MAX_H_MM = 14;
      const lengthMm = item.manualBlankPreview.lengthMm;
      const widthMm = item.manualBlankPreview.widthMm;
      const scale = Math.min(BLANK_BOX_MAX_W_MM / lengthMm, BLANK_BOX_MAX_H_MM / widthMm);
      const rectW = Math.max(6, lengthMm * scale);
      const rectH = Math.max(4, widthMm * scale);
      // Centre the bounded box within the (now narrow) left column.
      const colInnerW = leftColW - pad * 2;
      const rectX = cardLeft + pad + (colInnerW - rectW) / 2;
      const rectY = y + 1;
      pdf.setDrawColor(COLOR_BORDER);
      pdf.setLineWidth(0.3);
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(rectX, rectY, rectW, rectH, 0.6, 0.6, "FD");
      // Centred dimension label inside the bounded rectangle. Smaller
      // font (6.5pt) so it fits the new compact box.
      pdf.setFont(FONT_NORMAL, "normal");
      pdf.setFontSize(6.5);
      pdf.setTextColor(COLOR_BLACK);
      const dimText = `${lengthMm} x ${widthMm}mm`;
      const dimTextW = pdf.getTextWidth(dimText);
      const dimX = rectX + (rectW - dimTextW) / 2;
      const dimY = rectY + rectH / 2 + 1;
      pdf.text(dimText, dimX, dimY);
      // Italic muted caption beneath the rectangle, centred under the
      // bounded blank box (not the full left column).
      pdf.setFont(FONT_NORMAL, "italic");
      pdf.setFontSize(5.5);
      pdf.setTextColor(COLOR_MUTED);
      const captionText = "Indicative blank only";
      const captionW = pdf.getTextWidth(captionText);
      const captionX = rectX + (rectW - captionW) / 2;
      const captionY = rectY + rectH + 3;
      pdf.text(captionText, captionX, captionY);
      drawingBottomY = captionY + 1;
    }

    let specY = y;
    if (item.visibleSpecs.length > 0) {
      specY = renderSpecTableNoPageBreak(pdf, specY, item.visibleSpecs, rightColX, rightColW);
    }
    y = Math.max(drawingBottomY, specY);
  }

  y += 2;

  // Phase 5F.2 — compact, supplier-style customer pricing block (LL
  // parent items only). Renders an optional small nested operation
  // breakdown ("- Laser cut blank: $X", "- Folding: $X") only when the
  // showOperationPricing toggle is ON, then a right-aligned compact
  // "UNIT PRICE / LINE TOTAL" pair using the COMBINED values
  // (parent + Σ ops). Operations themselves are summarised as part of
  // the spec block above (synthesized "Operations" row added by
  // quote-renderer.ts → finaliseParentDisplay). ASCII / Latin-1 only.
  y = drawCompactItemPricing(pdf, y, item, cardLeft, cardWidth, pad);

  if (item.gosNote || item.catDoorNote) {
    pdf.setFont(FONT_NORMAL, "italic");
    pdf.setFontSize(7);
    pdf.setTextColor(COLOR_ACCENT);
    if (item.gosNote) {
      pdf.text(`[GOS] ${item.gosNote}`, cardLeft + pad, y + 2.5);
      y += 4;
    }
    if (item.catDoorNote) {
      pdf.text(`\u2022  ${item.catDoorNote}`, cardLeft + pad, y + 2.5);
      y += 4;
    }
  }

  if (item.paneGlassSpecs && item.paneGlassSpecs.length > 0) {
    y += 2;
    pdf.setFont(FONT_NORMAL, "bold");
    pdf.setFontSize(6.5);
    pdf.setTextColor(COLOR_MUTED);
    pdf.text("PANE-LEVEL GLAZING", cardLeft + pad, y + 2.5);
    y += 4;
    pdf.setFont(FONT_NORMAL, "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(COLOR_BLACK);
    for (const ps of [...item.paneGlassSpecs].sort((a, b) => a.paneIndex - b.paneIndex)) {
      const label = [ps.iguType, ps.glassType, ps.glassThickness].filter(Boolean).join(" · ") || "—";
      pdf.text(`Pane ${ps.paneIndex + 1}: ${label}`, cardLeft + pad + 2, y + 2.5);
      y += 3.5;
    }
  }

  // Phase 5F.1 — attached operations are now rendered as rows inside the
  // grouped pricing table above; no separate Operations block here.

  if (hasPhotos) {
    const renderedPhotosResult = await tryRenderPhotos(pdf, y, loadablePhotos, imageCache, item.title, pad, startY, itemStartPage, cardLeft, cardWidth);
    if (renderedPhotosResult.rendered) {
      if (renderedPhotosResult.newPage) {
        drawItemBorder(pdf, startY, y, itemStartPage, cardLeft, cardWidth);
        return renderedPhotosResult.y + 2;
      }
      y = renderedPhotosResult.y;
    }
  }

  drawItemBorder(pdf, startY, y, itemStartPage, cardLeft, cardWidth);
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
  cardLeft: number = LEFT_MARGIN,
  cardWidth: number = CONTENT_WIDTH,
): Promise<{ rendered: boolean; y: number; newPage: boolean }> {
  const actuallyLoadable = photos.filter((p) => imageCache.has(p.key));
  if (actuallyLoadable.length === 0) return { rendered: false, y, newPage: false };

  if (y + DENSITY_PHOTO_ROW_H > MAX_Y) {
    drawItemBorder(pdf, cardStartY, y, cardStartPage, cardLeft, cardWidth);
    pdf.addPage();
    y = TOP_MARGIN;
    const photosStartY = y;

    const result = await renderPhotosFromCache(pdf, y + 5, actuallyLoadable, imageCache);
    if (result.count > 0) {
      pdf.setFont(FONT_NORMAL, "bold");
      pdf.setFontSize(mmSize(T.typography.specLabelSize));
      pdf.setTextColor(COLOR_MUTED);
      pdf.text(`${itemTitle} — SITE PHOTOS (continued)`, cardLeft + pad, y + 3);
      y = result.y;
    }
    drawItemBorder(pdf, photosStartY - 2, y, pdf.getNumberOfPages(), cardLeft, cardWidth);
    return { rendered: result.count > 0, y, newPage: true };
  }

  const headingY = y;
  const result = await renderPhotosFromCache(pdf, y + 5, actuallyLoadable, imageCache);
  if (result.count > 0) {
    pdf.setFont(FONT_NORMAL, "bold");
    pdf.setFontSize(mmSize(T.typography.specLabelSize));
    pdf.setTextColor(COLOR_MUTED);
    pdf.text("SITE PHOTOS", cardLeft + pad, headingY + 3);
    y = result.y;
    return { rendered: true, y, newPage: false };
  }
  return { rendered: false, y: headingY, newPage: false };
}

function drawItemBorder(
  pdf: Pdf,
  startY: number,
  endY: number,
  startPage: number,
  cardLeft: number = LEFT_MARGIN,
  cardWidth: number = CONTENT_WIDTH,
) {
  const currentPage = pdf.getNumberOfPages();
  if (currentPage !== startPage) return;

  pdf.setDrawColor(COLOR_BORDER);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(cardLeft, startY - 2, cardWidth, endY - startY + 3, 1, 1, "S");
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

function cleanWrappedLines(lines: string[]): string[] {
  if (lines.length <= 1) return lines;
  return lines.map(line => line.replace(/ -$/, "").replace(/ \/$/, "").replace(/ \/\/$/, "").trimEnd());
}

// Phase 5F.2 — compact, supplier-style customer pricing block.
// Replaces the prior bulky grouped table with:
//   1. (optional) small nested op breakdown ("- Laser cut blank: $X",
//      "- Folding: $X") shown only when showOperationPricing is ON
//      and at least one price toggle is ON.
//   2. Right-aligned compact summary lines:
//        UNIT PRICE   $205.13 ea
//        LINE TOTAL   $1,025.64
//      using the COMBINED values (parent + Σ ops) so the customer sees
//      a single price per item.
//
// ASCII / Latin-1 only — uses "-" as bullet, " - " between procedure
// type and description, "$" for currency. No em-dash, no `↳`, no
// glyphs outside Latin-1 (jsPDF helvetica-only safe).
//
// Mirror of CompactItemPricing in client/src/pages/quote-preview.tsx.
// Snapshot subtotal/GST/total are NOT recomputed here — they are
// rendered upstream from snapshot.totalsBreakdown.
// Phase 5F.4 — no-op. The Pricing / Detail / Operations content has
// moved into the spec table as appended RenderSpecEntry rows
// (added by finaliseParentDisplay() in quote-renderer.ts), so the
// rows render through renderSpecTableNoPageBreak above. Both the
// y-advance and the visible content come from the spec-table render
// path, giving Preview/PDF perfect parity. The function is preserved
// as a stable extension point in case future phases reintroduce a
// dedicated supplier-style block; it currently returns y unchanged.
function drawCompactItemPricing(
  _pdf: Pdf,
  y: number,
  _item: RenderScheduleItem,
  _cardLeft: number,
  _cardWidth: number,
  _pad: number,
): number {
  return y;
}

// Phase 5F.2 — defensive ASCII / Latin-1 sanitizer for spec values
// rendered into jsPDF helvetica (Latin-1 only). Replaces common
// "smart" punctuation that callers may forget to convert: em-dash,
// en-dash, smart quotes, ellipsis. Spec entries may also opt in
// explicitly via `pdfValue`, which takes precedence.
// Phase 5F.3 — extracted shared sanitizer so price-detail strings
// (which embed user-entered procedureType) get the same defensive
// normalization as spec values.
function sanitizeForPdfText(raw: string): string {
  return raw
    .replace(/\u2014/g, " - ")  // em-dash
    .replace(/\u2013/g, "-")    // en-dash
    .replace(/[\u2018\u2019]/g, "'")  // smart single quotes
    .replace(/[\u201C\u201D]/g, '"')  // smart double quotes
    .replace(/\u2026/g, "...")  // ellipsis
    .replace(/\u21B3/g, "->");  // turn-down right arrow (legacy `↳`)
}

function specValueForPdf(entry: RenderSpecEntry): string {
  return sanitizeForPdfText(entry.pdfValue ?? entry.value);
}

function renderSpecTableNoPageBreak(pdf: Pdf, y: number, specs: RenderSpecEntry[], x: number, w: number): number {
  const rowH = DENSITY_SPEC_ROW_H;
  const labelW = w * 0.45;
  const valueW = w - labelW - 4;
  const valueFontPt = mmSize(T.typography.specValueSize);
  const lineSpacingMm = valueFontPt * 1.15 * 0.352778;
  const multiLineExtraPad = 1.5;

  for (let i = 0; i < specs.length; i++) {
    pdf.setFont(FONT_NORMAL, "normal");
    pdf.setFontSize(mmSize(T.typography.specLabelSize));
    const labelLines = wrapText(pdf, specs[i].label, labelW - 2);

    pdf.setFontSize(valueFontPt);
    const rawValLines = wrapText(pdf, specValueForPdf(specs[i]), valueW);
    const valLines = cleanWrappedLines(rawValLines);

    const nLines = Math.max(labelLines.length, valLines.length);
    const dynamicRowH = nLines <= 1
      ? rowH
      : rowH + (nLines - 1) * lineSpacingMm + multiLineExtraPad;

    if (y + dynamicRowH > MAX_Y) break;

    if (i % 2 === 0) {
      pdf.setFillColor(COLOR_BG_MUTED);
      pdf.rect(x, y, w, dynamicRowH, "F");
    }

    pdf.setFont(FONT_NORMAL, "normal");
    pdf.setFontSize(mmSize(T.typography.specLabelSize));
    pdf.setTextColor(COLOR_MUTED);
    pdf.text(labelLines, x + 2, y + 3.2);

    pdf.setFontSize(valueFontPt);
    pdf.setTextColor(COLOR_BLACK);
    pdf.text(valLines, x + labelW, y + 3.2);

    y += dynamicRowH;
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
