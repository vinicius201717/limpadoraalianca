import { NextResponse, type NextRequest } from "next/server";

import { getOrderAndChecklistItem } from "@/lib/checklist-access";
import { requireApiUser } from "@/lib/api-handlers";
import { canUserAccessOrder, getChecklistItemHistory } from "@/lib/store";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string; itemId: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  const { id, itemId } = await context.params;
  const { order, item } = getOrderAndChecklistItem(id, itemId);
  if (!order || !item) return NextResponse.json({ message: "OS ou item nao encontrado." }, { status: 404 });
  if (!canUserAccessOrder(auth.user, order)) {
    return NextResponse.json({ message: "Perfil sem permissao para ver historico deste item." }, { status: 403 });
  }
  return NextResponse.json({ events: getChecklistItemHistory(id, itemId) });
}
