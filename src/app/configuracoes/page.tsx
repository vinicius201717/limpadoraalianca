export const dynamic = "force-dynamic";
import { AccessDeniedView } from "@/components/AccessDeniedView";
import { SettingsSecurityView } from "@/components/SettingsSecurityView";
import { getCurrentUser } from "@/lib/auth";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    return <AccessDeniedView message="Faca login para acessar suas configuracoes." />;
  }

  return <SettingsSecurityView user={user} />;
}
