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

export interface JobTypePresetsConfig {
  renovation?: SiteVisitPresetDefaults;
  new_build?: SiteVisitPresetDefaults;
}

export const SEED_PRESETS: Record<string, JobTypePresetsConfig> = {
  LJ: {
    renovation: {
      frameType: "ES52",
      glassIguType: "EnergySaver",
      glassType: "Clear/Clear",
      wallThickness: 90,
      windZone: "Extra High",
      linerType: "MiterCut",
    },
    new_build: {
      wallThickness: 140,
    },
  },
};

export function resolvePresetsForDivision(
  divisionCode: string,
  persisted?: JobTypePresetsConfig | null,
): JobTypePresetsConfig {
  const seed = SEED_PRESETS[divisionCode] || {};
  if (!persisted || Object.keys(persisted).length === 0) {
    return seed;
  }
  return {
    renovation: { ...seed.renovation, ...persisted.renovation },
    new_build: { ...seed.new_build, ...persisted.new_build },
  };
}

export function getPresetsForDivision(divisionCode: string, persisted?: JobTypePresetsConfig | null): SiteVisitPreset[] {
  const resolved = resolvePresetsForDivision(divisionCode, persisted);
  const result: SiteVisitPreset[] = [];
  if (resolved.renovation) {
    result.push({
      divisionCode,
      presetKey: "renovation",
      label: "Renovation",
      description: "Typical retrofit into existing frame — defaults applied when Renovation is selected in Quote Builder",
      defaults: resolved.renovation,
    });
  }
  if (resolved.new_build) {
    result.push({
      divisionCode,
      presetKey: "new_build",
      label: "New Build",
      description: "New construction defaults — applied when New Build is selected in Quote Builder",
      defaults: resolved.new_build,
    });
  }
  return result;
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

export const PRESET_FIELD_KEYS: (keyof SiteVisitPresetDefaults)[] = [
  "frameType",
  "glassIguType",
  "glassType",
  "glassThickness",
  "linerType",
  "handleType",
  "wallThickness",
  "windZone",
];
