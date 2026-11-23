import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { canPrepareServiceMaterials, canRequestServiceMaterials } from "@/lib/permissions";
import { authorizeServiceOrderAccess, ServiceOrderAuthorizationError } from "@/lib/service-order-access";
import { canUserAccessOrder, db, flushDatabasePersistence, queueDatabasePersist, recordAuditLog } from "@/lib/store";
import { normalizeStockStatus } from "@/lib/stock-status";
import type { ServiceOrderEquipment, SessionUser } from "@/lib/types";
import { applyEquipmentMovement, InventoryError, isArchivedStockItem } from "@/lib/inventory-operations";
import { randomUUID } from "node:crypto";

const equipmentRequestSchema = z.object({
  equipmentId: z.string(),
  conditionBefore: z.string().optional().default("Aguardando conferencia do almoxarifado"),
  notes: z.string().optional().default(""),
});

const equipmentPatchSchema = z.object({
  id: z.string(),
  status: z.enum(["REQUESTED", "RESERVED", "DELIVERED", "IN_USE", "RETURNED", "DAMAGED", "LOST", "CANCELED"]),
  conditionBefore: z.string().optional(),
  conditionAfter: z.string().optional(),
  notes: z.string().optional(),
});

function canManageOrderEquipment(user: SessionUser, order: (typeof db.serviceOrders)[number]) {
  return canPrepareServiceMaterials(user.role) || (canRequestServiceMaterials(user.role) && canUserAccessOrder(user, order));
}

async function GETHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  try {
    authorizeServiceOrderAccess(auth.user, id, "equipment");
  } catch (error) {
    if (error instanceof ServiceOrderAuthorizationError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    throw error;
  }

  const equipment = db.serviceOrderEquipment
    .filter((item) => item.serviceOrderId === id)
    .map((item) => ({ ...item, equipment: db.equipment.find((equipmentItem) => equipmentItem.id === item.equipmentId) }));

  return NextResponse.json({ equipment });
}

async function POSTHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const order = db.serviceOrders.find((item) => item.id === id);
  if (!order) return NextResponse.json({ message: "OS nao encontrada." }, { status: 404 });
  if (!canRequestServiceMaterials(auth.user.role) || !canUserAccessOrder(auth.user, order)) {
    return NextResponse.json({ message: "Perfil sem permissao para solicitar equipamento nesta OS." }, { status: 403 });
  }

  const parsed = equipmentRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const stockItem = db.equipment.find((item) => item.id === parsed.data.equipmentId);
  if (!stockItem || isArchivedStockItem(stockItem)) return NextResponse.json({ message: "Equipamento ativo nao encontrado." }, { status: 404 });
  if (["DONE", "DELIVERED", "CANCELED"].includes(order.status)) return NextResponse.json({ message: "OS encerrada nao recebe novos equipamentos." }, { status: 409 });
  if (normalizeStockStatus(stockItem.status) !== "AVAILABLE") {
    return NextResponse.json({ message: "Equipamento nao esta disponivel para solicitacao." }, { status: 400 });
  }
  const alreadyLinked = db.serviceOrderEquipment.some(
    (item) =>
      item.equipmentId === stockItem.id &&
      !["RETURNED", "DAMAGED", "LOST", "CANCELED"].includes(item.status),
  );
  if (alreadyLinked) return NextResponse.json({ message: "Equipamento ja esta solicitado ou reservado." }, { status: 400 });

  const now = new Date().toISOString();
  const serviceEquipment: ServiceOrderEquipment = {
    id: `soequip-${randomUUID()}`,
    serviceOrderId: id,
    equipmentId: stockItem.id,
    status: "REQUESTED",
    reservedAt: now,
    conditionBefore: parsed.data.conditionBefore,
    notes: parsed.data.notes,
    createdAt: now,
    updatedAt: now,
  };
  db.serviceOrderEquipment.unshift(serviceEquipment);
  recordAuditLog({
    userId: auth.user.id,
    action: "REQUEST_SERVICE_ORDER_EQUIPMENT",
    entity: "ServiceOrderEquipment",
    entityId: serviceEquipment.id,
    newValueJson: serviceEquipment,
  });

  await flushDatabasePersistence();

  return NextResponse.json({ equipment: serviceEquipment }, { status: 201 });
}

async function PATCHHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const parsed = equipmentPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const link = db.serviceOrderEquipment.find((item) => item.id === parsed.data.id);
  if (!link) return NextResponse.json({ message: "Equipamento da OS nao encontrado." }, { status: 404 });
  const { id } = await context.params;
  if (link.serviceOrderId !== id) return NextResponse.json({ message: "Equipamento nao pertence a esta OS." }, { status: 404 });
  const order = db.serviceOrders.find((item) => item.id === link.serviceOrderId);
  if (!order) return NextResponse.json({ message: "OS nao encontrada." }, { status: 404 });
  if (!canManageOrderEquipment(auth.user, order)) {
    return NextResponse.json({ message: "Perfil sem permissao para atualizar equipamentos desta OS." }, { status: 403 });
  }
  const canPrepare = canPrepareServiceMaterials(auth.user.role);
  if (!canPrepare && !["REQUESTED", "IN_USE", "CANCELED"].includes(parsed.data.status)) {
    return NextResponse.json({ message: "Supervisor pode solicitar, marcar em uso ou remover. Reserva/retorno ficam com o almoxarifado." }, { status: 403 });
  }
  const stockItem = db.equipment.find((item) => item.id === link.equipmentId);
  if (!stockItem) return NextResponse.json({ message: "Equipamento de estoque nao encontrado." }, { status: 404 });

  const oldValueJson = { link: { ...link }, equipment: { ...stockItem } };
  try {
    applyEquipmentMovement(stockItem, link, parsed.data, db.serviceOrderEquipment, auth.user.id);
  } catch (error) {
    if (error instanceof InventoryError) return NextResponse.json({ message: error.message }, { status: 409 });
    throw error;
  }

  recordAuditLog({
    userId: auth.user.id,
    action: "UPDATE_SERVICE_ORDER_EQUIPMENT",
    entity: "ServiceOrderEquipment",
    entityId: link.id,
    oldValueJson,
    newValueJson: { link, equipment: stockItem },
  });
  queueDatabasePersist();
  await flushDatabasePersistence();

  return NextResponse.json({ equipment: link, stockEquipment: stockItem });
}

export const GET = withDatabase(GETHandler);
export const POST = withDatabase(POSTHandler);
export const PATCH = withDatabase(PATCHHandler);
