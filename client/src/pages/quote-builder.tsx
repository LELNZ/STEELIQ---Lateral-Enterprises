import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertQuoteItemSchema, type InsertQuoteItem, type QuoteItem, type CustomColumn, type EntranceDoorRow } from "@shared/schema";
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
import { Plus, Trash2, Pencil, Copy, Ruler, LayoutGrid, ChevronDown, ChevronRight, ArrowLeft, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CATEGORY_OPTIONS = [
  { value: "windows-standard", label: "Windows Standard" },
  { value: "sliding-window", label: "Sliding Window" },
  { value: "sliding-door", label: "Sliding Door" },
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
    const cols = config.customColumns || [];
    const colCount = cols.length;
    const rowCounts = cols.map(c => (c.rows || []).length);
    const allSame = rowCounts.every(r => r === rowCounts[0]);
    if (allSame && rowCounts.length > 0) {
      return `Custom ${rowCounts[0]}×${colCount}`;
    }
    return `Custom ${colCount}-col (${rowCounts.join("/")})`;
  }
  const cat = config.category;
  if (cat === "windows-standard") return config.windowType === "awning" ? "Awning" : "Fixed";
  if (cat === "sliding-window" || cat === "sliding-door") return "Fixed + Sliding";
  if (cat === "entrance-door") {
    if (!config.sidelightEnabled) return "Door (No Sidelight)";
    const side = config.sidelightSide === "both" ? "Both Sidelights" : config.sidelightSide === "left" ? "Left Sidelight" : "Right Sidelight";
    return `Door + ${side}`;
  }
  if (cat === "hinge-door") return `${config.hingeSide === "left" ? "Left" : "Right"} Hinge`;
  if (cat === "french-door") return "Double Door";
  if (cat === "bifold-door") return `${config.panels} Leaves`;
  if (cat === "stacker-door") return `${config.panels} Panels`;
  if (cat === "bay-window") return "Bay (3 Panel)";
  return "Standard";
}

function makeDefaultColumns(count: number): CustomColumn[] {
  return Array.from({ length: count }, () => ({
    width: 0,
    rows: [{ height: 0, type: "fixed" as const, slideDirection: "right" as const, hingeSide: "left" as const, openDirection: "out" as const }],
  }));
}

const defaultEntranceDoorRows: EntranceDoorRow[] = [{ height: 0, type: "fixed" }];

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
  sidelightEnabled: true,
  sidelightSide: "right",
  doorSplit: false,
  doorSplitHeight: 0,
  bifoldLeftCount: 0,
  centerWidth: 0,
  entranceDoorRows: [...defaultEntranceDoorRows],
  entranceSidelightRows: [...defaultEntranceDoorRows],
  entranceSidelightLeftRows: [...defaultEntranceDoorRows],
  customColumns: makeDefaultColumns(2),
};

