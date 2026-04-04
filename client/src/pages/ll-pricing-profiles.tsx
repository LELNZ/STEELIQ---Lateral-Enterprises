import { useState, useMemo } from "react";
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
  Plus, Copy, Pencil, Archive, ShieldCheck, CheckCircle,
  ArrowLeft, Clock, Loader2, History, ChevronDown, ChevronRight,
} from "lucide-react";
import type {
  LLPricingProfile,
  LLPricingAuditLog,
  LLPricingSettings,
  LLMachineProfile,
  LLProcessRateEntry,
  DivisionSettings,
} from "@shared/schema";
import { useLocation, Link } from "wouter";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-300",
  approved: "bg-blue-50 text-blue-700 border-blue-300",
  active: "bg-green-50 text-green-700 border-green-300",
  superseded: "bg-amber-50 text-amber-700 border-amber-300",
  archived: "bg-gray-100 text-gray-500 border-gray-300",
};

export default function LLPricingProfiles() {
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
    <div className="flex flex-col h-full" data-testid="ll-pricing-profiles-page">
      <div className="flex items-center justify-between border-b px-4 py-3 bg-background">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/settings")} data-testid="button-back-settings">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold" data-testid="text-page-title">LL Pricing Profiles</h1>
            <p className="text-xs text-muted-foreground">Pricing governance for Lateral Laser</p>
          </div>
        </div>
        <Button size="sm" onClick={() => { setDuplicateSourceId(null); setCreateDialogOpen(true); }} data-testid="button-new-profile">
          <Plus className="h-4 w-4 mr-1" />
          New Profile
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 border-r overflow-y-auto">
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
                  {new Date(profile.createdAt).toLocaleDateString()}
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
          <div className="font-medium">{new Date(profile.createdAt).toLocaleString()}</div>
        </div>
        {profile.approvedAt && (
          <div className="p-2 bg-muted/50 rounded">
            <span className="text-muted-foreground">Approved</span>
            <div className="font-medium">{new Date(profile.approvedAt).toLocaleString()}</div>
          </div>
        )}
        {profile.activatedAt && (
          <div className="p-2 bg-muted/50 rounded">
            <span className="text-muted-foreground">Activated</span>
            <div className="font-medium">{new Date(profile.activatedAt).toLocaleString()}</div>
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
        <div className="grid grid-cols-3 gap-3">
          {numField("O2", "gasCosts.o2PricePerLitre", settings.gasCosts.o2PricePerLitre, "$/L")}
          {numField("N2", "gasCosts.n2PricePerLitre", settings.gasCosts.n2PricePerLitre, "$/L")}
          {numField("Air", "gasCosts.compressedAirPricePerLitre", settings.gasCosts.compressedAirPricePerLitre, "$/L")}
        </div>
      </SettingsSection>

      <SettingsSection title="Consumable Costs">
        <div className="grid grid-cols-2 gap-3">
          {numField("Cost per Machine Hour", "consumableCosts.consumableCostPerMachineHour", settings.consumableCosts.consumableCostPerMachineHour, "$")}
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
          {numField("Default Markup", "commercialPolicy.defaultMarkupPercent", settings.commercialPolicy.defaultMarkupPercent, "%")}
          {numField("Min Material Charge", "commercialPolicy.minimumMaterialCharge", settings.commercialPolicy.minimumMaterialCharge, "$")}
          {numField("Min Line Charge", "commercialPolicy.minimumLineCharge", settings.commercialPolicy.minimumLineCharge, "$")}
          {numField("Rate per mm Cut", "commercialPolicy.defaultRatePerMmCut", settings.commercialPolicy.defaultRatePerMmCut, "$/mm")}
          {numField("Rate per Pierce", "commercialPolicy.defaultRatePerPierce", settings.commercialPolicy.defaultRatePerPierce, "$/pierce")}
        </div>
      </SettingsSection>

      <SettingsSection title="Nesting Defaults">
        <div className="grid grid-cols-4 gap-3">
          {numField("Kerf Width", "nestingDefaults.kerfWidthMm", settings.nestingDefaults.kerfWidthMm, "mm")}
          {numField("Part Gap", "nestingDefaults.partGapMm", settings.nestingDefaults.partGapMm, "mm")}
          {numField("Edge Trim", "nestingDefaults.edgeTrimMm", settings.nestingDefaults.edgeTrimMm, "mm")}
          {numField("Utilisation", "nestingDefaults.defaultUtilisationFactor", settings.nestingDefaults.defaultUtilisationFactor, "0-1")}
        </div>
      </SettingsSection>

      <SettingsSection title={`Machine Profiles (${settings.machineProfiles.length})`}>
        {settings.machineProfiles.map((mp, idx) => (
          <div key={mp.id} className="p-2 bg-muted/30 rounded mb-2">
            <div className="text-xs font-medium mb-1">{mp.name} {mp.isDefault ? "(Default)" : ""}</div>
            <div className="grid grid-cols-3 gap-2">
              {numField("Hourly Rate", `machineProfiles.${idx}.hourlyMachineRate`, mp.hourlyMachineRate, "$/hr")}
              {numField("Bed Length", `machineProfiles.${idx}.bedLengthMm`, mp.bedLengthMm, "mm")}
              {numField("Bed Width", `machineProfiles.${idx}.bedWidthMm`, mp.bedWidthMm, "mm")}
            </div>
          </div>
        ))}
      </SettingsSection>

      <SettingsSection title={`Process Rate Tables (${settings.processRateTables.length} entries)`}>
        <div className="max-h-48 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left p-1">Material</th>
                <th className="text-left p-1">Thickness</th>
                <th className="text-left p-1">Cut Speed</th>
                <th className="text-left p-1">Pierce Time</th>
                <th className="text-left p-1">Gas</th>
                <th className="text-left p-1">Gas L/min</th>
              </tr>
            </thead>
            <tbody>
              {settings.processRateTables.map((entry, idx) => (
                <tr key={idx} className="border-b border-muted">
                  <td className="p-1">{entry.materialFamily}</td>
                  <td className="p-1">{entry.thickness}mm</td>
                  <td className="p-1">
                    <Input
                      type="number"
                      step="any"
                      value={entry.cutSpeedMmPerMin}
                      onChange={e => update(`processRateTables.${idx}.cutSpeedMmPerMin`, parseFloat(e.target.value) || 0)}
                      className="h-6 text-xs w-20"
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      type="number"
                      step="any"
                      value={entry.pierceTimeSec}
                      onChange={e => update(`processRateTables.${idx}.pierceTimeSec`, parseFloat(e.target.value) || 0)}
                      className="h-6 text-xs w-16"
                    />
                  </td>
                  <td className="p-1">{entry.assistGasType}</td>
                  <td className="p-1">{entry.gasConsumptionLPerMin}</td>
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
  return (
    <div className="space-y-3" data-testid="settings-viewer">
      <SettingsSection title="Gas Costs">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div><span className="text-muted-foreground">O2:</span> ${settings.gasCosts.o2PricePerLitre}/L</div>
          <div><span className="text-muted-foreground">N2:</span> ${settings.gasCosts.n2PricePerLitre}/L</div>
          <div><span className="text-muted-foreground">Air:</span> ${settings.gasCosts.compressedAirPricePerLitre}/L</div>
        </div>
      </SettingsSection>

      <SettingsSection title="Consumable Costs">
        <div className="text-sm">
          <span className="text-muted-foreground">Per Machine Hour:</span> ${settings.consumableCosts.consumableCostPerMachineHour}
        </div>
      </SettingsSection>

      <SettingsSection title="Labour Rates">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Operator:</span> ${settings.labourRates.operatorRatePerHour}/hr</div>
          <div><span className="text-muted-foreground">Shop:</span> ${settings.labourRates.shopRatePerHour}/hr</div>
        </div>
      </SettingsSection>

      <SettingsSection title="Setup & Handling">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Setup:</span> {settings.setupHandlingDefaults.defaultSetupMinutes} min</div>
          <div><span className="text-muted-foreground">Handling:</span> {settings.setupHandlingDefaults.defaultHandlingMinutes} min</div>
        </div>
      </SettingsSection>

      <SettingsSection title="Commercial Policy">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div><span className="text-muted-foreground">Markup:</span> {settings.commercialPolicy.defaultMarkupPercent}%</div>
          <div><span className="text-muted-foreground">Min Material:</span> ${settings.commercialPolicy.minimumMaterialCharge}</div>
          <div><span className="text-muted-foreground">Min Line:</span> ${settings.commercialPolicy.minimumLineCharge}</div>
          <div><span className="text-muted-foreground">Rate/mm:</span> ${settings.commercialPolicy.defaultRatePerMmCut}</div>
          <div><span className="text-muted-foreground">Rate/Pierce:</span> ${settings.commercialPolicy.defaultRatePerPierce}</div>
        </div>
      </SettingsSection>

      <SettingsSection title="Nesting Defaults">
        <div className="grid grid-cols-4 gap-3 text-sm">
          <div><span className="text-muted-foreground">Kerf:</span> {settings.nestingDefaults.kerfWidthMm}mm</div>
          <div><span className="text-muted-foreground">Gap:</span> {settings.nestingDefaults.partGapMm}mm</div>
          <div><span className="text-muted-foreground">Trim:</span> {settings.nestingDefaults.edgeTrimMm}mm</div>
          <div><span className="text-muted-foreground">Util:</span> {(settings.nestingDefaults.defaultUtilisationFactor * 100).toFixed(0)}%</div>
        </div>
      </SettingsSection>

      <SettingsSection title={`Machine Profiles (${settings.machineProfiles.length})`}>
        {settings.machineProfiles.map(mp => (
          <div key={mp.id} className="p-2 bg-muted/30 rounded text-sm mb-1">
            <span className="font-medium">{mp.name}</span>
            {mp.isDefault && <Badge variant="outline" className="ml-2 text-[10px]">Default</Badge>}
            <span className="text-muted-foreground ml-2">${mp.hourlyMachineRate}/hr</span>
            <span className="text-muted-foreground ml-2">{mp.bedLengthMm}×{mp.bedWidthMm}mm</span>
          </div>
        ))}
      </SettingsSection>

      <SettingsSection title={`Process Rate Tables (${settings.processRateTables.length} entries)`}>
        <div className="max-h-48 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left p-1">Material</th>
                <th className="text-left p-1">Thickness</th>
                <th className="text-left p-1">Cut Speed (mm/min)</th>
                <th className="text-left p-1">Pierce (sec)</th>
                <th className="text-left p-1">Gas</th>
                <th className="text-left p-1">Gas (L/min)</th>
              </tr>
            </thead>
            <tbody>
              {settings.processRateTables.map((entry, idx) => (
                <tr key={idx} className="border-b border-muted">
                  <td className="p-1">{entry.materialFamily}</td>
                  <td className="p-1">{entry.thickness}mm</td>
                  <td className="p-1">{entry.cutSpeedMmPerMin}</td>
                  <td className="p-1">{entry.pierceTimeSec}</td>
                  <td className="p-1">{entry.assistGasType}</td>
                  <td className="p-1">{entry.gasConsumptionLPerMin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsSection>
    </div>
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
              <div className="text-muted-foreground mt-0.5">{new Date(entry.createdAt).toLocaleString()}</div>
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

  const mutation = useMutation({
    mutationFn: async () => {
      if (!action) return;
      const res = await apiRequest("POST", `/api/ll-pricing-profiles/${action.profileId}/${action.type}`);
      return res.json();
    },
    onSuccess: () => {
      const labels: Record<string, string> = {
        approve: "Profile approved",
        activate: "Profile activated — now live for all new estimates",
        archive: "Profile archived",
      };
      toast({ title: labels[action!.type] || "Done" });
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
          <AlertDialogAction onClick={() => mutation.mutate()} disabled={mutation.isPending} data-testid="button-confirm-action">
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
