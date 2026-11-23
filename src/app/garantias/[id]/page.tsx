import { CommercialPage } from "@/components/CommercialPage";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <CommercialPage module="garantias" id={id} />; }
