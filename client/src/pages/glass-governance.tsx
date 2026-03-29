import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Shield, CheckCircle2, XCircle, AlertTriangle, Search,
  ExternalLink, ChevronDown, ChevronRight, Database, Activity, Eye
} from "lucide-react";

type HealthStatus = "clean" | "warnings" | "conflicts";
type PricingSourceType = "pane-aware" | "partial-fallback" | "full-fallback" | "default" | "no-glass";
type ResolutionState = "all-valid" | "some-unresolved" | "all-unresolved" | "no-overrides";

interface GlassComboRecord {
  iguType: string;
  combo: string;
  thicknesses: string[];
  prices: Record<string, number>;
  status: "valid" | "duplicate" | "incomplete";
  missingThicknesses: string[];
}

interface DuplicateGroup {
  key: string;
  entries: Array<{ iguType: string; combo: string; prices: Record<string, number> }>;
  hasPriceConflict: boolean;
  prices: Record<string, number[]>;
}

interface LibraryAuditResult {
  totalEntries: number;
  byIgu: Record<string, GlassComboRecord[]>;
  duplicates: DuplicateGroup[];
  duplicateCount: number;
  incompleteCount: number;
  conflictCount: number;
  healthStatus: HealthStatus;
}

interface PaneDetail {
  paneIndex: number;
  isValid: boolean;
  iguType: string;
  glassType: string;
  thickness: string;
  issues: string[];
}

interface BatchIntegrityItem {
  itemId: string;
  itemName: string;
  jobId: string;
  jobName: string;
  category: string;
  heightFromFloor: number | null;
  paneCount: number;
  resolutionState: ResolutionState;
  pricingSource: {
    type: PricingSourceType;
    label: string;
    explanation: string;
    resolvedCount: number;
    unresolvedCount: number;
  };
  invalidPaneCount: number;
  totalOverrides: number;
  paneDetails: PaneDetail[];
}

const statusColor: Record<string, string> = {
  "valid": "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  "duplicate": "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  "incomplete": "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
};

