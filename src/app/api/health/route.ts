import { NextResponse } from "next/server";
import { readAppState } from "@/lib/app-state-db";
import { APP_STATE_ID } from "@/lib/request-store";
import { getEnv } from "@/lib/env";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    getEnv();
    const snapshot = await readAppState(APP_STATE_ID);
    if (!snapshot || !Array.isArray((snapshot.data as { users?: unknown }).users)) throw new Error("Not ready");
    return NextResponse.json({ status: "ready" }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
