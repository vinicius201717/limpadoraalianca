export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { Stack } from "@mui/material";

import { AccessDeniedView } from "@/components/AccessDeniedView";
import { RecordDetailView } from "@/components/RecordDetailView";
import { WhatsAppProfileAccessCard } from "@/components/WhatsAppProfileAccessCard";
import { getCurrentUser } from "@/lib/auth";
import { getModuleConfig } from "@/lib/module-config";
import { db, toPublicUser } from "@/lib/store";
import { whatsappProfileStatus } from "@/lib/whatsapp-profile";
import { canUseWhatsApp } from "@/lib/whatsapp-schema";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (currentUser?.role !== "OWNER") {
    return <AccessDeniedView message="Apenas o dono pode ver detalhes de usuarios." />;
  }

  const { id } = await params;
  const user = db.users.find((item) => item.id === id);
  if (!user) notFound();
  const link = whatsappProfileStatus(user, db.whatsappLinks);
  return (
    <Stack spacing={3}>
      <RecordDetailView config={getModuleConfig("usuarios")} record={toPublicUser(user) as unknown as Record<string, unknown>} />
      {canUseWhatsApp(user.role) && (
        <WhatsAppProfileAccessCard
          viewerUserId={currentUser.id}
          account={{ userId: user.id, name: user.name, isActive: user.isActive, mustChangePassword: user.mustChangePassword, ...link }}
        />
      )}
    </Stack>
  );
}
