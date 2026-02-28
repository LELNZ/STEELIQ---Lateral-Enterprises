import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertQuoteItemSchema, type InsertQuoteItem, type QuoteItem } from "@shared/schema";
import DrawingCanvas from "@/components/drawing-canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Pencil, Copy, Ruler, LayoutGrid } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CATEGORY_OPTIONS = [
  { value: "window", label: "Window" },
  { value: "hinge-door", label: "Hinge Door" },
  { value: "sliding-door", label: "Sliding/Stacking Door" },
  { value: "entry-door", label: "Entry Door" },
];

const WINDOW_LAYOUTS = [
  { value: "fixed", label: "Fixed" },
  { value: "awning", label: "Awning (Top-Hung)" },
  { value: "mullion-2", label: "2-Pane Vertical (Mullion)" },
  { value: "transom-2", label: "2-Pane Horizontal (Transom)" },
];

const HINGE_DOOR_LAYOUTS = [
  { value: "single", label: "Single Door" },
  { value: "with-sidelight", label: "Door with Sidelight" },
  { value: "with-transom", label: "Door with Transom" },
];

const SIDELIGHT_OPTIONS = [
  { value: "none", label: "No Sidelights" },
  { value: "left", label: "Left Sidelight" },
  { value: "right", label: "Right Sidelight" },
  { value: "both", label: "Both Sidelights" },
];

const PANE_TYPES = [
  { value: "fixed", label: "Fixed" },
  { value: "awning", label: "Awning" },
];

function getCategoryLabel(cat: string) {
  return CATEGORY_OPTIONS.find((c) => c.value === cat)?.label || cat;
}

function getLayoutLabel(cat: string, layout: string, sidelightConfig?: string) {
  if (cat === "window") return WINDOW_LAYOUTS.find((l) => l.value === layout)?.label || layout;
  if (cat === "hinge-door") return HINGE_DOOR_LAYOUTS.find((l) => l.value === layout)?.label || layout;
  if (cat === "sliding-door") return "Sliding/Stacking";
  if (cat === "entry-door") {
    const sl = SIDELIGHT_OPTIONS.find((s) => s.value === sidelightConfig)?.label || "";
    return sl ? `Entry Door - ${sl}` : "Entry Door";
  }
  return layout;
}

const defaultValues: InsertQuoteItem = {
  name: "W-01",
  quantity: 1,
  category: "window",
  width: 1200,
  height: 1500,
  layout: "fixed",
  hingeSide: "left",
  splitPosition: 0,
  halfSolid: false,
  pane1Type: "fixed",
  pane2Type: "fixed",
  panels: 2,
  sidelightConfig: "none",
};

