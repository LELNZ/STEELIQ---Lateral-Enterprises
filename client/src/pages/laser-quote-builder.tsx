import { useState, useEffect, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Save, Eye, ArrowLeft, Loader2 } from "lucide-react";
import type { LaserQuoteItem } from "@shared/schema";
import type { LaserSnapshotItem } from "@shared/estimate-snapshot";

const MATERIAL_TYPES = ["Mild Steel", "Stainless Steel", "Aluminium", "Corten", "Brass", "Copper"];
const MATERIAL_GRADES = ["Grade 250", "Grade 350", "304", "316", "3003", "5052", "6061"];

const EMPTY_ITEM: Omit<LaserQuoteItem, "id"> = {
  itemRef: "",
  title: "",
  quantity: 1,
  materialType: "",
  materialGrade: "",
  thickness: 0,
  length: 0,
  width: 0,
  finish: "",
  customerNotes: "",
  internalNotes: "",
  unitPrice: 0,
};

function itemToSnapshotItem(item: LaserQuoteItem, index: number): LaserSnapshotItem {
  return {
    itemNumber: index + 1,
    itemRef: item.itemRef,
    title: item.title,
    quantity: item.quantity,
    materialType: item.materialType,
    materialGrade: item.materialGrade,
    thickness: item.thickness,
    length: item.length,
    width: item.width,
    finish: item.finish,
    customerNotes: item.customerNotes,
    internalNotes: item.internalNotes,
    unitPrice: item.unitPrice,
    photos: [],
  };
}

function snapshotItemToItem(si: LaserSnapshotItem): LaserQuoteItem {
  return {
    id: crypto.randomUUID(),
    itemRef: si.itemRef,
    title: si.title,
    quantity: si.quantity,
    materialType: si.materialType,
    materialGrade: si.materialGrade,
    thickness: si.thickness,
    length: si.length,
    width: si.width,
    finish: si.finish,
    customerNotes: si.customerNotes,
    internalNotes: si.internalNotes,
    unitPrice: si.unitPrice,
  };
}

