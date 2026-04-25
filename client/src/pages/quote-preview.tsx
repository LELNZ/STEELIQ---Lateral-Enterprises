import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { routes } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ArrowLeftCircle, Download, Settings2, Info, Wrench } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import type { PreviewData, QuoteDocumentModel, QuoteDocumentItem, TotalsDisplayConfig } from "@/lib/quote-document";
import { buildQuoteDocumentModel, DEFAULT_TOTALS_DISPLAY_CONFIG } from "@/lib/quote-document";
import type { QuoteRenderModel, RenderScheduleItem, RenderTotalsLine } from "@/lib/quote-renderer";
import { buildQuoteRenderModel, rebuildScheduleItems } from "@/lib/quote-renderer";
import { MediaViewer } from "@/components/media-viewer";
import { generateQuotePdf } from "@/lib/pdf-engine";
import { isSectionVisible } from "@/lib/quote-template";
import { RichTextRenderer } from "@/components/ui/rich-text-renderer";
import type { QuoteTemplate } from "@/lib/quote-template";
import DrawingCanvas from "@/components/drawing-canvas";
import type { InsertQuoteItem } from "@shared/schema";


export default function QuotePreview() {
  const [, paramsSingular] = useRoute("/quote/:id/preview");
  const [, paramsPlural] = useRoute("/quotes/:id/preview");
  const params = paramsSingular || paramsPlural;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const quoteId = params?.id;
  const [specSheetOpen, setSpecSheetOpen] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [drawingRepairState, setDrawingRepairState] = useState<"idle" | "checking" | "repairing" | "done">("idle");
  const [repairProgress, setRepairProgress] = useState({ total: 0, done: 0, succeeded: 0 });
  const isAdminOrOwner = user?.role === "admin" || user?.role === "owner";

  const { data: preview, isLoading } = useQuery<PreviewData>({
    queryKey: ["/api/quotes", quoteId, "preview-data"],
    enabled: !!quoteId,
    staleTime: 0,
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
  const [localTotalsConfig, setLocalTotalsConfig] = useState<TotalsDisplayConfig | null>(null);
  const [localRemarks, setLocalRemarks] = useState<string | null>(null);

  useEffect(() => { setLocalKeys(null); setLocalTotalsConfig(null); setLocalRemarks(null); }, [quoteId]);

  const effectiveKeys = localKeys ?? doc?.specDisplay.effectiveKeys ?? [];

  const handleRepairDrawings = useCallback(async () => {
    if (!doc || drawingRepairState === "repairing" || drawingRepairState === "checking") return;
    setDrawingRepairState("checking");
    try {
      const res = await fetch("/api/drawing-images/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: doc.metadata.quoteId }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const { summary } = await res.json();
      setRepairProgress({ total: summary.total, done: summary.total, succeeded: summary.regenerated });
      if (summary.regenerated > 0) {
        setDrawingRepairState("done");
        toast({
          title: "Drawing repair complete",
          description: `${summary.regenerated} regenerated, ${summary.existed} already present.${summary.failed > 0 ? ` ${summary.failed} failed.` : ""}`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "preview-data"] });
      } else if (summary.failed > 0) {
        setDrawingRepairState("done");
        toast({ title: "Drawing repair failed", description: `${summary.failed} drawings could not be regenerated.`, variant: "destructive" });
      } else {
        setDrawingRepairState("done");
        toast({ title: "All drawings present", description: "No repair needed." });
      }
    } catch (err: any) {
      console.error("[drawing-repair] Error:", err);
      toast({ title: "Drawing repair failed", description: err.message, variant: "destructive" });
      setDrawingRepairState("idle");
    }
  }, [doc, drawingRepairState, toast, quoteId]);

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

  const effectiveTotalsConfig: TotalsDisplayConfig = localTotalsConfig ?? doc?.totalsDisplayConfig ?? DEFAULT_TOTALS_DISPLAY_CONFIG;
  const effectiveRemarks: string = localRemarks !== null ? localRemarks : (doc?.content.commercialRemarks ?? "");

  const liveDoc: QuoteDocumentModel | null = useMemo(() => {
    if (!doc) return null;
    const hasLocalOverrides = localKeys !== null || localTotalsConfig !== null || localRemarks !== null;
    if (!hasLocalOverrides) return doc;
    return {
      ...doc,
      specDisplay: { ...doc.specDisplay, effectiveKeys: localKeys ?? doc.specDisplay.effectiveKeys },
      totalsDisplayConfig: localTotalsConfig ?? doc.totalsDisplayConfig,
      content: { ...doc.content, commercialRemarks: localRemarks !== null ? localRemarks : doc.content.commercialRemarks },
    };
  }, [doc, localKeys, localTotalsConfig, localRemarks]);

  const liveRenderModel: QuoteRenderModel | null = useMemo(() => {
    if (!liveDoc) return null;
    return buildQuoteRenderModel(liveDoc);
  }, [liveDoc]);

  const liveScheduleItems: RenderScheduleItem[] = liveRenderModel?.scheduleItems ?? renderModel?.scheduleItems ?? [];

  const toggleSpecKey = (key: string) => {
    setLocalKeys(prev => {
      const current = prev ?? effectiveKeys;
      if (current.includes(key)) return current.filter(k => k !== key);
      return [...current, key];
    });
  };

  const toggleTotalsField = (field: keyof TotalsDisplayConfig) => {
    setLocalTotalsConfig(prev => {
      const current = prev ?? effectiveTotalsConfig;
      return { ...current, [field]: !current[field] };
    });
  };

  const hasUnsavedChanges = localKeys !== null || localTotalsConfig !== null || localRemarks !== null;

  const saveSpecDisplayMutation = useMutation({
    mutationFn: async () => {
      if (!doc) return;
      const payload: Record<string, unknown> = {};
      if (localKeys !== null) payload.specDisplayKeys = localKeys;
      if (localTotalsConfig !== null) payload.totalsDisplayConfig = localTotalsConfig;
      if (localRemarks !== null) payload.commercialRemarks = localRemarks || null;
      if (Object.keys(payload).length === 0) return;
      await apiRequest("PATCH", `/api/quotes/${doc.metadata.quoteId}/revisions/${doc.metadata.revisionId}/spec-display`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "preview-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId] });
      toast({ title: "Display settings saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save display settings", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Loading preview...</p></div>;
  }

  if (!renderModel || !doc) {
    return <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Quote not found</p></div>;
  }

  const activeModel = liveRenderModel ?? renderModel;
  const { header, branding, orgContact, customerProject, totals, legal, disclaimerText, resolvedTemplate: T, domainType } = activeModel;
  const isLaserQuote = domainType === "laser";

  const ITEMS_FIRST_PAGE = 1;
  const densityItemsMap: Record<string, number> = { comfortable: 3, standard: 4, compact: 5 };
  const ITEMS_PER_PAGE = densityItemsMap[T.density.itemGapMm <= 2 ? "compact" : T.density.itemGapMm >= 4 ? "comfortable" : "standard"] ?? 3;
  const hasSchedule = isSectionVisible(T, "schedule") && liveScheduleItems.length > 0;
  const page1ScheduleItems = hasSchedule ? liveScheduleItems.slice(0, ITEMS_FIRST_PAGE) : [];
  const overflowItems = hasSchedule ? liveScheduleItems.slice(ITEMS_FIRST_PAGE) : [];
  const overflowPages: RenderScheduleItem[][] = [];
  for (let i = 0; i < overflowItems.length; i += ITEMS_PER_PAGE) {
    overflowPages.push(overflowItems.slice(i, i + ITEMS_PER_PAGE));
  }

  const hasLegalOrAcceptance = isSectionVisible(T, "legal") || isSectionVisible(T, "acceptance");

  const pageStyle: React.CSSProperties = {
    maxWidth: "794px",
    width: "100%",
    margin: "0 auto",
    background: "#fff",
    boxShadow: "0 1px 8px rgba(0,0,0,0.10), 0 0 1px rgba(0,0,0,0.08)",
    borderRadius: "2px",
  };

  const pageContentStyle: React.CSSProperties = {
    padding: "40px 40px 48px 40px",
    display: "flex",
    flexDirection: "column",
    gap: `${Math.round(T.spacing.sectionGapMm * 3.78)}px`,
    minHeight: "1050px",
  };

  const sectionGap = `${Math.round(T.spacing.sectionGapMm * 3.78)}px`;

  return (
    <div style={{ background: "#e8e8ec" }} className="print:!bg-white" data-testid="quote-preview-page">
      <div className="mx-auto print:max-w-none" style={{ maxWidth: "794px" }}>
        <div className="flex items-center justify-between flex-wrap gap-2 p-4 print:hidden" style={{ background: "#fff", borderBottom: "1px solid #e2e2e5" }}>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(routes.quoteDetail(quoteId!))} data-testid="button-back-to-quote">
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
              <SheetContent className="w-[420px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Quote Display Settings</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-6">

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Totals Lines Visibility</p>
                    <p className="text-xs text-muted-foreground mb-3">The final total is always shown. Toggle individual breakdown lines on or off for the customer-facing quote.</p>
                    <div className="space-y-2.5">
                      {([
                        { key: "showItemsSubtotal", label: "Items Subtotal" },
                        ...(!isLaserQuote ? [
                          { key: "showInstallation", label: "Installation" },
                          { key: "showDelivery", label: "Delivery" },
                          { key: "showRemoval", label: "Old Window/Door Removal" },
                          { key: "showRubbish", label: "Rubbish / Waste Removal" },
                        ] : [
                          { key: "showDelivery", label: "Delivery" },
                          // Phase 5E hardening — line-level pricing visibility (LL only).
                          { key: "showLineUnitPrice", label: "Item Unit Price" },
                          { key: "showLineTotal", label: "Item Line Total" },
                        ]),
                        { key: "showSubtotal", label: "Subtotal (excl. GST)" },
                        { key: "showGst", label: "GST (15%)" },
                      ] as { key: keyof TotalsDisplayConfig; label: string }[]).map(({ key, label }) => (
                        <div key={key} className="flex items-center justify-between gap-3">
                          <Label htmlFor={`totals-${key}`} className="text-sm cursor-pointer">{label}</Label>
                          <Switch
                            id={`totals-${key}`}
                            checked={effectiveTotalsConfig[key]}
                            onCheckedChange={() => toggleTotalsField(key)}
                            data-testid={`switch-totals-${key}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Details Box</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Shows a dedicated &quot;Details&quot; section below Quote Summary.</p>
                      </div>
                      <Switch
                        id="totals-showCommercialRemarks"
                        checked={effectiveTotalsConfig.showCommercialRemarks ?? true}
                        onCheckedChange={() => toggleTotalsField("showCommercialRemarks")}
                        data-testid="switch-totals-showCommercialRemarks"
                      />
                    </div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5 mt-3">Customer-facing details text</p>
                    <Textarea
                      value={effectiveRemarks}
                      onChange={e => setLocalRemarks(e.target.value)}
                      placeholder="e.g. Price includes supply and installation. Payment: 50% deposit on acceptance, balance on completion."
                      rows={5}
                      className="text-sm"
                      data-testid="textarea-commercial-remarks"
                    />
                  </div>

                  <Separator />

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Item Spec Columns</p>
                    <div className="space-y-4">
                      {Object.entries(doc.specDisplay.specDictionaryGrouped).map(([group, specs]) => (
                        <div key={group}>
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">{group}</p>
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
                    </div>
                  </div>

                  <Button
                    onClick={() => saveSpecDisplayMutation.mutate()}
                    disabled={saveSpecDisplayMutation.isPending || !hasUnsavedChanges}
                    className="w-full"
                    data-testid="button-save-spec-display"
                  >
                    {saveSpecDisplayMutation.isPending ? "Saving..." : "Save Display Settings"}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            {isAdminOrOwner && (
              <Button
                variant="outline"
                size="sm"
                disabled={drawingRepairState === "checking" || drawingRepairState === "repairing"}
                onClick={handleRepairDrawings}
                data-testid="button-repair-drawings"
              >
                <Wrench className="h-4 w-4 mr-1" />
                {drawingRepairState === "checking" ? "Checking..." :
                 drawingRepairState === "repairing" ? `Repairing ${repairProgress.done}/${repairProgress.total}...` :
                 drawingRepairState === "done" ? "Repair Complete" : "Repair Drawings"}
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              disabled={pdfExporting}
              onClick={async () => {
                setPdfExporting(true);
                try {
                  await generateQuotePdf(activeModel);
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
      </div>

      <div className="mx-auto print:max-w-none print:!p-0" style={{ maxWidth: "794px" }}>
        <SnapshotBanner revisionVersion={header.revisionVersion} sourceJobId={doc.project.sourceJobId} />
      </div>

      <div style={{ padding: "32px 16px 48px", display: "flex", flexDirection: "column", gap: "28px" }} className="print:!p-0 print:!gap-0">

        <div style={pageStyle} className="print:!shadow-none print:!rounded-none" data-testid="preview-page-1">
          <div style={pageContentStyle} className="print:!p-4 print:!min-h-0">
            {isSectionVisible(T, "header") && (
              <div className="space-y-3">
                <HeaderSection branding={branding} orgContact={orgContact} template={T} />
                <Separator style={{ borderColor: T.colors.border }} />
              </div>
            )}

            <h2 className="text-lg font-bold uppercase tracking-wide" style={{ color: T.colors.accent }} data-testid="text-quotation-title">
              {T.documentMode === "tender" ? "TENDER" : activeModel.documentLabel.toUpperCase()}
            </h2>

            {isSectionVisible(T, "disclaimer") && (
              <div data-testid="text-preliminary-disclaimer">
                <RichTextRenderer
                  text={disclaimerText}
                  color={T.colors.headingMuted}
                  className="space-y-0.5 text-sm italic"
                />
              </div>
            )}

            {isSectionVisible(T, "customerProject") && (
              <CustomerProjectSection header={header} customerProject={customerProject} template={T} />
            )}

            {isSectionVisible(T, "totals") && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.colors.headingMuted }}>Quote Summary</p>
                <TotalsSection totals={totals} template={T} />
              </div>
            )}

            {activeModel.commercialRemarks && (
              <div
                data-testid="commercial-remarks-block"
                style={{
                  border: `1px solid ${T.colors.border}`,
                  borderRadius: 6,
                  padding: "12px 16px",
                }}
              >
                <p
                  className="text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: T.colors.headingMuted }}
                >
                  Details
                </p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: T.colors.bodyText }}>
                  {activeModel.commercialRemarks}
                </p>
              </div>
            )}

            {isSectionVisible(T, "schedule") && liveScheduleItems.length === 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: T.colors.accent }}>Schedule of Items</h3>
                <p className="text-sm mt-2" style={{ color: T.colors.headingMuted }}>No items in this quote snapshot. This may be a legacy quote — try generating a new revision from the estimator.</p>
              </div>
            )}

            {page1ScheduleItems.length > 0 && (
              <div>
                <div style={{ display: "flex", flexDirection: "column", gap: sectionGap, marginBottom: `${Math.round(T.density.itemGapMm * 3.78)}px` }}>
                  <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: T.colors.accent }}>Schedule of Items</h3>
                  {!isLaserQuote && (
                    <p className="text-xs italic" style={{ color: T.colors.body }} data-testid="text-orientation-note">All joinery is viewed from outside.</p>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: `${Math.round(T.density.itemGapMm * 3.78)}px` }}>
                  {page1ScheduleItems.map((item) => (
                    <ScheduleItemCard
                      key={item.index}
                      item={item}
                      template={T}
                      docItem={doc?.items[item.index]}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {overflowPages.map((pageItems, pageIdx) => (
          <div key={`schedule-page-${pageIdx}`} style={pageStyle} className="print:!shadow-none print:!rounded-none" data-testid={`preview-schedule-page-${pageIdx}`}>
            <div style={pageContentStyle} className="print:!p-4 print:!min-h-0">
              <div style={{ display: "flex", flexDirection: "column", gap: `${Math.round(T.density.itemGapMm * 3.78)}px` }}>
                {pageItems.map((item) => (
                  <ScheduleItemCard
                    key={item.index}
                    item={item}
                    template={T}
                    docItem={doc?.items[item.index]}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}

        {hasLegalOrAcceptance && (
          <div style={pageStyle} className="print:!shadow-none print:!rounded-none" data-testid="preview-page-legal">
            <div style={pageContentStyle} className="print:!p-4 print:!min-h-0">
              {isSectionVisible(T, "legal") && (
                <div>
                  <LegalSection legal={legal} template={T} />
                </div>
              )}

              {isSectionVisible(T, "acceptance") && (
                <AcceptanceSection template={T} quoteNumber={header.quoteNumber} />
              )}
            </div>
          </div>
        )}

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
            onClick={() => navigate(routes.jobExecSummary(sourceJobId))}
            data-testid="link-go-to-exec-summary"
          >
            Go to Executive Summary to update
          </Button>
        )}
      </div>
    </div>
  );
}

function HeaderSection({ branding, orgContact, template }: { branding: QuoteRenderModel["branding"]; orgContact: QuoteRenderModel["orgContact"]; template: QuoteTemplate }) {
  const logoMaxHPx = Math.round(template.header.logoMaxHeightMm * 3.78);
  const logoMaxWPx = Math.round(template.header.logoWidthMm * 3.78);
  const bottomSpacingPx = Math.round(template.header.headerBottomSpacingMm * 3.78);
  const contactAlign = template.header.contactBlockAlignment;
  const legalPlacement = template.header.legalLinePlacement;

  const legalLine = legalPlacement !== "hidden" ? (
    <p className="text-[10px] italic leading-snug" style={{ color: template.colors.headingMuted }} data-testid="text-legal-line">
      {branding.legalLine}
    </p>
  ) : null;

  return (
    <div style={{ paddingBottom: `${bottomSpacingPx}px` }}>
      <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            {branding.logoUrl && (
              <img
                src={branding.logoUrl}
                alt={`${branding.tradingName} logo`}
                style={{ maxHeight: `${logoMaxHPx}px`, maxWidth: `${logoMaxWPx}px` }}
                className="object-contain"
                data-testid="img-branding-logo"
              />
            )}
            <div>
              {template.header.showTradingName && (
                <p
                  className="font-semibold leading-tight"
                  style={{
                    color: template.colors.bodyText,
                    fontSize: template.header.logoScale === "large" ? "1rem" : template.header.logoScale === "small" ? "0.75rem" : "0.875rem",
                  }}
                  data-testid="text-trading-name"
                >
                  {branding.tradingName}
                </p>
              )}
              {legalPlacement === "beside_logo" && legalLine}
            </div>
          </div>
          {legalPlacement === "under_logo" && (
            <div className="mt-1">
              {legalLine}
            </div>
          )}
        </div>
        <div
          className="sm:text-right space-y-0"
          style={{
            color: template.colors.headingMuted,
            lineHeight: contactAlign === "compact_right" ? "1.25" : contactAlign === "stacked_right" ? "1.6" : "1.4",
            fontSize: contactAlign === "compact_right" ? "10px" : contactAlign === "stacked_right" ? "12px" : "11px",
          }}
        >
          {orgContact.address && <p>{orgContact.address}</p>}
          {orgContact.phone && <p>{orgContact.phone}</p>}
          {orgContact.email && <p>{orgContact.email}</p>}
          {orgContact.gstNumber && <p>GST: {orgContact.gstNumber}</p>}
          {orgContact.nzbn && <p>NZBN: {orgContact.nzbn}</p>}
        </div>
      </div>
    </div>
  );
}

function CustomerProjectSection({ header, customerProject, template }: { header: QuoteRenderModel["header"]; customerProject: QuoteRenderModel["customerProject"]; template: QuoteTemplate }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: template.colors.headingMuted }}>Customer</p>
        <p className="text-base font-semibold" style={{ color: template.colors.bodyText }} data-testid="text-customer">{customerProject.customerName}</p>
        {customerProject.hasProjectAddress && (
          <div className="mt-2">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: template.colors.headingMuted }}>Project Address</p>
            <p className="text-sm" style={{ color: template.colors.bodyText }} data-testid="text-project-address">{customerProject.projectAddress}</p>
          </div>
        )}
      </div>
      <div className="sm:text-right space-y-1">
        <div><span className="text-xs" style={{ color: template.colors.headingMuted }}>Quote #: </span><span className="font-mono font-semibold" data-testid="text-quote-number-preview">{header.quoteNumber}</span></div>
        <div><span className="text-xs" style={{ color: template.colors.headingMuted }}>Date: </span><span data-testid="text-quote-date">{header.dateFormatted}</span></div>
        <div><span className="text-xs" style={{ color: template.colors.headingMuted }}>Valid Until: </span><span data-testid="text-quote-expiry">{header.expiryFormatted}</span></div>
      </div>
    </div>
  );
}

function TotalsSection({ totals, template }: { totals: QuoteRenderModel["totals"]; template: QuoteTemplate }) {
  if (totals.isEmpty) {
    return (
      <div className="rounded-lg border p-5" style={{ backgroundColor: template.colors.bgMuted, borderColor: template.colors.border }} data-testid="totals-block">
        <p className="text-sm" style={{ color: template.colors.headingMuted }}>No pricing data available.</p>
      </div>
    );
  }

  const isInline = template.itemLayout.totalsLayoutVariant === "totals_inline_v1";

  if (isInline) {
    return (
      <div className="space-y-1.5 py-2" data-testid="totals-block">
        {totals.lines.map((line, idx) => (
          <TotalsLineRow key={idx} line={line} template={template} />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-5 space-y-2" style={{ backgroundColor: template.colors.bgMuted, borderColor: template.colors.border }} data-testid="totals-block">
      <div className="space-y-1.5">
        {totals.lines.map((line, idx) => (
          <TotalsLineRow key={idx} line={line} template={template} />
        ))}
      </div>
    </div>
  );
}

function TotalsLineRow({ line, template }: { line: RenderTotalsLine; template: QuoteTemplate }) {
  if (line.emphasis === "separator") return <Separator style={{ borderColor: template.colors.border }} />;
  const testId = line.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
  const style: Record<string, string> = {};
  let classes = "flex justify-between py-0.5";
  if (line.emphasis === "bold") {
    classes += " text-lg font-bold";
    style.color = template.colors.bodyText;
  } else if (line.emphasis === "muted") {
    style.color = template.colors.headingMuted;
  } else {
    classes += " font-medium";
    style.color = template.colors.bodyText;
  }
  return (
    <div className={classes} style={style}>
      <span>{line.label}</span>
      <span data-testid={`text-${testId}`}>{line.formatted}</span>
    </div>
  );
}

function LegalSection({ legal, template }: { legal: QuoteRenderModel["legal"]; template: QuoteTemplate }) {
  return (
    <div className="space-y-5">
      {legal.additionalCapabilities && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: template.colors.headingMuted }}>Additional Capabilities</p>
          <RichTextRenderer
            text={legal.additionalCapabilities}
            color={template.colors.bodyText}
            boldHeadings
            className="space-y-1"
          />
        </div>
      )}
      {legal.sections.length > 0 && (
        <>
          <h3 className="text-base font-bold uppercase tracking-wider" style={{ color: template.colors.accent }}>Terms & Conditions</h3>
          {legal.sections.map((section) => (
            <div key={section.heading} className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: template.colors.headingMuted }}>{section.heading}</p>
              <RichTextRenderer
                text={section.body}
                color={template.colors.bodyText}
                className="space-y-0.5"
              />
            </div>
          ))}
        </>
      )}
      {legal.hasBankDetails && (
        <div className="space-y-1.5 pt-2">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: template.colors.headingMuted }}>Remittance / Bank Details</p>
          <RichTextRenderer
            text={legal.bankDetails}
            color={template.colors.bodyText}
            className="space-y-0.5"
          />
        </div>
      )}
    </div>
  );
}

function AcceptanceSection({ template, quoteNumber }: { template: QuoteTemplate; quoteNumber: string }) {
  return (
    <div className="space-y-4 pt-4" data-testid="acceptance-section">
      <Separator style={{ borderColor: template.colors.border }} />
      <p className="text-base font-bold uppercase tracking-wider" style={{ color: template.colors.accent }} data-testid="text-acceptance-heading">Acceptance</p>
      <p className="text-sm" style={{ color: template.colors.bodyText }}>
        I accept the works described in {quoteNumber || "this quotation"} and agree to the terms and conditions outlined above.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
        {template.acceptance.fields.map((field) => (
          <div key={field} className="pb-6" style={{ borderBottomWidth: 1, borderBottomStyle: "dashed", borderBottomColor: template.colors.border }} data-testid={`acceptance-field-${field.toLowerCase()}`}>
            <p className="text-xs" style={{ color: template.colors.headingMuted }}>{field}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MediaImage({
  src,
  alt,
  className,
  style,
  testId,
  fallbackTestId,
  fallbackText,
  onLoadStatusChange,
}: {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
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
      style={style}
      data-testid={testId}
      onError={() => {
        setFailed(true);
        onLoadStatusChange?.(false);
      }}
    />
  );
}

function SpecTable({ specs, itemIndex, template }: { specs: { key: string; label: string; value: string }[]; itemIndex: number; template: QuoteTemplate }) {
  if (specs.length === 0) {
    return <p className="text-sm italic" style={{ color: template.colors.headingMuted }}>No specification data available for this item.</p>;
  }

  const rowPadPx = Math.max(1, Math.round((template.density.specRowH - 2) * 1.5));

  const renderRow = ({ key, label, value }: { key: string; label: string; value: string }, idx: number) => (
    <tr key={key} style={{ backgroundColor: idx % 2 === 0 ? template.colors.bgMuted : "transparent" }}>
      <td className="px-2 text-xs leading-snug align-top" style={{ color: template.colors.headingMuted, minWidth: "80px", maxWidth: "120px", overflowWrap: "break-word", wordBreak: "break-word", paddingTop: `${rowPadPx}px`, paddingBottom: `${rowPadPx}px` }}>{label}</td>
      <td className="px-2 font-medium text-sm leading-snug align-top" style={{ color: template.colors.bodyText, overflowWrap: "break-word", wordBreak: "break-word", paddingTop: `${rowPadPx}px`, paddingBottom: `${rowPadPx}px` }} data-testid={`text-spec-${key}-${itemIndex}`}>{value}</td>
    </tr>
  );

  const useTwoCol = specs.length > 6;
  const midpoint = Math.ceil(specs.length / 2);

  if (useTwoCol) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4" data-testid={`spec-table-${itemIndex}`}>
        <table className="w-full text-sm"><tbody>{specs.slice(0, midpoint).map((s, i) => renderRow(s, i))}</tbody></table>
        <table className="w-full text-sm"><tbody>{specs.slice(midpoint).map((s, i) => renderRow(s, i))}</tbody></table>
      </div>
    );
  }

  return (
    <table className="w-full text-sm" data-testid={`spec-table-${itemIndex}`}>
      <tbody>{specs.map((s, i) => renderRow(s, i))}</tbody>
    </table>
  );
}

function docItemToDrawingConfig(di: QuoteDocumentItem): InsertQuoteItem {
  const sv = di.specValues || {};
  return {
    name: di.itemRef || di.title || "",
    width: di.width,
    height: di.height,
    quantity: di.quantity || 1,
    category: (di.category || sv.itemCategory || "windows-standard") as any,
    layout: (sv.layout || "standard") as any,
    windowType: (sv.windowType || "fixed") as any,
    hingeSide: (sv.hingeSide || "left") as any,
    openDirection: (sv.openDirection || "out") as any,
    openingDirection: (di.openingDirection || "none") as any,
    panels: Number(sv.panels) || 3,
    halfSolid: Boolean(sv.halfSolid),
    rakedLeftHeight: di.rakedLeftHeight || 0,
    rakedRightHeight: di.rakedRightHeight || 0,
    rakedSplitEnabled: Boolean(sv.rakedSplitEnabled),
    rakedSplitPosition: Number(sv.rakedSplitPosition) || 0,
    sidelightEnabled: sv.sidelightEnabled ?? true,
    sidelightSide: (sv.sidelightSide || "right") as any,
    sidelightWidth: Number(sv.sidelightWidth) || 400,
    bayAngle: Number(sv.bayAngle) || 135,
    bayDepth: Number(sv.bayDepth) || 0,
    bifoldLeftCount: Number(sv.bifoldLeftCount) || 0,
    centerWidth: Number(sv.centerWidth) || 0,
    doorSplit: Boolean(sv.doorSplit),
    doorSplitHeight: Number(sv.doorSplitHeight) || 0,
    customColumns: Array.isArray(sv.customColumns) ? sv.customColumns : [],
    entranceDoorRows: Array.isArray(sv.entranceDoorRows) ? sv.entranceDoorRows : [{ height: 0, type: "fixed" as const, slideDirection: "right" as const }],
    entranceSidelightRows: Array.isArray(sv.entranceSidelightRows) ? sv.entranceSidelightRows : [{ height: 0, type: "fixed" as const, slideDirection: "right" as const }],
    entranceSidelightLeftRows: Array.isArray(sv.entranceSidelightLeftRows) ? sv.entranceSidelightLeftRows : [{ height: 0, type: "fixed" as const, slideDirection: "right" as const }],
    hingeDoorRows: Array.isArray(sv.hingeDoorRows) ? sv.hingeDoorRows : [{ height: 0, type: "fixed" as const, slideDirection: "right" as const }],
    frenchDoorLeftRows: Array.isArray(sv.frenchDoorLeftRows) ? sv.frenchDoorLeftRows : [{ height: 0, type: "fixed" as const, slideDirection: "right" as const }],
    frenchDoorRightRows: Array.isArray(sv.frenchDoorRightRows) ? sv.frenchDoorRightRows : [{ height: 0, type: "fixed" as const, slideDirection: "right" as const }],
    panelRows: Array.isArray(sv.panelRows) ? sv.panelRows : [],
    showLegend: true,
    pricePerSqm: Number(sv.pricePerSqm) || 500,
    overrideMode: "none" as const,
    overrideValue: null,
    frameType: String(sv.frameSeries || ""),
    frameColor: String(sv.frameColor || ""),
    flashingSize: Number(sv.flashingSize) || 0,
    windZone: String(sv.windZone || ""),
    linerType: String(sv.linerType || ""),
    glassIguType: String(sv.iguType || ""),
    glassType: String(sv.glassType || ""),
    glassThickness: String(sv.glassThickness || ""),
    wanzBar: Boolean(sv.wanzBarEnabled),
    wanzBarSource: (sv.wanzBarSource || "") as any,
    wanzBarSize: String(sv.wanzBarSize || ""),
    wallThickness: Number(sv.wallThickness) || 0,
    heightFromFloor: sv.heightFromFloor != null ? Number(sv.heightFromFloor) : 0,
    handleType: String(sv.handleSet || ""),
    lockType: String(sv.lockSet || ""),
    configurationId: String(sv.configurationId || ""),
    cachedWeightKg: 0,
    fulfilmentSource: "in-house" as const,
    outsourcedCostNzd: null,
    outsourcedSellNzd: null,
    gosRequired: di.gosRequired || false,
    gosChargeNzd: di.gosChargeNzd ?? null,
    catDoorEnabled: di.catDoorEnabled || false,
  };
}


function ScheduleItemCard({
  item,
  template,
  docItem,
}: {
  item: RenderScheduleItem;
  template: QuoteTemplate;
  docItem?: QuoteDocumentItem;
}) {
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState("");
  const [failedPhotos, setFailedPhotos] = useState<Set<string>>(new Set());
  const [drawingFailed, setDrawingFailed] = useState(false);
  const drawingConfig = useMemo(() => (docItem && drawingFailed) ? docItemToDrawingConfig(docItem) : null, [docItem, drawingFailed]);

  const { visibleSpecs, media } = item;
  const loadedPhotos = media.customerPhotos.filter((p) => !failedPhotos.has(p.key));

  const padPx = Math.round(template.density.itemCardPadMm * 3.78);
  const photoSizePx = Math.round(template.itemLayout.photoMaxSizeMm * 3.78);
  const photoMaxHPx = Math.round(template.density.photoRowH * 3.78);
  const gapPx = Math.max(4, Math.round(template.density.itemGapMm * 2));

  // Phase 5F — visual grouping for attached procedures. Indent the card,
  // soften the header background slightly, and prefix the title with a
  // subtle "↳ Attached operation" affordance so the relationship to the
  // parent (e.g. 001 → 001a) is obvious in the customer-facing preview.
  const attachedIndentPx = item.isAttachedChild ? 24 : 0;
  return (
    <div
      className="rounded overflow-hidden print:break-inside-avoid"
      style={{
        border: `1px solid ${template.colors.border}`,
        marginLeft: `${attachedIndentPx}px`,
        opacity: item.isAttachedChild ? 0.97 : 1,
      }}
      data-testid={`schedule-item-${item.index}`}
      data-attached-child={item.isAttachedChild ? "true" : "false"}
      data-display-number={item.displayNumber}
    >
      <div
        className="flex items-baseline justify-between"
        style={{
          backgroundColor: template.colors.bgMuted,
          borderBottom: `1px solid ${template.colors.border}`,
          padding: `${Math.max(4, padPx - 4)}px ${padPx}px`,
          ...(item.isAttachedChild ? { borderLeft: `3px solid ${template.colors.border}` } : {}),
        }}
      >
        <h4 className="font-bold text-sm leading-tight" style={{ color: template.colors.bodyText }} data-testid={`text-item-title-${item.index}`}>
          {item.isAttachedChild && (
            <span className="font-normal mr-1" style={{ color: template.colors.headingMuted }} data-testid={`text-attached-affordance-${item.index}`}>
              ↳ Attached operation —
            </span>
          )}
          {item.title}
        </h4>
        <p className="text-xs whitespace-nowrap ml-3" style={{ color: template.colors.headingMuted }}>
          {item.quantityLabel} &middot; {item.dimensionLabel}
        </p>
      </div>

      <div style={{ padding: `${padPx}px`, display: "flex", flexDirection: "column", gap: `${gapPx}px` }}>
        {template.itemLayout.scheduleLayoutVariant === "specs_only_v1" ? (
          <div>
            <SpecTable specs={visibleSpecs} itemIndex={item.index} template={template} />
          </div>
        ) : template.itemLayout.scheduleLayoutVariant === "image_top_specs_below_v1" ? (
          <div className="space-y-3">
            {media.drawingUrl && (
              <div className="flex items-center justify-center">
                {drawingConfig ? (
                  <div style={{ maxHeight: `${Math.round(template.density.drawingMaxH * 3.78)}px`, width: "100%" }} data-testid={`recovered-drawing-${item.index}`}>
                    <DrawingCanvas config={drawingConfig} showPaneNumbers={item.paneGlassSpecs.length > 0} />
                  </div>
                ) : (
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
                      style={{ maxHeight: `${Math.round(template.density.drawingMaxH * 3.78)}px` }}
                      className="w-full object-contain rounded"
                      testId={`img-drawing-${item.index}`}
                      fallbackTestId={`fallback-drawing-${item.index}`}
                      fallbackText="Drawing unavailable"
                      onLoadStatusChange={(loaded) => { if (!loaded) setDrawingFailed(true); }}
                    />
                  </div>
                )}
              </div>
            )}
            <div>
              <SpecTable specs={visibleSpecs} itemIndex={item.index} template={template} />
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: media.drawingUrl ? "45% 1fr" : "1fr", gap: "16px" }}>
            {media.drawingUrl && (
              <div className="flex items-center justify-center">
                {drawingConfig ? (
                  <div style={{ maxHeight: `${Math.round(template.density.drawingMaxH * 3.78)}px` }} data-testid={`recovered-drawing-${item.index}`}>
                    <DrawingCanvas config={drawingConfig} showPaneNumbers={item.paneGlassSpecs.length > 0} />
                  </div>
                ) : (
                  <div
                    className={drawingFailed ? "" : "cursor-pointer print:cursor-default"}
                    onClick={() => {
                      if (!drawingFailed) {
                        setViewerSrc(media.drawingUrl!);
                        setViewerTitle(media.drawingLabel);
                      }
                    }}
                  >
                    <MediaImage
                      src={media.drawingUrl}
                      alt={`Drawing for item ${item.index + 1}`}
                      style={{ maxHeight: `${Math.round(template.density.drawingMaxH * 3.78)}px` }}
                      className="object-contain rounded"
                      testId={`img-drawing-${item.index}`}
                      fallbackTestId={`fallback-drawing-${item.index}`}
                      fallbackText="Drawing unavailable"
                      onLoadStatusChange={(loaded) => { if (!loaded) setDrawingFailed(true); }}
                    />
                  </div>
                )}
              </div>
            )}
            <div>
              <SpecTable specs={visibleSpecs} itemIndex={item.index} template={template} />
            </div>
          </div>
        )}

        {(item.gosNote || item.catDoorNote) && (
          <div className="space-y-0.5" data-testid={`item-notes-${item.index}`}>
            {item.gosNote && (
              <p className="text-xs italic font-medium" style={{ color: template.colors.accent }} data-testid={`text-gos-note-${item.index}`}>
                [GOS] {item.gosNote}
              </p>
            )}
            {item.catDoorNote && (
              <p className="text-xs italic" style={{ color: template.colors.accent }} data-testid={`text-catdoor-note-${item.index}`}>
                • {item.catDoorNote}
              </p>
            )}
          </div>
        )}

        {item.paneGlassSpecs.length > 0 && (
          <div data-testid={`pane-glass-specs-${item.index}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: template.colors.headingMuted }}>Pane-Level Glazing</p>
            <div className="flex flex-col gap-0.5">
              {[...item.paneGlassSpecs].sort((a, b) => a.paneIndex - b.paneIndex).map((ps) => (
                <p key={ps.paneIndex} className="text-[10px]" style={{ color: template.colors.bodyText }} data-testid={`pane-spec-${item.index}-${ps.paneIndex}`}>
                  <span className="font-medium" style={{ color: template.colors.accent }}>Pane {ps.paneIndex + 1}:</span>{" "}
                  {[ps.iguType, ps.glassType, ps.glassThickness].filter(Boolean).join(" · ") || "—"}
                </p>
              ))}
            </div>
          </div>
        )}

        {loadedPhotos.length > 0 && (
          <div data-testid={`photos-section-${item.index}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: template.colors.headingMuted }}>Site Photos</p>
            <div className="flex flex-wrap" style={{ gap: `${Math.max(4, Math.round(template.density.itemCardPadMm * 1.5))}px`, maxHeight: `${photoMaxHPx + 16}px`, overflow: "hidden" }}>
              {loadedPhotos.map((photo, pIdx) => (
                  <div key={photo.key} className="space-y-1">
                    <div
                      className="cursor-pointer print:cursor-default"
                      onClick={() => {
                        setViewerSrc(photo.url);
                        setViewerTitle(photo.caption);
                      }}
                    >
                      <MediaImage
                        src={photo.url}
                        alt={photo.caption}
                        style={{ maxHeight: `${photoSizePx}px`, maxWidth: `${photoSizePx}px` }}
                        className="object-contain rounded"
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
                    {photo.caption && (
                      <p className="text-xs text-center" style={{ color: template.colors.headingMuted, maxWidth: `${photoSizePx}px` }}>{photo.caption}</p>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

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
