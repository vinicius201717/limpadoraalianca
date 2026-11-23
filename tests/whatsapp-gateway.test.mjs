import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import { createWhatsAppTestGateway } from "../scripts/whatsapp-test-gateway.mjs";

async function serve(server, t) {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return "http://127.0.0.1:" + server.address().port;
}
const appSecret = "test-gateway-only-secret";
const verifyToken = "test-gateway-only-verifier";
const signed = body => "sha256=" + createHmac("sha256", appSecret).update(body).digest("hex");

test("public gateway rejects other routes, invalid signatures and oversized bodies before forwarding", async (t) => {
  let forwarded = 0;
  const upstream = await serve(createServer((_req, res) => { forwarded++; res.end("ok"); }), t);
  const gateway = await serve(createWhatsAppTestGateway({ upstream, appSecret, verifyToken }), t);
  for (const path of ["/", "/api/login", "/api/whatsapp/connection", "/api/whatsapp/webhook/", "/api/whatsapp/%77ebhook"]) assert.equal((await fetch(gateway + path)).status, 404);
  assert.equal((await fetch(gateway + "/api/whatsapp/webhook")).status, 403);
  assert.equal((await fetch(gateway + "/api/whatsapp/webhook", { method: "DELETE" })).status, 405);
  assert.equal((await fetch(gateway + "/api/whatsapp/webhook", { method: "POST", body: "{}" })).status, 401);
  assert.equal((await fetch(gateway + "/api/whatsapp/webhook", { method: "POST", body: "tampered", headers: { "x-hub-signature-256": signed("original") } })).status, 401);
  assert.equal((await fetch(gateway + "/api/whatsapp/webhook", { method: "POST", body: "x".repeat(1024 * 1024 + 1) })).status, 413);
  assert.equal(forwarded, 0);
});

test("gateway preserves signed bytes and challenge while excluding session credentials", async (t) => {
  const received = []; const statuses = [];
  const upstream = await serve(createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    received.push({ headers: req.headers, body: Buffer.concat(chunks).toString() });
    res.setHeader("set-cookie", "should-not-leave=server");
    res.end(req.method === "GET" ? new URL(req.url, "http://localhost").searchParams.get("hub.challenge") : "accepted");
  }), t);
  const gateway = await serve(createWhatsAppTestGateway({ upstream, appSecret, verifyToken, onStatus: s => statuses.push(s) }), t);
  const challenge = await fetch(gateway + "/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=" + verifyToken + "&hub.challenge=123");
  assert.equal(await challenge.text(), "123");
  assert.equal(challenge.headers.get("set-cookie"), null);
  const body = JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ status: "failed", errors: [{ code: 131026 }] }] } }] }] });
  const result = await fetch(gateway + "/api/whatsapp/webhook", { method: "POST", body, headers: { "x-hub-signature-256": signed(body), authorization: "Bearer never-forward", cookie: "session=never-forward" } });
  assert.equal(result.status, 200);
  assert.equal(received[1].body, body);
  assert.equal(received[1].headers["x-hub-signature-256"], signed(body));
  assert.equal(received[1].headers.authorization, undefined);
  assert.equal(received[1].headers.cookie, undefined);
  assert.deepEqual(statuses, [{ status: "failed", errorCodes: [131026] }]);
  assert.throws(() => createWhatsAppTestGateway({ upstream: "https://example.com", appSecret, verifyToken }));
});
