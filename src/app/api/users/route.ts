import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { newPasswordSchema } from "@/lib/password-policy";

import { requireApiUser } from "@/lib/api-handlers";
import { canCreateManager, canCreateUserWithRole, canManageUsers } from "@/lib/permissions";
import { createSystemUser, db, flushDatabasePersistence, recordAuditLog, toPublicUser, toPublicUsers } from "@/lib/store";

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(8),
  role: z.enum(["OWNER", "GERENTE", "SUPERVISOR_OBRA", "ALMOXARIFADO", "COMERCIAL", "TECNICO", "FINANCEIRO", "COLABORADOR"]),
  isActive: z.boolean().optional(),
  linkedEmployeeId: z.string().optional(),
  temporaryPassword: newPasswordSchema,
  canViewFinancials: z.boolean().optional(),
});

async function GETHandler(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canManageUsers(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para listar usuarios." }, { status: 403 });
  }

  return NextResponse.json({ users: toPublicUsers(db.users) });
}

async function POSTHandler(request: NextRequest) {
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

  if (parsed.data.canViewFinancials && auth.user.role !== "OWNER") return NextResponse.json({ message: "Somente OWNER pode conceder acesso financeiro." }, { status: 403 });
  const result = createSystemUser(parsed.data);
  if (result.error === "EMAIL_EXISTS") {
    return NextResponse.json({ message: "E-mail ja cadastrado." }, { status: 409 });
  }
  if (result.error === "PHONE_EXISTS") {
    return NextResponse.json({ message: "Telefone ja cadastrado." }, { status: 409 });
  }
  if (result.error === "LOGIN_REQUIRED") {
    return NextResponse.json({ message: "Informe telefone para criar o acesso." }, { status: 400 });
  }
  if (!result.user) {
    return NextResponse.json({ message: "Nao foi possivel criar usuario." }, { status: 400 });
  }

  recordAuditLog({
    userId: auth.user.id,
    action: parsed.data.role === "GERENTE" ? "CREATE_MANAGER" : "CREATE_USER",
    entity: "User",
    entityId: result.user.id,
    newValueJson: { role: result.user.role, email: result.user.email, phone: result.user.phone },
  });

  await flushDatabasePersistence();

  return NextResponse.json({ message: "Usuario criado com sucesso.", user: toPublicUser(result.user) }, { status: 201 });
}

export const GET = withDatabase(GETHandler);
export const POST = withDatabase(POSTHandler);
