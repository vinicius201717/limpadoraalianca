import { WarehouseView } from "@/components/WarehouseView";
import { db, ensureDatabaseReady } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function WarehousePage() {
  await ensureDatabaseReady();
  return (
    <WarehouseView
      equipment={db.equipment}
      materialRequestItems={db.materialRequestItems}
      materialRequests={db.materialRequests}
      materials={db.materials}
      serviceOrderEquipment={db.serviceOrderEquipment}
      serviceOrderMaterials={db.serviceOrderMaterials}
      serviceOrders={db.serviceOrders}
    />
  );
}
