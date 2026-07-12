import { notFound } from "next/navigation";

import { ModuleScreen } from "@/components/ModuleScreen";
import { getCurrentUser } from "@/lib/auth";
import { getModuleConfig } from "@/lib/module-config";
import { canViewServiceOrderFinancials } from "@/lib/permissions";

export default async function FinancePage() {
  const user = await getCurrentUser();
  if (!user || !canViewServiceOrderFinancials(user.role)) notFound();
  return <ModuleScreen config={getModuleConfig("financeiro")} />;
}
