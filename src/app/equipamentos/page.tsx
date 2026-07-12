import { EquipmentStockView } from "@/components/EquipmentStockView";
import { db, ensureDatabaseReady } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function EquipmentPage() {
  await ensureDatabaseReady();
  return <EquipmentStockView initialEquipment={db.equipment} />;
}
