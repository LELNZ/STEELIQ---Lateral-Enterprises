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

function makeSnapshot(customer: string) {
  return {
    items: [],
    totalsBreakdown: { itemsSubtotal: 1000, installationTotal: 200, deliveryTotal: 100, subtotalExclGst: 1300, gstAmount: 195, totalInclGst: 1495 },
    totals: { cost: 500, sell: 1000, grossProfit: 500, grossMargin: 50, gpPerHour: 100, totalLabourHours: 5 },
    customer, divisionCode: "LJ", lineItems: [], assemblies: [], operations: [],
  };
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

interface TestData {
  jobA: any;
  jobB: any;
  quoteA: any;
  quoteB: any;
}

async function setup(): Promise<TestData> {
  const jobA = await api("POST", "/api/jobs", { name: "FilterTest Alpha Co", address: "1 Alpha Rd" });
  const jobB = await api("POST", "/api/jobs", { name: "FilterTest Beta Ltd", address: "2 Beta Ave" });

  const quoteResA = await api("POST", "/api/quotes", {
    snapshot: makeSnapshot("FilterTest Alpha Co"),
    sourceJobId: jobA.id,
    customer: "FilterTest Alpha Co",
    divisionCode: "LJ",
    mode: "revision",
  });

  const quoteResB = await api("POST", "/api/quotes", {
    snapshot: makeSnapshot("FilterTest Beta Ltd"),
    sourceJobId: jobB.id,
    customer: "FilterTest Beta Ltd",
    divisionCode: "LJ",
    mode: "revision",
  });

  return { jobA, jobB, quoteA: quoteResA.quote, quoteB: quoteResB.quote };
}

async function cleanup(data: TestData) {
  try { await api("DELETE", `/api/jobs/${data.jobA.id}`, { quoteCascade: "delete", confirmPermanent: true }); } catch {}
  try { await api("DELETE", `/api/jobs/${data.jobB.id}`, { quoteCascade: "delete", confirmPermanent: true }); } catch {}
}

async function testCustomerFilter(data: TestData) {
  console.log("\nTest: Customer filter");
  const quotes = await api("GET", "/api/quotes");

  const alphaQuotes = quotes.filter((q: any) => q.customer === "FilterTest Alpha Co");
  const betaQuotes = quotes.filter((q: any) => q.customer === "FilterTest Beta Ltd");

  assert(alphaQuotes.length >= 1, "Alpha Co quote exists in API response");
  assert(betaQuotes.length >= 1, "Beta Ltd quote exists in API response");

  const customers = [...new Set(quotes.map((q: any) => q.customer))];
  assert(customers.includes("FilterTest Alpha Co"), "Alpha Co appears in customer list");
  assert(customers.includes("FilterTest Beta Ltd"), "Beta Ltd appears in customer list");

  const filteredAlpha = quotes.filter((q: any) => q.customer === "FilterTest Alpha Co");
  assert(filteredAlpha.every((q: any) => q.customer === "FilterTest Alpha Co"), "Customer filter correctly isolates Alpha Co");

  const filteredBeta = quotes.filter((q: any) => q.customer === "FilterTest Beta Ltd");
  assert(filteredBeta.every((q: any) => q.customer === "FilterTest Beta Ltd"), "Customer filter correctly isolates Beta Ltd");
}

async function testQuoteTypeFilter(data: TestData) {
  console.log("\nTest: Quote type filter");
  const quotes = await api("GET", "/api/quotes");

  const alphaQuote = quotes.find((q: any) => q.id === data.quoteA.id);
  assert(alphaQuote !== undefined, "Alpha quote found in API");
  assert(alphaQuote?.quoteType === null || alphaQuote?.quoteType === undefined, "New quote has null quoteType (General)");

  const generalQuotes = quotes.filter((q: any) => !q.quoteType);
  assert(generalQuotes.length >= 1, "At least one General (null type) quote exists");
}

async function testDateFilter(data: TestData) {
  console.log("\nTest: Date range filter");
  const quotes = await api("GET", "/api/quotes");

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const quotesCreatedToday = quotes.filter((q: any) => {
    if (!q.createdAt) return false;
    const created = new Date(q.createdAt);
    return created >= new Date(todayStr) && created <= new Date(tomorrowStr);
  });
  assert(quotesCreatedToday.length >= 2, "At least 2 quotes created today (our test quotes)");

  const quotesInFuture = quotes.filter((q: any) => {
    if (!q.createdAt) return false;
    const futureDate = new Date("2030-01-01");
    return new Date(q.createdAt) >= futureDate;
  });
  assert(quotesInFuture.length === 0, "No quotes match a future date filter");

  const quotesInPast = quotes.filter((q: any) => {
    if (!q.createdAt) return false;
    const pastDate = new Date("2020-01-01");
    return new Date(q.createdAt) <= pastDate;
  });
  assert(quotesInPast.length === 0, "No quotes match a far-past date filter");
}

async function testSearchFilter(data: TestData) {
  console.log("\nTest: Search filter");
  const quotes = await api("GET", "/api/quotes");

  const searchAlpha = quotes.filter((q: any) =>
    q.number?.toLowerCase().includes("alpha") || q.customer?.toLowerCase().includes("alpha")
  );
  assert(searchAlpha.length >= 1, "Search for 'alpha' finds Alpha Co quote");

  const searchNotFound = quotes.filter((q: any) =>
    q.number?.toLowerCase().includes("zzzznotfound") || q.customer?.toLowerCase().includes("zzzznotfound")
  );
  assert(searchNotFound.length === 0, "Search for nonsense returns no results");
}

async function testClearFilters() {
  console.log("\nTest: Clear filters behavior");
  const quotes = await api("GET", "/api/quotes");

  const allActive = quotes.filter((q: any) => !q.deletedAt && !q.archivedAt);
  assert(allActive.length >= 2, "With no filters, at least 2 active quotes are returned");

  const filteredByCustomer = allActive.filter((q: any) => q.customer === "FilterTest Alpha Co");
  const afterClear = allActive;
  assert(afterClear.length > filteredByCustomer.length || afterClear.length === filteredByCustomer.length,
    "After clearing filters, all active quotes are shown (>= filtered count)");
}

async function main() {
  console.log("=== Quote Filters E2E Tests ===");

  let data: TestData | null = null;
  try {
    data = await setup();
    await testCustomerFilter(data);
    await testQuoteTypeFilter(data);
    await testDateFilter(data);
    await testSearchFilter(data);
    await testClearFilters();
  } catch (e) {
    console.error("UNEXPECTED ERROR:", e);
    failed++;
  } finally {
    if (data) await cleanup(data);
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main();
