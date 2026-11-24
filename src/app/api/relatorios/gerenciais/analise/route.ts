import {requireApiUser} from "@/lib/api-handlers";
import {withDatabase} from "@/lib/with-database";
import {canAccessOperationalReports} from "@/lib/permissions";
import {reportQuerySchema} from "@/lib/management-report-query";
import {generateManagementAnalysis,listManagementAnalyses} from "@/lib/management-report-ai";
import {z} from "zod";
import {randomUUID} from "node:crypto";
import {reviewManagementAnalysis} from "@/lib/management-report-ai";
import {assistantTransaction} from "@/lib/whatsapp-operations";
import {db} from "@/lib/store";
export const dynamic="force-dynamic";
export const maxDuration=120;
export const GET=withDatabase(async request=>{
 const auth=await requireApiUser(request);if(auth.response)return auth.response;
 if(!canAccessOperationalReports(auth.user.role))return Response.json({message:"Acesso restrito à direção e gerência."},{status:403});
 const query=reportQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
 if(!query.success)return Response.json({message:"Filtros inválidos."},{status:400});
 return Response.json({analyses:listManagementAnalyses(auth.user,query.data,request.nextUrl.searchParams.get("reviewQueue")==="1"),viewer:{id:auth.user.id,canApprove:auth.user.role==="OWNER"}});
});
export const POST=withDatabase(async request=>{
 const auth=await requireApiUser(request);if(auth.response)return auth.response;
 if(!canAccessOperationalReports(auth.user.role))return Response.json({message:"Acesso restrito à direção e gerência."},{status:403});
 const body=await request.json();
 const query=reportQuerySchema.safeParse(body);
 const requestId=z.string().uuid().safeParse(body?.requestId??randomUUID());
 if(!query.success||!requestId.success)return Response.json({message:"Filtros ou identificador inválidos."},{status:400});
 try{return Response.json({analysis:await generateManagementAnalysis(auth.user,query.data,requestId.data)},{status:201});}
 catch(e){
  const code=e instanceof Error?e.message:"";
  if(code==="REPORT_CONFLICT"||code==="REPORT_BUSY")return Response.json({message:"Análise já solicitada ou em andamento. Consulte o histórico antes de tentar novamente."},{status:409});
  if(code==="REPORT_RETENTION_LIMIT")return Response.json({message:"Limite de relatórios armazenados atingido. Solicite arquivamento à administração."},{status:409});
  if(code==="REPORT_RATE_LIMIT")return Response.json({message:"Limite de cinco análises por hora atingido."},{status:429});
  if(code==="REPORT_FORBIDDEN")return Response.json({message:"Acesso alterado. Entre novamente."},{status:403});
  if(code==="OPENAI_UNAVAILABLE")return Response.json({message:"IA ainda não configurada no servidor. O dashboard e os dados continuam disponíveis."},{status:503});
  if(code==="REPORT_INVALID_EVIDENCE")return Response.json({message:"A IA retornou referências inválidas. A análise não foi salva. Gere novamente."},{status:422});
  return Response.json({message:"Não foi possível gerar a análise pela IA. Verifique créditos, configuração e disponibilidade da OpenAI. Nenhum dado operacional foi alterado."},{status:503});
 }
});

export const PATCH=withDatabase(async request=>{
 const auth=await requireApiUser(request);if(auth.response)return auth.response;
 if(!canAccessOperationalReports(auth.user.role))return Response.json({message:"Acesso restrito."},{status:403});
 const body=z.object({id:z.string().uuid(),decision:z.enum(["REVIEWED","APPROVED","REJECTED"]),note:z.string().trim().min(3).max(1000)}).safeParse(await request.json());
 if(!body.success)return Response.json({message:"Informe a decisão e justificativa."},{status:400});
 try{const analysis=await assistantTransaction(()=>{const user=db.users.find(u=>u.id===auth.user.id);if(!user||user.sessionVersion!==auth.user.sessionVersion)throw new Error("REPORT_FORBIDDEN");return reviewManagementAnalysis(user,body.data.id,body.data.decision,body.data.note);});return Response.json({analysis});}
 catch(e){const code=e instanceof Error?e.message:"";return Response.json({message:"Revisão não autorizada, inexistente ou fora da etapa correta."},{status:code==="REPORT_FORBIDDEN"?403:code==="REPORT_NOT_FOUND"?404:409});}
});
