import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Project, Customer, Quote, OpJob, Invoice } from "@shared/schema";
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
  FolderOpen, Building2, MapPin, FileText, HardHat, ReceiptText,
  ArrowLeftCircle, ChevronDown, ChevronUp, ExternalLink, Pencil, Check, X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

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

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
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

  const customer = customers.find((c) => c.id === project?.customerId);

  const totalQuoted = pQuotes.reduce((s, q) => s + (q.totalValue ?? 0), 0);
  const totalAccepted = pQuotes
    .filter((q) => q.status === "accepted")
    .reduce((s, q) => s + (q.acceptedValue ?? q.totalValue ?? 0), 0);
  const totalInvoiced = pInvoices.reduce((s, i) => s + (i.amountInclGst ?? 0), 0);

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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Quotes", value: String(pQuotes.length), sub: pQuotes.length > 0 ? `$${fmt(totalQuoted)} total` : undefined },
          { label: "Accepted", value: pQuotes.filter((q) => q.status === "accepted").length > 0 ? fmtMoney(totalAccepted) : "—", sub: undefined },
          { label: "Jobs", value: String(pJobs.length), sub: undefined },
          { label: "Invoices", value: String(pInvoices.length), sub: pInvoices.length > 0 ? `$${fmt(totalInvoiced)} incl. GST` : undefined },
          { label: "Outstanding", value: totalAccepted > 0 ? fmtMoney(Math.max(0, totalAccepted - totalInvoiced)) : "—", sub: totalAccepted > 0 ? "uninvoiced" : undefined },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border bg-card px-4 py-3">
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
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">No quotes linked to this project.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
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
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">No jobs linked to this project.</p>
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
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">No invoices linked to this project.</p>
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
                  <TableCell className="text-sm capitalize">
                    {INVOICE_TYPE_LABELS[inv.type] ?? inv.type}
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
