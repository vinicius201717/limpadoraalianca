import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/api-handlers";
import { ServiceOrderAuthorizationError } from "@/lib/service-order-access";
import { buildServiceOrderDetailData } from "@/lib/service-order-detail-data";

function accessErrorResponse(error: ServiceOrderAuthorizationError) {
  return NextResponse.json({ message: error.message }, { status: error.status });
}

async function GETHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const { id } = await context.params;

  try {
    return NextResponse.json({
      detail: buildServiceOrderDetailData(auth.user, id),
    });
  } catch (error) {
    if (error instanceof ServiceOrderAuthorizationError) return accessErrorResponse(error);
    throw error;
  }
}

export const GET = withDatabase(GETHandler);
