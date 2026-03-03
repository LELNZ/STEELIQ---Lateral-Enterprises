import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean, real } from "drizzle-orm/pg-core";
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
  type: z.enum(["fixed", "awning", "sliding", "hinge"]).default("fixed"),
  slideDirection: z.enum(["left", "right"]).default("right"),
  hingeSide: z.enum(["left", "right"]).default("left"),
  openDirection: z.enum(["in", "out"]).default("out"),
});

export const customColumnSchema = z.object({
  width: z.number().min(0).default(0),
  rows: z.array(customColumnRowSchema).default([{ height: 0, type: "fixed" }]),
});

export type CustomColumnRow = z.infer<typeof customColumnRowSchema>;
export type CustomColumn = z.infer<typeof customColumnSchema>;

export const entranceDoorRowSchema = z.object({
  height: z.number().min(0).default(0),
  type: z.enum(["fixed", "awning"]).default("fixed"),
});

export type EntranceDoorRow = z.infer<typeof entranceDoorRowSchema>;

export const quoteItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Item name is required"),
  quantity: z.number().int().min(1),
  category: z.enum([
    "windows-standard", "sliding-window", "sliding-door",
    "entrance-door", "hinge-door", "french-door",
    "bifold-door", "stacker-door", "bay-window"
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
  sidelightEnabled: z.boolean().default(true),
  sidelightSide: z.enum(["left", "right", "both"]).default("right"),
  doorSplit: z.boolean().default(false),
  doorSplitHeight: z.number().default(0),
  bifoldLeftCount: z.number().int().min(0).default(0),
  centerWidth: z.number().default(0),
  entranceDoorRows: z.array(entranceDoorRowSchema).default([{ height: 0, type: "fixed" }]),
  entranceSidelightRows: z.array(entranceDoorRowSchema).default([{ height: 0, type: "fixed" }]),
  entranceSidelightLeftRows: z.array(entranceDoorRowSchema).default([{ height: 0, type: "fixed" }]),
  hingeDoorRows: z.array(entranceDoorRowSchema).default([{ height: 0, type: "fixed" }]),
  frenchDoorLeftRows: z.array(entranceDoorRowSchema).default([{ height: 0, type: "fixed" }]),
  frenchDoorRightRows: z.array(entranceDoorRowSchema).default([{ height: 0, type: "fixed" }]),
  panelRows: z.array(z.array(entranceDoorRowSchema)).default([]),
  showLegend: z.boolean().default(true),
  customColumns: z.array(customColumnSchema).default([
    { width: 0, rows: [{ height: 0, type: "fixed" }] },
    { width: 0, rows: [{ height: 0, type: "fixed" }] },
  ]),
  pricePerSqm: z.number().min(500).max(750).default(500),
  frameType: z.string().default(""),
  frameColor: z.string().default(""),
  flashingSize: z.number().default(0),
  windZone: z.string().default(""),
  linerType: z.string().default(""),
  glassIguType: z.string().default(""),
  glassType: z.string().default(""),
  glassThickness: z.string().default(""),
  wanzBar: z.boolean().default(false),
  wanzBarSource: z.enum(["nz-local", "direct", ""]).default(""),
  wanzBarSize: z.string().default(""),
  wallThickness: z.number().default(0),
  heightFromFloor: z.number().default(0),
  handleType: z.string().default(""),
  configurationId: z.string().default(""),
});

export const insertQuoteItemSchema = quoteItemSchema.omit({ id: true });

export type QuoteItem = z.infer<typeof quoteItemSchema>;
export type InsertQuoteItem = z.infer<typeof insertQuoteItemSchema>;

export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address").default(""),
  date: text("date").default(""),
  installationEnabled: boolean("installation_enabled").default(false),
  installationOverride: real("installation_override"),
  installationMarkup: real("installation_markup"),
  deliveryEnabled: boolean("delivery_enabled").default(false),
  deliveryMethod: text("delivery_method"),
  deliveryAmount: real("delivery_amount"),
  deliveryMarkup: real("delivery_markup"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertJobSchema = createInsertSchema(jobs).omit({ id: true, createdAt: true });
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

export const jobItems = pgTable("job_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull(),
  config: jsonb("config").notNull().$type<QuoteItem>(),
  photo: text("photo"),
  sortOrder: integer("sort_order").default(0),
});

export const insertJobItemSchema = createInsertSchema(jobItems).omit({ id: true });
export type InsertJobItem = z.infer<typeof insertJobItemSchema>;
export type JobItem = typeof jobItems.$inferSelect;

export const libraryEntries = pgTable("library_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  data: jsonb("data").notNull(),
  sortOrder: integer("sort_order").default(0),
});

export const insertLibraryEntrySchema = createInsertSchema(libraryEntries).omit({ id: true });
export type InsertLibraryEntry = z.infer<typeof insertLibraryEntrySchema>;
export type LibraryEntry = typeof libraryEntries.$inferSelect;

export const frameConfigurations = pgTable("frame_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  frameTypeId: varchar("frame_type_id").notNull(),
  name: text("name").notNull(),
  description: text("description").default(""),
  defaultSalePricePerSqm: integer("default_sale_price_per_sqm").default(550),
  sortOrder: integer("sort_order").default(0),
});

export const insertFrameConfigurationSchema = createInsertSchema(frameConfigurations).omit({ id: true });
export type InsertFrameConfiguration = z.infer<typeof insertFrameConfigurationSchema>;
export type FrameConfiguration = typeof frameConfigurations.$inferSelect;

export const configurationProfiles = pgTable("configuration_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  configurationId: varchar("configuration_id").notNull(),
  mouldNumber: text("mould_number").notNull(),
  role: text("role").notNull(),
  kgPerMetre: text("kg_per_metre").notNull(),
  pricePerKgUsd: text("price_per_kg_usd").notNull(),
  quantityPerSet: integer("quantity_per_set").default(1),
  lengthFormula: text("length_formula").default("perimeter"),
  surface: text("surface").default(""),
  sortOrder: integer("sort_order").default(0),
});

export const insertConfigurationProfileSchema = createInsertSchema(configurationProfiles).omit({ id: true });
export type InsertConfigurationProfile = z.infer<typeof insertConfigurationProfileSchema>;
export type ConfigurationProfile = typeof configurationProfiles.$inferSelect;

export const configurationAccessories = pgTable("configuration_accessories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  configurationId: varchar("configuration_id").notNull(),
  name: text("name").notNull(),
  code: text("code").default(""),
  colour: text("colour").default(""),
  priceUsd: text("price_usd").notNull(),
  quantityPerSet: text("quantity_per_set").default("1"),
  scalingType: text("scaling_type").default("fixed"),
  sortOrder: integer("sort_order").default(0),
});

export const insertConfigurationAccessorySchema = createInsertSchema(configurationAccessories).omit({ id: true });
export type InsertConfigurationAccessory = z.infer<typeof insertConfigurationAccessorySchema>;
export type ConfigurationAccessory = typeof configurationAccessories.$inferSelect;

export const configurationLabor = pgTable("configuration_labor", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  configurationId: varchar("configuration_id").notNull(),
  taskName: text("task_name").notNull(),
  costNzd: text("cost_nzd").default("0"),
  sortOrder: integer("sort_order").default(0),
});

export const insertConfigurationLaborSchema = createInsertSchema(configurationLabor).omit({ id: true });
export type InsertConfigurationLabor = z.infer<typeof insertConfigurationLaborSchema>;
export type ConfigurationLabor = typeof configurationLabor.$inferSelect;
