import { requireApiUser } from "@/lib/api-handlers";
import { withDatabase } from "@/lib/with-database";
import { db } from "@/lib/store";
import { visibleHistory } from "@/lib/whatsapp-operations";
import { canManageWhatsAppFinance, canUseWhatsApp } from "@/lib/whatsapp-schema";
import { readAssistantMedia } from "@/lib/whatsapp-provider";
import { authorizeServiceOrderAccess } from "@/lib/service-order-access";

export const GET = withDatabase(async (request, context: { params: Promise<{ id: string }> }) => {
  const auth = await requireApiUser(request); if (auth.response) return auth.response;
  if (!canUseWhatsApp(auth.user.role)) return Response.json({ message: "Sem acesso." }, { status: 403 });
  const { id } = await context.params;
  const entry = db.workHistory.find((item) => item.attachment?.id === id);
  const document = db.financialDocuments.find((item) => item.attachment.id === id);
  let attachment;
  try {
    if (entry && visibleHistory(auth.user, entry.serviceOrderId).some((item) => item.id === entry.id)) attachment = entry.attachment;
    if (document && canManageWhatsAppFinance(auth.user)) { authorizeServiceOrderAccess(auth.user, document.serviceOrderId); attachment = document.attachment; }
  } catch { /* Treat inaccessible objects as absent. */ }
  if (!attachment) return Response.json({ message: "Arquivo não encontrado." }, { status: 404 });
  const bytes = await readAssistantMedia(attachment);
  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": attachment.mimeType, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" } });
});
