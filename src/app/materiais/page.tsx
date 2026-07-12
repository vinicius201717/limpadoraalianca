import { MaterialsStockView } from "@/components/MaterialsStockView";
import { db, ensureDatabaseReady } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function MaterialsPage() {
  await ensureDatabaseReady();
  return <MaterialsStockView initialMaterials={db.materials} />;
}
