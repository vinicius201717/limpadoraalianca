import { ModuleScreen } from "@/components/ModuleScreen";
import type { ModuleConfig } from "@/lib/module-config";
import { db, ensureDatabaseReady } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function SupervisorsPage() {
  await ensureDatabaseReady();

  const supervisorRows = db.employees
    .filter((employee) => {
      const linkedUser = employee.userId ? db.users.find((user) => user.id === employee.userId) : undefined;
      const roleText = `${employee.roleName} ${employee.jobTitle ?? ""}`.toLowerCase();
      return linkedUser?.role === "SUPERVISOR_OBRA" || roleText.includes("supervisor");
    })
    .map((employee) => ({
      ...employee,
      assignedOrders: db.serviceOrders.filter(
        (order) =>
          order.supervisorEmployeeId === employee.id ||
          order.supervisorUserId === employee.userId ||
          db.serviceOrderEmployees.some((link) => link.serviceOrderId === order.id && link.employeeId === employee.id),
      ).length,
      activeOrders: db.serviceOrders.filter(
        (order) =>
          !["DONE", "DELIVERED", "CANCELED"].includes(order.status) &&
          (order.supervisorEmployeeId === employee.id ||
            order.supervisorUserId === employee.userId ||
            db.serviceOrderEmployees.some((link) => link.serviceOrderId === order.id && link.employeeId === employee.id)),
      ).length,
      supervisorAverageRating: employee.supervisorAverageRating ?? employee.averageRating,
    })) as Array<Record<string, unknown>>;

  const config: ModuleConfig = {
    key: "supervisores",
    title: "Supervisores",
    subtitle: "Supervisores de obra, ordens designadas e media recebida da equipe.",
    detailBasePath: "/colaboradores",
    searchPlaceholder: "Buscar supervisor ou obra",
    rows: supervisorRows,
    columns: [
      { key: "name", label: "Supervisor" },
      { key: "specialty", label: "Especialidade", format: "status" },
      { key: "assignedOrders", label: "OS designadas", format: "number" },
      { key: "activeOrders", label: "OS ativas", format: "number" },
      { key: "supervisorAverageRating", label: "Media supervisor", format: "rating" },
      { key: "status", label: "Status", format: "status" },
    ],
    emptyTitle: "Nenhum supervisor encontrado",
  };

  return <ModuleScreen config={config} />;
}
