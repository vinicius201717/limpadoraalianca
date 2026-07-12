import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUserFromRequest } from "@/lib/auth";
import { authorizeServiceOrderAccess, ServiceOrderAuthorizationError } from "@/lib/service-order-access";
import { db } from "@/lib/store";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ message: "Nao autenticado." }, { status: 401 });

  const { id } = await context.params;
  try {
    authorizeServiceOrderAccess(user, id, "evaluations");
  } catch (error) {
    if (error instanceof ServiceOrderAuthorizationError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    throw error;
  }
  return NextResponse.json({ evaluations: db.evaluations.filter((item) => item.serviceOrderId === id) });
}
