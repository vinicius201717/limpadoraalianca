import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/api-handlers";
import { authorizeServiceOrderAccess, ServiceOrderAuthorizationError } from "@/lib/service-order-access";
import { db } from "@/lib/store";

async function GETHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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
  const photos = db.serviceOrderChecklistPhotos
    .filter((photo) => photo.serviceOrderId === id)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((photo) => ({
      ...photo,
      checklistItemTitle: db.serviceOrderChecklistItems.find((item) => item.id === photo.checklistItemId)?.title ?? "",
      uploadedByName: db.users.find((user) => user.id === photo.uploadedByUserId)?.name ?? "",
      employeeName: photo.employeeId ? db.employees.find((employee) => employee.id === photo.employeeId)?.name ?? "" : "",
    }));

  return NextResponse.json({ photos });
}

async function POSTHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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
  return NextResponse.json(
    { message: "Anexe fotos diretamente em um item do checklist para manter o historico da OS organizado." },
    { status: 405, headers: { Allow: "GET" } },
  );
}

export const GET = withDatabase(GETHandler);
export const POST = withDatabase(POSTHandler);
