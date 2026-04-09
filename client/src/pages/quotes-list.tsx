import { useState, useMemo } from "react";
import { PageShell, PageHeader, WorklistBody } from "@/components/ui/platform-layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { type Quote } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileText, ArrowRight, Search, ArrowUpDown, Filter, Calendar, X, Trash2, BookOpen, FlaskConical, Building2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/lib/auth-context";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { queryClient, apiRequest } from "@/lib/queryClient";

type EnrichedQuote = Quote & {
  isOrphaned: boolean;
  linkedEstimateExists: boolean;
  sourceEstimateName?: string | null;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  review: "outline",
  sent: "default",
  accepted: "default",
  declined: "destructive",
  archived: "secondary",
  cancelled: "destructive",
};

const SORT_OPTIONS = [
  { value: "updatedAt-desc", label: "Last Updated" },
  { value: "createdAt-desc", label: "Newest First" },
  { value: "createdAt-asc", label: "Oldest First" },
  { value: "customer-asc", label: "Customer A-Z" },
  { value: "customer-desc", label: "Customer Z-A" },
  { value: "totalValue-desc", label: "Value (High-Low)" },
  { value: "totalValue-asc", label: "Value (Low-High)" },
  { value: "number-desc", label: "Quote # (Newest)" },
  { value: "number-asc", label: "Quote # (Oldest)" },
] as const;

