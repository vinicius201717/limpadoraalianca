import { ModuleScreen } from "@/components/ModuleScreen";
import { getModuleConfig } from "@/lib/module-config";

export default function LeadsPage() {
  return <ModuleScreen config={getModuleConfig("leads")} />;
}
