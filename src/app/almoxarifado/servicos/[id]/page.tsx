import { notFound } from "next/navigation";

import { WarehouseServiceView } from "@/components/WarehouseServiceView";
import { db, ensureDatabaseReady } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function WarehouseServicePage({ params }: { params: Promise<{ id: string }> }) {
  await ensureDatabaseReady();
  const { id } = await params;
  const order = db.serviceOrders.find((item) => item.id === id);
  if (!order) notFound();
  return (
    <WarehouseServiceView
      equipment={db.equipment}
      materialRequestItems={db.materialRequestItems}
      materialRequests={db.materialRequests}
      materials={db.materials}
      order={order}
      serviceOrderEquipment={db.serviceOrderEquipment}
      serviceOrderMaterials={db.serviceOrderMaterials}
    />
  );
}
