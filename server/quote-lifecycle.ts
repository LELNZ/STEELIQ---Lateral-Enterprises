import { type Quote } from "@shared/schema";
import { storage } from "./storage";

export type QuoteCascadeAction = "archive" | "delete" | "keep";

export interface EnrichedQuote extends Quote {
  isOrphaned: boolean;
  linkedEstimateExists: boolean;
}

export async function getQuotesByJobId(jobId: string): Promise<Quote[]> {
  return storage.getQuotesByJobId(jobId);
}

export async function archiveQuote(id: string): Promise<Quote | undefined> {
  const now = new Date();
  const updated = await storage.updateQuote(id, {
    status: "archived",
    archivedAt: now,
  } as any);

  if (updated) {
    await storage.createAuditLog({
      entityType: "quote",
      entityId: id,
      action: "archived",
      metadataJson: { archivedAt: now.toISOString() },
    });
  }
  return updated;
}

export async function unarchiveQuote(id: string): Promise<Quote | undefined> {
  const quote = await storage.getQuote(id);
  if (!quote || !quote.archivedAt) return undefined;

  const updated = await storage.updateQuote(id, {
    status: "draft",
    archivedAt: null,
  } as any);

  if (updated) {
    await storage.createAuditLog({
      entityType: "quote",
      entityId: id,
      action: "unarchived",
      metadataJson: { previousStatus: quote.status },
    });
  }
  return updated;
}

export async function softDeleteQuote(id: string): Promise<Quote | undefined> {
  const now = new Date();
  const updated = await storage.updateQuote(id, {
    deletedAt: now,
  } as any);

  if (updated) {
    await storage.createAuditLog({
      entityType: "quote",
      entityId: id,
      action: "soft_deleted",
      metadataJson: { deletedAt: now.toISOString() },
    });
  }
  return updated;
}

export async function hardDeleteQuote(id: string): Promise<void> {
  await storage.createAuditLog({
    entityType: "quote",
    entityId: id,
    action: "hard_deleted",
    metadataJson: {},
  });
  await storage.deleteQuoteAndRevisions(id);
}

export async function archiveQuotesByJobId(jobId: string): Promise<number> {
  const linkedQuotes = await storage.getQuotesByJobId(jobId);
  let count = 0;
  for (const q of linkedQuotes) {
    if (q.archivedAt === null) {
      await archiveQuote(q.id);
      count++;
    }
  }
  return count;
}

export async function softDeleteQuotesByJobId(jobId: string): Promise<number> {
  const linkedQuotes = await storage.getQuotesByJobId(jobId);
  let count = 0;
  for (const q of linkedQuotes) {
    if (q.deletedAt === null) {
      await softDeleteQuote(q.id);
      count++;
    }
  }
  return count;
}

export async function hardDeleteQuotesByJobId(jobId: string): Promise<number> {
  const linkedQuotes = await storage.getQuotesByJobId(jobId);
  for (const q of linkedQuotes) {
    await hardDeleteQuote(q.id);
  }
  return linkedQuotes.length;
}

export async function handleEstimateDeleteCascade(
  jobId: string,
  cascadeAction: QuoteCascadeAction
): Promise<{ quotesAffected: number }> {
  let quotesAffected = 0;

  switch (cascadeAction) {
    case "archive":
      quotesAffected = await archiveQuotesByJobId(jobId);
      break;
    case "delete":
      quotesAffected = await hardDeleteQuotesByJobId(jobId);
      break;
    case "keep":
      break;
  }

  if (cascadeAction !== "keep") {
    await storage.createAuditLog({
      entityType: "job",
      entityId: jobId,
      action: "estimate_delete_cascade",
      metadataJson: { cascadeAction, quotesAffected },
    });
  }

  return { quotesAffected };
}

export async function handleEstimateArchiveCascade(
  jobId: string,
  cascadeAction: "archive" | "keep"
): Promise<{ quotesAffected: number }> {
  let quotesAffected = 0;

  if (cascadeAction === "archive") {
    quotesAffected = await archiveQuotesByJobId(jobId);
  }

  await storage.createAuditLog({
    entityType: "job",
    entityId: jobId,
    action: "estimate_archive_cascade",
    metadataJson: { cascadeAction, quotesAffected },
  });

  return { quotesAffected };
}

export async function enrichQuotesWithOrphanState(quotes: Quote[]): Promise<EnrichedQuote[]> {
  const jobIds = Array.from(new Set(quotes.map(q => q.sourceJobId).filter(Boolean))) as string[];

  const existingJobIds = new Set<string>();
  for (const jobId of jobIds) {
    const job = await storage.getJob(jobId);
    if (job) existingJobIds.add(jobId);
  }

  return quotes.map(q => ({
    ...q,
    isOrphaned: q.sourceJobId ? !existingJobIds.has(q.sourceJobId) : false,
    linkedEstimateExists: q.sourceJobId ? existingJobIds.has(q.sourceJobId) : false,
  }));
}

export async function clearAllQuotes(): Promise<number> {
  const count = await storage.deleteAllQuotesAndRevisions();
  if (count > 0) {
    await storage.createAuditLog({
      entityType: "system",
      entityId: "dev-cleanup",
      action: "clear_all_quotes",
      metadataJson: { deletedCount: count },
    });
  }
  return count;
}
