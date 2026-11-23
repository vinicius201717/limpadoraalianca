import { canCreateCustomer, canCreateInspection, canCreateLead, canCreateQuote, canViewCustomers, canViewInspections, canViewLeads, canViewQuotes } from "./permissions";
import type { CommercialModule } from "./commercial-schema";
import type { UserRole } from "./types";

export function canReadCommercial(module: CommercialModule, role: UserRole) {
  return { clientes: canViewCustomers, leads: canViewLeads, vistorias: canViewInspections, orcamentos: canViewQuotes, garantias: (value: UserRole) => ["OWNER", "GERENTE", "COMERCIAL"].includes(value) }[module](role);
}
export function canWriteCommercial(module: CommercialModule, role: UserRole) {
  return { clientes: canCreateCustomer, leads: canCreateLead, vistorias: canCreateInspection, orcamentos: canCreateQuote, garantias: (value: UserRole) => ["OWNER", "GERENTE", "COMERCIAL"].includes(value) }[module](role);
}
