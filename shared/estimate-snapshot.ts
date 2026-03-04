import { z } from "zod";

export const estimateSnapshotSchema = z.object({
  division: z.string().default(""),
  customer: z.string().min(1),
  assemblies: z.array(z.any()).default([]),
  lineItems: z.array(z.any()).default([]),
  operations: z.array(z.any()).default([]),
  totals: z.object({
    cost: z.number(),
    sell: z.number(),
    grossProfit: z.number(),
    grossMargin: z.number(),
    totalLabourHours: z.number(),
    gpPerHour: z.number(),
  }),
  overheadAllocation: z.number().optional(),
  netProfitEstimate: z.number().optional(),
  exclusions: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
});

export type EstimateSnapshot = z.infer<typeof estimateSnapshotSchema>;
