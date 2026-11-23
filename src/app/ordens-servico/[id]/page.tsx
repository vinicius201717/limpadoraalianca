import { ServiceOrderDetailLoader } from "@/components/ServiceOrderDetailLoader";

export const dynamic = "force-dynamic";

export default async function ServiceOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ServiceOrderDetailLoader orderId={id} />;
}


