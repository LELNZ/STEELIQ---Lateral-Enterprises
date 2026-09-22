// server/authorize.ts
//
// Express middleware wrapping shared/permissions.ts. This is what replaces the
// ~26 inline `(user.role !== "admin" && user.role !== "owner")` checks currently
// scattered through server/routes.ts with one central, consistent gate.
//
// Destination in the repo: server/authorize.ts (new file, alongside auth.ts)

import { type Request, type Response, type NextFunction } from "express";
import { can, canSeeFinancials, type Resource, type Action } from "@shared/permissions";

// Use in place of an inline role check:
//   router.get("/api/quotes", requireAuth, requirePermission("estimates", "view"), handler)
export function requirePermission(resource: Resource, action: Action = "view") {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!can(req.user.role, resource, action)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

// Helper for handlers that return pricing/margin data to a mixed set of roles:
// strip the fields a role must never see rather than branching the whole handler.
//   if (!canShowFinancials(req)) { delete payload.marginPercent; delete payload.buyCost; }
export function canShowFinancials(req: Request): boolean {
  return canSeeFinancials(req.user?.role);
}