const resolutionColor: Record<string, string> = {
  "all-valid": "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  "some-unresolved": "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  "all-unresolved": "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  "no-overrides": "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const pricingSourceColor: Record<string, string> = {
  "pane-aware": "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  "partial-fallback": "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  "full-fallback": "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  "default": "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  "no-glass": "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export default function GlassGovernance() {
  const [activeTab, setActiveTab] = useState("library");
  const [iguFilter, setIguFilter] = useState<string>("all");
  const [integrityFilter, setIntegrityFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const auditQuery = useQuery<LibraryAuditResult>({
    queryKey: ["/api/admin/glass-governance/audit"],
  });

  const batchQuery = useQuery<{ items: BatchIntegrityItem[]; total: number }>({
    queryKey: ["/api/admin/glass-governance/batch-integrity"],
  });

  const audit = auditQuery.data;
  const batchItems = batchQuery.data?.items || [];

  const filteredLibrary = useMemo(() => {
    if (!audit) return {};
    const result: Record<string, GlassComboRecord[]> = {};
    for (const [igu, entries] of Object.entries(audit.byIgu)) {
      if (iguFilter !== "all" && igu !== iguFilter) continue;
      const filtered = entries.filter(e =>
        searchTerm === "" || e.combo.toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (filtered.length > 0) result[igu] = filtered;
    }
    return result;
  }, [audit, iguFilter, searchTerm]);

  const filteredIntegrity = useMemo(() => {
    let items = batchItems;
    if (integrityFilter === "all-invalid") {
      items = items.filter(i => i.resolutionState === "all-unresolved");
    } else if (integrityFilter === "partial-invalid") {
      items = items.filter(i => i.resolutionState === "some-unresolved");
    } else if (integrityFilter === "valid") {
      items = items.filter(i => i.resolutionState === "all-valid");
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      items = items.filter(i =>
        i.itemName.toLowerCase().includes(q) ||
        i.jobName.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
      );
    }
    return items;
  }, [batchItems, integrityFilter, searchTerm]);

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const healthIcon = (status: HealthStatus) => {
    if (status === "clean") return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    if (status === "warnings") return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    return <XCircle className="w-5 h-5 text-red-500" />;
  };

  return (
    <div className="min-h-screen bg-background" data-testid="glass-governance-page">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold" data-testid="page-title-glass-governance">Glass Library Governance</h1>
            <p className="text-sm text-muted-foreground">Library audit, batch integrity review, and pricing auditability</p>
          </div>
        </div>

        {audit && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <Card data-testid="stat-total-entries">
              <CardContent className="p-3">
                <div className="text-2xl font-bold">{audit.totalEntries}</div>
                <div className="text-xs text-muted-foreground">Total Entries</div>
              </CardContent>
            </Card>
            <Card data-testid="stat-health">
              <CardContent className="p-3 flex items-center gap-2">
                {healthIcon(audit.healthStatus)}
                <div>
                  <div className="text-sm font-semibold capitalize">{audit.healthStatus}</div>
                  <div className="text-xs text-muted-foreground">Library Health</div>
                </div>
              </CardContent>
            </Card>
            <Card data-testid="stat-duplicates">
              <CardContent className="p-3">
                <div className="text-2xl font-bold">{audit.duplicateCount}</div>
                <div className="text-xs text-muted-foreground">Duplicates</div>
              </CardContent>
            </Card>
            <Card data-testid="stat-incomplete">
              <CardContent className="p-3">
                <div className="text-2xl font-bold">{audit.incompleteCount}</div>
                <div className="text-xs text-muted-foreground">Incomplete</div>
              </CardContent>
            </Card>
            <Card data-testid="stat-items-with-pane-specs">
              <CardContent className="p-3">
                <div className="text-2xl font-bold">{batchQuery.data?.total ?? "—"}</div>
                <div className="text-xs text-muted-foreground">Items w/ Pane Specs</div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="library" data-testid="tab-library">
              <Database className="w-4 h-4 mr-1.5" /> Glass Library
            </TabsTrigger>
            <TabsTrigger value="integrity" data-testid="tab-integrity">
              <Activity className="w-4 h-4 mr-1.5" /> Batch Integrity
            </TabsTrigger>
            <TabsTrigger value="conflicts" data-testid="tab-conflicts">
              <AlertTriangle className="w-4 h-4 mr-1.5" /> Conflicts
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={activeTab === "library" ? "Search glass combos..." : "Search items..."}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8"
                data-testid="input-search-governance"
              />
            </div>
            {activeTab === "library" && (
              <Select value={iguFilter} onValueChange={setIguFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-igufilter">
                  <SelectValue placeholder="Filter IGU" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All IGU Types</SelectItem>
                  <SelectItem value="EnergySaver">EnergySaver</SelectItem>
                  <SelectItem value="LightBridge">LightBridge</SelectItem>
                  <SelectItem value="VLamThermotech">VLamThermotech</SelectItem>
                </SelectContent>
              </Select>
            )}
            {activeTab === "integrity" && (
              <Select value={integrityFilter} onValueChange={setIntegrityFilter}>
                <SelectTrigger className="w-[200px]" data-testid="select-integrityfilter">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items</SelectItem>
                  <SelectItem value="all-invalid">All Invalid</SelectItem>
                  <SelectItem value="partial-invalid">Partial Invalid</SelectItem>
                  <SelectItem value="valid">All Valid</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <TabsContent value="library">
            {auditQuery.isLoading ? (
              <div className="text-sm text-muted-foreground p-4">Loading glass library audit...</div>
            ) : (
              <div className="space-y-6">
                {Object.entries(filteredLibrary).map(([igu, entries]) => (
                  <Card key={igu} data-testid={`library-group-${igu}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        {igu}
                        <Badge variant="outline" className="text-xs">{entries.length} combos</Badge>
                        {entries.some(e => e.status === "duplicate") && (
                          <Badge className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">Has Duplicates</Badge>
                        )}
                        {entries.some(e => e.status === "incomplete") && (
                          <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">Some Incomplete</Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Glass Combination</TableHead>
                            <TableHead className="text-xs text-center">Status</TableHead>
                            <TableHead className="text-xs text-center">Thicknesses</TableHead>
                            <TableHead className="text-xs text-right">Price Range</TableHead>
                            <TableHead className="text-xs">Missing</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {entries.map((entry, idx) => {
                            const prices = Object.values(entry.prices);
                            const minP = Math.min(...prices);
                            const maxP = Math.max(...prices);
                            return (
                              <TableRow key={idx} data-testid={`library-entry-${igu}-${idx}`}>
                                <TableCell className="text-sm font-medium">{entry.combo}</TableCell>
                                <TableCell className="text-center">
                                  <Badge className={`text-[10px] ${statusColor[entry.status]}`} data-testid={`status-${igu}-${idx}`}>
                                    {entry.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-center font-mono">
                                  {entry.thicknesses.join(", ")}
                                </TableCell>
                                <TableCell className="text-xs text-right font-mono">
                                  ${minP.toFixed(2)} – ${maxP.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {entry.missingThicknesses.length > 0 ? entry.missingThicknesses.join(", ") : "—"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="integrity">
            {batchQuery.isLoading ? (
              <div className="text-sm text-muted-foreground p-4">Loading batch integrity data...</div>
            ) : filteredIntegrity.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  {integrityFilter === "all"
                    ? "No items with pane glass overrides found."
                    : `No items matching "${integrityFilter}" filter.`}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-8"></TableHead>
                        <TableHead className="text-xs">Item</TableHead>
                        <TableHead className="text-xs">Job</TableHead>
                        <TableHead className="text-xs text-center">Status</TableHead>
                        <TableHead className="text-xs text-center">Pricing Source</TableHead>
                        <TableHead className="text-xs text-center">Panes</TableHead>
                        <TableHead className="text-xs text-center">Issues</TableHead>
                        <TableHead className="text-xs text-center">FFL</TableHead>
                        <TableHead className="text-xs w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredIntegrity.map((item) => {
                        const expanded = expandedItems.has(item.itemId);
                        return (
                          <>
                            <TableRow key={item.itemId} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleExpand(item.itemId)} data-testid={`integrity-row-${item.itemId}`}>
                              <TableCell className="w-8">
                                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </TableCell>
                              <TableCell>
                                <div className="font-medium text-sm">{item.itemName}</div>
                                <div className="text-[10px] text-muted-foreground">{item.category}</div>
                              </TableCell>
                              <TableCell className="text-sm">{item.jobName}</TableCell>
                              <TableCell className="text-center">
                                <Badge className={`text-[10px] ${resolutionColor[item.resolutionState]}`} data-testid={`resolution-${item.itemId}`}>
                                  {item.resolutionState}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className={`text-[10px] ${pricingSourceColor[item.pricingSource.type]}`} data-testid={`pricing-source-${item.itemId}`}>
                                  {item.pricingSource.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center text-sm font-mono">{item.totalOverrides}</TableCell>
                              <TableCell className="text-center text-sm font-mono">
                                {item.invalidPaneCount > 0 ? (
                                  <span className="text-red-600 font-semibold">{item.invalidPaneCount}</span>
                                ) : (
                                  <span className="text-green-600">0</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center text-xs font-mono">{item.heightFromFloor ?? "—"}</TableCell>
                              <TableCell>
                                <Link href={`/job/${item.jobId}`}>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" data-testid={`nav-to-item-${item.itemId}`}>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </Button>
                                </Link>
                              </TableCell>
                            </TableRow>
                            {expanded && (
                              <TableRow key={`${item.itemId}-detail`} className="bg-muted/30">
                                <TableCell colSpan={9}>
                                  <div className="py-2 px-4 space-y-2">
                                    <div className="text-xs text-muted-foreground" data-testid={`pricing-explanation-${item.itemId}`}>
                                      <Eye className="w-3 h-3 inline mr-1" />
                                      <strong>Pricing:</strong> {item.pricingSource.explanation}
                                    </div>
                                    <div className="space-y-1">
                                      {item.paneDetails.map(pd => (
                                        <div key={pd.paneIndex} className={`flex items-center gap-2 text-xs p-1.5 rounded ${pd.isValid ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"}`} data-testid={`pane-detail-${item.itemId}-${pd.paneIndex}`}>
                                          {pd.isValid
                                            ? <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                                            : <XCircle className="w-3 h-3 text-red-500 shrink-0" />
                                          }
                                          <span className="font-medium">Pane {pd.paneIndex + 1}:</span>
                                          <span className="font-mono">{pd.iguType} / {pd.glassType} / {pd.thickness}</span>
                                          {pd.issues.length > 0 && (
                                            <span className="text-red-600 dark:text-red-400">— {pd.issues.join("; ")}</span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="conflicts">
            {auditQuery.isLoading ? (
              <div className="text-sm text-muted-foreground p-4">Loading conflict analysis...</div>
            ) : !audit || audit.duplicates.length === 0 ? (
              <Card data-testid="no-conflicts-card">
                <CardContent className="p-6 text-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-medium">No Duplicate or Conflicting Combinations Detected</p>
                  <p className="text-xs text-muted-foreground mt-1">The glass library has no duplicate entries. All {audit?.totalEntries ?? 0} combinations are unique.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <Card className="border-red-200 dark:border-red-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-red-600 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      {audit.duplicates.length} Duplicate Group(s) Detected
                      {audit.conflictCount > 0 && (
                        <Badge className="bg-red-100 text-red-700 text-[10px]">{audit.conflictCount} price conflict(s)</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {audit.duplicates.map((dg, idx) => (
                      <div key={idx} className="border rounded p-3 mb-3" data-testid={`duplicate-group-${idx}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium">{dg.key.replace("||", " → ")}</span>
                          {dg.hasPriceConflict && <Badge className="bg-red-100 text-red-700 text-[10px]">Price Conflict</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {dg.entries.length} entries with this combination.
                          {dg.hasPriceConflict && " Different pricing detected for the same thickness."}
                        </div>
                        <div className="mt-2 text-xs font-mono">
                          {Object.entries(dg.prices).map(([t, prices]) => (
                            <div key={t}>
                              {t}: {prices.map(p => `$${p.toFixed(2)}`).join(", ")}
                              {new Set(prices).size > 1 && <span className="text-red-500 ml-1">⚠ conflict</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
