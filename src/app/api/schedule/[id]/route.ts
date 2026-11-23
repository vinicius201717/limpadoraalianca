import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";

import { scheduleSchema, scheduleReferenceError } from "@/lib/schedule-schema";
import { requireApiUser } from "@/lib/api-handlers";
import { canAccessAllServiceOrders, canManageStock } from "@/lib/permissions";
import { canUserAccessOrder, db, getLinkedEmployeeId, upsertScheduleEvent } from "@/lib/store";

function canEditEvent(role: string, type?: string) {
  if (role === "OWNER" || role === "GERENTE") return true;
  if (role === "ALMOXARIFADO") return type === "MATERIAL_PREPARATION" || type === "EQUIPMENT_RETURN";
  return false;
}

async function GETHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const event = db.scheduleEvents.find((item) => item.id === id);
  if (!event) return NextResponse.json({ message: "Evento nao encontrado." }, { status: 404 });
  if (!canAccessAllServiceOrders(auth.user.role) && !canManageStock(auth.user.role) && event.serviceOrderId) {
    const order = db.serviceOrders.find((item) => item.id === event.serviceOrderId);
    if (!order || !canUserAccessOrder(auth.user, order)) {
      return NextResponse.json({ message: "Perfil sem permissao para ver este evento." }, { status: 403 });
    }
  }

  if (!canAccessAllServiceOrders(auth.user.role) && !canManageStock(auth.user.role) && !event.serviceOrderId && event.assignedUserId !== auth.user.id && !(getLinkedEmployeeId(auth.user) && event.assignedEmployeeId === getLinkedEmployeeId(auth.user))) return NextResponse.json({ message: "Acesso restrito." }, { status: 403 });
  return NextResponse.json({ event });
}

async function PATCHHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const current = db.scheduleEvents.find((item) => item.id === id);
  if (!current) return NextResponse.json({ message: "Evento nao encontrado." }, { status: 404 });
  if (!canEditEvent(auth.user.role, current.type)) {
    return NextResponse.json({ message: "Perfil sem permissao para editar este evento." }, { status: 403 });
  }

  const allowed = Object.fromEntries(Object.keys(scheduleSchema.shape).filter((key) => key in current).map((key) => [key, current[key as keyof typeof current]]));
  const parsed = scheduleSchema.safeParse({ ...allowed, ...(await request.json()) });
  if (!parsed.success) return NextResponse.json({ message: "Dados de agenda inválidos." }, { status: 400 });
  if (!canEditEvent(auth.user.role, parsed.data.type)) return NextResponse.json({ message: "Acesso restrito." }, { status: 403 });
  const referenceError = scheduleReferenceError(parsed.data);
  if (referenceError) return NextResponse.json({ message: referenceError }, { status: 400 });
  const event = upsertScheduleEvent({ ...parsed.data, id }, auth.user);
  return NextResponse.json({ event });
}

export const GET = withDatabase(GETHandler);
export const PATCH = withDatabase(PATCHHandler);
