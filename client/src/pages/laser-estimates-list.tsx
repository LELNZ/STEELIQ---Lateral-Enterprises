import { useState, useMemo } from "react";
import { PageShell, PageHeader, WorklistBody } from "@/components/ui/platform-layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
  DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Plus, Trash2, FolderOpen, Loader2, FileText, FlaskConical, SlidersHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import type {
  LaserEstimate, LaserQuoteItem, DivisionSettings, LLPricingProfile,
  LLGasCostInput, LLConsumablesCostInput, LLPricingSettings,
} from "@shared/schema";
import type { LLGovernedInputs } from "@/lib/ll-pricing";
// Phase 5H.9D — reuse the EXACT existing estimate pricing source so the list
// value columns match the builder subtotal and customer Preview/PDF totals.
// computeRowPricing is the same function the builder sums into its subtotal
// (totalValue). No new pricing formula is introduced here.
import { computeRowPricing, type SheetMaterialRef } from "@/pages/laser-quote-builder";

type EnrichedLaserEstimate = LaserEstimate & {
  linkedQuote?: { id: string; number: string; status: string } | null;
};

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-700" },
  ready: { label: "Ready", className: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700" },
  converted: { label: "Converted", className: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-700" },
  archived: { label: "Archived", className: "bg-gray-100 text-gray-500 border-gray-300 dark:bg-gray-900/40 dark:text-gray-400 dark:border-gray-600" },
};

// Phase 5H.9D — NZD currency formatting, two decimals, thousands separators.
const formatNzd = (n: number) =>
  `$${n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Phase 5H.9D — hideable (optional) columns. Mandatory columns (Estimate #,
// Customer, Status, Total excl. GST, Actions) are NOT in this list and can
// never be hidden. Visibility is local component state only (no persistence).
type HideableColumn = "items" | "totalIncGst" | "created" | "updated" | "linkedQuote";

const HIDEABLE_COLUMNS: { key: HideableColumn; label: string }[] = [
  { key: "items", label: "Items" },
  { key: "totalIncGst", label: "Total incl. GST" },
  { key: "created", label: "Created" },
  { key: "updated", label: "Updated" },
  { key: "linkedQuote", label: "Linked Quote" },
];

export default function LaserEstimatesList() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "owner" || user?.role === "admin";
  const [, navigate] = useLocation();
  const [deleteTarget, setDeleteTarget] = useState<EnrichedLaserEstimate | null>(null);

  // Phase 5H.9D — column visibility (local state, all visible by default).
  const [visibleCols, setVisibleCols] = useState<Record<HideableColumn, boolean>>({
    items: true,
    totalIncGst: true,
    created: true,
    updated: true,
    linkedQuote: true,
  });

  const { data: estimates = [], isLoading } = useQuery<EnrichedLaserEstimate[]>({
    queryKey: ["/api/laser-estimates"],
  });

  // Phase 5H.9D — pricing inputs: identical queries/derivation to the LL
  // builder so list totals are computed from the same active pricing source.
  const { data: llDivisionSettings } = useQuery<DivisionSettings>({
    queryKey: ["/api/settings/divisions", "LL"],
    staleTime: Infinity,
  });
  const { data: activePricingProfile } = useQuery<LLPricingProfile | null>({
    queryKey: ["/api/ll-pricing-profiles", "active"],
    queryFn: () => fetch("/api/ll-pricing-profiles/active", { credentials: "include" }).then(r => r.json()),
    staleTime: 60_000,
  });
  const { data: sheetMaterials = [] } = useQuery<SheetMaterialRef[]>({
    queryKey: ["/api/ll-sheet-materials", "active", "quoteable"],
    queryFn: () => fetch("/api/ll-sheet-materials?active=true&quoteable=true", { credentials: "include" }).then(r => r.json()),
  });
  const { data: activeGasInputs = [] } = useQuery<LLGasCostInput[]>({
    queryKey: ["/api/ll-gas-cost-inputs", "active"],
    queryFn: () => fetch("/api/ll-gas-cost-inputs/active", { credentials: "include" }).then(r => r.json()),
    staleTime: 60_000,
  });
  const { data: activeConsumableInputs = [] } = useQuery<LLConsumablesCostInput[]>({
    queryKey: ["/api/ll-consumables-cost-inputs", "active"],
    queryFn: () => fetch("/api/ll-consumables-cost-inputs/active", { credentials: "include" }).then(r => r.json()),
    staleTime: 60_000,
  });

  const llPricingSettings = (activePricingProfile?.llPricingSettingsJson ?? llDivisionSettings?.llPricingSettingsJson ?? null) as LLPricingSettings | null;
  const governedInputs: LLGovernedInputs = useMemo(() => ({
    gasInputs: activeGasInputs.length > 0 ? activeGasInputs : undefined,
    consumableInputs: activeConsumableInputs.length > 0 ? activeConsumableInputs : undefined,
  }), [activeGasInputs, activeConsumableInputs]);

  // Phase 5H.9D — per-estimate totals. Sum of computeRowPricing(...).finalLineSell
  // over the estimate's stored itemsJson (the same value the builder calls
  // totalValue / subtotalExclGst). GST mirrors the builder: × 0.15 / × 1.15.
  // Returns null when there are no items or computation fails → renders "—".
  const estimateTotals = useMemo(() => {
    const map = new Map<string, { exGst: number; incGst: number } | null>();
    for (const est of estimates) {
      try {
        const items = (est.itemsJson as LaserQuoteItem[]) ?? [];
        if (!items || items.length === 0) {
          map.set(est.id, null);
          continue;
        }
        let total = 0;
        for (const item of items) {
          total += computeRowPricing(item, sheetMaterials, llPricingSettings, governedInputs).finalLineSell;
        }
        map.set(est.id, { exGst: total, incGst: total * 1.15 });
      } catch {
        map.set(est.id, null);
      }
    }
    return map;
  }, [estimates, sheetMaterials, llPricingSettings, governedInputs]);

  const demoFlagMutation = useMutation({
    mutationFn: async ({ id, isDemoRecord }: { id: string; isDemoRecord: boolean }) => {
      await apiRequest("PATCH", `/api/laser-estimates/${id}/demo-flag`, { isDemoRecord });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/laser-estimates"] });
      toast({ title: "Demo flag updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/laser-estimates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/laser-estimates"] });
      toast({ title: "Deleted", description: "Laser estimate deleted" });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const itemCount = (est: LaserEstimate) => {
    const items = est.itemsJson as any[];
    return items?.length ?? 0;
  };

  const formatDate = (d: string | Date | null | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-NZ", { day: "2-digit", month: "short", year: "numeric" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="loading-laser-estimates">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        icon={<FileText className="w-4 h-4 text-primary-foreground" />}
        title="LL – Laser Estimates"
        subtitle="Lateral Laser — Estimate workspace"
        titleTestId="text-page-title"
        actions={
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-columns">
                  <SlidersHorizontal className="h-4 w-4 mr-1" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {HIDEABLE_COLUMNS.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.key}
                    checked={visibleCols[col.key]}
                    onCheckedChange={(checked) =>
                      setVisibleCols((prev) => ({ ...prev, [col.key]: !!checked }))
                    }
                    onSelect={(e) => e.preventDefault()}
                    data-testid={`toggle-column-${col.key}`}
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="sm"
              onClick={() => navigate("/laser-estimate/new")}
              data-testid="button-new-laser-estimate"
            >
              <Plus className="h-4 w-4 mr-1" />
              New Estimate
            </Button>
          </div>
        }
      />
      <WorklistBody>
        {estimates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center" data-testid="empty-state-laser-estimates">
            <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground mb-1">No laser estimates yet</p>
            <p className="text-xs text-muted-foreground mb-4">Create your first laser estimate to get started.</p>
            <Button size="sm" onClick={() => navigate("/laser-estimate/new")} data-testid="button-create-first-estimate">
              <Plus className="h-4 w-4 mr-1" />
              New Estimate
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[140px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estimate #</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer</TableHead>
                  {visibleCols.items && (
                    <TableHead className="w-[80px] text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Items</TableHead>
                  )}
                  <TableHead className="w-[100px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                  <TableHead className="w-[130px] text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total excl. GST</TableHead>
                  {visibleCols.totalIncGst && (
                    <TableHead className="w-[130px] text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total incl. GST</TableHead>
                  )}
                  {visibleCols.created && (
                    <TableHead className="w-[110px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Created</TableHead>
                  )}
                  {visibleCols.updated && (
                    <TableHead className="w-[110px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Updated</TableHead>
                  )}
                  {visibleCols.linkedQuote && (
                    <TableHead className="w-[140px] hidden md:table-cell text-xs font-semibold uppercase tracking-wider text-muted-foreground">Linked Quote</TableHead>
                  )}
                  <TableHead className="w-[100px] text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estimates.map((est) => {
                  const style = STATUS_STYLES[est.status] || STATUS_STYLES.draft;
                  const totals = estimateTotals.get(est.id) ?? null;
                  return (
                    <TableRow key={est.id} className="hover:bg-muted/30" data-testid={`row-laser-estimate-${est.id}`}>
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Link href={`/laser-estimate/${est.id}`}>
                            <span className="text-sm font-medium text-primary hover:underline cursor-pointer" data-testid={`link-estimate-${est.id}`}>
                              {est.estimateNumber}
                            </span>
                          </Link>
                          {isAdmin && est.isDemoRecord && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 shrink-0" data-testid={`badge-demo-laser-${est.id}`}>
                              <FlaskConical className="h-2.5 w-2.5 mr-0.5" />Demo
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <span className="text-sm" data-testid={`text-customer-${est.id}`}>{est.customerName}</span>
                      </TableCell>
                      {visibleCols.items && (
                        <TableCell className="text-center py-2.5">
                          <span className="text-sm text-muted-foreground" data-testid={`text-items-${est.id}`}>{itemCount(est)}</span>
                        </TableCell>
                      )}
                      <TableCell className="py-2.5">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${style.className}`} data-testid={`badge-status-${est.id}`}>
                          {style.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right py-2.5">
                        <span className="text-sm font-mono tabular-nums" data-testid={`text-total-excl-gst-${est.id}`}>
                          {totals ? formatNzd(totals.exGst) : "—"}
                        </span>
                      </TableCell>
                      {visibleCols.totalIncGst && (
                        <TableCell className="text-right py-2.5">
                          <span className="text-sm font-mono tabular-nums text-muted-foreground" data-testid={`text-total-incl-gst-${est.id}`}>
                            {totals ? formatNzd(totals.incGst) : "—"}
                          </span>
                        </TableCell>
                      )}
                      {visibleCols.created && (
                        <TableCell className="py-2.5">
                          <span className="text-xs text-muted-foreground">{formatDate(est.createdAt)}</span>
                        </TableCell>
                      )}
                      {visibleCols.updated && (
                        <TableCell className="py-2.5">
                          <span className="text-xs text-muted-foreground">{formatDate(est.updatedAt)}</span>
                        </TableCell>
                      )}
                      {visibleCols.linkedQuote && (
                        <TableCell className="hidden md:table-cell py-2.5">
                          {est.linkedQuote ? (
                            <Link href={`/quote/${est.linkedQuote.id}`}>
                              <span className="text-xs font-medium text-primary hover:underline cursor-pointer" data-testid={`link-quote-${est.id}`}>
                                {est.linkedQuote.number}
                              </span>
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-right py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-7 w-7 ${est.isDemoRecord ? "text-amber-600" : "text-muted-foreground"}`}
                              onClick={() => demoFlagMutation.mutate({ id: est.id, isDemoRecord: !est.isDemoRecord })}
                              title={est.isDemoRecord ? "Remove demo flag" : "Flag as demo"}
                              data-testid={`button-toggle-demo-${est.id}`}
                            >
                              <FlaskConical className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => navigate(`/laser-estimate/${est.id}`)}
                            title="Open"
                            data-testid={`button-open-estimate-${est.id}`}
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                          </Button>
                          {est.status !== "converted" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(est)}
                              title="Delete"
                              data-testid={`button-delete-estimate-${est.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </WorklistBody>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Laser Estimate</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete estimate <strong>{deleteTarget?.estimateNumber}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} data-testid="button-cancel-delete">Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
