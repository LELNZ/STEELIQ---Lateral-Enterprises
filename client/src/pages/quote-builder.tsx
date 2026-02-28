import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertQuoteItemSchema, type InsertQuoteItem, type QuoteItem } from "@shared/schema";
import DrawingCanvas, { getFrameSize } from "@/components/drawing-canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Pencil, Copy, Ruler, LayoutGrid } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CATEGORY_OPTIONS = [
  { value: "windows-standard", label: "Windows Standard" },
  { value: "sliding-window", label: "Sliding Window" },
  { value: "entrance-door", label: "Entrance Door" },
  { value: "hinge-door", label: "Hinge Door" },
  { value: "french-door", label: "French Door" },
  { value: "bifold-door", label: "Bi-folding Door" },
  { value: "stacker-door", label: "Stacker Door" },
  { value: "bay-window", label: "Bay Window" },
];

function getCategoryLabel(cat: string) {
  return CATEGORY_OPTIONS.find((c) => c.value === cat)?.label || cat;
}

function getLayoutSummary(config: QuoteItem) {
  if (config.layout === "custom") {
    return `Custom ${config.rows}x${config.columns}`;
  }
  const cat = config.category;
  if (cat === "windows-standard") return config.windowType === "awning" ? "Awning" : "Fixed";
  if (cat === "sliding-window") return "Fixed + Sliding";
  if (cat === "entrance-door") return "Door + Sidelight";
  if (cat === "hinge-door") return `${config.hingeSide === "left" ? "Left" : "Right"} Hinge`;
  if (cat === "french-door") return "Double Door";
  if (cat === "bifold-door") return `${config.panels} Leaves`;
  if (cat === "stacker-door") return `${config.panels} Panels`;
  if (cat === "bay-window") return "Bay (3 Panel)";
  return "Standard";
}

const defaultValues: InsertQuoteItem = {
  name: "W-01",
  quantity: 1,
  category: "windows-standard",
  width: 1200,
  height: 1500,
  layout: "standard",
  windowType: "fixed",
  hingeSide: "left",
  openDirection: "out",
  halfSolid: false,
  panels: 3,
  sidelightWidth: 400,
  rows: 1,
  columns: 2,
  paneTypes: ["fixed", "fixed"],
  bifoldLeftCount: 0,
  centerWidth: 0,
};

