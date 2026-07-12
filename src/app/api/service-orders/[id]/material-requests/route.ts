import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { canPrepareServiceMaterials, canRequestServiceMaterials } from "@/lib/permissions";
import { authorizeServiceOrderAccess, ServiceOrderAuthorizationError } from "@/lib/service-order-access";
import { createMaterialRequest, db, queueDatabasePersist, recordAuditLog } from "@/lib/store";

const requestSchema = z.object({
  reason: z.string().min(3),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  items: z.array(z.object({ materialId: z.string(), quantity: z.coerce.number().positive(), notes: z.string().optional() })).min(1),
});

const requestPatchSchema = z.object({
  id: z.string(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "SEPARATED", "DELIVERED", "CANCELED"]),
});

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  try {
    authorizeServiceOrderAccess(auth.user, id, "materials");
  } catch (error) {
    if (error instanceof ServiceOrderAuthorizationError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    throw error;
  }

  const requests = db.materialRequests
    .filter((item) => item.serviceOrderId === id)
    .map((item) => ({ ...item, items: db.materialRequestItems.filter((requestItem) => requestItem.requestId === item.id) }));
  return NextResponse.json({ requests });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  try {
    authorizeServiceOrderAccess(auth.user, id, "materials");
  } catch (error) {
    if (error instanceof ServiceOrderAuthorizationError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    throw error;
  }
  if (!canRequestServiceMaterials(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para solicitar material extra." }, { status: 403 });
  }

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const result = createMaterialRequest({
    serviceOrderId: id,
    requestedByUserId: auth.user.id,
    reason: parsed.data.reason,
    priority: parsed.data.priority,
    items: parsed.data.items,
  });
  return NextResponse.json(result, { status: 201 });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  try {
    authorizeServiceOrderAccess(auth.user, id, "materials");
  } catch (error) {
    if (error instanceof ServiceOrderAuthorizationError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    throw error;
  }
  if (!canPrepareServiceMaterials(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para atualizar solicitacao de material." }, { status: 403 });
  }

  const parsed = requestPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const materialRequest = db.materialRequests.find((item) => item.id === parsed.data.id && item.serviceOrderId === id);
  if (!materialRequest) return NextResponse.json({ message: "Solicitacao nao encontrada." }, { status: 404 });

  const oldValueJson = { ...materialRequest };
  materialRequest.status = parsed.data.status;
  materialRequest.updatedAt = new Date().toISOString();
  recordAuditLog({
    userId: auth.user.id,
    action: "UPDATE_MATERIAL_REQUEST_STATUS",
    entity: "ServiceMaterialRequest",
    entityId: materialRequest.id,
    oldValueJson,
    newValueJson: materialRequest,
  });
  queueDatabasePersist();

  return NextResponse.json({ request: materialRequest });
}
