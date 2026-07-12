import { NextResponse, type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/api-handlers";
import { canEditEmployee } from "@/lib/permissions";
import { db, recordAuditLog } from "@/lib/store";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  if (!canEditEmployee(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para ativar colaboradores." }, { status: 403 });
  }

  const { id } = await context.params;
  const employee = db.employees.find((item) => item.id === id);
  if (!employee) return NextResponse.json({ message: "Colaborador nao encontrado." }, { status: 404 });
  const oldValueJson = { status: employee.status };
  employee.status = "ACTIVE";
  recordAuditLog({
    userId: auth.user.id,
    action: "ACTIVATE_EMPLOYEE",
    entity: "Employee",
    entityId: employee.id,
    oldValueJson,
    newValueJson: { status: employee.status },
  });

  return NextResponse.json({ message: "Colaborador ativado com sucesso.", employee });
}
