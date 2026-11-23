import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { ConcurrentUpdateError } from "./app-state-db";
import { runWithStore } from "./request-store";
import { authorizeServiceOrderAccess } from "./service-order-access";
import { addReceipt, expenseTotal, reconcileExpenseLedger } from "./finance-operations";
import { assignChecklistItem, createChecklistItem, db, ensureDatabaseReady, getAccessibleServiceOrders, isEmployeeAssignedToServiceOrder, isOpenServiceOrderForTeam, recordAuditLog, recordChecklistEvent } from "./store";
import { assistantIntentSchema, canManageWhatsAppFinance, canUseWhatsApp, type AssistantIntent } from "./whatsapp-schema";
import type { AssistantAttachment, AssistantCommand, WhatsAppDeliveryUpdate, WhatsAppMessage, WorkHistoryEntry } from "./whatsapp-types";
import type { SessionUser } from "./types";

export class AssistantError extends Error {}
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const nowIso = () => new Date().toISOString();
export function replyAccess(user: SessionUser) {
  return digest(JSON.stringify({ id: user.id, role: user.role, version: user.sessionVersion ?? 0, finance: canManageWhatsAppFinance(user), orders: getAccessibleServiceOrders(user).map((order) => order.id).sort() }));
}
export function enqueueWhatsAppMessages(messages: WhatsAppMessage[]) {
  const pending = db.whatsappMessages.filter((entry) => ["QUEUED", "PROCESSING"].includes(entry.status)).length;
  const incoming = messages.filter((message) => !db.whatsappMessages.some((entry) => entry.id === message.id));
  if (pending + incoming.length > 2000) throw new Error("Queue capacity exceeded");
  for (const message of incoming) if (!db.whatsappMessages.some((entry) => entry.id === message.id)) db.whatsappMessages.push(message);
}

export function recordWhatsAppDelivery(updates: WhatsAppDeliveryUpdate[]) {
  const rank = { accepted: 0, sent: 1, failed: 2, delivered: 3, read: 4 };
  for (const update of updates) {
    const message = db.whatsappMessages.find((entry) => entry.replyMessageId === update.id || (update.trackingId && entry.replyTrackingId === update.trackingId && !entry.replyMessageId));
    if (!message || rank[update.status] < rank[message.replyDeliveryStatus ?? "accepted"]) continue;
    // A callback can arrive before the HTTP send response is persisted.
    message.replyMessageId = update.id;
    message.replySentAt ??= nowIso();
    message.replyDeliveryStatus = update.status;
    if (!message.replyStatusAt || update.timestamp > message.replyStatusAt) message.replyStatusAt = update.timestamp;
    message.replyErrorCodes = update.status === "failed" ? update.errorCodes : undefined;
  }
}

/** Short, retryable DB transaction. Never perform provider calls inside operation. */
export async function assistantTransaction<T>(operation: () => T): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    let result!: T;
    try {
      await runWithStore(async () => { await ensureDatabaseReady(); result = operation(); return Response.json({ ok: true }); });
      return result;
    } catch (error) {
      if (!(error instanceof ConcurrentUpdateError) || attempt >= 4) throw error;
    }
  }
}

