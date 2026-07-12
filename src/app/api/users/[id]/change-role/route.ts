import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { canCreateManager, canManageUsers } from "@/lib/permissions";
import { changeUserRole, toPublicUser } from "@/lib/store";

const changeRoleSchema = z.object({
  role: z.enum(["OWNER", "GERENTE", "SUPERVISOR_OBRA", "ALMOXARIFADO", "COMERCIAL", "TECNICO", "FINANCEIRO", "COLABORADOR"]),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canManageUsers(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para alterar permissoes." }, { status: 403 });
  }

  const parsed = changeRoleSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.role === "GERENTE" && !canCreateManager(auth.user.role)) {
    return NextResponse.json({ message: "Somente OWNER pode promover usuario para GERENTE." }, { status: 403 });
  }
  if (parsed.data.role === "OWNER") {
    return NextResponse.json({ message: "Mudanca para OWNER esta bloqueada por padrao." }, { status: 403 });
  }

  const { id } = await context.params;
  if (id === auth.user.id) {
    return NextResponse.json({ message: "Voce nao pode alterar a propria role." }, { status: 403 });
  }
  const user = changeUserRole(id, parsed.data.role, auth.user);
  if (!user) return NextResponse.json({ message: "Usuario nao encontrado ou alteracao sem permissao." }, { status: 404 });

  return NextResponse.json({ message: "Perfil alterado com sucesso.", user: toPublicUser(user) });
}
