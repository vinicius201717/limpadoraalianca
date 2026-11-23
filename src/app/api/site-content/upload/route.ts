import { withDatabase } from "@/lib/with-database";
import { randomUUID } from "crypto";
import { getSupabaseStorageConfig, supabaseServerHeaders } from "@/lib/checklist-photo-storage";
import { extname } from "path";

import { NextResponse, type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/api-handlers";
import { canAccessAllServiceOrders } from "@/lib/permissions";

export const runtime = "nodejs";

const allowedTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/avif", ".avif"],
]);

async function POSTHandler(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canAccessAllServiceOrders(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para enviar imagens do site." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Imagem nao enviada." }, { status: 400 });
  }

  const extension = allowedTypes.get(file.type);
  if (!extension) {
    return NextResponse.json({ message: "Formato de imagem nao permitido." }, { status: 400 });
  }

  const maxSizeInBytes = 3 * 1024 * 1024;
  if (file.size > maxSizeInBytes) {
    return NextResponse.json({ message: "Imagem maior que 3 MB." }, { status: 400 });
  }

  const originalExtension = extname(file.name).toLowerCase();
  const safeExtension = allowedTypes.has(file.type) && originalExtension === extension ? originalExtension : extension;
  const fileName = `${Date.now()}-${randomUUID()}${safeExtension}`;
  const config = getSupabaseStorageConfig();
  if (!config) return NextResponse.json({ message: "Armazenamento não configurado." }, { status: 503 });
  const bucket = `${config.bucket}-site-public`;
  const headers = { ...supabaseServerHeaders(config.serviceRoleKey), "Content-Type": "application/json" };
  const existing = await fetch(`${config.url}/storage/v1/bucket/${encodeURIComponent(bucket)}`, { headers, cache: "no-store" });
  if (existing.status === 404) {
    const created = await fetch(`${config.url}/storage/v1/bucket`, { method: "POST", headers, body: JSON.stringify({ id: bucket, name: bucket, public: true, file_size_limit: maxSizeInBytes, allowed_mime_types: Array.from(allowedTypes.keys()) }) });
    if (!created.ok && created.status !== 409) throw new Error("Não foi possível criar o armazenamento do site.");
  } else if (!existing.ok) throw new Error("Armazenamento indisponível.");
  const uploaded = await fetch(`${config.url}/storage/v1/object/${encodeURIComponent(bucket)}/${fileName}`, { method: "POST", headers: { ...supabaseServerHeaders(config.serviceRoleKey), "Content-Type": file.type, "x-upsert": "false" }, body: await file.arrayBuffer() });
  if (!uploaded.ok) return NextResponse.json({ message: "Não foi possível salvar a imagem." }, { status: 502 });
  return NextResponse.json({ url: `${config.url}/storage/v1/object/public/${encodeURIComponent(bucket)}/${fileName}` }, { status: 201 });

}

export const POST = withDatabase(POSTHandler);
