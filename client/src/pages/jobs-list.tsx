import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LayoutGrid, Plus, Trash2, FolderOpen, Archive, ArchiveRestore, ExternalLink, MapPin, Calendar, Square, FlaskConical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import type { Job, Quote } from "@shared/schema";

type JobWithCount = Job & { itemCount: number; totalSqm: number };

type CascadeDialogState =
  | { type: "none" }
  | { type: "delete"; jobId: string; jobName: string; linkedQuotes: Quote[]; loading: boolean }
  | { type: "archive"; jobId: string; jobName: string; linkedQuotes: Quote[]; loading: boolean };

export default function JobsList() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "owner" || user?.role === "admin";
  const [cascadeDialog, setCascadeDialog] = useState<CascadeDialogState>({ type: "none" });
  const [activeTab, setActiveTab] = useState("active");

  const demoFlagMutation = useMutation({
    mutationFn: async ({ id, isDemoRecord }: { id: string; isDemoRecord: boolean }) => {
      const res = await apiRequest("PATCH", `/api/jobs/${id}/demo-flag`, { isDemoRecord });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Demo flag updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const { data: activeJobs = [], isLoading: loadingActive } = useQuery<JobWithCount[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: archivedJobs = [], isLoading: loadingArchived } = useQuery<JobWithCount[]>({
    queryKey: ["/api/jobs", { scope: "archived" }],
    queryFn: async () => {
      const res = await fetch("/api/jobs?scope=archived", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load archived estimates");
      return res.json();
    },
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

  const unarchiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/jobs/${id}/unarchive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Estimate restored to active" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to unarchive estimate", description: error.message, variant: "destructive" });
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
        setCascadeDialog({ type: "none" });
        return;
      }
      setCascadeDialog({ type: "archive", jobId: job.id, jobName: job.name, linkedQuotes: quotes, loading: false });
    } catch {
      archiveMutation.mutate({ id: job.id, quoteCascade: "archive" });
      setCascadeDialog({ type: "none" });
    }
  }

  const isPending = deleteMutation.isPending || archiveMutation.isPending || unarchiveMutation.isPending;

  const jobs = activeTab === "archived" ? archivedJobs : activeJobs;
  const isLoading = activeTab === "archived" ? loadingArchived : loadingActive;

  return (
    <div className="flex flex-col h-full bg-background" data-testid="jobs-list">
      <header className="border-b px-4 sm:px-6 py-3 flex items-center justify-between gap-3 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary shrink-0">
            <LayoutGrid className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold tracking-tight" data-testid="text-app-title">Estimates</h1>
              <Badge variant="outline" className="text-xs" data-testid="badge-division-lj">LJ</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">Joinery quotation estimates</p>
          </div>
        </div>
        <Link href="/job/new">
          <Button size="sm" data-testid="button-new-job">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> New Estimate
          </Button>
        </Link>
      </header>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4" data-testid="tabs-estimates">
            <TabsTrigger value="active" data-testid="tab-estimates-active">
              Active {activeJobs.length > 0 && `(${activeJobs.length})`}
            </TabsTrigger>
            <TabsTrigger value="archived" data-testid="tab-estimates-archived">
              Archived {archivedJobs.length > 0 && `(${archivedJobs.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">Loading estimates…</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="rounded-lg border border-dashed p-12 text-center" data-testid="empty-jobs">
                <FolderOpen className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No estimates yet</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">Create your first estimate to get started.</p>
                <Link href="/job/new">
                  <Button size="sm" data-testid="button-create-first-job">
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Estimate
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="rounded-lg border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Address</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Date</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Items</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center hidden lg:table-cell">m²</TableHead>
                      <TableHead className="w-[180px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id} className="hover:bg-muted/30" data-testid={`row-job-${job.id}`}>
                        <TableCell className="font-medium text-sm py-2.5" data-testid={`text-job-name-${job.id}`}>
                          <div className="flex items-center gap-1.5">
                            {job.name}
                            {isAdmin && job.isDemoRecord && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 shrink-0" data-testid={`badge-demo-estimate-${job.id}`}>
                                <FlaskConical className="h-2.5 w-2.5 mr-0.5" />Demo
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground py-2.5 hidden md:table-cell">
                          {job.address ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 shrink-0" />{job.address}
                            </span>
                          ) : <span className="text-xs italic">—</span>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground py-2.5 hidden sm:table-cell">
                          {job.date ? (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 shrink-0" />{job.date}
                            </span>
                          ) : <span className="text-xs italic">—</span>}
                        </TableCell>
                        <TableCell className="text-center py-2.5">
                          <Badge variant="secondary" className="text-xs" data-testid={`badge-item-count-${job.id}`}>
                            {job.itemCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center py-2.5 hidden lg:table-cell">
                          {job.totalSqm > 0 ? (
                            <Badge variant="outline" className="text-xs font-mono" data-testid={`badge-sqm-${job.id}`}>
                              <Square className="w-2.5 h-2.5 mr-0.5" />{job.totalSqm}
                            </Badge>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-1 justify-end">
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-7 px-2 text-xs ${job.isDemoRecord ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}
                                onClick={() => demoFlagMutation.mutate({ id: job.id, isDemoRecord: !job.isDemoRecord })}
                                disabled={demoFlagMutation.isPending}
                                data-testid={`button-toggle-demo-estimate-${job.id}`}
                                title={job.isDemoRecord ? "Remove demo/test flag" : "Flag as demo/test"}
                              >
                                <FlaskConical className="w-3 h-3" />
                              </Button>
                            )}
                            <Link href={`/job/${job.id}`}>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" data-testid={`button-open-job-${job.id}`}>
                                <ExternalLink className="w-3 h-3 mr-1" /> Open
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-muted-foreground"
                              onClick={() => openArchiveDialog(job)}
                              disabled={isPending}
                              data-testid={`button-archive-job-${job.id}`}
                            >
                              <Archive className="w-3 h-3 mr-1" /> Archive
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                              onClick={() => openDeleteDialog(job)}
                              disabled={isPending}
                              data-testid={`button-delete-job-${job.id}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="archived">
            {loadingArchived ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">Loading archived estimates…</p>
              </div>
            ) : archivedJobs.length === 0 ? (
              <div className="rounded-lg border border-dashed p-12 text-center" data-testid="empty-archived-jobs">
                <Archive className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No archived estimates</p>
                <p className="text-xs text-muted-foreground mt-1">Archived estimates will appear here.</p>
              </div>
            ) : (
              <div className="rounded-lg border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Address</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Archived</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Items</TableHead>
                      <TableHead className="w-[160px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {archivedJobs.map((job) => (
                      <TableRow key={job.id} className="opacity-80 hover:opacity-100 hover:bg-muted/30" data-testid={`row-archived-job-${job.id}`}>
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm" data-testid={`text-archived-job-name-${job.id}`}>{job.name}</span>
                            <Badge variant="secondary" className="text-xs" data-testid={`badge-archived-${job.id}`}>Archived</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground py-2.5 hidden md:table-cell">
                          {job.address ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 shrink-0" />{job.address}
                            </span>
                          ) : <span className="text-xs italic">—</span>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground py-2.5 hidden sm:table-cell">
                          {job.archivedAt ? (
                            <span className="flex items-center gap-1 text-xs">
                              <Archive className="w-3 h-3" />
                              {new Date(job.archivedAt).toLocaleDateString("en-NZ")}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-center py-2.5">
                          <Badge variant="secondary" className="text-xs" data-testid={`badge-archived-item-count-${job.id}`}>
                            {job.itemCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => unarchiveMutation.mutate(job.id)}
                              disabled={isPending}
                              data-testid={`button-unarchive-job-${job.id}`}
                            >
                              <ArchiveRestore className="w-3 h-3 mr-1" /> Restore
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                              onClick={() => openDeleteDialog(job)}
                              disabled={isPending}
                              data-testid={`button-delete-archived-job-${job.id}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <p className="text-xs text-muted-foreground mt-3 text-right">
          {jobs.length} estimate{jobs.length !== 1 ? "s" : ""}
          {activeTab === "archived" ? " archived" : " active"}
        </p>
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
                    ? `Are you sure you want to permanently delete "${cascadeDialog.jobName}"? This action cannot be undone.`
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
                    Delete permanently
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
                  ? `"${cascadeDialog.jobName}" has ${cascadeDialog.linkedQuotes.length} linked quote${cascadeDialog.linkedQuotes.length !== 1 ? "s" : ""}. The estimate will be archived (not deleted) and can be restored later.`
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
                Archive estimate only (keep quotes active)
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
