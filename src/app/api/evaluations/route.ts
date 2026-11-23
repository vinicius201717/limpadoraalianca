import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUserFromRequest } from "@/lib/auth";
import { canAccessAllServiceOrders, canEvaluateEmployeeProfileByRole } from "@/lib/permissions";
import { canUserAccessOrder, createEvaluation, db, getEmployeeAccessRole } from "@/lib/store";

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

async function GETHandler(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ message: "Nao autenticado." }, { status: 401 });
  if (canAccessAllServiceOrders(user.role)) return NextResponse.json({ evaluations: db.evaluations });
  if (user.role !== "SUPERVISOR_OBRA" && user.role !== "COLABORADOR") {
    return NextResponse.json({ message: "Perfil sem permissao para listar avaliacoes." }, { status: 403 });
  }
  const visibleOrderIds = db.serviceOrders.filter((order) => canUserAccessOrder(user, order)).map((order) => order.id);
  return NextResponse.json({ evaluations: db.evaluations.filter((evaluation) => visibleOrderIds.includes(evaluation.serviceOrderId)) });
}

async function POSTHandler(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ message: "Nao autenticado." }, { status: 401 });

  const parsed = evaluationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const employee = db.employees.find((item) => item.id === parsed.data.employeeId);
  if (!employee) return NextResponse.json({ message: "Colaborador nao encontrado." }, { status: 404 });
  const targetRole = getEmployeeAccessRole(employee);
  if (!canEvaluateEmployeeProfileByRole(user.role, targetRole)) {
    return NextResponse.json({ message: "Perfil sem permissao para avaliar este perfil." }, { status: 403 });
  }

  const order = db.serviceOrders.find((item) => item.id === parsed.data.serviceOrderId);
  if (!order) return NextResponse.json({ message: "OS nao encontrada." }, { status: 404 });
  if (!canUserAccessOrder(user, order)) {
    return NextResponse.json({ message: "Perfil sem permissao para avaliar esta OS." }, { status: 403 });
  }
  const targetInOrder = order.employeeIds.includes(parsed.data.employeeId) || order.supervisorEmployeeId === parsed.data.employeeId;
  if (!targetInOrder) {
    return NextResponse.json({ message: "Perfil avaliado nao pertence a equipe desta OS." }, { status: 400 });
  }
  if (user.role === "SUPERVISOR_OBRA" && targetRole === "COLABORADOR" && !order.employeeIds.includes(parsed.data.employeeId)) {
    return NextResponse.json({ message: "Supervisor so pode avaliar colaboradores da equipe da OS." }, { status: 403 });
  }
  if (user.role === "COLABORADOR" && targetRole === "SUPERVISOR_OBRA" && order.supervisorEmployeeId !== parsed.data.employeeId) {
    return NextResponse.json({ message: "Colaborador so pode avaliar o supervisor principal da OS compartilhada." }, { status: 403 });
  }

  const evaluation = createEvaluation({
    ...parsed.data,
    supervisorUserId: user.id,
    supervisorName: user.name,
  });

  return NextResponse.json({ evaluation }, { status: 201 });
}

export const GET = withDatabase(GETHandler);
export const POST = withDatabase(POSTHandler);
