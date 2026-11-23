import "server-only";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "./auth";
import { ensureDatabaseReady } from "./store";
import { canManageStock } from "./permissions";
import { scopedOperationalData } from "./operational-projection";
export { scopedOperationalData } from "./operational-projection";
export async function getOperationalPageData(options: { stock?: boolean } = {}) {
  await ensureDatabaseReady();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (options.stock && !canManageStock(user.role)) notFound();
  return { user, data: scopedOperationalData(user) };
}
