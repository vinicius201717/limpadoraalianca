import { z } from "zod";
import { dateTime } from "./commercial-schema";
import { db } from "./store";
export const scheduleSchema = z.object({
  title: z.string().trim().min(2).max(200), description: z.string().max(4000).optional(),
  type: z.enum(["INSPECTION", "SERVICE_ORDER", "MATERIAL_PREPARATION", "EQUIPMENT_RETURN", "WARRANTY_RETURN", "AFTER_SALES", "INTERNAL_TASK"]).optional(),
  serviceOrderId: z.string().optional(), inspectionId: z.string().optional(), assignedUserId: z.string().optional(), assignedEmployeeId: z.string().optional(),
  startsAt: dateTime, endsAt: dateTime,
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "DONE", "CANCELED", "DELAYED"]).optional(), priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
}).strict().refine((item) => Date.parse(item.endsAt) >= Date.parse(item.startsAt), "O fim não pode anteceder o início.");
export function scheduleReferenceError(input: z.infer<typeof scheduleSchema>) {
  if (input.serviceOrderId && !db.serviceOrders.some((item) => item.id === input.serviceOrderId)) return "OS não encontrada.";
  if (input.inspectionId && !db.inspections.some((item) => item.id === input.inspectionId)) return "Vistoria não encontrada.";
  if (input.assignedUserId && !db.users.some((item) => item.id === input.assignedUserId && item.isActive)) return "Usuário não encontrado ou inativo.";
  if (input.assignedEmployeeId && !db.employees.some((item) => item.id === input.assignedEmployeeId && item.status === "ACTIVE")) return "Colaborador não encontrado ou inativo.";
  return null;
}
