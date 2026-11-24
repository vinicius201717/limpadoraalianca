import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { FieldAssistantView } from "@/components/FieldAssistantView";
import { FieldLoginView } from "@/components/FieldLoginView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Aliança Campo",
  description: "Diário de obras por voz, texto, foto e vídeo.",
  manifest: "/campo.webmanifest",
  appleWebApp: { capable: true, title: "Aliança Campo", statusBarStyle: "black-translucent" },
};
export default async function FieldPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive) return <FieldLoginView />;
  if (user.mustChangePassword) return <FieldLoginView changePassword />;
  return <FieldAssistantView userName={user.name} />;
}
