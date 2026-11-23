import { getOperationalPageData } from "@/lib/operational-page-data";
import { DashboardView } from "@/components/DashboardView";
import { buildDashboardData } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user, data } = await getOperationalPageData();
  return (
    <DashboardView
      data={buildDashboardData(data, user)}
      employees={data.employees}
      serviceOrders={data.serviceOrders}
      serviceOrderEmployees={data.serviceOrderEmployees}
      serviceOrderChecklistItems={data.serviceOrderChecklistItems}
      serviceOrderChecklistPhotos={data.serviceOrderChecklistPhotos}
      serviceOrderMaterials={data.serviceOrderMaterials}
      materialRequests={data.materialRequests}
      materials={data.materials}
      siteBeforeAfters={data.siteBeforeAfters}
      siteTestimonials={data.siteTestimonials}
    />
  );
}
