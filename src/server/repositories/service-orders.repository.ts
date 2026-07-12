import "server-only";

import type {
  MaterialRequestStatus as PrismaMaterialRequestStatus,
  Prisma,
  ServiceOrderEquipmentStatus as PrismaServiceOrderEquipmentStatus,
  ServiceOrderMaterialStatus as PrismaServiceOrderMaterialStatus,
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import {
  canAccessAllServiceOrders,
  canManageServiceOrderTeam,
  canUpdateServiceOrderStatus,
  canViewFinancialServiceOrders,
  canViewServiceOrderFinancials,
  canViewWarehouseServiceOrders,
} from "@/lib/permissions";
import type { ServiceOrder, ServiceOrderStatus, SessionUser } from "@/lib/types";

import { recordPrismaAuditLog } from "./audit-log.repository";

const inactiveOrderStatuses: ServiceOrderStatus[] = ["DONE", "DELIVERED", "CANCELED"];
const inactiveMaterialStatuses: PrismaServiceOrderMaterialStatus[] = ["RETURNED", "CONSUMED", "DAMAGED", "LOST", "CANCELED"];
const inactiveEquipmentStatuses: PrismaServiceOrderEquipmentStatus[] = ["RETURNED", "DAMAGED", "LOST", "CANCELED"];
const inactiveRequestStatuses: PrismaMaterialRequestStatus[] = ["REJECTED", "DELIVERED", "CANCELED"];

async function getLinkedEmployeeId(userId: string) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      employeeProfile: {
        select: { id: true },
      },
    },
  });

  return user?.employeeProfile?.id;
}

export async function getServiceOrderScopeWhere(user: SessionUser): Promise<Prisma.ServiceOrderWhereInput> {
  if (canAccessAllServiceOrders(user.role) || canViewFinancialServiceOrders(user.role)) return {};

  if (canViewWarehouseServiceOrders(user.role)) {
    return {
      OR: [
        { status: { notIn: inactiveOrderStatuses } },
        { serviceMaterials: { some: { status: { notIn: inactiveMaterialStatuses } } } },
        { serviceEquipment: { some: { status: { notIn: inactiveEquipmentStatuses } } } },
        { materialRequests: { some: { status: { notIn: inactiveRequestStatuses } } } },
      ],
    };
  }

  const linkedEmployeeId = await getLinkedEmployeeId(user.id);
  if (!linkedEmployeeId && user.role !== "SUPERVISOR_OBRA") return { id: "__forbidden__" };

  if (user.role === "SUPERVISOR_OBRA") {
    return {
      OR: [{ supervisorEmployeeId: linkedEmployeeId ?? "__missing__" }, { supervisorUserId: user.id }],
    };
  }

  if (user.role === "COLABORADOR") {
    return {
      employees: {
        some: {
          employeeId: linkedEmployeeId ?? "__missing__",
        },
      },
    };
  }

  return { id: "__forbidden__" };
}

function selectServiceOrderForRole(role: SessionUser["role"]) {
  const canViewFinancials = canViewServiceOrderFinancials(role);
  const canViewOperationalNotes = role === "OWNER" || role === "GERENTE";
  const canViewCustomerContext = role !== "ALMOXARIFADO" && role !== "FINANCEIRO";

  return {
    id: true,
    customerId: true,
    quoteId: true,
    title: true,
    description: canViewCustomerContext,
    address: true,
    scheduledStart: true,
    scheduledEnd: true,
    actualStart: true,
    actualEnd: true,
    status: true,
    supervisorEmployeeId: true,
    supervisorUserId: true,
    assignedByUserId: true,
    assignedAt: true,
    assignedSupervisorByUserId: true,
    supervisorAssignedAt: true,
    internalNotes: canViewOperationalNotes,
    clientNotes: canViewCustomerContext,
    customer: {
      select: {
        name: true,
      },
    },
    tasks: {
      select: {
        id: true,
        title: true,
        isDone: true,
      },
    },
    employees: {
      select: {
        employeeId: true,
      },
    },
    payments: canViewFinancials
      ? {
          select: {
            amount: true,
          },
        }
      : false,
    expenses: canViewFinancials
      ? {
          select: {
            amount: true,
          },
        }
      : false,
  } satisfies Prisma.ServiceOrderSelect;
}

