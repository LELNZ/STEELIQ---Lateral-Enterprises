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
}

export interface SubcontractorPdfOptions {
  scopeMode: ScopeMode;
  projectName: string;
  siteAddress?: string;
  clientName?: string;
  dateIssued: string;
  preparedBy?: string;
  items: SubcontractorPdfItem[];
  includeDrawings: boolean;
  includeSitePhotos: boolean;
  includePricingReturn: boolean;
  sitePhotoDataUrls?: string[];
}

function ensureSpace(pdf: jsPDF, y: number, needed: number): number {
  if (y + needed > MAX_Y) {
    pdf.addPage();
    drawFooter(pdf);
    return TM;
  }
  return y;
}

let pageCountRef = { count: 0 };

function drawFooter(pdf: jsPDF) {
  pageCountRef.count++;
  pdf.setFont(FONT, "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(CLR_MUTED);
  pdf.text("Subcontractor Install Scope — Issued for pricing only. Not a contract document.", LM, PH - 10);
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

export async function generateSubcontractorPdf(opts: SubcontractorPdfOptions): Promise<jsPDF> {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  pageCountRef = { count: 0 };

  renderCoverPage(pdf, opts);
  pdf.addPage();
  drawFooter(pdf);
  let y = renderScopeSummary(pdf, opts);
  y = renderItemSchedule(pdf, opts, y);

  const hasDetailedContent = opts.includeDrawings || opts.includeSitePhotos;
  if (hasDetailedContent) {
    await renderDetailedItems(pdf, opts);
  }

  if (opts.includePricingReturn) {
    pdf.addPage();
    drawFooter(pdf);
    renderPricingReturn(pdf, opts);
  }

  return pdf;
}

function renderCoverPage(pdf: jsPDF, opts: SubcontractorPdfOptions) {
  drawFooter(pdf);
  let y = 45;

  pdf.setFont(FONT, "bold");
  pdf.setFontSize(22);
  pdf.setTextColor(CLR);
  pdf.text("SUBCONTRACTOR", LM, y);
  y += 9;
  pdf.text("INSTALL SCOPE", LM, y);
  y += 14;

  pdf.setDrawColor(CLR_ACCENT);
  pdf.setLineWidth(1);
  pdf.line(LM, y, LM + 40, y);
  y += 10;

  const badge = opts.scopeMode === "renovation" ? "RENOVATION" : "NEW BUILD";
  const badgeW = pdf.getTextWidth(badge) + 10;
  pdf.setFillColor(opts.scopeMode === "renovation" ? "#fef3c7" : "#dbeafe");
  pdf.roundedRect(LM, y - 5, badgeW, 8, 1.5, 1.5, "F");
  pdf.setFont(FONT, "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(opts.scopeMode === "renovation" ? "#92400e" : "#1e40af");
  pdf.text(badge, LM + 5, y + 0.5);
  y += 14;

  pdf.setTextColor(CLR_MUTED);
  pdf.setFont(FONT, "italic");
  pdf.setFontSize(9);
  pdf.text("Issued for subcontractor installation pricing only", LM, y);
  y += 14;

  const fields: [string, string | undefined][] = [
    ["Project", opts.projectName],
    ["Site Address", opts.siteAddress],
    ["Client / Builder", opts.clientName],
    ["Date Issued", opts.dateIssued],
    ["Prepared By", opts.preparedBy],
    ["Item Count", `${opts.items.length} item${opts.items.length !== 1 ? "s" : ""}`],
  ];

  pdf.setFontSize(9);
  for (const [label, value] of fields) {
    if (!value) continue;
    y = ensureSpace(pdf, y, 8);
    pdf.setFont(FONT, "bold");
    pdf.setTextColor(CLR_MUTED);
    pdf.text(`${label}:`, LM, y);
    pdf.setFont(FONT, "normal");
    pdf.setTextColor(CLR);
    pdf.text(value, LM + 35, y);
    y += 7;
  }

  if (opts.includeSitePhotos && opts.sitePhotoDataUrls && opts.sitePhotoDataUrls.length > 0) {
    y += 8;
    y = ensureSpace(pdf, y, 60);
    pdf.setFont(FONT, "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(CLR_MUTED);
    pdf.text("SITE PHOTOS", LM, y);
    y += 5;

    const maxPhotoW = 80;
    const maxPhotoH = 55;
    let px = LM;
    for (const dataUrl of opts.sitePhotoDataUrls.slice(0, 4)) {
      if (px + maxPhotoW > PW - RM) {
        px = LM;
        y += maxPhotoH + 4;
        y = ensureSpace(pdf, y, maxPhotoH + 4);
      }
      try {
        pdf.addImage(dataUrl, "JPEG", px, y, maxPhotoW, maxPhotoH);
      } catch { /* skip unloadable */ }
      px += maxPhotoW + 4;
    }
  }
}

function renderScopeSummary(pdf: jsPDF, opts: SubcontractorPdfOptions): number {
  let y = TM;

  pdf.setFont(FONT, "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(CLR);
  pdf.text("SCOPE SUMMARY", LM, y);
  y += 3;
  drawLine(pdf, y);
  y += 8;

  if (opts.scopeMode === "renovation") {
    y = renderScopeSection(pdf, y, "Scope Includes", [
      "Removal of existing window and door units as scheduled",
      "Disposal of removed units and associated debris from site",
      "Supply and installation of new aluminium/steel joinery as scheduled",
      "Standard pack, level, fix, and seal of all new units to existing openings",
      "Standard site cleanup of installation debris on completion",
    ]);
    y = renderScopeSection(pdf, y, "What Installation Includes", [
      "Positioning and fixing of new joinery into prepared openings",
      "Plumbing, levelling, and squaring of all units",
      "Fixing with appropriate mechanical fasteners",
      "Perimeter sealing with approved sealant",
      "Hardware adjustment and operation check",
      "Final clean of installed units",
    ]);
    y = renderScopeSection(pdf, y, "Assumptions", [
      "Existing openings are structurally sound and suitable for new joinery",
      "Adequate clear access to all installation locations",
      "Power and water available on site",
      "Builder to provide making good to reveals, plaster, and external cladding after installation",
      "Working hours: standard business hours unless agreed otherwise",
      "All units will be installed at ground level unless otherwise noted",
    ]);
    y = renderScopeSection(pdf, y, "Exclusions", [
      "Structural alterations or modifications to openings",
      "Builder's making good (plaster, paint, cladding, tiling, flooring)",
      "Electrical work including alarm sensors, blinds wiring, or light fittings",
      "Curtain, blind, or security screen removal and reinstatement",
      "Scaffolding, elevated work platforms, or crane access (unless specifically noted)",
      "Consent applications or building inspections",
      "Glazing replacement or reglazing of existing retained units",
      "Any work outside the scheduled items",
    ]);
    y = renderScopeSection(pdf, y, "Potential Variations", [
      "Unexpected framing defects, rot, or structural damage discovered during removal",
      "Out-of-square or out-of-plumb openings requiring additional packing or trimming",
      "Hidden services (electrical, plumbing) requiring relocation",
      "Access restrictions requiring alternative installation methods",
      "Additional sealant, flashing, or weatherproofing requirements beyond standard",
      "Delays caused by other trades or site readiness",
    ]);
  } else {
    y = renderScopeSection(pdf, y, "Scope Includes", [
      "Supply and installation of new aluminium/steel joinery as scheduled",
      "Standard pack, level, fix, and seal of all new units to prepared openings",
      "Standard site cleanup of installation debris on completion",
    ]);
    y = renderScopeSection(pdf, y, "What Installation Includes", [
      "Positioning and fixing of new joinery into prepared openings",
      "Plumbing, levelling, and squaring of all units",
      "Fixing with appropriate mechanical fasteners",
      "Perimeter sealing with approved sealant",
      "Hardware adjustment and operation check",
      "Final clean of installed units",
    ]);
    y = renderScopeSection(pdf, y, "Assumptions", [
      "All openings are prepared to correct dimensions and are plumb, level, and square",
      "Adequate clear access to all installation locations",
      "Power and water available on site",
      "Builder to coordinate sequencing with other trades",
      "Working hours: standard business hours unless agreed otherwise",
      "All units will be installed at ground level unless otherwise noted",
    ]);
    y = renderScopeSection(pdf, y, "Exclusions", [
      "Structural alterations or modifications to openings",
      "Builder's making good (plaster, paint, cladding, tiling, flooring)",
      "Electrical work including alarm sensors, blinds wiring, or light fittings",
      "Scaffolding, elevated work platforms, or crane access (unless specifically noted)",
      "Consent applications or building inspections",
      "Any work outside the scheduled items",
    ]);
    y = renderScopeSection(pdf, y, "Potential Variations", [
      "Openings not prepared to specified dimensions or not plumb/level/square",
      "Hidden services requiring relocation",
      "Access restrictions requiring alternative installation methods",
      "Additional sealant, flashing, or weatherproofing requirements beyond standard",
      "Delays caused by other trades or site readiness",
    ]);
  }

  return y;
}

function renderScopeSection(pdf: jsPDF, startY: number, heading: string, items: string[]): number {
  let y = ensureSpace(pdf, startY, 12 + items.length * 5);

  pdf.setFont(FONT, "bold");
  pdf.setFontSize(9.5);
  pdf.setTextColor(CLR_ACCENT);
  pdf.text(heading, LM, y);
  y += 5;

  pdf.setFont(FONT, "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(CLR);

  for (const item of items) {
    y = ensureSpace(pdf, y, 5);
    pdf.text("•", LM + 2, y);
    const lines = wrapText(pdf, item, CW - 8);
    for (const line of lines) {
      y = ensureSpace(pdf, y, 4.5);
      pdf.text(line, LM + 7, y);
      y += 4.2;
    }
  }

  y += 4;
  return y;
}

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
};

function renderItemSchedule(pdf: jsPDF, opts: SubcontractorPdfOptions, startY: number): number {
  let y = ensureSpace(pdf, startY, 30);

  pdf.setFont(FONT, "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(CLR);
  pdf.text("ITEM SCHEDULE", LM, y);
  y += 3;
  drawLine(pdf, y);
  y += 6;

  const cols = [
    { label: "#", w: 8 },
    { label: "Item Ref", w: 30 },
    { label: "Location", w: 28 },
    { label: "Category", w: 30 },
    { label: "Layout", w: 22 },
    { label: "W×H (mm)", w: 26 },
    { label: "Qty", w: 10 },
    { label: "Notes", w: CW - 8 - 30 - 28 - 30 - 22 - 26 - 10 },
  ];

  y = ensureSpace(pdf, y, 8);
  pdf.setFillColor(CLR_BG);
  pdf.rect(LM, y - 3.5, CW, 6, "F");
  pdf.setFont(FONT, "bold");
  pdf.setFontSize(7);
  pdf.setTextColor(CLR_MUTED);
  let cx = LM;
  for (const col of cols) {
    pdf.text(col.label, cx + 1, y);
    cx += col.w;
  }
  y += 5;

  pdf.setFont(FONT, "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(CLR);

  for (let i = 0; i < opts.items.length; i++) {
    y = ensureSpace(pdf, y, 6);
    const item = opts.items[i];
    cx = LM;

    const values = [
      String(i + 1),
      item.name || `Item ${i + 1}`,
      item.location || "—",
      CATEGORY_LABELS[item.category] || item.category,
      item.layout || "—",
      `${item.width}×${item.height}`,
      String(item.quantity || 1),
      item.notes || "",
    ];

    for (let c = 0; c < cols.length; c++) {
      const txt = values[c];
      const maxW = cols[c].w - 2;
      const truncated = pdf.splitTextToSize(txt, maxW)[0] || "";
      pdf.text(truncated, cx + 1, y);
      cx += cols[c].w;
    }

    if (i < opts.items.length - 1) {
      y += 1;
      pdf.setDrawColor("#e5e7eb");
      pdf.setLineWidth(0.15);
      pdf.line(LM, y + 1.5, PW - RM, y + 1.5);
    }
    y += 4.5;
  }

  y += 4;
  pdf.setFont(FONT, "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(CLR_MUTED);
  pdf.text(`Total: ${opts.items.length} item${opts.items.length !== 1 ? "s" : ""}`, LM, y);
  y += 8;

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

async function renderDetailedItems(pdf: jsPDF, opts: SubcontractorPdfOptions) {
  for (let i = 0; i < opts.items.length; i++) {
    const item = opts.items[i];
    pdf.addPage();
    drawFooter(pdf);
    let y = TM;

    pdf.setFont(FONT, "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(CLR);
    pdf.text(`ITEM ${i + 1}: ${item.name || "Untitled"}`, LM, y);
    y += 3;
    drawLine(pdf, y);
    y += 8;

    const details: [string, string][] = [
      ["Category", CATEGORY_LABELS[item.category] || item.category],
      ["Dimensions", `${item.width} × ${item.height} mm`],
      ["Quantity", String(item.quantity || 1)],
    ];
    if (item.layout) details.push(["Layout / Handing", item.layout]);
    if (item.location) details.push(["Location", item.location]);
    if (item.notes) details.push(["Notes", item.notes]);

    pdf.setFontSize(8.5);
    for (const [label, value] of details) {
      pdf.setFont(FONT, "bold");
      pdf.setTextColor(CLR_MUTED);
      pdf.text(`${label}:`, LM, y);
      pdf.setFont(FONT, "normal");
      pdf.setTextColor(CLR);
      pdf.text(value, LM + 35, y);
      y += 5.5;
    }

    if (opts.includeDrawings && item.drawingDataUrl) {
      y += 4;
      const maxDrawW = CW;
      const maxDrawH = 140;
      try {
        const dims = await loadImageDimensions(item.drawingDataUrl);
        const aspect = dims.width / dims.height;
        let dw = maxDrawW;
        let dh = dw / aspect;
        if (dh > maxDrawH) {
          dh = maxDrawH;
          dw = dh * aspect;
        }
        const dx = LM + (CW - dw) / 2;
        const drawFmt = item.drawingDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
        pdf.addImage(item.drawingDataUrl, drawFmt, dx, y, dw, dh);
        y += dh + 4;
      } catch { /* skip */ }
    }

    if (opts.includeSitePhotos && item.photoDataUrls && item.photoDataUrls.length > 0) {
      y = ensureSpace(pdf, y, 50);
      pdf.setFont(FONT, "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(CLR_MUTED);
      pdf.text("ITEM PHOTOS", LM, y);
      y += 4;

      let px = LM;
      for (const photoUrl of item.photoDataUrls.slice(0, 4)) {
        if (px + 50 > PW - RM) {
          px = LM;
          y += 40;
          y = ensureSpace(pdf, y, 40);
        }
        try {
          const fmt = photoUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
          pdf.addImage(photoUrl, fmt, px, y, 48, 36);
        } catch { /* skip */ }
        px += 52;
      }
    }
  }
}

function renderPricingReturn(pdf: jsPDF, opts: SubcontractorPdfOptions) {
  let y = TM;

  pdf.setFont(FONT, "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(CLR);
  pdf.text("PRICING RETURN", LM, y);
  y += 3;
  drawLine(pdf, y);
  y += 8;

  pdf.setFont(FONT, "italic");
  pdf.setFontSize(8);
  pdf.setTextColor(CLR_MUTED);
  pdf.text("Please complete this section and return with your quotation.", LM, y);
  y += 10;

  pdf.setFont(FONT, "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(CLR_ACCENT);
  pdf.text("A. Overall Pricing", LM, y);
  y += 7;

  const pricingFields = [
    "Total Price for Scope (excl. GST):",
    "GST:",
    "Total Price (incl. GST):",
    "Lead Time / Availability:",
  ];

  pdf.setFontSize(9);
  for (const field of pricingFields) {
    y = ensureSpace(pdf, y, 8);
    pdf.setFont(FONT, "normal");
    pdf.setTextColor(CLR);
    pdf.text(field, LM, y);
    pdf.setDrawColor(CLR_BORDER);
    pdf.setLineWidth(0.3);
    pdf.line(LM + 62, y + 0.5, PW - RM, y + 0.5);
    y += 8;
  }

  y += 4;
  const contactFields = [
    "Company Name:",
    "Contact Name:",
    "Phone:",
    "Email:",
  ];
  for (const field of contactFields) {
    y = ensureSpace(pdf, y, 8);
    pdf.setFont(FONT, "normal");
    pdf.setTextColor(CLR);
    pdf.text(field, LM, y);
    pdf.setDrawColor(CLR_BORDER);
    pdf.setLineWidth(0.3);
    pdf.line(LM + 30, y + 0.5, PW - RM, y + 0.5);
    y += 8;
  }

  y += 6;
  pdf.setFont(FONT, "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(CLR_ACCENT);
  pdf.text("B. Assumptions / Exclusions / Variations", LM, y);
  y += 7;

  const noteBoxes = [
    "Assumptions / Clarifications:",
    "Exclusions:",
    "Variation Risks / Items Requiring Confirmation:",
  ];

  pdf.setFontSize(8.5);
  for (const label of noteBoxes) {
    y = ensureSpace(pdf, y, 28);
    pdf.setFont(FONT, "bold");
    pdf.setTextColor(CLR_MUTED);
    pdf.text(label, LM, y);
    y += 4;
    pdf.setDrawColor(CLR_BORDER);
    pdf.setLineWidth(0.3);
    pdf.rect(LM, y, CW, 18);
    y += 22;
  }

  y += 4;
  y = ensureSpace(pdf, y, 20 + opts.items.length * 5.5);
  pdf.setFont(FONT, "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(CLR_ACCENT);
  pdf.text("C. Item-by-Item Pricing (Optional)", LM, y);
  y += 7;

  const pCols = [
    { label: "#", w: 8 },
    { label: "Item Ref", w: 28 },
    { label: "Location", w: 24 },
    { label: "Description", w: 36 },
    { label: "Qty", w: 10 },
    { label: "Price", w: 30 },
    { label: "Notes", w: CW - 8 - 28 - 24 - 36 - 10 - 30 },
  ];

  y = ensureSpace(pdf, y, 8);
  pdf.setFillColor(CLR_BG);
  pdf.rect(LM, y - 3.5, CW, 6, "F");
  pdf.setFont(FONT, "bold");
  pdf.setFontSize(7);
  pdf.setTextColor(CLR_MUTED);
  let cx = LM;
  for (const col of pCols) {
    pdf.text(col.label, cx + 1, y);
    cx += col.w;
  }
  y += 5;

  pdf.setFont(FONT, "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(CLR);

  for (let i = 0; i < opts.items.length; i++) {
    y = ensureSpace(pdf, y, 6);
    const item = opts.items[i];
    cx = LM;
    const catLabel = CATEGORY_LABELS[item.category] || item.category;
    const desc = `${catLabel} ${item.width}×${item.height}`;

    const vals = [
      String(i + 1),
      item.name || `Item ${i + 1}`,
      item.location || "—",
      desc,
      String(item.quantity || 1),
      "",
      "",
    ];

    for (let c = 0; c < pCols.length; c++) {
      const txt = vals[c];
      if (c === 5 || c === 6) {
        pdf.setDrawColor(CLR_BORDER);
        pdf.setLineWidth(0.2);
        pdf.line(cx + 1, y + 0.5, cx + pCols[c].w - 1, y + 0.5);
      } else {
        const truncated = pdf.splitTextToSize(txt, pCols[c].w - 2)[0] || "";
        pdf.text(truncated, cx + 1, y);
      }
      cx += pCols[c].w;
    }

    y += 5.5;
  }

  y += 6;
  pdf.setFont(FONT, "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(CLR_MUTED);
  pdf.text("Signature: ________________________    Date: ________________________", LM, y);
}
