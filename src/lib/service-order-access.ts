import "server-only";

import {
  canAccessAllServiceOrders,
  canViewFinancialServiceOrders,
  canViewServiceOrderFinancials,
  canViewWarehouseServiceOrders,
} from "./permissions";
import { db, getLinkedEmployeeId, sanitizeServiceOrderForRole } from "./store";
import type { ServiceOrder, SessionUser } from "./types";

export type ServiceOrderOperation =
  | "read"
  | "update"
  | "status"
  | "team"
  | "checklist"
  | "materials"
  | "equipment"
  | "evaluations"
  | "history";

export type ServiceOrderAccessScope = "full" | "operational" | "assigned" | "warehouse" | "financial";

type ServiceOrderAccessContext = {
  serviceOrders?: ServiceOrder[];
  serviceOrderEmployees?: typeof db.serviceOrderEmployees;
  serviceOrderMaterials?: typeof db.serviceOrderMaterials;
  serviceOrderEquipment?: typeof db.serviceOrderEquipment;
  materialRequests?: typeof db.materialRequests;
};

export class ServiceOrderAuthorizationError extends Error {
  constructor(
    public readonly code: "UNAUTHENTICATED" | "NOT_FOUND" | "FORBIDDEN",
    message: string,
    public readonly status: 401 | 403 | 404,
  ) {
    super(message);
    this.name = "ServiceOrderAuthorizationError";
  }
}

function contextOrStore(context?: ServiceOrderAccessContext) {
  return {
    serviceOrders: context?.serviceOrders ?? db.serviceOrders,
    serviceOrderEmployees: context?.serviceOrderEmployees ?? db.serviceOrderEmployees,
    serviceOrderMaterials: context?.serviceOrderMaterials ?? db.serviceOrderMaterials,
    serviceOrderEquipment: context?.serviceOrderEquipment ?? db.serviceOrderEquipment,
    materialRequests: context?.materialRequests ?? db.materialRequests,
  };
}

function hasEmployeeLink(orderId: string, employeeId: string | undefined, context?: ServiceOrderAccessContext) {
  if (!employeeId) return false;
  const data = contextOrStore(context);
  const order = data.serviceOrders.find((item) => item.id === orderId);
  return Boolean(
    data.serviceOrderEmployees.some((link) => link.serviceOrderId === orderId && link.employeeId === employeeId) ||
      order?.employeeIds.includes(employeeId),
  );
}

function isDesignatedSupervisor(user: SessionUser, order: ServiceOrder) {
  const linkedEmployeeId = getLinkedEmployeeId(user);
  return Boolean(
    (linkedEmployeeId && order.supervisorEmployeeId === linkedEmployeeId) ||
      order.supervisorUserId === user.id,
  );
}

function isWarehouseRelevant(order: ServiceOrder, context?: ServiceOrderAccessContext) {
  const data = contextOrStore(context);
  const materialPending = data.serviceOrderMaterials.some(
    (item) =>
      item.serviceOrderId === order.id &&
      !["RETURNED", "CONSUMED", "DAMAGED", "LOST", "CANCELED"].includes(item.status),
  );
  const equipmentPending = data.serviceOrderEquipment.some(
    (item) =>
      item.serviceOrderId === order.id &&
      !["RETURNED", "DAMAGED", "LOST", "CANCELED"].includes(item.status),
  );
  const requestPending = data.materialRequests.some(
    (item) => item.serviceOrderId === order.id && !["REJECTED", "DELIVERED", "CANCELED"].includes(item.status),
  );
  const activeOrder = !["DONE", "DELIVERED", "CANCELED"].includes(order.status);
  return materialPending || equipmentPending || requestPending || activeOrder;
}

export function authorizeServiceOrderAccess(
  user: SessionUser | null | undefined,
  orderId: string,
  operation: ServiceOrderOperation = "read",
  context?: ServiceOrderAccessContext,
) {
  if (!user || !user.isActive) {
    throw new ServiceOrderAuthorizationError("UNAUTHENTICATED", "Nao autenticado.", 401);
  }

  const data = contextOrStore(context);
  const order = data.serviceOrders.find((item) => item.id === orderId);
  if (!order) {
    throw new ServiceOrderAuthorizationError("NOT_FOUND", "OS nao encontrada.", 404);
  }

  let scope: ServiceOrderAccessScope | null = null;

  if (user.role === "OWNER") scope = "full";
  else if (canAccessAllServiceOrders(user.role)) scope = "operational";
  else if (canViewFinancialServiceOrders(user.role)) scope = "financial";
  else if (canViewWarehouseServiceOrders(user.role) && isWarehouseRelevant(order, context)) scope = "warehouse";
  else if (user.role === "SUPERVISOR_OBRA" && isDesignatedSupervisor(user, order)) scope = "assigned";
  else if (user.role === "COLABORADOR" && hasEmployeeLink(order.id, getLinkedEmployeeId(user), context)) scope = "assigned";

  if (!scope) {
    throw new ServiceOrderAuthorizationError("FORBIDDEN", "Perfil sem permissao para acessar esta OS.", 403);
  }

  const canViewFinancialFields = canViewServiceOrderFinancials(user.role);
  return {
    allowed: true as const,
    operation,
    scope,
    order,
    sanitizedOrder: sanitizeServiceOrderForRole(user.role, order),
    visibleFields: {
      financial: canViewFinancialFields,
      internalNotes: scope === "full" || scope === "operational",
      clientNotes: scope !== "warehouse" && scope !== "financial",
      checklist: scope !== "financial",
      materials: scope !== "financial",
      equipment: scope !== "financial",
      evaluations: scope !== "warehouse" && scope !== "financial",
    },
  };
}
