import {requireApiUser} from "@/lib/api-handlers";
import {withDatabase} from "@/lib/with-database";
import {canAccessOperationalReports} from "@/lib/permissions";
import {reportQuerySchema} from "@/lib/management-report-query";
import {buildManagementReport} from "@/lib/management-reports";
export const dynamic="force-dynamic";
export const GET=withDatabase(async request=>{
 const auth=await requireApiUser(request);if(auth.response)return auth.response;
 if(!canAccessOperationalReports(auth.user.role))return Response.json({message:"Acesso restrito à direção e gerência."},{status:403});
 const query=reportQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
 if(!query.success)return Response.json({message:"Filtros de relatório inválidos."},{status:400});
 return Response.json({report:buildManagementReport(auth.user,query.data)});
});
