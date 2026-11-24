import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { canAccessAllServiceOrders, canPrepareServiceMaterials, canRequestServiceMaterials, canViewServiceOrderFinancials } from "@/lib/permissions";
import { authorizeServiceOrderAccess, ServiceOrderAuthorizationError } from "@/lib/service-order-access";
import { canUserAccessOrder, db, flushDatabasePersistence, recordAuditLog } from "@/lib/store";
import { getMaterialOperationalStatus } from "@/lib/stock-status";
import { applyMaterialMovement, InventoryError, isArchivedStockItem } from "@/lib/inventory-operations";
import { randomUUID } from "node:crypto";
import type { ServiceOrderMaterial, SessionUser } from "@/lib/types";

const materialSchema = z.object({
  materialId: z.string(),
  plannedQuantity: z.coerce.number().positive(),
  notes: z.string().optional().default(""),
});

const materialPatchSchema = z.object({
  id: z.string(),
  plannedQuantity: z.coerce.number().min(0).optional(),
  status: z
    .enum(["PENDING_SEPARATION", "SEPARATING", "RESERVED", "SEPARATED", "DELIVERED_TO_TEAM", "PARTIALLY_RETURNED", "RETURNED", "CONSUMED", "DAMAGED", "LOST", "CANCELED"])
    .optional(),
  separatedQuantity: z.coerce.number().nonnegative().optional(),
  deliveredQuantity: z.coerce.number().nonnegative().optional(),
  returnedQuantity: z.coerce.number().nonnegative().optional(),
  consumedQuantity: z.coerce.number().nonnegative().optional(),
  damagedQuantity: z.coerce.number().nonnegative().optional(),
  lostQuantity: z.coerce.number().nonnegative().optional(),
  notes: z.string().optional(),
});

function canManageOrderMaterial(user: SessionUser, order: (typeof db.serviceOrders)[number]) {
  return canAccessAllServiceOrders(user.role) || canPrepareServiceMaterials(user.role) || (canRequestServiceMaterials(user.role) && canUserAccessOrder(user, order));
}

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

  const materials = db.serviceOrderMaterials
    .filter((item) => item.serviceOrderId === id)
    .map((item) => { const material = db.materials.find(m => m.id === item.materialId); return {...item, material: material ? {...material, unitCost: canViewServiceOrderFinancials(auth.user) ? material.unitCost : 0} : undefined}; });
  return NextResponse.json({ materials });
}

async function POSTHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const parsed = materialSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await context.params;
  const order = db.serviceOrders.find((item) => item.id === id);
  if (!order) return NextResponse.json({ message: "OS nao encontrada." }, { status: 404 });
  if (!canManageOrderMaterial(auth.user, order)) {
    return NextResponse.json({ message: "Perfil sem permissao para definir materiais da OS." }, { status: 403 });
  }

  if (["DONE", "DELIVERED", "CANCELED"].includes(order.status)) return NextResponse.json({ message: "OS encerrada nao recebe novos materiais." }, { status: 409 });
  const stock = db.materials.find((item) => item.id === parsed.data.materialId);
  if (!stock || isArchivedStockItem(stock)) return NextResponse.json({ message: "Material ativo nao encontrado." }, { status: 404 });

  const material: ServiceOrderMaterial = {
    id: `som-${randomUUID()}`,
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

  await flushDatabasePersistence();

  return NextResponse.json({ material }, { status: 201 });
}

async function PATCHHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const parsed = materialPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const serviceMaterial = db.serviceOrderMaterials.find((item) => item.id === parsed.data.id);
  if (!serviceMaterial) return NextResponse.json({ message: "Material da OS nao encontrado." }, { status: 404 });
  const { id } = await context.params;
  const order = db.serviceOrders.find((item) => item.id === id && item.id === serviceMaterial.serviceOrderId);
  if (!order) return NextResponse.json({ message: "OS nao encontrada." }, { status: 404 });
  if (!canManageOrderMaterial(auth.user, order)) {
    return NextResponse.json({ message: "Perfil sem permissao para atualizar materiais desta OS." }, { status: 403 });
  }

  const canPrepare = canPrepareServiceMaterials(auth.user.role);
  if (!canPrepare && parsed.data.status && !["PENDING_SEPARATION", "CANCELED"].includes(parsed.data.status)) {
    return NextResponse.json({ message: "Supervisor pode ajustar planejamento ou remover material, mas reserva/entrega fica com o almoxarifado." }, { status: 403 });
  }
  if (!canPrepare && ["separatedQuantity", "deliveredQuantity", "returnedQuantity", "consumedQuantity", "damagedQuantity", "lostQuantity"].some((key) => key in parsed.data)) {
    return NextResponse.json({ message: "Quantidades operacionais sao conferidas pelo almoxarifado." }, { status: 403 });
  }

  const materialStock = db.materials.find((item) => item.id === serviceMaterial.materialId);
  if (!materialStock) return NextResponse.json({ message: "Material de estoque nao encontrado." }, { status: 404 });
  const oldValueJson = { material: { ...serviceMaterial }, stock: { ...materialStock } };
  let material;
  try {
    const { id: allocationId, ...patch } = parsed.data;
    void allocationId;
    material = applyMaterialMovement(materialStock, serviceMaterial, patch, auth.user.id);
  } catch (error) {
    if (error instanceof InventoryError) return NextResponse.json({ message: error.message }, { status: 409 });
    throw error;
  }
  recordAuditLog({ userId: auth.user.id, action: "MATERIAL_STOCK_MOVEMENT", entity: "ServiceOrderMaterial", entityId: material.id, oldValueJson, newValueJson: { material, stock: materialStock } });

  await flushDatabasePersistence();

  return NextResponse.json({
    material,
    stockMaterial: materialStock ? { ...materialStock, unitCost: canViewServiceOrderFinancials(auth.user) ? materialStock.unitCost : 0, status: getMaterialOperationalStatus(materialStock) } : undefined,
  });
}

export const GET = withDatabase(GETHandler);
export const POST = withDatabase(POSTHandler);
export const PATCH = withDatabase(PATCHHandler);
