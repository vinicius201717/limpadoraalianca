import { requireApiUser } from "@/lib/api-handlers";
import { withDatabase } from "@/lib/with-database";
import { db } from "@/lib/store";
import { fieldHistory } from "@/lib/field-assistant";
import { canManageWhatsAppFinance } from "@/lib/whatsapp-schema";
import { reportScope } from "@/lib/work-reports";

export const GET = withDatabase(async (request, context: { params: Promise<{ id: string }> }) => {
  const auth = await requireApiUser(request); if (auth.response) return auth.response;
  const { id } = await context.params;
  try {
    const entries = fieldHistory(auth.user, id);
    const documents = canManageWhatsAppFinance(auth.user) ? db.financialDocuments.filter((entry) => entry.serviceOrderId === id) : [];
    const canGenerateReport=["OWNER","GERENTE"].includes(auth.user.role); const reports = canGenerateReport ? db.workReports.filter((entry) => entry.serviceOrderId === id && entry.userId === auth.user.id && entry.scope === reportScope(auth.user)) : [];
    return Response.json({ entries, documents, reports, canGenerateReport, title: db.serviceOrders.find((entry) => entry.id === id)?.title });
  } catch { return Response.json({ message: "Sem permissão para o histórico desta obra." }, { status: 403 }); }
});