type ServiceOrderRow = {
  id: string;
  customerId: string;
  quoteId: string | null;
  title: string;
  description?: string | null;
  address: string;
  scheduledStart: Date;
  scheduledEnd: Date | null;
  status: ServiceOrderStatus;
  supervisorEmployeeId: string | null;
  supervisorUserId: string | null;
  assignedByUserId: string | null;
  assignedAt: Date | null;
  assignedSupervisorByUserId: string | null;
  supervisorAssignedAt: Date | null;
  internalNotes?: string | null;
  clientNotes?: string | null;
  customer: {
    name: string;
  };
  tasks: Array<{
    id: string;
    title: string;
    isDone: boolean;
  }>;
  employees: Array<{
    employeeId: string;
  }>;
  payments?: Array<{ amount: unknown }>;
  expenses?: Array<{ amount: unknown }>;
};

function decimalToNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

export function toServiceOrderFromPrisma(row: ServiceOrderRow): ServiceOrder {
  return {
    id: row.id,
    customerId: row.customerId,
    customerName: row.customer.name,
    quoteId: row.quoteId ?? "",
    title: row.title,
    description: row.description ?? "",
    address: row.address,
    scheduledStart: row.scheduledStart.toISOString(),
    scheduledEnd: row.scheduledEnd?.toISOString() ?? row.scheduledStart.toISOString(),
    status: row.status,
    supervisorEmployeeId: row.supervisorEmployeeId ?? undefined,
    supervisorUserId: row.supervisorUserId ?? undefined,
    assignedByUserId: row.assignedByUserId ?? undefined,
    assignedAt: row.assignedAt?.toISOString(),
    assignedSupervisorByUserId: row.assignedSupervisorByUserId ?? undefined,
    supervisorAssignedAt: row.supervisorAssignedAt?.toISOString(),
    internalNotes: row.internalNotes ?? "",
    clientNotes: row.clientNotes ?? "",
    employeeIds: row.employees.map((employee) => employee.employeeId),
    tasks: row.tasks.map((task) => ({ id: task.id, title: task.title, done: task.isDone })),
    revenue: (row.payments ?? []).reduce((total, payment) => total + decimalToNumber(payment.amount), 0),
    expenses: (row.expenses ?? []).reduce((total, expense) => total + decimalToNumber(expense.amount), 0),
  };
}

export async function listPrismaServiceOrdersForUser(user: SessionUser) {
  const prisma = getPrisma();
  const where = await getServiceOrderScopeWhere(user);
  const orders = (await prisma.serviceOrder.findMany({
    where,
    orderBy: [{ scheduledStart: "desc" }],
    select: selectServiceOrderForRole(user.role),
  })) as ServiceOrderRow[];

  return orders.map(toServiceOrderFromPrisma);
}

export async function getPrismaServiceOrderForUser(id: string, user: SessionUser) {
  const prisma = getPrisma();
  const scopeWhere = await getServiceOrderScopeWhere(user);
  const order = (await prisma.serviceOrder.findFirst({
    where: {
      AND: [{ id }, scopeWhere],
    },
    select: selectServiceOrderForRole(user.role),
  })) as ServiceOrderRow | null;

  return order ? toServiceOrderFromPrisma(order) : null;
}

