export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { Stack } from "@mui/material";
import { UserIdentitySummary } from "@/components/UserIdentitySummary";

import { AccessDeniedView } from "@/components/AccessDeniedView";
import { RecordDetailView } from "@/components/RecordDetailView";
import { FieldProfileAccessCard } from "@/components/FieldProfileAccessCard";
import { getCurrentUser } from "@/lib/auth";
import { getModuleConfig } from "@/lib/module-config";
import { db } from "@/lib/store";


export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (currentUser?.role !== "OWNER") {
    return <AccessDeniedView message="Apenas o dono pode ver detalhes de usuarios." />;
  }

  const { id } = await params;
  const user = db.users.find((item) => item.id === id);
  if (!user) notFound();
  return (
    <Stack spacing={3}>
      <RecordDetailView config={getModuleConfig("usuarios")} record={{ name: user.name, id: user.id, phone: user.phone, email: user.email?.endsWith("@telefone.alianca.local") ? undefined : user.email, role: user.role, isActive: user.isActive, canViewFinancials: user.canViewFinancials, linkedEmployee: db.employees.find(e => e.userId === user.id || e.id === user.linkedEmployeeId)?.name ?? "Sem vinculo", lastLoginAt: user.lastLoginAt, createdAt: user.createdAt, updatedAt: user.updatedAt, mustChangePassword: user.mustChangePassword }} />
      <UserIdentitySummary userId={user.id} complete={db.userIdentities.some(r => r.userId === user.id)} />
      <FieldProfileAccessCard viewerUserId={currentUser.id}
        account={{ userId: user.id, name: user.name, isActive: user.isActive, mustChangePassword: user.mustChangePassword, role: user.role }} />
    </Stack>
  );
}
