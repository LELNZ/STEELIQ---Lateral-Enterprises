export interface FrameTypeOption {
  value: string;
  label: string;
  categories: string[];
  pricePerKg: number | null;
}

export const FRAME_TYPES: FrameTypeOption[] = [
  { value: "ES52-Window", label: "ES52 Window", categories: ["windows-standard", "bay-window"], pricePerKg: null },
  { value: "ES52-HingeDoor", label: "ES52 Hinge Door", categories: ["hinge-door"], pricePerKg: null },
  { value: "EntranceDoor", label: "Entrance Door", categories: ["entrance-door"], pricePerKg: null },
  { value: "FrenchDoor", label: "French Door", categories: ["french-door"], pricePerKg: null },
  { value: "ES70-BifoldDoor", label: "ES70 Bifold Door", categories: ["bifold-door"], pricePerKg: null },
  { value: "ES127-SlidingWindow", label: "ES127 Sliding Window", categories: ["sliding-window"], pricePerKg: null },
  { value: "ES127-SlidingDoor", label: "ES127 Sliding Door", categories: ["sliding-door", "stacker-door"], pricePerKg: null },
];

export interface FrameColorOption {
  value: string;
  label: string;
  priceProvision: number | null;
}

export const FRAME_COLORS: FrameColorOption[] = [
  { value: "Dulux Iron Sand", label: "Dulux Iron Sand", priceProvision: null },
  { value: "Dulux Flax Pod", label: "Dulux Flax Pod", priceProvision: null },
  { value: "Dulux Arctic White", label: "Dulux Arctic White", priceProvision: null },
  { value: "Dulux Black", label: "Dulux Black", priceProvision: null },
];

export const FLASHING_SIZES: number[] = [];
for (let s = 35; s <= 95; s += 5) FLASHING_SIZES.push(s);

export const WIND_ZONES = ["Low", "Medium", "High", "Very High", "Extra High"] as const;

export interface LinerTypeOption {
  value: string;
  label: string;
  priceProvision: number | null;
}

export const LINER_TYPES: LinerTypeOption[] = [
  { value: "H3-Pine-19mm-Grooved", label: "H3 Paint Quality Pine 19mm Grooved", priceProvision: null },
  { value: "H3-Pine-19mm-MiterCut", label: "H3 Paint Quality Pine 19mm Miter Cut", priceProvision: null },
];

export interface HandleOption {
  value: string;
  label: string;
  priceProvision: number | null;
}

export const WINDOW_HANDLES: HandleOption[] = [
  { value: "Helix-Venting-Double-Tongue", label: "Helix Seal - Venting Double Tongue Window Handle", priceProvision: null },
  { value: "Helix-Low-Profile", label: "Helix Seal - Low Profile Window Handle", priceProvision: null },
  { value: "Miro-Standard-Wedgeless", label: "Miro - Standard Wedgeless Window Handle", priceProvision: null },
];

export const DOOR_HANDLES: HandleOption[] = [
  { value: "Standard-D-Type", label: "Standard D-Type Handle", priceProvision: null },
];

export function getFrameTypesForCategory(category: string): FrameTypeOption[] {
  return FRAME_TYPES.filter((ft) => ft.categories.includes(category));
}

export const DOOR_CATEGORIES = ["entrance-door", "hinge-door", "french-door", "bifold-door", "stacker-door", "sliding-door"];
export const WINDOW_CATEGORIES = ["windows-standard", "sliding-window", "bay-window"];

export function getHandlesForCategory(category: string): HandleOption[] {
  if (DOOR_CATEGORIES.includes(category)) return DOOR_HANDLES;
  return WINDOW_HANDLES;
}
