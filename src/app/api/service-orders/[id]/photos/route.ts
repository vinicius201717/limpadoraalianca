import { NextResponse, type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/api-handlers";
import { authorizeServiceOrderAccess, ServiceOrderAuthorizationError } from "@/lib/service-order-access";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  try {
    authorizeServiceOrderAccess(auth.user, id, "read");
  } catch (error) {
    if (error instanceof ServiceOrderAuthorizationError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    throw error;
  }
  return NextResponse.json({
    photos: [
      { id: `photo-${id}-before`, stage: "Antes", url: "/placeholder-before.jpg" },
      { id: `photo-${id}-during`, stage: "Durante", url: "/placeholder-during.jpg" },
      { id: `photo-${id}-after`, stage: "Depois", url: "/placeholder-after.jpg" },
    ],
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  try {
    authorizeServiceOrderAccess(auth.user, id, "read");
  } catch (error) {
    if (error instanceof ServiceOrderAuthorizationError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    throw error;
  }
  const body = await request.json();
  return NextResponse.json({ photo: { id: `photo-${Date.now()}`, serviceOrderId: id, ...body } }, { status: 201 });
}
