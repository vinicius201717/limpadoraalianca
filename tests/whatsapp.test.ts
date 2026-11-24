import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import type { Employee, ServiceOrder, SystemUser } from "../src/lib/types";
import type { AssistantIntent } from "../src/lib/whatsapp-schema";
import type { AssistantAttachment, WhatsAppMessage } from "../src/lib/whatsapp-types";

process.env.DATABASE_URL = "";
process.env.SUPABASE_URL = "https://fixture.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-storage-key";
process.env.JWT_SECRET = "test-only-secret-at-least-thirty-two-characters";
process.env.APP_URL = "http://localhost:3000";
process.env.WHATSAPP_APP_SECRET = "test-only-app-secret";
process.env.WHATSAPP_PHONE_NUMBER_ID = "12345";
process.env.WHATSAPP_ACCESS_TOKEN = "test-only-access-token";
process.env.WHATSAPP_GRAPH_VERSION = "v99.0";
process.env.OPENAI_API_KEY = "test-only-openai-key";
const { db, createChecklistItem, ensureDatabaseReady } = await import("../src/lib/store");
const { APP_STATE_ID, runWithStore } = await import("../src/lib/request-store");
const { actorForPhone, assistantContext, assistantTransaction, confirmCommand, consumeLink, createLink, digest, enqueueWhatsAppMessages, proposeCommand, saveDiary, validateIntent, visibleHistory } = await import("../src/lib/whatsapp-operations");
const { parseWhatsAppMessages, verifyWhatsAppSignature, whatsappConfiguration } = await import("../src/lib/whatsapp-provider");
const { drainWhatsAppQueue } = await import("../src/lib/whatsapp-worker");
const { signSessionToken } = await import("../src/lib/session-token");
const { whatsappProfileStatus } = await import("../src/lib/whatsapp-profile");
const { canUseWhatsApp } = await import("../src/lib/whatsapp-schema");
const { createWorkReport } = await import("../src/lib/work-reports");
const { appendFieldEntry, fieldHistory, fieldOrders } = await import("../src/lib/field-assistant");
const { verifyUploadTicket } = await import("../src/lib/field-storage");
const { fieldAssignment, authorizeFieldContext } = await import("../src/lib/field-assistant");
const { processFieldStatement, fieldSpeechContext } = await import("../src/lib/field-automation");
const { diaryAction } = await import("../src/lib/field-action-schema");
import type { FieldAction } from "../src/lib/field-action-schema";
const owner: SystemUser = { id: "owner", name: "Dona", email: "owner@example.test", role: "OWNER", isActive: true, sessionVersion: 0, createdAt: "2026-01-01", updatedAt: "2026-01-01" };
const supervisor: SystemUser = { ...owner, id: "supervisor", name: "Supervisora", role: "SUPERVISOR_OBRA", email: "sup@example.test" };
const finance: SystemUser = { ...owner, id: "finance", name: "Financeiro", role: "FINANCEIRO", email: "fin@example.test" };
const manager: SystemUser = { ...owner, id: "manager", name: "Gerente", role: "GERENTE", email: "manager@example.test" };
const collaborator: SystemUser = { ...owner, id: "worker-user", name: "Carlos", role: "COLABORADOR", email: "worker@example.test" };
const phone = "5511999999999";
function order(id: string): ServiceOrder { return { id, title: `Obra ${id}`, customerId: "customer", customerName: "Cliente", quoteId: "", address: "Rua", description: "Piso", scheduledStart: "2026-12-01", scheduledEnd: "2026-12-10", status: "IN_PROGRESS", employeeIds: id === "a" ? ["worker", "sup-employee"] : [], supervisorUserId: id === "a" ? supervisor.id : undefined, supervisorEmployeeId: id === "a" ? "sup-employee" : undefined, tasks: [], revenue: 1000, expenses: 0, internalNotes: "private", clientNotes: "" }; }
function employee(id: string, userId?: string): Employee { return { id, userId, name: id === "worker" ? "Carlos" : id, phone: "", email: "", document: "", roleName: "Auxiliar", specialty: "Pisos", status: "ACTIVE", dailyCost: 100, hiredAt: "2026-01-01", notes: "", averageRating: 0, serviceOrdersCount: 0, lastJob: "", strengths: [], improvements: [] }; }
function intent(overrides: Partial<AssistantIntent> = {}): AssistantIntent { return { action: "CREATE_CHECKLIST", serviceOrderId: "a", destinationOrderId: null, employeeId: "worker", checklistItemId: null, paymentId: null, title: "Polir a sala", details: "Polir o piso da sala.", question: "", amount: null, financialDirection: null, expenseCategory: null, paidAt: null, paymentMethod: null, ...overrides }; }
const receipt: AssistantAttachment = { id: "a".repeat(64), storagePath: `whatsapp/${"a".repeat(64)}`, fileName: "comprovante.pdf", mimeType: "application/pdf", sizeBytes: 8 };
function incoming(id: string, text: string, extra: Partial<WhatsAppMessage> = {}): WhatsAppMessage { return { id, from: phone, text, type: "text", timestamp: String(Math.floor(Date.now() / 1000)), status: "QUEUED", attempts: 0, createdAt: new Date().toISOString(), ...extra }; }
type Row = { data: Record<string, unknown>; updated_at: string };
const rows = new Map<string, Row>();
let nextIntent: AssistantIntent;
let failWrite = false; let failDelivery = false; let aiCalls = 0; let audioCalls = 0; let reportMode = false;
let beforeDeliveryResponse: ((trackingId: string, messageId: string) => Promise<void>) | undefined;
const deliveries: string[] = []; const prompts: string[] = [];
const state = () => rows.get(APP_STATE_ID)!.data;
function request(path: string, user: SystemUser = owner) { return new NextRequest(`http://localhost:3000${path}`, { headers: { cookie: `floor_session=${signSessionToken(user)}` } }); }
beforeEach(() => {
  failWrite = false; failDelivery = false; aiCalls = 0; audioCalls = 0; reportMode = false; deliveries.length = 0; prompts.length = 0; nextIntent = intent(); rows.clear();
  beforeDeliveryResponse = undefined;
  rows.set(APP_STATE_ID, { data: { users: [owner, supervisor, finance, manager, collaborator].map((user) => structuredClone(user)), serviceOrders: [order("a"), order("b")], employees: [employee("worker", collaborator.id), employee("sup-employee", supervisor.id), employee("outsider")], serviceOrderEmployees: [{ id: "team", serviceOrderId: "a", employeeId: "worker", roleInService: "AUXILIAR", assignedByUserId: "owner", assignedAt: "", createdAt: "", updatedAt: "" }], servicePayments: [{ id: "payment", serviceOrderId: "a", description: "Parcela 1", amount: 100, dueAt: "2026-12-01", createdAt: "", createdByUserId: "owner", receipts: [] }] }, updated_at: "2026-01-01T00:00:00.000Z" });
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.origin === "https://fixture.invalid" && url.pathname === "/rest/v1/app_state") {
      const id = url.searchParams.get("id")?.replace(/^eq\./, "");
      if (!init?.method || init.method === "GET") return Response.json(id && rows.has(id) ? [structuredClone(rows.get(id))] : []);
      if (failWrite) return Response.json({}, { status: 503 });
      const payload = JSON.parse(String(init.body));
      if (init.method === "POST") { if (rows.has(payload.id)) return Response.json({}, { status: 409 }); rows.set(payload.id, structuredClone(payload)); return Response.json(payload); }
      const previous = id ? rows.get(id) : null;
      if (!previous || url.searchParams.get("updated_at") !== `eq.${previous.updated_at}`) return Response.json([]);
      rows.set(id!, structuredClone(payload)); return Response.json([payload]);
    }
    if (url.origin === "https://fixture.invalid" && url.pathname.startsWith("/storage/v1/")) {
      if (url.pathname.includes("/bucket/")) return Response.json({ public: false });
      if (init?.method === "POST") return Response.json({ Key: "stored" });
      return new Response(new Uint8Array(Buffer.from("%PDF-1.4 test")));
    }
    if (url.origin === "https://graph.facebook.com") {
      if (url.pathname.endsWith("/messages")) { if (failDelivery) return Response.json({}, { status: 503 }); const sent = JSON.parse(String(init?.body)); deliveries.push(sent.text.body); const id = `sent-${deliveries.length}`; await beforeDeliveryResponse?.(sent.biz_opaque_callback_data, id); return Response.json({ messages: [{ id }] }); }
      return Response.json({ url: "https://lookaside.fbsbx.com/media", mime_type: "audio/ogg", file_size: 24 });
    }
    if (url.origin === "https://lookaside.fbsbx.com") return new Response(new Uint8Array(Buffer.from("OggS00000000000000000000")));
    if (url.origin === "https://api.openai.com" && url.pathname === "/v1/audio/transcriptions") { audioCalls++; return Response.json({ text: "Na obra a, registramos a preparação do piso." }); }
    if (url.origin === "https://api.openai.com" && url.pathname === "/v1/responses") {
      aiCalls++; prompts.push(String(init?.body));
      return Response.json({ id: "resp_fixture", object: "response", created_at: Math.floor(Date.now() / 1000), model: "gpt-6.2-sol", status: "completed", output: [{ type: "message", id: "msg_fixture", role: "assistant", status: "completed", content: [{ type: "output_text", text: reportMode ? "Relatório baseado no relato de preparação do piso [a]." : JSON.stringify(nextIntent), annotations: [] }] }], usage: { input_tokens: 20, output_tokens: 20, total_tokens: 40, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } } });
    }
    throw new Error(`Unexpected network request in isolated test: ${url.origin}${url.pathname}`);
  };
});

