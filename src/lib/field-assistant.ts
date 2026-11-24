import "server-only";
import { randomUUID } from "node:crypto";
import { authorizeServiceOrderAccess } from "./service-order-access";
import { getAccessibleServiceOrders, db, recordAuditLog } from "./store";
import type { AssistantAttachment, WorkHistoryEntry } from "./whatsapp-types";
import type { SessionUser } from "./types";
import { canManageWhatsAppFinance } from "./whatsapp-schema";

export class FieldError extends Error {}
export function fieldActor(user: SessionUser | null | undefined): asserts user is SessionUser {
  if (!user?.isActive || user.mustChangePassword) throw new FieldError("Sua conta precisa estar ativa, com senha definitiva.");
}
export function fieldOrders(user: SessionUser) {
  fieldActor(user);
  return getAccessibleServiceOrders(user).filter((order) => {
    try { authorizeServiceOrderAccess(user, order.id, "history"); return true; }
    catch { return false; }
  }).map((order) => ({ id: order.id, title: order.title, status: order.status, customer: order.customerName }));
}
export function fieldHistory(user: SessionUser, orderId: string): WorkHistoryEntry[] {
  fieldActor(user);
  authorizeServiceOrderAccess(user, orderId, "history");
  return db.workHistory.filter((e) => e.serviceOrderId === orderId
    && (e.kind !== "FINANCIAL" || canManageWhatsAppFinance(user))
    && (e.kind !== "WARNING" || ["OWNER", "GERENTE"].includes(user.role) || e.userId === user.id)
    && (user.role !== "FINANCEIRO" || e.kind === "FINANCIAL" || e.kind === "DIARY"));
}
export function appendFieldEntry(input: {
  user: SessionUser; orderId: string; nonce: string; title: string; content: string;
  transcript?: string; attachment?: AssistantAttachment;
}): WorkHistoryEntry {
  const { user, orderId, nonce, title, content, transcript = "", attachment } = input;
  fieldActor(user);
  authorizeServiceOrderAccess(user, orderId, "history");
  if (!/^[a-zA-Z0-9_-]{12,100}$/.test(nonce)) throw new FieldError("Identificador do envio inválido.");
  if (!content.trim() || content.length > 12000 || title.length > 180 || transcript.length > 12000) throw new FieldError("Relato vazio ou acima do limite.");
  const messageId = `campo:${user.id}:${nonce}`;
  const previous = db.workHistory.find((entry) => entry.messageId === messageId);
  if (previous) {
    if (previous.serviceOrderId !== orderId) throw new FieldError("Este envio pertence a outra obra.");
    return previous;
  }
  const entry: WorkHistoryEntry = {
    id: randomUUID(), serviceOrderId: orderId, userId: user.id, authorName: user.name,
    kind: "DIARY", title: title.trim() || "Relato de campo", content: content.trim(),
    transcript: transcript.trim(), messageId, attachment, createdAt: new Date().toISOString(),
  };
  db.workHistory.push(entry);
  recordAuditLog({ userId: user.id, action: "FIELD_DIARY_CREATED", entity: "WorkHistory", entityId: entry.id });
  return entry;
}
