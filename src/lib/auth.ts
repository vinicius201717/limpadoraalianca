import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

import type { SessionUser } from "./types";
import { ensureDatabaseReady, getSystemUserForSession } from "./store";
import { AUTH_COOKIE, SESSION_MAX_AGE_SECONDS, signSessionToken, verifySessionPayload } from "./session-token";

export { AUTH_COOKIE, SESSION_MAX_AGE_SECONDS };

export function signSession(user: SessionUser) {
  return signSessionToken(user);
}

export async function verifySessionToken(token?: string): Promise<SessionUser | null> {
  if (!token) return null;

  try {
    const decoded = verifySessionPayload(token);
    if (!decoded) return null;

    await ensureDatabaseReady();
    const currentUser = getSystemUserForSession(decoded.id);
    if (!currentUser) return null;

    return {
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      role: currentUser.role,
      isActive: currentUser.isActive,
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(AUTH_COOKIE)?.value);
}

export function getCurrentUserFromRequest(request: NextRequest) {
  return verifySessionToken(request.cookies.get(AUTH_COOKIE)?.value);
}
