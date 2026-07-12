import { NextResponse, type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/api-handlers";
import { canAccessAllServiceOrders, canManageStock } from "@/lib/permissions";
import { canUserAccessOrder, db, upsertScheduleEvent } from "@/lib/store";

function canEditEvent(role: string, type?: string) {
  if (role === "OWNER" || role === "GERENTE") return true;
  if (role === "ALMOXARIFADO") return type === "MATERIAL_PREPARATION" || type === "EQUIPMENT_RETURN";
  return false;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

  return NextResponse.json({ event });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const current = db.scheduleEvents.find((item) => item.id === id);
  if (!current) return NextResponse.json({ message: "Evento nao encontrado." }, { status: 404 });
  if (!canEditEvent(auth.user.role, current.type)) {
    return NextResponse.json({ message: "Perfil sem permissao para editar este evento." }, { status: 403 });
  }

  const event = upsertScheduleEvent({ ...current, ...(await request.json()), id }, auth.user);
  return NextResponse.json({ event });
}
