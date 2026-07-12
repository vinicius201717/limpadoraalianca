import { NextResponse, type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/api-handlers";
import { canPromoteEmployeeToSupervisor } from "@/lib/permissions";
import { removeSupervisorRole, toPublicUser } from "@/lib/store";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canPromoteEmployeeToSupervisor(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para remover funcao de supervisor." }, { status: 403 });
  }

  const { id } = await context.params;
  const result = removeSupervisorRole(id, auth.user);
  if (result.error === "NOT_FOUND") return NextResponse.json({ message: "Colaborador nao encontrado." }, { status: 404 });
  if (result.error === "NO_USER") return NextResponse.json({ message: "Colaborador sem acesso ao sistema." }, { status: 400 });
  if (result.error === "NOT_SUPERVISOR") return NextResponse.json({ message: "Colaborador nao possui funcao de supervisor." }, { status: 400 });
  if (!result.employee || !result.user) {
    return NextResponse.json({ message: "Nao foi possivel remover funcao de supervisor." }, { status: 400 });
  }

  return NextResponse.json({
    message: "Funcao de supervisor removida.",
    employee: result.employee,
    user: toPublicUser(result.user),
  });
}
