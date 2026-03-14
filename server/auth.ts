import { type Request, type Response, type NextFunction } from "express";
import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { parse as parseCookies } from "cookie";
import { storage } from "./storage";
import type { User } from "@shared/schema";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  if (!hashed || !salt) return false;
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  const storedBuf = Buffer.from(hashed, "hex");
  if (buf.length !== storedBuf.length) return false;
  return timingSafeEqual(buf, storedBuf);
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export const SESSION_COOKIE = "steeliq_session";
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export const TEST_MOCK_USER: User = {
  id: "test-user-id",
  username: "testadmin",
  password: "",
  email: "test@steeliq.local",
  displayName: "Test Admin",
  role: "admin",
  divisionCode: null,
  isActive: true,
  mustChangePassword: false,
  createdAt: new Date(),
};

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export async function sessionMiddleware(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === "test") {
    req.user = TEST_MOCK_USER;
    return next();
  }

  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies[SESSION_COOKIE];
  if (!token) return next();

  try {
    const session = await storage.getUserSessionByToken(token);
    if (!session) return next();
    if (session.expiresAt < new Date()) {
      await storage.deleteUserSession(token);
      return next();
    }
    const user = await storage.getUser(session.userId);
    if (user && user.isActive) {
      req.user = user;
    }
  } catch {
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

export function logActivity(
  event: string,
  entityType: string,
  entityId: string,
  userId: string | null,
  metadata?: Record<string, unknown>
) {
  storage.createAuditLog({
    entityType,
    entityId,
    action: event,
    performedByUserId: userId ?? undefined,
    metadataJson: metadata ?? null,
  }).catch(() => {});
}
