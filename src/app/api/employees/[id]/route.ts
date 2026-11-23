import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { canEditEmployee } from "@/lib/permissions";
import { canUserAccessEmployee, db, findEmployeeByDocument, flushDatabasePersistence, recordAuditLog } from "@/lib/store";

const employeeStatuses = ["ACTIVE", "VACATION", "ON_LEAVE", "SUSPENDED", "INACTIVE", "FIRED"] as const;

const employeePatchSchema = z.object({
  name: z.string().min(3).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  document: z.string().optional(),
  jobTitle: z.string().min(2).optional(),
  roleName: z.string().min(2).optional(),
  specialty: z.string().min(2).optional(),
  status: z.enum(employeeStatuses).optional(),
  dailyCost: z.coerce.number().finite().nonnegative().optional(),
  hiredAt: z.string().optional(),
  notes: z.string().optional(),
}).strict();

async function GETHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const employee = db.employees.find((item) => item.id === id);
  if (!employee) return NextResponse.json({ message: "Colaborador nao encontrado." }, { status: 404 });
  if (!canUserAccessEmployee(auth.user, id)) {
    return NextResponse.json({ message: "Perfil sem permissao para ver este colaborador." }, { status: 403 });
  }

  return NextResponse.json({ employee });
}

async function PATCHHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canEditEmployee(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para editar colaboradores." }, { status: 403 });
  }

  const parsed = employeePatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await context.params;
  const employee = db.employees.find((item) => item.id === id);
  if (!employee) return NextResponse.json({ message: "Colaborador nao encontrado." }, { status: 404 });
  const targetUser = db.users.find((item) => item.id === employee.userId);
  if (targetUser && (targetUser.role === "OWNER" || (auth.user.role === "GERENTE" && targetUser.role === "GERENTE"))) {
    return NextResponse.json({ message: "Este perfil deve ser administrado pelo dono na area de usuarios." }, { status: 403 });
  }
  const existingDocument = findEmployeeByDocument(parsed.data.document);
  if (existingDocument && existingDocument.id !== employee.id) {
    return NextResponse.json({ message: "Documento ja cadastrado." }, { status: 409 });
  }

  const oldValueJson = { ...employee };
  Object.assign(employee, parsed.data, {
    roleName: parsed.data.roleName ?? parsed.data.jobTitle ?? employee.roleName,
    jobTitle: parsed.data.jobTitle ?? parsed.data.roleName ?? employee.jobTitle,
  });
  recordAuditLog({
    userId: auth.user.id,
    action: "UPDATE_EMPLOYEE",
    entity: "Employee",
    entityId: employee.id,
    oldValueJson,
    newValueJson: employee,
  });
  await flushDatabasePersistence();

  return NextResponse.json({ employee });
}

async function DELETEHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canEditEmployee(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para remover colaboradores." }, { status: 403 });
  }

  const { id } = await context.params;
  const index = db.employees.findIndex((item) => item.id === id);
  if (index === -1) return NextResponse.json({ message: "Colaborador nao encontrado." }, { status: 404 });
  const employee = db.employees[index];
  if (db.serviceOrders.some((order) => !["DONE", "DELIVERED", "CANCELED"].includes(order.status) && (order.employeeIds.includes(id) || order.supervisorEmployeeId === id))) return NextResponse.json({ message: "Remova o colaborador das equipes ativas antes de inativar." }, { status: 409 });
  const linkedUser = db.users.find((user) => user.id === employee.userId);
  if (linkedUser && (linkedUser.role === "OWNER" || (linkedUser.role === "GERENTE" && auth.user.role !== "OWNER"))) return NextResponse.json({ message: "Este acesso é protegido." }, { status: 403 });
  const previous = { ...employee };
  employee.status = "INACTIVE";
  if (linkedUser) { linkedUser.isActive = false; linkedUser.sessionVersion = (linkedUser.sessionVersion ?? 0) + 1; }
  recordAuditLog({
    userId: auth.user.id,
    action: "ARCHIVE_EMPLOYEE",
    entity: "Employee",
    entityId: employee.id,
    oldValueJson: previous,
    newValueJson: { status: "INACTIVE" },
  });
  await flushDatabasePersistence();

  return NextResponse.json({ ok: true });
}

export const GET = withDatabase(GETHandler);
export const PATCH = withDatabase(PATCHHandler);
export const DELETE = withDatabase(DELETEHandler);
