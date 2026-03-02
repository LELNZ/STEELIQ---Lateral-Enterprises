import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon } from "lucide-react";
import { useSettings, type QuoteListPosition } from "@/lib/settings-context";

export default function Settings() {
  const { quoteListPosition, usdToNzdRate, gstRate, updateSetting } = useSettings();

  return (
    <div className="flex flex-col h-full bg-background" data-testid="settings-page">
      <header className="border-b px-6 py-3 flex items-center gap-3 bg-card shrink-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary">
          <SettingsIcon className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight" data-testid="text-settings-title">Settings</h1>
          <p className="text-xs text-muted-foreground">Global application preferences</p>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-xl mx-auto space-y-4">
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
      </div>
    </div>
  );
}