test("local media configuration works without Supabase and rejects ephemeral or unknown storage", () => {
  const keys = ["WHATSAPP_STORAGE_DRIVER", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "VERCEL"];
  const previous = new Map(keys.map(key => [key, process.env[key]]));
  try {
    delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.VERCEL;
    process.env.WHATSAPP_STORAGE_DRIVER = "supabase";
    assert.ok(whatsappConfiguration().missing.includes("SUPABASE_URL"));
    process.env.WHATSAPP_STORAGE_DRIVER = "local";
    assert.ok(!whatsappConfiguration().missing.some(key => key.startsWith("SUPABASE_")));
    process.env.VERCEL = "1";
    assert.ok(whatsappConfiguration().missing.includes("WHATSAPP_STORAGE_DRIVER"));
    delete process.env.VERCEL; process.env.WHATSAPP_STORAGE_DRIVER = "invalid";
    assert.ok(whatsappConfiguration().missing.includes("WHATSAPP_STORAGE_DRIVER"));
  } finally {
    for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test("link is single-use, expires, requires eligible account and revokes with session", async () => {
  await assistantTransaction(() => {
    assert.throws(() => createLink(collaborator), /não tem acesso/);
    assert.throws(() => createLink(finance), /não tem acesso/);
    const link = createLink(owner); assert.equal(db.whatsappLinks[0].tokenHash, digest(link.token));
    assert.ok(!JSON.stringify(db.whatsappLinks).includes(link.token));
    consumeLink(phone, link.token); assert.equal(actorForPhone(phone)?.id, owner.id);
    assert.throws(() => consumeLink(phone, link.token));
    db.users[0].sessionVersion = 1; assert.equal(actorForPhone(phone), null);
    const expired = createLink(supervisor); db.whatsappLinks.find((entry) => entry.userId === supervisor.id)!.tokenExpiresAt = "2000-01-01";
    assert.throws(() => consumeLink("5511888888888", expired.token));
    const warehouse = { ...owner, id: "warehouse", role: "ALMOXARIFADO" as const };
    db.users.push(warehouse);
    const warehouseLink = createLink(warehouse);
    consumeLink("5511777777777", warehouseLink.token);
    assert.equal(actorForPhone("5511777777777")?.id, warehouse.id);
  });
});
test("only owner, manager, supervisor and warehouse can use assistant, without expanding operational permissions", async () => {
  assert.ok(["OWNER", "GERENTE", "SUPERVISOR_OBRA", "ALMOXARIFADO"].every((role) => canUseWhatsApp(role as typeof owner.role)));
  assert.ok(["COMERCIAL", "TECNICO", "FINANCEIRO", "COLABORADOR"].every((role) => !canUseWhatsApp(role as typeof owner.role)));
  await assistantTransaction(() => {
    assert.throws(() => assistantContext(collaborator), /não tem acesso/);
    db.whatsappLinks.push({ userId: collaborator.id, phone: "5511666666666", sessionVersion: 0 });
    assert.equal(actorForPhone("5511666666666"), null);
    assert.equal(whatsappProfileStatus(collaborator, db.whatsappLinks).linked, false);
    assert.throws(() => validateIntent(collaborator, intent()), /não tem acesso/);
    assert.throws(() => validateIntent(collaborator, intent({ action: "DIARY" })), /não tem acesso/);
    const warehouse = { ...owner, id: "warehouse", role: "ALMOXARIFADO" as const };
    db.users.push(warehouse);
    assert.equal(assistantContext(warehouse).orders.length, 0);
    assert.equal(whatsappProfileStatus(warehouse, db.whatsappLinks).linked, false);
    const link = createLink(warehouse);
    consumeLink("5511777777777", link.token);
    assert.deepEqual(whatsappProfileStatus(warehouse, db.whatsappLinks), { linked: true, maskedPhone: "•••• 7777" });
    db.users.find((entry) => entry.id === warehouse.id)!.sessionVersion = 1;
    assert.equal(whatsappProfileStatus(db.users.find((entry) => entry.id === warehouse.id), db.whatsappLinks).linked, false);
  });
});

test("a phone cannot be silently bound to a second account", async () => {
  await assistantTransaction(() => { consumeLink(phone, createLink(owner).token); assert.throws(() => consumeLink(phone, createLink(supervisor).token), /outra conta/); });
});
test("checklist changes require confirmation and duplicate confirmation cannot duplicate work", async () => {
  await assistantTransaction(() => {
    const command = proposeCommand(supervisor, phone, intent(), "m1", "Polir a sala");
    assert.equal(db.serviceOrderChecklistItems.length, 0);
    assert.throws(() => confirmCommand(owner, phone, command.code));
    confirmCommand(supervisor, phone, command.code);
    assert.equal(db.serviceOrderChecklistItems.length, 1); assert.equal(db.serviceOrderChecklistItems[0].assignedEmployeeId, "worker");
    assert.match(confirmCommand(supervisor, phone, command.code), /já foi/);
    assert.equal(db.serviceOrderChecklistItems.length, 1); assert.equal(db.workHistory.length, 1);
  });
});
test("supervisor cannot act outside assigned works or transfer employees or write finances", async () => {
  await assistantTransaction(() => {
    assert.throws(() => validateIntent(supervisor, intent({ serviceOrderId: "b" })));
    assert.throws(() => validateIntent(supervisor, intent({ action: "TRANSFER_EMPLOYEE", destinationOrderId: "b" })));
    assert.throws(() => validateIntent(supervisor, intent({ action: "FILE_RECEIPT", financialDirection: "ARCHIVE" }), receipt));
    assert.throws(() => validateIntent(supervisor, intent({ employeeId: "outsider" })));
    assert.equal(assistantContext(supervisor).orders.length, 1); assert.equal(assistantContext(supervisor).payments.length, 0);
  });
});
test("finance cannot create tasks and manager needs explicit financial permission", async () => {
  await assistantTransaction(() => {
    assert.throws(() => validateIntent(finance, intent()));
    assert.throws(() => validateIntent(manager, intent({ action: "FILE_RECEIPT", financialDirection: "ARCHIVE" }), receipt));
    assert.throws(() => assistantContext(finance), /não tem acesso/);
  });
});
test("expired and revoked authorizations cannot be confirmed", async () => {
  await assistantTransaction(() => {
    const command = proposeCommand(supervisor, phone, intent(), "m1", "Pedido");
    db.serviceOrders[0].supervisorUserId = undefined; db.serviceOrders[0].supervisorEmployeeId = undefined;
    assert.throws(() => confirmCommand(supervisor, phone, command.code)); assert.equal(db.serviceOrderChecklistItems.length, 0);
    const expired = proposeCommand(owner, phone, intent(), "m2", "Pedido"); expired.expiresAt = "2000-01-01";
    assert.throws(() => confirmCommand(owner, phone, expired.code), /expirada/);
  });
});
test("transfer cleans legacy and multiple assignments but preserves completed execution history", async () => {
  await assistantTransaction(() => {
    const pending = createChecklistItem("a", { title: "Pendente", assignedEmployeeIds: ["worker"] }, owner).item!;
    pending.assignedEmployeeIds = undefined;
    const completed = createChecklistItem("a", { title: "Finalizada", assignedEmployeeIds: ["worker"], status: "DONE" }, owner).item!;
    const command = proposeCommand(manager, phone, intent({ action: "TRANSFER_EMPLOYEE", destinationOrderId: "b" }), "transfer", "Transferir");
    confirmCommand(manager, phone, command.code);
    assert.ok(!db.serviceOrders[0].employeeIds.includes("worker")); assert.ok(db.serviceOrders[1].employeeIds.includes("worker"));
    assert.equal(pending.assignedEmployeeId, undefined); assert.deepEqual(pending.assignedEmployeeIds, []);
    assert.equal(completed.assignedEmployeeId, "worker"); assert.equal(db.workHistory.filter((entry) => entry.kind === "TRANSFER").length, 2);
  });
});
test("ongoing work blocks transfer and leaves original assignment intact", async () => {
  await assistantTransaction(() => {
    createChecklistItem("a", { title: "Em execução", assignedEmployeeIds: ["worker"], status: "IN_PROGRESS" }, owner);
    assert.throws(() => proposeCommand(owner, phone, intent({ action: "TRANSFER_EMPLOYEE", destinationOrderId: "b" }), "transfer", "Transferir"), /andamento/);
    assert.ok(db.serviceOrders[0].employeeIds.includes("worker")); assert.equal(db.serviceOrders[1].employeeIds.length, 0);
  });
});
test("internal warnings require confirmation and are hidden from finance", async () => {
  await assistantTransaction(() => {
    const command = proposeCommand(supervisor, phone, intent({ action: "WARN_EMPLOYEE", details: "Atraso relatado de 30 minutos" }), "warn", "Atraso");
    assert.equal(db.employeeWarnings.length, 0); confirmCommand(supervisor, phone, command.code);
    assert.equal(db.employeeWarnings.length, 1); assert.throws(() => visibleHistory(finance, "a"), /não tem acesso/);
    assert.equal(visibleHistory(supervisor, "a").length, 1);
    assert.throws(() => validateIntent(supervisor, intent({ action: "WARN_EMPLOYEE", employeeId: "sup-employee" })));
  });
});
test("archiving receipts never adjusts balances and duplicate attachments are rejected", async () => {
  await assistantTransaction(() => {
    const command = proposeCommand(owner, phone, intent({ action: "FILE_RECEIPT", financialDirection: "ARCHIVE" }), "receipt", "Arquivar", receipt);
    confirmCommand(owner, phone, command.code);
    assert.equal(db.financialDocuments.length, 1); assert.equal(db.serviceOrders[0].expenses, 0); assert.equal(db.servicePayments[0].receipts.length, 0);
    assert.equal(visibleHistory(supervisor, "a").length, 0);
    assert.throws(() => proposeCommand(owner, phone, intent({ action: "FILE_RECEIPT", financialDirection: "ARCHIVE" }), "again", "Arquivar", receipt), /já foi registrado/);
  });
});
test("expense and receipt post to existing financial ledgers only after confirmation", async () => {
  await assistantTransaction(() => {
    const command = proposeCommand(owner, phone, intent({ action: "FILE_RECEIPT", financialDirection: "EXPENSE", amount: 25.5, paidAt: "2026-01-02", expenseCategory: "MATERIAL_OU_PRODUTO" }), "exp", "Lançar", receipt);
    assert.equal(db.serviceOrders[0].expenses, 0); confirmCommand(owner, phone, command.code);
    assert.equal(db.serviceOrders[0].expenses, 25.5); assert.equal(db.serviceExpenses[0].amount, 25.5);
    const payment = proposeCommand(owner, phone, intent({ action: "FILE_RECEIPT", financialDirection: "PAYMENT", amount: 40, paymentId: "payment", paidAt: "2026-01-02", paymentMethod: "PIX" }), "payment", "Receber", { ...receipt, id: "b".repeat(64) });
    confirmCommand(owner, phone, payment.code); assert.equal(db.servicePayments[0].receipts[0].amount, 40);
    assert.throws(() => validateIntent(owner, intent({ action: "FILE_RECEIPT", financialDirection: "PAYMENT", amount: 70, paymentId: "payment", paidAt: "2026-01-02", paymentMethod: "PIX" }), { ...receipt, id: "c".repeat(64) }), /saldo/);
  });
});
test("diary preserves source transcript and is idempotent", async () => {
  await assistantTransaction(() => {
    const input = intent({ action: "DIARY", employeeId: null, details: "Piso preparado." });
    saveDiary(supervisor, input, "diary", "Hoje a gente preparou o piso."); saveDiary(supervisor, input, "diary", "Hoje a gente preparou o piso.");
    assert.equal(db.workHistory.length, 1); assert.equal(db.workHistory[0].transcript, "Hoje a gente preparou o piso.");
  });
});
test("signature protects exact bytes and webhook ignores other business numbers", () => {
  const body = Buffer.from('{"ok":true}'); const signature = `sha256=${createHmac("sha256", process.env.WHATSAPP_APP_SECRET!).update(body).digest("hex")}`;
  assert.equal(verifyWhatsAppSignature(body, signature), true); assert.equal(verifyWhatsAppSignature(Buffer.from('{"ok":false}'), signature), false); assert.equal(verifyWhatsAppSignature(body, "sha256=oops"), false);
  const value = (number: string) => ({ field: "messages", value: { metadata: { phone_number_id: number }, messages: [{ id: number, from: phone, timestamp: "123", type: "text", text: { body: "Oi" } }] } });
  assert.equal(parseWhatsAppMessages({ object: "whatsapp_business_account", entry: [{ changes: [value("other"), value("12345")] }] }).length, 1);
});
test("field assistant excludes collaborators, guards unauthorized orders, and keeps each chunk idempotent", async () => {
  await assistantTransaction(() => {
    assert.throws(() => fieldOrders(collaborator));
    assert.deepEqual(fieldOrders(supervisor).map((order) => order.id), ["a"]);
    assert.deepEqual(fieldOrders(owner).map((order) => order.id), ["a", "b", "office"]);
    assert.throws(() => appendFieldEntry({ user: collaborator, orderId: "a", nonce: "denied-entry-000001", title: "Teste", content: "Não deve salvar." }));
    assert.throws(() => appendFieldEntry({ user: supervisor, orderId: "b", nonce: "not-allowed-entry-1", title: "Teste", content: "Não deve salvar." }));
    const input = { user: supervisor, orderId: "a", nonce: "field-nonce-000001", title: "Áudio transcrito", content: "Faltou material na sala.", transcript: "Faltou material na sala." };
    const one = appendFieldEntry(input);
    const same = appendFieldEntry(input);
    assert.equal(one.id, same.id);
    assert.equal(db.workHistory.length, 1);
    assert.equal(db.workHistory[0].userId, supervisor.id);
    assert.equal(db.workHistory[0].serviceOrderId, "a");
    assert.equal(fieldHistory(supervisor, "a")[0].content, "Faltou material na sala.");
    assert.throws(() => fieldHistory(supervisor, "b"));
  });
});
test("signed field upload tickets reject tampering and expiration", () => {
  const claim = { path: "campo/11111111-1111-4111-8111-111111111111", userId: "worker-user", sessionVersion: 0, orderId: "a", mimeType: "image/jpeg", fileName: "teste.jpg", sizeBytes: 24, exp: Date.now() + 20000, type: "image" };
  const data = Buffer.from(JSON.stringify(claim)).toString("base64url");
  const signature = createHmac("sha256", process.env.JWT_SECRET!).update(data).digest("base64url");
  assert.equal(verifyUploadTicket(`${data}.${signature}`).orderId, "a");
  assert.throws(() => verifyUploadTicket(`${data}.${signature.slice(0, -1)}x`));
  const expired = Buffer.from(JSON.stringify({ ...claim, exp: Date.now() - 1000 })).toString("base64url");
  assert.throws(() => verifyUploadTicket(`${expired}.${createHmac("sha256", process.env.JWT_SECRET!).update(expired).digest("base64url")}`), /expirado/);
});
test("WhatsApp transport has been retired and can never process incoming messages", async () => {
  const before = JSON.stringify(state());
  const webhook = await import("../src/app/api/whatsapp/webhook/route");
  const process = await import("../src/app/api/whatsapp/process/route");
  const connection = await import("../src/app/api/whatsapp/connection/route");
  assert.equal((await webhook.GET()).status, 410);
  assert.equal((await webhook.POST()).status, 410);
  assert.equal((await process.POST()).status, 410);
  assert.equal((await connection.GET()).status, 410);
  assert.equal((await connection.POST()).status, 410);
  assert.equal(JSON.stringify(state()), before);
});
test("database failure does not persist a business mutation or report success", async () => {
  failWrite = true;
  await assert.rejects(assistantTransaction(() => { saveDiary(supervisor, intent({ action: "DIARY" }), "diary", "Original"); }));
  assert.equal(state().workHistory, undefined);
});
test("text to AI proposal to confirmation works with durable deduplication", async () => {
  await assistantTransaction(() => { consumeLink(phone, createLink(supervisor).token); enqueueWhatsAppMessages([incoming("m1", "Crie polir a sala"), incoming("m1", "Crie polir a sala")]); });
  await drainWhatsAppQueue();
  let code = "";
  await assistantTransaction(() => { assert.equal(db.whatsappMessages.length, 1); assert.equal(db.assistantCommands.length, 1); assert.equal(db.serviceOrderChecklistItems.length, 0); code = db.assistantCommands[0].code; });
  assert.equal(aiCalls, 1); assert.match(deliveries[0], /CONFIRMAR/);
  await assistantTransaction(() => enqueueWhatsAppMessages([incoming("m2", `CONFIRMAR ${code}`)])); await drainWhatsAppQueue();
  await assistantTransaction(() => { assert.equal(db.serviceOrderChecklistItems.length, 1); assert.equal(db.whatsappMessages[1].status, "DONE"); });
  assert.equal(aiCalls, 1); assert.match(deliveries[1], /Registrado com sucesso/);
});
test("audio is transcribed, organized and saved with its private attachment", async () => {
  nextIntent = intent({ action: "DIARY", employeeId: null, title: "Preparação", details: "Preparação do piso concluída." });
  await assistantTransaction(() => { consumeLink(phone, createLink(supervisor).token); enqueueWhatsAppMessages([incoming("audio", "", { type: "audio", mediaId: "media", mimeType: "audio/ogg" })]); });
  await drainWhatsAppQueue();
  await assistantTransaction(() => { assert.equal(db.workHistory.length, 1); assert.match(db.workHistory[0].transcript, /preparação/); assert.equal(db.workHistory[0].attachment?.mimeType, "audio/ogg"); });
  assert.equal(audioCalls, 1); assert.equal(aiCalls, 1); assert.match(deliveries[0], /Salvo no histórico/);
});
test("unlinked and deactivated users never invoke AI", async () => {
  await assistantTransaction(() => enqueueWhatsAppMessages([incoming("unknown", "Crie uma tarefa")])); await drainWhatsAppQueue(); assert.equal(aiCalls, 0);
  await assistantTransaction(() => { consumeLink(phone, createLink(owner).token); db.users[0].isActive = false; enqueueWhatsAppMessages([incoming("inactive", "Crie outra tarefa")]); });
  await drainWhatsAppQueue(); assert.equal(aiCalls, 0);
});
test("delivery failure retries only the reply, not the committed business action", async () => {
  nextIntent = intent({ action: "DIARY" }); failDelivery = true;
  await assistantTransaction(() => { consumeLink(phone, createLink(supervisor).token); enqueueWhatsAppMessages([incoming("retry", "Diário")]); });
  await drainWhatsAppQueue(); assert.equal(aiCalls, 1);
  failDelivery = false; await assistantTransaction(() => { delete db.whatsappMessages[0].retryAt; }); await drainWhatsAppQueue();
  await assistantTransaction(() => { assert.equal(db.workHistory.length, 1); assert.ok(db.whatsappMessages[0].replySentAt); }); assert.equal(aiCalls, 1); assert.equal(deliveries.length, 1);
});
test("report prompt contains only accessible history and saves source references", async () => {
  await assistantTransaction(() => {
    saveDiary(supervisor, intent({ action: "DIARY", details: "Piso preparado" }), "diary", "Original");
    const command = proposeCommand(owner, phone, intent({ action: "FILE_RECEIPT", financialDirection: "ARCHIVE", details: "SEGREDO_FINANCEIRO" }), "receipt", "Confidencial", receipt); confirmCommand(owner, phone, command.code);
  });
  reportMode = true; const report = await createWorkReport(supervisor.id, "a");
  assert.ok(report.sourceIds.length >= 2); assert.ok(!prompts[0].includes("SEGREDO_FINANCEIRO")); assert.ok(!prompts[0].includes('"revenue"'));
  await assert.rejects(createWorkReport(supervisor.id, "b"));
});
test("private financial attachment cannot be downloaded by supervisor", async () => {
  await assistantTransaction(() => { const command = proposeCommand(owner, phone, intent({ action: "FILE_RECEIPT", financialDirection: "ARCHIVE" }), "receipt", "Arquivar", receipt); confirmCommand(owner, phone, command.code); });
  const { GET } = await import("../src/app/api/whatsapp/media/[id]/route");
  assert.equal((await GET(request(`/api/whatsapp/media/${receipt.id}`, supervisor), { params: Promise.resolve({ id: receipt.id }) })).status, 404);
  const response = await GET(request(`/api/whatsapp/media/${receipt.id}`, owner), { params: Promise.resolve({ id: receipt.id }) });
  assert.equal(response.status, 200); assert.match(response.headers.get("content-disposition")!, /attachment/);
});

test("a receipt without caption remains available for a later audio explanation", async () => {
  nextIntent = intent({ action: "CLARIFY", question: "A qual obra pertence este comprovante?" });
  await assistantTransaction(() => { consumeLink(phone, createLink(owner).token); enqueueWhatsAppMessages([incoming("document", "", { type: "document", attachment: receipt })]); });
  await drainWhatsAppQueue();
  nextIntent = intent({ action: "FILE_RECEIPT", employeeId: null, financialDirection: "ARCHIVE", title: "Comprovante de material", details: "Compra de material da obra a." });
  await assistantTransaction(() => enqueueWhatsAppMessages([incoming("explanation", "", { type: "audio", mediaId: "media", mimeType: "audio/ogg" })]));
  await drainWhatsAppQueue();
  await assistantTransaction(() => { assert.equal(db.assistantCommands.length, 1); assert.equal(db.assistantCommands[0].attachment?.id, receipt.id); assert.equal(db.financialDocuments.length, 0); confirmCommand(owner, phone, db.assistantCommands[0].code); assert.equal(db.financialDocuments[0].attachment.id, receipt.id); });
  assert.equal(audioCalls, 1); assert.ok(prompts[1].includes('"type":"input_file"'));
});
test("changed financial permission prevents delivery of a previously generated reply", async () => {
  failDelivery = true; nextIntent = intent({ action: "FILE_RECEIPT", employeeId: null, financialDirection: "ARCHIVE", details: "DADO_FINANCEIRO_PRIVADO" });
  await assistantTransaction(() => { db.users.find((entry) => entry.id === manager.id)!.canViewFinancials = true; consumeLink(phone, createLink(manager).token); enqueueWhatsAppMessages([incoming("private", "Arquivar", { attachment: receipt })]); });
  await drainWhatsAppQueue();
  failDelivery = false; await assistantTransaction(() => { db.users.find((entry) => entry.id === manager.id)!.canViewFinancials = false; delete db.whatsappMessages[0].retryAt; }); await drainWhatsAppQueue();
  assert.equal(deliveries.length, 1); assert.ok(!deliveries[0].includes("DADO_FINANCEIRO_PRIVADO")); assert.match(deliveries[0], /permissões mudaram/);
});
test("ambiguous intent asks for clarification and hallucinated IDs cannot mutate", async () => {
  nextIntent = intent({ action: "CLARIFY", question: "Você se refere à obra a ou b?" });
  await assistantTransaction(() => { consumeLink(phone, createLink(owner).token); enqueueWhatsAppMessages([incoming("ambiguous", "Crie uma tarefa naquela obra")]); }); await drainWhatsAppQueue();
  await assistantTransaction(() => { assert.equal(db.assistantCommands.length, 0); assert.equal(db.workHistory.length, 0); assert.equal(db.serviceOrderChecklistItems.length, 0); });
  nextIntent = intent({ serviceOrderId: "invented" });
  await assistantTransaction(() => enqueueWhatsAppMessages([incoming("invalid-id", "Faça uma tarefa")])); await drainWhatsAppQueue();
  await assistantTransaction(() => assert.equal(db.serviceOrderChecklistItems.length, 0)); assert.match(deliveries[1], /não encontrada/);
});
test("canceling a proposal keeps all business records unchanged", async () => {
  await assistantTransaction(() => { const command = proposeCommand(owner, phone, intent(), "cancel", "Criar"); confirmCommand(owner, phone, command.code, true); assert.equal(command.status, "CANCELED"); assert.match(confirmCommand(owner, phone, command.code), /cancelada/); assert.equal(db.serviceOrderChecklistItems.length, 0); });
});
test("sub-cent amounts are rejected before creating a financial command", async () => {
  await assistantTransaction(() => { assert.throws(() => proposeCommand(owner, phone, intent({ action: "FILE_RECEIPT", financialDirection: "EXPENSE", amount: 0.001, paidAt: "2026-01-01" }), "tiny", "Lançar", receipt), /duas casas/); assert.equal(db.assistantCommands.length, 0); });
});
test("simultaneous workers claim one message and execute one AI request", async () => {
  nextIntent = intent({ action: "DIARY" });
  await assistantTransaction(() => { consumeLink(phone, createLink(supervisor).token); enqueueWhatsAppMessages([incoming("concurrent", "Relato da obra")]); });
  await Promise.all([drainWhatsAppQueue(), drainWhatsAppQueue()]);
  assert.equal(aiCalls, 1); await assistantTransaction(() => assert.equal(db.workHistory.length, 1));
});


function fieldCommand(overrides: Partial<FieldAction>): FieldAction {
  return { ...diaryAction(), confidence: "HIGH", ...overrides };
}
async function runFieldCommand(user: SystemUser, orderId: string, nonce: string, action: FieldAction, text = "Relato em português da obra.") {
  let result!: Awaited<ReturnType<typeof processFieldStatement>>;
  await runWithStore(async () => {
    await ensureDatabaseReady();
    result = await processFieldStatement({ user, orderId, nonce, text, modelOverride: action });
    return Response.json({ ok: true });
  });
  return result;
}
function sampleWarehouse(): SystemUser {
  return { ...owner, id: "warehouse-user", name: "Almoxarife", email: "alm@example.test", role: "ALMOXARIFADO" };
}
function setupWarehouse(assigned = true) {
  const worker = sampleWarehouse();
  db.users.push(worker);
  db.employees.push(employee("warehouse-emp", worker.id));
  if (assigned) db.serviceOrderEmployees.push({
    id: "wh-assignment", serviceOrderId: "a", employeeId: "warehouse-emp",
    roleInService: "ALMOXARIFADO", assignedByUserId: owner.id, assignedAt: "", createdAt: "", updatedAt: "",
  });
  db.materials.push({ id: "mat-clean", name: "Detergente industrial", unit: "litros", currentStock: 10,
    minStock: 2, unitCost: 0, status: "AVAILABLE" });
  db.equipment.push({ id: "equipment-1", name: "Lavadora", code: "L-001", notes: "", status: "AVAILABLE" });
  return worker;
}
test("supervisor uses the assigned work automatically, but can choose between two assigned active works", async () => {
  await assistantTransaction(() => {
    const assignment = fieldAssignment(supervisor);
    assert.equal(assignment.locked, true);
    assert.equal(assignment.orderId, "a");
    assert.equal(assignment.orders.length, 1);
    assert.throws(() => authorizeFieldContext(supervisor, "b"));
    db.serviceOrders.find((order) => order.id === "b")!.supervisorUserId = supervisor.id;
    const selection = fieldAssignment(supervisor);
    assert.equal(selection.locked, false);
    assert.equal(selection.orderId, null);
    assert.deepEqual(selection.orders.map((o) => o.id).sort(), ["a", "b"]);
    assert.doesNotThrow(() => authorizeFieldContext(supervisor, "a"));
    assert.doesNotThrow(() => authorizeFieldContext(supervisor, "b"));
    assert.throws(() => authorizeFieldContext(supervisor, "office"));
  });
});
test("a voice-created checklist item has the correct author, two responsible employees and linked diary event", async () => {
  const created = await runFieldCommand(supervisor, "a", "field-auto-task-0001",
    fieldCommand({ action: "CREATE_CHECKLIST", title: "Limpar área externa", details: "Lavar sem danificar o piso.",
      employeeIds: ["worker", "sup-employee"] }), "Crie a tarefa de limpar a área externa para Carlos e supervisora.");
  assert.equal(created.operation.status, "executed");
  await assistantTransaction(() => {
    assert.equal(db.serviceOrderChecklistItems.length, 1);
    const item = db.serviceOrderChecklistItems[0];
    assert.equal(item.serviceOrderId, "a");
    assert.equal(item.createdByUserId, supervisor.id);
    assert.equal(item.origin, "FIELD_ASSISTANT");
    assert.deepEqual(item.assignedEmployeeIds, ["worker", "sup-employee"]);
    assert.equal(item.sourceMessageId, "campo:supervisor:field-auto-task-0001");
    assert.equal(db.serviceOrderChecklistEvents[0].type, "CREATED");
    assert.match(db.workHistory[0].content, /Ação executada/);
    assert.equal(db.workHistory[0].transcript, "Crie a tarefa de limpar a área externa para Carlos e supervisora.");
  });
  await runFieldCommand(supervisor, "a", "field-auto-task-0001",
    fieldCommand({ action: "CREATE_CHECKLIST", title: "Duplicado" }));
  await assistantTransaction(() => { assert.equal(db.serviceOrderChecklistItems.length, 1); assert.equal(db.workHistory.length, 1); });
});
test("add responsibilities on an existing checklist item without replacing the original team", async () => {
  await runFieldCommand(supervisor, "a", "field-add-task-0001",
    fieldCommand({ action: "CREATE_CHECKLIST", title: "Polir recepção", employeeIds: ["worker"] }));
  let itemId = "";
  await assistantTransaction(() => { itemId = db.serviceOrderChecklistItems[0].id; });
  const result = await runFieldCommand(supervisor, "a", "field-assign-task-0002",
    fieldCommand({ action: "ASSIGN_CHECKLIST", checklistItemId: itemId, employeeIds: ["sup-employee"] }));
  assert.equal(result.operation.status, "executed");
  await assistantTransaction(() => {
    assert.deepEqual(db.serviceOrderChecklistItems[0].assignedEmployeeIds, ["worker", "sup-employee"]);
    assert.equal(db.serviceOrderChecklistEvents.some((e) => e.type === "ASSIGNED"), true);
  });
});
test("warehouse stock dispatch is atomic and idempotent, keeps original work diary and a separate stock journal", async () => {
  const warehouse = sampleWarehouse();
  await assistantTransaction(() => {
    setupWarehouse();
    assert.equal(fieldAssignment(warehouse).orderId, "a");
    assert.equal(fieldSpeechContext(warehouse, "a").inventoryOrders.length, 2);
  });
  const delivery = fieldCommand({ action: "STOCK_DISPATCH", materialId: "mat-clean", quantity: 2,
    targetOrderId: "a", unit: "litros", employeeIds: ["worker"] });
  const first = await runFieldCommand(warehouse, "a", "warehouse-delivery-0001", delivery, "Equipe da obra A pegou 2 litros do detergente industrial.");
  assert.equal(first.operation.status, "executed");
  await assistantTransaction(() => {
    assert.equal(db.materials[0].currentStock, 8);
    assert.equal(db.serviceOrderMaterials[0].deliveredQuantity, 2);
    assert.equal(db.serviceOrderMaterials[0].status, "DELIVERED_TO_TEAM");
    assert.deepEqual(db.serviceOrderMaterials[0].receivedByEmployeeIds, ["worker"]);
    assert.equal(db.warehouseJournal.length, 1);
    assert.equal(db.workHistory.length, 1);
  });
  await runFieldCommand(warehouse, "a", "warehouse-delivery-0001", delivery);
  await assistantTransaction(() => { assert.equal(db.materials[0].currentStock, 8); assert.equal(db.warehouseJournal.length, 1); });
  const returned = await runFieldCommand(warehouse, "a", "warehouse-return-00002",
    fieldCommand({ action: "STOCK_RETURN", materialId: "mat-clean", quantity: 1, unit: "litros", targetOrderId: "a" }));
  assert.equal(returned.operation.status, "executed");
  await assistantTransaction(() => {
    assert.equal(db.materials[0].currentStock, 9);
    assert.equal(db.serviceOrderMaterials[0].returnedQuantity, 1);
    assert.equal(db.warehouseJournal.length, 2);
  });
  const invalid = await runFieldCommand(warehouse, "a", "warehouse-return-00003",
    fieldCommand({ action: "STOCK_RETURN", materialId: "mat-clean", quantity: 7, targetOrderId: "a" }));
  assert.equal(invalid.operation.status, "pending");
  await assistantTransaction(() => { assert.equal(db.materials[0].currentStock, 9); assert.equal(db.serviceOrderMaterials[0].returnedQuantity, 1); });
});
test("a warehouse employee with no assigned work can receive a new product in warehouse-only mode", async () => {
  const warehouse = sampleWarehouse();
  await assistantTransaction(() => { setupWarehouse(false); assert.equal(fieldAssignment(warehouse).orderId, "warehouse"); });
  const result = await runFieldCommand(warehouse, "warehouse", "new-stock-arrival-01",
    fieldCommand({ action: "STOCK_NEW", materialName: "Resina incolor", unit: "litros", quantity: 18 }),
    "Chegaram 18 litros de resina incolor, produto novo.");
  assert.equal(result.operation.status, "executed");
  await assistantTransaction(() => {
    assert.equal(db.materials.find((item) => item.name === "Resina incolor")?.currentStock, 18);
    assert.equal(db.warehouseJournal.length, 1);
  });
  const duplicate = await runFieldCommand(warehouse, "warehouse", "new-stock-arrival-02",
    fieldCommand({ action: "STOCK_NEW", materialName: "Resina incolor", unit: "litros", quantity: 10 }));
  assert.equal(duplicate.operation.status, "pending");
  await assistantTransaction(() => { assert.equal(db.materials.filter((item) => item.name === "Resina incolor").length, 1); });
});
test("a supervisor cannot change stock; low-confidence voice commands are diary only", async () => {
  await assistantTransaction(() => { db.materials.push({ id: "mat-clean", name: "Detergente", unit: "litros", currentStock: 10, minStock: 2, unitCost: 0 }); });
  const forbidden = await runFieldCommand(supervisor, "a", "forbidden-stock-0001",
    fieldCommand({ action: "STOCK_DISPATCH", materialId: "mat-clean", quantity: 3, targetOrderId: "a" }));
  assert.equal(forbidden.operation.status, "pending");
  const uncertain = await runFieldCommand(supervisor, "a", "uncertain-item-0001",
    fieldCommand({ action: "CREATE_CHECKLIST", title: "Trabalho duvidoso", confidence: "LOW", question: "Qual trabalho você quer criar?" }));
  assert.equal(uncertain.operation.status, "pending");
  await assistantTransaction(() => { assert.equal(db.serviceOrderChecklistItems.length, 0); assert.equal(db.materials[0].currentStock, 10); assert.equal(db.workHistory.length, 2); });
});
test("a warehouse employee can update a different team's stock only when the target order is explicitly authorized", async () => {
  const warehouse = sampleWarehouse();
  await assistantTransaction(() => { setupWarehouse(); });
  const result = await runFieldCommand(warehouse, "a", "warehouse-cross-00001",
    fieldCommand({ action: "STOCK_DISPATCH", materialId: "mat-clean", quantity: 2, targetOrderId: "b" }),
    "A equipe da obra B retirou 2 litros de detergente.");
  assert.equal(result.operation.status, "executed");
  await assistantTransaction(() => {
    assert.equal(db.warehouseJournal.length, 1);
    assert.equal(db.workHistory.length, 2);
    assert.ok(db.workHistory.some((entry) => entry.serviceOrderId === "b"));
    assert.equal(db.serviceOrderMaterials[0].serviceOrderId, "b");
    assert.equal(db.materials[0].currentStock, 8);
  });
});
test("equipment dispatch and return preserve the machine's custody trail", async () => {
  const warehouse = sampleWarehouse();
  await assistantTransaction(() => { setupWarehouse(); });
  const delivered = await runFieldCommand(warehouse, "a", "machine-dispatch-00001",
    fieldCommand({ action: "EQUIPMENT_DISPATCH", equipmentId: "equipment-1", targetOrderId: "a" }));
  assert.equal(delivered.operation.status, "executed");
  await assistantTransaction(() => {
    assert.equal(db.equipment[0].status, "RESERVED");
    assert.equal(db.serviceOrderEquipment[0].status, "DELIVERED");
  });
  const returned = await runFieldCommand(warehouse, "a", "machine-return-00001",
    fieldCommand({ action: "EQUIPMENT_RETURN", equipmentId: "equipment-1", targetOrderId: "a" }));
  assert.equal(returned.operation.status, "executed");
  await assistantTransaction(() => {
    assert.equal(db.equipment[0].status, "AVAILABLE");
    assert.equal(db.serviceOrderEquipment[0].status, "RETURNED");
    assert.equal(db.warehouseJournal.length, 2);
  });
});


test("closed work remains readable for reports, but no further field writing is permitted", async () => {
  await assistantTransaction(() => {
    db.serviceOrders.find((order) => order.id === "a")!.status = "DONE";
    assert.equal(fieldAssignment(supervisor).orderId, null);
    assert.doesNotThrow(() => fieldHistory(supervisor, "a"));
    assert.throws(() => authorizeFieldContext(supervisor, "a"));
  });
});
test("supervisor requests material through the existing requisition workflow without removing stock", async () => {
  await assistantTransaction(() => {
    db.materials.push({ id: "mat-clean", name: "Detergente", unit: "litros", currentStock: 10, minStock: 1, unitCost: 0 });
  });
  const result = await runFieldCommand(supervisor, "a", "field-material-req-0001",
    fieldCommand({ action: "REQUEST_MATERIAL", materialId: "mat-clean", quantity: 3, details: "Precisamos antes das 14 horas." }),
    "Solicite 3 litros de detergente para esta obra.");
  assert.equal(result.operation.status, "executed");
  await assistantTransaction(() => {
    assert.equal(db.materials[0].currentStock, 10);
    assert.equal(db.materialRequests.length, 1);
    assert.equal(db.materialRequests[0].serviceOrderId, "a");
    assert.equal(db.materialRequests[0].requestedByUserId, supervisor.id);
    assert.equal(db.materialRequestItems[0].materialId, "mat-clean");
    assert.equal(db.materialRequestItems[0].quantity, 3);
    assert.equal(db.workHistory.length, 1);
  });
});
test("shared warehouse movement journal excludes unrelated transcript and private audio", async () => {
  const warehouse = sampleWarehouse();
  await assistantTransaction(() => { setupWarehouse(); });
  const text = "A equipe B levou dois litros. Comentário particular que não faz parte do estoque.";
  const result = await runFieldCommand(warehouse, "a", "warehouse-privacy-0001",
    fieldCommand({ action: "STOCK_DISPATCH", targetOrderId: "b", materialId: "mat-clean", quantity: 2 }), text);
  assert.equal(result.operation.status, "executed");
  await assistantTransaction(() => {
    assert.match(db.workHistory.find((e) => e.serviceOrderId === "a")!.transcript, /Comentário particular/);
    const ledger = db.warehouseJournal[0];
    assert.ok(!ledger.transcript);
    assert.ok(!ledger.attachment);
    assert.ok(!ledger.content.includes("Comentário particular"));
    const target = db.workHistory.find((e) => e.serviceOrderId === "b")!;
    assert.ok(!target.transcript);
    assert.ok(!target.content.includes("Comentário particular"));
  });
});


test("a recording session stores each live transcript and applies only the complete instruction once", async () => {
  const session = "voice-session-00001";
  await assistantTransaction(() => {
    appendFieldEntry({
      user: supervisor, orderId: "a", nonce: "chunk-part-000001",
      title: "Trecho de gravação transcrito", content: "Crie um item para limpar o depósito",
      transcript: "Crie um item para limpar o depósito", recordingSessionId: session,
    });
    appendFieldEntry({
      user: supervisor, orderId: "a", nonce: "chunk-part-000002",
      title: "Trecho de gravação transcrito", content: "e atribua o Carlos a esse item.",
      transcript: "e atribua o Carlos a esse item.", recordingSessionId: session,
    });
    assert.equal(db.serviceOrderChecklistItems.length, 0);
  });
  const joined = "Crie um item para limpar o depósito e atribua o Carlos a esse item.";
  let result!: Awaited<ReturnType<typeof processFieldStatement>>;
  await runWithStore(async () => {
    await ensureDatabaseReady();
    result = await processFieldStatement({
      user: supervisor, orderId: "a", nonce: "sess_" + session, text: joined, summaryOnly: true,
      modelOverride: fieldCommand({ action: "CREATE_CHECKLIST", title: "Limpar depósito", employeeIds: ["worker"] }),
    });
    return Response.json({ ok: true });
  });
  assert.equal(result.operation.status, "executed");
  await assistantTransaction(() => {
    assert.equal(db.serviceOrderChecklistItems.length, 1);
    assert.deepEqual(db.serviceOrderChecklistItems[0].assignedEmployeeIds, ["worker"]);
    assert.equal(db.workHistory.length, 3);
    assert.equal(db.workHistory.filter((e) => e.recordingSessionId === session).length, 2);
    assert.equal(db.workHistory.find((e) => e.messageId === "campo:supervisor:sess_" + session)?.transcript, "");
  });
  await runWithStore(async () => {
    await ensureDatabaseReady();
    await processFieldStatement({
      user: supervisor, orderId: "a", nonce: "sess_" + session, text: joined, summaryOnly: true,
      modelOverride: fieldCommand({ action: "CREATE_CHECKLIST", title: "Outra tarefa" }),
    });
    return Response.json({ ok: true });
  });
  await assistantTransaction(() => assert.equal(db.serviceOrderChecklistItems.length, 1));
});
test("finalizing a nonexistent recording cannot fabricate or mutate the work diary", async () => {
  const { POST } = await import("../src/app/api/campo/finalizar/route");
  const raw = new NextRequest("http://localhost:3000/api/campo/finalizar", {
    method: "POST",
    headers: { cookie: "floor_session=" + signSessionToken(supervisor), "content-type": "application/json" },
    body: JSON.stringify({ orderId: "a", sessionId: "not-existing-recording" }),
  });
  const result = await POST(raw, undefined);
  assert.equal(result.status, 409);
  assert.equal(state().workHistory, undefined);
});


test("all operational profiles except collaborators can enter the PWA, with an administrative journal when needed", async () => {
  await assistantTransaction(() => {
    assert.ok(fieldAssignment(owner).orders.some((item) => item.id === "office"));
    assert.ok(fieldAssignment(finance).orders.some((item) => item.id === "office"));
    assert.ok(fieldAssignment(manager).orders.some((item) => item.id === "office"));
    assert.doesNotThrow(() => authorizeFieldContext(finance, "office"));
    assert.throws(() => fieldAssignment(collaborator));
    assert.throws(() => authorizeFieldContext(collaborator, "a"));
  });
  const { GET } = await import("../src/app/api/campo/route");
  const forbidden = await GET(request("/api/campo", collaborator), undefined);
  assert.equal(forbidden.status, 403);
  const permitted = await GET(request("/api/campo", finance), undefined);
  assert.equal(permitted.status, 200);
  const output = await permitted.json();
  assert.equal(output.user.role, "FINANCEIRO");
  assert.ok(output.orders.some((item: { id: string }) => item.id === "office"));
});
test("supervisor records absence and early departure only for assigned employees; incidents are non-punitive", async () => {
  const absence = await runFieldCommand(supervisor, "a", "attendance-absence-001",
    fieldCommand({ action: "REPORT_ABSENCE", employeeIds: ["worker"], occurredOn: "2026-11-22", details: "Ausência informada pelo encarregado." }),
    "O Carlos faltou no dia 22 de novembro.");
  assert.equal(absence.operation.status, "executed");
  const early = await runFieldCommand(supervisor, "a", "attendance-early-0001",
    fieldCommand({ action: "REPORT_EARLY_LEAVE", employeeIds: ["worker"], occurredOn: "2026-11-22",
      occurredAt: "14:30", details: "Informou que precisava sair." }),
    "O Carlos saiu mais cedo, às duas e meia.");
  assert.equal(early.operation.status, "executed");
  await assistantTransaction(() => {
    assert.equal(db.staffAttendanceReports.length, 2);
    assert.equal(db.staffAttendanceReports[0].kind, "ABSENCE");
    assert.equal(db.staffAttendanceReports[0].status, "REPORTED");
    assert.equal(db.staffAttendanceReports[1].occurredAt, "14:30");
    assert.equal(db.employeeWarnings.length, 0);
    assert.equal(db.serviceExpenses.length, 0);
    assert.equal(db.workHistory.length, 2);
  });
  await runFieldCommand(supervisor, "a", "attendance-absence-001",
    fieldCommand({ action: "REPORT_ABSENCE", employeeIds: ["worker"], occurredOn: "2026-11-22" }));
  await assistantTransaction(() => assert.equal(db.staffAttendanceReports.length, 2));
  const foreign = await runFieldCommand(supervisor, "a", "attendance-wrong-team1",
    fieldCommand({ action: "REPORT_ABSENCE", employeeIds: ["outsider"], occurredOn: "2026-11-22" }));
  assert.equal(foreign.operation.status, "pending");
  await assistantTransaction(() => assert.equal(db.staffAttendanceReports.length, 2));
});
test("finance-only profiles cannot file employee disciplinary incidents without team authority", async () => {
  const outcome = await runFieldCommand(finance, "a", "attendance-finance-01",
    fieldCommand({ action: "REPORT_ABSENCE", employeeIds: ["worker"], occurredOn: "2026-11-22" }));
  assert.equal(outcome.operation.status, "pending");
  await assistantTransaction(() => {
    assert.equal(db.staffAttendanceReports.length, 0);
    assert.equal(db.employeeWarnings.length, 0);
  });
});
test("PDF receipts are accepted by signed field upload validation and stored as pending review without modifying ledger balances", async () => {
  const { POST } = await import("../src/app/api/campo/comprovante/route");
  const { validateMediaSize } = await import("../src/lib/field-storage");
  assert.equal(validateMediaSize("application/pdf", 512).toString(), "document");
  assert.throws(() => validateMediaSize("application/pdf", 16 * 1024 * 1024));
  assert.throws(() => validateMediaSize("text/html", 80));
  const payload = Buffer.from("%PDF-1.4 test");
  const claim = {
    path: "campo/11111111-1111-4111-8111-111111111111",
    userId: supervisor.id, sessionVersion: 0, orderId: "a",
    mimeType: "application/pdf", fileName: "recibo.pdf",
    sizeBytes: payload.length, exp: Date.now() + 50000, type: "document",
  };
  const encoded = Buffer.from(JSON.stringify(claim)).toString("base64url");
  const token = encoded + "." + createHmac("sha256", process.env.JWT_SECRET!).update(encoded).digest("base64url");
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.origin === "https://fixture.invalid" && url.pathname.startsWith("/storage/v1/object/authenticated/")) {
      return init?.method === "HEAD" ? new Response(null, { status: 200, headers: { "content-length": String(payload.length) } })
        : new Response(new Uint8Array(payload), { status: 200 });
    }
    return previousFetch(input, init);
  };
  const requestReceipt = (nonce: string) => new NextRequest("http://localhost:3000/api/campo/comprovante", {
    method: "POST", headers: { cookie: "floor_session=" + signSessionToken(supervisor), "content-type": "application/json" },
    body: JSON.stringify({ ticket: token, nonce, description: "Compra de materiais de limpeza para a obra A." }),
  });
  const result = await POST(requestReceipt("receipt-nonce-001"), undefined);
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.equal(body.receipt.status, "PENDING_REVIEW");
  const duplicate = await POST(requestReceipt("receipt-nonce-002"), undefined);
  assert.equal(duplicate.status, 200);
  await assistantTransaction(() => {
    assert.equal(db.fieldReceipts.length, 1);
    assert.equal(db.fieldReceipts[0].description, "Compra de materiais de limpeza para a obra A.");
    assert.equal(db.financialDocuments.length, 1);
    assert.equal(db.financialDocuments[0].direction, "ARCHIVE");
    assert.equal(db.serviceExpenses.length, 0);
    assert.equal(db.serviceOrders.find((o) => o.id === "a")?.expenses, 0);
    assert.ok(db.workHistory[0].attachment === undefined, "Financial file must not be exposed in ordinary work history");
  });
});
test("receipt overview remains private to finance profiles, while employees may only see their own incident reports", async () => {
  const { GET: overview } = await import("../src/app/api/finance/campo-comprovantes/route");
  const denied = await overview(request("/api/finance/campo-comprovantes", supervisor), undefined);
  assert.equal(denied.status, 403);
  const permitted = await overview(request("/api/finance/campo-comprovantes", finance), undefined);
  assert.equal(permitted.status, 200);
  const { GET: incidents } = await import("../src/app/api/campo/ocorrencias/route");
  const blocked = await incidents(request("/api/campo/ocorrencias", collaborator), undefined);
  assert.equal(blocked.status, 403);
});
test("a user can dictate a description for their own receipt, but cannot silently describe another user's document", async () => {
  await assistantTransaction(() => {
    db.fieldReceipts.push({
      id: "11111111-1111-4111-8111-111111111111",
      serviceOrderId: "a", uploadedByUserId: supervisor.id, uploadedByName: supervisor.name,
      description: "Comprovante enviado.", status: "PENDING_REVIEW", createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), sourceMessageId: "campo:supervisor:receipt-old-doc01",
      attachment: { id: "att-test-receipt", storagePath: "campo/22222222-2222-4222-8222-222222222222",
        mimeType: "application/pdf", sizeBytes: 10, fileName: "nota.pdf" },
    });
  });
  const result = await runFieldCommand(supervisor, "a", "receipt-description-01",
    fieldCommand({ action: "DESCRIBE_RECEIPT", receiptId: "11111111-1111-4111-8111-111111111111",
      details: "Descrevo: aquisição de dois galões para o acabamento." }), "Acrescente no meu comprovante que foi compra de dois galões.");
  assert.equal(result.operation.status, "executed");
  await assistantTransaction(() => assert.match(db.fieldReceipts[0].description, /dois galões/));
  const invalid = await runFieldCommand(manager, "a", "receipt-description-02",
    fieldCommand({ action: "DESCRIBE_RECEIPT", receiptId: "11111111-1111-4111-8111-111111111111", details: "Alteração indevida." }));
  assert.equal(invalid.operation.status, "pending");
  await assistantTransaction(() => assert.ok(!db.fieldReceipts[0].description.includes("Alteração indevida")));
});


