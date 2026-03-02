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

type LibraryTab = "glass" | "frame_type" | "frame_color" | "handles" | "liner_type";

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
  const [activeTab, setActiveTab] = useState<LibraryTab>("glass");

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
            <TabsTrigger value="glass" data-testid="tab-glass">Glass</TabsTrigger>
            <TabsTrigger value="frame_type" data-testid="tab-frame-types">Frame Types</TabsTrigger>
            <TabsTrigger value="frame_color" data-testid="tab-frame-colors">Frame Colors</TabsTrigger>
            <TabsTrigger value="handles" data-testid="tab-handles">Handles</TabsTrigger>
            <TabsTrigger value="liner_type" data-testid="tab-liner-types">Liner Types</TabsTrigger>
            <TabsTrigger value="wanz_bar" data-testid="tab-wanz-bar">Wanz Bar</TabsTrigger>
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
