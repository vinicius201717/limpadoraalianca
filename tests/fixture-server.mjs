// Local-only disposable database double for browser verification. Never use in production.
import http from "node:http";
import bcrypt from "bcryptjs";
const id = "floor-restoration-manager-owner-only";
const now = new Date().toISOString();
const users = [
  { id: "local-owner", name: "Administrador de teste", email: "owner@example.test", phone: "11999999999", role: "OWNER", isActive: true, canViewFinancials: true, passwordHash: bcrypt.hashSync("Local-test-2026!", 4), sessionVersion: 0, createdAt: now, updatedAt: now },
  { id: "local-collaborator", name: "Colaborador de teste", email: "worker@example.test", phone: "11888888888", role: "COLABORADOR", isActive: true, passwordHash: bcrypt.hashSync("Local-worker-2026!", 4), sessionVersion: 0, createdAt: now, updatedAt: now },
];
const rows = new Map([[id, { data: { users }, updated_at: now }]]);
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1:4311");
  response.setHeader("Content-Type", "application/json");
  const send = (status, payload) => { response.statusCode = status; response.end(JSON.stringify(payload)); };
  if (url.pathname === "/__counts") return send(200, Object.fromEntries(Object.entries(rows.get(id).data).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length])));
  if (url.pathname !== "/rest/v1/app_state") return send(404, { message: "Fixture endpoint not implemented" });
  if (request.headers.apikey !== "local-fixture-key") return send(401, {});
  const rowId = url.searchParams.get("id")?.replace(/^eq\./, "");
  if (request.method === "GET") return send(200, rowId && rows.has(rowId) ? [rows.get(rowId)] : []);
  const chunks = []; for await (const chunk of request) chunks.push(chunk);
  let payload; try { payload = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return send(400, {}); }
  if (request.method === "POST") {
    if (rows.has(payload.id)) return send(409, {});
    rows.set(payload.id, payload); return send(201, payload);
  }
  const previous = rows.get(rowId);
  if (request.method !== "PATCH" || !previous || url.searchParams.get("updated_at") !== `eq.${previous.updated_at}`) return send(200, []);
  rows.set(rowId, payload); return send(200, [payload]);
});
server.listen(4311, "127.0.0.1", () => console.log("Disposable fixture database listening on 127.0.0.1:4311"));
