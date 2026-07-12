import "server-only";

import { getPrisma } from "@/lib/prisma";
import { canManageServiceOrderTeam } from "@/lib/permissions";
import type { ServiceOrderEmployee, ServiceTeamRole, SessionUser } from "@/lib/types";

import { recordPrismaAuditLog } from "./audit-log.repository";
import { getPrismaServiceOrderForUser } from "./service-orders.repository";

type ServiceOrderEmployeeRow = {
  id: string;
  serviceOrderId: string;
  employeeId: string;
  roleInService: ServiceTeamRole;
  assignedByUserId: string | null;
  assignedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

function toServiceOrderEmployee(row: ServiceOrderEmployeeRow): ServiceOrderEmployee {
  return {
    id: row.id,
    serviceOrderId: row.serviceOrderId,
    employeeId: row.employeeId,
    roleInService: row.roleInService,
    assignedByUserId: row.assignedByUserId ?? "",
    assignedAt: row.assignedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listPrismaServiceOrderTeam(serviceOrderId: string, actor: SessionUser) {
  const prisma = getPrisma();
  const allowedOrder = await getPrismaServiceOrderForUser(serviceOrderId, actor);
  if (!allowedOrder) return { employees: [], error: "NOT_FOUND" as const };

  const rows = (await prisma.serviceOrderEmployee.findMany({
    where: { serviceOrderId },
    orderBy: { assignedAt: "asc" },
    select: {
      id: true,
      serviceOrderId: true,
      employeeId: true,
      roleInService: true,
      assignedByUserId: true,
      assignedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  })) as ServiceOrderEmployeeRow[];

  return { employees: rows.map(toServiceOrderEmployee), error: null };
}

export async function addPrismaEmployeeToServiceOrder(
  serviceOrderId: string,
  employeeId: string,
  roleInService: ServiceTeamRole,
  actor: SessionUser,
) {
  const prisma = getPrisma();
  if (!canManageServiceOrderTeam(actor.role)) return { employee: null, error: "FORBIDDEN" as const };

  const [serviceOrder, employee] = await Promise.all([
    prisma.serviceOrder.findUnique({ where: { id: serviceOrderId }, select: { id: true } }),
    prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, status: true } }),
  ]);

  if (!serviceOrder) return { employee: null, error: "SERVICE_ORDER_NOT_FOUND" as const };
  if (!employee) return { employee: null, error: "EMPLOYEE_NOT_FOUND" as const };
  if (employee.status !== "ACTIVE") return { employee: null, error: "EMPLOYEE_NOT_ACTIVE" as const };

  const row = (await prisma.serviceOrderEmployee.upsert({
    where: {
      serviceOrderId_employeeId: {
        serviceOrderId,
        employeeId,
      },
    },
    update: {
      roleInService,
      assignedByUserId: actor.id,
      assignedAt: new Date(),
    },
    create: {
      serviceOrderId,
      employeeId,
      roleInService,
      assignedByUserId: actor.id,
    },
    select: {
      id: true,
      serviceOrderId: true,
      employeeId: true,
      roleInService: true,
      assignedByUserId: true,
      assignedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  })) as ServiceOrderEmployeeRow;

  await recordPrismaAuditLog({
    userId: actor.id,
    action: "ADD_SERVICE_ORDER_EMPLOYEE",
    entity: "ServiceOrder",
    entityId: serviceOrderId,
    newValueJson: { employeeId, roleInService },
  });

  return { employee: toServiceOrderEmployee(row), error: null };
}

export async function removePrismaEmployeeFromServiceOrder(serviceOrderId: string, employeeId: string, actor: SessionUser) {
  const prisma = getPrisma();
  if (!canManageServiceOrderTeam(actor.role)) return { removed: false, error: "FORBIDDEN" as const };

  await prisma.serviceOrderEmployee.delete({
    where: {
      serviceOrderId_employeeId: {
        serviceOrderId,
        employeeId,
      },
    },
  });

  await recordPrismaAuditLog({
    userId: actor.id,
    action: "REMOVE_SERVICE_ORDER_EMPLOYEE",
    entity: "ServiceOrder",
    entityId: serviceOrderId,
    oldValueJson: { employeeId },
  });

  return { removed: true, error: null };
}
