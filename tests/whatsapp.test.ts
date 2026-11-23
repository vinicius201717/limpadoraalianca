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
const { db, createChecklistItem } = await import("../src/lib/store");
const { APP_STATE_ID } = await import("../src/lib/request-store");
const { actorForPhone, assistantContext, assistantTransaction, confirmCommand, consumeLink, createLink, digest, enqueueWhatsAppMessages, proposeCommand, recordWhatsAppDelivery, saveDiary, validateIntent, visibleHistory } = await import("../src/lib/whatsapp-operations");
const { parseWhatsAppDeliveryUpdates, parseWhatsAppMessages, verifyWhatsAppSignature, whatsappConfiguration } = await import("../src/lib/whatsapp-provider");
const { drainWhatsAppQueue } = await import("../src/lib/whatsapp-worker");
const { signSessionToken } = await import("../src/lib/session-token");
const { createWorkReport } = await import("../src/lib/work-reports");
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
    assert.throws(() => createLink(collaborator));
    const link = createLink(owner); assert.equal(db.whatsappLinks[0].tokenHash, digest(link.token));
    assert.ok(!JSON.stringify(db.whatsappLinks).includes(link.token));
    consumeLink(phone, link.token); assert.equal(actorForPhone(phone)?.id, owner.id);
    assert.throws(() => consumeLink(phone, link.token));
    db.users[0].sessionVersion = 1; assert.equal(actorForPhone(phone), null);
    const expired = createLink(supervisor); db.whatsappLinks.find((entry) => entry.userId === supervisor.id)!.tokenExpiresAt = "2000-01-01";
    assert.throws(() => consumeLink("5511888888888", expired.token));
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
    assert.equal(assistantContext(finance).checklist.length, 0); assert.equal(assistantContext(finance).employees.length, 0);
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
    assert.equal(db.employeeWarnings.length, 1); assert.equal(visibleHistory(finance, "a").length, 0);
    assert.equal(visibleHistory(supervisor, "a").length, 1);
    assert.throws(() => validateIntent(supervisor, intent({ action: "WARN_EMPLOYEE", employeeId: "sup-employee" })));
  });
});
test("archiving receipts never adjusts balances and duplicate attachments are rejected", async () => {
  await assistantTransaction(() => {
    const command = proposeCommand(finance, phone, intent({ action: "FILE_RECEIPT", financialDirection: "ARCHIVE" }), "receipt", "Arquivar", receipt);
    confirmCommand(finance, phone, command.code);
    assert.equal(db.financialDocuments.length, 1); assert.equal(db.serviceOrders[0].expenses, 0); assert.equal(db.servicePayments[0].receipts.length, 0);
    assert.equal(visibleHistory(supervisor, "a").length, 0);
    assert.throws(() => proposeCommand(finance, phone, intent({ action: "FILE_RECEIPT", financialDirection: "ARCHIVE" }), "again", "Arquivar", receipt), /já foi registrado/);
  });
});
test("expense and receipt post to existing financial ledgers only after confirmation", async () => {
  await assistantTransaction(() => {
    const command = proposeCommand(finance, phone, intent({ action: "FILE_RECEIPT", financialDirection: "EXPENSE", amount: 25.5, paidAt: "2026-01-02", expenseCategory: "MATERIAL_OU_PRODUTO" }), "exp", "Lançar", receipt);
    assert.equal(db.serviceOrders[0].expenses, 0); confirmCommand(finance, phone, command.code);
    assert.equal(db.serviceOrders[0].expenses, 25.5); assert.equal(db.serviceExpenses[0].amount, 25.5);
    const payment = proposeCommand(finance, phone, intent({ action: "FILE_RECEIPT", financialDirection: "PAYMENT", amount: 40, paymentId: "payment", paidAt: "2026-01-02", paymentMethod: "PIX" }), "payment", "Receber", { ...receipt, id: "b".repeat(64) });
    confirmCommand(finance, phone, payment.code); assert.equal(db.servicePayments[0].receipts[0].amount, 40);
    assert.throws(() => validateIntent(finance, intent({ action: "FILE_RECEIPT", financialDirection: "PAYMENT", amount: 70, paymentId: "payment", paidAt: "2026-01-02", paymentMethod: "PIX" }), { ...receipt, id: "c".repeat(64) }), /saldo/);
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
test("invalid webhook signatures never touch storage", async () => {
  const { POST } = await import("../src/app/api/whatsapp/webhook/route");
  const response = await POST(new NextRequest("http://localhost:3000/api/whatsapp/webhook", { method: "POST", body: "{}", headers: { "x-hub-signature-256": "bad" } }));
  assert.equal(response.status, 401); assert.equal(state().whatsappMessages, undefined);
});

function deliveryPayload(status: string, options: { id?: string; number?: string; trackingId?: string } = {}) {
  return { object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: options.number ?? "12345" }, statuses: [{ id: options.id ?? "sent-1", status, timestamp: "1795315323", biz_opaque_callback_data: options.trackingId, errors: status === "failed" ? [{ code: 130497, message: "Provider detail must not be stored" }] : undefined }] } }] }] };
}
async function postDelivery(payload: unknown, validSignature = true) {
  const { POST } = await import("../src/app/api/whatsapp/webhook/route");
  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", process.env.WHATSAPP_APP_SECRET!).update(body).digest("hex");
  return POST(new NextRequest("http://localhost:3000/api/whatsapp/webhook", { method: "POST", body, headers: { "x-hub-signature-256": validSignature ? `sha256=${signature}` : "sha256=bad" } }));
}

