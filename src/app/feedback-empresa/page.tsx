import { AccessDeniedView } from "@/components/AccessDeniedView";
import { CompanyFeedbackView } from "@/components/CompanyFeedbackView";
import { getCurrentUser } from "@/lib/auth";
import { canViewCompanyFeedbacks } from "@/lib/permissions";
import { ensureDatabaseReady, toAnonymousCompanyFeedbacks } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function CompanyFeedbackPage() {
  await ensureDatabaseReady();
  const user = await getCurrentUser();

  if (!user) {
    return <AccessDeniedView message="Faca login para enviar feedback para a empresa." />;
  }

  const canReadFeedbacks = canViewCompanyFeedbacks(user.role);

  return (
    <CompanyFeedbackView
      canReadFeedbacks={canReadFeedbacks}
      initialFeedbacks={canReadFeedbacks ? toAnonymousCompanyFeedbacks() : []}
    />
  );
}
