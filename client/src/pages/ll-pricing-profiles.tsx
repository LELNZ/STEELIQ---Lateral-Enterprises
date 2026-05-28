import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus, Copy, Pencil, Archive, ShieldCheck, CheckCircle, Shield,
  ArrowLeft, Clock, Loader2, History, ChevronDown, ChevronRight, Info,
} from "lucide-react";
import type {
  LLPricingProfile,
  LLPricingAuditLog,
  LLPricingSettings,
  LLMachineProfile,
  LLProcessRateEntry,
  LLProcessRateSource,
  LLProductionAllowanceTier,
  DivisionSettings,
} from "@shared/schema";

// Phase 5H.3 — approved seed defaults for production allowance tiers.
// Used when an existing profile is opened for edit and has no tiers defined,
// so the user can seed-and-edit instead of typing five rows from scratch.
const SEED_PRODUCTION_ALLOWANCE_TIERS: LLProductionAllowanceTier[] = [
  {
    tierKey: "prototype",
    tierName: "Prototype (1–9)",
    minQty: 1,
    maxQty: 9,
    fixedBatchMinutes: 20,
    perSheetHandlingMinutes: 5,
    perPartHandlingSeconds: 30,
    perPartHandlingCapMinutes: 15,
    qaPackingMinutes: 5,
    productionOverheadPercent: 8,
    reviewRequiredAboveQty: null,
    internalNotes: "Short setup, manual inspection, one-off documentation.",
  },
  {
    tierKey: "small-batch",
    tierName: "Small Batch (10–49)",
    minQty: 10,
    maxQty: 49,
    fixedBatchMinutes: 30,
    perSheetHandlingMinutes: 6,
    perPartHandlingSeconds: 25,
    perPartHandlingCapMinutes: 30,
    qaPackingMinutes: 8,
    productionOverheadPercent: 6,
    reviewRequiredAboveQty: null,
    internalNotes: "Routine job — fixturing and break-up time still significant.",
  },
  {
    tierKey: "medium-batch",
    tierName: "Medium Batch (50–199)",
    minQty: 50,
    maxQty: 199,
    fixedBatchMinutes: 40,
    perSheetHandlingMinutes: 7,
    perPartHandlingSeconds: 20,
    perPartHandlingCapMinutes: 60,
    qaPackingMinutes: 12,
    productionOverheadPercent: 5,
    reviewRequiredAboveQty: null,
    internalNotes: "Multi-sheet, batched QA sampling.",
  },
  {
    tierKey: "large-batch",
    tierName: "Large Batch (200–999)",
    minQty: 200,
    maxQty: 999,
    fixedBatchMinutes: 60,
    perSheetHandlingMinutes: 8,
    perPartHandlingSeconds: 15,
    perPartHandlingCapMinutes: 120,
    qaPackingMinutes: 20,
    productionOverheadPercent: 4,
    reviewRequiredAboveQty: null,
    internalNotes: "Pallet handling, AQL-style QA, packaging amortised.",
  },
  {
    tierKey: "high-volume",
    tierName: "High Volume (1000+)",
    minQty: 1000,
    maxQty: null,
    fixedBatchMinutes: 90,
    perSheetHandlingMinutes: 10,
    perPartHandlingSeconds: 10,
    perPartHandlingCapMinutes: 240,
    qaPackingMinutes: 40,
    productionOverheadPercent: 3,
    reviewRequiredAboveQty: 5000,
    internalNotes: "Production run — review required above 5,000 parts.",
  },
];

/**
 * Phase 5H.3 — Validate tier coverage. Returns ordered warnings for the
 * admin UI (overlap, gap, missing entry-point at qty=1, etc.). Pure / read-only.
 */
function analyseTierCoverage(tiers: LLProductionAllowanceTier[] | undefined): string[] {
  if (!tiers || tiers.length === 0) return [];
  const warnings: string[] = [];
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  if (sorted[0].minQty > 1) {
    warnings.push(`Quantities 1–${sorted[0].minQty - 1} are not covered by any tier (allowance = 0).`);
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    const curMax = cur.maxQty ?? Infinity;
    if (curMax >= next.minQty) {
      warnings.push(`Tiers "${cur.tierName}" and "${next.tierName}" overlap (${cur.minQty}–${curMax} vs ${next.minQty}–${next.maxQty ?? "∞"}).`);
    } else if (curMax + 1 < next.minQty) {
      warnings.push(`Gap between "${cur.tierName}" (ends ${curMax}) and "${next.tierName}" (starts ${next.minQty}) — quantities in between will use the lower tier.`);
    }
  }
  const last = sorted[sorted.length - 1];
  if (last.maxQty != null) {
    warnings.push(`Top tier "${last.tierName}" has a finite max (${last.maxQty}). Quantities above ${last.maxQty} will get zero allowance.`);
  }
  return warnings;
}
import { useLocation, Link } from "wouter";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-300",
  approved: "bg-blue-50 text-blue-700 border-blue-300",
  active: "bg-green-50 text-green-700 border-green-300",
  superseded: "bg-amber-50 text-amber-700 border-amber-300",
  archived: "bg-gray-100 text-gray-500 border-gray-300",
};