test("accepted replies persist failed delivery callbacks without repeating business changes", async () => {
  nextIntent = intent({ action: "DIARY", employeeId: null });
  await assistantTransaction(() => { consumeLink(phone, createLink(supervisor).token); enqueueWhatsAppMessages([incoming("delivery", "Diário")]); });
  await drainWhatsAppQueue();
  await assistantTransaction(() => { assert.equal(db.whatsappMessages[0].replyDeliveryStatus, "accepted"); assert.equal(db.whatsappMessages[0].replyMessageId, "sent-1"); });
  assert.equal((await postDelivery(deliveryPayload("failed"), false)).status, 401);
  assert.equal((await postDelivery(deliveryPayload("failed", { number: "other" }))).status, 200);
  assert.equal((await postDelivery(deliveryPayload("failed", { id: "unrelated" }))).status, 200);
  await assistantTransaction(() => assert.equal(db.whatsappMessages[0].replyDeliveryStatus, "accepted"));
  assert.equal((await postDelivery(deliveryPayload("failed"))).status, 200);
  assert.equal((await postDelivery(deliveryPayload("failed"))).status, 200);
  await drainWhatsAppQueue();
  await assistantTransaction(() => { assert.equal(db.whatsappMessages[0].replyDeliveryStatus, "failed"); assert.deepEqual(db.whatsappMessages[0].replyErrorCodes, [130497]); assert.equal(db.workHistory.length, 1); });
  assert.equal(deliveries.length, 1); assert.equal(aiCalls, 1);
  assert.ok(!JSON.stringify(state()).includes("Provider detail"));
  const { GET } = await import("../src/app/api/whatsapp/connection/route");
  const result = await (await GET(request("/api/whatsapp/connection", supervisor), undefined)).json();
  assert.equal(result.messages[0].replyDeliveryStatus, "failed"); assert.deepEqual(result.messages[0].replyErrorCodes, [130497]);
  assert.equal(result.messages[0].replyTrackingId, undefined);
});

test("delivery callbacks arriving before send response persist and never regress on out-of-order events", async () => {
  beforeDeliveryResponse = async (trackingId, messageId) => {
    assert.match(trackingId, /^[a-f0-9-]{36}$/);
    assert.equal((await postDelivery(deliveryPayload("read", { id: messageId, trackingId }))).status, 200);
  };
  await assistantTransaction(() => enqueueWhatsAppMessages([incoming("race", "Olá")]));
  await drainWhatsAppQueue();
  for (const status of ["sent", "failed", "delivered", "read"]) assert.equal((await postDelivery(deliveryPayload(status))).status, 200);
  await assistantTransaction(() => { assert.equal(db.whatsappMessages[0].replyDeliveryStatus, "read"); assert.equal(db.whatsappMessages[0].replyMessageId, "sent-1"); assert.equal(db.whatsappMessages[0].replyErrorCodes, undefined); });
  assert.equal(deliveries.length, 1);
});

