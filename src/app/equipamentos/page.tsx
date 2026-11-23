import { getOperationalPageData } from "@/lib/operational-page-data";
import { EquipmentStockView } from "@/components/EquipmentStockView";

export const dynamic = "force-dynamic";

export default async function EquipmentPage() {
  const { data } = await getOperationalPageData({ stock: true });
  return (
    <EquipmentStockView
      employees={data.employees}
      initialEquipment={data.equipment}
      serviceOrderEquipment={data.serviceOrderEquipment}
      serviceOrders={data.serviceOrders}
    />
  );
}