export default function LLPricingProfiles({ embedded }: { embedded?: boolean } = {}) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [duplicateSourceId, setDuplicateSourceId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: string; profileId: string; profileName: string } | null>(null);

  const { data: profiles = [], isLoading } = useQuery<LLPricingProfile[]>({
    queryKey: ["/api/ll-pricing-profiles"],
    queryFn: () => fetch("/api/ll-pricing-profiles", { credentials: "include" }).then(r => r.json()),
  });

  const { data: llDivisionSettings } = useQuery<DivisionSettings>({
    queryKey: ["/api/settings/divisions", "LL"],
    staleTime: Infinity,
  });

  const selectedProfile = profiles.find(p => p.id === selectedId) || null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={embedded ? "flex flex-col" : "flex flex-col h-full"} data-testid="ll-pricing-profiles-page">
      {!embedded && (
        <header className="border-b px-4 sm:px-6 py-3 flex items-center justify-between gap-3 bg-card shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/settings")} data-testid="button-back-settings">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary shrink-0">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight" data-testid="text-page-title">LL Pricing Profiles</h1>
              <p className="text-[11px] text-muted-foreground leading-tight">Pricing governance for Lateral Laser</p>
            </div>
          </div>
          <Button size="sm" onClick={() => { setDuplicateSourceId(null); setCreateDialogOpen(true); }} data-testid="button-new-profile">
            <Plus className="h-4 w-4 mr-1" />
            New Profile
          </Button>
        </header>
      )}
      {embedded && (
        <div className="flex items-center justify-between pb-3">
          <div>
            <h3 className="text-sm font-semibold">LL Pricing Model — Profiles</h3>
            <p className="text-xs text-muted-foreground">Process rates, machine settings, commercial policy, and markup rules — does not own gas/consumable source costs</p>
          </div>
          <Button size="sm" onClick={() => { setDuplicateSourceId(null); setCreateDialogOpen(true); }} data-testid="button-new-profile">
            <Plus className="h-4 w-4 mr-1" />
            New Profile
          </Button>
        </div>
      )}

      {embedded && (
        <div className="flex items-start gap-2 p-2.5 mb-3 bg-green-50/50 dark:bg-green-950/10 border border-green-200 dark:border-green-800 rounded text-xs text-green-800 dark:text-green-300" data-testid="pricing-workflow-steps">
          <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <div>
            <strong>How to update pricing:</strong> 1) Duplicate the active profile or create new → 2) Edit the draft (rates, machines, policies) → 3) Approve when ready → 4) Activate to go live. The previously active profile moves to "superseded" and remains for audit.
          </div>
        </div>
      )}

      <div className={`flex ${embedded ? "h-[700px]" : "flex-1"} overflow-hidden border rounded-lg`}>
        <div className="w-72 border-r overflow-y-auto">
          <div className="p-3 space-y-1">
            {profiles.length === 0 && (
              <p className="text-sm text-muted-foreground p-4 text-center" data-testid="text-no-profiles">
                No pricing profiles yet. Create one from current settings.
              </p>
            )}
            {profiles.map(profile => (
              <button
                key={profile.id}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedId === profile.id ? "bg-accent border-primary/30" : "bg-card hover:bg-accent/50 border-transparent"
                }`}
                onClick={() => setSelectedId(profile.id)}
                data-testid={`profile-item-${profile.id}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate">{profile.profileName}</span>
                  <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[profile.status]}`} data-testid={`badge-status-${profile.id}`}>
                    {profile.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{profile.versionLabel}</div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "—"}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {selectedProfile ? (
            <ProfileDetail
              profile={selectedProfile}
              onDuplicate={(id) => { setDuplicateSourceId(id); setCreateDialogOpen(true); }}
              onConfirmAction={setConfirmAction}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Select a profile from the list to view details
            </div>
          )}
        </div>
      </div>

      <CreateProfileDialog
        open={createDialogOpen}
        onClose={() => { setCreateDialogOpen(false); setDuplicateSourceId(null); }}
        duplicateSourceId={duplicateSourceId}
        llDivisionSettings={llDivisionSettings}
        onCreated={(id) => setSelectedId(id)}
      />

      <ConfirmActionDialog
        action={confirmAction}
        onClose={() => setConfirmAction(null)}
        onSuccess={() => {
          setConfirmAction(null);
          queryClient.invalidateQueries({ queryKey: ["/api/ll-pricing-profiles"] });
        }}
      />
    </div>
  );
}

function ProfileDetail({
  profile,
  onDuplicate,
  onConfirmAction,
}: {
  profile: LLPricingProfile;
  onDuplicate: (id: string) => void;
  onConfirmAction: (action: { type: string; profileId: string; profileName: string }) => void;
}) {
  const { toast } = useToast();
  const settings = profile.llPricingSettingsJson as LLPricingSettings | null;
  const isEditable = profile.status === "draft";
  const [editing, setEditing] = useState(false);
  const [editSettings, setEditSettings] = useState<LLPricingSettings | null>(null);
  const [editName, setEditName] = useState("");
  const [editVersion, setEditVersion] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const { data: auditLog = [] } = useQuery<LLPricingAuditLog[]>({
    queryKey: ["/api/ll-pricing-profiles", profile.id, "audit"],
    queryFn: () => fetch(`/api/ll-pricing-profiles/${profile.id}/audit`, { credentials: "include" }).then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/ll-pricing-profiles/${profile.id}`, {
        profileName: editName,
        versionLabel: editVersion,
        notes: editNotes,
        llPricingSettingsJson: editSettings,
      });
      return res.json();
    },
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/ll-pricing-profiles"] });
      toast({ title: "Saved", description: "Profile updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const startEdit = () => {
    setEditName(profile.profileName);
    setEditVersion(profile.versionLabel);
    setEditNotes(profile.notes || "");
    setEditSettings(settings ? JSON.parse(JSON.stringify(settings)) : null);
    setEditing(true);
  };

  return (
    <div className="p-4 space-y-4" data-testid="profile-detail">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-profile-name">{profile.profileName}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className={STATUS_COLORS[profile.status]}>{profile.status}</Badge>
            <span className="text-xs text-muted-foreground">{profile.versionLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onDuplicate(profile.id)} data-testid="button-duplicate">
            <Copy className="h-3.5 w-3.5 mr-1" />
            Duplicate
          </Button>
          {isEditable && !editing && (
            <Button variant="outline" size="sm" onClick={startEdit} data-testid="button-edit">
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Edit
            </Button>
          )}
          {isEditable && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onConfirmAction({ type: "approve", profileId: profile.id, profileName: profile.profileName })}
              data-testid="button-approve"
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              Approve
            </Button>
          )}
          {profile.status === "approved" && (
            <Button
              variant="default"
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => onConfirmAction({ type: "activate", profileId: profile.id, profileName: profile.profileName })}
              data-testid="button-activate"
            >
              <ShieldCheck className="h-3.5 w-3.5 mr-1" />
              Activate
            </Button>
          )}
          {profile.status !== "active" && profile.status !== "archived" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onConfirmAction({ type: "archive", profileId: profile.id, profileName: profile.profileName })}
              data-testid="button-archive"
            >
              <Archive className="h-3.5 w-3.5 mr-1" />
              Archive
            </Button>
          )}
        </div>
      </div>

      {profile.notes && !editing && (
        <p className="text-sm text-muted-foreground" data-testid="text-profile-notes">{profile.notes}</p>
      )}

      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="p-2 bg-muted/50 rounded">
          <span className="text-muted-foreground">Created</span>
          <div className="font-medium">{profile.createdAt ? new Date(profile.createdAt).toLocaleString() : "—"}</div>
        </div>
        {profile.approvedAt && (
          <div className="p-2 bg-muted/50 rounded">
            <span className="text-muted-foreground">Approved</span>
            <div className="font-medium">{new Date(String(profile.approvedAt)).toLocaleString()}</div>
          </div>
        )}
        {profile.activatedAt && (
          <div className="p-2 bg-muted/50 rounded">
            <span className="text-muted-foreground">Activated</span>
            <div className="font-medium">{new Date(String(profile.activatedAt)).toLocaleString()}</div>
          </div>
        )}
      </div>

      <Separator />

      {editing && editSettings ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Profile Name</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} data-testid="input-edit-name" />
            </div>
            <div>
              <Label>Version Label</Label>
              <Input value={editVersion} onChange={e => setEditVersion(e.target.value)} data-testid="input-edit-version" />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} data-testid="input-edit-notes" />
          </div>

          <PricingSettingsEditor settings={editSettings} onChange={setEditSettings} />

          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-edit">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save Changes
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        settings && <PricingSettingsViewer settings={settings} />
      )}

      <Separator />

      <AuditTrail entries={auditLog} />
    </div>
  );
}

