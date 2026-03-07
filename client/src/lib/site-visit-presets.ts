export interface SiteVisitPresetDefaults {
  frameType?: string;
  glassIguType?: string;
  glassType?: string;
  glassThickness?: string;
  linerType?: string;
  handleType?: string;
  wallThickness?: number;
  windZone?: string;
}

export interface SiteVisitPreset {
  divisionCode: string;
  presetKey: string;
  label: string;
  description: string;
  defaults: SiteVisitPresetDefaults;
}

export const SEED_PRESETS: SiteVisitPreset[] = [
  {
    divisionCode: "LJ",
    presetKey: "renovation",
    label: "Renovation",
    description: "Typical retrofit into existing timber frame — ES52, EnergySaver IGU, 90mm wall",
    defaults: {
      frameType: "ES52",
      glassIguType: "EnergySaver",
      glassType: "Clear/Clear",
      wallThickness: 90,
      windZone: "Extra High",
      linerType: "MiterCut",
    },
  },
  {
    divisionCode: "LJ",
    presetKey: "new_build",
    label: "New Build",
    description: "New construction — 140mm wall thickness, other specs per selection",
    defaults: {
      wallThickness: 140,
    },
  },
];

export function getPresetsForDivision(divisionCode: string): SiteVisitPreset[] {
  return SEED_PRESETS.filter((p) => p.divisionCode === divisionCode);
}

export const PRESET_FIELD_LABELS: Record<keyof SiteVisitPresetDefaults, string> = {
  frameType: "Frame Type",
  glassIguType: "Glass IGU Type",
  glassType: "Glass Type",
  glassThickness: "Glass Thickness",
  linerType: "Liner Type",
  handleType: "Handle Type",
  wallThickness: "Wall Thickness (mm)",
  windZone: "Wind Zone",
};
