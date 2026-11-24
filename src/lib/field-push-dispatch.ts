import "server-only";
import { sendNotification } from "web-push";
import { db } from "./store";
import { assistantTransaction } from "./whatsapp-operations";
import { fieldNotices, isAllowedPushEndpoint, noticeId, type FieldNotice } from "./field-notifications";

function pushBody(notices:FieldNotice[]){
  if(notices.length>1)return "Você tem "+notices.length+" avisos operacionais. Abra o aplicativo para conferir e responder.";
  switch(notices[0].kind){
    case "PROGRESS":return "Há uma obra com andamento sem atualização recente. Confira apenas o que estiver faltando.";
    case "ORGANIZATION":return "Confira a organização dos materiais e ferramentas e envie um relato.";
    case "CHECKLIST":return "Confira o checklist e as tarefas pendentes.";
    case "BLOCKED":return "Existe uma tarefa que precisa de atenção. Confira no aplicativo.";
    case "FINANCE":return "Existe uma atualização financeira. Confira no aplicativo.";
  }
}
export async function dispatchFieldPush(credentials:{publicKey:string;privateKey:string;subject:string},send:typeof sendNotification=sendNotification){
  const {publicKey:pub,privateKey:priv,subject}=credentials;
  const now=Date.now();
  const claimed=await assistantTransaction(()=>{
    db.fieldPushDeliveries=db.fieldPushDeliveries.filter(d=>Date.parse(d.at)>now-14*86400000);
    db.fieldPushSubscriptions=db.fieldPushSubscriptions.filter(s=>Date.parse(s.updatedAt)>now-90*86400000);
    const users=new Map(db.users.filter(u=>u.isActive&&!u.mustChangePassword&&u.role!=="COLABORADOR").map(u=>[u.id,u]));
    const delivery=new Map(db.fieldPushDeliveries.map(d=>[d.id,d]));
    const jobs=[];
    for(const sub of db.fieldPushSubscriptions){
      const user=users.get(sub.userId);
      if(!user||(user.sessionVersion??0)!==sub.sessionVersion||!isAllowedPushEndpoint(sub.endpoint))continue;
      const read=new Set(db.fieldNoticeReads.filter(r=>r.userId===user.id).map(r=>r.id));
      const notices=fieldNotices(user,new Date(now)).filter(n=>{
        if(read.has(n.id)||Date.parse(n.createdAt)>now||Date.parse(n.createdAt)<now-(n.scheduled?2:24)*3600000)return false;
        const prior=delivery.get(noticeId(sub.id,n.id));
        return !prior || (prior.state!=="SENT" && (prior.attempts??1)<3 && Date.parse(prior.at)<now-30*60000);
      }).slice(0,10);
      if(!notices.length)continue;
      const at=new Date(now).toISOString();
      const ids=notices.map(n=>{
        const id=noticeId(sub.id,n.id);
        const prior=delivery.get(id);
        if(prior){prior.state="CLAIMED";prior.at=at;prior.attempts=(prior.attempts??1)+1;}
        else{const row={id,subscriptionId:sub.id,noticeId:n.id,state:"CLAIMED" as const,at,attempts:1};db.fieldPushDeliveries.push(row);delivery.set(id,row);}
        return id;
      });
      jobs.push({ids,at,sub:structuredClone(sub),notices});
      if(jobs.length>=50)break;
    }
    return jobs;
  });
  let sent=0,failed=0;
  for(let i=0;i<claimed.length;i+=10){
    const outcomes=await Promise.all(claimed.slice(i,i+10).map(async job=>{
      try{
        await send({endpoint:job.sub.endpoint,keys:job.sub.keys},JSON.stringify({title:"Aliança Campo",body:pushBody(job.notices),tag:"campo-"+noticeId(...job.notices.map(n=>n.id).sort())}),{vapidDetails:{subject,publicKey:pub,privateKey:priv},TTL:3600,timeout:7000});
        return {job,ok:true,expired:false};
      }catch(e){const status=(e as {statusCode?:number}).statusCode;return {job,ok:false,expired:status===404||status===410};}
    }));
    await assistantTransaction(()=>{for(const x of outcomes){
      for(const id of x.job.ids){const d=db.fieldPushDeliveries.find(d=>d.id===id&&d.at===x.job.at);if(d)d.state=x.ok?"SENT":"FAILED";}
      if(x.expired)db.fieldPushSubscriptions=db.fieldPushSubscriptions.filter(s=>s.id!==x.job.sub.id||s.updatedAt!==x.job.sub.updatedAt);
    }});
    sent+=outcomes.filter(x=>x.ok).length;failed+=outcomes.filter(x=>!x.ok).length;
  }
  return {claimed:claimed.length,sent,failed};
}
