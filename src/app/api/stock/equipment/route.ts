import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { randomUUID } from "node:crypto";
import { canManageStock } from "@/lib/permissions";
import { db, flushDatabasePersistence, queueDatabasePersist, recordAuditLog } from "@/lib/store";
import { normalizeStockStatus, stockStatusOptions } from "@/lib/stock-status";
import type { Equipment } from "@/lib/types";

const equipmentSchema = z.object({
  name: z.string().trim().min(2),
  code: z.string().trim().optional(),
  status: z.enum(stockStatusOptions).default("AVAILABLE"),
  notes: z.string().optional().default(""),
});

const equipmentPatchSchema = equipmentSchema.partial().extend({
  id: z.string(),
});

async function GETHandler(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  if (!canManageStock(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para acessar equipamentos." }, { status: 403 });
  }

  return NextResponse.json({
    equipment: db.equipment.filter(e=>!e.archivedAt).map((item) => ({ ...item, status: normalizeStockStatus(item.status) })),
    serviceOrderEquipment: db.serviceOrderEquipment,
  });
}

async function POSTHandler(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  if (!canManageStock(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para criar equipamento." }, { status: 403 });
  }

  const parsed = equipmentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const code = parsed.data.code || "EQ-" + randomUUID().slice(0,12);
  if (db.equipment.some(e=>e.code.toLowerCase()===code.toLowerCase())) return NextResponse.json({message:"Codigo de equipamento ja cadastrado."},{status:409});
  const equipment: Equipment = {
    id: `eq-${randomUUID()}`,
    name: parsed.data.name,
    code,
    status: normalizeStockStatus(parsed.data.status),
    notes: parsed.data.notes,
  };
  db.equipment.unshift(equipment);
  recordAuditLog({userId:auth.user.id,action:"STOCK_EQUIPMENT_CREATED",entity:"Equipment",entityId:equipment.id,newValueJson:equipment});
  queueDatabasePersist();
  await flushDatabasePersistence();
  return NextResponse.json({ equipment }, { status: 201 });
}

async function PATCHHandler(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  if (!canManageStock(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para atualizar equipamento." }, { status: 403 });
  }

  const parsed = equipmentPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const equipment = db.equipment.find((item) => item.id === parsed.data.id);
  if (!equipment) return NextResponse.json({ message: "Equipamento nao encontrado." }, { status: 404 });

  if (equipment.archivedAt) return NextResponse.json({message:"Equipamento arquivado."},{status:409});
  if (parsed.data.code && db.equipment.some(e=>e.id!==equipment.id && e.code.toLowerCase()===parsed.data.code!.toLowerCase())) return NextResponse.json({message:"Codigo de equipamento ja cadastrado."},{status:409});
  const old = {...equipment};
  Object.assign(equipment, {
    name: parsed.data.name ?? equipment.name,
    code: parsed.data.code ?? equipment.code,
    status: parsed.data.status ? normalizeStockStatus(parsed.data.status) : normalizeStockStatus(equipment.status),
    notes: parsed.data.notes ?? equipment.notes,
  });
  recordAuditLog({userId:auth.user.id,action:"STOCK_EQUIPMENT_UPDATED",entity:"Equipment",entityId:equipment.id,oldValueJson:old,newValueJson:equipment});
  queueDatabasePersist();
  await flushDatabasePersistence();

  return NextResponse.json({ equipment });
}

async function DELETEHandler(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  if (!canManageStock(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para limpar equipamentos." }, { status: 403 });
  }

  const url = new URL(request.url);
  const body = await request.json().catch(() => null);
  const id = url.searchParams.get("id") ?? (typeof body?.id === "string" ? body.id : "");

  if (id) {
    const equipment = db.equipment.find((item) => item.id === id);
    if (!equipment) return NextResponse.json({ message: "Equipamento nao encontrado." }, { status: 404 });

    const activeUse = db.serviceOrderEquipment.find(
      (item) => item.equipmentId === id && !["RETURNED", "DAMAGED", "LOST", "CANCELED"].includes(item.status),
    );
    if (activeUse) {
      const order = db.serviceOrders.find((item) => item.id === activeUse.serviceOrderId);
      return NextResponse.json(
        {
          message: `Equipamento em uso${order ? ` na OS ${order.title}` : ""}. Remova do servico antes de apagar do estoque.`,
          conflict: order ? { serviceOrderId: order.id, title: order.title } : undefined,
        },
        { status: 409 },
      );
    }

    equipment.archivedAt = new Date().toISOString();
    recordAuditLog({userId:auth.user.id,action:"STOCK_EQUIPMENT_ARCHIVED",entity:"Equipment",entityId:id,newValueJson:{archivedAt:equipment.archivedAt}});
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
