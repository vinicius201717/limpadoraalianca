import "server-only";

import { randomUUID } from "crypto";

import type { ChecklistPhotoType } from "./types";

export const allowedMediaMimeTypeValues = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;
export const allowedImageMimeTypes = new Set<string>(allowedMediaMimeTypeValues.filter((mimeType) => mimeType.startsWith("image/")));
export const allowedVideoMimeTypes = new Set<string>(allowedMediaMimeTypeValues.filter((mimeType) => mimeType.startsWith("video/")));
export const allowedMediaMimeTypes = new Set<string>(allowedMediaMimeTypeValues);
const defaultBucket = "ordens-servico-fotos";
export const defaultChecklistMaxPhotoBytes = 20 * 1024 * 1024;
export const maxVideoDurationSeconds = 30;
const configuredMaxBytes = Number(process.env.CHECKLIST_MAX_MEDIA_BYTES ?? process.env.CHECKLIST_MAX_PHOTO_BYTES ?? 0);
export const maxPhotoBytes = Number.isFinite(configuredMaxBytes) && configuredMaxBytes > 0 ? Math.min(configuredMaxBytes, 200 * 1024 * 1024) : defaultChecklistMaxPhotoBytes;

export type ChecklistPhotoPayload = {
  url: string;
  type?: ChecklistPhotoType;
  caption?: string;
  employeeId?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  durationSeconds?: number;
};

function hasValue(value: string | undefined) {
  return Boolean(value?.trim());
}

export function getSupabaseStorageConfig() {
  const uploadProvider = process.env.UPLOAD_PROVIDER?.trim().toLowerCase();
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || defaultBucket;
  const configured = hasValue(url) && hasValue(serviceRoleKey);

  if (uploadProvider === "supabase" && !configured) {
    throw new Error("Supabase Storage selecionado, mas SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY nao foram configurados.");
  }

  if (!configured) return null;
  return { url: url as string, serviceRoleKey: serviceRoleKey as string, bucket };
}

export function supabaseServerHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "User-Agent": "floor-restoration-manager-server/1.0",
  };
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([\s\S]+)$/i);
  if (!match) throw new Error("Formato de imagem invalido.");

  const mimeType = match[1].toLowerCase();
  if (!allowedImageMimeTypes.has(mimeType)) throw new Error("Tipo de imagem nao permitido.");

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.byteLength <= 0 || buffer.byteLength > maxPhotoBytes) {
    throw new Error("Imagem vazia ou acima do limite permitido.");
  }

  return { mimeType, buffer };
}

function extensionFor(mimeType: string, fileName?: string) {
  const existingExtension = fileName?.match(/\.(jpe?g|png|webp|heic|heif|mp4|webm|mov)$/i)?.[0]?.toLowerCase();
  if (existingExtension) return existingExtension === ".jpeg" ? ".jpg" : existingExtension;
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/heic") return ".heic";
  if (mimeType === "image/heif") return ".heif";
  if (mimeType === "video/mp4") return ".mp4";
  if (mimeType === "video/webm") return ".webm";
  if (mimeType === "video/quicktime") return ".mov";
  return ".jpg";
}

