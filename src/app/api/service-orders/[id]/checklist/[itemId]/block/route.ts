import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { canManageChecklistForOrder, getOrderAndChecklistItem } from "@/lib/checklist-access";
import { requireApiUser } from "@/lib/api-handlers";
import { canOperateChecklist } from "@/lib/permissions";
import { blockChecklistItem, getChecklistForServiceOrder } from "@/lib/store";

const blockSchema = z.object({ reason: z.string().min(3) });

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; itemId: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  const { id, itemId } = await context.params;
  const { order, item } = getOrderAndChecklistItem(id, itemId);
  if (!order || !item) return NextResponse.json({ message: "OS ou item nao encontrado." }, { status: 404 });
  if (!canOperateChecklist(auth.user.role) || !canManageChecklistForOrder(auth.user, order)) {
    return NextResponse.json({ message: "Perfil sem permissao para bloquear este item." }, { status: 403 });
  }
  const parsed = blockSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Motivo obrigatorio.", issues: parsed.error.flatten() }, { status: 400 });
  const result = blockChecklistItem(id, itemId, parsed.data.reason, auth.user);
  return NextResponse.json({ item: result.item, progress: getChecklistForServiceOrder(id).progress });
}
