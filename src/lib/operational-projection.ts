import "server-only";
import { db, getAccessibleServiceOrders, toPublicUser } from "./store";
import { canAccessAllServiceOrders, canViewServiceOrderFinancials } from "./permissions";
import type { SessionUser } from "./types";
export function scopedOperationalData(user: SessionUser) {
  const manager = canAccessAllServiceOrders(user.role);
  const financial = canViewServiceOrderFinancials(user);
  const serviceOrders = getAccessibleServiceOrders(user);
  const orderIds = new Set(serviceOrders.map((order) => order.id));
  const teamIds = new Set(serviceOrders.flatMap((order) => [...order.employeeIds, order.supervisorEmployeeId]));
  const materialRequests = db.materialRequests.filter((item) => orderIds.has(item.serviceOrderId));
  const requestIds = new Set(materialRequests.map((item) => item.id));
  const employees = db.employees.filter((item) => manager || teamIds.has(item.id) || item.userId === user.id).map((item) => ({ ...item, document: manager ? item.document : "", phone: manager ? item.phone : "", email: manager ? item.email : "", notes: manager ? item.notes : "", dailyCost: financial ? item.dailyCost : 0 }));
  const userIds = new Set(employees.map((item) => item.userId));
  return {
    serviceOrders, employees,
    users: db.users.filter((item) => userIds.has(item.id)).map((item) => ({ ...toPublicUser(item), email: manager ? item.email : "", phone: manager ? item.phone : "" })),
    serviceOrderEmployees: db.serviceOrderEmployees.filter((item) => orderIds.has(item.serviceOrderId)),
    serviceOrderChecklistItems: db.serviceOrderChecklistItems.filter((item) => orderIds.has(item.serviceOrderId)),
    serviceOrderChecklistPhotos: db.serviceOrderChecklistPhotos.filter((item) => orderIds.has(item.serviceOrderId)),
    serviceOrderMaterials: db.serviceOrderMaterials.filter((item) => orderIds.has(item.serviceOrderId)),
    serviceOrderEquipment: db.serviceOrderEquipment.filter((item) => orderIds.has(item.serviceOrderId)),
    materialRequests, materialRequestItems: db.materialRequestItems.filter((item) => requestIds.has(item.requestId)),
    materials: db.materials.filter((item) => !item.archivedAt).map((item) => ({ ...item, unitCost: financial ? item.unitCost : 0 })),
    equipment: db.equipment.filter((item) => !item.archivedAt),
    evaluations: db.evaluations.filter((item) => orderIds.has(item.serviceOrderId)),
    leads: manager || user.role === "COMERCIAL" ? db.leads : [],
    quotes: manager || user.role === "COMERCIAL" ? db.quotes : [],
    siteBeforeAfters: db.siteBeforeAfters.filter((item) => manager || item.isPublished),
    siteTestimonials: db.siteTestimonials.filter((item) => manager || item.isPublished),
  };
}
