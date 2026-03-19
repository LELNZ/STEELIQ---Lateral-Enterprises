// ─── Lifecycle Template Definitions ─────────────────────────────────────────
// Phase 1: LJ is the first live division template.
// Phase 2: Stage tasks added. The seeder upserts templateJson so all instances
//          (including those locked to v1) gain access to the task definitions.
//          Task definitions are operational overlays, not structural stage changes —
//          this does not mutate any financial or commercial record.

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
      tasks: [
        { key: "review_brief",       label: "Review site photos / initial brief",    required: false, sortOrder: 1 },
        { key: "record_measurements",label: "Take and record site measurements",      required: true,  sortOrder: 2 },
        { key: "price_materials",    label: "Price materials and labour",            required: false, sortOrder: 3 },
        { key: "complete_estimate",  label: "Complete cost estimate",                required: true,  sortOrder: 4 },
      ],
    },
    {
      key: "quote",
      label: "Quote",
      masterKey: "QUOTE",
      order: 2,
      ownerRole: "estimator",
      responsibility: "internal",
      description: "Quote prepared and issued to client",
      tasks: [
        { key: "generate_document",  label: "Generate quote document",              required: true,  sortOrder: 1 },
        { key: "internal_review",    label: "Internal pricing review",              required: false, sortOrder: 2 },
        { key: "send_to_client",     label: "Send quote to client",                 required: true,  sortOrder: 3 },
      ],
    },
    {
      key: "acceptance",
      label: "Acceptance",
      masterKey: "ACCEPTANCE",
      order: 3,
      ownerRole: "admin",
      responsibility: "client",
      description: "Client reviews and accepts the quote",
      tasks: [
        { key: "receive_acceptance", label: "Receive signed acceptance / confirmation", required: true,  sortOrder: 1 },
        { key: "record_acceptance",  label: "Record acceptance date and value",         required: true,  sortOrder: 2 },
      ],
    },
    {
      key: "commercial_setup",
      label: "Commercial Setup",
      masterKey: "COMMERCIAL_SETUP",
      order: 4,
      ownerRole: "admin",
      responsibility: "internal",
      description: "Deposit invoiced, job created and commercial records confirmed",
      tasks: [
        { key: "issue_deposit",      label: "Issue deposit invoice to client",         required: true,  sortOrder: 1 },
        { key: "create_job",         label: "Convert accepted quote to op-job",        required: true,  sortOrder: 2 },
        { key: "send_confirmation",  label: "Send job confirmation to client",         required: false, sortOrder: 3 },
      ],
    },
    {
      key: "site_measure",
      label: "Site Measure / Review",
      masterKey: "DESIGN_REVIEW",
      order: 5,
      ownerRole: "admin",
      responsibility: "internal",
      description: "Site measure completed and design finalised",
      tasks: [
        { key: "schedule_visit",     label: "Schedule site visit with client",         required: true,  sortOrder: 1 },
        { key: "complete_measure",   label: "Complete site measurements",              required: true,  sortOrder: 2 },
        { key: "confirm_design",     label: "Confirm final design and specifications", required: true,  sortOrder: 3 },
        { key: "client_signoff",     label: "Client sign-off on drawings",            required: false, sortOrder: 4 },
      ],
    },
    {
      key: "procurement",
      label: "Procurement",
      masterKey: "PROCUREMENT",
      order: 6,
      ownerRole: "production",
      responsibility: "internal",
      description: "Materials ordered and lead times confirmed",
      tasks: [
        { key: "order_frames",       label: "Order aluminium frames / extrusions",    required: true,  sortOrder: 1 },
        { key: "order_glass",        label: "Order glazing units",                    required: true,  sortOrder: 2 },
        { key: "confirm_leadtimes",  label: "Confirm lead times with suppliers",      required: true,  sortOrder: 3 },
        { key: "delivery_confirmed", label: "Receive material delivery confirmation", required: false, sortOrder: 4 },
      ],
    },
    {
      key: "manufacture",
      label: "Manufacture",
      masterKey: "MANUFACTURE",
      order: 7,
      ownerRole: "production",
      responsibility: "internal",
      description: "Windows and doors manufactured to specification",
      tasks: [
        { key: "begin_fabrication",  label: "Begin frame fabrication",               required: false, sortOrder: 1 },
        { key: "complete_glazing",   label: "Complete glazing installation",          required: true,  sortOrder: 2 },
        { key: "quality_check",      label: "Quality check complete",                required: true,  sortOrder: 3 },
        { key: "label_pack",         label: "Products labelled and packed",          required: false, sortOrder: 4 },
      ],
    },
    {
      key: "delivery_install",
      label: "Delivery / Install",
      masterKey: "DISPATCH",
      order: 8,
      ownerRole: "production",
      responsibility: "internal",
      description: "Product delivered and installed on site",
      tasks: [
        { key: "schedule_delivery",  label: "Schedule delivery date with client",     required: true,  sortOrder: 1 },
        { key: "deliver_product",    label: "Deliver product to site",               required: true,  sortOrder: 2 },
        { key: "install_complete",   label: "Install windows and doors",             required: true,  sortOrder: 3 },
        { key: "client_handover",    label: "Client handover sign-off",              required: true,  sortOrder: 4 },
      ],
    },
    {
      key: "invoicing",
      label: "Invoicing",
      masterKey: "INVOICING",
      order: 9,
      ownerRole: "finance",
      responsibility: "internal",
      description: "Final invoice issued and payment collected",
      tasks: [
        { key: "issue_final_invoice",label: "Issue final invoice",                   required: true,  sortOrder: 1 },
        { key: "followup_balance",   label: "Follow up outstanding balance (if any)",required: false, sortOrder: 2 },
        { key: "payment_received",   label: "Payment received / confirmed",          required: true,  sortOrder: 3 },
      ],
    },
    {
      key: "closeout",
      label: "Closeout",
      masterKey: "CLOSEOUT",
      order: 10,
      ownerRole: "admin",
      responsibility: "internal",
      description: "Job closed, records archived and completed",
      tasks: [
        { key: "archive_photos",     label: "Archive site photos and documentation", required: true,  sortOrder: 1 },
        { key: "warranty_details",   label: "Confirm warranty details with client",  required: false, sortOrder: 2 },
        { key: "mark_complete",      label: "Mark job complete",                     required: true,  sortOrder: 3 },
      ],
    },
  ],
};

// ─── Seeder ──────────────────────────────────────────────────────────────────
// Called once at server startup. Upserts the LJ v1 template record:
//   - If it doesn't exist: inserts.
//   - If it exists: updates templateJson to include Phase 2 task definitions.
// This is safe: task definitions are operational overlays on an existing template
// record. No financial or commercial records are mutated.
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
      console.log("[lifecycle] Seeded LJ v1 lifecycle template (with Phase 2 tasks)");
    } else {
      // Phase 2 upsert: update templateJson to add task definitions
      await db
        .update(lifecycleTemplates)
        .set({ templateJson: LJ_LIFECYCLE_TEMPLATE_V1 as any })
        .where(
          and(
            eq(lifecycleTemplates.divisionCode, "LJ"),
            eq(lifecycleTemplates.version, 1),
          ),
        );
      console.log("[lifecycle] Updated LJ v1 lifecycle template (Phase 2 tasks applied)");
    }
  } catch (err) {
    console.error("[lifecycle] Failed to seed lifecycle templates:", err);
  }
}
