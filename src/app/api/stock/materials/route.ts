import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { canManageStock } from "@/lib/permissions";
import { db, queueDatabasePersist } from "@/lib/store";
import { getMaterialOperationalStatus, normalizeStockStatus, stockStatusOptions } from "@/lib/stock-status";
import type { Material } from "@/lib/types";

const materialSchema = z.object({
  name: z.string().trim().min(2),
  unit: z.string().trim().min(1),
  status: z.enum(stockStatusOptions).optional(),
  currentStock: z.coerce.number().min(0),
  minStock: z.coerce.number().min(0),
  unitCost: z.coerce.number().min(0),
});

const materialPatchSchema = materialSchema.partial().extend({
  id: z.string(),
});

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  if (!canManageStock(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para acessar estoque." }, { status: 403 });
  }

  return NextResponse.json({
    materials: db.materials.map((material) => ({ ...material, status: getMaterialOperationalStatus(material) })),
    serviceOrderMaterials: db.serviceOrderMaterials,
  });
}

export async function POST(request: NextRequest) {
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
    id: `mat-${Date.now()}`,
    name: parsed.data.name,
    unit: parsed.data.unit,
    status: parsed.data.status ?? normalizeStockStatus(undefined),
    currentStock: parsed.data.currentStock,
    minStock: parsed.data.minStock,
    unitCost: parsed.data.unitCost,
  };
  db.materials.unshift(material);
  queueDatabasePersist();
  return NextResponse.json({ material: { ...material, status: getMaterialOperationalStatus(material) } }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
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

  Object.assign(material, {
    name: parsed.data.name ?? material.name,
    unit: parsed.data.unit ?? material.unit,
    status: parsed.data.status ?? material.status,
    currentStock: parsed.data.currentStock ?? material.currentStock,
    minStock: parsed.data.minStock ?? material.minStock,
    unitCost: parsed.data.unitCost ?? material.unitCost,
  });
  queueDatabasePersist();

  return NextResponse.json({ material: { ...material, status: getMaterialOperationalStatus(material) } });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  if (!canManageStock(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para limpar materiais." }, { status: 403 });
  }

  const removed = db.materials.length;
  db.materials.splice(0, db.materials.length);
  db.serviceOrderMaterials.splice(0, db.serviceOrderMaterials.length);
  db.materialRequests.splice(0, db.materialRequests.length);
  db.materialRequestItems.splice(0, db.materialRequestItems.length);
  queueDatabasePersist();
  return NextResponse.json({ ok: true, removed });
}
