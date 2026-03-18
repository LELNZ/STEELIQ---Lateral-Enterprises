import {
  type User, type InsertUser,
  type Job, type InsertJob,
  type JobItem, type InsertJobItem,
  type LibraryEntry, type InsertLibraryEntry,
  type FrameConfiguration, type InsertFrameConfiguration,
  type ConfigurationProfile, type InsertConfigurationProfile,
  type ConfigurationAccessory, type InsertConfigurationAccessory,
  type ConfigurationLabor, type InsertConfigurationLabor,
  type Quote, type InsertQuote,
  type QuoteRevision, type InsertQuoteRevision,
  type AuditLog, type InsertAuditLog,
  type OrgSettings, type InsertOrgSettings,
  type DivisionSettings, type InsertDivisionSettings,
  type SpecDictionaryEntry, type InsertSpecDictionary,
  type ItemPhoto,
  type UserSession,
  type Customer, type InsertCustomer,
  type CustomerContact, type InsertCustomerContact,
  type Project, type InsertProject,
  type Invoice, type InsertInvoice,
  type OpJob, type InsertOpJob,
  type LifecycleTemplate, type LifecycleInstance,
  users, jobs, jobItems, libraryEntries,
  frameConfigurations, configurationProfiles, configurationAccessories, configurationLabor,
  numberSequences, quotes, quoteRevisions, auditLogs,
  orgSettings, divisionSettings, specDictionary,
  itemPhotos,
  userSessions, customers, customerContacts, projects, invoices, opJobs,
  lifecycleTemplates, lifecycleInstances,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, asc, desc, and, or, sql, isNull, isNotNull, inArray, ilike } from "drizzle-orm";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool);
