import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE, verifySessionPayload } from "./lib/session-token";

const publicPaths = ["/login", "/acompanhe-servico", "/politica-de-privacidade", "/exclusao-de-dados"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const session = verifySessionPayload(token);
  const hasValidSession = Boolean(session);
  const isPublic = publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (!hasValidSession && pathname !== "/" && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    const response = NextResponse.redirect(url);
    if (token) {
      response.cookies.set(AUTH_COOKIE, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
      });
    }
    return response;
  }

  if (session?.mustChangePassword && pathname !== "/configuracoes" && pathname !== "/" && !isPublic) {
    return NextResponse.redirect(new URL("/configuracoes", request.url));
  }
  if (hasValidSession && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
