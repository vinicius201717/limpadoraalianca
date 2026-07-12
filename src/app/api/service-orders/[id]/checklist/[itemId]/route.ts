import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { canManageChecklistForOrder, getOrderAndChecklistItem } from "@/lib/checklist-access";
import { requireApiUser } from "@/lib/api-handlers";
import { canEditChecklist } from "@/lib/permissions";
import { deleteOrCancelChecklistItem, getChecklistForServiceOrder, updateChecklistItem } from "@/lib/store";

const updateChecklistItemSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isRequired: z.boolean().optional(),
  isPriority: z.boolean().optional(),
  requiresPhoto: z.boolean().optional(),
  minimumPhotos: z.coerce.number().int().min(0).max(20).optional(),
  assignedEmployeeId: z.string().optional(),
  assignedEmployeeIds: z.array(z.string()).optional(),
  completionNotes: z.string().optional(),
  problemDescription: z.string().optional(),
  blockedReason: z.string().optional(),
  notes: z.string().optional(),
  plannedStartAt: z.string().optional(),
  dueAt: z.string().optional(),
  allowCollaboratorAction: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> },
) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const { id, itemId } = await context.params;
  const { order, item } = getOrderAndChecklistItem(id, itemId);
  if (!order || !item) return NextResponse.json({ message: "OS ou item nao encontrado." }, { status: 404 });
  if (!canEditChecklist(auth.user.role) || !canManageChecklistForOrder(auth.user, order)) {
    return NextResponse.json({ message: "Perfil sem permissao para editar checklist." }, { status: 403 });
  }

  const parsed = updateChecklistItemSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const result = updateChecklistItem(id, itemId, parsed.data, auth.user);
  if (result.error === "EMPLOYEE_NOT_IN_TEAM") {
    return NextResponse.json({ message: "Colaborador precisa estar ativo e vinculado a equipe da OS." }, { status: 400 });
  }
  if (!result.item) return NextResponse.json({ message: "Nao foi possivel editar item." }, { status: 400 });

  return NextResponse.json({ item: result.item, progress: getChecklistForServiceOrder(id).progress });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> },
) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const { id, itemId } = await context.params;
  const { order, item } = getOrderAndChecklistItem(id, itemId);
  if (!order || !item) return NextResponse.json({ message: "OS ou item nao encontrado." }, { status: 404 });
  if (!canEditChecklist(auth.user.role) || !canManageChecklistForOrder(auth.user, order)) {
    return NextResponse.json({ message: "Perfil sem permissao para remover checklist." }, { status: 403 });
  }

  const result = deleteOrCancelChecklistItem(id, itemId, auth.user);
  if (!result.item) return NextResponse.json({ message: "Nao foi possivel remover item." }, { status: 400 });

  return NextResponse.json({
    item: result.item,
    deleted: result.deleted,
    progress: getChecklistForServiceOrder(id).progress,
  });
}
