import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Project, Customer, Quote, OpJob, Invoice, Variation } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  FolderOpen, Building2, MapPin, FileText, HardHat, ReceiptText, GitBranch,
  ArrowLeftCircle, ChevronDown, ChevronUp, ExternalLink, Pencil, Check, X, Plus,
  Briefcase, Link2, AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";

const VARIATION_STATUS_LABELS: Record<string, string> = {
  draft: "Draft", sent: "Sent", approved: "Approved",
  declined: "Declined", partially_invoiced: "Part. Invoiced", fully_invoiced: "Fully Invoiced",
};
const VARIATION_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  approved: "default", partially_invoiced: "outline", fully_invoiced: "outline",
  declined: "destructive", sent: "secondary", draft: "secondary",
};
const GST_RATE = 0.15;

const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft", review: "In Review", sent: "Sent",
  accepted: "Accepted", declined: "Declined", archived: "Archived", cancelled: "Cancelled",
};
const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft", ready_for_xero: "Ready for Xero", pushed_to_xero_draft: "Pushed to Xero",
  approved: "Approved", returned_to_draft: "Returned to Draft",
};
const INVOICE_TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit", progress: "Progress", variation: "Variation",
  final: "Final", retention_release: "Retention", credit_note: "Credit Note",
};

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (["accepted", "approved", "active"].includes(status)) return "default";
  if (["declined", "cancelled", "returned_to_draft"].includes(status)) return "destructive";
  if (["sent", "ready_for_xero", "pushed_to_xero_draft"].includes(status)) return "outline";
  return "secondary";
}

