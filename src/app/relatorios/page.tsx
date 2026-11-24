import { notFound } from "next/navigation";

import { scopedOperationalData } from "@/lib/operational-page-data";
import { ManagementReportsPanel } from "@/components/ManagementReportsPanel";
import { ReportsView } from "@/components/ReportsView";
import { getCurrentUser } from "@/lib/auth";
import { canAccessOperationalReports, canViewServiceOrderFinancials } from "@/lib/permissions";
import { db, ensureDatabaseReady, getAccessibleServiceOrders } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await ensureDatabaseReady();
  const user = await getCurrentUser();
  if (!user) notFound();

  const canViewOperations = canAccessOperationalReports(user.role);
  const canViewFinancials = canViewServiceOrderFinancials(user);
  if (!canViewOperations && !canViewFinancials) notFound();

  const data = scopedOperationalData(user);
  return (
    <><div style={{marginBottom:24}}>{canViewOperations && <ManagementReportsPanel/>}</div>
    <ReportsView
      user={user}
      serviceOrders={getAccessibleServiceOrders(user)}
      employees={data.employees}
      checklistItems={data.serviceOrderChecklistItems}
      checklistPhotos={data.serviceOrderChecklistPhotos}
      expenses={canViewFinancials ? db.serviceExpenses : []}
      canViewOperations={canViewOperations}
      canViewFinancials={canViewFinancials}
    /></>
  );
}
