import { NewRecordView } from "@/components/NewRecordView";
import { getModuleConfig } from "@/lib/module-config";

export default function NewCustomerPage() {
  return <NewRecordView config={getModuleConfig("clientes")} />;
}
