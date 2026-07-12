import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { canManageChecklistForOrder } from "@/lib/checklist-access";
import { requireApiUser } from "@/lib/api-handlers";
import { canEditChecklist } from "@/lib/permissions";
import { db, getChecklistForServiceOrder, reorderChecklistItems } from "@/lib/store";

const reorderSchema = z.object({
  itemIds: z.array(z.string()).min(1),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const order = db.serviceOrders.find((item) => item.id === id);
  if (!order) return NextResponse.json({ message: "OS nao encontrada." }, { status: 404 });
  if (!canEditChecklist(auth.user.role) || !canManageChecklistForOrder(auth.user, order)) {
    return NextResponse.json({ message: "Perfil sem permissao para reordenar checklist." }, { status: 403 });
  }

  const parsed = reorderSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });

  const result = reorderChecklistItems(id, parsed.data.itemIds, auth.user);
  if (result.error === "INVALID_ITEMS") return NextResponse.json({ message: "Lista contem item invalido para esta OS." }, { status: 400 });
  return NextResponse.json({ items: result.items, progress: getChecklistForServiceOrder(id).progress });
}
