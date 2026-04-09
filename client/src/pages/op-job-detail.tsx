import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { routes } from "@/lib/routes";
import { LLLifecycleStripFromJob } from "@/components/ll-lifecycle-strip";
import { type OpJob, type Customer, type Project, type Quote, type QuoteRevision, type Invoice, type Variation, OP_JOB_STATUSES, MEASUREMENT_REQUIREMENTS, DIMENSION_SOURCES } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeftCircle, HardHat, Building2, FolderOpen, FileText, CheckCircle2, Calendar, Pencil, XCircle, Archive, RotateCcw, AlertTriangle, ReceiptText, ExternalLink, Ruler, GitBranch,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import LifecyclePanel from "@/components/lifecycle-panel";

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  on_hold: "secondary",
  completed: "outline",
  cancelled: "destructive",
};

interface QuoteWithRevisions extends Quote {
  revisions?: QuoteRevision[];
}

export default function OpJobDetail() {
  const [, params] = useRoute("/op-jobs/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const jobId = params?.id;
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editStatus, setEditStatus] = useState<string>("active");
  const [editNotes, setEditNotes] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [editMeasurementReq, setEditMeasurementReq] = useState<string>("__none__");
  const [editDimensionSource, setEditDimensionSource] = useState<string>("__none__");
  const { user } = useAuth();
  const showDemoTools = user?.role === "owner" || user?.role === "admin";

  const { data: job, isLoading } = useQuery<OpJob>({
    queryKey: ["/api/op-jobs", jobId],
    enabled: !!jobId,
  });

  const { data: customers = [] } = useQuery<Customer[]>({ queryKey: ["/api/customers"] });
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["/api/projects"] });

  const { data: sourceQuote } = useQuery<QuoteWithRevisions>({
    queryKey: ["/api/quotes", job?.sourceQuoteId],
    enabled: !!job?.sourceQuoteId,
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/quotes", job?.sourceQuoteId, "invoices"],
    queryFn: async () => {
      const res = await fetch(`/api/quotes/${job?.sourceQuoteId}/invoices`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!job?.sourceQuoteId,
  });

  const { data: jobVariations = [] } = useQuery<Variation[]>({
    queryKey: ["/api/jobs", jobId, "variations"],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}/variations`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!jobId,
  });

  const customer = customers.find((c) => c.id === job?.customerId);
  const project = projects.find((p) => p.id === job?.projectId);
  const acceptedRevision = sourceQuote?.revisions?.find((r) => r.id === job?.acceptedRevisionId);
  const acceptedSnap = acceptedRevision?.snapshotJson as any;

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/op-jobs/${jobId}`, {
        title: editTitle,
        status: editStatus,
        notes: editNotes || null,
        measurementRequirement: editMeasurementReq === "__none__" ? null : editMeasurementReq,
        dimensionSource: editDimensionSource === "__none__" ? null : editDimensionSource,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Update failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/op-jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/op-jobs"] });
      toast({ title: "Job updated" });
      setEditing(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/op-jobs/${jobId}`, { status: "cancelled" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Cancel failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/op-jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/op-jobs"] });
      toast({ title: "Job cancelled" });
      setCancelDialogOpen(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/op-jobs/${jobId}/archive`, {});
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Archive failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/op-jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/op-jobs"] });
      toast({ title: "Job archived" });
      setArchiveDialogOpen(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unarchiveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/op-jobs/${jobId}/unarchive`, {});
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Unarchive failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/op-jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/op-jobs"] });
      toast({ title: "Job restored to active list" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const demoFlagMutation = useMutation({
    mutationFn: async (isDemoRecord: boolean) => {
      const res = await apiRequest("PATCH", `/api/op-jobs/${jobId}/demo-flag`, { isDemoRecord });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/op-jobs", jobId] });
      toast({ title: "Demo flag updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function startEdit() {
    if (!job) return;
    setEditTitle(job.title);
    setEditStatus(job.status);
    setEditNotes(job.notes ?? "");
    setEditMeasurementReq(job.measurementRequirement ?? "__none__");
    setEditDimensionSource(job.dimensionSource ?? "__none__");
    setEditing(true);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Job not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6" data-testid="op-job-detail-page">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(routes.opJobList())} data-testid="button-back-to-jobs">
            <ArrowLeftCircle className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <HardHat className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-xl font-bold font-mono" data-testid="text-job-number">{job.jobNumber}</h1>
              <Badge variant={STATUS_VARIANTS[job.status] ?? "outline"} data-testid="badge-job-status">
                {STATUS_LABELS[job.status] ?? job.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5" data-testid="text-job-title">{job.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!job.archivedAt && job.status !== "cancelled" && job.status !== "completed" && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setCancelDialogOpen(true)}
              disabled={cancelMutation.isPending}
              data-testid="button-cancel-job"
            >
              <XCircle className="h-3.5 w-3.5 mr-1.5" /> Cancel Job
            </Button>
          )}
          {!job.archivedAt && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setArchiveDialogOpen(true)}
              disabled={archiveMutation.isPending}
              data-testid="button-archive-job"
            >
              <Archive className="h-3.5 w-3.5 mr-1.5" /> Archive
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={startEdit} data-testid="button-edit-job">
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
        </div>
      </div>

      {editing && (
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <h3 className="text-sm font-semibold">Edit Job</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Title</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} data-testid="input-edit-job-title" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger data-testid="select-edit-job-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OP_JOB_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s] ?? s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={3}
              placeholder="Internal notes for this job…"
              data-testid="textarea-edit-job-notes"
            />
          </div>
          <div className="border-t pt-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Measurement & Dimensions</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Measurement Requirement</Label>
                <Select value={editMeasurementReq} onValueChange={setEditMeasurementReq}>
                  <SelectTrigger className="h-8 text-sm" data-testid="select-edit-measurement-req"><SelectValue placeholder="Not set" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Not set —</SelectItem>
                    <SelectItem value="pre_quote">Pre-quote measure</SelectItem>
                    <SelectItem value="post_acceptance">Post-acceptance measure</SelectItem>
                    <SelectItem value="not_required">Not required</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Dimension Source</Label>
                <Select value={editDimensionSource} onValueChange={setEditDimensionSource}>
                  <SelectTrigger className="h-8 text-sm" data-testid="select-edit-dimension-source"><SelectValue placeholder="Not set" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Not set —</SelectItem>
                    <SelectItem value="site_measure">Site measure</SelectItem>
                    <SelectItem value="confirmed_drawings">Confirmed drawings</SelectItem>
                    <SelectItem value="client_supplied">Client-supplied</SelectItem>
                    <SelectItem value="engineer_drawings">Engineer drawings</SelectItem>
                    <SelectItem value="architectural_drawings">Architectural drawings</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} data-testid="button-save-job">
              {updateMutation.isPending ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-card p-4 flex items-center gap-4" data-testid="card-job-status">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-1">Current Status</p>
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANTS[job.status] ?? "outline"} className="text-sm px-3 py-1" data-testid="badge-job-status-detail">
              {STATUS_LABELS[job.status] ?? job.status}
            </Badge>
            {job.notes && (
              <p className="text-xs text-muted-foreground truncate" data-testid="text-job-notes-summary">{job.notes}</p>
            )}
          </div>
        </div>
        
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-3 space-y-1">
          <p className="text-xs text-muted-foreground">Division</p>
          <p className="font-mono font-medium text-sm" data-testid="text-detail-division">{job.divisionId ?? "—"}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 space-y-1">
          <p className="text-xs text-muted-foreground">Converted</p>
          <p className="text-sm" data-testid="text-detail-converted-at">
            {job.convertedAt ? new Date(job.convertedAt).toLocaleDateString("en-NZ") : "—"}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3 space-y-1">
          <p className="text-xs text-muted-foreground">Accepted Value</p>
          <p className="text-sm font-medium" data-testid="text-detail-accepted-value">
            {acceptedSnap?.totals?.sell != null
              ? `$${Number(acceptedSnap.totals.sell).toLocaleString("en-NZ", { minimumFractionDigits: 2 })}`
              : "—"}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3 space-y-1">
          <p className="text-xs text-muted-foreground">Revision</p>
          <p className="text-sm font-mono" data-testid="text-detail-revision">
            {acceptedRevision ? `v${acceptedRevision.versionNumber}` : "—"}
          </p>
        </div>
      </div>

      {job.archivedAt && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 px-4 py-3" data-testid="banner-archived-job">
          <Archive className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="space-y-1 flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">This job is archived</p>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Archived on {new Date(job.archivedAt).toLocaleDateString("en-NZ")}. The job is hidden from the active list.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-1 h-7 text-xs border-amber-400"
              onClick={() => unarchiveMutation.mutate()}
              disabled={unarchiveMutation.isPending}
              data-testid="button-unarchive-job-inline"
            >
              <RotateCcw className="h-3 w-3 mr-1.5" />
              Restore to Active List
            </Button>
          </div>
        </div>
      )}

      <Separator />

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Source Relationships</h2>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" /> Customer
            </div>
            {customer ? (
              <div>
                <p className="font-medium text-sm" data-testid="text-detail-customer">{customer.name}</p>
                {customer.email && <p className="text-xs text-muted-foreground">{customer.email}</p>}
                {customer.phone && <p className="text-xs text-muted-foreground">{customer.phone}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Not linked</p>
            )}
          </div>

          <div className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FolderOpen className="h-3.5 w-3.5" /> Project
            </div>
            {project ? (
              <div>
                <button
                  className="font-medium text-sm text-primary hover:underline text-left"
                  onClick={() => navigate(routes.projectDetail(project.id))}
                  data-testid="link-detail-project"
                >
                  {project.name}
                </button>
                {project.address && <p className="text-xs text-muted-foreground">{project.address}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Not linked</p>
            )}
          </div>

          <div className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" /> Source Quote
            </div>
            {sourceQuote ? (
              <div className="space-y-1">
                <button
                  className="font-mono text-sm text-primary hover:underline"
                  onClick={() => navigate(routes.quoteDetail(sourceQuote.id))}
                  data-testid="link-source-quote"
                >
                  {sourceQuote.number}
                </button>
                {sourceQuote.acceptedValue != null && (
                  <p className="text-xs font-semibold" data-testid="text-source-quote-accepted-value">
                    ${sourceQuote.acceptedValue.toLocaleString("en-NZ", { minimumFractionDigits: 2 })} excl. GST
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Status: Accepted</p>
                <button
                  className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                  onClick={() => navigate(routes.quoteDetail(sourceQuote.id))}
                  data-testid="link-manage-billing"
                >
                  <ReceiptText className="h-3 w-3" /> Manage billing →
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">—</p>
            )}
          </div>
        </div>
      </div>

      <Separator />

      <div className={[
        "space-y-3 rounded-lg border-2 p-4",
        (!job.measurementRequirement || !job.dimensionSource) && job.measurementRequirement !== "not_required" && !job.archivedAt
          ? "border-amber-400 dark:border-amber-600 bg-amber-50/30 dark:bg-amber-950/20"
          : "border-transparent bg-transparent"
      ].join(" ")} data-testid="section-measurement-job">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ruler className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Measurement & Dimensions</h2>
            {(!job.measurementRequirement || !job.dimensionSource) && job.measurementRequirement !== "not_required" && !job.archivedAt && (
              <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">ACTION REQUIRED</span>
            )}
          </div>
          {!editing && !job.archivedAt && job.status !== "cancelled" && (
            <Button
              variant={(!job.measurementRequirement || !job.dimensionSource) && job.measurementRequirement !== "not_required" ? "default" : "ghost"}
              size="sm"
              className={(!job.measurementRequirement || !job.dimensionSource) && job.measurementRequirement !== "not_required" ? "h-7 text-xs" : "h-7 text-xs text-muted-foreground"}
              onClick={startEdit}
              data-testid="button-edit-measurement"
            >
              {(!job.measurementRequirement || !job.dimensionSource) && job.measurementRequirement !== "not_required" ? "Set Measurement" : "Edit"}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          These fields drive lifecycle tracking and production readiness. Set them before progressing to the Survey/Measure stage.
        </p>

        {/* Readiness guard — fires when measurement is required but fields are incomplete */}
        {job.measurementRequirement !== "not_required" && (!job.measurementRequirement || !job.dimensionSource) && !job.archivedAt && (
          <div className="flex items-start gap-2.5 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5" data-testid="banner-md-readiness-guard">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">Measurement readiness incomplete</p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {!job.measurementRequirement && !job.dimensionSource
                  ? "Both Measurement Requirement and Dimension Source must be set before the Survey/Measure stage can progress."
                  : !job.measurementRequirement
                  ? "Measurement Requirement must be set to indicate whether a site visit is needed before production."
                  : "Dimension Source must be set once dimensions are confirmed — this is required before production can begin."}
              </p>
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                Use the <span className="font-medium">Edit</span> button above to complete these fields before progressing the lifecycle.
              </p>
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-lg border bg-card p-3 space-y-1">
            <p className="text-xs text-muted-foreground">Measurement Requirement</p>
            <p className="text-sm font-medium" data-testid="text-measurement-req">
              {job.measurementRequirement === "pre_quote" && "Pre-quote measure"}
              {job.measurementRequirement === "post_acceptance" && "Post-acceptance measure"}
              {job.measurementRequirement === "not_required" && (
                <span className="text-emerald-700 dark:text-emerald-400">Not required</span>
              )}
              {!job.measurementRequirement && <span className="text-muted-foreground italic">Not set</span>}
            </p>
            <p className="text-[11px] text-muted-foreground/60 italic">
              {job.measurementRequirement === "pre_quote" && "Measure was needed before quoting. Confirm dimensions are captured."}
              {job.measurementRequirement === "post_acceptance" && "A site measure is required after acceptance. Schedule and complete before production begins."}
              {job.measurementRequirement === "not_required" && "No physical measure required — dimensions confirmed from drawings or client-supplied data."}
              {!job.measurementRequirement && "Set this to indicate whether a physical site visit is required before production."}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-3 space-y-1">
            <p className="text-xs text-muted-foreground">Dimension Source</p>
            <p className="text-sm font-medium capitalize" data-testid="text-dimension-source">
              {job.dimensionSource
                ? job.dimensionSource.replace(/_/g, " ")
                : <span className="text-muted-foreground italic">Not set</span>}
            </p>
            <p className="text-[11px] text-muted-foreground/60 italic">
              {job.dimensionSource === "site_measure" && "Dimensions taken from a physical site visit. Most accurate."}
              {job.dimensionSource === "confirmed_drawings" && "Dimensions from signed-off architectural or engineering drawings."}
              {job.dimensionSource === "client_supplied" && "Dimensions provided by the client. Confirm accuracy before production."}
              {job.dimensionSource === "engineer_drawings" && "Dimensions from structural or engineering specifications."}
              {job.dimensionSource === "architectural_drawings" && "Dimensions from architectural plans. Verify against site if possible."}
              {job.dimensionSource === "other" && "Non-standard dimension source. Document in job notes for traceability."}
              {!job.dimensionSource && "Set this once dimensions are confirmed to record their origin for production traceability."}
            </p>
          </div>
        </div>
      </div>

      {job.divisionId === "LL" && (
        <>
          <Separator />
          <LLLifecycleStripFromJob
            jobId={jobId}
            sourceQuoteId={job.sourceQuoteId}
            customerId={job.customerId}
            projectId={job.projectId}
          />
        </>
      )}

      <Separator />

      <div data-testid="section-lifecycle-job" className="rounded-lg border bg-card p-4 space-y-3">
        {job.measurementRequirement !== "not_required" && (!job.measurementRequirement || !job.dimensionSource) && !job.archivedAt && (
          <div className="flex items-start gap-2 rounded border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 px-2.5 py-2" data-testid="banner-lifecycle-md-reminder">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              <span className="font-semibold">Measurement readiness incomplete.</span>{" "}
              Complete the Measurement &amp; Dimensions fields above before progressing the Survey/Measure lifecycle stage.
            </p>
          </div>
        )}
        <LifecyclePanel jobId={jobId} />
      </div>

      <Separator />

      <div className="space-y-3" data-testid="section-invoices-job">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Invoices</h2>
            {invoices.length > 0 && (
              <span className="text-xs text-muted-foreground">({invoices.length})</span>
            )}
          </div>
          {job?.sourceQuoteId && (
            <button
              className="flex items-center gap-1 text-xs text-primary hover:underline"
              onClick={() => navigate(routes.quoteDetail(job.sourceQuoteId!))}
              data-testid="link-manage-invoices"
            >
              Manage in quote <ExternalLink className="h-3 w-3" />
            </button>
          )}
        </div>

        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No invoices yet for this job's source quote.</p>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Number</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Incl. GST</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const INVOICE_STATUS_LABELS: Record<string, string> = {
                    draft: "Draft", ready_for_xero: "Ready for Xero",
                    pushed_to_xero_draft: "Pushed to Xero", approved: "Approved",
                    returned_to_draft: "Returned to Draft",
                  };
                  const INVOICE_TYPE_LABELS: Record<string, string> = {
                    deposit: "Deposit", progress: "Progress", variation: "Variation",
                    final: "Final", retention_release: "Retention Release", credit_note: "Credit Note",
                  };
                  const statusColor: Record<string, string> = {
                    draft: "secondary", ready_for_xero: "outline",
                    pushed_to_xero_draft: "secondary", approved: "default", returned_to_draft: "destructive",
                  };
                  return (
                    <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/20" data-testid={`row-job-invoice-${inv.id}`}>
                      <td className="px-3 py-2 font-mono font-medium" data-testid={`text-job-invoice-number-${inv.id}`}>{inv.number}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          inv.type === "deposit" ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" :
                          inv.type === "progress" ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" :
                          inv.type === "variation" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" :
                          inv.type === "final" ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" :
                          inv.type === "retention_release" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" :
                          inv.type === "credit_note" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" :
                          "bg-muted text-muted-foreground"
                        }`} data-testid={`badge-job-invoice-type-${inv.id}`}>
                          {INVOICE_TYPE_LABELS[inv.type] || inv.type}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={(statusColor[inv.status] || "secondary") as any} className="text-xs" data-testid={`badge-job-invoice-status-${inv.id}`}>
                          {INVOICE_STATUS_LABELS[inv.status] || inv.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right font-medium" data-testid={`text-job-invoice-amount-${inv.id}`}>
                        ${(inv.amountInclGst ?? 0).toLocaleString("en-NZ", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {jobVariations.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3" data-testid="section-linked-variations">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Linked Variations</h2>
              <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">{jobVariations.length}</span>
            </div>
            <div className="rounded-lg border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Title</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Amount (excl. GST)</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {jobVariations.map((v) => (
                    <tr key={v.id} data-testid={`row-job-variation-${v.id}`}>
                      <td className="px-3 py-2 font-medium">{v.title}</td>
                      <td className="px-3 py-2">
                        <Badge variant={
                          v.status === "approved" ? "default"
                          : v.status === "partially_invoiced" || v.status === "fully_invoiced" ? "outline"
                          : v.status === "declined" ? "destructive"
                          : "secondary"
                        } className="text-xs" data-testid={`badge-job-variation-status-${v.id}`}>
                          {v.status === "partially_invoiced" ? "Part. Invoiced"
                            : v.status === "fully_invoiced" ? "Fully Invoiced"
                            : v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        ${(v.amountExclGst ?? 0).toLocaleString("en-NZ", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[200px]">{v.reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">These variations are linked to this job. Manage them from the project detail page.</p>
          </div>
        </>
      )}

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Accepted Revision Snapshot</h2>
        </div>
        {acceptedRevision ? (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Revision</p>
                <p className="font-mono font-medium">v{acceptedRevision.versionNumber}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Items</p>
                <p className="font-medium">
                  {(acceptedSnap?.items?.length ?? 0)} item{(acceptedSnap?.items?.length ?? 0) !== 1 ? "s" : ""}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sale Total</p>
                <p className="font-medium">
                  {acceptedSnap?.totals?.sell != null
                    ? `$${Number(acceptedSnap.totals.sell).toLocaleString("en-NZ", { minimumFractionDigits: 2 })}`
                    : "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Revision created: {acceptedRevision.createdAt
                ? new Date(acceptedRevision.createdAt).toLocaleDateString("en-NZ")
                : "—"}
            </div>
            <p className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded px-3 py-2">
              This snapshot is derived from the accepted revision and is read-only. The accepted quote history has not been modified.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Revision data not available.</p>
        )}
      </div>

      {job.notes && (
        <>
          <Separator />
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Notes</h2>
            <p className="text-sm whitespace-pre-wrap" data-testid="text-detail-notes">{job.notes}</p>
          </div>
        </>
      )}

      {(user?.role === "admin" || user?.role === "owner") && showDemoTools && (
        <>
          <Separator />
          <div className="rounded-lg border border-dashed p-4 space-y-2" data-testid="section-admin-demo-flag-job">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Admin: Demo / Test Record</p>
            <p className="text-xs text-muted-foreground">Flag this job as a demo/test record so it can be bulk-archived from the Governance panel. <strong>Record-level only</strong> — does not automatically propagate to the linked quote, project, estimates, or invoices. Use the Governance panel in Settings to manage chain-level classification.</p>
            <div className="flex items-center gap-3">
              <Button
                variant={job.isDemoRecord ? "secondary" : "outline"}
                size="sm"
                onClick={() => demoFlagMutation.mutate(!job.isDemoRecord)}
                disabled={demoFlagMutation.isPending}
                data-testid="button-toggle-demo-flag-job"
              >
                {job.isDemoRecord ? "✓ Flagged as Demo/Test" : "Mark as Demo/Test"}
              </Button>
              {job.isDemoRecord && (
                <span className="text-xs text-muted-foreground">This record will be archived by the next demo cleanup.</span>
              )}
            </div>
          </div>
        </>
      )}

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent data-testid="dialog-confirm-cancel-job">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {job.jobNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This marks the job as cancelled. The source quote and its history are not affected. The job can be re-activated by editing the status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-cancel-job">Back</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelMutation.mutate()}
              data-testid="button-confirm-cancel-job"
            >
              Cancel Job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent data-testid="dialog-confirm-archive-job">
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {job.jobNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This hides the job from the active list and moves it to the Archived tab. The job can be restored at any time. Its status and linked quote are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => archiveMutation.mutate()}
              disabled={archiveMutation.isPending}
              data-testid="button-confirm-archive-job"
            >
              Archive Job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
