import "server-only";
import { randomUUID } from "node:crypto";
import { fieldActionSchema, diaryAction, type FieldAction } from "./field-action-schema";
import { interpretFieldCommand } from "./field-command-ai";
import { appendFieldEntry, authorizeFieldContext, fieldActor, fieldAssignment, FieldError } from "./field-assistant";
import { authorizeServiceOrderAccess } from "./service-order-access";
import { canManageStock, canRequestServiceMaterials, canViewServiceOrderFinancials } from "./permissions";
import { pendingFinancialReceipts, settleFieldReceipt } from "./field-receipts";
import {
  assignChecklistItem, blockChecklistItem, completeChecklistItem, createChecklistItem,
  db, getLinkedEmployeeId, isEmployeeAssignedToServiceOrder, isOpenServiceOrderForTeam,
  recordAuditLog, startChecklistItem,
} from "./store";
import { applyEquipmentMovement, applyMaterialMovement, InventoryError, isArchivedStockItem } from "./inventory-operations";
import type { AssistantAttachment, WorkHistoryEntry } from "./whatsapp-types";
import type { Material, ServiceOrder, ServiceOrderEquipment, ServiceOrderMaterial, SessionUser } from "./types";

type UiDirective = { kind: "THEME" | "ORDER" | "REPORT"; value: string };
type Outcome = { message: string; entityId?: string; stockChange?: boolean; targetOrderId?: string; ui?: UiDirective };
const rounded = (n: number) => Math.round(n * 1e6) / 1e6;
const comparable = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
const operational = (role: string) => ["OWNER", "GERENTE", "SUPERVISOR_OBRA", "ALMOXARIFADO"].includes(role);
const stockAllowed = (user: SessionUser) => canManageStock(user.role);
function requireOpen(orderId: string) {
  const order = db.serviceOrders.find((item) => item.id === orderId);
  if (!order || !isOpenServiceOrderForTeam(order.status)) throw new FieldError("A obra de destino deve estar ativa.");
  return order;
}
function orderForStock(user: SessionUser, currentOrder: string, requested: string | null) {
  if (!stockAllowed(user)) throw new FieldError("Somente almoxarifado e gestão podem registrar saída, baixa e entrada de estoque.");
  const target = requested || (currentOrder === "warehouse" ? null : currentOrder);
  if (!target) throw new FieldError("Diga qual obra ou equipe recebeu ou devolveu o item.");
  const order = requireOpen(target);
  try { authorizeServiceOrderAccess(user, order.id, "materials"); }
  catch { throw new FieldError("Você não possui permissão para movimentar materiais dessa obra."); }
  if (user.role !== "ALMOXARIFADO" && target !== currentOrder) throw new FieldError("A operação deve se referir à obra selecionada.");
  return order;
}
function activeMaterial(id: string | null): Material {
  const item = db.materials.find((record) => record.id === id);
  if (!item || isArchivedStockItem(item)) throw new FieldError("Produto não encontrado no estoque ativo. Identifique-o pelo nome correto.");
  return item;
}
function amount(action: FieldAction) {
  const n = action.quantity;
  if (!n || !Number.isFinite(n) || n <= 0 || n > 100000 || Math.abs(rounded(n) - n) > 0.0000001)
    throw new FieldError("Informe uma quantidade positiva e precisa, com até seis casas decimais.");
  return n;
}
function teamMembers(order: ServiceOrder, ids: string[], allowEmpty = true) {
  if ((!allowEmpty && !ids.length) || new Set(ids).size !== ids.length) throw new FieldError("Informe colaboradores sem duplicações.");
  for (const id of ids) {
    const employee = db.employees.find((entry) => entry.id === id);
    if (!employee || employee.status !== "ACTIVE" || !isEmployeeAssignedToServiceOrder(order, id))
      throw new FieldError("O responsável precisa estar ativo e integrar a equipe da obra.");
  }
  return ids;
}
function activeItem(orderId: string, id: string | null) {
  const item = db.serviceOrderChecklistItems.find((entry) => entry.id === id && entry.serviceOrderId === orderId);
  if (!item || ["DONE", "CANCELED"].includes(item.status)) throw new FieldError("Item do checklist não encontrado ou já encerrado.");
  return item;
}
function updateStockStatus(stock: Material) {
  if (!["DAMAGED", "IN_MAINTENANCE", "UNAVAILABLE"].includes(stock.status || "")) {
    stock.status = stock.currentStock <= 0 ? "OUT_OF_STOCK" : stock.currentStock <= stock.minStock ? "LOW_STOCK" : "AVAILABLE";
  }
}
function auditStock(user: SessionUser, type: string, id: string, oldValue: unknown, nextValue: unknown, orderId?: string) {
  recordAuditLog({ userId: user.id, action: "FIELD_" + type, entity: "Inventory", entityId: id,
    oldValueJson: oldValue, newValueJson: nextValue, metadata: { orderId } });
}
function baseAllocation(orderId: string, materialId: string, quantity: number, source: string): ServiceOrderMaterial {
  const now = new Date().toISOString();
  return {
    id: "som-field-" + randomUUID(), serviceOrderId: orderId, materialId, plannedQuantity: quantity,
    separatedQuantity: 0, deliveredQuantity: 0, returnedQuantity: 0, consumedQuantity: 0,
    damagedQuantity: 0, lostQuantity: 0, status: "PENDING_SEPARATION", notes: "Entrega pelo Assistente de Campo",
    sourceMessageId: source, createdAt: now, updatedAt: now,
  };
}
function stockAllocation(orderId: string, materialId: string) {
  const found = db.serviceOrderMaterials.filter((item) =>
    item.serviceOrderId === orderId && item.materialId === materialId &&
    ["DELIVERED_TO_TEAM", "PARTIALLY_RETURNED"].includes(item.status) &&
    item.deliveredQuantity > rounded(item.returnedQuantity + item.consumedQuantity + item.damagedQuantity + item.lostQuantity));
  if (found.length !== 1) throw new FieldError(found.length
    ? "Há várias entregas abertas desse produto. Especifique o lote pelo checklist do estoque."
    : "Não há entrega aberta desse produto para registrar retorno, consumo ou perda.");
  return found[0];
}
function checkedStockMovement(user: SessionUser, stock: Material, link: ServiceOrderMaterial, patch: Parameters<typeof applyMaterialMovement>[2]) {
  const stockCopy = { ...stock };
  const linkCopy = { ...link };
  try { applyMaterialMovement(stockCopy, linkCopy, patch, user.id); }
  catch (error) { throw new FieldError(error instanceof InventoryError ? error.message : "Não foi possível validar o movimento."); }
  const oldValue = { stock: { ...stock }, movement: { ...link } };
  Object.assign(stock, stockCopy);
  Object.assign(link, linkCopy);
  auditStock(user, "STOCK_MOVEMENT", link.id, oldValue, { stock: stockCopy, movement: linkCopy }, link.serviceOrderId);
  return link;
}
export function fieldSpeechContext(user: SessionUser, orderId: string) {
  authorizeFieldContext(user, orderId);
  const current = ["warehouse", "office"].includes(orderId) ? null : db.serviceOrders.find((o) => o.id === orderId)!;
  const team = (["OWNER", "GERENTE"].includes(user.role) ? db.employees : current ? db.employees.filter((e) => e.status === "ACTIVE" && isEmployeeAssignedToServiceOrder(current, e.id)) : [])
    .map(({ id, name }) => ({ id, name }));
  const checklist = current ? db.serviceOrderChecklistItems.filter((i) => i.serviceOrderId === current.id && !["DONE", "CANCELED"].includes(i.status))
    .slice(-100).map((i) => ({ id: i.id, title: i.title, status: i.status, assignedEmployeeIds: i.assignedEmployeeIds || [] })) : [];
  const materials = stockAllowed(user) || canRequestServiceMaterials(user.role) ? db.materials
    .filter((m) => !isArchivedStockItem(m)).slice(0, 350).map((m) => ({ id: m.id, name: m.name, unit: m.unit, available: m.currentStock })) : [];
  const equipment = stockAllowed(user) ? db.equipment.filter((e) => !isArchivedStockItem(e)).slice(0, 180)
    .map((e) => ({ id: e.id, name: e.name, code: e.code, status: e.status })) : [];
  const receipts = db.fieldReceipts.filter((item) => item.uploadedByUserId === user.id && item.status === "PENDING_REVIEW" && (item.serviceOrderId || "office") === (current?.id || "office")).slice(-8).map(({ id, description, createdAt }) => ({ id, description, createdAt }));
  const inventoryOrders = stockAllowed(user) ? db.serviceOrders.filter((o) => isOpenServiceOrderForTeam(o.status))
    .filter((o) => { try { authorizeServiceOrderAccess(user, o.id, "materials"); return true; } catch { return false; } })
    .map((o) => ({ id: o.id, title: o.title, supervisor: o.supervisorEmployeeId })) : [];
  const financialReceipts = pendingFinancialReceipts(user, orderId).map(r => ({ id: r.id, description: r.description, fileName: r.attachment.fileName, amount: r.digital?.amount, merchant: r.digital?.merchant, direction: r.digital?.direction }));
  const last = [...(orderId === "office" ? db.officeJournal : db.workHistory)].reverse().find(e => e.serviceOrderId === orderId && e.userId === user.id && !e.recordingSessionId);
  const confirmationReceiptId = last?.title === "Consulta financeira" && financialReceipts.length === 1 && last.content.includes("protocolo " + financialReceipts[0].id) && Date.parse(db.fieldReceipts.find(r => r.id === financialReceipts[0].id)!.updatedAt) <= Date.parse(last.createdAt) && Date.now() - Date.parse(last.createdAt) < 15 * 60_000 ? financialReceipts[0].id : null;
  return {
    canSettleReceipts: canViewServiceOrderFinancials(user), financialReceipts, confirmationReceiptId,
    authorizedOrders: fieldAssignment(user).orders.map(({ id, title }) => ({ id, title })),
    role: user.role, currentOrder: current ? { id: current.id, title: current.title, status: current.status } : null,
    warehouseMode: orderId === "warehouse", employees: team, checklist, materials, equipment, inventoryOrders, receipts,
    today: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
  };
}