export function requireAssistantActor(user: SessionUser | null | undefined): asserts user is SessionUser {
  if (!user?.isActive || user.mustChangePassword || !canUseWhatsApp(user.role)) throw new AssistantError("Seu perfil não tem acesso ao assistente. Confira sua conta no sistema.");
}
export function actorForPhone(phone: string) {
  const link = db.whatsappLinks.find((entry) => entry.phone === phone);
  const user = link && db.users.find((entry) => entry.id === link.userId);
  if (!user || link?.sessionVersion !== (user.sessionVersion ?? 0)) return null;
  try { requireAssistantActor(user); } catch { return null; }
  return user;
}
export function createLink(user: SessionUser) {
  requireAssistantActor(user);
  const token = randomBytes(32).toString("hex");
  const existing = db.whatsappLinks.find((entry) => entry.userId === user.id);
  const link = existing ?? { userId: user.id, sessionVersion: user.sessionVersion ?? 0 };
  link.tokenHash = digest(token); link.tokenExpiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  link.sessionVersion = user.sessionVersion ?? 0;
  if (!existing) db.whatsappLinks.push(link);
  return { token, expiresAt: link.tokenExpiresAt };
}
export function consumeLink(phone: string, token: string) {
  const link = db.whatsappLinks.find((entry) => entry.tokenHash === digest(token) && Date.parse(entry.tokenExpiresAt ?? "") > Date.now());
  const user = link && db.users.find((entry) => entry.id === link.userId);
  if (!link || !user || link.sessionVersion !== (user.sessionVersion ?? 0)) throw new AssistantError("Vínculo expirado ou inválido. Abra o botão WhatsApp no sistema novamente.");
  requireAssistantActor(user);
  if (db.whatsappLinks.some((entry) => entry.phone === phone && entry.userId !== user.id)) throw new AssistantError("Este WhatsApp já está vinculado a outra conta. Desvincule no sistema antes de continuar.");
  link.phone = phone; link.linkedAt = nowIso(); delete link.tokenHash; delete link.tokenExpiresAt;
  recordAuditLog({ userId: user.id, action: "WHATSAPP_LINKED", entity: "User", entityId: user.id });
  return user;
}
export function visibleHistory(user: SessionUser, orderId: string) {
  requireAssistantActor(user); authorizeServiceOrderAccess(user, orderId, "history");
  return db.workHistory.filter((entry) => entry.serviceOrderId === orderId
    && (entry.kind !== "FINANCIAL" || canManageWhatsAppFinance(user))
    && (entry.kind !== "WARNING" || user.role === "OWNER" || user.role === "GERENTE" || entry.userId === user.id)
    && (user.role !== "FINANCEIRO" || entry.kind === "FINANCIAL"));
}
export function assistantContext(user: SessionUser) {
  requireAssistantActor(user);
  const orders = getAccessibleServiceOrders(user);
  const ids = new Set(orders.map((order) => order.id));
  return {
    role: user.role, canManageFinance: canManageWhatsAppFinance(user), today: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
    orders: orders.map((order) => ({ id: order.id, title: order.title, customer: order.customerName, status: order.status, employeeIds: order.employeeIds })),
    employees: user.role === "FINANCEIRO" ? [] : db.employees.filter((employee) => employee.status === "ACTIVE" && orders.some((order) => isEmployeeAssignedToServiceOrder(order, employee.id))).map(({ id, name }) => ({ id, name })),
    checklist: user.role === "FINANCEIRO" ? [] : db.serviceOrderChecklistItems.filter((item) => ids.has(item.serviceOrderId) && !["DONE", "CANCELED"].includes(item.status)).map(({ id, serviceOrderId, title }) => ({ id, serviceOrderId, title })),
    payments: canManageWhatsAppFinance(user) ? db.servicePayments.filter((item) => ids.has(item.serviceOrderId)).map(({ id, serviceOrderId, description, amount }) => ({ id, serviceOrderId, description, amount })) : [],
  };
}

