import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Settings as SettingsIcon, Save, Loader2, Upload, X, ClipboardList, Palette, Eye, EyeOff, RotateCcw } from "lucide-react";
import { useSettings, type QuoteListPosition } from "@/lib/settings-context";
import { useToast } from "@/hooks/use-toast";
import { getPresetsForDivision, PRESET_FIELD_LABELS, type SiteVisitPreset } from "@/lib/site-visit-presets";
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
} from "@/lib/quote-template";

interface OrgSettings {
  id: string;
  legalName: string;
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
  fontFamily: string | null;
  accentColor: string | null;
  logoPosition: string | null;
  headerVariant: string | null;
  scheduleLayoutVariant: string;
  totalsLayoutVariant: string;
  specDisplayDefaultsJson: string[] | null;
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
            <Textarea
              value={form.bankDetails || ""}
              onChange={(e) => setForm({ ...form, bankDetails: e.target.value })}
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
            <Textarea
              value={form.defaultHeaderNotesBlock || ""}
              onChange={(e) => setForm({ ...form, defaultHeaderNotesBlock: e.target.value })}
              rows={3}
              data-testid="input-org-defaultHeaderNotesBlock"
            />
          </div>
          <div>
            <Label className="text-sm font-medium mb-1 block">Default Terms</Label>
            <Textarea
              value={form.defaultTermsBlock || ""}
              onChange={(e) => setForm({ ...form, defaultTermsBlock: e.target.value })}
              rows={4}
              data-testid="input-org-defaultTermsBlock"
            />
          </div>
          <div>
            <Label className="text-sm font-medium mb-1 block">Default Exclusions</Label>
            <Textarea
              value={form.defaultExclusionsBlock || ""}
              onChange={(e) => setForm({ ...form, defaultExclusionsBlock: e.target.value })}
              rows={3}
              data-testid="input-org-defaultExclusionsBlock"
            />
          </div>
          <div>
            <Label className="text-sm font-medium mb-1 block">Payment Terms</Label>
            <Textarea
              value={form.paymentTermsBlock || ""}
              onChange={(e) => setForm({ ...form, paymentTermsBlock: e.target.value })}
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

function SiteVisitPresetsCard({ divisionCode }: { divisionCode: string }) {
  const presets = getPresetsForDivision(divisionCode);

  if (presets.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground" data-testid="text-presets-placeholder">
          <ClipboardList className="w-5 h-5 mx-auto mb-2 opacity-50" />
          No site visit presets configured for {divisionCode} yet
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Site Visit Presets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Default values applied when an estimator selects a site type in the quote builder. These are read-only for now — full editing coming soon.
        </p>
        {presets.map((preset) => (
          <div key={preset.presetKey} className="border rounded-lg p-3" data-testid={`preset-card-${preset.presetKey}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">{preset.label}</span>
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{preset.presetKey}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{preset.description}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {(Object.entries(preset.defaults) as [keyof typeof PRESET_FIELD_LABELS, string | number | undefined][])
                .filter(([, v]) => v !== undefined)
                .map(([key, value]) => (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{PRESET_FIELD_LABELS[key]}</span>
                    <span className="font-mono">{String(value)}</span>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function LogoUploadField({ logoUrl, onLogoChange }: { logoUrl: string; onLogoChange: (url: string) => void }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showUrlFallback, setShowUrlFallback] = useState(false);

  const isUploadedLogo = logoUrl.startsWith("/api/drawing-images/");

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

      const pngBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to convert"))), "image/png");
      });

      const formData = new FormData();
      formData.append("file", pngBlob, "logo.png");
      const res = await fetch("/api/drawing-images", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { key } = await res.json();
      onLogoChange(`/api/drawing-images/${key}`);
      toast({ title: "Logo uploaded" });
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
          {uploading ? "Uploading..." : "Upload Logo"}
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
  const [selectedCode, setSelectedCode] = useState("LJ");

  const { data: div, isLoading } = useQuery<DivisionSettings>({
    queryKey: ["/api/settings/divisions", selectedCode],
  });

  const { data: specEntries } = useQuery<SpecEntry[]>({
    queryKey: ["/api/spec-dictionary", selectedCode],
    queryFn: () => fetch(`/api/spec-dictionary?scope=${selectedCode}`).then(r => r.json()),
  });

  const [form, setForm] = useState<Partial<DivisionSettings>>({});

  useEffect(() => {
    setForm({});
  }, [selectedCode]);

  useEffect(() => {
    if (div) setForm(div);
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
    mutation.mutate(form);
  };

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
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Branding</CardTitle>
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
              <CardTitle className="text-base">Quote Presentation — Division Override</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Override the company master template defaults for this division. Base template structure is managed in the Template tab.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-1 block">Company Template</Label>
                <Input value="company_master_v1" disabled data-testid="input-div-templateKey" />
                <p className="text-xs text-muted-foreground mt-1">System-controlled — shared across all divisions</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium mb-1 block">Schedule Layout (Division Override)</Label>
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
                  <Label className="text-sm font-medium mb-1 block">Totals Layout (Division Override)</Label>
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
              <CardTitle className="text-base">Theme</CardTitle>
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
                      <SelectValue placeholder="Select position" />
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
                      <SelectValue placeholder="Select variant" />
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
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Override the organisation-level defaults for this division. Leave blank to use the org default.
              </p>
              <div>
                <Label className="text-sm font-medium mb-1 block">Terms Override</Label>
                <Textarea
                  value={form.termsOverrideBlock || ""}
                  onChange={(e) => setForm({ ...form, termsOverrideBlock: e.target.value })}
                  rows={3}
                  data-testid="input-div-termsOverrideBlock"
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-1 block">Header Notes Override</Label>
                <Textarea
                  value={form.headerNotesOverrideBlock || ""}
                  onChange={(e) => setForm({ ...form, headerNotesOverrideBlock: e.target.value })}
                  rows={3}
                  data-testid="input-div-headerNotesOverrideBlock"
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-1 block">Exclusions Override</Label>
                <Textarea
                  value={form.exclusionsOverrideBlock || ""}
                  onChange={(e) => setForm({ ...form, exclusionsOverrideBlock: e.target.value })}
                  rows={3}
                  data-testid="input-div-exclusionsOverrideBlock"
                />
              </div>
            </CardContent>
          </Card>

          {visibleSpecs.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Spec Display Defaults</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  Select which specs appear by default on customer quotes for {selectedCode}
                </p>
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

          <SiteVisitPresetsCard divisionCode={selectedCode} />

          <div className="flex justify-end">
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
    if (savedConfig && Object.keys(savedConfig).length > 0) {
      setConfig(savedConfig);
    }
  }, [savedConfig]);

  const sections: TemplateSectionDef[] = config.sections || COMPANY_MASTER_TEMPLATE.sections;

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
                <p className="text-xs text-muted-foreground mb-2">Controls items per page — affects drawing size, spec rows, padding, and gaps in both preview and PDF</p>
                <Select
                  value={config.densityPreset || "standard"}
                  onValueChange={(v) => setConfig({ ...config, densityPreset: v as DensityPreset })}
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
                    <SelectItem value="small">Small — 18mm max</SelectItem>
                    <SelectItem value="medium">Medium — 25mm max</SelectItem>
                    <SelectItem value="large">Large — 40mm max</SelectItem>
                  </SelectContent>
                </Select>
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
        <div className="max-w-2xl mx-auto">
          <Tabs defaultValue="application">
            <TabsList className="mb-4 overflow-x-auto">
              <TabsTrigger value="application" data-testid="tab-application">Application</TabsTrigger>
              <TabsTrigger value="organisation" data-testid="tab-organisation">Organisation</TabsTrigger>
              <TabsTrigger value="divisions" data-testid="tab-divisions">Divisions</TabsTrigger>
              <TabsTrigger value="template" data-testid="tab-template">
                <Palette className="w-3.5 h-3.5 mr-1.5" />
                Template
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

            <TabsContent value="template">
              <TemplateBuilderTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
