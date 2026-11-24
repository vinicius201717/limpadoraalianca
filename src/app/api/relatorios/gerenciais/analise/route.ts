import {requireApiUser} from "@/lib/api-handlers";
import {withDatabase} from "@/lib/with-database";
import {canAccessOperationalReports} from "@/lib/permissions";
import {reportQuerySchema} from "@/lib/management-report-query";
import {generateManagementAnalysis,listManagementAnalyses} from "@/lib/management-report-ai";
import {consumeRateLimit} from "@/lib/rate-limit";
export const dynamic="force-dynamic";
export const maxDuration=120;
export const GET=withDatabase(async request=>{
 const auth=await requireApiUser(request);if(auth.response)return auth.response;
 if(!canAccessOperationalReports(auth.user.role))return Response.json({message:"Acesso restrito à direção e gerência."},{status:403});
 const query=reportQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
 if(!query.success)return Response.json({message:"Filtros inválidos."},{status:400});
 return Response.json({analyses:listManagementAnalyses(auth.user,query.data)});
});
export const POST=withDatabase(async request=>{
 const auth=await requireApiUser(request);if(auth.response)return auth.response;
 if(!canAccessOperationalReports(auth.user.role))return Response.json({message:"Acesso restrito à direção e gerência."},{status:403});
 const query=reportQuerySchema.safeParse(await request.json());
 if(!query.success)return Response.json({message:"Filtros inválidos."},{status:400});
 const retry=await consumeRateLimit("management-ai-report",auth.user.id,5,60*60_000);
 if(retry)return Response.json({message:"Limite de cinco análises por hora atingido. Consulte as análises já salvas."},{status:429});
 try{return Response.json({analysis:await generateManagementAnalysis(auth.user.id,query.data)},{status:201});}
 catch(e){
  const code=e instanceof Error?e.message:"";
  if(code==="REPORT_FORBIDDEN")return Response.json({message:"Acesso alterado. Entre novamente."},{status:403});
  if(code==="OPENAI_UNAVAILABLE")return Response.json({message:"IA ainda não configurada no servidor. O dashboard e os dados continuam disponíveis."},{status:503});
  if(code==="REPORT_INVALID_EVIDENCE")return Response.json({message:"A IA retornou referências inválidas. A análise não foi salva. Gere novamente."},{status:422});
  return Response.json({message:"Não foi possível gerar a análise pela IA. Verifique créditos, configuração e disponibilidade da OpenAI. Nenhum dado operacional foi alterado."},{status:503});
 }
});