export default function QuoteBuilder() {
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<InsertQuoteItem>({
    resolver: zodResolver(insertQuoteItemSchema),
    defaultValues,
  });

  const watchAll = form.watch();
  const category = watchAll.category;
  const layout = watchAll.layout;

  useEffect(() => {
    if (category === "window") {
      form.setValue("layout", "fixed");
      form.setValue("hingeSide", "left");
    } else if (category === "hinge-door") {
      form.setValue("layout", "single");
    } else if (category === "sliding-door") {
      form.setValue("layout", "sliding");
    } else if (category === "entry-door") {
      form.setValue("layout", "single");
      form.setValue("sidelightConfig", "none");
    }
    form.setValue("splitPosition", 0);
  }, [category]);

  const showHingeSide = category === "hinge-door" || category === "entry-door";
  const showHalfSolid = category === "hinge-door" || category === "entry-door";
  const showLayout = category === "window" || category === "hinge-door";
  const showPanels = category === "sliding-door";
  const showSidelightConfig = category === "entry-door";
  const showSplit =
    (category === "window" && (layout === "mullion-2" || layout === "transom-2")) ||
    (category === "hinge-door" && (layout === "with-sidelight" || layout === "with-transom")) ||
    (category === "entry-door" && watchAll.sidelightConfig !== "none");
  const showPaneTypes = category === "window" && (layout === "mullion-2" || layout === "transom-2");

  const frameSize = category === "sliding-door" ? 127 : 52;

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
    toast({ title: "Item duplicated", description: `${newItem.name} added to quote.` });
  }

  function deleteItem(id: string) {
    setItems(items.filter((item) => item.id !== id));
    if (editingId === id) {
      setEditingId(null);
      form.reset(defaultValues);
    }
    toast({ title: "Item removed", description: "Item has been removed from the quote." });
  }

  function cancelEdit() {
    setEditingId(null);
    form.reset(defaultValues);
  }

  const splitLabel =
    category === "window" && layout === "mullion-2"
      ? "Split Position - Left Pane Width (mm)"
      : category === "window" && layout === "transom-2"
        ? "Split Position - Top Pane Height (mm)"
        : category === "hinge-door" && layout === "with-sidelight"
          ? "Sidelight Width (mm)"
          : category === "hinge-door" && layout === "with-transom"
            ? "Transom Height (mm)"
            : "Sidelight Width (mm)";

  const drawingConfig: InsertQuoteItem = {
    ...watchAll,
    width: watchAll.width || 1200,
    height: watchAll.height || 1500,
    quantity: watchAll.quantity || 1,
    name: watchAll.name || "Untitled",
  };

  return (
    <div className="flex flex-col h-screen bg-background" data-testid="quote-builder">
      <header className="border-b px-6 py-3 flex items-center justify-between gap-4 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary">
            <LayoutGrid className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight" data-testid="text-app-title">
              Window & Door Quote Tool
            </h1>
            <p className="text-xs text-muted-foreground">Configure and quote windows and doors</p>
          </div>
        </div>
        {items.length > 0 && (
          <Badge variant="secondary" data-testid="badge-item-count">
            {items.length} item{items.length !== 1 ? "s" : ""} in quote
          </Badge>
        )}
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <ScrollArea className="w-full lg:w-80 xl:w-96 border-r shrink-0">
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Ruler className="w-3.5 h-3.5" /> Item Details
              </h2>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="name">Item Name / Reference</Label>
                  <Input id="name" {...form.register("name")} data-testid="input-item-name" />
                  {form.formState.errors.name && (
                    <p className="text-xs text-destructive mt-1">{form.formState.errors.name.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input id="quantity" type="number" min={1}
                    {...form.register("quantity", { valueAsNumber: true })}
                    data-testid="input-quantity" />
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Type & Dimensions
              </h2>
              <div className="space-y-3">
                <div>
                  <Label>Category</Label>
                  <Select value={category} onValueChange={(v) => form.setValue("category", v as any)}>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="width">Width (mm)</Label>
                    <Input id="width" type="number" min={200}
                      {...form.register("width", { valueAsNumber: true })}
                      data-testid="input-width" />
                  </div>
                  <div>
                    <Label htmlFor="height">Height (mm)</Label>
                    <Input id="height" type="number" min={200}
                      {...form.register("height", { valueAsNumber: true })}
                      data-testid="input-height" />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {frameSize}mm Frame
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Configuration
              </h2>
              <div className="space-y-3">
                {showLayout && (
                  <div>
                    <Label>Layout</Label>
                    <Select value={layout} onValueChange={(v) => form.setValue("layout", v)}>
                      <SelectTrigger data-testid="select-layout">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(category === "window" ? WINDOW_LAYOUTS : HINGE_DOOR_LAYOUTS).map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {showPanels && (
                  <div>
                    <Label>Number of Panels</Label>
                    <Select value={String(watchAll.panels)} onValueChange={(v) => form.setValue("panels", parseInt(v))}>
                      <SelectTrigger data-testid="select-panels">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 Panels</SelectItem>
                        <SelectItem value="3">3 Panels</SelectItem>
                        <SelectItem value="4">4 Panels</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {showSidelightConfig && (
                  <div>
                    <Label>Sidelights</Label>
                    <Select value={watchAll.sidelightConfig} onValueChange={(v) => form.setValue("sidelightConfig", v as any)}>
                      <SelectTrigger data-testid="select-sidelight">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SIDELIGHT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {showHingeSide && (
                  <div>
                    <Label>Hinge Side</Label>
                    <Select value={watchAll.hingeSide} onValueChange={(v) => form.setValue("hingeSide", v as any)}>
                      <SelectTrigger data-testid="select-hinge-side">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {showHalfSolid && (
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox
                      id="halfSolid"
                      checked={watchAll.halfSolid}
                      onCheckedChange={(v) => form.setValue("halfSolid", !!v)}
                      data-testid="checkbox-half-solid"
                    />
                    <Label htmlFor="halfSolid" className="text-sm cursor-pointer">
                      Half-Solid Panel (Bottom)
                    </Label>
                  </div>
                )}

                {showSplit && (
                  <div>
                    <Label htmlFor="splitPosition">{splitLabel}</Label>
                    <Input id="splitPosition" type="number" min={0}
                      placeholder="0 = even split"
                      {...form.register("splitPosition", { valueAsNumber: true })}
                      data-testid="input-split-position" />
                    <p className="text-xs text-muted-foreground mt-1">Leave at 0 for an even split</p>
                  </div>
                )}

                {showPaneTypes && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>{layout === "mullion-2" ? "Left Pane" : "Top Pane"}</Label>
                      <Select value={watchAll.pane1Type} onValueChange={(v) => form.setValue("pane1Type", v as any)}>
                        <SelectTrigger data-testid="select-pane1-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PANE_TYPES.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>{layout === "mullion-2" ? "Right Pane" : "Bottom Pane"}</Label>
                      <Select value={watchAll.pane2Type} onValueChange={(v) => form.setValue("pane2Type", v as any)}>
                        <SelectTrigger data-testid="select-pane2-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PANE_TYPES.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
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
                  <>
                    <Pencil className="w-4 h-4 mr-2" /> Update Item
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" /> Add to Quote
                  </>
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
              <div className="px-4 py-2 flex items-center justify-between">
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
                      <TableHead>Type</TableHead>
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
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm">{getCategoryLabel(item.category)}</span>
                            <span className="text-xs text-muted-foreground">
                              {getLayoutLabel(item.category, item.layout, item.sidelightConfig)}
                            </span>
                          </div>
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
