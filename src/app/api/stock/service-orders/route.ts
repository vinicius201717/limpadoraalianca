import { NextResponse, type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/api-handlers";
import { canManageStock } from "@/lib/permissions";
import { db } from "@/lib/store";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  if (!canManageStock(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para acessar preparacao de materiais." }, { status: 403 });
  }

  const serviceOrders = db.serviceOrders.map((order) => ({
    ...order,
    materials: db.serviceOrderMaterials.filter((item) => item.serviceOrderId === order.id),
    equipment: db.serviceOrderEquipment.filter((item) => item.serviceOrderId === order.id),
    materialRequests: db.materialRequests.filter((item) => item.serviceOrderId === order.id),
  }));

  return NextResponse.json({ serviceOrders });
}
