import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { BookOpen, Plus, Pencil, Trash2, ChevronRight, ChevronDown, Settings2, Wrench, Package, Filter, Camera, ImageIcon, X, List, Star, Circle, CircleCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type {
  LibraryEntry, FrameConfiguration, ConfigurationProfile,
  ConfigurationAccessory, ConfigurationLabor,
} from "@shared/schema";
import { IGU_INFO, getThicknessColumnsForFamily } from "@shared/glass-library";
import { HANDLE_CATEGORIES, LOCK_CATEGORIES, WINDOW_CATEGORIES } from "@shared/item-options";

const CATEGORY_OPTIONS = [
  { value: "windows-standard", label: "Standard Window" },
  { value: "sliding-window", label: "Sliding Window" },
  { value: "sliding-door", label: "Sliding Door" },
  { value: "entrance-door", label: "Entrance Door" },
  { value: "hinge-door", label: "Hinge Door" },
  { value: "french-door", label: "French Door" },
  { value: "bifold-door", label: "Bifold Door" },
  { value: "stacker-door", label: "Stacker Door" },
  { value: "bay-window", label: "Bay Window" },
];

type LibraryTab = "glass" | "frame_type" | "frame_color" | "hardware" | "liner_type" | "wanz_bar" | "direct_materials" | "manufacturing_labour" | "site-costs" | "profile_roles" | "ll_mild_steel" | "ll_aluminium" | "ll_stainless_steel" | "ll_corten" | "ll_galvanised_steel";

const LL_FAMILY_TABS: { tab: LibraryTab; label: string; family: string }[] = [
  { tab: "ll_mild_steel", label: "Mild Steel", family: "Mild Steel" },
  { tab: "ll_aluminium", label: "Aluminium", family: "Aluminium" },
  { tab: "ll_stainless_steel", label: "Stainless Steel", family: "Stainless Steel" },
  { tab: "ll_galvanised_steel", label: "Galvanised Steel", family: "Galvanised Steel" },
  { tab: "ll_corten", label: "Corten", family: "Corten" },
];

const DIVISION_CODES = ["LJ", "LE", "LL"] as const;
type DivisionCode = typeof DIVISION_CODES[number];

type CategoryOwnershipEntry = {
  tab: LibraryTab;
  label: string;
  owner: DivisionCode | "platform";
  shared: boolean;
  justification: string;
};

const CATEGORY_OWNERSHIP: CategoryOwnershipEntry[] = [
  {
    tab: "direct_materials",
    label: "Direct Materials",
    owner: "LJ",
    shared: false,
    justification: "Aluminium extrusion profiles and accessories are specific to joinery window/door fabrication.",
  },
  {
    tab: "manufacturing_labour",
    label: "Manufacturing Labour",
    owner: "LJ",
    shared: false,
    justification: "Fabrication tasks, assembly operations, and glazing time bands are specific to joinery manufacturing.",
  },
  {
    tab: "glass",
    label: "Glass",
    owner: "LJ",
    shared: false,
    justification: "IGU glass types, thickness matrices, and R-value data are specific to joinery window/door products.",
  },
  {
    tab: "frame_type",
    label: "Frame Types",
    owner: "LJ",
    shared: false,
    justification: "Window and door frame configurations (sliding, bifold, entrance, etc.) are joinery-specific product types.",
  },
  {
    tab: "frame_color",
    label: "Frame Colors",
    owner: "LJ",
    shared: false,
    justification: "Powder coating and finish options apply to aluminium joinery frames only.",
  },
  {
    tab: "hardware",
    label: "Hardware",
    owner: "LJ",
    shared: false,
    justification: "Handles, locks, and fittings are category-specific to joinery window/door products.",
  },
  {
    tab: "liner_type",
    label: "Liner Types",
    owner: "LJ",
    shared: false,
    justification: "Interior liner options are specific to joinery window installations.",
  },
  {
    tab: "wanz_bar",
    label: "Wanz Bar",
    owner: "LJ",
    shared: false,
    justification: "WANZ Sill Support Bar defaults apply only to joinery window sill details.",
  },
  {
    tab: "profile_roles",
    label: "Profile Roles",
    owner: "LJ",
    shared: false,
    justification: "Profile role dictionary (outer-frame, mullion, bead, etc.) defines aluminium extrusion roles for joinery.",
  },
  ...LL_FAMILY_TABS.map(ft => ({
    tab: ft.tab,
    label: ft.label,
    owner: "LL" as DivisionCode,
    shared: false,
    justification: `${ft.family} sheet materials are specific to laser cutting operations (LL).`,
  })),
  {
    tab: "site-costs",
    label: "Site Costs",
    owner: "LJ",
    shared: false,
    justification: "LJ site costs are LJ-specific. Each division will have its own site cost structure when needed.",
  },
];

const ALL_LIBRARY_TABS: { value: LibraryTab; label: string }[] =
  CATEGORY_OWNERSHIP.map(c => ({ value: c.tab, label: `${c.owner} – ${c.label}` }));

function getVisibleTabs(divisionCode: string | null): { value: LibraryTab; label: string }[] {
  if (!divisionCode) return ALL_LIBRARY_TABS;
  const visible = CATEGORY_OWNERSHIP.filter(
    c => c.owner === divisionCode || c.shared
  );
  return visible.map(c => ({ value: c.tab, label: c.label }));
}

function useLibraryEntries(type: string, divisionCode?: string | null) {
  return useQuery<LibraryEntry[]>({
    queryKey: ["/api/library", type, divisionCode ?? "all"],
    queryFn: async () => {
      let url = `/api/library?type=${encodeURIComponent(type)}`;
      if (divisionCode) url += `&divisionCode=${encodeURIComponent(divisionCode)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
}

function ScopeBadge({ entry }: { entry: LibraryEntry }) {
  const scope = entry.divisionScope;
  return (
    <Badge
      variant={scope ? "outline" : "secondary"}
      className="text-[10px]"
      data-testid={`badge-scope-${entry.id}`}
    >
      {scope || "Shared"}
    </Badge>
  );
}

function DivisionScopeSelector({ divisionCode, onChange }: { divisionCode: string | null; onChange: (code: string | null) => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid="division-scope-selector">
      <Filter className="w-4 h-4 text-muted-foreground" />
      <span className="text-sm font-medium text-muted-foreground">Division Scope:</span>
      <div className="flex gap-1 flex-wrap">
        <Button
          size="sm"
          variant={divisionCode === null ? "default" : "outline"}
          className="h-7 px-3 text-xs"
          onClick={() => onChange(null)}
          data-testid="button-scope-all"
        >
          All
        </Button>
        {DIVISION_CODES.map((code) => (
          <Button
            key={code}
            size="sm"
            variant={divisionCode === code ? "default" : "outline"}
            className="h-7 px-3 text-xs"
            onClick={() => onChange(code)}
            data-testid={`button-scope-${code}`}
          >
            {code}
          </Button>
        ))}
      </div>
      {divisionCode && (
        <Badge variant="secondary" className="text-xs" data-testid="badge-active-scope">
          Showing: {divisionCode}
        </Badge>
      )}
    </div>
  );
}

function DivisionScopeField({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <Label>Division Scope</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger data-testid="select-entry-scope">
          <SelectValue placeholder="Shared (all divisions)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__shared__">Shared (all divisions)</SelectItem>
          {DIVISION_CODES.map((code) => (
            <SelectItem key={code} value={code}>{code}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {disabled && <p className="text-xs text-muted-foreground mt-1">Scope is set on creation for this entry type</p>}
    </div>
  );
}

export default function Library() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const [activeTab, setActiveTab] = useState<LibraryTab>("direct_materials");

  const parsedDivision = new URLSearchParams(searchString).get("division");
  const validDivision = parsedDivision && (DIVISION_CODES as readonly string[]).includes(parsedDivision) ? parsedDivision : null;
  const [selectedDivision, setSelectedDivision] = useState<string | null>(validDivision);

  const visibleTabs = getVisibleTabs(selectedDivision);

  useEffect(() => {
    setSelectedDivision(validDivision);
  }, [validDivision]);

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some(t => t.value === activeTab)) {
      setActiveTab(visibleTabs[0].value);
    }
  }, [selectedDivision, visibleTabs, activeTab]);

  function setDivisionAndUrl(code: string | null) {
    setSelectedDivision(code);
    const params = new URLSearchParams(searchString);
    if (code) {
      params.set("division", code);
    } else {
      params.delete("division");
    }
    const qs = params.toString();
    navigate(`/library${qs ? `?${qs}` : ""}`, { replace: true });
  }

  return (
    <div className="flex flex-col h-full bg-background" data-testid="library-page">
      <header className="border-b px-4 sm:px-6 py-3 flex items-center justify-between gap-3 bg-card shrink-0 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary shrink-0">
            <BookOpen className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight" data-testid="text-library-title">
              Item Library
            </h1>
            <p className="text-[11px] text-muted-foreground leading-tight hidden sm:block">Manage reference data for quotes</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="mb-4">
          <DivisionScopeSelector divisionCode={selectedDivision} onChange={setDivisionAndUrl} />
        </div>

        {visibleTabs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground" data-testid="empty-division-message">
            <p className="text-lg font-medium">No library categories for this division yet</p>
            <p className="text-sm mt-1">Categories will appear here when they are configured for this division.</p>
          </div>
        ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LibraryTab)}>
          <TabsList className="mb-4 overflow-x-auto flex-wrap" data-testid="library-tabs">
            {visibleTabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} data-testid={`tab-${tab.value}`}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="glass">
            <GlassSection divisionCode={selectedDivision} />
          </TabsContent>
          <TabsContent value="frame_type">
            <FrameTypeSection divisionCode={selectedDivision} />
          </TabsContent>
          <TabsContent value="frame_color">
            <SimpleSection type="frame_color" title="Frame Colors" fields={["value", "label", "supplierCode", "priceProvision"]} divisionCode={selectedDivision} />
          </TabsContent>
          <TabsContent value="hardware">
            <HardwareSection divisionCode={selectedDivision} />
          </TabsContent>
          <TabsContent value="liner_type">
            <LinerTypeSection divisionCode={selectedDivision} />
          </TabsContent>
          <TabsContent value="wanz_bar">
            <WanzBarSection divisionCode={selectedDivision} />
          </TabsContent>
          <TabsContent value="direct_materials">
            <DirectMaterialsSection divisionCode={selectedDivision} />
          </TabsContent>
          <TabsContent value="manufacturing_labour">
            <ManufacturingLabourSection divisionCode={selectedDivision} />
          </TabsContent>
          <TabsContent value="site-costs">
            <SiteCostsContent divisionCode={selectedDivision} />
          </TabsContent>
          {LL_FAMILY_TABS.map(ft => (
            <TabsContent key={ft.tab} value={ft.tab}>
              <SheetMaterialsSection materialFamily={ft.family} />
            </TabsContent>
          ))}
          <TabsContent value="profile_roles">
            <ProfileRoleDictionarySection />
          </TabsContent>
        </Tabs>
        )}
      </div>
    </div>
  );
}

function GlassTypeCollapsible({ iguType, info, items, onEdit, onDelete }: {
  iguType: string;
  info: { label: string; rValue: number | null } | undefined;
  items: LibraryEntry[];
  onEdit: (e: LibraryEntry) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const thicknessCols = getThicknessColumnsForFamily(iguType);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="text-sm flex items-center gap-2">
              {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              {info?.label || iguType}
              <Badge variant="outline" className="text-[10px]">{items.length} combos</Badge>
              {info && info.rValue != null && (
                <Badge variant="outline">R={info.rValue}</Badge>
              )}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Glass Combination</TableHead>
                    {thicknessCols.map((t) => (
                      <TableHead key={t} className="text-right">{t}</TableHead>
                    ))}
                    <TableHead>Scope</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((entry) => {
                    const d = entry.data as any;
                    return (
                      <TableRow key={entry.id} data-testid={`row-glass-${entry.id}`}>
                        <TableCell className="font-medium text-sm">{d.combo}</TableCell>
                        {thicknessCols.map((t) => (
                          <TableCell key={t} className="text-right font-mono text-sm">
                            {d.prices[t] != null ? `$${d.prices[t].toFixed(2)}` : "—"}
                          </TableCell>
                        ))}
                        <TableCell><ScopeBadge entry={entry} /></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(entry)} data-testid={`button-edit-glass-${entry.id}`}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(entry.id)} data-testid={`button-delete-glass-${entry.id}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function GlassSection({ divisionCode }: { divisionCode?: string | null }) {
  const { toast } = useToast();
  const { data: entries = [], isLoading } = useLibraryEntries("glass", divisionCode);
  const [editEntry, setEditEntry] = useState<LibraryEntry | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/library/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      toast({ title: "Glass entry deleted" });
      setDeleteId(null);
    },
  });

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

  const grouped: Record<string, LibraryEntry[]> = {};
  for (const e of entries) {
    const d = e.data as any;
    if (!grouped[d.iguType]) grouped[d.iguType] = [];
    grouped[d.iguType].push(e);
  }

  return (
    <div className="space-y-6" data-testid="section-glass">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Glass Pricing Library</h2>
          <p className="text-sm text-muted-foreground">{entries.length} entries across {Object.keys(grouped).length} IGU types</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-glass">
          <Plus className="w-4 h-4 mr-1.5" /> Add Entry
        </Button>
      </div>

      {Object.entries(grouped).map(([iguType, items]) => {
        const info = IGU_INFO[iguType as keyof typeof IGU_INFO];
        return (
          <GlassTypeCollapsible key={iguType} iguType={iguType} info={info} items={items} onEdit={setEditEntry} onDelete={setDeleteId} />
        );
      })}

      {(showAdd || editEntry) && (
        <GlassDialog
          entry={editEntry}
          divisionCode={divisionCode}
          onClose={() => { setShowAdd(false); setEditEntry(null); }}
        />
      )}

      <DeleteConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

function GlassDialog({ entry, divisionCode, onClose }: { entry: LibraryEntry | null; divisionCode?: string | null; onClose: () => void }) {
  const { toast } = useToast();
  const d = entry ? (entry.data as any) : {};
  const [iguType, setIguType] = useState(d.iguType || "EnergySaver");
  const [combo, setCombo] = useState(d.combo || "");
  const [scopeValue, setScopeValue] = useState(entry?.divisionScope || divisionCode || "__shared__");

  const buildPriceState = (igu: string, existingPrices?: Record<string, number>) => {
    const cols = getThicknessColumnsForFamily(igu);
    const result: Record<string, string> = {};
    for (const c of cols) {
      result[c] = existingPrices?.[c]?.toString() || "";
    }
    return result;
  };

  const [prices, setPrices] = useState<Record<string, string>>(() => buildPriceState(d.iguType || "EnergySaver", d.prices));

  const handleIguTypeChange = (newType: string) => {
    setIguType(newType);
    setPrices(buildPriceState(newType, d.iguType === newType ? d.prices : undefined));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const priceObj: Record<string, number> = {};
      for (const [k, v] of Object.entries(prices)) {
        if (v.trim()) priceObj[k] = parseFloat(v);
      }
      const data = { iguType, combo, prices: priceObj };
      const divisionScope = scopeValue === "__shared__" ? null : scopeValue;
      if (entry) {
        await apiRequest("PATCH", `/api/library/${entry.id}`, { data, divisionScope });
      } else {
        await apiRequest("POST", "/api/library", { type: "glass", data, sortOrder: 0, divisionScope });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      toast({ title: entry ? "Glass entry updated" : "Glass entry added" });
      onClose();
    },
  });

  const thicknessCols = getThicknessColumnsForFamily(iguType);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg" data-testid="dialog-glass">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit" : "Add"} Glass Entry</DialogTitle>
          <DialogDescription>Configure glass combination and pricing per thickness</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>IGU Type</Label>
            <Select value={iguType} onValueChange={handleIguTypeChange}>
              <SelectTrigger data-testid="select-dialog-igu">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EnergySaver">EnergySaver™</SelectItem>
                <SelectItem value="LightBridge">LightBridge™</SelectItem>
                <SelectItem value="VLamThermotech">VLam Thermotech</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Glass Combination</Label>
            <Input
              value={combo}
              onChange={(e) => setCombo(e.target.value)}
              placeholder="e.g. Clear // EnergySaver"
              data-testid="input-glass-combo"
            />
          </div>
          <div>
            <Label className="mb-2 block">Prices per Thickness ($/m²)</Label>
            <div className="grid grid-cols-3 gap-3">
              {thicknessCols.map((t) => (
                <div key={t}>
                  <Label className="text-xs text-muted-foreground">{t}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={prices[t] || ""}
                    onChange={(e) => setPrices({ ...prices, [t]: e.target.value })}
                    placeholder="0.00"
                    data-testid={`input-price-${t.replace(/\./g, "p").replace("/", "-")}`}
                  />
                </div>
              ))}
            </div>
          </div>
          <DivisionScopeField value={scopeValue} onChange={setScopeValue} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!combo.trim() || saveMutation.isPending}
            data-testid="button-save-glass"
          >
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const PROFILE_ROLES = [
  "outer-frame", "sash-frame", "mullion", "bead", "spacer",
  "door-frame", "transom", "sidelight-mullion",
];

const LENGTH_FORMULAS = [
  { value: "perimeter", label: "Perimeter (2W+2H)" },
  { value: "width", label: "Width" },
  { value: "height", label: "Height" },
];

const DEFAULT_LABOR_TASK_NAMES = [
  "cutting", "milling", "drilling", "assembly-crimped", "assembly-screwed", "glazing",
];

function FrameTypeSection({ divisionCode }: { divisionCode?: string | null }) {
  const { toast } = useToast();
  const { data: entries = [], isLoading } = useLibraryEntries("frame_type", divisionCode);
  const [editEntry, setEditEntry] = useState<LibraryEntry | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedFt, setExpandedFt] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/library/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      toast({ title: "Frame type deleted" });
      setDeleteId(null);
    },
  });

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-4" data-testid="section-frame-types">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Frame Types & Configurations</h2>
          <p className="text-sm text-muted-foreground">{entries.length} frame types — expand to manage configurations, profiles, accessories & labor</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-frame-type">
          <Plus className="w-4 h-4 mr-1.5" /> Add Frame Type
        </Button>
      </div>

      {entries.map((entry) => {
        const d = entry.data as any;
        const isOpen = expandedFt === entry.id;
        return (
          <Card key={entry.id}>
            <Collapsible open={isOpen} onOpenChange={() => setExpandedFt(isOpen ? null : entry.id)}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3" data-testid={`row-frame-type-${entry.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ChevronRight className={`w-4 h-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                      <div>
                        <CardTitle className="text-sm">{d.label}</CardTitle>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(d.categories || []).map((c: string) => (
                            <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                          ))}
                          <ScopeBadge entry={entry} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditEntry(entry)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(entry.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <ConfigurationsPanel frameTypeId={entry.id} />
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}

      {entries.length === 0 && (
        <Card><CardContent className="text-center text-muted-foreground py-8">No frame types. Click "Add" to create an entry.</CardContent></Card>
      )}

      {(showAdd || editEntry) && (
        <FrameTypeDialog entry={editEntry} divisionCode={divisionCode} onClose={() => { setShowAdd(false); setEditEntry(null); }} />
      )}
      <DeleteConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

function ConfigurationsPanel({ frameTypeId }: { frameTypeId: string }) {
  const { toast } = useToast();
  const { data: configs = [], isLoading } = useQuery<FrameConfiguration[]>({
    queryKey: ["/api/frame-types", frameTypeId, "configurations"],
    queryFn: async () => {
      const res = await fetch(`/api/frame-types/${frameTypeId}/configurations`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
  const [showAdd, setShowAdd] = useState(false);
  const [editConfig, setEditConfig] = useState<FrameConfiguration | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedConfig, setExpandedConfig] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/configurations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/frame-types", frameTypeId, "configurations"] });
      toast({ title: "Configuration deleted" });
      setDeleteId(null);
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading configurations...</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-1.5"><Settings2 className="w-4 h-4" /> Configurations</h3>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)} data-testid="button-add-config">
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Configuration
        </Button>
      </div>

      {configs.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">No configurations yet. Add one or seed defaults.</p>
      )}

      {configs.map((cfg) => {
        const isOpen = expandedConfig === cfg.id;
        return (
          <div key={cfg.id} className="border rounded-md">
            <Collapsible open={isOpen} onOpenChange={() => setExpandedConfig(isOpen ? null : cfg.id)}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30" data-testid={`row-config-${cfg.id}`}>
                  <div className="flex items-center gap-2">
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                    <div>
                      <span className="text-sm font-medium">{cfg.name}</span>
                      {cfg.description && <p className="text-xs text-muted-foreground">{cfg.description}</p>}
                    </div>
                    <Badge variant="secondary" className="text-xs">${cfg.defaultSalePricePerSqm}/m²</Badge>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditConfig(cfg)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteId(cfg.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t p-3 space-y-4">
                  <ProfilesPanel configurationId={cfg.id} />
                  <AccessoriesPanel configurationId={cfg.id} />
                  <LaborPanel configurationId={cfg.id} />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        );
      })}

      {(showAdd || editConfig) && (
        <ConfigDialog
          frameTypeId={frameTypeId}
          config={editConfig}
          onClose={() => { setShowAdd(false); setEditConfig(null); }}
        />
      )}
      <DeleteConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} isPending={deleteMutation.isPending} />
    </div>
  );
}

function ConfigDialog({ frameTypeId, config, onClose }: { frameTypeId: string; config: FrameConfiguration | null; onClose: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState(config?.name || "");
  const [description, setDescription] = useState(config?.description || "");
  const [defaultSalePrice, setDefaultSalePrice] = useState((config?.defaultSalePricePerSqm || 550).toString());

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = { name, description, defaultSalePricePerSqm: parseInt(defaultSalePrice) || 550 };
      if (config) {
        await apiRequest("PATCH", `/api/configurations/${config.id}`, body);
      } else {
        await apiRequest("POST", `/api/frame-types/${frameTypeId}/configurations`, body);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/frame-types", frameTypeId, "configurations"] });
      toast({ title: config ? "Configuration updated" : "Configuration added" });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent data-testid="dialog-config">
        <DialogHeader>
          <DialogTitle>{config ? "Edit" : "Add"} Configuration</DialogTitle>
          <DialogDescription>Define the configuration name and default sale price</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Awning, 1 Awning + 1 Fixed" data-testid="input-config-name" />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" data-testid="input-config-desc" />
          </div>
          <div>
            <Label>Default Sale Price ($/m²)</Label>
            <Input type="number" step="5" min="500" max="750" value={defaultSalePrice} onChange={(e) => setDefaultSalePrice(e.target.value)} data-testid="input-config-price" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!name.trim() || saveMutation.isPending} data-testid="button-save-config">
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProfilesPanel({ configurationId }: { configurationId: string }) {
  const { toast } = useToast();
  const { data: profiles = [], isLoading } = useQuery<ConfigurationProfile[]>({
    queryKey: ["/api/configurations", configurationId, "profiles"],
    queryFn: async () => {
      const res = await fetch(`/api/configurations/${configurationId}/profiles`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
  const [showAdd, setShowAdd] = useState(false);
  const [editProfile, setEditProfile] = useState<ConfigurationProfile | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/profiles/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configurations", configurationId, "profiles"] });
      toast({ title: "Profile deleted" });
      setDeleteId(null);
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Profiles ({profiles.length})</h4>
        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowAdd(true)} data-testid="button-add-profile">
          <Plus className="w-3 h-3 mr-1" /> Add
        </Button>
      </div>
      {isLoading ? <p className="text-xs text-muted-foreground">Loading...</p> : profiles.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">No profiles</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Mould #</TableHead>
                <TableHead className="text-xs">Role</TableHead>
                <TableHead className="text-xs text-right">kg/m</TableHead>
                <TableHead className="text-xs text-right">$/kg USD</TableHead>
                <TableHead className="text-xs text-right">Qty/Set</TableHead>
                <TableHead className="text-xs">Length</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <TableRow key={p.id} data-testid={`row-profile-${p.id}`}>
                  <TableCell className="font-mono text-xs">{p.mouldNumber}</TableCell>
                  <TableCell className="text-xs">{p.role}</TableCell>
                  <TableCell className="text-xs text-right font-mono">{p.kgPerMetre}</TableCell>
                  <TableCell className="text-xs text-right font-mono">{p.pricePerKgUsd}</TableCell>
                  <TableCell className="text-xs text-right">{p.quantityPerSet}</TableCell>
                  <TableCell className="text-xs">{p.lengthFormula}</TableCell>
                  <TableCell>
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditProfile(p)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteId(p.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {(showAdd || editProfile) && (
        <ProfileDialog configurationId={configurationId} profile={editProfile} onClose={() => { setShowAdd(false); setEditProfile(null); }} />
      )}
      <DeleteConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} isPending={deleteMutation.isPending} />
    </div>
  );
}

function ProfileDialog({ configurationId, profile, onClose }: { configurationId: string; profile: ConfigurationProfile | null; onClose: () => void }) {
  const { toast } = useToast();
  const { data: roleEntries = [] } = useLibraryEntries("profile_role");
  const managedRoles = roleEntries.map((e) => (e.data as any).name as string).filter(Boolean);
  const roleOptions = managedRoles.length > 0 ? managedRoles : PROFILE_ROLES;
  const [mouldNumber, setMouldNumber] = useState(profile?.mouldNumber || "");
  const [role, setRole] = useState(profile?.role || "outer-frame");
  const [kgPerMetre, setKgPerMetre] = useState(profile?.kgPerMetre || "");
  const [pricePerKgUsd, setPricePerKgUsd] = useState(profile?.pricePerKgUsd || "");
  const [quantityPerSet, setQuantityPerSet] = useState((profile?.quantityPerSet || 1).toString());
  const [lengthFormula, setLengthFormula] = useState(profile?.lengthFormula || "perimeter");
  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = { mouldNumber, role, kgPerMetre, pricePerKgUsd, quantityPerSet: parseInt(quantityPerSet) || 1, lengthFormula };
      if (profile) {
        await apiRequest("PATCH", `/api/profiles/${profile.id}`, body);
      } else {
        await apiRequest("POST", `/api/configurations/${configurationId}/profiles`, body);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configurations", configurationId, "profiles"] });
      toast({ title: profile ? "Profile updated" : "Profile added" });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg" data-testid="dialog-profile">
        <DialogHeader>
          <DialogTitle>{profile ? "Edit" : "Add"} Profile</DialogTitle>
          <DialogDescription>Aluminium profile details for this configuration</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Mould Number</Label>
            <Input value={mouldNumber} onChange={(e) => setMouldNumber(e.target.value)} placeholder="e.g. E0026001" data-testid="input-profile-mould" />
          </div>
          <div>
            <Label className="text-xs">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger data-testid="select-profile-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                {roleOptions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">kg/m</Label>
            <Input type="number" step="0.001" value={kgPerMetre} onChange={(e) => setKgPerMetre(e.target.value)} data-testid="input-profile-kgm" />
          </div>
          <div>
            <Label className="text-xs">Price/kg (USD)</Label>
            <Input type="number" step="0.01" value={pricePerKgUsd} onChange={(e) => setPricePerKgUsd(e.target.value)} data-testid="input-profile-price" />
          </div>
          <div>
            <Label className="text-xs">Qty per Set</Label>
            <Input type="number" min="1" value={quantityPerSet} onChange={(e) => setQuantityPerSet(e.target.value)} data-testid="input-profile-qty" />
          </div>
          <div>
            <Label className="text-xs">Length Formula</Label>
            <Select value={lengthFormula} onValueChange={setLengthFormula}>
              <SelectTrigger data-testid="select-profile-formula"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LENGTH_FORMULAS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!mouldNumber.trim() || !kgPerMetre || saveMutation.isPending} data-testid="button-save-profile">
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccessoriesPanel({ configurationId }: { configurationId: string }) {
  const { toast } = useToast();
  const { data: accessories = [], isLoading } = useQuery<ConfigurationAccessory[]>({
    queryKey: ["/api/configurations", configurationId, "accessories"],
    queryFn: async () => {
      const res = await fetch(`/api/configurations/${configurationId}/accessories`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
  const [showAdd, setShowAdd] = useState(false);
  const [editAcc, setEditAcc] = useState<ConfigurationAccessory | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/accessories/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configurations", configurationId, "accessories"] });
      toast({ title: "Accessory deleted" });
      setDeleteId(null);
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Wrench className="w-3.5 h-3.5" /> Accessories ({accessories.length})</h4>
        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowAdd(true)} data-testid="button-add-accessory">
          <Plus className="w-3 h-3 mr-1" /> Add
        </Button>
      </div>
      {isLoading ? <p className="text-xs text-muted-foreground">Loading...</p> : accessories.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">No accessories</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Code</TableHead>
                <TableHead className="text-xs text-right">$/USD</TableHead>
                <TableHead className="text-xs text-right">Qty/Set</TableHead>
                <TableHead className="text-xs">Scaling</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accessories.map((a) => (
                <TableRow key={a.id} data-testid={`row-accessory-${a.id}`}>
                  <TableCell className="text-xs">{a.name}</TableCell>
                  <TableCell className="font-mono text-xs">{a.code}</TableCell>
                  <TableCell className="text-xs text-right font-mono">{a.priceUsd}</TableCell>
                  <TableCell className="text-xs text-right">{a.quantityPerSet}</TableCell>
                  <TableCell className="text-xs">
                    <Badge variant={a.scalingType === "per-linear-metre" ? "default" : "outline"} className="text-xs">
                      {a.scalingType === "per-linear-metre" ? "per m" : "fixed"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditAcc(a)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteId(a.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {(showAdd || editAcc) && (
        <AccessoryDialog configurationId={configurationId} accessory={editAcc} onClose={() => { setShowAdd(false); setEditAcc(null); }} />
      )}
      <DeleteConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} isPending={deleteMutation.isPending} />
    </div>
  );
}

function AccessoryDialog({ configurationId, accessory, onClose }: { configurationId: string; accessory: ConfigurationAccessory | null; onClose: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState(accessory?.name || "");
  const [code, setCode] = useState(accessory?.code || "");
  const [colour, setColour] = useState(accessory?.colour || "");
  const [priceUsd, setPriceUsd] = useState(accessory?.priceUsd || "");
  const [quantityPerSet, setQuantityPerSet] = useState(accessory?.quantityPerSet || "1");
  const [scalingType, setScalingType] = useState(accessory?.scalingType || "fixed");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = { name, code, colour, priceUsd, quantityPerSet, scalingType };
      if (accessory) {
        await apiRequest("PATCH", `/api/accessories/${accessory.id}`, body);
      } else {
        await apiRequest("POST", `/api/configurations/${configurationId}/accessories`, body);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configurations", configurationId, "accessories"] });
      toast({ title: accessory ? "Accessory updated" : "Accessory added" });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent data-testid="dialog-accessory">
        <DialogHeader>
          <DialogTitle>{accessory ? "Edit" : "Add"} Accessory</DialogTitle>
          <DialogDescription>Hardware, gaskets, connectors and other accessories</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rubber Gasket" data-testid="input-acc-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Code</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 0808102" data-testid="input-acc-code" />
            </div>
            <div>
              <Label className="text-xs">Colour</Label>
              <Input value={colour} onChange={(e) => setColour(e.target.value)} placeholder="e.g. Black" data-testid="input-acc-colour" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Price (USD)</Label>
              <Input type="number" step="0.01" value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)} data-testid="input-acc-price" />
            </div>
            <div>
              <Label className="text-xs">Qty per Set</Label>
              <Input type="number" step="0.1" value={quantityPerSet} onChange={(e) => setQuantityPerSet(e.target.value)} data-testid="input-acc-qty" />
            </div>
            <div>
              <Label className="text-xs">Scaling Type</Label>
              <Select value={scalingType} onValueChange={setScalingType}>
                <SelectTrigger data-testid="select-acc-scaling"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed per set</SelectItem>
                  <SelectItem value="per-linear-metre">Per linear metre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!name.trim() || !priceUsd || saveMutation.isPending} data-testid="button-save-accessory">
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LaborPanel({ configurationId }: { configurationId: string }) {
  const { toast } = useToast();
  const { data: laborTasks = [], isLoading } = useQuery<ConfigurationLabor[]>({
    queryKey: ["/api/configurations", configurationId, "labor"],
    queryFn: async () => {
      const res = await fetch(`/api/configurations/${configurationId}/labor`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
  const [showAdd, setShowAdd] = useState(false);
  const [editLabor, setEditLabor] = useState<ConfigurationLabor | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/labor/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configurations", configurationId, "labor"] });
      toast({ title: "Labor task deleted" });
      setDeleteId(null);
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Wrench className="w-3.5 h-3.5" /> Labor ({laborTasks.length})</h4>
        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowAdd(true)} data-testid="button-add-labor">
          <Plus className="w-3 h-3 mr-1" /> Add
        </Button>
      </div>
      {isLoading ? <p className="text-xs text-muted-foreground">Loading...</p> : laborTasks.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">No labor tasks</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Task</TableHead>
                <TableHead className="text-xs text-right">Cost (NZD)</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {laborTasks.map((l) => (
                <TableRow key={l.id} data-testid={`row-labor-${l.id}`}>
                  <TableCell className="text-xs capitalize">{l.taskName.replace(/-/g, " ")}</TableCell>
                  <TableCell className="text-xs text-right font-mono">${l.costNzd}</TableCell>
                  <TableCell>
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditLabor(l)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteId(l.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {(showAdd || editLabor) && (
        <LaborDialog configurationId={configurationId} labor={editLabor} onClose={() => { setShowAdd(false); setEditLabor(null); }} />
      )}
      <DeleteConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} isPending={deleteMutation.isPending} />
    </div>
  );
}

function LaborDialog({ configurationId, labor, onClose }: { configurationId: string; labor: ConfigurationLabor | null; onClose: () => void }) {
  const { toast } = useToast();
  const [taskName, setTaskName] = useState(labor?.taskName || "cutting");
  const [customTask, setCustomTask] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [costNzd, setCostNzd] = useState(labor?.costNzd || "0");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const finalTaskName = useCustom ? customTask : taskName;
      const body = { taskName: finalTaskName, costNzd };
      if (labor) {
        await apiRequest("PATCH", `/api/labor/${labor.id}`, body);
      } else {
        await apiRequest("POST", `/api/configurations/${configurationId}/labor`, body);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configurations", configurationId, "labor"] });
      toast({ title: labor ? "Labor task updated" : "Labor task added" });
      onClose();
    },
  });

  const actualName = useCustom ? customTask : taskName;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent data-testid="dialog-labor">
        <DialogHeader>
          <DialogTitle>{labor ? "Edit" : "Add"} Labor Task</DialogTitle>
          <DialogDescription>Assembly and fabrication labor costs per set</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {!labor && (
            <div className="flex items-center gap-2">
              <Checkbox checked={useCustom} onCheckedChange={(v) => setUseCustom(!!v)} />
              <Label className="text-xs">Custom task name</Label>
            </div>
          )}
          {useCustom || labor ? (
            <div>
              <Label className="text-xs">Task Name</Label>
              <Input value={labor ? taskName : customTask} onChange={(e) => labor ? setTaskName(e.target.value) : setCustomTask(e.target.value)} placeholder="e.g. powder-coating" data-testid="input-labor-name" />
            </div>
          ) : (
            <div>
              <Label className="text-xs">Task</Label>
              <Select value={taskName} onValueChange={setTaskName}>
                <SelectTrigger data-testid="select-labor-task"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEFAULT_LABOR_TASK_NAMES.map((t) => <SelectItem key={t} value={t}>{t.replace(/-/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">Cost per Set (NZD)</Label>
            <Input type="number" step="0.01" value={costNzd} onChange={(e) => setCostNzd(e.target.value)} data-testid="input-labor-cost" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!actualName.trim() || saveMutation.isPending} data-testid="button-save-labor">
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FrameTypeDialog({ entry, divisionCode, onClose }: { entry: LibraryEntry | null; divisionCode?: string | null; onClose: () => void }) {
  const { toast } = useToast();
  const d = entry ? (entry.data as any) : {};
  const [value, setValue] = useState(d.value || "");
  const [label, setLabel] = useState(d.label || "");
  const [categories, setCategories] = useState<string[]>(d.categories || []);
  const [pricePerKg, setPricePerKg] = useState(d.pricePerKg?.toString() || "");
  const [scopeValue, setScopeValue] = useState(entry?.divisionScope || divisionCode || "__shared__");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        value, label, categories,
        pricePerKg: pricePerKg.trim() ? parseFloat(pricePerKg) : null,
      };
      const ds = scopeValue === "__shared__" ? null : scopeValue;
      if (entry) {
        await apiRequest("PATCH", `/api/library/${entry.id}`, { data, divisionScope: ds });
      } else {
        await apiRequest("POST", "/api/library", { type: "frame_type", data, sortOrder: 0, divisionScope: ds });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      toast({ title: entry ? "Frame type updated" : "Frame type added" });
      onClose();
    },
  });

  const toggleCategory = (cat: string) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent data-testid="dialog-frame-type">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit" : "Add"} Frame Type</DialogTitle>
          <DialogDescription>Configure frame type details and category associations</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Value (ID)</Label>
            <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. ES52-Window" data-testid="input-ft-value" />
          </div>
          <div>
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. ES52 Window" data-testid="input-ft-label" />
          </div>
          <div>
            <Label className="mb-2 block">Applicable Categories</Label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_OPTIONS.map((cat) => (
                <label key={cat.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={categories.includes(cat.value)}
                    onCheckedChange={() => toggleCategory(cat.value)}
                  />
                  {cat.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>Price per kg (optional)</Label>
            <Input type="number" step="0.01" value={pricePerKg} onChange={(e) => setPricePerKg(e.target.value)} placeholder="Leave empty if not set" data-testid="input-ft-price" />
          </div>
          <DivisionScopeField value={scopeValue} onChange={setScopeValue} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!value.trim() || !label.trim() || saveMutation.isPending} data-testid="button-save-frame-type">
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinerTypeSection({ divisionCode }: { divisionCode?: string | null }) {
  const { data: frameTypes = [] } = useLibraryEntries("frame_type", divisionCode);
  const allFrameTypeLabels = frameTypes.map((ft) => (ft.data as any).label as string).filter(Boolean);
  return (
    <SimpleSection
      type="liner_type"
      title="Liner Types (price per linear metre)"
      fields={["value", "label", "priceProvision"]}
      priceUnit="/lin.m"
      allFrameTypeLabels={allFrameTypeLabels}
      divisionCode={divisionCode}
    />
  );
}

function WanzBarSection({ divisionCode }: { divisionCode?: string | null }) {
  const { toast } = useToast();
  const { data: entries = [], isLoading } = useLibraryEntries("wanz_bar", divisionCode);
  const { data: frameTypes = [] } = useLibraryEntries("frame_type", divisionCode);
  const allFrameTypeLabels = frameTypes.map((ft) => (ft.data as any).label as string).filter(Boolean);
  const [editEntry, setEditEntry] = useState<LibraryEntry | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/library/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      toast({ title: "Wanz Bar entry deleted" });
      setDeleteId(null);
    },
  });


  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-4" data-testid="section-wanz-bar">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Wanz Sill Support Bars</h2>
          <p className="text-sm text-muted-foreground">{entries.length} entries · Applies to all window categories (width ≥ 600mm)</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-wanz-bar">
          <Plus className="w-4 h-4 mr-1.5" /> Add
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Section #</TableHead>
                <TableHead>Label</TableHead>
                <TableHead className="text-right">kg/m</TableHead>
                <TableHead className="text-right">Price USD/kg</TableHead>
                <TableHead className="text-right">Price NZD/lin.m</TableHead>
                <TableHead>Allocation</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const d = entry.data as any;
                return (
                  <TableRow key={entry.id} data-testid={`row-wanz-bar-${entry.id}`}>
                    <TableCell className="font-mono text-sm">{d.value || d.sectionNumber}</TableCell>
                    <TableCell className="font-medium">{d.label}</TableCell>
                    <TableCell className="text-right font-mono">{d.kgPerMetre}</TableCell>
                    <TableCell className="text-right font-mono">{d.pricePerKgUsd ? `$${d.pricePerKgUsd}` : "—"}</TableCell>
                    <TableCell className="text-right font-mono">{d.priceNzdPerLinM ? `$${d.priceNzdPerLinM}` : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{Array.isArray(d.allocations) && d.allocations.length > 0 ? d.allocations.join(", ") : "All Windows"}</TableCell>
                    <TableCell><ScopeBadge entry={entry} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditEntry(entry)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(entry.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {entries.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No entries. Click "Add" to create an entry.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(showAdd || editEntry) && (
        <WanzBarDialog entry={editEntry} allFrameTypeLabels={allFrameTypeLabels} divisionCode={divisionCode} onClose={() => { setShowAdd(false); setEditEntry(null); }} />
      )}
      <DeleteConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

function WanzBarDialog({ entry, allFrameTypeLabels, divisionCode, onClose }: { entry: LibraryEntry | null; allFrameTypeLabels: string[]; divisionCode?: string | null; onClose: () => void }) {
  const { toast } = useToast();
  const d = entry ? (entry.data as any) : {};
  const [scopeValue, setScopeValue] = useState(entry?.divisionScope || divisionCode || "__shared__");
  const [values, setValues] = useState({
    value: d.value?.toString() || "",
    label: d.label?.toString() || "",
    sectionNumber: d.sectionNumber?.toString() || d.value?.toString() || "",
    kgPerMetre: d.kgPerMetre?.toString() || "",
    pricePerKgUsd: d.pricePerKgUsd?.toString() || "0",
    priceNzdPerLinM: d.priceNzdPerLinM?.toString() || "0",
  });

  const initialAllocations: string[] = Array.isArray(d.allocations) && d.allocations.length > 0 ? d.allocations : [];
  const [selectedAllocations, setSelectedAllocations] = useState<string[]>(initialAllocations);

  function toggleAllocation(label: string) {
    setSelectedAllocations((prev) =>
      prev.includes(label) ? prev.filter((a) => a !== label) : [...prev, label]
    );
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data: Record<string, any> = {
        value: values.value || values.sectionNumber,
        label: values.label,
        sectionNumber: values.sectionNumber,
        kgPerMetre: parseFloat(values.kgPerMetre) || 0,
        pricePerKgUsd: parseFloat(values.pricePerKgUsd) || 0,
        priceNzdPerLinM: parseFloat(values.priceNzdPerLinM) || 0,
        allocations: selectedAllocations,
      };
      const ds = scopeValue === "__shared__" ? null : scopeValue;
      if (entry) {
        await apiRequest("PATCH", `/api/library/${entry.id}`, { data, divisionScope: ds });
      } else {
        await apiRequest("POST", "/api/library", { type: "wanz_bar", data, sortOrder: 0, divisionScope: ds });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      toast({ title: entry ? "Wanz Bar entry updated" : "Wanz Bar entry added" });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent data-testid="dialog-wanz-bar">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit" : "Add"} Wanz Bar Entry</DialogTitle>
          <DialogDescription>Configure the sill support bar details</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Section Number</Label>
            <Input value={values.sectionNumber} onChange={(e) => setValues({ ...values, sectionNumber: e.target.value, value: e.target.value })} placeholder="e.g. 36352" data-testid="input-wanz-bar-section" />
          </div>
          <div>
            <Label>Label</Label>
            <Input value={values.label} onChange={(e) => setValues({ ...values, label: e.target.value })} placeholder="e.g. 19mm Sill Support Bar" data-testid="input-wanz-bar-label" />
          </div>
          <div>
            <Label>Weight (kg/m)</Label>
            <Input type="number" step="0.001" value={values.kgPerMetre} onChange={(e) => setValues({ ...values, kgPerMetre: e.target.value })} placeholder="e.g. 0.525" data-testid="input-wanz-bar-kgm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Price USD/kg (Direct)</Label>
              <Input type="number" step="0.01" value={values.pricePerKgUsd} onChange={(e) => setValues({ ...values, pricePerKgUsd: e.target.value })} placeholder="0" data-testid="input-wanz-bar-price-usd" />
            </div>
            <div>
              <Label>Price NZD/lin.m (NZ Local)</Label>
              <Input type="number" step="0.01" value={values.priceNzdPerLinM} onChange={(e) => setValues({ ...values, priceNzdPerLinM: e.target.value })} placeholder="0" data-testid="input-wanz-bar-price-nzd" />
            </div>
          </div>
          {allFrameTypeLabels.length > 0 && (
            <div>
              <Label className="mb-2 block">Allocated Frame Types</Label>
              <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto" data-testid="wanz-allocation-checkboxes">
                {allFrameTypeLabels.map((ftLabel) => (
                  <div key={ftLabel} className="flex items-center gap-2">
                    <Checkbox
                      id={`wanz-alloc-${ftLabel}`}
                      checked={selectedAllocations.includes(ftLabel)}
                      onCheckedChange={() => toggleAllocation(ftLabel)}
                      data-testid={`checkbox-wanz-alloc-${ftLabel}`}
                    />
                    <label htmlFor={`wanz-alloc-${ftLabel}`} className="text-sm cursor-pointer select-none">
                      {ftLabel}
                    </label>
                  </div>
                ))}
              </div>
              {selectedAllocations.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">No frame types selected — defaults to All Windows</p>
              )}
            </div>
          )}
          <DivisionScopeField value={scopeValue} onChange={setScopeValue} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!values.label?.trim() || !values.sectionNumber?.trim() || saveMutation.isPending} data-testid="button-save-wanz-bar">
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HardwareSection({ divisionCode }: { divisionCode?: string | null }) {
  return (
    <div className="space-y-6" data-testid="section-hardware">
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Handles by Category</h2>
          <p className="text-sm text-muted-foreground">{HANDLE_CATEGORIES.length} handle categories</p>
        </div>
        {HANDLE_CATEGORIES.map((hc) => (
          <HandleCategoryCollapsible key={hc.type} handleCat={hc} divisionCode={divisionCode} />
        ))}
      </div>

      <Separator />

      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Locks by Category</h2>
          <p className="text-sm text-muted-foreground">{LOCK_CATEGORIES.length} lock categories (door products)</p>
        </div>
        {LOCK_CATEGORIES.map((lc) => (
          <LockCategoryCollapsible key={lc.type} lockCat={lc} divisionCode={divisionCode} />
        ))}
      </div>
    </div>
  );
}

function LockCategoryCollapsible({ lockCat, divisionCode }: { lockCat: typeof LOCK_CATEGORIES[number]; divisionCode?: string | null }) {
  const [open, setOpen] = useState(false);
  const { data: entries = [] } = useLibraryEntries(lockCat.type, divisionCode);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="text-sm flex items-center gap-2">
              {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              {lockCat.label}
              <Badge variant="secondary" className="text-[10px]">{entries.length} locks</Badge>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <SimpleSection type={lockCat.type} title={lockCat.label} fields={["value", "label", "priceProvision"]} divisionCode={divisionCode} />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function HandleCategoryCollapsible({ handleCat, divisionCode }: { handleCat: typeof HANDLE_CATEGORIES[number]; divisionCode?: string | null }) {
  const [open, setOpen] = useState(false);
  const { data: entries = [] } = useLibraryEntries(handleCat.type, divisionCode);
  const { data: frameTypes = [] } = useLibraryEntries("frame_type", divisionCode);
  const matchingFt = frameTypes.find((ft) => {
    const cats = (ft.data as any).categories;
    return Array.isArray(cats) && cats.includes(handleCat.categoryMatch);
  });
  const defaultAllocation = matchingFt ? (matchingFt.data as any).label : handleCat.frameTypeValue;
  const allFrameTypeLabels = frameTypes.map((ft) => (ft.data as any).label as string).filter(Boolean);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="text-sm flex items-center gap-2">
              {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              {handleCat.label}
              <Badge variant="secondary" className="text-[10px]">{entries.length} handles</Badge>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <SimpleSection type={handleCat.type} title={handleCat.label} fields={["value", "label", "priceProvision"]} defaultAllocation={defaultAllocation} allFrameTypeLabels={allFrameTypeLabels} divisionCode={divisionCode} />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function SimpleSection({ type, title, fields, priceUnit, defaultAllocation, allFrameTypeLabels, divisionCode }: { type: string; title: string; fields: string[]; priceUnit?: string; defaultAllocation?: string; allFrameTypeLabels?: string[]; divisionCode?: string | null }) {
  const { toast } = useToast();
  const { data: entries = [], isLoading } = useLibraryEntries(type, divisionCode);
  const [editEntry, setEditEntry] = useState<LibraryEntry | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const hasAllocation = !!defaultAllocation || (Array.isArray(allFrameTypeLabels) && allFrameTypeLabels.length > 0);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/library/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      toast({ title: `${title} entry deleted` });
      setDeleteId(null);
    },
  });

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

  const fieldLabels: Record<string, string> = {
    value: "Value (ID)",
    label: "Display Label",
    supplierCode: "Supplier Code",
    priceProvision: priceUnit ? `Price (${priceUnit})` : "Price Provision ($)",
  };

  function getEntryAllocations(entry: LibraryEntry): string {
    const d = entry.data as any;
    if (Array.isArray(d.allocations) && d.allocations.length > 0) {
      return d.allocations.join(", ");
    }
    return defaultAllocation || "—";
  }

  return (
    <div className="space-y-4" data-testid={`section-${type}`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{entries.length} entries</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid={`button-add-${type}`}>
          <Plus className="w-4 h-4 mr-1.5" /> Add
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {fields.map((f) => (
                  <TableHead key={f} className={f === "priceProvision" ? "text-right" : ""}>
                    {fieldLabels[f] || f}
                  </TableHead>
                ))}
                {hasAllocation && <TableHead>Allocation</TableHead>}
                <TableHead>Scope</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const d = entry.data as any;
                return (
                  <TableRow key={entry.id} data-testid={`row-${type}-${entry.id}`}>
                    {fields.map((f) => (
                      <TableCell key={f} className={f === "priceProvision" ? "text-right font-mono" : f === "value" ? "font-mono text-sm" : "font-medium"}>
                        {f === "priceProvision"
                          ? (d[f] != null ? `$${d[f]}${priceUnit || ''}` : "—")
                          : (d[f] ?? "—")}
                      </TableCell>
                    ))}
                    {hasAllocation && (
                      <TableCell className="text-sm text-muted-foreground" data-testid={`text-allocation-${entry.id}`}>{getEntryAllocations(entry)}</TableCell>
                    )}
                    <TableCell><ScopeBadge entry={entry} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditEntry(entry)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(entry.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {entries.length === 0 && (
                <TableRow><TableCell colSpan={fields.length + (hasAllocation ? 3 : 2)} className="text-center text-muted-foreground py-8">No entries. Click "Add" to create an entry.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(showAdd || editEntry) && (
        <SimpleDialog
          type={type}
          title={title}
          fields={fields}
          fieldLabels={fieldLabels}
          entry={editEntry}
          defaultAllocation={defaultAllocation}
          allFrameTypeLabels={allFrameTypeLabels}
          divisionCode={divisionCode}
          onClose={() => { setShowAdd(false); setEditEntry(null); }}
        />
      )}
      <DeleteConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

function SimpleDialog({ type, title, fields, fieldLabels, entry, defaultAllocation, allFrameTypeLabels, divisionCode, onClose }: {
  type: string;
  title: string;
  fields: string[];
  fieldLabels: Record<string, string>;
  entry: LibraryEntry | null;
  defaultAllocation?: string;
  allFrameTypeLabels?: string[];
  divisionCode?: string | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const d = entry ? (entry.data as any) : {};
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f, d[f]?.toString() || ""]))
  );
  const [scopeValue, setScopeValue] = useState(entry?.divisionScope || divisionCode || "__shared__");

  const initialAllocations: string[] = Array.isArray(d.allocations) && d.allocations.length > 0
    ? d.allocations
    : defaultAllocation ? [defaultAllocation] : [];
  const [selectedAllocations, setSelectedAllocations] = useState<string[]>(initialAllocations);

  const hasAllocationSelector = Array.isArray(allFrameTypeLabels) && allFrameTypeLabels.length > 0;

  function toggleAllocation(label: string) {
    setSelectedAllocations((prev) =>
      prev.includes(label) ? prev.filter((a) => a !== label) : [...prev, label]
    );
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data: Record<string, any> = {};
      for (const f of fields) {
        if (f === "priceProvision") {
          data[f] = values[f].trim() ? parseFloat(values[f]) : null;
        } else {
          data[f] = values[f];
        }
      }
      if (hasAllocationSelector) {
        data.allocations = selectedAllocations;
      }
      const ds = scopeValue === "__shared__" ? null : scopeValue;
      if (entry) {
        await apiRequest("PATCH", `/api/library/${entry.id}`, { data, divisionScope: ds });
      } else {
        await apiRequest("POST", "/api/library", { type, data, sortOrder: 0, divisionScope: ds });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      toast({ title: entry ? `${title} entry updated` : `${title} entry added` });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent data-testid={`dialog-${type}`}>
        <DialogHeader>
          <DialogTitle>{entry ? "Edit" : "Add"} {title} Entry</DialogTitle>
          <DialogDescription>Configure the entry details</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {fields.map((f) => (
            <div key={f}>
              <Label>{fieldLabels[f] || f}</Label>
              <Input
                type={f === "priceProvision" ? "number" : "text"}
                step={f === "priceProvision" ? "0.01" : undefined}
                value={values[f]}
                onChange={(e) => setValues({ ...values, [f]: e.target.value })}
                placeholder={f === "priceProvision" ? "Leave empty if not set" : `Enter ${(fieldLabels[f] || f).toLowerCase()}`}
                data-testid={`input-${type}-${f}`}
              />
            </div>
          ))}
          {hasAllocationSelector && (
            <div>
              <Label className="mb-2 block">Allocated Frame Types</Label>
              <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto" data-testid="allocation-checkboxes">
                {allFrameTypeLabels!.map((ftLabel) => (
                  <div key={ftLabel} className="flex items-center gap-2">
                    <Checkbox
                      id={`alloc-${ftLabel}`}
                      checked={selectedAllocations.includes(ftLabel)}
                      onCheckedChange={() => toggleAllocation(ftLabel)}
                      data-testid={`checkbox-alloc-${ftLabel}`}
                    />
                    <label htmlFor={`alloc-${ftLabel}`} className="text-sm cursor-pointer select-none">
                      {ftLabel}
                    </label>
                  </div>
                ))}
              </div>
              {selectedAllocations.length === 0 && defaultAllocation && (
                <p className="text-xs text-amber-600 mt-1">No frame types selected. Will default to: {defaultAllocation}</p>
              )}
            </div>
          )}
          <DivisionScopeField value={scopeValue} onChange={setScopeValue} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!values.value?.trim() || !values.label?.trim() || saveMutation.isPending}
            data-testid={`button-save-${type}`}
          >
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirmDialog({ open, onClose, onConfirm, isPending }: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent data-testid="dialog-delete-confirm">
        <DialogHeader>
          <DialogTitle>Delete Entry</DialogTitle>
          <DialogDescription>Are you sure you want to delete this entry? This cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending} data-testid="button-confirm-delete">
            {isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProfileRoleDictionarySection() {
  const { toast } = useToast();
  const { data: entries = [], isLoading } = useLibraryEntries("profile_role");
  const [newRoleName, setNewRoleName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const addMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/library", { type: "profile_role", data: { name: name.trim() }, sortOrder: entries.length });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library", "profile_role"] });
      setNewRoleName("");
      toast({ title: "Role added" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await apiRequest("PATCH", `/api/library/${id}`, { data: { name: name.trim() } });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library", "profile_role"] });
      setEditingId(null);
      setEditingName("");
      toast({ title: "Role updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/library/profile-roles/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Delete failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library", "profile_role"] });
      toast({ title: "Role removed" });
    },
    onError: (e: Error) => {
      toast({ title: "Cannot delete role", description: e.message, variant: "destructive" });
    },
  });

  const startEdit = (entry: LibraryEntry) => {
    setEditingId(entry.id);
    setEditingName((entry.data as any).name || "");
  };

  if (isLoading) return <div className="p-4 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4" data-testid="profile-role-dictionary-section">
      <div className="flex items-center gap-2">
        <List className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Profile Role Dictionary</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Manage the controlled list of role values available when assigning aluminium profiles. Roles in use by existing profiles cannot be deleted.
      </p>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role Name</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const roleName = (entry.data as any).name as string;
                const isEditing = editingId === entry.id;
                return (
                  <TableRow key={entry.id} data-testid={`row-role-${entry.id}`}>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          className="h-7 text-sm"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          autoFocus
                          data-testid={`input-edit-role-${entry.id}`}
                        />
                      ) : (
                        <span className="font-mono text-sm">{roleName}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        {isEditing ? (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={!editingName.trim() || updateMutation.isPending}
                              onClick={() => updateMutation.mutate({ id: entry.id, name: editingName })}
                              data-testid={`button-save-role-${entry.id}`}
                            >
                              Save
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => { setEditingId(null); setEditingName(""); }}
                              data-testid={`button-cancel-role-${entry.id}`}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => startEdit(entry)}
                              data-testid={`button-edit-role-${entry.id}`}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              disabled={deleteMutation.isPending}
                              onClick={() => deleteMutation.mutate(entry.id)}
                              data-testid={`button-delete-role-${entry.id}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground py-6">
                    No roles defined yet. Add one below.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="flex gap-2 items-center">
        <Input
          placeholder="New role name (e.g. transom-cap)"
          className="max-w-xs"
          value={newRoleName}
          onChange={(e) => setNewRoleName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && newRoleName.trim()) addMutation.mutate(newRoleName); }}
          data-testid="input-new-role-name"
        />
        <Button
          size="sm"
          disabled={!newRoleName.trim() || addMutation.isPending}
          onClick={() => addMutation.mutate(newRoleName)}
          data-testid="button-add-role"
        >
          <Plus className="w-4 h-4 mr-1" /> Add Role
        </Button>
      </div>
    </div>
  );
}

const FAMILY_GROUPS = ["ES52 Window", "ES52 Hinge Door", "ES127 Sliding Door"];

function DirectMaterialsSection({ divisionCode }: { divisionCode?: string | null }) {
  const { toast } = useToast();
  const { data: profiles = [], isLoading: pLoading } = useLibraryEntries("direct_profile", divisionCode);
  const { data: accessories = [], isLoading: aLoading } = useLibraryEntries("direct_accessory", divisionCode);
  const [editProfile, setEditProfile] = useState<LibraryEntry | null>(null);
  const [editAccessory, setEditAccessory] = useState<LibraryEntry | null>(null);
  const [addingProfile, setAddingProfile] = useState(false);
  const [addingAccessory, setAddingAccessory] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);


  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/library/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      setDeleteId(null);
      toast({ title: "Entry deleted" });
    },
  });

  const profilesByFamily = FAMILY_GROUPS.map((family) => ({
    family,
    items: profiles.filter((p) => {
      const fg = (p.data as any).familyGroup;
      return Array.isArray(fg) ? fg.includes(family) : fg === family;
    }),
  }));

  const accessoriesByFamily = FAMILY_GROUPS.map((family) => ({
    family,
    items: accessories.filter((a) => {
      const fg = (a.data as any).familyGroup;
      return Array.isArray(fg) ? fg.includes(family) : fg === family;
    }),
  }));

  if (pLoading || aLoading) return <div className="p-4 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4" data-testid="direct-materials-section">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Direct Materials Library</h2>
      </div>

      {FAMILY_GROUPS.map((family) => {
        const familyProfiles = profilesByFamily.find((f) => f.family === family)?.items || [];
        const familyAccessories = accessoriesByFamily.find((f) => f.family === family)?.items || [];
        return (
          <DirectMaterialsFamilyGroup
            key={family}
            family={family}
            profiles={familyProfiles}
            accessories={familyAccessories}
            onEditProfile={setEditProfile}
            onEditAccessory={setEditAccessory}
            onDelete={setDeleteId}
          />
        );
      })}

      <div className="flex gap-2 pt-2">
        <Button size="sm" onClick={() => setAddingProfile(true)} data-testid="button-add-profile">
          <Plus className="w-4 h-4 mr-1" /> Add Profile
        </Button>
        <Button size="sm" onClick={() => setAddingAccessory(true)} data-testid="button-add-accessory">
          <Plus className="w-4 h-4 mr-1" /> Add Accessory
        </Button>
      </div>

      {(editProfile || addingProfile) && (
        <DirectProfileDialog
          entry={editProfile}
          divisionCode={divisionCode}
          onClose={() => { setEditProfile(null); setAddingProfile(false); }}
        />
      )}
      {(editAccessory || addingAccessory) && (
        <DirectAccessoryDialog
          entry={editAccessory}
          divisionCode={divisionCode}
          onClose={() => { setEditAccessory(null); setAddingAccessory(false); }}
        />
      )}
      <DeleteConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} isPending={deleteMutation.isPending} />
    </div>
  );
}

function DirectMaterialsFamilyGroup({ family, profiles, accessories, onEditProfile, onEditAccessory, onDelete }: {
  family: string;
  profiles: LibraryEntry[];
  accessories: LibraryEntry[];
  onEditProfile: (e: LibraryEntry) => void;
  onEditAccessory: (e: LibraryEntry) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [profilesOpen, setProfilesOpen] = useState(true);
  const [accessoriesOpen, setAccessoriesOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="text-sm flex items-center gap-2">
              {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <Package className="w-4 h-4" />
              {family}
              <Badge variant="secondary" className="ml-auto">{profiles.length} profiles, {accessories.length} accessories</Badge>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <Collapsible open={profilesOpen} onOpenChange={setProfilesOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium cursor-pointer hover:text-primary py-1">
                {profilesOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Aluminium Profiles ({profiles.length})
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Mould #</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>kg/m</TableHead>
                      <TableHead>$/kg USD</TableHead>
                      <TableHead>Length</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profiles.map((p) => {
                      const d = p.data as any;
                      return (
                        <TableRow key={p.id} data-testid={`row-profile-${p.id}`}>
                          <TableCell className="p-1">
                            {d.imageKey ? (
                              <div className="w-8 h-8 rounded overflow-hidden border bg-muted flex-shrink-0 cursor-pointer" title="View reference image" onClick={() => window.open(`/api/item-photos/${d.imageKey}`, "_blank")} data-testid={`img-profile-thumb-${p.id}`}>
                                <img src={`/api/item-photos/${d.imageKey}`} alt="" className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded border border-dashed bg-muted/30 flex items-center justify-center" title="No reference image">
                                <ImageIcon className="w-3 h-3 text-muted-foreground/40" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{d.mouldNumber}</TableCell>
                          <TableCell><Badge variant="outline">{d.role}</Badge></TableCell>
                          <TableCell>{d.kgPerMetre}</TableCell>
                          <TableCell>${d.pricePerKgUsd}</TableCell>
                          <TableCell>{d.lengthFormula}</TableCell>
                          <TableCell><ScopeBadge entry={p} /></TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditProfile(p)} data-testid={`button-edit-profile-${p.id}`}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(p.id)} data-testid={`button-delete-profile-${p.id}`}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {profiles.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-4">No profiles</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible open={accessoriesOpen} onOpenChange={setAccessoriesOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium cursor-pointer hover:text-primary py-1">
                {accessoriesOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Accessories ({accessories.length})
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Colour</TableHead>
                      <TableHead>$/USD</TableHead>
                      <TableHead>Scaling</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accessories.map((a) => {
                      const d = a.data as any;
                      return (
                        <TableRow key={a.id} data-testid={`row-accessory-${a.id}`}>
                          <TableCell className="text-xs">{d.name}</TableCell>
                          <TableCell className="font-mono text-xs">{d.code}</TableCell>
                          <TableCell className="text-xs">{d.colour}</TableCell>
                          <TableCell>${d.priceUsd}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{d.scalingType === "per-linear-metre" ? "Per m" : "Fixed"}</Badge></TableCell>
                          <TableCell><ScopeBadge entry={a} /></TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditAccessory(a)} data-testid={`button-edit-accessory-${a.id}`}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(a.id)} data-testid={`button-delete-accessory-${a.id}`}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {accessories.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-4">No accessories</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function DirectProfileDialog({ entry, divisionCode, onClose }: { entry: LibraryEntry | null; divisionCode?: string | null; onClose: () => void }) {
  const { toast } = useToast();
  const isEdit = !!entry;
  const d = entry ? (entry.data as any) : {};
  const [scopeValue, setScopeValue] = useState(entry?.divisionScope || divisionCode || "__shared__");
  const [values, setValues] = useState({
    mouldNumber: d.mouldNumber || "",
    role: d.role || "spacer",
    kgPerMetre: d.kgPerMetre || "",
    pricePerKgUsd: d.pricePerKgUsd || "",
    lengthFormula: d.lengthFormula || "perimeter",
    familyGroup: d.familyGroup || ["ES52 Window"],
    description: d.description || "",
    imageKey: d.imageKey || "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const { data: roleEntries = [] } = useLibraryEntries("profile_role");
  const managedRoles = roleEntries.map((e) => (e.data as any).name as string).filter(Boolean);
  const roleOptions = managedRoles.length > 0 ? managedRoles : PROFILE_ROLES;

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/item-photos", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { key } = await res.json();
      setValues((v) => ({ ...v, imageKey: key }));
      toast({ title: "Image uploaded" });
    } catch {
      toast({ title: "Image upload failed", variant: "destructive" });
    } finally {
      setUploadingImage(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const ds = scopeValue === "__shared__" ? null : scopeValue;
      if (isEdit) {
        await apiRequest("PATCH", `/api/library/direct-profiles/${entry!.id}`, { data: values });
      } else {
        await apiRequest("POST", "/api/library", { type: "direct_profile", data: values, sortOrder: 0, divisionScope: ds });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      toast({ title: isEdit ? "Profile updated & synced to configurations" : "Profile added" });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-testid="dialog-direct-profile">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Profile" : "Add Profile"}</DialogTitle>
          <DialogDescription>{isEdit ? "Changes will sync to all configurations using this mould number." : "Add a new master profile."}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Mould Number</Label>
            <Input value={values.mouldNumber} onChange={(e) => setValues({ ...values, mouldNumber: e.target.value })} data-testid="input-mould-number" />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={values.role} onValueChange={(v) => setValues({ ...values, role: v })}>
              <SelectTrigger data-testid="select-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                {roleOptions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>kg/m</Label>
            <Input value={values.kgPerMetre} onChange={(e) => setValues({ ...values, kgPerMetre: e.target.value })} data-testid="input-kg-per-metre" />
          </div>
          <div>
            <Label>$/kg USD</Label>
            <Input value={values.pricePerKgUsd} onChange={(e) => setValues({ ...values, pricePerKgUsd: e.target.value })} data-testid="input-price-per-kg" />
          </div>
          <div>
            <Label>Length Formula</Label>
            <Select value={values.lengthFormula} onValueChange={(v) => setValues({ ...values, lengthFormula: v })}>
              <SelectTrigger data-testid="select-length-formula"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LENGTH_FORMULAS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Family Groups</Label>
            <div className="flex gap-3 mt-1">
              {FAMILY_GROUPS.map((fg) => (
                <label key={fg} className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={values.familyGroup.includes(fg)}
                    onCheckedChange={(checked) => {
                      const newFg = checked
                        ? [...values.familyGroup, fg]
                        : values.familyGroup.filter((g: string) => g !== fg);
                      setValues({ ...values, familyGroup: newFg });
                    }}
                  />
                  {fg}
                </label>
              ))}
            </div>
          </div>
          <div className="col-span-2">
            <Label>Reference Image</Label>
            <div className="mt-1 flex items-start gap-3">
              {values.imageKey ? (
                <div className="relative w-20 h-20 rounded border overflow-hidden bg-muted flex-shrink-0">
                  <img src={`/api/item-photos/${values.imageKey}`} alt="Profile reference" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white hover:bg-black/80"
                    onClick={() => setValues((v) => ({ ...v, imageKey: "" }))}
                    data-testid="button-remove-profile-image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded border border-dashed bg-muted flex items-center justify-center flex-shrink-0">
                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingImage}
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-upload-profile-image"
                >
                  <Camera className="w-4 h-4 mr-1.5" />
                  {uploadingImage ? "Uploading..." : values.imageKey ? "Replace Image" : "Upload Image"}
                </Button>
                <p className="text-xs text-muted-foreground">JPEG, up to 10MB. Used in library view and manufacturing reports.</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
                  data-testid="input-profile-image-file"
                />
              </div>
            </div>
          </div>
          <div className="col-span-2">
            <DivisionScopeField value={scopeValue} onChange={setScopeValue} disabled={isEdit} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!values.mouldNumber.trim() || saveMutation.isPending} data-testid="button-save-profile">
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DirectAccessoryDialog({ entry, divisionCode, onClose }: { entry: LibraryEntry | null; divisionCode?: string | null; onClose: () => void }) {
  const { toast } = useToast();
  const isEdit = !!entry;
  const d = entry ? (entry.data as any) : {};
  const [scopeValue, setScopeValue] = useState(entry?.divisionScope || divisionCode || "__shared__");
  const [values, setValues] = useState({
    name: d.name || "",
    code: d.code || "",
    colour: d.colour || "",
    priceUsd: d.priceUsd || "",
    scalingType: d.scalingType || "fixed",
    familyGroup: d.familyGroup || ["ES52 Window"],
    description: d.description || "",
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const ds = scopeValue === "__shared__" ? null : scopeValue;
      if (isEdit) {
        await apiRequest("PATCH", `/api/library/direct-accessories/${entry!.id}`, { data: values });
      } else {
        await apiRequest("POST", "/api/library", { type: "direct_accessory", data: values, sortOrder: 0, divisionScope: ds });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      toast({ title: isEdit ? "Accessory updated & synced to configurations" : "Accessory added" });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent data-testid="dialog-direct-accessory">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Accessory" : "Add Accessory"}</DialogTitle>
          <DialogDescription>{isEdit ? "Changes will sync to all configurations using this code." : "Add a new master accessory."}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Name</Label>
            <Input value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} data-testid="input-accessory-name" />
          </div>
          <div>
            <Label>Code</Label>
            <Input value={values.code} onChange={(e) => setValues({ ...values, code: e.target.value })} data-testid="input-accessory-code" />
          </div>
          <div>
            <Label>Colour</Label>
            <Input value={values.colour} onChange={(e) => setValues({ ...values, colour: e.target.value })} data-testid="input-accessory-colour" />
          </div>
          <div>
            <Label>Price (USD)</Label>
            <Input value={values.priceUsd} onChange={(e) => setValues({ ...values, priceUsd: e.target.value })} data-testid="input-accessory-price" />
          </div>
          <div>
            <Label>Scaling Type</Label>
            <Select value={values.scalingType} onValueChange={(v) => setValues({ ...values, scalingType: v })}>
              <SelectTrigger data-testid="select-scaling-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed</SelectItem>
                <SelectItem value="per-linear-metre">Per Linear Metre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Family Groups</Label>
            <div className="flex gap-3 mt-1">
              {FAMILY_GROUPS.map((fg) => (
                <label key={fg} className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={values.familyGroup.includes(fg)}
                    onCheckedChange={(checked) => {
                      const newFg = checked
                        ? [...values.familyGroup, fg]
                        : values.familyGroup.filter((g: string) => g !== fg);
                      setValues({ ...values, familyGroup: newFg });
                    }}
                  />
                  {fg}
                </label>
              ))}
            </div>
          </div>
          <div className="col-span-2">
            <DivisionScopeField value={scopeValue} onChange={setScopeValue} disabled={isEdit} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!values.name.trim() || saveMutation.isPending} data-testid="button-save-accessory">
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const DRIVER_TYPE_OPTIONS = [
  { value: "per_item",           label: "Per Item (flat)" },
  { value: "per_cut_cycle",      label: "Per Cut Cycle (CNC: 1 cycle = 1 member)" },
  { value: "per_hole",           label: "Per Hole (outer frame: 16 holes)" },
  { value: "per_slot",           label: "Per Slot (min 2 slots)" },
  { value: "per_end",            label: "Per Mullion/Transom End" },
  { value: "per_screw",          label: "Per Screw (16 frame + 2 per mullion/transom end)" },
  { value: "per_corner",         label: "Per Outer Corner (4 corners)" },
  { value: "per_joint",          label: "Per Mullion/Transom Joint" },
  { value: "per_glue_point",     label: "Per Glue Point (4 corners + mullion/transom ends)" },
  { value: "per_pane",           label: "Per Pane (flat rate per pane)" },
  { value: "per_pane_area_band", label: "Per Pane — Area Band (uses Glazing Bands table)" },
];

function ManufacturingLabourSection({ divisionCode }: { divisionCode?: string | null }) {
  const { toast } = useToast();
  const { data: operations = [], isLoading } = useLibraryEntries("labour_operation", divisionCode);
  const [editOp, setEditOp] = useState<LibraryEntry | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/library/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      setDeleteId(null);
      toast({ title: "Operation deleted" });
    },
  });

  const setDefaultAssemblyMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/library/set-default-assembly/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      toast({ title: "Default assembly method updated" });
    },
  });

  const manual = operations.filter((o) => (o.data as any).category === "manual");
  const cnc = operations.filter((o) => (o.data as any).category === "cnc");

  if (isLoading) return <div className="p-4 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4" data-testid="manufacturing-labour-section">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Manufacturing Labour Library</h2>
        <Button size="sm" onClick={() => setAdding(true)} data-testid="button-add-labour-op">
          <Plus className="w-4 h-4 mr-1" /> Add Operation
        </Button>
      </div>

      <div className="text-xs text-muted-foreground bg-muted/40 rounded px-3 py-2 border space-y-1">
        <p>Each operation uses a <strong>setup + driver</strong> model: <em>Total time = Setup minutes + (Driver quantity × Minutes per driver)</em>.
        Driver quantity is derived automatically from item geometry (member count, pane count, etc.).</p>
        <p className="text-amber-600 dark:text-amber-400"><strong>Glue is automatically applied</strong> to all items based on geometry (4 outer corners + mullion/transom joints). Do not add a separate glue row to frame configurations — it will be counted twice.</p>
      </div>

      <LabourCategoryGroup title="Manual Processes" operations={manual} allOperations={operations} onEdit={setEditOp} onDelete={setDeleteId} onSetDefaultAssembly={(id) => setDefaultAssemblyMutation.mutate(id)} />
      <LabourCategoryGroup title="CNC Processes" operations={cnc} allOperations={operations} onEdit={setEditOp} onDelete={setDeleteId} onSetDefaultAssembly={(id) => setDefaultAssemblyMutation.mutate(id)} />

      {(editOp || adding) && (
        <LabourOperationDialog entry={editOp} allOperations={operations} divisionCode={divisionCode} onClose={() => { setEditOp(null); setAdding(false); }} />
      )}
      <DeleteConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} isPending={deleteMutation.isPending} />

      <GlazingBandSection divisionCode={divisionCode} />
    </div>
  );
}

function isAssemblyOp(name: string): boolean {
  return name?.startsWith("assembly-") ?? false;
}

function LabourCategoryGroup({ title, operations, allOperations, onEdit, onDelete, onSetDefaultAssembly }: {
  title: string;
  operations: LibraryEntry[];
  allOperations: LibraryEntry[];
  onEdit: (e: LibraryEntry) => void;
  onDelete: (id: string) => void;
  onSetDefaultAssembly: (id: string) => void;
}) {
  const defaultAssemblyId = allOperations.find((o) => {
    const d = o.data as any;
    return isAssemblyOp(d.name) && d.isDefaultAssembly === true;
  })?.id;

  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="text-sm flex items-center gap-2">
              {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <Wrench className="w-4 h-4" />
              {title}
              <Badge variant="secondary" className="ml-auto">{operations.length}</Badge>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Setup (min)</TableHead>
                  <TableHead>Driver Type</TableHead>
                  <TableHead>Min/Driver</TableHead>
                  <TableHead>Rate ($/hr)</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operations.map((o) => {
                  const d = o.data as any;
                  const isLegacy = !d.driverType;
                  const isInactive = d.isActive === false;
                  const isAssembly = isAssemblyOp(d.name);
                  const isDefault = isAssembly && o.id === defaultAssemblyId;
                  const driverLabel = DRIVER_TYPE_OPTIONS.find((x) => x.value === d.driverType)?.label ?? d.driverType ?? "—";
                  return (
                    <TableRow key={o.id} data-testid={`row-labour-${o.id}`} className={isInactive ? "opacity-50" : undefined}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {d.name}
                          {isLegacy && <Badge variant="outline" className="text-[10px]">legacy</Badge>}
                          {isDefault && (
                            <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300 dark:border-amber-700" variant="outline" data-testid={`badge-default-assembly-${o.id}`}>
                              <Star className="w-3 h-3 mr-0.5 fill-current" /> default
                            </Badge>
                          )}
                          {isAssembly && !isDefault && !isInactive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-amber-600"
                              onClick={(e) => { e.stopPropagation(); onSetDefaultAssembly(o.id); }}
                              data-testid={`button-set-default-${o.id}`}
                              title="Set as default assembly method"
                            >
                              <Star className="w-3 h-3 mr-0.5" /> set default
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isInactive ? (
                          <Badge variant="outline" className="text-[10px] text-red-500 border-red-200 dark:border-red-800" data-testid={`badge-status-inactive-${o.id}`}>
                            <Circle className="w-2.5 h-2.5 mr-1 fill-red-400 text-red-400" /> Inactive
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-green-600 border-green-200 dark:border-green-800" data-testid={`badge-status-active-${o.id}`}>
                            <CircleCheck className="w-2.5 h-2.5 mr-1" /> Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{isLegacy ? d.timeMinutes : (d.setupMinutes ?? 0)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate" title={driverLabel}>
                        {isLegacy ? "flat" : driverLabel}
                      </TableCell>
                      <TableCell>{isLegacy ? "—" : d.minutesPerDriver}</TableCell>
                      <TableCell>${d.ratePerHour}</TableCell>
                      <TableCell><ScopeBadge entry={o} /></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(o)} data-testid={`button-edit-labour-${o.id}`}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(o.id)} data-testid={`button-delete-labour-${o.id}`}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {operations.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-4">No operations</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function LabourOperationDialog({ entry, allOperations, divisionCode, onClose }: { entry: LibraryEntry | null; allOperations: LibraryEntry[]; divisionCode?: string | null; onClose: () => void }) {
  const { toast } = useToast();
  const isEdit = !!entry;
  const d = entry ? (entry.data as any) : {};
  const [scopeValue, setScopeValue] = useState(entry?.divisionScope || divisionCode || "__shared__");
  const isLegacy = isEdit && !d.driverType;
  const [values, setValues] = useState({
    name: d.name || "",
    category: d.category || "manual",
    setupMinutes: d.setupMinutes ?? (isLegacy ? (d.timeMinutes ?? 0) : 0),
    driverType: d.driverType || "per_item",
    minutesPerDriver: d.minutesPerDriver ?? (isLegacy ? 0 : 1),
    ratePerHour: d.ratePerHour || 45,
    description: d.description || "",
    isActive: d.isActive !== false,
    isDefaultAssembly: d.isDefaultAssembly === true,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const ds = scopeValue === "__shared__" ? null : scopeValue;
      const payload = { ...values };
      if (!isAssemblyOp(payload.name)) {
        delete (payload as any).isDefaultAssembly;
      }
      if (!payload.isActive && isAssemblyOp(payload.name)) {
        payload.isDefaultAssembly = false;
      }
      if (isEdit) {
        await apiRequest("PATCH", `/api/library/${entry!.id}`, { data: payload, divisionScope: ds });
        if (payload.isDefaultAssembly && isAssemblyOp(payload.name)) {
          await apiRequest("POST", `/api/library/set-default-assembly/${entry!.id}`);
        }
      } else {
        const resp = await apiRequest("POST", "/api/library", { type: "labour_operation", data: payload, sortOrder: 0, divisionScope: ds });
        if (payload.isDefaultAssembly && isAssemblyOp(payload.name)) {
          const created = await resp.json();
          if (created?.id) {
            await apiRequest("POST", `/api/library/set-default-assembly/${created.id}`);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      toast({ title: isEdit ? "Operation updated" : "Operation added" });
      onClose();
    },
  });

  const exampleMemberCount = 5;
  const exampleDriverQty: Record<string, number> = {
    per_item: 1, per_cut_cycle: exampleMemberCount, per_hole: 16, per_slot: 2,
    per_end: 2, per_screw: 20, per_corner: 4, per_joint: 2,
    per_glue_point: 6, per_pane: 2, per_pane_area_band: 2,
  };
  const qty = exampleDriverQty[values.driverType] ?? 1;
  const exampleMins = (values.setupMinutes || 0) + qty * (values.minutesPerDriver || 0);
  const exampleCost = (exampleMins / 60) * (values.ratePerHour || 0);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-testid="dialog-labour-operation">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Operation" : "Add Operation"}</DialogTitle>
          <DialogDescription>
            Total time per item = Setup minutes + (Driver quantity × Minutes per driver).
            Driver quantity is derived automatically from item geometry.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Operation Name</Label>
            <Input value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} data-testid="input-labour-name" />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={values.category} onValueChange={(v) => setValues({ ...values, category: v })}>
              <SelectTrigger data-testid="select-labour-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="cnc">CNC</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Setup Minutes</Label>
            <Input type="number" min={0} step={0.5} value={values.setupMinutes} onChange={(e) => setValues({ ...values, setupMinutes: parseFloat(e.target.value) || 0 })} data-testid="input-labour-setup" />
          </div>
          <div>
            <Label>Rate ($/hr NZD)</Label>
            <Input type="number" min={0} value={values.ratePerHour} onChange={(e) => setValues({ ...values, ratePerHour: parseFloat(e.target.value) || 0 })} data-testid="input-labour-rate" />
          </div>
          <div className="col-span-2">
            <Label>Driver Type</Label>
            <Select value={values.driverType} onValueChange={(v) => setValues({ ...values, driverType: v })}>
              <SelectTrigger data-testid="select-labour-driver-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DRIVER_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Minutes per Driver Unit</Label>
            <Input type="number" min={0} step={0.5} value={values.minutesPerDriver} onChange={(e) => setValues({ ...values, minutesPerDriver: parseFloat(e.target.value) || 0 })} data-testid="input-labour-mins-per-driver" />
          </div>
          <div className="col-span-2 text-xs text-muted-foreground bg-muted/30 rounded px-3 py-2">
            Example (simple 4-member frame + 1 mullion = {exampleMemberCount} members):
            <span className="font-semibold text-foreground ml-1">{exampleMins.toFixed(1)} min → ${exampleCost.toFixed(2)}</span>
          </div>
          <div className="col-span-2">
            <Label>Description / Notes</Label>
            <Input value={values.description} onChange={(e) => setValues({ ...values, description: e.target.value })} data-testid="input-labour-description" />
          </div>
          <div className="col-span-2">
            <DivisionScopeField value={scopeValue} onChange={setScopeValue} />
          </div>
          <div className="col-span-2 border rounded-md p-3 space-y-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Status</Label>
                <p className="text-xs text-muted-foreground">Inactive operations are preserved for history but excluded from live costing</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${values.isActive ? "text-green-600" : "text-red-500"}`}>
                  {values.isActive ? "Active" : "Inactive"}
                </span>
                <Checkbox
                  checked={values.isActive}
                  onCheckedChange={(checked) => setValues({ ...values, isActive: !!checked })}
                  data-testid="checkbox-labour-active"
                />
              </div>
            </div>
            {isAssemblyOp(values.name) && values.isActive && (
              <div className="flex items-center justify-between border-t pt-3">
                <div>
                  <Label className="text-sm font-medium">Default Assembly Method</Label>
                  <p className="text-xs text-muted-foreground">Only one assembly method can be the default at a time</p>
                </div>
                <div className="flex items-center gap-2">
                  {values.isDefaultAssembly && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                  <Checkbox
                    checked={values.isDefaultAssembly}
                    onCheckedChange={(checked) => setValues({ ...values, isDefaultAssembly: !!checked })}
                    data-testid="checkbox-default-assembly"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!values.name.trim() || saveMutation.isPending} data-testid="button-save-labour">
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GlazingBandSection({ divisionCode }: { divisionCode?: string | null }) {
  const { toast } = useToast();
  const { data: bands = [], isLoading } = useLibraryEntries("glazing_band", divisionCode);
  const [editBand, setEditBand] = useState<LibraryEntry | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/library/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/library"] }); setDeleteId(null); toast({ title: "Band deleted" }); },
  });

  return (
    <Collapsible defaultOpen>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="text-sm flex items-center gap-2">
              <ChevronDown className="w-4 h-4" />
              <span>Glazing Time Bands</span>
              <Badge variant="secondary" className="ml-auto">{bands.length}</Badge>
              <Button size="sm" variant="outline" className="ml-2 h-6 text-xs px-2" onClick={(e) => { e.stopPropagation(); setAdding(true); }} data-testid="button-add-glazing-band">
                <Plus className="w-3 h-3 mr-1" /> Add Band
              </Button>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              These bands configure minutes per pane for glazing, based on pane area (m²). Used when glazing driver type is <em>per_pane_area_band</em>.
              Bands are sorted by max area; pane area is calculated as (width × height) ÷ pane count.
            </p>
            {isLoading ? <div className="text-muted-foreground text-sm">Loading...</div> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Max Pane Area (m²)</TableHead>
                    <TableHead>Min per Pane</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...bands].sort((a, b) => (a.data as any).maxAreaSqm - (b.data as any).maxAreaSqm).map((b) => {
                    const d = b.data as any;
                    return (
                      <TableRow key={b.id} data-testid={`row-glazing-band-${b.id}`}>
                        <TableCell className="font-medium capitalize">{d.label}</TableCell>
                        <TableCell>{d.maxAreaSqm >= 9999 ? "∞ (catch-all)" : `≤ ${d.maxAreaSqm}`}</TableCell>
                        <TableCell>{d.minutesPerPane} min</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{d.description}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditBand(b)} data-testid={`button-edit-glazing-band-${b.id}`}><Pencil className="w-3 h-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(b.id)} data-testid={`button-delete-glazing-band-${b.id}`}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {bands.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">No bands configured — defaults (small/medium/large/extra-large) are used.</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
      {(editBand || adding) && (
        <GlazingBandDialog entry={editBand} divisionCode={divisionCode} onClose={() => { setEditBand(null); setAdding(false); }} />
      )}
      <DeleteConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} isPending={deleteMutation.isPending} />
    </Collapsible>
  );
}

function GlazingBandDialog({ entry, divisionCode, onClose }: { entry: LibraryEntry | null; divisionCode?: string | null; onClose: () => void }) {
  const { toast } = useToast();
  const isEdit = !!entry;
  const d = entry ? (entry.data as any) : {};
  const [values, setValues] = useState({
    label: d.label || "",
    maxAreaSqm: d.maxAreaSqm ?? 0.5,
    minutesPerPane: d.minutesPerPane ?? 10,
    description: d.description || "",
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const ds = divisionCode || null;
      if (isEdit) {
        await apiRequest("PATCH", `/api/library/${entry!.id}`, { data: values, divisionScope: ds });
      } else {
        await apiRequest("POST", "/api/library", { type: "glazing_band", data: values, sortOrder: 0, divisionScope: ds });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      toast({ title: isEdit ? "Band updated" : "Band added" });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent data-testid="dialog-glazing-band">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Glazing Band" : "Add Glazing Band"}</DialogTitle>
          <DialogDescription>Panes with area ≤ Max Pane Area will use this band's minutes per pane. Sort order is by max area ascending.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Label</Label>
            <Input value={values.label} onChange={(e) => setValues({ ...values, label: e.target.value })} placeholder="e.g. small, medium, large" data-testid="input-glazing-label" />
          </div>
          <div>
            <Label>Max Pane Area (m²)</Label>
            <Input type="number" min={0} step={0.1} value={values.maxAreaSqm} onChange={(e) => setValues({ ...values, maxAreaSqm: parseFloat(e.target.value) || 0 })} data-testid="input-glazing-max-area" />
            <p className="text-xs text-muted-foreground mt-1">Use 9999 for the catch-all (largest) band.</p>
          </div>
          <div className="col-span-2">
            <Label>Minutes per Pane</Label>
            <Input type="number" min={0} step={1} value={values.minutesPerPane} onChange={(e) => setValues({ ...values, minutesPerPane: parseFloat(e.target.value) || 0 })} data-testid="input-glazing-mins-per-pane" />
          </div>
          <div className="col-span-2">
            <Label>Description</Label>
            <Input value={values.description} onChange={(e) => setValues({ ...values, description: e.target.value })} data-testid="input-glazing-description" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!values.label.trim() || saveMutation.isPending} data-testid="button-save-glazing-band">
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InstallationSection({ divisionCode }: { divisionCode?: string | null }) {
  const { toast } = useToast();
  const { data: rates = [], isLoading } = useLibraryEntries("installation_rate", divisionCode);
  const [editRate, setEditRate] = useState<LibraryEntry | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/library/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      setDeleteId(null);
      toast({ title: "Rate deleted" });
    },
  });

  const INSTALL_CAT_LABELS: Record<string, string> = { window: "Window Installation", door: "Door Installation", facade: "Facade Installation", all: "All Items" };
  const grouped = rates.reduce<Record<string, typeof rates>>((acc, r) => {
    const cat = (r.data as any).category || "window";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(r);
    return acc;
  }, {});
  const catOrder = ["window", "door", "facade", "all"];
  const sections = catOrder.filter((c) => grouped[c]?.length).map((c) => ({ title: INSTALL_CAT_LABELS[c] || c, items: grouped[c] }));
  const extraCats = Object.keys(grouped).filter((c) => !catOrder.includes(c));
  for (const c of extraCats) sections.push({ title: INSTALL_CAT_LABELS[c] || c, items: grouped[c] });

  const BASIS_LABELS: Record<string, string> = { per_item: "Per Item", per_m2: "Per m²", per_lm: "Per l/m" };

  if (isLoading) return <div className="p-4 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4" data-testid="installation-section">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Installation Labour Rates</h2>
        <Button size="sm" onClick={() => setAdding(true)} data-testid="button-add-installation-rate">
          <Plus className="w-4 h-4 mr-1" /> Add Rate
        </Button>
      </div>

      {sections.map(({ title, items }) => (
        <Card key={title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{title}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Size Name</TableHead>
                  <TableHead>Basis</TableHead>
                  <TableHead>Min m²</TableHead>
                  <TableHead>Max m²</TableHead>
                  <TableHead>Cost/Unit ($)</TableHead>
                  <TableHead>Sell/Unit ($)</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r) => {
                  const d = r.data as any;
                  return (
                    <TableRow key={r.id} data-testid={`row-installation-${r.id}`}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{BASIS_LABELS[d.pricingBasis] || "Per Item"}</Badge></TableCell>
                      <TableCell>{d.minSqm}</TableCell>
                      <TableCell>{d.maxSqm >= 999 ? "∞" : d.maxSqm}</TableCell>
                      <TableCell className="font-medium">${d.costPerUnit ?? d.pricePerUnit}</TableCell>
                      <TableCell className="font-semibold">${d.sellPerUnit ?? d.pricePerUnit}</TableCell>
                      <TableCell><ScopeBadge entry={r} /></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditRate(r)} data-testid={`button-edit-installation-${r.id}`}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(r.id)} data-testid={`button-delete-installation-${r.id}`}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {(editRate || adding) && (
        <InstallationRateDialog entry={editRate} divisionCode={divisionCode} onClose={() => { setEditRate(null); setAdding(false); }} />
      )}
      <DeleteConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} isPending={deleteMutation.isPending} />
    </div>
  );
}

function InstallationRateDialog({ entry, divisionCode, onClose }: { entry: LibraryEntry | null; divisionCode?: string | null; onClose: () => void }) {
  const { toast } = useToast();
  const isEdit = !!entry;
  const d = entry ? (entry.data as any) : {};
  const [scopeValue, setScopeValue] = useState(entry?.divisionScope || divisionCode || "__shared__");
  const [values, setValues] = useState({
    name: d.name || "",
    category: d.category || "window",
    pricingBasis: d.pricingBasis || "per_item",
    minSqm: d.minSqm ?? 0,
    maxSqm: d.maxSqm ?? 1,
    costPerUnit: d.costPerUnit ?? (d.pricePerUnit ? Math.round(d.pricePerUnit * 0.75 * 100) / 100 : 187.5),
    sellPerUnit: d.sellPerUnit ?? d.pricePerUnit ?? 250,
    description: d.description || "",
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const ds = scopeValue === "__shared__" ? null : scopeValue;
      if (isEdit) {
        await apiRequest("PATCH", `/api/library/${entry!.id}`, { data: values, divisionScope: ds });
      } else {
        await apiRequest("POST", "/api/library", { type: "installation_rate", data: values, sortOrder: 0, divisionScope: ds });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      toast({ title: isEdit ? "Rate updated" : "Rate added" });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent data-testid="dialog-installation-rate">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Installation Rate" : "Add Installation Rate"}</DialogTitle>
          <DialogDescription>Set pricing for a size tier.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Size Name</Label>
            <Input value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} data-testid="input-installation-name" />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={values.category} onValueChange={(v) => setValues({ ...values, category: v })}>
              <SelectTrigger data-testid="select-installation-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="window">Window</SelectItem>
                <SelectItem value="door">Door</SelectItem>
                <SelectItem value="facade">Facade</SelectItem>
                <SelectItem value="all">All Items</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Pricing Basis</Label>
            <Select value={values.pricingBasis} onValueChange={(v) => setValues({ ...values, pricingBasis: v })}>
              <SelectTrigger data-testid="select-installation-basis"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="per_item">Per Item</SelectItem>
                <SelectItem value="per_m2">Per m²</SelectItem>
                <SelectItem value="per_lm">Per l/m (perimeter)</SelectItem>
              </SelectContent>
            </Select>
            {values.pricingBasis === "per_lm" && (
              <p className="text-xs text-muted-foreground mt-1">Quantity = 2 × (width + height) / 1000 per item</p>
            )}
            {values.pricingBasis === "per_m2" && (
              <p className="text-xs text-muted-foreground mt-1">Quantity = width × height / 1,000,000 per item</p>
            )}
          </div>
          <div>
            <Label>Min m²</Label>
            <Input type="number" value={values.minSqm} onChange={(e) => setValues({ ...values, minSqm: parseFloat(e.target.value) || 0 })} data-testid="input-installation-min" />
          </div>
          <div>
            <Label>Max m²</Label>
            <Input type="number" value={values.maxSqm} onChange={(e) => setValues({ ...values, maxSqm: parseFloat(e.target.value) || 0 })} data-testid="input-installation-max" />
          </div>
          <div>
            <Label>Cost per Unit ($)</Label>
            <Input type="number" value={values.costPerUnit} onChange={(e) => setValues({ ...values, costPerUnit: parseFloat(e.target.value) || 0 })} data-testid="input-installation-cost" />
          </div>
          <div>
            <Label>Sell per Unit ($)</Label>
            <Input type="number" value={values.sellPerUnit} onChange={(e) => setValues({ ...values, sellPerUnit: parseFloat(e.target.value) || 0 })} data-testid="input-installation-sell" />
          </div>
          <div className="col-span-2">
            <DivisionScopeField value={scopeValue} onChange={setScopeValue} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!values.name.trim() || saveMutation.isPending} data-testid="button-save-installation">
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeliverySection({ divisionCode }: { divisionCode?: string | null }) {
  const { toast } = useToast();
  const { data: rates = [], isLoading } = useLibraryEntries("delivery_rate", divisionCode);
  const [editRate, setEditRate] = useState<LibraryEntry | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/library/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      setDeleteId(null);
      toast({ title: "Rate deleted" });
    },
  });

  if (isLoading) return <div className="p-4 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4" data-testid="delivery-section">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Delivery Rates</h2>
        <Button size="sm" onClick={() => setAdding(true)} data-testid="button-add-delivery-rate">
          <Plus className="w-4 h-4 mr-1" /> Add Rate
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Delivery Method</TableHead>
                <TableHead>Cost ($ NZD)</TableHead>
                <TableHead>Sell ($ NZD)</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((r) => {
                const d = r.data as any;
                return (
                  <TableRow key={r.id} data-testid={`row-delivery-${r.id}`}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="font-medium">{(d.costNzd ?? d.rateNzd) > 0 ? `$${d.costNzd ?? d.rateNzd}` : "Custom"}</TableCell>
                    <TableCell className="font-semibold">{(d.sellNzd ?? d.rateNzd) > 0 ? `$${d.sellNzd ?? d.rateNzd}` : "Custom"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.description}</TableCell>
                    <TableCell><ScopeBadge entry={r} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditRate(r)} data-testid={`button-edit-delivery-${r.id}`}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(r.id)} data-testid={`button-delete-delivery-${r.id}`}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rates.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">No delivery rates</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(editRate || adding) && (
        <DeliveryRateDialog entry={editRate} divisionCode={divisionCode} onClose={() => { setEditRate(null); setAdding(false); }} />
      )}
      <DeleteConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} isPending={deleteMutation.isPending} />
    </div>
  );
}

function DeliveryRateDialog({ entry, divisionCode, onClose }: { entry: LibraryEntry | null; divisionCode?: string | null; onClose: () => void }) {
  const { toast } = useToast();
  const isEdit = !!entry;
  const d = entry ? (entry.data as any) : {};
  const [scopeValue, setScopeValue] = useState(entry?.divisionScope || divisionCode || "__shared__");
  const [values, setValues] = useState({
    name: d.name || "",
    vehicle: d.vehicle || "",
    costNzd: d.costNzd ?? (d.rateNzd ? Math.round(d.rateNzd * 0.75 * 100) / 100 : 0),
    sellNzd: d.sellNzd ?? d.rateNzd ?? 0,
    description: d.description || "",
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const ds = scopeValue === "__shared__" ? null : scopeValue;
      if (isEdit) {
        await apiRequest("PATCH", `/api/library/${entry!.id}`, { data: values, divisionScope: ds });
      } else {
        await apiRequest("POST", "/api/library", { type: "delivery_rate", data: values, sortOrder: 0, divisionScope: ds });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      toast({ title: isEdit ? "Rate updated" : "Rate added" });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent data-testid="dialog-delivery-rate">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Delivery Rate" : "Add Delivery Rate"}</DialogTitle>
          <DialogDescription>Set pricing for this delivery method.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Method Name</Label>
            <Input value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} data-testid="input-delivery-name" />
          </div>
          <div>
            <Label>Cost ($ NZD)</Label>
            <Input type="number" value={values.costNzd} onChange={(e) => setValues({ ...values, costNzd: parseFloat(e.target.value) || 0 })} data-testid="input-delivery-cost" />
          </div>
          <div>
            <Label>Sell ($ NZD)</Label>
            <Input type="number" value={values.sellNzd} onChange={(e) => setValues({ ...values, sellNzd: parseFloat(e.target.value) || 0 })} data-testid="input-delivery-sell" />
          </div>
          <div className="col-span-2">
            <Label>Description</Label>
            <Input value={values.description} onChange={(e) => setValues({ ...values, description: e.target.value })} data-testid="input-delivery-description" />
          </div>
          <div className="col-span-2">
            <DivisionScopeField value={scopeValue} onChange={setScopeValue} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!values.name.trim() || saveMutation.isPending} data-testid="button-save-delivery">
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SiteCostsContent({ divisionCode }: { divisionCode?: string | null }) {
  const [subTab, setSubTab] = useState<"installation" | "delivery" | "removal" | "waste">("installation");
  return (
    <Tabs value={subTab} onValueChange={(v) => setSubTab(v as any)}>
      <TabsList className="mb-4" data-testid="site-costs-subtabs">
        <TabsTrigger value="installation" data-testid="subtab-installation">Installation</TabsTrigger>
        <TabsTrigger value="delivery" data-testid="subtab-delivery">Delivery</TabsTrigger>
        <TabsTrigger value="removal" data-testid="subtab-removal">Removal</TabsTrigger>
        <TabsTrigger value="waste" data-testid="subtab-waste">Waste / Disposal</TabsTrigger>
      </TabsList>
      <TabsContent value="installation">
        <InstallationSection divisionCode={divisionCode} />
      </TabsContent>
      <TabsContent value="delivery">
        <DeliverySection divisionCode={divisionCode} />
      </TabsContent>
      <TabsContent value="removal">
        <RemovalSection divisionCode={divisionCode} />
      </TabsContent>
      <TabsContent value="waste">
        <WasteSection divisionCode={divisionCode} />
      </TabsContent>
    </Tabs>
  );
}

function RemovalSection({ divisionCode }: { divisionCode?: string | null }) {
  const { toast } = useToast();
  const { data: rates = [], isLoading } = useLibraryEntries("removal_rate", divisionCode);
  const [editRate, setEditRate] = useState<LibraryEntry | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/library/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      setDeleteId(null);
      toast({ title: "Rate deleted" });
    },
  });

  const REMOVAL_CAT_LABELS: Record<string, string> = { window: "Window Removal", door: "Door Removal", facade: "Facade Removal", all: "All Items" };
  const grouped = rates.reduce<Record<string, typeof rates>>((acc, r) => {
    const cat = (r.data as any).category || "window";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(r);
    return acc;
  }, {});
  const catOrder = ["window", "door", "facade", "all"];
  const sections = catOrder.filter((c) => grouped[c]?.length).map((c) => ({ title: REMOVAL_CAT_LABELS[c] || c, items: grouped[c] }));
  const extraCats = Object.keys(grouped).filter((c) => !catOrder.includes(c));
  for (const c of extraCats) sections.push({ title: REMOVAL_CAT_LABELS[c] || c, items: grouped[c] });

  const BASIS_LABELS: Record<string, string> = { per_item: "Per Item", per_m2: "Per m²", per_lm: "Per l/m" };

  if (isLoading) return <div className="p-4 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4" data-testid="removal-section">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Removal Rates</h2>
        <Button size="sm" onClick={() => setAdding(true)} data-testid="button-add-removal-rate">
          <Plus className="w-4 h-4 mr-1" /> Add Rate
        </Button>
      </div>

      {sections.map(({ title, items }) => (
        <Card key={title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{title}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Size Name</TableHead>
                  <TableHead>Basis</TableHead>
                  <TableHead>Min m²</TableHead>
                  <TableHead>Max m²</TableHead>
                  <TableHead>Cost/Unit ($)</TableHead>
                  <TableHead>Sell/Unit ($)</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-4">No rates</TableCell></TableRow>
                ) : items.map((r) => {
                  const d = r.data as any;
                  return (
                    <TableRow key={r.id} data-testid={`row-removal-${r.id}`}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{BASIS_LABELS[d.pricingBasis] || "Per Item"}</Badge></TableCell>
                      <TableCell>{d.minSqm}</TableCell>
                      <TableCell>{d.maxSqm >= 999 ? "∞" : d.maxSqm}</TableCell>
                      <TableCell className="font-medium">${d.costPerUnit}</TableCell>
                      <TableCell className="font-semibold">${d.sellPerUnit}</TableCell>
                      <TableCell><ScopeBadge entry={r} /></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditRate(r)} data-testid={`button-edit-removal-${r.id}`}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(r.id)} data-testid={`button-delete-removal-${r.id}`}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {(editRate || adding) && (
        <RemovalRateDialog entry={editRate} divisionCode={divisionCode} onClose={() => { setEditRate(null); setAdding(false); }} />
      )}

      {deleteId && (
        <Dialog open onOpenChange={() => setDeleteId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Rate</DialogTitle>
              <DialogDescription>Are you sure you want to delete this removal rate?</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteId!)} disabled={deleteMutation.isPending} data-testid="button-confirm-delete-removal">
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function RemovalRateDialog({ entry, divisionCode, onClose }: { entry: LibraryEntry | null; divisionCode?: string | null; onClose: () => void }) {
  const { toast } = useToast();
  const isEdit = !!entry;
  const d = (entry?.data ?? {}) as any;
  const [values, setValues] = useState({
    name: d.name ?? "",
    category: d.category ?? "window",
    pricingBasis: d.pricingBasis ?? "per_item",
    minSqm: d.minSqm ?? 0,
    maxSqm: d.maxSqm ?? 1,
    costPerUnit: d.costPerUnit ?? 0,
    sellPerUnit: d.sellPerUnit ?? 0,
    description: d.description ?? "",
  });
  const [scopeValue, setScopeValue] = useState<string>(entry?.divisionScope || divisionCode || "__shared__");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const ds = scopeValue === "__shared__" ? null : scopeValue;
      if (isEdit) {
        await apiRequest("PATCH", `/api/library/${entry!.id}`, { data: values, divisionScope: ds });
      } else {
        await apiRequest("POST", "/api/library", { type: "removal_rate", data: values, sortOrder: 0, divisionScope: ds });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      toast({ title: isEdit ? "Rate updated" : "Rate added" });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent data-testid="dialog-removal-rate">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Removal Rate" : "Add Removal Rate"}</DialogTitle>
          <DialogDescription>Set pricing for a removal size tier.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Size Name</Label>
            <Input value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} data-testid="input-removal-name" />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={values.category} onValueChange={(v) => setValues({ ...values, category: v })}>
              <SelectTrigger data-testid="select-removal-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="window">Window</SelectItem>
                <SelectItem value="door">Door</SelectItem>
                <SelectItem value="facade">Facade</SelectItem>
                <SelectItem value="all">All Items</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Pricing Basis</Label>
            <Select value={values.pricingBasis} onValueChange={(v) => setValues({ ...values, pricingBasis: v })}>
              <SelectTrigger data-testid="select-removal-basis"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="per_item">Per Item</SelectItem>
                <SelectItem value="per_m2">Per m²</SelectItem>
                <SelectItem value="per_lm">Per l/m (perimeter)</SelectItem>
              </SelectContent>
            </Select>
            {values.pricingBasis === "per_lm" && (
              <p className="text-xs text-muted-foreground mt-1">Quantity = 2 × (width + height) / 1000 per item</p>
            )}
            {values.pricingBasis === "per_m2" && (
              <p className="text-xs text-muted-foreground mt-1">Quantity = width × height / 1,000,000 per item</p>
            )}
          </div>
          <div>
            <Label>Min m²</Label>
            <Input type="number" value={values.minSqm} onChange={(e) => setValues({ ...values, minSqm: parseFloat(e.target.value) || 0 })} data-testid="input-removal-min" />
          </div>
          <div>
            <Label>Max m²</Label>
            <Input type="number" value={values.maxSqm} onChange={(e) => setValues({ ...values, maxSqm: parseFloat(e.target.value) || 0 })} data-testid="input-removal-max" />
          </div>
          <div>
            <Label>Cost per Unit ($)</Label>
            <Input type="number" value={values.costPerUnit} onChange={(e) => setValues({ ...values, costPerUnit: parseFloat(e.target.value) || 0 })} data-testid="input-removal-cost" />
          </div>
          <div>
            <Label>Sell per Unit ($)</Label>
            <Input type="number" value={values.sellPerUnit} onChange={(e) => setValues({ ...values, sellPerUnit: parseFloat(e.target.value) || 0 })} data-testid="input-removal-sell" />
          </div>
          <div className="col-span-2">
            <Label>Description</Label>
            <Input value={values.description} onChange={(e) => setValues({ ...values, description: e.target.value })} data-testid="input-removal-description" />
          </div>
          <div className="col-span-2">
            <DivisionScopeField value={scopeValue} onChange={setScopeValue} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!values.name.trim() || saveMutation.isPending} data-testid="button-save-removal">
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WasteSection({ divisionCode }: { divisionCode?: string | null }) {
  const { toast } = useToast();
  const { data: rates = [], isLoading } = useLibraryEntries("general_waste", divisionCode);
  const [editRate, setEditRate] = useState<LibraryEntry | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/library/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      setDeleteId(null);
      toast({ title: "Rate deleted" });
    },
  });

  if (isLoading) return <div className="p-4 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4" data-testid="waste-section">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">General Waste (Rubbish Removal) Rates</h2>
        <Button size="sm" onClick={() => setAdding(true)} data-testid="button-add-waste-rate">
          <Plus className="w-4 h-4 mr-1" /> Add Rate
        </Button>
      </div>

      <Card>
        <CardContent className="overflow-x-auto pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Cost/Tonne ($)</TableHead>
                <TableHead>Sell/Tonne ($)</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">No waste rates</TableCell></TableRow>
              ) : rates.map((r) => {
                const d = r.data as any;
                return (
                  <TableRow key={r.id} data-testid={`row-waste-${r.id}`}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="font-medium">${d.costPerTonne}</TableCell>
                    <TableCell className="font-semibold">${d.sellPerTonne}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{d.description}</TableCell>
                    <TableCell><ScopeBadge entry={r} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditRate(r)} data-testid={`button-edit-waste-${r.id}`}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(r.id)} data-testid={`button-delete-waste-${r.id}`}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(editRate || adding) && (
        <WasteRateDialog entry={editRate} divisionCode={divisionCode} onClose={() => { setEditRate(null); setAdding(false); }} />
      )}

      {deleteId && (
        <Dialog open onOpenChange={() => setDeleteId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Rate</DialogTitle>
              <DialogDescription>Are you sure you want to delete this waste rate?</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteId!)} disabled={deleteMutation.isPending} data-testid="button-confirm-delete-waste">
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function WasteRateDialog({ entry, divisionCode, onClose }: { entry: LibraryEntry | null; divisionCode?: string | null; onClose: () => void }) {
  const { toast } = useToast();
  const isEdit = !!entry;
  const d = (entry?.data ?? {}) as any;
  const [values, setValues] = useState({
    name: d.name ?? "General Waste Disposal",
    costPerTonne: d.costPerTonne ?? 0,
    sellPerTonne: d.sellPerTonne ?? 0,
    description: d.description ?? "",
  });
  const ds = divisionCode ?? null;
  const [scopeValue, setScopeValue] = useState<string>(entry?.divisionScope ?? ds ?? "all");

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        await apiRequest("PATCH", `/api/library/${entry!.id}`, { data: values, divisionScope: scopeValue === "all" ? null : scopeValue });
      } else {
        await apiRequest("POST", "/api/library", { type: "general_waste", data: values, sortOrder: 0, divisionScope: scopeValue === "all" ? null : scopeValue });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      toast({ title: isEdit ? "Rate updated" : "Rate added" });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent data-testid="dialog-waste-rate">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Waste Rate" : "Add Waste Rate"}</DialogTitle>
          <DialogDescription>Set pricing for rubbish removal by tonne.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Rate Name</Label>
            <Input value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} data-testid="input-waste-name" />
          </div>
          <div>
            <Label>Cost per Tonne ($)</Label>
            <Input type="number" value={values.costPerTonne} onChange={(e) => setValues({ ...values, costPerTonne: parseFloat(e.target.value) || 0 })} data-testid="input-waste-cost" />
          </div>
          <div>
            <Label>Sell per Tonne ($)</Label>
            <Input type="number" value={values.sellPerTonne} onChange={(e) => setValues({ ...values, sellPerTonne: parseFloat(e.target.value) || 0 })} data-testid="input-waste-sell" />
          </div>
          <div className="col-span-2">
            <Label>Description</Label>
            <Input value={values.description} onChange={(e) => setValues({ ...values, description: e.target.value })} data-testid="input-waste-description" />
          </div>
          <div className="col-span-2">
            <DivisionScopeField value={scopeValue} onChange={setScopeValue} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!values.name.trim() || saveMutation.isPending} data-testid="button-save-waste">
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SheetMaterial {
  id: string;
  divisionScope: string;
  supplierName: string;
  materialFamily: string;
  productDescription: string;
  grade: string;
  finish: string;
  thickness: string;
  sheetLength: string;
  sheetWidth: string;
  pricePerSheetExGst: string;
  isActive: boolean;
  notes: string;
  sourceReference: string;
}

const EMPTY_SHEET_MATERIAL = {
  supplierName: "",
  materialFamily: "",
  productDescription: "",
  grade: "",
  finish: "",
  thickness: "",
  sheetLength: "2400",
  sheetWidth: "1200",
  pricePerSheetExGst: "",
  isActive: true,
  notes: "",
  sourceReference: "",
};

function SheetMaterialsSection({ materialFamily }: { materialFamily: string }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_SHEET_MATERIAL);
  const [filterGrade, setFilterGrade] = useState<string>("all");
  const [filterFinish, setFilterFinish] = useState<string>("all");
  const [filterThickness, setFilterThickness] = useState<string>("all");
  const [filterSupplier, setFilterSupplier] = useState<string>("all");

  const { data: materials = [], isLoading } = useQuery<SheetMaterial[]>({
    queryKey: ["/api/ll-sheet-materials"],
  });

  const familyMaterials = materials.filter(m => m.materialFamily === materialFamily);

  const grades = [...new Set(familyMaterials.map(m => m.grade))].sort();
  const finishes = [...new Set(familyMaterials.map(m => m.finish).filter(Boolean))].sort();
  const thicknesses = [...new Set(familyMaterials.map(m => m.thickness))].sort((a, b) => parseFloat(a) - parseFloat(b));
  const suppliers = [...new Set(familyMaterials.map(m => m.supplierName))].sort();

  let filtered = familyMaterials;
  if (filterGrade !== "all") filtered = filtered.filter(m => m.grade === filterGrade);
  if (filterFinish !== "all") filtered = filtered.filter(m => m.finish === filterFinish);
  if (filterThickness !== "all") filtered = filtered.filter(m => m.thickness === filterThickness);
  if (filterSupplier !== "all") filtered = filtered.filter(m => m.supplierName === filterSupplier);

  const createMutation = useMutation({
    mutationFn: (data: typeof EMPTY_SHEET_MATERIAL) =>
      apiRequest("POST", "/api/ll-sheet-materials", { ...data, divisionScope: "LL" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ll-sheet-materials"] });
      toast({ title: "Sheet material created" });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof EMPTY_SHEET_MATERIAL }) =>
      apiRequest("PATCH", `/api/ll-sheet-materials/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ll-sheet-materials"] });
      toast({ title: "Sheet material updated" });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/ll-sheet-materials/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ll-sheet-materials"] });
      toast({ title: "Sheet material deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_SHEET_MATERIAL, materialFamily });
    setDialogOpen(true);
  }

  function openEdit(m: SheetMaterial) {
    setEditingId(m.id);
    setForm({
      supplierName: m.supplierName,
      materialFamily: m.materialFamily,
      productDescription: m.productDescription,
      grade: m.grade,
      finish: m.finish,
      thickness: m.thickness,
      sheetLength: m.sheetLength,
      sheetWidth: m.sheetWidth,
      pricePerSheetExGst: m.pricePerSheetExGst,
      isActive: m.isActive,
      notes: m.notes,
      sourceReference: m.sourceReference,
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setForm(EMPTY_SHEET_MATERIAL);
  }

  function handleSave() {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle data-testid="text-sheet-materials-title">{materialFamily} Sheet Materials</CardTitle>
          <Button size="sm" onClick={openAdd} data-testid="button-add-sheet-material">
            <Plus className="w-4 h-4 mr-1" /> Add Material
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-2" data-testid="sheet-material-filters">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          {suppliers.length > 1 && (
            <Select value={filterSupplier} onValueChange={setFilterSupplier}>
              <SelectTrigger className="w-[160px] h-8 text-xs" data-testid="select-filter-supplier">
                <SelectValue placeholder="Supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                {suppliers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {grades.length > 1 && (
            <Select value={filterGrade} onValueChange={setFilterGrade}>
              <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-filter-grade">
                <SelectValue placeholder="Grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {grades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {finishes.length > 1 && (
            <Select value={filterFinish} onValueChange={setFilterFinish}>
              <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-filter-finish">
                <SelectValue placeholder="Finish" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Finishes</SelectItem>
                {finishes.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {thicknesses.length > 1 && (
            <Select value={filterThickness} onValueChange={setFilterThickness}>
              <SelectTrigger className="w-[120px] h-8 text-xs" data-testid="select-filter-thickness">
                <SelectValue placeholder="Thickness" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Thicknesses</SelectItem>
                {thicknesses.map(t => <SelectItem key={t} value={t}>{t}mm</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <span className="text-xs text-muted-foreground">{filtered.length} of {familyMaterials.length} materials</span>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground">No sheet materials found.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Family</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Finish</TableHead>
                  <TableHead className="text-right">Thickness</TableHead>
                  <TableHead className="text-right">Sheet Size</TableHead>
                  <TableHead className="text-right">Price (ex GST)</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(m => (
                  <TableRow key={m.id} className={!m.isActive ? "opacity-50" : ""} data-testid={`row-material-${m.id}`}>
                    <TableCell className="text-xs">{m.supplierName}</TableCell>
                    <TableCell>{m.materialFamily}</TableCell>
                    <TableCell>{m.grade}</TableCell>
                    <TableCell>{m.finish}</TableCell>
                    <TableCell className="text-right font-mono">{m.thickness}mm</TableCell>
                    <TableCell className="text-right font-mono text-xs">{m.sheetLength}×{m.sheetWidth}</TableCell>
                    <TableCell className="text-right font-mono">${parseFloat(m.pricePerSheetExGst).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={m.isActive ? "default" : "secondary"} data-testid={`badge-active-${m.id}`}>
                        {m.isActive ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(m)} data-testid={`button-edit-material-${m.id}`}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(m.id)} data-testid={`button-delete-material-${m.id}`}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-lg" data-testid="dialog-sheet-material">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Sheet Material" : "Add Sheet Material"}</DialogTitle>
            <DialogDescription>Manage LL sheet material pricing from supplier lists.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Supplier Name *</Label>
                <Input value={form.supplierName} onChange={(e) => setForm(p => ({ ...p, supplierName: e.target.value }))} data-testid="input-supplier-name" />
              </div>
              <div>
                <Label>Material Family *</Label>
                <Input value={form.materialFamily} onChange={(e) => setForm(p => ({ ...p, materialFamily: e.target.value }))} placeholder="e.g. Mild Steel" data-testid="input-material-family" />
              </div>
            </div>
            <div>
              <Label>Product Description</Label>
              <Input value={form.productDescription} onChange={(e) => setForm(p => ({ ...p, productDescription: e.target.value }))} placeholder="e.g. HR Plate 2400x1200" data-testid="input-product-description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Grade *</Label>
                <Input value={form.grade} onChange={(e) => setForm(p => ({ ...p, grade: e.target.value }))} placeholder="e.g. Grade 250" data-testid="input-grade" />
              </div>
              <div>
                <Label>Finish</Label>
                <Input value={form.finish} onChange={(e) => setForm(p => ({ ...p, finish: e.target.value }))} placeholder="e.g. Hot Rolled" data-testid="input-finish" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Thickness (mm) *</Label>
                <Input type="number" step="0.1" value={form.thickness} onChange={(e) => setForm(p => ({ ...p, thickness: e.target.value }))} data-testid="input-sm-thickness" />
              </div>
              <div>
                <Label>Sheet Length (mm)</Label>
                <Input type="number" value={form.sheetLength} onChange={(e) => setForm(p => ({ ...p, sheetLength: e.target.value }))} data-testid="input-sheet-length" />
              </div>
              <div>
                <Label>Sheet Width (mm)</Label>
                <Input type="number" value={form.sheetWidth} onChange={(e) => setForm(p => ({ ...p, sheetWidth: e.target.value }))} data-testid="input-sheet-width" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Price per Sheet (ex GST) *</Label>
                <Input type="number" step="0.01" value={form.pricePerSheetExGst} onChange={(e) => setForm(p => ({ ...p, pricePerSheetExGst: e.target.value }))} data-testid="input-price-per-sheet" />
              </div>
              <div>
                <Label>Source Reference</Label>
                <Input value={form.sourceReference} onChange={(e) => setForm(p => ({ ...p, sourceReference: e.target.value }))} placeholder="e.g. NZ Steel Price List" data-testid="input-source-reference" />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} data-testid="input-sm-notes" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="sm-active"
                checked={form.isActive}
                onCheckedChange={(v) => setForm(p => ({ ...p, isActive: !!v }))}
                data-testid="checkbox-sm-active"
              />
              <Label htmlFor="sm-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={!form.supplierName || !form.materialFamily || !form.grade || !form.thickness || !form.pricePerSheetExGst || isPending}
              data-testid="button-save-sheet-material"
            >
              {isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
