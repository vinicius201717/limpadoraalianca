import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { canOperateChecklistItemForOrder, getOrderAndChecklistItem } from "@/lib/checklist-access";
import { requireApiUser } from "@/lib/api-handlers";
import { maxPhotoBytes, maxVideoDurationSeconds, persistChecklistPhotoUploads } from "@/lib/checklist-photo-storage";
import { canOperateChecklist } from "@/lib/permissions";
import { completeChecklistItem, flushDatabasePersistence, getChecklistForServiceOrder } from "@/lib/store";

const photoSchema = z.object({
  url: z.string().min(1),
  type: z.enum(["BEFORE", "DURING", "AFTER", "EVIDENCE", "PROBLEM"]).optional(),
  caption: z.string().optional(),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
  sizeBytes: z.coerce.number().int().positive().max(maxPhotoBytes).optional(),
  durationSeconds: z.coerce.number().positive().optional(),
}).superRefine((data, ctx) => {
  if (data.mimeType?.startsWith("video/") && (!data.durationSeconds || data.durationSeconds > maxVideoDurationSeconds)) {
    ctx.addIssue({
      code: "custom",
      path: ["durationSeconds"],
      message: `Videos devem ter ate ${maxVideoDurationSeconds} segundos.`,
    });
  }
});

const completeChecklistSchema = z.object({
  completedByEmployeeId: z.string(),
  completedByEmployeeIds: z.array(z.string()).optional(),
  completionNotes: z.string().optional(),
  notes: z.string().optional(),
  photos: z.array(photoSchema).optional().default([]),
});

async function POSTHandler(
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

  let storedPhotos;
  try {
    storedPhotos = await persistChecklistPhotoUploads(parsed.data.photos, { serviceOrderId: id, checklistItemId: itemId });
  } catch (error) {
    console.error("[checklist-complete] photo upload failed", error);
    return NextResponse.json({ message: "Nao foi possivel enviar as midias para o armazenamento." }, { status: 500 });
  }

  const result = completeChecklistItem({
    serviceOrderId: id,
    itemId,
    completedByEmployeeId: parsed.data.completedByEmployeeId,
    completedByEmployeeIds: parsed.data.completedByEmployeeIds,
    completedByUserId: auth.user.id,
    actor: auth.user,
    completionNotes: parsed.data.completionNotes,
    notes: parsed.data.notes,
    photos: storedPhotos,
  });

  if (result.error === "ATTENDANCE_CONFLICT") return NextResponse.json({ message: "Há falta registrada hoje para um dos executores. Confirme quem realmente realizou o serviço antes de concluir." }, { status: 409 });
  if (result.error === "EMPLOYEE_NOT_IN_TEAM") {
    return NextResponse.json({ message: "Colaborador nao pertence a equipe desta OS." }, { status: 400 });
  }
  if (result.error === "PHOTO_REQUIRED") {
    return NextResponse.json({ message: "Este item exige a quantidade minima de fotos antes de concluir." }, { status: 400 });
  }
  if (result.error === "INVALID_PHOTO") {
    return NextResponse.json({ message: "Midia invalida. Use imagem JPEG, PNG, WebP, HEIC ou video MP4, WebM ou MOV de ate 30 segundos." }, { status: 400 });
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

  await flushDatabasePersistence();
  return NextResponse.json({ item: result.item, photos: result.photos, progress: getChecklistForServiceOrder(id).progress });
}

export const POST = withDatabase(POSTHandler);
