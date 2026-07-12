import { NewRecordView } from "@/components/NewRecordView";
import { getModuleConfig } from "@/lib/module-config";

export default function NewInspectionPage() {
  return <NewRecordView config={getModuleConfig("vistorias")} />;
}
