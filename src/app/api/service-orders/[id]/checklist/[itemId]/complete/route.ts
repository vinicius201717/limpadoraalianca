import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { canOperateChecklistItemForOrder, getOrderAndChecklistItem } from "@/lib/checklist-access";
import { requireApiUser } from "@/lib/api-handlers";
import { canOperateChecklist } from "@/lib/permissions";
import { completeChecklistItem, getChecklistForServiceOrder } from "@/lib/store";

const photoSchema = z.object({
  url: z.string().min(1),
  type: z.enum(["BEFORE", "DURING", "AFTER", "EVIDENCE", "PROBLEM"]).optional(),
  caption: z.string().optional(),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
  sizeBytes: z.coerce.number().int().positive().optional(),
});

const completeChecklistSchema = z.object({
  completedByEmployeeId: z.string(),
  completionNotes: z.string().optional(),
  notes: z.string().optional(),
  photos: z.array(photoSchema).optional().default([]),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> },
) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const { id, itemId } = await context.params;
  const { order, item } = getOrderAndChecklistItem(id, itemId);
  if (!order || !item) return NextResponse.json({ message: "OS ou item nao encontrado." }, { status: 404 });
  if (!(canOperateChecklist(auth.user.role) || auth.user.role === "COLABORADOR") || !canOperateChecklistItemForOrder(auth.user, order, item)) {
    return NextResponse.json({ message: "Perfil sem permissao para concluir este item." }, { status: 403 });
  }

  const parsed = completeChecklistSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const result = completeChecklistItem({
    serviceOrderId: id,
    itemId,
    completedByEmployeeId: parsed.data.completedByEmployeeId,
    completedByUserId: auth.user.id,
    actor: auth.user,
    completionNotes: parsed.data.completionNotes,
    notes: parsed.data.notes,
    photos: parsed.data.photos,
  });

  if (result.error === "EMPLOYEE_NOT_IN_TEAM") {
    return NextResponse.json({ message: "Colaborador nao pertence a equipe desta OS." }, { status: 400 });
  }
  if (result.error === "PHOTO_REQUIRED") {
    return NextResponse.json({ message: "Este item exige a quantidade minima de fotos antes de concluir." }, { status: 400 });
  }
  if (result.error === "INVALID_PHOTO") {
    return NextResponse.json({ message: "Foto invalida. Use JPEG, PNG ou WebP em upload local, /uploads ou /demo." }, { status: 400 });
  }
  if (result.error === "INVALID_STATUS") {
    return NextResponse.json({ message: "Item bloqueado, cancelado ou ja concluido nao pode ser concluido novamente." }, { status: 409 });
  }
  if (result.error === "ITEM_ALREADY_STARTED") {
    return NextResponse.json({ message: "Item ja iniciado por outro usuario." }, { status: 409 });
  }
  if (result.error === "ORDER_CLOSED") {
    return NextResponse.json({ message: "Nao e permitido concluir item de OS encerrada." }, { status: 400 });
  }
  if (result.error === "FORBIDDEN") {
    return NextResponse.json({ message: "Colaborador so pode concluir item atribuido a ele quando habilitado." }, { status: 403 });
  }
  if (!result.item) return NextResponse.json({ message: "Nao foi possivel concluir o item." }, { status: 400 });

  return NextResponse.json({ item: result.item, photos: result.photos, progress: getChecklistForServiceOrder(id).progress });
}
