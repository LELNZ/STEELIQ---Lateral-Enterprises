import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, pool, formatQuoteNumber } from "./storage";
import {
  insertJobSchema, insertLibraryEntrySchema, quoteItemSchema,
  insertFrameConfigurationSchema, insertConfigurationProfileSchema,
  insertConfigurationAccessorySchema, insertConfigurationLaborSchema,
  VALID_STATUS_TRANSITIONS, QUOTE_STATUSES, type QuoteStatus,
} from "@shared/schema";
import { z } from "zod";
import { estimateSnapshotSchema } from "@shared/estimate-snapshot";
import { GLASS_LIBRARY } from "@shared/glass-library";
import { FRAME_TYPES, FRAME_COLORS, LINER_TYPES, HANDLE_CATEGORIES, LOCK_CATEGORIES, WANZ_BAR_DEFAULTS } from "@shared/item-options";
import multer from "multer";
import path from "path";
import { sendQuoteEmail, isEmailConfigured } from "./email";
import fs from "fs";
import crypto from "crypto";
import {
  handleEstimateDeleteCascade,
  handleEstimateArchiveCascade,
  archiveQuote,
  unarchiveQuote,
  hardDeleteQuote,
  enrichQuotesWithOrphanState,
  clearAllQuotes,
  type QuoteCascadeAction,
} from "./quote-lifecycle";
import { requireAuth } from "./auth";

