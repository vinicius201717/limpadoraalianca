import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { canManageChecklistForOrder, getOrderAndChecklistItem } from "@/lib/checklist-access";
import { requireApiUser } from "@/lib/api-handlers";
import { canOperateChecklist } from "@/lib/permissions";
import { assignChecklistItem, getChecklistForServiceOrder } from "@/lib/store";

const assignSchema = z.object({
  employeeId: z.string().optional(),
  employeeIds: z.array(z.string()).optional(),
}).refine((value) => Boolean(value.employeeId || value.employeeIds?.length), {
  message: "Informe pelo menos um colaborador.",
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; itemId: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  const { id, itemId } = await context.params;
  const { order, item } = getOrderAndChecklistItem(id, itemId);
  if (!order || !item) return NextResponse.json({ message: "OS ou item nao encontrado." }, { status: 404 });
  if (!canOperateChecklist(auth.user.role) || !canManageChecklistForOrder(auth.user, order)) {
    return NextResponse.json({ message: "Perfil sem permissao para atribuir responsavel." }, { status: 403 });
  }
  const parsed = assignSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  const result = assignChecklistItem(id, itemId, parsed.data.employeeIds ?? (parsed.data.employeeId ? [parsed.data.employeeId] : []), auth.user);
  if (result.error === "EMPLOYEE_NOT_IN_TEAM") {
    return NextResponse.json({ message: "Colaborador precisa estar ativo e fazer parte da equipe da OS." }, { status: 400 });
  }
  return NextResponse.json({ item: result.item, progress: getChecklistForServiceOrder(id).progress });
}
