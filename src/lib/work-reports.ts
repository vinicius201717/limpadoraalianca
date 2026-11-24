import "server-only";
import { randomUUID } from "node:crypto";
import { assistantModel, generateWorkReport } from "./whatsapp-ai";
import { AssistantError, assistantTransaction } from "./whatsapp-operations";
import { fieldActor, fieldHistory } from "./field-assistant";
import { canManageWhatsAppFinance } from "./whatsapp-schema";
import { authorizeServiceOrderAccess } from "./service-order-access";
import { db, recordAuditLog } from "./store";
import type { SessionUser } from "./types";

export const reportScope = (user: SessionUser) => `${user.role}:${canManageWhatsAppFinance(user) ? "finance" : "operational"}`;
export async function createWorkReport(userId: string, orderId: string) {
  const snapshot = await assistantTransaction(() => {
    const user = db.users.find((entry) => entry.id === userId); fieldActor(user); if(!["OWNER","GERENTE"].includes(user.role))throw new AssistantError("Relatórios exclusivos do dono e do gerente.");
    const order = authorizeServiceOrderAccess(user, orderId, "history").order;
    const allHistory = fieldHistory(user, orderId);
    const entries = allHistory.slice(-300).map(({ id, authorName, kind, title, content, createdAt }) => ({ id, authorName, kind, title, content, createdAt }));
    const checklist = user.role === "FINANCEIRO" ? [] : db.serviceOrderChecklistItems.filter((item) => item.serviceOrderId === orderId).map(({ id, title, status, completionNotes }) => ({ id, title, status, completionNotes }));
    const financial = canManageWhatsAppFinance(user) ? { revenue: order.revenue, expenses: order.expenses, documents: db.financialDocuments.filter((item) => item.serviceOrderId === orderId).slice(-100).map(({ id, description, direction, amount, createdAt }) => ({ id, description, direction, amount, createdAt })) } : undefined;
    return { sessionVersion: user.sessionVersion ?? 0, scope: reportScope(user), input: { order: { id: order.id, title: order.title, status: order.status }, scope: reportScope(user), entries, checklist, financial, historyCount: allHistory.length, historyIncluded: entries.length }, sourceIds: [order.id, ...entries.map((entry) => entry.id), ...checklist.map((item) => item.id), ...(financial?.documents.map((item) => item.id) ?? [])] };
  });
  const content = await generateWorkReport(snapshot.input);
  return assistantTransaction(() => {
    const user = db.users.find((entry) => entry.id === userId); fieldActor(user); if(!["OWNER","GERENTE"].includes(user.role))throw new AssistantError("Relatórios exclusivos do dono e do gerente.");
    authorizeServiceOrderAccess(user, orderId, "history");
    if (reportScope(user) !== snapshot.scope || (user.sessionVersion ?? 0) !== snapshot.sessionVersion) throw new AssistantError("Suas permissões mudaram. Gere o relatório novamente.");
    const report = { id: randomUUID(), serviceOrderId: orderId, userId, content, sourceIds: snapshot.sourceIds, scope: snapshot.scope, createdAt: new Date().toISOString(), model: assistantModel() };
    db.workReports.push(report);
    recordAuditLog({ userId, action: "GENERATE_WORK_REPORT", entity: "WorkReport", entityId: report.id });
    return report;
  });
}
