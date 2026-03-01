import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertJobSchema, insertLibraryEntrySchema, quoteItemSchema } from "@shared/schema";
import { z } from "zod";
import { GLASS_LIBRARY } from "@shared/glass-library";
import { FRAME_TYPES, FRAME_COLORS, LINER_TYPES, WINDOW_HANDLES, DOOR_HANDLES } from "@shared/item-options";

async function seedLibraryDefaults() {
  const existing = await storage.getLibraryEntries();
  for (const entry of existing) {
    await storage.deleteLibraryEntry(entry.id);
  }

  let sortOrder = 0;
  for (const glass of GLASS_LIBRARY) {
    await storage.createLibraryEntry({ type: "glass", data: { iguType: glass.iguType, combo: glass.combo, prices: glass.prices }, sortOrder: sortOrder++ });
  }
  sortOrder = 0;
  for (const ft of FRAME_TYPES) {
    await storage.createLibraryEntry({ type: "frame_type", data: { value: ft.value, label: ft.label, categories: ft.categories, pricePerKg: ft.pricePerKg }, sortOrder: sortOrder++ });
  }
  sortOrder = 0;
  for (const fc of FRAME_COLORS) {
    await storage.createLibraryEntry({ type: "frame_color", data: { value: fc.value, label: fc.label, priceProvision: fc.priceProvision }, sortOrder: sortOrder++ });
  }
  sortOrder = 0;
  for (const wh of WINDOW_HANDLES) {
    await storage.createLibraryEntry({ type: "window_handle", data: { value: wh.value, label: wh.label, priceProvision: wh.priceProvision }, sortOrder: sortOrder++ });
  }
  sortOrder = 0;
  for (const dh of DOOR_HANDLES) {
    await storage.createLibraryEntry({ type: "door_handle", data: { value: dh.value, label: dh.label, priceProvision: dh.priceProvision }, sortOrder: sortOrder++ });
  }
  sortOrder = 0;
  for (const lt of LINER_TYPES) {
    await storage.createLibraryEntry({ type: "liner_type", data: { value: lt.value, label: lt.label, priceProvision: lt.priceProvision }, sortOrder: sortOrder++ });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const existingEntries = await storage.getLibraryEntries();
  if (existingEntries.length === 0) {
    console.log("Library is empty, seeding defaults...");
    await seedLibraryDefaults();
    console.log("Library seeded with defaults");
  }

  app.post("/api/jobs", async (req, res) => {
    try {
      const parsed = insertJobSchema.parse(req.body);
      const job = await storage.createJob(parsed);
      res.json(job);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/jobs", async (_req, res) => {
    try {
      const allJobs = await storage.getAllJobs();
      const jobsWithCounts = await Promise.all(
        allJobs.map(async (job) => {
          const items = await storage.getJobItems(job.id);
          let totalSqm = 0;
          for (const it of items) {
            const cfg = it.config as any;
            if (cfg && cfg.width && cfg.height) {
              totalSqm += (cfg.width * cfg.height * (cfg.quantity || 1)) / 1_000_000;
            }
          }
          return { ...job, itemCount: items.length, totalSqm: Math.round(totalSqm * 100) / 100 };
        })
      );
      res.json(jobsWithCounts);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) return res.status(404).json({ error: "Job not found" });
      const items = await storage.getJobItems(job.id);
      res.json({ ...job, items });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/jobs/:id", async (req, res) => {
    try {
      const parsed = insertJobSchema.partial().parse(req.body);
      const job = await storage.updateJob(req.params.id, parsed);
      if (!job) return res.status(404).json({ error: "Job not found" });
      res.json(job);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/jobs/:id", async (req, res) => {
    try {
      await storage.deleteJob(req.params.id);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  const jobItemBodySchema = z.object({
    config: quoteItemSchema,
    photo: z.string().nullable().optional(),
    sortOrder: z.number().int().optional().default(0),
  });

  app.post("/api/jobs/:id/items", async (req, res) => {
    try {
      const parsed = jobItemBodySchema.parse(req.body);
      const item = await storage.addJobItem({
        jobId: req.params.id,
        config: parsed.config,
        photo: parsed.photo || null,
        sortOrder: parsed.sortOrder,
      });
      res.json(item);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/jobs/:id/items/:itemId", async (req, res) => {
    try {
      const item = await storage.updateJobItem(req.params.itemId, req.body);
      if (!item) return res.status(404).json({ error: "Item not found" });
      res.json(item);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/jobs/:id/items/:itemId", async (req, res) => {
    try {
      await storage.deleteJobItem(req.params.itemId);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/library", async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const entries = await storage.getLibraryEntries(type);
      res.json(entries);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/library", async (req, res) => {
    try {
      const parsed = insertLibraryEntrySchema.parse(req.body);
      const entry = await storage.createLibraryEntry(parsed);
      res.json(entry);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/library/:id", async (req, res) => {
    try {
      const parsed = insertLibraryEntrySchema.partial().parse(req.body);
      const entry = await storage.updateLibraryEntry(req.params.id, parsed);
      if (!entry) return res.status(404).json({ error: "Library entry not found" });
      res.json(entry);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/library/:id", async (req, res) => {
    try {
      await storage.deleteLibraryEntry(req.params.id);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/library/seed", async (_req, res) => {
    try {
      await seedLibraryDefaults();
      const allEntries = await storage.getLibraryEntries();
      res.json({ ok: true, count: allEntries.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return httpServer;
}
