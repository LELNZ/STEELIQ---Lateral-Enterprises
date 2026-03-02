import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { BookOpen, Plus, Pencil, Trash2, RotateCcw, ChevronRight, ChevronDown, Settings2, Wrench, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type {
  LibraryEntry, FrameConfiguration, ConfigurationProfile,
  ConfigurationAccessory, ConfigurationLabor,
} from "@shared/schema";
import { IGU_INFO } from "@shared/glass-library";
import { HANDLE_CATEGORIES, WANZ_BAR_DEFAULTS, WINDOW_CATEGORIES } from "@shared/item-options";

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

type LibraryTab = "glass" | "frame_type" | "frame_color" | "handles" | "liner_type" | "wanz_bar" | "direct_materials" | "manufacturing_labour" | "installation" | "delivery";

function useLibraryEntries(type: string) {
  return useQuery<LibraryEntry[]>({
    queryKey: ["/api/library", type],
    queryFn: async () => {
      const res = await fetch(`/api/library?type=${type}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
}

export default function Library() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<LibraryTab>("direct_materials");

  const seedMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/library/seed");
      await apiRequest("POST", "/api/frame-types/seed-configurations");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      queryClient.invalidateQueries({ queryKey: ["/api/frame-types"] });
      toast({ title: "Library and configurations reset to defaults" });
    },
  });

  const seedConfigsMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/frame-types/seed-configurations");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/frame-types"] });
      toast({ title: "Configuration data seeded" });
    },
  });

  return (
    <div className="flex flex-col h-full bg-background" data-testid="library-page">
      <header className="border-b px-6 py-3 flex items-center justify-between gap-4 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary">
            <BookOpen className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight" data-testid="text-library-title">
              Item Library
            </h1>
            <p className="text-xs text-muted-foreground">Manage reference data for quotes</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => seedMutation.mutate()}
          disabled={seedMutation.isPending}
          data-testid="button-reset-defaults"
        >
          <RotateCcw className="w-4 h-4 mr-1.5" />
          {seedMutation.isPending ? "Resetting..." : "Reset to Defaults"}
        </Button>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LibraryTab)}>
          <TabsList className="mb-4" data-testid="library-tabs">
            <TabsTrigger value="direct_materials" data-testid="tab-direct-materials">Direct Materials</TabsTrigger>
            <TabsTrigger value="manufacturing_labour" data-testid="tab-manufacturing-labour">Manufacturing Labour</TabsTrigger>
            <TabsTrigger value="glass" data-testid="tab-glass">Glass</TabsTrigger>
            <TabsTrigger value="frame_type" data-testid="tab-frame-types">Frame Types</TabsTrigger>
            <TabsTrigger value="frame_color" data-testid="tab-frame-colors">Frame Colors</TabsTrigger>
            <TabsTrigger value="handles" data-testid="tab-handles">Handles</TabsTrigger>
            <TabsTrigger value="liner_type" data-testid="tab-liner-types">Liner Types</TabsTrigger>
            <TabsTrigger value="wanz_bar" data-testid="tab-wanz-bar">Wanz Bar</TabsTrigger>
            <TabsTrigger value="installation" data-testid="tab-installation">Installation</TabsTrigger>
            <TabsTrigger value="delivery" data-testid="tab-delivery">Delivery</TabsTrigger>
          </TabsList>

          <TabsContent value="glass">
            <GlassSection />
          </TabsContent>
          <TabsContent value="frame_type">
            <FrameTypeSection />
          </TabsContent>
          <TabsContent value="frame_color">
            <SimpleSection type="frame_color" title="Frame Colors" fields={["value", "label", "priceProvision"]} />
          </TabsContent>
          <TabsContent value="handles">
            <HandlesSection />
          </TabsContent>
          <TabsContent value="liner_type">
            <LinerTypeSection />
          </TabsContent>
          <TabsContent value="wanz_bar">
            <WanzBarSection />
          </TabsContent>
          <TabsContent value="direct_materials">
            <DirectMaterialsSection />
          </TabsContent>
          <TabsContent value="manufacturing_labour">
            <ManufacturingLabourSection />
          </TabsContent>
          <TabsContent value="installation">
            <InstallationSection />
          </TabsContent>
          <TabsContent value="delivery">
            <DeliverySection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function GlassTypeCollapsible({ iguType, info, items, onEdit, onDelete }: {
  iguType: string;
  info: { label: string; rValue: number } | undefined;
  items: LibraryEntry[];
  onEdit: (e: LibraryEntry) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="text-sm flex items-center gap-2">
              {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              {info?.label || iguType}
              <Badge variant="outline" className="text-[10px]">{items.length} combos</Badge>
              {info && (
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
                    <TableHead className="text-right">4/4</TableHead>
                    <TableHead className="text-right">5/4</TableHead>
                    <TableHead className="text-right">5/5</TableHead>
                    <TableHead className="text-right">6/5</TableHead>
                    <TableHead className="text-right">6/6</TableHead>
                    <TableHead className="text-right">8/8</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((entry) => {
                    const d = entry.data as any;
                    return (
                      <TableRow key={entry.id} data-testid={`row-glass-${entry.id}`}>
                        <TableCell className="font-medium text-sm">{d.combo}</TableCell>
                        {["4/4", "5/4", "5/5", "6/5", "6/6", "8/8"].map((t) => (
                          <TableCell key={t} className="text-right font-mono text-sm">
                            {d.prices[t] != null ? `$${d.prices[t].toFixed(2)}` : "—"}
                          </TableCell>
                        ))}
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

function GlassSection() {
  const { toast } = useToast();
  const { data: entries = [], isLoading } = useLibraryEntries("glass");
  const [editEntry, setEditEntry] = useState<LibraryEntry | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/library/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library", "glass"] });
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

function GlassDialog({ entry, onClose }: { entry: LibraryEntry | null; onClose: () => void }) {
  const { toast } = useToast();
  const d = entry ? (entry.data as any) : {};
  const [iguType, setIguType] = useState(d.iguType || "EnergySaver");
  const [combo, setCombo] = useState(d.combo || "");
  const [prices, setPrices] = useState<Record<string, string>>({
    "4/4": d.prices?.["4/4"]?.toString() || "",
    "5/4": d.prices?.["5/4"]?.toString() || "",
    "5/5": d.prices?.["5/5"]?.toString() || "",
    "6/5": d.prices?.["6/5"]?.toString() || "",
    "6/6": d.prices?.["6/6"]?.toString() || "",
    "8/8": d.prices?.["8/8"]?.toString() || "",
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const priceObj: Record<string, number> = {};
      for (const [k, v] of Object.entries(prices)) {
        if (v.trim()) priceObj[k] = parseFloat(v);
      }
      const data = { iguType, combo, prices: priceObj };
      if (entry) {
        await apiRequest("PATCH", `/api/library/${entry.id}`, { data });
      } else {
        await apiRequest("POST", "/api/library", { type: "glass", data, sortOrder: 0 });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library", "glass"] });
      toast({ title: entry ? "Glass entry updated" : "Glass entry added" });
      onClose();
    },
  });

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
            <Select value={iguType} onValueChange={setIguType}>
              <SelectTrigger data-testid="select-dialog-igu">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EnergySaver">EnergySaver™</SelectItem>
                <SelectItem value="LightBridge">LightBridge™</SelectItem>
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
              {["4/4", "5/4", "5/5", "6/5", "6/6", "8/8"].map((t) => (
                <div key={t}>
                  <Label className="text-xs text-muted-foreground">{t}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={prices[t]}
                    onChange={(e) => setPrices({ ...prices, [t]: e.target.value })}
                    placeholder="0.00"
                    data-testid={`input-price-${t.replace("/", "-")}`}
                  />
                </div>
              ))}
            </div>
          </div>
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

function FrameTypeSection() {
  const { toast } = useToast();
  const { data: entries = [], isLoading } = useLibraryEntries("frame_type");
  const [editEntry, setEditEntry] = useState<LibraryEntry | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedFt, setExpandedFt] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/library/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library", "frame_type"] });
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
        <Card><CardContent className="text-center text-muted-foreground py-8">No frame types. Click "Add" or "Reset to Defaults".</CardContent></Card>
      )}

      {(showAdd || editEntry) && (
        <FrameTypeDialog entry={editEntry} onClose={() => { setShowAdd(false); setEditEntry(null); }} />
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
                <TableHead className="text-xs">Surface</TableHead>
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
                  <TableCell className="text-xs">{p.surface}</TableCell>
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
  const [mouldNumber, setMouldNumber] = useState(profile?.mouldNumber || "");
  const [role, setRole] = useState(profile?.role || "outer-frame");
  const [kgPerMetre, setKgPerMetre] = useState(profile?.kgPerMetre || "");
  const [pricePerKgUsd, setPricePerKgUsd] = useState(profile?.pricePerKgUsd || "");
  const [quantityPerSet, setQuantityPerSet] = useState((profile?.quantityPerSet || 1).toString());
  const [lengthFormula, setLengthFormula] = useState(profile?.lengthFormula || "perimeter");
  const [surface, setSurface] = useState(profile?.surface || "");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = { mouldNumber, role, kgPerMetre, pricePerKgUsd, quantityPerSet: parseInt(quantityPerSet) || 1, lengthFormula, surface };
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
                {PROFILE_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
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
          <div className="col-span-2">
            <Label className="text-xs">Surface / Colour Code</Label>
            <Input value={surface} onChange={(e) => setSurface(e.target.value)} placeholder="e.g. HYX87838, Mill Finish" data-testid="input-profile-surface" />
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

function FrameTypeDialog({ entry, onClose }: { entry: LibraryEntry | null; onClose: () => void }) {
  const { toast } = useToast();
  const d = entry ? (entry.data as any) : {};
  const [value, setValue] = useState(d.value || "");
  const [label, setLabel] = useState(d.label || "");
  const [categories, setCategories] = useState<string[]>(d.categories || []);
  const [pricePerKg, setPricePerKg] = useState(d.pricePerKg?.toString() || "");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        value, label, categories,
        pricePerKg: pricePerKg.trim() ? parseFloat(pricePerKg) : null,
      };
      if (entry) {
        await apiRequest("PATCH", `/api/library/${entry.id}`, { data });
      } else {
        await apiRequest("POST", "/api/library", { type: "frame_type", data, sortOrder: 0 });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library", "frame_type"] });
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

function LinerTypeSection() {
  const { data: frameTypes = [] } = useLibraryEntries("frame_type");
  const allFrameTypeLabels = frameTypes.map((ft) => (ft.data as any).label as string).filter(Boolean);
  return (
    <SimpleSection
      type="liner_type"
      title="Liner Types (price per linear metre)"
      fields={["value", "label", "priceProvision"]}
      priceUnit="/lin.m"
      allFrameTypeLabels={allFrameTypeLabels}
    />
  );
}

function WanzBarSection() {
  const { toast } = useToast();
  const { data: entries = [], isLoading } = useLibraryEntries("wanz_bar");
  const { data: frameTypes = [] } = useLibraryEntries("frame_type");
  const allFrameTypeLabels = frameTypes.map((ft) => (ft.data as any).label as string).filter(Boolean);
  const [editEntry, setEditEntry] = useState<LibraryEntry | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/library/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library", "wanz_bar"] });
      toast({ title: "Wanz Bar entry deleted" });
      setDeleteId(null);
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      for (const e of entries) await apiRequest("DELETE", `/api/library/${e.id}`);
      for (const wb of WANZ_BAR_DEFAULTS) {
        await apiRequest("POST", "/api/library", { type: "wanz_bar", data: wb, sortOrder: 0 });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library", "wanz_bar"] });
      toast({ title: "Wanz Bar entries reset to defaults" });
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
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending} data-testid="button-reset-wanz-bar">
            <RotateCcw className="w-4 h-4 mr-1.5" /> Reset to Defaults
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-wanz-bar">
            <Plus className="w-4 h-4 mr-1.5" /> Add
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Section #</TableHead>
                <TableHead>Label</TableHead>
                <TableHead className="text-right">kg/m</TableHead>
                <TableHead className="text-right">Price USD/kg</TableHead>
                <TableHead className="text-right">Price NZD/lin.m</TableHead>
                <TableHead>Allocation</TableHead>
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
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No entries. Click "Add" or "Reset to Defaults".</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(showAdd || editEntry) && (
        <WanzBarDialog entry={editEntry} allFrameTypeLabels={allFrameTypeLabels} onClose={() => { setShowAdd(false); setEditEntry(null); }} />
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

function WanzBarDialog({ entry, allFrameTypeLabels, onClose }: { entry: LibraryEntry | null; allFrameTypeLabels: string[]; onClose: () => void }) {
  const { toast } = useToast();
  const d = entry ? (entry.data as any) : {};
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
      if (entry) {
        await apiRequest("PATCH", `/api/library/${entry.id}`, { data });
      } else {
        await apiRequest("POST", "/api/library", { type: "wanz_bar", data, sortOrder: 0 });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library", "wanz_bar"] });
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

function HandlesSection() {
  return (
    <div className="space-y-4" data-testid="section-handles">
      <div>
        <h2 className="text-base font-semibold">Handles by Category</h2>
        <p className="text-sm text-muted-foreground">{HANDLE_CATEGORIES.length} handle categories</p>
      </div>
      {HANDLE_CATEGORIES.map((hc) => (
        <HandleCategoryCollapsible key={hc.type} handleCat={hc} />
      ))}
    </div>
  );
}

function HandleCategoryCollapsible({ handleCat }: { handleCat: typeof HANDLE_CATEGORIES[number] }) {
  const [open, setOpen] = useState(false);
  const { data: entries = [] } = useLibraryEntries(handleCat.type);
  const { data: frameTypes = [] } = useLibraryEntries("frame_type");
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
            <SimpleSection type={handleCat.type} title={handleCat.label} fields={["value", "label", "priceProvision"]} defaultAllocation={defaultAllocation} allFrameTypeLabels={allFrameTypeLabels} />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function SimpleSection({ type, title, fields, priceUnit, defaultAllocation, allFrameTypeLabels }: { type: string; title: string; fields: string[]; priceUnit?: string; defaultAllocation?: string; allFrameTypeLabels?: string[] }) {
  const { toast } = useToast();
  const { data: entries = [], isLoading } = useLibraryEntries(type);
  const [editEntry, setEditEntry] = useState<LibraryEntry | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const hasAllocation = !!defaultAllocation || (Array.isArray(allFrameTypeLabels) && allFrameTypeLabels.length > 0);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/library/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library", type] });
      toast({ title: `${title} entry deleted` });
      setDeleteId(null);
    },
  });

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

  const fieldLabels: Record<string, string> = {
    value: "Value (ID)",
    label: "Display Label",
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
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {fields.map((f) => (
                  <TableHead key={f} className={f === "priceProvision" ? "text-right" : ""}>
                    {fieldLabels[f] || f}
                  </TableHead>
                ))}
                {hasAllocation && <TableHead>Allocation</TableHead>}
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
                <TableRow><TableCell colSpan={fields.length + (hasAllocation ? 2 : 1)} className="text-center text-muted-foreground py-8">No entries. Click "Add" or "Reset to Defaults".</TableCell></TableRow>
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

function SimpleDialog({ type, title, fields, fieldLabels, entry, defaultAllocation, allFrameTypeLabels, onClose }: {
  type: string;
  title: string;
  fields: string[];
  fieldLabels: Record<string, string>;
  entry: LibraryEntry | null;
  defaultAllocation?: string;
  allFrameTypeLabels?: string[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const d = entry ? (entry.data as any) : {};
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f, d[f]?.toString() || ""]))
  );

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
      if (entry) {
        await apiRequest("PATCH", `/api/library/${entry.id}`, { data });
      } else {
        await apiRequest("POST", "/api/library", { type, data, sortOrder: 0 });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library", type] });
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

const FAMILY_GROUPS = ["ES52 Window", "ES52 Hinge Door", "ES127 Sliding Door"];

function DirectMaterialsSection() {
  const { toast } = useToast();
  const { data: profiles = [], isLoading: pLoading } = useLibraryEntries("direct_profile");
  const { data: accessories = [], isLoading: aLoading } = useLibraryEntries("direct_accessory");
  const [editProfile, setEditProfile] = useState<LibraryEntry | null>(null);
  const [editAccessory, setEditAccessory] = useState<LibraryEntry | null>(null);
  const [addingProfile, setAddingProfile] = useState(false);
  const [addingAccessory, setAddingAccessory] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const seedMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/library/seed-direct-materials"); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library", "direct_profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/library", "direct_accessory"] });
      toast({ title: "Direct materials seeded from configurations" });
    },
  });

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
        <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} data-testid="button-seed-direct-materials">
          <RotateCcw className="w-4 h-4 mr-1.5" />
          {seedMutation.isPending ? "Seeding..." : "Seed from Configurations"}
        </Button>
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
          onClose={() => { setEditProfile(null); setAddingProfile(false); }}
        />
      )}
      {(editAccessory || addingAccessory) && (
        <DirectAccessoryDialog
          entry={editAccessory}
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mould #</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>kg/m</TableHead>
                      <TableHead>$/kg USD</TableHead>
                      <TableHead>Length</TableHead>
                      <TableHead>Surface</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profiles.map((p) => {
                      const d = p.data as any;
                      return (
                        <TableRow key={p.id} data-testid={`row-profile-${p.id}`}>
                          <TableCell className="font-mono text-xs">{d.mouldNumber}</TableCell>
                          <TableCell><Badge variant="outline">{d.role}</Badge></TableCell>
                          <TableCell>{d.kgPerMetre}</TableCell>
                          <TableCell>${d.pricePerKgUsd}</TableCell>
                          <TableCell>{d.lengthFormula}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{d.surface}</TableCell>
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
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-4">No profiles</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible open={accessoriesOpen} onOpenChange={setAccessoriesOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium cursor-pointer hover:text-primary py-1">
                {accessoriesOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Accessories ({accessories.length})
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Colour</TableHead>
                      <TableHead>$/USD</TableHead>
                      <TableHead>Scaling</TableHead>
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
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">No accessories</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function DirectProfileDialog({ entry, onClose }: { entry: LibraryEntry | null; onClose: () => void }) {
  const { toast } = useToast();
  const isEdit = !!entry;
  const d = entry ? (entry.data as any) : {};
  const [values, setValues] = useState({
    mouldNumber: d.mouldNumber || "",
    role: d.role || "spacer",
    kgPerMetre: d.kgPerMetre || "",
    pricePerKgUsd: d.pricePerKgUsd || "",
    lengthFormula: d.lengthFormula || "perimeter",
    surface: d.surface || "",
    familyGroup: d.familyGroup || ["ES52 Window"],
    description: d.description || "",
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        await apiRequest("PATCH", `/api/library/direct-profiles/${entry!.id}`, { data: values });
      } else {
        await apiRequest("POST", "/api/library", { type: "direct_profile", data: values, sortOrder: 0 });
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
      <DialogContent data-testid="dialog-direct-profile">
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
                {PROFILE_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
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
          <div>
            <Label>Surface</Label>
            <Input value={values.surface} onChange={(e) => setValues({ ...values, surface: e.target.value })} data-testid="input-surface" />
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

function DirectAccessoryDialog({ entry, onClose }: { entry: LibraryEntry | null; onClose: () => void }) {
  const { toast } = useToast();
  const isEdit = !!entry;
  const d = entry ? (entry.data as any) : {};
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
      if (isEdit) {
        await apiRequest("PATCH", `/api/library/direct-accessories/${entry!.id}`, { data: values });
      } else {
        await apiRequest("POST", "/api/library", { type: "direct_accessory", data: values, sortOrder: 0 });
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

function ManufacturingLabourSection() {
  const { toast } = useToast();
  const { data: operations = [], isLoading } = useLibraryEntries("labour_operation");
  const [editOp, setEditOp] = useState<LibraryEntry | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/library/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library", "labour_operation"] });
      setDeleteId(null);
      toast({ title: "Operation deleted" });
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

      <LabourCategoryGroup title="Manual Processes" operations={manual} onEdit={setEditOp} onDelete={setDeleteId} />
      <LabourCategoryGroup title="CNC Processes" operations={cnc} onEdit={setEditOp} onDelete={setDeleteId} />

      {(editOp || adding) && (
        <LabourOperationDialog entry={editOp} onClose={() => { setEditOp(null); setAdding(false); }} />
      )}
      <DeleteConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} isPending={deleteMutation.isPending} />
    </div>
  );
}

function LabourCategoryGroup({ title, operations, onEdit, onDelete }: {
  title: string;
  operations: LibraryEntry[];
  onEdit: (e: LibraryEntry) => void;
  onDelete: (id: string) => void;
}) {
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
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operation</TableHead>
                  <TableHead>Time (min)</TableHead>
                  <TableHead>Rate ($/hr)</TableHead>
                  <TableHead>Cost/Unit ($)</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operations.map((o) => {
                  const d = o.data as any;
                  const cost = ((parseFloat(d.timeMinutes) || 0) / 60) * (parseFloat(d.ratePerHour) || 0);
                  return (
                    <TableRow key={o.id} data-testid={`row-labour-${o.id}`}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell>{d.timeMinutes}</TableCell>
                      <TableCell>${d.ratePerHour}</TableCell>
                      <TableCell className="font-semibold">${cost.toFixed(2)}</TableCell>
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
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">No operations</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function LabourOperationDialog({ entry, onClose }: { entry: LibraryEntry | null; onClose: () => void }) {
  const { toast } = useToast();
  const isEdit = !!entry;
  const d = entry ? (entry.data as any) : {};
  const [values, setValues] = useState({
    name: d.name || "",
    category: d.category || "manual",
    timeMinutes: d.timeMinutes || 15,
    ratePerHour: d.ratePerHour || 45,
    description: d.description || "",
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        await apiRequest("PATCH", `/api/library/${entry!.id}`, { data: values });
      } else {
        await apiRequest("POST", "/api/library", { type: "labour_operation", data: values, sortOrder: 0 });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library", "labour_operation"] });
      toast({ title: isEdit ? "Operation updated" : "Operation added" });
      onClose();
    },
  });

  const cost = ((values.timeMinutes || 0) / 60) * (values.ratePerHour || 0);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent data-testid="dialog-labour-operation">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Operation" : "Add Operation"}</DialogTitle>
          <DialogDescription>Set time and rate for this manufacturing operation.</DialogDescription>
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
            <Label>Time (minutes)</Label>
            <Input type="number" value={values.timeMinutes} onChange={(e) => setValues({ ...values, timeMinutes: parseFloat(e.target.value) || 0 })} data-testid="input-labour-time" />
          </div>
          <div>
            <Label>Rate ($/hr NZD)</Label>
            <Input type="number" value={values.ratePerHour} onChange={(e) => setValues({ ...values, ratePerHour: parseFloat(e.target.value) || 0 })} data-testid="input-labour-rate" />
          </div>
          <div className="col-span-2 text-sm text-muted-foreground">
            Calculated cost per unit: <span className="font-semibold text-foreground">${cost.toFixed(2)}</span>
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

function InstallationSection() {
  const { toast } = useToast();
  const { data: rates = [], isLoading } = useLibraryEntries("installation_rate");
  const [editRate, setEditRate] = useState<LibraryEntry | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/library/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library", "installation_rate"] });
      setDeleteId(null);
      toast({ title: "Rate deleted" });
    },
  });

  const windowRates = rates.filter((r) => (r.data as any).category === "window");
  const doorRates = rates.filter((r) => (r.data as any).category === "door");

  if (isLoading) return <div className="p-4 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4" data-testid="installation-section">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Installation Labour Rates</h2>
        <Button size="sm" onClick={() => setAdding(true)} data-testid="button-add-installation-rate">
          <Plus className="w-4 h-4 mr-1" /> Add Rate
        </Button>
      </div>

      {[{ title: "Window Installation", items: windowRates }, { title: "Door Installation", items: doorRates }].map(({ title, items }) => (
        <Card key={title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Size Name</TableHead>
                  <TableHead>Min m²</TableHead>
                  <TableHead>Max m²</TableHead>
                  <TableHead>Price/Unit ($)</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r) => {
                  const d = r.data as any;
                  return (
                    <TableRow key={r.id} data-testid={`row-installation-${r.id}`}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell>{d.minSqm}</TableCell>
                      <TableCell>{d.maxSqm >= 999 ? "∞" : d.maxSqm}</TableCell>
                      <TableCell className="font-semibold">${d.pricePerUnit}</TableCell>
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
        <InstallationRateDialog entry={editRate} onClose={() => { setEditRate(null); setAdding(false); }} />
      )}
      <DeleteConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} isPending={deleteMutation.isPending} />
    </div>
  );
}

function InstallationRateDialog({ entry, onClose }: { entry: LibraryEntry | null; onClose: () => void }) {
  const { toast } = useToast();
  const isEdit = !!entry;
  const d = entry ? (entry.data as any) : {};
  const [values, setValues] = useState({
    name: d.name || "",
    category: d.category || "window",
    minSqm: d.minSqm ?? 0,
    maxSqm: d.maxSqm ?? 1,
    pricePerUnit: d.pricePerUnit ?? 250,
    description: d.description || "",
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        await apiRequest("PATCH", `/api/library/${entry!.id}`, { data: values });
      } else {
        await apiRequest("POST", "/api/library", { type: "installation_rate", data: values, sortOrder: 0 });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library", "installation_rate"] });
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
              </SelectContent>
            </Select>
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
            <Label>Price per Unit ($)</Label>
            <Input type="number" value={values.pricePerUnit} onChange={(e) => setValues({ ...values, pricePerUnit: parseFloat(e.target.value) || 0 })} data-testid="input-installation-price" />
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

function DeliverySection() {
  const { toast } = useToast();
  const { data: rates = [], isLoading } = useLibraryEntries("delivery_rate");
  const [editRate, setEditRate] = useState<LibraryEntry | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/library/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library", "delivery_rate"] });
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
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Delivery Method</TableHead>
                <TableHead>Rate ($ NZD)</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((r) => {
                const d = r.data as any;
                return (
                  <TableRow key={r.id} data-testid={`row-delivery-${r.id}`}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="font-semibold">{d.rateNzd > 0 ? `$${d.rateNzd}` : "Custom"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.description}</TableCell>
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
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No delivery rates</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(editRate || adding) && (
        <DeliveryRateDialog entry={editRate} onClose={() => { setEditRate(null); setAdding(false); }} />
      )}
      <DeleteConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} isPending={deleteMutation.isPending} />
    </div>
  );
}

function DeliveryRateDialog({ entry, onClose }: { entry: LibraryEntry | null; onClose: () => void }) {
  const { toast } = useToast();
  const isEdit = !!entry;
  const d = entry ? (entry.data as any) : {};
  const [values, setValues] = useState({
    name: d.name || "",
    vehicle: d.vehicle || "",
    rateNzd: d.rateNzd ?? 0,
    description: d.description || "",
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        await apiRequest("PATCH", `/api/library/${entry!.id}`, { data: values });
      } else {
        await apiRequest("POST", "/api/library", { type: "delivery_rate", data: values, sortOrder: 0 });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library", "delivery_rate"] });
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
            <Label>Rate ($ NZD)</Label>
            <Input type="number" value={values.rateNzd} onChange={(e) => setValues({ ...values, rateNzd: parseFloat(e.target.value) || 0 })} data-testid="input-delivery-rate" />
          </div>
          <div className="col-span-2">
            <Label>Description</Label>
            <Input value={values.description} onChange={(e) => setValues({ ...values, description: e.target.value })} data-testid="input-delivery-description" />
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
