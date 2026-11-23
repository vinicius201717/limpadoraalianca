export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";

import { PaymentsView } from "@/components/PaymentsView";
import { FinanceView } from "@/components/FinanceView";
import { getCurrentUser } from "@/lib/auth";
import { canViewServiceOrderFinancials } from "@/lib/permissions";
import { db, getAccessibleServiceOrders } from "@/lib/store";

export default async function FinancePage() {
  const user = await getCurrentUser();
  if (!user || !canViewServiceOrderFinancials(user)) notFound();
  return (
    <><FinanceView
      initialOrders={getAccessibleServiceOrders(user)}
      employees={db.employees.filter((employee) => employee.status === "ACTIVE")}
      initialExpenses={db.serviceExpenses}
    /><PaymentsView initialPayments={db.servicePayments} orders={getAccessibleServiceOrders(user).map((order) => ({ id: order.id, title: order.title }))} /></>
  );
}
