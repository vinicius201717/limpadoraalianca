import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { AUTH_COOKIE, SESSION_MAX_AGE_SECONDS, signSession } from "@/lib/auth";
import { verifyUserCredentials } from "@/lib/store";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos." }, { status: 400 });
  }

  const user = await verifyUserCredentials(parsed.data.email, parsed.data.password);

  if (!user) {
    return NextResponse.json({ message: "Credenciais invalidas." }, { status: 401 });
  }

  const token = signSession(user);
  const response = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
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
