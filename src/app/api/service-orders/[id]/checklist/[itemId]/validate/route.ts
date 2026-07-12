import { NextResponse, type NextRequest } from "next/server";

import { canManageChecklistForOrder, getOrderAndChecklistItem } from "@/lib/checklist-access";
import { requireApiUser } from "@/lib/api-handlers";
import { canValidateChecklistItem } from "@/lib/permissions";
import { getChecklistForServiceOrder, validateChecklistItem } from "@/lib/store";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; itemId: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  const { id, itemId } = await context.params;
  const { order, item } = getOrderAndChecklistItem(id, itemId);
  if (!order || !item) return NextResponse.json({ message: "OS ou item nao encontrado." }, { status: 404 });
  if (!canValidateChecklistItem(auth.user.role) || !canManageChecklistForOrder(auth.user, order)) {
    return NextResponse.json({ message: "Perfil sem permissao para validar este item." }, { status: 403 });
  }
  const result = validateChecklistItem(id, itemId, auth.user);
  if (result.error === "NOT_DONE") return NextResponse.json({ message: "Somente item concluido pode ser validado." }, { status: 400 });
  return NextResponse.json({ item: result.item, progress: getChecklistForServiceOrder(id).progress });
}
