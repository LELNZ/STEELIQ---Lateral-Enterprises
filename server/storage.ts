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
  users, jobs, jobItems, libraryEntries,
  frameConfigurations, configurationProfiles, configurationAccessories, configurationLabor,
  numberSequences, quotes, quoteRevisions, auditLogs,
  orgSettings, divisionSettings, specDictionary,
  itemPhotos,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, asc, desc, and, sql, isNull, isNotNull, inArray } from "drizzle-orm";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool);
export { pool };

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

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

  getNextQuoteNumber(): Promise<string>;
  createQuote(data: InsertQuote): Promise<Quote>;
  getQuote(id: string): Promise<Quote | undefined>;
  getQuoteByJobId(jobId: string): Promise<Quote | undefined>;
  getQuotesByJobId(jobId: string): Promise<Quote[]>;
  getAllQuotes(): Promise<Quote[]>;
  updateQuote(id: string, data: Partial<InsertQuote>): Promise<Quote | undefined>;
  updateQuoteStatus(id: string, status: string): Promise<Quote | undefined>;
  updateQuoteCurrentRevision(id: string, revisionId: string): Promise<Quote | undefined>;
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
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
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

  async getNextQuoteNumber(): Promise<string> {
    await db.insert(numberSequences).values({ id: "quote", currentValue: 0 }).onConflictDoNothing();
    const [row] = await db.update(numberSequences)
      .set({ currentValue: sql`${numberSequences.currentValue} + 1` })
      .where(eq(numberSequences.id, "quote"))
      .returning();
    return formatQuoteNumber(row.currentValue);
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
}

export function formatQuoteNumber(seq: number): string {
  return `Q-${String(seq).padStart(4, "0")}`;
}

export const storage = new DatabaseStorage();
