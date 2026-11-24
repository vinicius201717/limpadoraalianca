import {z} from "zod";
export const reportKinds=["services","supervisors","employees","managers","materials"] as const;
export type ReportKind=typeof reportKinds[number];
export const reportLabels:Record<ReportKind,string>={services:"Serviços",supervisors:"Supervisores",employees:"Colaboradores",managers:"Gerentes",materials:"Materiais e almoxarifado"};
export const reportQuerySchema=z.object({kind:z.enum(reportKinds).default("services"),period:z.enum(["all","today","7","30","month"]).default("30"),subject:z.string().trim().max(160).default("")});
export type ReportQuery=z.infer<typeof reportQuerySchema>;
export type ManagementReport={title:string;generatedAt:string;periodLabel:string;note:string;metrics:{label:string;value:string}[];columns:string[];rows:{id:string;cells:string[]}[];matched:number;summary:string};
export const normalizeReportText=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/\s+/g," ");
export function parseManagementReportRequest(text:string,currentOrderTitle?:string):ReportQuery|undefined{
 const s=normalizeReportText(text).replace(/[?!.,;]+$/g,"").trim();
 const m=/^(?:(?:chat|assistente)[, ]+)?(?:(?:me )?(?:da|de|manda|mande|mostra|mostre|passa|passe|envia|envie|gere|gera|faz|faca|quero ver|quero|abra|abre|consulta|consulte|preciso de) (?:um |o |os |de )?)?relatorios?(?: gerenciais?| completo[s]?)?(?: (.*))?$/.exec(s);
 if(!m)return;
 let rest=(m[1]||"").trim(), period:ReportQuery["period"]="30";
 const periods:[RegExp,ReportQuery["period"]][]=[[/\b(?:de hoje|hoje)$/, "today"],[/\b(?:dos |nos )?ultimos 7 dias$/, "7"],[/\b(?:dos |nos )?ultimos 30 dias$/, "30"],[/\b(?:deste mes|do mes atual|este mes)$/, "month"],[/\b(?:de todo o periodo|todo o periodo|geral|completo)$/, "all"]];
 for(const [pattern,p] of periods){if(pattern.test(rest)){period=p;rest=rest.replace(pattern,"").trim();break;}}
 const current=/^(?:desta obra|deste servico|esta obra|este servico|da obra atual|do servico atual|obra atual|servico atual)$/.test(rest);
 rest=rest.replace(/^(?:sobre |de |do |da |dos |das )+/,"");
 if(current)return {kind:"services",period:currentOrderTitle&&period==="30"?"all":period,subject:currentOrderTitle||""};
 if(/^(?:desta obra|deste servico|esta obra|este servico)$/.test(m[1]||"")||/^(?:obra atual|servico atual)$/.test(rest))return {kind:"services",period,subject:currentOrderTitle||""};
 const kinds:[RegExp,ReportKind][]=[[/^(?:supervisor(?:es)?|supervisao)(?:\s+|$)/,"supervisors"],[/^(?:colaborador(?:es)?|funcionarios?|equipe)(?:\s+|$)/,"employees"],[/^(?:gerentes?|gerencia)(?:\s+|$)/,"managers"],[/^(?:materiais|material|estoque|almoxarifado)(?:\s+|$)/,"materials"],[/^(?:servicos?|obras?|os)(?:\s+|$)/,"services"]];
 for(const [pattern,kind] of kinds){if(pattern.test(rest)){const subject=rest.replace(pattern,"").replace(/^(?:do |da |de |sobre )+/,"").trim();return {kind,period,subject:subject.slice(0,160)};}}
 if(!rest)return {kind:"services",period,subject:""};
 return;
}
