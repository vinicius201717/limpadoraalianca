import "server-only";
import { createHash } from "node:crypto";
import { db } from "./store";
import { fieldAssignment } from "./field-assistant";
import { canViewServiceOrderFinancials } from "./permissions";
import type { SessionUser } from "./types";

export type FieldNotice = { id:string; orderId:string; title:string; body:string; createdAt:string; scheduled?:boolean; kind:"PROGRESS"|"ORGANIZATION"|"CHECKLIST"|"FINANCE"|"BLOCKED" };
export type FieldPushSubscription = { id:string; userId:string; sessionVersion:number; endpoint:string; keys:{p256dh:string;auth:string}; updatedAt:string };
export type FieldPushDelivery = { id:string; subscriptionId:string; noticeId:string; state:"CLAIMED"|"SENT"|"FAILED"; at:string; attempts?:number };
export type FieldNoticeRead = { id:string; userId:string; at:string };
export const reminderSlots = [
  { hour:12,kind:"ORGANIZATION",title:"Hora de conferir os materiais",body:"Verifique se produtos, ferramentas e máquinas estão organizados e seguros na obra. Envie um relato." },
  { hour:16,kind:"CHECKLIST",title:"Conferência antes de encerrar",body:"Confira a organização, o recolhimento dos materiais e as condições de segurança antes de sair. Informe apenas ocorrências não registradas." },
] as const;
export const noticeId=(...parts:string[])=>createHash("sha256").update(JSON.stringify(parts)).digest("hex");
const dayKey=(date:Date)=>Number.isFinite(date.getTime())?new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(date):"";
const scheduledDay=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)?value:dayKey(new Date(value));
const localHour=(date:Date)=>Number(new Intl.DateTimeFormat("en-GB",{timeZone:"America/Sao_Paulo",hour:"2-digit",hourCycle:"h23"}).format(date));
export function isAllowedPushEndpoint(raw:string) {
  try {
    const u=new URL(raw);const h=u.hostname.toLowerCase();
    return u.protocol==="https:" && !u.username && !u.password && !u.port && !u.hash &&
      (h==="fcm.googleapis.com" || h==="updates.push.services.mozilla.com" || h.endsWith(".push.apple.com") || h.endsWith(".notify.windows.com"));
  } catch {return false;}
}
export function fieldNotices(user:SessionUser,now=new Date()):FieldNotice[] {
  if(!user.isActive || user.mustChangePassword || user.role==="COLABORADOR") return [];
  const day=dayKey(now), hour=localHour(now);
  const allowed=fieldAssignment(user).orders.filter(o=>!["office","warehouse"].includes(o.id));
  const rows:FieldNotice[]=[];
  for(const option of allowed){
    const order=db.serviceOrders.find(o=>o.id===option.id);
    if(!order)continue;
    if(user.role==="SUPERVISOR_OBRA") for(const event of db.serviceOrderChecklistEvents.filter(e=>e.serviceOrderId===order.id&&e.type==="CREATED"&&e.userId!==user.id&&Date.parse(e.createdAt)>=now.getTime()-30*86400000)) {
      const item=db.serviceOrderChecklistItems.find(i=>i.id===event.checklistItemId&&i.serviceOrderId===order.id);
      if(item)rows.push({id:noticeId(user.id,event.id,"new-checklist-item"),orderId:order.id,title:"Novo item no checklist",body:order.title+" • "+item.title,kind:"CHECKLIST",createdAt:event.createdAt});
    }
    // Remind only the designated supervisor, on days the work is scheduled or actively underway.
    if(user.role==="SUPERVISOR_OBRA" && ["IN_PROGRESS","SCHEDULED","PREPARING"].includes(order.status) &&
      !!scheduledDay(order.scheduledStart) && scheduledDay(order.scheduledStart)<=day && (order.status==="IN_PROGRESS" || day<=scheduledDay(order.scheduledEnd))) {
      const rawHours=(process.env.FIELD_REMINDER_HOURS||"9,12,16").split(",").map(x=>Number(x.trim()));
      // Preserve the old four-hour configuration, ignoring the retired progress reminder.
      const configured=rawHours.length===4?[rawHours[0],rawHours[1],rawHours[3]]:rawHours;
      const validHour=(value:number|undefined,fallback:number)=>Number.isInteger(value)&&value!>=6&&value!<=20?value!:fallback;
      const monitorStart=validHour(configured[0],9);
      const monitorEnd=validHour(configured[2],16);
      const staleHours=Number(process.env.FIELD_PROGRESS_STALE_HOURS||"3");
      const staleMs=(Number.isFinite(staleHours)&&staleHours>=1&&staleHours<=8?staleHours:3)*3600000;
      const items=db.serviceOrderChecklistItems.filter(i=>i.serviceOrderId===order.id);
      const actionable=items.some(i=>["PENDING","IN_PROGRESS","REOPENED"].includes(i.status)&&(!i.plannedStartAt||Date.parse(i.plannedStartAt)<=now.getTime()));
      // Only actual execution events count as progress; reading the checklist does not.
      if(order.status==="IN_PROGRESS"&&actionable&&hour>=monitorStart&&hour<=monitorEnd){
        const baseline=Date.parse(day+"T"+String(monitorStart).padStart(2,"0")+":00:00-03:00");
        const timestamps=[baseline,...items.flatMap(i=>[i.startedAt,i.completedAt,i.validatedAt]),...db.serviceOrderChecklistEvents.filter(e=>e.serviceOrderId===order.id&&(["STARTED","COMPLETED","VALIDATED","REOPENED","BLOCKED","CANCELED"].includes(e.type)||(e.previousStatus&&e.newStatus&&e.previousStatus!==e.newStatus))).map(e=>e.createdAt)].map(x=>typeof x==="number"?x:Date.parse(x||"")).filter(t=>Number.isFinite(t)&&t<=now.getTime());
        const last=Math.max(...timestamps);
        const due=last+staleMs;
        if(now.getTime()>=due)rows.push({id:noticeId(user.id,order.id,day,"stale-progress"),orderId:order.id,title:"Andamento sem atualização",body:order.title+" — O checklist tem tarefas em aberto e está sem atualização operacional recente. Confira o andamento e registre somente o que mudou ou o motivo do atraso.",kind:"PROGRESS",scheduled:true,createdAt:new Date(due).toISOString()});
      }
      for(const slot of reminderSlots.map((s,i)=>({...s,hour:validHour(configured[i+1],s.hour)})).filter(s=>s.hour<=hour)){
        rows.push({id:noticeId(user.id,order.id,day,String(slot.hour),slot.title),orderId:order.id,title:slot.title,body:order.title+" — "+slot.body,kind:slot.kind,scheduled:true,createdAt:day+"T"+String(slot.hour).padStart(2,"0")+":00:00-03:00"});
      }
      const awaiting=db.serviceOrderChecklistItems.filter(i=>i.serviceOrderId===order.id&&i.status==="DONE"&&!i.validatedAt&&!i.validatedByUserId&&i.completedByUserId&&db.users.some(u=>u.id===i.completedByUserId&&u.role==="COLABORADOR"));
      for(const item of awaiting) rows.push({id:noticeId(user.id,item.id,"awaiting-validation",item.completedAt||item.updatedAt),orderId:order.id,title:"Serviço aguardando sua conferência",body:order.title+" — "+item.title+". Confira a entrega e confirme se estiver correta.",kind:"CHECKLIST",createdAt:item.completedAt||item.updatedAt});
      const blocked=db.serviceOrderChecklistItems.filter(i=>i.serviceOrderId===order.id&&i.status==="BLOCKED");
      for(const item of blocked) rows.push({id:noticeId(user.id,item.id,"blocked",item.updatedAt),orderId:order.id,title:"Item bloqueado no checklist",body:order.title+" — "+item.title+(item.blockedReason?" — "+item.blockedReason:""),kind:"BLOCKED",createdAt:item.updatedAt});
      for(const item of db.serviceOrderChecklistItems.filter(i=>i.serviceOrderId===order.id&&!["DONE","CANCELED","BLOCKED"].includes(i.status)&&i.dueAt&&scheduledDay(i.dueAt)<day)) rows.push({id:noticeId(user.id,item.id,"overdue",day),orderId:order.id,title:"Tarefa com prazo vencido",body:order.title+" — "+item.title+". Verifique o motivo e atualize o checklist.",kind:"CHECKLIST",createdAt:day+"T09:00:00-03:00"});
    }
  }
  for(const r of db.fieldReceipts.filter(r=>r.uploadedByUserId===user.id&&["SETTLED","REVERSED"].includes(r.status)&&Date.parse(r.updatedAt)>now.getTime()-7*86400000)){
    rows.push({id:noticeId(user.id,r.id,r.status,r.updatedAt),orderId:"office",title:r.status==="SETTLED"?"Comprovante conferido pelo financeiro":"Comprovante estornado",body:"Consulte a situação com o financeiro.",kind:"FINANCE",createdAt:r.updatedAt});
  }
  if(canViewServiceOrderFinancials(user)){
    for(const r of db.fieldReceipts.filter(r=>["PENDING_REVIEW","REVIEWED"].includes(r.status)&&Date.parse(r.createdAt)>now.getTime()-7*86400000)){
      rows.push({id:noticeId(user.id,r.id,"pending"),orderId:r.serviceOrderId||"office",title:"Comprovante aguardando conferência",body:"Há um documento aguardando revisão no financeiro.",kind:"FINANCE",createdAt:r.createdAt});
    }
  }
  return rows.filter(n=>Date.parse(n.createdAt)<=now.getTime()).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)).slice(0,100);
}
export function unreadFieldNotices(user:SessionUser,now=new Date()){
  const read=new Set([...db.fieldNoticeReads,...db.systemNoticeReads].filter(r=>r.userId===user.id).map(r=>r.id));
  return fieldNotices(user,now).map(n=>({...n,read:read.has(n.id)}));
}
