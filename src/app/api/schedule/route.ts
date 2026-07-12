import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { canAccessAllServiceOrders, canManageStock } from "@/lib/permissions";
import { canUserAccessOrder, db, getLinkedEmployeeId, upsertScheduleEvent } from "@/lib/store";

const scheduleSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  type: z.enum(["INSPECTION", "SERVICE_ORDER", "MATERIAL_PREPARATION", "EQUIPMENT_RETURN", "WARRANTY_RETURN", "AFTER_SALES", "INTERNAL_TASK"]).optional(),
  serviceOrderId: z.string().optional(),
  inspectionId: z.string().optional(),
  assignedUserId: z.string().optional(),
  assignedEmployeeId: z.string().optional(),
  startsAt: z.string(),
  endsAt: z.string(),
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "DONE", "CANCELED", "DELAYED"]).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
});

function canEditScheduleEvent(role: string, type?: string) {
  if (role === "OWNER" || role === "GERENTE") return true;
  if (role === "ALMOXARIFADO") return type === "MATERIAL_PREPARATION" || type === "EQUIPMENT_RETURN";
  return false;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const linkedEmployeeId = getLinkedEmployeeId(auth.user);
  const events = db.scheduleEvents.filter((event) => {
    if (canAccessAllServiceOrders(auth.user.role) || canManageStock(auth.user.role)) return true;
    if (event.serviceOrderId) {
      const order = db.serviceOrders.find((item) => item.id === event.serviceOrderId);
      return Boolean(order && canUserAccessOrder(auth.user, order));
    }
    return event.assignedUserId === auth.user.id || event.assignedEmployeeId === linkedEmployeeId;
  });

  return NextResponse.json({ events });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const parsed = scheduleSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  if (!canEditScheduleEvent(auth.user.role, parsed.data.type)) {
    return NextResponse.json({ message: "Perfil sem permissao para criar este evento." }, { status: 403 });
  }

  const event = upsertScheduleEvent(parsed.data, auth.user);
  return NextResponse.json({ event }, { status: 201 });
}
