import { useState, useMemo, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ArrowLeftCircle, Printer, Settings2, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { PreviewData, QuoteDocumentModel, QuoteDocumentItem } from "@/lib/quote-document";
import { buildQuoteDocumentModel } from "@/lib/quote-document";
import { MediaViewer } from "@/components/media-viewer";

function fmt(n: number): string {
  return n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" });
}

export default function QuotePreview() {
  const [, paramsSingular] = useRoute("/quote/:id/preview");
  const [, paramsPlural] = useRoute("/quotes/:id/preview");
  const params = paramsSingular || paramsPlural;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const quoteId = params?.id;
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [specSheetOpen, setSpecSheetOpen] = useState(false);

  const { data: preview, isLoading } = useQuery<PreviewData>({
    queryKey: ["/api/quotes", quoteId, "preview-data"],
    enabled: !!quoteId,
  });

  const doc: QuoteDocumentModel | null = useMemo(() => {
    if (!preview) return null;
    return buildQuoteDocumentModel(preview);
  }, [preview]);

  const [localKeys, setLocalKeys] = useState<string[] | null>(null);

  const effectiveKeys = localKeys ?? doc?.specDisplay.effectiveKeys ?? [];

  const allSpecKeys = useMemo(() => {
    if (!doc) return [];
    const entries: { key: string; label: string; sortOrder?: number | null; customerVisibleAllowed?: boolean | null }[] = [];
    for (const group of Object.values(doc.specDisplay.specDictionaryGrouped)) {
      entries.push(...group);
    }
    return entries.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [doc]);

  const specKeyToLabel = useMemo(() => {
    const m: Record<string, string> = {};
    allSpecKeys.forEach(s => { m[s.key] = s.label; });
    return m;
  }, [allSpecKeys]);

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

  const toggleItemExpand = (idx: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Loading preview...</p></div>;
  }

  if (!doc) {
    return <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Quote not found</p></div>;
  }

  const { metadata, branding, org, customer, totals, content, specDisplay } = doc;
  const items = doc.items;

  const quoteDate = formatDate(metadata.createdAt);
  const expiryDate = formatDate(metadata.validUntil);

  return (
    <div className="max-w-4xl mx-auto print:max-w-none" data-testid="quote-preview-page">
      <div className="flex items-center justify-between flex-wrap gap-2 p-4 print:hidden border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/quote/${quoteId}`)} data-testid="button-back-to-quote">
            <ArrowLeftCircle className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">Customer Quote Preview</h1>
            <p className="text-sm text-muted-foreground">{metadata.quoteNumber}</p>
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
                {Object.entries(specDisplay.specDictionaryGrouped).map(([group, specs]) => (
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
          <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="button-print-preview">
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
        </div>
      </div>

      <div className="p-4 sm:p-8 print:p-4 space-y-8 print:space-y-6">
        <div className="space-y-6">
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
              {org.address && <p>{org.address}</p>}
              {org.phone && <p>{org.phone}</p>}
              {org.email && <p>{org.email}</p>}
              {org.gstNumber && <p>GST: {org.gstNumber}</p>}
              {org.nzbn && <p>NZBN: {org.nzbn}</p>}
            </div>
          </div>

          <Separator />

          <p className="text-sm italic text-muted-foreground print:text-gray-500" data-testid="text-preliminary-disclaimer">
            Preliminary Estimate — subject to final site measure, specification confirmation, and final approval.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Customer</p>
              <p className="text-lg font-semibold" data-testid="text-customer">{customer.name}</p>
              {doc.project.address && (
                <div className="mt-1">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Project Address</p>
                  <p className="text-sm" data-testid="text-project-address">{doc.project.address}</p>
                </div>
              )}
            </div>
            <div className="sm:text-right space-y-1">
              <div><span className="text-xs text-muted-foreground">Quote #: </span><span className="font-mono font-semibold" data-testid="text-quote-number-preview">{metadata.quoteNumber}</span></div>
              <div><span className="text-xs text-muted-foreground">Date: </span><span data-testid="text-quote-date">{quoteDate}</span></div>
              <div><span className="text-xs text-muted-foreground">Valid Until: </span><span data-testid="text-quote-expiry">{expiryDate}</span></div>
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-2" data-testid="totals-block">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Quote Summary</h3>
            {(totals.itemsSubtotal > 0 || (totals.legacySell !== null && totals.legacySell > 0)) ? (
              <div className="space-y-1 text-sm">
                {totals.itemsSubtotal > 0 && <div className="flex justify-between"><span>Items Subtotal</span><span data-testid="text-items-subtotal">${fmt(totals.itemsSubtotal)}</span></div>}
                {totals.installationTotal > 0 && <div className="flex justify-between"><span>Installation</span><span data-testid="text-install-total">${fmt(totals.installationTotal)}</span></div>}
                {totals.deliveryTotal > 0 && <div className="flex justify-between"><span>Delivery</span><span data-testid="text-delivery-total">${fmt(totals.deliveryTotal)}</span></div>}
                <Separator />
                <div className="flex justify-between font-medium"><span>Subtotal (excl. GST)</span><span data-testid="text-subtotal-ex-gst">${fmt(totals.subtotalExclGst)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>GST (15%)</span><span data-testid="text-gst">${fmt(totals.gstAmount)}</span></div>
                <div className="flex justify-between text-lg font-bold"><span>Total (incl. GST)</span><span data-testid="text-total-inc-gst">${fmt(totals.totalInclGst)}</span></div>
              </div>
            ) : totals.legacySell !== null ? (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between font-medium"><span>Quoted Price (excl. GST)</span><span>${fmt(totals.legacySell)}</span></div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No pricing data available.</p>
            )}
          </div>
        </div>

        <div className="print:break-before-page space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Terms & Conditions</h3>
          {content.exclusions && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Exclusions</p>
              <p className="text-sm whitespace-pre-wrap">{content.exclusions}</p>
            </div>
          )}
          {content.terms && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Terms</p>
              <p className="text-sm whitespace-pre-wrap">{content.terms}</p>
            </div>
          )}
          {content.paymentTerms && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Payment Terms</p>
              <p className="text-sm whitespace-pre-wrap">{content.paymentTerms}</p>
            </div>
          )}
          {org.bankDetails && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Bank Details</p>
              <p className="text-sm whitespace-pre-wrap">{org.bankDetails}</p>
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

        <div className="print:break-before-page space-y-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Schedule of Items</h3>
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">No items in this quote snapshot. This may be a legacy quote — try generating a new revision from the estimator.</p>
          )}
          {items.map((item, idx) => (
            <ScheduleItem
              key={idx}
              item={item}
              index={idx}
              expanded={expandedItems.has(idx)}
              onToggle={() => toggleItemExpand(idx)}
              displayKeys={effectiveKeys}
              specKeyToLabel={specKeyToLabel}
            />
          ))}
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
}: {
  src: string;
  alt: string;
  className?: string;
  testId: string;
  fallbackTestId: string;
  fallbackText: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => { setFailed(false); }, [src]);

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
      onError={() => setFailed(true)}
    />
  );
}

function ScheduleItem({
  item,
  index,
  expanded,
  onToggle,
  displayKeys,
  specKeyToLabel,
}: {
  item: QuoteDocumentItem;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  displayKeys: string[];
  specKeyToLabel: Record<string, string>;
}) {
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState("");

  const specs = item.resolvedSpecs || {};
  const visibleSpecs = displayKeys
    .filter(key => specs[key] && specs[key] !== "" && specs[key] !== "0")
    .map(key => ({ key, label: specKeyToLabel[key] || key, value: specs[key] }));

  const defaultShow = Math.min(visibleSpecs.length, 14);
  const hasMore = visibleSpecs.length > defaultShow;
  const useTwoColPrint = visibleSpecs.length > 14;

  const customerPhotos = (item.photos || []).filter(p => p.includeInCustomerPdf);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 print:break-inside-avoid" data-testid={`schedule-item-${index}`}>
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold" data-testid={`text-item-title-${index}`}>
            Item {item.itemNumber || index + 1} — {item.itemRef || item.title || `Item ${index + 1}`}
          </h4>
          <p className="text-sm text-muted-foreground">
            Qty: {item.quantity || 1} | {item.width}mm x {item.height}mm
          </p>
        </div>
        {hasMore && (
          <Button variant="ghost" size="sm" onClick={onToggle} className="print:hidden" data-testid={`button-toggle-specs-${index}`}>
            {expanded ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
            {expanded ? "Show less" : "Show more details"}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {item.drawingImageKey && (
          <div className="flex items-center justify-center">
            <div
              className="cursor-pointer print:cursor-default"
              onClick={() => {
                setViewerSrc(`/api/drawing-images/${item.drawingImageKey}`);
                setViewerTitle(`Drawing — Item ${item.itemNumber || index + 1}`);
              }}
            >
              <MediaImage
                src={`/api/drawing-images/${item.drawingImageKey}`}
                alt={`Drawing for item ${index + 1}`}
                className="max-h-64 object-contain rounded border"
                testId={`img-drawing-${index}`}
                fallbackTestId={`fallback-drawing-${index}`}
                fallbackText="Drawing unavailable"
              />
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className={`w-full text-sm ${useTwoColPrint ? "print:hidden" : ""}`}>
            <tbody>
              {(expanded ? visibleSpecs : visibleSpecs.slice(0, defaultShow)).map(({ key, label, value }) => (
                <tr key={key} className="border-b last:border-b-0">
                  <td className="py-1 pr-3 text-muted-foreground whitespace-nowrap max-w-[140px] truncate">{label}</td>
                  <td className="py-1 font-medium overflow-wrap-anywhere" style={{ overflowWrap: "break-word" }} data-testid={`text-spec-${key}-${index}`}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {useTwoColPrint && (
            <table className="hidden print:table w-full text-sm">
              <tbody>
                <tr>
                  <td className="align-top pr-4 w-1/2">
                    <table className="w-full text-sm">
                      <tbody>
                        {visibleSpecs.slice(0, Math.ceil(visibleSpecs.length / 2)).map(({ key, label, value }) => (
                          <tr key={key} className="border-b last:border-b-0">
                            <td className="py-0.5 pr-2 text-muted-foreground whitespace-nowrap max-w-[140px] truncate text-xs">{label}</td>
                            <td className="py-0.5 font-medium text-xs" style={{ overflowWrap: "break-word" }}>{value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                  <td className="align-top w-1/2">
                    <table className="w-full text-sm">
                      <tbody>
                        {visibleSpecs.slice(Math.ceil(visibleSpecs.length / 2)).map(({ key, label, value }) => (
                          <tr key={key} className="border-b last:border-b-0">
                            <td className="py-0.5 pr-2 text-muted-foreground whitespace-nowrap max-w-[140px] truncate text-xs">{label}</td>
                            <td className="py-0.5 font-medium text-xs" style={{ overflowWrap: "break-word" }}>{value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
          )}
          {!useTwoColPrint && (
            <table className="hidden print:table w-full text-sm">
              <tbody>
                {visibleSpecs.map(({ key, label, value }) => (
                  <tr key={key} className="border-b last:border-b-0">
                    <td className="py-0.5 pr-3 text-muted-foreground whitespace-nowrap max-w-[140px] truncate text-xs">{label}</td>
                    <td className="py-0.5 font-medium text-xs" style={{ overflowWrap: "break-word" }}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {visibleSpecs.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No specification data available for this item.</p>
          )}
        </div>
      </div>

      {customerPhotos.length > 0 && (
        <div className="space-y-2" data-testid={`photos-section-${index}`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Site Photos</p>
          <div className="flex flex-wrap gap-3">
            {customerPhotos.map((photo, pIdx) => (
              <div key={photo.key} className="space-y-1">
                <div
                  className="cursor-pointer print:cursor-default"
                  onClick={() => {
                    setViewerSrc(`/api/item-photos/${photo.key}`);
                    setViewerTitle(photo.caption || `Photo ${pIdx + 1} — Item ${index + 1}`);
                  }}
                >
                  <MediaImage
                    src={`/api/item-photos/${photo.key}`}
                    alt={photo.caption || `Photo ${pIdx + 1} for item ${index + 1}`}
                    className="max-h-48 max-w-[200px] object-contain rounded border"
                    testId={`img-photo-${index}-${pIdx}`}
                    fallbackTestId={`fallback-photo-${index}-${pIdx}`}
                    fallbackText="Photo unavailable"
                  />
                </div>
                {photo.caption && (
                  <p className="text-xs text-muted-foreground text-center max-w-[200px]">{photo.caption}</p>
                )}
              </div>
            ))}
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
