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
  { hour:9,kind:"PROGRESS",title:"Como está a obra?",body:"Relate o andamento, equipe, dificuldades e próximas tarefas." },
  { hour:12,kind:"ORGANIZATION",title:"Hora de conferir os materiais",body:"Verifique se produtos, ferramentas e máquinas estão organizados e seguros na obra. Envie um relato." },
  { hour:15,kind:"PROGRESS",title:"Atualização da obra",body:"Informe o que foi concluído, o que falta e qualquer impedimento." },
  { hour:16,kind:"CHECKLIST",title:"Conferência antes de encerrar",body:"Confira o checklist, a organização e o recolhimento dos materiais. Informe pendências antes de sair." },
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
    // Remind only the designated supervisor, on days the work is scheduled or actively underway.
    if(user.role==="SUPERVISOR_OBRA" && ["IN_PROGRESS","SCHEDULED","PREPARING"].includes(order.status) &&
      !!scheduledDay(order.scheduledStart) && scheduledDay(order.scheduledStart)<=day && (order.status==="IN_PROGRESS" || day<=scheduledDay(order.scheduledEnd))) {
      const configured=(process.env.FIELD_REMINDER_HOURS||"9,12,15,16").split(",").map(x=>Number(x.trim()));
      for(const slot of reminderSlots.map((s,i)=>({...s,hour:Number.isInteger(configured[i])&&configured[i]>=6&&configured[i]<=20?configured[i]:s.hour})).filter(s=>s.hour<=hour)){
        rows.push({id:noticeId(user.id,order.id,day,String(slot.hour),slot.title),orderId:order.id,title:slot.title,body:order.title+" — "+slot.body,kind:slot.kind,scheduled:true,createdAt:day+"T"+String(slot.hour).padStart(2,"0")+":00:00-03:00"});
      }
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
  const read=new Set(db.fieldNoticeReads.filter(r=>r.userId===user.id).map(r=>r.id));
  return fieldNotices(user,now).map(n=>({...n,read:read.has(n.id)}));
}
