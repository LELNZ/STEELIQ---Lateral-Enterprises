import { z } from "zod";
import type { DomainType } from "./schema";

const snapshotPhotoSchema = z.object({
  key: z.string(),
  isPrimary: z.boolean().optional(),
  includeInCustomerPdf: z.boolean().optional(),
  caption: z.string().optional(),
  takenAt: z.string().optional(),
});

export const laserSnapshotItemSchema = z.object({
  itemNumber: z.number(),
  itemRef: z.string(),
  title: z.string(),
  quantity: z.number(),
  materialType: z.string().default(""),
  materialGrade: z.string().default(""),
  thickness: z.number().default(0),
  length: z.number().default(0),
  width: z.number().default(0),
  finish: z.string().default(""),
  customerNotes: z.string().default(""),
  internalNotes: z.string().default(""),
  unitPrice: z.number().default(0),
  photos: z.array(snapshotPhotoSchema).optional().default([]),

  llSheetMaterialId: z.string().default(""),
  supplierName: z.string().default(""),
  sheetLength: z.number().default(0),
  sheetWidth: z.number().default(0),
  pricePerSheetExGst: z.number().default(0),
  cutLengthMm: z.number().default(0),
  pierceCount: z.number().default(0),
  setupMinutes: z.number().default(0),
  handlingMinutes: z.number().default(0),
  markupPercent: z.number().default(0),
  utilisationFactor: z.number().default(0),
  materialCostTotal: z.number().default(0),
  processCostTotal: z.number().default(0),
  setupHandlingCost: z.number().default(0),
  internalCostSubtotal: z.number().default(0),
  markupAmount: z.number().default(0),
  sellTotal: z.number().default(0),
});

export type LaserSnapshotItem = z.infer<typeof laserSnapshotItemSchema>;

const snapshotItemSchema = z.object({
  itemNumber: z.number(),
  itemRef: z.string(),
  title: z.string(),
  quantity: z.number(),
  width: z.number(),
  height: z.number(),
  category: z.string().optional(),
  rakedLeftHeight: z.number().optional(),
  rakedRightHeight: z.number().optional(),
  bayAngle: z.number().optional(),
  bayDepth: z.number().optional(),
  openingDirection: z.string().optional(),
  gosRequired: z.boolean().optional(),
  gosChargeNzd: z.number().optional(),
  catDoorEnabled: z.boolean().optional(),
  drawingImageKey: z.string().optional(),
  photos: z.array(snapshotPhotoSchema).optional().default([]),
  paneGlassSpecs: z.array(z.object({
    paneIndex: z.number(),
    iguType: z.string(),
    glassType: z.string(),
    glassThickness: z.string(),
  })).optional().default([]),
  specValues: z.record(z.string(), z.any()).default({}),
  resolvedSpecs: z.record(z.string(), z.string()).default({}),
  libraryRefs: z.any().optional(),
});

const totalsBreakdownSchema = z.object({
  itemsSubtotal: z.number().default(0),
  installationTotal: z.number().default(0),
  deliveryTotal: z.number().default(0),
  removalTotal: z.number().default(0),
  rubbishTotal: z.number().default(0),
  subtotalExclGst: z.number().default(0),
  gstAmount: z.number().default(0),
  totalInclGst: z.number().default(0),
});

export const estimateSnapshotSchema = z.object({
  divisionCode: z.string().default(""),
  customer: z.string().default("Unknown"),
  specDictionaryVersion: z.number().optional().default(1),
  items: z.array(snapshotItemSchema).default([]),
  laserItems: z.array(laserSnapshotItemSchema).default([]).optional(),
  totalsBreakdown: totalsBreakdownSchema.default({}),

  division: z.string().default("").optional(),
  assemblies: z.array(z.any()).default([]).optional(),
  lineItems: z.array(z.any()).default([]).optional(),
  operations: z.array(z.any()).default([]).optional(),
  totals: z.object({
    cost: z.number(),
    sell: z.number(),
    grossProfit: z.number(),
    grossMargin: z.number(),
    totalLabourHours: z.number(),
    gpPerHour: z.number(),
  }).optional(),
  overheadAllocation: z.number().optional(),
  netProfitEstimate: z.number().optional(),
  exclusions: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
});

export type EstimateSnapshot = z.infer<typeof estimateSnapshotSchema>;
export type SnapshotItem = z.infer<typeof snapshotItemSchema>;
export type TotalsBreakdown = z.infer<typeof totalsBreakdownSchema>;

export type JoinerySnapshotItem = SnapshotItem;

export type LaserSnapshotItemBase = LaserSnapshotItem;

export interface EngineeringSnapshotItemBase {
  domain: "engineering";
  itemNumber: number;
  itemRef: string;
  title: string;
  quantity: number;
}

export type DomainSnapshotItemEnvelope =
  | { domain: "joinery"; item: JoinerySnapshotItem }
  | { domain: "laser"; item: LaserSnapshotItemBase }
  | { domain: "engineering"; item: EngineeringSnapshotItemBase };

export function resolveSnapshotItemDomain(
  item: SnapshotItem,
  quoteDomainType: DomainType
): "joinery" | "laser" | "engineering" {
  if (quoteDomainType === "laser") return "laser";
  if (quoteDomainType === "engineering") return "engineering";
  return "joinery";
}
