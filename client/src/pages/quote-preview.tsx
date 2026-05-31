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
import { buildQuoteRenderModel, rebuildScheduleItems, extractLaserTableRow } from "@/lib/quote-renderer";
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

  const hasSchedule = isSectionVisible(T, "schedule") && liveScheduleItems.length > 0;

  // Phase 5F Pagination Parity — replace the old hardcoded
  // `ITEMS_FIRST_PAGE = 1` (which always pushed Item 002 onto preview page 2,
  // even when the PDF correctly fit it on page 1) with a measurement-based
  // packer that mirrors the PDF's per-item height estimate (see
  // `pdf-engine.ts` lines 913-934 / 957-963 / 1115-1145). Heights are
  // computed in mm using the same density values the PDF uses, so preview
  // page placement tracks PDF page placement as closely as the engines'
  // shared estimates allow.
  //
  // The PDF page is A4 (297mm tall, 18mm top + 18mm bottom margin →
  // 261mm of usable content height). Page 1 in the PDF also carries the
  // header / disclaimer / customer-project / totals / details chrome
  // *above* the Schedule section, so the budget for schedule items on
  // page 1 is reduced accordingly. Subsequent pages get the full 261mm
  // budget (PDF starts those at TOP_MARGIN). The first item on any page
  // is always placed even if it overruns the budget — that matches the
  // PDF's `ensureSpace(... Math.min(estimatedH, MAX_Y - TOP_MARGIN - 5))`
  // behaviour, which only adds a fresh page when there isn't room and
  // never refuses to place a single oversized item.
  const PAGE_CONTENT_MM = 297 - 18 - 18;

  const estimateScheduleItemMm = (item: RenderScheduleItem): number => {
    // Phase 5G — for laser quotes, EVERY schedule row (including
    // standalone manual procedures with pricingDisplay == null) is
    // rendered through the LaserScheduleTable so the estimator must
    // also use the table-row formula. Mismatch here against the actual
    // render path was causing false overflow pages on quotes whose
    // first item was a standalone manual procedure.
    if (activeModel.domainType === "laser") {
      // Phase 5H.0 — image stays at 78px (~22mm). The Item /
      // Description cell now stacks up to 3 text lines (ref + title +
      // optional Ops) and Material / Spec stacks 2 text lines, so we
      // bump the row height budget to 24mm for safer pagination.
      // Must stay aligned with PDF row math in renderLaserScheduleTable.
      const ROW_H = 24; // image-capped row height (Phase 5H.0)
      const pd = item.pricingDisplay;
      // Phase 5H.1 — detail row height MUST match pdf-engine.ts
      // `DETAIL_H = 4.5` exactly so per-item pagination matches the
      // PDF page-pack 1:1.
      const detailH = pd?.showOperationPricing
        && item.attachedOperations.length > 0
        && (pd.showUnitPriceColumn || pd.showLineTotalColumn)
        ? 4.5
        : 0;
      // Customer photos are intentionally NOT rendered inside the
      // laser schedule table (the table is the sell-side schedule;
      // customer photos belong to the gallery section). Therefore the
      // estimator must NOT add photoH for laser rows or it will create
      // false overflow pages on photo-bearing items.
      return ROW_H + detailH + 1;
    }
    // Joinery / standalone-manual fallback — original card formula.
    const headerH = T.density.itemHeaderH;
    const specH = item.visibleSpecs.length * T.density.specRowH;
    const drawH = item.media.drawingUrl ? T.density.drawingMaxH + 2 : 0;
    const BLANK_PREVIEW_MM = 22;
    const blankH = item.manualBlankPreview ? BLANK_PREVIEW_MM : 0;
    const photoH = item.media.customerPhotos.length > 0 ? T.density.photoRowH + 5 : 0;
    const paneH = item.paneGlassSpecs.length > 0 ? 6 + item.paneGlassSpecs.length * 3.5 : 0;
    return headerH + Math.max(drawH, blankH, specH) + paneH + photoH + 4 + T.density.itemGapMm;
  };

  // Conservative page-1 chrome estimate (mm). Tracks the visible sections
  // the PDF places above the Schedule heading, plus inter-section gaps.
  const headerVisible = isSectionVisible(T, "header");
  const disclaimerVisible = isSectionVisible(T, "disclaimer");
  const customerProjectVisible = isSectionVisible(T, "customerProject");
  const totalsVisible = isSectionVisible(T, "totals");
  const remarksVisible = !!activeModel.commercialRemarks;

  // Wrap-aware estimator for free-text blocks (remarks / disclaimer):
  // ~80 chars per line at the rendered font size, ~4mm per line, 8mm
  // chrome (label + padding + border). Caps at 80mm to avoid runaway
  // values from pathological inputs.
  const estimateRichTextMm = (text: string | null | undefined, basePadMm: number): number => {
    const t = (text ?? "").trim();
    if (!t) return 0;
    const lines = t.split(/\r?\n/).reduce((acc, line) => acc + Math.max(1, Math.ceil(line.length / 80)), 0);
    return Math.min(80, basePadMm + lines * 4);
  };

  const HEADER_MM = headerVisible ? 30 : 0;
  const TITLE_MM = 8;
  const DISCLAIMER_MM = disclaimerVisible ? estimateRichTextMm(disclaimerText, 4) : 0;
  const CUSTOMER_PROJECT_MM = customerProjectVisible ? 22 : 0;
  const TOTALS_MM = totalsVisible ? 24 + Math.max(0, totals.lines.length) * 4.5 : 0;
  const REMARKS_MM = remarksVisible ? estimateRichTextMm(activeModel.commercialRemarks, 8) : 0;
  const SCHEDULE_HEADING_MM = 12;
  const SECTION_GAPS_MM = T.spacing.sectionGapMm * 6;

  const page1ChromeMm =
    HEADER_MM + TITLE_MM + DISCLAIMER_MM + CUSTOMER_PROJECT_MM + TOTALS_MM +
    REMARKS_MM + SCHEDULE_HEADING_MM + SECTION_GAPS_MM;

  const page1BudgetMm = Math.max(40, PAGE_CONTENT_MM - page1ChromeMm);
  // Overflow pages do NOT re-render the schedule heading in the PDF, so
  // they get the full A4 content height as their budget.
  const overflowBudgetMm = PAGE_CONTENT_MM;

  const packedPages: RenderScheduleItem[][] = [];
  if (hasSchedule) {
    let currentPage: RenderScheduleItem[] = [];
    let currentBudget = page1BudgetMm;
    for (const item of liveScheduleItems) {
      const itemMm = estimateScheduleItemMm(item);
      if (currentPage.length === 0) {
        currentPage.push(item);
        currentBudget -= itemMm;
      } else if (itemMm <= currentBudget) {
        currentPage.push(item);
        currentBudget -= itemMm;
      } else {
        packedPages.push(currentPage);
        currentPage = [item];
        currentBudget = overflowBudgetMm - itemMm;
      }
    }
    if (currentPage.length > 0) packedPages.push(currentPage);
  }

  const page1ScheduleItems = packedPages[0] ?? [];
  const overflowPages: RenderScheduleItem[][] = packedPages.slice(1);

  // Phase 5G — derive laser table column visibility from the FULL
  // schedule (not the per-page subset) so that a continuation page
  // that happens to contain only standalone manual procedures still
  // renders the same column set as page 1. Mirrors the PDF logic in
  // renderLaserScheduleTable() which reads from model.scheduleItems.
  const laserSampleWithPricing = isLaserQuote
    ? liveScheduleItems.find(it => !!it.pricingDisplay)
    : undefined;
  const laserShowUnit = laserSampleWithPricing?.pricingDisplay?.showUnitPriceColumn ?? false;
  const laserShowLT = laserSampleWithPricing?.pricingDisplay?.showLineTotalColumn ?? false;

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
                          // Phase 5F card-tightening — independent toggle for
                          // attached operation pricing (LL only). Default OFF so
                          // operations show description + qty without exposing
                          // their unit / line price; the underlying operation
                          // value is implicitly absorbed into the parent item /
                          // quote subtotal — no math change.
                          { key: "showOperationPricing", label: "Operation Unit/Line Pricing" },
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
                    <p className="text-xs italic" style={{ color: T.colors.bodyText }} data-testid="text-orientation-note">All joinery is viewed from outside.</p>
                  )}
                </div>
                {isLaserQuote ? (
                  <LaserScheduleTable
                    items={page1ScheduleItems}
                    template={T}
                    docItems={doc?.items}
                    showUnit={laserShowUnit}
                    showLT={laserShowLT}
                  />
                ) : (
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
                )}
              </div>
            )}
          </div>
        </div>

        {overflowPages.map((pageItems, pageIdx) => (
          <div key={`schedule-page-${pageIdx}`} style={pageStyle} className="print:!shadow-none print:!rounded-none" data-testid={`preview-schedule-page-${pageIdx}`}>
            <div style={pageContentStyle} className="print:!p-4 print:!min-h-0">
              {isLaserQuote ? (
                <LaserScheduleTable
                  items={pageItems}
                  template={T}
                  docItems={doc?.items}
                  showUnit={laserShowUnit}
                  showLT={laserShowLT}
                  isContinuation
                />
              ) : (
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
              )}
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

// Phase 5F manual blank preview — simple proportional rectangle outline
// rendered in the existing left visual area when an LL item has valid
// dimensions but no uploaded drawing. Aspect ratio is preserved so a
// 1000x500 looks rectangular and a 1000x1000 looks square. Indicative
// only — never represents holes, folds, cutouts, or any manufacturing
// geometry. Customer-safe: uses dimensions already on the snapshot, no
// internal data exposure.
// Phase 5F card-tightening — strict, bounded compact size for the manual
// blank placeholder. Maximum 130px wide × 80px tall regardless of density
// tier so the placeholder never dominates the card. Aspect ratio is
// preserved within those bounds: 1000×500 reads as a rectangle, 1000×1000
// as a square. Indicative geometry only — never holes / folds / cutouts.
const MANUAL_BLANK_PREVIEW_MAX_W_PX = 130;
const MANUAL_BLANK_PREVIEW_MAX_H_PX = 80;

function ManualBlankPreviewSvg({
  lengthMm,
  widthMm,
  template,
  itemIndex,
  showCaption = true,
  showDimensionText = true,
  maxWidthPx = MANUAL_BLANK_PREVIEW_MAX_W_PX,
  maxHeightPx = MANUAL_BLANK_PREVIEW_MAX_H_PX,
}: {
  lengthMm: number;
  widthMm: number;
  template: QuoteTemplate;
  itemIndex: number;
  // Phase 5H.1a — the LL hybrid schedule table call site passes
  // false so the "Indicative blank only" caption is suppressed in the
  // customer-facing schedule (visual clutter / Preview-vs-PDF parity).
  // Default true preserves the existing LJ joinery card behaviour.
  showCaption?: boolean;
  // Phase 5H.9C — the LL hybrid schedule table call site passes false so
  // the inner "L x Wmm" dimension text is suppressed inside the image
  // cell. This matches the PDF (renderLaserScheduleTable draws a clean
  // rounded-rectangle outline with NO text inside) and removes the
  // "size text inside the image box" defect. Size remains in the Size
  // column. Default true preserves the existing LJ joinery card behaviour.
  showDimensionText?: boolean;
  // Phase 5H.9F — optional max-size overrides for the rendered blank. The LL
  // hybrid schedule image column is only ~22mm/~88px wide, but the defaults
  // (130x80px) let the rect grow far wider than the cell, so the surrounding
  // overflow:hidden clipped the centred rounded rectangle into a thin sliver
  // ("only a line"). The LL call site now passes cell-fitting values so the
  // placeholder renders as a clean, fully-visible rounded rectangle that
  // mirrors the PDF schedule placeholder. Defaults preserve LJ joinery sizing.
  maxWidthPx?: number;
  maxHeightPx?: number;
}) {
  const scale = Math.min(
    maxWidthPx / lengthMm,
    maxHeightPx / widthMm,
  );
  const rectW = Math.max(16, Math.round(lengthMm * scale));
  const rectH = Math.max(12, Math.round(widthMm * scale));
  const padPx = 4;
  const captionPx = 11;
  const totalW = rectW + padPx * 2;
  const totalH = rectH + padPx * 2 + (showCaption ? captionPx + 2 : 0);
  return (
    <div
      className="flex flex-col items-center justify-center"
      data-testid={`manual-blank-preview-${itemIndex}`}
    >
      <svg
        width={totalW}
        height={totalH}
        viewBox={`0 0 ${totalW} ${totalH}`}
        role="img"
        aria-label={`Indicative blank ${lengthMm} by ${widthMm} millimetres`}
      >
        <rect
          x={padPx}
          y={padPx}
          width={rectW}
          height={rectH}
          fill="#ffffff"
          stroke={template.colors.border}
          strokeWidth={1}
          rx={2}
          ry={2}
        />
        {showDimensionText && (
          <text
            x={totalW / 2}
            y={padPx + rectH / 2 + 3}
            textAnchor="middle"
            fontSize={9}
            fontFamily="sans-serif"
            fill={template.colors.bodyText}
            data-testid={`text-blank-dimensions-${itemIndex}`}
          >
            {`${lengthMm} x ${widthMm}mm`}
          </text>
        )}
        {showCaption && (
          <text
            x={totalW / 2}
            y={padPx + rectH + captionPx}
            textAnchor="middle"
            fontSize={7}
            fontFamily="sans-serif"
            fontStyle="italic"
            fill={template.colors.headingMuted}
          >
            Indicative blank only
          </text>
        )}
      </svg>
    </div>
  );
}

function SpecTable({ specs, itemIndex, template }: { specs: { key: string; label: string; value: string }[]; itemIndex: number; template: QuoteTemplate }) {
  if (specs.length === 0) {
    return <p className="text-sm italic" style={{ color: template.colors.headingMuted }}>No specification data available for this item.</p>;
  }

  const rowPadPx = Math.max(1, Math.round((template.density.specRowH - 2) * 1.5));

  // Phase 5F.1 — compact spec table. Label cell sized to its content
  // (whiteSpace: nowrap) so labels stay tight against values, and the
  // dimensions value uses non-breaking spacing so "1000mm x 1000mm"
  // doesn't break across lines awkwardly. Long free-text values still
  // wrap naturally on word boundaries (overflowWrap: break-word) but
  // we no longer break inside tokens like "1000mm".
  const renderRow = ({ key, label, value }: { key: string; label: string; value: string }, idx: number) => {
    const isDimension = key === "dimensions" || key === "length" || key === "width";
    const displayValue = isDimension ? value.replace(/\s*x\s*/g, "\u00A0x\u00A0") : value;
    return (
      <tr key={key} style={{ backgroundColor: idx % 2 === 0 ? template.colors.bgMuted : "transparent" }}>
        <td
          className="text-xs leading-snug align-top"
          style={{
            color: template.colors.headingMuted,
            whiteSpace: "nowrap",
            paddingLeft: "8px",
            paddingRight: "8px",
            paddingTop: `${rowPadPx}px`,
            paddingBottom: `${rowPadPx}px`,
            width: "1%",
          }}
        >{label}</td>
        <td
          className="font-medium text-sm leading-snug align-top"
          style={{
            color: template.colors.bodyText,
            overflowWrap: "break-word",
            paddingLeft: "0",
            paddingRight: "8px",
            paddingTop: `${rowPadPx}px`,
            paddingBottom: `${rowPadPx}px`,
          }}
          data-testid={`text-spec-${key}-${itemIndex}`}
        >{displayValue}</td>
      </tr>
    );
  };

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
    sidelightEnabled: Boolean(sv.sidelightEnabled ?? true),
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
    paneGlassSpecs: [],
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


// Phase 5F.2 — compact, supplier-style customer pricing block for an
// LL parent item. Replaces the prior bulky grouped table with a small
// right-aligned "Unit Price / Line Total" pair (always the COMBINED
// values: parent + Σ attached ops), plus an optional small nested
// breakdown ("- Laser cut blank: $X", "- Folding: $X") shown only
// when the showOperationPricing toggle is ON.
//
// The operations themselves are summarised separately as part of the
// spec block (see the synthesized "Operations" row added in
// quote-renderer.ts → finaliseParentDisplay), so attached operations
// always read as part of the item's description even when their $
// breakdown is hidden.
//
// Visibility rules:
//  - Block renders when an LL parent has pricingDisplay AND at least
//    one of the price toggles (showLineUnitPrice / showLineTotal) is
//    ON. With both toggles OFF the block disappears entirely (no
//    customer-facing prices).
//  - "Unit Price: $X ea" line shows only when showLineUnitPrice is ON
//    and combinedUnitPrice > 0.
//  - "Line Total: $X" line shows only when showLineTotal is ON and
//    combinedLineTotal > 0.
//  - Operation breakdown sub-list shows only when ops.length > 0,
//    showOperationPricing is ON, and either price toggle is ON.
//
// Customer-safe: only governed display values; never cost / margin /
// supplier / bucket / internal-notes data.
//
// FUTURE: when quantity-break presentation is enabled, replace the
// single Unit/Line pair with a small Qty | Unit | Line table sourced
// from `pricingDisplay.quantityBreaks`. See replit.md "Quantity-Break
// Future Design" for the planned customer layout. NOT implemented in
// Phase 5F.2.
function fmtMoney(n: number): string {
  return `$${n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Phase 5F.4 — visible Pricing/Detail/Operations data has moved into
// the spec table (rendered as `text-spec-pricing-N` /
// `text-spec-detail-N` / `text-spec-operations-N`). This component
// now only emits *hidden* alias testids so existing regression suites
// that bind to `text-line-unit-price-N`, `text-line-total-N`,
// `text-item-total-N`, `price-detail-N`, and the legacy
// `text-op-breakdown-{label,amount}-N-{idx|parent}` IDs continue to
// resolve without any visible duplication. No extra space is consumed
// in the layout — `display:none` keeps the bounding box at zero.
function CompactItemPricing({
  item,
}: {
  item: RenderScheduleItem;
  template: QuoteTemplate;
}) {
  const pd = item.pricingDisplay;
  const ops = item.attachedOperations;
  if (!pd) return null;

  const showUnit = pd.showUnitPriceColumn;
  const showLT = pd.showLineTotalColumn;
  const showOps = pd.showOperationPricing;
  if (!showUnit && !showLT) return null;

  const combinedUnit = pd.combinedUnitPrice;
  const combinedLT = pd.combinedLineTotal;
  const showUnitLine = showUnit && combinedUnit > 0;
  const showLineTotalLine = showLT && combinedLT > 0;
  const renderDetail = showOps && ops.length > 0 && (showUnit || showLT);
  if (!showUnitLine && !showLineTotalLine && !renderDetail) return null;

  return (
    <div data-testid={`pricing-block-${item.index}`} style={{ display: "none" }}>
      {showUnitLine && (
        <span data-testid={`text-line-unit-price-${item.index}`}>
          {pd.combinedUnitPriceLabel ?? `${fmtMoney(combinedUnit)} ea`}
        </span>
      )}
      {showLineTotalLine && (
        <span data-testid={`text-line-total-${item.index}`}>
          {pd.combinedLineTotalLabel ?? fmtMoney(combinedLT)}
        </span>
      )}
      {showLineTotalLine && (
        <span data-testid={`text-item-total-${item.index}`}>
          {pd.combinedLineTotalLabel ?? fmtMoney(combinedLT)}
        </span>
      )}
      {renderDetail && (
        <span data-testid={`price-detail-${item.index}`}>
          <span data-testid={`text-op-breakdown-label-${item.index}-parent`}>Blank </span>
          <span data-testid={`text-op-breakdown-amount-${item.index}-parent`}>{fmtMoney(pd.lineTotal)}</span>
          {ops.map((op, opIdx) => (
            <span key={opIdx}>
              <span data-testid={`text-op-breakdown-label-${item.index}-${opIdx}`}>{op.procedureType} </span>
              <span data-testid={`text-op-breakdown-amount-${item.index}-${opIdx}`}>{fmtMoney(op.lineTotal)}</span>
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

// Phase 5H.0 — enterprise hybrid schedule TABLE for the LL
// customer-facing surface. Replaces the previous Phase 5G 8-column
// table with a tighter 7-column hybrid layout. Same columns /
// behaviour are mirrored in the PDF by renderLaserScheduleTable() in
// pdf-engine.ts.
//
// Columns: Image · Item / Description · Material / Spec · Size · Qty
//   · Unit (toggle) · Total (toggle).
//
// Operations are now nested INSIDE Item / Description as a third
// stacked text line ("Ops: Folding, Deburring") instead of a
// standalone column. Material / Spec is split into two stacked lines
// (primary "Aluminium 5052" + secondary "3mm · Fibre PE"). Size
// replaces the old Dimensions column as a single compact value.
//
// Pricing-related columns and the optional `Pricing detail:` sub-row
// are strictly toggle-gated: showUnitPriceColumn / showLineTotalColumn
// / showOperationPricing — all derived from the per-revision Quote
// Display Settings via the render model. No cost / margin / supplier
// / internal-notes data ever surfaces.
//
// TODO Phase 5H — Qty Breaks tier pricing sub-row slot is reserved
// inside this component (see qtyBreaksSlot helper below). When data
// becomes available, the helper will return the rendered <tr/>
// without any other layout change.
function LaserScheduleTable({
  items,
  template,
  docItems,
  showUnit,
  showLT,
  isContinuation,
}: {
  items: RenderScheduleItem[];
  template: QuoteTemplate;
  docItems: QuoteDocumentItem[] | undefined;
  showUnit: boolean;
  showLT: boolean;
  isContinuation?: boolean;
}) {
  if (items.length === 0) return null;

  // showUnit / showLT are derived once at the parent level from the
  // FULL liveScheduleItems array (not the per-page subset) so that a
  // continuation page containing only standalone manual procedures
  // still renders the same column set as page 1. This mirrors the PDF
  // logic in renderLaserScheduleTable() in pdf-engine.ts.
  void docItems; // reserved for future per-row drawing config lookups

  const headerCellStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "6px 8px",
    fontSize: "11px",
    fontWeight: 600,
    color: template.colors.bodyText,
    backgroundColor: template.colors.bgMuted,
    borderBottom: `1px solid ${template.colors.border}`,
    whiteSpace: "nowrap",
  };
  const cellStyle: React.CSSProperties = {
    padding: "6px 8px",
    fontSize: "11.5px",
    color: template.colors.bodyText,
    borderBottom: `1px solid ${template.colors.border}`,
    verticalAlign: "top",
  };
  const numericCellStyle: React.CSSProperties = {
    ...cellStyle,
    textAlign: "right",
    whiteSpace: "nowrap",
  };

  // Column widths in mm — total = 180mm (matches PDF CONTENT_WIDTH so
  // both surfaces look identical to the customer). Image / Size / Qty
  // are fixed; Unit / Total are gated by toggles. The remaining
  // budget is split 60% Item / Description, 40% Material / Spec — so
  // when toggles are off the reclaimed width flows to BOTH text
  // columns (per spec). We then convert each mm width to a percentage
  // that always sums to 100% (the React table layout would otherwise
  // leave browser-dependent slack and drift from the PDF).
  const PDF_CONTENT_MM = 180;
  const W_IMAGE_MM = 22;
  const W_SIZE_MM = 24;
  const W_QTY_MM = 8;
  const W_UNIT_MM = showUnit ? 14 : 0;
  const W_TOTAL_MM = showLT ? 18 : 0;
  const remainingForTextMm =
    PDF_CONTENT_MM - W_IMAGE_MM - W_SIZE_MM - W_QTY_MM - W_UNIT_MM - W_TOTAL_MM;
  const W_ITEM_MM = Math.floor(remainingForTextMm * 0.60);
  const W_MATERIAL_MM = remainingForTextMm - W_ITEM_MM;
  const pct = (mm: number) => `${((mm / PDF_CONTENT_MM) * 100).toFixed(3)}%`;
  const widths = {
    image: pct(W_IMAGE_MM),
    item: pct(W_ITEM_MM),
    material: pct(W_MATERIAL_MM),
    size: pct(W_SIZE_MM),
    qty: pct(W_QTY_MM),
    unit: pct(W_UNIT_MM),
    total: pct(W_TOTAL_MM),
  };

  const totalCols = 5 + (showUnit ? 1 : 0) + (showLT ? 1 : 0);

  // TODO Phase 5H — Qty Breaks tier pricing sub-row.
  // Returns null until the underlying data exists. Will render below
  // the Pricing detail row spanning all columns. No DB fields, no
  // calculation, no mock output in this phase.
  const qtyBreaksSlot = (
    _item: RenderScheduleItem,
    _row: ReturnType<typeof extractLaserTableRow>,
  ): React.ReactElement | null => null;

  return (
    <div data-testid={`laser-schedule-table${isContinuation ? "-continuation" : ""}`}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
        }}
      >
        <colgroup>
          <col style={{ width: widths.image }} />
          <col style={{ width: widths.item }} />
          <col style={{ width: widths.material }} />
          <col style={{ width: widths.size }} />
          <col style={{ width: widths.qty }} />
          {showUnit && <col style={{ width: widths.unit }} />}
          {showLT && <col style={{ width: widths.total }} />}
        </colgroup>
        <thead>
          <tr>
            <th style={headerCellStyle}>Image</th>
            <th style={headerCellStyle}>Item / Description</th>
            <th style={headerCellStyle}>Material / Spec</th>
            <th style={headerCellStyle}>Size</th>
            <th style={{ ...headerCellStyle, textAlign: "right" }}>Qty</th>
            {showUnit && <th style={{ ...headerCellStyle, textAlign: "right" }}>Unit</th>}
            {showLT && <th style={{ ...headerCellStyle, textAlign: "right" }}>Total</th>}
          </tr>
        </thead>
        <tbody>
          {items.flatMap((item) => {
            const row = extractLaserTableRow(item);
            const blank = item.manualBlankPreview;
            const drawingUrl = item.media.drawingUrl;
            const showDetail = !!row.detailPreview;
            const qtyBreakRow = qtyBreaksSlot(item, row);
            const trs: React.ReactElement[] = [
                <tr key={`row-${item.index}`} data-testid={`schedule-row-${item.index}`}>
                  <td style={cellStyle}>
                    <div
                      style={{
                        width: "100%",
                        height: "78px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      {drawingUrl ? (
                        <MediaImage
                          src={drawingUrl}
                          alt={`Drawing for ${item.itemRef}`}
                          style={{
                            maxWidth: "100%",
                            maxHeight: "78px",
                            objectFit: "contain",
                          }}
                          testId={`img-drawing-${item.index}`}
                          fallbackTestId={`img-drawing-fallback-${item.index}`}
                          fallbackText="—"
                        />
                      ) : blank ? (
                        <ManualBlankPreviewSvg
                          lengthMm={blank.lengthMm}
                          widthMm={blank.widthMm}
                          template={template}
                          itemIndex={item.index}
                          showCaption={false}
                          showDimensionText={false}
                          maxWidthPx={64}
                          maxHeightPx={68}
                        />
                      ) : (
                        <span style={{ fontSize: "10px", color: template.colors.headingMuted }}>—</span>
                      )}
                    </div>
                  </td>
                  <td style={cellStyle}>
                    <div
                      style={{ fontSize: "10.5px", color: template.colors.headingMuted }}
                      data-testid={`text-item-ref-${item.index}`}
                    >
                      {row.itemRefLine}
                    </div>
                    <div
                      style={{ fontWeight: 600, marginTop: "1px" }}
                      data-testid={`text-item-title-${item.index}`}
                    >
                      {row.title || "—"}
                    </div>
                    {row.opsSummaryPreview && (
                      <div
                        style={{ fontSize: "10.5px", color: template.colors.bodyText, marginTop: "2px" }}
                        data-testid={`text-item-ops-${item.index}`}
                      >
                        {row.opsSummaryPreview}
                      </div>
                    )}
                    {/* Phase 5H.0 — customer notes are intentionally NOT
                        rendered as an extra line here. They are already
                        absorbed into the description fallback chain
                        (extractLaserTableRow), so showing them again
                        would duplicate content AND break Preview/PDF
                        parity (the PDF table never rendered notes). */}
                  </td>
                  <td style={cellStyle} data-testid={`text-row-material-${item.index}`}>
                    <div>{row.materialPrimary || "—"}</div>
                    {row.materialSecondary && (
                      <div
                        style={{ fontSize: "10.5px", color: template.colors.headingMuted, marginTop: "2px" }}
                        data-testid={`text-row-material-secondary-${item.index}`}
                      >
                        {row.materialSecondary}
                      </div>
                    )}
                  </td>
                  <td style={cellStyle} data-testid={`text-row-size-${item.index}`}>
                    {row.dimensions || "—"}
                  </td>
                  <td style={numericCellStyle} data-testid={`text-row-qty-${item.index}`}>
                    {row.qty}
                  </td>
                  {showUnit && (
                    <td style={numericCellStyle} data-testid={`text-row-unit-${item.index}`}>
                      {row.unitPriceLabel ?? "—"}
                    </td>
                  )}
                  {showLT && (
                    <td style={numericCellStyle} data-testid={`text-row-line-total-${item.index}`}>
                      {row.lineTotalLabel ?? "—"}
                    </td>
                  )}
                </tr>,
            ];
            if (showDetail) {
              trs.push(
                <tr key={`detail-${item.index}`} data-testid={`schedule-row-detail-${item.index}`}>
                  <td
                    colSpan={totalCols}
                    style={{
                      ...cellStyle,
                      paddingTop: 0,
                      paddingLeft: "calc(11% + 8px)",
                      fontSize: "10.5px",
                      color: template.colors.headingMuted,
                      fontStyle: "italic",
                    }}
                    data-testid={`text-row-detail-${item.index}`}
                  >
                    {row.detailPreview}
                  </td>
                </tr>
              );
            }
            if (qtyBreakRow) trs.push(qtyBreakRow);
            // Hidden back-compat testids (display:none) for the legacy
            // regression suite that binds to text-line-unit-price-N /
            // text-line-total-N / text-item-total-N / price-detail-N etc.
            trs.push(
              <tr key={`compat-${item.index}`} style={{ display: "none" }} aria-hidden="true">
                <td colSpan={totalCols}>
                  <CompactItemPricing item={item} template={template} />
                </td>
              </tr>
            );
            return trs;
          })}
        </tbody>
      </table>
    </div>
  );
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

  // Phase 5F polish — attached procedures collapse into the parent's
  // `attachedOperations` block (rendered below specs), so per-card indent
  // / "↳ Attached operation —" affordance is removed. `isAttachedChild`
  // only stays true for orphan attached rows whose parent could not be
  // resolved (defensive fallback) — keep a small indent in that case so
  // they remain visually distinct.
  const attachedIndentPx = item.isAttachedChild ? 24 : 0;
  return (
    <div
      className="rounded overflow-hidden print:break-inside-avoid"
      style={{
        border: `1px solid ${template.colors.border}`,
        marginLeft: `${attachedIndentPx}px`,
      }}
      data-testid={`schedule-item-${item.index}`}
      data-display-number={item.displayNumber}
    >
      <div
        className="flex items-baseline justify-between"
        style={{
          backgroundColor: template.colors.bgMuted,
          borderBottom: `1px solid ${template.colors.border}`,
          padding: `${Math.max(4, padPx - 4)}px ${padPx}px`,
        }}
      >
        <h4 className="font-bold text-sm leading-tight" style={{ color: template.colors.bodyText }} data-testid={`text-item-title-${item.index}`}>
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
          <div style={{ display: "grid", gridTemplateColumns: media.drawingUrl ? "45% 1fr" : item.manualBlankPreview ? "150px 1fr" : "1fr", gap: "16px" }}>
            {media.drawingUrl ? (
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
            ) : item.manualBlankPreview ? (
              <ManualBlankPreviewSvg
                lengthMm={item.manualBlankPreview.lengthMm}
                widthMm={item.manualBlankPreview.widthMm}
                template={template}
                itemIndex={item.index}
              />
            ) : null}
            <div>
              <SpecTable specs={visibleSpecs} itemIndex={item.index} template={template} />
            </div>
          </div>
        )}

        <CompactItemPricing item={item} template={template} />


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

        {/* Phase 5F.1 — attached operations are now grouped INSIDE the
             GroupedPricingTable above; we no longer render a separate
             Operations block here. Standalone manual procedures still
             render as their own card and don't carry pricingDisplay
             so they remain unaffected by the new table. */}

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
