import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { identitySchema } from "@/lib/user-identity-schema";
import { saveUserIdentity, IdentityError } from "@/lib/user-identity";

import { requireApiUser } from "@/lib/api-handlers";
import { canManageTargetUserRole, canPromoteEmployeeToSupervisor } from "@/lib/permissions";
import { db, flushDatabasePersistence, promoteEmployeeToSupervisor, toPublicUser } from "@/lib/store";
import { newPasswordSchema } from "@/lib/password-policy";

const promoteSchema = z.object({
  identity: identitySchema.optional(),
  email: z.string().email().optional(),
  temporaryPassword: newPasswordSchema.optional(),
});

async function POSTHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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
  const employee = db.employees.find((item) => item.id === id);
  const target = db.users.find((item) => item.id === employee?.userId);
  if (target && !canManageTargetUserRole(auth.user.role, target.role, "SUPERVISOR_OBRA")) {
    return NextResponse.json({ message: "Voce nao pode alterar o papel deste usuario." }, { status: 403 });
  }
  if (employee && !target && !parsed.data.identity) return NextResponse.json({ message: "CPF e frente e verso do documento sao obrigatorios para criar acesso." }, { status: 422 });
  if (employee && !target && !parsed.data.temporaryPassword) {
    return NextResponse.json({ message: "Informe uma senha inicial exclusiva para criar o acesso." }, { status: 400 });
  }
  const result = promoteEmployeeToSupervisor(id, auth.user, parsed.data);
  if (result.error === "NOT_FOUND") return NextResponse.json({ message: "Colaborador nao encontrado." }, { status: 404 });
  if (result.error === "EMPLOYEE_NOT_ACTIVE") {
    return NextResponse.json({ message: "Somente colaborador desligado nao pode ser promovido." }, { status: 400 });
  }
  if (result.error === "EMAIL_EXISTS") return NextResponse.json({ message: "E-mail ja cadastrado." }, { status: 409 });
  if (result.error === "PHONE_EXISTS") return NextResponse.json({ message: "Telefone ja cadastrado." }, { status: 409 });
  if (result.error === "LOGIN_REQUIRED") return NextResponse.json({ message: "Informe telefone para criar acesso." }, { status: 400 });
  if (!result.employee || !result.user) {
    return NextResponse.json({ message: "Nao foi possivel promover colaborador." }, { status: 400 });
  }

  if (!target && parsed.data.identity) {
    try { await saveUserIdentity(result.user.id, parsed.data.identity, auth.user.id); }
    catch (error) { if (error instanceof IdentityError) return NextResponse.json({ message: error.message }, { status: 422 }); throw error; }
  }
  await flushDatabasePersistence();

  return NextResponse.json({
    message: "Colaborador promovido a supervisor.",
    employee: result.employee,
    user: toPublicUser(result.user),
  });
}

export const POST = withDatabase(POSTHandler);
