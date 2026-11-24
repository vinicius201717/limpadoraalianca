import "server-only";
import {db} from "./store";
import type {ReportQuery} from "./management-report-query";
import type {ServiceOrder} from "./types";
export const localReportDay=(value:Date|string)=>{if(typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value))return value;const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"}):"";};
export function reportPeriod(q:ReportQuery,now=new Date(),financial=true){
 const today=localReportDay(now);
 const start=q.period==="custom"?q.from||"":q.period==="all"?"":q.period==="today"?today:q.period==="month"?today.slice(0,7)+"-01":localReportDay(new Date(now.getTime()-(Number(q.period)-1)*86400000));
 const end=q.period==="custom"?q.to||today:today;
 const during=(s?:string)=>{const d=s?localReportDay(s):"";return !!d&&d<=today&&d<=end&&(!start||d>=start);};
 const overlap=(a:string,b:string)=>{const x=localReportDay(a),y=localReportDay(b)||x;return !!x&&(q.period==="all"||x<=end&&(!start||y>=start));};
 const activity=new Set<string>();
 for(const a of db.serviceOrderChecklistEvents)if(during(a.createdAt))activity.add(a.serviceOrderId);
 for(const a of db.workHistory)if(during(a.createdAt)&&a.serviceOrderId&&(financial||a.kind!=="FINANCIAL"))activity.add(a.serviceOrderId);
 if(financial){for(const a of db.serviceExpenses)if(during(a.createdAt))activity.add(a.serviceOrderId);
 for(const a of db.servicePayments)if(during(a.createdAt)||during(a.dueAt)||a.receipts.some(r=>during(r.paidAt)||during(r.reversedAt)))activity.add(a.serviceOrderId);
 for(const a of db.fieldReceipts)if(a.serviceOrderId&&(during(a.createdAt)||during(a.settlement?.at)||during(a.reversal?.at)))activity.add(a.serviceOrderId);
 }
 for(const a of db.staffAttendanceReports)if(a.serviceOrderId&&during(a.occurredOn))activity.add(a.serviceOrderId);
 for(const a of db.evaluations)if(during(a.createdAt))activity.add(a.serviceOrderId);
 for(const a of db.supervisorEvaluations)if(during(a.createdAt))activity.add(a.serviceOrderId);
 for(const a of db.materialRequests)if(during(a.createdAt)||during(a.updatedAt))activity.add(a.serviceOrderId);
 for(const a of db.serviceOrderMaterials)if(during(a.updatedAt))activity.add(a.serviceOrderId);
 for(const a of db.serviceOrderEquipment)if(during(a.deliveredAt)||during(a.returnedAt)||during(a.updatedAt))activity.add(a.serviceOrderId);
 for(const a of db.serviceOrderChecklistItems)if(during(a.createdAt)||during(a.completedAt)||during(a.validatedAt)||during(a.updatedAt))activity.add(a.serviceOrderId);
 for(const a of db.serviceOrders)if(during(a.clientDeliverySignedAt))activity.add(a.id);
 const active=(o:ServiceOrder)=>!["DONE","DELIVERED","CANCELED"].includes(o.status);
 const orderIncluded=(o:ServiceOrder)=>q.period==="all"||overlap(o.scheduledStart,o.scheduledEnd)||activity.has(o.id)||(end>=today&&active(o)&&localReportDay(o.scheduledStart)<=today);
 return {today,start,end,during,overlap,orderIncluded};
}
export function reportLabel(value:string|undefined,financial:boolean){
 const text=(value||"").slice(0,2000);
 // Never send raw diary text to the provider. UI retains sanitized authorized excerpts.
 const redacted=text.replace(/\b(?:senha|password|token|api[ _-]?key|chave\s*pix|secret|segredo|bearer)\b[^\n,;]*/giu,"[dado reservado]").replace(/https?:\/\/[^\s]+/gi,"[link omitido]").replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,"[e-mail omitido]").replace(/\b(?:\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/g,"[documento omitido]").replace(/(?:\+55\s*)?(?:\(?\d{2}\)?[ .-]*)?\d{4,5}[- .]\d{4}\b/g,"[telefone omitido]").replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g,"[credencial omitida]");
 return financial?redacted:redacted.replace(/(?:R\s*\$|BRL|USD|US\s*\$|€)\s*[\d.,]+|\b[\d.,]+\s*(?:reais|dolares|dólares|centavos)\b/gi,"[valor reservado]").replace(/\b(?:custo|sal[aá]rio|pre[cç]o|receita|despesa|pagamento|valor|lucro|faturamento)\b[^\n,;]*/giu,"[informação financeira reservada]");
}
