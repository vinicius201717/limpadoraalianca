import { getOperationalPageData } from "@/lib/operational-page-data";
import { WarehouseView } from "@/components/WarehouseView";

export const dynamic = "force-dynamic";

export default async function WarehouseServicesPage() {
  const { data } = await getOperationalPageData({ stock: true });
  return (
    <WarehouseView
      employees={data.employees}
      equipment={data.equipment}
      materialRequestItems={data.materialRequestItems}
      materialRequests={data.materialRequests}
      materials={data.materials}
      serviceOrderEquipment={data.serviceOrderEquipment}
      serviceOrderMaterials={data.serviceOrderMaterials}
      serviceOrders={data.serviceOrders}
    />
  );
}
