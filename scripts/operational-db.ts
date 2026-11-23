import "dotenv/config";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import bcrypt from "bcryptjs";
import { insertAppState, readAppState } from "../src/lib/app-state-db";
import { APP_STATE_ID } from "../src/lib/request-store";
import { newPasswordSchema } from "../src/lib/password-policy";

function backupKey() {
  const value = process.env.BACKUP_ENCRYPTION_KEY;
  if (!value || value.length < 32) throw new Error("Configure BACKUP_ENCRYPTION_KEY com pelo menos 32 caracteres; guarde-a separada do backup.");
  return createHash("sha256").update(value).digest();
}
function validate(data: unknown): asserts data is Record<string, unknown> {
  if (!data || typeof data !== "object" || !Array.isArray((data as { users?: unknown }).users) || !(data as { users: unknown[] }).users.length) throw new Error("Backup sem base de usuários válida.");
}
async function main() {
  const action = process.argv[2];
  if (!["inspect", "backup", "verify-backup", "restore-empty", "bootstrap-empty"].includes(action)) throw new Error("Use inspect | backup | verify-backup <arquivo> | restore-empty <arquivo> | bootstrap-empty.");
  if (action === "verify-backup" || action === "restore-empty") {
    if (!process.argv[3]) throw new Error("Informe o arquivo de backup.");
    const envelope = JSON.parse(await readFile(path.resolve(process.argv[3]), "utf8"));
    if (envelope.format !== "alianca-backup-v1") throw new Error("Formato de backup desconhecido.");
    const decipher = createDecipheriv("aes-256-gcm", backupKey(), Buffer.from(envelope.iv, "base64"));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    const decoded = JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.content, "base64")), decipher.final()]).toString("utf8"));
    if (decoded.id !== APP_STATE_ID) throw new Error("Identificador operacional incorreto.");
    validate(decoded.data);
    if (action === "restore-empty") {
      if (await readAppState(APP_STATE_ID)) throw new Error("Restauração recusada: a base de destino já contém dados. Use uma base vazia para ensaiar a recuperação.");
      await insertAppState(APP_STATE_ID, decoded.data);
      const restored = await readAppState(APP_STATE_ID);
      if (!isDeepStrictEqual(restored?.data, decoded.data)) throw new Error("Verificação da restauração falhou.");
    }
    console.log(action === "verify-backup" ? "Backup íntegro e decifrável." : "Backup restaurado e conferido em base vazia."); return;
  }
  const snapshot = await readAppState(APP_STATE_ID);
  if (action === "bootstrap-empty") {
    if (snapshot) throw new Error("Provisionamento recusado: a base já existe.");
    const password = newPasswordSchema.parse(process.env.BOOTSTRAP_PASSWORD);
    const name = process.env.BOOTSTRAP_NAME?.trim(); const email = process.env.BOOTSTRAP_EMAIL?.trim().toLowerCase();
    if (!name || !email || !email.includes("@")) throw new Error("Configure BOOTSTRAP_NAME, BOOTSTRAP_EMAIL e BOOTSTRAP_PASSWORD localmente.");
    const now = new Date().toISOString();
    await insertAppState(APP_STATE_ID, { users: [{ id: `owner-${randomUUID()}`, name, email, role: "OWNER", isActive: true, canViewFinancials: true, mustChangePassword: true, sessionVersion: 0, passwordHash: await bcrypt.hash(password, 12), createdAt: now, updatedAt: now }] });
    console.log("Base vazia provisionada. Troca de senha obrigatória no primeiro acesso."); return;
  }
  if (!snapshot) throw new Error("Base operacional não encontrada; nenhuma alteração executada.");
  validate(snapshot.data);
  if (action === "inspect") {
    console.log(JSON.stringify({ provider: process.env.DATABASE_URL ? "mysql" : "supabase", version: snapshot.version, counts: Object.fromEntries(Object.entries(snapshot.data).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, (value as unknown[]).length])) }, null, 2)); return;
  }
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", backupKey(), iv);
  const content = Buffer.concat([cipher.update(JSON.stringify({ id: APP_STATE_ID, ...snapshot }), "utf8"), cipher.final()]);
  const directory = path.resolve("backups", "database"); await mkdir(directory, { recursive: true });
  const destination = path.join(directory, `app-state-${new Date().toISOString().replace(/[:.]/g, "-")}.encrypted.json`);
  await writeFile(destination, JSON.stringify({ format: "alianca-backup-v1", iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), content: content.toString("base64") }), { flag: "wx", mode: 0o600 });
  console.log(`Backup criptografado criado: ${destination}`);
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Operação falhou."); process.exitCode = 1; });
