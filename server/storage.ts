import {
  type User, type InsertUser,
  type Job, type InsertJob,
  type JobItem, type InsertJobItem,
  type LibraryEntry, type InsertLibraryEntry,
  type FrameConfiguration, type InsertFrameConfiguration,
  type ConfigurationProfile, type InsertConfigurationProfile,
  type ConfigurationAccessory, type InsertConfigurationAccessory,
  type ConfigurationLabor, type InsertConfigurationLabor,
  users, jobs, jobItems, libraryEntries,
  frameConfigurations, configurationProfiles, configurationAccessories, configurationLabor,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, asc } from "drizzle-orm";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  createJob(job: InsertJob): Promise<Job>;
  getJob(id: string): Promise<Job | undefined>;
  getAllJobs(): Promise<Job[]>;
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
    return db.select().from(jobs);
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
}

export const storage = new DatabaseStorage();
