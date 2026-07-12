import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { canOperateChecklistItemForOrder, getOrderAndChecklistItem } from "@/lib/checklist-access";
import { requireApiUser } from "@/lib/api-handlers";
import { canOperateChecklist } from "@/lib/permissions";
import { addChecklistPhoto, getChecklistForServiceOrder } from "@/lib/store";

const photoSchema = z.object({
  url: z.string().min(1),
  type: z.enum(["BEFORE", "DURING", "AFTER", "EVIDENCE", "PROBLEM"]).optional(),
  caption: z.string().optional(),
  employeeId: z.string().optional(),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
  sizeBytes: z.coerce.number().int().positive().optional(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; itemId: string }> }) {
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
  const result = addChecklistPhoto(id, itemId, parsed.data, auth.user);
  if (result.error === "EMPLOYEE_NOT_IN_TEAM") return NextResponse.json({ message: "Colaborador nao pertence a equipe." }, { status: 400 });
  if (result.error === "INVALID_PHOTO") return NextResponse.json({ message: "Foto invalida. Use JPEG, PNG ou WebP em upload local, /uploads ou /demo." }, { status: 400 });
  return NextResponse.json({ photo: result.photo, progress: getChecklistForServiceOrder(id).progress }, { status: 201 });
}
