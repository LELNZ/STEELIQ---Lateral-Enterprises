import { useState, useMemo, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ArrowLeftCircle, Download, Settings2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { PreviewData, QuoteDocumentModel } from "@/lib/quote-document";
import { buildQuoteDocumentModel } from "@/lib/quote-document";
import type { QuoteRenderModel, RenderScheduleItem, RenderTotalsLine } from "@/lib/quote-renderer";
import { buildQuoteRenderModel, rebuildScheduleItems } from "@/lib/quote-renderer";
import { MediaViewer } from "@/components/media-viewer";
import { generateQuotePdf } from "@/lib/pdf-engine";

export default function QuotePreview() {
  const [, paramsSingular] = useRoute("/quote/:id/preview");
  const [, paramsPlural] = useRoute("/quotes/:id/preview");
  const params = paramsSingular || paramsPlural;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const quoteId = params?.id;
  const [specSheetOpen, setSpecSheetOpen] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);

  const { data: preview, isLoading } = useQuery<PreviewData>({
    queryKey: ["/api/quotes", quoteId, "preview-data"],
    enabled: !!quoteId,
  });

  const doc: QuoteDocumentModel | null = useMemo(() => {
    if (!preview) return null;
    return buildQuoteDocumentModel(preview);
  }, [preview]);

  const renderModel: QuoteRenderModel | null = useMemo(() => {
    if (!doc) return null;
    return buildQuoteRenderModel(doc);
  }, [doc]);

  const [localKeys, setLocalKeys] = useState<string[] | null>(null);

  useEffect(() => { setLocalKeys(null); }, [quoteId]);

  const effectiveKeys = localKeys ?? doc?.specDisplay.effectiveKeys ?? [];

  const autoExportTriggered = useRef(false);
  useEffect(() => {
    if (autoExportTriggered.current || !renderModel) return;
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("export") !== "pdf") return;
    autoExportTriggered.current = true;
    const timer = setTimeout(async () => {
      setPdfExporting(true);
      try {
        await generateQuotePdf(renderModel);
        toast({ title: "PDF exported successfully" });
      } catch (err: any) {
        toast({ title: "PDF export failed", description: err.message, variant: "destructive" });
      } finally {
        setPdfExporting(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [renderModel, toast]);

  const liveScheduleItems: RenderScheduleItem[] = useMemo(() => {
    if (!doc) return [];
    if (localKeys) return rebuildScheduleItems(doc, localKeys);
    return renderModel?.scheduleItems ?? [];
  }, [doc, localKeys, renderModel]);

  const toggleSpecKey = (key: string) => {
    setLocalKeys(prev => {
      const current = prev ?? effectiveKeys;
      if (current.includes(key)) return current.filter(k => k !== key);
      return [...current, key];
    });
  };

  const saveSpecDisplayMutation = useMutation({
    mutationFn: async () => {
      if (!doc || !localKeys) return;
      await apiRequest("PATCH", `/api/quotes/${doc.metadata.quoteId}/revisions/${doc.metadata.revisionId}/spec-display`, {
        specDisplayKeys: localKeys,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "preview-data"] });
      toast({ title: "Spec display saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save spec display", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Loading preview...</p></div>;
  }

  if (!renderModel || !doc) {
    return <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Quote not found</p></div>;
  }

  const { header, branding, orgContact, customerProject, totals, legal, disclaimerText } = renderModel;

  return (
    <div className="max-w-4xl mx-auto print:max-w-none" data-testid="quote-preview-page">
      <div className="flex items-center justify-between flex-wrap gap-2 p-4 print:hidden border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/quote/${quoteId}`)} data-testid="button-back-to-quote">
            <ArrowLeftCircle className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">Customer Quote Preview</h1>
            <p className="text-sm text-muted-foreground">{header.quoteNumber} &middot; Revision {header.revisionVersion}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Sheet open={specSheetOpen} onOpenChange={setSpecSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-edit-spec-display">
                <Settings2 className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Edit </span>Spec Display
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Visible Specs</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                {Object.entries(doc.specDisplay.specDictionaryGrouped).map(([group, specs]) => (
                  <div key={group}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{group}</p>
                    <div className="space-y-1.5">
                      {specs.filter(s => s.customerVisibleAllowed).map(spec => (
                        <div key={spec.key} className="flex items-center gap-2">
                          <Checkbox
                            id={`spec-${spec.key}`}
                            checked={effectiveKeys.includes(spec.key)}
                            onCheckedChange={() => toggleSpecKey(spec.key)}
                            data-testid={`checkbox-spec-${spec.key}`}
                          />
                          <Label htmlFor={`spec-${spec.key}`} className="text-sm">{spec.label}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <Button
                  onClick={() => saveSpecDisplayMutation.mutate()}
                  disabled={saveSpecDisplayMutation.isPending || !localKeys}
                  className="w-full"
                  data-testid="button-save-spec-display"
                >
                  {saveSpecDisplayMutation.isPending ? "Saving..." : "Save Display Settings"}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <Button
            variant="default"
            size="sm"
            disabled={pdfExporting}
            onClick={async () => {
              if (!renderModel) return;
              setPdfExporting(true);
              try {
                const exportModel = { ...renderModel, scheduleItems: liveScheduleItems };
                await generateQuotePdf(exportModel);
                toast({ title: "PDF exported successfully" });
              } catch (err: any) {
                toast({ title: "PDF export failed", description: err.message, variant: "destructive" });
              } finally {
                setPdfExporting(false);
              }
            }}
            data-testid="button-export-pdf"
          >
            <Download className="h-4 w-4 mr-1" /> {pdfExporting ? "Exporting..." : "Export PDF"}
          </Button>
        </div>
      </div>

      <SnapshotBanner revisionVersion={header.revisionVersion} sourceJobId={doc.project.sourceJobId} />

      <div className="p-4 sm:p-8 print:p-4 space-y-8 print:space-y-6">
        <div className="space-y-6">
          <HeaderSection branding={branding} orgContact={orgContact} />
          <Separator />
          <p className="text-sm italic text-muted-foreground print:text-gray-500" data-testid="text-preliminary-disclaimer">
            {disclaimerText}
          </p>
          <CustomerProjectSection header={header} customerProject={customerProject} />
          <TotalsSection totals={totals} />
        </div>

        <LegalSection legal={legal} />

        <div className="print:break-before-page space-y-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Schedule of Items</h3>
          {liveScheduleItems.length === 0 && (
            <p className="text-sm text-muted-foreground">No items in this quote snapshot. This may be a legacy quote — try generating a new revision from the estimator.</p>
          )}
          {liveScheduleItems.map((item) => (
            <ScheduleItemCard
              key={item.index}
              item={item}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SnapshotBanner({ revisionVersion, sourceJobId }: { revisionVersion: number; sourceJobId: string | null }) {
  const [, navigate] = useLocation();
  return (
    <div className="print:hidden bg-muted/50 border-b px-4 py-2.5 flex items-start gap-2.5 text-sm" data-testid="snapshot-banner">
      <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
      <div className="space-y-0.5">
        <p className="text-muted-foreground">
          This preview reflects <span className="font-medium text-foreground">Revision {revisionVersion}</span>.
          Changes to specs, photos, or pricing in the estimate will appear here after you update the quote from the Executive Summary.
        </p>
        {sourceJobId && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-xs underline text-muted-foreground hover:text-foreground"
            onClick={() => navigate(`/job/${sourceJobId}/exec-summary`)}
            data-testid="link-go-to-exec-summary"
          >
            Go to Executive Summary to update
          </Button>
        )}
      </div>
    </div>
  );
}

function HeaderSection({ branding, orgContact }: { branding: QuoteRenderModel["branding"]; orgContact: QuoteRenderModel["orgContact"] }) {
  return (
    <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
      <div className="flex items-start gap-4">
        {branding.logoUrl && (
          <img
            src={branding.logoUrl}
            alt={`${branding.tradingName} logo`}
            className="max-h-14 max-w-[160px] object-contain print:max-h-12"
            data-testid="img-branding-logo"
          />
        )}
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-trading-name">
            {branding.tradingName}
          </h2>
          <p className="text-sm text-muted-foreground italic" data-testid="text-legal-line">
            {branding.legalLine}
          </p>
        </div>
      </div>
      <div className="sm:text-right text-sm text-muted-foreground space-y-0.5">
        {orgContact.address && <p>{orgContact.address}</p>}
        {orgContact.phone && <p>{orgContact.phone}</p>}
        {orgContact.email && <p>{orgContact.email}</p>}
        {orgContact.gstNumber && <p>GST: {orgContact.gstNumber}</p>}
        {orgContact.nzbn && <p>NZBN: {orgContact.nzbn}</p>}
      </div>
    </div>
  );
}

function CustomerProjectSection({ header, customerProject }: { header: QuoteRenderModel["header"]; customerProject: QuoteRenderModel["customerProject"] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Customer</p>
        <p className="text-lg font-semibold" data-testid="text-customer">{customerProject.customerName}</p>
        {customerProject.hasProjectAddress && (
          <div className="mt-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Project Address</p>
            <p className="text-sm" data-testid="text-project-address">{customerProject.projectAddress}</p>
          </div>
        )}
      </div>
      <div className="sm:text-right space-y-1">
        <div><span className="text-xs text-muted-foreground">Quote #: </span><span className="font-mono font-semibold" data-testid="text-quote-number-preview">{header.quoteNumber}</span></div>
        <div><span className="text-xs text-muted-foreground">Date: </span><span data-testid="text-quote-date">{header.dateFormatted}</span></div>
        <div><span className="text-xs text-muted-foreground">Valid Until: </span><span data-testid="text-quote-expiry">{header.expiryFormatted}</span></div>
      </div>
    </div>
  );
}

function TotalsSection({ totals }: { totals: QuoteRenderModel["totals"] }) {
  if (totals.isEmpty) {
    return (
      <div className="rounded-lg border p-4 space-y-2" data-testid="totals-block">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Quote Summary</h3>
        <p className="text-sm text-muted-foreground">No pricing data available.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4 space-y-2" data-testid="totals-block">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Quote Summary</h3>
      <div className="space-y-1 text-sm">
        {totals.lines.map((line, idx) => (
          <TotalsLineRow key={idx} line={line} />
        ))}
      </div>
    </div>
  );
}

function TotalsLineRow({ line }: { line: RenderTotalsLine }) {
  if (line.emphasis === "separator") return <Separator />;
  const testId = line.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
  return (
    <div className={`flex justify-between ${line.emphasis === "bold" ? "text-lg font-bold" : ""} ${line.emphasis === "muted" ? "text-muted-foreground" : ""} ${line.emphasis === "normal" ? "font-medium" : ""}`}>
      <span>{line.label}</span>
      <span data-testid={`text-${testId}`}>{line.formatted}</span>
    </div>
  );
}

function LegalSection({ legal }: { legal: QuoteRenderModel["legal"] }) {
  return (
    <div className="print:break-before-page space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Terms & Conditions</h3>
      {legal.sections.map((section) => (
        <div key={section.heading} className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase">{section.heading}</p>
          <p className="text-sm whitespace-pre-wrap">{section.body}</p>
        </div>
      ))}
      {legal.hasBankDetails && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Bank Details</p>
          <p className="text-sm whitespace-pre-wrap">{legal.bankDetails}</p>
        </div>
      )}
      <div className="mt-8 space-y-4 border-t pt-4">
        <p className="text-sm font-semibold">Acceptance</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="border-b border-dashed pb-6">
            <p className="text-xs text-muted-foreground">Signature</p>
          </div>
          <div className="border-b border-dashed pb-6">
            <p className="text-xs text-muted-foreground">Name</p>
          </div>
          <div className="border-b border-dashed pb-6">
            <p className="text-xs text-muted-foreground">Date</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MediaImage({
  src,
  alt,
  className,
  testId,
  fallbackTestId,
  fallbackText,
  onLoadStatusChange,
}: {
  src: string;
  alt: string;
  className?: string;
  testId: string;
  fallbackTestId: string;
  fallbackText: string;
  onLoadStatusChange?: (loaded: boolean) => void;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    onLoadStatusChange?.(true);
  }, [src]);

  if (failed) {
    return (
      <div
        className="flex items-center justify-center rounded border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground"
        data-testid={fallbackTestId}
      >
        {fallbackText}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      data-testid={testId}
      onError={() => {
        setFailed(true);
        onLoadStatusChange?.(false);
      }}
    />
  );
}

function SpecTable({ specs, itemIndex }: { specs: { key: string; label: string; value: string }[]; itemIndex: number }) {
  if (specs.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No specification data available for this item.</p>;
  }

  const useTwoCol = specs.length > 6;
  const midpoint = Math.ceil(specs.length / 2);

  if (useTwoCol) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4" data-testid={`spec-table-${itemIndex}`}>
        <table className="w-full text-sm">
          <tbody>
            {specs.slice(0, midpoint).map(({ key, label, value }) => (
              <tr key={key} className="border-b last:border-b-0">
                <td className="py-1 pr-2 text-muted-foreground text-xs leading-snug align-top" style={{ minWidth: "80px", maxWidth: "120px", overflowWrap: "break-word", wordBreak: "break-word" }}>{label}</td>
                <td className="py-1 font-medium text-sm leading-snug align-top" style={{ overflowWrap: "break-word", wordBreak: "break-word" }} data-testid={`text-spec-${key}-${itemIndex}`}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="w-full text-sm">
          <tbody>
            {specs.slice(midpoint).map(({ key, label, value }) => (
              <tr key={key} className="border-b last:border-b-0">
                <td className="py-1 pr-2 text-muted-foreground text-xs leading-snug align-top" style={{ minWidth: "80px", maxWidth: "120px", overflowWrap: "break-word", wordBreak: "break-word" }}>{label}</td>
                <td className="py-1 font-medium text-sm leading-snug align-top" style={{ overflowWrap: "break-word", wordBreak: "break-word" }} data-testid={`text-spec-${key}-${itemIndex}`}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <table className="w-full text-sm" data-testid={`spec-table-${itemIndex}`}>
      <tbody>
        {specs.map(({ key, label, value }) => (
          <tr key={key} className="border-b last:border-b-0">
            <td className="py-1 pr-3 text-muted-foreground text-xs leading-snug align-top" style={{ minWidth: "80px", maxWidth: "140px", overflowWrap: "break-word", wordBreak: "break-word" }}>{label}</td>
            <td className="py-1 font-medium text-sm leading-snug align-top" style={{ overflowWrap: "break-word", wordBreak: "break-word" }} data-testid={`text-spec-${key}-${itemIndex}`}>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ScheduleItemCard({
  item,
}: {
  item: RenderScheduleItem;
}) {
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState("");
  const [failedPhotos, setFailedPhotos] = useState<Set<string>>(new Set());
  const [drawingFailed, setDrawingFailed] = useState(false);

  const { visibleSpecs, media } = item;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 print:break-inside-avoid" data-testid={`schedule-item-${item.index}`}>
      <div>
        <h4 className="font-semibold" data-testid={`text-item-title-${item.index}`}>
          {item.title}
        </h4>
        <p className="text-sm text-muted-foreground">
          {item.quantityLabel} | {item.dimensionLabel}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {media.drawingUrl && (
          <div className="flex items-center justify-center">
            <div
              className={drawingFailed ? "" : "cursor-pointer print:cursor-default"}
              onClick={() => {
                if (!drawingFailed) {
                  setViewerSrc(media.drawingUrl);
                  setViewerTitle(media.drawingLabel);
                }
              }}
            >
              <MediaImage
                src={media.drawingUrl}
                alt={`Drawing for item ${item.index + 1}`}
                className="max-h-64 object-contain rounded border"
                testId={`img-drawing-${item.index}`}
                fallbackTestId={`fallback-drawing-${item.index}`}
                fallbackText="Drawing unavailable"
                onLoadStatusChange={(loaded) => { if (!loaded) setDrawingFailed(true); }}
              />
            </div>
          </div>
        )}
        <div>
          <SpecTable specs={visibleSpecs} itemIndex={item.index} />
        </div>
      </div>

      {media.customerPhotos.length > 0 && (
        <div className="space-y-2" data-testid={`photos-section-${item.index}`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Site Photos</p>
          <div className="flex flex-wrap gap-3">
            {media.customerPhotos.map((photo, pIdx) => {
              const isFailed = failedPhotos.has(photo.key);
              return (
                <div key={photo.key} className="space-y-1">
                  <div
                    className={isFailed ? "" : "cursor-pointer print:cursor-default"}
                    onClick={() => {
                      if (!isFailed) {
                        setViewerSrc(photo.url);
                        setViewerTitle(photo.caption);
                      }
                    }}
                  >
                    <MediaImage
                      src={photo.url}
                      alt={photo.caption}
                      className="max-h-48 max-w-[200px] object-contain rounded border"
                      testId={`img-photo-${item.index}-${pIdx}`}
                      fallbackTestId={`fallback-photo-${item.index}-${pIdx}`}
                      fallbackText="Photo unavailable"
                      onLoadStatusChange={(loaded) => {
                        if (!loaded) {
                          setFailedPhotos(prev => new Set(prev).add(photo.key));
                        }
                      }}
                    />
                  </div>
                  {photo.caption && !isFailed && (
                    <p className="text-xs text-muted-foreground text-center max-w-[200px]">{photo.caption}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <MediaViewer
        open={!!viewerSrc}
        onOpenChange={(open) => { if (!open) setViewerSrc(null); }}
        src={viewerSrc || ""}
        alt={viewerTitle}
        title={viewerTitle}
        downloadFilename={`${viewerTitle.replace(/\s+/g, "_")}.png`}
      />
    </div>
  );
}
