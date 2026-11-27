import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { validCpf, normalizeCpf, formatCpf, identitySchema } from "../src/lib/user-identity-schema";
process.env.DATABASE_URL = "";
process.env.SUPABASE_URL = "https://identity-fixture.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";
process.env.JWT_SECRET = "test-only-secret-at-least-thirty-two-characters";
process.env.USER_IDENTITY_KEY = "a".repeat(64);
process.env.APP_URL = "http://localhost:3000";
const { POST, GET } = await import("../src/app/api/users/route");
const identityRoute = await import("../src/app/api/users/[id]/identity/route");
const { signSessionToken } = await import("../src/lib/session-token");
const { db, ensureDatabaseReady } = await import("../src/lib/store");
const { runWithStore } = await import("../src/lib/request-store");
const owner = { id: "owner", name: "Fixture Owner", email: "owner@example.test", role: "OWNER" as const, isActive: true };
const worker = { ...owner, id: "worker", role: "COLABORADOR" as const, email: "worker@example.test" };
let state: Record<string, unknown>, version: string, publicBucket: boolean, failSecond: boolean, uploads: number, objects: Map<string, Buffer>;
const front = "data:image/jpeg;base64," + (await sharp({ create: { width: 800, height: 500, channels: 3, background: "#ff1122" } }).jpeg().toBuffer()).toString("base64");
const back = "data:image/jpeg;base64," + (await sharp({ create: { width: 800, height: 500, channels: 3, background: "#2244ff" } }).jpeg().toBuffer()).toString("base64");
const cpf = "529.982.247-25";
const identity = { cpf, address: "Endereco de teste sintetico", front, back };
function req(path: string, method = "GET", body?: unknown, user: typeof owner | typeof worker = owner) {
  return new NextRequest("http://localhost:3000" + path, { method, headers: { cookie: "floor_session=" + signSessionToken(user), "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
function userBody(phone = "62900000001") { return { name: "Fixture User", phone, role: "COLABORADOR", temporaryPassword: "Unique-test-123!", identity }; }
beforeEach(() => {
  state = { users: [{ ...owner, createdAt: "2026-01-01", updatedAt: "2026-01-01" }, { ...worker, createdAt: "2026-01-01", updatedAt: "2026-01-01" }] };
  version = "2026-01-01T00:00:00.000Z"; publicBucket = false; failSecond = false; uploads = 0; objects = new Map();
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input)); assert.equal(url.origin, "https://identity-fixture.invalid");
    const method = init?.method ?? "GET", path = url.pathname;
    if (path === "/rest/v1/app_state") {
      if (method === "GET") return Response.json([{ data: structuredClone(state), updated_at: version }]);
      if (method === "PATCH") {
        if (url.searchParams.get("updated_at") !== "eq." + version) return Response.json([]);
        const payload = JSON.parse(String(init?.body)); state = structuredClone(payload.data); version = payload.updated_at; return Response.json([{ updated_at: version }]);
      }
    }
    if (path.includes("/storage/v1/bucket/")) return Response.json({ public: publicBucket });
    const prefix = "/storage/v1/object/alianca-user-identity-private-v1";
    if (path === prefix && method === "DELETE") { for (const key of JSON.parse(String(init?.body)).prefixes) objects.delete(key); return Response.json([]); }
    if (path.startsWith(prefix + "/")) {
      const key = decodeURIComponent(path.slice(prefix.length + 1));
      if (method === "POST") { uploads++; if (failSecond && uploads === 2) return Response.json({}, { status: 503 }); objects.set(key, Buffer.from(init?.body as Uint8Array)); return Response.json({}); }
      const object = objects.get(key); return object ? new Response(new Uint8Array(object)) : new Response(null, { status: 404 });
    }
    throw Error("Unexpected fixture endpoint " + path);
  };
});
test("CPF normaliza e valida digitos, rejeita repetidos e campos ausentes", () => {
  assert.equal(validCpf(cpf), true); assert.equal(validCpf("529.982.247-26"), false); assert.equal(validCpf("111.111.111-11"), false);
  assert.equal(normalizeCpf(cpf), "52998224725"); assert.equal(formatCpf("52998224725"), cpf);
  assert.equal(identitySchema.safeParse({ cpf, front }).success, false);
  assert.equal(identitySchema.safeParse({ cpf, front, back }).success, true);
});
test("novo usuario sem documento nao e persistido, nem por caminho alternativo", async () => {
  const { identity: _, ...body } = userBody(); void _;
  assert.equal((await POST(req("/api/users", "POST", body), undefined)).status, 400);
  const response = await runWithStore(async () => { await ensureDatabaseReady(); db.users.push({ ...owner, id: "bypass", createdAt: "", updatedAt: "" }); return Response.json({}); }, true);
  assert.equal(response.status, 422); assert.equal((state.users as unknown[]).length, 2);
});
test("cadastro criptografado, duplicidade e acesso restrito", async () => {
  const response = await POST(req("/api/users", "POST", { ...userBody(), temporaryPassword: "A7x9" }), undefined);
  assert.equal(response.status, 201); const created = await response.json(); const id = created.user.id as string;
  assert.equal(objects.size, 2); assert.ok(!JSON.stringify(state).includes("52998224725")); assert.ok(!JSON.stringify(state).includes(identity.address));
  for (const object of objects.values()) assert.notEqual(object.subarray(0, 2).toString("hex"), "ffd8");
  const ctx = { params: Promise.resolve({ id }) };
  assert.equal((await identityRoute.GET(req("/api/users/" + id + "/identity", "GET", undefined, worker), ctx)).status, 403);
  const summary = await identityRoute.GET(req("/api/users/" + id + "/identity"), ctx); assert.equal(summary.status, 200); assert.equal((await summary.json()).identity.cpf, "52998224725");
  const photos = await identityRoute.GET(req("/api/users/" + id + "/identity?side=both"), ctx); assert.equal(photos.status, 200); assert.match((await photos.json()).front, /^data:image\/jpeg;base64,/);
  const list = await GET(req("/api/users"), undefined); assert.ok(!(await list.text()).includes("cpfIndex"));
  const duplicate = await POST(req("/api/users", "POST", userBody("62900000002")), undefined);
  assert.equal(duplicate.status, 422); assert.equal(objects.size, 2);
  const replacement = await identityRoute.PUT(req("/api/users/" + id + "/identity", "PUT", { ...identity, address: "Alterado" }), ctx); assert.equal(replacement.status, 200); assert.equal(objects.size, 2);
});
test("arquivo falso, fotos iguais, bucket publico e upload parcial sao rejeitados", async () => {
  for (const bad of [{ ...identity, front: "data:image/jpeg;base64,YWJj" }, { ...identity, back: front }]) {
    assert.equal((await POST(req("/api/users", "POST", { ...userBody(), identity: bad }), undefined)).status, 422);
    assert.equal(objects.size, 0);
  }
  publicBucket = true;
  assert.equal((await POST(req("/api/users", "POST", userBody()), undefined)).status, 422);
  publicBucket = false; failSecond = true;
  assert.equal((await POST(req("/api/users", "POST", userBody()), undefined)).status, 422);
  assert.equal(objects.size, 0); assert.equal((state.users as unknown[]).length, 2);
});
