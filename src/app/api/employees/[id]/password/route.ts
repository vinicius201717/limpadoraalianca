import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { changeEmployeeAccessPassword, toPublicUser } from "@/lib/store";

const passwordSchema = z.object({
  currentPassword: z.string().min(6).optional(),
  newPassword: z.string().min(6),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const parsed = passwordSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Senha invalida. Use no minimo 6 caracteres.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await context.params;
  const result = await changeEmployeeAccessPassword(id, parsed.data, auth.user);

  if (result.error === "NOT_FOUND") return NextResponse.json({ message: "Colaborador nao encontrado." }, { status: 404 });
  if (result.error === "NO_USER") return NextResponse.json({ message: "Colaborador sem acesso ao sistema." }, { status: 400 });
  if (result.error === "FORBIDDEN") return NextResponse.json({ message: "Perfil sem permissao para alterar esta senha." }, { status: 403 });
  if (result.error === "CURRENT_PASSWORD_REQUIRED") {
    return NextResponse.json({ message: "Informe a senha atual para alterar sua propria senha." }, { status: 400 });
  }
  if (result.error === "INVALID_CURRENT_PASSWORD") {
    return NextResponse.json({ message: "Senha atual incorreta." }, { status: 401 });
  }
  if (!result.user) return NextResponse.json({ message: "Nao foi possivel alterar a senha." }, { status: 400 });

  return NextResponse.json({
    message: "Senha atualizada com sucesso.",
    user: toPublicUser(result.user),
  });
}
