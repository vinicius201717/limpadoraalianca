import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";
import { normalizeChecklistMediaUrl } from "./checklist-photo-storage";
import { DatabaseUnavailableError, readAppState, writeAppState } from "./app-state-db";

export const APP_STATE_ID = "floor-restoration-manager-owner-only";
type State = Record<string, unknown>;
type Context = { state?: State; original?: string; version?: string; loading?: Promise<void> };
const storage = new AsyncLocalStorage<Context>();
const renderContext = cache((): Context => ({}));
function context() { return storage.getStore() ?? renderContext(); }

export function currentState<T>(): T {
  const state = context().state;
  if (!state) throw new DatabaseUnavailableError("O banco precisa ser carregado antes de acessar os dados.");
  return state as T;
}
export function createStateProxy<T extends object>(): T {
  return new Proxy({} as T, {
    get: (_, key) => Reflect.get(currentState<T>(), key),
    set: (_, key, value) => Reflect.set(currentState<T>(), key, value),
    ownKeys: () => Reflect.ownKeys(currentState<T>()),
    getOwnPropertyDescriptor: (_, key) => Object.getOwnPropertyDescriptor(currentState<T>(), key),
  });
}
export async function loadState(defaults: State) {
  const ctx = context();
  ctx.loading ??= (async () => {
    const snapshot = await readAppState(APP_STATE_ID);
    if (!snapshot || !snapshot.data || typeof snapshot.data !== "object" || Array.isArray(snapshot.data)) throw new DatabaseUnavailableError("Base operacional ausente ou inválida. Restaure um backup ou execute o provisionamento explícito.");
    const stored = snapshot.data as State;
    if (!Array.isArray(stored.users) || !stored.users.length) throw new DatabaseUnavailableError("Base operacional sem usuários. Revise o provisionamento.");
    for (const key of Object.keys(defaults)) {
      if (stored[key] !== undefined && !Array.isArray(stored[key])) throw new DatabaseUnavailableError(`Coleção inválida: ${key}.`);
    }
    // Preserve legacy fields; new collections start empty, never with demonstration records.
    ctx.state = { ...structuredClone(defaults), ...stored };
    if (Array.isArray(ctx.state.serviceOrderChecklistPhotos)) {
      for (const photo of ctx.state.serviceOrderChecklistPhotos) if (photo && typeof photo.url === "string") photo.url = normalizeChecklistMediaUrl(photo.url);
    }
    ctx.original = JSON.stringify(ctx.state);
    ctx.version = snapshot.version;
  })();
  await ctx.loading;
}
export async function runWithStore<T extends Response>(operation: () => Promise<T>): Promise<T> {
  return storage.run({}, async () => {
    const response = await operation();
    const ctx = context();
    if (response.status < 400 && ctx.state && ctx.version && JSON.stringify(ctx.state) !== ctx.original) {
      await writeAppState(APP_STATE_ID, ctx.state, ctx.version);
    }
    return response;
  });
}
export function assertStoreReady() { currentState(); }
