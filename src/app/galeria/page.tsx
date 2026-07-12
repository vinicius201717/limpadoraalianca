import { ModuleScreen } from "@/components/ModuleScreen";
import { getModuleConfig } from "@/lib/module-config";

export default function GalleryPage() {
  return <ModuleScreen config={getModuleConfig("galeria")} />;
}
