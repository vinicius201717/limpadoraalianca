import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { canUpdateServiceOrderStatus } from "@/lib/permissions";
import { authorizeServiceOrderAccess, ServiceOrderAuthorizationError } from "@/lib/service-order-access";
import { db, flushDatabasePersistence, recordAuditLog, sanitizeServiceOrderForRole } from "@/lib/store";
import { getServiceOrderTransitionError } from "@/lib/service-order-transitions";

const serviceOrderStatusSchema = z.object({
  status: z.enum(["SCHEDULED", "PREPARING", "IN_PROGRESS", "PAUSED", "WAITING_CUSTOMER", "DONE", "DELIVERED", "CANCELED"]),
  reason: z.string().optional(),
});

async function PATCHHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canUpdateServiceOrderStatus(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para atualizar status da OS." }, { status: 403 });
  }

  const { id } = await context.params;
  let serviceOrder;
  try {
    serviceOrder = authorizeServiceOrderAccess(auth.user, id, "status").order;
  } catch (error) {
    if (error instanceof ServiceOrderAuthorizationError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    throw error;
  }

  const parsed = serviceOrderStatusSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const transitionError = getServiceOrderTransitionError(serviceOrder, parsed.data.status, db);
  if (transitionError) return NextResponse.json({ message: transitionError }, { status: 409 });
  if (parsed.data.status === "CANCELED" && !parsed.data.reason?.trim()) return NextResponse.json({ message: "Informe o motivo do cancelamento." }, { status: 400 });
  const oldValueJson = { status: serviceOrder.status };
  serviceOrder.status = parsed.data.status;
  if (parsed.data.reason?.trim()) {
    serviceOrder.internalNotes = [serviceOrder.internalNotes, `Atualizacao de status: ${parsed.data.reason.trim()}`]
      .filter(Boolean)
      .join("\n");
  }

  recordAuditLog({
    userId: auth.user.id,
    action: "UPDATE_SERVICE_ORDER_STATUS",
    entity: "ServiceOrder",
    entityId: serviceOrder.id,
    oldValueJson,
    newValueJson: { status: serviceOrder.status, reason: parsed.data.reason },
  });
  await flushDatabasePersistence();

  return NextResponse.json({ serviceOrder: sanitizeServiceOrderForRole(auth.user, serviceOrder) });
}

export const PATCH = withDatabase(PATCHHandler);
