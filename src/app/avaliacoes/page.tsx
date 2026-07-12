import { ModuleScreen } from "@/components/ModuleScreen";
import { getModuleConfig } from "@/lib/module-config";

export default function EvaluationsPage() {
  return <ModuleScreen config={getModuleConfig("avaliacoes")} />;
}
