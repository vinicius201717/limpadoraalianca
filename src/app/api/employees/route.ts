import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUserFromRequest } from "@/lib/auth";
import { canAccessAllServiceOrders, canCreateEmployee, canCreateUserWithRole } from "@/lib/permissions";
import { createEmployee, db, getAccessibleServiceOrders, getLinkedEmployeeId, toPublicUser } from "@/lib/store";
import type { UserRole } from "@/lib/types";

const employeeAccessRoles = ["COLABORADOR", "SUPERVISOR_OBRA", "GERENTE", "ALMOXARIFADO"] as const;

const roleLabels: Record<(typeof employeeAccessRoles)[number], string> = {
  COLABORADOR: "Colaborador",
  SUPERVISOR_OBRA: "Supervisor de obra",
  GERENTE: "Gerente",
  ALMOXARIFADO: "Almoxarifado",
};

const employeeSchema = z.object({
  name: z.string().min(3),
  userId: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  document: z.string().optional(),
  jobTitle: z.string().optional(),
  roleName: z.string().min(2).optional(),
  specialty: z.string().min(2).optional(),
  cargo: z.enum(employeeAccessRoles).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ON_LEAVE", "FIRED"]).optional(),
  dailyCost: z.coerce.number().optional(),
  hiredAt: z.string().optional(),
  notes: z.string().optional(),
  createAccess: z.boolean().optional(),
  accessRole: z.enum(employeeAccessRoles).optional(),
  temporaryPassword: z.string().min(6).optional(),
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ message: "Nao autenticado." }, { status: 401 });
  if (canAccessAllServiceOrders(user.role)) return NextResponse.json({ employees: db.employees });

  const linkedEmployeeId = getLinkedEmployeeId(user);
  const accessibleOrders = getAccessibleServiceOrders(user);
  const allowedEmployeeIds = new Set(accessibleOrders.flatMap((order) => order.employeeIds));
  if (linkedEmployeeId) allowedEmployeeIds.add(linkedEmployeeId);

  return NextResponse.json({ employees: db.employees.filter((employee) => allowedEmployeeIds.has(employee.id)) });
}

export async function POST(request: NextRequest) {
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

  if (parsed.data.createAccess && !parsed.data.email) {
    return NextResponse.json({ message: "Informe um e-mail para criar acesso ao sistema." }, { status: 400 });
  }

  const accessRole = (parsed.data.accessRole ?? parsed.data.cargo ?? "COLABORADOR") as UserRole;
  if ((parsed.data.createAccess ?? Boolean(parsed.data.email)) && !canCreateUserWithRole(user.role, accessRole)) {
    return NextResponse.json({ message: "Voce nao possui permissao para criar este cargo." }, { status: 403 });
  }

  const cargoLabel = roleLabels[(parsed.data.cargo ?? parsed.data.accessRole ?? "COLABORADOR") as keyof typeof roleLabels] ?? "Colaborador";
  const result = createEmployee(
    {
      ...parsed.data,
      jobTitle: parsed.data.jobTitle ?? cargoLabel,
      roleName: parsed.data.roleName ?? cargoLabel,
      specialty: parsed.data.specialty ?? cargoLabel,
      hiredAt: parsed.data.hiredAt ?? new Date().toISOString().slice(0, 10),
      createAccess: parsed.data.createAccess ?? Boolean(parsed.data.email),
      accessRole,
      temporaryPassword: parsed.data.temporaryPassword ?? "123456",
    },
    user,
  );
  if (result.error === "EMAIL_EXISTS") return NextResponse.json({ message: "E-mail ja cadastrado." }, { status: 409 });
  if (result.error === "DOCUMENT_EXISTS") return NextResponse.json({ message: "Documento ja cadastrado." }, { status: 409 });
  if (result.error === "INVALID_ACCESS_ROLE") {
    return NextResponse.json({ message: "Perfil inicial de acesso invalido." }, { status: 403 });
  }
  if (!result.employee) return NextResponse.json({ message: "Nao foi possivel criar colaborador." }, { status: 400 });

  return NextResponse.json(
    {
      message: "Colaborador criado com sucesso.",
      employee: result.employee,
      user: result.user ? toPublicUser(result.user) : null,
    },
    { status: 201 },
  );
}
