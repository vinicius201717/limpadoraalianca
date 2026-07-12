import { NextResponse, type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/api-handlers";
import { canPromoteSupervisorToManager } from "@/lib/permissions";
import { promoteSupervisorToManager, toPublicUser } from "@/lib/store";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canPromoteSupervisorToManager(auth.user.role)) {
    return NextResponse.json({ message: "Somente OWNER pode promover supervisor para gerente." }, { status: 403 });
  }

  const { id } = await context.params;
  const result = promoteSupervisorToManager(id, auth.user);
  if (result.error === "NOT_FOUND") return NextResponse.json({ message: "Colaborador nao encontrado." }, { status: 404 });
  if (result.error === "EMPLOYEE_NOT_ACTIVE") {
    return NextResponse.json({ message: "Colaborador desligado nao pode ser promovido." }, { status: 400 });
  }
  if (result.error === "NO_USER") return NextResponse.json({ message: "Supervisor sem acesso ao sistema." }, { status: 400 });
  if (result.error === "NOT_SUPERVISOR") {
    return NextResponse.json({ message: "Somente supervisor pode ser promovido para gerente." }, { status: 400 });
  }
  if (!result.employee || !result.user) {
    return NextResponse.json({ message: "Nao foi possivel promover supervisor para gerente." }, { status: 400 });
  }

  return NextResponse.json({
    message: "Supervisor promovido a gerente.",
    employee: result.employee,
    user: toPublicUser(result.user),
  });
}
