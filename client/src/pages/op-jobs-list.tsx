import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { type OpJob, type Customer, type Project, type Quote } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { HardHat, ExternalLink, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

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

export default function OpJobsList() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"active" | "archived">("active");

  const { data: jobs = [], isLoading } = useQuery<OpJob[]>({
    queryKey: ["/api/op-jobs"],
  });

  const { data: archivedJobs = [], isLoading: archivedLoading } = useQuery<OpJob[]>({
    queryKey: ["/api/op-jobs", "archived"],
    queryFn: async () => {
      const res = await fetch("/api/op-jobs?scope=archived", { credentials: "include" });
      return res.json();
    },
    enabled: tab === "archived",
  });

  const { data: customers = [] } = useQuery<Customer[]>({ queryKey: ["/api/customers"] });
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["/api/projects"] });
  const { data: quotes = [] } = useQuery<Quote[]>({ queryKey: ["/api/quotes"] });

  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c.name]));
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const quoteNumberMap = Object.fromEntries(quotes.map((q) => [q.id, q.number]));

  return (
    <div className="flex flex-col h-full bg-background" data-testid="jobs-list-op">
      <header className="border-b px-4 sm:px-6 py-3 flex items-center justify-between gap-3 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary shrink-0">
            <HardHat className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight" data-testid="heading-jobs">Jobs</h1>
            <p className="text-[11px] text-muted-foreground leading-tight">Operational jobs converted from accepted quotes</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
      <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "archived")}>
        <TabsList>
          <TabsTrigger value="active" data-testid="tab-active-jobs">
            Active {jobs.length > 0 ? `(${jobs.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="archived" data-testid="tab-archived-jobs">
            Archived {archivedJobs.length > 0 ? `(${archivedJobs.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <JobsTable
            jobs={jobs}
            isLoading={isLoading}
            customerMap={customerMap}
            projectMap={projectMap}
            quoteNumberMap={quoteNumberMap}
            onNavigate={(id) => navigate(`/op-jobs/${id}`)}
            isArchived={false}
          />
        </TabsContent>

        <TabsContent value="archived">
          <JobsTable
            jobs={archivedJobs}
            isLoading={archivedLoading}
            customerMap={customerMap}
            projectMap={projectMap}
            quoteNumberMap={quoteNumberMap}
            onNavigate={(id) => navigate(`/op-jobs/${id}`)}
            isArchived={true}
          />
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}

function JobsTable({
  jobs, isLoading, customerMap, projectMap, quoteNumberMap, onNavigate, isArchived,
}: {
  jobs: OpJob[];
  isLoading: boolean;
  customerMap: Record<string, string>;
  projectMap: Record<string, string>;
  quoteNumberMap: Record<string, string>;
  onNavigate: (id: string) => void;
  isArchived: boolean;
}) {
  const { toast } = useToast();
  const [unarchiveTarget, setUnarchiveTarget] = useState<OpJob | null>(null);

  const unarchiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/op-jobs/${id}/unarchive`, {});
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Unarchive failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/op-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/op-jobs", "archived"] });
      toast({ title: "Job restored to active list" });
      setUnarchiveTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <>
      <div className="rounded-lg border bg-card overflow-x-auto mt-4">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[100px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Job No.</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Division</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Source Quote</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Created</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && jobs.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12">
                  <div className="space-y-2">
                    <HardHat className="h-8 w-8 mx-auto text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">
                      {isArchived ? "No archived jobs" : "No jobs yet"}
                    </p>
                    {!isArchived && (
                      <p className="text-xs text-muted-foreground">Accept a quote and use the "Convert to Job" action to create the first job.</p>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
            {jobs.map((job) => (
              <TableRow
                key={job.id}
                className="cursor-pointer hover:bg-muted/40"
                onClick={() => onNavigate(job.id)}
                data-testid={`row-job-${job.id}`}
              >
                <TableCell className="font-mono font-semibold text-sm py-3" data-testid={`text-job-number-${job.id}`}>
                  {job.jobNumber}
                </TableCell>
                <TableCell className="font-medium text-sm py-3" data-testid={`text-job-title-${job.id}`}>
                  {job.title}
                  {job.isDemoRecord && (
                    <Badge variant="secondary" className="ml-2 text-xs" data-testid={`badge-demo-${job.id}`}>Demo</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm py-3" data-testid={`text-job-customer-${job.id}`}>
                  {job.customerId ? <span className="font-medium">{customerMap[job.customerId] ?? <span className="italic text-muted-foreground">Unknown</span>}</span> : <span className="italic text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-sm py-3" data-testid={`text-job-project-${job.id}`}>
                  {job.projectId ? <span className="text-muted-foreground">{projectMap[job.projectId] ?? <span className="italic">Unknown</span>}</span> : <span className="italic text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-sm font-mono py-3 hidden lg:table-cell" data-testid={`text-job-division-${job.id}`}>
                  {job.divisionId ?? <span className="text-muted-foreground text-xs">—</span>}
                </TableCell>
                <TableCell className="py-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant={STATUS_VARIANTS[job.status] ?? "outline"} className="text-xs" data-testid={`badge-job-status-${job.id}`}>
                      {STATUS_LABELS[job.status] ?? job.status}
                    </Badge>
                    {job.archivedAt && (
                      <Badge variant="secondary" className="text-xs" data-testid={`badge-archived-job-${job.id}`}>Archived</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="py-3 hidden md:table-cell" data-testid={`text-job-source-quote-${job.id}`}>
                  {job.sourceQuoteId ? (
                    <span className="font-mono text-xs font-medium text-primary">
                      {quoteNumberMap[job.sourceQuoteId] ?? job.sourceQuoteId}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground py-3 hidden sm:table-cell" data-testid={`text-job-created-${job.id}`}>
                  {job.createdAt ? new Date(job.createdAt).toLocaleDateString("en-NZ") : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {isArchived && (
                      <Button
                        variant="ghost" size="sm" className="h-7 w-7 p-0"
                        onClick={(e) => { e.stopPropagation(); setUnarchiveTarget(job); }}
                        title="Unarchive"
                        data-testid={`button-unarchive-job-${job.id}`}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost" size="sm" className="h-7 w-7 p-0"
                      onClick={(e) => { e.stopPropagation(); onNavigate(job.id); }}
                      data-testid={`button-view-job-${job.id}`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!unarchiveTarget} onOpenChange={(v) => !v && setUnarchiveTarget(null)}>
        <AlertDialogContent data-testid="dialog-confirm-unarchive-job">
          <AlertDialogHeader>
            <AlertDialogTitle>Restore {unarchiveTarget?.jobNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will unarchive the job and return it to the active list. The job status (e.g. Cancelled) remains unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => unarchiveTarget && unarchiveMutation.mutate(unarchiveTarget.id)}
              data-testid="button-confirm-unarchive-job"
            >
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
