import { getOperationalPageData } from "@/lib/operational-page-data";
import { GalleryView } from "@/components/GalleryView";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const { data } = await getOperationalPageData();
  return (
    <GalleryView
      photos={data.serviceOrderChecklistPhotos}
      serviceOrders={data.serviceOrders}
      checklistItems={data.serviceOrderChecklistItems}
      employees={data.employees}
      users={data.users}
    />
  );
}
