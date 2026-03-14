export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    || "drawing";
}

export function svgToPngBlob(svgElement: SVGSVGElement, scale = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const svgRect = svgElement.getBoundingClientRect();
    const width = svgRect.width * scale;
    const height = svgRect.height * scale;

    const cloned = svgElement.cloneNode(true) as SVGSVGElement;
    cloned.setAttribute("width", String(svgRect.width));
    cloned.setAttribute("height", String(svgRect.height));

    const styles = document.querySelectorAll("style");
    const defsEl = cloned.querySelector("defs") || document.createElementNS("http://www.w3.org/2000/svg", "defs");
    if (!cloned.querySelector("defs")) {
      cloned.insertBefore(defsEl, cloned.firstChild);
    }
    styles.forEach((s) => {
      const styleClone = s.cloneNode(true) as HTMLStyleElement;
      defsEl.appendChild(styleClone);
    });

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(cloned);
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to get canvas context"));
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, svgRect.width, svgRect.height);
      URL.revokeObjectURL(url);

      canvas.toBlob((pngBlob) => {
        if (pngBlob) {
          resolve(pngBlob);
        } else {
          reject(new Error("Failed to create PNG blob"));
        }
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load SVG image"));
    };
    img.src = url;
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadPng(svgElement: SVGSVGElement, filename: string): Promise<void> {
  const blob = await svgToPngBlob(svgElement, 3);
  const safeName = filename.endsWith(".png") ? filename : `${filename}.png`;
  downloadBlob(blob, safeName);
}

export async function compressImageToBlob(file: File, maxLongEdge = 1600, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        const longEdge = Math.max(w, h);
        if (longEdge > maxLongEdge) {
          const scale = maxLongEdge / longEdge;
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Failed to create JPEG blob"));
          },
          "image/jpeg",
          quality,
        );
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export async function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = (h * maxWidth) / w;
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
