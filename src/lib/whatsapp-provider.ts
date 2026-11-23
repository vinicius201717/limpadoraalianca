import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { AssistantError, digest } from "./whatsapp-operations";
import type { AssistantAttachment, WhatsAppDeliveryUpdate, WhatsAppMessage } from "./whatsapp-types";
import { readLocalMedia, writeLocalMedia } from "./whatsapp-local-media";

export function whatsappConfiguration() {
  const driver = process.env.WHATSAPP_STORAGE_DRIVER || "supabase";
  const required = ["OPENAI_API_KEY", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_BUSINESS_NUMBER", "WHATSAPP_APP_SECRET", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_GRAPH_VERSION", "WHATSAPP_WORKER_SECRET", ...(driver === "supabase" ? ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] : [])];
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (!["local", "supabase"].includes(driver) || (driver === "local" && process.env.VERCEL)) missing.push("WHATSAPP_STORAGE_DRIVER");
  return { ready: missing.length === 0, missing, businessNumber: process.env.WHATSAPP_BUSINESS_NUMBER?.replace(/\D/g, "") ?? "" };
}
export function verifyWhatsAppSignature(raw: Uint8Array, signature: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}
export function secureEquals(value: string, expected: string) {
  return expected.length > 0 && timingSafeEqual(Buffer.from(digest(value), "hex"), Buffer.from(digest(expected), "hex"));
}
const mediaSchema = z.object({ id: z.string().min(1).max(200), mime_type: z.string().max(100).optional(), caption: z.string().max(6000).optional(), filename: z.string().max(255).optional() });
const deliverySchema = z.object({ id: z.string().min(1).max(500), status: z.string().max(60), timestamp: z.string().regex(/^\d{1,12}$/), biz_opaque_callback_data: z.string().max(512).optional(), errors: z.array(z.object({ code: z.number().int().nonnegative() })).max(20).optional() });
const payloadSchema = z.object({ object: z.literal("whatsapp_business_account"), entry: z.array(z.object({ changes: z.array(z.object({ field: z.string(), value: z.object({ metadata: z.object({ phone_number_id: z.string() }).optional(), statuses: z.array(deliverySchema).max(100).optional(), messages: z.array(z.object({ id: z.string().min(1).max(500), from: z.string().regex(/^\d{8,15}$/), timestamp: z.string().regex(/^\d+$/), type: z.string().max(60), text: z.object({ body: z.string().max(6000) }).optional(), audio: mediaSchema.optional(), image: mediaSchema.optional(), document: mediaSchema.optional() })).max(100).optional() }) })).max(100) })).max(100) });
export function parseWhatsAppDeliveryUpdates(payload: unknown): WhatsAppDeliveryUpdate[] {
  const data = payloadSchema.parse(payload);
  const updates: WhatsAppDeliveryUpdate[] = [];
  for (const entry of data.entry) for (const change of entry.changes) {
    if (change.field !== "messages" || change.value.metadata?.phone_number_id !== process.env.WHATSAPP_PHONE_NUMBER_ID) continue;
    for (const status of change.value.statuses ?? []) {
      if (status.status !== "sent" && status.status !== "delivered" && status.status !== "read" && status.status !== "failed") continue;
      updates.push({ id: status.id, trackingId: status.biz_opaque_callback_data, status: status.status, timestamp: new Date(Number(status.timestamp) * 1000).toISOString(), errorCodes: (status.errors ?? []).map((error) => error.code) });
    }
  }
  return updates;
}
export function parseWhatsAppMessages(payload: unknown): WhatsAppMessage[] {
  const data = payloadSchema.parse(payload);
  const result: WhatsAppMessage[] = [];
  for (const entry of data.entry) for (const change of entry.changes) {
    if (change.field !== "messages" || change.value.metadata?.phone_number_id !== process.env.WHATSAPP_PHONE_NUMBER_ID) continue;
    for (const message of change.value.messages ?? []) {
      const media = message.type === "audio" ? message.audio : message.type === "image" ? message.image : message.type === "document" ? message.document : undefined;
      result.push({ id: message.id, from: message.from, type: message.type, text: message.text?.body ?? media?.caption ?? "", timestamp: message.timestamp, mediaId: media?.id, mimeType: media?.mime_type, fileName: media?.filename, status: "QUEUED", attempts: 0, createdAt: new Date().toISOString() });
    }
  }
  return result.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
}
function graphConfig() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const version = process.env.WHATSAPP_GRAPH_VERSION;
  if (!token || !version || !/^v\d+\.\d+$/.test(version)) throw new AssistantError("A conexão com o WhatsApp ainda não está configurada.");
  return { base: `https://graph.facebook.com/${version}`, token };
}
export async function sendWhatsAppReply(phone: string, text: string, trackingId: string) {
  const config = graphConfig();
  const response = await fetch(`${config.base}/${encodeURIComponent(process.env.WHATSAPP_PHONE_NUMBER_ID ?? "")}/messages`, {
    method: "POST", headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: phone, type: "text", biz_opaque_callback_data: trackingId, text: { preview_url: false, body: text.slice(0, 4000) } }), signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`WhatsApp delivery failed (${response.status})`);
  const result = z.object({ messages: z.array(z.object({ id: z.string().min(1).max(500) })).min(1) }).parse(await response.json());
  return result.messages[0].id;
}
const MAX_MEDIA = 16 * 1024 * 1024;
export async function boundedBytes(response: Response, max = MAX_MEDIA) {
  if (!response.ok || Number(response.headers.get("content-length")) > max || !response.body) throw new AssistantError("Não foi possível ler o arquivo ou ele supera 16 MB.");
  const chunks: Uint8Array[] = []; let size = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength; if (size > max) { await reader.cancel(); throw new AssistantError("O arquivo supera o limite de 16 MB."); }
    chunks.push(value);
  }
  if (!size) throw new AssistantError("O arquivo está vazio.");
  return Buffer.concat(chunks);
}
function storageConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, ""); const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new AssistantError("O armazenamento privado de arquivos ainda não foi configurado.");
  return { url, bucket: process.env.WHATSAPP_STORAGE_BUCKET || "assistente-privado", headers: { apikey: key, Authorization: `Bearer ${key}` } };
}
export async function downloadWhatsAppMedia(message: WhatsAppMessage) {
  const config = graphConfig();
  const metadata = await fetch(`${config.base}/${encodeURIComponent(message.mediaId!)}?phone_number_id=${encodeURIComponent(process.env.WHATSAPP_PHONE_NUMBER_ID ?? "")}`, { headers: { Authorization: `Bearer ${config.token}` }, signal: AbortSignal.timeout(20_000) });
  if (!metadata.ok) throw new AssistantError("O arquivo do WhatsApp não está disponível. Envie-o novamente.");
  const data = z.object({ url: z.string().url(), mime_type: z.string(), file_size: z.number().optional() }).parse(await metadata.json());
  const mediaUrl = new URL(data.url);
  if (mediaUrl.protocol !== "https:" || !(mediaUrl.hostname === "lookaside.fbsbx.com" || mediaUrl.hostname.endsWith(".facebook.com") || mediaUrl.hostname.endsWith(".fbcdn.net"))) throw new AssistantError("Origem do arquivo inválida.");
  const mime = data.mime_type.split(";")[0].trim().toLowerCase();
  const allowed = message.type === "audio" ? ["audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav", "audio/webm", "audio/flac", "audio/aac", "audio/amr"] : ["application/pdf", "image/jpeg", "image/png"];
  if (!allowed.includes(mime) || (data.file_size ?? 0) > MAX_MEDIA) throw new AssistantError("Envie áudio de até 16 MB ou comprovante em PDF, JPG ou PNG.");
  const response = await fetch(mediaUrl, { headers: { Authorization: `Bearer ${config.token}` }, redirect: "error", signal: AbortSignal.timeout(30_000) });
  return { bytes: await boundedBytes(response), mime };
}
export async function storeAssistantMedia(message: WhatsAppMessage, bytes: Buffer, mimeType: string): Promise<AssistantAttachment> {
  if (!bytes.length || bytes.length > MAX_MEDIA) throw new AssistantError("O arquivo está vazio ou supera 16 MB.");
  const id = digest(message.id); const storagePath = `whatsapp/${id}`;
  const driver = process.env.WHATSAPP_STORAGE_DRIVER || "supabase";
  if (driver === "local") {
    try { await writeLocalMedia(id, bytes); }
    catch { throw new AssistantError("Não foi possível salvar o arquivo no armazenamento privado local."); }
  } else if (driver === "supabase") {
    await storeSupabaseMedia(storagePath, bytes, mimeType);
  } else { throw new AssistantError("Configure o armazenamento privado de arquivos."); }
  const extension = mimeType === "application/pdf" ? "pdf" : mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : mimeType.split("/")[1];
  return { id, storagePath, mimeType, fileName: (message.fileName || `arquivo.${extension}`).replace(/[^\p{L}\p{N}._ -]/gu, "-").slice(0, 160), sizeBytes: bytes.length, ...(driver === "local" ? { storageProvider: "local" as const } : {}) };
}
async function storeSupabaseMedia(storagePath: string, bytes: Buffer, mimeType: string) {
  const config = storageConfig();
  const bucketUrl = `${config.url}/storage/v1/bucket/${encodeURIComponent(config.bucket)}`;
  const bucket = await fetch(bucketUrl, { headers: config.headers, signal: AbortSignal.timeout(15_000) });
  if (bucket.status === 404) {
    const created = await fetch(`${config.url}/storage/v1/bucket`, { method: "POST", headers: { ...config.headers, "Content-Type": "application/json" }, body: JSON.stringify({ id: config.bucket, name: config.bucket, public: false, file_size_limit: MAX_MEDIA }), signal: AbortSignal.timeout(15_000) });
    if (!created.ok && created.status !== 409) throw new Error("Private bucket creation failed");
  } else if (!bucket.ok || (await bucket.json()).public !== false) { throw new AssistantError("Configure um bucket privado para os arquivos do assistente."); }
  // Deterministic object key keeps retries from creating a second copy.
  const stored = await fetch(`${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}/${storagePath}`, { method: "POST", headers: { ...config.headers, "Content-Type": mimeType, "x-upsert": "true" }, body: new Uint8Array(bytes), signal: AbortSignal.timeout(30_000) });
  if (!stored.ok) throw new Error("Private attachment persistence failed");
}
export async function readAssistantMedia(attachment: AssistantAttachment) {
  if (!/^whatsapp\/[a-f0-9]{64}$/.test(attachment.storagePath)) throw new AssistantError("Arquivo inválido.");
  if (attachment.storageProvider === "local") {
    try { return await readLocalMedia(attachment.storagePath.slice("whatsapp/".length)); }
    catch { throw new AssistantError("O arquivo privado local não está disponível."); }
  }
  const config = storageConfig();
  return boundedBytes(await fetch(`${config.url}/storage/v1/object/authenticated/${encodeURIComponent(config.bucket)}/${attachment.storagePath}`, { headers: config.headers, signal: AbortSignal.timeout(30_000), cache: "no-store" }));
}