export default function QuoteBuilder() {
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<InsertQuoteItem>({
    resolver: zodResolver(insertQuoteItemSchema),
    defaultValues,
  });

  const w = form.watch();
  const category = w.category;
  const layout = w.layout;
  const frameSize = getFrameSize(category);

  useEffect(() => {
    form.setValue("layout", "standard");
    form.setValue("windowType", "fixed");
    form.setValue("hingeSide", "left");
    form.setValue("openDirection", "out");
    form.setValue("halfSolid", false);
    form.setValue("sidelightWidth", 400);
    form.setValue("centerWidth", 0);
    form.setValue("rows", 1);
    form.setValue("columns", 2);
    form.setValue("paneTypes", ["fixed", "fixed"]);
    if (category === "bifold-door") {
      form.setValue("panels", 3);
      form.setValue("bifoldLeftCount", 1);
    } else if (category === "stacker-door") {
      form.setValue("panels", 3);
    } else {
      form.setValue("panels", 3);
      form.setValue("bifoldLeftCount", 0);
    }
  }, [category]);

  useEffect(() => {
    if (layout === "custom") {
      const total = (w.rows || 1) * (w.columns || 1);
      const current = w.paneTypes || [];
      if (current.length !== total) {
        const next = Array.from({ length: total }, (_, i) => current[i] || "fixed");
        form.setValue("paneTypes", next);
      }
    }
  }, [w.rows, w.columns, layout]);

  const isCustom = layout === "custom";

  const showWindowType = !isCustom && category === "windows-standard";
  const showHingeSide = !isCustom && ["entrance-door", "hinge-door"].includes(category);
  const showHalfSolid = !isCustom && ["entrance-door", "hinge-door"].includes(category);
  const showSidelightWidth = !isCustom && category === "entrance-door";
  const showPanels = !isCustom && ["bifold-door", "stacker-door"].includes(category);
  const showBifoldSplit = !isCustom && category === "bifold-door";
  const showCenterWidth = !isCustom && category === "bay-window";
  const showOpenDirection = !isCustom && !["sliding-window", "stacker-door"].includes(category);
  const showGrid = isCustom;

  function onSubmit(data: InsertQuoteItem) {
    if (editingId) {
      setItems(items.map((item) => (item.id === editingId ? { ...data, id: editingId } : item)));
      setEditingId(null);
      toast({ title: "Item updated", description: `${data.name} has been updated.` });
    } else {
      const newItem: QuoteItem = { ...data, id: crypto.randomUUID() };
      setItems([...items, newItem]);
      toast({ title: "Item added", description: `${data.name} added to quote.` });
    }
    form.reset(defaultValues);
  }

  function editItem(item: QuoteItem) {
    const { id, ...rest } = item;
    form.reset(rest);
    setEditingId(id);
  }

  function duplicateItem(item: QuoteItem) {
    const newItem: QuoteItem = { ...item, id: crypto.randomUUID(), name: `${item.name} (copy)` };
    setItems([...items, newItem]);
    toast({ title: "Item duplicated" });
  }

  function deleteItem(id: string) {
    setItems(items.filter((item) => item.id !== id));
    if (editingId === id) { setEditingId(null); form.reset(defaultValues); }
    toast({ title: "Item removed" });
  }

  function cancelEdit() {
    setEditingId(null);
    form.reset(defaultValues);
  }

  function togglePaneType(index: number) {
    const current = [...(w.paneTypes || [])];
    current[index] = current[index] === "awning" ? "fixed" : "awning";
    form.setValue("paneTypes", current);
  }

  const drawingConfig: InsertQuoteItem = {
    ...w,
    width: w.width || 1200,
    height: w.height || 1500,
    quantity: w.quantity || 1,
    name: w.name || "Untitled",
  };

  const gridRows = w.rows || 1;
  const gridCols = w.columns || 1;

  return (
    <div className="flex flex-col h-screen bg-background" data-testid="quote-builder">
      <header className="border-b px-6 py-3 flex items-center justify-between gap-4 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary">
            <LayoutGrid className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight" data-testid="text-app-title">
              Pro-Quote CAD Generator
            </h1>
            <p className="text-xs text-muted-foreground">Configure and quote windows & doors</p>
          </div>
        </div>
        {items.length > 0 && (
          <Badge variant="secondary" data-testid="badge-item-count">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </Badge>
        )}
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <ScrollArea className="w-full lg:w-80 xl:w-96 border-r shrink-0">
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 space-y-4">
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                <Ruler className="w-3.5 h-3.5" /> Item Details
              </h2>
              <div className="space-y-2">
                <div>
                  <Label htmlFor="name" className="text-xs">Item ID / Reference</Label>
                  <Input id="name" {...form.register("name")} data-testid="input-item-name" />
                </div>
                <div>
                  <Label htmlFor="quantity" className="text-xs">Quantity</Label>
                  <Input id="quantity" type="number" min={1}
                    {...form.register("quantity", { valueAsNumber: true })}
                    data-testid="input-quantity" />
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Type & Dimensions
              </h2>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Category</Label>
                  <Select value={category} onValueChange={(v) => form.setValue("category", v as any)}>
                    <SelectTrigger data-testid="select-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="width" className="text-xs">Width (mm)</Label>
                    <Input id="width" type="number" min={200}
                      {...form.register("width", { valueAsNumber: true })}
                      data-testid="input-width" />
                  </div>
                  <div>
                    <Label htmlFor="height" className="text-xs">Height (mm)</Label>
                    <Input id="height" type="number" min={200}
                      {...form.register("height", { valueAsNumber: true })}
                      data-testid="input-height" />
                  </div>
                </div>
                <Badge variant="outline" className="text-xs" data-testid="badge-frame-size">
                  {frameSize}mm Frame
                </Badge>
              </div>
            </div>

            <Separator />

            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Configuration
              </h2>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Layout</Label>
                  <Select value={layout} onValueChange={(v) => form.setValue("layout", v as any)}>
                    <SelectTrigger data-testid="select-layout"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="custom">Custom (Grid)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {showWindowType && (
                  <div>
                    <Label className="text-xs">Window Type</Label>
                    <Select value={w.windowType} onValueChange={(v) => form.setValue("windowType", v as any)}>
                      <SelectTrigger data-testid="select-window-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed</SelectItem>
                        <SelectItem value="awning">Awning (Top-Hung)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {showOpenDirection && (
                  <div>
                    <Label className="text-xs">Opening Direction</Label>
                    <Select value={w.openDirection} onValueChange={(v) => form.setValue("openDirection", v as any)}>
                      <SelectTrigger data-testid="select-open-direction"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="out">Out (Solid Line)</SelectItem>
                        <SelectItem value="in">In (Dashed Line)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {showHingeSide && (
                  <div>
                    <Label className="text-xs">Hinge Side</Label>
                    <Select value={w.hingeSide} onValueChange={(v) => form.setValue("hingeSide", v as any)}>
                      <SelectTrigger data-testid="select-hinge-side"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {showHalfSolid && (
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox id="halfSolid" checked={w.halfSolid}
                      onCheckedChange={(v) => form.setValue("halfSolid", !!v)}
                      data-testid="checkbox-half-solid" />
                    <Label htmlFor="halfSolid" className="text-xs cursor-pointer">
                      Solid Bottom Panel
                    </Label>
                  </div>
                )}

                {showSidelightWidth && (
                  <div>
                    <Label htmlFor="sidelightWidth" className="text-xs">Sidelight Width (mm)</Label>
                    <Input id="sidelightWidth" type="number" min={100}
                      {...form.register("sidelightWidth", { valueAsNumber: true })}
                      data-testid="input-sidelight-width" />
                  </div>
                )}

                {showPanels && (
                  <div>
                    <Label className="text-xs">
                      {category === "bifold-door" ? "Number of Leaves" : "Number of Panels"}
                    </Label>
                    <Select value={String(w.panels)} onValueChange={(v) => {
                      const num = parseInt(v);
                      form.setValue("panels", num);
                      if (category === "bifold-door") {
                        form.setValue("bifoldLeftCount", Math.floor(num / 2));
                      }
                    }}>
                      <SelectTrigger data-testid="select-panels"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(category === "bifold-door"
                          ? [2, 3, 4, 5, 6, 7, 8]
                          : [3, 4, 5, 6]
                        ).map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {showBifoldSplit && (
                  <div>
                    <Label className="text-xs">Fold Left Count</Label>
                    <Select value={String(w.bifoldLeftCount)}
                      onValueChange={(v) => form.setValue("bifoldLeftCount", parseInt(v))}>
                      <SelectTrigger data-testid="select-bifold-left"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: (w.panels || 3) + 1 }, (_, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {i} left, {(w.panels || 3) - i} right
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {showCenterWidth && (
                  <div>
                    <Label htmlFor="centerWidth" className="text-xs">Center Panel Width (mm)</Label>
                    <Input id="centerWidth" type="number" min={0}
                      placeholder="0 = 60% of total"
                      {...form.register("centerWidth", { valueAsNumber: true })}
                      data-testid="input-center-width" />
                    <p className="text-xs text-muted-foreground mt-1">0 = default 60% of total width</p>
                  </div>
                )}

                {showGrid && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Rows</Label>
                        <Select value={String(gridRows)} onValueChange={(v) => form.setValue("rows", parseInt(v))}>
                          <SelectTrigger data-testid="select-rows"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 6].map((n) => (
                              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Columns</Label>
                        <Select value={String(gridCols)} onValueChange={(v) => form.setValue("columns", parseInt(v))}>
                          <SelectTrigger data-testid="select-columns"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 6].map((n) => (
                              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs mb-1.5 block">Pane Types (click to toggle)</Label>
                      <div className="border rounded-md p-2 bg-muted/30"
                        style={{ display: "grid", gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gap: "4px" }}>
                        {Array.from({ length: gridRows * gridCols }, (_, idx) => {
                          const pType = (w.paneTypes || [])[idx] || "fixed";
                          const isAwning = pType === "awning";
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => togglePaneType(idx)}
                              className={`
                                rounded-sm text-xs font-mono py-2 px-1 border transition-colors
                                ${isAwning
                                  ? "bg-primary/15 border-primary/30 text-primary"
                                  : "bg-background border-border text-muted-foreground"
                                }
                              `}
                              data-testid={`button-pane-${idx}`}
                            >
                              {isAwning ? "AWN" : "FIX"}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">FIX = Fixed, AWN = Awning</p>
                    </div>

                    <div>
                      <Label className="text-xs">Opening Direction</Label>
                      <Select value={w.openDirection} onValueChange={(v) => form.setValue("openDirection", v as any)}>
                        <SelectTrigger data-testid="select-custom-open-dir"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="out">Out (Solid Line)</SelectItem>
                          <SelectItem value="in">In (Dashed Line)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            <div className="flex gap-2">
              <Button type="submit" className="flex-1" data-testid="button-add-item">
                {editingId ? (
                  <><Pencil className="w-4 h-4 mr-2" /> Update Item</>
                ) : (
                  <><Plus className="w-4 h-4 mr-2" /> Add to Quote</>
                )}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={cancelEdit} data-testid="button-cancel-edit">
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </ScrollArea>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex items-center justify-center p-4 min-h-0"
            style={{ background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)" }}>
            <div className="w-full h-full max-w-3xl max-h-[600px]" data-testid="drawing-preview">
              <DrawingCanvas config={drawingConfig} />
            </div>
          </div>

          {items.length > 0 && (
            <div className="border-t bg-card shrink-0">
              <div className="px-4 py-2">
                <h3 className="text-sm font-semibold" data-testid="text-quote-list-title">
                  Quote Items ({items.length})
                </h3>
              </div>
              <ScrollArea className="max-h-52">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Layout</TableHead>
                      <TableHead>Dimensions</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right w-28">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={item.id} data-testid={`row-item-${item.id}`}>
                        <TableCell className="text-muted-foreground text-xs">{index + 1}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-sm">{getCategoryLabel(item.category)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {getLayoutSummary(item)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{item.width} x {item.height}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => editItem(item)}
                              data-testid={`button-edit-${item.id}`}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => duplicateItem(item)}
                              data-testid={`button-duplicate-${item.id}`}>
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => deleteItem(item.id)}
                              data-testid={`button-delete-${item.id}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
