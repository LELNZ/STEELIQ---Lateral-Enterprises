// WARNING: This test calls POST /api/dev/clear-quotes which deletes ALL quotes.
// Requires: ENABLE_DESTRUCTIVE_DEV_TOOLS=true environment variable.
// Run with: ENABLE_DESTRUCTIVE_DEV_TOOLS=true npx tsx tests/lifecycle-regression.ts
import { pool } from "../server/storage";

const BASE = "http://localhost:5000";

async function api(method: string, path: string, body?: any) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

function makeSnapshot() {
  return {
    items: [],
    totalsBreakdown: { itemsSubtotal: 1000, installationTotal: 200, deliveryTotal: 100, subtotalExclGst: 1300, gstAmount: 195, totalInclGst: 1495 },
    totals: { cost: 500, sell: 1000, grossProfit: 500, grossMargin: 50, gpPerHour: 100, totalLabourHours: 5 },
    customer: "Test", divisionCode: "LJ", lineItems: [], assemblies: [], operations: [],
  };
}

async function createJobAndQuote(name: string) {
  const job = await api("POST", "/api/jobs", { name, address: "Test St" });
  const quoteRes = await api("POST", "/api/quotes", {
    snapshot: makeSnapshot(),
    sourceJobId: job.id,
    customer: name,
    divisionCode: "LJ",
    mode: "revision",
  });
  return { job, quote: quoteRes.quote };
}

