import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { canManageServiceOrderTeam } from "@/lib/permissions";
import { authorizeServiceOrderAccess, ServiceOrderAuthorizationError } from "@/lib/service-order-access";
import { db, recordAuditLog } from "@/lib/store";
import type { ServiceOrderEmployee } from "@/lib/types";

const teamSchema = z.object({
  employeeId: z.string(),
  roleInService: z.enum(["SUPERVISOR", "POLIDOR", "AUXILIAR", "TECNICO", "MOTORISTA", "ALMOXARIFADO", "OUTRO"]).optional(),
});

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  try {
    authorizeServiceOrderAccess(auth.user, id, "team");
  } catch (error) {
    if (error instanceof ServiceOrderAuthorizationError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    throw error;
  }

  const links = db.serviceOrderEmployees.filter((item) => item.serviceOrderId === id);
  const employees = links.map((link) => ({
    ...link,
    employee: db.employees.find((employee) => employee.id === link.employeeId),
  }));
  return NextResponse.json({ employees });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canManageServiceOrderTeam(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para montar equipe." }, { status: 403 });
  }

  const parsed = teamSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await context.params;
  const order = db.serviceOrders.find((item) => item.id === id);
  const employee = db.employees.find((item) => item.id === parsed.data.employeeId);
  if (!order || !employee) return NextResponse.json({ message: "OS ou colaborador nao encontrado." }, { status: 404 });

  if (!order.employeeIds.includes(employee.id)) order.employeeIds.push(employee.id);
  let link = db.serviceOrderEmployees.find((item) => item.serviceOrderId === id && item.employeeId === employee.id);
  if (!link) {
    link = {
      id: `soe-${Date.now()}`,
      serviceOrderId: id,
      employeeId: employee.id,
      roleInService: parsed.data.roleInService ?? "OUTRO",
      assignedByUserId: auth.user.id,
      assignedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies ServiceOrderEmployee;
    db.serviceOrderEmployees.unshift(link);
  } else {
    link.roleInService = parsed.data.roleInService ?? link.roleInService;
    link.updatedAt = new Date().toISOString();
  }

  recordAuditLog({
    userId: auth.user.id,
    action: "ASSIGN_SERVICE_ORDER_EMPLOYEE",
    entity: "ServiceOrderEmployee",
    entityId: link.id,
    newValueJson: link,
  });

  return NextResponse.json({ employee: link }, { status: 201 });
}
