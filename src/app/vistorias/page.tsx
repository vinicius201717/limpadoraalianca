import { ModuleScreen } from "@/components/ModuleScreen";
import { getModuleConfig } from "@/lib/module-config";

export default function InspectionsPage() {
  return <ModuleScreen config={getModuleConfig("vistorias")} />;
}
