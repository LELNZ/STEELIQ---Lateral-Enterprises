import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings as SettingsIcon } from "lucide-react";
import { useSettings, type QuoteListPosition } from "@/lib/settings-context";

export default function Settings() {
  const { showLegendDefault, quoteListPosition, updateSetting } = useSettings();

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
              <CardTitle className="text-base">Drawing Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Show Legend by Default</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Display the drawing legend on new items</p>
                </div>
                <Switch
                  checked={showLegendDefault}
                  onCheckedChange={(v) => updateSetting("showLegendDefault", v)}
                  data-testid="switch-legend-default"
                />
              </div>
            </CardContent>
          </Card>

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
        </div>
      </div>
    </div>
  );
}
