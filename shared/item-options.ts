export interface FrameTypeOption {
  value: string;
  label: string;
  categories: string[];
  pricePerKg: number | null;
}

export const FRAME_TYPES: FrameTypeOption[] = [
  { value: "ES52-Window", label: "ES52 Window", categories: ["windows-standard", "raked-fixed"], pricePerKg: null },
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
  supplierCode: string;
}

export const FRAME_COLORS: FrameColorOption[] = [
  { value: "Dulux Iron Sand", label: "Dulux Iron Sand", priceProvision: null, supplierCode: "HYX87838" },
  { value: "Dulux Flax Pod", label: "Dulux Flax Pod", priceProvision: null, supplierCode: "JL3600" },
  { value: "Dulux Arctic White", label: "Dulux Arctic White", priceProvision: null, supplierCode: "" },
  { value: "Dulux Black", label: "Dulux Black", priceProvision: null, supplierCode: "" },
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
  categoryMatch: string;
  defaults: HandleOption[];
}

export const HANDLE_CATEGORIES: HandleCategoryDef[] = [
  { type: "awning_handle", label: "Awning Window Handles", frameTypeValue: "ES52-Window", categoryMatch: "windows-standard", defaults: [
    { value: "Helix-Venting-Double-Tongue", label: "Helix Seal - Venting Double Tongue Window Handle", priceProvision: 28.50 },
    { value: "Helix-Low-Profile", label: "Helix Seal - Low Profile Window Handle", priceProvision: 24.00 },
    { value: "Miro-Standard-Wedgeless", label: "Miro - Standard Wedgeless Window Handle", priceProvision: 22.00 },
  ]},
  { type: "sliding_window_handle", label: "Sliding Window Handles", frameTypeValue: "ES127-SlidingWindow", categoryMatch: "sliding-window", defaults: [
    { value: "Helix-Venting-Double-Tongue", label: "Helix Seal - Venting Double Tongue Window Handle", priceProvision: 28.50 },
    { value: "Helix-Low-Profile", label: "Helix Seal - Low Profile Window Handle", priceProvision: 24.00 },
  ]},
  { type: "entrance_door_handle", label: "Entrance Door Handles", frameTypeValue: "EntranceDoor", categoryMatch: "entrance-door", defaults: [
    { value: "Standard-D-Type", label: "Standard D-Type Handle", priceProvision: 45.00 },
  ]},
  { type: "hinge_door_handle", label: "Hinge Door Handles", frameTypeValue: "ES52-HingeDoor", categoryMatch: "hinge-door", defaults: [
    { value: "Standard-D-Type", label: "Standard D-Type Handle", priceProvision: 45.00 },
  ]},
  { type: "sliding_door_handle", label: "Sliding Door Handles", frameTypeValue: "ES127-SlidingDoor", categoryMatch: "sliding-door", defaults: [
    { value: "Standard-D-Type", label: "Standard D-Type Handle", priceProvision: 45.00 },
  ]},
  { type: "bifold_door_handle", label: "Bifold Door Handles", frameTypeValue: "ES70-BifoldDoor", categoryMatch: "bifold-door", defaults: [
    { value: "Standard-D-Type", label: "Standard D-Type Handle", priceProvision: 45.00 },
  ]},
  { type: "stacker_door_handle", label: "Stacker Door Handles", frameTypeValue: "ES127-StackerDoor", categoryMatch: "stacker-door", defaults: [
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
export const WINDOW_CATEGORIES = ["windows-standard", "sliding-window", "bay-window", "raked-fixed"];

export function getHandlesForCategory(category: string): HandleOption[] {
  const handleType = getHandleTypeForCategory(category);
  const cat = HANDLE_CATEGORIES.find((c) => c.type === handleType);
  if (cat) return cat.defaults;
  if (DOOR_CATEGORIES.includes(category)) return DOOR_HANDLES;
  return WINDOW_HANDLES;
}

export interface LockOption {
  value: string;
  label: string;
  priceProvision: number | null;
}

export const DOOR_LOCKS: LockOption[] = [
  { value: "Lockwood-Selector-Entry", label: "Lockwood Selector Entry Lock", priceProvision: 85.00 },
  { value: "Yale-Assure-Deadbolt", label: "Yale Assure Deadbolt", priceProvision: 120.00 },
  { value: "Customer-Supplied", label: "Customer Supplied", priceProvision: null },
  { value: "TBC", label: "TBC", priceProvision: null },
  { value: "Custom-Local-Supply", label: "Custom / Local Supply", priceProvision: null },
];

export interface LockCategoryDef {
  type: string;
  label: string;
  categoryMatch: string;
  defaults: LockOption[];
}

export const LOCK_CATEGORIES: LockCategoryDef[] = [
  { type: "entrance_door_lock", label: "Entry Door Locks", categoryMatch: "entrance-door", defaults: [...DOOR_LOCKS] },
  { type: "hinge_door_lock", label: "Hinge Door Locks", categoryMatch: "hinge-door", defaults: [...DOOR_LOCKS] },
  { type: "sliding_door_lock", label: "Sliding Door Locks", categoryMatch: "sliding-door", defaults: [...DOOR_LOCKS] },
  { type: "bifold_door_lock", label: "Bifold Door Locks", categoryMatch: "bifold-door", defaults: [...DOOR_LOCKS] },
  { type: "stacker_door_lock", label: "Stacker Door Locks", categoryMatch: "stacker-door", defaults: [...DOOR_LOCKS] },
  { type: "french_door_lock", label: "French Door Locks", categoryMatch: "french-door", defaults: [...DOOR_LOCKS] },
];

const CATEGORY_TO_LOCK_TYPE: Record<string, string> = {
  "entrance-door": "entrance_door_lock",
  "hinge-door": "hinge_door_lock",
  "french-door": "french_door_lock",
  "sliding-door": "sliding_door_lock",
  "bifold-door": "bifold_door_lock",
  "stacker-door": "stacker_door_lock",
};

export function getLockTypeForCategory(category: string): string {
  return CATEGORY_TO_LOCK_TYPE[category] || "";
}

export function getLocksForCategory(category: string): LockOption[] {
  const lockType = getLockTypeForCategory(category);
  if (!lockType) return [];
  const cat = LOCK_CATEGORIES.find((c) => c.type === lockType);
  return cat ? cat.defaults : DOOR_LOCKS;
}

export function isDoorCategory(category: string): boolean {
  return DOOR_CATEGORIES.includes(category);
}

export interface WanzBarOption {
  value: string;
  label: string;
  sectionNumber: string;
  kgPerMetre: number;
  pricePerKgUsd: number;
  priceNzdPerLinM: number;
}

export const WANZ_BAR_DEFAULTS: WanzBarOption[] = [
  { value: "36352", label: "19mm Sill Support Bar", sectionNumber: "36352", kgPerMetre: 0.525, pricePerKgUsd: 0, priceNzdPerLinM: 0 },
  { value: "36353", label: "30mm Sill Support Bar", sectionNumber: "36353", kgPerMetre: 0.591, pricePerKgUsd: 0, priceNzdPerLinM: 0 },
  { value: "36354", label: "40mm Sill Support Bar", sectionNumber: "36354", kgPerMetre: 0.793, pricePerKgUsd: 0, priceNzdPerLinM: 0 },
  { value: "34370", label: "55mm Sill Support Bar", sectionNumber: "34370", kgPerMetre: 0.678, pricePerKgUsd: 0, priceNzdPerLinM: 0 },
  { value: "36355", label: "55mm Sill Support Bar (New)", sectionNumber: "36355", kgPerMetre: 0.978, pricePerKgUsd: 0, priceNzdPerLinM: 0 },
  { value: "36356", label: "55mm Full Length Sill Support Bar", sectionNumber: "36356", kgPerMetre: 1.173, pricePerKgUsd: 0, priceNzdPerLinM: 0 },
];
