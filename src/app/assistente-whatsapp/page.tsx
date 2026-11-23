import { AccessDeniedView } from "@/components/AccessDeniedView";
import { WhatsAppAssistantView } from "@/components/WhatsAppAssistantView";
import { getCurrentUser } from "@/lib/auth";
import { canUseWhatsApp } from "@/lib/whatsapp-schema";

export const dynamic = "force-dynamic";
export default async function WhatsAppAssistantPage() {
  const user = await getCurrentUser();
  if (!user || !canUseWhatsApp(user.role)) return <AccessDeniedView message="Seu perfil não tem acesso ao assistente WhatsApp." />;
  return <WhatsAppAssistantView user={user} />;
}
