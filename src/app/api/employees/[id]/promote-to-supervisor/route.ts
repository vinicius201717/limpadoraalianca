import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { canPromoteEmployeeToSupervisor } from "@/lib/permissions";
import { promoteEmployeeToSupervisor, toPublicUser } from "@/lib/store";

const promoteSchema = z.object({
  email: z.string().email().optional(),
  temporaryPassword: z.string().min(6).optional(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canPromoteEmployeeToSupervisor(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para promover supervisor." }, { status: 403 });
  }

  const parsed = promoteSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await context.params;
  const result = promoteEmployeeToSupervisor(id, auth.user, parsed.data);
  if (result.error === "NOT_FOUND") return NextResponse.json({ message: "Colaborador nao encontrado." }, { status: 404 });
  if (result.error === "EMPLOYEE_NOT_ACTIVE") {
    return NextResponse.json({ message: "Somente colaborador desligado nao pode ser promovido." }, { status: 400 });
  }
  if (result.error === "EMAIL_EXISTS") return NextResponse.json({ message: "E-mail ja cadastrado." }, { status: 409 });
  if (result.error === "INVALID_ACCESS_ROLE") {
    return NextResponse.json({ message: "Perfil inicial de acesso invalido." }, { status: 403 });
  }
  if (!result.employee || !result.user) {
    return NextResponse.json({ message: "Nao foi possivel promover colaborador." }, { status: 400 });
  }

  return NextResponse.json({
    message: "Colaborador promovido a supervisor.",
    employee: result.employee,
    user: toPublicUser(result.user),
  });
}
