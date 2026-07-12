import { ModuleScreen } from "@/components/ModuleScreen";
import { getCurrentUser } from "@/lib/auth";
import { getModuleConfig } from "@/lib/module-config";
import { canAccessAllServiceOrders, canViewServiceOrderFinancials } from "@/lib/permissions";
import { getAccessibleServiceOrders } from "@/lib/store";

export default async function ServiceOrdersPage() {
  const user = await getCurrentUser();
  const baseConfig = getModuleConfig("ordens-servico");
  const rows = user ? getAccessibleServiceOrders(user) : [];
  const columns = user && canViewServiceOrderFinancials(user.role)
    ? baseConfig.columns
    : baseConfig.columns.filter((column) => column.key !== "revenue");

  return (
    <ModuleScreen
      config={{
        ...baseConfig,
        rows: rows as unknown as Array<Record<string, unknown>>,
        columns,
        newPath: user && canAccessAllServiceOrders(user.role) ? "/ordens-servico/novo" : undefined,
      }}
    />
  );
}
