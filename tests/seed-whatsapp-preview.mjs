// Only the disposable fixture server on loopback can receive this demonstration data.
const base = "http://127.0.0.1:4311/rest/v1/app_state";
const id = "floor-restoration-manager-owner-only";
const headers = { apikey: "local-fixture-key", "Content-Type": "application/json" };
const response = await fetch(`${base}?id=eq.${id}`, { headers });
if (!response.ok) throw new Error("Start tests/fixture-server.mjs first.");
const [row] = await response.json();
if (!row || !row.data.users.every((user) => user.id.startsWith("local-"))) throw new Error("This script only accepts the disposable fixture database.");
const now = new Date().toISOString();
row.data.serviceOrders = [{ id: "preview-work", title: "Obra de demonstração — Jardim das Flores", customerId: "preview-customer", customerName: "Cliente de demonstração", quoteId: "", description: "Restauração de pisos", address: "Endereço de demonstração", scheduledStart: now, scheduledEnd: now, status: "IN_PROGRESS", employeeIds: [], tasks: [], revenue: 1000, expenses: 150, internalNotes: "", clientNotes: "" }];
row.data.workHistory = [{ id: "preview-diary", serviceOrderId: "preview-work", userId: "local-owner", authorName: "Administrador de teste", kind: "DIARY", title: "Preparação do piso concluída", content: "A equipe concluiu a preparação do piso da sala. O corredor aguarda a chegada do material. Próxima etapa informada: polimento da sala.", transcript: "Hoje a gente terminou de preparar o piso da sala. Faltou material no corredor. Amanhã vamos começar o polimento.", messageId: "preview-message", createdAt: now }];
row.data.whatsappMessages = [{ id: "preview-message", from: "5511999999999", type: "audio", text: "", transcript: "Hoje a gente terminou de preparar o piso da sala.", userId: "local-owner", status: "DONE", attempts: 1, timestamp: String(Math.floor(Date.now() / 1000)), createdAt: now }];
const saved = await fetch(`${base}?id=eq.${id}&updated_at=eq.${encodeURIComponent(row.updated_at)}`, { method: "PATCH", headers, body: JSON.stringify({ data: row.data, updated_at: now }) });
if (!saved.ok || (await saved.json()).length !== 1) throw new Error("Fixture seed failed.");
console.log("Disposable WhatsApp preview populated.");
