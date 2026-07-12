import { AccessDeniedView } from "@/components/AccessDeniedView";
import { EmployeeListView } from "@/components/EmployeeListView";
import { getCurrentUser } from "@/lib/auth";
import { db, toPublicUsers } from "@/lib/store";

export default async function EmployeesPage() {
  const user = await getCurrentUser();
  if (user?.role !== "OWNER" && user?.role !== "GERENTE") {
    return <AccessDeniedView message="A listagem administrativa de colaboradores e exclusiva para OWNER e GERENTE." />;
  }

  return <EmployeeListView employees={db.employees} users={toPublicUsers(db.users)} />;
}
