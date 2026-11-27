import "server-only";
import { db, getLinkedEmployeeId } from "./store";
import { canAccessAllServiceOrders, canManageStock, canViewCompanyFeedbacks, canViewInspections, canViewLeads, canViewQuotes, canViewServiceOrderFinancials } from "./permissions";
import { fieldNotices, noticeId } from "./field-notifications";
import { paymentReceived } from "./finance-operations";
import { canReadCommercial } from "./commercial-permissions";
import type { SessionUser } from "./types";

export type NotificationKind = "LEAD" | "CHECKLIST" | "OPERATION" | "STOCK" | "FINANCE" | "COMMERCIAL" | "PEOPLE" | "AGENDA";
export type SystemNotice = { id: string; title: string; body: string; href: string; kind: NotificationKind; createdAt?: string; urgent?: boolean; field?: boolean };
export type SystemNoticeRead = { id: string; userId: string; at: string };
const day = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const dateKey = (value?: string) => !value ? "" : /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : Number.isFinite(Date.parse(value)) ? day(new Date(value)) : "";
const path = (id: string) => encodeURIComponent(id);
export function systemNotices(user: SessionUser, now = new Date()) {
  if (!user.isActive || user.mustChangePassword) return { newLeads: 0, notices: [] as SystemNotice[] };
  const today = day(now), timestamp = now.getTime(), recent = (value?: string) => !!value && Date.parse(value) <= timestamp && Date.parse(value) >= timestamp - 30 * 86400000;
  const management = canAccessAllServiceOrders(user.role), commercial = canViewLeads(user.role), financial = canViewServiceOrderFinancials(user), stock = canManageStock(user.role);
  const employeeId = getLinkedEmployeeId(user);
  const rows = new Map<string, SystemNotice>();
  const add = (kind: NotificationKind, key: string[], title: string, body: string, href: string, createdAt?: string, urgent = false) => {
    const id = noticeId("system", ...key);
    rows.set(id, { id, kind, title, body, href, createdAt, urgent });
  };
  const orders = new Map(db.serviceOrders.map(o => [o.id, o]));
  const assigned = (id: string) => {
    const o = orders.get(id);
    if (!o) return false;
    if (management) return true;
    if (user.role === "SUPERVISOR_OBRA") return o.supervisorUserId === user.id || (!!employeeId && o.supervisorEmployeeId === employeeId);
    return user.role === "COLABORADOR" && !!employeeId && ((o.employeeIds ?? []).includes(employeeId) || db.serviceOrderEmployees.some(e => e.serviceOrderId === id && e.employeeId === employeeId));
  };
  const open = (id: string) => { const o = orders.get(id); return !!o && !["DONE","DELIVERED","CANCELED"].includes(o.status); };
  const osLink = (id: string) => "/ordens-servico/" + path(id);
  const checklistLink = (id: string) => osLink(id) + "/checklist";
  const leadAudit = new Map<string, string>();
  if (commercial) for (const log of db.auditLogs) if (log.entityId && (log.action === "PUBLIC_QUOTE_REQUEST" || (log.action === "CREATE_COMMERCIAL_RECORD" && log.entity === "leads"))) {
    const old = leadAudit.get(log.entityId); if (!old || log.createdAt < old) leadAudit.set(log.entityId, log.createdAt);
  }
  if (commercial) for (const lead of db.leads) {
    const at = leadAudit.get(lead.id);
    if (lead.status === "NEW" || recent(at)) add("LEAD", ["lead",lead.id], "Novo lead", lead.name + " • " + (lead.source || "Cadastro comercial"), "/leads/" + path(lead.id), at);
    const due = dateKey(lead.nextFollowUpAt);
    if (!["NEW","WON","LOST"].includes(lead.status) && due && due <= today) add("COMMERCIAL", ["follow-up",lead.id,lead.nextFollowUpAt], "Retorno comercial pendente", lead.name, "/leads/" + path(lead.id), lead.nextFollowUpAt, due < today);
  }
  if (canViewQuotes(user.role)) for (const q of db.quotes) {
    if (q.status === "APPROVED" && recent(q.approvedAt)) add("COMMERCIAL", ["quote-approved",q.id], "Orçamento aprovado", q.customerName, "/orcamentos/" + path(q.id), q.approvedAt);
    const due = dateKey(q.validUntil);
    if (q.status === "SENT" && due && due <= today) add("COMMERCIAL", ["quote-expired",q.id,q.validUntil], "Orçamento precisa de retorno", q.customerName, "/orcamentos/" + path(q.id), q.validUntil, due < today);
  }
  if (canReadCommercial("garantias",user.role)) for (const w of db.warranties) if (w.status === "CLAIM_OPEN") add("OPERATION", ["warranty",w.id,w.updatedAt], "Chamado de garantia aberto", w.title, "/garantias/" + path(w.id), w.updatedAt, true);
  const items = new Map(db.serviceOrderChecklistItems.map(i => [i.id,i]));
  for (const e of db.serviceOrderChecklistEvents) {
    if (!recent(e.createdAt) || e.userId === user.id || !assigned(e.serviceOrderId)) continue;
    const item = items.get(e.checklistItemId), order = orders.get(e.serviceOrderId);
    if (!item || item.serviceOrderId !== e.serviceOrderId || !order) continue;
    if (user.role === "COLABORADOR" && (!employeeId || !(item.assignedEmployeeIds ?? []).includes(employeeId) && item.assignedEmployeeId !== employeeId)) continue;
    // Supervisors receive the same created-item identifier as the existing field notification panel.
    if (user.role === "SUPERVISOR_OBRA" && e.type === "CREATED") {
      const id = noticeId(user.id,e.id,"new-checklist-item");
      rows.set(id,{id, kind:"CHECKLIST", title:"Novo item no checklist", body:order.title+" • "+item.title, href:checklistLink(order.id), createdAt:e.createdAt, field:true});
      continue;
    }
    if (user.role === "SUPERVISOR_OBRA" && ["BLOCKED","COMPLETED"].includes(e.type)) continue;
    const titles: Record<string,string> = { CREATED:"Novo item no checklist", ASSIGNED:"Responsabilidade no checklist atualizada", BLOCKED:"Item do checklist bloqueado", REOPENED:"Item do checklist reaberto", COMPLETED:"Item concluído" };
    if (titles[e.type]) add("CHECKLIST",["checklist-event",e.id],titles[e.type],order.title+" • "+item.title,checklistLink(order.id),e.createdAt,e.type==="BLOCKED");
  }
  for (const o of db.serviceOrders) {
    if (!assigned(o.id)) continue;
    if (user.role === "SUPERVISOR_OBRA" && recent(o.supervisorAssignedAt) && o.assignedSupervisorByUserId !== user.id) add("OPERATION",["supervisor-assigned",o.id,o.supervisorAssignedAt!],"Nova obra atribuída",o.title,osLink(o.id),o.supervisorAssignedAt);
    if (management && recent(o.clientDeliverySignedAt)) add("OPERATION",["delivery",o.id,o.clientDeliverySignedAt!],"Entrega confirmada pelo cliente",o.title,osLink(o.id),o.clientDeliverySignedAt);
    if (open(o.id) && dateKey(o.scheduledStart)===today) add("AGENDA",["order-today",o.id,o.scheduledStart],"Obra programada para hoje",o.title,osLink(o.id),o.scheduledStart);
    if (open(o.id) && dateKey(o.scheduledEnd) && dateKey(o.scheduledEnd)<today) add("OPERATION",["overdue-order",o.id,o.scheduledEnd],"Obra com prazo vencido",o.title,osLink(o.id),o.scheduledEnd,true);
  }
  if (management) for (const item of db.serviceOrderChecklistItems) {
    if (!open(item.serviceOrderId)) continue;
    const o = orders.get(item.serviceOrderId)!;
    if (item.status === "DONE" && !item.validatedAt && !item.validatedByUserId && item.completedByUserId && db.users.some(u => u.id===item.completedByUserId && u.role==="COLABORADOR")) add("CHECKLIST",["await-validation",item.id,item.completedAt || item.updatedAt],"Item aguardando validação",o.title+" • "+item.title,checklistLink(o.id),item.completedAt || item.updatedAt);
  }
  for (const r of db.materialRequests) {
    if (stock && ["PENDING","APPROVED"].includes(r.status) && open(r.serviceOrderId)) add("STOCK",["material-request",r.id,r.status],"Solicitação de materiais pendente",orders.get(r.serviceOrderId)?.title || "Ordem de serviço","/almoxarifado",r.updatedAt || r.createdAt,r.priority==="URGENT");
    if (user.role==="SUPERVISOR_OBRA" && assigned(r.serviceOrderId) && ["REJECTED","SEPARATED","DELIVERED"].includes(r.status) && recent(r.updatedAt)) add("STOCK",["material-update",r.id,r.status,r.updatedAt],"Solicitação de materiais atualizada",orders.get(r.serviceOrderId)?.title || "Ordem de serviço",osLink(r.serviceOrderId)+"/materiais",r.updatedAt);
  }
  if (stock) {
    const latestStockChange = new Map<string,string>();
    for(const log of db.auditLogs) if(log.entityId&&["Material","Equipment"].includes(log.entity)&&log.action.startsWith("STOCK_")) { const previous=latestStockChange.get(log.entityId); if(!previous||previous<log.createdAt)latestStockChange.set(log.entityId,log.createdAt); }
    for (const m of db.materials) if (!m.archivedAt && m.currentStock <= m.minStock) add("STOCK",["stock-low",m.id,m.currentStock<=0?"empty":"low",String(m.currentStock),latestStockChange.get(m.id)||""],m.currentStock<=0?"Material sem estoque":"Estoque abaixo do mínimo",m.name,"/materiais",undefined,m.currentStock<=0);
    for (const e of db.equipment) if (!e.archivedAt && ["DAMAGED","IN_MAINTENANCE"].includes(e.status)) add("STOCK",["equipment",e.id,e.status,latestStockChange.get(e.id)||""],"Equipamento indisponível",e.name,"/equipamentos",undefined,e.status==="DAMAGED");
  }
  if (financial) {
    for (const p of db.servicePayments) if (dateKey(p.dueAt) && dateKey(p.dueAt)<today && paymentReceived(p)<p.amount) add("FINANCE",["payment",p.id,p.dueAt],"Parcela em atraso",p.description,"/financeiro",p.dueAt,true);
    for (const r of db.fieldReceipts) if (["PENDING_REVIEW","REVIEWED"].includes(r.status)) {
      const id=noticeId(user.id,r.id,"pending");
      rows.set(id,{id,kind:"FINANCE",title:"Comprovante aguardando conferência",body:"Há um comprovante pendente no financeiro.",href:"/financeiro/comprovantes",createdAt:r.createdAt,field:true});
    }
  }
  if (canViewCompanyFeedbacks(user.role)) for (const f of db.companyFeedbacks) if (f.status==="NEW") add("PEOPLE",["feedback",f.id],"Novo feedback da empresa","Categoria: "+f.category,"/feedback-empresa",f.createdAt,f.category==="SEGURANCA");
  if (management) for (const r of db.staffAttendanceReports) if (recent(r.createdAt)) add("PEOPLE",["attendance",r.id],r.kind==="ABSENCE"?"Falta registrada":"Saída antecipada registrada",r.employeeName,"/colaboradores/"+path(r.employeeId),r.createdAt);
  if (user.role==="OWNER") for (const u of db.users) if (!db.userIdentities.some(r=>r.userId===u.id) && u.isActive) add("PEOPLE",["identity",u.id],"Documentação cadastral pendente",u.name,"/usuarios/"+path(u.id),undefined);
  if (canViewInspections(user.role)) for (const inspection of db.inspections) if (dateKey(inspection.inspectionDate)===today) add("AGENDA",["inspection-today",inspection.id,inspection.inspectionDate],"Vistoria marcada para hoje",inspection.customerName,"/vistorias/"+path(inspection.id),inspection.inspectionDate);
  for (const e of db.scheduleEvents) {
    if (!["SCHEDULED","IN_PROGRESS","DELAYED"].includes(e.status)) continue;
    if (e.status!=="DELAYED"&&((e.type==="SERVICE_ORDER"&&e.serviceOrderId&&assigned(e.serviceOrderId)&&dateKey(orders.get(e.serviceOrderId)?.scheduledStart)===today)||(e.type==="INSPECTION"&&e.inspectionId&&canViewInspections(user.role)&&db.inspections.some(i=>i.id===e.inspectionId&&dateKey(i.inspectionDate)===today)))) continue;
    if (!(management || e.assignedUserId===user.id || (!!employeeId && e.assignedEmployeeId===employeeId) || (!!e.serviceOrderId && assigned(e.serviceOrderId)))) continue;
    if (dateKey(e.startsAt)===today || e.status==="DELAYED") add("AGENDA",["agenda",e.id,e.startsAt,e.status],e.status==="DELAYED"?"Compromisso atrasado":"Compromisso de hoje",e.title,"/agenda",e.startsAt,e.status==="DELAYED");
  }
  if (user.role!=="COLABORADOR") for (const n of fieldNotices(user,now)) if (!rows.has(n.id)) rows.set(n.id,{id:n.id,title:n.title,body:n.body,kind:n.kind==="FINANCE"?"FINANCE":"CHECKLIST",href:n.kind==="FINANCE"?(financial?"/financeiro/comprovantes":"/campo"):checklistLink(n.orderId),createdAt:n.createdAt,urgent:n.kind==="BLOCKED",field:true});
  return {newLeads:commercial?db.leads.filter(l=>l.status==="NEW").length:0,notices:[...rows.values()]};
}
export function notificationFeed(user: SessionUser, now = new Date()) {
  const { newLeads, notices } = systemNotices(user,now);
  const read = new Set([...db.systemNoticeReads,...db.fieldNoticeReads].filter(r=>r.userId===user.id).map(r=>r.id));
  const sorted = notices.map(n=>({...n,read:read.has(n.id)})).sort((a,b)=>Number(a.read)-Number(b.read)||Number(!!b.urgent)-Number(!!a.urgent)||(Date.parse(b.createdAt||"")||0)-(Date.parse(a.createdAt||"")||0)||a.id.localeCompare(b.id));
  return {newLeads, unread:sorted.filter(n=>!n.read).length, total:sorted.length, notices:sorted.slice(0,100)};
}
export function markSystemNotices(user:SessionUser, ids: string[] | "all", now = new Date()) {
  const { notices } = systemNotices(user,now);
  const requested = ids==="all"?null:new Set(ids);
  const read = new Set(db.systemNoticeReads.filter(r=>r.userId===user.id).map(r=>r.id));
  const fieldRead = new Set(db.fieldNoticeReads.filter(r=>r.userId===user.id).map(r=>r.id));
  const at = now.toISOString();
  for (const n of notices) if (!requested || requested.has(n.id)) {
    if (!read.has(n.id)) db.systemNoticeReads.push({id:n.id,userId:user.id,at});
    if (n.field && !fieldRead.has(n.id)) db.fieldNoticeReads.push({id:n.id,userId:user.id,at});
  }
}
