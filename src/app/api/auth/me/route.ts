import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE, getCurrentUserFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);

  if (!user) {
    const response = NextResponse.json({ user: null }, { status: 401 });
    response.cookies.set(AUTH_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return response;
  }

  return NextResponse.json({ user });
}
