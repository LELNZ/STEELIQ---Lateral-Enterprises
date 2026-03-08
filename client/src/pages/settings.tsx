import { useState, useEffect, useRef } from "react";
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
import { Settings as SettingsIcon, Save, Loader2, Upload, X, ClipboardList } from "lucide-react";
import { useSettings, type QuoteListPosition } from "@/lib/settings-context";
import { useToast } from "@/hooks/use-toast";
import { getPresetsForDivision, PRESET_FIELD_LABELS, type SiteVisitPreset } from "@/lib/site-visit-presets";

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
              <CardTitle className="text-base">Quote Presentation</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Company master template controls document structure, section ordering, and acceptance block. Division overrides control branding and layout options below.</p>
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
          </Tabs>
        </div>
      </div>
    </div>
  );
}