export default function QuoteBuilder() {
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedCols, setExpandedCols] = useState<Set<number>>(new Set([0]));
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
    form.setValue("openDirection", category === "entrance-door" ? "in" : "out");
    form.setValue("halfSolid", false);
    form.setValue("sidelightWidth", 400);
    form.setValue("sidelightEnabled", true);
    form.setValue("sidelightSide", "right");
    form.setValue("doorSplit", false);
    form.setValue("doorSplitHeight", 0);
    form.setValue("centerWidth", 0);
    form.setValue("entranceDoorRows", [...defaultEntranceDoorRows]);
    form.setValue("entranceSidelightRows", [...defaultEntranceDoorRows]);
    form.setValue("entranceSidelightLeftRows", [...defaultEntranceDoorRows]);
    form.setValue("customColumns", makeDefaultColumns(2));
    if (category === "bifold-door") {
      form.setValue("panels", 3);
      form.setValue("bifoldLeftCount", 1);
    } else if (category === "stacker-door") {
      form.setValue("panels", 3);
    } else if (category === "sliding-door") {
      form.setValue("panels", 2);
      form.setValue("bifoldLeftCount", 0);
    } else {
      form.setValue("panels", 3);
      form.setValue("bifoldLeftCount", 0);
    }
  }, [category]);

  const isEntrance = category === "entrance-door";
  const isCustom = layout === "custom" && !isEntrance;
  const isSlidingCategory = ["sliding-window", "sliding-door", "stacker-door"].includes(category);
  const isDoorCategory = ["hinge-door", "french-door"].includes(category);

  const showWindowType = !isCustom && category === "windows-standard";
  const showHingeSide = ["entrance-door", "hinge-door"].includes(category);
  const showHalfSolid = category === "hinge-door";
  const showSidelightControls = isEntrance && w.sidelightEnabled;
  const showPanels = !isCustom && ["bifold-door", "stacker-door"].includes(category);
  const showBifoldSplit = !isCustom && category === "bifold-door";
  const showCenterWidth = !isCustom && category === "bay-window";
  const showOpenDirection = !isCustom && !["windows-standard", "sliding-window", "sliding-door", "stacker-door"].includes(category);
  const showLayoutSelect = !isEntrance;
  const showGrid = isCustom;

  const customColumns: CustomColumn[] = w.customColumns || makeDefaultColumns(2);
  const numColumns = customColumns.length;

  function setColumnCount(count: number) {
    const current = w.customColumns || [];
    const next: CustomColumn[] = Array.from({ length: count }, (_, i) => {
      if (i < current.length) return current[i];
      return { width: 0, rows: [{ height: 0, type: "fixed" as const, slideDirection: "right" as const, hingeSide: "left" as const, openDirection: "out" as const }] };
    });
    form.setValue("customColumns", next);
    setExpandedCols(new Set([0]));
  }

  function setColumnWidth(colIdx: number, width: number) {
    const cols = [...(w.customColumns || [])];
    cols[colIdx] = { ...cols[colIdx], width };
    form.setValue("customColumns", cols);
  }

  function setColumnRowCount(colIdx: number, rowCount: number) {
    const cols = [...(w.customColumns || [])];
    const currentRows = cols[colIdx].rows || [];
    const next = Array.from({ length: rowCount }, (_, i) => {
      if (i < currentRows.length) return currentRows[i];
      return { height: 0, type: "fixed" as const, slideDirection: "right" as const, hingeSide: "left" as const, openDirection: "out" as const };
    });
    cols[colIdx] = { ...cols[colIdx], rows: next };
    form.setValue("customColumns", cols);
  }

  function setRowHeight(colIdx: number, rowIdx: number, height: number) {
    const cols = [...(w.customColumns || [])];
    const rows = [...(cols[colIdx].rows || [])];
    rows[rowIdx] = { ...rows[rowIdx], height };
    cols[colIdx] = { ...cols[colIdx], rows };
    form.setValue("customColumns", cols);
  }

  function toggleRowType(colIdx: number, rowIdx: number) {
    const cols = [...(w.customColumns || [])];
    const rows = [...(cols[colIdx].rows || [])];
    const current = rows[rowIdx].type || "fixed";
    if (isSlidingCategory) {
      const cycle: Record<string, "fixed" | "sliding" | "awning"> = { fixed: "sliding", sliding: "awning", awning: "fixed" };
      rows[rowIdx] = {
        ...rows[rowIdx],
        type: cycle[current] || "fixed",
      };
    } else if (isDoorCategory) {
      const cycle: Record<string, "fixed" | "awning" | "hinge"> = { fixed: "awning", awning: "hinge", hinge: "fixed" };
      rows[rowIdx] = {
        ...rows[rowIdx],
        type: cycle[current] || "fixed",
      };
    } else {
      rows[rowIdx] = {
        ...rows[rowIdx],
        type: current === "awning" ? "fixed" : "awning",
      };
    }
    cols[colIdx] = { ...cols[colIdx], rows };
    form.setValue("customColumns", cols);
  }

  function setSlideDirection(colIdx: number, rowIdx: number, dir: "left" | "right") {
    const cols = [...(w.customColumns || [])];
    const rows = [...(cols[colIdx].rows || [])];
    rows[rowIdx] = { ...rows[rowIdx], slideDirection: dir };
    cols[colIdx] = { ...cols[colIdx], rows };
    form.setValue("customColumns", cols);
  }

  function setRowHingeSide(colIdx: number, rowIdx: number, side: "left" | "right") {
    const cols = [...(w.customColumns || [])];
    const rows = [...(cols[colIdx].rows || [])];
    rows[rowIdx] = { ...rows[rowIdx], hingeSide: side };
    cols[colIdx] = { ...cols[colIdx], rows };
    form.setValue("customColumns", cols);
  }

  function setRowOpenDirection(colIdx: number, rowIdx: number, dir: "in" | "out") {
    const cols = [...(w.customColumns || [])];
    const rows = [...(cols[colIdx].rows || [])];
    rows[rowIdx] = { ...rows[rowIdx], openDirection: dir };
    cols[colIdx] = { ...cols[colIdx], rows };
    form.setValue("customColumns", cols);
  }

  function setEntranceDoorRowCount(field: "entranceDoorRows" | "entranceSidelightRows" | "entranceSidelightLeftRows", count: number) {
    const current = w[field] || defaultEntranceDoorRows;
    const next: EntranceDoorRow[] = Array.from({ length: count }, (_, i) => {
      if (i < current.length) return current[i];
      return { height: 0, type: "fixed" as const };
    });
    form.setValue(field, next);
  }

  function setEntranceDoorRowHeight(field: "entranceDoorRows" | "entranceSidelightRows" | "entranceSidelightLeftRows", rowIdx: number, height: number) {
    const current = [...(w[field] || defaultEntranceDoorRows)];
    current[rowIdx] = { ...current[rowIdx], height };
    form.setValue(field, current);
  }

  function toggleEntranceDoorRowType(field: "entranceDoorRows" | "entranceSidelightRows" | "entranceSidelightLeftRows", rowIdx: number) {
    const current = [...(w[field] || defaultEntranceDoorRows)];
    current[rowIdx] = { ...current[rowIdx], type: current[rowIdx].type === "awning" ? "fixed" : "awning" };
    form.setValue(field, current);
  }

  function toggleColumnExpanded(colIdx: number) {
    setExpandedCols(prev => {
      const next = new Set(prev);
      if (next.has(colIdx)) next.delete(colIdx);
      else next.add(colIdx);
      return next;
    });
  }

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

  const drawingConfig: InsertQuoteItem = {
    ...w,
    width: w.width || 1200,
    height: w.height || 1500,
    quantity: w.quantity || 1,
    name: w.name || "Untitled",
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
                {showLayoutSelect && (
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
                )}

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

                {isEntrance && (
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox id="sidelightEnabled" checked={w.sidelightEnabled}
                      onCheckedChange={(v) => form.setValue("sidelightEnabled", !!v)}
                      data-testid="checkbox-sidelight-enabled" />
                    <Label htmlFor="sidelightEnabled" className="text-xs cursor-pointer">
                      Sidelight
                    </Label>
                  </div>
                )}

                {showSidelightControls && (
                  <>
                    <div>
                      <Label className="text-xs">Sidelight Position</Label>
                      <Select value={w.sidelightSide || "right"} onValueChange={(v) => form.setValue("sidelightSide", v as any)}>
                        <SelectTrigger data-testid="select-sidelight-side"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                          <SelectItem value="both">Both</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="sidelightWidth" className="text-xs">Sidelight Width (mm)</Label>
                      <Input id="sidelightWidth" type="number" min={100}
                        {...form.register("sidelightWidth", { valueAsNumber: true })}
                        data-testid="input-sidelight-width" />
                    </div>
                  </>
                )}

                {isEntrance && (() => {
                  const doorRows: EntranceDoorRow[] = w.entranceDoorRows || defaultEntranceDoorRows;
                  const slSide = w.sidelightSide || "right";
                  const slEnabled = w.sidelightEnabled;
                  const slRows: EntranceDoorRow[] = w.entranceSidelightRows || defaultEntranceDoorRows;
                  const slLeftRows: EntranceDoorRow[] = w.entranceSidelightLeftRows || defaultEntranceDoorRows;

                  function renderRowControls(
                    label: string,
                    rows: EntranceDoorRow[],
                    field: "entranceDoorRows" | "entranceSidelightRows" | "entranceSidelightLeftRows",
                    prefix: string
                  ) {
                    return (
                      <div className="border rounded-md bg-muted/20 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold">{label}</Label>
                          <Select value={String(rows.length)} onValueChange={(v) => setEntranceDoorRowCount(field, parseInt(v))}>
                            <SelectTrigger data-testid={`select-${prefix}-rows`} className="h-7 text-xs w-16">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4].map((n) => (
                                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          {rows.map((row, ri) => {
                            const typeLabel = row.type === "awning" ? "AWN" : "FIX";
                            const isActive = row.type !== "fixed";
                            return (
                              <div key={ri} className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => toggleEntranceDoorRowType(field, ri)}
                                  className={`
                                    shrink-0 rounded-sm text-xs font-mono py-1 px-2 border transition-colors
                                    ${isActive
                                      ? "bg-primary/15 border-primary/30 text-primary"
                                      : "bg-background border-border text-muted-foreground"
                                    }
                                  `}
                                  data-testid={`button-${prefix}-row-type-${ri}`}
                                >
                                  {typeLabel}
                                </button>
                                <Input
                                  type="number"
                                  min={0}
                                  value={row.height || ""}
                                  placeholder="Auto"
                                  onChange={(e) => setEntranceDoorRowHeight(field, ri, parseFloat(e.target.value) || 0)}
                                  data-testid={`input-${prefix}-row-height-${ri}`}
                                  className="h-7 text-xs flex-1"
                                />
                                <span className="text-xs text-muted-foreground shrink-0">mm</span>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground">FIX = Fixed, AWN = Awning. 0 = even split.</p>
                      </div>
                    );
                  }

                  return (
                    <>
                      {renderRowControls("Door Panel", doorRows, "entranceDoorRows", "door")}
                      {slEnabled && slSide !== "both" && renderRowControls("Sidelight", slRows, "entranceSidelightRows", "sl")}
                      {slEnabled && slSide === "both" && (
                        <>
                          {renderRowControls("Left Sidelight", slLeftRows, "entranceSidelightLeftRows", "sl-left")}
                          {renderRowControls("Right Sidelight", slRows, "entranceSidelightRows", "sl-right")}
                        </>
                      )}
                    </>
                  );
                })()}

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
                    <div>
                      <Label className="text-xs">Number of Columns</Label>
                      <Select value={String(numColumns)} onValueChange={(v) => setColumnCount(parseInt(v))}>
                        <SelectTrigger data-testid="select-columns"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6].map((n) => (
                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      {customColumns.map((col, ci) => {
                        const colRows = col.rows || [{ height: 0, type: "fixed" as const }];
                        const isExpanded = expandedCols.has(ci);
                        return (
                          <div key={ci} className="border rounded-md bg-muted/20 overflow-hidden" data-testid={`column-config-${ci}`}>
                            <button
                              type="button"
                              onClick={() => toggleColumnExpanded(ci)}
                              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/40 transition-colors"
                              data-testid={`button-toggle-col-${ci}`}
                            >
                              <span>Column {ci + 1} ({colRows.length} row{colRows.length !== 1 ? "s" : ""})</span>
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>

                            {isExpanded && (
                              <div className="px-3 pb-3 space-y-2 border-t">
                                <div className="pt-2">
                                  <Label className="text-xs">Width (mm)</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={col.width || ""}
                                    placeholder="Auto (even split)"
                                    onChange={(e) => setColumnWidth(ci, parseFloat(e.target.value) || 0)}
                                    data-testid={`input-col-width-${ci}`}
                                    className="h-8 text-xs"
                                  />
                                </div>

                                <div>
                                  <Label className="text-xs">Rows in Column</Label>
                                  <Select value={String(colRows.length)} onValueChange={(v) => setColumnRowCount(ci, parseInt(v))}>
                                    <SelectTrigger data-testid={`select-col-rows-${ci}`} className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {[1, 2, 3, 4, 5, 6].map((n) => (
                                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-1">
                                  {colRows.map((row, ri) => {
                                    const typeLabel = row.type === "awning" ? "AWN" : row.type === "sliding" ? "SLD" : row.type === "hinge" ? "HNG" : "FIX";
                                    const isActive = row.type !== "fixed";
                                    return (
                                      <div key={ri} className="space-y-1" data-testid={`row-config-${ci}-${ri}`}>
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => toggleRowType(ci, ri)}
                                            className={`
                                              shrink-0 rounded-sm text-xs font-mono py-1 px-2 border transition-colors
                                              ${isActive
                                                ? "bg-primary/15 border-primary/30 text-primary"
                                                : "bg-background border-border text-muted-foreground"
                                              }
                                            `}
                                            data-testid={`button-pane-${ci}-${ri}`}
                                          >
                                            {typeLabel}
                                          </button>
                                          {isSlidingCategory && row.type === "sliding" && (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() => setSlideDirection(ci, ri, "left")}
                                                className={`shrink-0 rounded-sm text-xs py-1 px-1.5 border transition-colors ${
                                                  row.slideDirection === "left"
                                                    ? "bg-primary/15 border-primary/30 text-primary"
                                                    : "bg-background border-border text-muted-foreground"
                                                }`}
                                                data-testid={`button-slide-left-${ci}-${ri}`}
                                              >
                                                <ArrowLeft className="w-3 h-3" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setSlideDirection(ci, ri, "right")}
                                                className={`shrink-0 rounded-sm text-xs py-1 px-1.5 border transition-colors ${
                                                  row.slideDirection !== "left"
                                                    ? "bg-primary/15 border-primary/30 text-primary"
                                                    : "bg-background border-border text-muted-foreground"
                                                }`}
                                                data-testid={`button-slide-right-${ci}-${ri}`}
                                              >
                                                <ArrowRight className="w-3 h-3" />
                                              </button>
                                            </>
                                          )}
                                          <Input
                                            type="number"
                                            min={0}
                                            value={row.height || ""}
                                            placeholder="Auto"
                                            onChange={(e) => setRowHeight(ci, ri, parseFloat(e.target.value) || 0)}
                                            data-testid={`input-row-height-${ci}-${ri}`}
                                            className="h-7 text-xs flex-1"
                                          />
                                          <span className="text-xs text-muted-foreground shrink-0">mm</span>
                                        </div>
                                        {isDoorCategory && row.type === "hinge" && (
                                          <div className="flex items-center gap-1.5 pl-1">
                                            <button
                                              type="button"
                                              onClick={() => setRowOpenDirection(ci, ri, row.openDirection === "in" ? "out" : "in")}
                                              className="shrink-0 rounded-sm text-xs font-mono py-0.5 px-2 border border-primary/30 bg-primary/10 text-primary transition-colors"
                                              data-testid={`button-open-dir-${ci}-${ri}`}
                                            >
                                              {row.openDirection === "in" ? "IN" : "OUT"}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setRowHingeSide(ci, ri, "left")}
                                              className={`shrink-0 rounded-sm text-xs py-0.5 px-1.5 border transition-colors ${
                                                row.hingeSide !== "right"
                                                  ? "bg-primary/15 border-primary/30 text-primary"
                                                  : "bg-background border-border text-muted-foreground"
                                              }`}
                                              data-testid={`button-hinge-left-${ci}-${ri}`}
                                            >
                                              <ArrowLeft className="w-3 h-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setRowHingeSide(ci, ri, "right")}
                                              className={`shrink-0 rounded-sm text-xs py-0.5 px-1.5 border transition-colors ${
                                                row.hingeSide === "right"
                                                  ? "bg-primary/15 border-primary/30 text-primary"
                                                  : "bg-background border-border text-muted-foreground"
                                              }`}
                                              data-testid={`button-hinge-right-${ci}-${ri}`}
                                            >
                                              <ArrowRight className="w-3 h-3" />
                                            </button>
                                            <span className="text-xs text-muted-foreground">Hinge</span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {isSlidingCategory
                        ? "FIX / SLD / AWN cycle. Arrow buttons set slide direction. 0 = even split."
                        : isDoorCategory
                        ? "FIX / AWN / HNG cycle. HNG shows open direction & hinge side. 0 = even split."
                        : "FIX = Fixed, AWN = Awning. Leave widths/heights at 0 for even split."
                      }
                    </p>

                    {!isSlidingCategory && !isDoorCategory && (
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
                    )}
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
