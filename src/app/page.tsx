import { PublicSiteView } from "@/components/PublicSiteView";
import { db, ensureDatabaseReady } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function PublicHomePage() {
  try {
    await ensureDatabaseReady();
  } catch (error) {
    console.error("[public-home] database unavailable, rendering bundled site data", error);
  }

  return (
    <PublicSiteView
      beforeAfters={db.siteBeforeAfters}
      testimonials={db.siteTestimonials}
    />
  );
}
