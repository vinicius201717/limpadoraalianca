import { getOperationalPageData } from "@/lib/operational-page-data";
import { notFound } from "next/navigation";

import { WarehouseServiceView } from "@/components/WarehouseServiceView";

export const dynamic = "force-dynamic";

export default async function WarehouseServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { data } = await getOperationalPageData({ stock: true });
  const { id } = await params;
  const order = data.serviceOrders.find((item) => item.id === id);
  if (!order) notFound();
  return (
    <WarehouseServiceView
      equipment={data.equipment}
      materialRequestItems={data.materialRequestItems}
      materialRequests={data.materialRequests.filter((item) => item.serviceOrderId === id)}
      materials={data.materials}
      order={order}
      serviceOrderEquipment={data.serviceOrderEquipment.filter((item) => item.serviceOrderId === id)}
      serviceOrderMaterials={data.serviceOrderMaterials.filter((item) => item.serviceOrderId === id)}
    />
  );
}
