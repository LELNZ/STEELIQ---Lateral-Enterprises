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
  coilLengthMm: z.number().default(0),
  stockBehaviour: z.string().default("sheet"),
  pricePerKg: z.number().default(0),
  densityKgM3: z.number().default(0),
  pierceCount: z.number().default(0),
  setupMinutes: z.number().default(0),
  handlingMinutes: z.number().default(0),
  markupPercent: z.number().default(0),
  materialMarkupPercent: z.number().default(0).optional(),
  consumablesMarkupPercent: z.number().default(0).optional(),
  utilisationFactor: z.number().default(0),
  estimatedSheets: z.number().default(0),
  materialCostTotal: z.number().default(0),
  processCostTotal: z.number().default(0),
  setupHandlingCost: z.number().default(0),
  internalCostSubtotal: z.number().default(0),
  markupAmount: z.number().default(0),
  sellTotal: z.number().default(0),
  materialBuyCost: z.number().default(0).optional(),
  materialSellCost: z.number().default(0).optional(),
  labourBuyCost: z.number().default(0).optional(),
  labourSellCost: z.number().default(0).optional(),
  machineBuyCost: z.number().default(0).optional(),
  machineSellCost: z.number().default(0).optional(),
  consumablesBuyCost: z.number().default(0).optional(),
  consumablesSellCost: z.number().default(0).optional(),
  gasBuyCost: z.number().default(0).optional(),
  totalBuyCost: z.number().default(0).optional(),
  totalMargin: z.number().default(0).optional(),
  totalMarginPercent: z.number().default(0).optional(),

  geometrySource: z.enum(["manual", "dxf", "cam_import"]).default("manual"),

  operations: z.array(z.object({
    type: z.enum(["laser", "fold"]),
    enabled: z.boolean().default(true),
    costTotal: z.number().default(0),
    notes: z.string().optional(),
  })).optional(),

  // Commercial Override Layer (Phase 5E) — additive, optional.
  // Override is preserved in snapshot so quote revisions reload faithfully.
  // unitPrice and sellTotal in snapshot reflect the FINAL (commercial) values.
  pricingOverrideEnabled: z.boolean().optional(),
  // Phase 5F — adds "markup_on_cost" mode allowing markup values >100 (uncapped).
  pricingOverrideMode: z.enum(["none", "manual_sell", "target_margin", "markup_on_cost"]).optional(),
  manualSellPrice: z.number().optional(),
  targetMarginPercent: z.number().optional(),
  // Phase 5F — markup % applied to calculated unit cost (sell = cost * (1 + mk/100)).
  // No upper cap; true margin is output-only via finalMarginPercent.
  markupOnCostPercent: z.number().min(0).optional(),
  overrideReason: z.string().optional(),
  calculatedSellPrice: z.number().optional(),
  calculatedBuyCost: z.number().optional(),
  finalSellPrice: z.number().optional(),
  finalMarginAmount: z.number().optional(),
  finalMarginPercent: z.number().optional(),

  // Manual Procedure / Provisional line (Phase 5E).
  isManualProcedure: z.boolean().optional(),
  procedureType: z.enum(["Folding", "Deburring", "Tapping", "Other"]).optional(),
  procedureDescription: z.string().optional(),
  manualUnitCost: z.number().optional(),
  manualUnitSell: z.number().optional(),
  manualTargetMarginPercent: z.number().optional(),
  manualNotes: z.string().optional(),

  // Attached manual procedures (Phase 5E — secondary operations belonging to a
  // parent LL line item). Stored on the parent snapshot row so reload restores
  // the parent->child relationship faithfully.
  attachedManualProcedures: z.array(z.object({
    id: z.string(),
    procedureType: z.enum(["Folding", "Deburring", "Tapping", "Other"]),
    description: z.string().optional(),
    quantity: z.number().min(0),
    unitCost: z.number().min(0).optional(),
    unitSell: z.number().min(0).optional(),
    targetMarginPercent: z.number().optional(),
    notes: z.string().optional(),
  })).optional(),

  // For flattened pseudo-rows that represent an attached procedure as its own
  // child sub-line in the snapshot (so PDF/Preview can render it inline after
  // the parent without any quote-document changes). Reload-time loaders use
  // these to skip pseudo rows and rebuild parent->child from the parent's
  // attachedManualProcedures array.
  attachedToParentRef: z.string().optional(),
  attachedProcedureId: z.string().optional(),
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
