import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { canManageChecklistForOrder } from "@/lib/checklist-access";
import { requireApiUser } from "@/lib/api-handlers";
import { canCreateChecklist } from "@/lib/permissions";
import { authorizeServiceOrderAccess, ServiceOrderAuthorizationError } from "@/lib/service-order-access";
import { createChecklistItem, db, getChecklistForServiceOrder } from "@/lib/store";

const checklistItemSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional().default(""),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isRequired: z.boolean().optional().default(true),
  isPriority: z.boolean().optional().default(false),
  requiresPhoto: z.boolean().optional().default(false),
  minimumPhotos: z.coerce.number().int().min(0).max(20).optional(),
  assignedEmployeeId: z.string().optional(),
  assignedEmployeeIds: z.array(z.string()).optional(),
  plannedStartAt: z.string().optional(),
  dueAt: z.string().optional(),
  allowCollaboratorAction: z.boolean().optional().default(false),
});

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  try {
    authorizeServiceOrderAccess(auth.user, id, "checklist");
  } catch (error) {
    if (error instanceof ServiceOrderAuthorizationError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    throw error;
  }

  return NextResponse.json(getChecklistForServiceOrder(id));
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const order = db.serviceOrders.find((item) => item.id === id);
  if (!order) return NextResponse.json({ message: "OS nao encontrada." }, { status: 404 });
  if (!canCreateChecklist(auth.user.role) || !canManageChecklistForOrder(auth.user, order)) {
    return NextResponse.json({ message: "Perfil sem permissao para criar checklist." }, { status: 403 });
  }

  const parsed = checklistItemSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const result = createChecklistItem(id, parsed.data, auth.user);
  if (result.error === "EMPLOYEE_NOT_IN_TEAM") {
    return NextResponse.json({ message: "Colaborador precisa estar ativo e vinculado a equipe da OS." }, { status: 400 });
  }
  if (!result.item) return NextResponse.json({ message: "Nao foi possivel criar item." }, { status: 400 });

  return NextResponse.json({ item: result.item, progress: getChecklistForServiceOrder(id).progress }, { status: 201 });
}
