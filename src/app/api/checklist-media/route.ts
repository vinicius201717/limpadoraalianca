import { NextRequest, NextResponse } from "next/server";
import { withDatabase } from "@/lib/with-database";
import { getCurrentUserFromRequest } from "@/lib/auth";
import { db, findServiceOrderByClientAccessCode } from "@/lib/store";
import { authorizeServiceOrderAccess, ServiceOrderAuthorizationError } from "@/lib/service-order-access";
import { checklistStoragePath, encodeStoragePath, getSupabaseStorageConfig, supabaseServerHeaders } from "@/lib/checklist-photo-storage";

export const GET = withDatabase(async (request: NextRequest) => {
  const path = request.nextUrl.searchParams.get("path");
  const photo = db.serviceOrderChecklistPhotos.find((item) => checklistStoragePath(item.url) === path);
  if (!path || !photo) return NextResponse.json({ message: "Imagem não encontrada." }, { status: 404 });
  const code = request.nextUrl.searchParams.get("code");
  const clientOrder = code ? findServiceOrderByClientAccessCode(code) : null;
  if (!clientOrder || clientOrder.id !== photo.serviceOrderId) {
    const user = await getCurrentUserFromRequest(request);
    if (!user || user.mustChangePassword) return NextResponse.json({ message: "Acesso restrito." }, { status: 401 });
    try { authorizeServiceOrderAccess(user, photo.serviceOrderId, "read"); }
    catch (error) { if (error instanceof ServiceOrderAuthorizationError) return NextResponse.json({ message: "Acesso restrito." }, { status: error.status }); throw error; }
  }
  const config = getSupabaseStorageConfig();
  if (!config) return NextResponse.json({ message: "Armazenamento indisponível." }, { status: 503 });
  const response = await fetch(`${config.url}/storage/v1/object/sign/${encodeURIComponent(config.bucket)}/${encodeStoragePath(path)}`, {
    method: "POST", headers: { ...supabaseServerHeaders(config.serviceRoleKey), "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 120 }), cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok || typeof result.signedURL !== "string") return NextResponse.json({ message: "Imagem indisponível." }, { status: 502 });
  return NextResponse.redirect(`${config.url}/storage/v1${result.signedURL}`, { headers: { "Referrer-Policy": "no-referrer" } });
});
