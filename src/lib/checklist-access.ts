import "server-only";

import { canAccessAllServiceOrders } from "./permissions";
import { authorizeServiceOrderAccess, ServiceOrderAuthorizationError } from "./service-order-access";
import { db, getLinkedEmployeeId } from "./store";
import type { ServiceOrder, ServiceOrderChecklistItem, SessionUser } from "./types";

function getAssignedEmployeeIds(item: ServiceOrderChecklistItem) {
  return Array.from(new Set([...(item.assignedEmployeeIds ?? []), item.assignedEmployeeId].filter(Boolean))) as string[];
}

export function canManageChecklistForOrder(user: SessionUser, order: ServiceOrder) {
  if (canAccessAllServiceOrders(user.role)) return true;
  if (user.role !== "SUPERVISOR_OBRA") return false;
  try {
    authorizeServiceOrderAccess(user, order.id, "checklist");
    return true;
  } catch (error) {
    if (error instanceof ServiceOrderAuthorizationError) return false;
    throw error;
  }
}

export function canCollaboratorOperateChecklistItem(
  user: SessionUser,
  order: ServiceOrder,
  item: ServiceOrderChecklistItem,
) {
  const linkedEmployeeId = getLinkedEmployeeId(user);
  return Boolean(
      user.role === "COLABORADOR" &&
      linkedEmployeeId &&
      item.allowCollaboratorAction &&
      getAssignedEmployeeIds(item).includes(linkedEmployeeId) &&
      (order.employeeIds.includes(linkedEmployeeId) ||
        db.serviceOrderEmployees.some((link) => link.serviceOrderId === order.id && link.employeeId === linkedEmployeeId)),
  );
}

export function canOperateChecklistItemForOrder(
  user: SessionUser,
  order: ServiceOrder,
  item: ServiceOrderChecklistItem,
) {
  return canManageChecklistForOrder(user, order) || canCollaboratorOperateChecklistItem(user, order, item);
}

export function getOrderAndChecklistItem(orderId: string, itemId: string) {
  const order = db.serviceOrders.find((candidate) => candidate.id === orderId);
  const item = db.serviceOrderChecklistItems.find(
    (candidate) => candidate.serviceOrderId === orderId && candidate.id === itemId,
  );
  return { order, item };
}
