import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { canPrepareServiceMaterials, canRequestServiceMaterials, canViewServiceOrderFinancials } from "@/lib/permissions";
import { authorizeServiceOrderAccess, ServiceOrderAuthorizationError } from "@/lib/service-order-access";
import { createMaterialRequest, db, flushDatabasePersistence, recordAuditLog } from "@/lib/store";
import { InventoryError, isArchivedStockItem, moveMaterialRequest } from "@/lib/inventory-operations";

const requestSchema = z.object({
  reason: z.string().min(3),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  items: z.array(z.object({ materialId: z.string(), quantity: z.coerce.number().positive(), notes: z.string().optional() })).min(1),
});

const requestPatchSchema = z.object({
  id: z.string(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "SEPARATED", "DELIVERED", "CANCELED"]),
});

async function GETHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

async function POSTHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

  const order = db.serviceOrders.find((item) => item.id === id);
  if (!order || ["DONE", "DELIVERED", "CANCELED"].includes(order.status)) return NextResponse.json({ message: "OS encerrada nao recebe novas solicitacoes." }, { status: 409 });
  if (parsed.data.items.some((item) => !db.materials.some((material) => material.id === item.materialId && !isArchivedStockItem(material)))) return NextResponse.json({ message: "Solicitacao contem material inexistente ou arquivado." }, { status: 400 });

  const result = createMaterialRequest({
    serviceOrderId: id,
    requestedByUserId: auth.user.id,
    reason: parsed.data.reason,
    priority: parsed.data.priority,
    items: parsed.data.items,
  });
  await flushDatabasePersistence();
  return NextResponse.json(result, { status: 201 });
}

async function PATCHHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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
  let allocations;
  try {
    allocations = moveMaterialRequest(db, materialRequest, parsed.data.status, auth.user.id);
  } catch (error) {
    if (error instanceof InventoryError) return NextResponse.json({ message: error.message }, { status: 409 });
    throw error;
  }
  recordAuditLog({
    userId: auth.user.id,
    action: "UPDATE_MATERIAL_REQUEST_STATUS",
    entity: "ServiceMaterialRequest",
    entityId: materialRequest.id,
    oldValueJson,
    newValueJson: { request: materialRequest, allocations },
  });
  await flushDatabasePersistence();

  return NextResponse.json({ request: materialRequest, allocations, materials: db.materials.filter((item) => allocations.some((allocation) => allocation.materialId === item.id)).map(m=>({...m,unitCost:canViewServiceOrderFinancials(auth.user)?m.unitCost:0})) });
}

export const GET = withDatabase(GETHandler);
export const POST = withDatabase(POSTHandler);
export const PATCH = withDatabase(PATCHHandler);
