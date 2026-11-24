import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { randomUUID } from "node:crypto";
import { canViewServiceOrderFinancials, canManageStock } from "@/lib/permissions";
import { db, flushDatabasePersistence, queueDatabasePersist, recordAuditLog } from "@/lib/store";
import { getMaterialOperationalStatus, normalizeStockStatus, stockStatusOptions } from "@/lib/stock-status";
import type { Material } from "@/lib/types";

const materialSchema = z.object({
  name: z.string().trim().min(2),
  unit: z.string().trim().min(1),
  status: z.enum(stockStatusOptions).optional(),
  currentStock: z.coerce.number().min(0),
  minStock: z.coerce.number().min(0).optional().default(0),
  unitCost: z.coerce.number().min(0).optional().default(0),
});

const materialPatchSchema = materialSchema.partial().extend({
  id: z.string(),
});

async function GETHandler(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  if (!canManageStock(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para acessar estoque." }, { status: 403 });
  }

  return NextResponse.json({
    materials: db.materials.filter(m=>!m.archivedAt).map((material) => ({ ...material, unitCost: canViewServiceOrderFinancials(auth.user) ? material.unitCost : 0, status: getMaterialOperationalStatus(material) })),
    serviceOrderMaterials: db.serviceOrderMaterials,
  });
}

async function POSTHandler(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  if (!canManageStock(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para criar material." }, { status: 403 });
  }

  const parsed = materialSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const material: Material = {
    id: `mat-${randomUUID()}`,
    name: parsed.data.name,
    unit: parsed.data.unit,
    status: parsed.data.status ?? normalizeStockStatus(undefined),
    currentStock: parsed.data.currentStock,
    minStock: parsed.data.minStock,
    unitCost: canViewServiceOrderFinancials(auth.user) ? parsed.data.unitCost : 0,
  };
  db.materials.unshift(material);
  recordAuditLog({userId:auth.user.id,action:"STOCK_MATERIAL_CREATED",entity:"Material",entityId:material.id,newValueJson:material});
  queueDatabasePersist();
  await flushDatabasePersistence();
  return NextResponse.json({ material: { ...material, unitCost: canViewServiceOrderFinancials(auth.user) ? material.unitCost : 0, status: getMaterialOperationalStatus(material) } }, { status: 201 });
}

async function PATCHHandler(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  if (!canManageStock(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para atualizar material." }, { status: 403 });
  }

  const parsed = materialPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const material = db.materials.find((item) => item.id === parsed.data.id);
  if (!material) return NextResponse.json({ message: "Material nao encontrado." }, { status: 404 });

  if (material.archivedAt) return NextResponse.json({message:"Material arquivado."},{status:409});
  const old = {...material};
  Object.assign(material, {
    name: parsed.data.name ?? material.name,
    unit: parsed.data.unit ?? material.unit,
    status: parsed.data.status ?? material.status,
    currentStock: parsed.data.currentStock ?? material.currentStock,
    minStock: parsed.data.minStock ?? material.minStock,
    unitCost: canViewServiceOrderFinancials(auth.user) ? parsed.data.unitCost ?? material.unitCost : material.unitCost,
  });
  recordAuditLog({userId:auth.user.id,action:"STOCK_MATERIAL_UPDATED",entity:"Material",entityId:material.id,oldValueJson:old,newValueJson:material});
  queueDatabasePersist();
  await flushDatabasePersistence();

  return NextResponse.json({ material: { ...material, unitCost: canViewServiceOrderFinancials(auth.user) ? material.unitCost : 0, status: getMaterialOperationalStatus(material) } });
}

async function DELETEHandler(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  if (!canManageStock(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para limpar materiais." }, { status: 403 });
  }

  const url = new URL(request.url);
  const body = await request.json().catch(() => null);
  const id = url.searchParams.get("id") ?? (typeof body?.id === "string" ? body.id : "");

  if (id) {
    const material = db.materials.find((item) => item.id === id);
    if (!material) return NextResponse.json({ message: "Material nao encontrado." }, { status: 404 });

    const activeUse = db.serviceOrderMaterials.find(
      (item) =>
        item.materialId === id &&
        !["RETURNED", "CONSUMED", "DAMAGED", "LOST", "CANCELED"].includes(item.status),
    );
    if (activeUse) {
      const order = db.serviceOrders.find((item) => item.id === activeUse.serviceOrderId);
      return NextResponse.json(
        {
          message: `Material em uso${order ? ` na OS ${order.title}` : ""}. Remova do servico antes de apagar do estoque.`,
          conflict: order ? { serviceOrderId: order.id, title: order.title } : undefined,
        },
        { status: 409 },
      );
    }

    if (db.materialRequestItems.some(x=>x.materialId===id && db.materialRequests.some(r=>r.id===x.requestId && !["DELIVERED","REJECTED","CANCELED"].includes(r.status)))) return NextResponse.json({message:"Material possui solicitacao pendente."},{status:409});
    material.archivedAt = new Date().toISOString();
    recordAuditLog({userId:auth.user.id,action:"STOCK_MATERIAL_ARCHIVED",entity:"Material",entityId:id,newValueJson:{archivedAt:material.archivedAt}});
    queueDatabasePersist();
    await flushDatabasePersistence();
    return NextResponse.json({ ok: true, removed: 1, id });
  }

  return NextResponse.json({message:"Exclusao em massa desativada para preservar o historico."},{status:400});
}

export const GET = withDatabase(GETHandler);
export const POST = withDatabase(POSTHandler);
export const PATCH = withDatabase(PATCHHandler);
export const DELETE = withDatabase(DELETEHandler);
