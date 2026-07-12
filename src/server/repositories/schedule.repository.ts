import "server-only";

import { getPrisma } from "@/lib/prisma";
import { canAccessAllServiceOrders, canViewFinancialServiceOrders } from "@/lib/permissions";
import type { ScheduleEvent, ScheduleEventStatus, ServiceOrderStatus, SessionUser } from "@/lib/types";

import { getServiceOrderScopeWhere } from "./service-orders.repository";

function mapServiceOrderStatus(status: ServiceOrderStatus, startsAt: Date): ScheduleEventStatus {
  if (status === "CANCELED") return "CANCELED";
  if (status === "DONE" || status === "DELIVERED") return "DONE";
  if (status === "IN_PROGRESS") return "IN_PROGRESS";
  if (startsAt.getTime() < Date.now()) return "DELAYED";
  return "SCHEDULED";
}

async function getLinkedEmployeeId(userId: string) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { employeeProfile: { select: { id: true } } },
  });
  return user?.employeeProfile?.id;
}

export async function listPrismaScheduleEvents(user: SessionUser) {
  const prisma = getPrisma();
  const serviceOrderWhere = await getServiceOrderScopeWhere(user);
  const serviceOrders = await prisma.serviceOrder.findMany({
    where: serviceOrderWhere,
    orderBy: [{ scheduledStart: "asc" }],
    select: {
      id: true,
      title: true,
      address: true,
      scheduledStart: true,
      scheduledEnd: true,
      status: true,
      customer: { select: { name: true } },
      supervisorEmployee: { select: { name: true } },
      employees: { select: { employee: { select: { name: true } } } },
    },
  });

  const orderEvents: ScheduleEvent[] = serviceOrders.map((order) => {
    const teamNames = order.employees.map((link) => link.employee.name).join(", ");
    const description = [
      `Cliente: ${order.customer.name}`,
      `Endereco: ${order.address}`,
      order.supervisorEmployee?.name ? `Supervisor: ${order.supervisorEmployee.name}` : undefined,
      teamNames ? `Equipe: ${teamNames}` : undefined,
    ]
      .filter(Boolean)
      .join(" | ");

    return {
      id: order.id,
      title: order.title,
      description,
      type: "SERVICE_ORDER",
      serviceOrderId: order.id,
      startsAt: order.scheduledStart.toISOString(),
      endsAt: (order.scheduledEnd ?? order.scheduledStart).toISOString(),
      status: mapServiceOrderStatus(order.status as ServiceOrderStatus, order.scheduledStart),
      priority: "NORMAL",
      createdAt: order.scheduledStart.toISOString(),
      updatedAt: (order.scheduledEnd ?? order.scheduledStart).toISOString(),
    };
  });

  const linkedEmployeeId = await getLinkedEmployeeId(user.id);
  const independentWhere =
    canAccessAllServiceOrders(user.role) || canViewFinancialServiceOrders(user.role)
      ? {}
      : {
          OR: [{ assignedUserId: user.id }, { assignedEmployeeId: linkedEmployeeId ?? "__missing__" }],
        };

  const independentEvents = await prisma.scheduleEvent.findMany({
    where: {
      AND: [{ type: { not: "SERVICE_ORDER" } }, independentWhere],
    },
    orderBy: [{ startsAt: "asc" }],
  });

  return [
    ...orderEvents,
    ...independentEvents.map((event): ScheduleEvent => ({
      id: event.id,
      title: event.title,
      description: event.description ?? "",
      type: event.type,
      serviceOrderId: event.serviceOrderId ?? undefined,
      inspectionId: event.inspectionId ?? undefined,
      assignedUserId: event.assignedUserId ?? undefined,
      assignedEmployeeId: event.assignedEmployeeId ?? undefined,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      status: event.status,
      priority: event.priority,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    })),
  ];
}
