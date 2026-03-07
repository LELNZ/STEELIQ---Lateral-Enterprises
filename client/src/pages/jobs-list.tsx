import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LayoutGrid, Plus, Trash2, FolderOpen, Calendar, MapPin, Square, Archive } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Job, Quote } from "@shared/schema";

type JobWithCount = Job & { itemCount: number; totalSqm: number };

type CascadeDialogState =
  | { type: "none" }
  | { type: "delete"; jobId: string; jobName: string; linkedQuotes: Quote[]; loading: boolean }
  | { type: "archive"; jobId: string; jobName: string; linkedQuotes: Quote[]; loading: boolean };

export default function JobsList() {
  const { toast } = useToast();
  const [cascadeDialog, setCascadeDialog] = useState<CascadeDialogState>({ type: "none" });

  const { data: jobs = [], isLoading } = useQuery<JobWithCount[]>({
    queryKey: ["/api/jobs"],
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, quoteCascade }: { id: string; quoteCascade: "archive" | "delete" | "keep" }) => {
      const body: any = { quoteCascade };
      if (quoteCascade === "delete") body.confirmPermanent = true;
      await apiRequest("DELETE", `/api/jobs/${id}`, body);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      setCascadeDialog({ type: "none" });
      const actionLabel = variables.quoteCascade === "archive"
        ? "Estimate deleted, linked quotes archived"
        : variables.quoteCascade === "delete"
          ? "Estimate and linked quotes permanently deleted"
          : "Estimate deleted, quotes kept";
      toast({ title: actionLabel });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete estimate", description: error.message, variant: "destructive" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, quoteCascade }: { id: string; quoteCascade: "archive" | "keep" }) => {
      await apiRequest("PATCH", `/api/jobs/${id}/archive`, { quoteCascade });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      setCascadeDialog({ type: "none" });
      const actionLabel = variables.quoteCascade === "archive"
        ? "Estimate archived with linked quotes"
        : "Estimate archived, quotes kept";
      toast({ title: actionLabel });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to archive estimate", description: error.message, variant: "destructive" });
    },
  });

  async function openDeleteDialog(job: JobWithCount) {
    setCascadeDialog({ type: "delete", jobId: job.id, jobName: job.name, linkedQuotes: [], loading: true });
    try {
      const res = await apiRequest("GET", `/api/jobs/${job.id}/quotes`);
      const quotes: Quote[] = await res.json();
      setCascadeDialog({ type: "delete", jobId: job.id, jobName: job.name, linkedQuotes: quotes, loading: false });
    } catch {
      setCascadeDialog({ type: "delete", jobId: job.id, jobName: job.name, linkedQuotes: [], loading: false });
    }
  }

  async function openArchiveDialog(job: JobWithCount) {
    setCascadeDialog({ type: "archive", jobId: job.id, jobName: job.name, linkedQuotes: [], loading: true });
    try {
      const res = await apiRequest("GET", `/api/jobs/${job.id}/quotes`);
      const quotes: Quote[] = await res.json();
      if (quotes.length === 0) {
        archiveMutation.mutate({ id: job.id, quoteCascade: "archive" });
        return;
      }
      setCascadeDialog({ type: "archive", jobId: job.id, jobName: job.name, linkedQuotes: quotes, loading: false });
    } catch {
      archiveMutation.mutate({ id: job.id, quoteCascade: "archive" });
    }
  }

  const isPending = deleteMutation.isPending || archiveMutation.isPending;

  return (
    <div className="flex flex-col h-full bg-background" data-testid="jobs-list">
      <header className="border-b px-4 sm:px-6 py-3 flex items-center justify-between gap-3 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary">
            <LayoutGrid className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold tracking-tight" data-testid="text-app-title">
                Estimates
              </h1>
              <Badge variant="outline" data-testid="badge-division-lj">LJ</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Manage your quotation estimates</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/job/new">
            <Button data-testid="button-new-job">
              <Plus className="w-4 h-4 mr-2" /> New Estimate
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading jobs...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4" data-testid="empty-jobs">
            <FolderOpen className="w-12 h-12 text-muted-foreground/50" />
            <p className="text-muted-foreground text-lg">No estimates yet</p>
            <Link href="/job/new">
              <Button data-testid="button-create-first-job">
                <Plus className="w-4 h-4 mr-2" /> Create your first estimate
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 max-w-4xl mx-auto">
            {jobs.map((job) => (
              <Card key={job.id} data-testid={`card-job-${job.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base" data-testid={`text-job-name-${job.id}`}>
                      {job.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {job.totalSqm > 0 && (
                        <Badge variant="outline" data-testid={`badge-sqm-${job.id}`}>
                          <Square className="w-3 h-3 mr-1" />
                          {job.totalSqm} m²
                        </Badge>
                      )}
                      <Badge variant="secondary" data-testid={`badge-item-count-${job.id}`}>
                        {job.itemCount} item{job.itemCount !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                    {job.address && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {job.address}
                      </span>
                    )}
                    {job.date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> {job.date}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Link href={`/job/${job.id}`}>
                      <Button className="min-h-10 sm:min-h-9" data-testid={`button-open-job-${job.id}`}>
                        <FolderOpen className="w-3.5 h-3.5 mr-1.5" /> Open
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      className="min-h-10 sm:min-h-9"
                      onClick={() => openArchiveDialog(job)}
                      disabled={isPending}
                      data-testid={`button-archive-job-${job.id}`}
                    >
                      <Archive className="w-3.5 h-3.5 mr-1.5" /> Archive
                    </Button>
                    <Button
                      variant="ghost"
                      className="min-h-10 sm:min-h-9"
                      onClick={() => openDeleteDialog(job)}
                      disabled={isPending}
                      data-testid={`button-delete-job-${job.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={cascadeDialog.type === "delete"}
        onOpenChange={(open) => { if (!open) setCascadeDialog({ type: "none" }); }}
      >
        <DialogContent data-testid="dialog-delete-estimate">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">Delete Estimate</DialogTitle>
            <DialogDescription data-testid="text-dialog-description">
              {cascadeDialog.type === "delete" && cascadeDialog.loading
                ? "Checking for linked quotes..."
                : cascadeDialog.type === "delete" && cascadeDialog.linkedQuotes.length > 0
                  ? `"${cascadeDialog.jobName}" has ${cascadeDialog.linkedQuotes.length} linked quote${cascadeDialog.linkedQuotes.length !== 1 ? "s" : ""}. Choose how to handle them.`
                  : cascadeDialog.type === "delete"
                    ? `Are you sure you want to delete "${cascadeDialog.jobName}"? This action cannot be undone.`
                    : ""}
            </DialogDescription>
          </DialogHeader>

          {cascadeDialog.type === "delete" && !cascadeDialog.loading && (
            <DialogFooter className="flex flex-col gap-2 sm:flex-col">
              {cascadeDialog.linkedQuotes.length > 0 ? (
                <>
                  <Button
                    onClick={() => deleteMutation.mutate({ id: cascadeDialog.jobId, quoteCascade: "archive" })}
                    disabled={isPending}
                    data-testid="button-delete-cascade-archive"
                  >
                    Delete estimate + archive linked quotes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => deleteMutation.mutate({ id: cascadeDialog.jobId, quoteCascade: "keep" })}
                    disabled={isPending}
                    data-testid="button-delete-cascade-keep"
                  >
                    Delete estimate only (keep quotes)
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => deleteMutation.mutate({ id: cascadeDialog.jobId, quoteCascade: "delete" })}
                    disabled={isPending}
                    data-testid="button-delete-cascade-delete"
                  >
                    Delete estimate + permanently delete linked quotes
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => deleteMutation.mutate({ id: cascadeDialog.jobId, quoteCascade: "keep" })}
                    disabled={isPending}
                    data-testid="button-delete-confirm"
                  >
                    Delete estimate
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setCascadeDialog({ type: "none" })}
                    data-testid="button-delete-cancel"
                  >
                    Cancel
                  </Button>
                </>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={cascadeDialog.type === "archive"}
        onOpenChange={(open) => { if (!open) setCascadeDialog({ type: "none" }); }}
      >
        <DialogContent data-testid="dialog-archive-estimate">
          <DialogHeader>
            <DialogTitle data-testid="text-archive-dialog-title">Archive Estimate</DialogTitle>
            <DialogDescription data-testid="text-archive-dialog-description">
              {cascadeDialog.type === "archive" && cascadeDialog.loading
                ? "Checking for linked quotes..."
                : cascadeDialog.type === "archive" && cascadeDialog.linkedQuotes.length > 0
                  ? `"${cascadeDialog.jobName}" has ${cascadeDialog.linkedQuotes.length} linked quote${cascadeDialog.linkedQuotes.length !== 1 ? "s" : ""}. Choose how to handle them.`
                  : ""}
            </DialogDescription>
          </DialogHeader>

          {cascadeDialog.type === "archive" && !cascadeDialog.loading && cascadeDialog.linkedQuotes.length > 0 && (
            <DialogFooter className="flex flex-col gap-2 sm:flex-col">
              <Button
                onClick={() => archiveMutation.mutate({ id: cascadeDialog.jobId, quoteCascade: "archive" })}
                disabled={isPending}
                data-testid="button-archive-cascade-archive"
              >
                Archive estimate + linked quotes
              </Button>
              <Button
                variant="outline"
                onClick={() => archiveMutation.mutate({ id: cascadeDialog.jobId, quoteCascade: "keep" })}
                disabled={isPending}
                data-testid="button-archive-cascade-keep"
              >
                Archive estimate only
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
