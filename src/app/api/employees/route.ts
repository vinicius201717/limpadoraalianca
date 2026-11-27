import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { identitySchema } from "@/lib/user-identity-schema";
import { saveUserIdentity, IdentityError } from "@/lib/user-identity";

import { getCurrentUserFromRequest } from "@/lib/auth";
import { canAccessAllServiceOrders, canCreateEmployee, canCreateUserWithRole } from "@/lib/permissions";
import { createEmployee, db, flushDatabasePersistence, getVisibleEmployeesForUser, toPublicUser } from "@/lib/store";
import type { UserRole } from "@/lib/types";
import { newPasswordSchema } from "@/lib/password-policy";

const employeeAccessRoles = ["COLABORADOR", "SUPERVISOR_OBRA", "GERENTE", "ALMOXARIFADO"] as const;
const employeeStatuses = ["ACTIVE", "VACATION", "ON_LEAVE", "SUSPENDED", "INACTIVE", "FIRED"] as const;

const roleLabels: Record<(typeof employeeAccessRoles)[number], string> = {
  COLABORADOR: "Colaborador",
  SUPERVISOR_OBRA: "Supervisor de obra",
  GERENTE: "Gerente",
  ALMOXARIFADO: "Almoxarifado",
};

const employeeSchema = z.object({
  identity: identitySchema.optional(),
  name: z.string().min(3),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  document: z.string().optional(),
  jobTitle: z.string().optional(),
  roleName: z.string().min(2).optional(),
  specialty: z.string().min(2).optional(),
  cargo: z.enum(employeeAccessRoles).optional(),
  status: z.enum(employeeStatuses).optional(),
  dailyCost: z.coerce.number().optional(),
  hiredAt: z.string().optional(),
  notes: z.string().optional(),
  createAccess: z.boolean().optional(),
  accessRole: z.enum(employeeAccessRoles).optional(),
  temporaryPassword: newPasswordSchema.optional(),
  canViewFinancials: z.boolean().optional(),
}).strict();

async function GETHandler(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ message: "Nao autenticado." }, { status: 401 });
  if (canAccessAllServiceOrders(user.role)) return NextResponse.json({ employees: db.employees });
  return NextResponse.json({ employees: getVisibleEmployeesForUser(user) });
}

async function POSTHandler(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Nao autenticado." }, { status: 401 });
  }

  if (!canCreateEmployee(user.role)) {
    return NextResponse.json({ message: "Seu perfil nao tem permissao para criar colaboradores." }, { status: 403 });
  }

  const parsed = employeeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const createAccess = parsed.data.createAccess ?? Boolean(parsed.data.phone);
  if (createAccess && !parsed.data.phone) {
    return NextResponse.json({ message: "Informe um telefone para criar acesso ao sistema." }, { status: 400 });
  }

  const accessRole = (parsed.data.accessRole ?? parsed.data.cargo ?? "COLABORADOR") as UserRole;
  if (createAccess && !canCreateUserWithRole(user.role, accessRole)) {
    return NextResponse.json({ message: "Voce nao possui permissao para criar este cargo." }, { status: 403 });
  }

  if (createAccess && !parsed.data.temporaryPassword) {
    return NextResponse.json({ message: "Informe uma senha inicial exclusiva de pelo menos 4 caracteres." }, { status: 400 });
  }
  if (parsed.data.canViewFinancials && user.role !== "OWNER") {
    return NextResponse.json({ message: "Somente o dono pode conceder acesso financeiro." }, { status: 403 });
  }

  if (createAccess && !parsed.data.identity) return NextResponse.json({ message: "CPF e frente e verso do documento sao obrigatorios para criar acesso." }, { status: 422 });

  const cargoLabel = roleLabels[(parsed.data.cargo ?? parsed.data.accessRole ?? "COLABORADOR") as keyof typeof roleLabels] ?? "Colaborador";
  const result = createEmployee(
    {
      ...parsed.data,
      jobTitle: parsed.data.jobTitle ?? cargoLabel,
      roleName: parsed.data.roleName ?? cargoLabel,
      specialty: parsed.data.specialty ?? cargoLabel,
      hiredAt: parsed.data.hiredAt ?? new Date().toISOString().slice(0, 10),
      createAccess,
      accessRole,
      temporaryPassword: parsed.data.temporaryPassword,
    },
    user,
  );
  if (result.error === "EMAIL_EXISTS") return NextResponse.json({ message: "E-mail ja cadastrado." }, { status: 409 });
  if (result.error === "PHONE_EXISTS") return NextResponse.json({ message: "Telefone ja cadastrado." }, { status: 409 });
  if (result.error === "LOGIN_REQUIRED") return NextResponse.json({ message: "Informe telefone para criar acesso." }, { status: 400 });
  if (result.error === "DOCUMENT_EXISTS") return NextResponse.json({ message: "Documento ja cadastrado." }, { status: 409 });
  if (result.error === "INVALID_ACCESS_ROLE") {
    return NextResponse.json({ message: "Perfil inicial de acesso invalido." }, { status: 403 });
  }
  if (!result.employee) return NextResponse.json({ message: "Nao foi possivel criar colaborador." }, { status: 400 });

  if (result.user && parsed.data.identity) {
    try { await saveUserIdentity(result.user.id, parsed.data.identity, user.id); }
    catch (error) { if (error instanceof IdentityError) return NextResponse.json({ message: error.message }, { status: 422 }); throw error; }
  }
  await flushDatabasePersistence();

  return NextResponse.json(
    {
      message: "Colaborador criado com sucesso.",
      employee: result.employee,
      user: result.user ? toPublicUser(result.user) : null,
    },
    { status: 201 },
  );
}

export const GET = withDatabase(GETHandler);
export const POST = withDatabase(POSTHandler);
