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

export const customColumnRowSchema = z.object({
  height: z.number().min(0).default(0),
  type: z.enum(["fixed", "awning"]).default("fixed"),
});

export const customColumnSchema = z.object({
  width: z.number().min(0).default(0),
  rows: z.array(customColumnRowSchema).default([{ height: 0, type: "fixed" }]),
});

export type CustomColumnRow = z.infer<typeof customColumnRowSchema>;
export type CustomColumn = z.infer<typeof customColumnSchema>;

export const quoteItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Item name is required"),
  quantity: z.number().int().min(1),
  category: z.enum([
    "windows-standard", "sliding-window", "entrance-door",
    "hinge-door", "french-door", "bifold-door",
    "stacker-door", "bay-window"
  ]),
  width: z.number().min(200, "Minimum width is 200mm"),
  height: z.number().min(200, "Minimum height is 200mm"),
  layout: z.enum(["standard", "custom"]).default("standard"),
  windowType: z.enum(["fixed", "awning"]).default("fixed"),
  hingeSide: z.enum(["left", "right"]).default("left"),
  openDirection: z.enum(["in", "out"]).default("out"),
  halfSolid: z.boolean().default(false),
  panels: z.number().int().min(2).max(8).default(3),
  sidelightWidth: z.number().default(400),
  bifoldLeftCount: z.number().int().min(0).default(0),
  centerWidth: z.number().default(0),
  customColumns: z.array(customColumnSchema).default([
    { width: 0, rows: [{ height: 0, type: "fixed" }] },
    { width: 0, rows: [{ height: 0, type: "fixed" }] },
  ]),
});

export const insertQuoteItemSchema = quoteItemSchema.omit({ id: true });

export type QuoteItem = z.infer<typeof quoteItemSchema>;
export type InsertQuoteItem = z.infer<typeof insertQuoteItemSchema>;
