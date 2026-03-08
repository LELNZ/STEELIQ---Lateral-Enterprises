import { jsPDF } from "jspdf";
import type { QuoteRenderModel, RenderScheduleItem, RenderTotalsLine, RenderSpecEntry } from "./quote-renderer";
import { SYSTEM_TEMPLATE, isSectionVisible } from "./quote-template";

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;
const CW = PAGE_W - MARGIN * 2;
const MAX_Y = PAGE_H - MARGIN;

const FONT_NORMAL = "helvetica";
const T = SYSTEM_TEMPLATE;
const COLOR_BLACK = T.colors.bodyText;
const COLOR_MUTED = T.colors.headingMuted;
const COLOR_ACCENT = T.colors.accent;
const COLOR_BORDER = T.colors.border;
const COLOR_BG_MUTED = T.colors.bgMuted;

type Pdf = jsPDF;

function ensureSpace(pdf: Pdf, y: number, needed: number): number {
  if (y + needed > MAX_Y) {
    pdf.addPage();
    return MARGIN;
  }
  return y;
}

function drawLine(pdf: Pdf, y: number, x1?: number, x2?: number) {
  pdf.setDrawColor(COLOR_BORDER);
  pdf.setLineWidth(0.3);
  pdf.line(x1 ?? MARGIN, y, x2 ?? (MARGIN + CW), y);
}

