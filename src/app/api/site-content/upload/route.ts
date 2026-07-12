import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { extname, join } from "path";

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

export async function POST(request: NextRequest) {
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

  const maxSizeInBytes = 8 * 1024 * 1024;
  if (file.size > maxSizeInBytes) {
    return NextResponse.json({ message: "Imagem maior que 8 MB." }, { status: 400 });
  }

  const originalExtension = extname(file.name).toLowerCase();
  const safeExtension = allowedTypes.has(file.type) && originalExtension === extension ? originalExtension : extension;
  const fileName = `${Date.now()}-${randomUUID()}${safeExtension}`;
  const uploadDir = join(process.cwd(), "public", "uploads", "site");
  const filePath = join(uploadDir, fileName);

  await mkdir(uploadDir, { recursive: true });
  await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({ url: `/uploads/site/${fileName}` }, { status: 201 });
}