async function getQuoteFromApi(quoteId: string) {
  const quotes = await api("GET", "/api/quotes");
  return quotes.find((q: any) => q.id === quoteId);
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  FAIL: ${msg}`);
    failed++;
  }
}

async function test1_archiveEstimateArchiveQuotes() {
  console.log("\nTest 1: Archive estimate + archive quotes");
  const { job, quote } = await createJobAndQuote("Archive-Archive Test");

  await api("PATCH", `/api/jobs/${job.id}/archive`, { quoteCascade: "archive" });

  const archivedJobs = await api("GET", "/api/jobs?scope=archived");
  const foundJob = archivedJobs.find((j: any) => j.id === job.id);
  assert(!!foundJob, "Archived estimate appears in archived scope");
  assert(!!foundJob?.archivedAt, "Archived estimate has archivedAt timestamp");

  const activeJobs = await api("GET", "/api/jobs");
  const notInActive = !activeJobs.find((j: any) => j.id === job.id);
  assert(notInActive, "Archived estimate does NOT appear in active scope");

  const q = await getQuoteFromApi(quote.id);
  assert(q?.status === "archived", "Linked quote status is archived");
  assert(!!q?.archivedAt, "Linked quote has archivedAt timestamp");
  assert(q?.isOrphaned === false, "Linked quote is NOT orphaned (estimate still exists)");
  assert(q?.linkedEstimateExists === true, "linkedEstimateExists is true");

  await api("DELETE", `/api/jobs/${job.id}`, { quoteCascade: "delete", confirmPermanent: true });
}

async function test2_deleteEstimateArchiveQuotes() {
  console.log("\nTest 2: Delete estimate + archive quotes");
  const { job, quote } = await createJobAndQuote("Delete-Archive Test");

  await api("DELETE", `/api/jobs/${job.id}`, { quoteCascade: "archive" });

  const activeJobs = await api("GET", "/api/jobs");
  const archivedJobs = await api("GET", "/api/jobs?scope=archived");
  assert(!activeJobs.find((j: any) => j.id === job.id), "Deleted estimate NOT in active scope");
  assert(!archivedJobs.find((j: any) => j.id === job.id), "Deleted estimate NOT in archived scope");

  const q = await getQuoteFromApi(quote.id);
  assert(q?.status === "archived", "Linked quote status is archived");
  assert(!!q?.archivedAt, "Linked quote has archivedAt timestamp");
  assert(q?.isOrphaned === true, "Linked quote IS orphaned (estimate deleted)");
  assert(q?.linkedEstimateExists === false, "linkedEstimateExists is false");

  await api("POST", "/api/dev/clear-quotes");
}

async function test3_deleteEstimateKeepQuotes() {
  console.log("\nTest 3: Delete estimate + keep quotes");
  const { job, quote } = await createJobAndQuote("Delete-Keep Test");

  await api("DELETE", `/api/jobs/${job.id}`, { quoteCascade: "keep" });

  const q = await getQuoteFromApi(quote.id);
  assert(q?.status === "draft", "Linked quote keeps prior status (draft)");
  assert(!q?.archivedAt, "Linked quote NOT archived");
  assert(q?.isOrphaned === true, "Linked quote IS orphaned (estimate deleted)");

  await api("POST", "/api/dev/clear-quotes");
}

async function test4_unarchiveEstimate() {
  console.log("\nTest 4: Unarchive estimate");
  const { job, quote } = await createJobAndQuote("Unarchive Test");

  await api("PATCH", `/api/jobs/${job.id}/archive`, { quoteCascade: "archive" });

  let q = await getQuoteFromApi(quote.id);
  assert(q?.status === "archived", "Quote archived after estimate archive");
  assert(q?.isOrphaned === false, "Quote NOT orphaned while estimate archived");

  await api("PATCH", `/api/jobs/${job.id}/unarchive`);

  const activeJobs = await api("GET", "/api/jobs");
  const foundActive = activeJobs.find((j: any) => j.id === job.id);
  assert(!!foundActive, "Unarchived estimate returns to active scope");
  assert(!foundActive?.archivedAt, "Unarchived estimate has no archivedAt");

  q = await getQuoteFromApi(quote.id);
  assert(q?.status === "archived", "Quote status unchanged after unarchive (still archived)");
  assert(q?.isOrphaned === false, "Quote still NOT orphaned after unarchive");

  await api("DELETE", `/api/jobs/${job.id}`, { quoteCascade: "delete", confirmPermanent: true });
}

async function test5_defensiveGuards() {
  console.log("\nTest 5: Defensive guards");
  const { job } = await createJobAndQuote("Guard Test");

  await api("PATCH", `/api/jobs/${job.id}/archive`, { quoteCascade: "keep" });

  let error = false;
  try {
    await api("PATCH", `/api/jobs/${job.id}/archive`, { quoteCascade: "keep" });
  } catch (e: any) {
    error = true;
    assert(e.message.includes("400"), "Cannot archive already-archived job (400 error)");
  }
  assert(error, "Archiving already-archived job throws error");

  error = false;
  try {
    await api("PATCH", `/api/jobs/${job.id}/unarchive`);
  } catch {
    error = true;
  }
  assert(!error, "Unarchiving archived job succeeds");

  error = false;
  try {
    await api("PATCH", `/api/jobs/${job.id}/unarchive`);
  } catch (e: any) {
    error = true;
    assert(e.message.includes("400"), "Cannot unarchive non-archived job (400 error)");
  }
  assert(error, "Unarchiving non-archived job throws error");

  await api("DELETE", `/api/jobs/${job.id}`, { quoteCascade: "delete", confirmPermanent: true });
}

async function test6_inputValidation() {
  console.log("\nTest 6: Input validation");
  const { job } = await createJobAndQuote("Validation Test");

  let error = false;
  try {
    await api("PATCH", `/api/jobs/${job.id}/archive`, { quoteCascade: "invalid_value" });
  } catch (e: any) {
    error = true;
    assert(e.message.includes("400"), "Invalid archive cascade value returns 400");
  }
  assert(error, "Invalid archive cascade value is rejected");

  error = false;
  try {
    await api("DELETE", `/api/jobs/nonexistent-id-12345`, { quoteCascade: "keep" });
  } catch (e: any) {
    error = true;
    assert(e.message.includes("404"), "Deleting non-existent job returns 404");
  }
  assert(error, "Deleting non-existent job throws error");

  error = false;
  try {
    await api("PATCH", "/api/jobs/nonexistent-id-12345/archive", { quoteCascade: "archive" });
  } catch (e: any) {
    error = true;
    assert(e.message.includes("404"), "Archiving non-existent job returns 404");
  }
  assert(error, "Archiving non-existent job throws error");

  await api("DELETE", `/api/jobs/${job.id}`, { quoteCascade: "delete", confirmPermanent: true });
}

async function main() {
  console.log("=== Lifecycle Regression Tests ===");

  try {
    await test1_archiveEstimateArchiveQuotes();
    await test2_deleteEstimateArchiveQuotes();
    await test3_deleteEstimateKeepQuotes();
    await test4_unarchiveEstimate();
    await test5_defensiveGuards();
    await test6_inputValidation();
  } catch (e) {
    console.error("UNEXPECTED ERROR:", e);
    failed++;
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main();
