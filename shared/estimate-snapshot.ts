import { z } from "zod";

const snapshotPhotoSchema = z.object({
  key: z.string(),
  isPrimary: z.boolean().optional(),
  includeInCustomerPdf: z.boolean().optional(),
  caption: z.string().optional(),
  takenAt: z.string().optional(),
});

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
  openingDirection: z.string().optional(),
  gosRequired: z.boolean().optional(),
  catDoorEnabled: z.boolean().optional(),
  drawingImageKey: z.string().optional(),
  photos: z.array(snapshotPhotoSchema).optional().default([]),
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
