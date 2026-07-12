import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { canEditEmployee } from "@/lib/permissions";
import { canUserAccessEmployee, db, findEmployeeByDocument, recordAuditLog } from "@/lib/store";

const employeePatchSchema = z.object({
  userId: z.string().optional(),
  name: z.string().min(3).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  document: z.string().optional(),
  jobTitle: z.string().min(2).optional(),
  roleName: z.string().min(2).optional(),
  specialty: z.string().min(2).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ON_LEAVE", "FIRED"]).optional(),
  dailyCost: z.coerce.number().optional(),
  hiredAt: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

  return NextResponse.json({ employee });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canEditEmployee(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para remover colaboradores." }, { status: 403 });
  }

  const { id } = await context.params;
  const index = db.employees.findIndex((item) => item.id === id);
  if (index === -1) return NextResponse.json({ message: "Colaborador nao encontrado." }, { status: 404 });
  const [employee] = db.employees.splice(index, 1);
  recordAuditLog({
    userId: auth.user.id,
    action: "DELETE_EMPLOYEE",
    entity: "Employee",
    entityId: employee.id,
    oldValueJson: employee,
  });

  return NextResponse.json({ ok: true });
}
