import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertJobSchema, insertLibraryEntrySchema, quoteItemSchema,
  insertFrameConfigurationSchema, insertConfigurationProfileSchema,
  insertConfigurationAccessorySchema, insertConfigurationLaborSchema,
} from "@shared/schema";
import { z } from "zod";
import { GLASS_LIBRARY } from "@shared/glass-library";
import { FRAME_TYPES, FRAME_COLORS, LINER_TYPES, HANDLE_CATEGORIES, WANZ_BAR_DEFAULTS } from "@shared/item-options";

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
  }

  const hasDirectProfiles = existingEntries.some((e) => e.type === "direct_profile");
  if (!hasDirectProfiles) {
    console.log("Seeding direct materials from configurations...");
    await seedDirectMaterials();
    console.log("Direct materials seeded");
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
