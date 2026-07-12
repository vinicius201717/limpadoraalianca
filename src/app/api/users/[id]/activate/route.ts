import { NextResponse, type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/api-handlers";
import { canActivateTargetUser } from "@/lib/permissions";
import { db, toPublicUser, updateUserStatus } from "@/lib/store";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const target = db.users.find((user) => user.id === id);
  if (!target) return NextResponse.json({ message: "Usuario nao encontrado." }, { status: 404 });
  if (!canActivateTargetUser(auth.user.role, target.role)) {
    return NextResponse.json({ message: "Voce nao possui permissao para executar esta acao." }, { status: 403 });
  }

  const result = updateUserStatus(id, true, auth.user);
  if (result.error === "PROTECTED_OWNER") {
    return NextResponse.json({ message: "O OWNER nao pode ser alterado pelas APIs normais." }, { status: 403 });
  }
  if (!result.user) return NextResponse.json({ message: "Nao foi possivel ativar usuario." }, { status: 400 });

  return NextResponse.json({ message: "Usuario ativado com sucesso.", user: toPublicUser(result.user) });
}
