import { requireApiUser } from "@/lib/api-handlers";
import { withDatabase } from "@/lib/with-database";
import { db } from "@/lib/store";
import { authorizeFieldContext, fieldAssignment, fieldHistory } from "@/lib/field-assistant";
import { reportScope } from "@/lib/work-reports";

export const GET = withDatabase(async (request) => {
  const auth = await requireApiUser(request); if (auth.response) return auth.response;
  if (auth.user.role === "COLABORADOR") return Response.json({ message: "PWA indisponível para colaboradores." }, { status: 403 });
  const assignment = fieldAssignment(auth.user);
  const id = request.nextUrl.searchParams.get("obra");
  const base = { user: { id: auth.user.id, name: auth.user.name, role: auth.user.role, canViewFinancials: auth.user.canViewFinancials === true }, orders: assignment.orders,
    locked: assignment.locked, assignedOrderId: assignment.orderId, assignmentProblem: assignment.problem,
    warehouseJournal: ["OWNER", "GERENTE", "ALMOXARIFADO"].includes(auth.user.role) ? db.warehouseJournal.slice(-60) : [] };
  if (!id) return Response.json({ ...base, entries: [], reports: [] });
  try { authorizeFieldContext(auth.user, id); }
  catch { return Response.json({ message: "Esta obra não pertence à sua escala ou perfil." }, { status: 403 }); }
  const entries = fieldHistory(auth.user, id).slice(-150);
  const reports = !["OWNER","GERENTE"].includes(auth.user.role) || id === "warehouse" || id === "office" ? [] : db.workReports.filter((item) => item.serviceOrderId === id &&
    item.userId === auth.user.id && item.scope === reportScope(auth.user)).slice(-3);
  return Response.json({ ...base, entries, reports });
});