export default function LaserQuoteBuilder() {
  const params = useParams<{ id?: string }>();
  const quoteId = params.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [items, setItems] = useState<LaserQuoteItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [projectAddress, setProjectAddress] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LaserQuoteItem | null>(null);
  const [formData, setFormData] = useState<Omit<LaserQuoteItem, "id">>(EMPTY_ITEM);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const isEditMode = !!quoteId;

  const { data: quoteData, isLoading: quoteLoading } = useQuery<any>({
    queryKey: ["/api/quotes", quoteId],
    enabled: isEditMode,
  });

  useEffect(() => {
    if (quoteData && isEditMode) {
      setCustomerName(quoteData.customer || "");
      const revisions = quoteData.revisions || [];
      const currentRev = revisions.find((r: any) => r.id === quoteData.currentRevisionId) || revisions[revisions.length - 1];
      if (currentRev) {
        const raw = currentRev.snapshotJson;
        const snapshot = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (snapshot) {
          setProjectAddress(snapshot.projectAddress || "");
          if (snapshot.laserItems?.length) {
            setItems(snapshot.laserItems.map(snapshotItemToItem));
          }
        }
      }
    }
  }, [quoteData, isEditMode]);

  const totalValue = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  }, [items]);

  const buildSnapshot = () => {
    const laserItems = items.map((item, idx) => itemToSnapshotItem(item, idx));
    return {
      customer: customerName,
      projectAddress,
      items: [],
      laserItems,
      totals: {
        cost: 0,
        sell: totalValue,
        grossProfit: totalValue,
        grossMargin: totalValue > 0 ? 100 : 0,
        totalLabourHours: 0,
        gpPerHour: 0,
      },
      totalsBreakdown: {
        itemsSubtotal: totalValue,
        installationTotal: 0,
        deliveryTotal: 0,
        removalTotal: 0,
        rubbishTotal: 0,
        subtotalExclGst: totalValue,
        gstAmount: totalValue * 0.15,
        totalInclGst: totalValue * 1.15,
      },
      specDictionaryVersion: 1,
    };
  };

  const createQuoteMutation = useMutation({
    mutationFn: async () => {
      const snapshot = buildSnapshot();
      const res = await apiRequest("POST", "/api/quotes", {
        snapshot,
        customer: customerName,
        divisionCode: "LL",
        mode: "new_quote",
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Quote created", description: `${data.quote.number} created successfully` });
      navigate(`/laser-quote/${data.quote.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const saveRevisionMutation = useMutation({
    mutationFn: async () => {
      const snapshot = buildSnapshot();
      const res = await apiRequest("POST", `/api/quotes/${quoteId}/revisions`, { snapshot });
      return res.json();
    },
    onSuccess: () => {
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Saved", description: "Quote revision saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!customerName.trim()) {
      toast({ title: "Required", description: "Customer name is required", variant: "destructive" });
      return;
    }
    if (isEditMode) {
      saveRevisionMutation.mutate();
    } else {
      createQuoteMutation.mutate();
    }
  };

  const openAddDialog = () => {
    setEditingItem(null);
    setFormData({ ...EMPTY_ITEM });
    setDialogOpen(true);
  };

  const openEditDialog = (item: LaserQuoteItem) => {
    setEditingItem(item);
    setFormData({
      itemRef: item.itemRef,
      title: item.title,
      quantity: item.quantity,
      materialType: item.materialType,
      materialGrade: item.materialGrade,
      thickness: item.thickness,
      length: item.length,
      width: item.width,
      finish: item.finish,
      customerNotes: item.customerNotes,
      internalNotes: item.internalNotes,
      unitPrice: item.unitPrice,
    });
    setDialogOpen(true);
  };

  const handleDialogSave = () => {
    if (!formData.itemRef.trim() || !formData.title.trim()) {
      toast({ title: "Required", description: "Item reference and title are required", variant: "destructive" });
      return;
    }
    if (editingItem) {
      setItems(prev => prev.map(i => i.id === editingItem.id ? { ...formData, id: editingItem.id } : i));
    } else {
      setItems(prev => [...prev, { ...formData, id: crypto.randomUUID() }]);
    }
    setHasUnsavedChanges(true);
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    setHasUnsavedChanges(true);
    setDeleteConfirm(null);
  };

  const isSaving = createQuoteMutation.isPending || saveRevisionMutation.isPending;

  if (isEditMode && quoteLoading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="loading-laser-builder">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const quoteNumber = quoteData?.number || "New Laser Quote";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b px-4 py-3 bg-background" data-testid="laser-builder-header">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/quotes")}
            data-testid="button-back-quotes"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold" data-testid="text-quote-number">{quoteNumber}</h1>
            <p className="text-xs text-muted-foreground">Lateral Laser — Quote Builder</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/quote/${quoteId}/preview`)}
              data-testid="button-preview-quote"
            >
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            data-testid="button-save-quote"
          >
            {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            {isEditMode ? "Save Revision" : "Create Quote"}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <Card data-testid="card-quote-details">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Quote Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="customerName">Customer Name *</Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => { setCustomerName(e.target.value); setHasUnsavedChanges(true); }}
                placeholder="Enter customer name"
                data-testid="input-customer-name"
              />
            </div>
            <div>
              <Label htmlFor="projectAddress">Project / Address</Label>
              <Input
                id="projectAddress"
                value={projectAddress}
                onChange={(e) => { setProjectAddress(e.target.value); setHasUnsavedChanges(true); }}
                placeholder="Optional project address"
                data-testid="input-project-address"
              />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-items-table">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Line Items ({items.length})</CardTitle>
            <Button size="sm" variant="outline" onClick={openAddDialog} data-testid="button-add-item">
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {items.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground" data-testid="text-no-items">
                No items yet. Click "Add Item" to start.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Ref</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Thickness</TableHead>
                      <TableHead className="text-right">L x W (mm)</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Line Total</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow key={item.id} data-testid={`row-item-${idx}`}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-mono text-xs" data-testid={`text-item-ref-${idx}`}>{item.itemRef}</TableCell>
                        <TableCell data-testid={`text-item-title-${idx}`}>{item.title}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-xs">
                          {[item.materialType, item.materialGrade].filter(Boolean).join(" / ") || "—"}
                        </TableCell>
                        <TableCell className="text-right">{item.thickness > 0 ? `${item.thickness}mm` : "—"}</TableCell>
                        <TableCell className="text-right text-xs">
                          {item.length > 0 && item.width > 0 ? `${item.length} x ${item.width}` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">${item.unitPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          ${(item.unitPrice * item.quantity).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEditDialog(item)}
                              data-testid={`button-edit-item-${idx}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => setDeleteConfirm(item.id)}
                              data-testid={`button-delete-item-${idx}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
          {items.length > 0 && (
            <div className="border-t px-4 py-3 flex justify-end" data-testid="items-total">
              <div className="text-sm">
                <span className="text-muted-foreground mr-2">Subtotal:</span>
                <span className="font-mono font-semibold">${totalValue.toFixed(2)}</span>
                <span className="text-muted-foreground ml-4 mr-2">Incl. GST:</span>
                <span className="font-mono font-semibold">${(totalValue * 1.15).toFixed(2)}</span>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-item-form">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Item" : "Add Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="itemRef">Item Reference *</Label>
                <Input
                  id="itemRef"
                  value={formData.itemRef}
                  onChange={(e) => setFormData(prev => ({ ...prev, itemRef: e.target.value }))}
                  placeholder="e.g. LC-001"
                  data-testid="input-item-ref"
                />
              </div>
              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  value={formData.quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                  data-testid="input-quantity"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Base plate 200x200"
                data-testid="input-title"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="materialType">Material Type</Label>
                <Select
                  value={formData.materialType}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, materialType: v }))}
                >
                  <SelectTrigger data-testid="select-material-type">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MATERIAL_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="materialGrade">Material Grade</Label>
                <Select
                  value={formData.materialGrade}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, materialGrade: v }))}
                >
                  <SelectTrigger data-testid="select-material-grade">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MATERIAL_GRADES.map(g => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="thickness">Thickness (mm)</Label>
                <Input
                  id="thickness"
                  type="number"
                  min={0}
                  step={0.1}
                  value={formData.thickness || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, thickness: parseFloat(e.target.value) || 0 }))}
                  data-testid="input-thickness"
                />
              </div>
              <div>
                <Label htmlFor="length">Length (mm)</Label>
                <Input
                  id="length"
                  type="number"
                  min={0}
                  value={formData.length || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, length: parseFloat(e.target.value) || 0 }))}
                  data-testid="input-length"
                />
              </div>
              <div>
                <Label htmlFor="width">Width (mm)</Label>
                <Input
                  id="width"
                  type="number"
                  min={0}
                  value={formData.width || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, width: parseFloat(e.target.value) || 0 }))}
                  data-testid="input-width"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="finish">Finish</Label>
                <Input
                  id="finish"
                  value={formData.finish}
                  onChange={(e) => setFormData(prev => ({ ...prev, finish: e.target.value }))}
                  placeholder="e.g. Hot-dip galvanised"
                  data-testid="input-finish"
                />
              </div>
              <div>
                <Label htmlFor="unitPrice">Unit Price ($)</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  min={0}
                  step={0.01}
                  value={formData.unitPrice || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                  data-testid="input-unit-price"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="customerNotes">Customer Notes</Label>
              <Textarea
                id="customerNotes"
                value={formData.customerNotes}
                onChange={(e) => setFormData(prev => ({ ...prev, customerNotes: e.target.value }))}
                placeholder="Notes visible to customer..."
                rows={2}
                data-testid="input-customer-notes"
              />
            </div>
            <div>
              <Label htmlFor="internalNotes">Internal Notes</Label>
              <Textarea
                id="internalNotes"
                value={formData.internalNotes}
                onChange={(e) => setFormData(prev => ({ ...prev, internalNotes: e.target.value }))}
                placeholder="Internal notes (not shown on quote)..."
                rows={2}
                data-testid="input-internal-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-item">
              Cancel
            </Button>
            <Button onClick={handleDialogSave} data-testid="button-save-item">
              {editingItem ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent data-testid="dialog-delete-confirm">
          <DialogHeader>
            <DialogTitle>Delete Item</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to remove this item?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} data-testid="button-confirm-delete">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
