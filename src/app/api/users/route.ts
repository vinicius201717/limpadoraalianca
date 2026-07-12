import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { canCreateManager, canCreateUserWithRole, canManageUsers } from "@/lib/permissions";
import { createSystemUser, db, recordAuditLog, toPublicUser, toPublicUsers } from "@/lib/store";

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["OWNER", "GERENTE", "SUPERVISOR_OBRA", "ALMOXARIFADO", "COMERCIAL", "TECNICO", "FINANCEIRO", "COLABORADOR"]),
  isActive: z.boolean().optional(),
  linkedEmployeeId: z.string().optional(),
  temporaryPassword: z.string().min(6).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canManageUsers(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para listar usuarios." }, { status: 403 });
  }

  return NextResponse.json({ users: toPublicUsers(db.users) });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canManageUsers(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para criar usuarios." }, { status: 403 });
  }

  const parsed = userSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  if (!canCreateUserWithRole(auth.user.role, parsed.data.role)) {
    return NextResponse.json({ message: "Voce nao possui permissao para criar este perfil." }, { status: 403 });
  }

  if (parsed.data.role === "GERENTE" && !canCreateManager(auth.user.role)) {
    return NextResponse.json({ message: "Somente OWNER pode criar gerente." }, { status: 403 });
  }

  const result = createSystemUser(parsed.data);
  if (result.error === "EMAIL_EXISTS") {
    return NextResponse.json({ message: "E-mail ja cadastrado." }, { status: 409 });
  }
  if (!result.user) {
    return NextResponse.json({ message: "Nao foi possivel criar usuario." }, { status: 400 });
  }

  recordAuditLog({
    userId: auth.user.id,
    action: parsed.data.role === "GERENTE" ? "CREATE_MANAGER" : "CREATE_USER",
    entity: "User",
    entityId: result.user.id,
    newValueJson: { role: result.user.role, email: result.user.email },
  });

  return NextResponse.json({ message: "Usuario criado com sucesso.", user: toPublicUser(result.user) }, { status: 201 });
}
