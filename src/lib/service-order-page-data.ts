import "server-only";

import { getCurrentUser } from "./auth";
import { ServiceOrderAuthorizationError } from "./service-order-access";
import { ensureDatabaseReady } from "./store";
import { buildServiceOrderDetailData } from "./service-order-detail-data";

export async function getAuthorizedServiceOrderDetailData(orderId: string) {
  await ensureDatabaseReady();
  const user = await getCurrentUser();

  try {
    if (!user) return null;
    return buildServiceOrderDetailData(user, orderId);
  } catch (error) {
    if (error instanceof ServiceOrderAuthorizationError) return null;
    throw error;
  }
}
