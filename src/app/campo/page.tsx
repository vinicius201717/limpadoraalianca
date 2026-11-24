import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { FieldAssistantView } from "@/components/FieldAssistantView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Aliança Campo",
  description: "Diário de obras por voz, texto, foto e vídeo.",
  manifest: "/campo.webmanifest",
  appleWebApp: { capable: true, title: "Aliança Campo", statusBarStyle: "black-translucent" },
};
export default async function FieldPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive) redirect("/login?from=/campo");
  if (user.mustChangePassword) redirect("/configuracoes");
  return <FieldAssistantView userName={user.name} />;
}
