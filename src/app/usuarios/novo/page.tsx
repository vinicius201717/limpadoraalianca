import { AccessDeniedView } from "@/components/AccessDeniedView";
import { NewUserView } from "@/components/NewUserView";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/store";

export default async function NewUserPage() {
  const user = await getCurrentUser();
  if (user?.role !== "OWNER") {
    return <AccessDeniedView message="Apenas o dono pode criar usuarios de acesso interno." />;
  }

  return <NewUserView employees={db.employees} />;
}
