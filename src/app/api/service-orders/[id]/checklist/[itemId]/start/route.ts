import { NextResponse, type NextRequest } from "next/server";

import { canOperateChecklistItemForOrder, getOrderAndChecklistItem } from "@/lib/checklist-access";
import { requireApiUser } from "@/lib/api-handlers";
import { canOperateChecklist } from "@/lib/permissions";
import { getChecklistForServiceOrder, startChecklistItem } from "@/lib/store";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; itemId: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  const { id, itemId } = await context.params;
  const { order, item } = getOrderAndChecklistItem(id, itemId);
  if (!order || !item) return NextResponse.json({ message: "OS ou item nao encontrado." }, { status: 404 });
  if (!(canOperateChecklist(auth.user.role) || auth.user.role === "COLABORADOR") || !canOperateChecklistItemForOrder(auth.user, order, item)) {
    return NextResponse.json({ message: "Perfil sem permissao para iniciar este item." }, { status: 403 });
  }
  const result = startChecklistItem(id, itemId, auth.user);
  if (result.error === "ORDER_CLOSED") return NextResponse.json({ message: "Nao e permitido iniciar item de OS encerrada." }, { status: 400 });
  if (result.error === "ITEM_CANCELED") return NextResponse.json({ message: "Item cancelado nao pode ser iniciado." }, { status: 400 });
  if (result.error === "ITEM_ALREADY_STARTED") return NextResponse.json({ message: "Item ja iniciado por outro usuario." }, { status: 409 });
  if (result.error === "INVALID_STATUS") return NextResponse.json({ message: "Item nao esta disponivel para iniciar." }, { status: 409 });
  if (result.error === "FORBIDDEN") return NextResponse.json({ message: "Colaborador so pode iniciar tarefa propria habilitada." }, { status: 403 });
  return NextResponse.json({ item: result.item, progress: getChecklistForServiceOrder(id).progress });
}
