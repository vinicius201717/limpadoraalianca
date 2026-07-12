import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { canEvaluateSupervisor } from "@/lib/permissions";
import { canUserAccessOrder, createSupervisorEvaluation, db, getLinkedEmployeeId } from "@/lib/store";

const supervisorEvaluationSchema = z.object({
  clarityScore: z.coerce.number().min(1).max(5),
  organizationScore: z.coerce.number().min(1).max(5),
  respectScore: z.coerce.number().min(1).max(5),
  taskDistributionScore: z.coerce.number().min(1).max(5),
  communicationScore: z.coerce.number().min(1).max(5),
  supportScore: z.coerce.number().min(1).max(5),
  leadershipScore: z.coerce.number().min(1).max(5),
  positiveNotes: z.string().optional(),
  improvementNotes: z.string().optional(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canEvaluateSupervisor(auth.user.role)) {
    return NextResponse.json({ message: "Apenas COLABORADOR pode avaliar o supervisor." }, { status: 403 });
  }

  const { id } = await context.params;
  const order = db.serviceOrders.find((item) => item.id === id);
  if (!order) return NextResponse.json({ message: "OS nao encontrada." }, { status: 404 });
  if (!canUserAccessOrder(auth.user, order)) {
    return NextResponse.json({ message: "Perfil sem permissao para avaliar supervisor desta OS." }, { status: 403 });
  }

  const employeeId = getLinkedEmployeeId(auth.user);
  if (!employeeId || !order.employeeIds.includes(employeeId)) {
    return NextResponse.json({ message: "Colaborador nao esta escalado nesta OS." }, { status: 403 });
  }
  if (!order.supervisorEmployeeId || !order.supervisorUserId) {
    return NextResponse.json({ message: "OS sem supervisor designado." }, { status: 400 });
  }
  const alreadyEvaluated = db.supervisorEvaluations.some(
    (evaluation) => evaluation.serviceOrderId === id && evaluation.employeeUserId === auth.user.id,
  );
  if (alreadyEvaluated) {
    return NextResponse.json({ message: "Supervisor ja avaliado por este colaborador nesta OS." }, { status: 409 });
  }

  const parsed = supervisorEvaluationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const evaluation = createSupervisorEvaluation({
    serviceOrderId: id,
    supervisorEmployeeId: order.supervisorEmployeeId,
    supervisorUserId: order.supervisorUserId,
    employeeId,
    employeeUserId: auth.user.id,
    positiveNotes: parsed.data.positiveNotes ?? "",
    improvementNotes: parsed.data.improvementNotes ?? "",
    clarityScore: parsed.data.clarityScore,
    organizationScore: parsed.data.organizationScore,
    respectScore: parsed.data.respectScore,
    taskDistributionScore: parsed.data.taskDistributionScore,
    communicationScore: parsed.data.communicationScore,
    supportScore: parsed.data.supportScore,
    leadershipScore: parsed.data.leadershipScore,
  });

  return NextResponse.json({ evaluation }, { status: 201 });
}
