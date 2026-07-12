import { ModuleScreen } from "@/components/ModuleScreen";
import { getModuleConfig } from "@/lib/module-config";

export default function WarrantiesPage() {
  return <ModuleScreen config={getModuleConfig("garantias")} />;
}
