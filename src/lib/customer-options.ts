import type { Customer } from "./types";
import { normalizeText } from "./format";
export type CustomerOption = Pick<Customer,"id"|"name"|"phone"|"email">;
export function customerOptions(customers: readonly Customer[], query = ""): CustomerOption[] {
  // The store prepends newly registered customers; edits preserve their position.
  const terms = normalizeText(query.trim()).split(/\s+/).filter(Boolean);
  return customers.filter(c => terms.every(term => normalizeText(c.name).includes(term)))
    .slice(0, terms.length ? 30 : 5)
    .map(c => ({ id:c.id, name:c.name, phone:c.phone || "", email:c.email || "" }));
}
