// Exposes only the signed WhatsApp callback during a local test.
import { createServer } from "node:http";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const CALLBACK = "/api/whatsapp/webhook";
const MAX_BODY = 1024 * 1024;
const sameSecret = (a, b) => Boolean(b) && timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

export function createWhatsAppTestGateway({ upstream, appSecret, verifyToken, onStatus = () => {} }) {
  const target = new URL(upstream);
  if (target.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) || target.username || target.password || target.pathname !== "/" || target.search || target.hash) throw new Error("Upstream must be a loopback HTTP origin.");
  if (!appSecret || !verifyToken) throw new Error("Configure WhatsApp webhook secrets before starting the gateway.");
  const server = createServer({ requestTimeout: 30_000, headersTimeout: 10_000, maxHeaderSize: 16_384 }, async (req, res) => {
    const reply = (status, message) => { res.writeHead(status, { "Content-Type": "text/plain", "Cache-Control": "no-store" }); res.end(message); };
    try {
      if (!req.url || req.url.length > 4096 || req.url.split("?")[0] !== CALLBACK) return reply(404, "Not found");
      if (!["GET", "POST"].includes(req.method)) return reply(405, "Method not allowed");
      const url = new URL(req.url, target);
      let body;
      const headers = {};
      if (req.method === "GET") {
        if (url.searchParams.get("hub.mode") !== "subscribe" || !sameSecret(url.searchParams.get("hub.verify_token") || "", verifyToken)) return reply(403, "Forbidden");
      } else {
        if (Number(req.headers["content-length"]) > MAX_BODY) return reply(413, "Payload too large");
        const chunks = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > MAX_BODY) return reply(413, "Payload too large"); chunks.push(chunk); }
        body = Buffer.concat(chunks);
        const signature = req.headers["x-hub-signature-256"];
        if (typeof signature !== "string" || !/^sha256=[a-f0-9]{64}$/i.test(signature) || !timingSafeEqual(createHmac("sha256", appSecret).update(body).digest(), Buffer.from(signature.slice(7), "hex"))) return reply(401, "Unauthorized");
        headers["content-type"] = "application/json";
        headers["x-hub-signature-256"] = signature;
      }
      const result = await fetch(url, { method: req.method, headers, body, redirect: "error", signal: AbortSignal.timeout(25_000) });
      const responseBody = await result.text();
      if (body && result.ok) {
        try {
          const data = JSON.parse(body.toString("utf8"));
          for (const entry of data.entry ?? []) for (const change of entry.changes ?? []) for (const status of change.value?.statuses ?? []) onStatus({ status: status.status, errorCodes: (status.errors ?? []).map(error => error.code) });
        } catch { /* Status diagnostics must never break callback acknowledgement. */ }
      }
      res.writeHead(result.status, { "Content-Type": result.headers.get("content-type") || "text/plain", "Cache-Control": "no-store" });
      res.end(responseBody);
    } catch { if (!res.headersSent) reply(502, "Callback unavailable"); else res.end(); }
  });
  server.on("upgrade", (_req, socket) => socket.destroy());
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.WHATSAPP_TEST_GATEWAY_PORT || 4313);
  const server = createWhatsAppTestGateway({ upstream: process.env.WHATSAPP_TEST_UPSTREAM || "http://127.0.0.1:4312", appSecret: process.env.WHATSAPP_APP_SECRET, verifyToken: process.env.WHATSAPP_VERIFY_TOKEN, onStatus: status => console.log(JSON.stringify({ whatsappDelivery: status })) });
  server.listen(port, "127.0.0.1", () => console.log("WhatsApp callback gateway listening on 127.0.0.1:" + port));
}