function fmt(n: number) {
  return n.toLocaleString("en-NZ", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtMoney(n: number) {
  return `$${n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function CollapsibleSection({
  title, icon, count, children, defaultOpen = true,
  "data-testid": testId,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  "data-testid"?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border bg-card" data-testid={testId}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold">{title}</span>
          <Badge variant="secondary" className="text-xs">{count}</Badge>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="border-t">{children}</div>}
    </div>
  );
}

// ─── Variations Section ────────────────────────────────────────────────────────
function VariationsSection({ projectId, acceptedQuoteId }: { projectId: string; acceptedQuoteId?: string }) {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [linkJobOpen, setLinkJobOpen] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", reason: "", amountExclGst: "", jobId: "" });
  const [linkJobId, setLinkJobId] = useState("");

  const { data: variations = [], isLoading } = useQuery<Variation[]>({
    queryKey: ["/api/projects", projectId, "variations"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/variations`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: projectJobs = [] } = useQuery<OpJob[]>({
    queryKey: ["/api/projects", projectId, "jobs"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/jobs`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId,
  });

  type AllocData = { variationInvoicedByVariationId: Record<string, number> };
  const { data: allocData } = useQuery<AllocData>({
    queryKey: ["/api/quotes", acceptedQuoteId, "invoice-allocation"],
    queryFn: async () => {
      const res = await fetch(`/api/quotes/${acceptedQuoteId}/invoice-allocation`);
      if (!res.ok) return { variationInvoicedByVariationId: {} };
      return res.json();
    },
    enabled: !!acceptedQuoteId,
  });
  const invoicedMap = allocData?.variationInvoicedByVariationId ?? {};
  const jobMap = Object.fromEntries(projectJobs.map((j) => [j.id, j]));

  const createMutation = useMutation({
    mutationFn: async () => {
      const amountExcl = parseFloat(form.amountExclGst);
      if (!form.title.trim() || isNaN(amountExcl) || amountExcl <= 0) throw new Error("Invalid fields");
      const gst = Math.round(amountExcl * GST_RATE * 100) / 100;
      const res = await apiRequest("POST", "/api/variations", {
        projectId,
        quoteId: acceptedQuoteId ?? null,
        jobId: form.jobId || null,
        title: form.title.trim(),
        reason: form.reason.trim() || null,
        amountExclGst: amountExcl,
        gstAmount: gst,
        amountInclGst: Math.round((amountExcl + gst) * 100) / 100,
        status: "draft",
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "variations"] });
      setAddOpen(false);
      setForm({ title: "", reason: "", amountExclGst: "", jobId: "" });
      toast({ title: "Variation created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const patchMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/variations/${id}`, data);
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "variations"] });
      if (acceptedQuoteId) queryClient.invalidateQueries({ queryKey: ["/api/quotes", acceptedQuoteId, "invoice-allocation"] });
      toast({ title: "Variation updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <CollapsibleSection
      title="Variations"
      icon={<GitBranch className="h-4 w-4 text-muted-foreground" />}
      count={variations.length}
      defaultOpen={variations.length > 0}
      data-testid="section-variations"
    >
      <div className="p-4 space-y-3">
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} data-testid="button-add-variation">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Variation
          </Button>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
        ) : variations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No variations yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Approved (excl.)</TableHead>
                  <TableHead className="text-right">Invoiced (excl.)</TableHead>
                  <TableHead className="text-right">Remaining (excl.)</TableHead>
                  <TableHead>Linked Job</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {variations.map((v) => {
                  const invoiced = invoicedMap[v.id] ?? 0;
                  const remaining = Math.max(0, (v.amountExclGst ?? 0) - invoiced);
                  const isInvoiceable = ["approved", "partially_invoiced"].includes(v.status);
                  const linkedJob = v.jobId ? jobMap[v.jobId] : null;
                  return (
                    <TableRow key={v.id} data-testid={`row-variation-${v.id}`}>
                      <TableCell className="text-sm">
                        <div className="font-medium">{v.title}</div>
                        {v.reason && <div className="text-xs text-muted-foreground truncate max-w-[160px]">{v.reason}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={VARIATION_STATUS_VARIANT[v.status] ?? "secondary"} className="text-xs" data-testid={`badge-variation-status-${v.id}`}>
                          {VARIATION_STATUS_LABELS[v.status] ?? v.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{v.amountExclGst != null ? fmtMoney(v.amountExclGst) : "—"}</TableCell>
                      <TableCell className="text-right font-mono text-sm" data-testid={`text-variation-invoiced-${v.id}`}>
                        {["approved", "partially_invoiced", "fully_invoiced"].includes(v.status) && acceptedQuoteId ? fmtMoney(invoiced) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm" data-testid={`text-variation-remaining-${v.id}`}>
                        {isInvoiceable && acceptedQuoteId
                          ? <span className={remaining <= 0.005 ? "text-muted-foreground" : "text-green-600 dark:text-green-400 font-semibold"}>{fmtMoney(remaining)}</span>
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm" data-testid={`cell-variation-job-${v.id}`}>
                        {linkedJob ? (
                          <Link href={`/op-jobs/${linkedJob.id}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                            <Briefcase className="h-3 w-3" />{linkedJob.jobNumber}
                          </Link>
                        ) : (
                          <button
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                            onClick={() => { setLinkJobOpen(v.id); setLinkJobId(""); }}
                            data-testid={`button-link-job-${v.id}`}
                          >
                            <Link2 className="h-3 w-3" /> Link job
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          {v.status === "draft" && (
                            <>
                              <Button size="sm" variant="outline" className="h-7 text-xs"
                                onClick={() => patchMutation.mutate({ id: v.id, data: { status: "sent" } })}
                                disabled={patchMutation.isPending}
                                data-testid={`button-send-variation-${v.id}`}>
                                Mark Sent
                              </Button>
                              <Button size="sm" variant="default" className="h-7 text-xs"
                                onClick={() => patchMutation.mutate({ id: v.id, data: { status: "approved" } })}
                                disabled={patchMutation.isPending}
                                data-testid={`button-approve-variation-${v.id}`}>
                                <Check className="h-3 w-3 mr-1" /> Approve
                              </Button>
                              <Button size="sm" variant="destructive" className="h-7 text-xs"
                                onClick={() => patchMutation.mutate({ id: v.id, data: { status: "declined" } })}
                                disabled={patchMutation.isPending}
                                data-testid={`button-decline-variation-${v.id}`}>
                                <X className="h-3 w-3 mr-1" /> Decline
                              </Button>
                            </>
                          )}
                          {v.status === "sent" && (
                            <>
                              <Button size="sm" variant="default" className="h-7 text-xs"
                                onClick={() => patchMutation.mutate({ id: v.id, data: { status: "approved" } })}
                                disabled={patchMutation.isPending}
                                data-testid={`button-approve-variation-${v.id}`}>
                                <Check className="h-3 w-3 mr-1" /> Approve
                              </Button>
                              <Button size="sm" variant="destructive" className="h-7 text-xs"
                                onClick={() => patchMutation.mutate({ id: v.id, data: { status: "declined" } })}
                                disabled={patchMutation.isPending}
                                data-testid={`button-decline-variation-${v.id}`}>
                                <X className="h-3 w-3 mr-1" /> Decline
                              </Button>
                            </>
                          )}
                          {isInvoiceable && acceptedQuoteId && remaining > 0.005 && (
                            <Link href={`/quotes/${acceptedQuoteId}`}>
                              <Button size="sm" variant="outline" className="h-7 text-xs"
                                data-testid={`button-invoice-variation-${v.id}`}>
                                <ReceiptText className="h-3 w-3 mr-1" /> Invoice
                              </Button>
                            </Link>
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

      {/* Add Variation Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Variation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Additional sliding door" data-testid="input-variation-title" />
            </div>
            <div>
              <Label>Reason <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Brief description of what changed and why" rows={3} data-testid="input-variation-reason" />
            </div>
            <div>
              <Label>Amount excl. GST <span className="text-destructive">*</span></Label>
              <Input type="number" min="0" step="0.01" value={form.amountExclGst}
                onChange={(e) => setForm((f) => ({ ...f, amountExclGst: e.target.value }))}
                placeholder="0.00" data-testid="input-variation-amount" />
              {form.amountExclGst && !isNaN(parseFloat(form.amountExclGst)) && parseFloat(form.amountExclGst) > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  GST: {fmtMoney(parseFloat(form.amountExclGst) * GST_RATE)} · Incl. GST: {fmtMoney(parseFloat(form.amountExclGst) * (1 + GST_RATE))}
                </p>
              )}
            </div>
            {projectJobs.length > 0 && (
              <div>
                <Label>Linked Job <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Select value={form.jobId || "_none"} onValueChange={(v) => setForm((f) => ({ ...f, jobId: v === "_none" ? "" : v }))}>
                  <SelectTrigger data-testid="select-variation-job">
                    <SelectValue placeholder="None — project-level variation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None</SelectItem>
                    {projectJobs.map((j) => (
                      <SelectItem key={j.id} value={j.id}>{j.jobNumber} — {j.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!form.title.trim() || !form.amountExclGst || createMutation.isPending}
              data-testid="button-save-variation">
              {createMutation.isPending ? "Saving…" : "Create Variation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Job Dialog */}
      <Dialog open={!!linkJobOpen} onOpenChange={(o) => { if (!o) setLinkJobOpen(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Link Variation to Job</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Assign this variation to a job for operational traceability.</p>
            <Select value={linkJobId} onValueChange={setLinkJobId}>
              <SelectTrigger data-testid="select-link-job">
                <SelectValue placeholder="Select a job…" />
              </SelectTrigger>
              <SelectContent>
                {projectJobs.map((j) => (
                  <SelectItem key={j.id} value={j.id}>{j.jobNumber} — {j.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkJobOpen(null)}>Cancel</Button>
            <Button
              disabled={!linkJobId || patchMutation.isPending}
              onClick={() => {
                if (!linkJobOpen || !linkJobId) return;
                patchMutation.mutate({ id: linkJobOpen, data: { jobId: linkJobId } }, {
                  onSuccess: () => setLinkJobOpen(null),
                });
              }}
              data-testid="button-confirm-link-job">
              Link Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CollapsibleSection>
  );
}

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "owner" || user?.role === "admin";
  const projectId = params?.id!;

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  const { data: customers = [] } = useQuery<Customer[]>({ queryKey: ["/api/customers"] });
  const { data: pQuotes = [] } = useQuery<Quote[]>({
    queryKey: ["/api/projects", projectId, "quotes"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/quotes`);
      return res.json();
    },
    enabled: !!projectId,
  });
  const { data: pJobs = [] } = useQuery<OpJob[]>({
    queryKey: ["/api/projects", projectId, "jobs"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/jobs`);
      return res.json();
    },
    enabled: !!projectId,
  });
  const { data: pInvoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/projects", projectId, "invoices"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/invoices`);
      return res.json();
    },
    enabled: !!projectId,
  });
  const { data: pVariations = [] } = useQuery<Variation[]>({
    queryKey: ["/api/projects", projectId, "variations"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/variations`);
      return res.json();
    },
    enabled: !!projectId,
  });

  const customer = customers.find((c) => c.id === project?.customerId);

  const totalQuoted = pQuotes.reduce((s, q) => s + (q.totalValue ?? 0), 0);
  const totalAccepted = pQuotes
    .filter((q) => q.status === "accepted")
    .reduce((s, q) => s + (q.acceptedValue ?? q.totalValue ?? 0), 0);
  // Use excl. GST to match acceptedValue basis (which is stored excl. GST)
  const totalInvoicedExcl = pInvoices.reduce((s, i) => s + (i.amountExclGst ?? 0), 0);
  const totalInvoicedIncl = pInvoices.reduce((s, i) => s + (i.amountInclGst ?? 0), 0);
  const approvedVariationTotal = pVariations
    .filter((v) => ["approved", "partially_invoiced", "fully_invoiced"].includes(v.status))
    .reduce((s, v) => s + (v.amountExclGst ?? 0), 0);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}`, {
        name: editName,
        address: editAddress || null,
        description: editDescription || null,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Update failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Project updated" });
      setEditOpen(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const demoFlagMutation = useMutation({
    mutationFn: async (isDemoRecord: boolean) => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}/demo-flag`, { isDemoRecord });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Demo flag updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading project…</div>;
  }
  if (!project) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm font-medium">Project not found</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/projects")}>
          Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" className="h-7 mt-0.5" onClick={() => navigate("/projects")} data-testid="button-back-projects">
            <ArrowLeftCircle className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight" data-testid="text-project-name">{project.name}</h1>
              {project.divisionCode && <Badge variant="outline" className="text-xs">{project.divisionCode}</Badge>}
            </div>
            {customer && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <Building2 className="h-3 w-3" />
                {customer.name}
              </p>
            )}
            {project.address && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3" />
                {project.address}
              </p>
            )}
            {project.description && (
              <p className="text-xs text-muted-foreground mt-1 italic">{project.description}</p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs shrink-0"
          onClick={() => {
            setEditName(project.name);
            setEditAddress(project.address ?? "");
            setEditDescription(project.description ?? "");
            setEditOpen(true);
          }}
          data-testid="button-edit-project"
        >
          <Pencil className="h-3 w-3 mr-1" /> Edit
        </Button>
      </div>

      {project.isDemoRecord && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 px-4 py-2 flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300" data-testid="banner-demo-project">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          This project is flagged as a demo/test record and may be bulk-archived by an administrator.
        </div>
      )}

      {/* Commercial Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Quotes", value: String(pQuotes.length), sub: pQuotes.length > 0 ? `${fmtMoney(totalQuoted)} total` : undefined, testId: "card-quotes" },
          { label: "Accepted Contract", value: pQuotes.filter((q) => q.status === "accepted").length > 0 ? fmtMoney(totalAccepted) : "—", sub: "excl. GST", testId: "card-accepted" },
          { label: "Approved Variations", value: approvedVariationTotal > 0 ? fmtMoney(approvedVariationTotal) : "—", sub: approvedVariationTotal > 0 ? "excl. GST" : "none", testId: "card-variations" },
          { label: "Jobs", value: String(pJobs.length), sub: undefined, testId: "card-jobs" },
          { label: "Invoiced", value: pInvoices.length > 0 ? fmtMoney(totalInvoicedIncl) : "—", sub: pInvoices.length > 0 ? "incl. GST" : undefined, testId: "card-invoiced" },
          { label: "Outstanding", value: totalAccepted > 0 ? fmtMoney(Math.max(0, totalAccepted - totalInvoicedExcl)) : "—", sub: totalAccepted > 0 ? "excl. GST" : undefined, testId: "card-outstanding" },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border bg-card px-4 py-3" data-testid={card.testId}>
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="text-lg font-semibold font-mono">{card.value}</p>
            {card.sub && <p className="text-xs text-muted-foreground">{card.sub}</p>}
          </div>
        ))}
      </div>

      {/* Quotes */}
      <CollapsibleSection
        title="Quotes"
        icon={<FileText className="h-4 w-4 text-muted-foreground" />}
        count={pQuotes.length}
        data-testid="section-project-quotes"
      >
        {pQuotes.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">No quotes linked to this project yet.</p>
            <p className="text-xs text-muted-foreground/70">Open a quote and link it to this project via the Customer &amp; Project section.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Accepted</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pQuotes.map((q) => (
                <TableRow key={q.id} data-testid={`row-project-quote-${q.id}`}>
                  <TableCell className="font-mono text-sm">{q.number}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(q.status)} className="text-xs capitalize">
                      {QUOTE_STATUS_LABELS[q.status] ?? q.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {q.totalValue != null ? `$${fmt(q.totalValue)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm hidden sm:table-cell">
                    {q.status === "accepted" && q.acceptedValue != null ? fmtMoney(q.acceptedValue) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm hidden md:table-cell">
                    {q.createdAt ? new Date(q.createdAt).toLocaleDateString("en-NZ") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/quote/${q.id}`}>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" data-testid={`button-open-quote-${q.id}`}>
                        <ExternalLink className="h-3 w-3 mr-1" /> Open
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CollapsibleSection>

      {/* Jobs */}
      <CollapsibleSection
        title="Jobs"
        icon={<HardHat className="h-4 w-4 text-muted-foreground" />}
        count={pJobs.length}
        data-testid="section-project-jobs"
      >
        {pJobs.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">No jobs linked to this project yet.</p>
            <p className="text-xs text-muted-foreground/70">Accept a linked quote and convert it to a job to see it here.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pJobs.map((j) => (
                <TableRow key={j.id} data-testid={`row-project-job-${j.id}`}>
                  <TableCell className="font-mono text-sm">{j.jobNumber}</TableCell>
                  <TableCell className="text-sm">{j.title}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(j.status)} className="text-xs capitalize">
                      {j.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm hidden md:table-cell">
                    {j.createdAt ? new Date(j.createdAt).toLocaleDateString("en-NZ") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/op-jobs/${j.id}`}>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" data-testid={`button-open-job-${j.id}`}>
                        <ExternalLink className="h-3 w-3 mr-1" /> Open
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CollapsibleSection>

      {/* Invoices */}
      <CollapsibleSection
        title="Invoices"
        icon={<ReceiptText className="h-4 w-4 text-muted-foreground" />}
        count={pInvoices.length}
        data-testid="section-project-invoices"
      >
        {pInvoices.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">No invoices linked to this project yet.</p>
            <p className="text-xs text-muted-foreground/70">Invoices are created from accepted quotes and will appear here once raised.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount (incl. GST)</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pInvoices.map((inv) => (
                <TableRow key={inv.id} data-testid={`row-project-invoice-${inv.id}`}>
                  <TableCell className="font-mono text-sm">{inv.number}</TableCell>
                  <TableCell className="text-sm">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      inv.type === "deposit" ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" :
                      inv.type === "progress" ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" :
                      inv.type === "variation" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" :
                      inv.type === "final" ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" :
                      inv.type === "retention_release" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" :
                      inv.type === "credit_note" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" :
                      "bg-muted text-muted-foreground"
                    }`} data-testid={`badge-project-invoice-type-${inv.id}`}>
                      {INVOICE_TYPE_LABELS[inv.type] ?? inv.type}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(inv.status)} className="text-xs">
                      {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {inv.amountInclGst != null ? fmtMoney(inv.amountInclGst) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {inv.quoteId && (
                      <Link href={`/quote/${inv.quoteId}`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" data-testid={`button-manage-invoice-${inv.id}`}>
                          <ExternalLink className="h-3 w-3 mr-1" /> Quote
                        </Button>
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CollapsibleSection>

      {/* Variations */}
      <VariationsSection
        projectId={projectId}
        acceptedQuoteId={pQuotes.find((q) => q.status === "accepted")?.id}
      />

      {isAdmin && (
        <>
          <Separator />
          <div className="rounded-lg border border-dashed p-4 space-y-2" data-testid="section-admin-demo-flag-project">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Admin: Demo / Test Record</p>
            <p className="text-xs text-muted-foreground">Flag this project as a demo/test record so it can be managed from the Governance panel. <strong>Record-level only</strong> — does not automatically propagate to linked quotes, jobs, or invoices. Use the Governance panel in Settings to manage chain-level classification.</p>
            <div className="flex items-center gap-3">
              <Button
                variant={project.isDemoRecord ? "secondary" : "outline"}
                size="sm"
                onClick={() => demoFlagMutation.mutate(!project.isDemoRecord)}
                disabled={demoFlagMutation.isPending}
                data-testid="button-toggle-demo-flag-project"
              >
                {project.isDemoRecord ? "✓ Flagged as Demo/Test" : "Mark as Demo/Test"}
              </Button>
              {project.isDemoRecord && (
                <span className="text-xs text-muted-foreground">This record will be archived by the next demo cleanup.</span>
              )}
            </div>
          </div>
        </>
      )}

      {/* Edit Project Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Project Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                data-testid="input-edit-project-name"
              />
            </div>
            <div>
              <Label>Address <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                placeholder="Site or delivery address"
                data-testid="input-edit-project-address"
              />
            </div>
            <div>
              <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Brief description or notes"
                rows={3}
                data-testid="input-edit-project-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={!editName.trim() || updateMutation.isPending}
              data-testid="button-save-project"
            >
              {updateMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