function executeFieldOperation(user: SessionUser, currentOrder: string, action: FieldAction, source: string): Outcome {
  if (action.action === "DIARY") return { message: "Relato salvo no diário." };
  if (action.action === "CLARIFY" || action.confidence !== "HIGH")
    throw new FieldError(action.question.trim() || "Dê mais detalhes para executar a ação com segurança.");
  if (action.action === "LIST_FINANCIAL_RECEIPTS" || action.action === "SETTLE_RECEIPT") {
    if (!canViewServiceOrderFinancials(user)) throw new FieldError("Sem permissao financeira.");
    const pending = pendingFinancialReceipts(user, currentOrder);
    if (action.action === "LIST_FINANCIAL_RECEIPTS") {
      return { message: pending.length ? pending.slice(0, 20).map(r => r.attachment.fileName + " | " + r.description + " | " + (r.digital?.amount ? "R$ " + r.digital.amount.toFixed(2) : "valor a revisar") + " | " + (r.digital?.direction || "UNKNOWN") + " | protocolo " + r.id).join("\n") + (pending.length === 1 ? "\nPara autorizar esta baixa, diga confirmo." : "\nIdentifique o comprovante para autorizar a baixa.") : "Nenhum comprovante pendente." };
    }
    const receipt = pending.find(r => r.id === action.receiptId);
    if (!receipt) throw new FieldError("Identifique o comprovante pendente desta conversa antes de dar baixa.");
    settleFieldReceipt(user, receipt.id);
    return { message: "Baixa financeira registrada. Protocolo " + receipt.id, entityId: receipt.id };
  }
  if (action.action === "SET_THEME") {
    if (!action.uiTheme) throw new FieldError("Informe se deseja o tema claro ou escuro.");
    return { message: "Tema visual alterado para " + (action.uiTheme === "light" ? "claro" : "escuro") + ".",
      ui: { kind: "THEME", value: action.uiTheme } };
  }
  if (action.action === "SWITCH_ORDER") {
    const allowed = fieldAssignment(user).orders.find((order) => order.id === action.targetOrderId);
    if (!allowed) throw new FieldError("Esta obra não pertence às opções disponíveis da sua conta.");
    return { message: "Conversa alterada para " + allowed.title + ".",
      ui: { kind: "ORDER", value: allowed.id } };
  }
  if (action.action === "REQUEST_REPORT") {
    if (["office", "warehouse"].includes(currentOrder)) throw new FieldError("Selecione uma obra para gerar relatório.");
    authorizeServiceOrderAccess(user, currentOrder, "history");
    return { message: "Iniciando relatório da obra atual.",
      ui: { kind: "REPORT", value: currentOrder } };
  }
  if (["REPORT_ABSENCE", "REPORT_EARLY_LEAVE"].includes(action.action)) {
    if (!["OWNER", "GERENTE", "SUPERVISOR_OBRA", "ALMOXARIFADO"].includes(user.role))
      throw new FieldError("Seu perfil não pode lançar ocorrências de equipe.");
    if (!action.occurredOn || !/^\d{4}-\d{2}-\d{2}$/.test(action.occurredOn) || Number.isNaN(Date.parse(action.occurredOn)) ||
      new Date(action.occurredOn).toISOString().slice(0, 10) !== action.occurredOn)
      throw new FieldError("Informe a data exata da falta ou da saída antecipada.");
    if (!action.employeeIds.length || action.employeeIds.length > 12 || new Set(action.employeeIds).size !== action.employeeIds.length)
      throw new FieldError("Identifique um ou mais colaboradores da equipe sem repetição.");
    if (action.occurredAt && !/^([01]\d|2[0-3]):[0-5]\d$/.test(action.occurredAt))
      throw new FieldError("Horário inválido. Use HH:MM ou omita se não informado.");
    if (Date.parse(action.occurredOn) > Date.now() + 86400000)
      throw new FieldError("Ocorrência não pode acontecer no futuro.");
    const order = ["warehouse", "office"].includes(currentOrder) ? null : requireOpen(currentOrder);
    const workers = action.employeeIds.map((id) => {
      const worker = db.employees.find((e) => e.id === id);
      if (!worker || worker.status === "FIRED") throw new FieldError("Funcionário não encontrado.");
      if (!["OWNER", "GERENTE"].includes(user.role) && (!order || !isEmployeeAssignedToServiceOrder(order, id)))
        throw new FieldError("Somente funcionários vinculados à sua obra podem ser registrados.");
      return worker;
    });
    const type = action.action === "REPORT_ABSENCE" ? "ABSENCE" : "EARLY_LEAVE";
    for (const worker of workers) {
      const record = { id: "attendance-" + randomUUID(), serviceOrderId: order?.id || null,
        employeeId: worker.id, employeeName: worker.name, kind: type as "ABSENCE" | "EARLY_LEAVE",
        occurredOn: action.occurredOn, occurredAt: action.occurredAt || undefined,
        description: action.details.trim().slice(0, 2500), reportedByUserId: user.id,
        reportedByName: user.name, sourceMessageId: source,
        status: "REPORTED" as const, createdAt: new Date().toISOString() };
      db.staffAttendanceReports.push(record);
      recordAuditLog({ userId: user.id, action: "FIELD_ATTENDANCE_REPORTED", entity: "StaffAttendance", entityId: record.id, newValueJson: record });
    }
    return { message: (type === "ABSENCE" ? "Falta informada" : "Saída antecipada informada") + " para " +
      workers.map((e) => e.name).join(", ") + " em " + action.occurredOn +
      (action.occurredAt ? " às " + action.occurredAt : "") + ". Registro pendente de conferência, sem desconto ou advertência automática." };
  }
  if (action.action === "DESCRIBE_RECEIPT") {
    const candidates = db.fieldReceipts.filter((item) => item.uploadedByUserId === user.id &&
      item.status === "PENDING_REVIEW" && (item.serviceOrderId || "office") === (currentOrder === "warehouse" ? "office" : currentOrder));
    const receipt = action.receiptId
      ? candidates.find((item) => item.id === action.receiptId)
      : candidates.length === 1 ? candidates[0] : null;
    if (!receipt || !action.details.trim())
      throw new FieldError("Há vários comprovantes ou nenhum pendente. Diga qual documento e sua descrição.");
    const old = { description: receipt.description };
    receipt.description = [receipt.description, action.details.trim()].filter(Boolean).join("\n").slice(0, 2400);
    receipt.updatedAt = new Date().toISOString();
    const linked = db.financialDocuments.find((item) => item.id === receipt.id);
    if (linked) linked.description = receipt.description;
    recordAuditLog({ userId: user.id, action: "FIELD_RECEIPT_DESCRIBED", entity: "FieldReceipt", entityId: receipt.id, oldValueJson: old, newValueJson: { description: receipt.description } });
    return { message: "Descrição anexada ao comprovante do financeiro. Aguardando conferência.", entityId: receipt.id };
  }
  const home = ["warehouse", "office"].includes(currentOrder) ? null : requireOpen(currentOrder);
  const title = action.title.trim();
  const description = action.details.trim();
  if (["CREATE_CHECKLIST", "ASSIGN_CHECKLIST", "START_CHECKLIST", "COMPLETE_CHECKLIST", "BLOCK_CHECKLIST"].includes(action.action)) {
    if (!operational(user.role) || !home) throw new FieldError("Somente colaboradores autorizados podem alterar checklist de sua obra ativa.");
    authorizeServiceOrderAccess(user, home.id, "checklist");
    if (user.role === "ALMOXARIFADO" && !isEmployeeAssignedToServiceOrder(home, getLinkedEmployeeId(user)))
      throw new FieldError("Almoxarife sem escala nessa obra.");
    if (action.action === "CREATE_CHECKLIST") {
      if (title.length < 3 || title.length > 180) throw new FieldError("Diga o nome completo do novo item.");
      teamMembers(home, action.employeeIds);
      if (db.serviceOrderChecklistItems.some((item) => item.serviceOrderId === home.id
        && !["DONE", "CANCELED"].includes(item.status) && comparable(item.title) === comparable(title)))
        throw new FieldError("Já existe um item ativo com esse título. Diga se deseja atribuir colaboradores ao item existente.");
      const created = createChecklistItem(home.id, {
        title, description, assignedEmployeeIds: action.employeeIds, allowCollaboratorAction: true,
        origin: "FIELD_ASSISTANT", sourceMessageId: source, isRequired: true,
      }, user);
      if (!created.item) throw new FieldError("Não foi possível criar o item do checklist.");
      const names = action.employeeIds.map((id) => db.employees.find((e) => e.id === id)?.name || id);
      return { message: "Item extra criado no checklist: " + title + " (" + created.item.id + "). Criado por " + user.name +
        ". Responsáveis: " + (names.join(", ") || "a definir") + ".", entityId: created.item.id };
    }
    const item = activeItem(home.id, action.checklistItemId);
    if (action.action === "ASSIGN_CHECKLIST") {
      teamMembers(home, action.employeeIds, false);
      const assigned = [...new Set([...(item.assignedEmployeeIds || (item.assignedEmployeeId ? [item.assignedEmployeeId] : [])), ...action.employeeIds])];
      teamMembers(home, assigned, false);
      const assignedResult = assignChecklistItem(home.id, item.id, assigned, user);
      if (!assignedResult.item) throw new FieldError("Não foi possível atribuir o item.");
      return { message: "Responsáveis de " + item.title + ": " + assigned.map((id) => db.employees.find((e) => e.id === id)?.name || id).join(", ") + ".", entityId: item.id };
    }
    if (action.action === "START_CHECKLIST") {
      const started = startChecklistItem(home.id, item.id, user);
      if (!started.item) throw new FieldError("Não foi possível iniciar o item. Verifique o status atual.");
      return { message: "Item iniciado: " + item.title + ".", entityId: item.id };
    }
    if (action.action === "BLOCK_CHECKLIST") {
      if (!description || ["DONE", "CANCELED", "BLOCKED"].includes(item.status)) throw new FieldError("Informe motivo e um item ainda aberto para registrar o bloqueio.");
      const blocked = blockChecklistItem(home.id, item.id, description, user);
      if (!blocked.item) throw new FieldError("Não foi possível bloquear o item.");
      return { message: "Item bloqueado: " + item.title + ". Motivo: " + description, entityId: item.id };
    }
    if (action.action === "COMPLETE_CHECKLIST") {
      const ids = action.employeeIds.length ? action.employeeIds : item.assignedEmployeeIds || (item.assignedEmployeeId ? [item.assignedEmployeeId] : []);
      if (!ids.length || (!action.employeeIds.length && ids.length > 1))
        throw new FieldError("Informe quais colaboradores concluíram este item.");
      teamMembers(home, ids, false);
      const completed = completeChecklistItem({
        serviceOrderId: home.id, itemId: item.id, completedByEmployeeId: ids[0],
        completedByEmployeeIds: ids, completedByUserId: user.id, actor: user, completionNotes: description || "Concluído conforme relato do responsável.",
      });
      if (!completed.item) throw new FieldError(completed.error === "PHOTO_REQUIRED"
        ? "Este item exige foto de comprovação antes da conclusão."
        : "Não foi possível concluir o item. Confira status e responsáveis.");
      return { message: "Item concluído: " + item.title + ". Por: " + ids.map((id) => db.employees.find((e) => e.id === id)?.name || id).join(", ") + ".", entityId: item.id };
    }
  }
  if (action.action === "REQUEST_MATERIAL") {
    if (!home || !canRequestServiceMaterials(user.role)) throw new FieldError("Seu perfil não pode solicitar materiais dessa obra.");
    authorizeServiceOrderAccess(user, home.id, "materials");
    const material = activeMaterial(action.materialId); const qty = amount(action);
    if (action.unit && comparable(action.unit) !== comparable(material.unit)) throw new FieldError("Unidade de medida diferente da unidade cadastrada no estoque.");
    const now = new Date().toISOString(); const id = "req-field-" + randomUUID();
    db.materialRequests.push({ id, serviceOrderId: home.id, requestedByUserId: user.id,
      status: "PENDING", priority: "NORMAL", reason: description || "Solicitação pelo Assistente de Campo", createdAt: now, updatedAt: now });
    db.materialRequestItems.push({ id: "req-item-" + randomUUID(), requestId: id, materialId: material.id, quantity: qty, notes: description });
    recordAuditLog({ userId: user.id, action: "FIELD_REQUEST_MATERIAL", entity: "ServiceMaterialRequest", entityId: id,
      newValueJson: { serviceOrderId: home.id, materialId: material.id, quantity: qty, unit: material.unit } });
    return { message: "Solicitação ao almoxarifado criada: " + qty + " " + material.unit + " de " + material.name + ".", entityId: id };
  }
  if (["STOCK_NEW", "STOCK_RECEIVE"].includes(action.action)) {
    if (!stockAllowed(user)) throw new FieldError("Sem acesso à gestão de estoque.");
    const qty = amount(action);
    if (action.action === "STOCK_NEW") {
      if (action.materialName.trim().length < 3 || action.unit.trim().length < 1)
        throw new FieldError("Novo produto exige nome, quantidade e unidade (unidade, litro, kg etc.).");
      if (db.materials.some((m) => !isArchivedStockItem(m) && comparable(m.name) === comparable(action.materialName)))
        throw new FieldError("Este produto já existe. Peça entrada de quantidade no produto cadastrado, não duplicação.");
      const material: Material = {
        id: "mat-field-" + randomUUID(), name: action.materialName.trim(), unit: action.unit.trim(),
        currentStock: qty, minStock: 0, unitCost: 0, status: "AVAILABLE",
      };
      db.materials.unshift(material);
      auditStock(user, "STOCK_NEW", material.id, null, material);
      return { message: "Produto criado no estoque: " + material.name + ", " + qty + " " + material.unit + ". Preço não informado.", entityId: material.id, stockChange: true };
    }
    const stock = activeMaterial(action.materialId);
    if (action.unit && comparable(action.unit) !== comparable(stock.unit)) throw new FieldError("Unidade incompatível com o cadastro de " + stock.name + ".");
    const old = { ...stock };
    stock.currentStock = rounded(stock.currentStock + qty);
    updateStockStatus(stock);
    auditStock(user, "STOCK_RECEIVE", stock.id, old, { ...stock, quantityReceived: qty });
    return { message: "Entrada de estoque: +" + qty + " " + stock.unit + " de " + stock.name + ". Disponível: " + stock.currentStock + ".", entityId: stock.id, stockChange: true };
  }
  if (["STOCK_DISPATCH", "STOCK_RETURN", "STOCK_CONSUME", "STOCK_DAMAGE", "STOCK_LOSS"].includes(action.action)) {
    const order = orderForStock(user, currentOrder, action.targetOrderId);
    const stock = activeMaterial(action.materialId); const qty = amount(action);
    if (action.unit && comparable(action.unit) !== comparable(stock.unit)) throw new FieldError("Unidade de quantidade incompatível com o produto cadastrado.");
    if (action.action === "STOCK_DISPATCH") {
      teamMembers(order, action.employeeIds);
      const stockCopy = { ...stock };
      const link = baseAllocation(order.id, stock.id, qty, source);
      link.receivedByEmployeeIds = [...action.employeeIds];
      try {
        applyMaterialMovement(stockCopy, link, { status: "RESERVED", separatedQuantity: qty }, user.id);
        applyMaterialMovement(stockCopy, link, { status: "DELIVERED_TO_TEAM", deliveredQuantity: qty }, user.id);
      } catch (e) { throw new FieldError(e instanceof InventoryError ? e.message : "Entrega inválida."); }
      const old = { ...stock };
      Object.assign(stock, stockCopy); db.serviceOrderMaterials.push(link);
      auditStock(user, "STOCK_DISPATCH", link.id, { stock: old }, { stock: stockCopy, allocation: link }, order.id);
      return { message: "Entregue " + qty + " " + stock.unit + " de " + stock.name + " para " + order.title +
        (action.employeeIds.length ? ", recebido por " + action.employeeIds.map((id) => db.employees.find((e) => e.id === id)?.name).join(", ") : "") + ".", entityId: link.id, stockChange: true, targetOrderId: order.id };
    }
    const link = stockAllocation(order.id, stock.id);
    const outstanding = rounded(link.deliveredQuantity - link.returnedQuantity - link.consumedQuantity - link.damagedQuantity - link.lostQuantity);
    if (qty > outstanding) throw new FieldError("A quantidade excede o saldo entregue à obra (" + outstanding + " " + stock.unit + ").");
    const kind = action.action === "STOCK_RETURN" ? "returnedQuantity" : action.action === "STOCK_CONSUME" ? "consumedQuantity" : action.action === "STOCK_DAMAGE" ? "damagedQuantity" : "lostQuantity";
    const nextValue = rounded(link[kind] + qty);
    const fullyAccounted = qty === outstanding && link.separatedQuantity === link.deliveredQuantity;
    const finalStatus = action.action === "STOCK_RETURN" ? (fullyAccounted ? "RETURNED" : "PARTIALLY_RETURNED")
      : fullyAccounted ? (action.action === "STOCK_CONSUME" ? "CONSUMED" : action.action === "STOCK_DAMAGE" ? "DAMAGED" : "LOST") : link.status;
    checkedStockMovement(user, stock, link, { status: finalStatus, [kind]: nextValue });
    const names = { STOCK_RETURN: "Devolução", STOCK_CONSUME: "Consumo", STOCK_DAMAGE: "Material danificado", STOCK_LOSS: "Material perdido" };
    return { message: names[action.action as keyof typeof names] + ": " + qty + " " + stock.unit + " de " + stock.name + " na obra " + order.title +
      ". Saldo ainda em campo: " + rounded(outstanding - qty) + ".", entityId: link.id, stockChange: true, targetOrderId: order.id };
  }

  if (["EQUIPMENT_DISPATCH", "EQUIPMENT_RETURN", "EQUIPMENT_DAMAGE"].includes(action.action)) {
    const order = orderForStock(user, currentOrder, action.targetOrderId);
    const eq = db.equipment.find((e) => e.id === action.equipmentId);
    if (!eq || isArchivedStockItem(eq)) throw new FieldError("Equipamento ativo não identificado. Informe o código da máquina.");
    const eqCopy = { ...eq };
    const links = db.serviceOrderEquipment.map((record) => ({ ...record }));
    const now = new Date().toISOString();
    let link: ServiceOrderEquipment;
    if (action.action === "EQUIPMENT_DISPATCH") {
      if (links.some((record) => record.equipmentId === eq.id && !["RETURNED", "DAMAGED", "LOST", "CANCELED"].includes(record.status)))
        throw new FieldError("Máquina já está vinculada a uma movimentação ativa. Verifique antes de entregar novamente.");
      link = { id: "soe-field-" + randomUUID(), serviceOrderId: order.id, equipmentId: eq.id,
        status: "REQUESTED", reservedAt: now, conditionBefore: description || "Não informado",
        notes: "Registro pelo Assistente de Campo", createdAt: now, updatedAt: now };
      links.push(link);
      try {
        applyEquipmentMovement(eqCopy, link, { status: "RESERVED" }, links, user.id);
        applyEquipmentMovement(eqCopy, link, { status: "DELIVERED" }, links, user.id);
      } catch (error) { throw new FieldError(error instanceof InventoryError ? error.message : "Movimento de equipamento inválido."); }
      db.serviceOrderEquipment.push(link);
    } else {
      const candidates = links.filter((candidate) => candidate.serviceOrderId === order.id &&
        candidate.equipmentId === eq.id && ["DELIVERED", "IN_USE"].includes(candidate.status));
      if (candidates.length !== 1) throw new FieldError("Nenhuma entrega única em aberto desse equipamento nessa obra.");
      link = candidates[0];
      try {
        applyEquipmentMovement(eqCopy, link, {
          status: action.action === "EQUIPMENT_DAMAGE" ? "DAMAGED" : "RETURNED",
          conditionAfter: description || "Não informado",
        }, links, user.id);
      } catch (error) { throw new FieldError(error instanceof InventoryError ? error.message : "Não foi possível registrar o retorno."); }
      Object.assign(db.serviceOrderEquipment.find((e) => e.id === link.id)!, link);
    }
    const old = { ...eq }; Object.assign(eq, eqCopy);
    auditStock(user, "EQUIPMENT_MOVEMENT", link.id, { equipment: old },
      { equipment: eqCopy, link }, order.id);
    const actionText = action.action === "EQUIPMENT_DISPATCH" ? "Entregue" : action.action === "EQUIPMENT_DAMAGE" ? "Dano registrado" : "Devolvido";
    return { message: actionText + ": " + eq.name + " (" + eq.code + ") na " + order.title + ".",
      entityId: link.id, stockChange: true, targetOrderId: order.id };
  }
  throw new FieldError("Comando não suportado. O relato será arquivado sem alterar registros.");
}

