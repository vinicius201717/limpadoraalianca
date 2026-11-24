import { withDatabase } from "@/lib/with-database";
import { NextResponse } from "next/server";

import { AUTH_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";
import {db,ensureDatabaseReady} from "@/lib/store";
import {verifySessionPayload,sessionTokenHash} from "@/lib/session-token";
import type {NextRequest} from "next/server";

async function POSTHandler(request:NextRequest) {
  const token=request.cookies.get(AUTH_COOKIE)?.value;
  if(token&&verifySessionPayload(token)){
    await ensureDatabaseReady();
    const hash=sessionTokenHash(token),now=Date.now();
    db.revokedSessions=db.revokedSessions.filter(s=>s.expiresAt>now);
    if(!db.revokedSessions.some(s=>s.hash===hash))db.revokedSessions.push({hash,expiresAt:now+SESSION_MAX_AGE_SECONDS*1000});
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export const POST = withDatabase(POSTHandler);
