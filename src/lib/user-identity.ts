import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomUUID, timingSafeEqual, createHash } from "node:crypto";
import sharp from "sharp";
import { getSupabaseStorageConfig, supabaseServerHeaders, encodeStoragePath } from "./checklist-photo-storage";
import { db, recordAuditLog } from "./store";
import { onStoreRollback, onStoreCommit } from "./request-store";
import { MAX_DOCUMENT_BYTES, type IdentityInput } from "./user-identity-schema";

export type UserIdentityRecord = { userId: string; cpfIndex: string; sealed: string; frontPath: string; backPath: string; updatedAt: string; updatedBy: string };
export class IdentityError extends Error {}
const bucket = "alianca-user-identity-private-v1";
function key() {
  const raw = process.env.USER_IDENTITY_KEY?.trim();
  if (!raw || !/^[a-f0-9]{64}$/i.test(raw)) throw new IdentityError("Armazenamento de documentos ainda nao configurado. Contate o administrador.");
  return Buffer.from(raw, "hex");
}
function subkey(label: string) { return createHmac("sha256", key()).update(label).digest(); }
function seal(bytes: Buffer, context: string) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", subkey("identity-encryption-v1"), iv);
  cipher.setAAD(Buffer.from(context));
  return Buffer.concat([iv, cipher.update(bytes), cipher.final(), cipher.getAuthTag()]);
}
function open(bytes: Buffer, context: string) {
  if (bytes.length < 29) throw new IdentityError("Documento invalido.");
  const cipher = createDecipheriv("aes-256-gcm", subkey("identity-encryption-v1"), bytes.subarray(0, 12));
  cipher.setAAD(Buffer.from(context)); cipher.setAuthTag(bytes.subarray(-16));
  return Buffer.concat([cipher.update(bytes.subarray(12, -16)), cipher.final()]);
}
function index(cpf: string) { return createHmac("sha256", subkey("identity-cpf-index-v1")).update(cpf).digest("hex"); }
function config() {
  const value = getSupabaseStorageConfig();
  if (!value) throw new IdentityError("Armazenamento privado indisponivel.");
  return value;
}
async function ensureBucket() {
  const c = config(), headers = supabaseServerHeaders(c.serviceRoleKey);
  const url = c.url + "/storage/v1/bucket/" + bucket;
  let result = await fetch(url, { headers, cache: "no-store" });
  if (result.status === 404) {
    const create = await fetch(c.url + "/storage/v1/bucket", { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ id: bucket, name: bucket, public: false, file_size_limit: 2 * 1024 * 1024, allowed_mime_types: ["application/octet-stream"] }) });
    if (!create.ok && create.status !== 409) throw new IdentityError("Nao foi possivel preparar o armazenamento privado.");
    result = await fetch(url, { headers, cache: "no-store" });
  }
  if (!result.ok || (await result.json()).public !== false) throw new IdentityError("Armazenamento de documentos precisa ser privado.");
}
async function upload(path: string, data: Buffer) {
  const c = config();
  const response = await fetch(c.url + "/storage/v1/object/" + bucket + "/" + encodeStoragePath(path), { method: "POST", headers: { ...supabaseServerHeaders(c.serviceRoleKey), "Content-Type": "application/octet-stream", "x-upsert": "false" }, body: new Uint8Array(data), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new IdentityError("Nao foi possivel salvar o documento.");
}
async function remove(paths: string[]) {
  if (!paths.length) return;
  const c = config();
  const response = await fetch(c.url + "/storage/v1/object/" + bucket, { method: "DELETE", headers: { ...supabaseServerHeaders(c.serviceRoleKey), "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: paths }), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("identity_storage_cleanup_failed");
}
async function cleanPhoto(data: string) {
  try {
    const match = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(data);
    if (!match) throw Error();
    const bytes = Buffer.from(match[2], "base64");
    if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES || bytes.toString("base64") !== match[2]) throw Error();
    const image = sharp(bytes, { limitInputPixels: 20_000_000, failOn: "error" });
    const info = await image.metadata();
    if (info.format !== match[1] || (info.pages ?? 1) !== 1 || (info.width ?? 0) < 300 || (info.height ?? 0) < 200) throw Error();
    const cleaned = await image.rotate().resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    if (cleaned.length > MAX_DOCUMENT_BYTES) throw Error();
    return cleaned;
  } catch { throw new IdentityError("Foto invalida, ilegivel ou acima do limite. Envie JPEG, PNG ou WebP nitido."); }
}
export function assertUniqueCpf(cpf: string, userId?: string) {
  const cpfIndex = index(cpf);
  if (db.userIdentities.some(r => r.userId !== userId && r.cpfIndex === cpfIndex)) throw new IdentityError("CPF ja cadastrado para outro usuario.");
  return cpfIndex;
}
export async function saveUserIdentity(userId: string, input: IdentityInput, actorId: string) {
  const cpfIndex = assertUniqueCpf(input.cpf, userId);
  const [front, back] = await Promise.all([cleanPhoto(input.front), cleanPhoto(input.back)]);
  if (timingSafeEqual(createHash("sha256").update(front).digest(), createHash("sha256").update(back).digest())) throw new IdentityError("Frente e verso precisam ser fotos diferentes.");
  await ensureBucket();
  const prefix = userId + "/" + randomUUID(), frontPath = prefix + "/front", backPath = prefix + "/back";
  const previous = db.userIdentities.find(r => r.userId === userId);
  onStoreRollback(() => remove([frontPath, backPath]));
  await upload(frontPath, seal(front, frontPath));
  await upload(backPath, seal(back, backPath));
  const record: UserIdentityRecord = { userId, cpfIndex, sealed: seal(Buffer.from(JSON.stringify({ cpf: input.cpf, address: input.address })), userId).toString("base64"), frontPath, backPath, updatedAt: new Date().toISOString(), updatedBy: actorId };
  db.userIdentities = db.userIdentities.filter(r => r.userId !== userId).concat(record);
  if (previous) onStoreCommit(() => remove([previous.frontPath, previous.backPath]));
  recordAuditLog({ userId: actorId, action: previous ? "UPDATE_USER_IDENTITY" : "CREATE_USER_IDENTITY", entity: "User", entityId: userId });
}
export function identitySummary(userId: string) {
  const record = db.userIdentities.find(r => r.userId === userId);
  if (!record) return null;
  const data = JSON.parse(open(Buffer.from(record.sealed, "base64"), userId).toString("utf8")) as { cpf: string; address: string };
  return { ...data, updatedAt: record.updatedAt };
}
export async function identityPhoto(userId: string, side: "front" | "back") {
  const record = db.userIdentities.find(r => r.userId === userId);
  if (!record) return null;
  const path = side === "front" ? record.frontPath : record.backPath, c = config();
  if (!path.startsWith(userId + "/")) throw new IdentityError("Documento invalido.");
  const response = await fetch(c.url + "/storage/v1/object/" + bucket + "/" + encodeStoragePath(path), { headers: supabaseServerHeaders(c.serviceRoleKey), cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new IdentityError("Documento temporariamente indisponivel.");
  return open(Buffer.from(await response.arrayBuffer()), path);
}
