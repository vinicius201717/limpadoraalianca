export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { FieldReceiptsBoard } from "@/components/FieldReceiptsBoard";
import { getCurrentUser } from "@/lib/auth";
import { canViewServiceOrderFinancials } from "@/lib/permissions";
import { db } from "@/lib/store";

export default async function FinancialReceiptsPage() {
  const user = await getCurrentUser();
  if (!user || !canViewServiceOrderFinancials(user)) notFound();
  const rows = [...db.fieldReceipts].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,50).map(({ attachment, ...receipt }) => ({
    ...receipt, fileName: attachment.fileName, mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes,
  })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <FieldReceiptsBoard initial={rows} />;
}
