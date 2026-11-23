import { withDatabase } from "@/lib/with-database";
import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { canOperateChecklistItemForOrder, getOrderAndChecklistItem } from "@/lib/checklist-access";
import {
  checklistMediaUrl,
  allowedMediaMimeTypes,
  allowedMediaMimeTypeValues,
  allowedVideoMimeTypes,
  encodeStoragePath,
  ensureSupabaseBucket,
  getSupabaseStorageConfig,
  maxPhotoBytes,
  maxVideoDurationSeconds,
  sanitizeFileName,
  supabaseServerHeaders,
} from "@/lib/checklist-photo-storage";
import { canOperateChecklist } from "@/lib/permissions";

const signedUploadSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.enum(allowedMediaMimeTypeValues),
  sizeBytes: z.coerce.number().int().positive().max(maxPhotoBytes),
  durationSeconds: z.coerce.number().positive().max(maxVideoDurationSeconds).optional(),
});

async function POSTHandler(
  request: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> },
) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const { id, itemId } = await context.params;
  const { order, item } = getOrderAndChecklistItem(id, itemId);
  if (!order || !item) return NextResponse.json({ message: "OS ou item nao encontrado." }, { status: 404 });
  if (!(canOperateChecklist(auth.user.role) || auth.user.role === "COLABORADOR") || !canOperateChecklistItemForOrder(auth.user, order, item)) {
    return NextResponse.json({ message: "Perfil sem permissao para anexar midia neste item." }, { status: 403 });
  }

  const parsed = signedUploadSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  if (!allowedMediaMimeTypes.has(parsed.data.mimeType)) {
    return NextResponse.json({ message: "Tipo de midia nao permitido." }, { status: 400 });
  }
  if (allowedVideoMimeTypes.has(parsed.data.mimeType) && typeof parsed.data.durationSeconds !== "number") {
    return NextResponse.json({ message: "Informe a duracao do video antes do upload." }, { status: 400 });
  }

  const config = getSupabaseStorageConfig();
  if (!config) {
    return NextResponse.json({ message: "Upload direto para o storage nao configurado." }, { status: 501 });
  }

  await ensureSupabaseBucket(config);

  const fileName = sanitizeFileName(parsed.data.fileName, parsed.data.mimeType);
  const storagePath = [
    "service-orders",
    id,
    "checklist",
    itemId,
    `${Date.now()}-${randomUUID()}-${fileName}`,
  ].join("/");
  const encodedPath = encodeStoragePath(storagePath);

  const response = await fetch(`${config.url}/storage/v1/object/upload/sign/${encodeURIComponent(config.bucket)}/${encodedPath}`, {
    method: "POST",
    headers: {
      ...supabaseServerHeaders(config.serviceRoleKey),
      "Content-Type": "application/json",
      "x-upsert": "false",
    },
    body: JSON.stringify({ expiresIn: 900 }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    return NextResponse.json({ message: data?.message ?? "Nao foi possivel preparar o upload da midia." }, { status: response.status });
  }

  const signedPath = data?.signedURL ?? data?.signedUrl ?? data?.url;
  if (typeof signedPath !== "string" || !signedPath) {
    return NextResponse.json({ message: "Storage nao retornou URL assinada." }, { status: 502 });
  }
  const storageBaseUrl = `${config.url}/storage/v1`;
  const uploadUrl = signedPath.startsWith("http")
    ? signedPath
    : `${storageBaseUrl}${signedPath.startsWith("/") ? signedPath : `/${signedPath}`}`;

  return NextResponse.json({
    uploadUrl,
    publicUrl: checklistMediaUrl(storagePath),
    storagePath,
    fileName,
  });
}

export const POST = withDatabase(POSTHandler);
