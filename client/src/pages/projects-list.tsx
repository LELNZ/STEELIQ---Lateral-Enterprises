import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { Project, Customer, Quote, OpJob, Invoice } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FolderOpen, Search, Building2, MapPin, Plus, ExternalLink, Archive } from "lucide-react";
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
      p.address?.toLowerCase().includes(s)
    );
  });

  const isLoading = tab === "archived" ? loadingArchived : loadingProjects;

  const fmt = (n: number) => n.toLocaleString("en-NZ", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="border-b px-4 sm:px-6 py-3 flex items-center justify-between gap-3 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary shrink-0">
            <FolderOpen className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight">Projects</h1>
            <p className="text-[11px] text-muted-foreground leading-tight">Contract-level projects linked to customers and quotes</p>
          </div>
        </div>
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
      </header>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
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
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Project</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Customer</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Address</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Quotes</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Jobs</th>
                      <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Invoices</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">Quoted</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">Invoiced</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p, idx) => (
                      <tr
                        key={p.id}
                        className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                        data-testid={`row-project-${p.id}`}
                      >
                        <td className="px-4 py-3">
                          <Link href={`/projects/${p.id}`}>
                            <span className="font-medium hover:underline cursor-pointer" data-testid={`link-project-${p.id}`}>{p.name}</span>
                          </Link>
                          {p.divisionCode && (
                            <Badge variant="outline" className="ml-2 text-xs">{p.divisionCode}</Badge>
                          )}
                          {tabValue === "archived" && p.archivedAt && (
                            <Badge variant="outline" className="ml-2 text-xs text-muted-foreground">Archived</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {p.customer ? (
                            <Link href={`/customers`}>
                              <span className="flex items-center gap-1.5 hover:underline cursor-pointer font-medium">
                                <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />{p.customer.name}
                              </span>
                            </Link>
                          ) : (
                            <span className="italic text-xs text-muted-foreground">No customer</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                          {p.address ? (
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" />{p.address}</span>
                          ) : (
                            <span className="italic text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={p.quoteCount > 0 ? "secondary" : "outline"} className="text-xs">{p.quoteCount}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={p.jobCount > 0 ? "secondary" : "outline"} className="text-xs">{p.jobCount}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={p.invoiceCount > 0 ? "secondary" : "outline"} className="text-xs">{p.invoiceCount}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right hidden lg:table-cell">
                          {p.totalQuoted > 0 ? (
                            <span className="font-mono text-sm font-semibold tabular-nums">${fmt(p.totalQuoted)}</span>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right hidden lg:table-cell">
                          {p.totalInvoiced > 0 ? (
                            <span className="font-mono text-sm font-medium tabular-nums">${fmt(p.totalInvoiced)}</span>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/projects/${p.id}`}>
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" data-testid={`button-open-project-${p.id}`}>
                              Open <ExternalLink className="h-3 w-3" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <p className="text-xs text-muted-foreground text-right mt-2">
        {filtered.length} {filtered.length === 1 ? "project" : "projects"}{search ? ` matching "${search}"` : ""}{tab === "archived" ? " (archived)" : ""}
      </p>
      </div>
    </div>
  );
}
