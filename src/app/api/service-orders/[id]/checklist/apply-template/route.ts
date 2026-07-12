import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { canManageChecklistForOrder } from "@/lib/checklist-access";
import { requireApiUser } from "@/lib/api-handlers";
import { canCreateChecklist } from "@/lib/permissions";
import { applyChecklistTemplate, db, getChecklistForServiceOrder } from "@/lib/store";

const applyTemplateSchema = z.object({
  templateId: z.string(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const order = db.serviceOrders.find((item) => item.id === id);
  if (!order) return NextResponse.json({ message: "OS nao encontrada." }, { status: 404 });
  if (!canCreateChecklist(auth.user.role) || !canManageChecklistForOrder(auth.user, order)) {
    return NextResponse.json({ message: "Perfil sem permissao para aplicar template." }, { status: 403 });
  }

  const parsed = applyTemplateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });

  const result = applyChecklistTemplate(id, parsed.data.templateId, auth.user);
  if (result.error === "NOT_FOUND") return NextResponse.json({ message: "OS ou template nao encontrado." }, { status: 404 });
  if (result.error === "EMPTY_TEMPLATE") return NextResponse.json({ message: "Template sem itens." }, { status: 400 });
  return NextResponse.json({ items: result.items, progress: getChecklistForServiceOrder(id).progress });
}