export { pool };

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;

  createUserSession(userId: string, token: string, expiresAt: Date): Promise<UserSession>;
  getUserSessionByToken(token: string): Promise<UserSession | undefined>;
  deleteUserSession(token: string): Promise<void>;
  deleteExpiredSessions(): Promise<void>;

  createJob(job: InsertJob): Promise<Job>;
  getJob(id: string): Promise<Job | undefined>;
  getAllJobs(): Promise<Job[]>;
  getArchivedJobs(): Promise<Job[]>;
  archiveJob(id: string): Promise<Job | undefined>;
  unarchiveJob(id: string): Promise<Job | undefined>;
  updateJob(id: string, data: Partial<InsertJob>): Promise<Job | undefined>;
  deleteJob(id: string): Promise<void>;

  addJobItem(item: InsertJobItem): Promise<JobItem>;
  getJobItems(jobId: string): Promise<JobItem[]>;
  updateJobItem(id: string, data: Partial<InsertJobItem>): Promise<JobItem | undefined>;
  deleteJobItem(id: string): Promise<void>;
  deleteJobItems(jobId: string): Promise<void>;

  getLibraryEntries(type?: string): Promise<LibraryEntry[]>;
  createLibraryEntry(entry: InsertLibraryEntry): Promise<LibraryEntry>;
  updateLibraryEntry(id: string, data: Partial<InsertLibraryEntry>): Promise<LibraryEntry | undefined>;
  deleteLibraryEntry(id: string): Promise<void>;

  getFrameConfigurations(frameTypeId: string): Promise<FrameConfiguration[]>;
  createFrameConfiguration(config: InsertFrameConfiguration): Promise<FrameConfiguration>;
  updateFrameConfiguration(id: string, data: Partial<InsertFrameConfiguration>): Promise<FrameConfiguration | undefined>;
  deleteFrameConfiguration(id: string): Promise<void>;

  getConfigurationProfiles(configurationId: string): Promise<ConfigurationProfile[]>;
  createConfigurationProfile(profile: InsertConfigurationProfile): Promise<ConfigurationProfile>;
  updateConfigurationProfile(id: string, data: Partial<InsertConfigurationProfile>): Promise<ConfigurationProfile | undefined>;
  deleteConfigurationProfile(id: string): Promise<void>;

  getConfigurationAccessories(configurationId: string): Promise<ConfigurationAccessory[]>;
  createConfigurationAccessory(accessory: InsertConfigurationAccessory): Promise<ConfigurationAccessory>;
  updateConfigurationAccessory(id: string, data: Partial<InsertConfigurationAccessory>): Promise<ConfigurationAccessory | undefined>;
  deleteConfigurationAccessory(id: string): Promise<void>;

  getConfigurationLabor(configurationId: string): Promise<ConfigurationLabor[]>;
  createConfigurationLabor(labor: InsertConfigurationLabor): Promise<ConfigurationLabor>;
  updateConfigurationLabor(id: string, data: Partial<InsertConfigurationLabor>): Promise<ConfigurationLabor | undefined>;
  deleteConfigurationLabor(id: string): Promise<void>;

  deleteConfigurationChildren(configurationId: string): Promise<void>;

  getAllConfigurationProfiles(): Promise<ConfigurationProfile[]>;
  getAllConfigurationAccessories(): Promise<ConfigurationAccessory[]>;
  updateProfilesByMouldNumber(mouldNumber: string, data: Partial<InsertConfigurationProfile>): Promise<number>;
  updateAccessoriesByCode(code: string, data: Partial<InsertConfigurationAccessory>): Promise<number>;

  getNextQuoteNumber(divisionCode?: string): Promise<string>;
  createQuote(data: InsertQuote): Promise<Quote>;
  getQuote(id: string): Promise<Quote | undefined>;
  getQuoteByJobId(jobId: string): Promise<Quote | undefined>;
  getQuotesByJobId(jobId: string): Promise<Quote[]>;
  getAllQuotes(): Promise<Quote[]>;
  updateQuote(id: string, data: Partial<InsertQuote>): Promise<Quote | undefined>;
  updateQuoteStatus(id: string, status: string): Promise<Quote | undefined>;
  updateQuoteCurrentRevision(id: string, revisionId: string): Promise<Quote | undefined>;
  acceptQuote(id: string, data: { acceptedAt: Date; acceptedByUserId: string | null; acceptedValue: number; acceptedRevisionId: string }): Promise<Quote | undefined>;
  deleteQuoteAndRevisions(id: string): Promise<void>;
  deleteAllQuotesAndRevisions(): Promise<number>;

  createQuoteRevision(data: InsertQuoteRevision): Promise<QuoteRevision>;
  getQuoteRevisions(quoteId: string): Promise<QuoteRevision[]>;

  createAuditLog(data: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(entityType: string, entityId: string): Promise<AuditLog[]>;

  getOrgSettings(): Promise<OrgSettings | undefined>;
  upsertOrgSettings(data: Partial<InsertOrgSettings>): Promise<OrgSettings>;

  getDivisionSettings(code: string): Promise<DivisionSettings | undefined>;
  getAllDivisionSettings(): Promise<DivisionSettings[]>;
  upsertDivisionSettings(code: string, data: Partial<InsertDivisionSettings>): Promise<DivisionSettings>;

  getSpecDictionary(divisionScope?: string): Promise<SpecDictionaryEntry[]>;
  getAllSpecEntries(): Promise<SpecDictionaryEntry[]>;

  getLibraryEntriesWithScope(type?: string, divisionCode?: string): Promise<LibraryEntry[]>;

  saveItemPhoto(key: string, data: Buffer, mimeType: string): Promise<void>;
  getItemPhoto(key: string): Promise<{ data: Buffer; mimeType: string } | undefined>;
  deleteItemPhoto(key: string): Promise<void>;
  deleteItemPhotos(keys: string[]): Promise<void>;

  getAllCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  createCustomer(data: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer | undefined>;
  archiveCustomer(id: string): Promise<Customer | undefined>;

  listContacts(filters?: { customerId?: string; category?: string; search?: string }): Promise<CustomerContact[]>;
  getCustomerContacts(customerId: string): Promise<CustomerContact[]>;
  getContact(id: string): Promise<CustomerContact | undefined>;
  createCustomerContact(data: InsertCustomerContact): Promise<CustomerContact>;
  updateCustomerContact(id: string, data: Partial<InsertCustomerContact>): Promise<CustomerContact | undefined>;
  archiveContact(id: string): Promise<CustomerContact | undefined>;
  deleteCustomerContact(id: string): Promise<void>;

  getAllProjects(): Promise<Project[]>;
  getProjectsByCustomer(customerId: string): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(data: InsertProject): Promise<Project>;
  updateProject(id: string, data: Partial<InsertProject>): Promise<Project | undefined>;
  archiveProject(id: string): Promise<Project | undefined>;

  getNextInvoiceNumber(): Promise<string>;
  createInvoice(data: InsertInvoice): Promise<Invoice>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  getInvoicesByQuote(quoteId: string): Promise<Invoice[]>;
  getAllInvoices(): Promise<Invoice[]>;
  getAllInvoicesEnriched(): Promise<(Invoice & { customerName: string | null; projectName: string | null })[]>;
  updateInvoice(id: string, data: Partial<InsertInvoice>): Promise<Invoice | undefined>;

  getNextJobNumber(divisionCode?: string): Promise<string>;
  getNumberSequences(): Promise<{ id: string; currentValue: number }[]>;
  setNumberSequence(id: string, nextValue: number): Promise<void>;
  createOpJob(data: InsertOpJob): Promise<OpJob>;
  getOpJob(id: string): Promise<OpJob | undefined>;
  getAllOpJobs(): Promise<OpJob[]>;
  getArchivedOpJobs(): Promise<OpJob[]>;
  archiveOpJob(id: string): Promise<OpJob | undefined>;
  unarchiveOpJob(id: string): Promise<OpJob | undefined>;
  updateOpJob(id: string, data: Partial<InsertOpJob>): Promise<OpJob | undefined>;
  getOpJobByQuoteId(quoteId: string): Promise<OpJob | undefined>;
  getDemoQuotes(): Promise<Quote[]>;
  getDemoOpJobs(): Promise<OpJob[]>;

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  getActiveLifecycleTemplate(divisionCode: string): Promise<LifecycleTemplate | undefined>;
  getLifecycleTemplateById(id: string): Promise<LifecycleTemplate | undefined>;
  getLifecycleInstanceForQuote(quoteId: string): Promise<LifecycleInstance | undefined>;
  createLifecycleInstance(data: {
    quoteId: string;
    divisionCode: string;
    templateId: string;
    templateVersion: number;
  }): Promise<LifecycleInstance>;
  updateLifecycleInstanceJob(quoteId: string, opJobId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser as any).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data as any).where(eq(users.id, id)).returning();
    return updated;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(asc(users.displayName));
  }

  async createUserSession(userId: string, token: string, expiresAt: Date): Promise<UserSession> {
    const [session] = await db.insert(userSessions).values({ userId, token, expiresAt }).returning();
    return session;
  }

  async getUserSessionByToken(token: string): Promise<UserSession | undefined> {
    const [session] = await db.select().from(userSessions).where(eq(userSessions.token, token));
    return session;
  }

  async deleteUserSession(token: string): Promise<void> {
    await db.delete(userSessions).where(eq(userSessions.token, token));
  }

  async deleteExpiredSessions(): Promise<void> {
    await db.delete(userSessions).where(sql`${userSessions.expiresAt} < NOW()`);
  }

  async createJob(job: InsertJob): Promise<Job> {
    const [created] = await db.insert(jobs).values(job).returning();
    return created;
  }

  async getJob(id: string): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job;
  }

  async getAllJobs(): Promise<Job[]> {
    return db.select().from(jobs).where(isNull(jobs.archivedAt));
  }

  async getArchivedJobs(): Promise<Job[]> {
    return db.select().from(jobs).where(isNotNull(jobs.archivedAt));
  }

  async archiveJob(id: string): Promise<Job | undefined> {
    const job = await this.getJob(id);
    if (!job) return undefined;
    if (job.archivedAt) return undefined;
    const [updated] = await db.update(jobs).set({ archivedAt: new Date() } as any).where(eq(jobs.id, id)).returning();
    return updated;
  }

  async unarchiveJob(id: string): Promise<Job | undefined> {
    const job = await this.getJob(id);
    if (!job) return undefined;
    if (!job.archivedAt) return undefined;
    const [updated] = await db.update(jobs).set({ archivedAt: null } as any).where(eq(jobs.id, id)).returning();
    return updated;
  }

  async updateJob(id: string, data: Partial<InsertJob>): Promise<Job | undefined> {
    const [updated] = await db.update(jobs).set(data).where(eq(jobs.id, id)).returning();
    return updated;
  }

  async deleteJob(id: string): Promise<void> {
    await db.delete(jobItems).where(eq(jobItems.jobId, id));
    await db.delete(jobs).where(eq(jobs.id, id));
  }

  async addJobItem(item: InsertJobItem): Promise<JobItem> {
    const [created] = await db.insert(jobItems).values(item as any).returning();
    return created;
  }

  async getJobItems(jobId: string): Promise<JobItem[]> {
    return db.select().from(jobItems).where(eq(jobItems.jobId, jobId)).orderBy(asc(jobItems.sortOrder));
  }

  async updateJobItem(id: string, data: Partial<InsertJobItem>): Promise<JobItem | undefined> {
    const [updated] = await db.update(jobItems).set(data as any).where(eq(jobItems.id, id)).returning();
    return updated;
  }

  async deleteJobItem(id: string): Promise<void> {
    await db.delete(jobItems).where(eq(jobItems.id, id));
  }

  async deleteJobItems(jobId: string): Promise<void> {
    await db.delete(jobItems).where(eq(jobItems.jobId, jobId));
  }

  async getLibraryEntries(type?: string): Promise<LibraryEntry[]> {
    if (type) {
      return db.select().from(libraryEntries).where(eq(libraryEntries.type, type)).orderBy(asc(libraryEntries.sortOrder));
    }
    return db.select().from(libraryEntries).orderBy(asc(libraryEntries.sortOrder));
  }

  async createLibraryEntry(entry: InsertLibraryEntry): Promise<LibraryEntry> {
    const [created] = await db.insert(libraryEntries).values(entry).returning();
    return created;
  }

  async updateLibraryEntry(id: string, data: Partial<InsertLibraryEntry>): Promise<LibraryEntry | undefined> {
    const [updated] = await db.update(libraryEntries).set(data).where(eq(libraryEntries.id, id)).returning();
    return updated;
  }

  async deleteLibraryEntry(id: string): Promise<void> {
    await db.delete(libraryEntries).where(eq(libraryEntries.id, id));
  }

  async getFrameConfigurations(frameTypeId: string): Promise<FrameConfiguration[]> {
    return db.select().from(frameConfigurations).where(eq(frameConfigurations.frameTypeId, frameTypeId)).orderBy(asc(frameConfigurations.sortOrder));
  }

  async createFrameConfiguration(config: InsertFrameConfiguration): Promise<FrameConfiguration> {
    const [created] = await db.insert(frameConfigurations).values(config).returning();
    return created;
  }

  async updateFrameConfiguration(id: string, data: Partial<InsertFrameConfiguration>): Promise<FrameConfiguration | undefined> {
    const [updated] = await db.update(frameConfigurations).set(data).where(eq(frameConfigurations.id, id)).returning();
    return updated;
  }

  async deleteFrameConfiguration(id: string): Promise<void> {
    await this.deleteConfigurationChildren(id);
    await db.delete(frameConfigurations).where(eq(frameConfigurations.id, id));
  }

  async getConfigurationProfiles(configurationId: string): Promise<ConfigurationProfile[]> {
    return db.select().from(configurationProfiles).where(eq(configurationProfiles.configurationId, configurationId)).orderBy(asc(configurationProfiles.sortOrder));
  }

  async createConfigurationProfile(profile: InsertConfigurationProfile): Promise<ConfigurationProfile> {
    const [created] = await db.insert(configurationProfiles).values(profile).returning();
    return created;
  }

  async updateConfigurationProfile(id: string, data: Partial<InsertConfigurationProfile>): Promise<ConfigurationProfile | undefined> {
    const [updated] = await db.update(configurationProfiles).set(data).where(eq(configurationProfiles.id, id)).returning();
    return updated;
  }

  async deleteConfigurationProfile(id: string): Promise<void> {
    await db.delete(configurationProfiles).where(eq(configurationProfiles.id, id));
  }

  async getConfigurationAccessories(configurationId: string): Promise<ConfigurationAccessory[]> {
    return db.select().from(configurationAccessories).where(eq(configurationAccessories.configurationId, configurationId)).orderBy(asc(configurationAccessories.sortOrder));
  }

  async createConfigurationAccessory(accessory: InsertConfigurationAccessory): Promise<ConfigurationAccessory> {
    const [created] = await db.insert(configurationAccessories).values(accessory).returning();
    return created;
  }

  async updateConfigurationAccessory(id: string, data: Partial<InsertConfigurationAccessory>): Promise<ConfigurationAccessory | undefined> {
    const [updated] = await db.update(configurationAccessories).set(data).where(eq(configurationAccessories.id, id)).returning();
    return updated;
  }

  async deleteConfigurationAccessory(id: string): Promise<void> {
    await db.delete(configurationAccessories).where(eq(configurationAccessories.id, id));
  }

  async getConfigurationLabor(configurationId: string): Promise<ConfigurationLabor[]> {
    return db.select().from(configurationLabor).where(eq(configurationLabor.configurationId, configurationId)).orderBy(asc(configurationLabor.sortOrder));
  }

  async createConfigurationLabor(labor: InsertConfigurationLabor): Promise<ConfigurationLabor> {
    const [created] = await db.insert(configurationLabor).values(labor).returning();
    return created;
  }

  async updateConfigurationLabor(id: string, data: Partial<InsertConfigurationLabor>): Promise<ConfigurationLabor | undefined> {
    const [updated] = await db.update(configurationLabor).set(data).where(eq(configurationLabor.id, id)).returning();
    return updated;
  }

  async deleteConfigurationLabor(id: string): Promise<void> {
    await db.delete(configurationLabor).where(eq(configurationLabor.id, id));
  }

  async deleteConfigurationChildren(configurationId: string): Promise<void> {
    await db.delete(configurationProfiles).where(eq(configurationProfiles.configurationId, configurationId));
    await db.delete(configurationAccessories).where(eq(configurationAccessories.configurationId, configurationId));
    await db.delete(configurationLabor).where(eq(configurationLabor.configurationId, configurationId));
  }

  async getAllConfigurationProfiles(): Promise<ConfigurationProfile[]> {
    return db.select().from(configurationProfiles).orderBy(asc(configurationProfiles.sortOrder));
  }

  async getAllConfigurationAccessories(): Promise<ConfigurationAccessory[]> {
    return db.select().from(configurationAccessories).orderBy(asc(configurationAccessories.sortOrder));
  }

  async updateProfilesByMouldNumber(mouldNumber: string, data: Partial<InsertConfigurationProfile>): Promise<number> {
    const result = await db.update(configurationProfiles).set(data).where(eq(configurationProfiles.mouldNumber, mouldNumber)).returning();
    return result.length;
  }

  async updateAccessoriesByCode(code: string, data: Partial<InsertConfigurationAccessory>): Promise<number> {
    const result = await db.update(configurationAccessories).set(data).where(eq(configurationAccessories.code, code)).returning();
    return result.length;
  }

  async getNextQuoteNumber(divisionCode?: string): Promise<string> {
    await db.insert(numberSequences).values({ id: "quote", currentValue: 0 }).onConflictDoNothing();
    const [row] = await db.update(numberSequences)
      .set({ currentValue: sql`${numberSequences.currentValue} + 1` })
      .where(eq(numberSequences.id, "quote"))
      .returning();
    const org = await this.getOrgSettings();
    return formatQuoteNumber(row.currentValue, org?.quoteNumberPrefix ?? "Q", divisionCode, org?.quoteNumberUseDivisionSuffix ?? false);
  }

  async createQuote(data: InsertQuote): Promise<Quote> {
    const [created] = await db.insert(quotes).values(data).returning();
    return created;
  }

  async getQuote(id: string): Promise<Quote | undefined> {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, id));
    return quote;
  }

  async getQuoteByJobId(jobId: string): Promise<Quote | undefined> {
    const [quote] = await db.select().from(quotes).where(eq(quotes.sourceJobId, jobId));
    return quote;
  }

  async getQuotesByJobId(jobId: string): Promise<Quote[]> {
    return db.select().from(quotes)
      .where(and(eq(quotes.sourceJobId, jobId), isNull(quotes.deletedAt)))
      .orderBy(desc(quotes.createdAt));
  }

  async getAllQuotes(): Promise<Quote[]> {
    return db.select().from(quotes)
      .where(isNull(quotes.deletedAt))
      .orderBy(desc(quotes.createdAt));
  }

  async updateQuote(id: string, data: Partial<InsertQuote>): Promise<Quote | undefined> {
    const [updated] = await db.update(quotes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(quotes.id, id))
      .returning();
    return updated;
  }

  async updateQuoteStatus(id: string, status: string): Promise<Quote | undefined> {
    const [updated] = await db.update(quotes)
      .set({ status, updatedAt: new Date() })
      .where(eq(quotes.id, id))
      .returning();
    return updated;
  }

  async acceptQuote(id: string, data: { acceptedAt: Date; acceptedByUserId: string | null; acceptedValue: number; acceptedRevisionId: string }): Promise<Quote | undefined> {
    const [updated] = await db.update(quotes)
      .set({
        status: "accepted",
        acceptedAt: data.acceptedAt,
        acceptedByUserId: data.acceptedByUserId,
        acceptedValue: data.acceptedValue,
        acceptedRevisionId: data.acceptedRevisionId,
        updatedAt: new Date(),
      } as any)
      .where(eq(quotes.id, id))
      .returning();
    return updated;
  }

  async deleteQuoteAndRevisions(id: string): Promise<void> {
    await db.delete(quoteRevisions).where(eq(quoteRevisions.quoteId, id));
    await db.delete(quotes).where(eq(quotes.id, id));
  }

  async deleteAllQuotesAndRevisions(): Promise<number> {
    const allQuotes = await db.select({ id: quotes.id }).from(quotes);
    const count = allQuotes.length;
    if (count > 0) {
      await db.delete(quoteRevisions);
      await db.delete(quotes);
    }
    return count;
  }

  async updateQuoteCurrentRevision(id: string, revisionId: string): Promise<Quote | undefined> {
    const [updated] = await db.update(quotes)
      .set({ currentRevisionId: revisionId, updatedAt: new Date() })
      .where(eq(quotes.id, id))
      .returning();
    return updated;
  }

  async createQuoteRevision(data: InsertQuoteRevision): Promise<QuoteRevision> {
    const [created] = await db.insert(quoteRevisions).values(data).returning();
    return created;
  }

  async getQuoteRevisions(quoteId: string): Promise<QuoteRevision[]> {
    return db.select().from(quoteRevisions)
      .where(eq(quoteRevisions.quoteId, quoteId))
      .orderBy(asc(quoteRevisions.versionNumber));
  }

  async createAuditLog(data: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(data).returning();
    return created;
  }

  async getAuditLogs(entityType: string, entityId: string): Promise<AuditLog[]> {
    return db.select().from(auditLogs)
      .where(and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId)))
      .orderBy(desc(auditLogs.createdAt));
  }

  async getOrgSettings(): Promise<OrgSettings | undefined> {
    const [row] = await db.select().from(orgSettings).where(eq(orgSettings.id, "default"));
    return row;
  }

  async upsertOrgSettings(data: Partial<InsertOrgSettings>): Promise<OrgSettings> {
    const existing = await this.getOrgSettings();
    if (existing) {
      const [updated] = await db.update(orgSettings).set(data).where(eq(orgSettings.id, "default")).returning();
      return updated;
    }
    const [created] = await db.insert(orgSettings).values({ ...data, id: "default" } as any).returning();
    return created;
  }

  async getDivisionSettings(code: string): Promise<DivisionSettings | undefined> {
    const [row] = await db.select().from(divisionSettings).where(eq(divisionSettings.divisionCode, code));
    return row;
  }

  async getAllDivisionSettings(): Promise<DivisionSettings[]> {
    return db.select().from(divisionSettings);
  }

  async upsertDivisionSettings(code: string, data: Partial<InsertDivisionSettings>): Promise<DivisionSettings> {
    const existing = await this.getDivisionSettings(code);
    if (existing) {
      const [updated] = await db.update(divisionSettings).set(data).where(eq(divisionSettings.divisionCode, code)).returning();
      return updated;
    }
    const [created] = await db.insert(divisionSettings).values({ ...data, divisionCode: code } as any).returning();
    return created;
  }

  async getSpecDictionary(divisionScope?: string): Promise<SpecDictionaryEntry[]> {
    if (divisionScope) {
      return db.select().from(specDictionary)
        .where(sql`${specDictionary.divisionScope} IS NULL OR ${specDictionary.divisionScope} = ${divisionScope}`)
        .orderBy(asc(specDictionary.sortOrder));
    }
    return db.select().from(specDictionary).orderBy(asc(specDictionary.sortOrder));
  }

  async getAllSpecEntries(): Promise<SpecDictionaryEntry[]> {
    return db.select().from(specDictionary).orderBy(asc(specDictionary.sortOrder));
  }

  async getLibraryEntriesWithScope(type?: string, divisionCode?: string): Promise<LibraryEntry[]> {
    if (type && divisionCode) {
      return db.select().from(libraryEntries)
        .where(and(
          eq(libraryEntries.type, type),
          sql`(${libraryEntries.divisionScope} IS NULL OR ${libraryEntries.divisionScope} = ${divisionCode})`
        ))
        .orderBy(asc(libraryEntries.sortOrder));
    }
    if (type) {
      return db.select().from(libraryEntries).where(eq(libraryEntries.type, type)).orderBy(asc(libraryEntries.sortOrder));
    }
    if (divisionCode) {
      return db.select().from(libraryEntries)
        .where(sql`(${libraryEntries.divisionScope} IS NULL OR ${libraryEntries.divisionScope} = ${divisionCode})`)
        .orderBy(asc(libraryEntries.sortOrder));
    }
    return db.select().from(libraryEntries).orderBy(asc(libraryEntries.sortOrder));
  }

  async saveItemPhoto(key: string, data: Buffer, mimeType: string): Promise<void> {
    await db.insert(itemPhotos).values({
      key,
      data,
      mimeType,
      sizeBytes: data.length,
    }).onConflictDoUpdate({
      target: itemPhotos.key,
      set: { data, mimeType, sizeBytes: data.length },
    });
  }

  async getItemPhoto(key: string): Promise<{ data: Buffer; mimeType: string } | undefined> {
    const [row] = await db.select({ data: itemPhotos.data, mimeType: itemPhotos.mimeType })
      .from(itemPhotos)
      .where(eq(itemPhotos.key, key));
    if (!row) return undefined;
    return { data: Buffer.from(row.data), mimeType: row.mimeType };
  }

  async deleteItemPhoto(key: string): Promise<void> {
    await db.delete(itemPhotos).where(eq(itemPhotos.key, key));
  }

  async deleteItemPhotos(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await db.delete(itemPhotos).where(inArray(itemPhotos.key, keys));
  }

  async getAllCustomers(): Promise<Customer[]> {
    return db.select().from(customers).where(isNull(customers.archivedAt)).orderBy(asc(customers.name));
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [row] = await db.select().from(customers).where(eq(customers.id, id));
    return row;
  }

  async createCustomer(data: InsertCustomer): Promise<Customer> {
    const [created] = await db.insert(customers).values(data).returning();
    return created;
  }

  async updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [updated] = await db.update(customers).set(data).where(eq(customers.id, id)).returning();
    return updated;
  }

  async archiveCustomer(id: string): Promise<Customer | undefined> {
    const [updated] = await db.update(customers).set({ archivedAt: new Date() } as any).where(eq(customers.id, id)).returning();
    return updated;
  }

  async listContacts(filters?: { customerId?: string; category?: string; search?: string }): Promise<CustomerContact[]> {
    const conditions = [isNull(customerContacts.archivedAt)];
    if (filters?.customerId) conditions.push(eq(customerContacts.customerId, filters.customerId));
    if (filters?.category) conditions.push(eq(customerContacts.category, filters.category));
    if (filters?.search) {
      const q = `%${filters.search}%`;
      const matchingCustomerIds = await db
        .select({ id: customers.id })
        .from(customers)
        .where(ilike(customers.name, q));
      const customerIdList = matchingCustomerIds.map((c) => c.id);
      const searchOr = or(
        ilike(customerContacts.firstName, q),
        ilike(customerContacts.lastName, q),
        ilike(customerContacts.email, q),
        ilike(customerContacts.phone, q),
        ilike(customerContacts.mobile, q),
        customerIdList.length > 0 ? inArray(customerContacts.customerId, customerIdList) : sql`false`,
      );
      conditions.push(searchOr!);
    }
    return db
      .select()
      .from(customerContacts)
      .where(and(...conditions))
      .orderBy(asc(customerContacts.firstName), asc(customerContacts.lastName));
  }

  async getCustomerContacts(customerId: string): Promise<CustomerContact[]> {
    return db.select().from(customerContacts).where(and(eq(customerContacts.customerId, customerId), isNull(customerContacts.archivedAt))).orderBy(desc(customerContacts.isPrimary), asc(customerContacts.firstName), asc(customerContacts.lastName));
  }

  async getContact(id: string): Promise<CustomerContact | undefined> {
    const [contact] = await db.select().from(customerContacts).where(eq(customerContacts.id, id));
    return contact;
  }

  async createCustomerContact(data: InsertCustomerContact): Promise<CustomerContact> {
    const [created] = await db.insert(customerContacts).values(data).returning();
    return created;
  }

  async updateCustomerContact(id: string, data: Partial<InsertCustomerContact>): Promise<CustomerContact | undefined> {
    const [updated] = await db.update(customerContacts).set(data).where(eq(customerContacts.id, id)).returning();
    return updated;
  }

  async archiveContact(id: string): Promise<CustomerContact | undefined> {
    const [updated] = await db.update(customerContacts).set({ archivedAt: new Date() }).where(eq(customerContacts.id, id)).returning();
    return updated;
  }

  async deleteCustomerContact(id: string): Promise<void> {
    await db.delete(customerContacts).where(eq(customerContacts.id, id));
  }

  async getAllProjects(): Promise<Project[]> {
    return db.select().from(projects).where(isNull(projects.archivedAt)).orderBy(desc(projects.createdAt));
  }

  async getProjectsByCustomer(customerId: string): Promise<Project[]> {
    return db.select().from(projects).where(and(eq(projects.customerId, customerId), isNull(projects.archivedAt))).orderBy(desc(projects.createdAt));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [row] = await db.select().from(projects).where(eq(projects.id, id));
    return row;
  }

  async createProject(data: InsertProject): Promise<Project> {
    const [created] = await db.insert(projects).values(data).returning();
    return created;
  }

  async updateProject(id: string, data: Partial<InsertProject>): Promise<Project | undefined> {
    const [updated] = await db.update(projects).set(data).where(eq(projects.id, id)).returning();
    return updated;
  }

  async archiveProject(id: string): Promise<Project | undefined> {
    const [updated] = await db.update(projects).set({ archivedAt: new Date() } as any).where(eq(projects.id, id)).returning();
    return updated;
  }

  async getNextInvoiceNumber(): Promise<string> {
    await db.insert(numberSequences).values({ id: "invoice", currentValue: 0 }).onConflictDoNothing();
    const [row] = await db.update(numberSequences)
      .set({ currentValue: sql`${numberSequences.currentValue} + 1` })
      .where(eq(numberSequences.id, "invoice"))
      .returning();
    return `INV-${String(row.currentValue).padStart(4, "0")}`;
  }

  async createInvoice(data: InsertInvoice): Promise<Invoice> {
    const [created] = await db.insert(invoices).values(data as any).returning();
    return created;
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [row] = await db.select().from(invoices).where(eq(invoices.id, id));
    return row;
  }

  async getInvoicesByQuote(quoteId: string): Promise<Invoice[]> {
    return db.select().from(invoices).where(eq(invoices.quoteId, quoteId)).orderBy(desc(invoices.createdAt));
  }

  async getAllInvoices(): Promise<Invoice[]> {
    return db.select().from(invoices).orderBy(desc(invoices.createdAt));
  }

  async getAllInvoicesEnriched(): Promise<(Invoice & { customerName: string | null; projectName: string | null })[]> {
    const result = await pool.query(`
      SELECT
        i.*,
        c.name AS "customerName",
        p.name AS "projectName"
      FROM invoices i
      LEFT JOIN customers c ON c.id = i.customer_id
      LEFT JOIN projects p ON p.id = i.project_id
      ORDER BY i.created_at DESC
    `);
    return result.rows.map((row: any) => ({
      id: row.id,
      number: row.number,
      quoteId: row.quote_id,
      quoteRevisionId: row.quote_revision_id,
      divisionCode: row.division_code,
      customerId: row.customer_id,
      projectId: row.project_id,
      type: row.type,
      status: row.status,
      depositType: row.deposit_type,
      depositPercentage: row.deposit_percentage,
      amountExclGst: row.amount_excl_gst,
      gstAmount: row.gst_amount,
      amountInclGst: row.amount_incl_gst,
      description: row.description,
      notes: row.notes,
      xeroInvoiceId: row.xero_invoice_id,
      xeroInvoiceNumber: row.xero_invoice_number,
      xeroStatus: row.xero_status,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      customerName: row.customerName ?? null,
      projectName: row.projectName ?? null,
    }));
  }

  async updateInvoice(id: string, data: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const [updated] = await db.update(invoices)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(invoices.id, id))
      .returning();
    return updated;
  }

  async getNextJobNumber(divisionCode?: string): Promise<string> {
    await db.insert(numberSequences).values({ id: "op_job", currentValue: 0 }).onConflictDoNothing();
    const [row] = await db.update(numberSequences)
      .set({ currentValue: sql`${numberSequences.currentValue} + 1` })
      .where(eq(numberSequences.id, "op_job"))
      .returning();
    const org = await this.getOrgSettings();
    const prefix = org?.jobNumberPrefix ?? "J";
    const base = `${prefix}-${String(row.currentValue).padStart(4, "0")}`;
    if (org?.jobNumberUseDivisionSuffix && divisionCode) return `${base}-${divisionCode}`;
    return base;
  }

  async getNumberSequences(): Promise<{ id: string; currentValue: number }[]> {
    return db.select().from(numberSequences).where(
      sql`${numberSequences.id} IN ('quote', 'op_job', 'invoice')`
    );
  }

  async setNumberSequence(id: string, nextValue: number): Promise<void> {
    await db.insert(numberSequences).values({ id, currentValue: 0 }).onConflictDoNothing();
    await db.update(numberSequences)
      .set({ currentValue: nextValue - 1 })
      .where(eq(numberSequences.id, id));
  }

  async createOpJob(data: InsertOpJob): Promise<OpJob> {
    const [created] = await db.insert(opJobs).values(data as any).returning();
    return created;
  }

  async getOpJob(id: string): Promise<OpJob | undefined> {
    const [row] = await db.select().from(opJobs).where(eq(opJobs.id, id));
    return row;
  }

  async getAllOpJobs(): Promise<OpJob[]> {
    return db.select().from(opJobs).where(isNull(opJobs.archivedAt)).orderBy(desc(opJobs.createdAt));
  }

  async getArchivedOpJobs(): Promise<OpJob[]> {
    return db.select().from(opJobs).where(isNotNull(opJobs.archivedAt)).orderBy(desc(opJobs.createdAt));
  }

  async archiveOpJob(id: string): Promise<OpJob | undefined> {
    const job = await this.getOpJob(id);
    if (!job || job.archivedAt) return undefined;
    const [updated] = await db.update(opJobs).set({ archivedAt: new Date() } as any).where(eq(opJobs.id, id)).returning();
    return updated;
  }

  async unarchiveOpJob(id: string): Promise<OpJob | undefined> {
    const job = await this.getOpJob(id);
    if (!job || !job.archivedAt) return undefined;
    const [updated] = await db.update(opJobs).set({ archivedAt: null } as any).where(eq(opJobs.id, id)).returning();
    return updated;
  }

  async updateOpJob(id: string, data: Partial<InsertOpJob>): Promise<OpJob | undefined> {
    const [updated] = await db.update(opJobs)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(opJobs.id, id))
      .returning();
    return updated;
  }

  async getOpJobByQuoteId(quoteId: string): Promise<OpJob | undefined> {
    const [row] = await db.select().from(opJobs).where(eq(opJobs.sourceQuoteId, quoteId));
    return row;
  }

  async getDemoQuotes(): Promise<Quote[]> {
    return db.select().from(quotes)
      .where(and(eq(quotes.isDemoRecord, true), isNull(quotes.deletedAt)));
  }

  async getDemoOpJobs(): Promise<OpJob[]> {
    return db.select().from(opJobs).where(eq(opJobs.isDemoRecord, true));
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async getActiveLifecycleTemplate(divisionCode: string): Promise<LifecycleTemplate | undefined> {
    const [row] = await db
      .select()
      .from(lifecycleTemplates)
      .where(and(eq(lifecycleTemplates.divisionCode, divisionCode), eq(lifecycleTemplates.isActive, true)))
      .orderBy(desc(lifecycleTemplates.version))
      .limit(1);
    return row;
  }

  async getLifecycleTemplateById(id: string): Promise<LifecycleTemplate | undefined> {
    const [row] = await db
      .select()
      .from(lifecycleTemplates)
      .where(eq(lifecycleTemplates.id, id))
      .limit(1);
    return row;
  }

  async getLifecycleInstanceForQuote(quoteId: string): Promise<LifecycleInstance | undefined> {
    const [row] = await db
      .select()
      .from(lifecycleInstances)
      .where(eq(lifecycleInstances.quoteId, quoteId))
      .limit(1);
    return row;
  }

  async createLifecycleInstance(data: {
    quoteId: string;
    divisionCode: string;
    templateId: string;
    templateVersion: number;
  }): Promise<LifecycleInstance> {
    const [created] = await db
      .insert(lifecycleInstances)
      .values({
        quoteId: data.quoteId,
        divisionCode: data.divisionCode,
        templateId: data.templateId,
        templateVersion: data.templateVersion,
        assignedAt: new Date(),
      })
      .returning();
    return created;
  }

  async updateLifecycleInstanceJob(quoteId: string, opJobId: string): Promise<void> {
    await db
      .update(lifecycleInstances)
      .set({ opJobId })
      .where(eq(lifecycleInstances.quoteId, quoteId));
  }
}

export function formatQuoteNumber(seq: number, prefix = "Q", divisionCode?: string, useDivisionSuffix = false): string {
  const base = `${prefix}-${String(seq).padStart(4, "0")}`;
  if (useDivisionSuffix && divisionCode) return `${base}-${divisionCode}`;
  return base;
}

export const storage = new DatabaseStorage();
