// Run alongside the web process to recover messages after a restart or provider failure.
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const endpoint = new URL("/api/whatsapp/process", process.env.APP_URL || "http://localhost:3000");
const secret = process.env.WHATSAPP_WORKER_SECRET;
if (!secret) throw new Error("WHATSAPP_WORKER_SECRET must be configured before starting the worker.");
let running = true;
process.on("SIGINT", () => { running = false; });
process.on("SIGTERM", () => { running = false; });
while (running) {
  try {
    const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(290000) });
    if (!response.ok) console.error(`WhatsApp worker returned HTTP ${response.status}`);
  } catch { console.error("WhatsApp worker unavailable; retrying shortly."); }
  if (running) await new Promise((resolve) => setTimeout(resolve, 15000));
}
