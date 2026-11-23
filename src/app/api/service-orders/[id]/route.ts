import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";

import { z } from "zod";
import { getServiceOrderTransitionError } from "@/lib/service-order-transitions";
import { requireApiUser } from "@/lib/api-handlers";
import { canAccessAllServiceOrders } from "@/lib/permissions";
import { authorizeServiceOrderAccess, ServiceOrderAuthorizationError } from "@/lib/service-order-access";
import { db, flushDatabasePersistence, recordAuditLog, sanitizeServiceOrderForRole } from "@/lib/store";

function accessErrorResponse(error: ServiceOrderAuthorizationError) {
  return NextResponse.json({ message: error.message }, { status: error.status });
}

async function GETHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

async function PATCHHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canAccessAllServiceOrders(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para editar ordens de servico." }, { status: 403 });
  }

  const { id } = await context.params;
  const serviceOrder = db.serviceOrders.find((item) => item.id === id);
  if (!serviceOrder) return NextResponse.json({ message: "OS nao encontrada." }, { status: 404 });

  const parsed = z.object({
    title: z.string().trim().min(3).max(200).optional(), description: z.string().max(10000).optional(), address: z.string().trim().min(5).max(1000).optional(),
    internalNotes: z.string().max(10000).optional(), clientNotes: z.string().max(10000).optional(), clientAccessEnabled: z.boolean().optional(),
  }).strict().safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Dados inválidos. Use as ações específicas para status, equipe, agenda e financeiro." }, { status: 400 });
  const payload = parsed.data;

  const oldValueJson = { ...serviceOrder };
  Object.assign(serviceOrder, payload);
  recordAuditLog({
    userId: auth.user.id,
    action: "UPDATE_SERVICE_ORDER",
    entity: "ServiceOrder",
    entityId: serviceOrder.id,
    oldValueJson,
    newValueJson: serviceOrder,
  });
  await flushDatabasePersistence();

  return NextResponse.json({ serviceOrder: sanitizeServiceOrderForRole(auth.user, serviceOrder) });
}

async function DELETEHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canAccessAllServiceOrders(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para cancelar ordens de servico." }, { status: 403 });
  }

  const { id } = await context.params;
  const serviceOrder = db.serviceOrders.find((item) => item.id === id);
  if (!serviceOrder) return NextResponse.json({ message: "OS nao encontrada." }, { status: 404 });

  const transitionError = getServiceOrderTransitionError(serviceOrder, "CANCELED", db);
  if (transitionError) return NextResponse.json({ message: transitionError }, { status: 409 });
  serviceOrder.status = "CANCELED";
  recordAuditLog({
    userId: auth.user.id,
    action: "CANCEL_SERVICE_ORDER",
    entity: "ServiceOrder",
    entityId: serviceOrder.id,
    newValueJson: { status: serviceOrder.status },
  });
  await flushDatabasePersistence();

  return NextResponse.json({ ok: true, serviceOrder: sanitizeServiceOrderForRole(auth.user, serviceOrder) });
}

export const GET = withDatabase(GETHandler);
export const PATCH = withDatabase(PATCHHandler);
export const DELETE = withDatabase(DELETEHandler);
