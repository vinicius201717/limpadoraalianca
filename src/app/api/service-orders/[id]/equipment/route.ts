import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { canPrepareServiceMaterials, canRequestServiceMaterials } from "@/lib/permissions";
import { authorizeServiceOrderAccess, ServiceOrderAuthorizationError } from "@/lib/service-order-access";
import { canUserAccessOrder, db, queueDatabasePersist, recordAuditLog } from "@/lib/store";
import { normalizeStockStatus } from "@/lib/stock-status";
import type { ServiceOrderEquipment } from "@/lib/types";

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

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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
  if (!stockItem) return NextResponse.json({ message: "Equipamento nao encontrado." }, { status: 404 });
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
    id: `soequip-${Date.now()}`,
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

  return NextResponse.json({ equipment: serviceEquipment }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  if (!canPrepareServiceMaterials(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para preparar equipamentos." }, { status: 403 });
  }

  const parsed = equipmentPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const link = db.serviceOrderEquipment.find((item) => item.id === parsed.data.id);
  if (!link) return NextResponse.json({ message: "Equipamento da OS nao encontrado." }, { status: 404 });
  const stockItem = db.equipment.find((item) => item.id === link.equipmentId);
  if (!stockItem) return NextResponse.json({ message: "Equipamento de estoque nao encontrado." }, { status: 404 });

  const oldValueJson = { link: { ...link }, equipment: { ...stockItem } };
  const now = new Date().toISOString();
  link.status = parsed.data.status;
  link.conditionBefore = parsed.data.conditionBefore ?? link.conditionBefore;
  link.conditionAfter = parsed.data.conditionAfter ?? link.conditionAfter;
  link.notes = parsed.data.notes ?? link.notes;
  link.updatedAt = now;

  if (parsed.data.status === "RESERVED") {
    link.reservedAt = now;
    stockItem.status = "RESERVED";
  }
  if (parsed.data.status === "DELIVERED" || parsed.data.status === "IN_USE") {
    link.deliveredAt = link.deliveredAt ?? now;
    link.deliveredByUserId = auth.user.id;
    stockItem.status = "RESERVED";
  }
  if (parsed.data.status === "RETURNED") {
    link.returnedAt = now;
    link.returnedByUserId = auth.user.id;
    stockItem.status = "AVAILABLE";
  }
  if (parsed.data.status === "DAMAGED") {
    stockItem.status = "DAMAGED";
  }
  if (parsed.data.status === "LOST") {
    stockItem.status = "UNAVAILABLE";
  }
  if (parsed.data.status === "CANCELED") {
    stockItem.status = "AVAILABLE";
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

  return NextResponse.json({ equipment: link, stockEquipment: stockItem });
}
