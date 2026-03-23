import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean, real, uniqueIndex, index, customType } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() { return "bytea"; },
  toDriver(value: Buffer): Buffer { return value; },
  fromDriver(value: Buffer): Buffer { return Buffer.from(value); },
});

export const USER_ROLES = ["owner", "admin", "estimator", "finance", "production", "viewer"] as const;
export type UserRole = typeof USER_ROLES[number];

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  displayName: text("display_name"),
  role: text("role").notNull().default("estimator"),
  divisionCode: text("division_code"),
  isActive: boolean("is_active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
}).extend({
  email: z.string().email().optional(),
  displayName: z.string().optional(),
  role: z.enum(USER_ROLES).default("estimator"),
  divisionCode: z.string().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const userSessions = pgTable("user_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type UserSession = typeof userSessions.$inferSelect;

export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  notes: text("notes"),
  xeroContactId: text("xero_contact_id"),
  isDemoRecord: boolean("is_demo_record").default(false),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, archivedAt: true, createdAt: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

export const CONTACT_CATEGORIES = ["client", "supplier", "subcontractor", "consultant", "other"] as const;
export type ContactCategory = typeof CONTACT_CATEGORIES[number];

export const customerContacts = pgTable("customer_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  roleTitle: text("role_title"),
  email: text("email"),
  phone: text("phone"),
  mobile: text("mobile"),
  category: text("category").default("client"),
  notes: text("notes"),
  isPrimary: boolean("is_primary").default(false),
  isDemoRecord: boolean("is_demo_record").default(false),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCustomerContactSchema = createInsertSchema(customerContacts).omit({ id: true, createdAt: true });
export type InsertCustomerContact = z.infer<typeof insertCustomerContactSchema>;
export type CustomerContact = typeof customerContacts.$inferSelect;

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull(),
  name: text("name").notNull(),
  address: text("address"),
  description: text("description"),
  divisionCode: text("division_code"),
  archivedAt: timestamp("archived_at"),
  isDemoRecord: boolean("is_demo_record").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, archivedAt: true, createdAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

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
  type: z.enum(["fixed", "awning", "sliding"]).default("fixed"),
  slideDirection: z.enum(["left", "right"]).default("right"),
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
  windowType: z.enum(["fixed", "awning", "french-left", "french-right", "french-pair"]).default("fixed"),
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
  overrideMode: z.enum(["none", "per_sqm", "total_sell"]).default("none"),
  overrideValue: z.number().nullable().optional(),
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
  lockType: z.string().default(""),
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
  siteType: text("site_type"),
  installationEnabled: boolean("installation_enabled").default(false),
  installationOverride: real("installation_override"),
  installationMarkup: real("installation_markup"),
  deliveryEnabled: boolean("delivery_enabled").default(false),
  deliveryMethod: text("delivery_method"),
  deliveryAmount: real("delivery_amount"),
  deliveryMarkup: real("delivery_markup"),
  removalEnabled: boolean("removal_enabled").default(false),
  removalOverride: real("removal_override"),
  removalMarkup: real("removal_markup"),
  rubbishEnabled: boolean("rubbish_enabled").default(false),
  rubbishTonnage: real("rubbish_tonnage"),
  clientName: text("client_name"),
  clientEmail: text("client_email"),
  clientPhone: text("client_phone"),
  customerId: varchar("customer_id"),
  contactId: varchar("contact_id"),
  archivedAt: timestamp("archived_at"),
  isDemoRecord: boolean("is_demo_record").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertJobSchema = createInsertSchema(jobs).omit({ id: true, archivedAt: true, createdAt: true }).extend({
  siteType: z.enum(["renovation", "new_build"]).nullable().optional(),
});
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

export const QUOTE_STATUSES = ["draft", "review", "sent", "accepted", "declined", "archived", "cancelled"] as const;
export type QuoteStatus = typeof QUOTE_STATUSES[number];

export const QUOTE_TYPES = ["renovation", "new_build", "tender"] as const;
export type QuoteType = typeof QUOTE_TYPES[number];

export const VALID_STATUS_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ["review", "archived"],
  review: ["sent", "archived", "cancelled"],
  sent: ["accepted", "declined", "cancelled"],
  accepted: ["archived"],
  declined: ["archived"],
  archived: [],
  cancelled: ["archived"],
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
  quoteType: text("quote_type"),
  currentRevisionId: varchar("current_revision_id"),
  createdByUserId: varchar("created_by_user_id"),
  totalValue: real("total_value"),
  customerId: varchar("customer_id"),
  projectId: varchar("project_id"),
  acceptedAt: timestamp("accepted_at"),
  acceptedByUserId: varchar("accepted_by_user_id"),
  acceptedValue: real("accepted_value"),
  acceptedRevisionId: varchar("accepted_revision_id"),
  sentAt: timestamp("sent_at"),
  sentToEmail: text("sent_to_email"),
  archivedAt: timestamp("archived_at"),
  deletedAt: timestamp("deleted_at"),
  isDemoRecord: boolean("is_demo_record").default(false),
  retentionPercentage: real("retention_percentage"),
  retentionHeldValue: real("retention_held_value"),
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
  totalsDisplayConfigJson: jsonb("totals_display_config_json"),
  commercialRemarks: text("commercial_remarks"),
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
  businessDisplayName: text("business_display_name").default("Lateral Enterprises"),
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
  templateConfigJson: jsonb("template_config_json"),
  systemMode: text("system_mode").notNull().default("development"),
  documentLabel: text("document_label").default("Quote"),
  quoteNumberPrefix: text("quote_number_prefix").default("Q"),
  quoteNumberUseDivisionSuffix: boolean("quote_number_use_division_suffix").default(false),
  jobNumberPrefix: text("job_number_prefix").default("J"),
  jobNumberUseDivisionSuffix: boolean("job_number_use_division_suffix").default(false),
  invoiceNumberPrefix: text("invoice_number_prefix").default("INV"),
  xeroAccountCode: text("xero_account_code").default("200"),
  xeroTaxType: text("xero_tax_type").default("OUTPUT2"),
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
  jobTypePresetsJson: jsonb("job_type_presets_json"),
  additionalCapabilitiesBlock: text("additional_capabilities_block"),
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

export const itemPhotos = pgTable("item_photos", {
  key: varchar("key").primaryKey(),
  data: bytea("data").notNull(),
  mimeType: text("mime_type").notNull().default("image/jpeg"),
  sizeBytes: integer("size_bytes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type ItemPhoto = typeof itemPhotos.$inferSelect;

export const INVOICE_TYPES = ["deposit", "progress", "variation", "final", "retention_release", "credit_note"] as const;
export type InvoiceType = typeof INVOICE_TYPES[number];

export const INVOICE_STATUSES = ["draft", "ready_for_xero", "pushed_to_xero_draft", "approved", "returned_to_draft"] as const;
export type InvoiceStatus = typeof INVOICE_STATUSES[number];

export const VALID_INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["ready_for_xero"],
  ready_for_xero: ["draft", "pushed_to_xero_draft"],
  pushed_to_xero_draft: ["approved", "returned_to_draft"],
  approved: ["returned_to_draft"],
  returned_to_draft: ["draft", "ready_for_xero"],
};

export const DEPOSIT_TYPES = ["percentage", "fixed"] as const;
export type DepositType = typeof DEPOSIT_TYPES[number];

export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  number: text("number").notNull().unique(),
  quoteId: varchar("quote_id"),
  quoteRevisionId: varchar("quote_revision_id"),
  divisionCode: text("division_code"),
  customerId: varchar("customer_id"),
  projectId: varchar("project_id"),
  type: text("type").notNull().default("deposit"),
  status: text("status").notNull().default("draft"),
  depositType: text("deposit_type"),
  depositPercentage: real("deposit_percentage"),
  amountExclGst: real("amount_excl_gst"),
  gstAmount: real("gst_amount"),
  amountInclGst: real("amount_incl_gst"),
  description: text("description"),
  notes: text("notes"),
  variationId: varchar("variation_id"),
  reference: text("reference"),
  xeroInvoiceId: text("xero_invoice_id"),
  xeroInvoiceNumber: text("xero_invoice_number"),
  xeroStatus: text("xero_status"),
  xeroAmountPaid: real("xero_amount_paid"),
  xeroAmountDue: real("xero_amount_due"),
  xeroLastSyncedAt: timestamp("xero_last_synced_at"),
  isDemoRecord: boolean("is_demo_record").default(false),
  archivedAt: timestamp("archived_at"),
  createdByUserId: varchar("created_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

// ─── Invoice Lines ───────────────────────────────────────────────────────────

export const INVOICE_LINE_TYPES = [
  "deposit", "progress", "variation", "final",
  "retention_release", "standard", "manual", "adjustment",
] as const;
export type InvoiceLineType = typeof INVOICE_LINE_TYPES[number];

export const invoiceLines = pgTable("invoice_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  lineType: text("line_type").notNull().default("standard"),
  description: text("description"),
  quantity: real("quantity").notNull().default(1),
  unitAmount: real("unit_amount"),
  lineAmountExclGst: real("line_amount_excl_gst"),
  variationId: varchar("variation_id"),
  sourceContext: text("source_context"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_invoice_lines_invoice_id").on(table.invoiceId),
]);

export const insertInvoiceLineSchema = createInsertSchema(invoiceLines).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInvoiceLine = z.infer<typeof insertInvoiceLineSchema>;
export type InvoiceLine = typeof invoiceLines.$inferSelect;

// ─── Variations ──────────────────────────────────────────────────────────────

export const VARIATION_STATUSES = [
  "draft", "sent", "approved", "declined",
  "partially_invoiced", "fully_invoiced",
] as const;
export type VariationStatus = typeof VARIATION_STATUSES[number];

export const variations = pgTable("variations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id"),
  quoteId: varchar("quote_id"),
  jobId: varchar("job_id"),
  customerId: varchar("customer_id"),
  divisionCode: text("division_code"),
  title: text("title").notNull(),
  reason: text("reason"),
  amountExclGst: real("amount_excl_gst").notNull(),
  gstAmount: real("gst_amount"),
  amountInclGst: real("amount_incl_gst"),
  status: text("status").notNull().default("draft"),
  approvedAt: timestamp("approved_at"),
  createdByUserId: varchar("created_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertVariationSchema = createInsertSchema(variations).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVariation = z.infer<typeof insertVariationSchema>;
export type Variation = typeof variations.$inferSelect;

// ─── Operational Jobs ─────────────────────────────────────────────────────────

export const OP_JOB_STATUSES = ["active", "on_hold", "completed", "cancelled"] as const;
export type OpJobStatus = typeof OP_JOB_STATUSES[number];

export const MEASUREMENT_REQUIREMENTS = ["pre_quote", "post_acceptance", "not_required"] as const;
export type MeasurementRequirement = typeof MEASUREMENT_REQUIREMENTS[number];

export const DIMENSION_SOURCES = [
  "site_measure",
  "confirmed_drawings",
  "client_supplied",
  "engineer_drawings",
  "architectural_drawings",
  "other",
] as const;
export type DimensionSource = typeof DIMENSION_SOURCES[number];

export const opJobs = pgTable("op_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobNumber: text("job_number").notNull().unique(),
  title: text("title").notNull(),
  status: text("status").notNull().default("active"),
  divisionId: varchar("division_id"),
  customerId: varchar("customer_id"),
  projectId: varchar("project_id"),
  sourceQuoteId: varchar("source_quote_id"),
  acceptedRevisionId: varchar("accepted_revision_id"),
  notes: text("notes"),
  measurementRequirement: text("measurement_requirement"),
  dimensionSource: text("dimension_source"),
  archivedAt: timestamp("archived_at"),
  isDemoRecord: boolean("is_demo_record").default(false),
  createdByUserId: varchar("created_by_user_id"),
  convertedAt: timestamp("converted_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertOpJobSchema = createInsertSchema(opJobs).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOpJob = z.infer<typeof insertOpJobSchema>;
export type OpJob = typeof opJobs.$inferSelect;

// ─── Lifecycle Framework ─────────────────────────────────────────────────────

// Stores the template definition for each division (versioned for auditability).
// templateJson contains a LifecycleTemplateConfig (see shared/lifecycle.ts).
export const lifecycleTemplates = pgTable("lifecycle_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  divisionCode: text("division_code").notNull(),
  name: text("name").notNull(),
  version: integer("version").notNull().default(1),
  templateJson: jsonb("template_json").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export type LifecycleTemplate = typeof lifecycleTemplates.$inferSelect;

// Records which template version was assigned to a quote at acceptance.
// Once created, this record is immutable — it preserves what lifecycle
// framework was in effect when commercial commitment was made.
export const lifecycleInstances = pgTable("lifecycle_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id),
  opJobId: varchar("op_job_id"),  // populated when job is created from this quote
  divisionCode: text("division_code").notNull(),
  templateId: varchar("template_id").notNull().references(() => lifecycleTemplates.id),
  templateVersion: integer("template_version").notNull(),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  quoteIdUnique: uniqueIndex("lifecycle_instances_quote_id_unique").on(table.quoteId),
}));

export type LifecycleInstance = typeof lifecycleInstances.$inferSelect;

// Phase 2: Stores per-task completion state for a lifecycle instance.
// The template defines which tasks exist; this table records who completed them and when.
// Upserted on toggle — one row per (instanceId, stageKey, taskKey).
export const lifecycleTaskStates = pgTable("lifecycle_task_states", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lifecycleInstanceId: varchar("lifecycle_instance_id").notNull().references(() => lifecycleInstances.id),
  stageKey: text("stage_key").notNull(),
  taskKey: text("task_key").notNull(),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  completedByUserId: varchar("completed_by_user_id"),
  note: text("note"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  uniqueTaskState: uniqueIndex("uq_lifecycle_task_state").on(t.lifecycleInstanceId, t.stageKey, t.taskKey),
}));

export type LifecycleTaskState = typeof lifecycleTaskStates.$inferSelect;

// ─── Xero OAuth Connections ──────────────────────────────────────────────────

// Stores OAuth 2.0 token set obtained via the Xero Authorization Code flow.
// Only one active connection is expected (single-org). The table uses a fixed
// "singleton" row keyed by id="default" to allow simple upsert semantics.
// Tokens are NEVER exposed to the browser — all reads are server-side only.
export const xeroConnections = pgTable("xero_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type XeroConnection = typeof xeroConnections.$inferSelect;
