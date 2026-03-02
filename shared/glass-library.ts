export interface GlassEntry {
  iguType: "EnergySaver" | "LightBridge";
  combo: string;
  prices: Record<string, number>;
}

export const GLASS_LIBRARY: GlassEntry[] = [
  { iguType: "EnergySaver", combo: "Clear // EnergySaver", prices: { "4/4": 96.29, "5/4": 102.33, "5/5": 108.37, "6/5": 121.57, "6/6": 134.76 } },
  { iguType: "EnergySaver", combo: "Clear // EnergySaver - Toughened any one side", prices: { "4/4": 147.18, "5/4": 153.22, "5/5": 157.25, "6/5": 170.45, "6/6": 182.96 } },
  { iguType: "EnergySaver", combo: "Clear Toughened // EnergySaver Toughened", prices: { "4/4": 198.08, "5/4": 202.11, "5/5": 206.14, "6/5": 218.63, "6/6": 231.14 } },
  { iguType: "EnergySaver", combo: "Tint // EnergySaver", prices: { "4/4": 113.05, "5/4": 115.00, "5/5": 121.04, "6/5": 144.50, "6/6": 157.70 } },
  { iguType: "EnergySaver", combo: "Tint // EnergySaver Toughened", prices: { "4/4": 163.94, "5/4": 165.89, "5/5": 169.91, "6/5": 193.38, "6/6": 205.88 } },
  { iguType: "EnergySaver", combo: "Tint Toughened // EnergySaver", prices: { "4/4": 160.21, "5/4": 166.81, "5/5": 172.86, "6/5": 189.45, "6/6": 202.65 } },
  { iguType: "EnergySaver", combo: "Tint Toughened // EnergySaver Toughened", prices: { "4/4": 211.11, "5/4": 217.71, "5/5": 221.73, "6/5": 238.33, "6/6": 250.84 } },
  { iguType: "EnergySaver", combo: "Obscure // EnergySaver", prices: { "4/4": 110.91, "5/4": 116.95, "5/5": 131.69, "6/5": 144.89, "6/6": 166.05 } },
  { iguType: "EnergySaver", combo: "Obscure Toughened // EnergySaver", prices: { "4/4": 154.30, "5/4": 160.35, "5/5": 166.99, "6/5": 180.17, "6/6": 201.04 } },
  { iguType: "EnergySaver", combo: "Obscure // EnergySaver Toughened", prices: { "4/4": 161.81, "5/4": 165.83, "5/5": 180.56, "6/5": 193.07, "6/6": 214.24 } },
  { iguType: "EnergySaver", combo: "Obscure Toughened // EnergySaver Toughened", prices: { "4/4": 205.21, "5/4": 209.23, "5/5": 215.86, "6/5": 228.37, "6/6": 249.22 } },
  { iguType: "EnergySaver", combo: "Etchlite // EnergySaver", prices: { "4/4": 147.60, "5/4": 153.64, "5/5": 165.01, "6/5": 178.20, "6/6": 186.91 } },
  { iguType: "EnergySaver", combo: "Etchlite Toughened // EnergySaver", prices: { "4/4": 200.39, "5/4": 206.43, "5/5": 217.42, "6/5": 230.61, "6/6": 239.03 } },
  { iguType: "EnergySaver", combo: "Etchlite // EnergySaver Toughened", prices: { "4/4": 198.50, "5/4": 202.52, "5/5": 213.88, "6/5": 226.39, "6/6": 235.10 } },
  { iguType: "EnergySaver", combo: "Etchlite Toughened // EnergySaver Toughened", prices: { "4/4": 251.28, "5/4": 255.31, "5/5": 266.30, "6/5": 278.80, "6/6": 287.22 } },

  { iguType: "LightBridge", combo: "Clear // LightBridge", prices: { "4/4": 126.29, "5/4": 132.33, "5/5": 138.37, "6/5": 151.57, "6/6": 164.76, "8/8": 207.30 } },
  { iguType: "LightBridge", combo: "Clear // LightBridge - Toughened any one side", prices: { "4/4": 177.18, "5/4": 183.22, "5/5": 187.25, "6/5": 200.45, "6/6": 212.96, "8/8": 289.12 } },
  { iguType: "LightBridge", combo: "Clear Toughened // LightBridge Toughened", prices: { "4/4": 228.08, "5/4": 232.11, "5/5": 236.14, "6/5": 248.63, "6/6": 261.14, "8/8": 370.94 } },
  { iguType: "LightBridge", combo: "Tint // LightBridge", prices: { "4/4": 143.05, "5/4": 145.00, "5/5": 151.04, "6/5": 174.50, "6/6": 187.70 } },
  { iguType: "LightBridge", combo: "Tint // LightBridge Toughened", prices: { "4/4": 193.94, "5/4": 195.89, "5/5": 199.91, "6/5": 223.38, "6/6": 235.88 } },
  { iguType: "LightBridge", combo: "Tint Toughened // LightBridge", prices: { "4/4": 190.21, "5/4": 196.81, "5/5": 202.86, "6/5": 219.45, "6/6": 232.65 } },
  { iguType: "LightBridge", combo: "Tint Toughened // LightBridge Toughened", prices: { "4/4": 241.11, "5/4": 247.71, "5/5": 251.73, "6/5": 268.33, "6/6": 280.84 } },
  { iguType: "LightBridge", combo: "Obscure // LightBridge", prices: { "4/4": 140.91, "5/4": 146.95, "5/5": 161.69, "6/5": 174.89, "6/6": 196.05 } },
  { iguType: "LightBridge", combo: "Obscure Toughened // LightBridge", prices: { "4/4": 184.30, "5/4": 190.35, "5/5": 196.99, "6/5": 210.17, "6/6": 231.04 } },
  { iguType: "LightBridge", combo: "Obscure // LightBridge Toughened", prices: { "4/4": 191.81, "5/4": 195.83, "5/5": 210.56, "6/5": 223.07, "6/6": 244.24 } },
  { iguType: "LightBridge", combo: "Obscure Toughened // LightBridge Toughened", prices: { "4/4": 235.21, "5/4": 239.23, "5/5": 245.86, "6/5": 258.37, "6/6": 279.22 } },
  { iguType: "LightBridge", combo: "Etchlite // LightBridge", prices: { "4/4": 177.60, "5/4": 183.64, "5/5": 195.01, "6/5": 208.20, "6/6": 216.91 } },
  { iguType: "LightBridge", combo: "Etchlite Toughened // LightBridge", prices: { "4/4": 230.39, "5/4": 236.43, "5/5": 247.42, "6/5": 260.61, "6/6": 269.03 } },
  { iguType: "LightBridge", combo: "Etchlite // LightBridge Toughened", prices: { "4/4": 228.50, "5/4": 232.52, "5/5": 243.88, "6/5": 256.39, "6/6": 265.10 } },
  { iguType: "LightBridge", combo: "Etchlite Toughened // LightBridge Toughened", prices: { "4/4": 281.28, "5/4": 285.31, "5/5": 296.30, "6/5": 308.80, "6/6": 317.22 } },
];

export const IGU_INFO = {
  EnergySaver: { label: "EnergySaver™ IGU (Entry-level Low-E)", rValue: 0.37 },
  LightBridge: { label: "LightBridge™ IGU (High Performance Low-E)", rValue: 0.46 },
} as const;

export function getGlassCombos(iguType: string): string[] {
  return GLASS_LIBRARY
    .filter((e) => e.iguType === iguType)
    .map((e) => e.combo);
}

export function getAvailableThicknesses(iguType: string, combo: string): string[] {
  const entry = GLASS_LIBRARY.find((e) => e.iguType === iguType && e.combo === combo);
  return entry ? Object.keys(entry.prices) : [];
}

export function getGlassPrice(iguType: string, combo: string, thickness: string): number | null {
  const entry = GLASS_LIBRARY.find((e) => e.iguType === iguType && e.combo === combo);
  return entry?.prices[thickness] ?? null;
}

export function getGlassRValue(iguType: string): number | null {
  const info = IGU_INFO[iguType as keyof typeof IGU_INFO];
  return info?.rValue ?? null;
}
