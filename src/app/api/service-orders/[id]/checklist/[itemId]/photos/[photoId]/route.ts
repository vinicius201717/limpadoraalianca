import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";

import { canManageChecklistForOrder, getOrderAndChecklistItem } from "@/lib/checklist-access";
import { requireApiUser } from "@/lib/api-handlers";
import { deleteChecklistPhotoFromStorage } from "@/lib/checklist-photo-storage";
import { canOperateChecklist } from "@/lib/permissions";
import { flushDatabasePersistence, getChecklistForServiceOrder, removeChecklistPhoto } from "@/lib/store";

async function DELETEHandler(
  request: NextRequest,
  context: { params: Promise<{ id: string; itemId: string; photoId: string }> },
) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  const { id, itemId, photoId } = await context.params;
  const { order, item } = getOrderAndChecklistItem(id, itemId);
  if (!order || !item) return NextResponse.json({ message: "OS ou item nao encontrado." }, { status: 404 });
  if (!canOperateChecklist(auth.user.role) || !canManageChecklistForOrder(auth.user, order)) {
    return NextResponse.json({ message: "Perfil sem permissao para remover foto deste item." }, { status: 403 });
  }
  const result = removeChecklistPhoto(id, itemId, photoId, auth.user);
  if (result.error === "NOT_FOUND") return NextResponse.json({ message: "Foto nao encontrada." }, { status: 404 });
  if (result.photo?.url) {
    await deleteChecklistPhotoFromStorage(result.photo.url).catch((error) => {
      console.error("[checklist-photos] storage delete failed", error);
    });
  }
  await flushDatabasePersistence();
  return NextResponse.json({ photo: result.photo, progress: getChecklistForServiceOrder(id).progress });
}

export const DELETE = withDatabase(DELETEHandler);