test("voice commands can change the UI theme without changing permissions or stock", async () => {
  const result = await runFieldCommand(owner, "office", "theme-command-0001",
    fieldCommand({ action: "SET_THEME", uiTheme: "light" }), "Mude para o tema claro.");
  assert.equal(result.operation.status, "executed");
  assert.equal(result.operation.ui?.kind, "THEME");
  assert.equal(result.operation.ui?.value, "light");
  await assistantTransaction(() => {
    assert.equal(db.officeJournal.length, 1);
    assert.equal(db.serviceExpenses.length, 0);
  });
});
test("voice switching only targets active works assigned to the current supervisor", async () => {
  await assistantTransaction(() => { db.serviceOrders.find((order) => order.id === "b")!.supervisorUserId = supervisor.id; });
  const switched = await runFieldCommand(supervisor, "a", "select-assigned-0001",
    fieldCommand({ action: "SWITCH_ORDER", targetOrderId: "b" }), "Troque para a obra B.");
  assert.equal(switched.operation.ui?.kind, "ORDER");
  assert.equal(switched.operation.ui?.value, "b");
  const invalid = await runFieldCommand(supervisor, "a", "select-forbidden-001",
    fieldCommand({ action: "SWITCH_ORDER", targetOrderId: "office" }));
  assert.equal(invalid.operation.status, "pending");
  assert.equal(invalid.operation.ui, undefined);
});
test("a voice report request is scoped to one work and cannot run in a general journal", async () => {
  const requested = await runFieldCommand(supervisor, "a", "request-report-0001",
    fieldCommand({ action: "REQUEST_REPORT" }), "Faça um relatório desta obra.");
  assert.equal(requested.operation.ui?.kind, "REPORT");
  assert.equal(requested.operation.ui?.value, "a");
  const denied = await runFieldCommand(owner, "office", "request-report-0002",
    fieldCommand({ action: "REQUEST_REPORT" }));
  assert.equal(denied.operation.status, "pending");
  await assistantTransaction(() => assert.equal(db.workReports.length, 0));
});
