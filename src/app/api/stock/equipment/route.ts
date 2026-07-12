import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { canManageStock } from "@/lib/permissions";
import { db, queueDatabasePersist } from "@/lib/store";
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

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  if (!canManageStock(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para acessar equipamentos." }, { status: 403 });
  }

  return NextResponse.json({
    equipment: db.equipment.map((item) => ({ ...item, status: normalizeStockStatus(item.status) })),
    serviceOrderEquipment: db.serviceOrderEquipment,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  if (!canManageStock(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para criar equipamento." }, { status: 403 });
  }

  const parsed = equipmentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const equipment: Equipment = {
    id: `eq-${Date.now()}`,
    name: parsed.data.name,
    code: parsed.data.code || `EQ-${Date.now()}`,
    status: normalizeStockStatus(parsed.data.status),
    notes: parsed.data.notes,
  };
  db.equipment.unshift(equipment);
  queueDatabasePersist();
  return NextResponse.json({ equipment }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
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

  Object.assign(equipment, {
    name: parsed.data.name ?? equipment.name,
    code: parsed.data.code ?? equipment.code,
    status: parsed.data.status ? normalizeStockStatus(parsed.data.status) : normalizeStockStatus(equipment.status),
    notes: parsed.data.notes ?? equipment.notes,
  });
  queueDatabasePersist();

  return NextResponse.json({ equipment });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  if (!canManageStock(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para limpar equipamentos." }, { status: 403 });
  }

  const removed = db.equipment.length;
  db.equipment.splice(0, db.equipment.length);
  db.serviceOrderEquipment.splice(0, db.serviceOrderEquipment.length);
  queueDatabasePersist();
  return NextResponse.json({ ok: true, removed });
}
