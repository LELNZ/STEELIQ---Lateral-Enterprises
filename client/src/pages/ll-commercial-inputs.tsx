import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, ChevronRight, Shield, AlertTriangle, FileText, Flame, Wrench } from "lucide-react";
import type { LLGasCostInput, LLConsumablesCostInput, LLPricingAuditLog } from "@shared/schema";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-300",
  approved: "bg-blue-50 text-blue-700 border-blue-300",
  active: "bg-green-50 text-green-700 border-green-300",
  superseded: "bg-amber-50 text-amber-700 border-amber-300",
  archived: "bg-red-50 text-red-600 border-red-300",
};

export default function LLCommercialInputs({ embedded }: { embedded?: boolean } = {}) {
  const [activeTab, setActiveTab] = useState<string>("gas");
  const [selectedGasId, setSelectedGasId] = useState<string | null>(null);
  const [selectedConsumableId, setSelectedConsumableId] = useState<string | null>(null);
  const [showCreateGas, setShowCreateGas] = useState(false);
  const [showCreateConsumable, setShowCreateConsumable] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: string; id: string; name: string } | null>(null);
  const { toast } = useToast();

  const gasQuery = useQuery<LLGasCostInput[]>({ queryKey: ["/api/ll-gas-cost-inputs"] });
  const consumablesQuery = useQuery<LLConsumablesCostInput[]>({ queryKey: ["/api/ll-consumables-cost-inputs"] });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ll-commercial-inputs/seed");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: `Seeded ${data.seeded} commercial input records` });
      queryClient.invalidateQueries({ queryKey: ["/api/ll-gas-cost-inputs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ll-consumables-cost-inputs"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error seeding", description: err.message, variant: "destructive" });
    },
  });

  const gasInputs = gasQuery.data || [];
  const consumableInputs = consumablesQuery.data || [];
  const selectedGas = gasInputs.find(g => g.id === selectedGasId);
  const selectedConsumable = consumableInputs.find(c => c.id === selectedConsumableId);

  const hasNoData = gasInputs.length === 0 && consumableInputs.length === 0;

  return (
    <div className={embedded ? "flex flex-col" : "flex flex-col h-full"} data-testid="ll-commercial-inputs-page">
      {!embedded && (
        <div className="border-b px-6 py-3 flex items-center justify-between bg-background">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold" data-testid="page-title">LL Commercial Inputs</h1>
          </div>
          <div className="flex gap-2">
            {hasNoData && (
              <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} data-testid="button-seed">
                {seedMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                Seed from BOC/Bodor
              </Button>
            )}
          </div>
        </div>
      )}
      {embedded && (
        <div className="flex items-center justify-between pb-3">
          <div>
            <h3 className="text-sm font-semibold">Commercial Inputs</h3>
            <p className="text-xs text-muted-foreground">Supplier-backed gas and consumable cost records with contract traceability</p>
          </div>
          <div className="flex gap-2">
            {hasNoData && (
              <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} data-testid="button-seed">
                {seedMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                Seed from BOC/Bodor
              </Button>
            )}
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b px-6">
          <TabsList className="h-10">
            <TabsTrigger value="gas" className="gap-1.5" data-testid="tab-gas">
              <Flame className="h-3.5 w-3.5" /> Gas Costs ({gasInputs.length})
            </TabsTrigger>
            <TabsTrigger value="consumables" className="gap-1.5" data-testid="tab-consumables">
              <Wrench className="h-3.5 w-3.5" /> Consumables ({consumableInputs.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <TabsContent value="gas" className="flex-1 flex m-0 data-[state=inactive]:hidden">
            <div className="w-80 border-r overflow-y-auto p-3 space-y-1.5">
              <Button variant="outline" size="sm" className="w-full gap-1" onClick={() => setShowCreateGas(true)} data-testid="button-new-gas">
                <Plus className="h-3.5 w-3.5" /> New Gas Input
              </Button>
              {gasInputs.map(g => (
                <div
                  key={g.id}
                  onClick={() => setSelectedGasId(g.id)}
                  className={`p-2.5 rounded-md border cursor-pointer text-sm transition-colors ${selectedGasId === g.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                  data-testid={`gas-item-${g.id}`}
                >
                  <div className="font-medium">{g.gasType.toUpperCase()}</div>
                  <div className="text-xs text-muted-foreground">{g.packageType} — {g.supplierName}</div>
                  <Badge variant="outline" className={`mt-1 text-[10px] ${statusColors[g.status]}`}>{g.status}</Badge>
                </div>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {selectedGas ? (
                <GasInputDetail input={selectedGas} onConfirmAction={setConfirmAction} />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">Select a gas cost input to view details</div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="consumables" className="flex-1 flex m-0 data-[state=inactive]:hidden">
            <div className="w-80 border-r overflow-y-auto p-3 space-y-1.5">
              <Button variant="outline" size="sm" className="w-full gap-1" onClick={() => setShowCreateConsumable(true)} data-testid="button-new-consumable">
                <Plus className="h-3.5 w-3.5" /> New Consumable Input
              </Button>
              {consumableInputs.map(c => (
                <div
                  key={c.id}
                  onClick={() => setSelectedConsumableId(c.id)}
                  className={`p-2.5 rounded-md border cursor-pointer text-sm transition-colors ${selectedConsumableId === c.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                  data-testid={`consumable-item-${c.id}`}
                >
                  <div className="font-medium truncate">{c.description}</div>
                  <div className="text-xs text-muted-foreground">{c.consumableCategory} — {c.supplierName}</div>
                  <Badge variant="outline" className={`mt-1 text-[10px] ${statusColors[c.status]}`}>{c.status}</Badge>
                </div>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {selectedConsumable ? (
                <ConsumableInputDetail input={selectedConsumable} onConfirmAction={setConfirmAction} />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">Select a consumable input to view details</div>
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <ConfirmActionDialog action={confirmAction} onClose={() => setConfirmAction(null)} onSuccess={() => setConfirmAction(null)} />
      <CreateGasDialog open={showCreateGas} onClose={() => setShowCreateGas(false)} />
      <CreateConsumableDialog open={showCreateConsumable} onClose={() => setShowCreateConsumable(false)} />
    </div>
  );
}

function GasInputDetail({ input, onConfirmAction }: { input: LLGasCostInput; onConfirmAction: (a: any) => void }) {
  const auditQuery = useQuery<LLPricingAuditLog[]>({
    queryKey: ["/api/ll-pricing-profiles", input.id, "audit"],
  });
  const assumptions = input.derivedAssumptionsJson as Record<string, string> | null;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{input.gasType.toUpperCase()} — {input.packageType}</h2>
          <p className="text-sm text-muted-foreground">{input.description || input.packageCode}</p>
        </div>
        <Badge variant="outline" className={`text-xs ${statusColors[input.status]}`}>{input.status}</Badge>
      </div>

      {input.status === "draft" && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onConfirmAction({ type: "approve", id: input.id, name: `${input.gasType} (${input.packageType})`, entity: "gas" })} data-testid="button-approve">Approve</Button>
        </div>
      )}
      {input.status === "approved" && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onConfirmAction({ type: "activate", id: input.id, name: `${input.gasType} (${input.packageType})`, entity: "gas" })} data-testid="button-activate">Activate</Button>
        </div>
      )}
      {input.status !== "active" && input.status !== "draft" && input.status !== "approved" && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onConfirmAction({ type: "archive", id: input.id, name: `${input.gasType} (${input.packageType})`, entity: "gas" })} data-testid="button-archive">Archive</Button>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Supplier & Source</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Supplier:</span> {input.supplierName}</div>
          <div><span className="text-muted-foreground">Source Type:</span> {input.sourceType}</div>
          <div><span className="text-muted-foreground">Reference:</span> {input.sourceReference}</div>
          <div><span className="text-muted-foreground">Document:</span> {input.sourceDocumentName || "—"}</div>
          <div><span className="text-muted-foreground">Source Date:</span> {input.sourceDate || "—"}</div>
          {input.sourceNotes && <div className="col-span-2"><span className="text-muted-foreground">Notes:</span> {input.sourceNotes}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Package Pricing</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Package Code:</span> {input.packageCode || "—"}</div>
          <div><span className="text-muted-foreground">Delivered Price (ex GST):</span> ${input.deliveredPriceExGst.toFixed(2)}</div>
          <div><span className="text-muted-foreground">Daily Service Charge:</span> ${input.dailyServiceChargeExGst.toFixed(2)}</div>
          <div><span className="text-muted-foreground">Unit Capacity:</span> {input.unitCapacityValue ? `${input.unitCapacityValue.toLocaleString()} ${input.unitCapacityUom || ""}` : "Not set"}</div>
          <div><span className="text-muted-foreground">Usable Fraction:</span> {input.usableFraction ? `${(input.usableFraction * 100).toFixed(0)}%` : "—"}</div>
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Derived Cost</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="text-lg font-bold">
            {input.derivedCostPerLitre != null ? `$${input.derivedCostPerLitre.toFixed(6)}/litre` : "Not calculated"}
          </div>
          {assumptions && (
            <div className="text-xs space-y-1 text-muted-foreground">
              {Object.entries(assumptions).map(([k, v]) => (
                <div key={k} className="flex gap-1"><AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" /> {v}</div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {input.activatedAt && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Lifecycle</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            {input.approvedAt && <div><span className="text-muted-foreground">Approved:</span> {new Date(input.approvedAt).toLocaleString()}</div>}
            {input.activatedAt && <div><span className="text-muted-foreground">Activated:</span> {new Date(input.activatedAt).toLocaleString()}</div>}
            {input.effectiveFrom && <div><span className="text-muted-foreground">Effective From:</span> {new Date(input.effectiveFrom).toLocaleString()}</div>}
          </CardContent>
        </Card>
      )}

      {auditQuery.data && auditQuery.data.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Audit Trail</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {auditQuery.data.map(entry => (
              <div key={entry.id} className="flex items-start gap-2 text-xs border-b last:border-0 pb-1.5">
                <Badge variant="outline" className="text-[9px] shrink-0">{entry.eventType}</Badge>
                <div className="flex-1">{entry.summary}</div>
                <span className="text-muted-foreground shrink-0">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ""}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ConsumableInputDetail({ input, onConfirmAction }: { input: LLConsumablesCostInput; onConfirmAction: (a: any) => void }) {
  const auditQuery = useQuery<LLPricingAuditLog[]>({
    queryKey: ["/api/ll-pricing-profiles", input.id, "audit"],
  });
  const assumptions = input.derivedAssumptionsJson as Record<string, string> | null;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{input.description}</h2>
          <p className="text-sm text-muted-foreground">{input.consumableCategory} — SKU: {input.sku}</p>
        </div>
        <Badge variant="outline" className={`text-xs ${statusColors[input.status]}`}>{input.status}</Badge>
      </div>

      {input.status === "draft" && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onConfirmAction({ type: "approve", id: input.id, name: input.description, entity: "consumable" })} data-testid="button-approve">Approve</Button>
        </div>
      )}
      {input.status === "approved" && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onConfirmAction({ type: "activate", id: input.id, name: input.description, entity: "consumable" })} data-testid="button-activate">Activate</Button>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Supplier & Source</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Supplier:</span> {input.supplierName}</div>
          <div><span className="text-muted-foreground">Source Type:</span> {input.sourceType}</div>
          <div><span className="text-muted-foreground">Reference:</span> {input.sourceReference}</div>
          <div><span className="text-muted-foreground">Document:</span> {input.sourceDocumentName || "—"}</div>
          <div><span className="text-muted-foreground">Source Date:</span> {input.sourceDate || "—"}</div>
          {input.sourceNotes && <div className="col-span-2"><span className="text-muted-foreground">Notes:</span> {input.sourceNotes}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Purchase Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Purchase Cost (ex GST):</span> ${input.purchaseCostExGst.toFixed(2)}</div>
          <div><span className="text-muted-foreground">Quantity:</span> {input.quantityPurchased}</div>
          <div><span className="text-muted-foreground">Unit Cost:</span> ${input.unitCostExGst.toFixed(2)}</div>
          <div><span className="text-muted-foreground">Machine:</span> {input.machineFamily || "—"} {input.machineModel || ""}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Life Assumptions</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Life Model:</span> {input.lifeModelType}</div>
          <div><span className="text-muted-foreground">Expected Life:</span> {input.expectedLifeValue} {input.lifeModelType}</div>
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Derived Cost</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="text-lg font-bold">
            {input.derivedCostPerHour != null ? `$${input.derivedCostPerHour.toFixed(4)}/hour` : "Not calculated"}
          </div>
          {assumptions && (
            <div className="text-xs space-y-1 text-muted-foreground">
              {Object.entries(assumptions).map(([k, v]) => (
                <div key={k} className="flex gap-1"><AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" /> {v}</div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {input.activatedAt && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Lifecycle</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            {input.approvedAt && <div><span className="text-muted-foreground">Approved:</span> {new Date(input.approvedAt).toLocaleString()}</div>}
            {input.activatedAt && <div><span className="text-muted-foreground">Activated:</span> {new Date(input.activatedAt).toLocaleString()}</div>}
          </CardContent>
        </Card>
      )}

      {auditQuery.data && auditQuery.data.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Audit Trail</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {auditQuery.data.map(entry => (
              <div key={entry.id} className="flex items-start gap-2 text-xs border-b last:border-0 pb-1.5">
                <Badge variant="outline" className="text-[9px] shrink-0">{entry.eventType}</Badge>
                <div className="flex-1">{entry.summary}</div>
                <span className="text-muted-foreground shrink-0">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ""}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ConfirmActionDialog({ action, onClose, onSuccess }: {
  action: { type: string; id: string; name: string; entity?: string } | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (captured: { type: string; id: string; entity?: string }) => {
      const base = captured.entity === "consumable" ? "/api/ll-consumables-cost-inputs" : "/api/ll-gas-cost-inputs";
      const res = await apiRequest("POST", `${base}/${captured.id}/${captured.type}`);
      return res.json();
    },
    onSuccess: (_data, captured) => {
      const labels: Record<string, string> = { approve: "Input approved", activate: "Input activated", archive: "Input archived" };
      toast({ title: labels[captured.type] || "Done" });
      queryClient.invalidateQueries({ queryKey: ["/api/ll-gas-cost-inputs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ll-consumables-cost-inputs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ll-gas-cost-inputs", "active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ll-consumables-cost-inputs", "active"] });
      onSuccess();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleConfirm = () => {
    if (!action) return;
    mutation.mutate({ type: action.type, id: action.id, entity: action.entity });
  };

  return (
    <AlertDialog open={!!action} onOpenChange={(o) => { if (!o) onClose(); }}>
      <AlertDialogContent data-testid="dialog-confirm-action">
        <AlertDialogHeader>
          <AlertDialogTitle>{action?.type === "approve" ? "Approve" : action?.type === "activate" ? "Activate" : "Archive"} "{action?.name}"?</AlertDialogTitle>
          <AlertDialogDescription>
            {action?.type === "approve" && "This will mark the input as approved and ready for activation."}
            {action?.type === "activate" && "This will make this input the active source for pricing. Any currently active input for this type will be superseded."}
            {action?.type === "archive" && "This will archive the input."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={mutation.isPending} data-testid="button-confirm-action">
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CreateGasDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    gasType: "oxygen", packageType: "cylinder", supplierName: "", sourceReference: "",
    sourceType: "agreement", sourceDocumentName: "", sourceDate: "", sourceNotes: "",
    packageCode: "", description: "", deliveredPriceExGst: 0, dailyServiceChargeExGst: 0,
    unitCapacityValue: 0, unitCapacityUom: "litres", usableFraction: 0.95,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const derived = form.unitCapacityValue > 0 && form.usableFraction > 0
        ? form.deliveredPriceExGst / (form.unitCapacityValue * form.usableFraction)
        : undefined;
      const res = await apiRequest("POST", "/api/ll-gas-cost-inputs", {
        ...form,
        derivedCostPerLitre: derived ? parseFloat(derived.toFixed(6)) : undefined,
        derivedAssumptionsJson: { capacitySource: "Manual entry", usableFractionNote: `${(form.usableFraction * 100).toFixed(0)}% usable`, conversionNote: "Delivered price / (capacity × usable fraction)" },
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Gas cost input created" });
      queryClient.invalidateQueries({ queryKey: ["/api/ll-gas-cost-inputs"] });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Gas Cost Input</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Gas Type</Label>
              <Select value={form.gasType} onValueChange={v => setForm(f => ({ ...f, gasType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="oxygen">Oxygen</SelectItem>
                  <SelectItem value="nitrogen">Nitrogen</SelectItem>
                  <SelectItem value="argon">Argon</SelectItem>
                  <SelectItem value="compressed_air">Compressed Air</SelectItem>
                  <SelectItem value="co2">CO2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Package Type</Label>
              <Select value={form.packageType} onValueChange={v => setForm(f => ({ ...f, packageType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cylinder">Cylinder</SelectItem>
                  <SelectItem value="mcp">MCP (Manifold)</SelectItem>
                  <SelectItem value="bulk">Bulk</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Supplier</Label><Input value={form.supplierName} onChange={e => setForm(f => ({ ...f, supplierName: e.target.value }))} /></div>
            <div><Label>Source Reference</Label><Input value={form.sourceReference} onChange={e => setForm(f => ({ ...f, sourceReference: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Source Type</Label>
              <Select value={form.sourceType} onValueChange={v => setForm(f => ({ ...f, sourceType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agreement">Agreement</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="manual_adjustment">Manual Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Package Code</Label><Input value={form.packageCode} onChange={e => setForm(f => ({ ...f, packageCode: e.target.value }))} /></div>
          </div>
          <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Delivered Price (ex GST)</Label><Input type="number" step="0.01" value={form.deliveredPriceExGst} onChange={e => setForm(f => ({ ...f, deliveredPriceExGst: parseFloat(e.target.value) || 0 }))} /></div>
            <div><Label>Daily Service Charge</Label><Input type="number" step="0.01" value={form.dailyServiceChargeExGst} onChange={e => setForm(f => ({ ...f, dailyServiceChargeExGst: parseFloat(e.target.value) || 0 }))} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Capacity</Label><Input type="number" value={form.unitCapacityValue} onChange={e => setForm(f => ({ ...f, unitCapacityValue: parseFloat(e.target.value) || 0 }))} /></div>
            <div><Label>UOM</Label><Input value={form.unitCapacityUom} onChange={e => setForm(f => ({ ...f, unitCapacityUom: e.target.value }))} /></div>
            <div><Label>Usable %</Label><Input type="number" step="0.01" value={form.usableFraction} onChange={e => setForm(f => ({ ...f, usableFraction: parseFloat(e.target.value) || 0.95 }))} /></div>
          </div>
          <div><Label>Source Document Name</Label><Input value={form.sourceDocumentName} onChange={e => setForm(f => ({ ...f, sourceDocumentName: e.target.value }))} /></div>
          <div><Label>Source Notes</Label><Textarea value={form.sourceNotes} onChange={e => setForm(f => ({ ...f, sourceNotes: e.target.value }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.supplierName || !form.sourceReference}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Create Draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateConsumableDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    sku: "", description: "", consumableCategory: "lens", supplierName: "", sourceReference: "",
    sourceType: "invoice", sourceDocumentName: "", sourceDate: "", sourceNotes: "",
    machineFamily: "", machineModel: "",
    purchaseCostExGst: 0, quantityPurchased: 1, unitCostExGst: 0,
    lifeModelType: "hours", expectedLifeValue: 0,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const derived = form.expectedLifeValue > 0
        ? form.unitCostExGst / form.expectedLifeValue
        : undefined;
      const res = await apiRequest("POST", "/api/ll-consumables-cost-inputs", {
        ...form,
        derivedCostPerHour: derived ? parseFloat(derived.toFixed(4)) : undefined,
        derivedAssumptionsJson: { lifeNote: `${form.expectedLifeValue} ${form.lifeModelType} estimated life`, costBasis: `Unit cost $${form.unitCostExGst.toFixed(2)}`, derivedCalc: "unitCost / expectedLife" },
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Consumable cost input created" });
      queryClient.invalidateQueries({ queryKey: ["/api/ll-consumables-cost-inputs"] });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Consumable Cost Input</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>SKU</Label><Input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} /></div>
            <div><Label>Category</Label>
              <Select value={form.consumableCategory} onValueChange={v => setForm(f => ({ ...f, consumableCategory: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lens">Lens</SelectItem>
                  <SelectItem value="ceramic">Ceramic</SelectItem>
                  <SelectItem value="nozzle">Nozzle</SelectItem>
                  <SelectItem value="filter">Filter</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Supplier</Label><Input value={form.supplierName} onChange={e => setForm(f => ({ ...f, supplierName: e.target.value }))} /></div>
            <div><Label>Source Reference</Label><Input value={form.sourceReference} onChange={e => setForm(f => ({ ...f, sourceReference: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Purchase Cost (ex GST)</Label><Input type="number" step="0.01" value={form.purchaseCostExGst} onChange={e => setForm(f => ({ ...f, purchaseCostExGst: parseFloat(e.target.value) || 0 }))} /></div>
            <div><Label>Qty Purchased</Label><Input type="number" value={form.quantityPurchased} onChange={e => setForm(f => ({ ...f, quantityPurchased: parseInt(e.target.value) || 1 }))} /></div>
            <div><Label>Unit Cost</Label><Input type="number" step="0.01" value={form.unitCostExGst} onChange={e => setForm(f => ({ ...f, unitCostExGst: parseFloat(e.target.value) || 0 }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Life Model</Label>
              <Select value={form.lifeModelType} onValueChange={v => setForm(f => ({ ...f, lifeModelType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="pierces">Pierces</SelectItem>
                  <SelectItem value="metres_cut">Metres Cut</SelectItem>
                  <SelectItem value="sheets">Sheets</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Expected Life Value</Label><Input type="number" value={form.expectedLifeValue} onChange={e => setForm(f => ({ ...f, expectedLifeValue: parseFloat(e.target.value) || 0 }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Machine Family</Label><Input value={form.machineFamily} onChange={e => setForm(f => ({ ...f, machineFamily: e.target.value }))} /></div>
            <div><Label>Machine Model</Label><Input value={form.machineModel} onChange={e => setForm(f => ({ ...f, machineModel: e.target.value }))} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.sku || !form.description || !form.supplierName}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Create Draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