async function seedLibraryDefaults() {
  const existing = await storage.getLibraryEntries();
  const existingTypes = new Set(existing.map((e) => e.type));
  const existingValues = new Set(
    existing
      .filter((e) => (e.data as any)?.value)
      .map((e) => `${e.type}::${(e.data as any).value}`)
  );
  const existingCombos = new Set(
    existing
      .filter((e) => (e.data as any)?.combo)
      .map((e) => `${e.type}::${(e.data as any).combo}`)
  );

  const seedType = async (type: string, entries: { data: Record<string, unknown> }[]) => {
    if (existingTypes.has(type)) {
      const maxSort = existing.filter((e) => e.type === type).reduce((m, e) => Math.max(m, e.sortOrder ?? 0), -1);
      let nextSort = maxSort + 1;
      for (const entry of entries) {
        const key = (entry.data as any).value
          ? `${type}::${(entry.data as any).value}`
          : (entry.data as any).combo
            ? `${type}::${(entry.data as any).combo}`
            : null;
        if (key && (existingValues.has(key) || existingCombos.has(key))) continue;
        await storage.createLibraryEntry({ type, data: entry.data, sortOrder: nextSort++ });
      }
      return;
    }
    let sortOrder = 0;
    for (const entry of entries) {
      await storage.createLibraryEntry({ type, data: entry.data, sortOrder: sortOrder++ });
    }
  };

  await seedType("glass", GLASS_LIBRARY.map((g) => ({ data: { iguType: g.iguType, combo: g.combo, prices: g.prices } })));
  await seedType("frame_type", FRAME_TYPES.map((ft) => ({ data: { value: ft.value, label: ft.label, categories: ft.categories, pricePerKg: ft.pricePerKg } })));
  await seedType("frame_color", FRAME_COLORS.map((fc) => ({ data: { value: fc.value, label: fc.label, priceProvision: fc.priceProvision, supplierCode: fc.supplierCode || "" } })));
  await seedType("liner_type", LINER_TYPES.map((lt) => ({ data: { value: lt.value, label: lt.label, priceProvision: lt.priceProvision } })));
  for (const hc of HANDLE_CATEGORIES) {
    await seedType(hc.type, hc.defaults.map((h) => ({ data: { value: h.value, label: h.label, priceProvision: h.priceProvision } })));
  }
  for (const lc of LOCK_CATEGORIES) {
    await seedType(lc.type, lc.defaults.map((l) => ({ data: { value: l.value, label: l.label, priceProvision: l.priceProvision } })));
  }
  await seedType("wanz_bar", WANZ_BAR_DEFAULTS.map((wb) => ({
    data: { value: wb.value, label: wb.label, sectionNumber: wb.sectionNumber, kgPerMetre: wb.kgPerMetre, pricePerKgUsd: wb.pricePerKgUsd, priceNzdPerLinM: wb.priceNzdPerLinM }
  })));
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
  } else {
    const hasWanzBar = existingEntries.some((e) => e.type === "wanz_bar");
    if (!hasWanzBar) {
      console.log("Seeding wanz_bar defaults...");
      for (let i = 0; i < WANZ_BAR_DEFAULTS.length; i++) {
        const wb = WANZ_BAR_DEFAULTS[i];
        await storage.createLibraryEntry({ type: "wanz_bar", data: { value: wb.value, label: wb.label, sectionNumber: wb.sectionNumber, kgPerMetre: wb.kgPerMetre, pricePerKgUsd: wb.pricePerKgUsd, priceNzdPerLinM: wb.priceNzdPerLinM }, sortOrder: i });
      }
    }

    const hasLocks = existingEntries.some((e) => e.type.endsWith("_door_lock"));
    if (!hasLocks) {
      console.log("Seeding lock defaults...");
      for (const lc of LOCK_CATEGORIES) {
        for (let i = 0; i < lc.defaults.length; i++) {
          const l = lc.defaults[i];
          await storage.createLibraryEntry({ type: lc.type, data: { value: l.value, label: l.label, priceProvision: l.priceProvision }, sortOrder: i });
        }
      }
    }
  }

  const hasDirectProfiles = existingEntries.some((e) => e.type === "direct_profile");
  if (!hasDirectProfiles) {
    console.log("Seeding direct materials from configurations...");
    await seedDirectMaterials();
    console.log("Direct materials seeded");
  }

  const hasProfileRoles = existingEntries.some((e) => e.type === "profile_role");
  if (!hasProfileRoles) {
    console.log("Seeding profile role dictionary...");
    const PROFILE_ROLES_SEED = ["outer-frame", "sash-frame", "mullion", "bead", "spacer", "door-frame", "transom", "sidelight-mullion"];
    for (let i = 0; i < PROFILE_ROLES_SEED.length; i++) {
      await storage.createLibraryEntry({ type: "profile_role", data: { name: PROFILE_ROLES_SEED[i] }, sortOrder: i });
    }
    console.log("Profile role dictionary seeded");
  }

  const existingColors = await storage.getLibraryEntries("frame_color");
  for (const entry of existingColors) {
    const d = entry.data as any;
    if (d.value && !d.supplierCode) {
      const match = FRAME_COLORS.find((fc) => fc.value === d.value);
      if (match && match.supplierCode) {
        await storage.updateLibraryEntry(entry.id, { data: { ...d, supplierCode: match.supplierCode } });
      }
    }
  }

  await seedLabourOperations();
  await seedInstallationRates();
  await seedDeliveryRates();
  await seedOrgAndDivisions();
  await seedSpecDictionary();

  const existingAdmin = await storage.getUserByUsername("admin").catch(() => undefined);
  if (!existingAdmin) {
    console.log("Creating default admin user...");
    const { hashPassword: _seedHash } = await import("./auth");
    const pw = await _seedHash("SteelIQ2025!");
    await storage.createUser({
      username: "admin",
      password: pw,
      email: "admin@lateralenterprises.co.nz",
      displayName: "Admin",
      role: "admin",
      divisionCode: undefined,
    });
    console.log("Default admin user created (username: admin, password: SteelIQ2025!)");
  }

  const ljDiv = await storage.getDivisionSettings("LJ");
  if (ljDiv) {
    const specKeys = (ljDiv as any).specDisplayDefaultsJson as string[] | null;
    if (specKeys && Array.isArray(specKeys) && !specKeys.includes("lockSet")) {
      const handleIdx = specKeys.indexOf("handleSet");
      const updated = [...specKeys];
      if (handleIdx >= 0) {
        updated.splice(handleIdx + 1, 0, "lockSet");
      } else {
        updated.push("lockSet");
      }
      await storage.upsertDivisionSettings("LJ", { specDisplayDefaultsJson: updated });
    }
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

  app.get("/api/jobs", async (req, res) => {
    try {
      const scope = req.query.scope as string | undefined;
      const allJobs = scope === "archived"
        ? await storage.getArchivedJobs()
        : await storage.getAllJobs();
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

  async function getReferencedPhotoKeys(jobId: string): Promise<Set<string>> {
    const referenced = new Set<string>();
    try {
      const linkedQuotes = await storage.getQuotesByJobId(jobId);
      const singleQuote = await storage.getQuoteByJobId(jobId);
      const allQuotes = [...linkedQuotes];
      if (singleQuote && !allQuotes.find(q => q.id === singleQuote.id)) {
        allQuotes.push(singleQuote);
      }
      for (const quote of allQuotes) {
        const revisions = await storage.getQuoteRevisions(quote.id);
        for (const rev of revisions) {
          try {
            const snapshot = rev.snapshotJson as any;
            const items = snapshot?.items || [];
            for (const item of items) {
              const photos = item.photos || [];
              for (const p of photos) {
                if (p.key) referenced.add(p.key);
              }
            }
          } catch {}
        }
      }
    } catch {}
    return referenced;
  }

  async function safeDeletePhotoFile(key: string): Promise<void> {
    try {
      await storage.deleteItemPhoto(key);
    } catch (e) {
      console.error(`[photo-cleanup] DB delete failed for ${key}:`, e);
    }
    try {
      const filePath = path.resolve(ITEM_PHOTO_DIR, key);
      if (filePath.startsWith(path.resolve(ITEM_PHOTO_DIR)) && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {}
    photoCache.delete(key);
  }

  app.delete("/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) return res.status(404).json({ error: "Job not found" });

      const linkedQuotes = await storage.getQuotesByJobId(req.params.id);
      const activeQuotes = linkedQuotes.filter(
        (q) => q.status !== "draft" && q.status !== "archived" && q.status !== "cancelled" && !q.deletedAt,
      );
      if (activeQuotes.length > 0 && req.body?.force !== true) {
        return res.status(422).json({
          error: `This estimate has ${activeQuotes.length} active quote(s) (${activeQuotes.map((q) => q.number).join(", ")}). Archive or cancel them before deleting this estimate, or pass force: true to override.`,
          activeQuotes: activeQuotes.map((q) => ({ id: q.id, number: q.number, status: q.status })),
        });
      }

      const cascadeAction: QuoteCascadeAction = req.body?.quoteCascade || "archive";
      const validActions: QuoteCascadeAction[] = ["archive", "delete", "keep"];
      if (!validActions.includes(cascadeAction)) {
        return res.status(400).json({ error: `Invalid quoteCascade value. Must be one of: ${validActions.join(", ")}` });
      }

      if (cascadeAction === "delete" && req.body?.confirmPermanent !== true) {
        return res.status(400).json({
          error: "Permanently deleting linked quotes requires confirmPermanent: true",
        });
      }

      const cascadeResult = await handleEstimateDeleteCascade(req.params.id, cascadeAction);

      const items = await storage.getJobItems(req.params.id);
      const allPhotoKeys: string[] = [];
      for (const item of items) {
        const photos = (item.photos as any[]) || [];
        for (const p of photos) {
          if (p.key) allPhotoKeys.push(p.key);
        }
      }

      const referenced = await getReferencedPhotoKeys(req.params.id);

      await storage.deleteJob(req.params.id);

      for (const key of allPhotoKeys) {
        if (!referenced.has(key)) {
          await safeDeletePhotoFile(key);
        }
      }

      res.json({ ok: true, quotesAffected: cascadeResult.quotesAffected, cascadeAction });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/jobs/:id/quotes", async (req, res) => {
    try {
      const linkedQuotes = await storage.getQuotesByJobId(req.params.id);
      const enriched = await Promise.all(linkedQuotes.map(async (q) => {
        const revisions = await storage.getQuoteRevisions(q.id);
        const currentRev = revisions.find(r => r.id === q.currentRevisionId);
        return {
          ...q,
          revisionCount: revisions.length,
          currentRevisionNumber: currentRev?.versionNumber || revisions.length || 1,
        };
      }));
      res.json(enriched);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/jobs/:id/archive", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) return res.status(404).json({ error: "Job not found" });
      if (job.archivedAt) return res.status(400).json({ error: "Job is already archived" });

      const cascadeAction = req.body?.quoteCascade || "archive";
      const validArchiveActions = ["archive", "keep"];
      if (!validArchiveActions.includes(cascadeAction)) {
        return res.status(400).json({ error: `Invalid quoteCascade value. Must be one of: ${validArchiveActions.join(", ")}` });
      }
      const cascadeResult = await handleEstimateArchiveCascade(req.params.id, cascadeAction as "archive" | "keep");

      await storage.archiveJob(req.params.id);

      res.json({ ok: true, quotesAffected: cascadeResult.quotesAffected, cascadeAction });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/jobs/:id/unarchive", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) return res.status(404).json({ error: "Job not found" });
      if (!job.archivedAt) return res.status(400).json({ error: "Job is not archived" });

      const updated = await storage.unarchiveJob(req.params.id);
      res.json({ ok: true, job: updated });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  const PHOTO_KEY_REGEX = /^[A-Za-z0-9._-]+\.jpg$/;
  const itemPhotoRefSchema = z.object({
    key: z.string()
      .max(200)
      .refine(k => !k.startsWith("data:"), { message: "Data URIs not allowed in photo keys" })
      .refine(k => PHOTO_KEY_REGEX.test(k), { message: "Photo key must match [A-Za-z0-9._-]+.jpg" }),
    isPrimary: z.boolean().optional(),
    includeInCustomerPdf: z.boolean().optional(),
    caption: z.string().max(500).optional(),
    takenAt: z.string().optional(),
  });

  const jobItemBodySchema = z.object({
    config: quoteItemSchema,
    photo: z.string().nullable().optional(),
    photos: z.array(itemPhotoRefSchema).nullable().optional(),
    sortOrder: z.number().int().optional().default(0),
  });

  function normalizePhotoPrimary(photos: any[] | null | undefined): any[] | null {
    if (!photos || photos.length === 0) return photos as any;
    const hasPrimary = photos.some(p => p.isPrimary);
    if (!hasPrimary) {
      return photos.map((p, i) => i === 0 ? { ...p, isPrimary: true } : { ...p, isPrimary: false });
    }
    let foundFirst = false;
    return photos.map(p => {
      if (p.isPrimary && !foundFirst) { foundFirst = true; return p; }
      if (p.isPrimary && foundFirst) return { ...p, isPrimary: false };
      return p;
    });
  }

  app.post("/api/jobs/:id/items", async (req, res) => {
    try {
      const parsed = jobItemBodySchema.parse(req.body);
      const item = await storage.addJobItem({
        jobId: req.params.id,
        config: parsed.config,
        photo: parsed.photo || null,
        photos: normalizePhotoPrimary(parsed.photos) || null,
        sortOrder: parsed.sortOrder,
      });
      res.json(item);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/jobs/:id/items/:itemId", async (req, res) => {
    try {
      const parsed = jobItemBodySchema.partial().parse(req.body);
      const updateData: any = {};
      if (parsed.config !== undefined) updateData.config = parsed.config;
      if (parsed.photo !== undefined) updateData.photo = parsed.photo;
      if (parsed.photos !== undefined) updateData.photos = normalizePhotoPrimary(parsed.photos);
      if (parsed.sortOrder !== undefined) updateData.sortOrder = parsed.sortOrder;
      const item = await storage.updateJobItem(req.params.itemId, updateData);
      if (!item) return res.status(404).json({ error: "Item not found" });
      res.json(item);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/jobs/:id/items/:itemId", async (req, res) => {
    try {
      const items = await storage.getJobItems(req.params.id);
      const item = items.find(i => i.id === req.params.itemId);
      const photoKeys: string[] = [];
      if (item) {
        const photos = (item.photos as any[]) || [];
        for (const p of photos) {
          if (p.key) photoKeys.push(p.key);
        }
      }

      const referenced = photoKeys.length > 0 ? await getReferencedPhotoKeys(req.params.id) : new Set<string>();

      await storage.deleteJobItem(req.params.itemId);

      for (const key of photoKeys) {
        if (!referenced.has(key)) {
          await safeDeletePhotoFile(key);
        }
      }

      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/library", async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const divisionCode = req.query.divisionCode as string | undefined;
      if (divisionCode) {
        const entries = await storage.getLibraryEntriesWithScope(type, divisionCode);
        return res.json(entries);
      }
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

  app.delete("/api/library/profile-roles/:id", async (req, res) => {
    try {
      const allRoles = await storage.getLibraryEntries("profile_role");
      const roleEntry = allRoles.find((e) => e.id === req.params.id);
      if (!roleEntry) return res.status(404).json({ error: "Role not found" });
      const roleName = (roleEntry.data as any).name as string;
      const profiles = await storage.getLibraryEntries("direct_profile");
      const inUse = profiles.some((p) => (p.data as any).role === roleName);
      if (inUse) {
        return res.status(409).json({ error: `Role "${roleName}" is used by existing profiles. Reassign those profiles first.` });
      }
      await storage.deleteLibraryEntry(req.params.id);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
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

  app.get("/api/frame-types/:frameTypeId/configurations", async (req, res) => {
    try {
      const configs = await storage.getFrameConfigurations(req.params.frameTypeId);
      res.json(configs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/frame-types/:frameTypeId/configurations", async (req, res) => {
    try {
      const parsed = insertFrameConfigurationSchema.parse({
        ...req.body,
        frameTypeId: req.params.frameTypeId,
      });
      const config = await storage.createFrameConfiguration(parsed);
      res.json(config);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/configurations/:id", async (req, res) => {
    try {
      const parsed = insertFrameConfigurationSchema.partial().parse(req.body);
      const config = await storage.updateFrameConfiguration(req.params.id, parsed);
      if (!config) return res.status(404).json({ error: "Configuration not found" });
      res.json(config);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/configurations/:id", async (req, res) => {
    try {
      await storage.deleteFrameConfiguration(req.params.id);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/configurations/:id/profiles", async (req, res) => {
    try {
      const profiles = await storage.getConfigurationProfiles(req.params.id);
      res.json(profiles);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/configurations/:id/profiles", async (req, res) => {
    try {
      const parsed = insertConfigurationProfileSchema.parse({
        ...req.body,
        configurationId: req.params.id,
      });
      const profile = await storage.createConfigurationProfile(parsed);
      res.json(profile);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/profiles/:id", async (req, res) => {
    try {
      const parsed = insertConfigurationProfileSchema.partial().parse(req.body);
      const profile = await storage.updateConfigurationProfile(req.params.id, parsed);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      res.json(profile);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/profiles/:id", async (req, res) => {
    try {
      await storage.deleteConfigurationProfile(req.params.id);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/configurations/:id/accessories", async (req, res) => {
    try {
      const accessories = await storage.getConfigurationAccessories(req.params.id);
      res.json(accessories);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/configurations/:id/accessories", async (req, res) => {
    try {
      const parsed = insertConfigurationAccessorySchema.parse({
        ...req.body,
        configurationId: req.params.id,
      });
      const accessory = await storage.createConfigurationAccessory(parsed);
      res.json(accessory);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/accessories/:id", async (req, res) => {
    try {
      const parsed = insertConfigurationAccessorySchema.partial().parse(req.body);
      const accessory = await storage.updateConfigurationAccessory(req.params.id, parsed);
      if (!accessory) return res.status(404).json({ error: "Accessory not found" });
      res.json(accessory);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/accessories/:id", async (req, res) => {
    try {
      await storage.deleteConfigurationAccessory(req.params.id);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/configurations/:id/labor", async (req, res) => {
    try {
      const labor = await storage.getConfigurationLabor(req.params.id);
      res.json(labor);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/configurations/:id/labor", async (req, res) => {
    try {
      const parsed = insertConfigurationLaborSchema.parse({
        ...req.body,
        configurationId: req.params.id,
      });
      const labor = await storage.createConfigurationLabor(parsed);
      res.json(labor);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/labor/:id", async (req, res) => {
    try {
      const parsed = insertConfigurationLaborSchema.partial().parse(req.body);
      const labor = await storage.updateConfigurationLabor(req.params.id, parsed);
      if (!labor) return res.status(404).json({ error: "Labor task not found" });
      res.json(labor);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/labor/:id", async (req, res) => {
    try {
      await storage.deleteConfigurationLabor(req.params.id);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/frame-types/seed-configurations", async (_req, res) => {
    try {
      await seedConfigurationDefaults();
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/library/seed-direct-materials", async (_req, res) => {
    try {
      await seedDirectMaterials();
      const profiles = await storage.getLibraryEntries("direct_profile");
      const accessories = await storage.getLibraryEntries("direct_accessory");
      res.json({ ok: true, profiles: profiles.length, accessories: accessories.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/library/direct-profiles/:id", async (req, res) => {
    try {
      const entry = await storage.updateLibraryEntry(req.params.id, { data: req.body.data });
      if (!entry) return res.status(404).json({ error: "Not found" });
      const data = entry.data as any;
      if (data.mouldNumber) {
        const syncData: any = {};
        if (data.kgPerMetre !== undefined) syncData.kgPerMetre = String(data.kgPerMetre);
        if (data.pricePerKgUsd !== undefined) syncData.pricePerKgUsd = String(data.pricePerKgUsd);
        if (data.role !== undefined) syncData.role = data.role;
        if (data.lengthFormula !== undefined) syncData.lengthFormula = data.lengthFormula;
        const synced = await storage.updateProfilesByMouldNumber(data.mouldNumber, syncData);
        return res.json({ ...entry, syncedConfigProfiles: synced });
      }
      res.json(entry);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/library/direct-accessories/:id", async (req, res) => {
    try {
      const entry = await storage.updateLibraryEntry(req.params.id, { data: req.body.data });
      if (!entry) return res.status(404).json({ error: "Not found" });
      const data = entry.data as any;
      if (data.code) {
        const syncData: any = {};
        if (data.name !== undefined) syncData.name = data.name;
        if (data.priceUsd !== undefined) syncData.priceUsd = String(data.priceUsd);
        if (data.colour !== undefined) syncData.colour = data.colour;
        if (data.scalingType !== undefined) syncData.scalingType = data.scalingType;
        const synced = await storage.updateAccessoriesByCode(data.code, syncData);
        return res.json({ ...entry, syncedConfigAccessories: synced });
      }
      res.json(entry);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  const createQuoteBodySchema = z.object({
    snapshot: estimateSnapshotSchema,
    sourceJobId: z.string().optional(),
    customer: z.string().min(1),
    divisionCode: z.string().optional().default("LJ"),
    mode: z.enum(["revision", "new_quote"]).optional().default("revision"),
    quoteType: z.enum(["renovation", "new_build"]).optional(),
  });

  app.post("/api/quotes", async (req, res) => {
    try {
      const parsed = createQuoteBodySchema.parse(req.body);
      const { snapshot, sourceJobId, customer, divisionCode, mode, quoteType } = parsed;

      const divSettings = await storage.getDivisionSettings(divisionCode);
      const templateKey = divSettings?.templateKey || "base_v1";
      const orgForNumbering = await storage.getOrgSettings();
      const quotePrefix = orgForNumbering?.quoteNumberPrefix ?? "Q";
      const quoteUseDivSuffix = orgForNumbering?.quoteNumberUseDivisionSuffix ?? false;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        if (mode === "revision" && sourceJobId) {
          const existingResult = await client.query(
            `SELECT * FROM quotes WHERE source_job_id = $1 LIMIT 1 FOR UPDATE`,
            [sourceJobId]
          );
          if (existingResult.rows.length > 0) {
            const existing = existingResult.rows[0];
            const revResult = await client.query(
              `SELECT COALESCE(MAX(version_number), 0) AS max_ver FROM quote_revisions WHERE quote_id = $1`,
              [existing.id]
            );
            const nextVersion = (revResult.rows[0].max_ver || 0) + 1;
            const revInsert = await client.query(
              `INSERT INTO quote_revisions (id, quote_id, version_number, snapshot_json, template_key, created_at)
               VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW()) RETURNING *`,
              [existing.id, nextVersion, JSON.stringify(snapshot), templateKey]
            );
            const revision = revInsert.rows[0];
            const snapshotSellValue = (snapshot as any).totals?.sell ?? null;
            await client.query(
              `UPDATE quotes SET current_revision_id = $1, division_id = $2, total_value = $3, updated_at = NOW() WHERE id = $4`,
              [revision.id, divisionCode, snapshotSellValue, existing.id]
            );
            await client.query(
              `INSERT INTO audit_logs (id, entity_type, entity_id, action, metadata_json, created_at)
               VALUES (gen_random_uuid(), 'quote', $1, 'revision_created', $2, NOW())`,
              [existing.id, JSON.stringify({ versionNumber: nextVersion })]
            );
            await client.query("COMMIT");
            const updatedQuote = await storage.getQuote(existing.id);
            const fullRev = {
              id: revision.id,
              quoteId: revision.quote_id,
              versionNumber: revision.version_number,
              snapshotJson: snapshot,
              templateKey: revision.template_key,
              specDisplayOverrideJson: revision.spec_display_override_json || null,
              xeroSyncStatus: revision.xero_sync_status || null,
              procurementGenerated: revision.procurement_generated || false,
              pdfStorageKey: revision.pdf_storage_key || null,
              createdByUserId: revision.created_by_user_id || null,
              createdAt: revision.created_at,
            };
            return res.json({
              quote: updatedQuote,
              revision: fullRev,
              isNewRevision: true,
            });
          }
        }

        await client.query(
          `INSERT INTO number_sequences (id, current_value) VALUES ('quote', 0) ON CONFLICT DO NOTHING`
        );
        const seqResult = await client.query(
          `UPDATE number_sequences SET current_value = current_value + 1 WHERE id = 'quote' RETURNING current_value`
        );
        const number = formatQuoteNumber(seqResult.rows[0].current_value, quotePrefix, divisionCode, quoteUseDivSuffix);

        const newQuoteSellValue = (snapshot as any).totals?.sell ?? null;
        const quoteInsert = await client.query(
          `INSERT INTO quotes (id, number, source_job_id, division_id, customer, status, quote_type, total_value, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, 'draft', $5, $6, NOW(), NOW()) RETURNING *`,
          [number, sourceJobId || null, divisionCode, customer, quoteType || null, newQuoteSellValue]
        );
        const quote = quoteInsert.rows[0];

        const revInsert = await client.query(
          `INSERT INTO quote_revisions (id, quote_id, version_number, snapshot_json, template_key, created_at)
           VALUES (gen_random_uuid(), $1, 1, $2, $3, NOW()) RETURNING *`,
          [quote.id, JSON.stringify(snapshot), templateKey]
        );
        const revision = revInsert.rows[0];

        await client.query(
          `UPDATE quotes SET current_revision_id = $1 WHERE id = $2`,
          [revision.id, quote.id]
        );

        await client.query(
          `INSERT INTO audit_logs (id, entity_type, entity_id, action, metadata_json, created_at)
           VALUES (gen_random_uuid(), 'quote', $1, 'quote_created', $2, NOW())`,
          [quote.id, JSON.stringify({ number })]
        );

        await client.query("COMMIT");
        const fullQuote = await storage.getQuote(quote.id);
        const fullRevision = {
          id: revision.id,
          quoteId: revision.quote_id,
          versionNumber: revision.version_number,
          snapshotJson: snapshot,
          templateKey: revision.template_key,
          specDisplayOverrideJson: revision.spec_display_override_json || null,
          xeroSyncStatus: revision.xero_sync_status || null,
          procurementGenerated: revision.procurement_generated || false,
          pdfStorageKey: revision.pdf_storage_key || null,
          createdByUserId: revision.created_by_user_id || null,
          createdAt: revision.created_at,
        };
        res.json({
          quote: fullQuote,
          revision: fullRevision,
          isNewRevision: false,
        });
      } catch (txErr) {
        await client.query("ROLLBACK");
        throw txErr;
      } finally {
        client.release();
      }
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/quotes", async (req, res) => {
    try {
      const allQuotes = await storage.getAllQuotes();
      const enriched = await enrichQuotesWithOrphanState(allQuotes);

      const userDivision = req.user?.divisionCode;
      const isAllDivision = !req.user?.divisionCode || req.user?.role === "admin" || req.user?.role === "owner";
      const filtered = isAllDivision
        ? enriched
        : enriched.filter(q => (q.divisionId || null) === userDivision);

      const jobIds = Array.from(new Set(filtered.map(q => q.sourceJobId).filter(Boolean))) as string[];
      const jobNameMap: Record<string, string> = {};
      for (const jid of jobIds) {
        const job = await storage.getJob(jid);
        if (job) jobNameMap[jid] = job.name;
      }

      const withEstimateName = filtered.map(q => ({
        ...q,
        sourceEstimateName: q.sourceJobId ? (jobNameMap[q.sourceJobId] || null) : null,
      }));

      res.json(withEstimateName);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/quotes/:id", async (req, res) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote) return res.status(404).json({ error: "Quote not found" });
      const userDivision = req.user?.divisionCode;
      const isAllDivision = !userDivision || req.user?.role === "admin" || req.user?.role === "owner";
      if (!isAllDivision && (quote.divisionId || null) !== userDivision) {
        return res.status(403).json({ error: "Access denied: different division" });
      }
      const revisions = await storage.getQuoteRevisions(quote.id);
      res.json({ ...quote, revisions });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/quotes/:id/status", async (req, res) => {
    try {
      const { status } = z.object({ status: z.enum(QUOTE_STATUSES) }).parse(req.body);
      const quote = await storage.getQuote(req.params.id);
      if (!quote) return res.status(404).json({ error: "Quote not found" });

      const currentStatus = quote.status as QuoteStatus;
      const allowed = VALID_STATUS_TRANSITIONS[currentStatus] || [];
      if (!allowed.includes(status as QuoteStatus)) {
        return res.status(400).json({
          error: `Cannot transition from "${currentStatus}" to "${status}". Allowed: ${allowed.join(", ") || "none"}`,
        });
      }

      if (status === "archived") {
        const archived = await archiveQuote(req.params.id);
        return res.json(archived);
      }

      const updated = await storage.updateQuoteStatus(req.params.id, status);
      await storage.createAuditLog({
        entityType: "quote",
        entityId: req.params.id,
        action: "status_changed",
        metadataJson: { from: currentStatus, to: status },
      });
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/quotes/:id/type", async (req, res) => {
    try {
      const { quoteType } = z.object({
        quoteType: z.enum(["renovation", "new_build"]),
      }).parse(req.body);
      const quote = await storage.getQuote(req.params.id);
      if (!quote) return res.status(404).json({ error: "Quote not found" });

      const result = await pool.query(
        `UPDATE quotes SET quote_type = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [quoteType, req.params.id]
      );
      await storage.createAuditLog({
        entityType: "quote",
        entityId: req.params.id,
        action: "type_changed",
        metadataJson: { from: quote.quoteType || null, to: quoteType },
      });
      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/quotes/backfill-values", async (req, res) => {
    try {
      const quotesWithoutValue = await pool.query(
        `SELECT q.id, q.current_revision_id FROM quotes q WHERE q.total_value IS NULL AND q.current_revision_id IS NOT NULL`
      );
      let updated = 0;
      let skipped = 0;
      for (const row of quotesWithoutValue.rows) {
        try {
          const revResult = await pool.query(
            `SELECT snapshot_json FROM quote_revisions WHERE id = $1`,
            [row.current_revision_id]
          );
          if (revResult.rows.length > 0) {
            const snap = typeof revResult.rows[0].snapshot_json === "string"
              ? JSON.parse(revResult.rows[0].snapshot_json)
              : revResult.rows[0].snapshot_json;
            const sellValue = snap?.totals?.sell;
            if (typeof sellValue === "number" && isFinite(sellValue)) {
              await pool.query(
                `UPDATE quotes SET total_value = $1 WHERE id = $2`,
                [sellValue, row.id]
              );
              updated++;
            } else {
              skipped++;
            }
          } else {
            skipped++;
          }
        } catch {
          skipped++;
        }
      }
      res.json({ message: `Backfilled ${updated} of ${quotesWithoutValue.rows.length} quotes`, skipped });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/quotes/:id/archive", async (req, res) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote) return res.status(404).json({ error: "Quote not found" });
      if (quote.archivedAt) return res.status(400).json({ error: "Quote is already archived" });

      const archived = await archiveQuote(req.params.id);
      res.json(archived);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/quotes/:id/unarchive", async (req, res) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote) return res.status(404).json({ error: "Quote not found" });
      if (!quote.archivedAt) return res.status(400).json({ error: "Quote is not archived" });

      const restored = await unarchiveQuote(req.params.id);
      res.json(restored);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/quotes/:id", async (req, res) => {
    try {
      const confirm = req.query.confirm;
      if (confirm !== "permanent") {
        return res.status(400).json({
          error: "Hard delete requires explicit confirmation. Use ?confirm=permanent",
        });
      }

      const quote = await storage.getQuote(req.params.id);
      if (!quote) return res.status(404).json({ error: "Quote not found" });

      if (quote.status !== "draft") {
        return res.status(422).json({
          error: `Only draft quotes can be deleted. This quote has status '${quote.status}'. Cancel or archive it first.`,
        });
      }

      await hardDeleteQuote(req.params.id);
      res.json({ ok: true, deleted: quote.number });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/dev/clear-quotes", async (_req, res) => {
    try {
      if (process.env.NODE_ENV === "production") {
        return res.status(403).json({ error: "This endpoint is not available in production" });
      }
      if (process.env.ENABLE_DESTRUCTIVE_DEV_TOOLS !== "true") {
        return res.status(403).json({ error: "Destructive dev tools are disabled. Set ENABLE_DESTRUCTIVE_DEV_TOOLS=true to enable." });
      }
      const count = await clearAllQuotes();
      console.log(`[DEV] Cleared all quotes: ${count} deleted`);
      res.json({ ok: true, deleted: count });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/quotes/:id/audit-log", async (req, res) => {
    try {
      const logs = await storage.getAuditLogs("quote", req.params.id);
      res.json(logs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/settings/org", async (_req, res) => {
    try {
      const org = await storage.getOrgSettings();
      res.json(org || {});
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/settings/org", async (req, res) => {
    try {
      const org = await storage.upsertOrgSettings(req.body);
      res.json(org);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/settings/template", async (_req, res) => {
    try {
      const org = await storage.getOrgSettings();
      res.json(org?.templateConfigJson || {});
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  const templateConfigSchema = z.object({
    sections: z.array(z.object({
      key: z.string(),
      visible: z.boolean(),
    })).optional(),
    spacingPreset: z.enum(["compact", "standard", "spacious"]).optional(),
    typographyPreset: z.enum(["small", "standard", "large"]).optional(),
    photoSizePreset: z.enum(["small", "medium", "large"]).optional(),
    accentColor: z.string().optional(),
    scheduleLayoutVariant: z.enum(["image_left_specs_right_v1", "specs_only_v1", "image_top_specs_below_v1"]).optional(),
    totalsLayoutVariant: z.enum(["totals_block_v1", "totals_inline_v1"]).optional(),
    logoScale: z.enum(["small", "standard", "large"]).optional(),
    showTradingName: z.boolean().optional(),
    densityPreset: z.enum(["comfortable", "standard", "compact"]).optional(),
    documentMode: z.enum(["standard", "tender"]).optional(),
    logoWidthMm: z.number().min(10).max(120).optional(),
    logoMaxHeightMm: z.number().min(5).max(60).optional(),
    legalLinePlacement: z.enum(["under_logo", "beside_logo", "hidden"]).optional(),
    contactBlockAlignment: z.enum(["right", "stacked_right", "compact_right"]).optional(),
    headerBottomSpacingMm: z.number().min(0).max(20).optional(),
    drawingMaxHeightMm: z.number().min(15).max(80).optional(),
    photoMaxHeightMm: z.number().min(10).max(60).optional(),
    specRowHeightMm: z.number().min(2).max(8).optional(),
    itemHeaderHeightMm: z.number().min(6).max(20).optional(),
    itemCardPaddingMm: z.number().min(1).max(10).optional(),
    itemCardGapMm: z.number().min(1).max(10).optional(),
  }).strict();

  app.patch("/api/settings/template", async (req, res) => {
    try {
      const config = templateConfigSchema.parse(req.body);
      const org = await storage.upsertOrgSettings({ templateConfigJson: config });
      res.json(org.templateConfigJson || {});
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid template config", details: e.errors });
      }
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/settings/divisions", async (_req, res) => {
    try {
      const all = await storage.getAllDivisionSettings();
      res.json(all);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/settings/divisions/:code", async (req, res) => {
    try {
      const div = await storage.getDivisionSettings(req.params.code);
      if (!div) return res.status(404).json({ error: "Division not found" });
      res.json(div);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  const presetDefaultsSchema = z.object({
    frameType: z.string().optional(),
    glassIguType: z.string().optional(),
    glassType: z.string().optional(),
    glassThickness: z.string().optional(),
    linerType: z.string().optional(),
    lockType: z.string().optional(),
    handleType: z.string().optional(),
    wallThickness: z.number().min(0).max(500).optional(),
    windZone: z.string().optional(),
  });

  const jobTypePresetsSchema = z.object({
    renovation: presetDefaultsSchema.optional(),
    new_build: presetDefaultsSchema.optional(),
  });

  const divisionPatchSchema = z.object({
    tradingName: z.string().optional().nullable(),
    logoUrl: z.string().optional().nullable(),
    templateKey: z.string().optional(),
    requiredLegalLine: z.string().optional(),
    termsOverrideBlock: z.string().optional().nullable(),
    headerNotesOverrideBlock: z.string().optional().nullable(),
    exclusionsOverrideBlock: z.string().optional().nullable(),
    additionalCapabilitiesBlock: z.string().optional().nullable(),
    fontFamily: z.string().optional().nullable(),
    accentColor: z.string().optional().nullable(),
    logoPosition: z.string().optional().nullable(),
    headerVariant: z.string().optional().nullable(),
    scheduleLayoutVariant: z.string().optional(),
    totalsLayoutVariant: z.string().optional(),
    specDisplayDefaultsJson: z.any().optional(),
    jobTypePresetsJson: jobTypePresetsSchema.optional().nullable(),
  });

  app.patch("/api/settings/divisions/:code", async (req, res) => {
    try {
      const data = divisionPatchSchema.parse(req.body);
      const div = await storage.upsertDivisionSettings(req.params.code, data);
      res.json(div);
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid division settings", details: e.errors });
      }
      res.status(400).json({ error: e.message });
    }
  });

  // ─── System Mode ──────────────────────────────────────────────────────────

  const VALID_SYSTEM_MODES = ["development", "demo", "production"] as const;
  type SystemMode = typeof VALID_SYSTEM_MODES[number];

  async function getSystemMode(): Promise<SystemMode> {
    const org = await storage.getOrgSettings();
    const mode = (org?.systemMode ?? "development") as SystemMode;
    return VALID_SYSTEM_MODES.includes(mode) ? mode : "development";
  }

  function requireNonProductionMode(res: any, mode: SystemMode): boolean {
    if (mode === "production") {
      res.status(403).json({ error: "This action is disabled in production mode." });
      return false;
    }
    return true;
  }

  app.get("/api/settings/system-mode", async (_req, res) => {
    try {
      const mode = await getSystemMode();
      res.json({ systemMode: mode });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/settings/system-mode", async (req, res) => {
    try {
      const reqUser = (req as any).user;
      if (!reqUser || (reqUser.role !== "admin" && reqUser.role !== "owner")) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const { systemMode } = z.object({
        systemMode: z.enum(VALID_SYSTEM_MODES),
      }).parse(req.body);

      const updated = await storage.upsertOrgSettings({ systemMode } as any);
      await storage.createAuditLog({
        entityType: "system",
        entityId: "system-mode",
        action: "system_mode_changed",
        performedByUserId: reqUser.id,
        metadataJson: { newMode: systemMode },
      });
      res.json({ systemMode: (updated as any).systemMode ?? systemMode });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Invalid system mode", details: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────

  app.get("/api/spec-dictionary", async (req, res) => {
    try {
      const scope = req.query.scope as string | undefined;
      const entries = await storage.getSpecDictionary(scope);
      res.json(entries);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  const ITEM_PHOTO_DIR = path.resolve("uploads/item-photos");
  fs.mkdirSync(ITEM_PHOTO_DIR, { recursive: true });

  const photoCache = new Map<string, Buffer>();
  const PHOTO_CACHE_MAX = 200;

  function photoCacheSet(key: string, data: Buffer) {
    if (photoCache.size >= PHOTO_CACHE_MAX) {
      const oldest = photoCache.keys().next().value;
      if (oldest) photoCache.delete(oldest);
    }
    photoCache.set(key, data);
  }

  const itemPhotoUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype === "image/jpeg") cb(null, true);
      else cb(new Error("Only JPEG files allowed"));
    },
  });

  app.post("/api/item-photos", itemPhotoUpload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    try {
      const key = `${crypto.randomUUID()}.jpg`;
      const data = req.file.buffer;
      await storage.saveItemPhoto(key, data, "image/jpeg");
      photoCacheSet(key, data);
      res.json({ key });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to save photo" });
    }
  });

  app.get("/api/item-photos/:key", async (req, res) => {
    const key = req.params.key;
    if (!/^[A-Za-z0-9._-]+\.jpg$/.test(key)) {
      return res.status(400).json({ error: "Invalid key" });
    }
    const cached = photoCache.get(key);
    if (cached) {
      return res.type("image/jpeg").send(cached);
    }
    const dbPhoto = await storage.getItemPhoto(key);
    if (dbPhoto) {
      photoCacheSet(key, dbPhoto.data);
      return res.type(dbPhoto.mimeType).send(dbPhoto.data);
    }
    const filePath = path.resolve(ITEM_PHOTO_DIR, key);
    const resolvedDir = path.resolve(ITEM_PHOTO_DIR);
    if (filePath.startsWith(resolvedDir) && fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath);
      if (data.length > 100) {
        photoCacheSet(key, data);
        storage.saveItemPhoto(key, data, "image/jpeg").catch(() => {});
        return res.type("image/jpeg").send(data);
      }
    }
    return res.status(404).json({ error: "Image not found" });
  });

  const DRAWING_DIR = path.resolve("uploads/drawing-images");
  fs.mkdirSync(DRAWING_DIR, { recursive: true });

  const drawingUpload = multer({
    storage: multer.diskStorage({
      destination: DRAWING_DIR,
      filename: (_req, _file, cb) => {
        cb(null, `${crypto.randomUUID()}.png`);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype === "image/png") cb(null, true);
      else cb(new Error("Only PNG files allowed"));
    },
  });

  app.post("/api/drawing-images", drawingUpload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    res.json({ key: req.file.filename });
  });

  app.get("/api/drawing-images/:key", (req, res) => {
    const key = req.params.key;
    if (!/^[a-f0-9-]+\.png$/.test(key)) {
      return res.status(400).json({ error: "Invalid key" });
    }
    const filePath = path.resolve(DRAWING_DIR, key);
    const resolvedDir = path.resolve(DRAWING_DIR);
    if (!filePath.startsWith(resolvedDir)) {
      return res.status(400).json({ error: "Invalid key" });
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Image not found" });
    }
    res.type("image/png").sendFile(filePath);
  });

  app.get("/api/quotes/:id/preview-data", async (req, res) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote) return res.status(404).json({ error: "Quote not found" });
      const revisions = await storage.getQuoteRevisions(quote.id);
      const currentRevision = revisions.find(r => r.id === quote.currentRevisionId) || revisions[revisions.length - 1];
      if (!currentRevision) return res.status(404).json({ error: "No revision found" });

      const orgSettings = await storage.getOrgSettings();
      const divCode = quote.divisionId || "LJ";
      const divisionSettings = await storage.getDivisionSettings(divCode);
      const specEntries = await storage.getSpecDictionary(divCode);

      const grouped: Record<string, typeof specEntries> = {};
      for (const entry of specEntries) {
        if (!grouped[entry.group]) grouped[entry.group] = [];
        grouped[entry.group].push(entry);
      }

      const revOverride = currentRevision.specDisplayOverrideJson as string[] | null;
      const divDefaults = divisionSettings?.specDisplayDefaultsJson as string[] | null;
      const effectiveSpecDisplayKeys = revOverride || divDefaults || [];

      let projectAddress: string | null = null;
      if (quote.sourceJobId) {
        const sourceJob = await storage.getJob(quote.sourceJobId);
        if (sourceJob) {
          projectAddress = sourceJob.address || null;
        }
      }

      res.json({
        orgSettings: orgSettings || {},
        divisionSettings: divisionSettings || {},
        quote,
        currentRevision,
        snapshot: currentRevision.snapshotJson,
        templateKey: currentRevision.templateKey || "base_v1",
        specDictionaryGrouped: grouped,
        effectiveSpecDisplayKeys,
        projectAddress,
        companyTemplateConfig: orgSettings?.templateConfigJson || null,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/quotes/:id/revisions/:revId/spec-display", async (req, res) => {
    try {
      const { specDisplayKeys } = z.object({ specDisplayKeys: z.array(z.string()) }).parse(req.body);
      const client = await pool.connect();
      try {
        await client.query(
          `UPDATE quote_revisions SET spec_display_override_json = $1 WHERE id = $2 AND quote_id = $3`,
          [JSON.stringify(specDisplayKeys), req.params.revId, req.params.id]
        );
        res.json({ ok: true });
      } finally {
        client.release();
      }
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ─── Auth Routes ────────────────────────────────────────────────────────
  const { hashPassword, verifyPassword, generateSessionToken, SESSION_COOKIE, SESSION_DURATION_MS, logActivity } = await import("./auth");

  app.get("/api/auth/me", (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    const { password: _pw, ...safeUser } = req.user;
    return res.json(safeUser);
  });

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });
    try {
      const user = await storage.getUserByUsername(username);
      if (!user || !user.isActive) return res.status(401).json({ error: "Invalid credentials" });
      const valid = await verifyPassword(password, user.password);
      if (!valid) return res.status(401).json({ error: "Invalid credentials" });
      const token = generateSessionToken();
      const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
      await storage.createUserSession(user.id, token, expiresAt);
      res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(SESSION_DURATION_MS / 1000)}`);
      const { password: _pw, ...safeUser } = user;
      return res.json(safeUser);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    const { parse: parseCookies } = await import("cookie");
    const cookies = parseCookies(req.headers.cookie || "");
    const token = cookies[SESSION_COOKIE];
    if (token) await storage.deleteUserSession(token).catch(() => {});
    res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0`);
    return res.json({ ok: true });
  });

  app.get("/api/auth/users", async (req, res) => {
    try {
      const all = await storage.getAllUsers();
      return res.json(all.map(({ password: _pw, ...u }) => u));
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/auth/users", requireAuth, async (req, res) => {
    if (req.user?.role !== "admin" && req.user?.role !== "owner") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const schema = z.object({
      username: z.string().min(2),
      password: z.string().min(6),
      email: z.string().email().optional(),
      displayName: z.string().optional(),
      role: z.enum(["owner", "admin", "estimator", "finance", "production", "viewer"]).default("estimator"),
      divisionCode: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const hashed = await hashPassword(parsed.data.password);
      const user = await storage.createUser({ ...parsed.data, password: hashed, mustChangePassword: true } as any);
      const { password: _pw, ...safeUser } = user;
      return res.status(201).json(safeUser);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/auth/change-password", async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const schema = z.object({ currentPassword: z.string(), newPassword: z.string().min(6) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const fullUser = await storage.getUser(req.user.id);
      if (!fullUser) return res.status(404).json({ error: "User not found" });
      const valid = await verifyPassword(parsed.data.currentPassword, fullUser.password);
      if (!valid) return res.status(401).json({ error: "Current password is incorrect" });
      const hashed = await hashPassword(parsed.data.newPassword);
      await storage.updateUser(req.user.id, { password: hashed, mustChangePassword: false });
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/auth/users/:id", requireAuth, async (req, res) => {
    if (req.user?.role !== "admin" && req.user?.role !== "owner") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const schema = z.object({
      displayName: z.string().optional(),
      email: z.string().email().optional().nullable(),
      role: z.enum(["owner", "admin", "estimator", "finance", "production", "viewer"]).optional(),
      divisionCode: z.string().optional().nullable(),
      isActive: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const userId = String(req.params.id);
      const updated = await storage.updateUser(userId, parsed.data as any);
      if (!updated) return res.status(404).json({ error: "User not found" });
      const { password: _pw, ...safeUser } = updated;
      return res.json(safeUser);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/auth/users/:id/reset-password", requireAuth, async (req, res) => {
    if (req.user?.role !== "admin" && req.user?.role !== "owner") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const schema = z.object({ password: z.string().min(6) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const userId = String(req.params.id);
      const hashed = await hashPassword(parsed.data.password);
      const updated = await storage.updateUser(userId, { password: hashed, mustChangePassword: true });
      if (!updated) return res.status(404).json({ error: "User not found" });
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ─── Customer Routes ─────────────────────────────────────────────────────
  app.get("/api/customers", async (_req, res) => {
    try {
      return res.json(await storage.getAllCustomers());
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/customers", async (req, res) => {
    const schema = z.object({
      name: z.string().min(1),
      email: z.string().email().optional().nullable(),
      phone: z.string().optional().nullable(),
      address: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      return res.status(201).json(await storage.createCustomer(parsed.data));
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    const customer = await storage.getCustomer(req.params.id);
    if (!customer) return res.status(404).json({ error: "Not found" });
    return res.json(customer);
  });

  app.patch("/api/customers/:id", async (req, res) => {
    const schema = z.object({
      name: z.string().min(1).optional(),
      email: z.string().email().optional().nullable(),
      phone: z.string().optional().nullable(),
      address: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const updated = await storage.updateCustomer(req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ error: "Not found" });
      return res.json(updated);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/contacts", async (req, res) => {
    try {
      const customerId = req.query.customerId as string | undefined;
      const category = req.query.category as string | undefined;
      const search = req.query.q as string | undefined;
      return res.json(await storage.listContacts({ customerId, category, search }));
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/contacts/:id", async (req, res) => {
    try {
      const contact = await storage.getContact(req.params.id);
      if (!contact) return res.status(404).json({ error: "Not found" });
      return res.json(contact);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/customers/:id/contacts", async (req, res) => {
    try {
      return res.json(await storage.getCustomerContacts(req.params.id));
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  const contactBodySchema = z.object({
    name: z.string().min(1),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    mobile: z.string().optional().nullable(),
    role: z.string().optional().nullable(),
    category: z.enum(["client", "supplier", "subcontractor", "consultant", "other"]).default("client"),
    notes: z.string().optional().nullable(),
    isPrimary: z.boolean().default(false),
  });

  app.post("/api/customers/:id/contacts", async (req, res) => {
    const parsed = contactBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const contact = await storage.createCustomerContact({ ...parsed.data, customerId: req.params.id });
      return res.status(201).json(contact);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/contacts/:id", async (req, res) => {
    const schema = contactBodySchema.partial();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const updated = await storage.updateCustomerContact(req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ error: "Not found" });
      return res.json(updated);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/contacts/:id/archive", async (req, res) => {
    try {
      const updated = await storage.archiveContact(req.params.id);
      if (!updated) return res.status(404).json({ error: "Not found" });
      return res.json(updated);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/contacts/:id", async (req, res) => {
    try {
      await storage.deleteCustomerContact(req.params.id);
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/customers/:id/projects", async (req, res) => {
    try {
      return res.json(await storage.getProjectsByCustomer(req.params.id));
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ─── Project Routes ───────────────────────────────────────────────────────
  app.get("/api/projects", async (_req, res) => {
    try {
      return res.json(await storage.getAllProjects());
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/projects", async (req, res) => {
    const schema = z.object({
      customerId: z.string(),
      name: z.string().min(1),
      address: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
      divisionCode: z.string().optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      return res.status(201).json(await storage.createProject(parsed.data));
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    const project = await storage.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: "Not found" });
    return res.json(project);
  });

  app.patch("/api/projects/:id", async (req, res) => {
    const schema = z.object({
      name: z.string().min(1).optional(),
      address: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
      divisionCode: z.string().optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const updated = await storage.updateProject(req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ error: "Not found" });
      return res.json(updated);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ─── Quote Acceptance ─────────────────────────────────────────────────────
  app.post("/api/quotes/:id/accept", async (req, res) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote) return res.status(404).json({ error: "Quote not found" });
      if (quote.status === "accepted") return res.status(409).json({ error: "Quote is already accepted" });
      if (!["sent", "review"].includes(quote.status)) {
        return res.status(400).json({ error: `Cannot accept a quote with status '${quote.status}'` });
      }
      if (!quote.currentRevisionId) return res.status(400).json({ error: "Quote has no current revision" });
      const acceptedValue = quote.totalValue ?? 0;
      const userId = req.user?.id ?? null;
      const updated = await storage.acceptQuote(quote.id, {
        acceptedAt: new Date(),
        acceptedByUserId: userId,
        acceptedValue,
        acceptedRevisionId: quote.currentRevisionId,
      });
      logActivity("quote_accepted", "quote", quote.id, userId, {
        quoteNumber: quote.number,
        acceptedValue,
        revisionId: quote.currentRevisionId,
      });
      return res.json(updated);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/quotes/:id/customer", async (req, res) => {
    const schema = z.object({
      customerId: z.string().nullable().optional(),
      projectId: z.string().nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const updated = await storage.updateQuote(req.params.id, parsed.data as any);
      if (!updated) return res.status(404).json({ error: "Not found" });
      return res.json(updated);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ─── Invoice Routes ───────────────────────────────────────────────────────
  app.get("/api/invoices", async (req, res) => {
    try {
      const all = await storage.getAllInvoices();
      const userDivision = req.user?.divisionCode;
      const isAllDivision = !userDivision || req.user?.role === "admin" || req.user?.role === "owner";
      const filtered = isAllDivision ? all : all.filter(i => (i.divisionCode || null) === userDivision);
      return res.json(filtered);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/quotes/:id/invoices", async (req, res) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote) return res.status(404).json({ error: "Quote not found" });
      const userDivision = req.user?.divisionCode;
      const isAllDivision = !userDivision || req.user?.role === "admin" || req.user?.role === "owner";
      if (!isAllDivision && (quote.divisionId || null) !== userDivision) {
        return res.status(403).json({ error: "Access denied: different division" });
      }
      return res.json(await storage.getInvoicesByQuote(req.params.id));
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/invoices", async (req, res) => {
    const schema = z.object({
      quoteId: z.string().optional().nullable(),
      quoteRevisionId: z.string().optional().nullable(),
      divisionCode: z.string().optional().nullable(),
      customerId: z.string().optional().nullable(),
      projectId: z.string().optional().nullable(),
      type: z.enum(["deposit", "progress", "variation", "final", "retention_release", "credit_note"]).default("deposit"),
      depositType: z.enum(["percentage", "fixed"]).optional().nullable(),
      depositPercentage: z.number().optional().nullable(),
      amountExclGst: z.number().optional().nullable(),
      gstAmount: z.number().optional().nullable(),
      amountInclGst: z.number().optional().nullable(),
      description: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const number = await storage.getNextInvoiceNumber();
      const userId = req.user?.id ?? null;
      const invoice = await storage.createInvoice({
        ...parsed.data,
        number,
        status: "draft",
        createdByUserId: userId ?? undefined,
      } as any);
      logActivity("invoice_created", "invoice", invoice.id, userId, { number, type: parsed.data.type });
      return res.status(201).json(invoice);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/invoices/:id", async (req, res) => {
    const invoice = await storage.getInvoice(req.params.id);
    if (!invoice) return res.status(404).json({ error: "Not found" });
    return res.json(invoice);
  });

  app.patch("/api/invoices/:id", async (req, res) => {
    const schema = z.object({
      type: z.enum(["deposit", "progress", "variation", "final", "retention_release", "credit_note"]).optional(),
      status: z.enum(["draft", "ready_for_xero", "pushed_to_xero_draft", "approved", "returned_to_draft"]).optional(),
      depositType: z.enum(["percentage", "fixed"]).optional().nullable(),
      depositPercentage: z.number().optional().nullable(),
      amountExclGst: z.number().optional().nullable(),
      gstAmount: z.number().optional().nullable(),
      amountInclGst: z.number().optional().nullable(),
      description: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
      xeroInvoiceId: z.string().optional().nullable(),
      xeroInvoiceNumber: z.string().optional().nullable(),
      xeroStatus: z.string().optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) return res.status(404).json({ error: "Not found" });
      const userId = req.user?.id ?? null;
      if (parsed.data.status) {
        logActivity("invoice_updated", "invoice", invoice.id, userId, { from: invoice.status, to: parsed.data.status });
      }
      const updated = await storage.updateInvoice(req.params.id, parsed.data as any);
      return res.json(updated);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/invoices/:id/return-to-draft", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) return res.status(404).json({ error: "Not found" });
      const userId = req.user?.id ?? null;
      const updated = await storage.updateInvoice(req.params.id, { status: "returned_to_draft" } as any);
      logActivity("invoice_returned_to_draft", "invoice", invoice.id, userId, {
        previousStatus: invoice.status,
        xeroInvoiceId: invoice.xeroInvoiceId,
      });
      return res.json({
        invoice: updated,
        xeroWarning: invoice.xeroInvoiceId
          ? "The Xero invoice must be deleted before reissuing a replacement invoice."
          : null,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ─── Quote Linkage (customer/project) ─────────────────────────────────────
  app.patch("/api/quotes/:id/link", async (req, res) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote) return res.status(404).json({ error: "Quote not found" });
      const schema = z.object({
        customerId: z.string().nullable().optional(),
        projectId: z.string().nullable().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      const updated = await storage.updateQuote(req.params.id, parsed.data);
      return res.json(updated);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ─── Quote Send (Email) ────────────────────────────────────────────────────
  app.post("/api/quotes/:id/send", async (req, res) => {
    try {
      if (!isEmailConfigured()) {
        return res.status(503).json({ error: "Email is not configured on this server. Set RESEND_API_KEY to enable sending." });
      }

      const quote = await storage.getQuote(req.params.id);
      if (!quote) return res.status(404).json({ error: "Quote not found" });

      const schema = z.object({
        pdfBase64: z.string().min(100),
        toEmail: z.string().email(),
        subject: z.string().min(1),
        message: z.string().min(1),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }

      const { pdfBase64, toEmail, subject, message } = parsed.data;

      await sendQuoteEmail({
        toEmail,
        subject,
        message,
        pdfBase64,
        quoteNumber: quote.number,
        customerName: quote.customer,
      });

      const now = new Date();
      const updated = await storage.updateQuote(req.params.id, {
        sentAt: now,
        sentToEmail: toEmail,
      });

      return res.json({ success: true, sentAt: now, quote: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ─── Revert Accepted Quote to Draft ───────────────────────────────────────
  app.post("/api/quotes/:id/revert-to-draft", async (req, res) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote) return res.status(404).json({ error: "Quote not found" });

      if (quote.status !== "accepted") {
        return res.status(422).json({ error: "Only accepted quotes can be reverted to draft." });
      }

      const invoices = await storage.getInvoicesByQuote(req.params.id);
      if (invoices.length > 0) {
        return res.status(422).json({
          error: "This quote cannot be reverted because invoices exist against it.",
        });
      }

      const existingJob = await storage.getOpJobByQuoteId(req.params.id);
      if (existingJob && existingJob.status !== "cancelled") {
        return res.status(422).json({
          error: `This quote cannot be reverted because it has an active job (${existingJob.jobNumber}). Cancel the job first, then revert.`,
        });
      }

      const updated = await storage.updateQuote(req.params.id, {
        status: "draft",
        acceptedAt: null,
        acceptedByUserId: null,
        acceptedValue: null,
        acceptedRevisionId: null,
      });

      const userId = (req as any).user?.id;
      await storage.createAuditLog({
        entityType: "quote",
        entityId: req.params.id,
        action: "reverted_to_draft",
        performedByUserId: userId,
        metadataJson: { hadCancelledJob: !!existingJob, linkedJobId: existingJob?.id ?? null },
      });

      if (existingJob) {
        await storage.createAuditLog({
          entityType: "op_job",
          entityId: existingJob.id,
          action: "linked_quote_reverted_to_draft",
          performedByUserId: userId,
          metadataJson: { quoteId: req.params.id },
        });
      }

      return res.json(updated);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ─── Quote -> Job Conversion ───────────────────────────────────────────────
  app.post("/api/quotes/:id/convert-to-job", async (req, res) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote) return res.status(404).json({ error: "Quote not found" });
      if (quote.status !== "accepted") {
        return res.status(422).json({ error: "Only accepted quotes can be converted to a job." });
      }
      const existing = await storage.getOpJobByQuoteId(quote.id);
      if (existing) {
        return res.status(409).json({ error: "A job already exists for this quote.", jobId: existing.id });
      }
      const schema = z.object({
        title: z.string().min(1).optional(),
        notes: z.string().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const userId = req.user?.id ?? null;
      const jobNumber = await storage.getNextJobNumber(quote.divisionId ?? undefined);
      const title = parsed.data.title || quote.customer || `Job from ${quote.number}`;

      const opJob = await storage.createOpJob({
        jobNumber,
        title,
        status: "active",
        divisionId: quote.divisionId ?? null,
        customerId: quote.customerId ?? null,
        projectId: quote.projectId ?? null,
        sourceQuoteId: quote.id,
        acceptedRevisionId: quote.acceptedRevisionId ?? null,
        notes: parsed.data.notes ?? null,
        createdByUserId: userId,
        convertedAt: new Date(),
      } as any);

      logActivity("quote_converted_to_job", "op_job", opJob.id, userId, {
        quoteId: quote.id,
        quoteNumber: quote.number,
        jobNumber,
      });

      return res.status(201).json(opJob);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ─── Op Jobs Routes ────────────────────────────────────────────────────────
  app.get("/api/op-jobs", async (req, res) => {
    try {
      const userDivision = (req as any).user?.divisionCode;
      const isAllDivision = !userDivision || (req as any).user?.role === "admin" || (req as any).user?.role === "owner";
      const scope = req.query.scope as string | undefined;
      if (scope === "archived") {
        const all = await storage.getArchivedOpJobs();
        return res.json(isAllDivision ? all : all.filter(j => (j.divisionId || null) === userDivision));
      }
      const all = await storage.getAllOpJobs();
      return res.json(isAllDivision ? all : all.filter(j => (j.divisionId || null) === userDivision));
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/op-jobs/:id/archive", async (req, res) => {
    try {
      const job = await storage.getOpJob(req.params.id);
      if (!job) return res.status(404).json({ error: "Job not found" });
      const userDivision = (req as any).user?.divisionCode;
      const isAllDivision = !userDivision || (req as any).user?.role === "admin" || (req as any).user?.role === "owner";
      if (!isAllDivision && (job.divisionId || null) !== userDivision) return res.status(403).json({ error: "Access denied" });
      if (job.archivedAt) return res.status(400).json({ error: "Job is already archived" });

      const updated = await storage.archiveOpJob(req.params.id);
      await storage.createAuditLog({
        entityType: "op_job",
        entityId: req.params.id,
        action: "archived",
        performedByUserId: (req as any).user?.id,
        metadataJson: {},
      });
      res.json({ ok: true, job: updated });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/op-jobs/:id/unarchive", async (req, res) => {
    try {
      const job = await storage.getOpJob(req.params.id);
      if (!job) return res.status(404).json({ error: "Job not found" });
      const userDivision = (req as any).user?.divisionCode;
      const isAllDivision = !userDivision || (req as any).user?.role === "admin" || (req as any).user?.role === "owner";
      if (!isAllDivision && (job.divisionId || null) !== userDivision) return res.status(403).json({ error: "Access denied" });
      if (!job.archivedAt) return res.status(400).json({ error: "Job is not archived" });

      const updated = await storage.unarchiveOpJob(req.params.id);
      await storage.createAuditLog({
        entityType: "op_job",
        entityId: req.params.id,
        action: "unarchived",
        performedByUserId: (req as any).user?.id,
        metadataJson: {},
      });
      res.json({ ok: true, job: updated });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/admin/number-sequences", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || (user.role !== "admin" && user.role !== "owner")) {
        return res.status(403).json({ error: "Admin only" });
      }
      const sequences = await storage.getNumberSequences();
      res.json(sequences);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/admin/number-sequences/:id", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || (user.role !== "admin" && user.role !== "owner")) {
        return res.status(403).json({ error: "Admin only" });
      }
      const { id } = req.params;
      if (!["quote", "op_job"].includes(id)) {
        return res.status(400).json({ error: "Invalid sequence id. Must be 'quote' or 'op_job'." });
      }
      const parsed = z.object({ nextValue: z.number().int().min(1) }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      await storage.setNumberSequence(id, parsed.data.nextValue);
      await storage.createAuditLog({
        entityType: "number_sequence",
        entityId: id,
        action: "set_next_number",
        performedByUserId: user.id ?? null,
        metadataJson: { id, nextValue: parsed.data.nextValue, changedBy: user.username },
      });
      res.json({ ok: true, id, nextValue: parsed.data.nextValue });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/cleanup-demo", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || (user.role !== "admin" && user.role !== "owner")) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const mode = await getSystemMode();
      if (!requireNonProductionMode(res, mode)) return;

      const demoQuotes = await storage.getDemoQuotes();
      const demoJobs = await storage.getDemoOpJobs();

      let quotesArchived = 0;
      let jobsArchived = 0;

      for (const q of demoQuotes) {
        if (!q.archivedAt && !q.deletedAt) {
          await archiveQuote(q.id);
          quotesArchived++;
        }
      }
      for (const j of demoJobs) {
        if (!j.archivedAt) {
          await storage.archiveOpJob(j.id);
          jobsArchived++;
        }
      }

      await storage.createAuditLog({
        entityType: "system",
        entityId: "admin-cleanup",
        action: "demo_cleanup",
        performedByUserId: user.id,
        metadataJson: { quotesArchived, jobsArchived },
      });

      res.json({ ok: true, quotesArchived, jobsArchived });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/reset-demo-environment", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || (user.role !== "admin" && user.role !== "owner")) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const mode = await getSystemMode();
      if (!requireNonProductionMode(res, mode)) return;

      // Locate the single live commercial record to preserve
      const allQuotes = await storage.getAllQuotes();
      const preserveQuote = allQuotes.find(q => q.number === "Q-0135");
      const preserveQuoteId = preserveQuote?.id ?? null;
      const preserveCustomerId = preserveQuote?.customerId ?? null;
      const preserveProjectId = preserveQuote?.projectId ?? null;
      const preserveEstimateId = preserveQuote?.sourceJobId ?? null;

      let quotesArchived = 0;
      let jobsArchived = 0;
      let estimatesArchived = 0;
      let customersArchived = 0;
      let projectsArchived = 0;

      // Archive all quotes except Q-0135
      for (const q of allQuotes) {
        if (q.id !== preserveQuoteId && !q.archivedAt && !q.deletedAt) {
          await archiveQuote(q.id);
          quotesArchived++;
        }
      }

      // Archive all op-jobs not linked to Q-0135
      const allOpJobs = await storage.getAllOpJobs();
      const archivedOpJobs = await storage.getArchivedOpJobs();
      const allJobsUnified = [...allOpJobs, ...archivedOpJobs.filter(j => !allOpJobs.find(a => a.id === j.id))];
      for (const j of allJobsUnified) {
        if (j.sourceQuoteId !== preserveQuoteId && !j.archivedAt) {
          await storage.archiveOpJob(j.id);
          jobsArchived++;
        }
      }

      // Archive all estimates (jobs) except Q-0135's linked estimate
      const allEstimates = await storage.getAllJobs();
      for (const e of allEstimates) {
        if (e.id !== preserveEstimateId && !e.archivedAt) {
          await storage.archiveJob(e.id);
          estimatesArchived++;
        }
      }

      // Archive all projects except Q-0135's linked project
      const allProjects = await storage.getAllProjects();
      for (const p of allProjects) {
        if (p.id !== preserveProjectId && !p.archivedAt) {
          await storage.archiveProject(p.id);
          projectsArchived++;
        }
      }

      // Archive all customers except Q-0135's customer
      const allCustomers = await storage.getAllCustomers();
      for (const c of allCustomers) {
        if (c.id !== preserveCustomerId && !c.archivedAt) {
          await storage.archiveCustomer(c.id);
          customersArchived++;
        }
      }

      await storage.createAuditLog({
        entityType: "system",
        entityId: "admin-reset-demo",
        action: "demo_environment_reset",
        performedByUserId: user.id,
        metadataJson: {
          preservedQuote: preserveQuote?.number ?? "none",
          quotesArchived,
          jobsArchived,
          estimatesArchived,
          customersArchived,
          projectsArchived,
        },
      });

      res.json({
        ok: true,
        preserved: preserveQuote?.number ?? null,
        quotesArchived,
        jobsArchived,
        estimatesArchived,
        customersArchived,
        projectsArchived,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/admin/demo-stats", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || (user.role !== "admin" && user.role !== "owner")) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const mode = await getSystemMode();
      if (!requireNonProductionMode(res, mode)) return;
      const demoQuotes = await storage.getDemoQuotes();
      const demoJobs = await storage.getDemoOpJobs();
      res.json({
        quotes: demoQuotes.filter(q => !q.archivedAt && !q.deletedAt).length,
        opJobs: demoJobs.filter(j => !j.archivedAt).length,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/quotes/:id/demo-flag", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || (user.role !== "admin" && user.role !== "owner")) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const mode = await getSystemMode();
      if (!requireNonProductionMode(res, mode)) return;
      const quote = await storage.getQuote(req.params.id);
      if (!quote) return res.status(404).json({ error: "Quote not found" });
      const { isDemoRecord } = z.object({ isDemoRecord: z.boolean() }).parse(req.body);
      const updated = await storage.updateQuote(req.params.id, { isDemoRecord } as any);
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/op-jobs/:id/demo-flag", async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user || (user.role !== "admin" && user.role !== "owner")) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const mode = await getSystemMode();
      if (!requireNonProductionMode(res, mode)) return;
      const job = await storage.getOpJob(req.params.id);
      if (!job) return res.status(404).json({ error: "Job not found" });
      const { isDemoRecord } = z.object({ isDemoRecord: z.boolean() }).parse(req.body);
      const updated = await storage.updateOpJob(req.params.id, { isDemoRecord } as any);
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/op-jobs/:id", async (req, res) => {
    try {
      const job = await storage.getOpJob(req.params.id);
      if (!job) return res.status(404).json({ error: "Job not found" });
      const userDivision = (req as any).user?.divisionCode;
      const isAllDivision = !userDivision || (req as any).user?.role === "admin" || (req as any).user?.role === "owner";
      if (!isAllDivision && (job.divisionId || null) !== userDivision) return res.status(403).json({ error: "Access denied" });
      return res.json(job);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/op-jobs/:id", async (req, res) => {
    try {
      const job = await storage.getOpJob(req.params.id);
      if (!job) return res.status(404).json({ error: "Job not found" });
      const userDivision = (req as any).user?.divisionCode;
      const isAllDivision = !userDivision || (req as any).user?.role === "admin" || (req as any).user?.role === "owner";
      if (!isAllDivision && (job.divisionId || null) !== userDivision) return res.status(403).json({ error: "Access denied" });
      const schema = z.object({
        title: z.string().min(1).optional(),
        status: z.enum(["active", "on_hold", "completed", "cancelled"]).optional(),
        notes: z.string().nullable().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      const updated = await storage.updateOpJob(req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ error: "Job not found" });
      return res.json(updated);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  return httpServer;
}

const DEFAULT_LABOR_TASKS = ["cutting", "milling", "drilling", "assembly-crimped", "assembly-screwed", "glazing"];

async function seedConfigurationDefaults() {
  const frameTypes = await storage.getLibraryEntries("frame_type");

  const findFt = (value: string) => frameTypes.find((f) => (f.data as any).value === value);

  async function needsSeed(ftId: string): Promise<boolean> {
    const existing = await storage.getFrameConfigurations(ftId);
    return existing.length === 0;
  }

  const seedMap: [string, (id: string) => Promise<void>][] = [
    ["ES52-Window", seedES52WindowConfigs],
    ["ES52-HingeDoor", seedES52HingeDoorConfigs],
    ["ES127-SlidingDoor", seedES127SlidingDoorConfigs],
  ];

  for (const [value, seedFn] of seedMap) {
    const ft = findFt(value);
    if (ft && await needsSeed(ft.id)) {
      await seedFn(ft.id);
    }
  }
}

async function addLaborTasks(configId: string) {
  for (let i = 0; i < DEFAULT_LABOR_TASKS.length; i++) {
    await storage.createConfigurationLabor({
      configurationId: configId,
      taskName: DEFAULT_LABOR_TASKS[i],
      costNzd: "0",
      sortOrder: i,
    });
  }
}

async function seedES52WindowConfigs(frameTypeId: string) {
  const awning = await storage.createFrameConfiguration({
    frameTypeId,
    name: "Awning",
    description: "Single awning pane, 0 Mullion, 0 Transom",
    defaultSalePricePerSqm: 550,
    sortOrder: 0,
  });

  const awningProfiles = [
    { mouldNumber: "0015032", role: "spacer", kgPerMetre: "1.309", pricePerKgUsd: "3.970", quantityPerSet: 1, lengthFormula: "perimeter" },
    { mouldNumber: "0017133", role: "bead", kgPerMetre: "1.250", pricePerKgUsd: "4.180", quantityPerSet: 1, lengthFormula: "perimeter" },
    { mouldNumber: "E0026001", role: "outer-frame", kgPerMetre: "1.530", pricePerKgUsd: "4.400", quantityPerSet: 1, lengthFormula: "perimeter" },
    { mouldNumber: "E0026002", role: "sash-frame", kgPerMetre: "0.679", pricePerKgUsd: "4.400", quantityPerSet: 1, lengthFormula: "perimeter" },
  ];

  for (let i = 0; i < awningProfiles.length; i++) {
    await storage.createConfigurationProfile({ ...awningProfiles[i], configurationId: awning.id, sortOrder: i });
  }

  await seedES52WindowAccessories(awning.id);
  await addLaborTasks(awning.id);

  const a1f = await storage.createFrameConfiguration({
    frameTypeId,
    name: "1 Awning + 1 Fixed",
    description: "1 Awning + 1 Fixed, 1 Mullion, 0 Transom",
    defaultSalePricePerSqm: 550,
    sortOrder: 1,
  });

  const a1fProfiles = [
    { mouldNumber: "0017133", role: "bead", kgPerMetre: "1.250", pricePerKgUsd: "4.180", quantityPerSet: 1, lengthFormula: "perimeter" },
    { mouldNumber: "E0026001", role: "outer-frame", kgPerMetre: "1.530", pricePerKgUsd: "4.400", quantityPerSet: 1, lengthFormula: "perimeter" },
    { mouldNumber: "E0026002", role: "sash-frame", kgPerMetre: "0.679", pricePerKgUsd: "4.400", quantityPerSet: 1, lengthFormula: "perimeter" },
    { mouldNumber: "2020250", role: "mullion", kgPerMetre: "0.646", pricePerKgUsd: "4.400", quantityPerSet: 1, lengthFormula: "height" },
  ];

  for (let i = 0; i < a1fProfiles.length; i++) {
    await storage.createConfigurationProfile({ ...a1fProfiles[i], configurationId: a1f.id, sortOrder: i });
  }

  await seedES52WindowAccessories(a1f.id);
  await addLaborTasks(a1f.id);

  const a2f = await storage.createFrameConfiguration({
    frameTypeId,
    name: "2 Awning + 1 Fixed",
    description: "2 Awning + 1 Fixed, 2 Mullion, 0 Transom",
    defaultSalePricePerSqm: 550,
    sortOrder: 2,
  });

  const a2fProfiles = [
    { mouldNumber: "0017133", role: "bead", kgPerMetre: "1.250", pricePerKgUsd: "4.180", quantityPerSet: 1, lengthFormula: "perimeter" },
    { mouldNumber: "E0026001", role: "outer-frame", kgPerMetre: "1.530", pricePerKgUsd: "4.400", quantityPerSet: 1, lengthFormula: "perimeter" },
    { mouldNumber: "E0026002", role: "sash-frame", kgPerMetre: "0.679", pricePerKgUsd: "4.400", quantityPerSet: 2, lengthFormula: "perimeter" },
    { mouldNumber: "2020250", role: "mullion", kgPerMetre: "0.646", pricePerKgUsd: "4.400", quantityPerSet: 2, lengthFormula: "height" },
  ];

  for (let i = 0; i < a2fProfiles.length; i++) {
    await storage.createConfigurationProfile({ ...a2fProfiles[i], configurationId: a2f.id, sortOrder: i });
  }

  await seedES52WindowAccessories(a2f.id);
  await addLaborTasks(a2f.id);
}

async function seedES52WindowAccessories(configId: string) {
  const accessories = [
    { name: "3mm plastic for glass", code: "0550083 04", colour: "Black", priceUsd: "0.03", quantityPerSet: "1", scalingType: "fixed" },
    { name: "5mm plastic for glass", code: "0550085 04", colour: "Black", priceUsd: "0.03", quantityPerSet: "6.3", scalingType: "fixed" },
    { name: "14mm fix plate", code: "0507002 00", colour: "Material colour", priceUsd: "0.04", quantityPerSet: "18.4", scalingType: "fixed" },
    { name: "18/13.6mm corner", code: "0502310 00", colour: "Material colour", priceUsd: "0.47", quantityPerSet: "9.2", scalingType: "fixed" },
    { name: "11/5.6mm corner", code: "0502312 00", colour: "Material colour", priceUsd: "0.21", quantityPerSet: "9.2", scalingType: "fixed" },
    { name: "26.6mm T-connector (inc. 2 screws)", code: "0503222 00", colour: "Material colour", priceUsd: "0.74", quantityPerSet: "2.2", scalingType: "fixed" },
    { name: "Outside opening frame 18/11mm T-connector", code: "0503732 00", colour: "Material colour", priceUsd: "0.29", quantityPerSet: "2.2", scalingType: "fixed" },
    { name: "φ5x8mm screw", code: "0682003 SS", colour: "SUS", priceUsd: "0.02", quantityPerSet: "18.4", scalingType: "fixed" },
    { name: "Rubber Gasket", code: "0808102 04", colour: "Black", priceUsd: "0.19", quantityPerSet: "10.7", scalingType: "per-linear-metre" },
    { name: "Rubber Gasket for outer glass", code: "0808204 04", colour: "Black", priceUsd: "0.20", quantityPerSet: "10.7", scalingType: "per-linear-metre" },
    { name: "Rubber Gasket for outer glass", code: "0808305 04", colour: "Black", priceUsd: "0.30", quantityPerSet: "8.3", scalingType: "per-linear-metre" },
    { name: "14 inch friction stay", code: "FJ600A-14", colour: "Steel", priceUsd: "2.82", quantityPerSet: "1.3", scalingType: "fixed" },
    { name: "Limiter", code: "XW15", colour: "Steel", priceUsd: "0.92", quantityPerSet: "1.3", scalingType: "fixed" },
  ];

  for (let i = 0; i < accessories.length; i++) {
    await storage.createConfigurationAccessory({ ...accessories[i], configurationId: configId, sortOrder: i });
  }
}

async function seedES52HingeDoorConfigs(frameTypeId: string) {
  const standard = await storage.createFrameConfiguration({
    frameTypeId,
    name: "Standard (Open In)",
    description: "Standard entrance door, 0 Mullion, 1 Transom",
    defaultSalePricePerSqm: 550,
    sortOrder: 0,
  });

  const profiles = [
    { mouldNumber: "0010175", role: "spacer", kgPerMetre: "0.105", pricePerKgUsd: "3.970", quantityPerSet: 1, lengthFormula: "perimeter" },
    { mouldNumber: "0035223", role: "bead", kgPerMetre: "0.278", pricePerKgUsd: "4.180", quantityPerSet: 1, lengthFormula: "perimeter" },
    { mouldNumber: "E0026004", role: "outer-frame", kgPerMetre: "1.946", pricePerKgUsd: "4.400", quantityPerSet: 1, lengthFormula: "perimeter" },
    { mouldNumber: "0020322", role: "door-frame", kgPerMetre: "1.849", pricePerKgUsd: "4.400", quantityPerSet: 1, lengthFormula: "perimeter" },
    { mouldNumber: "0021801", role: "transom", kgPerMetre: "0.765", pricePerKgUsd: "4.180", quantityPerSet: 1, lengthFormula: "width" },
    { mouldNumber: "0022200", role: "sash-frame", kgPerMetre: "1.331", pricePerKgUsd: "4.400", quantityPerSet: 1, lengthFormula: "perimeter" },
    { mouldNumber: "0011808", role: "bead", kgPerMetre: "0.286", pricePerKgUsd: "4.400", quantityPerSet: 1, lengthFormula: "perimeter" },
  ];

  for (let i = 0; i < profiles.length; i++) {
    await storage.createConfigurationProfile({ ...profiles[i], configurationId: standard.id, sortOrder: i });
  }

  const accessories = [
    { name: "Glass cushion block", code: "0550082/3/5", colour: "Black plastic", priceUsd: "0.03", quantityPerSet: "8", scalingType: "fixed" },
    { name: "Water drain hole cap", code: "0550104", colour: "Black plastic", priceUsd: "0.07", quantityPerSet: "6", scalingType: "fixed" },
    { name: "28mm glass support", code: "0550722", colour: "Black plastic", priceUsd: "0.10", quantityPerSet: "8", scalingType: "fixed" },
    { name: "ES52 waterproof rubber pad (13mm)", code: "0815201", colour: "Black plastic", priceUsd: "0.06", quantityPerSet: "2", scalingType: "fixed" },
    { name: "Stream deflector 0003733", code: "0553730", colour: "Black plastic", priceUsd: "0.06", quantityPerSet: "8", scalingType: "fixed" },
    { name: "Stream deflector 0003726", code: "0553727", colour: "Black plastic", priceUsd: "0.06", quantityPerSet: "8", scalingType: "fixed" },
    { name: "Sealant corner for frame", code: "0818005", colour: "Black plastic", priceUsd: "0.30", quantityPerSet: "2", scalingType: "fixed" },
    { name: "5/10.5mm T-connector", code: "0503751", colour: "Plain color", priceUsd: "0.22", quantityPerSet: "2", scalingType: "fixed" },
    { name: "20mm Corner fixing piece", code: "0507000", colour: "Plain color", priceUsd: "0.06", quantityPerSet: "12", scalingType: "fixed" },
    { name: "14mm Corner fixing piece", code: "0507002", colour: "Plain color", priceUsd: "0.04", quantityPerSet: "4", scalingType: "fixed" },
    { name: "Locking T-connector (1 pair)", code: "0502200", colour: "Plain color", priceUsd: "0.61", quantityPerSet: "2", scalingType: "fixed" },
    { name: "27/39mm corner connector", code: "0502341", colour: "Plain color", priceUsd: "1.11", quantityPerSet: "4", scalingType: "fixed" },
    { name: "11/31mm corner connector", code: "0502522", colour: "Plain color", priceUsd: "0.51", quantityPerSet: "4", scalingType: "fixed" },
    { name: "15/33mm corner connector", code: "0504747", colour: "Plain color", priceUsd: "0.49", quantityPerSet: "4", scalingType: "fixed" },
    { name: "8/26mm corner connector", code: "0504872", colour: "Plain color", priceUsd: "0.27", quantityPerSet: "4", scalingType: "fixed" },
    { name: "13.6mm T-connector (inc. 1 nail)", code: "0503111", colour: "Plain color", priceUsd: "0.59", quantityPerSet: "2", scalingType: "fixed" },
    { name: "SS countersunk screw M5x45", code: "0612245", colour: "Stainless steel", priceUsd: "0.04", quantityPerSet: "1", scalingType: "fixed" },
    { name: "SS countersunk screw M5x75 (door handle)", code: "0612275", colour: "Stainless steel", priceUsd: "0.09", quantityPerSet: "2", scalingType: "fixed" },
    { name: "φ5x8mm pin", code: "0682003", colour: "Stainless steel", priceUsd: "0.02", quantityPerSet: "2", scalingType: "fixed" },
    { name: "8*105mm steel square spindle", code: "0702407", colour: "Plain color", priceUsd: "0.44", quantityPerSet: "1", scalingType: "fixed" },
    { name: "55/31 Knob lock cylinder", code: "0711024", colour: "Plain color", priceUsd: "5.80", quantityPerSet: "1", scalingType: "fixed" },
    { name: "3D adjustable hinge (set A)", code: "0745861.E1/E3", colour: "Silver/Black", priceUsd: "5.62", quantityPerSet: "3", scalingType: "fixed" },
    { name: "3D adjustable hinge (set B)", code: "0745862.E1/E3", colour: "Silver/Black", priceUsd: "5.62", quantityPerSet: "3", scalingType: "fixed" },
    { name: "Square shaft handle with base", code: "0755044.E1/E3", colour: "Silver/Black", priceUsd: "6.85", quantityPerSet: "1", scalingType: "fixed" },
    { name: "Lock-nail", code: "0755103", colour: "Plain color", priceUsd: "0.37", quantityPerSet: "2", scalingType: "fixed" },
    { name: "Lock seat", code: "0755123", colour: "Plain color", priceUsd: "0.20", quantityPerSet: "2", scalingType: "fixed" },
    { name: "Lock component A", code: "0755322", colour: "Plain color", priceUsd: "1.06", quantityPerSet: "1", scalingType: "fixed" },
    { name: "Lock component B", code: "0755324", colour: "Plain color", priceUsd: "9.31", quantityPerSet: "1", scalingType: "fixed" },
    { name: "Center gasket", code: "0808005", colour: "Black plastic", priceUsd: "0.60", quantityPerSet: "6.02", scalingType: "per-linear-metre" },
    { name: "Sealing gasket", code: "0808106", colour: "Black plastic", priceUsd: "0.19", quantityPerSet: "6.02", scalingType: "per-linear-metre" },
    { name: "Outer glass gasket", code: "0808204", colour: "Black plastic", priceUsd: "0.20", quantityPerSet: "6.95", scalingType: "per-linear-metre" },
    { name: "Inner glazing gasket", code: "0808306", colour: "Black plastic", priceUsd: "0.32", quantityPerSet: "6.95", scalingType: "per-linear-metre" },
    { name: "4mm round gasket", code: "0808504", colour: "Black plastic", priceUsd: "0.09", quantityPerSet: "0.8", scalingType: "per-linear-metre" },
    { name: "Sealing gasket B", code: "0808702", colour: "Black plastic", priceUsd: "0.17", quantityPerSet: "6.02", scalingType: "per-linear-metre" },
    { name: "Sealing gasket C", code: "0808744", colour: "Black plastic", priceUsd: "0.20", quantityPerSet: "6.02", scalingType: "per-linear-metre" },
  ];

  for (let i = 0; i < accessories.length; i++) {
    await storage.createConfigurationAccessory({ ...accessories[i], configurationId: standard.id, sortOrder: i });
  }

  await addLaborTasks(standard.id);
}

async function seedES127SlidingDoorConfigs(frameTypeId: string) {
  const standard = await storage.createFrameConfiguration({
    frameTypeId,
    name: "Standard",
    description: "1 Fixed + 1 Sliding, 1 Mullion, 1 Transom",
    defaultSalePricePerSqm: 650,
    sortOrder: 0,
  });

  const profiles = [
    { mouldNumber: "0011133", role: "bead", kgPerMetre: "0.259", pricePerKgUsd: "4.180", quantityPerSet: 3, lengthFormula: "perimeter" },
    { mouldNumber: "0100122", role: "spacer", kgPerMetre: "0.421", pricePerKgUsd: "4.180", quantityPerSet: 1, lengthFormula: "perimeter" },
    { mouldNumber: "0101008", role: "outer-frame", kgPerMetre: "0.565", pricePerKgUsd: "4.180", quantityPerSet: 1, lengthFormula: "perimeter" },
    { mouldNumber: "0200122", role: "sash-frame", kgPerMetre: "0.415", pricePerKgUsd: "4.180", quantityPerSet: 1, lengthFormula: "perimeter" },
    { mouldNumber: "0204102", role: "door-frame", kgPerMetre: "1.915", pricePerKgUsd: "4.400", quantityPerSet: 1, lengthFormula: "perimeter" },
    { mouldNumber: "0209016", role: "spacer", kgPerMetre: "0.241", pricePerKgUsd: "4.400", quantityPerSet: 1, lengthFormula: "width" },
    { mouldNumber: "0209112", role: "sash-frame", kgPerMetre: "1.962", pricePerKgUsd: "4.400", quantityPerSet: 1, lengthFormula: "perimeter" },
    { mouldNumber: "0209120", role: "transom", kgPerMetre: "1.293", pricePerKgUsd: "4.400", quantityPerSet: 1, lengthFormula: "width" },
    { mouldNumber: "0209210", role: "outer-frame", kgPerMetre: "2.678", pricePerKgUsd: "4.400", quantityPerSet: 2, lengthFormula: "perimeter" },
    { mouldNumber: "0209252", role: "door-frame", kgPerMetre: "2.007", pricePerKgUsd: "4.400", quantityPerSet: 1, lengthFormula: "perimeter" },
    { mouldNumber: "0355313", role: "bead", kgPerMetre: "0.226", pricePerKgUsd: "4.180", quantityPerSet: 1, lengthFormula: "perimeter" },
  ];

  for (let i = 0; i < profiles.length; i++) {
    await storage.createConfigurationProfile({ ...profiles[i], configurationId: standard.id, sortOrder: i });
  }

  const accessories = [
    { name: "Hinged insulation profile", code: "0100104 04", colour: "Black plastic", priceUsd: "1.48", quantityPerSet: "8.58", scalingType: "per-linear-metre" },
    { name: "Stainless steel rail", code: "0110019 SS", colour: "Stainless steel", priceUsd: "0.86", quantityPerSet: "4.23", scalingType: "per-linear-metre" },
    { name: "Process hole cap Φ10", code: "0550065 04", colour: "Black plastic", priceUsd: "0.02", quantityPerSet: "36", scalingType: "fixed" },
    { name: "Glass cushion block", code: "0550080 04", colour: "Black plastic", priceUsd: "0.03", quantityPerSet: "28", scalingType: "fixed" },
    { name: "Water drain hole cap", code: "0550104 04", colour: "Black plastic", priceUsd: "0.07", quantityPerSet: "17", scalingType: "fixed" },
    { name: "Hook edge sealing block (top/bottom)", code: "0550120 04", colour: "Black plastic", priceUsd: "0.29", quantityPerSet: "2", scalingType: "fixed" },
    { name: "Hook edge sealing block (upper inner)", code: "0550121 04", colour: "Black plastic", priceUsd: "0.19", quantityPerSet: "2", scalingType: "fixed" },
    { name: "Hook edge sealing block (lower internal)", code: "0550122 04", colour: "Black plastic", priceUsd: "0.10", quantityPerSet: "2", scalingType: "fixed" },
    { name: "Sealing block for ES120", code: "0550128 04", colour: "Black plastic", priceUsd: "0.19", quantityPerSet: "2", scalingType: "fixed" },
    { name: "Windproof drain valve", code: "0550139 04", colour: "Black plastic", priceUsd: "0.17", quantityPerSet: "10", scalingType: "fixed" },
    { name: "ES152 sealing block (lower)", code: "0550159 04", colour: "Black plastic", priceUsd: "0.14", quantityPerSet: "2", scalingType: "fixed" },
    { name: "ES152 sealing block (upper)", code: "0550160 04", colour: "Black plastic", priceUsd: "0.15", quantityPerSet: "6", scalingType: "fixed" },
    { name: "Gap block for lift-sliding door", code: "0550246 04", colour: "Black plastic", priceUsd: "0.05", quantityPerSet: "16", scalingType: "fixed" },
    { name: "25mm cache block", code: "0550266 04", colour: "Black plastic", priceUsd: "0.27", quantityPerSet: "4", scalingType: "fixed" },
    { name: "Hook edge sealing block (lower soft)", code: "0550312 04", colour: "Black plastic", priceUsd: "0.09", quantityPerSet: "2", scalingType: "fixed" },
    { name: "28mm glass support", code: "0550722 04", colour: "Black plastic", priceUsd: "0.10", quantityPerSet: "8", scalingType: "fixed" },
    { name: "37mm glass support", code: "0550731 04", colour: "Black plastic", priceUsd: "0.12", quantityPerSet: "8", scalingType: "fixed" },
    { name: "Glass support", code: "0550732 04", colour: "Black plastic", priceUsd: "0.10", quantityPerSet: "12", scalingType: "fixed" },
    { name: "Clip anti-theft", code: "0551461 04", colour: "Black plastic", priceUsd: "0.04", quantityPerSet: "12", scalingType: "fixed" },
    { name: "Stream deflector 0003726", code: "0553727 04", colour: "Black plastic", priceUsd: "0.06", quantityPerSet: "32", scalingType: "fixed" },
    { name: "11/41mm corner connector", code: "0502871 00", colour: "Plain color", priceUsd: "0.61", quantityPerSet: "8", scalingType: "fixed" },
    { name: "13/17.5mm T-connector A", code: "0503401 00", colour: "Plain color", priceUsd: "0.60", quantityPerSet: "4", scalingType: "fixed" },
    { name: "13/17.5mm T-connector B", code: "0503402 00", colour: "Plain color", priceUsd: "0.50", quantityPerSet: "4", scalingType: "fixed" },
    { name: "18/17.5mm T-connector A (inc. nuts/nails)", code: "0503603 00", colour: "Plain color", priceUsd: "0.36", quantityPerSet: "4", scalingType: "fixed" },
    { name: "18/17.5mm T-connector B (inc. nuts/nails)", code: "0503613 00", colour: "Plain color", priceUsd: "0.36", quantityPerSet: "4", scalingType: "fixed" },
    { name: "10.5/23.3mm corner connector", code: "0504570 00", colour: "Plain color", priceUsd: "0.26", quantityPerSet: "8", scalingType: "fixed" },
    { name: "7.5/26mm corner connector", code: "0504723 00", colour: "Plain color", priceUsd: "0.22", quantityPerSet: "16", scalingType: "fixed" },
    { name: "13/13mm corner connector", code: "0504834 00", colour: "Plain color", priceUsd: "0.32", quantityPerSet: "8", scalingType: "fixed" },
    { name: "53/13mm corner connector", code: "0504852 00", colour: "Plain color", priceUsd: "0.41", quantityPerSet: "4", scalingType: "fixed" },
    { name: "20mm corner fixing piece", code: "0507000 00", colour: "Plain color", priceUsd: "0.06", quantityPerSet: "24", scalingType: "fixed" },
    { name: "18.5mm corner fixing piece", code: "0507001 00", colour: "Plain color", priceUsd: "0.05", quantityPerSet: "4", scalingType: "fixed" },
    { name: "13mm corner fixing piece", code: "0507013 00", colour: "Plain color", priceUsd: "0.03", quantityPerSet: "16", scalingType: "fixed" },
    { name: "SS pan head screw ST3.5x9.5", code: "0602110 SS", colour: "Stainless steel", priceUsd: "0.01", quantityPerSet: "36", scalingType: "fixed" },
    { name: "SS pan head screw ST4.2x19", code: "0603119 SS", colour: "Stainless steel", priceUsd: "0.02", quantityPerSet: "9", scalingType: "fixed" },
    { name: "SS countersunk screw ST4.2x13", code: "0603213 SS", colour: "Stainless steel", priceUsd: "0.01", quantityPerSet: "26", scalingType: "fixed" },
    { name: "SS countersunk screw ST4.2x32", code: "0603232 SS", colour: "Stainless steel", priceUsd: "0.02", quantityPerSet: "4", scalingType: "fixed" },
    { name: "Anti-collision block", code: "0731747", colour: "Black", priceUsd: "0.44", quantityPerSet: "4", scalingType: "fixed" },
    { name: "Sealing gasket (same as 102)", code: "0808111 04", colour: "Black plastic", priceUsd: "0.24", quantityPerSet: "16.44", scalingType: "per-linear-metre" },
    { name: "Outer glass gasket", code: "0808204 04", colour: "Black plastic", priceUsd: "0.20", quantityPerSet: "26.71", scalingType: "per-linear-metre" },
    { name: "Inner glazing gasket A", code: "0808305 04", colour: "Black plastic", priceUsd: "0.30", quantityPerSet: "12.43", scalingType: "per-linear-metre" },
    { name: "Inner glazing gasket B", code: "0808306 04", colour: "Black plastic", priceUsd: "0.32", quantityPerSet: "14.28", scalingType: "per-linear-metre" },
    { name: "4mm round gasket", code: "0808504 04", colour: "Black plastic", priceUsd: "0.09", quantityPerSet: "1", scalingType: "per-linear-metre" },
    { name: "Sealing gasket D", code: "0808535 04", colour: "Black plastic", priceUsd: "0.31", quantityPerSet: "4.67", scalingType: "per-linear-metre" },
    { name: "Gasket A", code: "0808586 04", colour: "Black plastic", priceUsd: "0.13", quantityPerSet: "8.67", scalingType: "per-linear-metre" },
    { name: "Gasket B", code: "0808595 04", colour: "Black plastic", priceUsd: "0.88", quantityPerSet: "2.14", scalingType: "per-linear-metre" },
    { name: "Sealing gasket E", code: "0808762 04", colour: "Black plastic", priceUsd: "0.18", quantityPerSet: "8.58", scalingType: "per-linear-metre" },
    { name: "Sliding window gasket", code: "0809000 04", colour: "Black plastic", priceUsd: "0.29", quantityPerSet: "18.97", scalingType: "per-linear-metre" },
  ];

  for (let i = 0; i < accessories.length; i++) {
    await storage.createConfigurationAccessory({ ...accessories[i], configurationId: standard.id, sortOrder: i });
  }

  await addLaborTasks(standard.id);
}

const PROFILE_FAMILY_MAP: Record<string, string[]> = {
  "0015032": ["ES52 Window"],
  "0017133": ["ES52 Window"],
  "E0026001": ["ES52 Window"],
  "E0026002": ["ES52 Window"],
  "2020250": ["ES52 Window"],
  "0010175": ["ES52 Hinge Door"],
  "0035223": ["ES52 Hinge Door"],
  "E0026004": ["ES52 Hinge Door"],
  "0020322": ["ES52 Hinge Door"],
  "0021801": ["ES52 Hinge Door"],
  "0022200": ["ES52 Hinge Door"],
  "0011808": ["ES52 Hinge Door"],
  "0011133": ["ES127 Sliding Door"],
  "0100122": ["ES127 Sliding Door"],
  "0101008": ["ES127 Sliding Door"],
  "0200122": ["ES127 Sliding Door"],
  "0204102": ["ES127 Sliding Door"],
  "0209016": ["ES127 Sliding Door"],
  "0209112": ["ES127 Sliding Door"],
  "0209120": ["ES127 Sliding Door"],
  "0209210": ["ES127 Sliding Door"],
  "0209252": ["ES127 Sliding Door"],
  "0355313": ["ES127 Sliding Door"],
};

const ACCESSORY_FAMILY_MAP: Record<string, string[]> = {};

function buildAccessoryFamilyMap() {
  const es52WindowCodes = [
    "0550083 04", "0550085 04", "0507002 00", "0502310 00", "0502312 00",
    "0503222 00", "0503732 00", "0682003 SS", "0808102 04", "0808204 04",
    "0808305 04", "FJ600A-14", "XW15",
  ];
  const es52DoorCodes = [
    "0550082/3/5", "0550104", "0550722", "0815201", "0553730", "0553727",
    "0818005", "0503751", "0507000", "0507002", "0502200", "0502341",
    "0502522", "0504747", "0504872", "0503111", "0612245", "0612275",
    "0682003", "0702407", "0711024", "0745861.E1/E3", "0745862.E1/E3",
    "0755044.E1/E3", "0755103", "0755123", "0755322", "0755324",
    "0808005", "0808106", "0808204", "0808306", "0808504", "0808702", "0808744",
  ];
  const es127Codes = [
    "0100104 04", "0110019 SS", "0550065 04", "0550080 04", "0550104 04",
    "0550120 04", "0550121 04", "0550122 04", "0550128 04", "0550139 04",
    "0550159 04", "0550160 04", "0550246 04", "0550266 04", "0550312 04",
    "0550722 04", "0550731 04", "0550732 04", "0551461 04", "0553727 04",
    "0502871 00", "0503401 00", "0503402 00", "0503603 00", "0503613 00",
    "0504570 00", "0504723 00", "0504834 00", "0504852 00", "0507000 00",
    "0507001 00", "0507013 00", "0602110 SS", "0603119 SS", "0603213 SS",
    "0603232 SS", "0731747", "0808111 04", "0808204 04", "0808305 04",
    "0808306 04", "0808504 04", "0808535 04", "0808586 04", "0808595 04",
    "0808762 04", "0809000 04",
  ];

  for (const code of es52WindowCodes) {
    if (!ACCESSORY_FAMILY_MAP[code]) ACCESSORY_FAMILY_MAP[code] = [];
    if (!ACCESSORY_FAMILY_MAP[code].includes("ES52 Window")) ACCESSORY_FAMILY_MAP[code].push("ES52 Window");
  }
  for (const code of es52DoorCodes) {
    if (!ACCESSORY_FAMILY_MAP[code]) ACCESSORY_FAMILY_MAP[code] = [];
    if (!ACCESSORY_FAMILY_MAP[code].includes("ES52 Hinge Door")) ACCESSORY_FAMILY_MAP[code].push("ES52 Hinge Door");
  }
  for (const code of es127Codes) {
    if (!ACCESSORY_FAMILY_MAP[code]) ACCESSORY_FAMILY_MAP[code] = [];
    if (!ACCESSORY_FAMILY_MAP[code].includes("ES127 Sliding Door")) ACCESSORY_FAMILY_MAP[code].push("ES127 Sliding Door");
  }
}

buildAccessoryFamilyMap();

async function seedDirectMaterials() {
  const existingProfiles = await storage.getLibraryEntries("direct_profile");
  const existingAccessories = await storage.getLibraryEntries("direct_accessory");
  const existingMoulds = new Set(existingProfiles.map(e => (e.data as any).mouldNumber));
  const existingCodes = new Set(existingAccessories.map(e => (e.data as any).code));

  const allProfiles = await storage.getAllConfigurationProfiles();
  const allAccessories = await storage.getAllConfigurationAccessories();

  const profileMap = new Map<string, typeof allProfiles[0]>();
  for (const p of allProfiles) {
    if (!profileMap.has(p.mouldNumber)) {
      profileMap.set(p.mouldNumber, p);
    }
  }

  let profileSort = existingProfiles.length;
  for (const [mouldNumber, p] of Array.from(profileMap)) {
    if (existingMoulds.has(mouldNumber)) continue;
    const familyGroup = PROFILE_FAMILY_MAP[mouldNumber] || ["Other"];
    await storage.createLibraryEntry({
      type: "direct_profile",
      data: {
        mouldNumber,
        role: p.role,
        kgPerMetre: p.kgPerMetre,
        pricePerKgUsd: p.pricePerKgUsd,
        lengthFormula: p.lengthFormula || "perimeter",
        familyGroup,
        description: "",
      },
      sortOrder: profileSort++,
    });
  }

  const accessoryMap = new Map<string, typeof allAccessories[0]>();
  for (const a of allAccessories) {
    const code = a.code || "";
    if (code && !accessoryMap.has(code)) {
      accessoryMap.set(code, a);
    }
  }

  let accSort = existingAccessories.length;
  for (const [code, a] of Array.from(accessoryMap)) {
    if (existingCodes.has(code)) continue;
    const familyGroup = ACCESSORY_FAMILY_MAP[code] || ["Other"];
    await storage.createLibraryEntry({
      type: "direct_accessory",
      data: {
        name: a.name,
        code,
        colour: a.colour || "",
        priceUsd: a.priceUsd,
        scalingType: a.scalingType || "fixed",
        familyGroup,
        description: "",
      },
      sortOrder: accSort++,
    });
  }
}

const DEFAULT_LABOUR_OPERATIONS = [
  { name: "cutting", category: "manual", timeMinutes: 15, ratePerHour: 45, description: "" },
  { name: "milling", category: "manual", timeMinutes: 10, ratePerHour: 45, description: "" },
  { name: "drilling", category: "manual", timeMinutes: 10, ratePerHour: 45, description: "" },
  { name: "slotting", category: "manual", timeMinutes: 8, ratePerHour: 45, description: "" },
  { name: "assembly-crimped", category: "manual", timeMinutes: 20, ratePerHour: 45, description: "" },
  { name: "assembly-screwed", category: "manual", timeMinutes: 25, ratePerHour: 45, description: "" },
  { name: "glazing", category: "manual", timeMinutes: 15, ratePerHour: 45, description: "" },
  { name: "cnc-drilling", category: "cnc", timeMinutes: 5, ratePerHour: 85, description: "" },
  { name: "cnc-milling", category: "cnc", timeMinutes: 8, ratePerHour: 85, description: "" },
  { name: "cnc-routing", category: "cnc", timeMinutes: 10, ratePerHour: 85, description: "" },
];

async function seedLabourOperations() {
  const existing = await storage.getLibraryEntries("labour_operation");
  if (existing.length > 0) return;
  for (let i = 0; i < DEFAULT_LABOUR_OPERATIONS.length; i++) {
    await storage.createLibraryEntry({
      type: "labour_operation",
      data: DEFAULT_LABOUR_OPERATIONS[i],
      sortOrder: i,
    });
  }
}

const DEFAULT_INSTALLATION_RATES = [
  { name: "Small Window", category: "window", minSqm: 0, maxSqm: 1, costPerUnit: 187.5, sellPerUnit: 250, description: "" },
  { name: "Medium Window", category: "window", minSqm: 1, maxSqm: 2, costPerUnit: 225, sellPerUnit: 300, description: "" },
  { name: "Large Window", category: "window", minSqm: 2, maxSqm: 3, costPerUnit: 262.5, sellPerUnit: 350, description: "" },
  { name: "Extra Large Window", category: "window", minSqm: 3, maxSqm: 999, costPerUnit: 300, sellPerUnit: 400, description: "" },
  { name: "Standard Door", category: "door", minSqm: 0, maxSqm: 2.5, costPerUnit: 262.5, sellPerUnit: 350, description: "" },
  { name: "Large Door", category: "door", minSqm: 2.5, maxSqm: 999, costPerUnit: 337.5, sellPerUnit: 450, description: "" },
];

async function seedInstallationRates() {
  const existing = await storage.getLibraryEntries("installation_rate");
  if (existing.length > 0) {
    for (const entry of existing) {
      const d = entry.data as any;
      if (d.pricePerUnit !== undefined && d.costPerUnit === undefined) {
        const sell = d.pricePerUnit;
        const cost = Math.round(sell * 0.75 * 100) / 100;
        const { pricePerUnit, ...rest } = d;
        await storage.updateLibraryEntry(entry.id, { data: { ...rest, costPerUnit: cost, sellPerUnit: sell } });
      }
    }
    return;
  }
  for (let i = 0; i < DEFAULT_INSTALLATION_RATES.length; i++) {
    await storage.createLibraryEntry({
      type: "installation_rate",
      data: DEFAULT_INSTALLATION_RATES[i],
      sortOrder: i,
    });
  }
}

const DEFAULT_DELIVERY_RATES = [
  { name: "In-house Vehicle", vehicle: "van", costNzd: 112.5, sellNzd: 150, description: "" },
  { name: "Small Crane Truck", vehicle: "small-crane", costNzd: 262.5, sellNzd: 350, description: "" },
  { name: "Large Crane Truck", vehicle: "large-crane", costNzd: 412.5, sellNzd: 550, description: "" },
  { name: "Trucking Company", vehicle: "trucking-company", costNzd: 0, sellNzd: 0, description: "Enter custom rate" },
];

async function seedDeliveryRates() {
  const existing = await storage.getLibraryEntries("delivery_rate");
  if (existing.length > 0) {
    for (const entry of existing) {
      const d = entry.data as any;
      if (d.rateNzd !== undefined && d.costNzd === undefined) {
        const sell = d.rateNzd;
        const cost = Math.round(sell * 0.75 * 100) / 100;
        const { rateNzd, ...rest } = d;
        await storage.updateLibraryEntry(entry.id, { data: { ...rest, costNzd: cost, sellNzd: sell } });
      }
    }
    return;
  }
  for (let i = 0; i < DEFAULT_DELIVERY_RATES.length; i++) {
    await storage.createLibraryEntry({
      type: "delivery_rate",
      data: DEFAULT_DELIVERY_RATES[i],
      sortOrder: i,
    });
  }
}

const LJ_DEFAULT_SPEC_DISPLAY_KEYS = [
  "configuration", "overallSize", "frameSeries", "frameColor", "windZone",
  "rValue", "iguType", "glassType", "glassThickness", "handleSet", "lockSet",
  "linerType", "flashingSize", "wallThickness", "heightFromFloor",
];

async function seedOrgAndDivisions() {
  const org = await storage.getOrgSettings();
  if (!org) {
    await storage.upsertOrgSettings({
      id: "default",
      legalName: "Lateral Engineering Limited",
      quoteValidityDays: 30,
    });
  }

  const divisions = [
    { divisionCode: "LJ", tradingName: "Lateral Joinery", templateKey: "joinery_v1", specDisplayDefaultsJson: LJ_DEFAULT_SPEC_DISPLAY_KEYS },
    { divisionCode: "LE", tradingName: "Lateral Engineering", templateKey: "engineering_v1", specDisplayDefaultsJson: null },
    { divisionCode: "LL", tradingName: "Lateral Laser", templateKey: "laser_v1", specDisplayDefaultsJson: null },
  ];

  for (const d of divisions) {
    const existing = await storage.getDivisionSettings(d.divisionCode);
    if (!existing) {
      await storage.upsertDivisionSettings(d.divisionCode, {
        tradingName: d.tradingName,
        templateKey: d.templateKey,
        specDisplayDefaultsJson: d.specDisplayDefaultsJson,
      });
    }
  }
}

const LJ_SPEC_ENTRIES = [
  { key: "itemRef", divisionScope: "LJ", group: "Identification", label: "Item Reference", sortOrder: 1, inputKind: "text", customerVisibleAllowed: true },
  { key: "configuration", divisionScope: "LJ", group: "Identification", label: "Configuration", sortOrder: 2, inputKind: "text", customerVisibleAllowed: true },
  { key: "itemCategory", divisionScope: "LJ", group: "Identification", label: "Item Category", sortOrder: 3, inputKind: "select_enum", optionsJson: ["windows-standard","sliding-window","sliding-door","entrance-door","hinge-door","french-door","bifold-door","stacker-door","bay-window"], customerVisibleAllowed: true },
  { key: "overallSize", divisionScope: "LJ", group: "Dimensions", label: "Overall Size", sortOrder: 10, inputKind: "computed", customerVisibleAllowed: true, unit: "mm" },
  { key: "quantity", divisionScope: "LJ", group: "Dimensions", label: "Quantity", sortOrder: 11, inputKind: "number", customerVisibleAllowed: false },
  { key: "width", divisionScope: "LJ", group: "Dimensions", label: "Width", sortOrder: 12, inputKind: "number", customerVisibleAllowed: true, unit: "mm" },
  { key: "height", divisionScope: "LJ", group: "Dimensions", label: "Height", sortOrder: 13, inputKind: "number", customerVisibleAllowed: true, unit: "mm" },
  { key: "windZone", divisionScope: "LJ", group: "Performance", label: "Wind Zone", sortOrder: 20, inputKind: "select_enum", optionsJson: ["Low","Medium","High","Very High","Extra High"], customerVisibleAllowed: true },
  { key: "rValue", divisionScope: "LJ", group: "Performance", label: "R-Value", sortOrder: 21, inputKind: "computed", customerVisibleAllowed: true },
  { key: "frameSeries", divisionScope: "LJ", group: "FrameFinish", label: "Frame Series", sortOrder: 30, inputKind: "select_library", librarySourceKey: "frame_type", customerVisibleAllowed: true },
  { key: "frameColor", divisionScope: "LJ", group: "FrameFinish", label: "Frame Colour", sortOrder: 31, inputKind: "select_library", librarySourceKey: "frame_color", customerVisibleAllowed: true },
  { key: "flashingSize", divisionScope: "LJ", group: "FrameFinish", label: "Flashing Size", sortOrder: 32, inputKind: "select_enum", optionsJson: ["0","40","50","60","75","100","125","150"], unit: "mm", customerVisibleAllowed: true },
  { key: "iguType", divisionScope: "LJ", group: "Glazing", label: "IGU Type", sortOrder: 40, inputKind: "cascading_glass", customerVisibleAllowed: true },
  { key: "glassType", divisionScope: "LJ", group: "Glazing", label: "Glass Type", sortOrder: 41, inputKind: "cascading_glass", customerVisibleAllowed: true },
  { key: "glassThickness", divisionScope: "LJ", group: "Glazing", label: "Glass Thickness", sortOrder: 42, inputKind: "cascading_glass", customerVisibleAllowed: true },
  { key: "handleSet", divisionScope: "LJ", group: "Hardware", label: "Handle Set", sortOrder: 50, inputKind: "select_library_dynamic", customerVisibleAllowed: true },
  { key: "lockSet", divisionScope: "LJ", group: "Hardware", label: "Lock Type", sortOrder: 51, inputKind: "select_library_dynamic", customerVisibleAllowed: true },
  { key: "wanzBarEnabled", divisionScope: "LJ", group: "Hardware", label: "Wanz Bar", sortOrder: 52, inputKind: "boolean", customerVisibleAllowed: false },
  { key: "wanzBarSource", divisionScope: "LJ", group: "Hardware", label: "Wanz Bar Source", sortOrder: 52, inputKind: "select_enum", optionsJson: ["nz-local","direct",""], customerVisibleAllowed: false },
  { key: "wanzBarSize", divisionScope: "LJ", group: "Hardware", label: "Wanz Bar Size", sortOrder: 53, inputKind: "select_library", librarySourceKey: "wanz_bar", customerVisibleAllowed: false },
  { key: "linerType", divisionScope: "LJ", group: "LinersFlashings", label: "Liner Type", sortOrder: 60, inputKind: "select_library", librarySourceKey: "liner_type", customerVisibleAllowed: true },
  { key: "wallThickness", divisionScope: "LJ", group: "Install", label: "Wall Thickness", sortOrder: 70, inputKind: "number", unit: "mm", customerVisibleAllowed: true },
  { key: "heightFromFloor", divisionScope: "LJ", group: "Install", label: "Height from Floor", sortOrder: 71, inputKind: "number", unit: "mm", customerVisibleAllowed: true },
  { key: "pricePerSqm", divisionScope: "LJ", group: "Pricing", label: "Sale Price / m²", sortOrder: 80, inputKind: "number", unit: "$/m²", customerVisibleAllowed: false },
  { key: "configurationId", divisionScope: "LJ", group: "Pricing", label: "Frame Configuration", sortOrder: 81, inputKind: "text", customerVisibleAllowed: false },
  { key: "layout", divisionScope: "LJ", group: "Layout", label: "Layout Mode", sortOrder: 90, inputKind: "select_enum", optionsJson: ["standard","custom"], customerVisibleAllowed: false },
  { key: "windowType", divisionScope: "LJ", group: "Layout", label: "Window Type", sortOrder: 91, inputKind: "select_enum", optionsJson: ["fixed","awning"], customerVisibleAllowed: true },
  { key: "hingeSide", divisionScope: "LJ", group: "Layout", label: "Hinge Side", sortOrder: 92, inputKind: "select_enum", optionsJson: ["left","right"], customerVisibleAllowed: true },
  { key: "openDirection", divisionScope: "LJ", group: "Layout", label: "Open Direction", sortOrder: 93, inputKind: "select_enum", optionsJson: ["in","out"], customerVisibleAllowed: true },
  { key: "halfSolid", divisionScope: "LJ", group: "Layout", label: "Half Solid Panel", sortOrder: 94, inputKind: "boolean", customerVisibleAllowed: false },
  { key: "panels", divisionScope: "LJ", group: "Layout", label: "Panel Count", sortOrder: 95, inputKind: "number", customerVisibleAllowed: true },
  { key: "sidelightEnabled", divisionScope: "LJ", group: "Layout", label: "Sidelight", sortOrder: 96, inputKind: "boolean", customerVisibleAllowed: true },
  { key: "sidelightSide", divisionScope: "LJ", group: "Layout", label: "Sidelight Side", sortOrder: 97, inputKind: "select_enum", optionsJson: ["left","right","both"], customerVisibleAllowed: true },
  { key: "sidelightWidth", divisionScope: "LJ", group: "Layout", label: "Sidelight Width", sortOrder: 98, inputKind: "number", unit: "mm", customerVisibleAllowed: true },
  { key: "doorSplit", divisionScope: "LJ", group: "Layout", label: "Door Split", sortOrder: 99, inputKind: "boolean", customerVisibleAllowed: false },
  { key: "doorSplitHeight", divisionScope: "LJ", group: "Layout", label: "Split Height", sortOrder: 100, inputKind: "number", unit: "mm", customerVisibleAllowed: false },
  { key: "bifoldLeftCount", divisionScope: "LJ", group: "Layout", label: "Bifold Left Panels", sortOrder: 101, inputKind: "number", customerVisibleAllowed: false },
  { key: "showLegend", divisionScope: "LJ", group: "Layout", label: "Show Legend", sortOrder: 102, inputKind: "boolean", customerVisibleAllowed: false },
  { key: "cachedWeightKg", divisionScope: "LJ", group: "Pricing", label: "Estimated Weight", sortOrder: 82, inputKind: "computed", unit: "kg", customerVisibleAllowed: false },
  { key: "notes", divisionScope: "LJ", group: "Notes", label: "Notes", sortOrder: 110, inputKind: "textarea", customerVisibleAllowed: false },
];

async function seedSpecDictionary() {
  const existing = await storage.getAllSpecEntries();
  const existingKeys = new Set(existing.map(e => e.key));
  for (const entry of LJ_SPEC_ENTRIES) {
    if (existingKeys.has(entry.key)) continue;
    await pool.query(
      `INSERT INTO spec_dictionary (key, division_scope, "group", label, sort_order, input_kind, library_source_key, options_json, customer_visible_allowed, unit, help_text) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING`,
      [
        entry.key,
        entry.divisionScope || null,
        entry.group,
        entry.label,
        entry.sortOrder,
        entry.inputKind,
        (entry as any).librarySourceKey || null,
        (entry as any).optionsJson ? JSON.stringify((entry as any).optionsJson) : null,
        entry.customerVisibleAllowed ?? true,
        (entry as any).unit || null,
        (entry as any).helpText || null,
      ]
    );
  }
}
