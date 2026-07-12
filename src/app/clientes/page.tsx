import { ModuleScreen } from "@/components/ModuleScreen";
import { getModuleConfig } from "@/lib/module-config";

export default function CustomersPage() {
  return <ModuleScreen config={getModuleConfig("clientes")} />;
}
