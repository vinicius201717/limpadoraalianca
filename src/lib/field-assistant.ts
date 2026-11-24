import "server-only";
import { randomUUID } from "node:crypto";
import { authorizeServiceOrderAccess } from "./service-order-access";
import { getAccessibleServiceOrders, getLinkedEmployeeId, isEmployeeAssignedToServiceOrder, isOpenServiceOrderForTeam, db, recordAuditLog } from "./store";
import type { AssistantAttachment, WorkHistoryEntry } from "./whatsapp-types";
import type { SessionUser } from "./types";
import { canManageWhatsAppFinance } from "./whatsapp-schema";

export class FieldError extends Error {}
export function fieldActor(user: SessionUser | null | undefined): asserts user is SessionUser {
  if (!user?.isActive || user.mustChangePassword || user.role === "COLABORADOR") throw new FieldError("O Assistente de Campo é exclusivo para usuários administrativos e de supervisão.");
}
const globalWarehouse = { id: "warehouse", title: "Diário do almoxarifado", status: "IN_PROGRESS", customer: "" };
export function isWarehouseJournalUser(user: SessionUser) {
  return ["OWNER", "GERENTE", "ALMOXARIFADO"].includes(user.role);
}
const officeOption = { id: "office", title: "Diário administrativo", status: "IN_PROGRESS" as const, customer: "" };
export function fieldAssignment(user: SessionUser) {
  fieldActor(user);
  const linkedId = getLinkedEmployeeId(user);
  if (user.role === "SUPERVISOR_OBRA") {
    const candidates = db.serviceOrders.filter((order) =>
      isOpenServiceOrderForTeam(order.status) &&
      (order.supervisorUserId === user.id || Boolean(linkedId && order.supervisorEmployeeId === linkedId))
    ).filter((order) => {
      try { authorizeServiceOrderAccess(user, order.id, "history"); return true; }
      catch { return false; }
    });
    const orders = candidates.map((o) => ({ id: o.id, title: o.title, status: o.status, customer: o.customerName }));
    return { locked: orders.length <= 1, orderId: orders.length === 1 ? orders[0].id : null, orders,
      problem: !orders.length ? "Nenhuma obra ativa foi atribuída a este supervisor." : null };
  }
  if (user.role === "ALMOXARIFADO") {
    const candidates = db.serviceOrders.filter((o) => isOpenServiceOrderForTeam(o.status) &&
      isEmployeeAssignedToServiceOrder(o, linkedId)).filter((order) => {
      try { authorizeServiceOrderAccess(user, order.id, "history"); return true; }
      catch { return false; }
    });
    const orders = [
      ...candidates.map((o) => ({ id: o.id, title: o.title, status: o.status, customer: o.customerName })),
      globalWarehouse,
    ];
    // Prefer the work assigned to the warehouse employee while keeping the warehouse available.
    return { locked: candidates.length === 0, orderId: candidates.length === 1 ? candidates[0].id : candidates.length === 0 ? "warehouse" : null,
      orders, problem: null };
  }
  const orders = getAccessibleServiceOrders(user).filter((order) => {
    try { authorizeServiceOrderAccess(user, order.id, "history"); return true; } catch { return false; }
  }).map((order) => ({ id: order.id, title: order.title, status: order.status, customer: order.customerName }));
  orders.push(officeOption);
  return { locked: orders.length === 1, orderId: orders.length === 1 ? orders[0].id : null,
    orders, problem: null };
}
export function fieldOrders(user: SessionUser) { return fieldAssignment(user).orders; }
export function authorizeFieldContext(user: SessionUser, orderId: string) {
  fieldActor(user);
  const assignment = fieldAssignment(user);
  if (assignment.locked && assignment.orderId !== orderId) throw new FieldError(assignment.problem || "Este diário não pertence ao seu perfil.");
  if (!assignment.orders.some((order) => order.id === orderId)) throw new FieldError("Obra sem permissão para este perfil.");
  if (orderId === "office") return db.officeJournal.filter((e) => (e.userId === user.id || ["OWNER", "GERENTE"].includes(user.role)) && (e.kind !== "FINANCIAL" || canManageWhatsAppFinance(user)));
  if (orderId === "warehouse") {
    if (!isWarehouseJournalUser(user)) throw new FieldError("Acesso ao almoxarifado não autorizado.");
  } else if (orderId !== "office") authorizeServiceOrderAccess(user, orderId, "history");
  return assignment;
}
export function fieldHistory(user: SessionUser, orderId: string): WorkHistoryEntry[] {
  fieldActor(user);
  if (orderId === "office") return db.officeJournal.filter((e) => (e.userId === user.id || ["OWNER", "GERENTE"].includes(user.role)) && (e.kind !== "FINANCIAL" || canManageWhatsAppFinance(user)));
  if (orderId === "warehouse") {
    if (!isWarehouseJournalUser(user)) throw new FieldError("Sem acesso ao diário do almoxarifado.");
    return db.warehouseJournal.filter(e=>(e.kind!=="FINANCIAL"||canManageWhatsAppFinance(user))&&(e.kind!=="WARNING"||["OWNER","GERENTE"].includes(user.role)||e.userId===user.id));
  }
  // Historical consultation remains available after the work is closed.
  // Only new submissions require the active, locked fieldAssignment.
  authorizeServiceOrderAccess(user, orderId, "history");
  return db.workHistory.filter((e) => e.serviceOrderId === orderId
    && (e.kind !== "FINANCIAL" || canManageWhatsAppFinance(user))
    && (e.kind !== "WARNING" || ["OWNER", "GERENTE"].includes(user.role) || e.userId === user.id)
    && (user.role !== "FINANCEIRO" || e.kind === "FINANCIAL" || e.kind === "DIARY"));
}
export function appendFieldEntry(input: {
  user: SessionUser; orderId: string; nonce: string; title: string; content: string;
  transcript?: string; attachment?: AssistantAttachment; recordingSessionId?: string;
}): WorkHistoryEntry {
  const { user, orderId, nonce, title, content, transcript = "", attachment, recordingSessionId } = input;
  fieldActor(user);
  authorizeFieldContext(user, orderId);
  if (!/^[a-zA-Z0-9_-]{12,100}$/.test(nonce)) throw new FieldError("Identificador do envio inválido.");
  if (!content.trim() || content.length > 12000 || title.length > 180 || transcript.length > 12000) throw new FieldError("Relato vazio ou acima do limite.");
  const messageId = `campo:${user.id}:${nonce}`;
  const collection = orderId === "warehouse" ? db.warehouseJournal : orderId === "office" ? db.officeJournal : db.workHistory;
  const previous = collection.find((entry) => entry.messageId === messageId);
  if (previous) {
    if (previous.serviceOrderId !== orderId) throw new FieldError("Este envio pertence a outra obra.");
    return previous;
  }
  const entry: WorkHistoryEntry = {
    id: randomUUID(), serviceOrderId: orderId, userId: user.id, authorName: user.name,
    kind: "DIARY", title: title.trim() || "Relato de campo", content: content.trim(),
    transcript: transcript.trim(), messageId, attachment, recordingSessionId, createdAt: new Date().toISOString(),
  };
  collection.push(entry);
  recordAuditLog({ userId: user.id, action: "FIELD_DIARY_CREATED", entity: "WorkHistory", entityId: entry.id });
  return entry;
}
