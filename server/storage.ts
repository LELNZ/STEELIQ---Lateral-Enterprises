import {
  type User, type InsertUser,
  type Job, type InsertJob,
  type JobItem, type InsertJobItem,
  type LibraryEntry, type InsertLibraryEntry,
  users, jobs, jobItems, libraryEntries,
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
    const [created] = await db.insert(jobItems).values(item).returning();
    return created;
  }

  async getJobItems(jobId: string): Promise<JobItem[]> {
    return db.select().from(jobItems).where(eq(jobItems.jobId, jobId)).orderBy(asc(jobItems.sortOrder));
  }

  async updateJobItem(id: string, data: Partial<InsertJobItem>): Promise<JobItem | undefined> {
    const [updated] = await db.update(jobItems).set(data).where(eq(jobItems.id, id)).returning();
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
}

export const storage = new DatabaseStorage();
