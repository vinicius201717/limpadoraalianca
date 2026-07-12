import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { canAccessAllServiceOrders, canPrepareServiceMaterials } from "@/lib/permissions";
import { authorizeServiceOrderAccess, ServiceOrderAuthorizationError } from "@/lib/service-order-access";
import { db, recordAuditLog, updateServiceOrderMaterial } from "@/lib/store";
import { getMaterialOperationalStatus, normalizeStockStatus } from "@/lib/stock-status";
import type { ServiceOrderMaterial } from "@/lib/types";

const materialSchema = z.object({
  materialId: z.string(),
  plannedQuantity: z.coerce.number().min(0),
  notes: z.string().optional().default(""),
});

const materialPatchSchema = z.object({
  id: z.string(),
  status: z
    .enum(["PENDING_SEPARATION", "SEPARATING", "RESERVED", "SEPARATED", "DELIVERED_TO_TEAM", "PARTIALLY_RETURNED", "RETURNED", "CONSUMED", "DAMAGED", "LOST", "CANCELED"])
    .optional(),
  separatedQuantity: z.coerce.number().optional(),
  deliveredQuantity: z.coerce.number().optional(),
  returnedQuantity: z.coerce.number().optional(),
  consumedQuantity: z.coerce.number().optional(),
  damagedQuantity: z.coerce.number().optional(),
  lostQuantity: z.coerce.number().optional(),
  notes: z.string().optional(),
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

  const materials = db.serviceOrderMaterials
    .filter((item) => item.serviceOrderId === id)
    .map((item) => ({ ...item, material: db.materials.find((material) => material.id === item.materialId) }));
  return NextResponse.json({ materials });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canAccessAllServiceOrders(auth.user.role) && !canPrepareServiceMaterials(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para definir materiais da OS." }, { status: 403 });
  }

  const parsed = materialSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await context.params;
  const order = db.serviceOrders.find((item) => item.id === id);
  if (!order) return NextResponse.json({ message: "OS nao encontrada." }, { status: 404 });

  const material: ServiceOrderMaterial = {
    id: `som-${Date.now()}`,
    serviceOrderId: id,
    materialId: parsed.data.materialId,
    plannedQuantity: parsed.data.plannedQuantity,
    separatedQuantity: 0,
    deliveredQuantity: 0,
    returnedQuantity: 0,
    consumedQuantity: 0,
    damagedQuantity: 0,
    lostQuantity: 0,
    status: "PENDING_SEPARATION",
    notes: parsed.data.notes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.serviceOrderMaterials.unshift(material);
  recordAuditLog({
    userId: auth.user.id,
    action: "CREATE_SERVICE_ORDER_MATERIAL",
    entity: "ServiceOrderMaterial",
    entityId: material.id,
    newValueJson: material,
  });

  return NextResponse.json({ material }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canPrepareServiceMaterials(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para preparar materiais." }, { status: 403 });
  }

  const parsed = materialPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const serviceMaterial = db.serviceOrderMaterials.find((item) => item.id === parsed.data.id);
  if (!serviceMaterial) return NextResponse.json({ message: "Material da OS nao encontrado." }, { status: 404 });

  const materialStock = db.materials.find((item) => item.id === serviceMaterial.materialId);
  const nextStatus = parsed.data.status;
  const nextSeparatedQuantity =
    parsed.data.separatedQuantity ?? (nextStatus === "RESERVED" || nextStatus === "SEPARATED" ? serviceMaterial.plannedQuantity : serviceMaterial.separatedQuantity);
  const shouldReserveStock = nextStatus === "RESERVED" || nextStatus === "SEPARATED";

  if (shouldReserveStock) {
    if (!materialStock) return NextResponse.json({ message: "Material de estoque nao encontrado." }, { status: 404 });
    const stockStatus = normalizeStockStatus(materialStock.status);
    if (stockStatus === "IN_MAINTENANCE" || stockStatus === "DAMAGED" || stockStatus === "UNAVAILABLE") {
      return NextResponse.json({ message: "Material indisponivel para reserva no estoque." }, { status: 400 });
    }
    const reservationDelta = Math.max(0, nextSeparatedQuantity - serviceMaterial.separatedQuantity);
    if (reservationDelta > materialStock.currentStock) {
      return NextResponse.json({ message: "Estoque insuficiente para reservar esta quantidade." }, { status: 400 });
    }
    materialStock.currentStock -= reservationDelta;
    materialStock.status = getMaterialOperationalStatus(materialStock);
  }

  const patchData: Partial<ServiceOrderMaterial> = {
    ...parsed.data,
    separatedQuantity: nextSeparatedQuantity,
    preparedByUserId: shouldReserveStock ? auth.user.id : serviceMaterial.preparedByUserId,
  };
  if (nextStatus === "DELIVERED_TO_TEAM") {
    patchData.deliveredQuantity = parsed.data.deliveredQuantity ?? Math.max(serviceMaterial.deliveredQuantity, serviceMaterial.separatedQuantity);
    patchData.deliveredByUserId = auth.user.id;
  }

  const material = updateServiceOrderMaterial(parsed.data.id, patchData, auth.user);

  return NextResponse.json({
    material,
    stockMaterial: materialStock ? { ...materialStock, status: getMaterialOperationalStatus(materialStock) } : undefined,
  });
}
