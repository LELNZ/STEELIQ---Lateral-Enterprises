export interface FrameTypeOption {
  value: string;
  label: string;
  categories: string[];
  pricePerKg: number | null;
}

export const FRAME_TYPES: FrameTypeOption[] = [
  { value: "ES52-Window", label: "ES52 Window", categories: ["windows-standard"], pricePerKg: null },
  { value: "ES52-HingeDoor", label: "ES52 Hinge Door", categories: ["hinge-door"], pricePerKg: null },
  { value: "EntranceDoor", label: "Entrance Door", categories: ["entrance-door"], pricePerKg: null },
  { value: "FrenchDoor", label: "French Door", categories: ["french-door"], pricePerKg: null },
  { value: "ES70-BifoldDoor", label: "ES70 Bifold Door", categories: ["bifold-door"], pricePerKg: null },
  { value: "ES127-SlidingWindow", label: "ES127 Sliding Window", categories: ["sliding-window"], pricePerKg: null },
  { value: "ES127-SlidingDoor", label: "ES127 Sliding Door", categories: ["sliding-door"], pricePerKg: null },
  { value: "ES52-BayWindow", label: "ES52 Bay Window", categories: ["bay-window"], pricePerKg: null },
  { value: "ES127-StackerDoor", label: "ES127 Stacker Door", categories: ["stacker-door"], pricePerKg: null },
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
  { value: "H3-Pine-19mm-Grooved", label: "H3 Paint Quality Pine 19mm Grooved", priceProvision: 12.50 },
  { value: "H3-Pine-19mm-MiterCut", label: "H3 Paint Quality Pine 19mm Miter Cut", priceProvision: 12.50 },
];

export interface HandleOption {
  value: string;
  label: string;
  priceProvision: number | null;
}

export const WINDOW_HANDLES: HandleOption[] = [
  { value: "Helix-Venting-Double-Tongue", label: "Helix Seal - Venting Double Tongue Window Handle", priceProvision: 28.50 },
  { value: "Helix-Low-Profile", label: "Helix Seal - Low Profile Window Handle", priceProvision: 24.00 },
  { value: "Miro-Standard-Wedgeless", label: "Miro - Standard Wedgeless Window Handle", priceProvision: 22.00 },
];

export const DOOR_HANDLES: HandleOption[] = [
  { value: "Standard-D-Type", label: "Standard D-Type Handle", priceProvision: 45.00 },
];

export interface HandleCategoryDef {
  type: string;
  label: string;
  frameTypeValue: string;
  defaults: HandleOption[];
}

export const HANDLE_CATEGORIES: HandleCategoryDef[] = [
  { type: "awning_handle", label: "Awning Window Handles", frameTypeValue: "ES52-Window", defaults: [
    { value: "Helix-Venting-Double-Tongue", label: "Helix Seal - Venting Double Tongue Window Handle", priceProvision: 28.50 },
    { value: "Helix-Low-Profile", label: "Helix Seal - Low Profile Window Handle", priceProvision: 24.00 },
    { value: "Miro-Standard-Wedgeless", label: "Miro - Standard Wedgeless Window Handle", priceProvision: 22.00 },
  ]},
  { type: "sliding_window_handle", label: "Sliding Window Handles", frameTypeValue: "ES127-SlidingWindow", defaults: [
    { value: "Helix-Venting-Double-Tongue", label: "Helix Seal - Venting Double Tongue Window Handle", priceProvision: 28.50 },
    { value: "Helix-Low-Profile", label: "Helix Seal - Low Profile Window Handle", priceProvision: 24.00 },
  ]},
  { type: "entrance_door_handle", label: "Entrance Door Handles", frameTypeValue: "EntranceDoor", defaults: [
    { value: "Standard-D-Type", label: "Standard D-Type Handle", priceProvision: 45.00 },
  ]},
  { type: "hinge_door_handle", label: "Hinge Door Handles", frameTypeValue: "ES52-HingeDoor", defaults: [
    { value: "Standard-D-Type", label: "Standard D-Type Handle", priceProvision: 45.00 },
  ]},
  { type: "sliding_door_handle", label: "Sliding Door Handles", frameTypeValue: "ES127-SlidingDoor", defaults: [
    { value: "Standard-D-Type", label: "Standard D-Type Handle", priceProvision: 45.00 },
  ]},
  { type: "bifold_door_handle", label: "Bifold Door Handles", frameTypeValue: "ES70-BifoldDoor", defaults: [
    { value: "Standard-D-Type", label: "Standard D-Type Handle", priceProvision: 45.00 },
  ]},
  { type: "stacker_door_handle", label: "Stacker Door Handles", frameTypeValue: "ES127-StackerDoor", defaults: [
    { value: "Standard-D-Type", label: "Standard D-Type Handle", priceProvision: 45.00 },
  ]},
];

const CATEGORY_TO_HANDLE_TYPE: Record<string, string> = {
  "windows-standard": "awning_handle",
  "bay-window": "awning_handle",
  "sliding-window": "sliding_window_handle",
  "entrance-door": "entrance_door_handle",
  "hinge-door": "hinge_door_handle",
  "french-door": "hinge_door_handle",
  "sliding-door": "sliding_door_handle",
  "bifold-door": "bifold_door_handle",
  "stacker-door": "stacker_door_handle",
};

export function getHandleTypeForCategory(category: string): string {
  return CATEGORY_TO_HANDLE_TYPE[category] || "awning_handle";
}

export function getFrameTypesForCategory(category: string): FrameTypeOption[] {
  return FRAME_TYPES.filter((ft) => ft.categories.includes(category));
}

export const DOOR_CATEGORIES = ["entrance-door", "hinge-door", "french-door", "bifold-door", "stacker-door", "sliding-door"];
export const WINDOW_CATEGORIES = ["windows-standard", "sliding-window", "bay-window"];

export function getHandlesForCategory(category: string): HandleOption[] {
  const handleType = getHandleTypeForCategory(category);
  const cat = HANDLE_CATEGORIES.find((c) => c.type === handleType);
  if (cat) return cat.defaults;
  if (DOOR_CATEGORIES.includes(category)) return DOOR_HANDLES;
  return WINDOW_HANDLES;
}
