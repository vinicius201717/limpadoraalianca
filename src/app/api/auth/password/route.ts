import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { newPasswordSchema } from "@/lib/password-policy";

import { requireApiUser } from "@/lib/api-handlers";
import { AUTH_COOKIE, SESSION_MAX_AGE_SECONDS, signSession } from "@/lib/auth";
import { changeOwnPassword, flushDatabasePersistence, toPublicUser } from "@/lib/store";

const passwordSchema = z.object({
  currentPassword: z.string().min(4).max(128),
  newPassword: newPasswordSchema,
});

async function PATCHHandler(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const parsed = passwordSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Senha invalida. Use entre 4 e 72 caracteres.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const result = await changeOwnPassword(auth.user.id, parsed.data);
  if (result.error === "NOT_FOUND") return NextResponse.json({ message: "Usuario nao encontrado." }, { status: 404 });
  if (result.error === "INVALID_CURRENT_PASSWORD") {
    return NextResponse.json({ message: "Senha atual incorreta." }, { status: 401 });
  }
  if (!result.user) return NextResponse.json({ message: "Nao foi possivel alterar a senha." }, { status: 400 });

  await flushDatabasePersistence();

  const response = NextResponse.json({
    message: "Senha atualizada com sucesso.",
    user: toPublicUser(result.user),
  });
  response.cookies.set(AUTH_COOKIE, signSession(toPublicUser(result.user)), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

export const PATCH = withDatabase(PATCHHandler);
