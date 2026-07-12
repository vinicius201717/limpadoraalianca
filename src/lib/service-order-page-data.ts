import "server-only";

import { getCurrentUser } from "./auth";
import { authorizeServiceOrderAccess, ServiceOrderAuthorizationError } from "./service-order-access";
import { db, ensureDatabaseReady, toPublicUsers } from "./store";

export async function getAuthorizedServiceOrderDetailData(orderId: string) {
  await ensureDatabaseReady();
  const user = await getCurrentUser();

  try {
    const access = authorizeServiceOrderAccess(user, orderId, "read");
    return {
      order: access.sanitizedOrder,
      customers: db.customers,
      employees: db.employees,
      users: toPublicUsers(db.users),
      equipment: db.equipment,
      evaluations: db.evaluations,
      materials: db.materials,
      serviceOrderChecklistItems: db.serviceOrderChecklistItems,
      serviceOrderChecklistPhotos: db.serviceOrderChecklistPhotos,
      serviceOrderEquipment: db.serviceOrderEquipment,
      serviceOrderMaterials: db.serviceOrderMaterials,
      materialRequests: db.materialRequests,
      materialRequestItems: db.materialRequestItems,
    };
  } catch (error) {
    if (error instanceof ServiceOrderAuthorizationError) return null;
    throw error;
  }
}
