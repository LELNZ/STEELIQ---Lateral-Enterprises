import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ArrowLeftCircle, Printer, Settings2, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { OrgSettings, DivisionSettings, Quote, QuoteRevision, SpecDictionaryEntry } from "@shared/schema";
import type { EstimateSnapshot, SnapshotItem } from "@shared/estimate-snapshot";

interface PreviewData {
  orgSettings: OrgSettings;
  divisionSettings: DivisionSettings;
  quote: Quote;
  currentRevision: QuoteRevision;
  snapshot: EstimateSnapshot;
  templateKey: string;
  specDictionaryGrouped: Record<string, SpecDictionaryEntry[]>;
  effectiveSpecDisplayKeys: string[];
}

function fmt(n: number): string {
  return n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function QuotePreview() {
  const [, params] = useRoute("/quote/:id/preview");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const quoteId = params?.id;
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [specSheetOpen, setSpecSheetOpen] = useState(false);

  const { data: preview, isLoading } = useQuery<PreviewData>({
    queryKey: ["/api/quotes", quoteId, "preview-data"],
    enabled: !!quoteId,
  });

  const [localKeys, setLocalKeys] = useState<string[] | null>(null);

  const effectiveKeys = localKeys ?? preview?.effectiveSpecDisplayKeys ?? [];

  const allSpecKeys = useMemo(() => {
    if (!preview) return [];
    const entries: SpecDictionaryEntry[] = [];
    for (const group of Object.values(preview.specDictionaryGrouped)) {
      entries.push(...group);
    }
    return entries.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [preview]);

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
      if (!preview || !localKeys) return;
      await apiRequest("PATCH", `/api/quotes/${quoteId}/revisions/${preview.currentRevision.id}/spec-display`, {
        specDisplayKeys: localKeys,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "preview-data"] });
      toast({ title: "Spec display saved" });
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

  if (!preview) {
    return <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Quote not found</p></div>;
  }

  const { orgSettings, divisionSettings, quote, snapshot } = preview;
  const items = snapshot.items || [];
  const tb = snapshot.totalsBreakdown || { itemsSubtotal: 0, installationTotal: 0, deliveryTotal: 0, subtotalExclGst: 0, gstAmount: 0, totalInclGst: 0 };
  const legacyTotals = snapshot.totals;

  const quoteDate = quote.createdAt ? new Date(quote.createdAt).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" }) : "—";
  const validityDays = orgSettings.quoteValidityDays || 30;
  const expiryDate = quote.createdAt
    ? new Date(new Date(quote.createdAt).getTime() + validityDays * 24 * 60 * 60 * 1000).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" })
    : "—";

  return (
    <div className="max-w-4xl mx-auto print:max-w-none" data-testid="quote-preview-page">
      <div className="flex items-center justify-between p-4 print:hidden border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/quote/${quoteId}`)} data-testid="button-back-to-quote">
            <ArrowLeftCircle className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">Customer Quote Preview</h1>
            <p className="text-sm text-muted-foreground">{quote.number}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Sheet open={specSheetOpen} onOpenChange={setSpecSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-edit-spec-display">
                <Settings2 className="h-4 w-4 mr-1" /> Edit Spec Display
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Visible Specs</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                {Object.entries(preview.specDictionaryGrouped).map(([group, specs]) => (
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

      <div className="p-8 print:p-4 space-y-8 print:space-y-6">
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold" data-testid="text-trading-name">
                {divisionSettings.tradingName || orgSettings.legalName || "Pro-Quote"}
              </h2>
              <p className="text-sm text-muted-foreground italic" data-testid="text-legal-line">
                {divisionSettings.requiredLegalLine || "A trading division of Lateral Engineering Limited"}
              </p>
            </div>
            <div className="text-right text-sm text-muted-foreground space-y-0.5">
              {orgSettings.address && <p>{orgSettings.address}</p>}
              {orgSettings.phone && <p>{orgSettings.phone}</p>}
              {orgSettings.email && <p>{orgSettings.email}</p>}
              {orgSettings.gstNumber && <p>GST: {orgSettings.gstNumber}</p>}
              {orgSettings.nzbn && <p>NZBN: {orgSettings.nzbn}</p>}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Customer</p>
              <p className="text-lg font-semibold" data-testid="text-customer">{quote.customer}</p>
            </div>
            <div className="text-right space-y-1">
              <div><span className="text-xs text-muted-foreground">Quote #: </span><span className="font-mono font-semibold" data-testid="text-quote-number-preview">{quote.number}</span></div>
              <div><span className="text-xs text-muted-foreground">Date: </span><span data-testid="text-quote-date">{quoteDate}</span></div>
              <div><span className="text-xs text-muted-foreground">Valid Until: </span><span data-testid="text-quote-expiry">{expiryDate}</span></div>
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-2" data-testid="totals-block">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Quote Summary</h3>
            {(tb.itemsSubtotal > 0 || (legacyTotals && legacyTotals.sell > 0)) ? (
              <div className="space-y-1 text-sm">
                {tb.itemsSubtotal > 0 && <div className="flex justify-between"><span>Items Subtotal</span><span data-testid="text-items-subtotal">${fmt(tb.itemsSubtotal)}</span></div>}
                {tb.installationTotal > 0 && <div className="flex justify-between"><span>Installation</span><span data-testid="text-install-total">${fmt(tb.installationTotal)}</span></div>}
                {tb.deliveryTotal > 0 && <div className="flex justify-between"><span>Delivery</span><span data-testid="text-delivery-total">${fmt(tb.deliveryTotal)}</span></div>}
                <Separator />
                <div className="flex justify-between font-medium"><span>Subtotal (excl. GST)</span><span data-testid="text-subtotal-ex-gst">${fmt(tb.subtotalExclGst || tb.itemsSubtotal)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>GST (15%)</span><span data-testid="text-gst">${fmt(tb.gstAmount)}</span></div>
                <div className="flex justify-between text-lg font-bold"><span>Total (incl. GST)</span><span data-testid="text-total-inc-gst">${fmt(tb.totalInclGst)}</span></div>
              </div>
            ) : legacyTotals ? (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between font-medium"><span>Quoted Price (excl. GST)</span><span>${fmt(legacyTotals.sell)}</span></div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No pricing data available.</p>
            )}
          </div>
        </div>

        <div className="print:break-before-page space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Terms & Conditions</h3>
          {(divisionSettings.exclusionsOverrideBlock || orgSettings.defaultExclusionsBlock) && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Exclusions</p>
              <p className="text-sm whitespace-pre-wrap">{divisionSettings.exclusionsOverrideBlock || orgSettings.defaultExclusionsBlock}</p>
            </div>
          )}
          {(divisionSettings.termsOverrideBlock || orgSettings.defaultTermsBlock) && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Terms</p>
              <p className="text-sm whitespace-pre-wrap">{divisionSettings.termsOverrideBlock || orgSettings.defaultTermsBlock}</p>
            </div>
          )}
          {orgSettings.paymentTermsBlock && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Payment Terms</p>
              <p className="text-sm whitespace-pre-wrap">{orgSettings.paymentTermsBlock}</p>
            </div>
          )}
          {orgSettings.bankDetails && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Bank Details</p>
              <p className="text-sm whitespace-pre-wrap">{orgSettings.bankDetails}</p>
            </div>
          )}

          <div className="mt-8 space-y-4 border-t pt-4">
            <p className="text-sm font-semibold">Acceptance</p>
            <div className="grid grid-cols-3 gap-4">
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

function ScheduleItem({
  item,
  index,
  expanded,
  onToggle,
  displayKeys,
  specKeyToLabel,
}: {
  item: SnapshotItem;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  displayKeys: string[];
  specKeyToLabel: Record<string, string>;
}) {
  const specs = item.resolvedSpecs || {};
  const visibleSpecs = displayKeys
    .filter(key => specs[key] && specs[key] !== "" && specs[key] !== "0")
    .map(key => ({ key, label: specKeyToLabel[key] || key, value: specs[key] }));

  const defaultShow = Math.min(visibleSpecs.length, 14);
  const hasMore = visibleSpecs.length > defaultShow;

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {item.drawingImageKey && (
          <div className="flex items-center justify-center">
            <img
              src={`/api/drawing-images/${item.drawingImageKey}`}
              alt={`Drawing for item ${index + 1}`}
              className="max-h-64 object-contain rounded border"
              data-testid={`img-drawing-${index}`}
            />
          </div>
        )}
        <div>
          <table className="w-full text-sm">
            <tbody>
              {(expanded ? visibleSpecs : visibleSpecs.slice(0, defaultShow)).map(({ key, label, value }) => (
                <tr key={key} className="border-b last:border-b-0">
                  <td className="py-1 pr-3 text-muted-foreground whitespace-nowrap">{label}</td>
                  <td className="py-1 font-medium" data-testid={`text-spec-${key}-${index}`}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleSpecs.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No specification data available for this item.</p>
          )}
        </div>
      </div>
    </div>
  );
}
