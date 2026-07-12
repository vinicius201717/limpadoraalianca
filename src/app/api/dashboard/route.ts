import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUserFromRequest } from "@/lib/auth";
import { buildDashboardData } from "@/lib/analytics";
import { db, ensureDatabaseReady } from "@/lib/store";

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ message: "Nao autenticado." }, { status: 401 });

  await ensureDatabaseReady();
  return NextResponse.json(buildDashboardData(db));
}
