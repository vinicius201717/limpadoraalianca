import { ModuleScreen } from "@/components/ModuleScreen";
import { getModuleConfig } from "@/lib/module-config";

export default function QuotesPage() {
  return <ModuleScreen config={getModuleConfig("orcamentos")} />;
}