export async function createPrismaServiceOrder(
  input: {
    id?: string;
    customerId: string;
    quoteId?: string;
    title: string;
    description?: string;
    address: string;
    scheduledStart: string;
    scheduledEnd?: string;
    supervisorEmployeeId?: string;
    internalNotes?: string;
    clientNotes?: string;
  },
  actor: SessionUser,
) {
  const prisma = getPrisma();
  if (!canAccessAllServiceOrders(actor.role)) return { serviceOrder: null, error: "FORBIDDEN" as const };

  let supervisorUserId: string | undefined;
  if (input.supervisorEmployeeId) {
    const supervisor = await prisma.employee.findUnique({
      where: { id: input.supervisorEmployeeId },
      select: {
        id: true,
        status: true,
        user: {
          select: {
            id: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!supervisor || supervisor.status !== "ACTIVE" || supervisor.user?.role !== "SUPERVISOR_OBRA" || !supervisor.user.isActive) {
      return { serviceOrder: null, error: "INVALID_SUPERVISOR" as const };
    }
    supervisorUserId = supervisor.user.id;
  }

  const now = new Date();
  const created = (await prisma.serviceOrder.create({
    data: {
      ...(input.id ? { id: input.id } : {}),
      customerId: input.customerId,
      quoteId: input.quoteId || undefined,
      title: input.title.trim(),
      description: input.description ?? "",
      address: input.address.trim(),
      scheduledStart: new Date(input.scheduledStart),
      scheduledEnd: input.scheduledEnd ? new Date(input.scheduledEnd) : undefined,
      supervisorEmployeeId: input.supervisorEmployeeId,
      supervisorUserId,
      assignedByUserId: input.supervisorEmployeeId ? actor.id : undefined,
      assignedAt: input.supervisorEmployeeId ? now : undefined,
      assignedSupervisorByUserId: input.supervisorEmployeeId ? actor.id : undefined,
      supervisorAssignedAt: input.supervisorEmployeeId ? now : undefined,
      internalNotes: input.internalNotes ?? "",
      clientNotes: input.clientNotes ?? "",
    },
    select: selectServiceOrderForRole(actor.role),
  })) as ServiceOrderRow;

  await recordPrismaAuditLog({
    userId: actor.id,
    action: "CREATE_SERVICE_ORDER",
    entity: "ServiceOrder",
    entityId: created.id,
    newValueJson: toServiceOrderFromPrisma(created),
  });

  return { serviceOrder: toServiceOrderFromPrisma(created), error: null };
}

export async function updatePrismaServiceOrderStatus(id: string, status: ServiceOrderStatus, actor: SessionUser) {
  const prisma = getPrisma();
  if (!canUpdateServiceOrderStatus(actor.role)) return { serviceOrder: null, error: "FORBIDDEN" as const };

  const existing = await getPrismaServiceOrderForUser(id, actor);
  if (!existing) return { serviceOrder: null, error: "NOT_FOUND" as const };
  const currentCore = await prisma.serviceOrder.findUnique({
    where: { id },
    select: { actualStart: true },
  });

  const serviceOrder = (await prisma.serviceOrder.update({
    where: { id },
    data: {
      status,
      actualStart: status === "IN_PROGRESS" && !currentCore?.actualStart ? new Date() : undefined,
      actualEnd: status === "DONE" || status === "DELIVERED" ? new Date() : undefined,
    },
    select: selectServiceOrderForRole(actor.role),
  })) as ServiceOrderRow;

  await recordPrismaAuditLog({
    userId: actor.id,
    action: "UPDATE_SERVICE_ORDER_STATUS",
    entity: "ServiceOrder",
    entityId: id,
    oldValueJson: { status: existing.status },
    newValueJson: { status },
  });

  return { serviceOrder: toServiceOrderFromPrisma(serviceOrder), error: null };
}

export async function assignPrismaSupervisorToServiceOrder(id: string, supervisorEmployeeId: string, actor: SessionUser) {
  const prisma = getPrisma();
  if (!canManageServiceOrderTeam(actor.role)) return { serviceOrder: null, error: "FORBIDDEN" as const };

  const supervisor = await prisma.employee.findUnique({
    where: { id: supervisorEmployeeId },
    select: {
      id: true,
      status: true,
      user: {
        select: {
          id: true,
          role: true,
          isActive: true,
        },
      },
    },
  });

  if (!supervisor || supervisor.status !== "ACTIVE" || supervisor.user?.role !== "SUPERVISOR_OBRA" || !supervisor.user.isActive) {
    return { serviceOrder: null, error: "INVALID_SUPERVISOR" as const };
  }

  const assignedAt = new Date();
  const serviceOrder = (await prisma.serviceOrder.update({
    where: { id },
    data: {
      supervisorEmployeeId,
      supervisorUserId: supervisor.user.id,
      assignedByUserId: actor.id,
      assignedAt,
      assignedSupervisorByUserId: actor.id,
      supervisorAssignedAt: assignedAt,
    },
    select: selectServiceOrderForRole(actor.role),
  })) as ServiceOrderRow;

  await recordPrismaAuditLog({
    userId: actor.id,
    action: "ASSIGN_SERVICE_ORDER_SUPERVISOR",
    entity: "ServiceOrder",
    entityId: id,
    newValueJson: { supervisorEmployeeId, supervisorUserId: supervisor.user.id },
  });

  return { serviceOrder: toServiceOrderFromPrisma(serviceOrder), error: null };
}

export async function removePrismaSupervisorFromServiceOrder(id: string, actor: SessionUser) {
  const prisma = getPrisma();
  if (!canManageServiceOrderTeam(actor.role)) return { serviceOrder: null, error: "FORBIDDEN" as const };

  const serviceOrder = (await prisma.serviceOrder.update({
    where: { id },
    data: {
      supervisorEmployeeId: null,
      supervisorUserId: null,
      assignedSupervisorByUserId: null,
      supervisorAssignedAt: null,
    },
    select: selectServiceOrderForRole(actor.role),
  })) as ServiceOrderRow;

  await recordPrismaAuditLog({
    userId: actor.id,
    action: "REMOVE_SERVICE_ORDER_SUPERVISOR",
    entity: "ServiceOrder",
    entityId: id,
  });

  return { serviceOrder: toServiceOrderFromPrisma(serviceOrder), error: null };
}
