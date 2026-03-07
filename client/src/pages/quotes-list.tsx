import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
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
  FileText, ArrowRight, Search, ArrowUpDown, Filter,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

type EnrichedQuote = Quote & {
  isOrphaned: boolean;
  linkedEstimateExists: boolean;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  review: "outline",
  sent: "default",
  accepted: "default",
  declined: "destructive",
  archived: "secondary",
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

function formatQuoteType(qt: string | null | undefined): string {
  if (!qt) return "General";
  switch (qt) {
    case "renovation": return "Renovation";
    case "new_build": return "New Build";
    case "tender": return "Tender";
    default: return "General";
  }
}

function isActive(q: EnrichedQuote): boolean {
  return !q.deletedAt && !q.archivedAt;
}

function isArchived(q: EnrichedQuote): boolean {
  return !!q.archivedAt && !q.deletedAt;
}

export default function QuotesList() {
  const { data: quotes, isLoading } = useQuery<EnrichedQuote[]>({ queryKey: ["/api/quotes"] });
  const isMobile = useIsMobile();

  const [activeTab, setActiveTab] = useState("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState("updatedAt-desc");
  const [filterDivision, setFilterDivision] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const divisions = useMemo(() => {
    if (!quotes) return [];
    const divs = new Set(quotes.map(q => q.divisionId).filter(Boolean) as string[]);
    return Array.from(divs).sort();
  }, [quotes]);

  const filteredQuotes = useMemo(() => {
    if (!quotes) return [];

    let filtered = quotes.filter(q => {
      switch (activeTab) {
        case "active": return isActive(q);
        case "renovation": return isActive(q) && q.quoteType === "renovation";
        case "new_build": return isActive(q) && q.quoteType === "new_build";
        case "tender": return isActive(q) && q.quoteType === "tender";
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
  }, [quotes, activeTab, searchQuery, sortOption, filterDivision, filterStatus]);

  const tabCounts = useMemo(() => {
    if (!quotes) return { active: 0, renovation: 0, new_build: 0, tender: 0, archived: 0 };
    return {
      active: quotes.filter(isActive).length,
      renovation: quotes.filter(q => isActive(q) && q.quoteType === "renovation").length,
      new_build: quotes.filter(q => isActive(q) && q.quoteType === "new_build").length,
      tender: quotes.filter(q => isActive(q) && q.quoteType === "tender").length,
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
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4" data-testid="quotes-list-page">
      <div className="flex items-center gap-3 flex-wrap">
        <FileText className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-xl font-bold" data-testid="text-quotes-heading">Quotes</h1>
      </div>

      {noQuotesAtAll ? (
        <div className="text-center py-16 text-muted-foreground" data-testid="text-no-quotes-empty">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p className="text-lg font-medium">No quotes yet</p>
          <p className="mt-1 text-sm">Create your first quote from an estimate preview</p>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto">
            <TabsList data-testid="tabs-quote-categories">
              <TabsTrigger value="active" data-testid="tab-active">
                Active {tabCounts.active > 0 && `(${tabCounts.active})`}
              </TabsTrigger>
              <TabsTrigger value="renovation" data-testid="tab-renovation">
                Renovations {tabCounts.renovation > 0 && `(${tabCounts.renovation})`}
              </TabsTrigger>
              <TabsTrigger value="new_build" data-testid="tab-new-build">
                New Builds {tabCounts.new_build > 0 && `(${tabCounts.new_build})`}
              </TabsTrigger>
              <TabsTrigger value="tender" data-testid="tab-tender">
                Tenders {tabCounts.tender > 0 && `(${tabCounts.tender})`}
              </TabsTrigger>
              <TabsTrigger value="archived" data-testid="tab-archived">
                Archived {tabCounts.archived > 0 && `(${tabCounts.archived})`}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-4">
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

          {["active", "renovation", "new_build", "tender", "archived"].map(tabValue => (
            <TabsContent key={tabValue} value={tabValue}>
              {filteredQuotes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="text-no-quotes-filtered">
                  <p>No quotes match your filters</p>
                </div>
              ) : (
                <>
                  {isMobile ? (
                    <MobileQuoteCards quotes={filteredQuotes} />
                  ) : (
                    <DesktopQuoteTable quotes={filteredQuotes} />
                  )}
                </>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
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
      {quote.quoteType === "tender" && (
        <Badge variant="outline" data-testid={`badge-tender-${quote.id}`}>Tender</Badge>
      )}
    </div>
  );
}

function DesktopQuoteTable({ quotes }: { quotes: EnrichedQuote[] }) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Quote #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead className="w-[100px]">Type</TableHead>
            <TableHead className="w-[100px]">Division</TableHead>
            <TableHead className="w-[120px] text-right">Value</TableHead>
            <TableHead className="w-[180px]">Status</TableHead>
            <TableHead className="w-[120px]">Updated</TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotes.map((q) => (
            <TableRow key={q.id} data-testid={`row-quote-${q.id}`}>
              <TableCell className="font-mono font-medium" data-testid={`text-quote-number-${q.id}`}>
                {q.number}
              </TableCell>
              <TableCell data-testid={`text-quote-customer-${q.id}`}>{q.customer}</TableCell>
              <TableCell className="text-sm text-muted-foreground" data-testid={`text-quote-type-${q.id}`}>
                {formatQuoteType(q.quoteType)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground" data-testid={`text-quote-division-${q.id}`}>
                {q.divisionId || "—"}
              </TableCell>
              <TableCell className="text-right font-mono text-sm" data-testid={`text-quote-value-${q.id}`}>
                {q.totalValue != null ? `$${fmt(q.totalValue)}` : "—"}
              </TableCell>
              <TableCell>
                <QuoteBadges quote={q} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {q.updatedAt ? new Date(q.updatedAt).toLocaleDateString("en-NZ") : q.createdAt ? new Date(q.createdAt).toLocaleDateString("en-NZ") : "—"}
              </TableCell>
              <TableCell>
                <Link href={`/quote/${q.id}`}>
                  <Button variant="ghost" size="icon" data-testid={`button-view-quote-${q.id}`}>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function MobileQuoteCards({ quotes }: { quotes: EnrichedQuote[] }) {
  return (
    <div className="space-y-3">
      {quotes.map((q) => (
        <Link key={q.id} href={`/quote/${q.id}`}>
          <Card
            className="p-4 hover-elevate active-elevate-2 cursor-pointer"
            data-testid={`card-quote-${q.id}`}
          >
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <span className="font-mono font-medium text-sm" data-testid={`text-quote-number-mobile-${q.id}`}>
                {q.number}
              </span>
              <QuoteBadges quote={q} />
            </div>
            <p className="mt-2 text-sm" data-testid={`text-quote-customer-mobile-${q.id}`}>
              {q.customer}
            </p>
            <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span data-testid={`text-quote-type-mobile-${q.id}`}>{formatQuoteType(q.quoteType)}</span>
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
