import { requireApiUser } from "@/lib/api-handlers";
import { withDatabase } from "@/lib/with-database";
import { canViewServiceOrderFinancials } from "@/lib/permissions";
import { db } from "@/lib/store";
import { signedFieldDownload } from "@/lib/field-storage";

export const GET = withDatabase(async (request, context: { params: Promise<{ id: string }> }) => {
  const auth = await requireApiUser(request); if (auth.response) return auth.response;
  const { id } = await context.params;
  const receipt = db.fieldReceipts.find((item) => item.id === id);
  if (!receipt) return Response.json({ message: "Documento não encontrado." }, { status: 404 });
  if (receipt.uploadedByUserId !== auth.user.id && !canViewServiceOrderFinancials(auth.user))
    return Response.json({ message: "Documento restrito ao emissor e ao financeiro." }, { status: 403 });
  try { return Response.redirect(await signedFieldDownload(receipt.attachment), 302); }
  catch { return Response.json({ message: "Documento indisponível." }, { status: 503 }); }
});
