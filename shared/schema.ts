import { sql } from "drizzle-orm";
import { pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const quoteItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Item name is required"),
  quantity: z.number().int().min(1),
  category: z.enum(["window", "hinge-door", "sliding-door", "entry-door"]),
  width: z.number().min(200, "Minimum width is 200mm"),
  height: z.number().min(200, "Minimum height is 200mm"),
  layout: z.string(),
  hingeSide: z.enum(["left", "right"]).default("left"),
  splitPosition: z.number().default(0),
  halfSolid: z.boolean().default(false),
  pane1Type: z.enum(["fixed", "awning"]).default("fixed"),
  pane2Type: z.enum(["fixed", "awning"]).default("fixed"),
  panels: z.number().int().min(2).max(4).default(2),
  sidelightConfig: z.enum(["none", "left", "right", "both"]).default("none"),
});

export const insertQuoteItemSchema = quoteItemSchema.omit({ id: true });

export type QuoteItem = z.infer<typeof quoteItemSchema>;
export type InsertQuoteItem = z.infer<typeof insertQuoteItemSchema>;
