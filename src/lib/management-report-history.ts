import "server-only";
import {db} from "./store";
type Completion={itemId:string;orderId:string;at:string;employeeIds:string[];validationAt?:string;validatorId?:string;source:"EVENT"|"LEGACY"};
type Validation={itemId:string;orderId:string;at:string;userId:string;completionAt?:string};
export function checklistReportHistory(){
 const completions:Completion[]=[],validations:Validation[]=[],latest=new Map<string,Completion>(),eventItems=new Set<string>(),validationItems=new Set<string>();
 const events=[...db.serviceOrderChecklistEvents].sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
 for(const event of events){
  if(event.type==="COMPLETED"){
   const metadata=event.metadataJson as {completedByEmployeeIds?:unknown;completedByEmployeeId?:unknown}|undefined;
   const ids=Array.isArray(metadata?.completedByEmployeeIds)?metadata.completedByEmployeeIds.filter((x):x is string=>typeof x==="string"):typeof metadata?.completedByEmployeeId==="string"?[metadata.completedByEmployeeId]:event.employeeId?[event.employeeId]:[];
   const c:Completion={itemId:event.checklistItemId,orderId:event.serviceOrderId,at:event.createdAt,employeeIds:[...new Set(ids)],source:"EVENT"};
   eventItems.add(event.checklistItemId);completions.push(c);latest.set(event.checklistItemId,c);
  }else if(event.type==="REOPENED"){latest.delete(event.checklistItemId);}
  else if(event.type==="VALIDATED"){
   const c=latest.get(event.checklistItemId);if(c&&!c.validationAt){c.validationAt=event.createdAt;c.validatorId=event.userId;}
   validationItems.add(event.checklistItemId);validations.push({itemId:event.checklistItemId,orderId:event.serviceOrderId,at:event.createdAt,userId:event.userId,completionAt:c?.at});
  }
 }
 for(const item of db.serviceOrderChecklistItems){
  if(item.status!=="DONE")continue;
  if(item.completedAt&&!eventItems.has(item.id)){
   completions.push({itemId:item.id,orderId:item.serviceOrderId,at:item.completedAt,employeeIds:[...new Set([item.completedByEmployeeId,...(item.completedByEmployeeIds||[])].filter((x):x is string=>!!x))],validationAt:item.validatedAt,validatorId:item.validatedByUserId,source:"LEGACY"});
  }
  if(item.validatedAt&&item.validatedByUserId&&!validationItems.has(item.id)){
   validations.push({itemId:item.id,orderId:item.serviceOrderId,at:item.validatedAt,userId:item.validatedByUserId,completionAt:item.completedAt});
  }
 }
 return {completions,validations,reopened:events.filter(e=>e.type==="REOPENED"),unattributed:completions.filter(c=>!c.employeeIds.length).length};
}
export function meanDurationHours(values:{start?:string;end?:string}[]){
 const hours=values.flatMap(v=>{const a=Date.parse(v.start||""),b=Date.parse(v.end||"");return Number.isFinite(a)&&Number.isFinite(b)&&b>=a?[(b-a)/3600000]:[];});
 return {count:hours.length,hours:hours.length?hours.reduce((s,v)=>s+v,0)/hours.length:null};
}
