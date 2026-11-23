export const dynamic = "force-dynamic";
import { getOperationalPageData } from "@/lib/operational-page-data";
import { ModuleScreen } from "@/components/ModuleScreen";
import { getModuleConfig } from "@/lib/module-config";

export default async function EvaluationsPage() {
  const { data } = await getOperationalPageData();
  return <ModuleScreen config={{ ...getModuleConfig("avaliacoes"), rows: data.evaluations as unknown as Array<Record<string, unknown>> }} />;
}
