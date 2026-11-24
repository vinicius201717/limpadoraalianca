import { z } from "zod";
import { requireApiUser } from "@/lib/api-handlers";
import { withDatabase } from "@/lib/with-database";
import { fieldActor } from "@/lib/field-assistant";
import { db } from "@/lib/store";
import { fieldNotices, unreadFieldNotices, isAllowedPushEndpoint, noticeId } from "@/lib/field-notifications";
const schema=z.discriminatedUnion("action",[
  z.object({action:z.literal("read"),ids:z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(100)}),
  z.object({action:z.literal("subscribe"),endpoint:z.string().max(2048).refine(isAllowedPushEndpoint),keys:z.object({p256dh:z.string().regex(/^[A-Za-z0-9_-]{87}$/),auth:z.string().regex(/^[A-Za-z0-9_-]{22}$/)})}),
  z.object({action:z.literal("unsubscribe"),endpoint:z.string().max(2048)}),
]);
export const GET=withDatabase(async request=>{
  const auth=await requireApiUser(request);if(auth.response)return auth.response;
  try{fieldActor(auth.user)}catch{return Response.json({message:"Sem acesso."},{status:403})}
  return Response.json({notices:unreadFieldNotices(auth.user),publicKey:process.env.FIELD_VAPID_PUBLIC_KEY||"",pushConfigured:Boolean(process.env.FIELD_VAPID_PUBLIC_KEY&&process.env.FIELD_VAPID_PRIVATE_KEY&&process.env.FIELD_VAPID_SUBJECT&&process.env.CRON_SECRET)});
});
export const POST=withDatabase(async request=>{
  const auth=await requireApiUser(request);if(auth.response)return auth.response;
  try{fieldActor(auth.user)}catch{return Response.json({message:"Sem acesso."},{status:403})}
  const input=schema.parse(await request.json());const user=auth.user;const now=new Date().toISOString();
  if(input.action==="read"){
    const allowed=new Set(fieldNotices(user).map(n=>n.id));
    db.fieldNoticeReads=db.fieldNoticeReads.filter(r=>Date.parse(r.at)>Date.now()-30*86400000);
    for(const id of input.ids)if(allowed.has(id)&&!db.fieldNoticeReads.some(r=>r.id===id&&r.userId===user.id))db.fieldNoticeReads.push({id,userId:user.id,at:now});
  }else if(input.action==="unsubscribe"){
    db.fieldPushSubscriptions=db.fieldPushSubscriptions.filter(s=>s.userId!==user.id||s.endpoint!==input.endpoint);
  }else{
    if(!process.env.FIELD_VAPID_PUBLIC_KEY||!process.env.FIELD_VAPID_PRIVATE_KEY||!process.env.FIELD_VAPID_SUBJECT||!process.env.CRON_SECRET)return Response.json({message:"Push ainda não configurado."},{status:503});
    const id=noticeId(input.endpoint);
    const own=db.fieldPushSubscriptions.filter(s=>s.userId===user.id&&s.id!==id).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
    const remove=new Set(own.slice(4).map(s=>s.id));
    db.fieldPushSubscriptions=db.fieldPushSubscriptions.filter(s=>s.id!==id&&!remove.has(s.id));
    db.fieldPushSubscriptions.push({id,userId:user.id,sessionVersion:user.sessionVersion??0,endpoint:input.endpoint,keys:input.keys,updatedAt:now});
  }
  return Response.json({ok:true});
});
