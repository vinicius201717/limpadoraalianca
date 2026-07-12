import { PublicSiteView } from "@/components/PublicSiteView";
import { db, ensureDatabaseReady } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function PublicHomePage() {
  await ensureDatabaseReady();

  return (
    <PublicSiteView
      beforeAfters={db.siteBeforeAfters}
      testimonials={db.siteTestimonials}
    />
  );
}
