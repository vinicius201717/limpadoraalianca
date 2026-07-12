import { ModuleScreen } from "@/components/ModuleScreen";
import { getModuleConfig } from "@/lib/module-config";

export default function SettingsPage() {
  return <ModuleScreen config={getModuleConfig("configuracoes")} />;
}
