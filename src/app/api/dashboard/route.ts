import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUserFromRequest } from "@/lib/auth";
import { buildDashboardData } from "@/lib/analytics";
import { scopedOperationalData } from "@/lib/operational-projection";
import { ensureDatabaseReady } from "@/lib/store";

async function GETHandler(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ message: "Nao autenticado." }, { status: 401 });

  await ensureDatabaseReady();
  return NextResponse.json(buildDashboardData(scopedOperationalData(user), user));
}

export const GET = withDatabase(GETHandler);
