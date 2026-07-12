import { notFound } from "next/navigation";

import { RecordDetailView } from "@/components/RecordDetailView";
import { getModuleConfig } from "@/lib/module-config";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const config = getModuleConfig("leads");
  const record = config.rows.find((row) => row.id === id);
  if (!record) notFound();
  return <RecordDetailView config={config} record={record} />;
}
