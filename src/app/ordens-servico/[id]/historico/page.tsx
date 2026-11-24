import { AccessDeniedView } from "@/components/AccessDeniedView";
import { WorkHistoryView } from "@/components/WorkHistoryView";
import { getCurrentUser } from "@/lib/auth";
import { fieldHistory } from "@/lib/field-assistant";

export const dynamic = "force-dynamic";
export default async function WorkHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const user = await getCurrentUser();
  try { if (!user) throw new Error("Unauthenticated"); fieldHistory(user, id); }
  catch { return <AccessDeniedView message="Seu perfil não tem acesso ao histórico desta obra." />; }
  return <WorkHistoryView orderId={id} />;
}
