import { notFound } from "next/navigation";

import { AccessDeniedView } from "@/components/AccessDeniedView";
import { EmployeeDetailView } from "@/components/EmployeeDetailView";
import { getCurrentUser } from "@/lib/auth";
import { db, ensureDatabaseReady } from "@/lib/store";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await ensureDatabaseReady();
  const user = await getCurrentUser();
  if (user?.role !== "OWNER" && user?.role !== "GERENTE") {
    return <AccessDeniedView message="Apenas OWNER e GERENTE podem abrir perfis administrativos de colaboradores." />;
  }

  const { id } = await params;
  const employee = db.employees.find((item) => item.id === id);
  if (!employee) notFound();
  return <EmployeeDetailView employee={employee} evaluations={db.evaluations} serviceOrders={db.serviceOrders} />;
}
