import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { canCreateManager, canManageUsers } from "@/lib/permissions";
import { db, toPublicUser, updateSystemUser } from "@/lib/store";

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(["OWNER", "GERENTE", "SUPERVISOR_OBRA", "ALMOXARIFADO", "COMERCIAL", "TECNICO", "FINANCEIRO", "COLABORADOR"]).optional(),
  isActive: z.boolean().optional(),
  linkedEmployeeId: z.string().optional(),
});

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canManageUsers(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para ver usuarios." }, { status: 403 });
  }

  const { id } = await context.params;
  const user = db.users.find((item) => item.id === id);
  if (!user) return NextResponse.json({ message: "Usuario nao encontrado." }, { status: 404 });
  return NextResponse.json({ user: toPublicUser(user) });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canManageUsers(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para editar usuarios." }, { status: 403 });
  }

  const parsed = updateUserSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.role === "GERENTE" && !canCreateManager(auth.user.role)) {
    return NextResponse.json({ message: "Somente OWNER pode promover usuario para GERENTE." }, { status: 403 });
  }

  const { id } = await context.params;
  const result = updateSystemUser(id, parsed.data, auth.user);
  if (result.error === "NOT_FOUND") return NextResponse.json({ message: "Usuario nao encontrado." }, { status: 404 });
  if (result.error === "EMAIL_EXISTS") return NextResponse.json({ message: "E-mail ja cadastrado." }, { status: 409 });
  if (result.error === "SELF_ROLE_CHANGE") {
    return NextResponse.json({ message: "Voce nao pode alterar a propria role." }, { status: 403 });
  }
  if (result.error === "FORBIDDEN_ROLE") {
    return NextResponse.json({ message: "Voce nao possui permissao para alterar este perfil." }, { status: 403 });
  }
  if (result.error === "PROTECTED_OWNER") {
    return NextResponse.json({ message: "O OWNER nao pode ser alterado pelas APIs normais." }, { status: 403 });
  }
  if (result.error === "LAST_OWNER") {
    return NextResponse.json({ message: "Nao e permitido desativar o ultimo OWNER ativo." }, { status: 403 });
  }
  if (!result.user) return NextResponse.json({ message: "Nao foi possivel editar usuario." }, { status: 400 });

  return NextResponse.json({ message: "Usuario atualizado com sucesso.", user: toPublicUser(result.user) });
}
