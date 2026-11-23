import { withDatabase } from "@/lib/with-database";
import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-handlers";
import { canUserAccessOrder, db } from "@/lib/store";
export const GET = withDatabase(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const auth = await requireApiUser(request); if (auth.response) return auth.response;
  const { id } = await context.params;
  const evaluation = db.evaluations.find((item) => item.id === id);
  const order = db.serviceOrders.find((item) => item.id === evaluation?.serviceOrderId);
  if (!evaluation || !order) return NextResponse.json({ message: "Avaliação não encontrada." }, { status: 404 });
  if (!["OWNER", "GERENTE", "SUPERVISOR_OBRA", "COLABORADOR"].includes(auth.user.role) || !canUserAccessOrder(auth.user, order)) return NextResponse.json({ message: "Acesso restrito." }, { status: 403 });
  return NextResponse.json({ evaluation });
});
