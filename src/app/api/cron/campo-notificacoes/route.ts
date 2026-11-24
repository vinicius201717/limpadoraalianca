import { timingSafeEqual } from "node:crypto";
import { dispatchFieldPush } from "@/lib/field-push-dispatch";
export const maxDuration=60;
export const dynamic="force-dynamic";

export async function GET(request:Request){
  const secret=process.env.CRON_SECRET;
  const received=request.headers.get("authorization")||"";
  const expected="Bearer "+secret;
  if(!secret||Buffer.byteLength(received)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(received),Buffer.from(expected)))return Response.json({message:"Não autorizado."},{status:401});
  const {FIELD_VAPID_PUBLIC_KEY:pub,FIELD_VAPID_PRIVATE_KEY:priv,FIELD_VAPID_SUBJECT:subject}=process.env;
  if(!pub||!priv||!subject)return Response.json({message:"Push não configurado."},{status:503});
  return Response.json(await dispatchFieldPush({publicKey:pub,privateKey:priv,subject}));
}
