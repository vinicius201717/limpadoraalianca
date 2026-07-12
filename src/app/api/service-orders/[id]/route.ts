import { NextResponse, type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/api-handlers";
import { canAccessAllServiceOrders } from "@/lib/permissions";
import { authorizeServiceOrderAccess, ServiceOrderAuthorizationError } from "@/lib/service-order-access";
import { db, recordAuditLog, sanitizeServiceOrderForRole } from "@/lib/store";

function accessErrorResponse(error: ServiceOrderAuthorizationError) {
  return NextResponse.json({ message: error.message }, { status: error.status });
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  try {
    const access = authorizeServiceOrderAccess(auth.user, id, "read");
    return NextResponse.json({ serviceOrder: access.sanitizedOrder });
  } catch (error) {
    if (error instanceof ServiceOrderAuthorizationError) return accessErrorResponse(error);
    throw error;
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canAccessAllServiceOrders(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para editar ordens de servico." }, { status: 403 });
  }

  const { id } = await context.params;
  const serviceOrder = db.serviceOrders.find((item) => item.id === id);
  if (!serviceOrder) return NextResponse.json({ message: "OS nao encontrada." }, { status: 404 });

  const oldValueJson = { ...serviceOrder };
  Object.assign(serviceOrder, await request.json());
  recordAuditLog({
    userId: auth.user.id,
    action: "UPDATE_SERVICE_ORDER",
    entity: "ServiceOrder",
    entityId: serviceOrder.id,
    oldValueJson,
    newValueJson: serviceOrder,
  });

  return NextResponse.json({ serviceOrder: sanitizeServiceOrderForRole(auth.user.role, serviceOrder) });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canAccessAllServiceOrders(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para cancelar ordens de servico." }, { status: 403 });
  }

  const { id } = await context.params;
  const serviceOrder = db.serviceOrders.find((item) => item.id === id);
  if (!serviceOrder) return NextResponse.json({ message: "OS nao encontrada." }, { status: 404 });

  serviceOrder.status = "CANCELED";
  recordAuditLog({
    userId: auth.user.id,
    action: "CANCEL_SERVICE_ORDER",
    entity: "ServiceOrder",
    entityId: serviceOrder.id,
    newValueJson: { status: serviceOrder.status },
  });

  return NextResponse.json({ ok: true, serviceOrder: sanitizeServiceOrderForRole(auth.user.role, serviceOrder) });
}
