import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { canManageChecklistForOrder, getOrderAndChecklistItem } from "@/lib/checklist-access";
import { requireApiUser } from "@/lib/api-handlers";
import { canReopenChecklistItem } from "@/lib/permissions";
import { getChecklistForServiceOrder, reopenChecklistItem } from "@/lib/store";

const reopenSchema = z.object({ reason: z.string().min(3) });

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; itemId: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  const { id, itemId } = await context.params;
  const { order, item } = getOrderAndChecklistItem(id, itemId);
  if (!order || !item) return NextResponse.json({ message: "OS ou item nao encontrado." }, { status: 404 });
  if (!canReopenChecklistItem(auth.user.role) || !canManageChecklistForOrder(auth.user, order)) {
    return NextResponse.json({ message: "Perfil sem permissao para reabrir este item." }, { status: 403 });
  }
  const parsed = reopenSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Motivo obrigatorio.", issues: parsed.error.flatten() }, { status: 400 });
  const result = reopenChecklistItem(id, itemId, parsed.data.reason, auth.user);
  if (result.error === "REASON_REQUIRED") return NextResponse.json({ message: "Motivo obrigatorio." }, { status: 400 });
  return NextResponse.json({ item: result.item, progress: getChecklistForServiceOrder(id).progress });
}
