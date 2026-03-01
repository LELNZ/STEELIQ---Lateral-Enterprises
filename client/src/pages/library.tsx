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
import { BookOpen, Plus, Pencil, Trash2, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { LibraryEntry } from "@shared/schema";
import { IGU_INFO } from "@shared/glass-library";

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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      toast({ title: "Library reset to defaults" });
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
            <SimpleSection type="liner_type" title="Liner Types" fields={["value", "label", "priceProvision"]} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
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
          <Card key={iguType}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {info?.label || iguType}
                {info && (
                  <>
                    <Badge variant="outline">R={info.rValue}</Badge>
                    <Badge variant="secondary">+${info.surcharge}/m²</Badge>
                  </>
                )}
              </CardTitle>
            </CardHeader>
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
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditEntry(entry)} data-testid={`button-edit-glass-${entry.id}`}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(entry.id)} data-testid={`button-delete-glass-${entry.id}`}>
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
          </Card>
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

function FrameTypeSection() {
  const { toast } = useToast();
  const { data: entries = [], isLoading } = useLibraryEntries("frame_type");
  const [editEntry, setEditEntry] = useState<LibraryEntry | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
          <h2 className="text-base font-semibold">Frame Types</h2>
          <p className="text-sm text-muted-foreground">{entries.length} frame types configured</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-frame-type">
          <Plus className="w-4 h-4 mr-1.5" /> Add Frame Type
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Value</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Categories</TableHead>
                <TableHead className="text-right">Price/kg</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const d = entry.data as any;
                return (
                  <TableRow key={entry.id} data-testid={`row-frame-type-${entry.id}`}>
                    <TableCell className="font-mono text-sm">{d.value}</TableCell>
                    <TableCell className="font-medium">{d.label}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(d.categories || []).map((c: string) => (
                          <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {d.pricePerKg != null ? `$${d.pricePerKg}` : "—"}
                    </TableCell>
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
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No frame types. Click "Add" or "Reset to Defaults".</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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

function HandlesSection() {
  return (
    <div className="space-y-6" data-testid="section-handles">
      <SimpleSection type="window_handle" title="Window Handles" fields={["value", "label", "priceProvision"]} />
      <SimpleSection type="door_handle" title="Door Handles" fields={["value", "label", "priceProvision"]} />
    </div>
  );
}

function SimpleSection({ type, title, fields }: { type: string; title: string; fields: string[] }) {
  const { toast } = useToast();
  const { data: entries = [], isLoading } = useLibraryEntries(type);
  const [editEntry, setEditEntry] = useState<LibraryEntry | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
    priceProvision: "Price Provision ($)",
  };

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
                          ? (d[f] != null ? `$${d[f]}` : "—")
                          : (d[f] ?? "—")}
                      </TableCell>
                    ))}
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
                <TableRow><TableCell colSpan={fields.length + 1} className="text-center text-muted-foreground py-8">No entries. Click "Add" or "Reset to Defaults".</TableCell></TableRow>
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

function SimpleDialog({ type, title, fields, fieldLabels, entry, onClose }: {
  type: string;
  title: string;
  fields: string[];
  fieldLabels: Record<string, string>;
  entry: LibraryEntry | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const d = entry ? (entry.data as any) : {};
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f, d[f]?.toString() || ""]))
  );

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
