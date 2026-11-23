import { getOperationalPageData } from "@/lib/operational-page-data";
import { MaterialsStockView } from "@/components/MaterialsStockView";

export const dynamic = "force-dynamic";

export default async function MaterialsPage() {
  const { data } = await getOperationalPageData({ stock: true });
  return (
    <MaterialsStockView
      employees={data.employees}
      initialMaterials={data.materials}
      serviceOrderMaterials={data.serviceOrderMaterials}
      serviceOrders={data.serviceOrders}
    />
  );
}
