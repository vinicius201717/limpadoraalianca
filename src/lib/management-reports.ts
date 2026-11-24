import "server-only";
import {db} from "./store";
import {canAccessOperationalReports,canViewServiceOrderFinancials} from "./permissions";
import {reportLabels,normalizeReportText,type ReportQuery,type ManagementReport} from "./management-report-query";
import type {SessionUser} from "./types";
const localDay=(value:Date|string)=>{const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"}):"";};
const day=(s?:string)=>s?(/^\d{4}-\d{2}-\d{2}$/.test(s)?s:localDay(s)):"";
const n=(v:number)=>v.toLocaleString("pt-BR",{maximumFractionDigits:3});
const money=(v:number)=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const date=(s:string)=>s?s.split("-").reverse().join("/"):"—";
const status:Record<string,string>={SCHEDULED:"Agendado",PREPARING:"Preparação",IN_PROGRESS:"Em execução",PAUSED:"Pausado",WAITING_CUSTOMER:"Aguardando cliente",DONE:"Concluído",DELIVERED:"Entregue",CANCELED:"Cancelado",ACTIVE:"Ativo",INACTIVE:"Inativo",AVAILABLE:"Disponível",LOW_STOCK:"Estoque baixo",IN_MAINTENANCE:"Em manutenção",RESERVED:"Reservado",VACATION:"Férias",ON_LEAVE:"Afastado",FIRED:"Desligado",SUSPENDED:"Suspenso"};
const closed=(s:string)=>["DONE","DELIVERED","CANCELED"].includes(s);
const average=(values:number[])=>values.length?n(values.reduce((a,b)=>a+b,0)/values.length)+" / 5":"Sem avaliação";
export function buildManagementReport(user:SessionUser,q:ReportQuery,now=new Date()):ManagementReport{
 if(!user.isActive||user.mustChangePassword||!canAccessOperationalReports(user.role))throw new Error("Acesso restrito à direção e gerência.");
 const financial=canViewServiceOrderFinancials(user), today=localDay(now);
 const start=q.period==="all"?"":q.period==="today"?today:q.period==="month"?today.slice(0,7)+"-01":localDay(new Date(now.getTime()-(Number(q.period)-1)*86400000));
 const during=(s?:string)=>{const d=day(s);return !!d&&d<=today&&(!start||d>=start);};
 const overlap=(s:string,e:string)=>{const a=day(s),b=day(e)||a;return !!a&&a<=today&&(!start||b>=start);};
 const search=normalizeReportText(q.subject);
 const matches=(...values:(string|undefined)[])=>!search||values.some(v=>v&&normalizeReportText(v).includes(search));
 const metric=(label:string,value:number|string)=>({label,value:typeof value==="number"?n(value):value});
 const users=new Map(db.users.map(u=>[u.id,u])), employees=new Map(db.employees.map(e=>[e.id,e]));
 const allItems=db.serviceOrderChecklistItems.filter(i=>i.status!=="CANCELED");
 const validated=(i:typeof allItems[number])=>i.status==="DONE"&&!!i.validatedAt&&!!i.validatedByUserId;
 const title=reportLabels[q.kind]+(q.subject?" · "+q.subject:"");
 const periodLabel=start?date(start)+" a "+date(today):"Todo o período até "+date(today);
 const base={title,generatedAt:now.toISOString(),periodLabel};
 let metrics:ManagementReport["metrics"]=[],columns:string[]=[],rows:ManagementReport["rows"]=[],note="";
 if(q.kind==="services"){
   const orders=db.serviceOrders.filter(o=>overlap(o.scheduledStart,o.scheduledEnd)&&matches(o.id,o.title,o.customerName));
   const ids=new Set(orders.map(o=>o.id));const items=allItems.filter(i=>ids.has(i.serviceOrderId));
   const real=orders.filter(o=>o.status!=="CANCELED");
   metrics=[metric("Obras no período",orders.length),metric("Em aberto",orders.filter(o=>!closed(o.status)).length),metric("Concluídas / entregues",orders.filter(o=>["DONE","DELIVERED"].includes(o.status)).length),metric("Atrasadas hoje",orders.filter(o=>!closed(o.status)&&day(o.scheduledEnd)<today).length),metric("Itens validados",validatedCount(items)),metric("Itens em aberto",items.filter(i=>!validated(i)).length)];
   if(financial)metrics.push(metric("Valor contratado (não canceladas)",money(real.reduce((s,o)=>s+o.revenue,0))),metric("Despesas registradas (não canceladas)",money(real.reduce((s,o)=>s+o.expenses,0))));
   columns=["Obra","Supervisor","Status atual","Prazo","Checklist validado","Bloqueios","Registros no período",...(financial?["Contrato","Despesas registradas","Recebido no período"]:[])];
   rows=orders.map(o=>{const it=items.filter(i=>i.serviceOrderId===o.id);const received=db.servicePayments.filter(p=>p.serviceOrderId===o.id).flatMap(p=>p.receipts).filter(r=>!r.reversedAt&&during(r.paidAt)).reduce((s,r)=>s+r.amount,0);return {id:o.id,cells:[o.title,users.get(o.supervisorUserId||"")?.name||employees.get(o.supervisorEmployeeId||"")?.name||"Sem supervisor",status[o.status]||o.status,date(day(o.scheduledEnd)),n(validatedCount(it))+" / "+n(it.length),n(it.filter(i=>i.status==="BLOCKED").length),n(db.workHistory.filter(h=>h.serviceOrderId===o.id&&during(h.createdAt)&&(financial||h.kind!=="FINANCIAL")).length),...(financial?[money(o.revenue),money(o.expenses),money(received)]:[])]};});
   note="Obras com agenda sobreposta ao período. Status, checklist e custos são a posição atual das obras; recebimentos e registros usam suas datas. Valor contratado menos despesas não é lucro líquido.";
 }else if(q.kind==="supervisors"||q.kind==="managers"){
   const role=q.kind==="supervisors"?"SUPERVISOR_OBRA":"GERENTE";
   const people=db.users.filter(u=>u.role===role&&matches(u.name,u.id));
   const related=(u:typeof people[number])=>db.serviceOrders.filter(o=>overlap(o.scheduledStart,o.scheduledEnd)&&(role==="SUPERVISOR_OBRA"?(o.supervisorUserId===u.id||!!u.linkedEmployeeId&&o.supervisorEmployeeId===u.linkedEmployeeId):false));
   const logs=(id:string)=>db.auditLogs.filter(a=>a.userId===id&&during(a.createdAt)&&(financial||!/(PAYMENT|FINANC|EXPENSE|RECEIPT|COBRAN)/i.test(a.action))&&/^(ASSIGN_|UPDATE_SERVICE_ORDER|CREATE_SERVICE_ORDER|FIELD_|PAYMENT_|UPDATE_MATERIAL_REQUEST|COMPLETE_CHECKLIST|VALIDATE_CHECKLIST|CHECKLIST_|STOCK_|EQUIPMENT_)/.test(a.action));
   const checks=(id:string)=>allItems.filter(i=>i.validatedByUserId===id&&validated(i)&&during(i.validatedAt)).length;
   const incidents=(id:string)=>db.staffAttendanceReports.filter(r=>r.reportedByUserId===id&&during(r.occurredOn)).length;
   const updates=(id:string)=>db.workHistory.filter(h=>h.userId===id&&during(h.createdAt)&&(financial||h.kind!=="FINANCIAL")).length+db.officeJournal.filter(h=>h.userId===id&&during(h.createdAt)&&(financial||h.kind!=="FINANCIAL")).length;
   metrics=[metric(role==="GERENTE"?"Gerentes cadastrados":"Supervisores cadastrados",people.length),metric("Contas ativas",people.filter(u=>u.isActive).length),metric("Validações no período",people.reduce((s,u)=>s+checks(u.id),0)),metric("Ações operacionais auditadas",people.reduce((s,u)=>s+logs(u.id).length,0)),metric("Ocorrências registradas",people.reduce((s,u)=>s+incidents(u.id),0))];
   columns=["Nome","Conta",...(role==="SUPERVISOR_OBRA"?["Obras vinculadas","Em aberto","Entregues","Avaliação no período"]:[]),"Validações","Registros de diário","Ocorrências informadas","Ações auditadas"];
   rows=people.map(u=>{const os=related(u);const evals=db.supervisorEvaluations.filter(e=>e.supervisorUserId===u.id&&during(e.createdAt));return {id:u.id,cells:[u.name,u.isActive?"Ativa":"Inativa",...(role==="SUPERVISOR_OBRA"?[n(os.length),n(os.filter(o=>!closed(o.status)).length),n(os.filter(o=>o.status==="DELIVERED").length),average(evals.map(e=>e.overallScore))]:[]),n(checks(u.id)),n(updates(u.id)),n(incidents(u.id)),n(logs(u.id).length)]};});
   note="Vínculos e situação das contas são atuais; ações, avaliações, validações e ocorrências usam as datas registradas. Quantidade de ações não mede qualidade ou produtividade individual.";
 }else if(q.kind==="employees"){
   const people=db.employees.filter(e=>{const u=e.userId?users.get(e.userId):db.users.find(u=>u.linkedEmployeeId===e.id);return (!u||u.role==="COLABORADOR")&&matches(e.name,e.id);});
   const assigned=(id:string)=>allItems.filter(i=>(i.assignedEmployeeIds||[]).includes(id)||i.assignedEmployeeId===id);
   const completed=(id:string)=>allItems.filter(i=>i.status==="DONE"&&during(i.completedAt)&&((i.completedByEmployeeIds||[]).includes(id)||i.completedByEmployeeId===id));
   const attendance=(id:string,kind:string)=>db.staffAttendanceReports.filter(r=>r.employeeId===id&&r.kind===kind&&during(r.occurredOn));
   metrics=[metric("Colaboradores cadastrados",people.length),metric("Ativos",people.filter(e=>e.status==="ACTIVE").length),metric("Conclusões por colaborador",people.reduce((s,e)=>s+completed(e.id).length,0)),metric("Faltas informadas",people.reduce((s,e)=>s+attendance(e.id,"ABSENCE").length,0)),metric("Saídas antecipadas informadas",people.reduce((s,e)=>s+attendance(e.id,"EARLY_LEAVE").length,0))];
   columns=["Colaborador","Situação","Itens atribuídos em aberto (atual)","Conclusões no período","Conclusões validadas","Faltas informadas","Saídas antecipadas","Avaliação no período"];
   rows=people.map(e=>({id:e.id,cells:[e.name,status[e.status]||e.status,n(assigned(e.id).filter(i=>!validated(i)).length),n(completed(e.id).length),n(completed(e.id).filter(validated).length),n(attendance(e.id,"ABSENCE").length),n(attendance(e.id,"EARLY_LEAVE").length),average(db.evaluations.filter(x=>x.employeeId===e.id&&during(x.createdAt)).map(x=>x.overallScore))]}));
   note="Uma tarefa conjunta conta uma vez para cada responsável que a concluiu; ocorrências são relatos pendentes de apuração, não faltas confirmadas nem descontos. Atribuições abertas são atuais.";
 }else{
   const mats=db.materials.filter(m=>!m.archivedAt&&matches(m.name,m.id));const ids=new Set(mats.map(m=>m.id));
   const requests=db.materialRequests.filter(r=>during(r.createdAt)&&db.materialRequestItems.some(i=>i.requestId===r.id&&ids.has(i.materialId)));
   const eq=db.equipment.filter(e=>!e.archivedAt&&matches(e.name,e.code,e.id));
   metrics=[metric("Produtos ativos",mats.length),metric("Abaixo do mínimo",mats.filter(m=>m.currentStock<m.minStock).length),metric("Solicitações no período",requests.length),metric("Solicitações pendentes do período",requests.filter(r=>!["DELIVERED","REJECTED","CANCELED"].includes(r.status)).length),metric("Equipamentos ativos",eq.length),metric("Máquinas em manutenção",eq.filter(e=>e.status==="IN_MAINTENANCE").length)];
   if(financial)metrics.push(metric("Valor do estoque atual",money(mats.reduce((s,m)=>s+m.currentStock*m.unitCost,0))));
   columns=["Produto / equipamento","Unidade / código","Disponível agora","Mínimo","Entregue acumulado","Consumo acumulado","Devolvido acumulado","Perdas / danos acumulados",...(financial?["Valor estoque atual"]:[])];
   rows=mats.map(m=>{const a=db.serviceOrderMaterials.filter(i=>i.materialId===m.id);const sum=(key:"deliveredQuantity"|"consumedQuantity"|"returnedQuantity"|"lostQuantity"|"damagedQuantity")=>a.reduce((s,i)=>s+i[key],0);return {id:m.id,cells:[m.name,m.unit,n(m.currentStock),n(m.minStock),n(sum("deliveredQuantity")),n(sum("consumedQuantity")),n(sum("returnedQuantity")),n(sum("lostQuantity"))+" / "+n(sum("damagedQuantity")),...(financial?[money(m.currentStock*m.unitCost)]:[])]};});
   rows.push(...eq.map(e=>({id:e.id,cells:[e.name,e.code,status[e.status]||e.status,"—","—","—","—","—",...(financial?["—"]:[])]})));
   note="Estoque, equipamentos e movimentações acumuladas são a posição atual; o filtro de período afeta somente solicitações. Não há histórico completo de saldos por data. Quantidades de unidades diferentes não são somadas.";
 }
 const matched=rows.length;
 const summary=matched?metrics.map(m=>m.label+": "+m.value).join("\n"):"Nenhum registro corresponde ao filtro. Confira o nome ou amplie o período.";
 return {...base,note,metrics,columns,rows:rows.slice(0,1000),matched,summary};
}
function validatedCount(items:{status:string;validatedAt?:string;validatedByUserId?:string}[]){return items.filter(i=>i.status==="DONE"&&!!i.validatedAt&&!!i.validatedByUserId).length;}
