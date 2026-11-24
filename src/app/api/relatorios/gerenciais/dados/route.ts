import {requireApiUser} from "@/lib/api-handlers";
import {withDatabase} from "@/lib/with-database";
import {canAccessOperationalReports} from "@/lib/permissions";
import {reportQuerySchema} from "@/lib/management-report-query";
import {managementDetails} from "@/lib/management-report-detail";
import {z} from "zod";
export const dynamic="force-dynamic";
export const GET=withDatabase(async request=>{
 const auth=await requireApiUser(request);if(auth.response)return auth.response;
 if(!canAccessOperationalReports(auth.user.role))return Response.json({message:"Acesso restrito à direção e gerência."},{status:403});
 const query=reportQuerySchema.extend({section:z.string().max(80).optional(),page:z.coerce.number().int().min(0).max(100000).default(0)}).safeParse(Object.fromEntries(request.nextUrl.searchParams));
 if(!query.success)return Response.json({message:"Filtros inválidos."},{status:400});
 const data=managementDetails(auth.user,query.data);
 const section=data.sections.find(s=>s.key===query.data.section),size=15;
 if(query.data.section&&!section)return Response.json({message:"Seção indisponível para esta consulta."},{status:404});
 return Response.json({sections:data.sections.map(({key,label,basis,total})=>({key,label,basis,total})),limitations:data.limitations,section:section?{...section,rows:section.rows.slice(query.data.page*size,(query.data.page+1)*size)}:null,pageSize:size});
});
