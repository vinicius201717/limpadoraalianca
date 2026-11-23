import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";
import { scheduleSchema, scheduleReferenceError } from "@/lib/schedule-schema";

import { requireApiUser } from "@/lib/api-handlers";
import { canAccessAllServiceOrders, canManageStock } from "@/lib/permissions";
import { canUserAccessOrder, db, getLinkedEmployeeId, upsertScheduleEvent } from "@/lib/store";

function canEditScheduleEvent(role: string, type?: string) {
  if (role === "OWNER" || role === "GERENTE") return true;
  if (role === "ALMOXARIFADO") return type === "MATERIAL_PREPARATION" || type === "EQUIPMENT_RETURN";
  return false;
}

async function GETHandler(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const linkedEmployeeId = getLinkedEmployeeId(auth.user);
  const events = db.scheduleEvents.filter((event) => {
    if (canAccessAllServiceOrders(auth.user.role) || canManageStock(auth.user.role)) return true;
    if (event.serviceOrderId) {
      const order = db.serviceOrders.find((item) => item.id === event.serviceOrderId);
      return Boolean(order && canUserAccessOrder(auth.user, order));
    }
    return event.assignedUserId === auth.user.id || Boolean(linkedEmployeeId && event.assignedEmployeeId === linkedEmployeeId);
  });

  return NextResponse.json({ events });
}

async function POSTHandler(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const parsed = scheduleSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  if (!canEditScheduleEvent(auth.user.role, parsed.data.type)) {
    return NextResponse.json({ message: "Perfil sem permissao para criar este evento." }, { status: 403 });
  }

  const referenceError = scheduleReferenceError(parsed.data);
  if (referenceError) return NextResponse.json({ message: referenceError }, { status: 400 });
  const event = upsertScheduleEvent(parsed.data, auth.user);
  return NextResponse.json({ event }, { status: 201 });
}

export const GET = withDatabase(GETHandler);
export const POST = withDatabase(POSTHandler);
