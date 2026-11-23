import { requireApiUser } from "@/lib/api-handlers";
import { withDatabase } from "@/lib/with-database";
import { db } from "@/lib/store";
import { visibleHistory } from "@/lib/whatsapp-operations";
import { canManageWhatsAppFinance } from "@/lib/whatsapp-schema";
import { reportScope } from "@/lib/work-reports";

export const GET = withDatabase(async (request, context: { params: Promise<{ id: string }> }) => {
  const auth = await requireApiUser(request); if (auth.response) return auth.response;
  const { id } = await context.params;
  try {
    const entries = visibleHistory(auth.user, id);
    const documents = canManageWhatsAppFinance(auth.user) ? db.financialDocuments.filter((entry) => entry.serviceOrderId === id) : [];
    const reports = db.workReports.filter((entry) => entry.serviceOrderId === id && entry.userId === auth.user.id && entry.scope === reportScope(auth.user));
    return Response.json({ entries, documents, reports, title: db.serviceOrders.find((entry) => entry.id === id)?.title });
  } catch { return Response.json({ message: "Sem permissão para o histórico desta obra." }, { status: 403 }); }
});