function PricingSettingsEditor({
  settings,
  onChange,
}: {
  settings: LLPricingSettings;
  onChange: (s: LLPricingSettings) => void;
}) {
  const update = (path: string, value: any) => {
    const copy = JSON.parse(JSON.stringify(settings));
    const keys = path.split(".");
    let obj: any = copy;
    for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
    obj[keys[keys.length - 1]] = value;
    onChange(copy);
  };

  const numField = (label: string, path: string, value: number, unit?: string) => (
    <div>
      <Label className="text-xs">{label}{unit ? ` (${unit})` : ""}</Label>
      <Input
        type="number"
        step="any"
        value={value}
        onChange={e => update(path, parseFloat(e.target.value) || 0)}
        className="h-8 text-sm"
        data-testid={`input-${path.replace(/\./g, "-")}`}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <SettingsSection title="Gas Costs">
        <div className="px-3 py-2 mb-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-700 dark:text-blue-400 flex items-center gap-1.5" data-testid="gas-governed-notice">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Gas costs are <strong>governed by active Source Costs</strong> (supplier-backed). Profile values below are fallback only and do not override governed rates.</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {numField("O2 (fallback)", "gasCosts.o2PricePerLitre", settings.gasCosts.o2PricePerLitre, "$/L")}
          {numField("N2 (fallback)", "gasCosts.n2PricePerLitre", settings.gasCosts.n2PricePerLitre, "$/L")}
          {numField("Air (fallback)", "gasCosts.compressedAirPricePerLitre", settings.gasCosts.compressedAirPricePerLitre, "$/L")}
        </div>
      </SettingsSection>

      <SettingsSection title="Consumable Costs">
        <div className="px-3 py-2 mb-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-700 dark:text-blue-400 flex items-center gap-1.5" data-testid="consumables-governed-notice">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Consumable costs are <strong>governed by active Source Costs</strong> (invoice-backed). Profile value below is fallback only.</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {numField("Cost per Machine Hour (fallback)", "consumableCosts.consumableCostPerMachineHour", settings.consumableCosts.consumableCostPerMachineHour, "$")}
        </div>
      </SettingsSection>

      <SettingsSection title="Labour Rates">
        <div className="grid grid-cols-2 gap-3">
          {numField("Operator Rate", "labourRates.operatorRatePerHour", settings.labourRates.operatorRatePerHour, "$/hr")}
          {numField("Shop Rate", "labourRates.shopRatePerHour", settings.labourRates.shopRatePerHour, "$/hr")}
        </div>
      </SettingsSection>

      <SettingsSection title="Setup & Handling Defaults">
        <div className="grid grid-cols-2 gap-3">
          {numField("Default Setup", "setupHandlingDefaults.defaultSetupMinutes", settings.setupHandlingDefaults.defaultSetupMinutes, "min")}
          {numField("Default Handling", "setupHandlingDefaults.defaultHandlingMinutes", settings.setupHandlingDefaults.defaultHandlingMinutes, "min")}
        </div>
      </SettingsSection>

      <SettingsSection title="Commercial Policy">
        <div className="grid grid-cols-3 gap-3">
          {numField("Material Markup", "commercialPolicy.defaultMaterialMarkupPercent", settings.commercialPolicy.defaultMaterialMarkupPercent ?? 20, "%")}
          {numField("Consumables Markup", "commercialPolicy.defaultConsumablesMarkupPercent", settings.commercialPolicy.defaultConsumablesMarkupPercent ?? 25, "%")}
          {numField("Min Material Charge", "commercialPolicy.minimumMaterialCharge", settings.commercialPolicy.minimumMaterialCharge, "$")}
          {numField("Min Line Charge", "commercialPolicy.minimumLineCharge", settings.commercialPolicy.minimumLineCharge, "$")}
          {numField("Rate per mm Cut", "commercialPolicy.defaultRatePerMmCut", settings.commercialPolicy.defaultRatePerMmCut, "$/mm")}
          {numField("Rate per Pierce", "commercialPolicy.defaultRatePerPierce", settings.commercialPolicy.defaultRatePerPierce, "$/pierce")}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">Material and consumables markups are applied to buy costs to derive sell prices. Machine and labour sell rates are governed by machine profile and labour rates above.</p>
      </SettingsSection>

      <SettingsSection title="Nesting Defaults">
        <div className="grid grid-cols-4 gap-3">
          {numField("Kerf Width", "nestingDefaults.kerfWidthMm", settings.nestingDefaults.kerfWidthMm, "mm")}
          {numField("Part Gap", "nestingDefaults.partGapMm", settings.nestingDefaults.partGapMm, "mm")}
          {numField("Edge Trim", "nestingDefaults.edgeTrimMm", settings.nestingDefaults.edgeTrimMm, "mm")}
          {numField("Utilisation", "nestingDefaults.defaultUtilisationFactor", settings.nestingDefaults.defaultUtilisationFactor, "0-1")}
        </div>
      </SettingsSection>

      <SettingsSection title={`Production Allowance Tiers (${settings.productionAllowanceTiers?.length ?? 0})`}>
        <div className="px-3 py-2 mb-2 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded text-xs text-purple-800 dark:text-purple-300 flex items-start gap-1.5" data-testid="allowance-tier-notice">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Internal-only.</strong> Adds batch setup, per-sheet handling, per-part touch time, QA/packing, and a production overhead % to each LL line. Selected by qty (and optionally sheet count). Customer-facing Preview and PDF are not changed.
          </div>
        </div>

        {(!settings.productionAllowanceTiers || settings.productionAllowanceTiers.length === 0) && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-orange-300 bg-orange-50 dark:bg-orange-950/20 p-3 mb-2" data-testid="empty-allowance-tiers-warning">
            <div className="text-xs text-orange-700 dark:text-orange-400">
              <p className="font-medium">No tiers defined</p>
              <p className="mt-0.5 text-[10px]">All quantities get zero allowance — engine behaves as pre-5H.3.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const copy = JSON.parse(JSON.stringify(settings));
                copy.productionAllowanceTiers = JSON.parse(JSON.stringify(SEED_PRODUCTION_ALLOWANCE_TIERS));
                onChange(copy);
              }}
              data-testid="button-seed-allowance-tiers"
            >
              Seed approved defaults
            </Button>
          </div>
        )}

        {settings.productionAllowanceTiers && settings.productionAllowanceTiers.length > 0 && (() => {
          const warnings = analyseTierCoverage(settings.productionAllowanceTiers);
          if (warnings.length === 0) return null;
          return (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-2 mb-2 text-[11px] text-amber-800 dark:text-amber-300 space-y-0.5" data-testid="allowance-tier-warnings">
              {warnings.map((w, i) => (
                <div key={i}>⚠ {w}</div>
              ))}
            </div>
          );
        })()}

        {(settings.productionAllowanceTiers ?? []).map((tier, idx) => (
          <div key={`${tier.tierKey}-${idx}`} className="p-3 bg-muted/30 rounded mb-2 border" data-testid={`tier-editor-${idx}`}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Input
                  value={tier.tierName}
                  onChange={e => update(`productionAllowanceTiers.${idx}.tierName`, e.target.value)}
                  className="h-7 text-xs font-medium w-56"
                  placeholder="Tier name"
                  data-testid={`input-tier-name-${idx}`}
                />
                <Input
                  value={tier.tierKey}
                  onChange={e => update(`productionAllowanceTiers.${idx}.tierKey`, e.target.value)}
                  className="h-7 text-[10px] w-40 font-mono"
                  placeholder="tier-key"
                  data-testid={`input-tier-key-${idx}`}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] text-red-600 hover:text-red-700"
                onClick={() => {
                  const copy = JSON.parse(JSON.stringify(settings));
                  copy.productionAllowanceTiers.splice(idx, 1);
                  onChange(copy);
                }}
                data-testid={`button-remove-tier-${idx}`}
              >
                Remove
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {numField("Min Qty", `productionAllowanceTiers.${idx}.minQty`, tier.minQty, "parts")}
              <div>
                <Label className="text-xs">Max Qty (blank = ∞)</Label>
                <Input
                  type="number"
                  step="any"
                  value={tier.maxQty ?? ""}
                  onChange={e => update(`productionAllowanceTiers.${idx}.maxQty`, e.target.value === "" ? null : (parseFloat(e.target.value) || 0))}
                  className="h-8 text-sm"
                  data-testid={`input-tier-max-qty-${idx}`}
                />
              </div>
              <div>
                <Label className="text-xs">Min Sheets (optional)</Label>
                <Input
                  type="number"
                  step="any"
                  value={tier.minSheets ?? ""}
                  onChange={e => update(`productionAllowanceTiers.${idx}.minSheets`, e.target.value === "" ? null : (parseFloat(e.target.value) || 0))}
                  className="h-8 text-sm"
                  data-testid={`input-tier-min-sheets-${idx}`}
                />
              </div>
              <div>
                <Label className="text-xs">Max Sheets (optional)</Label>
                <Input
                  type="number"
                  step="any"
                  value={tier.maxSheets ?? ""}
                  onChange={e => update(`productionAllowanceTiers.${idx}.maxSheets`, e.target.value === "" ? null : (parseFloat(e.target.value) || 0))}
                  className="h-8 text-sm"
                  data-testid={`input-tier-max-sheets-${idx}`}
                />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {numField("Fixed Batch", `productionAllowanceTiers.${idx}.fixedBatchMinutes`, tier.fixedBatchMinutes, "min")}
              {numField("Per Sheet", `productionAllowanceTiers.${idx}.perSheetHandlingMinutes`, tier.perSheetHandlingMinutes, "min/sheet")}
              {numField("Per Part", `productionAllowanceTiers.${idx}.perPartHandlingSeconds`, tier.perPartHandlingSeconds, "sec/part")}
              <div>
                <Label className="text-xs">Per-Part Cap (min, blank = none)</Label>
                <Input
                  type="number"
                  step="any"
                  value={tier.perPartHandlingCapMinutes ?? ""}
                  onChange={e => update(`productionAllowanceTiers.${idx}.perPartHandlingCapMinutes`, e.target.value === "" ? null : (parseFloat(e.target.value) || 0))}
                  className="h-8 text-sm"
                  data-testid={`input-tier-per-part-cap-${idx}`}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {numField("QA / Packing", `productionAllowanceTiers.${idx}.qaPackingMinutes`, tier.qaPackingMinutes ?? 0, "min")}
              {numField("Overhead", `productionAllowanceTiers.${idx}.productionOverheadPercent`, tier.productionOverheadPercent ?? 0, "%")}
              <div>
                <Label className="text-xs">Review Above (parts, blank = never)</Label>
                <Input
                  type="number"
                  step="any"
                  value={tier.reviewRequiredAboveQty ?? ""}
                  onChange={e => update(`productionAllowanceTiers.${idx}.reviewRequiredAboveQty`, e.target.value === "" ? null : (parseFloat(e.target.value) || 0))}
                  className="h-8 text-sm"
                  data-testid={`input-tier-review-above-${idx}`}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Internal Notes</Label>
              <Textarea
                value={tier.internalNotes ?? ""}
                onChange={e => update(`productionAllowanceTiers.${idx}.internalNotes`, e.target.value)}
                rows={1}
                className="text-xs"
                data-testid={`input-tier-notes-${idx}`}
              />
            </div>
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          className="w-full mt-1"
          onClick={() => {
            const copy = JSON.parse(JSON.stringify(settings));
            const existing: LLProductionAllowanceTier[] = copy.productionAllowanceTiers ?? [];
            const nextIdx = existing.length + 1;
            existing.push({
              tierKey: `tier-${Date.now()}`,
              tierName: `New Tier ${nextIdx}`,
              minQty: 1,
              maxQty: null,
              minSheets: null,
              maxSheets: null,
              fixedBatchMinutes: 0,
              perSheetHandlingMinutes: 0,
              perPartHandlingSeconds: 0,
              perPartHandlingCapMinutes: null,
              qaPackingMinutes: 0,
              productionOverheadPercent: 0,
              reviewRequiredAboveQty: null,
              internalNotes: "",
            });
            copy.productionAllowanceTiers = existing;
            onChange(copy);
          }}
          data-testid="button-add-tier"
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Tier
        </Button>
      </SettingsSection>

      <SettingsSection title={`Machine Profiles (${settings.machineProfiles.length})`}>
        <p className="text-[10px] text-muted-foreground mb-2">Each machine defines a laser cutter's physical bed size and hourly rate. These are used in estimate calculations.</p>
        {settings.machineProfiles.map((mp, idx) => (
          <div key={mp.id} className="p-3 bg-muted/30 rounded mb-2 border">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Input
                  value={mp.name}
                  onChange={e => update(`machineProfiles.${idx}.name`, e.target.value)}
                  className="h-7 text-xs font-medium w-48"
                  data-testid={`input-machine-name-${idx}`}
                />
                {mp.isDefault && <Badge variant="outline" className="text-[9px]">Default</Badge>}
              </div>
              {mp.isDefault && <span className="text-[10px] text-muted-foreground">Used for estimates</span>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {numField("Sell Rate", `machineProfiles.${idx}.hourlyMachineRate`, mp.hourlyMachineRate, "$/hr")}
              {numField("Buy Cost", `machineProfiles.${idx}.machineBuyCostPerHour`, mp.machineBuyCostPerHour ?? mp.hourlyMachineRate * 0.6, "$/hr")}
              {numField("Bed Length", `machineProfiles.${idx}.bedLengthMm`, mp.bedLengthMm, "mm")}
              {numField("Bed Width", `machineProfiles.${idx}.bedWidthMm`, mp.bedWidthMm, "mm")}
              {numField("Usable Length", `machineProfiles.${idx}.usableLengthMm`, mp.usableLengthMm || 0, "mm")}
              {numField("Usable Width", `machineProfiles.${idx}.usableWidthMm`, mp.usableWidthMm || 0, "mm")}
            </div>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-1"
          onClick={() => {
            const copy = JSON.parse(JSON.stringify(settings));
            copy.machineProfiles.push({
              id: `machine-${Date.now()}`,
              name: `New Machine ${copy.machineProfiles.length + 1}`,
              bedLengthMm: 3000, bedWidthMm: 1500,
              usableLengthMm: 2900, usableWidthMm: 1400,
              hourlyMachineRate: 0, machineBuyCostPerHour: 0, isDefault: false, isActive: true,
              maxThicknessByMaterialFamily: {},
            });
            onChange(copy);
          }}
          data-testid="button-add-machine"
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Machine Profile
        </Button>
      </SettingsSection>

      <SettingsSection title={`Process Rate Tables (${settings.processRateTables.length} entries)`}>
        <p className="text-[10px] text-muted-foreground mb-2">Defines cut speed, pierce time, and <strong>assist gas type</strong> for each material/thickness combination. The gas type here determines which gas source cost is used during pricing.</p>
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b">
                <th className="text-left p-1.5 font-medium">Material Family</th>
                <th className="text-left p-1.5 font-medium">Thickness</th>
                <th className="text-left p-1.5 font-medium">Cut Speed (mm/min)</th>
                <th className="text-left p-1.5 font-medium">Pierce (sec)</th>
                <th className="text-left p-1.5 font-medium">Assist Gas Type</th>
                <th className="text-left p-1.5 font-medium">Gas (L/min)</th>
                <th className="text-left p-1.5 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {settings.processRateTables.map((entry, idx) => (
                <tr key={idx} className="border-b border-muted hover:bg-muted/30">
                  <td className="p-1.5">{entry.materialFamily}</td>
                  <td className="p-1.5">{entry.thickness}mm</td>
                  <td className="p-1.5">
                    <Input
                      type="number"
                      step="any"
                      value={entry.cutSpeedMmPerMin}
                      onChange={e => update(`processRateTables.${idx}.cutSpeedMmPerMin`, parseFloat(e.target.value) || 0)}
                      className="h-6 text-xs w-20"
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      type="number"
                      step="any"
                      value={entry.pierceTimeSec}
                      onChange={e => update(`processRateTables.${idx}.pierceTimeSec`, parseFloat(e.target.value) || 0)}
                      className="h-6 text-xs w-16"
                    />
                  </td>
                  <td className="p-1.5">
                    <Badge variant="outline" className="text-[10px]">{entry.assistGasType}</Badge>
                  </td>
                  <td className="p-1.5">{entry.gasConsumptionLPerMin}</td>
                  <td className="p-1.5"><ProvenanceBadge source={entry.dataSource} note={entry.dataSourceNote} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsSection>
    </div>
  );
}

function PricingSettingsViewer({ settings }: { settings: LLPricingSettings }) {
  const gas = settings.gasCosts;
  const consumables = settings.consumableCosts;
  const labour = settings.labourRates;
  const setup = settings.setupHandlingDefaults;
  return (
    <div className="space-y-3" data-testid="settings-viewer">
      {gas && (
        <SettingsSection title="Gas Costs">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div><span className="text-muted-foreground">O2:</span> ${gas.o2PricePerLitre}/L</div>
            <div><span className="text-muted-foreground">N2:</span> ${gas.n2PricePerLitre}/L</div>
            <div><span className="text-muted-foreground">Air:</span> ${gas.compressedAirPricePerLitre}/L</div>
          </div>
        </SettingsSection>
      )}

      {consumables && (
        <SettingsSection title="Consumable Costs">
          <div className="text-sm">
            <span className="text-muted-foreground">Per Machine Hour:</span> ${consumables.consumableCostPerMachineHour}
          </div>
        </SettingsSection>
      )}

      {labour && (
        <SettingsSection title="Labour Rates">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Operator:</span> ${labour.operatorRatePerHour}/hr</div>
            <div><span className="text-muted-foreground">Shop:</span> ${labour.shopRatePerHour}/hr</div>
          </div>
        </SettingsSection>
      )}

      {setup && (
        <SettingsSection title="Setup & Handling">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Setup:</span> {setup.defaultSetupMinutes} min</div>
          <div><span className="text-muted-foreground">Handling:</span> {setup.defaultHandlingMinutes} min</div>
        </div>
      </SettingsSection>
      )}

      {settings.commercialPolicy && (
        <SettingsSection title="Commercial Policy">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div><span className="text-muted-foreground">Material Markup:</span> {settings.commercialPolicy.defaultMaterialMarkupPercent ?? 20}%</div>
            <div><span className="text-muted-foreground">Consumables Markup:</span> {settings.commercialPolicy.defaultConsumablesMarkupPercent ?? 25}%</div>
            <div><span className="text-muted-foreground">Min Material:</span> ${settings.commercialPolicy.minimumMaterialCharge}</div>
            <div><span className="text-muted-foreground">Min Line:</span> ${settings.commercialPolicy.minimumLineCharge}</div>
            <div><span className="text-muted-foreground">Rate/mm:</span> ${settings.commercialPolicy.defaultRatePerMmCut}</div>
            <div><span className="text-muted-foreground">Rate/Pierce:</span> ${settings.commercialPolicy.defaultRatePerPierce}</div>
          </div>
        </SettingsSection>
      )}

      {settings.nestingDefaults && (
        <SettingsSection title="Nesting Defaults">
          <div className="grid grid-cols-4 gap-3 text-sm">
            <div><span className="text-muted-foreground">Kerf:</span> {settings.nestingDefaults.kerfWidthMm}mm</div>
            <div><span className="text-muted-foreground">Gap:</span> {settings.nestingDefaults.partGapMm}mm</div>
            <div><span className="text-muted-foreground">Trim:</span> {settings.nestingDefaults.edgeTrimMm}mm</div>
            <div><span className="text-muted-foreground">Util:</span> {(settings.nestingDefaults.defaultUtilisationFactor * 100).toFixed(0)}%</div>
          </div>
        </SettingsSection>
      )}

      {settings.machineProfiles && (
        <SettingsSection title={`Machine Profiles (${settings.machineProfiles.length})`}>
          {settings.machineProfiles.map(mp => (
            <div key={mp.id} className="p-2 bg-muted/30 rounded text-sm mb-1">
              <span className="font-medium">{mp.name}</span>
              {mp.isDefault && <Badge variant="outline" className="ml-2 text-[10px]">Default</Badge>}
              <span className="text-muted-foreground ml-2">Sell ${mp.hourlyMachineRate}/hr</span>
              <span className="text-muted-foreground ml-2">Buy ${mp.machineBuyCostPerHour ?? +(mp.hourlyMachineRate * 0.6).toFixed(2)}/hr</span>
              <span className="text-muted-foreground ml-2">{mp.bedLengthMm}×{mp.bedWidthMm}mm</span>
            </div>
          ))}
        </SettingsSection>
      )}

      <SettingsSection title={`Production Allowance Tiers (${settings.productionAllowanceTiers?.length ?? 0})`}>
        {!settings.productionAllowanceTiers || settings.productionAllowanceTiers.length === 0 ? (
          <div className="rounded-md border border-dashed border-orange-300 bg-orange-50 dark:bg-orange-950/20 p-3 text-xs text-orange-700 dark:text-orange-400" data-testid="viewer-empty-allowance-tiers">
            <p className="font-medium">No tiers configured</p>
            <p className="mt-0.5 text-[10px]">All quantities get zero allowance — engine behaves as pre-5H.3.</p>
          </div>
        ) : (
          <>
            {(() => {
              const warnings = analyseTierCoverage(settings.productionAllowanceTiers);
              if (warnings.length === 0) return null;
              return (
                <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-2 mb-2 text-[11px] text-amber-800 dark:text-amber-300 space-y-0.5" data-testid="viewer-allowance-tier-warnings">
                  {warnings.map((w, i) => (<div key={i}>⚠ {w}</div>))}
                </div>
              );
            })()}
            <div className="overflow-x-auto">
              <table className="w-full text-xs" data-testid="viewer-allowance-tiers">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-1">Tier</th>
                    <th className="text-left p-1">Qty</th>
                    <th className="text-left p-1">Sheets</th>
                    <th className="text-right p-1">Batch (min)</th>
                    <th className="text-right p-1">Per Sheet</th>
                    <th className="text-right p-1">Per Part</th>
                    <th className="text-right p-1">Cap</th>
                    <th className="text-right p-1">QA/Pack</th>
                    <th className="text-right p-1">OH %</th>
                    <th className="text-right p-1">Review &gt;</th>
                  </tr>
                </thead>
                <tbody>
                  {settings.productionAllowanceTiers.map((t, i) => (
                    <tr key={i} className="border-b border-muted">
                      <td className="p-1 font-medium">{t.tierName}<div className="text-[9px] font-mono text-muted-foreground">{t.tierKey}</div></td>
                      <td className="p-1">{t.minQty}–{t.maxQty ?? "∞"}</td>
                      <td className="p-1">{t.minSheets != null || t.maxSheets != null ? `${t.minSheets ?? "0"}–${t.maxSheets ?? "∞"}` : "—"}</td>
                      <td className="p-1 text-right">{t.fixedBatchMinutes}</td>
                      <td className="p-1 text-right">{t.perSheetHandlingMinutes} min</td>
                      <td className="p-1 text-right">{t.perPartHandlingSeconds}s</td>
                      <td className="p-1 text-right">{t.perPartHandlingCapMinutes ?? "—"}</td>
                      <td className="p-1 text-right">{t.qaPackingMinutes ?? 0}</td>
                      <td className="p-1 text-right">{t.productionOverheadPercent ?? 0}%</td>
                      <td className="p-1 text-right">{t.reviewRequiredAboveQty ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Internal-only. Adds batch setup, per-sheet handling, per-part touch time, QA/packing, and a production overhead % to LL lines based on quantity.</p>
          </>
        )}
      </SettingsSection>

      <SettingsSection title={`Process Rate Tables (${settings.processRateTables?.length ?? 0} entries)`}>
        {!settings.processRateTables || settings.processRateTables.length === 0 ? (
          <div className="rounded-md border border-dashed border-orange-300 bg-orange-50 dark:bg-orange-950/20 p-3 text-xs text-orange-700 dark:text-orange-400" data-testid="empty-process-rates-warning">
            <p className="font-medium">No process rate entries defined</p>
            <p className="mt-0.5 text-[10px]">This profile cannot produce accurate cut-time or gas-consumption estimates without process rate data. Edit the profile to add material/thickness entries.</p>
          </div>
        ) : (
          <div className="max-h-48 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-1">Material</th>
                  <th className="text-left p-1">Thickness</th>
                  <th className="text-left p-1">Cut Speed (mm/min)</th>
                  <th className="text-left p-1">Pierce (sec)</th>
                  <th className="text-left p-1">Assist Gas</th>
                  <th className="text-left p-1">Gas (L/min)</th>
                  <th className="text-left p-1">Source</th>
                </tr>
              </thead>
              <tbody>
                {settings.processRateTables.map((entry, idx) => (
                  <tr key={idx} className="border-b border-muted">
                    <td className="p-1">{entry.materialFamily}</td>
                    <td className="p-1">{entry.thickness}mm</td>
                    <td className="p-1">{entry.cutSpeedMmPerMin}</td>
                    <td className="p-1">{entry.pierceTimeSec}</td>
                    <td className="p-1">
                      <Badge variant="outline" className="text-[10px]">{entry.assistGasType === 'compressed_air' ? 'Air' : entry.assistGasType}</Badge>
                    </td>
                    <td className="p-1">{entry.gasConsumptionLPerMin}</td>
                    <td className="p-1"><ProvenanceBadge source={entry.dataSource} note={entry.dataSourceNote} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-1">Assist gas type per row determines which source gas cost is applied during pricing.</p>
      </SettingsSection>
    </div>
  );
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  architecture_default: { label: "Default", color: "text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-950/40" },
  bodor_spec: { label: "Bodor Spec", color: "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-950/40" },
  empirical_test: { label: "Tested", color: "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-950/40" },
  operator_input: { label: "Operator", color: "text-violet-600 bg-violet-100 dark:text-violet-400 dark:bg-violet-950/40" },
  manual_override: { label: "Override", color: "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-950/40" },
  orphaned_no_library_match: { label: "Orphaned", color: "text-gray-500 bg-gray-100 dark:text-gray-400 dark:bg-gray-800/40" },
};

function ProvenanceBadge({ source, note }: { source?: string; note?: string }) {
  const info = source ? SOURCE_LABELS[source] : undefined;
  if (!info) return <span className="text-[9px] text-muted-foreground">—</span>;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${info.color}`}
      title={note || ""}
      data-testid="badge-provenance"
    >
      {info.label}
    </span>
  );
}

function SettingsSection({ title, children }: { title: string; children: any }) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium w-full text-left py-1">
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-5 pt-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function AuditTrail({ entries }: { entries: LLPricingAuditLog[] }) {
  if (entries.length === 0) return null;
  return (
    <div data-testid="audit-trail">
      <h3 className="text-sm font-medium mb-2 flex items-center gap-1">
        <History className="h-3.5 w-3.5" />
        Audit Trail
      </h3>
      <div className="space-y-1">
        {entries.map(entry => (
          <div key={entry.id} className="flex items-start gap-2 text-xs p-2 bg-muted/30 rounded">
            <Clock className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div>
              <span className="font-medium">{entry.actorDisplayName}</span>
              <span className="text-muted-foreground ml-1">{entry.summary}</span>
              <div className="text-muted-foreground mt-0.5">{entry.createdAt ? new Date(String(entry.createdAt)).toLocaleString() : ""}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateProfileDialog({
  open,
  onClose,
  duplicateSourceId,
  llDivisionSettings,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  duplicateSourceId: string | null;
  llDivisionSettings?: DivisionSettings;
  onCreated: (id: string) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        profileName: name.trim(),
        versionLabel: version.trim(),
        notes: notes.trim(),
      };

      if (duplicateSourceId) {
        body.duplicateFromId = duplicateSourceId;
      } else {
        const existingSettings = llDivisionSettings?.llPricingSettingsJson as LLPricingSettings | null;
        if (!existingSettings) throw new Error("No LL pricing settings found to seed from");
        body.llPricingSettingsJson = existingSettings;
      }

      const res = await apiRequest("POST", "/api/ll-pricing-profiles", body);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ll-pricing-profiles"] });
      toast({ title: "Profile created", description: `"${data.profileName}" created as draft` });
      onCreated(data.id);
      onClose();
      setName("");
      setVersion("");
      setNotes("");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent data-testid="dialog-create-profile">
        <DialogHeader>
          <DialogTitle>{duplicateSourceId ? "Duplicate Profile" : "New Pricing Profile"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Profile Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Standard Rates 2026" data-testid="input-profile-name" />
          </div>
          <div>
            <Label>Version Label</Label>
            <Input value={version} onChange={e => setVersion(e.target.value)} placeholder="e.g. v1.0" data-testid="input-version-label" />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Reason for this version..." data-testid="input-notes" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!name.trim() || !version.trim() || mutation.isPending} data-testid="button-create-profile-confirm">
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {duplicateSourceId ? "Duplicate" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmActionDialog({
  action,
  onClose,
  onSuccess,
}: {
  action: { type: string; profileId: string; profileName: string } | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();

  const actionRef = useRef(action);
  actionRef.current = action;

  const mutation = useMutation({
    mutationFn: async (captured: { type: string; profileId: string }) => {
      const res = await apiRequest("POST", `/api/ll-pricing-profiles/${captured.profileId}/${captured.type}`);
      return res.json();
    },
    onSuccess: (_data, captured) => {
      const labels: Record<string, string> = {
        approve: "Profile approved",
        activate: "Profile activated — now live for all new estimates",
        archive: "Profile archived",
      };
      toast({ title: labels[captured.type] || "Done" });
      queryClient.invalidateQueries({ queryKey: ["/api/ll-pricing-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ll-pricing-profiles", "active"] });
      onSuccess();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const descriptions: Record<string, string> = {
    approve: "This will mark the profile as approved and ready for activation.",
    activate: "This will make this profile the active pricing source for all new LL estimates and quotes. Any currently active profile will be superseded.",
    archive: "This will archive the profile. It will no longer be available for activation.",
  };

  const handleConfirm = () => {
    if (!action) return;
    mutation.mutate({ type: action.type, profileId: action.profileId });
  };

  return (
    <AlertDialog open={!!action} onOpenChange={(o) => { if (!o) onClose(); }}>
      <AlertDialogContent data-testid="dialog-confirm-action">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {action?.type === "approve" ? "Approve" : action?.type === "activate" ? "Activate" : "Archive"} "{action?.profileName}"?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {action ? descriptions[action.type] : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={mutation.isPending} data-testid="button-confirm-action">
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
