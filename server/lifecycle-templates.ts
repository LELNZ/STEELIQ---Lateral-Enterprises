// ─── Lifecycle Template Definitions ─────────────────────────────────────────
// Phase 1: LJ is the first live division template.
// LEL and LL are not operationally active — their templates will be added later.
// The seeder creates/upserts the template record at server startup.

import { pool } from "./storage";
import { drizzle } from "drizzle-orm/node-postgres";
import { lifecycleTemplates } from "@shared/schema";
import { LifecycleTemplateConfig } from "@shared/lifecycle";
import { eq, and } from "drizzle-orm";

const db = drizzle(pool);

// ─── LJ Template v1 ──────────────────────────────────────────────────────────
export const LJ_LIFECYCLE_TEMPLATE_V1: LifecycleTemplateConfig = {
  divisionCode: "LJ",
  name: "Lateral Joinery — Standard Lifecycle",
  stages: [
    {
      key: "estimate",
      label: "Estimate",
      masterKey: "ESTIMATE",
      order: 1,
      ownerRole: "estimator",
      responsibility: "internal",
      description: "Job measured, costed and estimate prepared",
    },
    {
      key: "quote",
      label: "Quote",
      masterKey: "QUOTE",
      order: 2,
      ownerRole: "estimator",
      responsibility: "internal",
      description: "Quote prepared and issued to client",
    },
    {
      key: "acceptance",
      label: "Acceptance",
      masterKey: "ACCEPTANCE",
      order: 3,
      ownerRole: "admin",
      responsibility: "client",
      description: "Client reviews and accepts the quote",
    },
    {
      key: "commercial_setup",
      label: "Commercial Setup",
      masterKey: "COMMERCIAL_SETUP",
      order: 4,
      ownerRole: "admin",
      responsibility: "internal",
      description: "Deposit invoiced, job created and commercial records confirmed",
    },
    {
      key: "site_measure",
      label: "Site Measure / Review",
      masterKey: "DESIGN_REVIEW",
      order: 5,
      ownerRole: "admin",
      responsibility: "internal",
      description: "Site measure completed and design finalised",
    },
    {
      key: "procurement",
      label: "Procurement",
      masterKey: "PROCUREMENT",
      order: 6,
      ownerRole: "production",
      responsibility: "internal",
      description: "Materials ordered and lead times confirmed",
    },
    {
      key: "manufacture",
      label: "Manufacture",
      masterKey: "MANUFACTURE",
      order: 7,
      ownerRole: "production",
      responsibility: "internal",
      description: "Windows and doors manufactured to specification",
    },
    {
      key: "delivery_install",
      label: "Delivery / Install",
      masterKey: "DISPATCH",
      order: 8,
      ownerRole: "production",
      responsibility: "internal",
      description: "Product delivered and installed on site",
    },
    {
      key: "invoicing",
      label: "Invoicing",
      masterKey: "INVOICING",
      order: 9,
      ownerRole: "finance",
      responsibility: "internal",
      description: "Final invoice issued and payment collected",
    },
    {
      key: "closeout",
      label: "Closeout",
      masterKey: "CLOSEOUT",
      order: 10,
      ownerRole: "admin",
      responsibility: "internal",
      description: "Job closed, records archived and completed",
    },
  ],
};

// ─── Seeder ──────────────────────────────────────────────────────────────────
// Called once at server startup. Creates the LJ v1 template record if it does
// not already exist. Safe to call multiple times — idempotent.
export async function seedLifecycleTemplates(): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(lifecycleTemplates)
      .where(
        and(
          eq(lifecycleTemplates.divisionCode, "LJ"),
          eq(lifecycleTemplates.version, 1),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(lifecycleTemplates).values({
        divisionCode: "LJ",
        name: LJ_LIFECYCLE_TEMPLATE_V1.name,
        version: 1,
        templateJson: LJ_LIFECYCLE_TEMPLATE_V1 as any,
        isActive: true,
      });
      console.log("[lifecycle] Seeded LJ v1 lifecycle template");
    }
  } catch (err) {
    // Non-fatal — log but do not crash server startup
    console.error("[lifecycle] Failed to seed lifecycle templates:", err);
  }
}
