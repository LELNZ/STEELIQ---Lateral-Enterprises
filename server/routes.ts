import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertJobSchema, quoteItemSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
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

  return httpServer;
}
