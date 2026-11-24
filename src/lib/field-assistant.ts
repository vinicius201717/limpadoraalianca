import "server-only";
import { randomUUID } from "node:crypto";
import { authorizeServiceOrderAccess } from "./service-order-access";
import { getAccessibleServiceOrders, getLinkedEmployeeId, isEmployeeAssignedToServiceOrder, isOpenServiceOrderForTeam, db, recordAuditLog } from "./store";
import type { AssistantAttachment, WorkHistoryEntry } from "./whatsapp-types";
import type { SessionUser } from "./types";
import { canManageWhatsAppFinance } from "./whatsapp-schema";

export class FieldError extends Error {}
export function fieldActor(user: SessionUser | null | undefined): asserts user is SessionUser {
  if (!user?.isActive || user.mustChangePassword) throw new FieldError("Sua conta precisa estar ativa, com senha definitiva.");
}
const globalWarehouse = { id: "warehouse", title: "Diário do almoxarifado", status: "IN_PROGRESS", customer: "" };
export function isWarehouseJournalUser(user: SessionUser) {
  return ["OWNER", "GERENTE", "ALMOXARIFADO"].includes(user.role);
}
export function fieldAssignment(user: SessionUser) {
  fieldActor(user);
  const linkedId = getLinkedEmployeeId(user);
  if (user.role === "SUPERVISOR_OBRA" || user.role === "ALMOXARIFADO") {
    // Never infer a supervisor's job from a generic team membership.
    const candidates = db.serviceOrders.filter((order) =>
      isOpenServiceOrderForTeam(order.status) &&
      (user.role === "SUPERVISOR_OBRA"
        ? order.supervisorUserId === user.id || Boolean(linkedId && order.supervisorEmployeeId === linkedId)
        : isEmployeeAssignedToServiceOrder(order, linkedId))
    ).filter((order) => {
      try { authorizeServiceOrderAccess(user, order.id, "history"); return true; }
      catch { return false; }
    });
    if (candidates.length > 1) return { locked: true, orderId: null, orders: [],
      problem: "Há mais de uma obra ativa vinculada ao seu perfil. A gestão precisa regularizar a escala para evitar registros na obra errada." };
    if (candidates.length === 1) return { locked: true, orderId: candidates[0].id,
      orders: [{ id: candidates[0].id, title: candidates[0].title, status: candidates[0].status, customer: candidates[0].customerName }], problem: null };
    if (user.role === "ALMOXARIFADO") return { locked: true, orderId: globalWarehouse.id, orders: [globalWarehouse], problem: null };
    return { locked: true, orderId: null, orders: [],
      problem: "Nenhuma obra ativa está designada para você como supervisor. Peça à gestão para vincular sua obra." };
  }
  const orders = getAccessibleServiceOrders(user).filter((order) => {
    try { authorizeServiceOrderAccess(user, order.id, "history"); return true; }
    catch { return false; }
  }).map((order) => ({ id: order.id, title: order.title, status: order.status, customer: order.customerName }));
  return { locked: false, orderId: null, orders, problem: null };
}
export function fieldOrders(user: SessionUser) { return fieldAssignment(user).orders; }
export function authorizeFieldContext(user: SessionUser, orderId: string) {
  fieldActor(user);
  const assignment = fieldAssignment(user);
  if (assignment.locked && assignment.orderId !== orderId) throw new FieldError(assignment.problem || "Esta obra não pertence à sua escala ativa.");
  if (!assignment.orders.some((order) => order.id === orderId)) throw new FieldError("Obra sem permissão para este perfil.");
  if (orderId === "warehouse") {
    if (!isWarehouseJournalUser(user)) throw new FieldError("Acesso ao almoxarifado não autorizado.");
  } else authorizeServiceOrderAccess(user, orderId, "history");
  return assignment;
}
export function fieldHistory(user: SessionUser, orderId: string): WorkHistoryEntry[] {
  fieldActor(user);
  if (orderId === "warehouse") {
    if (!isWarehouseJournalUser(user)) throw new FieldError("Sem acesso ao diário do almoxarifado.");
    return db.warehouseJournal;
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
  const collection = orderId === "warehouse" ? db.warehouseJournal : db.workHistory;
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