function activeOrder(user: SessionUser, id: string | null) {
  if (!id) throw new AssistantError("Informe qual obra deve receber o registro.");
  try { return authorizeServiceOrderAccess(user, id, "history").order; }
  catch { throw new AssistantError("Obra não encontrada ou sem permissão para seu perfil."); }
}
export function validateIntent(user: SessionUser, raw: AssistantIntent, attachment?: AssistantAttachment) {
  requireAssistantActor(user);
  const intent = assistantIntentSchema.parse(raw);
  if (intent.action === "CLARIFY") return intent;
  const order = activeOrder(user, intent.serviceOrderId);
  if (user.role === "FINANCEIRO" && !["FILE_RECEIPT", "REPORT"].includes(intent.action)) throw new AssistantError("Seu perfil financeiro pode arquivar comprovantes e consultar relatórios financeiros.");
  if (["CREATE_CHECKLIST", "ASSIGN_CHECKLIST", "TRANSFER_EMPLOYEE", "WARN_EMPLOYEE"].includes(intent.action) && !isOpenServiceOrderForTeam(order.status)) throw new AssistantError("Esta obra está encerrada. Escolha uma obra ativa.");
  const employee = db.employees.find((entry) => entry.id === intent.employeeId);
  if (["ASSIGN_CHECKLIST", "TRANSFER_EMPLOYEE", "WARN_EMPLOYEE"].includes(intent.action) || (intent.action === "CREATE_CHECKLIST" && intent.employeeId)) {
    if (!employee || employee.status !== "ACTIVE" || !isEmployeeAssignedToServiceOrder(order, employee.id)) throw new AssistantError("O colaborador precisa estar ativo e fazer parte da equipe desta obra.");
  }
  if (intent.action === "ASSIGN_CHECKLIST") {
    const item = db.serviceOrderChecklistItems.find((entry) => entry.id === intent.checklistItemId && entry.serviceOrderId === order.id);
    if (!item || ["DONE", "CANCELED"].includes(item.status)) throw new AssistantError("Escolha um item de checklist ainda aberto desta obra.");
  }
  if (intent.action === "TRANSFER_EMPLOYEE") {
    if (!["OWNER", "GERENTE"].includes(user.role)) throw new AssistantError("Somente donos e gerentes podem transferir colaboradores entre obras.");
    const destination = activeOrder(user, intent.destinationOrderId);
    if (destination.id === order.id || !isOpenServiceOrderForTeam(destination.status)) throw new AssistantError("Escolha outra obra ativa como destino.");
    if (order.supervisorEmployeeId === employee!.id || db.serviceOrderEmployees.some((link) => link.serviceOrderId === order.id && link.employeeId === employee!.id && link.roleInService === "SUPERVISOR")) throw new AssistantError("Troque o supervisor pela tela da obra antes de remanejá-lo.");
    if (db.serviceOrders.some((other) => other.id !== order.id && other.id !== destination.id && isOpenServiceOrderForTeam(other.status) && isEmployeeAssignedToServiceOrder(other, employee!.id))) throw new AssistantError("Este colaborador também está escalado em uma terceira obra ativa. Revise a equipe no sistema.");
    if (db.serviceOrderChecklistItems.some((item) => item.serviceOrderId === order.id && item.status === "IN_PROGRESS" && (item.assignedEmployeeIds ?? [item.assignedEmployeeId]).includes(employee!.id))) throw new AssistantError("O colaborador tem atividade em andamento. Conclua ou reatribua a atividade antes de transferi-lo.");
  }
  if (intent.action === "WARN_EMPLOYEE") {
    const target = db.users.find((entry) => entry.id === employee?.userId);
    if (employee?.userId === user.id || (target && target.role === "OWNER") || (target?.role === "GERENTE" && user.role !== "OWNER") || (user.role === "SUPERVISOR_OBRA" && (order.supervisorEmployeeId === employee!.id || (target && target.role !== "COLABORADOR")))) throw new AssistantError("Seu perfil não pode registrar advertência para este colaborador.");
  }
  if (["DIARY", "WARN_EMPLOYEE"].includes(intent.action) && !intent.details.trim()) throw new AssistantError("Descreva o ocorrido para registrar.");
  if (intent.action === "CREATE_CHECKLIST" && !intent.title.trim()) throw new AssistantError("Informe o título da atividade.");
  if (intent.action === "FILE_RECEIPT") {
    if (!canManageWhatsAppFinance(user)) throw new AssistantError("Seu perfil não tem permissão financeira.");
    if (!attachment || !["application/pdf", "image/jpeg", "image/png"].includes(attachment.mimeType)) throw new AssistantError("Envie primeiro o comprovante em PDF, JPG ou PNG e informe a obra.");
    if (db.financialDocuments.some((entry) => entry.attachment.id === attachment.id)) throw new AssistantError("Este comprovante já foi registrado.");
    if (!intent.financialDirection) throw new AssistantError("Informe se deseja apenas arquivar, lançar uma despesa ou registrar um recebimento.");
    if (intent.amount !== null && (Math.round(intent.amount * 100) <= 0 || Math.abs(Math.round(intent.amount * 100) / 100 - intent.amount) > 0.0000001)) throw new AssistantError("Informe um valor positivo com no máximo duas casas decimais.");
    if (intent.financialDirection !== "ARCHIVE" && (!intent.amount || !intent.paidAt || !Number.isFinite(Date.parse(intent.paidAt)) || Date.parse(intent.paidAt) > Date.now() + 86400000)) throw new AssistantError("Confirme o valor e a data do pagamento.");
    if (intent.financialDirection === "PAYMENT") {
      const payment = db.servicePayments.find((entry) => entry.id === intent.paymentId && entry.serviceOrderId === order.id);
      if (!payment) throw new AssistantError("Informe a parcela correta para este recebimento.");
      if (!intent.paymentMethod?.trim()) throw new AssistantError("Informe a forma de pagamento.");
      try { addReceipt(structuredClone(payment), { amount: intent.amount!, paidAt: intent.paidAt!, method: intent.paymentMethod, reference: attachment.id }, user.id); }
      catch { throw new AssistantError("O valor deve ser positivo e não pode superar o saldo da parcela."); }
    }
  }
  return intent;
}

