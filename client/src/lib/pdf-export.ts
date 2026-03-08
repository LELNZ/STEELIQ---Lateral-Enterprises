import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 12;
const CONTENT_WIDTH_MM = A4_WIDTH_MM - MARGIN_MM * 2;
const CONTENT_HEIGHT_MM = A4_HEIGHT_MM - MARGIN_MM * 2;

export async function exportQuotePreviewToPdf(
  container: HTMLElement,
  filename: string,
  onProgress?: (status: string) => void,
): Promise<void> {
  onProgress?.("Preparing document...");

  const originalOverflow = container.style.overflow;
  const originalHeight = container.style.height;
  const originalMaxHeight = container.style.maxHeight;
  container.style.overflow = "visible";
  container.style.height = "auto";
  container.style.maxHeight = "none";

  try {
    onProgress?.("Rendering pages...");

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: 794,
    });

    onProgress?.("Generating PDF...");

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const imgWidth = CONTENT_WIDTH_MM;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const pageContentHeight = CONTENT_HEIGHT_MM;
    const totalPages = Math.ceil(imgHeight / pageContentHeight);

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) {
        pdf.addPage();
      }

      const sourceY = (page * pageContentHeight * canvas.width) / imgWidth;
      const sourceH = (pageContentHeight * canvas.width) / imgWidth;
      const actualSourceH = Math.min(sourceH, canvas.height - sourceY);

      if (actualSourceH <= 0) break;

      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = actualSourceH;
      const ctx = sliceCanvas.getContext("2d");
      if (!ctx) continue;

      ctx.drawImage(
        canvas,
        0,
        sourceY,
        canvas.width,
        actualSourceH,
        0,
        0,
        canvas.width,
        actualSourceH,
      );

      const sliceImgData = sliceCanvas.toDataURL("image/jpeg", 0.92);
      const sliceHeight = (actualSourceH * imgWidth) / canvas.width;

      pdf.addImage(sliceImgData, "JPEG", MARGIN_MM, MARGIN_MM, imgWidth, sliceHeight);
    }

    onProgress?.("Saving...");
    pdf.save(filename);
  } finally {
    container.style.overflow = originalOverflow;
    container.style.height = originalHeight;
    container.style.maxHeight = originalMaxHeight;
  }
}
