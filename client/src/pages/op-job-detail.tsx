import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type OpJob, type Customer, type Project, type Quote, type QuoteRevision, OP_JOB_STATUSES } from "@shared/schema";
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
  ArrowLeftCircle, HardHat, Building2, FolderOpen, FileText, CheckCircle2, Calendar, Pencil,
} from "lucide-react";

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

  function startEdit() {
    if (!job) return;
    setEditTitle(job.title);
    setEditStatus(job.status);
    setEditNotes(job.notes ?? "");
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
          <Button variant="ghost" size="icon" onClick={() => navigate("/op-jobs")} data-testid="button-back-to-jobs">
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
        <Button variant="outline" size="sm" onClick={startEdit} data-testid="button-edit-job">
          <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
        </Button>
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
          <div className="flex gap-2">
            <Button size="sm" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} data-testid="button-save-job">
              {updateMutation.isPending ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      )}

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
                <p className="font-medium text-sm" data-testid="text-detail-project">{project.name}</p>
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
              <div>
                <button
                  className="font-mono text-sm text-primary hover:underline"
                  onClick={() => navigate(`/quote/${sourceQuote.id}`)}
                  data-testid="link-source-quote"
                >
                  {sourceQuote.number}
                </button>
                <p className="text-xs text-muted-foreground">{sourceQuote.customer}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">—</p>
            )}
          </div>
        </div>
      </div>

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
    </div>
  );
}
