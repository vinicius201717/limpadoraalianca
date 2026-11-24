import {z} from "zod";
export const reportKinds=["services","supervisors","employees","managers","materials","general"] as const;
export type ReportKind=typeof reportKinds[number];
export const reportLabels:Record<ReportKind,string>={services:"Serviços",supervisors:"Supervisores",employees:"Colaboradores",managers:"Gerentes",materials:"Materiais e almoxarifado",general:"Consolidado da empresa"};
const dateOnly=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{const d=new Date(s+"T00:00:00Z");return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;});
export const reportQuerySchema=z.object({kind:z.enum(reportKinds).default("services"),period:z.enum(["all","today","7","30","month","custom"]).default("30"),subject:z.string().trim().max(160).default(""),mode:z.enum(["ai"]).optional(),from:dateOnly.optional(),to:dateOnly.optional()}).refine(q=>(q.period!=="custom"||!!q.from&&!!q.to&&q.from<=q.to)&&(q.kind!=="general"||!q.subject),{message:"Informe intervalo de datas válido."});
export type ReportQuery=z.infer<typeof reportQuerySchema>;
export type ManagementReport={title:string;generatedAt:string;periodLabel:string;note:string;metrics:{label:string;value:string}[];columns:string[];rows:{id:string;cells:string[]}[];matched:number;summary:string;charts?:{title:string;values:{label:string;value:number}[]}[]};
export const normalizeReportText=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/\s+/g," ");
export function parseManagementReportRequest(text:string,currentOrderTitle?:string):ReportQuery|undefined{
 const isAI=/\b(?:com ia|pela ia|por ia|analitico|analitica|inteligencia artificial)\b/.test(normalizeReportText(text));
 const clean=normalizeReportText(text).replace(/\b(?:com ia|pela ia|por ia|analitico|analitica|inteligencia artificial)\b/g,"").replace(/\s+/g," ").trim();
 const result=parseBaseReportRequest(clean,currentOrderTitle);return result&&isAI?{...result,mode:"ai"}:result;
}
function parseBaseReportRequest(text:string,currentOrderTitle?:string):ReportQuery|undefined{
 const s=normalizeReportText(text).replace(/[?!.,;]+$/g,"").trim();
 const m=/^(?:(?:chat|assistente)[, ]+)?(?:(?:me )?(?:da|de|manda|mande|mostra|mostre|passa|passe|envia|envie|gere|gera|faz|faca|quero ver|quero|abra|abre|consulta|consulte|preciso de) (?:um |o |os |de )?)?relatorios?(?: gerenciais?| completo[s]?)?(?: (.*))?$/.exec(s);
 if(!m)return;
 let rest=(m[1]||"").trim(), period:ReportQuery["period"]="30";
 if(/^(?:geral|consolidado|da empresa|de toda a empresa|todos os departamentos)$/.test(rest))return {kind:"general",period:"30",subject:""};
 const general=/^(?:geral|consolidado|da empresa|de toda a empresa|todos os departamentos)(?:\s|$)/.test(rest);
 if(general)rest=rest.replace(/^(?:geral|consolidado|da empresa|de toda a empresa|todos os departamentos)\s*/,"");
 const periods:[RegExp,ReportQuery["period"]][]=[[/\b(?:de hoje|hoje)$/, "today"],[/\b(?:dos |nos )?ultimos 7 dias$/, "7"],[/\b(?:dos |nos )?ultimos 30 dias$/, "30"],[/\b(?:deste mes|do mes atual|este mes)$/, "month"],[/\b(?:de todo o periodo|todo o periodo|geral|completo)$/, "all"]];
 for(const [pattern,p] of periods){if(pattern.test(rest)){period=p;rest=rest.replace(pattern,"").trim();break;}}
 if(general&&!rest)return {kind:"general",period,subject:""};
 const current=/^(?:desta obra|deste servico|esta obra|este servico|da obra atual|do servico atual|obra atual|servico atual)$/.test(rest);
 rest=rest.replace(/^(?:sobre |de |do |da |dos |das )+/,"");
 if(current)return currentOrderTitle?{kind:"services",period:period==="30"?"all":period,subject:currentOrderTitle}:undefined;
 if(/^(?:desta obra|deste servico|esta obra|este servico)$/.test(m[1]||"")||/^(?:obra atual|servico atual)$/.test(rest))return currentOrderTitle?{kind:"services",period,subject:currentOrderTitle}:undefined;
 const kinds:[RegExp,ReportKind][]=[[/^(?:supervisor(?:a|as|es)?|supervisao)(?:\s+|$)/,"supervisors"],[/^(?:colaborador(?:a|as|es)?|funcionarios?|equipe)(?:\s+|$)/,"employees"],[/^(?:gerentes?|gerencia)(?:\s+|$)/,"managers"],[/^(?:materiais|material|estoque|almoxarifado)(?:\s+|$)/,"materials"],[/^(?:servicos?|obras?|os)(?:\s+|$)/,"services"]];
 for(const [pattern,kind] of kinds){if(pattern.test(rest)){const subject=rest.replace(pattern,"").replace(/^(?:do |da |de |sobre )+/,"").trim();return {kind,period,subject:subject.slice(0,160)};}}
 if(!rest)return {kind:"general",period,subject:""};
 return;
}

export type ReportSource={id:string;fields:Record<string,string|number|boolean|null>};
export type ReportSection={key:string;label:string;basis:string;total:number;rows:ReportSource[]};
export type ReportSectionInfo=Omit<ReportSection,"rows">;
export const reportAnalysisSchema=z.object({
 executiveSummary:z.string().min(1).max(3500),
 findings:z.array(z.object({title:z.string().max(180),severity:z.enum(["CRITICAL","HIGH","MEDIUM","LOW","INFO"]),analysis:z.string().max(1400),evidence:z.array(z.string().max(250)).min(1).max(8)})).max(12),
 recommendations:z.array(z.object({action:z.string().max(700),priority:z.enum(["HIGH","MEDIUM","LOW"]),responsibleRole:z.string().max(100),suggestedDeadline:z.string().max(100),evidence:z.array(z.string().max(250)).min(1).max(8)})).max(10),
 dataGaps:z.array(z.string().max(500)).max(10),
 conclusion:z.string().max(1500),
});
export type ReportAnalysis=z.infer<typeof reportAnalysisSchema>;
export type AnalysisEvidence={id:string;label:string;detail:string};
export type ManagementReview={status:"PENDING"|"REVIEWED"|"APPROVED"|"REJECTED";byUserId?:string;at?:string;note?:string;previous?:ManagementReview};
export type ManagementAnalysisRun={requestId:string;userId:string;scope:string;queryKey:string;sessionVersion:number;status:"RUNNING"|"DONE"|"FAILED";createdAt:string;analysisId?:string};
export type SavedManagementAnalysis={id:string;userId:string;scope:string;query:ReportQuery;title:string;periodLabel:string;generatedAt:string;model:string;analysis:ReportAnalysis;coverage:{section:string;total:number;included:number}[];limitations:string[];evidence:AnalysisEvidence[];usage?:{inputTokens:number|null;outputTokens:number|null;totalTokens:number|null};review?:ManagementReview;method?:string};
