import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean, real, uniqueIndex } from "drizzle-orm/pg-core";
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
  cachedWeightKg: z.number().default(0),
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
  photos: jsonb("photos").$type<Array<{
    key: string;
    isPrimary?: boolean;
    includeInCustomerPdf?: boolean;
    caption?: string;
    takenAt?: string;
  }>>(),
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
  divisionScope: text("division_scope"),
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

export const QUOTE_STATUSES = ["draft", "review", "sent", "accepted", "declined", "archived"] as const;
export type QuoteStatus = typeof QUOTE_STATUSES[number];

export const VALID_STATUS_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ["review"],
  review: ["sent"],
  sent: ["accepted", "declined"],
  accepted: ["archived"],
  declined: ["archived"],
  archived: [],
};

export const numberSequences = pgTable("number_sequences", {
  id: varchar("id").primaryKey(),
  currentValue: integer("current_value").notNull().default(0),
});

export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  number: text("number").notNull().unique(),
  sourceJobId: varchar("source_job_id"),
  tenantId: varchar("tenant_id"),
  divisionId: varchar("division_id"),
  customer: text("customer").notNull(),
  status: text("status").notNull().default("draft"),
  currentRevisionId: varchar("current_revision_id"),
  createdByUserId: varchar("created_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertQuoteSchema = createInsertSchema(quotes).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;

export const quoteRevisions = pgTable("quote_revisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull(),
  versionNumber: integer("version_number").notNull(),
  snapshotJson: jsonb("snapshot_json").notNull(),
  specDisplayOverrideJson: jsonb("spec_display_override_json"),
  templateKey: text("template_key").notNull().default("base_v1"),
  xeroSyncStatus: text("xero_sync_status"),
  procurementGenerated: boolean("procurement_generated").default(false),
  pdfStorageKey: text("pdf_storage_key"),
  createdByUserId: varchar("created_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("quote_revision_unique").on(table.quoteId, table.versionNumber),
]);

export const insertQuoteRevisionSchema = createInsertSchema(quoteRevisions).omit({ id: true, createdAt: true });
export type InsertQuoteRevision = z.infer<typeof insertQuoteRevisionSchema>;
export type QuoteRevision = typeof quoteRevisions.$inferSelect;

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  action: text("action").notNull(),
  performedByUserId: varchar("performed_by_user_id"),
  metadataJson: jsonb("metadata_json"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

export const orgSettings = pgTable("org_settings", {
  id: varchar("id").primaryKey().default("default"),
  legalName: text("legal_name").notNull().default("Lateral Engineering Limited"),
  gstNumber: text("gst_number"),
  nzbn: text("nzbn"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  bankDetails: text("bank_details"),
  defaultHeaderNotesBlock: text("default_header_notes_block"),
  defaultTermsBlock: text("default_terms_block"),
  defaultExclusionsBlock: text("default_exclusions_block"),
  paymentTermsBlock: text("payment_terms_block"),
  quoteValidityDays: integer("quote_validity_days").default(30),
});

export const insertOrgSettingsSchema = createInsertSchema(orgSettings).omit({});
export type InsertOrgSettings = z.infer<typeof insertOrgSettingsSchema>;
export type OrgSettings = typeof orgSettings.$inferSelect;

export const divisionSettings = pgTable("division_settings", {
  divisionCode: varchar("division_code").primaryKey(),
  tradingName: text("trading_name"),
  logoUrl: text("logo_url"),
  templateKey: text("template_key").notNull().default("base_v1"),
  requiredLegalLine: text("required_legal_line").notNull().default("A trading division of Lateral Engineering Limited"),
  termsOverrideBlock: text("terms_override_block"),
  headerNotesOverrideBlock: text("header_notes_override_block"),
  exclusionsOverrideBlock: text("exclusions_override_block"),
  fontFamily: text("font_family"),
  accentColor: text("accent_color"),
  logoPosition: text("logo_position"),
  headerVariant: text("header_variant"),
  scheduleLayoutVariant: text("schedule_layout_variant").notNull().default("image_left_specs_right_v1"),
  totalsLayoutVariant: text("totals_layout_variant").notNull().default("totals_block_v1"),
  specDisplayDefaultsJson: jsonb("spec_display_defaults_json"),
});

export const insertDivisionSettingsSchema = createInsertSchema(divisionSettings);
export type InsertDivisionSettings = z.infer<typeof insertDivisionSettingsSchema>;
export type DivisionSettings = typeof divisionSettings.$inferSelect;

export const specDictionary = pgTable("spec_dictionary", {
  key: text("key").primaryKey(),
  divisionScope: text("division_scope"),
  group: text("group").notNull(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").default(0),
  inputKind: text("input_kind").notNull(),
  librarySourceKey: text("library_source_key"),
  optionsJson: jsonb("options_json"),
  customerVisibleAllowed: boolean("customer_visible_allowed").default(true),
  unit: text("unit"),
  helpText: text("help_text"),
});

export const insertSpecDictionarySchema = createInsertSchema(specDictionary);
export type InsertSpecDictionary = z.infer<typeof insertSpecDictionarySchema>;
export type SpecDictionaryEntry = typeof specDictionary.$inferSelect;
