import "server-only";

import { maxPhotoBytes } from "./checklist-photo-storage";
import { canAccessAllServiceOrders, canViewServiceOrderFinancials } from "./permissions";
import { authorizeServiceOrderAccess } from "./service-order-access";
import { db, sanitizeServiceOrderForRole } from "./store";
import type { SessionUser } from "./types";

/** The same projection is used by route handlers and server rendered subpages. */
export function buildServiceOrderDetailData(user: SessionUser, orderId: string) {
  const access = authorizeServiceOrderAccess(user, orderId, "read");
  const order = access.order;
  const manager = canAccessAllServiceOrders(user.role);
  const financial = canViewServiceOrderFinancials(user);
  const operational = user.role !== "FINANCEIRO";
  const teamIds = new Set([...(order.employeeIds ?? []), order.supervisorEmployeeId,
    ...db.serviceOrderEmployees.filter((link) => link.serviceOrderId === orderId).map((link) => link.employeeId)]);
  const employees = db.employees.filter((employee) => manager || teamIds.has(employee.id)).map((employee) => ({
    ...employee,
    document: manager ? employee.document : "",
    dailyCost: financial ? employee.dailyCost : 0,
    notes: manager ? employee.notes : "",
    phone: manager ? employee.phone : "",
    email: manager ? employee.email : "",
  }));
  const userIds = new Set(employees.map((employee) => employee.userId));
  const users = db.users.filter((candidate) => userIds.has(candidate.id) || candidate.id === user.id).map((candidate) => ({
    id: candidate.id, name: candidate.name, email: "", role: candidate.role, isActive: candidate.isActive,
  }));
  const requests = operational ? db.materialRequests.filter((request) => request.serviceOrderId === orderId) : [];
  const requestIds = new Set(requests.map((request) => request.id));
  return {
    maxMediaBytes: maxPhotoBytes,
    order: { ...access.sanitizedOrder, internalNotes: manager ? order.internalNotes : "", clientDeliveryIp: undefined },
    serviceOrders: (manager ? db.serviceOrders : [order]).map((item) => ({
      ...sanitizeServiceOrderForRole(user, item), internalNotes: manager ? item.internalNotes : "", clientDeliveryIp: undefined,
    })),
    customers: db.customers.filter((customer) => customer.id === order.customerId).map((customer) => ({
      ...customer, totalValue: financial ? customer.totalValue : 0, notes: manager ? customer.notes : "",
    })),
    employees: operational ? employees : [],
    users: operational ? users : [],
    equipment: operational ? db.equipment : [],
    evaluations: operational ? db.evaluations.filter((evaluation) => evaluation.serviceOrderId === orderId) : [],
    materials: operational ? db.materials.map((material) => ({ ...material, unitCost: financial ? material.unitCost : 0 })) : [],
    serviceOrderChecklistItems: operational ? db.serviceOrderChecklistItems.filter((item) => item.serviceOrderId === orderId) : [],
    serviceOrderChecklistPhotos: operational ? db.serviceOrderChecklistPhotos.filter((photo) => photo.serviceOrderId === orderId) : [],
    serviceOrderEquipment: operational ? db.serviceOrderEquipment.filter((item) => item.serviceOrderId === orderId) : [],
    serviceOrderMaterials: operational ? db.serviceOrderMaterials.filter((item) => item.serviceOrderId === orderId) : [],
    materialRequests: requests,
    materialRequestItems: db.materialRequestItems.filter((item) => requestIds.has(item.requestId)),
  };
}
