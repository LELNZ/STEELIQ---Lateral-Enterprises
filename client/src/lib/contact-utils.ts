import type { CustomerContact } from "@shared/schema";

export function contactDisplayName(contact: Pick<CustomerContact, "firstName" | "lastName">): string {
  const parts = [contact.firstName, contact.lastName].filter(Boolean);
  return parts.join(" ") || "—";
}
