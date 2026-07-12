import { notFound } from "next/navigation";

import { RecordDetailView } from "@/components/RecordDetailView";
import { getModuleConfig } from "@/lib/module-config";

export default async function InspectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const config = getModuleConfig("vistorias");
  const record = config.rows.find((row) => row.id === id);
  if (!record) notFound();
  return <RecordDetailView config={config} record={record} />;
}
