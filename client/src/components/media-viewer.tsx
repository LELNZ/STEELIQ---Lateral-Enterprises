import { useEffect, useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, ZoomIn, ZoomOut } from "lucide-react";

interface MediaViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  alt?: string;
  title?: string;
  downloadFilename?: string;
}

export function MediaViewer({
  open,
  onOpenChange,
  src,
  alt = "Image",
  title,
  downloadFilename,
}: MediaViewerProps) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (open) setZoom(1);
  }, [open]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    },
    [onOpenChange]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  const handleDownload = async () => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadFilename || "image.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(src, "_blank");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden" data-testid="media-viewer-dialog">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle data-testid="media-viewer-title">{title || alt}</DialogTitle>
          <DialogDescription className="sr-only">Enlarged view of {title || alt}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 px-4 pb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
            disabled={zoom <= 0.25}
            data-testid="button-zoom-out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground min-w-[50px] text-center" data-testid="text-zoom-level">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
            disabled={zoom >= 4}
            data-testid="button-zoom-in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={handleDownload} data-testid="button-download-image">
            <Download className="h-4 w-4 mr-1" /> Download
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} data-testid="button-close-viewer">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-4 pt-0 flex items-center justify-center min-h-[300px] max-h-[70vh]">
          <img
            src={src}
            alt={alt}
            style={{ transform: `scale(${zoom})`, transformOrigin: "center center", transition: "transform 0.15s ease" }}
            className="max-w-full max-h-full object-contain"
            data-testid="media-viewer-image"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
