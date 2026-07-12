import { NewRecordView } from "@/components/NewRecordView";
import { getModuleConfig } from "@/lib/module-config";

export default function NewLeadPage() {
  return <NewRecordView config={getModuleConfig("leads")} />;
}
