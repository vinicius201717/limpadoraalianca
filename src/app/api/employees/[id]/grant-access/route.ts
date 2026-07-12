import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { canCreateUserWithRole, canManageEmployeeUserAccess } from "@/lib/permissions";
import { grantEmployeeAccess, toPublicUser } from "@/lib/store";

const grantAccessSchema = z.object({
  email: z.string().email(),
  role: z.enum(["COLABORADOR", "SUPERVISOR_OBRA", "GERENTE", "ALMOXARIFADO"]).default("COLABORADOR"),
  temporaryPassword: z.string().min(6).optional(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canManageEmployeeUserAccess(auth.user.role)) {
    return NextResponse.json({ message: "Voce nao possui permissao para executar esta acao." }, { status: 403 });
  }

  const parsed = grantAccessSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }
  if (!canCreateUserWithRole(auth.user.role, parsed.data.role)) {
    return NextResponse.json({ message: "Voce nao possui permissao para criar este cargo." }, { status: 403 });
  }

  const { id } = await context.params;
  const result = grantEmployeeAccess(id, parsed.data, auth.user);
  if (result.error === "NOT_FOUND") return NextResponse.json({ message: "Colaborador nao encontrado." }, { status: 404 });
  if (result.error === "ALREADY_HAS_ACCESS") {
    return NextResponse.json({ message: "Colaborador ja possui acesso ao sistema." }, { status: 409 });
  }
  if (result.error === "EMAIL_EXISTS") return NextResponse.json({ message: "E-mail ja cadastrado." }, { status: 409 });
  if (result.error === "EMPLOYEE_NOT_ACTIVE") {
    return NextResponse.json({ message: "Somente colaborador ativo pode receber acesso." }, { status: 400 });
  }
  if (result.error === "INVALID_ACCESS_ROLE") {
    return NextResponse.json({ message: "Perfil inicial de acesso invalido." }, { status: 403 });
  }
  if (!result.employee || !result.user) return NextResponse.json({ message: "Nao foi possivel criar acesso." }, { status: 400 });

  return NextResponse.json({
    message: "Acesso criado com sucesso.",
    employee: result.employee,
    user: toPublicUser(result.user),
  }, { status: 201 });
}
