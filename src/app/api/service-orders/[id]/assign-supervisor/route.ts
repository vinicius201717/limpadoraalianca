import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { canAssignSupervisorToServiceOrder } from "@/lib/permissions";
import { assignSupervisorToServiceOrder, flushDatabasePersistence, removeSupervisorFromServiceOrder, sanitizeServiceOrderForRole } from "@/lib/store";

const assignSupervisorSchema = z.object({
  supervisorEmployeeId: z.string(),
});

async function POSTHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canAssignSupervisorToServiceOrder(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para designar supervisor." }, { status: 403 });
  }

  const parsed = assignSupervisorSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await context.params;
  const result = assignSupervisorToServiceOrder(id, parsed.data.supervisorEmployeeId, auth.user);
  if (result.error === "NOT_FOUND") return NextResponse.json({ message: "OS ou supervisor nao encontrado." }, { status: 404 });
  if (result.error === "INVALID_SUPERVISOR") {
    return NextResponse.json({ message: "Supervisor precisa ser colaborador ativo com acesso SUPERVISOR_OBRA." }, { status: 400 });
  }
  if (result.error === "TEAM_CONFLICT") {
    return NextResponse.json(
      {
        message: `Este supervisor ja esta escalado em outra OS ativa: ${result.conflict.title}. Remova da outra equipe antes de adicionar aqui.`,
        conflict: { serviceOrderId: result.conflict.id, title: result.conflict.title },
      },
      { status: 409 },
    );
  }
  if (!result.serviceOrder) return NextResponse.json({ message: "Nao foi possivel designar supervisor." }, { status: 400 });

  await flushDatabasePersistence();

  return NextResponse.json({ message: "Supervisor designado para a obra.", serviceOrder: sanitizeServiceOrderForRole(auth.user, result.serviceOrder) });
}

async function DELETEHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canAssignSupervisorToServiceOrder(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para remover supervisor." }, { status: 403 });
  }

  const { id } = await context.params;
  const result = removeSupervisorFromServiceOrder(id, auth.user);
  if (result.error === "NOT_FOUND") return NextResponse.json({ message: "OS nao encontrada." }, { status: 404 });
  if (!result.serviceOrder) return NextResponse.json({ message: "Nao foi possivel remover supervisor." }, { status: 400 });

  await flushDatabasePersistence();

  return NextResponse.json({ message: "Supervisor removido da obra.", serviceOrder: sanitizeServiceOrderForRole(auth.user, result.serviceOrder) });
}

export const POST = withDatabase(POSTHandler);
export const DELETE = withDatabase(DELETEHandler);
