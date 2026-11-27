import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { AUTH_COOKIE, SESSION_MAX_AGE_SECONDS, signSession } from "@/lib/auth";
import { verifyUserCredentials } from "@/lib/store";

const schema = z.object({
  login: z.string().trim().min(3).optional(),
  email: z.string().trim().optional(),
  password: z.string().min(4).max(128),
}).refine((value) => Boolean(value.login || value.email), {
  message: "Informe telefone ou e-mail.",
});

async function POSTHandler(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos." }, { status: 400 });
  }

  const user = await verifyUserCredentials(parsed.data.login ?? parsed.data.email ?? "", parsed.data.password);

  if (!user) {
    return NextResponse.json({ message: "Credenciais invalidas." }, { status: 401 });
  }

  const token = signSession(user);
  const response = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      canViewFinancials: user.canViewFinancials,
      avatarUrl: user.avatarUrl,
      mustChangePassword: user.mustChangePassword,
    },
  });

  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return response;
}

export const POST = withDatabase(POSTHandler);