export function sanitizeFileName(fileName: string | undefined, mimeType: string) {
  const fallback = `evidencia${extensionFor(mimeType)}`;
  const normalized = (fileName?.trim() || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const withoutExtension = normalized.replace(/\.(jpe?g|png|webp|heic|heif|mp4|webm|mov)$/i, "") || "evidencia";
  return `${withoutExtension}${extensionFor(mimeType, normalized)}`;
}

export function encodeStoragePath(path: string) {
  return path.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

export async function ensureSupabaseBucket(config: { url: string; serviceRoleKey: string; bucket: string }) {
  const bucketUrl = `${config.url}/storage/v1/bucket/${encodeURIComponent(config.bucket)}`;
  const headers = supabaseServerHeaders(config.serviceRoleKey);

  const existing = await fetch(bucketUrl, { headers, cache: "no-store" });
  if (existing.ok) {
    const bucket = await existing.json() as { public?: boolean; file_size_limit?: number | null };
    if (bucket.public !== false) throw new Error("Configure o bucket de evidencias como privado antes de enviar arquivos.");
    if (bucket.file_size_limit && bucket.file_size_limit < maxPhotoBytes) throw new Error("O limite do aplicativo excede o limite do bucket. Revise CHECKLIST_MAX_MEDIA_BYTES.");
    return;
  }
  if (existing.status !== 404) {
    throw new Error(`Nao foi possivel validar o bucket de fotos (${existing.status}).`);
  }

  const created = await fetch(`${config.url}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: config.bucket,
      name: config.bucket,
      public: false,
      file_size_limit: String(maxPhotoBytes),
      allowed_mime_types: Array.from(allowedMediaMimeTypes),
    }),
  });

  if (!created.ok && created.status !== 409) {
    throw new Error(`Nao foi possivel criar o bucket de fotos (${created.status}).`);
  }
}

async function uploadDataUrlToSupabase(
  input: ChecklistPhotoPayload,
  context: { serviceOrderId: string; checklistItemId: string; index: number },
) {
  const config = getSupabaseStorageConfig();
  if (!config) throw new Error("Armazenamento de imagens não configurado.");
  if (!input.url.trim().startsWith("data:")) {
    const path = checklistStoragePath(input.url);
    if (!path || !path.startsWith(`service-orders/${context.serviceOrderId}/checklist/${context.checklistItemId}/`)) throw new Error("A imagem não pertence a este item da OS.");
    const response = await fetch(`${config.url}/storage/v1/object/info/${encodeURIComponent(config.bucket)}/${encodeStoragePath(path)}`, { headers: supabaseServerHeaders(config.serviceRoleKey), cache: "no-store" });
    if (!response.ok) throw new Error("Envio da imagem não confirmado pelo armazenamento.");
    const info = await response.json();
    const size = Number(info.metadata?.size ?? info.size);
    const mime = info.metadata?.mimetype ?? info.contentType;
    if (!Number.isFinite(size) || size <= 0 || size > maxPhotoBytes || !allowedMediaMimeTypes.has(mime)) throw new Error("Arquivo inválido no armazenamento.");
    return { ...input, url: checklistMediaUrl(path), sizeBytes: size, mimeType: mime };
  }

  const { mimeType, buffer } = parseDataUrl(input.url);
  await ensureSupabaseBucket(config);

  const fileName = sanitizeFileName(input.fileName, input.mimeType || mimeType);
  const storedFileName = `${Date.now()}-${context.index + 1}-${randomUUID()}-${fileName}`;
  const storagePath = [
    "service-orders",
    context.serviceOrderId,
    "checklist",
    context.checklistItemId,
    storedFileName,
  ].join("/");
  const encodedPath = encodeStoragePath(storagePath);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

  const response = await fetch(`${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}/${encodedPath}`, {
    method: "POST",
    headers: {
      ...supabaseServerHeaders(config.serviceRoleKey),
      "Content-Type": mimeType,
      "x-upsert": "true",
    },
    body: arrayBuffer,
  });

  if (!response.ok) {
    throw new Error(`Nao foi possivel enviar a imagem para o Supabase (${response.status}).`);
  }

  return {
    ...input,
    url: checklistMediaUrl(storagePath),
    fileName,
    mimeType,
    sizeBytes: buffer.byteLength,
  };
}

export async function persistChecklistPhotoUploads(
  photos: ChecklistPhotoPayload[],
  context: { serviceOrderId: string; checklistItemId: string },
) {
  const storedPhotos: ChecklistPhotoPayload[] = [];
  for (const [index, photo] of photos.entries()) {
    storedPhotos.push(await uploadDataUrlToSupabase(photo, { ...context, index }));
  }
  return storedPhotos;
}

export async function deleteChecklistPhotoFromStorage(photoUrl: string) {
  // Keep bytes for recovery. Physical deletion is a retention job after durable metadata commit.
  void photoUrl;
}
export function checklistMediaUrl(path: string) { return `/api/checklist-media?path=${encodeURIComponent(path)}`; }
export function checklistStoragePath(url: string): string | null {
  let path: string | null = null;
  try {
    if (url.startsWith("/api/checklist-media?")) path = new URL(url, "https://local.invalid").searchParams.get("path");
    else {
      const config = getSupabaseStorageConfig();
      const prefix = config ? `${config.url}/storage/v1/object/public/${encodeURIComponent(config.bucket)}/` : "";
      if (prefix && url.startsWith(prefix)) path = decodeURIComponent(url.slice(prefix.length));
    }
  } catch { return null; }
  if (!path || path.includes("\\") || path.split("/").some((part) => !part || part === "." || part === "..")) return null;
  return path;
}
export function normalizeChecklistMediaUrl(url: string) { const path = checklistStoragePath(url); return path ? checklistMediaUrl(path) : url; }
