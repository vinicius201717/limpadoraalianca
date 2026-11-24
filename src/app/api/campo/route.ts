import { requireApiUser } from "@/lib/api-handlers";
import { withDatabase } from "@/lib/with-database";
import { db } from "@/lib/store";
import { fieldHistory, fieldOrders } from "@/lib/field-assistant";
import { reportScope } from "@/lib/work-reports";

export const GET = withDatabase(async (request) => {
  const auth = await requireApiUser(request); if (auth.response) return auth.response;
  const orders = fieldOrders(auth.user);
  const id = request.nextUrl.searchParams.get("obra");
  if (!id) return Response.json({ user: { name: auth.user.name, role: auth.user.role }, orders, entries: [], reports: [] });
  if (!orders.some((o) => o.id === id)) return Response.json({ message: "Obra não permitida para este perfil." }, { status: 403 });
  const entries = fieldHistory(auth.user, id).slice(-100);
  const reports = db.workReports.filter((item) => item.serviceOrderId === id && item.userId === auth.user.id && item.scope === reportScope(auth.user)).slice(-3);
  return Response.json({ user: { name: auth.user.name, role: auth.user.role }, orders, entries, reports });
});
