import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Settings as SettingsIcon, Save, Loader2, Upload, X, Palette, Eye, EyeOff, RotateCcw, FileText, Wrench, Lock, AlertTriangle, Shield, Hash, ExternalLink, CheckCircle2, XCircle, Archive, Trash2, Flag, Server, Database, RefreshCw, Info, ChevronDown, ChevronRight, Clock, Activity, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useSettings, type QuoteListPosition } from "@/lib/settings-context";
import { useToast } from "@/hooks/use-toast";
import { resolvePresetsForDivision, PRESET_FIELD_LABELS, type SiteVisitPresetDefaults, type JobTypePresetsConfig } from "@/lib/site-visit-presets";
import { useLibraryOptions } from "@/hooks/use-library-options";
import {
  COMPANY_MASTER_TEMPLATE,
  applyCompanyConfig,
  type CompanyTemplateConfig,
  type TemplateSectionDef,
  type SpacingPreset,
  type TypographyPreset,
  type PhotoSizePreset,
  type ScheduleLayoutVariant,
  type TotalsLayoutVariant,
  type LogoScale,
  type DensityPreset,
  type DocumentMode,
  type LegalLinePlacement,
  type ContactBlockAlignment,
} from "@/lib/quote-template";
import { Slider } from "@/components/ui/slider";
import type { LLPricingSettings, LLMachineProfile, LLProcessRateEntry } from "@shared/schema";
import LLPricingProfilesPage from "@/pages/ll-pricing-profiles";
import LLCommercialInputsPage from "@/pages/ll-commercial-inputs";
import { DollarSign, Flame, Layers, BookOpen, Receipt, Cpu } from "lucide-react";

interface OrgSettings {
  id: string;
  legalName: string;
  businessDisplayName: string | null;
  gstNumber: string | null;
  nzbn: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  bankDetails: string | null;
  defaultHeaderNotesBlock: string | null;
  defaultTermsBlock: string | null;
  defaultExclusionsBlock: string | null;
  paymentTermsBlock: string | null;
  quoteValidityDays: number;
  documentLabel: string | null;
  quoteNumberPrefix: string | null;
  quoteNumberUseDivisionSuffix: boolean | null;
  jobNumberPrefix: string | null;
  jobNumberUseDivisionSuffix: boolean | null;
}

interface DivisionSettings {
  divisionCode: string;
  tradingName: string | null;
  logoUrl: string | null;
  templateKey: string;
  requiredLegalLine: string;
  termsOverrideBlock: string | null;
  headerNotesOverrideBlock: string | null;
  exclusionsOverrideBlock: string | null;
  additionalCapabilitiesBlock: string | null;
  fontFamily: string | null;
  accentColor: string | null;
  logoPosition: string | null;
  headerVariant: string | null;
  scheduleLayoutVariant: string;
  totalsLayoutVariant: string;
  specDisplayDefaultsJson: string[] | null;
  jobTypePresetsJson: JobTypePresetsConfig | null;
  domainType?: string;
}

interface SpecEntry {
  key: string;
  group: string;
  label: string;
  customerVisibleAllowed: boolean;
}

