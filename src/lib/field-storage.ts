import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { AssistantAttachment } from "./whatsapp-types";
import { FieldError } from "./field-assistant";

const maxImage = 10 * 1024 * 1024;
const maxVideo = 45 * 1024 * 1024;
const maxAudio = 4 * 1024 * 1024;
const bucketName = () => process.env.FIELD_STORAGE_BUCKET || "alianca-campo-privado";
type FieldType = "image" | "video" | "document";
const maxDocument = 15 * 1024 * 1024;
export type UploadClaim = {
  path: string; userId: string; sessionVersion: number; orderId: string;
  mimeType: string; fileName: string; sizeBytes: number; exp: number; type: FieldType;
};
function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new FieldError("Armazenamento privado não configurado.");
  return { url, bucket: bucketName(), headers: { apikey: key, Authorization: `Bearer ${key}` } };
}
function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 24) throw new FieldError("Assinatura de uploads indisponível.");
  return value;
}
function hmac(data: string) { return createHmac("sha256", secret()).update(data).digest("base64url"); }
export function mediaType(mimeType: string): FieldType {
  if (["image/jpeg", "image/png", "image/webp"].includes(mimeType)) return "image";
  if (mimeType === "application/pdf") return "document";
  if (["video/mp4", "video/webm", "video/quicktime"].includes(mimeType)) return "video";
  throw new FieldError("Envie JPG, PNG, WEBP, PDF, MP4, WEBM ou MOV.");
}
export function validateMediaSize(mimeType: string, sizeBytes: number) {
  const type = mediaType(mimeType);
  const max = type === "image" ? maxImage : type === "document" ? maxDocument : maxVideo;
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > max)
    throw new FieldError(type === "image" ? "Imagem deve ter até 10 MB." : type === "document" ? "Comprovante PDF deve ter até 15 MB." : "Vídeo deve ter até 45 MB.");
  return type;
}
async function checkBucket() {
  const c = config();
  const r = await fetch(`${c.url}/storage/v1/bucket/${encodeURIComponent(c.bucket)}`, {
    headers: c.headers, signal: AbortSignal.timeout(12000), cache: "no-store",
  });
  if (r.status === 404) {
    const create = await fetch(`${c.url}/storage/v1/bucket`, {
      method: "POST", headers: { ...c.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.bucket, name: c.bucket, public: false, file_size_limit: maxVideo }),
      signal: AbortSignal.timeout(15000),
    });
    if (!create.ok && create.status !== 409) throw new FieldError("Não foi possível criar armazenamento privado.");
  } else if (!r.ok || (await r.json()).public !== false) throw new FieldError("O bucket do assistente precisa ser privado.");
  return c;
}
function signedUrl(raw: string, base: string) {
  const url = new URL(raw, base);
  const origin = new URL(base);
  if (url.origin !== origin.origin || !url.pathname.startsWith("/storage/v1/object/"))
    throw new FieldError("URL de armazenamento inválida.");
  return url.toString();
}
export async function createUploadTicket(userId: string, sessionVersion: number, orderId: string, mimeType: string, name: string, sizeBytes: number) {
  const type = validateMediaSize(mimeType, sizeBytes);
  const c = await checkBucket();
  const claim: UploadClaim = {
    path: `campo/${randomUUID()}`, userId, sessionVersion, orderId,
    mimeType, fileName: name.replace(/[^\p{L}\p{N}._ -]/gu, "-").slice(0, 120) || "arquivo",
    sizeBytes, exp: Date.now() + 10 * 60_000, type,
  };
  const target = `${c.url}/storage/v1/object/upload/sign/${encodeURIComponent(c.bucket)}/${claim.path}`;
  const r = await fetch(target, { method: "POST", headers: { ...c.headers, "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 300 }), signal: AbortSignal.timeout(16000) });
  if (!r.ok) throw new FieldError("Não foi possível autorizar o envio do arquivo.");
  const result = await r.json();
  const raw = result.url || result.signedURL || result.signedUrl;
  if (typeof raw !== "string") throw new FieldError("Resposta de envio inválida.");
  const payload = Buffer.from(JSON.stringify(claim)).toString("base64url");
  return { uploadUrl: signedUrl(raw, c.url), token: `${payload}.${hmac(payload)}`, maxBytes: type === "image" ? maxImage : type === "document" ? maxDocument : maxVideo };
}
export function verifyUploadTicket(token: string): UploadClaim {
  const parts = token.split(".");
  if (parts.length !== 2 || parts[0].length > 2500) throw new FieldError("Envio inválido.");
  const expected = hmac(parts[0]);
  if (parts[1].length !== expected.length || !timingSafeEqual(Buffer.from(parts[1]), Buffer.from(expected))) throw new FieldError("Envio sem autorização.");
  let claim: UploadClaim;
  try { claim = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")); }
  catch { throw new FieldError("Envio inválido."); }
  if (claim.exp < Date.now() || !/^campo\/[0-9a-f-]{36}$/i.test(claim.path) || !/^[a-zA-Z0-9_-]{1,160}$/.test(claim.orderId))
    throw new FieldError("Envio expirado ou inválido.");
  validateMediaSize(claim.mimeType, claim.sizeBytes);
  return claim;
}
export async function verifyUploadedMedia(claim: UploadClaim) {
  const c = config();
  const url = `${c.url}/storage/v1/object/authenticated/${encodeURIComponent(c.bucket)}/${claim.path}`;
  const res = await fetch(url, { method: "HEAD", headers: c.headers, cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new FieldError("O arquivo ainda não foi enviado ao armazenamento.");
  const storedSize = Number(res.headers.get("content-length"));
  if (storedSize > claim.sizeBytes || storedSize <= 0 || storedSize > (claim.type === "image" ? maxImage : claim.type === "document" ? maxDocument : maxVideo))
    throw new FieldError("O tamanho recebido não corresponde ao envio.");
}
export async function readFieldImage(path: string, maxBytes = maxImage) {
  if (!/^campo\/[0-9a-f-]{36}$/i.test(path)) throw new FieldError("Anexo inválido.");
  const c = config();
  const res = await fetch(`${c.url}/storage/v1/object/authenticated/${encodeURIComponent(c.bucket)}/${path}`, {
    headers: c.headers, cache: "no-store", signal: AbortSignal.timeout(20000),
  });
  if (!res.ok || Number(res.headers.get("content-length")) > maxBytes) throw new FieldError("Não foi possível ler a imagem.");
  const bytes = Buffer.from(await res.arrayBuffer());
  if (!bytes.length || bytes.length > maxBytes) throw new FieldError("Imagem inválida.");
  return bytes;
}
export async function writeFieldAudio(bytes: Buffer, mimeType: string, filename = "gravacao.webm"): Promise<AssistantAttachment> {
  if (!bytes.length || bytes.length > maxAudio || !["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg", "audio/wav", "audio/aac"].includes(mimeType))
    throw new FieldError("Áudio inválido ou acima de 4 MB.");
  const c = await checkBucket();
  const path = `campo/${randomUUID()}`;
  const r = await fetch(`${c.url}/storage/v1/object/${encodeURIComponent(c.bucket)}/${path}`, {
    method: "POST", headers: { ...c.headers, "Content-Type": mimeType, "x-upsert": "false" },
    body: new Uint8Array(bytes), signal: AbortSignal.timeout(25000),
  });
  if (!r.ok) throw new FieldError("Não foi possível arquivar o áudio original.");
  return { id: randomUUID(), storagePath: path, mimeType, fileName: filename.slice(0, 100), sizeBytes: bytes.length };
}
export function fieldAttachment(claim: UploadClaim): AssistantAttachment {
  return { id: randomUUID(), storagePath: claim.path, mimeType: claim.mimeType, fileName: claim.fileName, sizeBytes: claim.sizeBytes };
}
export async function signedFieldDownload(attachment: AssistantAttachment) {
  if (!/^campo\/[0-9a-f-]{36}$/i.test(attachment.storagePath)) throw new FieldError("Arquivo inválido.");
  const c = config();
  const r = await fetch(`${c.url}/storage/v1/object/sign/${encodeURIComponent(c.bucket)}/${attachment.storagePath}`, {
    method: "POST", headers: { ...c.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 60, download: attachment.fileName }),
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new FieldError("Arquivo temporariamente indisponível.");
  const data = await r.json();
  const raw = data.signedURL || data.url;
  if (typeof raw !== "string") throw new FieldError("Link do arquivo inválido.");
  return signedUrl(raw, c.url);
}
