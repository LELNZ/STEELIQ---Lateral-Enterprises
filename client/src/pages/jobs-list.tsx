import { useState } from "react";
import { PageShell, PageHeader, WorklistBody, useDemoToggle, DemoToggle } from "@/components/ui/platform-layout";
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
import { LayoutGrid, Plus, Trash2, FolderOpen, Archive, ArchiveRestore, ExternalLink, MapPin, Calendar, Square, FlaskConical, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { routes } from "@/lib/routes";
import type { Job, Quote } from "@shared/schema";

type LinkedQuoteSummary = { id: string; number: string; status: string; revisionCount: number };
type JobWithCount = Job & { itemCount: number; totalSqm: number; linkedQuotes?: LinkedQuoteSummary[] };

type EstimateStatus = "active" | "archived";

function deriveEstimateStatus(job: JobWithCount): EstimateStatus {
  if (job.archivedAt) return "archived";
  return "active";
}

const ESTIMATE_STATUS_STYLES: Record<EstimateStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-700" },
  archived: { label: "Archived", className: "bg-gray-100 text-gray-500 border-gray-300 dark:bg-gray-900/40 dark:text-gray-400 dark:border-gray-600" },
};

const QUOTE_STATUS_COLORS: Record<string, string> = {
  draft: "border-gray-300 text-gray-600 bg-gray-50 dark:bg-gray-900/30 dark:text-gray-400",
  review: "border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400",
  sent: "border-indigo-300 text-indigo-700 bg-indigo-50 dark:bg-indigo-950/30 dark:text-indigo-400",
  accepted: "border-green-300 text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-400",
  declined: "border-red-300 text-red-700 bg-red-50 dark:bg-red-950/30 dark:text-red-400",
  archived: "border-gray-300 text-gray-500 bg-gray-50 dark:bg-gray-900/30 dark:text-gray-500",
};

function QuoteSignalCell({ job }: { job: JobWithCount }) {
  const lq = job.linkedQuotes;
  if (!lq || lq.length === 0) {
    return <span className="text-xs text-muted-foreground italic">No quote</span>;
  }
  const primary = lq[0];
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${QUOTE_STATUS_COLORS[primary.status] || ""}`} data-testid={`badge-quote-status-${job.id}`}>
          {primary.status.charAt(0).toUpperCase() + primary.status.slice(1)}
        </Badge>
        {primary.revisionCount > 1 && (
          <span className="text-[10px] text-muted-foreground font-mono" data-testid={`text-revision-count-${job.id}`}>
            Rev {primary.revisionCount}
          </span>
        )}
      </div>
      <Link href={routes.quoteDetail(primary.id)}>
        <span className="text-[10px] text-primary hover:underline flex items-center gap-0.5 cursor-pointer" data-testid={`link-open-quote-${job.id}`}>
          <FileText className="w-2.5 h-2.5" />{primary.number}
        </span>
      </Link>
    </div>
  );
}

type CascadeDialogState =
  | { type: "none" }
  | { type: "delete"; jobId: string; jobName: string; linkedQuotes: Quote[]; loading: boolean }
  | { type: "archive"; jobId: string; jobName: string; linkedQuotes: Quote[]; loading: boolean };

export default function JobsList() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "owner" || user?.role === "admin";
  const { isAdmin: canToggleDemo, showDemo, queryParam, toggle: toggleDemo } = useDemoToggle();
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
    queryKey: ["/api/jobs", { showDemo }],
    queryFn: async () => {
      const res = await fetch(`/api/jobs${queryParam ? `?${queryParam}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load estimates");
      return res.json();
    },
  });

  const { data: archivedJobs = [], isLoading: loadingArchived } = useQuery<JobWithCount[]>({
    queryKey: ["/api/jobs", { scope: "archived", showDemo }],
    queryFn: async () => {
      const res = await fetch(`/api/jobs?scope=archived${queryParam ? `&${queryParam}` : ""}`, { credentials: "include" });
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
    <PageShell testId="jobs-list">
      <PageHeader
        icon={<LayoutGrid className="w-4 h-4 text-primary-foreground" />}
        title="Estimates"
        subtitle="Joinery quotation estimates"
        badge={<Badge variant="outline" className="text-xs" data-testid="badge-division-lj">LJ</Badge>}
        titleTestId="text-app-title"
        actions={
          <>
            {canToggleDemo && <DemoToggle showDemo={showDemo} onToggle={toggleDemo} />}
            <Link href={routes.jobNew()}>
              <Button size="sm" data-testid="button-new-job">
                <Plus className="w-3.5 h-3.5 mr-1.5" /> New Estimate
              </Button>
            </Link>
          </>
        }
      />
      <WorklistBody>
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
                <Link href={routes.jobNew()}>
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
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[110px]">Estimate #</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Address</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Date</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Items</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center hidden lg:table-cell">m²</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Status</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Quote</TableHead>
                      <TableHead className="w-[180px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job, idx) => {
                      const estStatus = deriveEstimateStatus(job);
                      const estStyle = ESTIMATE_STATUS_STYLES[estStatus];
                      const estDisplayNum = `LJ-EST-${String(activeJobs.length - idx).padStart(4, "0")}`;
                      return (
                      <TableRow key={job.id} className="hover:bg-muted/30" data-testid={`row-job-${job.id}`}>
                        <TableCell className="py-2.5">
                          <span className="text-xs font-mono text-muted-foreground" data-testid={`text-estimate-number-${job.id}`}>{estDisplayNum}</span>
                        </TableCell>
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
                        <TableCell className="py-2.5 hidden sm:table-cell" data-testid={`cell-estimate-status-${job.id}`}>
                          <Badge variant="outline" className={`text-[11px] px-2 py-0.5 font-medium ${estStyle.className}`} data-testid={`badge-estimate-status-${job.id}`}>
                            {estStyle.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2.5 hidden md:table-cell" data-testid={`cell-quote-status-${job.id}`}>
                          <QuoteSignalCell job={job} />
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
                            <Link href={routes.jobDetail(job.id)}>
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
                      );
                    })}
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
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[110px]">Estimate #</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Address</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Archived</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Items</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Status</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Quote</TableHead>
                      <TableHead className="w-[160px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {archivedJobs.map((job, idx) => {
                      const estStyle = ESTIMATE_STATUS_STYLES["archived"];
                      const archDisplayNum = `LJ-EST-A${String(archivedJobs.length - idx).padStart(4, "0")}`;
                      return (
                      <TableRow key={job.id} className="opacity-80 hover:opacity-100 hover:bg-muted/30" data-testid={`row-archived-job-${job.id}`}>
                        <TableCell className="py-2.5">
                          <span className="text-xs font-mono text-muted-foreground" data-testid={`text-archived-estimate-number-${job.id}`}>{archDisplayNum}</span>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <span className="font-medium text-sm" data-testid={`text-archived-job-name-${job.id}`}>{job.name}</span>
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
                        <TableCell className="py-2.5 hidden sm:table-cell" data-testid={`cell-archived-estimate-status-${job.id}`}>
                          <Badge variant="outline" className={`text-[11px] px-2 py-0.5 font-medium ${estStyle.className}`} data-testid={`badge-archived-estimate-status-${job.id}`}>
                            {estStyle.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2.5 hidden md:table-cell" data-testid={`cell-archived-quote-status-${job.id}`}>
                          <QuoteSignalCell job={job} />
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
                      );
                    })}
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
      </WorklistBody>

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
    </PageShell>
  );
}
