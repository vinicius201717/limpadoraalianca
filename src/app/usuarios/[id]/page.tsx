import { notFound } from "next/navigation";

import { AccessDeniedView } from "@/components/AccessDeniedView";
import { RecordDetailView } from "@/components/RecordDetailView";
import { getCurrentUser } from "@/lib/auth";
import { getModuleConfig } from "@/lib/module-config";
import { db, toPublicUser } from "@/lib/store";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (currentUser?.role !== "OWNER") {
    return <AccessDeniedView message="Apenas o dono pode ver detalhes de usuarios." />;
  }

  const { id } = await params;
  const user = db.users.find((item) => item.id === id);
  if (!user) notFound();
  return <RecordDetailView config={getModuleConfig("usuarios")} record={toPublicUser(user) as unknown as Record<string, unknown>} />;
}
