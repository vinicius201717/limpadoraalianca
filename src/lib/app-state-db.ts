import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "./prisma";

export class DatabaseUnavailableError extends Error {}
export class ConcurrentUpdateError extends Error {}
export type StateSnapshot = { data: unknown; version: string };
function supabase() {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new DatabaseUnavailableError("Banco de dados não configurado.");
  return { url, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" } };
}
async function request(path: string, init?: RequestInit) {
  const config = supabase();
  try {
    const response = await fetch(`${config.url}/rest/v1/app_state?${path}`, {
      ...init, headers: { ...config.headers, ...init?.headers }, cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    if (response.status === 409) throw new ConcurrentUpdateError("Registro criado por outra operação.");
    if (!response.ok) throw new DatabaseUnavailableError(`Banco indisponível (${response.status}).`);
    return response;
  } catch (error) {
    if (error instanceof ConcurrentUpdateError || error instanceof DatabaseUnavailableError) throw error;
    throw new DatabaseUnavailableError("Não foi possível acessar o banco.");
  }
}
export async function readAppState(id: string): Promise<StateSnapshot | null> {
  if (!process.env.DATABASE_URL?.trim()) {
    const response = await request(`id=eq.${encodeURIComponent(id)}&select=data,updated_at&limit=1`);
    const rows = await response.json() as Array<{ data: unknown; updated_at: string }>;
    if (!rows.length) return null;
    if (!rows[0].updated_at || !Number.isFinite(Date.parse(rows[0].updated_at))) throw new DatabaseUnavailableError("Versão do registro inválida.");
    return { data: rows[0].data, version: rows[0].updated_at };
  }
  try {
    const row = await getPrisma().appState.findUnique({ where: { id }, select: { data: true, updatedAt: true } });
    return row ? { data: row.data, version: row.updatedAt.toISOString() } : null;
  } catch { throw new DatabaseUnavailableError("Não foi possível ler o banco."); }
}
/** Compare-and-swap across instances: never overwrite a newer revision. */
export async function writeAppState(id: string, data: unknown, expectedVersion: string): Promise<string> {
  const version = new Date(Math.max(Date.now(), Date.parse(expectedVersion) + 1)).toISOString();
  if (!process.env.DATABASE_URL?.trim()) {
    const response = await request(`id=eq.${encodeURIComponent(id)}&updated_at=eq.${encodeURIComponent(expectedVersion)}`, {
      method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ data, updated_at: version }),
    });
    const rows = await response.json() as Array<{ updated_at: string }>;
    if (rows.length !== 1) throw new ConcurrentUpdateError("Os dados foram atualizados por outra operação. Atualize a tela e tente novamente.");
    return rows[0].updated_at;
  }
  let count: number;
  try {
    ({ count } = await getPrisma().appState.updateMany({ where: { id, updatedAt: new Date(expectedVersion) }, data: { data: data as Prisma.InputJsonValue, updatedAt: new Date(version) } }));
  } catch { throw new DatabaseUnavailableError("Não foi possível gravar no banco."); }
  if (count !== 1) throw new ConcurrentUpdateError("Os dados foram atualizados por outra operação. Atualize a tela e tente novamente.");
  return version;
}
/** Explicit provisioning; never a fallback for missing business data. */
export async function insertAppState(id: string, data: unknown) {
  const version = new Date().toISOString();
  if (!process.env.DATABASE_URL?.trim()) {
    await request("", { method: "POST", body: JSON.stringify({ id, data, updated_at: version }) });
  } else {
    try { await getPrisma().appState.create({ data: { id, data: data as Prisma.InputJsonValue, updatedAt: new Date(version) } }); }
    catch (error) {
      if ((error as { code?: string }).code === "P2002") throw new ConcurrentUpdateError("Registro já existe.");
      throw new DatabaseUnavailableError("Não foi possível criar o registro.");
    }
  }
  return version;
}
