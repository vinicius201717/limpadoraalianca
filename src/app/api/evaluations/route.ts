import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUserFromRequest } from "@/lib/auth";
import { canAccessAllServiceOrders, canEvaluateEmployees } from "@/lib/permissions";
import { canUserAccessOrder, createEvaluation, db } from "@/lib/store";

const evaluationSchema = z.object({
  serviceOrderId: z.string(),
  employeeId: z.string(),
  employeeName: z.string().optional(),
  punctualityScore: z.coerce.number().min(1).max(5),
  qualityScore: z.coerce.number().min(1).max(5),
  productivityScore: z.coerce.number().min(1).max(5),
  careScore: z.coerce.number().min(1).max(5),
  teamworkScore: z.coerce.number().min(1).max(5),
  clientPostureScore: z.coerce.number().min(1).max(5),
  checklistComplianceScore: z.coerce.number().min(1).max(5),
  positiveNotes: z.string().optional(),
  improvementNotes: z.string().optional(),
  seriousIssue: z.boolean().optional(),
  needsTraining: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ message: "Nao autenticado." }, { status: 401 });
  if (canAccessAllServiceOrders(user.role)) return NextResponse.json({ evaluations: db.evaluations });
  if (user.role !== "SUPERVISOR_OBRA") {
    return NextResponse.json({ message: "Perfil sem permissao para listar avaliacoes." }, { status: 403 });
  }
  const visibleOrderIds = db.serviceOrders.filter((order) => canUserAccessOrder(user, order)).map((order) => order.id);
  return NextResponse.json({ evaluations: db.evaluations.filter((evaluation) => visibleOrderIds.includes(evaluation.serviceOrderId)) });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ message: "Nao autenticado." }, { status: 401 });

  if (!canEvaluateEmployees(user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para avaliar colaboradores." }, { status: 403 });
  }

  const parsed = evaluationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const order = db.serviceOrders.find((item) => item.id === parsed.data.serviceOrderId);
  if (!order) return NextResponse.json({ message: "OS nao encontrada." }, { status: 404 });
  if (!canUserAccessOrder(user, order)) {
    return NextResponse.json({ message: "Perfil sem permissao para avaliar esta OS." }, { status: 403 });
  }
  if (!order.employeeIds.includes(parsed.data.employeeId)) {
    return NextResponse.json({ message: "Colaborador nao pertence a equipe desta OS." }, { status: 400 });
  }

  const evaluation = createEvaluation({
    ...parsed.data,
    supervisorUserId: user.id,
    supervisorName: user.name,
  });

  return NextResponse.json({ evaluation }, { status: 201 });
}
