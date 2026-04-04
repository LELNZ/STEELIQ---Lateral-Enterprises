import { useState } from "react";
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
import { Plus, Trash2, FolderOpen, Loader2, FileText, ArrowRightCircle, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { LaserEstimate } from "@shared/schema";

type EnrichedLaserEstimate = LaserEstimate & {
  linkedQuote?: { id: string; number: string; status: string } | null;
};

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-700" },
  ready: { label: "Ready", className: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700" },
  converted: { label: "Converted", className: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-700" },
  archived: { label: "Archived", className: "bg-gray-100 text-gray-500 border-gray-300 dark:bg-gray-900/40 dark:text-gray-400 dark:border-gray-600" },
};

export default function LaserEstimatesList() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [deleteTarget, setDeleteTarget] = useState<EnrichedLaserEstimate | null>(null);

  const { data: estimates = [], isLoading } = useQuery<EnrichedLaserEstimate[]>({
    queryKey: ["/api/laser-estimates"],
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
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b px-4 py-3 bg-background" data-testid="laser-estimates-header">
        <div>
          <h1 className="text-lg font-semibold" data-testid="text-page-title">LL – Laser Estimates</h1>
          <p className="text-xs text-muted-foreground">Lateral Laser — Estimate workspace</p>
        </div>
        <Button
          size="sm"
          onClick={() => navigate("/laser-estimate/new")}
          data-testid="button-new-laser-estimate"
        >
          <Plus className="h-4 w-4 mr-1" />
          New Estimate
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
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
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Estimate #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="w-[80px] text-center">Items</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[110px]">Created</TableHead>
                  <TableHead className="w-[110px]">Updated</TableHead>
                  <TableHead className="w-[140px] hidden md:table-cell">Linked Quote</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estimates.map((est) => {
                  const style = STATUS_STYLES[est.status] || STATUS_STYLES.draft;
                  return (
                    <TableRow key={est.id} data-testid={`row-laser-estimate-${est.id}`}>
                      <TableCell>
                        <Link href={`/laser-estimate/${est.id}`}>
                          <span className="text-sm font-medium text-primary hover:underline cursor-pointer" data-testid={`link-estimate-${est.id}`}>
                            {est.estimateNumber}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm" data-testid={`text-customer-${est.id}`}>{est.customerName}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm text-muted-foreground" data-testid={`text-items-${est.id}`}>{itemCount(est)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${style.className}`} data-testid={`badge-status-${est.id}`}>
                          {style.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{formatDate(est.createdAt)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{formatDate(est.updatedAt)}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
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
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
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
      </div>

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
    </div>
  );
}
