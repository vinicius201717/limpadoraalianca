import { AccessDeniedView } from "@/components/AccessDeniedView";
import { NewEmployeeView } from "@/components/NewEmployeeView";
import { getCurrentUser } from "@/lib/auth";

export default async function NewEmployeePage() {
  const user = await getCurrentUser();
  if (user?.role !== "OWNER" && user?.role !== "GERENTE") {
    return <AccessDeniedView message="Apenas OWNER e GERENTE podem criar colaboradores." />;
  }

  return <NewEmployeeView />;
}
