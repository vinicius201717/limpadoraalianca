import "server-only";
import { createHmac } from "node:crypto";
import { ConcurrentUpdateError, insertAppState, readAppState, writeAppState } from "./app-state-db";
import { getEnv } from "./env";

type Bucket = { count: number; expiresAt: number };
/** One bounded database record, shared by every function instance. No process-local bypass. */
export async function consumeRateLimit(scope: string, identity: string, limit: number, windowMs: number) {
  const id = `security-rate-${scope}`;
  const key = createHmac("sha256", getEnv().JWT_SECRET).update(identity).digest("hex");
  for (let attempt = 0; attempt < 8; attempt++) {
    const now = Date.now();
    const row = await readAppState(id);
    const buckets = Object.fromEntries(Object.entries((row?.data ?? {}) as Record<string, Bucket>).filter(([, value]) => value.expiresAt > now));
    const current = buckets[key] ?? { count: 0, expiresAt: now + windowMs };
    if (current.count >= limit || (!buckets[key] && Object.keys(buckets).length >= 5000)) return Math.max(1, Math.ceil((current.expiresAt - now) / 1000));
    buckets[key] = { count: current.count + 1, expiresAt: current.expiresAt };
    try {
      if (row) await writeAppState(id, buckets, row.version);
      else await insertAppState(id, buckets);
      return 0;
    } catch (error) { if (!(error instanceof ConcurrentUpdateError)) throw error; }
  }
  return 2;
}