test("delivery status persistence failure asks Meta to retry and unknown statuses are ignored", async () => {
  assert.deepEqual(parseWhatsAppDeliveryUpdates(deliveryPayload("unknown-future-status")), []);
  await assistantTransaction(() => enqueueWhatsAppMessages([incoming("status-write", "Olá")])); await drainWhatsAppQueue();
  failWrite = true;
  assert.equal((await postDelivery(deliveryPayload("delivered"))).status, 503);
  failWrite = false;
  await assistantTransaction(() => { assert.equal(db.whatsappMessages[0].replyDeliveryStatus, "accepted"); recordWhatsAppDelivery(parseWhatsAppDeliveryUpdates(deliveryPayload("delivered"))); });
  await assistantTransaction(() => assert.equal(db.whatsappMessages[0].replyDeliveryStatus, "delivered"));
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
    const command = proposeCommand(finance, phone, intent({ action: "FILE_RECEIPT", financialDirection: "ARCHIVE", details: "SEGREDO_FINANCEIRO" }), "receipt", "Confidencial", receipt); confirmCommand(finance, phone, command.code);
  });
  reportMode = true; const report = await createWorkReport(supervisor.id, "a");
  assert.ok(report.sourceIds.length >= 2); assert.ok(!prompts[0].includes("SEGREDO_FINANCEIRO")); assert.ok(!prompts[0].includes('"revenue"'));
  await assert.rejects(createWorkReport(supervisor.id, "b"));
});
test("private financial attachment cannot be downloaded by supervisor", async () => {
  await assistantTransaction(() => { const command = proposeCommand(finance, phone, intent({ action: "FILE_RECEIPT", financialDirection: "ARCHIVE" }), "receipt", "Arquivar", receipt); confirmCommand(finance, phone, command.code); });
  const { GET } = await import("../src/app/api/whatsapp/media/[id]/route");
  assert.equal((await GET(request(`/api/whatsapp/media/${receipt.id}`, supervisor), { params: Promise.resolve({ id: receipt.id }) })).status, 404);
  const response = await GET(request(`/api/whatsapp/media/${receipt.id}`, finance), { params: Promise.resolve({ id: receipt.id }) });
  assert.equal(response.status, 200); assert.match(response.headers.get("content-disposition")!, /attachment/);
});

test("a receipt without caption remains available for a later audio explanation", async () => {
  nextIntent = intent({ action: "CLARIFY", question: "A qual obra pertence este comprovante?" });
  await assistantTransaction(() => { consumeLink(phone, createLink(finance).token); enqueueWhatsAppMessages([incoming("document", "", { type: "document", attachment: receipt })]); });
  await drainWhatsAppQueue();
  nextIntent = intent({ action: "FILE_RECEIPT", employeeId: null, financialDirection: "ARCHIVE", title: "Comprovante de material", details: "Compra de material da obra a." });
  await assistantTransaction(() => enqueueWhatsAppMessages([incoming("explanation", "", { type: "audio", mediaId: "media", mimeType: "audio/ogg" })]));
  await drainWhatsAppQueue();
  await assistantTransaction(() => { assert.equal(db.assistantCommands.length, 1); assert.equal(db.assistantCommands[0].attachment?.id, receipt.id); assert.equal(db.financialDocuments.length, 0); confirmCommand(finance, phone, db.assistantCommands[0].code); assert.equal(db.financialDocuments[0].attachment.id, receipt.id); });
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
  await assistantTransaction(() => { assert.throws(() => proposeCommand(finance, phone, intent({ action: "FILE_RECEIPT", financialDirection: "EXPENSE", amount: 0.001, paidAt: "2026-01-01" }), "tiny", "Lançar", receipt), /duas casas/); assert.equal(db.assistantCommands.length, 0); });
});
test("simultaneous workers claim one message and execute one AI request", async () => {
  nextIntent = intent({ action: "DIARY" });
  await assistantTransaction(() => { consumeLink(phone, createLink(supervisor).token); enqueueWhatsAppMessages([incoming("concurrent", "Relato da obra")]); });
  await Promise.all([drainWhatsAppQueue(), drainWhatsAppQueue()]);
  assert.equal(aiCalls, 1); await assistantTransaction(() => assert.equal(db.workHistory.length, 1));
});
