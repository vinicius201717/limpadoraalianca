import { z } from "zod";
import type { SessionUser, UserRole } from "./types";

export function canUseWhatsApp(role: UserRole) {
  return ["OWNER", "GERENTE", "SUPERVISOR_OBRA", "ALMOXARIFADO"].includes(role);
}
export function canManageWhatsAppOperations(role: UserRole) {
  return role === "OWNER" || role === "GERENTE" || role === "SUPERVISOR_OBRA";
}
export function canManageWhatsAppFinance(user: Pick<SessionUser, "role" | "canViewFinancials">) {
  return user.role === "OWNER" || user.role === "FINANCEIRO" || (user.role === "GERENTE" && user.canViewFinancials === true);
}
export const assistantIntentSchema = z.object({
  action: z.enum(["CLARIFY", "DIARY", "CREATE_CHECKLIST", "ASSIGN_CHECKLIST", "TRANSFER_EMPLOYEE", "WARN_EMPLOYEE", "FILE_RECEIPT", "REPORT"]),
  serviceOrderId: z.string().max(160).nullable(),
  destinationOrderId: z.string().max(160).nullable(),
  employeeId: z.string().max(160).nullable(),
  checklistItemId: z.string().max(160).nullable(),
  paymentId: z.string().max(160).nullable(),
  title: z.string().max(200),
  details: z.string().max(6000),
  question: z.string().max(1000),
  amount: z.number().positive().max(100000000).nullable(),
  financialDirection: z.enum(["ARCHIVE", "EXPENSE", "PAYMENT"]).nullable(),
  expenseCategory: z.enum(["GASOLINA", "ALMOCO", "MATERIAL_OU_PRODUTO", "OUTROS"]).nullable(),
  paidAt: z.string().max(40).nullable(),
  paymentMethod: z.string().max(100).nullable(),
});
export type AssistantIntent = z.infer<typeof assistantIntentSchema>;
