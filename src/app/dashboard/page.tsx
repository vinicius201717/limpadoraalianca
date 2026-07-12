import { DashboardView } from "@/components/DashboardView";
import { buildDashboardData } from "@/lib/analytics";
import { ensureDatabaseReady, db } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await ensureDatabaseReady();
  return (
    <DashboardView
      data={buildDashboardData(db)}
      employees={db.employees}
      serviceOrders={db.serviceOrders}
      serviceOrderEmployees={db.serviceOrderEmployees}
      serviceOrderChecklistItems={db.serviceOrderChecklistItems}
      serviceOrderChecklistPhotos={db.serviceOrderChecklistPhotos}
      serviceOrderMaterials={db.serviceOrderMaterials}
      materialRequests={db.materialRequests}
      materials={db.materials}
      siteBeforeAfters={db.siteBeforeAfters}
      siteTestimonials={db.siteTestimonials}
    />
  );
}
