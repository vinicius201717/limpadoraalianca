export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";

import { AccessDeniedView } from "@/components/AccessDeniedView";
import { EmployeeDetailView } from "@/components/EmployeeDetailView";
import { canViewServiceOrderFinancials } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/auth";
import { db, canUserAccessEmployee, canUserAccessOrder, ensureDatabaseReady, getEmployeeAccessRole, sanitizeServiceOrderForRole } from "@/lib/store";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await ensureDatabaseReady();
  const user = await getCurrentUser();
  if (!user) {
    return <AccessDeniedView message="Entre no sistema para abrir perfis de colaboradores." />;
  }

  const { id } = await params;
  const employee = db.employees.find((item) => item.id === id);
  if (!employee) notFound();
  if (!canUserAccessEmployee(user, employee.id)) {
    return <AccessDeniedView message="Seu perfil nao possui permissao para abrir este perfil." />;
  }

  const visibleOrders =
    user.role === "OWNER" || user.role === "GERENTE"
      ? db.serviceOrders
      : db.serviceOrders.filter((order) => canUserAccessOrder(user, order));

  return (
    <EmployeeDetailView
      employee={{ ...employee, dailyCost: canViewServiceOrderFinancials(user) ? employee.dailyCost : 0, document: ["OWNER", "GERENTE"].includes(user.role) ? employee.document : "", notes: ["OWNER", "GERENTE"].includes(user.role) ? employee.notes : "" }}
      targetAccessRole={getEmployeeAccessRole(employee)}
      evaluations={db.evaluations.filter((item) => item.employeeId === id && visibleOrders.some((order) => order.id === item.serviceOrderId))}
      supervisorEvaluations={db.supervisorEvaluations.filter((item) => item.supervisorEmployeeId === id && visibleOrders.some((order) => order.id === item.serviceOrderId))}
      serviceOrders={visibleOrders.map((order) => sanitizeServiceOrderForRole(user, order))}
      checklistEvents={db.serviceOrderChecklistEvents.filter((event) => event.employeeId === employee.id && event.type === "COMPLETED")}
      checklistItems={db.serviceOrderChecklistItems.filter((item) => visibleOrders.some((order) => order.id === item.serviceOrderId))}
    />
  );
}