function OrgSettingsTab() {
  const { toast } = useToast();
  const { data: org, isLoading } = useQuery<OrgSettings>({
    queryKey: ["/api/settings/org"],
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const [form, setForm] = useState<Partial<OrgSettings>>({});

  useEffect(() => {
    if (org) setForm(org);
  }, [org]);

  const mutation = useMutation({
    mutationFn: async (data: Partial<OrgSettings>) => {
      const res = await apiRequest("PATCH", "/api/settings/org", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/org"] });
      toast({ title: "Organisation settings saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (form.quoteValidityDays != null && (isNaN(form.quoteValidityDays) || form.quoteValidityDays < 1 || !Number.isInteger(form.quoteValidityDays))) {
      toast({ title: "Quote validity must be a whole number ≥ 1", variant: "destructive" });
      return;
    }
    mutation.mutate(form);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="org-settings-tab">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Branding</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Controls how STEELIQ appears to operators in the sidebar and app shell.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-1 block">Business Display Name</Label>
            <p className="text-xs text-muted-foreground mb-2">Shown beneath STEELIQ in the sidebar as a sub-label (e.g. Lateral Enterprises)</p>
            <Input
              value={form.businessDisplayName || ""}
              onChange={(e) => setForm({ ...form, businessDisplayName: e.target.value })}
              placeholder="Lateral Enterprises"
              data-testid="input-org-businessDisplayName"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Customer-Facing Document Label</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Controls the heading shown on customer-facing quote documents — the live preview and exported PDF. Internal system logic, lifecycle, and numbering remain quote-based. This setting does not rename other document types or modules.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-1 block">Document Label</Label>
            <p className="text-xs text-muted-foreground mb-2">Examples: Quote, Service Estimate, Proposal</p>
            <Input
              value={form.documentLabel || ""}
              onChange={(e) => setForm({ ...form, documentLabel: e.target.value })}
              placeholder="Quote"
              className="w-64"
              data-testid="input-org-documentLabel"
            />
            {form.documentLabel && form.documentLabel.trim() && (
              <p className="text-xs text-muted-foreground mt-2">
                Preview and PDF heading will read: <strong className="font-semibold">{form.documentLabel.trim().toUpperCase()}</strong>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Company Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-1 block">Legal Name</Label>
            <Input
              value={form.legalName || ""}
              onChange={(e) => setForm({ ...form, legalName: e.target.value })}
              data-testid="input-org-legalName"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium mb-1 block">GST Number</Label>
              <Input
                value={form.gstNumber || ""}
                onChange={(e) => setForm({ ...form, gstNumber: e.target.value })}
                data-testid="input-org-gstNumber"
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1 block">NZBN</Label>
              <Input
                value={form.nzbn || ""}
                onChange={(e) => setForm({ ...form, nzbn: e.target.value })}
                data-testid="input-org-nzbn"
              />
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium mb-1 block">Address</Label>
            <Input
              value={form.address || ""}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              data-testid="input-org-address"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium mb-1 block">Phone</Label>
              <Input
                value={form.phone || ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                data-testid="input-org-phone"
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1 block">Email</Label>
              <Input
                value={form.email || ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                data-testid="input-org-email"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Banking</CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <Label className="text-sm font-medium mb-1 block">Bank Details</Label>
            <p className="text-xs text-muted-foreground mb-2">Displayed on customer invoices and quotes</p>
            <RichTextEditor
              value={form.bankDetails || ""}
              onChange={(v) => setForm(prev => ({ ...prev, bankDetails: v }))}
              rows={3}
              data-testid="input-org-bankDetails"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quote Defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-1 block">Quote Validity (days)</Label>
            <p className="text-xs text-muted-foreground mb-2">Number of days quotes remain valid from issue date</p>
            <Input
              type="number"
              min="1"
              step="1"
              value={form.quoteValidityDays ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setForm({ ...form, quoteValidityDays: v === "" ? undefined : parseInt(v, 10) });
              }}
              className="w-32"
              data-testid="input-org-quoteValidityDays"
            />
          </div>
          <Separator />
          <div>
            <Label className="text-sm font-medium mb-1 block">Default Header Notes</Label>
            <RichTextEditor
              value={form.defaultHeaderNotesBlock || ""}
              onChange={(v) => setForm(prev => ({ ...prev, defaultHeaderNotesBlock: v }))}
              rows={3}
              data-testid="input-org-defaultHeaderNotesBlock"
            />
          </div>
          <div>
            <Label className="text-sm font-medium mb-1 block">Default Terms</Label>
            <RichTextEditor
              value={form.defaultTermsBlock || ""}
              onChange={(v) => setForm(prev => ({ ...prev, defaultTermsBlock: v }))}
              rows={4}
              data-testid="input-org-defaultTermsBlock"
            />
          </div>
          <div>
            <Label className="text-sm font-medium mb-1 block">Default Exclusions</Label>
            <RichTextEditor
              value={form.defaultExclusionsBlock || ""}
              onChange={(v) => setForm(prev => ({ ...prev, defaultExclusionsBlock: v }))}
              rows={3}
              data-testid="input-org-defaultExclusionsBlock"
            />
          </div>
          <div>
            <Label className="text-sm font-medium mb-1 block">Payment Terms</Label>
            <RichTextEditor
              value={form.paymentTermsBlock || ""}
              onChange={(v) => setForm(prev => ({ ...prev, paymentTermsBlock: v }))}
              rows={3}
              data-testid="input-org-paymentTermsBlock"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={mutation.isPending} data-testid="button-save-org">
          {mutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
          ) : (
            <><Save className="w-4 h-4 mr-2" /> Save Organisation Settings</>
          )}
        </Button>
      </div>
    </div>
  );
}

function InvalidPresetWarning({ field, value }: { field: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 mt-1 text-amber-600 dark:text-amber-400" data-testid={`warning-invalid-${field}`}>
      <AlertTriangle className="w-3 h-3 shrink-0" />
      <span className="text-[10px] leading-tight">
        Saved value "{value}" is no longer available. Please select a current option.
      </span>
    </div>
  );
}

function PresetSelectField({
  presetKey,
  field,
  value,
  options,
  onChange,
}: {
  presetKey: string;
  field: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  onChange: (val: string | undefined) => void;
}) {
  const isInvalid = value !== undefined && value !== "" && !options.some(o => o.value === value);

  return (
    <div>
      <Label className="text-xs font-medium mb-1 block text-muted-foreground">{PRESET_FIELD_LABELS[field as keyof typeof PRESET_FIELD_LABELS]}</Label>
      <Select
        value={value || "__none__"}
        onValueChange={(v) => onChange(v === "__none__" ? undefined : v)}
      >
        <SelectTrigger className="h-8 text-sm" data-testid={`select-preset-${presetKey}-${field}`}>
          <SelectValue placeholder="Not set" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Not set</SelectItem>
          {options.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isInvalid && <InvalidPresetWarning field={`${presetKey}-${field}`} value={value!} />}
    </div>
  );
}

function PresetFieldEditor({ 
  presetKey,
  defaults, 
  onChange 
}: { 
  presetKey: string;
  defaults: SiteVisitPresetDefaults; 
  onChange: (updated: SiteVisitPresetDefaults) => void;
}) {
  const lib = useLibraryOptions();

  const updateField = (field: keyof SiteVisitPresetDefaults, value: string | number | undefined) => {
    const next = { ...defaults };
    if (value === undefined) {
      delete next[field];
    } else {
      (next as any)[field] = value;
    }
    if (field === "glassIguType") {
      delete next.glassType;
      delete next.glassThickness;
    }
    if (field === "glassType") {
      delete next.glassThickness;
    }
    onChange(next);
  };

  const allFrameTypes = lib.frameTypeOptions("windows-standard");
  const glassComboStrings = defaults.glassIguType ? lib.glassComboOptions(defaults.glassIguType) : [];
  const glassComboOpts = glassComboStrings.map(c => ({ value: c, label: c }));
  const thicknessStrings = defaults.glassIguType && defaults.glassType ? lib.glassThicknessOptions(defaults.glassIguType, defaults.glassType) : [];
  const thicknessOpts = thicknessStrings.map(t => ({ value: t, label: t }));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <PresetSelectField presetKey={presetKey} field="frameType" value={defaults.frameType} options={allFrameTypes} onChange={(v) => updateField("frameType", v)} />
      <PresetSelectField presetKey={presetKey} field="glassIguType" value={defaults.glassIguType} options={lib.iguTypeOptions} onChange={(v) => updateField("glassIguType", v)} />
      <PresetSelectField presetKey={presetKey} field="glassType" value={defaults.glassType} options={glassComboOpts} onChange={(v) => updateField("glassType", v)} />
      <PresetSelectField presetKey={presetKey} field="glassThickness" value={defaults.glassThickness} options={thicknessOpts} onChange={(v) => updateField("glassThickness", v)} />
      <PresetSelectField presetKey={presetKey} field="linerType" value={defaults.linerType} options={lib.linerOptions} onChange={(v) => updateField("linerType", v)} />
      <PresetSelectField presetKey={presetKey} field="handleType" value={defaults.handleType} options={lib.handleOptions("windows-standard")} onChange={(v) => updateField("handleType", v)} />
      <PresetSelectField presetKey={presetKey} field="lockType" value={defaults.lockType} options={lib.lockOptions} onChange={(v) => updateField("lockType", v)} />
      <div>
        <Label className="text-xs font-medium mb-1 block text-muted-foreground">{PRESET_FIELD_LABELS.wallThickness}</Label>
        <Input
          value={defaults.wallThickness !== undefined ? String(defaults.wallThickness) : ""}
          onChange={(e) => updateField("wallThickness", e.target.value === "" ? undefined : Number(e.target.value))}
          type="number"
          placeholder="Not set"
          className="h-8 text-sm"
          data-testid={`input-preset-${presetKey}-wallThickness`}
        />
      </div>
      <PresetSelectField presetKey={presetKey} field="windZone" value={defaults.windZone} options={lib.windZoneOptions} onChange={(v) => updateField("windZone", v)} />
    </div>
  );
}

function JobTypePresetsCard({ 
  divisionCode, 
  presetsConfig, 
  onPresetsChange 
}: { 
  divisionCode: string;
  presetsConfig: JobTypePresetsConfig;
  onPresetsChange: (updated: JobTypePresetsConfig) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Job Type Presets</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          These values prefill item specifics in Quote Builder when Renovation or New Build is selected. Items can still be reviewed and edited later.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="border rounded-lg p-4 space-y-3" data-testid="preset-card-renovation">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">Renovation</span>
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">renovation</span>
          </div>
          <p className="text-xs text-muted-foreground">Defaults applied for retrofit into existing frames.</p>
          <PresetFieldEditor
            presetKey="renovation"
            defaults={presetsConfig.renovation || {}}
            onChange={(updated) => onPresetsChange({ ...presetsConfig, renovation: updated })}
          />
        </div>

        <div className="border rounded-lg p-4 space-y-3" data-testid="preset-card-new_build">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">New Build</span>
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">new_build</span>
          </div>
          <p className="text-xs text-muted-foreground">Defaults applied for new construction projects.</p>
          <PresetFieldEditor
            presetKey="new_build"
            defaults={presetsConfig.new_build || {}}
            onChange={(updated) => onPresetsChange({ ...presetsConfig, new_build: updated })}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function LogoUploadField({ logoUrl, onLogoChange }: { logoUrl: string; onLogoChange: (url: string) => void }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showUrlFallback, setShowUrlFallback] = useState(false);

  const isUploadedLogo = logoUrl.startsWith("/api/drawing-images/") || logoUrl.startsWith("data:");

  useEffect(() => {
    if (!logoUrl.startsWith("/api/drawing-images/")) return;
    fetch(logoUrl)
      .then(res => res.ok ? res.blob() : Promise.reject())
      .then(blob => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }))
      .then(dataUrl => { onLogoChange(dataUrl); })
      .catch(() => {});
  }, [logoUrl]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const canvas = document.createElement("canvas");
      const img = new Image();
      const blobUrl = URL.createObjectURL(file);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = blobUrl;
      });

      const MAX_DIM = 600;
      let w = img.width;
      let h = img.height;
      if (w > MAX_DIM || h > MAX_DIM) {
        const scale = Math.min(MAX_DIM / w, MAX_DIM / h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(blobUrl);

      const dataUrl = canvas.toDataURL("image/png");
      onLogoChange(dataUrl);
      toast({ title: "Logo ready — save settings to persist" });
    } catch (err) {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div>
      <Label className="text-sm font-medium mb-1 block">Division Logo</Label>
      {logoUrl && (
        <div className="mb-2 flex items-start gap-2">
          <img
            src={logoUrl}
            alt="Division logo"
            className="max-h-16 max-w-[200px] object-contain rounded border bg-white p-1"
            data-testid="img-div-logo-preview"
          />
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-6 w-6"
            onClick={() => onLogoChange("")}
            title="Remove logo"
            data-testid="button-remove-logo"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
          data-testid="input-logo-upload"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          data-testid="button-upload-logo"
        >
          <Upload className="w-3.5 h-3.5 mr-1.5" />
          {uploading ? "Processing..." : "Upload Logo"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowUrlFallback(!showUrlFallback)}
          data-testid="button-toggle-logo-url"
        >
          {showUrlFallback ? "Hide URL" : "Enter URL instead"}
        </Button>
      </div>
      {showUrlFallback && (
        <Input
          value={isUploadedLogo ? "" : logoUrl}
          onChange={(e) => onLogoChange(e.target.value)}
          placeholder="https://..."
          className="mt-2"
          data-testid="input-div-logoUrl"
        />
      )}
    </div>
  );
}

function DivisionSettingsTab() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const [selectedCode, setSelectedCode] = useState(urlParams.get("division") || "LJ");

  const { data: div, isLoading } = useQuery<DivisionSettings>({
    queryKey: ["/api/settings/divisions", selectedCode],
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const { data: specEntries } = useQuery<SpecEntry[]>({
    queryKey: ["/api/spec-dictionary", selectedCode],
    queryFn: () => fetch(`/api/spec-dictionary?scope=${selectedCode}`).then(r => r.json()),
  });

  const [form, setForm] = useState<Partial<DivisionSettings>>({});
  const originalFormRef = useRef<Partial<DivisionSettings>>({});

  useEffect(() => {
    if (div) {
      setForm(div);
      originalFormRef.current = div;
    } else {
      setForm({});
      originalFormRef.current = {};
    }
  }, [div]);

  const mutation = useMutation({
    mutationFn: async (data: Partial<DivisionSettings>) => {
      const { divisionCode, ...payload } = data;
      const res = await apiRequest("PATCH", `/api/settings/divisions/${selectedCode}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/divisions", selectedCode] });
      toast({ title: `${selectedCode} settings saved` });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    const changed: Partial<DivisionSettings> = {};
    for (const key of Object.keys(form) as (keyof DivisionSettings)[]) {
      if (key === "divisionCode") continue;
      const currentVal = (form as any)[key];
      const originalVal = (originalFormRef.current as any)[key];
      if (JSON.stringify(currentVal) !== JSON.stringify(originalVal)) {
        if (currentVal === "" && typeof originalVal === "string" && originalVal.length > 0) continue;
        (changed as any)[key] = currentVal;
      }
    }
    if (Object.keys(changed).length === 0) {
      toast({ title: "No changes to save" });
      return;
    }
    mutation.mutate(changed);
  };

  const isJoineryDomain = (div as any)?.domainType === "joinery";

  const resolvedPresets = useMemo(() => {
    return resolvePresetsForDivision(selectedCode, form.jobTypePresetsJson as JobTypePresetsConfig | null);
  }, [selectedCode, form.jobTypePresetsJson]);

  const visibleSpecs = specEntries?.filter(e => e.customerVisibleAllowed) || [];
  const currentDefaults: string[] = (form.specDisplayDefaultsJson as string[]) || [];

  return (
    <div className="space-y-4" data-testid="division-settings-tab">
      <div className="flex gap-2 mb-4">
        {["LJ", "LE", "LL"].map((code) => (
          <Button
            key={code}
            variant={selectedCode === code ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCode(code)}
            data-testid={`button-division-${code}`}
          >
            {code}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : selectedCode === "LL" ? (
        <LLDivisionSettings
          div={div}
          form={form}
          setForm={setForm}
          handleSave={handleSave}
          isLoading={isLoading}
          mutation={mutation}
          visibleSpecs={visibleSpecs}
          currentDefaults={currentDefaults}
          selectedCode={selectedCode}
          defaultTab={urlParams.get("tab") || "division"}
        />
      ) : (
        <>
          <DivisionFormContent
            form={form}
            setForm={setForm}
            visibleSpecs={visibleSpecs}
            currentDefaults={currentDefaults}
            selectedCode={selectedCode}
            isJoineryDomain={isJoineryDomain}
            resolvedPresets={resolvedPresets}
          />

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={isLoading || mutation.isPending} data-testid="button-save-division">
              {mutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" /> Save {selectedCode} Settings</>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function DivisionFormContent({
  form, setForm, visibleSpecs, currentDefaults, selectedCode, isJoineryDomain, resolvedPresets,
}: {
  form: Partial<DivisionSettings>;
  setForm: (v: Partial<DivisionSettings> | ((prev: Partial<DivisionSettings>) => Partial<DivisionSettings>)) => void;
  visibleSpecs: SpecEntry[];
  currentDefaults: string[];
  selectedCode: string;
  isJoineryDomain?: boolean;
  resolvedPresets?: JobTypePresetsConfig;
}) {
  return (
    <>
      <div className="space-y-1 mt-2" data-testid="section-quote-presentation">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Quote Presentation</h3>
        </div>
        <p className="text-xs text-muted-foreground pl-6">
          These settings override the company quote template for this division. The base template is managed in the Template tab.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
            Inherited Company Template
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 px-3 py-2.5 bg-muted/50 border border-border rounded-md" data-testid="info-base-template">
            <span className="text-sm font-medium text-foreground">Company Master Template</span>
            <span className="text-xs text-muted-foreground bg-background border px-1.5 py-0.5 rounded font-mono">{form.templateKey || "company_master_v2"}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2 pl-0.5">
            Managed at company level. Divisions inherit this template and can override approved presentation settings below.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Division Branding</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Division-specific logo, name, and legal line used on customer quotes.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-1 block">Trading Name</Label>
            <Input
              value={form.tradingName || ""}
              onChange={(e) => setForm({ ...form, tradingName: e.target.value })}
              data-testid="input-div-tradingName"
            />
          </div>
          <LogoUploadField
            logoUrl={form.logoUrl || ""}
            onLogoChange={(url) => setForm({ ...form, logoUrl: url })}
          />
          <div>
            <Label className="text-sm font-medium mb-1 block">Required Legal Line</Label>
            <Input
              value={form.requiredLegalLine || ""}
              onChange={(e) => setForm({ ...form, requiredLegalLine: e.target.value })}
              data-testid="input-div-requiredLegalLine"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Layout Overrides</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Override how schedule items and totals are arranged on this division's quotes.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium mb-1 block">Schedule Layout</Label>
              <Select
                value={form.scheduleLayoutVariant || ""}
                onValueChange={(v) => setForm({ ...form, scheduleLayoutVariant: v })}
              >
                <SelectTrigger data-testid="select-div-scheduleLayout">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image_left_specs_right_v1">Image Left, Specs Right (v1)</SelectItem>
                  <SelectItem value="specs_only_v1">Specs Only (v1)</SelectItem>
                  <SelectItem value="image_top_specs_below_v1">Image Top, Specs Below (v1)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium mb-1 block">Totals Layout</Label>
              <Select
                value={form.totalsLayoutVariant || ""}
                onValueChange={(v) => setForm({ ...form, totalsLayoutVariant: v })}
              >
                <SelectTrigger data-testid="select-div-totalsLayout">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="totals_block_v1">Totals Block (v1)</SelectItem>
                  <SelectItem value="totals_inline_v1">Totals Inline (v1)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Theme Overrides</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Override fonts, colours, and header style for this division. Leave blank to inherit from company template.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium mb-1 block">Font Family</Label>
              <Input
                value={form.fontFamily || ""}
                onChange={(e) => setForm({ ...form, fontFamily: e.target.value })}
                placeholder="e.g. Inter, sans-serif"
                data-testid="input-div-fontFamily"
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1 block">Accent Colour</Label>
              <Input
                value={form.accentColor || ""}
                onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                placeholder="e.g. #1a5276"
                data-testid="input-div-accentColor"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium mb-1 block">Logo Position</Label>
              <Select
                value={form.logoPosition || ""}
                onValueChange={(v) => setForm({ ...form, logoPosition: v })}
              >
                <SelectTrigger data-testid="select-div-logoPosition">
                  <SelectValue placeholder="Inherit from company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Centre</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium mb-1 block">Header Variant</Label>
              <Select
                value={form.headerVariant || ""}
                onValueChange={(v) => setForm({ ...form, headerVariant: v })}
              >
                <SelectTrigger data-testid="select-div-headerVariant">
                  <SelectValue placeholder="Inherit from company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="compact">Compact</SelectItem>
                  <SelectItem value="full_width">Full Width</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Content Overrides</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Override the organisation-level text blocks for this division. Leave blank to use the company default.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-1 block">Terms Override</Label>
            <RichTextEditor
              value={form.termsOverrideBlock || ""}
              onChange={(v) => setForm(prev => ({ ...prev, termsOverrideBlock: v }))}
              rows={3}
              data-testid="input-div-termsOverrideBlock"
            />
          </div>
          <div>
            <Label className="text-sm font-medium mb-1 block">Header Notes Override</Label>
            <RichTextEditor
              value={form.headerNotesOverrideBlock || ""}
              onChange={(v) => setForm(prev => ({ ...prev, headerNotesOverrideBlock: v }))}
              rows={3}
              data-testid="input-div-headerNotesOverrideBlock"
            />
          </div>
          <div>
            <Label className="text-sm font-medium mb-1 block">Exclusions Override</Label>
            <RichTextEditor
              value={form.exclusionsOverrideBlock || ""}
              onChange={(v) => setForm(prev => ({ ...prev, exclusionsOverrideBlock: v }))}
              rows={3}
              data-testid="input-div-exclusionsOverrideBlock"
            />
          </div>
          <div>
            <Label className="text-sm font-medium mb-1 block">Additional Capabilities</Label>
            <p className="text-xs text-muted-foreground mb-2">Cross-promotes other Lateral divisions on the quote. Use **bold** for service headings and a blank line between each service block.</p>
            <RichTextEditor
              value={form.additionalCapabilitiesBlock || ""}
              onChange={(v) => setForm(prev => ({ ...prev, additionalCapabilitiesBlock: v }))}
              rows={6}
              placeholder={"Many of our clients also engage us across multiple stages.\n\n**Lateral Engineering**\nStructural steel fabrication, general engineering, repairs and custom manufacturing.\n\n**Lateral Laser Cutting**\nCNC fibre laser cutting, folded components, sheet processing and small-batch production."}
              data-testid="input-div-additionalCapabilitiesBlock"
            />
          </div>
        </CardContent>
      </Card>

      {visibleSpecs.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Spec Display Defaults</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Select which specs appear by default on customer quotes for {selectedCode}.</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {visibleSpecs.map((entry) => {
                const checked = currentDefaults.includes(entry.key);
                return (
                  <div key={entry.key} className="flex items-center gap-2">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        const isChecked = v === true;
                        const next = isChecked
                          ? [...currentDefaults, entry.key]
                          : currentDefaults.filter(k => k !== entry.key);
                        setForm({ ...form, specDisplayDefaultsJson: next });
                      }}
                      data-testid={`checkbox-spec-${entry.key}`}
                    />
                    <Label className="text-sm font-normal">{entry.label}</Label>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground" data-testid="text-spec-placeholder">
            Spec dictionary not configured for {selectedCode} yet
          </CardContent>
        </Card>
      )}

      {isJoineryDomain && resolvedPresets && (
        <>
          <Separator className="my-6" />
          <div className="space-y-1" data-testid="section-estimate-defaults">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">On-Site Estimate Defaults</h3>
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              These defaults are used in Quote Builder to prefill item specifics when Renovation or New Build is selected.
            </p>
          </div>
          <JobTypePresetsCard
            divisionCode={selectedCode}
            presetsConfig={resolvedPresets}
            onPresetsChange={(updated) => setForm({ ...form, jobTypePresetsJson: updated })}
          />
        </>
      )}
    </>
  );
}


function LLDivisionSettings({
  div, form, setForm, handleSave, isLoading, mutation, visibleSpecs, currentDefaults, selectedCode, defaultTab,
}: {
  div: DivisionSettings | undefined;
  form: Partial<DivisionSettings>;
  setForm: (v: Partial<DivisionSettings> | ((prev: Partial<DivisionSettings>) => Partial<DivisionSettings>)) => void;
  handleSave: () => void;
  isLoading: boolean;
  mutation: { isPending: boolean };
  visibleSpecs: SpecEntry[];
  currentDefaults: string[];
  selectedCode: string;
  defaultTab?: string;
}) {
  const tabMap: Record<string, string> = {
    "division": "overview",
    "pricing-governance": "pricing-model",
    "commercial-inputs": "source-costs",
  };
  const [llTab, setLlTab] = useState(tabMap[defaultTab || ""] || defaultTab || "overview");
  return (
    <div className="space-y-4" data-testid="ll-division-settings">
      <Tabs value={llTab} onValueChange={setLlTab}>
        <TabsList className="mb-4" data-testid="ll-settings-tabs">
          <TabsTrigger value="overview" data-testid="tab-ll-overview">
            <Layers className="w-3.5 h-3.5 mr-1.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="library" data-testid="tab-ll-library">
            <BookOpen className="w-3.5 h-3.5 mr-1.5" />
            Library
          </TabsTrigger>
          <TabsTrigger value="source-costs" data-testid="tab-ll-source-costs">
            <Receipt className="w-3.5 h-3.5 mr-1.5" />
            Source Costs
          </TabsTrigger>
          <TabsTrigger value="pricing-model" data-testid="tab-ll-pricing-model">
            <Cpu className="w-3.5 h-3.5 mr-1.5" />
            Pricing Model
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900" data-testid="ll-overview-header">
            <CardContent className="py-4">
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300">Lateral Laser — Enterprise Administration</h4>
                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                      LL administration is separated into three governed domains. Each domain has explicit ownership and does not duplicate truth held by another.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  <div className="rounded border border-blue-200 dark:border-blue-800 bg-white dark:bg-blue-950/30 p-2.5" data-testid="ll-overview-library-card">
                    <div className="flex items-center gap-1.5 mb-1">
                      <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">Library</span>
                    </div>
                    <p className="text-[11px] text-blue-700 dark:text-blue-400">Material families, grades, finishes, thicknesses, sheet sizes, and supplier material records.</p>
                  </div>
                  <div className="rounded border border-blue-200 dark:border-blue-800 bg-white dark:bg-blue-950/30 p-2.5" data-testid="ll-overview-source-costs-card">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Receipt className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">Source Costs</span>
                    </div>
                    <p className="text-[11px] text-blue-700 dark:text-blue-400">Supplier-backed gas and consumable cost records with governed approval lifecycle.</p>
                  </div>
                  <div className="rounded border border-blue-200 dark:border-blue-800 bg-white dark:bg-blue-950/30 p-2.5" data-testid="ll-overview-pricing-model-card">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Cpu className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">Pricing Model</span>
                    </div>
                    <p className="text-[11px] text-blue-700 dark:text-blue-400">Approved pricing rules, process rates, markup policy, and costing logic for estimates and quotes.</p>
                  </div>
                </div>
                <div className="pt-2 border-t border-blue-200 dark:border-blue-800">
                  <h4 className="text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wide mb-1">Data Flow</h4>
                  <p className="text-[11px] text-blue-700 dark:text-blue-400">
                    Library + Source Costs + Pricing Model → Estimate Builder → Quote. The estimate builder does not own independent pricing truth.
                  </p>
                </div>
                <div className="pt-2 border-t border-blue-200 dark:border-blue-800">
                  <h4 className="text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wide mb-1">Precedence</h4>
                  <ol className="text-[11px] text-blue-700 dark:text-blue-400 space-y-0.5 list-decimal pl-4">
                    <li><strong>Source Costs</strong> govern gas and consumable source-cost truth (supplier-backed)</li>
                    <li><strong>Pricing Model</strong> governs costing policy, rates, markup, and commercial rules</li>
                    <li><strong>Library</strong> governs material/sheet selection and material cost</li>
                    <li><strong>Fallback</strong> only if no active governed data is present (pricing model embedded values)</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>

          <DivisionFormContent
            form={form}
            setForm={setForm}
            visibleSpecs={visibleSpecs}
            currentDefaults={currentDefaults}
            selectedCode={selectedCode}
          />

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={isLoading || mutation.isPending} data-testid="button-save-division">
              {mutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" /> Save LL Settings</>
              )}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="library" className="space-y-4">
          <LLLibraryTab />
        </TabsContent>

        <TabsContent value="source-costs" className="space-y-4">
          <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10 dark:border-amber-900 mb-4" data-testid="ll-source-costs-header">
            <CardContent className="py-3">
              <div className="flex items-start gap-2">
                <Receipt className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wide">Source Costs</h4>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    Supplier-backed source cost records for gas and consumables. These governed records provide the cost truth used by the pricing engine. They are not library material records and do not own pricing policy.
                  </p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-1">
                    <strong>Package selection policy:</strong> When multiple active packages exist for the same gas type, the system currently selects the lowest-cost package automatically. This is a temporary bounded rule — not final enterprise logic.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <LLCommercialInputsPage embedded />
        </TabsContent>

        <TabsContent value="pricing-model" className="space-y-4">
          <Card className="border-green-200 bg-green-50/30 dark:bg-green-950/10 dark:border-green-900 mb-4" data-testid="ll-pricing-model-header">
            <CardContent className="py-3">
              <div className="flex items-start gap-2">
                <Cpu className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-xs font-semibold text-green-800 dark:text-green-300 uppercase tracking-wide">Pricing Model</h4>
                  <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                    Approved pricing rules and costing policy used by LL estimates and quotes. Owns machine profiles, process rates, labour/shop rates, markup, minimums, nesting defaults, and expedite tiers. Gas and consumable cost values embedded in profiles are fallback only — active Source Costs take precedence.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <LLPricingProfilesPage embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LLLibraryTab() {
  const { data: materials = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/ll-sheet-materials"],
  });
  const navigate = (path: string) => { window.location.href = path; };

  const families = [...new Set(materials.map((m: any) => m.materialFamily))].sort();
  const activeMaterials = materials.filter((m: any) => m.isActive !== false);

  return (
    <>
      <Card className="border-indigo-200 bg-indigo-50/30 dark:bg-indigo-950/10 dark:border-indigo-900 mb-4" data-testid="ll-library-header">
        <CardContent className="py-3">
          <div className="flex items-start gap-2">
            <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-xs font-semibold text-indigo-800 dark:text-indigo-300 uppercase tracking-wide">Library</h4>
              <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-0.5">
                Operational master data used for material and sheet selection. Owns material families, grades, finishes, thicknesses, sheet sizes, and supplier material records. Does not own gas/consumable source costs or pricing policy.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="ll-library-summary">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Sheet Materials Summary</span>
            <Badge variant="outline" className="text-[10px]">{activeMaterials.length} active records</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading materials...
            </div>
          ) : families.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No sheet materials configured. Add materials via the Library page.</p>
          ) : (
            <div className="space-y-3">
              {families.map(fam => {
                const famMats = materials.filter((m: any) => m.materialFamily === fam);
                const grades = [...new Set(famMats.map((m: any) => m.grade))];
                const thicknesses = [...new Set(famMats.map((m: any) => m.thickness))].sort((a: string, b: string) => parseFloat(a) - parseFloat(b));
                return (
                  <div key={fam} className="rounded border p-2.5" data-testid={`ll-library-family-${fam.toLowerCase().replace(/\s+/g, '-')}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold">{fam}</span>
                      <Badge variant="secondary" className="text-[10px]">{famMats.length} sheets</Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground space-y-0.5">
                      <div>Grades: {grades.join(", ")}</div>
                      <div>Thicknesses: {thicknesses.map((t: string) => `${t}mm`).join(", ")}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="pt-3 border-t mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/library")}
              data-testid="button-open-library"
            >
              <BookOpen className="w-3.5 h-3.5 mr-1.5" />
              Open Full Library
            </Button>
            <p className="text-[10px] text-muted-foreground mt-1">
              Full material CRUD, supplier records, and sheet management are available in the Library page.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function LLPricingSettingsViewer({ settings }: { settings: LLPricingSettings | null }) {
  if (!settings) {
    return (
      <Card data-testid="ll-pricing-settings-empty">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No LL pricing settings configured. Settings will be seeded on next server restart.
        </CardContent>
      </Card>
    );
  }

  const defaultMachine = settings.machineProfiles.find(m => m.isDefault && m.isActive) || settings.machineProfiles[0];
  const gasTypeLabel = (g: string) => {
    if (g === "O2") return "Oxygen (O₂)";
    if (g === "N2") return "Nitrogen (N₂)";
    return "Compressed Air";
  };

  const materialFamilies = [...new Set(settings.processRateTables.map(r => r.materialFamily))].sort();

  return (
    <div className="space-y-4" data-testid="ll-pricing-settings-viewer">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">LL Pricing Settings</h3>
          <Badge variant="outline" className="text-[10px]">Read-Only</Badge>
        </div>
        <p className="text-xs text-muted-foreground pl-6">
          Division-level pricing configuration for Lateral Laser. These values are used by the LL pricing engine.
          Values shown are initial architecture activation defaults — not yet business-approved production truth.
        </p>
      </div>

      <Card data-testid="ll-settings-machine-profile">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-muted-foreground" />
            Default Machine Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {defaultMachine ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <div className="text-muted-foreground">Name</div>
              <div className="font-medium" data-testid="text-machine-name">{defaultMachine.name}</div>
              <div className="text-muted-foreground">Bed Size</div>
              <div>{defaultMachine.bedLengthMm} × {defaultMachine.bedWidthMm} mm</div>
              <div className="text-muted-foreground">Usable Area</div>
              <div data-testid="text-machine-usable-area">{defaultMachine.usableLengthMm} × {defaultMachine.usableWidthMm} mm</div>
              <div className="text-muted-foreground">Hourly Rate</div>
              <div data-testid="text-machine-hourly-rate">${defaultMachine.hourlyMachineRate.toFixed(2)}/hr</div>
              <div className="text-muted-foreground">Max Thickness</div>
              <div className="text-xs">
                {Object.entries(defaultMachine.maxThicknessByMaterialFamily).map(([fam, t]) => (
                  <span key={fam} className="inline-block mr-3">{fam}: {t}mm</span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No machine profile configured</p>
          )}
        </CardContent>
      </Card>

      <Card data-testid="ll-settings-process-rates">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            Process Rate Tables ({settings.processRateTables.length} entries)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {materialFamilies.map(fam => {
              const entries = settings.processRateTables.filter(r => r.materialFamily === fam);
              return (
                <div key={fam}>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">{fam} ({entries.length} thicknesses)</p>
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-1 pr-3 font-medium text-muted-foreground">Thick.</th>
                          <th className="text-right py-1 pr-3 font-medium text-muted-foreground">Cut Speed</th>
                          <th className="text-right py-1 pr-3 font-medium text-muted-foreground">Pierce</th>
                          <th className="text-left py-1 pr-3 font-medium text-muted-foreground">Gas</th>
                          <th className="text-right py-1 font-medium text-muted-foreground">Gas L/min</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map(e => (
                          <tr key={`${fam}-${e.thickness}`} className="border-b border-border/50">
                            <td className="py-0.5 pr-3">{e.thickness}mm</td>
                            <td className="py-0.5 pr-3 text-right">{e.cutSpeedMmPerMin.toLocaleString()} mm/min</td>
                            <td className="py-0.5 pr-3 text-right">{e.pierceTimeSec}s</td>
                            <td className="py-0.5 pr-3">{gasTypeLabel(e.assistGasType)}</td>
                            <td className="py-0.5 text-right">{e.gasConsumptionLPerMin}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card data-testid="ll-settings-gas-costs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Gas Costs <Badge variant="outline" className="ml-2 text-[9px] text-blue-600 border-blue-300">Fallback — governed by Commercial Inputs</Badge></CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Oxygen (O₂)</span><span>${settings.gasCosts.o2PricePerLitre.toFixed(4)}/L</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Nitrogen (N₂)</span><span>${settings.gasCosts.n2PricePerLitre.toFixed(4)}/L</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Compressed Air</span><span>${settings.gasCosts.compressedAirPricePerLitre.toFixed(4)}/L</span></div>
          </CardContent>
        </Card>

        <Card data-testid="ll-settings-consumables">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Consumables & Labour <Badge variant="outline" className="ml-2 text-[9px] text-blue-600 border-blue-300">Consumables governed by Commercial Inputs</Badge></CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Consumables</span><span>${settings.consumableCosts.consumableCostPerMachineHour.toFixed(2)}/hr</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Operator Rate</span><span>${settings.labourRates.operatorRatePerHour.toFixed(2)}/hr</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Shop Rate</span><span>${settings.labourRates.shopRatePerHour.toFixed(2)}/hr</span></div>
          </CardContent>
        </Card>

        <Card data-testid="ll-settings-defaults">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Setup & Handling Defaults</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Setup Time</span><span>{settings.setupHandlingDefaults.defaultSetupMinutes} min</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Handling Time</span><span>{settings.setupHandlingDefaults.defaultHandlingMinutes} min</span></div>
          </CardContent>
        </Card>

        <Card data-testid="ll-settings-commercial">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Commercial Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Default Markup</span><span>{settings.commercialPolicy.defaultMarkupPercent}%</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Min Material Charge</span><span>${settings.commercialPolicy.minimumMaterialCharge.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Min Line Charge</span><span>${settings.commercialPolicy.minimumLineCharge.toFixed(2)}</span></div>
            {settings.commercialPolicy.defaultRatePerMmCut != null && (
              <div className="flex justify-between"><span className="text-muted-foreground">Rate per mm Cut</span><span>${settings.commercialPolicy.defaultRatePerMmCut.toFixed(4)}/mm</span></div>
            )}
            {settings.commercialPolicy.defaultRatePerPierce != null && (
              <div className="flex justify-between"><span className="text-muted-foreground">Rate per Pierce</span><span>${settings.commercialPolicy.defaultRatePerPierce.toFixed(2)}/pierce</span></div>
            )}
            {settings.commercialPolicy.expediteTiers.length > 0 && (
              <div className="mt-2 pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-1">Expedite Tiers</p>
                {settings.commercialPolicy.expediteTiers.map(t => (
                  <div key={t.key} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{t.label}</span>
                    <span>{t.upliftPercent > 0 ? `+${t.upliftPercent}%` : "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="ll-settings-nesting">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Nesting Defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Kerf Width</span><span>{settings.nestingDefaults.kerfWidthMm}mm</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Part Gap</span><span>{settings.nestingDefaults.partGapMm}mm</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Edge Trim</span><span>{settings.nestingDefaults.edgeTrimMm}mm</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Default Utilisation</span><span>{(settings.nestingDefaults.defaultUtilisationFactor * 100).toFixed(0)}%</span></div>
          </div>
        </CardContent>
      </Card>

      <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md" data-testid="ll-settings-disclaimer">
        <p className="text-xs text-amber-800 dark:text-amber-200">
          <strong>Note:</strong> These are initial architecture activation defaults seeded for Phase 3A.
          All values are approximate and must be reviewed against actual Lateral Laser machine specifications,
          supplier gas pricing, and operational rates before production use.
          A full settings editor will be available in Phase 3F.
        </p>
      </div>
    </div>
  );
}

const SECTION_LABELS: Record<string, string> = {
  header: "Header",
  disclaimer: "Disclaimer",
  customerProject: "Customer & Project",
  totals: "Quote Summary",
  schedule: "Schedule of Items",
  legal: "Terms & Conditions",
  acceptance: "Acceptance",
};

const SECTION_DESCRIPTIONS: Record<string, string> = {
  header: "Company branding, trading name, legal line, contact details",
  disclaimer: "Preliminary estimate notice shown below the header",
  customerProject: "Customer name and project address block",
  totals: "Quote summary with cost breakdown",
  schedule: "Individual item cards with specs and drawings",
  legal: "Terms, exclusions, payment terms, and bank details",
  acceptance: "Signature block for customer acceptance",
};

function TemplateSchematicPreview({ config }: { config: CompanyTemplateConfig }) {
  const resolved = useMemo(() => applyCompanyConfig(config), [config]);

  const visibleSections = resolved.sections.filter(s => s.visible);

  return (
    <div className="border rounded-lg p-3 bg-white" data-testid="template-schematic-preview">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-medium">Live Layout Preview</p>
      <div className="space-y-1">
        {visibleSections.map((section) => {
          const isAccent = section.key === "header" || section.key === "acceptance";
          return (
            <div
              key={section.key}
              className="rounded px-2 py-1.5 text-[11px] font-medium flex items-center justify-between"
              style={{
                backgroundColor: isAccent ? resolved.colors.accent + "18" : resolved.colors.bgMuted,
                borderLeft: `3px solid ${isAccent ? resolved.colors.accent : resolved.colors.border}`,
                color: resolved.colors.bodyText,
              }}
            >
              <span>{SECTION_LABELS[section.key] || section.key}</span>
              {section.key === "schedule" && (
                <span className="text-[9px] opacity-60">
                  {resolved.itemLayout.scheduleLayoutVariant === "image_left_specs_right_v1" ? "Image + Specs" :
                   resolved.itemLayout.scheduleLayoutVariant === "specs_only_v1" ? "Specs Only" : "Image Top"}
                </span>
              )}
              {section.key === "totals" && (
                <span className="text-[9px] opacity-60">
                  {resolved.itemLayout.totalsLayoutVariant === "totals_block_v1" ? "Block" : "Inline"}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 pt-2 border-t flex gap-3 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: resolved.colors.accent }} />
          <span>Accent</span>
        </div>
        <span>Spacing: {config.spacingPreset || "standard"}</span>
        <span>Type: {config.typographyPreset || "standard"}</span>
      </div>
    </div>
  );
}

function TemplateBuilderTab() {
  const { toast } = useToast();
  const { data: savedConfig, isLoading } = useQuery<CompanyTemplateConfig>({
    queryKey: ["/api/settings/template"],
  });

  const [config, setConfig] = useState<CompanyTemplateConfig>({});

  useEffect(() => {
    if (savedConfig) {
      setConfig(savedConfig);
    }
  }, [savedConfig]);

  const sections: TemplateSectionDef[] = config.sections || COMPANY_MASTER_TEMPLATE.sections;
  const resolvedForSliders = useMemo(() => applyCompanyConfig(config), [config]);

  const toggleSection = (key: string) => {
    const updated = sections.map(s => s.key === key ? { ...s, visible: !s.visible } : s);
    setConfig({ ...config, sections: updated });
  };

  const mutation = useMutation({
    mutationFn: async (data: CompanyTemplateConfig) => {
      const res = await apiRequest("PATCH", "/api/settings/template", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/template"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/org"] });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key.length >= 1 && typeof key[0] === "string" && key[0].startsWith("/api/quotes");
        },
      });
      toast({ title: "Template configuration saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save template", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => mutation.mutate(config);

  const handleReset = () => {
    setConfig({});
    toast({ title: "Reset to defaults — save to apply" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="template-builder-tab">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Company master template controls the structure and presentation of all quotes. Divisions can override branding and layout options in Division settings.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Header & Branding</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Controls the company header layout on quotes and PDFs</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-1 block">Logo Scale</Label>
                <p className="text-xs text-muted-foreground mb-2">Sets the prominence of your company logo — the logo is the primary brand element</p>
                <Select
                  value={config.logoScale || "large"}
                  onValueChange={(v) => setConfig({ ...config, logoScale: v as LogoScale })}
                >
                  <SelectTrigger data-testid="select-template-logoScale">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small — minimal logo footprint</SelectItem>
                    <SelectItem value="standard">Standard — balanced logo presence</SelectItem>
                    <SelectItem value="large">Large — strong brand presence (recommended)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-1 block">Logo Width (mm)</Label>
                <p className="text-xs text-muted-foreground mb-2">Fine-tune logo width independently — overrides scale preset</p>
                <div className="flex items-center gap-3">
                  <Slider
                    min={10} max={120} step={2}
                    value={[config.logoWidthMm ?? COMPANY_MASTER_TEMPLATE.header.logoWidthMm]}
                    onValueChange={([v]) => setConfig({ ...config, logoWidthMm: v })}
                    className="flex-1"
                    data-testid="slider-logoWidthMm"
                  />
                  <span className="text-sm text-muted-foreground w-12 text-right font-mono">{config.logoWidthMm ?? COMPANY_MASTER_TEMPLATE.header.logoWidthMm}mm</span>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium mb-1 block">Logo Max Height (mm)</Label>
                <p className="text-xs text-muted-foreground mb-2">Limits logo height to prevent oversized headers</p>
                <div className="flex items-center gap-3">
                  <Slider
                    min={5} max={60} step={1}
                    value={[config.logoMaxHeightMm ?? COMPANY_MASTER_TEMPLATE.header.logoMaxHeightMm]}
                    onValueChange={([v]) => setConfig({ ...config, logoMaxHeightMm: v })}
                    className="flex-1"
                    data-testid="slider-logoMaxHeightMm"
                  />
                  <span className="text-sm text-muted-foreground w-12 text-right font-mono">{config.logoMaxHeightMm ?? COMPANY_MASTER_TEMPLATE.header.logoMaxHeightMm}mm</span>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between py-1.5">
                <div>
                  <p className="text-sm font-medium">Show Company Name</p>
                  <p className="text-xs text-muted-foreground">Display the trading name as text next to the logo — off if logo contains company name</p>
                </div>
                <Switch
                  checked={config.showTradingName === true}
                  onCheckedChange={(v) => setConfig({ ...config, showTradingName: v })}
                  data-testid="switch-showTradingName"
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-1 block">Legal Line Placement</Label>
                <p className="text-xs text-muted-foreground mb-2">Where the legal/registration line appears relative to the logo</p>
                <Select
                  value={config.legalLinePlacement || "under_logo"}
                  onValueChange={(v) => setConfig({ ...config, legalLinePlacement: v as LegalLinePlacement })}
                >
                  <SelectTrigger data-testid="select-template-legalLinePlacement">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="under_logo">Under Logo — legal line below the logo (recommended)</SelectItem>
                    <SelectItem value="beside_logo">Beside Logo — next to logo/company name</SelectItem>
                    <SelectItem value="hidden">Hidden — do not show legal line</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-1 block">Contact Block</Label>
                <p className="text-xs text-muted-foreground mb-2">Controls how compact the address/phone/email block appears</p>
                <Select
                  value={config.contactBlockAlignment || COMPANY_MASTER_TEMPLATE.header.contactBlockAlignment}
                  onValueChange={(v) => setConfig({ ...config, contactBlockAlignment: v as ContactBlockAlignment })}
                >
                  <SelectTrigger data-testid="select-template-contactBlockAlignment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="right">Standard — right-aligned contact details</SelectItem>
                    <SelectItem value="stacked_right">Stacked — right-aligned, slightly larger text</SelectItem>
                    <SelectItem value="compact_right">Compact — smaller text, tighter spacing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-1 block">Header Bottom Spacing (mm)</Label>
                <p className="text-xs text-muted-foreground mb-2">Space between the header and the next section</p>
                <div className="flex items-center gap-3">
                  <Slider
                    min={0} max={20} step={1}
                    value={[config.headerBottomSpacingMm ?? COMPANY_MASTER_TEMPLATE.header.headerBottomSpacingMm]}
                    onValueChange={([v]) => setConfig({ ...config, headerBottomSpacingMm: v })}
                    className="flex-1"
                    data-testid="slider-headerBottomSpacingMm"
                  />
                  <span className="text-sm text-muted-foreground w-12 text-right font-mono">{config.headerBottomSpacingMm ?? COMPANY_MASTER_TEMPLATE.header.headerBottomSpacingMm}mm</span>
                </div>
              </div>
              <Separator />
              <div>
                <Label className="text-sm font-medium mb-1 block">Document Type</Label>
                <p className="text-xs text-muted-foreground mb-2">Sets the document title and terminology used throughout</p>
                <Select
                  value={config.documentMode || "standard"}
                  onValueChange={(v) => setConfig({ ...config, documentMode: v as DocumentMode })}
                >
                  <SelectTrigger data-testid="select-template-documentMode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Quotation — standard quote document</SelectItem>
                    <SelectItem value="tender">Tender — formal tender document</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Sections</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Show or hide document sections. Order is fixed by template design.</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {sections.map((section) => (
                <div key={section.key} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{SECTION_LABELS[section.key] || section.key}</p>
                    <p className="text-xs text-muted-foreground">{SECTION_DESCRIPTIONS[section.key]}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {section.visible ? (
                      <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    <Switch
                      checked={section.visible}
                      onCheckedChange={() => toggleSection(section.key)}
                      data-testid={`switch-section-${section.key}`}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-1 block">Totals Layout</Label>
                <p className="text-xs text-muted-foreground mb-2">Default totals block layout for the quote summary section</p>
                <Select
                  value={config.totalsLayoutVariant || "totals_block_v1"}
                  onValueChange={(v) => setConfig({ ...config, totalsLayoutVariant: v as TotalsLayoutVariant })}
                >
                  <SelectTrigger data-testid="select-template-totalsLayout">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="totals_block_v1">Totals Block — bordered summary box</SelectItem>
                    <SelectItem value="totals_inline_v1">Totals Inline — flat line items</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-1 block">Content Density</Label>
                <p className="text-xs text-muted-foreground mb-2">Base preset for items per page — granular controls below can fine-tune further</p>
                <Select
                  value={config.densityPreset || "standard"}
                  onValueChange={(v) => {
                    const { drawingMaxHeightMm, photoMaxHeightMm, specRowHeightMm, itemHeaderHeightMm, itemCardPaddingMm, itemCardGapMm, ...rest } = config;
                    setConfig({ ...rest, densityPreset: v as DensityPreset });
                  }}
                >
                  <SelectTrigger data-testid="select-template-densityPreset">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comfortable">Comfortable — ~3 items/page, generous spacing</SelectItem>
                    <SelectItem value="standard">Standard — ~4 items/page, professional density (recommended)</SelectItem>
                    <SelectItem value="compact">Compact — ~5 items/page, maximum information density</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div>
                <Label className="text-sm font-medium mb-1 block">Schedule Layout</Label>
                <p className="text-xs text-muted-foreground mb-2">Default layout for item cards in the schedule section</p>
                <Select
                  value={config.scheduleLayoutVariant || "image_left_specs_right_v1"}
                  onValueChange={(v) => setConfig({ ...config, scheduleLayoutVariant: v as ScheduleLayoutVariant })}
                >
                  <SelectTrigger data-testid="select-template-scheduleLayout">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image_left_specs_right_v1">Image Left, Specs Right — side by side</SelectItem>
                    <SelectItem value="specs_only_v1">Specs Only — no drawing image</SelectItem>
                    <SelectItem value="image_top_specs_below_v1">Image Top, Specs Below — stacked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-1 block">Photo Size</Label>
                <p className="text-xs text-muted-foreground mb-2">Maximum size for site photos — affects both preview and PDF</p>
                <Select
                  value={config.photoSizePreset || "medium"}
                  onValueChange={(v) => setConfig({ ...config, photoSizePreset: v as PhotoSizePreset })}
                >
                  <SelectTrigger data-testid="select-template-photoSize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small — 15mm max</SelectItem>
                    <SelectItem value="medium">Medium — 20mm max (recommended)</SelectItem>
                    <SelectItem value="large">Large — 35mm max</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Granular Size Controls</p>
              <p className="text-xs text-muted-foreground -mt-2">Fine-tune individual element sizes. These override the density preset values.</p>
              <div>
                <Label className="text-sm font-medium mb-1 block">Drawing Max Height (mm)</Label>
                <div className="flex items-center gap-3">
                  <Slider
                    min={15} max={80} step={1}
                    value={[config.drawingMaxHeightMm ?? resolvedForSliders.density.drawingMaxH]}
                    onValueChange={([v]) => setConfig({ ...config, drawingMaxHeightMm: v })}
                    className="flex-1"
                    data-testid="slider-drawingMaxHeightMm"
                  />
                  <span className="text-sm text-muted-foreground w-12 text-right font-mono">{config.drawingMaxHeightMm ?? resolvedForSliders.density.drawingMaxH}mm</span>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium mb-1 block">Photo Row Height (mm)</Label>
                <div className="flex items-center gap-3">
                  <Slider
                    min={10} max={60} step={1}
                    value={[config.photoMaxHeightMm ?? resolvedForSliders.density.photoRowH]}
                    onValueChange={([v]) => setConfig({ ...config, photoMaxHeightMm: v })}
                    className="flex-1"
                    data-testid="slider-photoMaxHeightMm"
                  />
                  <span className="text-sm text-muted-foreground w-12 text-right font-mono">{config.photoMaxHeightMm ?? resolvedForSliders.density.photoRowH}mm</span>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium mb-1 block">Spec Row Height (mm)</Label>
                <div className="flex items-center gap-3">
                  <Slider
                    min={2} max={8} step={0.5}
                    value={[config.specRowHeightMm ?? resolvedForSliders.density.specRowH]}
                    onValueChange={([v]) => setConfig({ ...config, specRowHeightMm: v })}
                    className="flex-1"
                    data-testid="slider-specRowHeightMm"
                  />
                  <span className="text-sm text-muted-foreground w-12 text-right font-mono">{config.specRowHeightMm ?? resolvedForSliders.density.specRowH}mm</span>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium mb-1 block">Item Card Padding (mm)</Label>
                <div className="flex items-center gap-3">
                  <Slider
                    min={1} max={10} step={0.5}
                    value={[config.itemCardPaddingMm ?? resolvedForSliders.density.itemCardPadMm]}
                    onValueChange={([v]) => setConfig({ ...config, itemCardPaddingMm: v })}
                    className="flex-1"
                    data-testid="slider-itemCardPaddingMm"
                  />
                  <span className="text-sm text-muted-foreground w-12 text-right font-mono">{config.itemCardPaddingMm ?? resolvedForSliders.density.itemCardPadMm}mm</span>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium mb-1 block">Item Card Gap (mm)</Label>
                <div className="flex items-center gap-3">
                  <Slider
                    min={1} max={10} step={0.5}
                    value={[config.itemCardGapMm ?? resolvedForSliders.density.itemGapMm]}
                    onValueChange={([v]) => setConfig({ ...config, itemCardGapMm: v })}
                    className="flex-1"
                    data-testid="slider-itemCardGapMm"
                  />
                  <span className="text-sm text-muted-foreground w-12 text-right font-mono">{config.itemCardGapMm ?? resolvedForSliders.density.itemGapMm}mm</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Theme & Spacing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-1 block">Default Accent Colour</Label>
                <p className="text-xs text-muted-foreground mb-2">Company default — divisions can override this in their settings</p>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={config.accentColor || COMPANY_MASTER_TEMPLATE.colors.accent}
                    onChange={(e) => setConfig({ ...config, accentColor: e.target.value })}
                    className="w-10 h-8 rounded border cursor-pointer"
                    data-testid="input-template-accentColor"
                  />
                  <Input
                    value={config.accentColor || COMPANY_MASTER_TEMPLATE.colors.accent}
                    onChange={(e) => setConfig({ ...config, accentColor: e.target.value })}
                    placeholder="#374151"
                    className="w-32 font-mono text-sm"
                    data-testid="input-template-accentColorText"
                  />
                  {config.accentColor && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { const { accentColor, ...rest } = config; setConfig(rest); }}
                      data-testid="button-reset-accent"
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>
              <Separator />
              <div>
                <Label className="text-sm font-medium mb-1 block">Typography Scale</Label>
                <p className="text-xs text-muted-foreground mb-2">Controls text sizes in the PDF export — affects headings, body text, and totals</p>
                <Select
                  value={config.typographyPreset || "standard"}
                  onValueChange={(v) => setConfig({ ...config, typographyPreset: v as TypographyPreset })}
                >
                  <SelectTrigger data-testid="select-template-typography">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small — compact text, more content per page</SelectItem>
                    <SelectItem value="standard">Standard — balanced readability</SelectItem>
                    <SelectItem value="large">Large — emphasis on readability</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-1 block">Section Spacing</Label>
                <p className="text-xs text-muted-foreground mb-2">Controls whitespace between document sections — affects both preview and PDF</p>
                <Select
                  value={config.spacingPreset || "standard"}
                  onValueChange={(v) => setConfig({ ...config, spacingPreset: v as SpacingPreset })}
                >
                  <SelectTrigger data-testid="select-template-spacing">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compact">Compact — tighter spacing, more content per page</SelectItem>
                    <SelectItem value="standard">Standard — balanced layout</SelectItem>
                    <SelectItem value="spacious">Spacious — more breathing room</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="hidden lg:block">
          <div className="sticky top-4">
            <TemplateSchematicPreview config={config} />
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={handleReset} data-testid="button-reset-template">
          <RotateCcw className="w-4 h-4 mr-2" /> Reset to Defaults
        </Button>
        <Button onClick={handleSave} disabled={mutation.isPending} data-testid="button-save-template">
          {mutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
          ) : (
            <><Save className="w-4 h-4 mr-2" /> Save Template</>
          )}
        </Button>
      </div>
    </div>
  );
}

type GovernanceSummary = {
  estimates: Array<{ id: string; name: string; isDemoRecord: boolean; archivedAt: string | null; createdAt: string }>;
  quotes: Array<{ id: string; number: string; customer: string; status: string; isDemoRecord: boolean; archivedAt: string | null; _chain: { opJob: { id: string; jobNumber: string; isDemoRecord: boolean; archivedAt: string | null } | null; invoiceCount: number; xeroLinkedInvoiceCount: number; xeroLinkedNumbers: string[] } }>;
  opJobs: Array<{ id: string; jobNumber: string; title: string; isDemoRecord: boolean; archivedAt: string | null; _chain: { sourceQuote: { id: string; number: string; isDemoRecord: boolean } | null } }>;
  projects: Array<{ id: string; name: string; isDemoRecord: boolean; archivedAt: string | null; createdAt: string }>;
  invoices: Array<{ id: string; number: string; type: string; status: string; amountInclGst: number | null; isDemoRecord: boolean; _xeroLinked: boolean; _xeroNumber: string | null }>;
  counts: { estimates: number; quotes: number; opJobs: number; projects: number; invoices: number };
};

type EnvInfo = {
  nodeEnv: string;
  instanceLabel: string;
  isReplitDeployment: boolean;
  isReplitWorkspace: boolean;
  databaseConnected: boolean;
};

function NumberingTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "owner";

  const { data: org, isLoading: orgLoading } = useQuery<OrgSettings>({
    queryKey: ["/api/settings/org"],
  });

  const { data: sequences, isLoading: seqLoading } = useQuery<{ id: string; currentValue: number }[]>({
    queryKey: ["/api/admin/number-sequences"],
    enabled: isAdmin,
  });

  const [quotePrefix, setQuotePrefix] = useState("");
  const [quoteDivSuffix, setQuoteDivSuffix] = useState(false);
  const [jobPrefix, setJobPrefix] = useState("");
  const [jobDivSuffix, setJobDivSuffix] = useState(false);
  const [invoicePrefix, setInvoicePrefix] = useState("");
  const [quoteNext, setQuoteNext] = useState("");
  const [jobNext, setJobNext] = useState("");
  const [invoiceNext, setInvoiceNext] = useState("");

  useEffect(() => {
    if (org) {
      setQuotePrefix(org.quoteNumberPrefix || "Q");
      setQuoteDivSuffix(org.quoteNumberUseDivisionSuffix ?? false);
      setJobPrefix(org.jobNumberPrefix || "J");
      setJobDivSuffix(org.jobNumberUseDivisionSuffix ?? false);
      setInvoicePrefix(org.invoiceNumberPrefix || "INV");
    }
  }, [org]);

  useEffect(() => {
    if (sequences) {
      const qSeq = sequences.find(s => s.id === "quote");
      const jSeq = sequences.find(s => s.id === "op_job");
      const iSeq = sequences.find(s => s.id === "invoice");
      if (qSeq) setQuoteNext(String(qSeq.currentValue + 1));
      if (jSeq) setJobNext(String(jSeq.currentValue + 1));
      if (iSeq) setInvoiceNext(String(iSeq.currentValue + 1));
    }
  }, [sequences]);

  const prefixMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/settings/org", {
        quoteNumberPrefix: quotePrefix || "Q",
        quoteNumberUseDivisionSuffix: quoteDivSuffix,
        jobNumberPrefix: jobPrefix || "J",
        jobNumberUseDivisionSuffix: jobDivSuffix,
        invoiceNumberPrefix: invoicePrefix || "INV",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/org"] });
      toast({ title: "Numbering prefix settings saved" });
    },
    onError: (err: Error) => toast({ title: "Failed to save", description: err.message, variant: "destructive" }),
  });

  const seqMutation = useMutation({
    mutationFn: async ({ id, nextValue }: { id: string; nextValue: number }) => {
      const res = await apiRequest("PATCH", `/api/admin/number-sequences/${id}`, { nextValue });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/number-sequences"] });
      toast({ title: "Next number updated" });
    },
    onError: (err: Error) => toast({ title: "Failed to update", description: err.message, variant: "destructive" }),
  });

  const handleSetNext = (id: string, rawValue: string) => {
    const v = parseInt(rawValue, 10);
    if (isNaN(v) || v < 1) {
      toast({ title: "Next number must be a whole number ≥ 1", variant: "destructive" });
      return;
    }
    seqMutation.mutate({ id, nextValue: v });
  };

  const quotePreview = quotePrefix
    ? `${quotePrefix}-${String(parseInt(quoteNext || "1")).padStart(4, "0")}${quoteDivSuffix ? "-LJ" : ""}`
    : "";
  const jobPreview = jobPrefix
    ? `${jobPrefix}-${String(parseInt(jobNext || "1")).padStart(4, "0")}${jobDivSuffix ? "-LJ" : ""}`
    : "";
  const invoicePreview = invoicePrefix
    ? `${invoicePrefix}-${String(parseInt(invoiceNext || "1")).padStart(4, "0")}`
    : "";

  if (!isAdmin) {
    return (
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        Numbering settings are admin-only.
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="numbering-tab">
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3 flex gap-2 text-sm text-amber-800 dark:text-amber-300">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>Changes apply to future records only. Historical records are not renumbered. All changes are audit-logged.</span>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quote / Document Numbering</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Controls the prefix for customer-facing document numbers (e.g. Q-0135, SE-0135).</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium mb-1 block">Prefix</Label>
              <Input
                value={quotePrefix}
                onChange={(e) => setQuotePrefix(e.target.value)}
                placeholder="Q"
                className="w-24"
                data-testid="input-quote-number-prefix"
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex items-center gap-2 pb-1">
                <Switch
                  checked={quoteDivSuffix}
                  onCheckedChange={setQuoteDivSuffix}
                  data-testid="switch-quote-division-suffix"
                />
                <Label className="text-sm">Add division suffix (e.g. -LJ)</Label>
              </div>
            </div>
          </div>
          {quotePreview && (
            <p className="text-xs text-muted-foreground">Preview: <strong>{quotePreview}</strong></p>
          )}
          <Separator />
          <div>
            <Label className="text-sm font-medium mb-1 block">Next Quote Number</Label>
            <p className="text-xs text-muted-foreground mb-2">
              The next quote created will use this sequence number. Current next: <strong>{seqLoading ? "…" : quoteNext}</strong>
            </p>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                min="1"
                step="1"
                value={quoteNext}
                onChange={(e) => setQuoteNext(e.target.value)}
                className="w-32"
                data-testid="input-quote-next-number"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={seqMutation.isPending}
                onClick={() => handleSetNext("quote", quoteNext)}
                data-testid="button-set-quote-next"
              >
                Set
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Job Numbering</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Controls the prefix for operational job numbers (e.g. J-0042).</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium mb-1 block">Prefix</Label>
              <Input
                value={jobPrefix}
                onChange={(e) => setJobPrefix(e.target.value)}
                placeholder="J"
                className="w-24"
                data-testid="input-job-number-prefix"
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex items-center gap-2 pb-1">
                <Switch
                  checked={jobDivSuffix}
                  onCheckedChange={setJobDivSuffix}
                  data-testid="switch-job-division-suffix"
                />
                <Label className="text-sm">Add division suffix (e.g. -LJ)</Label>
              </div>
            </div>
          </div>
          {jobPreview && (
            <p className="text-xs text-muted-foreground">Preview: <strong>{jobPreview}</strong></p>
          )}
          <Separator />
          <div>
            <Label className="text-sm font-medium mb-1 block">Next Job Number</Label>
            <p className="text-xs text-muted-foreground mb-2">
              The next job created will use this sequence number. Current next: <strong>{seqLoading ? "…" : jobNext}</strong>
            </p>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                min="1"
                step="1"
                value={jobNext}
                onChange={(e) => setJobNext(e.target.value)}
                className="w-32"
                data-testid="input-job-next-number"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={seqMutation.isPending}
                onClick={() => handleSetNext("op_job", jobNext)}
                data-testid="button-set-job-next"
              >
                Set
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Invoice Numbering</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Controls the prefix for invoice numbers (e.g. INV-0042, SE-0042). Applies to all future invoices.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium mb-1 block">Prefix</Label>
              <Input
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                placeholder="INV"
                className="w-24"
                data-testid="input-invoice-number-prefix"
              />
            </div>
          </div>
          {invoicePreview && (
            <p className="text-xs text-muted-foreground">Preview: <strong>{invoicePreview}</strong></p>
          )}
          <Separator />
          <div>
            <Label className="text-sm font-medium mb-1 block">Next Invoice Number</Label>
            <p className="text-xs text-muted-foreground mb-2">
              The next invoice created will use this sequence number. Current next: <strong>{seqLoading ? "…" : (invoiceNext || "1")}</strong>
            </p>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                min="1"
                step="1"
                value={invoiceNext}
                onChange={(e) => setInvoiceNext(e.target.value)}
                className="w-32"
                data-testid="input-invoice-next-number"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={seqMutation.isPending}
                onClick={() => handleSetNext("invoice", invoiceNext)}
                data-testid="button-set-invoice-next"
              >
                Set
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => prefixMutation.mutate()}
          disabled={prefixMutation.isPending || orgLoading}
          data-testid="button-save-numbering"
        >
          {prefixMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
          ) : (
            <><Save className="w-4 h-4 mr-2" /> Save Prefix Settings</>
          )}
        </Button>
      </div>
    </div>
  );
}

function EnvironmentInfoSection() {
  const { data: envInfo, isLoading } = useQuery<EnvInfo>({
    queryKey: ["/api/admin/environment-info"],
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return (
    <Card data-testid="card-environment-info">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Server className="h-4 w-4" /> Environment Information
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Read-only runtime truth. This reflects actual infrastructure state — it is not a configurable switch.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : envInfo ? (
          <>
            <div className="rounded-lg border divide-y text-sm">
              <div className="flex items-center justify-between px-3 py-2.5 gap-2" data-testid="row-env-instance">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Server className="h-3.5 w-3.5" />
                  <span>Instance</span>
                </div>
                <span className="font-medium text-right">{envInfo.instanceLabel}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 gap-2" data-testid="row-env-node">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Wrench className="h-3.5 w-3.5" />
                  <span>Node Environment</span>
                </div>
                <Badge variant={envInfo.nodeEnv === "production" ? "default" : "secondary"} className="text-xs">
                  {envInfo.nodeEnv}
                </Badge>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 gap-2" data-testid="row-env-database">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Database className="h-3.5 w-3.5" />
                  <span>Database</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium">Connected</span>
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-muted/40 border p-3 text-xs text-muted-foreground space-y-1">
              <div className="flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <p>
                  <strong className="text-foreground">Environment vs. record governance are separate concerns.</strong>{" "}
                  The infrastructure environment this app runs in cannot be changed from the UI. Record governance — flagging, archiving, and deleting test/demo data — is managed below and does not switch the environment.
                </p>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Unable to load environment information.</p>
        )}
      </CardContent>
    </Card>
  );
}

type GovernanceEntityType = "estimate" | "quote" | "opJob" | "project" | "invoice" | "customer" | "contact";

function GovernanceEntitySection({
  title,
  entityType,
  items,
  onRefresh,
}: {
  title: string;
  entityType: GovernanceEntityType;
  items: any[];
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const archiveMutation = useMutation({
    mutationFn: async (entityId: string) => {
      const res = await apiRequest("POST", "/api/admin/governance/archive", { entityType, entityId });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Archive failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Record archived", description: "Removed from active operational lists. Historical record preserved." });
      onRefresh();
    },
    onError: (e: any) => toast({ title: "Archive failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (entityId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/governance/record/${entityType}/${entityId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Delete failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Record deleted", description: "Permanently removed from the system." });
      setConfirmDelete(null);
      onRefresh();
    },
    onError: (e: any) => {
      toast({ title: "Delete blocked", description: e.message, variant: "destructive" });
      setConfirmDelete(null);
    },
  });

  const clearXeroLinkMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await apiRequest("POST", `/api/admin/governance/clear-xero-link/${invoiceId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Clear Xero link failed");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Xero link cleared", description: data.message || "Invoice is now eligible for archive or delete." });
      onRefresh();
    },
    onError: (e: any) => toast({ title: "Clear Xero link failed", description: e.message, variant: "destructive" }),
  });

  const [confirmClearXero, setConfirmClearXero] = useState<string | null>(null);

  const chainArchiveInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await apiRequest("POST", "/api/admin/governance/archive", { entityType: "invoice", entityId: invoiceId });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Archive failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Invoice archived", description: "Linked invoice archived. Refresh chain to see updated status." });
      onRefresh();
    },
    onError: (e: any) => toast({ title: "Archive failed", description: e.message, variant: "destructive" }),
  });

  const chainDeleteInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/governance/record/invoice/${invoiceId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Delete failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Invoice deleted", description: "Linked invoice permanently removed." });
      onRefresh();
    },
    onError: (e: any) => toast({ title: "Delete blocked", description: e.message, variant: "destructive" }),
  });

  const activeItems = items.filter((i: any) => !i.archivedAt);
  const archivedItems = items.filter((i: any) => !!i.archivedAt);
  const isProtected = (i: any) => i._isolation?.xeroLinked || i._isolation?.isSharedWithLiveData || i._xeroLinked;
  const protectedItems = activeItems.filter(isProtected);
  const actionableItems = activeItems.filter((i: any) => !isProtected(i));

  if (items.length === 0) {
    return (
      <div className="rounded-lg border px-4 py-3 flex items-center justify-between text-sm" data-testid={`governance-section-${entityType}-empty`}>
        <span className="font-medium text-muted-foreground">{title}</span>
        <Badge variant="outline" className="text-xs">None flagged</Badge>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden" data-testid={`governance-section-${entityType}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
        data-testid={`button-expand-${entityType}`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Flag className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          <span>{title}</span>
          {actionableItems.length > 0 && (
            <Badge variant="secondary" className="text-xs">{actionableItems.length} active</Badge>
          )}
          {protectedItems.length > 0 && (
            <Badge variant="outline" className="text-xs border-destructive/40 text-destructive">{protectedItems.length} protected</Badge>
          )}
          {archivedItems.length > 0 && (
            <Badge variant="outline" className="text-xs text-muted-foreground">{archivedItems.length} archived</Badge>
          )}
          {actionableItems.length === 0 && protectedItems.length === 0 && archivedItems.length > 0 && (
            <span className="text-xs text-green-700 dark:text-green-400">✓ all archived</span>
          )}
        </div>
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t">
          {actionableItems.length > 0 && (
            <div className="px-4 py-2 bg-amber-50/50 dark:bg-amber-950/20 border-b">
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Active — requires action</span>
            </div>
          )}
          <div className="divide-y">
          {actionableItems.map((item: any) => {
            const id = item.id;
            const label = item.number || item.jobNumber || item.name || item.title
              || (item.firstName || item.lastName ? `${item.firstName ?? ""} ${item.lastName ?? ""}`.trim() : null)
              || id;
            const sub = item.customer || item.status || "";
            const isArchived = !!item.archivedAt;
            const chain = item._chain;
            const xeroLinked = item._xeroLinked || (chain?.xeroLinkedInvoiceCount > 0) || item._isolation?.xeroLinked;

            return (
              <div key={id} className="px-4 py-3 space-y-2" data-testid={`governance-row-${entityType}-${id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{label}</span>
                      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
                      {isArchived && <Badge variant="outline" className="text-xs">Archived</Badge>}
                      {xeroLinked && (
                        <Badge variant="destructive" className="text-xs">Xero-linked</Badge>
                      )}
                    </div>
                    {chain && (
                      <div className="text-xs text-muted-foreground space-y-1">
                        {/* Quote chain: op-job */}
                        {chain.opJob && (
                          <div>→ Op-Job: {chain.opJob.jobNumber}{chain.opJob.isDemoRecord ? " (demo flagged)" : " ⚠ not demo-flagged"}</div>
                        )}
                        {/* Estimate chain: linked quotes */}
                        {chain.quoteCount > 0 && (
                          <div className="text-amber-600 dark:text-amber-400">
                            → {chain.quoteCount} linked quote(s): {chain.quoteNumbers?.join(", ")} — delete blocked until resolved
                          </div>
                        )}
                        {chain.quoteCount === 0 && entityType === "estimate" && (
                          <div>No linked quotes — safe to delete</div>
                        )}
                        {/* Op-job: source quote */}
                        {chain.sourceQuote && (
                          <div>← Source quote: {chain.sourceQuote.number}{!chain.sourceQuote.isDemoRecord ? " ⚠ not demo-flagged" : ""}</div>
                        )}
                        {/* Project chain: quote, op-job counts */}
                        {chain.opJobCount > 0 && (
                          <div className="text-amber-600 dark:text-amber-400">→ {chain.opJobCount} linked op-job(s) — delete blocked until resolved</div>
                        )}
                        {chain.quoteCount > 0 && entityType === "project" && (
                          <div className="text-amber-600 dark:text-amber-400">→ {chain.quoteCount} linked quote(s) — delete blocked until resolved</div>
                        )}
                        {/* Quote chain: individual invoice details with inline actions */}
                        {entityType === "quote" && chain.invoices?.length > 0 && (
                          <div className="space-y-1 mt-1">
                            <div className="font-medium text-foreground">Linked invoices ({chain.invoices.length}):</div>
                            {chain.invoices.map((inv: any) => {
                              const isXeroLinked = !!inv.xeroInvoiceId;
                              const isArchived = !!inv.archivedAt;
                              const isNonDemo = !inv.isDemoRecord;
                              return (
                                <div key={inv.id} className="flex items-center gap-2 flex-wrap pl-3 py-0.5 border-l-2 border-muted" data-testid={`chain-invoice-${inv.id}`}>
                                  <span className="font-mono">{inv.number}</span>
                                  <span className="text-muted-foreground">{inv.type} · {inv.status}</span>
                                  {isNonDemo && <Badge variant="outline" className="text-xs border-amber-400 text-amber-700 dark:text-amber-400">Live (not demo)</Badge>}
                                  {inv.isDemoRecord && <Badge variant="outline" className="text-xs">Demo</Badge>}
                                  {isXeroLinked && <Badge variant="destructive" className="text-xs">Xero: {inv.xeroInvoiceNumber}</Badge>}
                                  {isArchived && <Badge variant="outline" className="text-xs">Archived</Badge>}
                                  {/* Inline actions for demo invoices */}
                                  {inv.isDemoRecord && !isArchived && (
                                    <div className="flex items-center gap-1 ml-auto">
                                      {isXeroLinked && (
                                        confirmClearXero === inv.id ? (
                                          <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded px-1.5 py-0.5">
                                            <span className="text-amber-800 dark:text-amber-300">Voided in Xero?</span>
                                            <Button size="sm" variant="destructive" className="h-4 px-1.5 text-[10px]"
                                              disabled={clearXeroLinkMutation.isPending}
                                              onClick={() => clearXeroLinkMutation.mutate(inv.id)}
                                              data-testid={`button-chain-confirm-clear-xero-${inv.id}`}
                                            >{clearXeroLinkMutation.isPending ? "..." : "Yes, clear"}</Button>
                                            <Button size="sm" variant="ghost" className="h-4 px-1.5 text-[10px]"
                                              onClick={() => setConfirmClearXero(null)}
                                            >No</Button>
                                          </div>
                                        ) : (
                                          <Button size="sm" variant="outline" className="h-5 px-1.5 text-[10px] border-amber-400 text-amber-700 dark:text-amber-400"
                                            onClick={() => setConfirmClearXero(inv.id)}
                                            data-testid={`button-chain-clear-xero-${inv.id}`}
                                          >Clear Xero Link</Button>
                                        )
                                      )}
                                      {!isXeroLinked && (
                                        <>
                                          <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px]"
                                            disabled={chainArchiveInvoiceMutation.isPending}
                                            onClick={() => chainArchiveInvoiceMutation.mutate(inv.id)}
                                            data-testid={`button-chain-archive-inv-${inv.id}`}
                                          >Archive</Button>
                                          <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px] text-destructive"
                                            disabled={chainDeleteInvoiceMutation.isPending}
                                            onClick={() => chainDeleteInvoiceMutation.mutate(inv.id)}
                                            data-testid={`button-chain-delete-inv-${inv.id}`}
                                          >Delete</Button>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {/* Chain status guidance */}
                            {chain.hasNonDemoInvoice && (
                              <div className="text-destructive font-medium mt-1">
                                ⚠ Chain contains live (non-demo) invoice(s) — chain cleanup blocked. Flag them as demo first if appropriate.
                              </div>
                            )}
                            {!chain.hasNonDemoInvoice && chain.xeroLinkedInvoiceCount > 0 && (
                              <div className="text-amber-600 dark:text-amber-400 font-medium mt-1">
                                Next step: Clear stale Xero link(s) above, then archive/delete the invoices, then delete this quote.
                              </div>
                            )}
                            {chain.canChainDelete && chain.invoiceCount > 0 && (
                              <div className="text-green-700 dark:text-green-400 font-medium mt-1">
                                All linked records are demo-flagged with no Xero blockers — quote delete will auto-cleanup this chain.
                              </div>
                            )}
                          </div>
                        )}
                        {/* Non-quote entity: summary invoice counts (existing behavior) */}
                        {entityType !== "quote" && chain.invoiceCount > 0 && (
                          <div>
                            → {chain.invoiceCount} linked invoice(s)
                            {chain.xeroLinkedInvoiceCount > 0 && (
                              <span className="ml-1 text-destructive font-medium">({chain.xeroLinkedInvoiceCount} Xero-linked: {chain.xeroLinkedNumbers.join(", ")})</span>
                            )}
                            {chain.xeroLinkedInvoiceCount === 0 && <span className="ml-1 text-amber-600 dark:text-amber-400">— delete blocked until resolved</span>}
                          </div>
                        )}
                      </div>
                    )}
                    {item._xeroLinked && (
                      <div className="text-xs space-y-1">
                        <div className="text-destructive">
                          Xero invoice: {item._xeroNumber || "linked"} — archive/delete blocked while Xero link is active
                        </div>
                        {entityType === "invoice" && (
                          <div className="flex items-center gap-2">
                            {confirmClearXero === item.id ? (
                              <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded px-2 py-1">
                                <span className="text-amber-800 dark:text-amber-300 text-xs">Confirm: has this Xero invoice been voided or deleted in Xero?</span>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-5 px-2 text-xs"
                                  disabled={clearXeroLinkMutation.isPending}
                                  onClick={() => clearXeroLinkMutation.mutate(item.id)}
                                  data-testid={`button-confirm-clear-xero-${item.id}`}
                                >
                                  {clearXeroLinkMutation.isPending ? "Clearing..." : "Yes, clear link"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-5 px-2 text-xs"
                                  onClick={() => setConfirmClearXero(null)}
                                  data-testid={`button-cancel-clear-xero-${item.id}`}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-5 px-2 text-xs border-amber-400 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                onClick={() => setConfirmClearXero(item.id)}
                                data-testid={`button-clear-xero-link-${item.id}`}
                              >
                                Clear Xero Link (post-void cleanup)
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {/* CRM isolation info for customers */}
                    {item._isolation && (
                      <div className="text-xs space-y-0.5">
                        {/* Customer: Xero link warning */}
                        {item._isolation.xeroLinked && (
                          <div className="text-destructive">Xero contact linked — archive/delete blocked until Xero link is removed</div>
                        )}
                        {/* Contact: parent customer Xero link warning */}
                        {item._isolation.parentXeroLinked && (
                          <div className="text-destructive">Parent customer is Xero-linked — governance actions are restricted</div>
                        )}
                        {item._isolation.isSharedWithLiveData ? (
                          <div className="space-y-0.5">
                            <div className="text-destructive font-medium">
                              ⚠ Shared with live data — archive and delete blocked
                            </div>
                            {/* Customer-level live record counts */}
                            {item._isolation.liveQuoteCount > 0 && (
                              <div className="text-destructive">→ {item._isolation.liveQuoteCount} live quote(s)</div>
                            )}
                            {item._isolation.liveJobCount > 0 && entityType === "customer" && (
                              <div className="text-destructive">→ {item._isolation.liveJobCount} live estimate(s)</div>
                            )}
                            {item._isolation.liveProjectCount > 0 && (
                              <div className="text-destructive">→ {item._isolation.liveProjectCount} live project(s)</div>
                            )}
                            {item._isolation.liveInvoiceCount > 0 && (
                              <div className="text-destructive">→ {item._isolation.liveInvoiceCount} live invoice(s)</div>
                            )}
                            {/* Contact-level: parent customer live counts */}
                            {item._isolation.parentCustomerShared && item._isolation.parentLiveCounts && (
                              <div className="text-destructive">
                                → Parent customer "{item._isolation.parentCustomerName}" has live records:
                                {item._isolation.parentLiveCounts.quotes > 0 && ` ${item._isolation.parentLiveCounts.quotes} quote(s)`}
                                {item._isolation.parentLiveCounts.jobs > 0 && ` ${item._isolation.parentLiveCounts.jobs} estimate(s)`}
                                {item._isolation.parentLiveCounts.projects > 0 && ` ${item._isolation.parentLiveCounts.projects} project(s)`}
                                {item._isolation.parentLiveCounts.invoices > 0 && ` ${item._isolation.parentLiveCounts.invoices} invoice(s)`}
                              </div>
                            )}
                            {/* Contact: direct live job linkage */}
                            {item._isolation.liveJobCount > 0 && entityType === "contact" && (
                              <div className="text-destructive">→ {item._isolation.liveJobCount} live estimate(s) directly reference this contact</div>
                            )}
                          </div>
                        ) : (
                          <div className="text-green-700 dark:text-green-400">
                            Isolated — {item._isolation.safeToDelete ? "safe to archive and delete" : "safe to archive"}
                            {item._isolation.totalLinkedQuotes > 0 && ` (${item._isolation.totalLinkedQuotes} linked quote(s), all demo-flagged)`}
                            {item._isolation.totalLinkedJobs > 0 && ` (${item._isolation.totalLinkedJobs} linked job(s), all demo-flagged)`}
                          </div>
                        )}
                        {/* Contact: parent customer context line (always shown) */}
                        {item._isolation.parentCustomerName && (
                          <div className="text-muted-foreground">
                            Parent: {item._isolation.parentCustomerName}
                            {item._isolation.parentCustomerIsDemoFlagged ? " (demo-flagged)" : " (live customer)"}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isArchived && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={archiveMutation.isPending}
                        onClick={() => archiveMutation.mutate(id)}
                        data-testid={`button-archive-${entityType}-${id}`}
                      >
                        <Archive className="h-3 w-3 mr-1" />
                        Archive
                      </Button>
                    )}
                    {(() => {
                      const chainBlocked = entityType === "quote" && chain && (chain.xeroLinkedInvoiceCount > 0 || chain.hasNonDemoInvoice);
                      return confirmDelete === id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs"
                            disabled={deleteMutation.isPending}
                            onClick={() => deleteMutation.mutate(id)}
                            data-testid={`button-confirm-delete-${entityType}-${id}`}
                          >
                            {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm Delete"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => setConfirmDelete(null)}
                            data-testid={`button-cancel-delete-${entityType}-${id}`}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setConfirmDelete(id)}
                          disabled={!!chainBlocked}
                          title={chainBlocked ? "Resolve linked chain blockers first" : undefined}
                          data-testid={`button-delete-${entityType}-${id}`}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      );
                    })()}
                  </div>
                </div>

                {confirmDelete === id && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive space-y-1">
                    <div className="flex items-start gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-medium">Permanent deletion — this cannot be undone.</p>
                        {xeroLinked && <p>⚠ This record or its downstream chain has Xero-linked invoices. The server will block deletion to protect accounting integrity. Archiving in SteelIQ does not remove records from Xero.</p>}
                        {chain?.quoteCount > 0 && entityType === "estimate" && <p>⚠ This estimate has {chain.quoteCount} linked quote(s). The server will block deletion until those quotes are resolved first.</p>}
                        {chain?.invoiceCount > 0 && entityType !== "estimate" && <p>⚠ {chain.invoiceCount} linked invoice(s) in this chain will be reviewed before deletion is allowed.</p>}
                        {chain?.opJobCount > 0 && <p>⚠ {chain.opJobCount} linked op-job(s) must be resolved before this project can be deleted.</p>}
                        {(chain?.quoteCount > 0 || chain?.opJobCount > 0 || chain?.invoiceCount > 0) && entityType === "project" && <p>⚠ This project has linked downstream records. The server will block deletion until they are resolved.</p>}
                        <p>Archive is the safer option and preserves historical records.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          </div>
          {protectedItems.length > 0 && (
            <>
              <div className="px-4 py-2 bg-red-50/50 dark:bg-red-950/20 border-t border-b">
                <span className="text-xs font-medium text-red-700 dark:text-red-400">Protected — cannot be bulk-archived (Xero-linked or shared with live data)</span>
              </div>
              <div className="divide-y">
                {protectedItems.map((item: any) => {
                  const id = item.id;
                  const label = item.number || item.jobNumber || item.name || item.title
                    || (item.firstName || item.lastName ? `${item.firstName ?? ""} ${item.lastName ?? ""}`.trim() : null)
                    || id;
                  const sub = item.customer || item.status || "";
                  const xeroLinked = item._xeroLinked || item._isolation?.xeroLinked;
                  const isXeroLinkedInvoice = entityType === "invoice" && item._xeroLinked;
                  return (
                    <div key={id} className="px-4 py-2.5 space-y-1.5" data-testid={`governance-row-protected-${entityType}-${id}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{label}</span>
                        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
                        {xeroLinked && <Badge variant="destructive" className="text-xs">Xero-linked</Badge>}
                        <Badge variant="outline" className="text-xs border-destructive/40 text-destructive">Protected</Badge>
                      </div>
                      {isXeroLinkedInvoice && (
                        <div className="text-xs space-y-1.5">
                          <div className="text-destructive">
                            Xero invoice: {item._xeroNumber || "linked"} — archive/delete blocked while Xero link is active.
                            Returning to Draft does not clear the Xero link.
                          </div>
                          <div className="flex items-center gap-2">
                            {confirmClearXero === id ? (
                              <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded px-2 py-1">
                                <span className="text-amber-800 dark:text-amber-300 text-xs">Confirm: has this Xero invoice been voided or deleted in Xero?</span>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-5 px-2 text-xs"
                                  disabled={clearXeroLinkMutation.isPending}
                                  onClick={() => clearXeroLinkMutation.mutate(id)}
                                  data-testid={`button-confirm-clear-xero-${id}`}
                                >
                                  {clearXeroLinkMutation.isPending ? "Clearing..." : "Yes, clear link"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-5 px-2 text-xs"
                                  onClick={() => setConfirmClearXero(null)}
                                  data-testid={`button-cancel-clear-xero-${id}`}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-5 px-2 text-xs border-amber-400 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                onClick={() => setConfirmClearXero(id)}
                                data-testid={`button-clear-xero-link-${id}`}
                              >
                                Clear Xero Link (post-void cleanup)
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                      {item._isolation?.xeroLinked && entityType === "customer" && (
                        <div className="text-xs text-destructive">
                          Xero contact linked — archive/delete blocked until Xero link is removed
                        </div>
                      )}
                      {item._isolation?.isSharedWithLiveData && (
                        <div className="text-xs text-destructive">
                          Shared with live data — archive/delete blocked
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {archivedItems.length > 0 && (
            <>
              <div className="px-4 py-2 bg-muted/30 border-t border-b">
                <span className="text-xs font-medium text-muted-foreground">Archived — no action needed (historical record)</span>
              </div>
              <div className="divide-y opacity-70">
                {archivedItems.map((item: any) => {
                  const id = item.id;
                  const label = item.number || item.jobNumber || item.name || item.title
                    || (item.firstName || item.lastName ? `${item.firstName ?? ""} ${item.lastName ?? ""}`.trim() : null)
                    || id;
                  const sub = item.customer || item.status || "";
                  return (
                    <div key={id} className="px-4 py-2.5" data-testid={`governance-row-archived-${entityType}-${id}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-muted-foreground">{label}</span>
                        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
                        <Badge variant="outline" className="text-xs">Archived</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

type GovernanceAuditEntry = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string | null;
  actorName: string;
  metadata: Record<string, any> | null;
  createdAt: string | null;
};

function formatGovernanceAction(action: string): string {
  switch (action) {
    case "demo_flagged":     return "Demo Flagged";
    case "demo_unflagged":   return "Demo Flag Removed";
    case "governance_archive": return "Archived (Governance)";
    case "governance_delete":  return "Deleted (Governance)";
    default: return action;
  }
}

function formatGovernanceEntityType(entityType: string): string {
  switch (entityType) {
    case "estimate":  return "Estimate";
    case "quote":     return "Quote";
    case "op_job":    return "Op-Job";
    case "job":       return "Estimate";
    case "project":   return "Project";
    case "invoice":   return "Invoice";
    case "customer":  return "Customer";
    case "contact":   return "Contact";
    default: return entityType;
  }
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function GovernanceSection() {
  const { toast } = useToast();
  const [bulkConfirm, setBulkConfirm] = useState(false);

  const { data: summary, isLoading, refetch, isFetching } = useQuery<GovernanceSummary>({
    queryKey: ["/api/admin/governance/summary"],
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  const { data: auditHistory, isLoading: auditLoading } = useQuery<{ entries: GovernanceAuditEntry[] }>({
    queryKey: ["/api/settings/governance/audit-history"],
    queryFn: () => fetch("/api/settings/governance/audit-history?limit=30").then(r => r.json()),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  type BulkArchiveResult = {
    totalArchived: number;
    totalSkipped: number;
    results: Record<string, { archived: number; skipped: number; skipReasons: string[] }>;
  };
  const [lastBulkResult, setLastBulkResult] = useState<BulkArchiveResult | null>(null);

  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/cleanup-demo", {});
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Cleanup failed");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      const total = data.totalArchived ?? (data.quotesArchived + data.jobsArchived);
      toast({ title: "Archive complete", description: `${total} record(s) archived across all entity types.` });
      setBulkConfirm(false);
      setLastBulkResult(data.results ? { totalArchived: data.totalArchived, totalSkipped: data.totalSkipped, results: data.results } : null);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/settings/governance/audit-history"] });
    },
    onError: (e: any) => {
      toast({ title: "Archive failed", description: e.message, variant: "destructive" });
      setBulkConfirm(false);
    },
  });

  const totalFlagged = summary ? (summary.counts.estimates + summary.counts.quotes + summary.counts.opJobs + summary.counts.projects + summary.counts.invoices + (summary.counts.customers ?? 0) + (summary.counts.contacts ?? 0)) : 0;

  return (
    <div className="space-y-4" data-testid="governance-section">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Test / Demo Data Governance</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review, archive, and manage records flagged as test or demo data. These flags are set per-record and do not affect the infrastructure environment.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-refresh-governance"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Explanation banner */}
      <div className="rounded-lg bg-muted/40 border p-3 text-xs text-muted-foreground space-y-1.5" data-testid="governance-explanation">
        <div className="flex items-start gap-1.5">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p><strong className="text-foreground">Flagging does not change the infrastructure environment.</strong> Demo/test flags are per-record labels that identify data created during testing or demonstrations. Governance controls (flagging, archiving, deleting) are restricted to Owner and Admin roles.</p>
            <p><strong className="text-foreground">Flagged records are hidden from standard users.</strong> Records marked as demo/test are automatically filtered from operational list and detail views for non-admin users. Admins and owners can see, flag, and manage demo records. To permanently remove flagged records, archive them using the controls below or via Bulk Archive.</p>
            <p><strong className="text-foreground">Archive is the preferred action.</strong> Archiving hides records from normal operational views while preserving them historically. Deletion is permanent and only allowed for explicitly flagged demo/test records.</p>
            <p><strong className="text-foreground">Xero-linked invoices are protected.</strong> Deleting a record in SteelIQ does not remove it from Xero. Records with Xero invoice links cannot be deleted until voided in Xero first.</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading flagged records…
        </div>
      ) : summary ? (
        <>
          {totalFlagged === 0 ? (
            <div className="rounded-lg border bg-muted/20 px-4 py-6 text-center space-y-2" data-testid="governance-no-flagged">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400 mx-auto" />
              <p className="text-sm font-medium">No records are currently flagged as demo or test data.</p>
              <p className="text-xs text-muted-foreground">To flag a record, open it in its detail view and use the Demo/Test governance controls there.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <GovernanceEntitySection
                title="Estimates"
                entityType="estimate"
                items={summary.estimates}
                onRefresh={() => refetch()}
              />
              <GovernanceEntitySection
                title="Quotes"
                entityType="quote"
                items={summary.quotes}
                onRefresh={() => refetch()}
              />
              <GovernanceEntitySection
                title="Op-Jobs / Production Jobs"
                entityType="opJob"
                items={summary.opJobs}
                onRefresh={() => refetch()}
              />
              <GovernanceEntitySection
                title="Projects"
                entityType="project"
                items={summary.projects}
                onRefresh={() => refetch()}
              />
              <GovernanceEntitySection
                title="Invoices"
                entityType="invoice"
                items={summary.invoices}
                onRefresh={() => refetch()}
              />
              <GovernanceEntitySection
                title="Customers (CRM)"
                entityType="customer"
                items={summary.customers ?? []}
                onRefresh={() => refetch()}
              />
              <GovernanceEntitySection
                title="Contacts (CRM)"
                entityType="contact"
                items={summary.contacts ?? []}
                onRefresh={() => refetch()}
              />
            </div>
          )}

          {/* Bulk archive section */}
          {totalFlagged > 0 && (
            <Card className="border-amber-200 dark:border-amber-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Archive className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  Bulk Archive Flagged Records
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Archive all currently active demo-flagged records across all entity types — estimates, quotes, op-jobs, projects, invoices, customers, and contacts. Records are removed from operational views but preserved historically. Xero-linked invoices are automatically skipped. This action cannot be undone without individually unarchiving records.
                </p>
                {!bulkConfirm ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-300 dark:border-amber-700"
                    onClick={() => { setBulkConfirm(true); setLastBulkResult(null); }}
                    data-testid="button-bulk-archive-start"
                  >
                    <Archive className="h-3.5 w-3.5 mr-1.5" />
                    Bulk Archive All Active Demo Records
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-2.5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <div>
                        <p>This will archive all active demo-flagged records across: estimates, quotes, op-jobs, projects, invoices, customers, and contacts.</p>
                        <p className="mt-1"><strong>Protected:</strong> Xero-linked invoices will be skipped automatically.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        disabled={cleanupMutation.isPending}
                        onClick={() => cleanupMutation.mutate()}
                        data-testid="button-bulk-archive-confirm"
                      >
                        {cleanupMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Archive className="h-3.5 w-3.5 mr-1.5" />}
                        Confirm Bulk Archive
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setBulkConfirm(false)} data-testid="button-bulk-archive-cancel">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                {lastBulkResult && (
                  <div className={`rounded-md border p-3 text-xs space-y-2 ${lastBulkResult.totalSkipped > 0 ? "border-amber-300 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-950/20" : "border-green-300 dark:border-green-700 bg-green-50/30 dark:bg-green-950/20"}`} data-testid="bulk-archive-result-summary">
                    <p className="font-medium text-foreground flex items-center gap-1.5">
                      {lastBulkResult.totalSkipped > 0 ? <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" /> : <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />}
                      {lastBulkResult.totalArchived > 0
                        ? `${lastBulkResult.totalArchived} record(s) archived successfully`
                        : "No records were archived"}
                      {lastBulkResult.totalSkipped > 0 && ` · ${lastBulkResult.totalSkipped} protected/skipped`}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-muted-foreground">
                      {Object.entries(lastBulkResult.results).map(([key, val]) => (
                        <div key={key} className="flex items-center gap-1">
                          <span className="capitalize">{key === "opJobs" ? "Op-Jobs" : key}:</span>
                          <span className="font-mono font-medium text-foreground">{val.archived}</span>
                          {val.skipped > 0 && (
                            <span className="text-amber-600 dark:text-amber-400" title={val.skipReasons.join(", ")}>
                              ({val.skipped} skipped)
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    {lastBulkResult.totalSkipped > 0 && (
                      <div className="text-amber-700 dark:text-amber-400 space-y-0.5">
                        {Object.entries(lastBulkResult.results)
                          .filter(([, val]) => val.skipped > 0)
                          .map(([key, val]) => (
                            <p key={key} className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              {val.skipped} {key === "opJobs" ? "op-job" : key}(s) skipped: {val.skipReasons.join(", ")}. Use individual governance actions.
                            </p>
                          ))
                        }
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Unable to load governance summary.</p>
      )}

      {/* Recent Governance Activity */}
      <Separator />
      <div className="space-y-3" data-testid="governance-audit-section">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Recent Governance Activity</h4>
          <span className="text-xs text-muted-foreground ml-1">(last 30 actions)</span>
        </div>
        {auditLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
          </div>
        ) : !auditHistory?.entries?.length ? (
          <div className="rounded-md border bg-muted/20 px-4 py-5 text-center">
            <Clock className="h-6 w-6 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">No governance actions have been recorded yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Actions such as flagging, archiving, and deleting demo records will appear here.</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden" data-testid="governance-audit-table">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Record</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                    <User className="h-3 w-3 inline mr-1" />Actor
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider">
                    <Clock className="h-3 w-3 inline mr-1" />When
                  </th>
                </tr>
              </thead>
              <tbody>
                {auditHistory.entries.map((entry, idx) => {
                  const isDelete = entry.action === "governance_delete";
                  const isFlag = entry.action === "demo_flagged";
                  const isUnflag = entry.action === "demo_unflagged";
                  const isArchive = entry.action === "governance_archive";
                  return (
                    <tr
                      key={entry.id}
                      className={`border-b last:border-0 ${idx % 2 === 0 ? "bg-background" : "bg-muted/20"}`}
                      data-testid={`row-audit-entry-${entry.id}`}
                    >
                      <td className="px-3 py-2">
                        <span className={`font-medium ${
                          isDelete ? "text-destructive" :
                          isFlag ? "text-amber-600 dark:text-amber-400" :
                          isUnflag ? "text-muted-foreground" :
                          isArchive ? "text-blue-600 dark:text-blue-400" :
                          "text-foreground"
                        }`}>
                          {formatGovernanceAction(entry.action)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{formatGovernanceEntityType(entry.entityType)}</td>
                      <td className="px-3 py-2 text-muted-foreground font-mono hidden sm:table-cell truncate max-w-[120px]">
                        {entry.entityId.slice(0, 8)}…
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">{entry.actorName}</td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap" title={entry.createdAt ?? ""}>
                        {formatRelativeTime(entry.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SystemTab() {
  const { user } = useAuth();
  const isOwnerOrAdmin = user?.role === "owner" || user?.role === "admin";

  return (
    <div className="space-y-6" data-testid="system-tab">
      {/* Section 1: Environment Information (always visible, read-only) */}
      <EnvironmentInfoSection />

      <Separator />

      {/* Section 2: Test / Demo Data Governance (Owner/Admin only) */}
      {isOwnerOrAdmin ? (
        <GovernanceSection />
      ) : (
        <Card data-testid="governance-restricted">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4" /> Test / Demo Data Governance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted/30 border px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
              <Shield className="h-4 w-4 shrink-0" />
              <span>Governance controls are restricted to Owner and Admin roles only.</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type XeroStatusResponse = {
  mode: "not_configured" | "scaffold" | "live_wired";
  configured: boolean;
  livePushWired: boolean;
  liveCapable: boolean;
  hasRefreshToken: boolean;
  hasDbConnection: boolean;
  dbTokenExpired: boolean;
  redirectUriSet: boolean;
  status: string;
  requiredFields: string[];
  optionalFields: string[];
  presentFields: string[];
  missingFields: string[];
  accountCode: string;
  taxType: string;
  scaffoldNote: string | null;
  tokenNote: string | null;
};

function XeroStatusTab() {
  const { toast } = useToast();

  const { data: xeroStatus, isLoading, refetch, isFetching } = useQuery<XeroStatusResponse>({
    queryKey: ["/api/settings/xero-status"],
    staleTime: 30_000,
  });

  // Accounting config form state
  const [accountCode, setAccountCode] = useState<string>("");
  const [taxType, setTaxType] = useState<string>("");
  const [accountingSaving, setAccountingSaving] = useState(false);

  // Sync form fields when status data loads
  useEffect(() => {
    if (xeroStatus) {
      setAccountCode(xeroStatus.accountCode ?? "200");
      setTaxType(xeroStatus.taxType ?? "OUTPUT2");
    }
  }, [xeroStatus?.accountCode, xeroStatus?.taxType]);

  // Show toast when returning from Xero OAuth callback
  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/[?&]xero=([^&]+)(&reason=([^&]*))?/);
    if (!match) return;
    const outcome = match[1];
    const reason = match[3] ? decodeURIComponent(match[3]) : null;
    if (outcome === "connected") {
      toast({ title: "Xero connected", description: "OAuth connection established. Live push is now active." });
      refetch();
    } else if (outcome === "error") {
      toast({
        title: "Xero connection failed",
        description: reason ? `Error: ${reason}` : "An unknown error occurred. Check server logs for details.",
        variant: "destructive",
      });
    }
    // Strip the xero params from the hash to avoid re-triggering
    window.history.replaceState(null, "", window.location.pathname + window.location.search + "#/settings");
  }, []);

  const saveAccountingConfig = async () => {
    if (!accountCode.trim()) {
      toast({ title: "Validation error", description: "Account code cannot be empty.", variant: "destructive" });
      return;
    }
    if (!taxType.trim()) {
      toast({ title: "Validation error", description: "Tax type cannot be empty.", variant: "destructive" });
      return;
    }
    setAccountingSaving(true);
    try {
      const res = await apiRequest("PATCH", "/api/settings/org", {
        xeroAccountCode: accountCode.trim(),
        xeroTaxType: taxType.trim(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Save failed");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/settings/xero-status"] });
      toast({ title: "Accounting configuration saved", description: `AccountCode: ${accountCode.trim()} · TaxType: ${taxType.trim()}` });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setAccountingSaving(false);
    }
  };

  const modeColor =
    xeroStatus?.mode === "live_wired"
      ? "text-green-700 dark:text-green-400"
      : xeroStatus?.mode === "scaffold"
      ? "text-amber-600 dark:text-amber-400"
      : "text-muted-foreground";

  return (
    <div className="space-y-4">
      {/* ── OAuth Connection Card ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Connect to Xero
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Use OAuth 2.0 to authorise this system to push invoices to your Xero organisation.
            Tokens are stored securely in the database and refreshed automatically.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  {xeroStatus?.hasDbConnection ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-green-700 dark:text-green-400" data-testid="text-xero-oauth-status">
                          OAuth Connected
                        </p>
                        {xeroStatus?.dbTokenExpired && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            Token expired — will refresh automatically on next push
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                      <p className="text-sm text-muted-foreground" data-testid="text-xero-oauth-status">
                        Not connected via OAuth
                      </p>
                    </>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={xeroStatus?.hasDbConnection ? "outline" : "default"}
                  className="shrink-0 gap-1.5"
                  data-testid="button-xero-connect"
                  onClick={() => { window.location.href = "/api/xero/connect"; }}
                  disabled={!xeroStatus?.redirectUriSet}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {xeroStatus?.hasDbConnection ? "Re-connect" : "Connect to Xero"}
                </Button>
              </div>

              {!xeroStatus?.redirectUriSet && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  <p className="font-semibold">XERO_REDIRECT_URI not set</p>
                  <p>
                    Set <span className="font-mono">XERO_REDIRECT_URI</span> to{" "}
                    <span className="font-mono">{window.location.origin}/api/xero/callback</span> in environment variables,
                    and register the same URI in your Xero Developer app settings before connecting.
                  </p>
                </div>
              )}

            </>
          )}
        </CardContent>
      </Card>

      {/* ── Integration Status ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Xero Integration Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading status…
            </div>
          ) : xeroStatus ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <p className={`text-sm font-semibold ${modeColor}`} data-testid="text-xero-status">
                    {xeroStatus.status}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Live push path: <strong>Wired</strong> — active when all credentials are present
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Live push capable: <strong>{xeroStatus.liveCapable ? "Yes" : "No"}</strong>
                    {xeroStatus.liveCapable && " — awaiting first verified push"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Auto token refresh: <strong>{xeroStatus.hasRefreshToken ? "Enabled" : "Not configured"}</strong>
                    {!xeroStatus.hasRefreshToken && " — set XERO_REFRESH_TOKEN to enable"}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => refetch()} disabled={isFetching} data-testid="button-xero-refresh">
                  {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refresh"}
                </Button>
              </div>

              <Separator />

              {/* Required vars */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Required Environment Variables</p>
                <div className="rounded-lg border divide-y text-sm">
                  {xeroStatus.requiredFields.map((field) => {
                    const present = xeroStatus.presentFields.includes(field);
                    return (
                      <div key={field} className="flex items-center justify-between px-3 py-2 gap-2" data-testid={`row-xero-field-${field}`}>
                        <span className="font-mono text-xs">{field}</span>
                        {present ? (
                          <Badge variant="default" className="text-xs">Present</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">Missing</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Optional vars */}
              {xeroStatus.optionalFields.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Optional Environment Variables
                  </p>
                  <div className="rounded-lg border divide-y text-sm">
                    {xeroStatus.optionalFields.map((field) => {
                      const present = xeroStatus.presentFields.includes(field);
                      const isRefreshToken = field === "XERO_REFRESH_TOKEN";
                      return (
                        <div key={field} className="px-3 py-2 space-y-0.5" data-testid={`row-xero-field-${field}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs">{field}</span>
                            {present ? (
                              <Badge variant="secondary" className="text-xs">Present</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">Not set</Badge>
                            )}
                          </div>
                          {isRefreshToken && (
                            <p className="text-xs text-muted-foreground">
                              {present
                                ? "Auto-refresh enabled — on 401, system will refresh token and retry push once. Xero tokens rotate; update this env var after refresh."
                                : "Recommended for production. Without it, you must manually update XERO_ACCESS_TOKEN when it expires (~30 min)."}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <Separator />

              {/* Notes panel */}
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-2">
                {xeroStatus.scaffoldNote && (
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">Configuration Required</p>
                    <p>{xeroStatus.scaffoldNote}</p>
                  </div>
                )}
                {xeroStatus.tokenNote && (
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">Token Management</p>
                    <p>{xeroStatus.tokenNote}</p>
                  </div>
                )}
                <p>
                  <strong>Environment variables are set on the server — values are never exposed here.</strong>{" "}
                  Only presence/absence is reported above.
                </p>
                <p>
                  For reliable Xero contact matching, set a{" "}
                  <strong>Xero Contact ID</strong> on each customer record in the Customers page.
                  Without it, Xero will match or create a contact by name.
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Unable to load Xero status.</p>
          )}
        </CardContent>
      </Card>

      {/* ── Accounting Configuration ────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Accounting Configuration</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            These values are used on every Xero invoice line item. Consult your Xero chart of accounts to verify codes.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="xero-account-code">
                    Account Code
                  </label>
                  <Input
                    id="xero-account-code"
                    data-testid="input-xero-account-code"
                    value={accountCode}
                    onChange={(e) => setAccountCode(e.target.value)}
                    placeholder="e.g. 200"
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Xero revenue account code (e.g. <code>200</code> = Sales in NZ standard chart)
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="xero-tax-type">
                    Tax Type
                  </label>
                  <Input
                    id="xero-tax-type"
                    data-testid="input-xero-tax-type"
                    value={taxType}
                    onChange={(e) => setTaxType(e.target.value)}
                    placeholder="e.g. OUTPUT2"
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Xero tax type (e.g. <code>OUTPUT2</code> = NZ 15% GST, <code>OUTPUT</code> = AU 10% GST)
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={saveAccountingConfig}
                  disabled={accountingSaving}
                  data-testid="button-save-xero-accounting"
                >
                  {accountingSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                  Save Accounting Config
                </Button>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <p>
                  <strong>These values apply to all invoices pushed to Xero.</strong>{" "}
                  Validation errors from Xero related to account code or tax type will appear in the
                  push toast on the quote detail page. Common Xero tax types: <code>OUTPUT2</code> (NZ GST),{" "}
                  <code>OUTPUT</code> (AU GST), <code>NONE</code> (no tax).
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Settings() {
  const { quoteListPosition, usdToNzdRate, gstRate, updateSetting } = useSettings();

  return (
    <div className="flex flex-col h-full bg-background" data-testid="settings-page">
      <header className="border-b px-4 sm:px-6 py-3 flex items-center gap-3 bg-card shrink-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary">
          <SettingsIcon className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight" data-testid="text-settings-title">Settings</h1>
          <p className="text-xs text-muted-foreground">Global application preferences</p>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-3xl mx-auto">
          <Tabs defaultValue={new URLSearchParams(window.location.search).has("division") ? "divisions" : "application"}>
            <TabsList className="mb-4 overflow-x-auto">
              <TabsTrigger value="application" data-testid="tab-application">Application</TabsTrigger>
              <TabsTrigger value="organisation" data-testid="tab-organisation">Organisation</TabsTrigger>
              <TabsTrigger value="divisions" data-testid="tab-divisions">Divisions</TabsTrigger>
              <TabsTrigger value="numbering" data-testid="tab-numbering">
                <Hash className="w-3.5 h-3.5 mr-1.5" />
                Numbering
              </TabsTrigger>
              <TabsTrigger value="template" data-testid="tab-template">
                <Palette className="w-3.5 h-3.5 mr-1.5" />
                Template
              </TabsTrigger>
              <TabsTrigger value="system" data-testid="tab-system">
                <Shield className="w-3.5 h-3.5 mr-1.5" />
                System
              </TabsTrigger>
              <TabsTrigger value="xero" data-testid="tab-xero">
                Xero
              </TabsTrigger>
            </TabsList>

            <TabsContent value="application">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Layout Options</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Quote Items List Position</Label>
                      <p className="text-xs text-muted-foreground mb-3">Choose where the quote items list appears relative to the drawing</p>
                      <div className="flex gap-2">
                        <Button
                          variant={quoteListPosition === "bottom" ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateSetting("quoteListPosition", "bottom")}
                          data-testid="button-position-bottom"
                        >
                          Bottom
                        </Button>
                        <Button
                          variant={quoteListPosition === "right" ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateSetting("quoteListPosition", "right")}
                          data-testid="button-position-right"
                        >
                          Right Side
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Pricing</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium mb-1 block">USD to NZD Conversion Rate</Label>
                      <p className="text-xs text-muted-foreground mb-2">Applied to material prices stored in USD (profiles and accessories)</p>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.1"
                        max="5"
                        value={usdToNzdRate}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v) && v > 0) updateSetting("usdToNzdRate", v);
                        }}
                        className="w-32"
                        data-testid="input-usd-nzd-rate"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-1 block">GST Rate (%)</Label>
                      <p className="text-xs text-muted-foreground mb-2">Applied to all sell-side totals on quotes and summaries</p>
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={gstRate}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v) && v >= 0) updateSetting("gstRate", v);
                        }}
                        className="w-32"
                        data-testid="input-gst-rate"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="organisation">
              <OrgSettingsTab />
            </TabsContent>

            <TabsContent value="divisions">
              <DivisionSettingsTab />
            </TabsContent>

            <TabsContent value="numbering">
              <NumberingTab />
            </TabsContent>

            <TabsContent value="template">
              <TemplateBuilderTab />
            </TabsContent>

            <TabsContent value="system">
              <SystemTab />
            </TabsContent>

            <TabsContent value="xero">
              <XeroStatusTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
