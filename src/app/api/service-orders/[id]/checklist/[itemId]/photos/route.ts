import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { canOperateChecklistItemForOrder, getOrderAndChecklistItem } from "@/lib/checklist-access";
import { requireApiUser } from "@/lib/api-handlers";
import { maxPhotoBytes, maxVideoDurationSeconds, persistChecklistPhotoUploads } from "@/lib/checklist-photo-storage";
import { canOperateChecklist } from "@/lib/permissions";
import { addChecklistPhoto, flushDatabasePersistence, getChecklistForServiceOrder } from "@/lib/store";

const photoSchema = z.object({
  url: z.string().min(1),
  type: z.enum(["BEFORE", "DURING", "AFTER", "EVIDENCE", "PROBLEM"]).optional(),
  caption: z.string().optional(),
  employeeId: z.string().optional(),
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

async function POSTHandler(request: NextRequest, context: { params: Promise<{ id: string; itemId: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  const { id, itemId } = await context.params;
  const { order, item } = getOrderAndChecklistItem(id, itemId);
  if (!order || !item) return NextResponse.json({ message: "OS ou item nao encontrado." }, { status: 404 });
  if (!(canOperateChecklist(auth.user.role) || auth.user.role === "COLABORADOR") || !canOperateChecklistItemForOrder(auth.user, order, item)) {
    return NextResponse.json({ message: "Perfil sem permissao para anexar foto neste item." }, { status: 403 });
  }
  const parsed = photoSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  let storedPhoto;
  try {
    [storedPhoto] = await persistChecklistPhotoUploads([parsed.data], { serviceOrderId: id, checklistItemId: itemId });
  } catch (error) {
    console.error("[checklist-photos] upload failed", error);
    return NextResponse.json({ message: "Nao foi possivel enviar a midia para o armazenamento." }, { status: 500 });
  }
  const result = addChecklistPhoto(id, itemId, storedPhoto, auth.user);
  if (result.error === "EMPLOYEE_NOT_IN_TEAM") return NextResponse.json({ message: "Colaborador nao pertence a equipe." }, { status: 400 });
  if (result.error === "INVALID_PHOTO") return NextResponse.json({ message: "Midia invalida. Use imagem JPEG, PNG, WebP, HEIC ou video MP4, WebM ou MOV de ate 30 segundos." }, { status: 400 });
  await flushDatabasePersistence();
  return NextResponse.json({ photo: result.photo, progress: getChecklistForServiceOrder(id).progress }, { status: 201 });
}

export const POST = withDatabase(POSTHandler);
