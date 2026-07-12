import { ModuleScreen } from "@/components/ModuleScreen";
import { getModuleConfig } from "@/lib/module-config";

export default function ReportsPage() {
  return <ModuleScreen config={getModuleConfig("relatorios")} />;
}
