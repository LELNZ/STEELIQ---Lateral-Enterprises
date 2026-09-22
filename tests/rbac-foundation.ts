/**
 * RBAC foundation regression tests.
 *
 * Run: npx tsx tests/rbac-foundation.ts
 *
 * This suite deliberately does not call registerRoutes(): doing so runs startup
 * seeds. HTTP checks mount only the real permission middleware followed by a
 * sentinel, so no production handler or database mutation can run.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import express from "express";
import { parse as parseCookies } from "cookie";
import { USER_ROLES } from "../shared/schema";
import {
  RESOURCES,
  ROLES,
  can,
  normalizeRole,
  type Action,
  type Resource,
} from "../shared/permissions";
import { requirePermission } from "../server/authorize";
import {
  SESSION_COOKIE,
  SESSION_DURATION_MS,
  TEST_MOCK_USER,
  generateSessionToken,
  hashPassword,
  verifyPassword,
} from "../server/auth";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

async function testAsync(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

const actions: Action[] = ["view", "edit", "full"];
const grants: Record<string, Partial<Record<Resource, Action>>> = {
  owner: Object.fromEntries(RESOURCES.map((resource) => [resource, "full"])),
  admin: Object.fromEntries(RESOURCES.map((resource) => [resource, "full"])),
  qs: {
    estimates: "full",
    invoices: "view",
    customers_projects: "edit",
    jobs_production: "view",
    library_pricing: "view",
    site_capture: "view",
  },
  project_manager: {
    estimates: "view",
    invoices: "view",
    customers_projects: "full",
    jobs_production: "full",
    site_capture: "view",
  },
  workshop_manager: { jobs_production: "full", site_capture: "view" },
  site_supervisor: { jobs_production: "edit", site_capture: "edit" },
  client: { estimates: "view", invoices: "view" },
};
const rank: Record<Action, number> = { view: 1, edit: 2, full: 3 };

function expectedCan(role: string | null | undefined, resource: Resource, action: Action) {
  const normalized = role === "estimator" || role === "finance" || role === "production" || role === "viewer"
    ? "qs"
    : ROLES.includes(role as (typeof ROLES)[number])
      ? role!
      : "client";
  const grant = grants[normalized]?.[resource];
  return grant !== undefined && rank[grant] >= rank[action];
}

function invokeMiddleware(role: string | undefined, resource: Resource, action: Action) {
  let status = 200;
  let body: unknown;
  let nextCalled = false;
  const req = role === undefined ? {} : { user: { role } };
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
  };
  requirePermission(resource, action)(req as any, res as any, () => {
    nextCalled = true;
  });
  return { status, body, nextCalled };
}

test("permission matrix matches the independent specification for every role/resource/action", () => {
  const roles = [...new Set<string>([...USER_ROLES, ...ROLES, "estimator"])];
  for (const role of roles) {
    for (const resource of RESOURCES) {
      for (const action of actions) {
        assert.equal(
          can(role, resource, action),
          expectedCan(role, resource, action),
          `${role} ${resource}:${action}`,
        );
      }
    }
  }
  assert.equal(normalizeRole(undefined), "client");
  assert.equal(normalizeRole("unrecognised"), "client");
});

test("estimator is exactly equivalent to qs for every resource/action", () => {
  for (const resource of RESOURCES) {
    for (const action of actions) {
      assert.equal(can("estimator", resource, action), can("qs", resource, action));
    }
  }
});

test("requirePermission behavior matches the matrix for all schema roles", () => {
  for (const role of USER_ROLES) {
    for (const resource of RESOURCES) {
      for (const action of actions) {
        const result = invokeMiddleware(role, resource, action);
        const allowed = expectedCan(role, resource, action);
        assert.equal(result.nextCalled, allowed, `${role} ${resource}:${action} next`);
        assert.equal(result.status, allowed ? 200 : 403, `${role} ${resource}:${action} status`);
      }
    }
  }
  const anonymous = invokeMiddleware(undefined, "estimates", "view");
  assert.equal(anonymous.status, 401);
  assert.equal(anonymous.nextCalled, false);
});

const protectedRoutes = [
  ["patch", "/api/settings/system-mode"],
  ["get", "/api/xero/connect"],
  ["get", "/api/settings/xero-status"],
  ["put", "/api/drawing-images/:key"],
  ["post", "/api/drawing-images/check-missing"],
  ["post", "/api/drawing-images/regenerate"],
  ["post", "/api/auth/users"],
  ["patch", "/api/auth/users/:id"],
  ["post", "/api/auth/users/:id/reset-password"],
  ["post", "/api/invoices/:id/reset-xero-link"],
  ["get", "/api/admin/number-sequences"],
  ["patch", "/api/admin/number-sequences/:id"],
  ["post", "/api/admin/cleanup-demo"],
  ["patch", "/api/quotes/:id/demo-flag"],
  ["patch", "/api/op-jobs/:id/demo-flag"],
  ["patch", "/api/jobs/:id/demo-flag"],
  ["patch", "/api/projects/:id/demo-flag"],
  ["patch", "/api/invoices/:id/demo-flag"],
  ["patch", "/api/customers/:id/demo-flag"],
  ["patch", "/api/customer-contacts/:id/demo-flag"],
  ["patch", "/api/laser-estimates/:id/demo-flag"],
  ["get", "/api/admin/governance/summary"],
  ["get", "/api/settings/governance/audit-history"],
  ["post", "/api/admin/governance/archive"],
  ["post", "/api/admin/governance/clear-xero-link/:invoiceId"],
  ["delete", "/api/admin/governance/record/:entityType/:entityId"],
] as const;

const routesSource = await readFile(new URL("../server/routes.ts", import.meta.url), "utf8");

test("all 26 actual privileged route registrations contain the central middleware", () => {
  const sourceLines = routesSource.split("\n");
  for (const [method, path] of protectedRoutes) {
    const prefix = `app.${method}("${path}",`;
    const registration = sourceLines.find((line) => line.trimStart().startsWith(prefix));
    assert.ok(registration, `missing actual registration: ${method.toUpperCase()} ${path}`);
    assert.match(
      registration,
      /requirePermission\(\s*"settings_users"\s*,\s*"full"\s*\)/,
      `missing middleware: ${method.toUpperCase()} ${path}`,
    );
  }
  const attachedCount = (routesSource.match(
    /requirePermission\(\s*"settings_users"\s*,\s*"full"\s*\)/g,
  ) ?? []).length;
  assert.equal(attachedCount, 26, "unexpected privileged-gate attachment count");
});

await testAsync("HTTP gate-only verification: five real route shapes pass owner/admin and deny every other role", async () => {
  const selected = [
    ["patch", "/api/jobs/:id/demo-flag", "/api/jobs/sentinel/demo-flag"],
    ["patch", "/api/laser-estimates/:id/demo-flag", "/api/laser-estimates/sentinel/demo-flag"],
    ["patch", "/api/invoices/:id/demo-flag", "/api/invoices/sentinel/demo-flag"],
    ["patch", "/api/settings/system-mode", "/api/settings/system-mode"],
    ["post", "/api/auth/users", "/api/auth/users"],
  ] as const;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const role = req.header("x-test-role");
    if (role) (req as any).user = { role };
    next();
  });
  for (const [method, pattern] of selected) {
    const sourceRegistration = protectedRoutes.some(([m, p]) => m === method && p === pattern);
    assert.ok(sourceRegistration, `${method} ${pattern} is not in inspected production registrations`);
    (app as any)[method](
      pattern,
      requirePermission("settings_users", "full"),
      (_req: unknown, res: express.Response) => res.status(204).end(),
    );
  }

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    for (const role of USER_ROLES) {
      for (const [method, , path] of selected) {
        const response = await fetch(base + path, {
          method: method.toUpperCase(),
          headers: { "x-test-role": role, "content-type": "application/json" },
          body: method === "get" ? undefined : "{}",
        });
        assert.equal(response.status, role === "owner" || role === "admin" ? 204 : 403, `${role} ${path}`);
      }
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    );
  }
});

function extractFunctionBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `source signature not found: ${signature}`);
  const open = source.indexOf("{", start + signature.length);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = open; index < source.length; index++) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === `"` || char === `'` || char === "`") {
      quote = char;
    } else if (char === "{") {
      depth++;
    } else if (char === "}" && --depth === 0) {
      return source.slice(open + 1, index);
    }
  }
  throw new Error(`unterminated source function: ${signature}`);
}

await testAsync("real estimator login handler verifies password and real session middleware restores user", async () => {
  const authSource = await readFile(new URL("../server/auth.ts", import.meta.url), "utf8");
  const loginBody = extractFunctionBody(
    routesSource,
    `app.post("/api/auth/login", async (req, res) =>`,
  ).replace(/catch\s*\(([^):]+):\s*any\)/g, "catch ($1)");
  const sessionBody = extractFunctionBody(
    authSource,
    "export async function sessionMiddleware(req: Request, res: Response, next: NextFunction)",
  );
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const loginHandler = new AsyncFunction(
    "req",
    "res",
    "bindings",
    `const {
      storage, verifyPassword, generateSessionToken, SESSION_DURATION_MS, SESSION_COOKIE
    } = bindings;
    ${loginBody}`,
  );
  const extractedSessionMiddleware = new AsyncFunction(
    "req", "res", "next", "storage", "parseCookies", "TEST_MOCK_USER", "SESSION_COOKIE", sessionBody,
  );

  const password = "rbac-local-test-password";
  const estimator = {
    id: "memory-estimator",
    username: "memory-estimator",
    password: await hashPassword(password),
    email: null,
    displayName: "Memory Estimator",
    role: "estimator",
    divisionCode: null,
    divisionCodes: null,
    isActive: true,
    mustChangePassword: false,
    createdAt: new Date(),
  };
  const sessions = new Map<string, { userId: string; expiresAt: Date }>();
  const storage = {
    async getUserByUsername(username: string) {
      return username === estimator.username ? estimator : undefined;
    },
    async createUserSession(userId: string, token: string, expiresAt: Date) {
      sessions.set(token, { userId, expiresAt });
    },
    async getUserSessionByToken(token: string) {
      return sessions.get(token);
    },
    async deleteUserSession(token: string) {
      sessions.delete(token);
    },
    async getUser(id: string) {
      return id === estimator.id ? estimator : undefined;
    },
  };
  let responseStatus = 200;
  let responseBody: any;
  const headers: Record<string, string> = {};
  const response = {
    status(code: number) {
      responseStatus = code;
      return this;
    },
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
    json(body: unknown) {
      responseBody = body;
      return this;
    },
  };

  await loginHandler(
    { body: { username: estimator.username, password } },
    response,
    {
      storage,
      verifyPassword,
      generateSessionToken,
      SESSION_DURATION_MS,
      SESSION_COOKIE,
    },
  );
  assert.equal(responseStatus, 200);
  assert.equal(responseBody.role, "estimator");
  assert.equal("password" in responseBody, false);
  assert.match(headers["set-cookie"], new RegExp(`^${SESSION_COOKIE}=`));
  assert.equal(sessions.size, 1);

  const cookie = headers["set-cookie"].split(";")[0];
  const sessionRequest: any = { headers: { cookie } };
  let nextCalled = false;
  const oldNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "rbac-foundation";
  try {
    await extractedSessionMiddleware(
      sessionRequest,
      {},
      () => { nextCalled = true; },
      storage,
      parseCookies,
      TEST_MOCK_USER,
      SESSION_COOKIE,
    );
  } finally {
    if (oldNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldNodeEnv;
  }
  assert.equal(nextCalled, true);
  assert.equal(sessionRequest.user?.id, estimator.id);
  assert.equal(sessionRequest.user?.role, "estimator");
});

console.log(`\nRBAC foundation: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;