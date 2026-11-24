import "server-only";
import {randomUUID} from "node:crypto";
import {AssistantError,assistantTransaction} from "./whatsapp-operations";
import {fieldActor,fieldHistory} from "./field-assistant";
import {canManageWhatsAppFinance} from "./whatsapp-schema";
import {authorizeServiceOrderAccess} from "./service-order-access";
import {db,recordAuditLog} from "./store";
import {buildManagementReport} from "./management-reports";
import type {SessionUser} from "./types";

export const reportScope=(user:SessionUser)=>`${user.role}:${canManageWhatsAppFinance(user)?"finance":"operational"}`;
// Compatibility route: no raw diary text or unconstrained generated conclusions.
export async function createWorkReport(userId:string,orderId:string){
 return assistantTransaction(()=>{
  const user=db.users.find(u=>u.id===userId);fieldActor(user);
  if(!["OWNER","GERENTE"].includes(user.role))throw new AssistantError("Relatórios exclusivos do dono e do gerente.");
  const order=authorizeServiceOrderAccess(user,orderId,"history").order;
  const report=buildManagementReport(user,{kind:"services",period:"all",subject:order.id});
  const entries=fieldHistory(user,orderId);
  const sourceIds=[...new Set([order.id,...entries.map(e=>e.id),...db.serviceOrderChecklistItems.filter(i=>i.serviceOrderId===orderId).map(i=>i.id)])];
  const content=["Relatório estruturado da obra",report.periodLabel,...report.metrics.map(m=>m.label+": "+m.value),report.note,"Para análise e priorização com IA, use a Central de Relatórios. Este resumo não envia relatos à OpenAI."].join("\n");
  const saved={id:randomUUID(),serviceOrderId:orderId,userId,content,sourceIds,scope:reportScope(user),createdAt:new Date().toISOString(),model:"structured-v2"};
  db.workReports.push(saved);recordAuditLog({userId,action:"GENERATE_WORK_REPORT",entity:"WorkReport",entityId:saved.id});return saved;
 });
}
