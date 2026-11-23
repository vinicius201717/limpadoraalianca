import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import type { Material, ServiceOrderMaterial, ServiceOrder, SystemUser } from "../src/lib/types";

process.env.DATABASE_URL = "";
process.env.SUPABASE_URL = "https://fixture.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-not-a-real-key";
process.env.JWT_SECRET = "test-only-secret-at-least-thirty-two-characters";
process.env.APP_URL = "http://localhost:3000";
const { runWithStore, loadState, currentState, APP_STATE_ID } = await import("../src/lib/request-store");
const { ConcurrentUpdateError, readAppState, writeAppState } = await import("../src/lib/app-state-db");
const { withDatabase } = await import("../src/lib/with-database");
const { db, ensureDatabaseReady, changeOwnPassword, findEmployeeActiveServiceOrderConflict } = await import("../src/lib/store");
const { signSessionToken } = await import("../src/lib/session-token");
const { verifySessionToken } = await import("../src/lib/auth");
const { applyMaterialMovement, moveMaterialRequest } = await import("../src/lib/inventory-operations");
const { getServiceOrderTransitionError } = await import("../src/lib/service-order-transitions");
const { adjustExpenseTotal, addReceipt, paymentReceived } = await import("../src/lib/finance-operations");
const { consumeRateLimit } = await import("../src/lib/rate-limit");
const { scopedOperationalData } = await import("../src/lib/operational-projection");
const { persistChecklistPhotoUploads } = await import("../src/lib/checklist-photo-storage");
const bcrypt = (await import("bcryptjs")).default;
const owner: SystemUser = { id: "owner", name: "Test Owner", email: "owner@example.test", role: "OWNER", isActive: true, createdAt: "2026-01-01", updatedAt: "2026-01-01", passwordHash: bcrypt.hashSync("Test-only-pass-123", 4) };
const outsider: SystemUser = { ...owner, id: "outsider", name: "Outsider", email: "outsider@example.test", role: "COLABORADOR" };
const sampleOrder = (id = "order"): ServiceOrder => ({ id, title: id, customerId: "customer", customerName: "Customer", quoteId: "", address: "Test address", description: "Restoration", scheduledStart: "2026-12-01T08:00:00Z", scheduledEnd: "2026-12-01T12:00:00Z", status: "SCHEDULED", employeeIds: [], tasks: [], revenue: 100, expenses: 0, internalNotes: "private notes", clientNotes: "", clientAccessCode: "TEST-CODE" });
type Row = { data: Record<string, unknown>; updated_at: string };
const rows = new Map<string, Row>();
let failWrites = false;
function state() { return rows.get(APP_STATE_ID)!.data; }
function request(path = "/api/test", method = "GET", body?: unknown, user = owner) {
  return new NextRequest(`http://localhost:3000${path}`, { method, headers: { cookie: `floor_session=${signSessionToken(user)}`, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
beforeEach(() => {
  rows.clear(); failWrites = false;
  rows.set(APP_STATE_ID, { data: { users: [structuredClone(owner), structuredClone(outsider)], serviceOrders: [sampleOrder()], customers: [{ id: "customer", name: "Customer", phone: "11987654321", email: "", document: "", type: "PERSON", source: "test", notes: "", totalValue: 100, lastService: "" }], materials: [{ id: "material", name: "Product", unit: "L", currentStock: 10, minStock: 1, unitCost: 5 }] }, updated_at: "2026-01-01T00:00:00.000Z" });
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://fixture.invalid", "Tests must never access a live provider");
    const id = url.searchParams.get("id")?.replace(/^eq\./, "");
    if (!init?.method || init.method === "GET") return Response.json(id && rows.has(id) ? [structuredClone(rows.get(id))] : []);
    if (failWrites) return Response.json({}, { status: 503 });
    const payload = JSON.parse(String(init.body));
    if (init.method === "POST") {
      if (rows.has(payload.id)) return Response.json({}, { status: 409 });
      rows.set(payload.id, structuredClone(payload)); return Response.json(payload);
    }
    const previous = id ? rows.get(id) : null;
    if (!previous || url.searchParams.get("updated_at") !== `eq.${previous.updated_at}`) return Response.json([]);
    rows.set(id!, structuredClone(payload)); return Response.json([payload]);
  };
});

test("concurrent requests cannot silently overwrite a newer revision", async () => {
  const snapshot = await readAppState(APP_STATE_ID);
  await writeAppState(APP_STATE_ID, { ...state(), marker: "first" }, snapshot!.version);
  await assert.rejects(writeAppState(APP_STATE_ID, { marker: "stale" }, snapshot!.version), ConcurrentUpdateError);
  assert.equal(state().marker, "first");
});
test("request snapshots are isolated and rejected mutations are discarded", async () => {
  await runWithStore(async () => { await loadState({ users: [], materials: [] }); currentState<{ materials: unknown[] }>().materials.length = 0; return Response.json({}, { status: 400 }); });
  await runWithStore(async () => { await ensureDatabaseReady(); assert.equal(db.materials.length, 1); assert.equal(db.users.length, 2); return Response.json({}); });
  assert.equal((state().materials as unknown[]).length, 1);
});
test("success is withheld on failed persistence and a later request cannot save the failed mutation", async () => {
  failWrites = true;
  const handler = withDatabase(async () => { db.materials[0].currentStock = 0; return Response.json({ ok: true }); });
  assert.equal((await handler(request(), undefined)).status, 503);
  failWrites = false;
  await runWithStore(async () => { await ensureDatabaseReady(); assert.equal(db.materials[0].currentStock, 10); return Response.json({}); });
});
test("missing database never creates demo accounts or wipes inventory", async () => {
  rows.delete(APP_STATE_ID);
  assert.equal((await withDatabase(async () => Response.json({ ok: true }))(request(), undefined)).status, 503);
  assert.equal(rows.has(APP_STATE_ID), false);
});
test("fresh requests observe database changes without restarting the process", async () => {
  await runWithStore(async () => { await ensureDatabaseReady(); assert.equal(db.materials[0].currentStock, 10); return Response.json({}); });
  (state().materials as Array<{ currentStock: number }>)[0].currentStock = 7;
  await runWithStore(async () => { await ensureDatabaseReady(); assert.equal(db.materials[0].currentStock, 7); return Response.json({}); });
});
test("reservation reductions, returns and cancellation restore exact quantities", () => {
  const stock = { currentStock: 10, minStock: 1 } as Material;
  const allocation = { id: "allocation", plannedQuantity: 5, separatedQuantity: 0, deliveredQuantity: 0, returnedQuantity: 0, consumedQuantity: 0, damagedQuantity: 0, lostQuantity: 0, status: "PENDING_SEPARATION" } as ServiceOrderMaterial;
  applyMaterialMovement(stock, allocation, { status: "RESERVED", separatedQuantity: 5 }, "owner"); assert.equal(stock.currentStock, 5);
  applyMaterialMovement(stock, allocation, { separatedQuantity: 3 }, "owner"); assert.equal(stock.currentStock, 7);
  applyMaterialMovement(stock, allocation, { status: "DELIVERED_TO_TEAM" }, "owner");
  applyMaterialMovement(stock, allocation, { status: "RETURNED" }, "owner"); assert.equal(stock.currentStock, 10);
  applyMaterialMovement(stock, allocation, { status: "RETURNED" }, "owner"); assert.equal(stock.currentStock, 10);
});
test("multi-line material requests are atomic and retrying does not duplicate allocations", () => {
  const stock = [{ id: "a", currentStock: 10, minStock: 1 }, { id: "b", currentStock: 1, minStock: 0 }] as Material[];
  const input = { materials: stock, serviceOrderMaterials: [] as ServiceOrderMaterial[], materialRequestItems: [{ id: "1", requestId: "r", materialId: "a", quantity: 2, notes: "" }, { id: "2", requestId: "r", materialId: "b", quantity: 2, notes: "" }] };
  const req = { id: "r", serviceOrderId: "order", status: "PENDING" as const, priority: "NORMAL" as const, reason: "test", requestedByUserId: "owner", createdAt: "", updatedAt: "" };
  assert.throws(() => moveMaterialRequest(input, req, "SEPARATED", "owner")); assert.equal(stock[0].currentStock, 10); assert.equal(input.serviceOrderMaterials.length, 0);
  stock[1].currentStock = 10; moveMaterialRequest(input, req, "SEPARATED", "owner"); moveMaterialRequest(input, req, "SEPARATED", "owner"); assert.equal(input.serviceOrderMaterials.length, 2); assert.equal(stock[0].currentStock, 8);
});
test("delivery cannot skip execution and cannot close unvalidated mandatory work", () => {
  const context = { serviceOrderChecklistItems: [], serviceOrderChecklistPhotos: [], serviceOrderMaterials: [], serviceOrderEquipment: [], materialRequests: [] };
  assert.ok(getServiceOrderTransitionError(sampleOrder(), "DELIVERED", context, { customerAcceptance: true }));
  assert.ok(getServiceOrderTransitionError({ ...sampleOrder(), status: "IN_PROGRESS", tasks: [{ id: "task", title: "pending", done: false }] }, "DONE", context));
  assert.equal(getServiceOrderTransitionError({ ...sampleOrder(), status: "DONE" }, "DELIVERED", context, { customerAcceptance: true }), null);
});
test("expense adjustments preserve the legacy opening balance and receipts cannot exceed balance", () => {
  const order = { ...sampleOrder(), expenses: 25 }; const expenses: import("../src/lib/types").ServiceExpense[] = [];
  adjustExpenseTotal(order, expenses, 30, "Invoice correction", "owner"); assert.equal(expenses.length, 2); assert.equal(expenses.reduce((sum, item) => sum + item.amount, 0), 30);
  adjustExpenseTotal(order, expenses, 30, "Same adjustment", "owner"); assert.equal(expenses.length, 2);
  const payment = { id: "p", serviceOrderId: "order", description: "test", amount: 100, dueAt: "2026-12-01", createdAt: "", createdByUserId: "owner", receipts: [] };
  addReceipt(payment, { amount: 60, paidAt: "2026-12-01", method: "PIX", reference: "" }, "owner"); assert.equal(paymentReceived(payment), 60);
  assert.throws(() => addReceipt(payment, { amount: 41, paidAt: "2026-12-01", method: "PIX", reference: "" }, "owner")); assert.equal(paymentReceived(payment), 60);
});
test("password changes revoke older tokens", async () => {
  const oldToken = signSessionToken(owner);
  await runWithStore(async () => { await ensureDatabaseReady(); const result = await changeOwnPassword(owner.id, { currentPassword: "Test-only-pass-123", newPassword: "New-test-pass-456" }); assert.equal(result.error, null); return Response.json({}); });
  await runWithStore(async () => { assert.equal(await verifySessionToken(oldToken), null); return Response.json({}); });
});
test("dashboard and gallery projections never include credentials or unrelated orders", async () => {
  await runWithStore(async () => { await ensureDatabaseReady(); const data = scopedOperationalData(outsider); assert.equal(data.serviceOrders.length, 0); assert.ok(!JSON.stringify(data).includes("passwordHash")); assert.ok(!JSON.stringify(data).includes("private notes")); return Response.json({}); });
});
test("media from a different order cannot be attached", async () => {
  await assert.rejects(persistChecklistPhotoUploads([{ url: "/api/checklist-media?path=service-orders%2Fother%2Fchecklist%2Fitem%2Fphoto.jpg" }], { serviceOrderId: "order", checklistItemId: "item" }), /pertence/);
});
test("rate limits persist independently of failed login responses", async () => {
  assert.equal(await consumeRateLimit("test", "ip", 2, 60_000), 0); assert.equal(await consumeRateLimit("test", "ip", 2, 60_000), 0); assert.ok(await consumeRateLimit("test", "ip", 2, 60_000) > 0);
});
test("date-based assignment permits non-overlapping work", async () => {
  await runWithStore(async () => { await ensureDatabaseReady(); db.serviceOrders[0].employeeIds = ["employee"]; assert.equal(findEmployeeActiveServiceOrderConflict("employee", undefined, { scheduledStart: "2026-12-01T12:00:00Z", scheduledEnd: "2026-12-01T15:00:00Z" }), null); assert.ok(findEmployeeActiveServiceOrderConflict("employee", undefined, { scheduledStart: "2026-12-01T11:00:00Z", scheduledEnd: "2026-12-01T15:00:00Z" })); return Response.json({}); });
});
test("quote approval persists one order and is idempotent", async () => {
  const { POST } = await import("../src/app/api/quotes/[id]/approve/route");
  state().quotes = [{ id: "quote", customerId: "customer", customerName: "Customer", title: "Restore floor", address: "Test address", description: "Scope of work", serviceType: "RESTORATION", total: 100, subtotal: 100, discount: 0, status: "SENT", paymentTerms: "PIX", validUntil: "2099-12-31" }];
  const body = { scheduledStart: "2026-12-01T08:00:00Z", scheduledEnd: "2026-12-01T12:00:00Z", acceptanceNotes: "Customer approved by email" };
  const context = { params: Promise.resolve({ id: "quote" }) };
  const response = await POST(request("/api/quotes/quote/approve", "POST", body), context); assert.equal(response.status, 201);
  const second = await POST(request("/api/quotes/quote/approve", "POST", body), context); assert.equal(second.status, 200); assert.equal((state().serviceOrders as ServiceOrder[]).filter((order) => order.quoteId === "quote").length, 1);
});
test("commercial APIs reject arbitrary IDs and report successful persistence only after commit", async () => {
  const { POST } = await import("../src/app/api/customers/route");
  const response = await POST(request("/api/customers", "POST", { id: "chosen", name: "Customer", phone: "11987654321" }), undefined); assert.equal(response.status, 400);
  const created = await POST(request("/api/customers", "POST", { name: "Real new customer", phone: "11987654321" }), undefined); assert.equal(created.status, 201);
  assert.equal((state().customers as unknown[]).length, 2);
});
test("unassigned employee cannot read another order evaluation or edit its order", async () => {
  state().evaluations = [{ id: "evaluation", serviceOrderId: "order", employeeId: "someone" }];
  const { GET } = await import("../src/app/api/evaluations/[id]/route");
  assert.equal((await GET(request("/api/evaluations/evaluation", "GET", undefined, outsider), { params: Promise.resolve({ id: "evaluation" }) })).status, 403);
  const { PATCH } = await import("../src/app/api/service-orders/[id]/route");
  assert.equal((await PATCH(request("/api/service-orders/order", "PATCH", { id: "changed" }), { params: Promise.resolve({ id: "order" }) })).status, 400);
});
test("simultaneous API mutations return a conflict instead of a false success", async () => {
  let arrived = 0; let release!: () => void;
  const barrier = new Promise<void>((resolve) => { release = resolve; });
  const handler = withDatabase(async () => { db.materials[0].currentStock -= 1; arrived++; if (arrived === 2) release(); await barrier; return Response.json({ ok: true }); });
  const responses = await Promise.all([handler(request(), undefined), handler(request(), undefined)]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  assert.equal((state().materials as Array<{ currentStock: number }>)[0].currentStock, 9);
});
test("public delivery rejects premature acceptance and does not disclose internal fields on repeats", async () => {
  const { POST } = await import("../src/app/api/public/service-tracking/delivery/route");
  const body = { code: "TEST-CODE", signatureDataUrl: `data:image/png;base64,${"A".repeat(100)}` };
  assert.equal((await POST(request("/api/public/service-tracking/delivery", "POST", body), undefined)).status, 409);
  const order = (state().serviceOrders as ServiceOrder[])[0]; order.status = "DELIVERED"; order.clientDeliverySignedAt = new Date().toISOString();
  const repeated = await POST(request("/api/public/service-tracking/delivery", "POST", body), undefined);
  const payload = await repeated.text(); assert.equal(repeated.status, 409); assert.ok(!payload.includes("private notes")); assert.ok(!payload.includes("serviceOrder"));
});
test("employee phone-based access cannot give a manager owner-only roles", async () => {
  const manager = { ...owner, id: "manager", role: "GERENTE" as const, email: "manager@example.test" };
  (state().users as SystemUser[]).push(manager);
  const { POST } = await import("../src/app/api/employees/route");
  const response = await POST(request("/api/employees", "POST", { name: "Forbidden manager", phone: "11911223344", createAccess: true, accessRole: "GERENTE", temporaryPassword: "Strong-test-pass-123", canViewFinancials: true }, manager), undefined);
  assert.ok([400, 403].includes(response.status)); assert.equal((state().users as SystemUser[]).length, 3);
});
test("a linked owner cannot be demoted through employee promotion", async () => {
  state().employees = [{ id: "employee-owner", userId: "owner", name: "Owner", status: "ACTIVE" }];
  const { POST } = await import("../src/app/api/employees/[id]/promote-to-supervisor/route");
  const response = await POST(request("/api/employees/employee-owner/promote-to-supervisor", "POST", {}), { params: Promise.resolve({ id: "employee-owner" }) });
  assert.equal(response.status, 403); assert.equal((state().users as SystemUser[])[0].role, "OWNER");
});
test("financial API persists installments, receipts and auditable reversal", async () => {
  const { POST } = await import("../src/app/api/finance/payments/route");
  const create = await POST(request("/api/finance/payments", "POST", { action: "create", serviceOrderId: "order", description: "Final payment", dueAt: "2026-12-01", amount: 100 }), undefined);
  assert.equal(create.status, 201); const paymentId = (await create.json()).payment.id;
  const received = await POST(request("/api/finance/payments", "POST", { action: "receive", paymentId, amount: 100, paidAt: "2026-12-01", method: "PIX", reference: "receipt-test" }), undefined);
  assert.equal(received.status, 201); const receiptId = (await received.json()).payment.receipts[0].id;
  const overpayment = await POST(request("/api/finance/payments", "POST", { action: "receive", paymentId, amount: 1, paidAt: "2026-12-01", method: "PIX" }), undefined); assert.equal(overpayment.status, 409);
  const reversal = await POST(request("/api/finance/payments", "POST", { action: "reverse", paymentId, receiptId, reason: "Incorrect receipt" }), undefined); assert.equal(reversal.status, 201);
  const updated = (await reversal.json()).payment; assert.equal(updated.receipts.length, 1); assert.equal(paymentReceived(updated), 0); assert.equal(updated.receipts[0].reversedByUserId, owner.id);
});
test("lead conversion and warranty creation use durable linked records", async () => {
  state().leads = [{ id: "lead", name: "New customer", phone: "11988776655", email: "", source: "test", notes: "", status: "NEW" }];
  const { POST: convert } = await import("../src/app/api/leads/[id]/convert/route");
  const first = await convert(request("/api/leads/lead/convert", "POST", {}), { params: Promise.resolve({ id: "lead" }) }); assert.equal(first.status, 201);
  const second = await convert(request("/api/leads/lead/convert", "POST", {}), { params: Promise.resolve({ id: "lead" }) }); assert.equal(second.status, 200); assert.equal((state().customers as unknown[]).length, 2);
  const { POST: warranty } = await import("../src/app/api/warranties/route");
  const body = { serviceOrderId: "order", startsAt: "2026-12-01", endsAt: "2027-12-01", terms: "Limited warranty for the completed service" };
  assert.equal((await warranty(request("/api/warranties", "POST", body), undefined)).status, 400);
  (state().serviceOrders as ServiceOrder[])[0].status = "DELIVERED";
  assert.equal((await warranty(request("/api/warranties", "POST", body), undefined)).status, 201);
  assert.equal((state().warranties as unknown[]).length, 1);
});
test("cross-site writes and oversized requests are rejected before mutation", async () => {
  const handler = withDatabase(async () => { db.materials[0].currentStock = 0; return Response.json({}); });
  const crossSite = new NextRequest("http://localhost:3000/api/test", { method: "POST", headers: { origin: "https://evil.invalid" }, body: "{}" });
  assert.equal((await handler(crossSite, undefined)).status, 403);
  const oversized = new NextRequest("http://localhost:3000/api/test", { method: "POST", headers: { "Content-Length": String(5 * 1024 * 1024) }, body: "{}" });
  assert.equal((await handler(oversized, undefined)).status, 413); assert.equal((state().materials as Array<{ currentStock: number }>)[0].currentStock, 10);
});

test("tasks can be completed durably but cannot bypass assignment or closed-order history", async () => {
  const { POST, PATCH } = await import("../src/app/api/service-orders/[id]/tasks/route");
  const context = { params: Promise.resolve({ id: "order" }) };
  const created = await POST(request("/api/service-orders/order/tasks", "POST", { title: "Conferir acabamento" }), context);
  assert.equal(created.status, 201);
  const { task } = await created.json();
  assert.equal((await PATCH(request("/api/service-orders/order/tasks", "PATCH", { taskId: task.id, done: true }, outsider), context)).status, 403);
  assert.equal((await PATCH(request("/api/service-orders/order/tasks", "PATCH", { taskId: task.id, done: true }), context)).status, 200);
  assert.equal((state().serviceOrders as ServiceOrder[])[0].tasks[0].done, true);
  (state().serviceOrders as ServiceOrder[])[0].status = "DELIVERED";
  assert.equal((await PATCH(request("/api/service-orders/order/tasks", "PATCH", { taskId: task.id, done: false }), context)).status, 409);
  assert.equal((state().serviceOrders as ServiceOrder[])[0].tasks[0].done, true);
});

test("a manager cannot grant financial access when creating a supervisor", async () => {
  const manager = { ...owner, id: "manager", role: "GERENTE" as const, email: "manager@example.test" };
  (state().users as SystemUser[]).push(manager);
  const { POST } = await import("../src/app/api/users/route");
  const response = await POST(request("/api/users", "POST", { name: "Supervisor", phone: "11911223344", role: "SUPERVISOR_OBRA", temporaryPassword: "Strong-test-pass-123", canViewFinancials: true }, manager), undefined);
  assert.equal(response.status, 403);
  assert.equal((state().users as SystemUser[]).length, 3);
});