function wrapText(pdf: Pdf, text: string, maxWidth: number): string[] {
  return pdf.splitTextToSize(text, maxWidth) as string[];
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
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

export async function generateQuotePdf(
  model: QuoteRenderModel,
  onProgress?: (status: string) => void,
): Promise<void> {
  onProgress?.("Initializing PDF...");

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = MARGIN;

  if (isSectionVisible(T, "header")) {
    y = await renderHeader(pdf, y, model);
    y = renderSeparator(pdf, y);
  }

  if (isSectionVisible(T, "disclaimer")) {
    y = renderDisclaimer(pdf, y, model.disclaimerText);
  }

  if (isSectionVisible(T, "customerProject")) {
    y = renderCustomerProject(pdf, y, model);
  }

  if (isSectionVisible(T, "totals")) {
    y = renderTotals(pdf, y, model);
  }

  if (isSectionVisible(T, "legal")) {
    onProgress?.("Rendering terms...");
    y = renderLegal(pdf, y, model);
  }

  if (isSectionVisible(T, "schedule")) {
    onProgress?.("Rendering schedule...");
    y = await renderSchedule(pdf, y, model, onProgress);
  }

  if (isSectionVisible(T, "acceptance")) {
    onProgress?.("Rendering acceptance...");
    y = renderAcceptance(pdf, y);
  }

  const safeName = (model.header.quoteNumber || "quote").replace(/[^a-zA-Z0-9-_]/g, "_");
  onProgress?.("Saving...");
  pdf.save(`${safeName}.pdf`);
}

async function renderHeader(pdf: Pdf, y: number, model: QuoteRenderModel): Promise<number> {
  const { branding, orgContact, header } = model;
  const startY = y;

  if (branding.logoUrl) {
    const logoData = await loadImageAsDataUrl(branding.logoUrl);
    if (logoData) {
      try {
        const dims = await getImageDimensions(logoData);
        const maxLogoH = 12;
        const maxLogoW = 40;
        const scale = Math.min(maxLogoW / dims.w, maxLogoH / dims.h, 1);
        const lw = dims.w * scale;
        const lh = dims.h * scale;
        pdf.addImage(logoData, MARGIN, y, lw, lh);
        y += lh + 2;
      } catch { /* skip logo */ }
    }
  }

  pdf.setFont(FONT_NORMAL, "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(COLOR_BLACK);
  pdf.text(branding.tradingName, MARGIN, y + 5);
  y += 7;

  pdf.setFont(FONT_NORMAL, "italic");
  pdf.setFontSize(8);
  pdf.setTextColor(COLOR_MUTED);
  pdf.text(branding.legalLine, MARGIN, y + 3);
  y += 6;

  let rightY = startY + 2;
  const rightX = MARGIN + CW;
  pdf.setFont(FONT_NORMAL, "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(COLOR_MUTED);

  const contactLines: string[] = [];
  if (orgContact.address) contactLines.push(orgContact.address);
  if (orgContact.phone) contactLines.push(orgContact.phone);
  if (orgContact.email) contactLines.push(orgContact.email);
  if (orgContact.gstNumber) contactLines.push(`GST: ${orgContact.gstNumber}`);
  if (orgContact.nzbn) contactLines.push(`NZBN: ${orgContact.nzbn}`);

  for (const line of contactLines) {
    rightY += 3.5;
    pdf.text(line, rightX, rightY, { align: "right" });
  }

  y = Math.max(y, rightY + 2);
  return y;
}

function renderSeparator(pdf: Pdf, y: number): number {
  y += 2;
  drawLine(pdf, y);
  y += 4;
  return y;
}

function renderDisclaimer(pdf: Pdf, y: number, text: string): number {
  y = ensureSpace(pdf, y, 8);
  pdf.setFont(FONT_NORMAL, "italic");
  pdf.setFontSize(8);
  pdf.setTextColor(COLOR_MUTED);
  const lines = wrapText(pdf, text, CW);
  pdf.text(lines, MARGIN, y + 3);
  y += lines.length * 3.5 + 4;
  return y;
}

function renderCustomerProject(pdf: Pdf, y: number, model: QuoteRenderModel): number {
  const { header, customerProject } = model;
  y = ensureSpace(pdf, y, 30);

  const colW = CW / 2;

  pdf.setFont(FONT_NORMAL, "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(COLOR_MUTED);
  pdf.text("CUSTOMER", MARGIN, y + 3);

  pdf.setFont(FONT_NORMAL, "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(COLOR_BLACK);
  pdf.text(customerProject.customerName, MARGIN, y + 9);

  let custY = y + 12;
  if (customerProject.hasProjectAddress) {
    pdf.setFont(FONT_NORMAL, "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(COLOR_MUTED);
    pdf.text("PROJECT ADDRESS", MARGIN, custY + 3);
    pdf.setFontSize(9);
    pdf.setTextColor(COLOR_BLACK);
    const addrLines = wrapText(pdf, customerProject.projectAddress, colW - 5);
    pdf.text(addrLines, MARGIN, custY + 7);
    custY += 7 + addrLines.length * 3.5;
  }

  const rightX = MARGIN + colW + 5;
  let rightY = y;

  pdf.setFont(FONT_NORMAL, "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(COLOR_MUTED);

  const quoteInfoItems = [
    { label: "Quote #", value: header.quoteNumber },
    { label: "Date", value: header.dateFormatted },
    { label: "Valid Until", value: header.expiryFormatted },
  ];

  for (const info of quoteInfoItems) {
    pdf.setFontSize(7);
    pdf.setTextColor(COLOR_MUTED);
    pdf.text(info.label + ":", rightX, rightY + 3, { align: "left" });
    pdf.setFontSize(9);
    pdf.setTextColor(COLOR_BLACK);
    pdf.setFont(FONT_NORMAL, info.label === "Quote #" ? "bold" : "normal");
    pdf.text(info.value, rightX + 25, rightY + 3);
    pdf.setFont(FONT_NORMAL, "normal");
    rightY += 5;
  }

  y = Math.max(custY, rightY) + 4;
  return y;
}

function renderTotals(pdf: Pdf, y: number, model: QuoteRenderModel): number {
  const { totals } = model;
  if (totals.isEmpty) return y;

  const blockH = totals.lines.length * 6 + 10;
  y = ensureSpace(pdf, y, blockH);

  const boxX = MARGIN;
  const boxW = CW;
  const boxH = blockH;

  pdf.setDrawColor(COLOR_BORDER);
  pdf.setLineWidth(0.3);
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(boxX, y, boxW, boxH, 2, 2, "FD");

  y += 5;
  const labelX = MARGIN + 8;
  const amountX = MARGIN + CW - 8;

  for (const line of totals.lines) {
    if (line.emphasis === "separator") {
      drawLine(pdf, y, labelX - 2, amountX + 2);
      y += 3;
      continue;
    }

    if (line.emphasis === "bold") {
      pdf.setFont(FONT_NORMAL, "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(COLOR_BLACK);
    } else if (line.emphasis === "muted") {
      pdf.setFont(FONT_NORMAL, "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(COLOR_MUTED);
    } else {
      pdf.setFont(FONT_NORMAL, "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(COLOR_BLACK);
    }

    pdf.text(line.label, labelX, y + 3);
    pdf.text(line.formatted, amountX, y + 3, { align: "right" });
    y += 6;
  }

  y += 5;
  pdf.setFont(FONT_NORMAL, "normal");
  return y;
}

function renderLegal(pdf: Pdf, y: number, model: QuoteRenderModel): number {
  const { legal } = model;
  if (legal.sections.length === 0 && !legal.hasBankDetails) return y;

  pdf.addPage();
  y = MARGIN;

  pdf.setFont(FONT_NORMAL, "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(COLOR_ACCENT);
  pdf.text("TERMS & CONDITIONS", MARGIN, y + 4);
  y += 10;

  for (const section of legal.sections) {
    y = ensureSpace(pdf, y, 15);

    pdf.setFont(FONT_NORMAL, "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(COLOR_MUTED);
    pdf.text(section.heading.toUpperCase(), MARGIN, y + 3);
    y += 6;

    pdf.setFont(FONT_NORMAL, "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(COLOR_BLACK);
    const bodyLines = wrapText(pdf, section.body, CW);

    for (let i = 0; i < bodyLines.length; i++) {
      y = ensureSpace(pdf, y, 4);
      pdf.text(bodyLines[i], MARGIN, y + 3);
      y += 3.5;
    }

    y += 4;
  }

  if (legal.hasBankDetails && legal.bankDetails) {
    y = ensureSpace(pdf, y, 15);

    pdf.setFont(FONT_NORMAL, "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(COLOR_MUTED);
    pdf.text("BANK DETAILS", MARGIN, y + 3);
    y += 6;

    pdf.setFont(FONT_NORMAL, "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(COLOR_BLACK);
    const bankLines = wrapText(pdf, legal.bankDetails, CW);
    for (const bl of bankLines) {
      y = ensureSpace(pdf, y, 4);
      pdf.text(bl, MARGIN, y + 3);
      y += 3.5;
    }
    y += 4;
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

  pdf.addPage();
  y = MARGIN;

  pdf.setFont(FONT_NORMAL, "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(COLOR_ACCENT);
  pdf.text("SCHEDULE OF ITEMS", MARGIN, y + 4);
  y += 10;

  for (let si = 0; si < model.scheduleItems.length; si++) {
    const item = model.scheduleItems[si];
    onProgress?.(`Rendering item ${si + 1} of ${model.scheduleItems.length}...`);

    const estimatedH = 30 + item.visibleSpecs.length * 4 + (item.media.customerPhotos.length > 0 ? 35 : 0);
    y = ensureSpace(pdf, y, Math.min(estimatedH, MAX_Y - MARGIN - 10));

    y = await renderScheduleItem(pdf, y, item);
    y += 4;
  }

  return y;
}

async function renderScheduleItem(pdf: Pdf, y: number, item: RenderScheduleItem): Promise<number> {
  const headerH = 16;
  const specH = item.visibleSpecs.length * 4.5;
  const drawingH = item.media.drawingUrl ? 57 : 0;
  const photosH = item.media.customerPhotos.length > 0 ? 35 : 0;
  const minItemH = headerH + Math.max(drawingH, specH) + photosH + 6;

  y = ensureSpace(pdf, y, Math.min(minItemH, MAX_Y - MARGIN - 5));
  const itemStartPage = pdf.getNumberOfPages();
  const startY = y;

  pdf.setFont(FONT_NORMAL, "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(COLOR_BLACK);
  pdf.text(item.title, MARGIN + 3, y + 5);
  y += 7;

  pdf.setFont(FONT_NORMAL, "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(COLOR_MUTED);
  pdf.text(`${item.quantityLabel}  |  ${item.dimensionLabel}`, MARGIN + 3, y + 3);
  y += 7;

  const leftColW = CW / 2 - 2;
  const rightColX = MARGIN + CW / 2 + 2;
  const rightColW = CW / 2 - 5;

  let drawingBottomY = y;
  if (item.media.drawingUrl) {
    const drawingData = await loadImageAsDataUrl(item.media.drawingUrl);
    if (drawingData) {
      try {
        const dims = await getImageDimensions(drawingData);
        const maxDrawW = leftColW - 6;
        const maxDrawH = 55;
        const scale = Math.min(maxDrawW / dims.w, maxDrawH / dims.h, 1);
        const dw = dims.w * scale;
        const dh = dims.h * scale;

        const drawX = MARGIN + 3 + (leftColW - 6 - dw) / 2;
        pdf.addImage(drawingData, drawX, y, dw, dh);
        drawingBottomY = y + dh + 2;
      } catch { /* skip */ }
    }
  }

  let specY = y;
  if (item.visibleSpecs.length > 0) {
    specY = renderSpecTableNoPageBreak(pdf, specY, item.visibleSpecs, rightColX, rightColW);
  }

  y = Math.max(drawingBottomY, specY) + 2;

  if (item.media.customerPhotos.length > 0) {
    if (y + 35 > MAX_Y) {
      drawItemBorder(pdf, startY, y, itemStartPage);
      pdf.addPage();
      y = MARGIN;
      const photosStartY = y;

      pdf.setFont(FONT_NORMAL, "bold");
      pdf.setFontSize(7);
      pdf.setTextColor(COLOR_MUTED);
      pdf.text(`${item.title} — SITE PHOTOS (continued)`, MARGIN + 3, y + 3);
      y += 5;

      y = await renderPhotos(pdf, y, item.media.customerPhotos);
      drawItemBorder(pdf, photosStartY - 2, y, pdf.getNumberOfPages());
      return y + 2;
    }

    pdf.setFont(FONT_NORMAL, "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(COLOR_MUTED);
    pdf.text("SITE PHOTOS", MARGIN + 3, y + 3);
    y += 5;

    y = await renderPhotos(pdf, y, item.media.customerPhotos);
  }

  drawItemBorder(pdf, startY, y, itemStartPage);
  return y + 2;
}

function drawItemBorder(pdf: Pdf, startY: number, endY: number, startPage: number) {
  const currentPage = pdf.getNumberOfPages();
  if (currentPage !== startPage) return;

  pdf.setDrawColor(COLOR_BORDER);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(MARGIN, startY - 2, CW, endY - startY + 4, 1.5, 1.5, "S");
}

async function renderPhotos(pdf: Pdf, y: number, photos: { url: string; caption: string; key: string }[]): Promise<number> {
  let photoX = MARGIN + 3;
  const photoMaxW = 30;
  const photoMaxH = 25;

  for (const photo of photos) {
    const photoData = await loadImageAsDataUrl(photo.url);
    if (!photoData) continue;

    try {
      const dims = await getImageDimensions(photoData);
      const scale = Math.min(photoMaxW / dims.w, photoMaxH / dims.h, 1);
      const pw = dims.w * scale;
      const ph = dims.h * scale;

      if (photoX + pw > MARGIN + CW - 3) {
        photoX = MARGIN + 3;
        y += photoMaxH + 3;
        if (y + photoMaxH > MAX_Y) {
          pdf.addPage();
          y = MARGIN;
        }
      }

      pdf.addImage(photoData, photoX, y, pw, ph);
      photoX += pw + 3;
    } catch { /* skip */ }
  }
  y += photoMaxH + 2;
  return y;
}

function renderSpecTableNoPageBreak(pdf: Pdf, y: number, specs: RenderSpecEntry[], x: number, w: number): number {
  const rowH = 4.5;
  const labelW = w * 0.45;

  for (let i = 0; i < specs.length; i++) {
    if (y + rowH > MAX_Y) break;

    if (i % 2 === 0) {
      pdf.setFillColor(COLOR_BG_MUTED);
      pdf.rect(x, y, w, rowH, "F");
    }

    pdf.setFont(FONT_NORMAL, "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(COLOR_MUTED);

    const labelLines = wrapText(pdf, specs[i].label, labelW - 2);
    pdf.text(labelLines[0] || specs[i].label, x + 2, y + 3.2);

    pdf.setTextColor(COLOR_BLACK);
    const valLines = wrapText(pdf, specs[i].value, w - labelW - 4);
    pdf.text(valLines[0] || specs[i].value, x + labelW, y + 3.2);

    y += rowH;
  }

  return y;
}

function renderAcceptance(pdf: Pdf, y: number): number {
  y = ensureSpace(pdf, y, 45);

  y += 6;
  drawLine(pdf, y);
  y += 6;

  pdf.setFont(FONT_NORMAL, "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(COLOR_BLACK);
  pdf.text("Acceptance", MARGIN, y + 3);
  y += 10;

  const fields = T.acceptance.fields;
  const fieldW = CW / 3;

  for (let i = 0; i < fields.length; i++) {
    const fx = MARGIN + i * fieldW;

    pdf.setFont(FONT_NORMAL, "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(COLOR_MUTED);
    pdf.text(fields[i], fx + 2, y + 3);

    pdf.setDrawColor(COLOR_BORDER);
    pdf.setLineDashPattern([1, 1], 0);
    pdf.line(fx + 2, y + 15, fx + fieldW - 4, y + 15);
    pdf.setLineDashPattern([], 0);
  }

  y += 20;
  return y;
}
