import { requireApiUser } from "@/lib/api-handlers";
import { withDatabase } from "@/lib/with-database";
import { createWorkReport } from "@/lib/work-reports";
import { AssistantError, visibleHistory } from "@/lib/whatsapp-operations";
import { consumeRateLimit } from "@/lib/rate-limit";

export const maxDuration = 120;
export const POST = withDatabase(async (request, context: { params: Promise<{ id: string }> }) => {
  const auth = await requireApiUser(request); if (auth.response) return auth.response;
  if(!["OWNER","GERENTE"].includes(auth.user.role))return Response.json({message:"Relatórios exclusivos do dono e do gerente."},{status:403});
  const { id } = await context.params;
  try { visibleHistory(auth.user, id); } catch { return Response.json({ message: "Sem permissão para esta obra." }, { status: 403 }); }
  const retry = await consumeRateLimit("work-report", auth.user.id, 10, 60 * 60_000);
  if (retry) return Response.json({ message: "Limite de relatórios atingido. Tente mais tarde." }, { status: 429 });
  try { return Response.json({ report: await createWorkReport(auth.user.id, id) }); }
  catch (error) { return Response.json({ message: error instanceof AssistantError ? error.message : "Não foi possível gerar o relatório. Tente novamente." }, { status: 503 }); }
});
