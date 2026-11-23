export const dynamic = "force-dynamic";
import { AccessDeniedView } from "@/components/AccessDeniedView";
import { NewServiceOrderView } from "@/components/NewServiceOrderView";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAllServiceOrders } from "@/lib/permissions";
import { db, findEmployeeActiveServiceOrderConflict } from "@/lib/store";

export default async function NewServiceOrderPage() {
  const user = await getCurrentUser();
  if (!user || !canAccessAllServiceOrders(user.role)) {
    return <AccessDeniedView message="Apenas dono e gerente podem criar servicos." />;
  }

  const supervisors = db.employees.filter((employee) => {
    if (employee.status !== "ACTIVE" || !employee.userId) return false;
    const supervisorUser = db.users.find((item) => item.id === employee.userId);
    return supervisorUser?.role === "SUPERVISOR_OBRA" && supervisorUser.isActive && !findEmployeeActiveServiceOrderConflict(employee.id);
  });

  return <NewServiceOrderView supervisors={supervisors} />;
}