function fmt(n: number): string {
  return n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatQuoteType(qt: string | null | undefined, divisionId?: string | null): string {
  switch (qt) {
    case "renovation": return "Renovation";
    case "new_build": return "New Build";
    default:
      if (divisionId === "LL") return "Laser Quote";
      return "Unclassified";
  }
}

function isActive(q: EnrichedQuote): boolean {
  return !q.deletedAt && !q.archivedAt;
}

function isArchived(q: EnrichedQuote): boolean {
  return !!q.archivedAt && !q.deletedAt;
}

export default function QuotesList() {
  const { data: quotes, isLoading } = useQuery<EnrichedQuote[]>({
    queryKey: ["/api/quotes"],
  });
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const isAdmin = user?.role === "owner" || user?.role === "admin";
  const { toast } = useToast();

  const demoFlagMutation = useMutation({
    mutationFn: async ({ id, isDemoRecord }: { id: string; isDemoRecord: boolean }) => {
      const res = await apiRequest("PATCH", `/api/quotes/${id}/demo-flag`, { isDemoRecord });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Demo flag updated" });
    },
  });

  const [activeTab, setActiveTab] = useState("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState("updatedAt-desc");
  const [filterDivision, setFilterDivision] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCustomer, setFilterCustomer] = useState("all");
  const [filterQuoteType, setFilterQuoteType] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const divisions = useMemo(() => {
    if (!quotes) return [];
    const divs = new Set(quotes.map(q => q.divisionId).filter(Boolean) as string[]);
    return Array.from(divs).sort();
  }, [quotes]);

  const customers = useMemo(() => {
    if (!quotes) return [];
    const custs = new Set(quotes.map(q => q.customer).filter(Boolean) as string[]);
    return Array.from(custs).sort();
  }, [quotes]);

  const hasActiveFilters = filterCustomer !== "all" || filterQuoteType !== "all" || filterDateFrom || filterDateTo;

  function clearAllFilters() {
    setFilterCustomer("all");
    setFilterQuoteType("all");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterDivision("all");
    setFilterStatus("all");
    setSearchQuery("");
  }

  const filteredQuotes = useMemo(() => {
    if (!quotes) return [];

    let filtered = quotes.filter(q => {
      switch (activeTab) {
        case "active": return isActive(q);
        case "archived": return isArchived(q);
        default: return isActive(q);
      }
    });

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(q =>
        q.number?.toLowerCase().includes(query) ||
        q.customer?.toLowerCase().includes(query)
      );
    }

    if (filterDivision !== "all") {
      filtered = filtered.filter(q => q.divisionId === filterDivision);
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter(q => q.status === filterStatus);
    }

    if (filterCustomer !== "all") {
      filtered = filtered.filter(q => q.customer === filterCustomer);
    }

    if (filterQuoteType !== "all") {
      filtered = filtered.filter(q => q.quoteType === filterQuoteType);
    }

    if (filterDateFrom) {
      const fromDate = new Date(filterDateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(q => q.createdAt && new Date(q.createdAt) >= fromDate);
    }

    if (filterDateTo) {
      const toDate = new Date(filterDateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(q => q.createdAt && new Date(q.createdAt) <= toDate);
    }

    const [field, direction] = sortOption.split("-") as [string, string];
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (field) {
        case "updatedAt":
          cmp = new Date(a.updatedAt || a.createdAt || 0).getTime() - new Date(b.updatedAt || b.createdAt || 0).getTime();
          break;
        case "createdAt":
          cmp = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
          break;
        case "customer":
          cmp = (a.customer || "").localeCompare(b.customer || "");
          break;
        case "totalValue":
          cmp = (a.totalValue || 0) - (b.totalValue || 0);
          break;
        case "number":
          cmp = (a.number || "").localeCompare(b.number || "", undefined, { numeric: true });
          break;
        default:
          break;
      }
      return direction === "desc" ? -cmp : cmp;
    });

    return filtered;
  }, [quotes, activeTab, searchQuery, sortOption, filterDivision, filterStatus, filterCustomer, filterQuoteType, filterDateFrom, filterDateTo]);

  const tabCounts = useMemo(() => {
    if (!quotes) return { active: 0, archived: 0 };
    return {
      active: quotes.filter(isActive).length,
      archived: quotes.filter(isArchived).length,
    };
  }, [quotes]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="loading-quotes">
        <p className="text-muted-foreground">Loading quotes...</p>
      </div>
    );
  }

  const noQuotesAtAll = !quotes || quotes.length === 0;

  return (
    <PageShell testId="quotes-list-page">
      <PageHeader
        icon={<BookOpen className="w-4 h-4 text-primary-foreground" />}
        title="Quotes"
        subtitle="All formal quotes across divisions"
        titleTestId="text-quotes-heading"
        actions={undefined}
      />
      <WorklistBody className="space-y-4">

      {noQuotesAtAll ? (
        <div className="text-center py-16 text-muted-foreground" data-testid="text-no-quotes-empty">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p className="text-lg font-medium">No quotes yet</p>
          <p className="mt-1 text-sm">Create your first quote from an estimate preview</p>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList data-testid="tabs-quote-categories">
            <TabsTrigger value="active" data-testid="tab-active">
              Active {tabCounts.active > 0 && `(${tabCounts.active})`}
            </TabsTrigger>
            <TabsTrigger value="archived" data-testid="tab-archived">
              Archived {tabCounts.archived > 0 && `(${tabCounts.archived})`}
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-col gap-3 mt-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by quote number or customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-quotes"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {divisions.length > 0 && (
                  <Select value={filterDivision} onValueChange={setFilterDivision}>
                    <SelectTrigger className="w-[140px]" data-testid="select-filter-division">
                      <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                      <SelectValue placeholder="Division" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Divisions</SelectItem>
                      {divisions.map(d => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[130px]" data-testid="select-filter-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortOption} onValueChange={setSortOption}>
                  <SelectTrigger className="w-[160px]" data-testid="select-sort-quotes">
                    <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap items-center">
              {customers.length > 0 && (
                <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                  <SelectTrigger className="w-[160px]" data-testid="select-filter-customer">
                    <SelectValue placeholder="Customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Customers</SelectItem>
                    {customers.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={filterQuoteType} onValueChange={setFilterQuoteType}>
                <SelectTrigger className="w-[140px]" data-testid="select-filter-quote-type">
                  <SelectValue placeholder="Quote Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="renovation">Renovation</SelectItem>
                  <SelectItem value="new_build">New Build</SelectItem>
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5" data-testid="button-date-range-filter">
                    <Calendar className="h-3.5 w-3.5" />
                    {filterDateFrom || filterDateTo
                      ? `${filterDateFrom || "..."} – ${filterDateTo || "..."}`
                      : "Date Range"
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4" align="start">
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Filter by creation date</p>
                    <div className="flex gap-2 items-center">
                      <div>
                        <label className="text-xs text-muted-foreground">From</label>
                        <Input
                          type="date"
                          value={filterDateFrom}
                          onChange={(e) => setFilterDateFrom(e.target.value)}
                          className="w-[150px]"
                          data-testid="input-date-from"
                        />
                      </div>
                      <span className="text-muted-foreground mt-4">–</span>
                      <div>
                        <label className="text-xs text-muted-foreground">To</label>
                        <Input
                          type="date"
                          value={filterDateTo}
                          onChange={(e) => setFilterDateTo(e.target.value)}
                          className="w-[150px]"
                          data-testid="input-date-to"
                        />
                      </div>
                    </div>
                    {(filterDateFrom || filterDateTo) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }}
                        data-testid="button-clear-date-range"
                      >
                        Clear dates
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-9 gap-1"
                  data-testid="button-clear-all-filters"
                >
                  <X className="h-3.5 w-3.5" /> Clear filters
                </Button>
              )}
            </div>
          </div>

          {["active", "archived"].map(tabValue => (
            <TabsContent key={tabValue} value={tabValue}>
              {filteredQuotes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="text-no-quotes-filtered">
                  <p>No quotes match your filters</p>
                </div>
              ) : (
                <>
                  {isMobile ? (
                    <MobileQuoteCards quotes={filteredQuotes} isAdmin={isAdmin} demoFlagMutation={demoFlagMutation} />
                  ) : (
                    <DesktopQuoteTable quotes={filteredQuotes} isAdmin={isAdmin} demoFlagMutation={demoFlagMutation} />
                  )}
                </>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
      </WorklistBody>
    </PageShell>
  );
}

function QuoteBadges({ quote }: { quote: EnrichedQuote }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      <Badge variant={STATUS_VARIANT[quote.status] || "secondary"} data-testid={`badge-quote-status-${quote.id}`}>
        {quote.status}
      </Badge>
      {quote.archivedAt && quote.status !== "archived" && (
        <Badge variant="secondary" data-testid={`badge-archived-${quote.id}`}>Archived</Badge>
      )}
      {quote.isOrphaned && (
        <Badge variant="destructive" data-testid={`badge-orphaned-${quote.id}`}>Estimate Removed</Badge>
      )}
    </div>
  );
}

function DesktopQuoteTable({ quotes, isAdmin, demoFlagMutation }: { quotes: EnrichedQuote[]; isAdmin: boolean; demoFlagMutation: any }) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[120px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quote #</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer</TableHead>
            <TableHead className="hidden xl:table-cell w-[140px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Source Estimate</TableHead>
            <TableHead className="hidden lg:table-cell w-[90px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</TableHead>
            <TableHead className="hidden lg:table-cell w-[90px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Division</TableHead>
            <TableHead className="w-[120px] text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Value</TableHead>
            <TableHead className="w-[170px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
            <TableHead className="hidden xl:table-cell w-[100px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Updated</TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotes.map((q) => (
            <TableRow key={q.id} className="hover:bg-muted/30" data-testid={`row-quote-${q.id}`}>
              <TableCell className="font-mono font-medium py-2.5" data-testid={`text-quote-number-${q.id}`}>
                <div className="flex items-center gap-1.5">
                  {q.number}
                  {isAdmin && q.isDemoRecord && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 shrink-0 font-sans" data-testid={`badge-demo-quote-${q.id}`}>
                      <FlaskConical className="h-2.5 w-2.5 mr-0.5" />Demo
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="py-2.5" data-testid={`text-quote-customer-${q.id}`}>
                {q.customer ? (
                  <span className="flex items-center gap-1.5 text-sm">
                    <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />{q.customer}
                  </span>
                ) : <span className="text-xs text-muted-foreground italic">—</span>}
              </TableCell>
              <TableCell className="hidden xl:table-cell text-sm text-muted-foreground py-2.5" data-testid={`text-quote-source-${q.id}`}>
                {q.sourceEstimateName || "—"}
              </TableCell>
              <TableCell className="hidden lg:table-cell text-sm text-muted-foreground py-2.5" data-testid={`text-quote-type-${q.id}`}>
                {formatQuoteType(q.quoteType, q.divisionId)}
              </TableCell>
              <TableCell className="hidden lg:table-cell text-sm text-muted-foreground py-2.5" data-testid={`text-quote-division-${q.id}`}>
                {q.divisionId || "—"}
              </TableCell>
              <TableCell className="text-right font-mono text-sm py-2.5" data-testid={`text-quote-value-${q.id}`}>
                {q.totalValue != null ? `$${fmt(q.totalValue)}` : "—"}
              </TableCell>
              <TableCell className="py-2.5">
                <QuoteBadges quote={q} />
              </TableCell>
              <TableCell className="hidden xl:table-cell text-sm text-muted-foreground py-2.5">
                {q.updatedAt ? new Date(q.updatedAt).toLocaleDateString("en-NZ") : q.createdAt ? new Date(q.createdAt).toLocaleDateString("en-NZ") : "—"}
              </TableCell>
              <TableCell className="py-2.5">
                <div className="flex items-center justify-end gap-1">
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-7 px-2 text-xs ${q.isDemoRecord ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}
                      onClick={() => demoFlagMutation.mutate({ id: q.id, isDemoRecord: !q.isDemoRecord })}
                      disabled={demoFlagMutation.isPending}
                      data-testid={`button-toggle-demo-quote-${q.id}`}
                      title={q.isDemoRecord ? "Remove demo flag" : "Flag as demo"}
                    >
                      <FlaskConical className="w-3 h-3" />
                    </Button>
                  )}
                  {q.status === "draft" && (
                    <QuoteDeleteButton quoteId={q.id} quoteNumber={q.number} />
                  )}
                  <Link href={`/quote/${q.id}`}>
                    <Button variant="ghost" size="icon" data-testid={`button-view-quote-${q.id}`}>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function MobileQuoteCards({ quotes, isAdmin, demoFlagMutation }: { quotes: EnrichedQuote[]; isAdmin: boolean; demoFlagMutation: any }) {
  return (
    <div className="space-y-3">
      {quotes.map((q) => (
        <Link key={q.id} href={`/quote/${q.id}`}>
          <Card
            className="p-4 hover-elevate active-elevate-2 cursor-pointer"
            data-testid={`card-quote-${q.id}`}
          >
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-mono font-medium text-sm" data-testid={`text-quote-number-mobile-${q.id}`}>
                  {q.number}
                </span>
                {isAdmin && q.isDemoRecord && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 shrink-0 font-sans" data-testid={`badge-demo-quote-mobile-${q.id}`}>
                    Demo
                  </Badge>
                )}
              </div>
              <QuoteBadges quote={q} />
            </div>
            <p className="mt-2 text-sm" data-testid={`text-quote-customer-mobile-${q.id}`}>
              {q.customer}
            </p>
            <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span data-testid={`text-quote-type-mobile-${q.id}`}>{formatQuoteType(q.quoteType, q.divisionId)}</span>
                {q.divisionId && <span data-testid={`text-quote-division-mobile-${q.id}`}>{q.divisionId}</span>}
                <span>
                  {q.updatedAt ? new Date(q.updatedAt).toLocaleDateString("en-NZ") : q.createdAt ? new Date(q.createdAt).toLocaleDateString("en-NZ") : "—"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {q.totalValue != null && (
                  <span className="text-sm font-mono" data-testid={`text-quote-value-mobile-${q.id}`}>
                    ${fmt(q.totalValue)}
                  </span>
                )}
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function QuoteDeleteButton({ quoteId, quoteNumber }: { quoteId: string; quoteNumber: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/quotes/${quoteId}?confirm=permanent`, {});
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Delete failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Quote deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        disabled={deleteMutation.isPending}
        data-testid={`button-delete-quote-${quoteId}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent data-testid={`dialog-confirm-delete-${quoteId}`}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {quoteNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes this draft quote and all its revisions. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid={`button-cancel-delete-${quoteId}`}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
              data-testid={`button-confirm-delete-${quoteId}`}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