export type FieldStatementResult = {
  entry: WorkHistoryEntry;
  operation: { status: "executed" | "diary" | "pending"; message: string; entityId?: string; ui?: UiDirective };
};

/** Called inside withDatabase's durable transaction; writes are atomic with the diary entry. */
export async function processFieldStatement(input: {
  user: SessionUser; orderId: string; nonce: string; text: string;
  attachment?: AssistantAttachment;
  modelOverride?: FieldAction; summaryOnly?: boolean;
}): Promise<FieldStatementResult> {
  const { user, orderId, nonce, text, attachment } = input;
  fieldActor(user);
  authorizeFieldContext(user, orderId);
  if (!/^[a-zA-Z0-9_-]{12,100}$/.test(nonce) || !text.trim() || text.length > 12000)
    throw new FieldError("Relato vazio, longo demais ou com identificador inválido.");
  const source = "campo:" + user.id + ":" + nonce;
  const anyEntry = [...db.workHistory, ...db.warehouseJournal, ...db.officeJournal].find((e) => e.messageId === source);
  if (anyEntry) {
    if (anyEntry.serviceOrderId !== orderId) throw new FieldError("Este envio já pertence a outra obra.");
    return { entry: anyEntry, operation: { status: "diary", message: "Este relato já estava salvo. Nenhuma ação duplicada." } };
  }
  const context = fieldSpeechContext(user, orderId);
  let action = diaryAction();
  let advisory = "";
  try {
    action = fieldActionSchema.parse(input.modelOverride ?? await interpretFieldCommand(text, context));
  } catch {
    advisory = "IA indisponível para interpretar ações. O relato foi registrado, sem alteração no checklist ou estoque.";
  }
  if (action.action === "SETTLE_RECEIPT" && /^(confirmo|confirmado|sim|ok|pode|autorizo|aprovado|aprovo)[.! ]*$/i.test(text.trim()) && context.confirmationReceiptId !== action.receiptId) {
    action = { ...diaryAction(), action: "CLARIFY", question: "Consulte os comprovantes pendentes primeiro e confirme o documento apresentado." };
  }
  // Changes to the authenticated account while the model worked must invalidate execution.
  const currentUser = db.users.find((record) => record.id === user.id);
  if (!currentUser || !currentUser.isActive || currentUser.mustChangePassword ||
    currentUser.role !== user.role || (currentUser.sessionVersion ?? 0) !== (user.sessionVersion ?? 0))
    throw new FieldError("Sua sessão ou permissão mudou. Entre novamente antes de registrar.");
  authorizeFieldContext(currentUser, orderId);
  let outcome: Outcome = { message: "Relato registrado no diário." };
  let status: "executed" | "diary" | "pending" = "diary";
  if (advisory) {
    outcome.message = advisory;
    status = "pending";
  } else if (action.action === "CLARIFY" || action.confidence === "LOW") {
    outcome.message = action.question.trim() || "Informe melhor obra, funcionário, produto, quantidade ou item para executar esta solicitação.";
    status = "pending";
  } else if (action.action !== "DIARY") {
    try {
      outcome = executeFieldOperation(currentUser, orderId, action, source);
      status = "executed";
    } catch (error) {
      outcome = { message: error instanceof FieldError ? error.message : "Não foi possível executar o comando. Confirme os dados." };
      status = "pending";
    }
  }
  const financialAction = ["LIST_FINANCIAL_RECEIPTS", "SETTLE_RECEIPT"].includes(action.action) && canViewServiceOrderFinancials(currentUser);
  const summary = status === "executed" ? "Ação executada: " + outcome.message
    : status === "pending" ? "Pendente, sem alteração automática: " + outcome.message
    : "Registrado sem ação automática.";
  const content = input.summaryOnly ? summary + "\n\nTranscrição completa disponível nos trechos de áudio desta gravação."
    : "Relato: " + text.slice(0, 8500).trim() + "\n\n" + summary;
  const entry = appendFieldEntry({
    user: currentUser, orderId, nonce,
    title: financialAction ? (action.action === "LIST_FINANCIAL_RECEIPTS" ? "Consulta financeira" : "Baixa financeira") : status === "executed" ? "Registro e operação de campo" : status === "pending" ? "Relato pendente de esclarecimento" : "Relato de campo",
    content, transcript: input.summaryOnly ? "" : text, attachment,
  });
  if (financialAction) entry.kind = "FINANCIAL";
  if (status === "executed" && outcome.stockChange) {
    // The shared journal contains only validated movement details, not unrelated voice content.
    const safeMovement = { ...entry, transcript: "", attachment: undefined, content: outcome.message };
    if (orderId !== "warehouse") {
      db.warehouseJournal.push({ ...safeMovement, id: randomUUID(), serviceOrderId: "warehouse",
        messageId: source + ":almoxarifado", title: "Movimentação do almoxarifado" });
    }
    if (outcome.targetOrderId && outcome.targetOrderId !== orderId) {
      db.workHistory.push({ ...safeMovement, id: randomUUID(), serviceOrderId: outcome.targetOrderId,
        messageId: source + ":destino:" + outcome.targetOrderId, title: "Movimento de material/equipamento na obra" });
    }
  }
  return { entry, operation: { status, message: outcome.message, entityId: outcome.entityId, ui: outcome.ui } };
}
