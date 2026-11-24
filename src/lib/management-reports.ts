import "server-only";
import {db,getEmployeeAccessRole} from "./store";
import {canAccessOperationalReports,canViewServiceOrderFinancials} from "./permissions";
import {reportLabels,normalizeReportText,type ReportQuery,type ManagementReport} from "./management-report-query";
import {checklistReportHistory,meanDurationHours} from "./management-report-history";
import {reportPeriod,reportLabel} from "./management-report-period";
import type {SessionUser} from "./types";

const day=(s?:string)=>s?(/^\d{4}-\d{2}-\d{2}$/.test(s)?s:new Date(s).toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"})):"";
const n=(v:number)=>v.toLocaleString("pt-BR",{maximumFractionDigits:3});
const money=(v:number)=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const date=(s:string)=>s?s.split("-").reverse().join("/"):"—";
const status:Record<string,string>={SCHEDULED:"Agendado",PREPARING:"Preparação",IN_PROGRESS:"Em execução",PAUSED:"Pausado",WAITING_CUSTOMER:"Aguardando cliente",DONE:"Concluído",DELIVERED:"Entregue",CANCELED:"Cancelado",ACTIVE:"Ativo",INACTIVE:"Inativo",AVAILABLE:"Disponível",LOW_STOCK:"Estoque baixo",IN_MAINTENANCE:"Em manutenção",RESERVED:"Reservado",VACATION:"Férias",ON_LEAVE:"Afastado",FIRED:"Desligado",SUSPENDED:"Suspenso"};
const closed=(s:string)=>["DONE","DELIVERED","CANCELED"].includes(s);
const average=(values:number[])=>values.length?n(values.reduce((a,b)=>a+b,0)/values.length)+" / 5":"Sem avaliação";
export function buildManagementReport(user:SessionUser,q:ReportQuery,now=new Date()):ManagementReport{
 if(!user.isActive||user.mustChangePassword||!canAccessOperationalReports(user.role))throw new Error("Acesso restrito à direção e gerência.");
 const financial=canViewServiceOrderFinancials(user), {today,start,end,during,orderIncluded}=reportPeriod(q,now,financial);
 const label=(s?:string)=>reportLabel(s,financial);
 const search=normalizeReportText(q.subject);
 const matches=(...values:(string|undefined)[])=>!search||values.some(v=>v&&normalizeReportText(label(v)).includes(search));
 const metric=(label:string,value:number|string)=>({label,value:typeof value==="number"?n(value):value});
 const users=new Map(db.users.map(u=>[u.id,u])), employees=new Map(db.employees.map(e=>[e.id,e]));
 const validOrders=new Set(db.serviceOrders.filter(o=>o.status!=="CANCELED").map(o=>o.id));
 const allItems=db.serviceOrderChecklistItems.filter(i=>i.status!=="CANCELED"&&validOrders.has(i.serviceOrderId));
 const validated=(i:typeof allItems[number])=>i.status==="DONE"&&!!i.validatedAt&&!!i.validatedByUserId;
 const title=reportLabels[q.kind]+(q.subject?" · "+label(q.subject):"");
 const periodLabel=start?date(start)+" a "+date(end):"Todo o período (agenda futura incluída; movimentos até "+date(end)+")";
 const base={title,generatedAt:now.toISOString(),periodLabel};
 const history=checklistReportHistory();
 const charts:NonNullable<ManagementReport["charts"]>=[];
 const distribution=(title:string,values:string[])=>{const counts=new Map<string,number>();for(const v of values)counts.set(v,(counts.get(v)||0)+1);charts.push({title,values:[...counts].map(([label,value])=>({label,value}))});};
 let metrics:ManagementReport["metrics"]=[],columns:string[]=[],rows:ManagementReport["rows"]=[],note="";
 if(q.kind==="general"){
  const subs=(["services","supervisors","employees","managers","materials"] as const).map(kind=>buildManagementReport(user,{...q,kind,subject:""},now));
  const metrics=subs.flatMap(r=>r.metrics.map(m=>({label:r.title+" · "+m.label,value:m.value})));
  if(financial)metrics.push(metric("Administrativo · Despesas pagas no período",money(db.administrativeExpenses.filter(a=>during(a.paidAt)).reduce((s,a)=>s+a.amount,0))));
  return {...base,note:"Consolidado por departamento. Indicadores de departamentos distintos não são somados; posição atual e fluxos por data são separados.",metrics,columns:["Departamento","Indicador","Valor"],rows:metrics.map((m,i)=>({id:"consolidated-"+i,cells:[m.label.split(" · ")[0],m.label.split(" · ").slice(1).join(" · "),m.value]})),matched:metrics.length,summary:metrics.map(m=>m.label+": "+m.value).join("\n"),charts:subs.flatMap(r=>r.charts||[])};
 }
 if(q.kind==="services"){
   const exact=db.serviceOrders.find(o=>normalizeReportText(o.id)===search);const orders=db.serviceOrders.filter(o=>orderIncluded(o)&&(exact?o.id===exact.id:matches(o.id,o.title,o.customerName)));
   const ids=new Set(orders.map(o=>o.id));const items=allItems.filter(i=>ids.has(i.serviceOrderId));
   const real=orders.filter(o=>o.status!=="CANCELED");
   distribution("Situação atual das obras",orders.map(o=>status[o.status]||o.status));
   distribution("Situação atual do checklist",items.map(i=>validated(i)?"Validado":i.status==="DONE"?"Aguardando validação":i.status==="BLOCKED"?"Bloqueado":i.status==="IN_PROGRESS"?"Em execução":"Pendente / reaberto"));
   metrics=[metric("Obras selecionadas",orders.length),metric("Agendadas no futuro",orders.filter(o=>day(o.scheduledStart)>today&&!closed(o.status)).length),metric("Em aberto",orders.filter(o=>!closed(o.status)).length),metric("Concluídas / entregues",orders.filter(o=>["DONE","DELIVERED"].includes(o.status)).length),metric("Atrasadas hoje",orders.filter(o=>!closed(o.status)&&!!day(o.scheduledEnd)&&day(o.scheduledEnd)<today).length),metric("Itens validados",validatedCount(items)),metric("Itens em aberto",items.filter(i=>!validated(i)).length),metric("Reaberturas registradas no período",history.reopened.filter(e=>ids.has(e.serviceOrderId)&&during(e.createdAt)).length)];
   const accepted=orders.filter(o=>during(o.clientDeliverySignedAt));const withDeadline=accepted.filter(o=>!!day(o.scheduledEnd));const onTime=withDeadline.filter(o=>day(o.clientDeliverySignedAt)<=day(o.scheduledEnd));const ratings=accepted.filter(o=>typeof o.clientRating==="number");const validationTime=meanDurationHours(history.validations.filter(v=>ids.has(v.orderId)&&during(v.at)).map(v=>({start:v.completionAt,end:v.at})));metrics.push(metric("Entregas com aceite no período",accepted.length),metric("Aceites até prazo cadastrado",withDeadline.length?n(onTime.length/withDeadline.length*100)+"% ("+onTime.length+"/"+withDeadline.length+")":"Sem base"),metric("Nota média do cliente (aceites)",average(ratings.map(o=>o.clientRating!))),metric("Tempo médio entre conclusão e validação",validationTime.hours===null?"Sem base":n(validationTime.hours)+" h ("+validationTime.count+" eventos)"));
   if(financial){const receipts=db.servicePayments.filter(p=>ids.has(p.serviceOrderId)).flatMap(p=>p.receipts);metrics.push(metric("Valor contratado atual (não canceladas)",money(real.reduce((s,o)=>s+o.revenue,0))),metric("Despesas acumuladas atuais (não canceladas)",money(real.reduce((s,o)=>s+o.expenses,0))),metric("Recebimentos brutos no período",money(receipts.filter(r=>during(r.paidAt)).reduce((s,r)=>s+r.amount,0))),metric("Estornos no período",money(receipts.filter(r=>during(r.reversedAt)).reduce((s,r)=>s+r.amount,0))),metric("Despesas lançadas no período",money(db.serviceExpenses.filter(x=>ids.has(x.serviceOrderId)&&during(x.createdAt)).reduce((s,x)=>s+x.amount,0))));}
   columns=["Obra","Supervisor","Status atual","Prazo","Checklist validado","Bloqueios","Registros no período",...(financial?["Contrato","Despesas registradas","Recebimentos brutos no período","Estornos no período"]:[])];
   rows=orders.map(o=>{const it=items.filter(i=>i.serviceOrderId===o.id);const received=db.servicePayments.filter(p=>p.serviceOrderId===o.id).flatMap(p=>p.receipts).filter(r=>during(r.paidAt)).reduce((s,r)=>s+r.amount,0);const reversed=db.servicePayments.filter(p=>p.serviceOrderId===o.id).flatMap(p=>p.receipts).filter(r=>during(r.reversedAt)).reduce((s,r)=>s+r.amount,0);return {id:o.id,cells:[label(o.title),label(users.get(o.supervisorUserId||"")?.name||employees.get(o.supervisorEmployeeId||"")?.name||"Sem supervisor"),status[o.status]||o.status,date(day(o.scheduledEnd)),n(validatedCount(it))+" / "+n(it.length),n(it.filter(i=>i.status==="BLOCKED").length),n(db.workHistory.filter(h=>h.serviceOrderId===o.id&&during(h.createdAt)&&(financial||h.kind!=="FINANCIAL")).length),...(financial?[money(o.revenue),money(o.expenses),money(received),money(reversed)]:[])]};});
   note="Obras por agenda, atividade no período ou pendências atuais. Obras futuras no período completo. Checklist exclui canceladas. Recebimentos brutos e estornos usam datas próprias. Status e valores contratuais são atuais; não equivalem a lucro líquido.";
 }else if(q.kind==="supervisors"||q.kind==="managers"){
   const role=q.kind==="supervisors"?"SUPERVISOR_OBRA":"GERENTE";
   const people=db.users.filter(u=>u.role===role&&matches(u.name,u.id));
   distribution("Situação das contas",people.map(u=>u.isActive?"Ativa":"Inativa"));
   const related=(u:typeof people[number])=>db.serviceOrders.filter(o=>orderIncluded(o)&&(role==="SUPERVISOR_OBRA"?(o.supervisorUserId===u.id||!!u.linkedEmployeeId&&o.supervisorEmployeeId===u.linkedEmployeeId):false));
   const logs=(id:string)=>db.auditLogs.filter(a=>a.userId===id&&during(a.createdAt)&&(financial||!/(PAYMENT|FINANC|EXPENSE|RECEIPT|COBRAN)/i.test(a.action))&&/^(ASSIGN_|UPDATE_SERVICE_ORDER|CREATE_SERVICE_ORDER|FIELD_|PAYMENT_|UPDATE_MATERIAL_REQUEST|COMPLETE_CHECKLIST|VALIDATE_CHECKLIST|CHECKLIST_|STOCK_|EQUIPMENT_)/.test(a.action));
   const checks=(id:string)=>history.validations.filter(i=>i.userId===id&&during(i.at)).length;
   const incidents=(id:string)=>db.staffAttendanceReports.filter(r=>r.reportedByUserId===id&&during(r.occurredOn)).length;
   const updates=(id:string)=>db.workHistory.filter(h=>h.userId===id&&during(h.createdAt)&&(financial||h.kind!=="FINANCIAL")).length+db.officeJournal.filter(h=>h.userId===id&&during(h.createdAt)&&(financial||h.kind!=="FINANCIAL")).length;
   metrics=[metric(role==="GERENTE"?"Gerentes cadastrados":"Supervisores cadastrados",people.length),metric("Contas ativas",people.filter(u=>u.isActive).length),metric("Validações no período",people.reduce((s,u)=>s+checks(u.id),0)),metric("Ações operacionais auditadas",people.reduce((s,u)=>s+logs(u.id).length,0)),metric("Ocorrências registradas",people.reduce((s,u)=>s+incidents(u.id),0))];
   columns=["Nome","Conta",...(role==="SUPERVISOR_OBRA"?["Obras vinculadas","Em aberto","Entregues","Avaliação no período"]:[]),"Validações","Tempo médio até validação (h)","Registros de diário","Ocorrências informadas","Ações auditadas"];
   rows=people.map(u=>{const os=related(u);const evals=db.supervisorEvaluations.filter(e=>e.supervisorUserId===u.id&&during(e.createdAt));return {id:u.id,cells:[label(u.name),u.isActive?"Ativa":"Inativa",...(role==="SUPERVISOR_OBRA"?[n(os.length),n(os.filter(o=>!closed(o.status)).length),n(os.filter(o=>o.status==="DELIVERED").length),average(evals.map(e=>e.overallScore))]:[]),n(checks(u.id)),(()=>{const t=meanDurationHours(history.validations.filter(v=>v.userId===u.id&&during(v.at)).map(v=>({start:v.completionAt,end:v.at})));return t.hours===null?"Sem base":n(t.hours)+" ("+t.count+")";})(),n(updates(u.id)),n(incidents(u.id)),n(logs(u.id).length)]};});
   note="Vínculos e situação das contas são atuais; ações, avaliações, validações e ocorrências usam as datas registradas. Quantidade de ações não mede qualidade ou produtividade individual.";
 }else if(q.kind==="employees"){
   const people=db.employees.filter(e=>getEmployeeAccessRole(e)==="COLABORADOR"&&matches(e.name,e.id));
   const assigned=(id:string)=>allItems.filter(i=>(i.assignedEmployeeIds||[]).includes(id)||i.assignedEmployeeId===id);
   const completed=(id:string)=>history.completions.filter(i=>during(i.at)&&i.employeeIds.includes(id));
   const attendance=(id:string,kind:string)=>db.staffAttendanceReports.filter(r=>r.employeeId===id&&r.kind===kind&&during(r.occurredOn));
   distribution("Situação dos colaboradores",people.map(e=>status[e.status]||e.status));
   charts.push({title:"Ocorrências informadas no período",values:[{label:"Faltas informadas",value:people.reduce((s,e)=>s+attendance(e.id,"ABSENCE").length,0)},{label:"Saídas antecipadas",value:people.reduce((s,e)=>s+attendance(e.id,"EARLY_LEAVE").length,0)}]});
   metrics=[metric("Colaboradores cadastrados",people.length),metric("Ativos",people.filter(e=>e.status==="ACTIVE").length),metric("Conclusões por colaborador",people.reduce((s,e)=>s+completed(e.id).length,0)),metric("Faltas informadas",people.reduce((s,e)=>s+attendance(e.id,"ABSENCE").length,0)),metric("Saídas antecipadas informadas",people.reduce((s,e)=>s+attendance(e.id,"EARLY_LEAVE").length,0))];
   columns=["Colaborador","Situação","Itens atribuídos em aberto (atual)","Conclusões no período","Conclusões do período validadas até fim do período","Faltas informadas","Saídas antecipadas","Avaliação no período"];
   rows=people.map(e=>({id:e.id,cells:[label(e.name),status[e.status]||e.status,n(assigned(e.id).filter(i=>!validated(i)).length),n(completed(e.id).length),n(completed(e.id).filter(c=>!!c.validationAt&&during(c.validationAt)).length),n(attendance(e.id,"ABSENCE").length),n(attendance(e.id,"EARLY_LEAVE").length),average(db.evaluations.filter(x=>x.employeeId===e.id&&during(x.createdAt)).map(x=>x.overallScore))]}));
   note="Cada evento de conclusão conta uma vez por responsável; reaberturas não apagam conclusões registradas. Registros legados sem evento ou autoria não permitem reconstrução completa. Ocorrências são relatos, não faltas comprovadas. Atribuições abertas são atuais.";
 }else{
   const mats=db.materials.filter(m=>!m.archivedAt&&matches(m.name,m.id));const ids=new Set(mats.map(m=>m.id));
   const requests=db.materialRequests.filter(r=>during(r.createdAt)&&db.materialRequestItems.some(i=>i.requestId===r.id&&ids.has(i.materialId)));
   const eq=db.equipment.filter(e=>!e.archivedAt&&matches(e.name,e.code,e.id));
   distribution("Nível de estoque por produto",mats.map(m=>m.currentStock<m.minStock?"Abaixo do mínimo":"No mínimo ou acima"));
   distribution("Situação dos equipamentos",eq.map(e=>status[e.status]||e.status));
   metrics=[metric("Produtos ativos",mats.length),metric("Abaixo do mínimo",mats.filter(m=>m.currentStock<m.minStock).length),metric("Solicitações no período",requests.length),metric("Solicitações pendentes do período",requests.filter(r=>!["DELIVERED","REJECTED","CANCELED"].includes(r.status)).length),metric("Equipamentos ativos",eq.length),metric("Máquinas em manutenção",eq.filter(e=>e.status==="IN_MAINTENANCE").length)];
   if(financial)metrics.push(metric("Valor do estoque atual",money(mats.reduce((s,m)=>s+m.currentStock*m.unitCost,0))));
   columns=["Produto / equipamento","Unidade / código","Disponível agora","Mínimo","Entregue acumulado","Consumo acumulado","Devolvido acumulado","Perdas / danos acumulados",...(financial?["Valor estoque atual"]:[])];
   rows=mats.map(m=>{const a=db.serviceOrderMaterials.filter(i=>i.materialId===m.id);const sum=(key:"deliveredQuantity"|"consumedQuantity"|"returnedQuantity"|"lostQuantity"|"damagedQuantity")=>a.reduce((s,i)=>s+i[key],0);return {id:m.id,cells:[label(m.name),label(m.unit),n(m.currentStock),n(m.minStock),n(sum("deliveredQuantity")),n(sum("consumedQuantity")),n(sum("returnedQuantity")),n(sum("lostQuantity"))+" / "+n(sum("damagedQuantity")),...(financial?[money(m.currentStock*m.unitCost)]:[])]};});
   rows.push(...eq.map(e=>({id:e.id,cells:[label(e.name),label(e.code),status[e.status]||e.status,"—","—","—","—","—",...(financial?["—"]:[])]})));
   note="Estoque, equipamentos e movimentações acumuladas são a posição atual; o filtro de período afeta somente solicitações. Não há histórico completo de saldos por data. Quantidades de unidades diferentes não são somadas.";
 }
 const matched=rows.length;
 const summary=matched?metrics.map(m=>m.label+": "+m.value).join("\n"):"Nenhum registro corresponde ao filtro. Confira o nome ou amplie o período.";
 return {...base,note,metrics,columns,rows,matched,summary,charts};
}
function validatedCount(items:{status:string;validatedAt?:string;validatedByUserId?:string}[]){return items.filter(i=>i.status==="DONE"&&!!i.validatedAt&&!!i.validatedByUserId).length;}
