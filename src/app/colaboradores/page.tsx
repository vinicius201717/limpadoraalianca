export const dynamic = "force-dynamic";
import { AccessDeniedView } from "@/components/AccessDeniedView";
import { EmployeeListView } from "@/components/EmployeeListView";
import { getCurrentUser } from "@/lib/auth";
import { canAccessCollaboratorDirectory } from "@/lib/permissions";
import { ensureDatabaseReady, getVisibleEmployeesForUser, toPublicUsers } from "@/lib/store";

export default async function EmployeesPage() {
  await ensureDatabaseReady();
  const user = await getCurrentUser();
  if (!user || !canAccessCollaboratorDirectory(user.role)) {
    return <AccessDeniedView message="Seu perfil nao possui acesso a lista de colaboradores." />;
  }

  return <EmployeeListView employees={getVisibleEmployeesForUser(user)} users={toPublicUsers()} />;
}
