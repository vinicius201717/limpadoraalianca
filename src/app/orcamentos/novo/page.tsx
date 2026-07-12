import { NewRecordView } from "@/components/NewRecordView";
import { getModuleConfig } from "@/lib/module-config";

export default function NewQuotePage() {
  return <NewRecordView config={getModuleConfig("orcamentos")} />;
}
