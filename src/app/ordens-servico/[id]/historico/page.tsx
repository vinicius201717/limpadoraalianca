import { AccessDeniedView } from "@/components/AccessDeniedView";
import { WorkHistoryView } from "@/components/WorkHistoryView";
import { getCurrentUser } from "@/lib/auth";
import { visibleHistory } from "@/lib/whatsapp-operations";

export const dynamic = "force-dynamic";
export default async function WorkHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const user = await getCurrentUser();
  try { if (!user) throw new Error("Unauthenticated"); visibleHistory(user, id); }
  catch { return <AccessDeniedView message="Seu perfil não tem acesso ao histórico desta obra." />; }
  return <WorkHistoryView orderId={id} />;
}
