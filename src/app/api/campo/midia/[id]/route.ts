import { requireApiUser } from "@/lib/api-handlers";
import { withDatabase } from "@/lib/with-database";
import { db } from "@/lib/store";
import { fieldHistory } from "@/lib/field-assistant";
import { signedFieldDownload } from "@/lib/field-storage";

export const GET = withDatabase(async (request, context: { params: Promise<{ id: string }> }) => {
  const auth = await requireApiUser(request); if (auth.response) return auth.response;
  const { id } = await context.params;
  const entry = [...db.workHistory, ...db.warehouseJournal, ...db.officeJournal].find((item) => item.attachment?.id === id);
  if (!entry || !entry.attachment?.storagePath.startsWith("campo/")) return Response.json({ message: "Mídia não encontrada." }, { status: 404 });
  try {
    if (!fieldHistory(auth.user, entry.serviceOrderId).some((item) => item.id === entry.id))
      return Response.json({ message: "Mídia não autorizada." }, { status: 403 });
    return Response.redirect(await signedFieldDownload(entry.attachment), 302);
  } catch { return Response.json({ message: "Anexo indisponível ou sem permissão." }, { status: 403 }); }
});
