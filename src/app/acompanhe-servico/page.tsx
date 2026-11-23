export const dynamic = "force-dynamic";
import { ClientServiceTrackingView } from "@/components/ClientServiceTrackingView";

export const metadata = {
  title: "Acompanhe seu servico | Alianca",
  description: "Area do cliente para acompanhar progresso, checklist e fotos do servico.",
};

export default function ClientServiceTrackingPage() {
  return <ClientServiceTrackingView />;
}
