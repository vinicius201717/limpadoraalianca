import { AccessDeniedView } from "@/components/AccessDeniedView";
import { UserListView } from "@/components/UserListView";
import { getCurrentUser } from "@/lib/auth";
import { db, toPublicUsers } from "@/lib/store";

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (user?.role !== "OWNER") {
    return <AccessDeniedView message="Apenas o dono pode acessar usuarios e permissoes." />;
  }

  return <UserListView employees={db.employees} users={toPublicUsers(db.users)} />;
}