export function describeIntent(user: SessionUser, intent: AssistantIntent, attachment?: AssistantAttachment) {
  validateIntent(user, intent, attachment);
  const order = activeOrder(user, intent.serviceOrderId);
  const employee = db.employees.find((entry) => entry.id === intent.employeeId);
  const item = db.serviceOrderChecklistItems.find((entry) => entry.id === intent.checklistItemId);
  const prefix = `Obra: ${order.title} (${order.id}).`;
  switch (intent.action) {
    case "CREATE_CHECKLIST": return `${prefix}\nCriar atividade: ${intent.title}. ${intent.details}${employee ? `\nResponsável: ${employee.name}.` : ""}`;
    case "ASSIGN_CHECKLIST": return `${prefix}\nAtribuir “${item!.title}” a ${employee!.name}, substituindo: ${(item!.assignedEmployeeIds ?? (item!.assignedEmployeeId ? [item!.assignedEmployeeId] : [])).map((id) => db.employees.find((entry) => entry.id === id)?.name || id).join(", ") || "sem responsável"}.`;
    case "TRANSFER_EMPLOYEE": return `${prefix}\nTransferir ${employee!.name} para ${activeOrder(user, intent.destinationOrderId).title}. Remover da equipe e das atividades pendentes da obra de origem.`;
    case "WARN_EMPLOYEE": return `${prefix}\nRegistrar advertência interna para ${employee!.name}: ${intent.details}`;
    case "FILE_RECEIPT": return `${prefix}\n${intent.financialDirection === "ARCHIVE" ? "Arquivar comprovante (sem alterar saldos)" : intent.financialDirection === "EXPENSE" ? "Lançar despesa com comprovante" : "Registrar recebimento na parcela " + db.servicePayments.find((entry) => entry.id === intent.paymentId)?.description + " (" + intent.paymentId + ")"}: ${intent.details || intent.title}.\nArquivo: ${attachment!.fileName}.${intent.financialDirection !== "ARCHIVE" ? `\nValor: R$ ${intent.amount!.toFixed(2)}. Data: ${intent.paidAt}. ${intent.financialDirection === "EXPENSE" ? `Categoria: ${intent.expenseCategory || "OUTROS"}.` : `Forma: ${intent.paymentMethod}.`}` : ""}`;
    default: return `${prefix}\n${intent.title}: ${intent.details}`;
  }
}
function history(user: SessionUser, intent: AssistantIntent, messageId: string, transcript: string, kind: WorkHistoryEntry["kind"], title: string, content: string, attachment?: AssistantAttachment) {
  const entry: WorkHistoryEntry = { id: randomUUID(), serviceOrderId: intent.serviceOrderId!, userId: user.id, authorName: user.name, kind, title, content, transcript, messageId, attachment, createdAt: nowIso() };
  db.workHistory.push(entry); return entry;
}
export function saveDiary(user: SessionUser, intent: AssistantIntent, messageId: string, transcript: string, attachment?: AssistantAttachment) {
  validateIntent(user, intent, attachment);
  if (intent.action !== "DIARY") throw new AssistantError("Registro inválido.");
  const existing = db.workHistory.find((entry) => entry.messageId === messageId && entry.kind === "DIARY");
  if (existing) return existing;
  const entry = history(user, intent, messageId, transcript, "DIARY", intent.title || "Diário da obra", intent.details, attachment);
  recordAuditLog({ userId: user.id, action: "WHATSAPP_DIARY", entity: "WorkHistory", entityId: entry.id });
  return entry;
}
export function proposeCommand(user: SessionUser, phone: string, intent: AssistantIntent, messageId: string, transcript: string, attachment?: AssistantAttachment) {
  const summary = describeIntent(user, intent, attachment);
  if (summary.length > 3000) throw new AssistantError("O pedido ficou muito longo para conferir pelo WhatsApp. Envie uma ação por vez com uma descrição mais curta.");
  const existing = db.assistantCommands.find((entry) => entry.messageId === messageId);
  if (existing) return existing;
  const command: AssistantCommand = { id: randomUUID(), code: randomBytes(6).toString("hex").toUpperCase(), userId: user.id, phone, sessionVersion: user.sessionVersion ?? 0, intent, messageId, transcript, attachment, summary, createdAt: nowIso(), expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(), status: "PENDING" };
  db.assistantCommands.push(command); return command;
}
export function confirmCommand(user: SessionUser, phone: string, code: string, cancel = false) {
  requireAssistantActor(user);
  const command = db.assistantCommands.find((entry) => entry.code === code && entry.userId === user.id && entry.phone === phone);
  if (!command || command.sessionVersion !== (user.sessionVersion ?? 0)) throw new AssistantError("Confirmação inválida para esta conta.");
  if (command.status !== "PENDING") return command.status === "CONFIRMED" ? "Esta ação já foi registrada; nada foi duplicado." : "Esta ação já foi cancelada.";
  if (Date.parse(command.expiresAt) <= Date.now()) throw new AssistantError("Confirmação expirada. Envie o pedido novamente.");
  if (cancel) { command.status = "CANCELED"; return "Pedido cancelado. Nenhum registro foi alterado."; }
  const intent = validateIntent(user, command.intent, command.attachment);
  // Re-render names and amounts against the current state before execution.
  if (describeIntent(user, intent, command.attachment) !== command.summary) throw new AssistantError("Os dados mudaram desde o pedido. Envie a solicitação novamente para revisar.");
  const order = activeOrder(user, intent.serviceOrderId);
  const time = nowIso();
  let kind: WorkHistoryEntry["kind"] = "CHECKLIST";
  if (intent.action === "CREATE_CHECKLIST") {
    const result = createChecklistItem(order.id, { title: intent.title, description: intent.details, assignedEmployeeIds: intent.employeeId ? [intent.employeeId] : [] }, user);
    if (result.error) throw new AssistantError("Não foi possível criar a atividade. Revise a equipe.");
  } else if (intent.action === "ASSIGN_CHECKLIST") {
    const result = assignChecklistItem(order.id, intent.checklistItemId!, [intent.employeeId!], user);
    if (result.error) throw new AssistantError("Não foi possível atribuir a atividade. Revise a equipe.");
    kind = "ASSIGNMENT";
  } else if (intent.action === "TRANSFER_EMPLOYEE") {
    const destination = activeOrder(user, intent.destinationOrderId);
    const employeeId = intent.employeeId!;
    const oldLink = db.serviceOrderEmployees.find((entry) => entry.serviceOrderId === order.id && entry.employeeId === employeeId);
    const role = oldLink?.roleInService ?? "OUTRO";
    order.employeeIds = order.employeeIds.filter((id) => id !== employeeId);
    db.serviceOrderEmployees = db.serviceOrderEmployees.filter((entry) => !(entry.serviceOrderId === order.id && entry.employeeId === employeeId));
    if (!destination.employeeIds.includes(employeeId)) destination.employeeIds.push(employeeId);
    if (!db.serviceOrderEmployees.some((entry) => entry.serviceOrderId === destination.id && entry.employeeId === employeeId)) db.serviceOrderEmployees.push({ id: randomUUID(), serviceOrderId: destination.id, employeeId, roleInService: role, assignedByUserId: user.id, assignedAt: time, createdAt: time, updatedAt: time });
    for (const item of db.serviceOrderChecklistItems.filter((entry) => entry.serviceOrderId === order.id && !["DONE", "CANCELED"].includes(entry.status))) {
      const assigned = item.assignedEmployeeIds ?? (item.assignedEmployeeId ? [item.assignedEmployeeId] : []);
      if (!assigned.includes(employeeId)) continue;
      item.assignedEmployeeIds = assigned.filter((id) => id !== employeeId); item.assignedEmployeeId = item.assignedEmployeeIds[0]; item.updatedAt = time;
      recordChecklistEvent({ checklistItemId: item.id, serviceOrderId: order.id, userId: user.id, type: "ASSIGNED", message: "Responsável removido por transferência confirmada via WhatsApp." });
    }
    kind = "TRANSFER";
    history(user, { ...intent, serviceOrderId: destination.id }, command.messageId, command.transcript, kind, "Transferência de colaborador", command.summary);
  } else if (intent.action === "WARN_EMPLOYEE") {
    const employee = db.employees.find((entry) => entry.id === intent.employeeId)!;
    db.employeeWarnings.push({ id: randomUUID(), serviceOrderId: order.id, employeeId: employee.id, employeeName: employee.name, reason: intent.details, userId: user.id, authorName: user.name, messageId: command.messageId, createdAt: time });
    kind = "WARNING";
  } else if (intent.action === "FILE_RECEIPT") {
    let expenseId: string | undefined; let receiptId: string | undefined;
    if (intent.financialDirection === "EXPENSE") {
      reconcileExpenseLedger(order, db.serviceExpenses, user.id); expenseId = randomUUID();
      db.serviceExpenses.push({ id: expenseId, serviceOrderId: order.id, employeeId: "", employeeName: "Financeiro", category: intent.expenseCategory ?? "OUTROS", amount: Math.round(intent.amount! * 100) / 100, notes: `${intent.details || intent.title}\nData do pagamento: ${intent.paidAt}`, createdByUserId: user.id, createdAt: time, updatedAt: time });
      order.expenses = expenseTotal(order.id, db.serviceExpenses);
    } else if (intent.financialDirection === "PAYMENT") {
      const payment = db.servicePayments.find((entry) => entry.id === intent.paymentId)!;
      receiptId = addReceipt(payment, { amount: intent.amount!, paidAt: intent.paidAt!, method: intent.paymentMethod!, reference: command.attachment!.id }, user.id).id;
    }
    db.financialDocuments.push({ id: randomUUID(), serviceOrderId: order.id, description: intent.details || intent.title, direction: intent.financialDirection!, amount: intent.amount ?? undefined, paymentId: intent.paymentId ?? undefined, expenseId, receiptId, userId: user.id, messageId: command.messageId, attachment: command.attachment!, createdAt: time });
    kind = "FINANCIAL";
  } else { throw new AssistantError("Esta ação não pode ser confirmada."); }
  history(user, intent, command.messageId, command.transcript, kind, intent.title || "Registro via WhatsApp", command.summary, command.attachment);
  command.status = "CONFIRMED"; command.confirmedAt = time;
  recordAuditLog({ userId: user.id, action: `WHATSAPP_${intent.action}`, entity: "ServiceOrder", entityId: order.id, metadata: { commandId: command.id, messageId: command.messageId } });
  return `Registrado com sucesso.\n${command.summary}`;
}
