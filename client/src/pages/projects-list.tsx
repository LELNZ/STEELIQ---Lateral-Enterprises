import { useQuery } from "@tanstack/react-query";
import { PageShell, PageHeader, WorklistBody } from "@/components/ui/platform-layout";
import { Link } from "wouter";
import type { Project, Customer, Quote, OpJob, Invoice } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FolderOpen, Search, Building2, MapPin, Plus, ExternalLink, Archive, FlaskConical } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";

type ProjectWithSummary = Project & {
  customer: Customer | null;
  quoteCount: number;
  jobCount: number;
  invoiceCount: number;
  totalQuoted: number;
  totalInvoiced: number;
};

export default function ProjectsList() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("active");
  const { user } = useAuth();
  const isAdmin = user?.role === "owner" || user?.role === "admin";

  const { data: rawProjects = [], isLoading: loadingProjects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });
  const { data: archivedProjects = [], isLoading: loadingArchived } = useQuery<Project[]>({
    queryKey: ["/api/projects", "archived"],
    queryFn: async () => {
      const res = await fetch("/api/projects?scope=archived", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch archived projects");
      return res.json();
    },
    enabled: tab === "archived",
  });
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });
  const { data: allQuotes = [] } = useQuery<Quote[]>({
    queryKey: ["/api/quotes"],
  });
  const { data: allJobs = [] } = useQuery<OpJob[]>({
    queryKey: ["/api/op-jobs"],
  });
  const { data: allInvoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c]));

  const enrichProjects = (list: Project[]): ProjectWithSummary[] =>
    list.map((p) => {
      const pQuotes = allQuotes.filter((q) => q.projectId === p.id);
      const pJobs = allJobs.filter((j) => j.projectId === p.id);
      const pInvoices = allInvoices.filter((i) => i.projectId === p.id);
      const totalQuoted = pQuotes.reduce((sum, q) => sum + (q.totalValue ?? 0), 0);
      const totalInvoiced = pInvoices.reduce((sum, i) => sum + (i.amountInclGst ?? 0), 0);
      return {
        ...p,
        customer: customerMap[p.customerId] ?? null,
        quoteCount: pQuotes.length,
        jobCount: pJobs.length,
        invoiceCount: pInvoices.length,
        totalQuoted,
        totalInvoiced,
      };
    });

  const projects = enrichProjects(tab === "archived" ? archivedProjects : rawProjects);

  const filtered = projects.filter((p) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(s) ||
      p.customer?.name.toLowerCase().includes(s) ||
      p.address?.toLowerCase().includes(s) ||
      p.projectNumber?.toLowerCase().includes(s)
    );
  });

  const isLoading = tab === "archived" ? loadingArchived : loadingProjects;

  const fmt = (n: number) => n.toLocaleString("en-NZ", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <PageShell>
      <PageHeader
        icon={<FolderOpen className="w-4 h-4 text-primary-foreground" />}
        title="Projects"
        subtitle="Contract-level projects linked to customers and quotes"
        actions={
          <div className="flex items-center gap-2">
            <div className="relative hidden sm:block">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-sm w-56"
                placeholder="Search projects…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search-projects"
              />
            </div>
            <Link href="/customers">
              <Button variant="outline" size="sm" data-testid="button-manage-customers">
                <Building2 className="h-3.5 w-3.5 mr-1.5" />
                Customers
              </Button>
            </Link>
          </div>
        }
      />
      <WorklistBody>
      <div className="sm:hidden relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search projects, customers, addresses…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-projects-mobile"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList data-testid="tabs-projects-scope">
          <TabsTrigger value="active" data-testid="tab-projects-active">Active</TabsTrigger>
          <TabsTrigger value="archived" data-testid="tab-projects-archived">
            <Archive className="h-3.5 w-3.5 mr-1.5" />
            Archived
          </TabsTrigger>
        </TabsList>

        {["active", "archived"].map(tabValue => (
          <TabsContent key={tabValue} value={tabValue}>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading projects…</div>
            ) : filtered.length === 0 ? (
              <div className="rounded-lg border border-dashed p-12 text-center">
                <FolderOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium">
                  {search ? "No projects match your search" : tabValue === "archived" ? "No archived projects" : "No projects yet"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {search
                    ? "Try a different search term"
                    : tabValue === "archived"
                      ? "Archived projects will appear here."
                      : "Projects are created from accepted quotes. Open a quote and use Create Project."}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[110px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project #</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Address</TableHead>
                      <TableHead className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quotes</TableHead>
                      <TableHead className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Jobs</TableHead>
                      <TableHead className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Invoices</TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Quoted</TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Invoiced</TableHead>
                      <TableHead className="w-[80px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => {
                      return (
                      <TableRow key={p.id} className="hover:bg-muted/30" data-testid={`row-project-${p.id}`}>
                        <TableCell className="py-2.5">
                          <span className="text-xs font-mono text-muted-foreground" data-testid={`text-project-number-${p.id}`}>{p.projectNumber ?? "—"}</span>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Link href={`/projects/${p.id}`}>
                              <span className="font-medium text-sm hover:underline cursor-pointer" data-testid={`link-project-${p.id}`}>{p.name}</span>
                            </Link>
                            {p.divisionCode && (
                              <Badge variant="outline" className="text-xs">{p.divisionCode}</Badge>
                            )}
                            {isAdmin && (p as any).isDemoRecord && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 shrink-0" data-testid={`badge-demo-project-${p.id}`}>
                                <FlaskConical className="h-2.5 w-2.5 mr-0.5" />Demo
                              </Badge>
                            )}
                            {tabValue === "archived" && p.archivedAt && (
                              <Badge variant="outline" className="text-xs text-muted-foreground">Archived</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5">
                          {p.customer ? (
                            <Link href="/customers">
                              <span className="flex items-center gap-1.5 text-sm hover:underline cursor-pointer">
                                <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />{p.customer.name}
                              </span>
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground py-2.5 hidden md:table-cell">
                          {p.address ? (
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" />{p.address}</span>
                          ) : (
                            <span className="text-xs italic">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center py-2.5">
                          <Badge variant={p.quoteCount > 0 ? "secondary" : "outline"} className="text-xs">{p.quoteCount}</Badge>
                        </TableCell>
                        <TableCell className="text-center py-2.5">
                          <Badge variant={p.jobCount > 0 ? "secondary" : "outline"} className="text-xs">{p.jobCount}</Badge>
                        </TableCell>
                        <TableCell className="text-center py-2.5">
                          <Badge variant={p.invoiceCount > 0 ? "secondary" : "outline"} className="text-xs">{p.invoiceCount}</Badge>
                        </TableCell>
                        <TableCell className="text-right py-2.5 hidden lg:table-cell">
                          {p.totalQuoted > 0 ? (
                            <span className="font-mono text-sm font-semibold tabular-nums">${fmt(p.totalQuoted)}</span>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right py-2.5 hidden lg:table-cell">
                          {p.totalInvoiced > 0 ? (
                            <span className="font-mono text-sm font-medium tabular-nums">${fmt(p.totalInvoiced)}</span>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <Link href={`/projects/${p.id}`}>
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" data-testid={`button-open-project-${p.id}`}>
                              Open <ExternalLink className="h-3 w-3" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <p className="text-xs text-muted-foreground text-right mt-2">
        {filtered.length} {filtered.length === 1 ? "project" : "projects"}{search ? ` matching "${search}"` : ""}{tab === "archived" ? " (archived)" : ""}
      </p>
      </WorklistBody>
    </PageShell>
  );
}
