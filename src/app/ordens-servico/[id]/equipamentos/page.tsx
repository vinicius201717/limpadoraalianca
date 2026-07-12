import { notFound } from "next/navigation";

import { ServiceOrderDetailView } from "@/components/ServiceOrderDetailView";
import { getAuthorizedServiceOrderDetailData } from "@/lib/service-order-page-data";

export default async function ServiceOrderEquipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getAuthorizedServiceOrderDetailData(id);
  if (!data) notFound();
  return <ServiceOrderDetailView {...data} />;
}


