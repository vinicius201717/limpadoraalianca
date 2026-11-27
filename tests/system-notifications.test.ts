import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import type { SessionUser } from "../src/lib/types";
process.env.DATABASE_URL="";
process.env.SUPABASE_URL="https://notice-fixture.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY="test-only";
process.env.JWT_SECRET="test-only-secret-at-least-thirty-two-characters";
process.env.APP_URL="http://localhost:3000";
const {GET,POST}=await import("../src/app/api/notificacoes/route");
const field=await import("../src/app/api/campo/notificacoes/route");
const {signSessionToken}=await import("../src/lib/session-token");
const {db,ensureDatabaseReady}=await import("../src/lib/store");
const {runWithStore}=await import("../src/lib/request-store");
const {notificationFeed}=await import("../src/lib/system-notifications");
const user=(id:string,role:SessionUser["role"],canViewFinancials=false):SessionUser=>({id,name:id,email:id+"@example.test",role,isActive:true,canViewFinancials});
const owner=user("owner","OWNER"), manager=user("manager","GERENTE"), sales=user("sales","COMERCIAL"), superA=user("super-a","SUPERVISOR_OBRA"), superB=user("super-b","SUPERVISOR_OBRA"), warehouse=user("warehouse","ALMOXARIFADO"), finance=user("finance","FINANCEIRO"), worker=user("worker","COLABORADOR");
const now=new Date(), at=now.toISOString(), future=new Date(now.getTime()+86400000*3).toISOString(), past=new Date(now.getTime()-86400000*3).toISOString();
let state:Record<string,unknown>, version:string;
const order=(id:string,supervisorUserId:string)=>({id,title:"Obra "+id,customerName:"Cliente "+id,supervisorUserId,status:"IN_PROGRESS",scheduledStart:past,scheduledEnd:future,employeeIds:id==="a"?["worker-emp"]:[]});
beforeEach(()=>{
 state={
  users:[owner,manager,sales,superA,superB,warehouse,finance,worker].map(u=>({...u,createdAt:at,updatedAt:at})),
  employees:[{id:"worker-emp",userId:worker.id,name:"Colaborador"}],
  leads:[{id:"lead-1",name:"Lead novo",source:"Site",status:"NEW",nextFollowUpAt:at},{id:"lead-2",name:"Lead contatado",status:"CONTACTED",nextFollowUpAt:future}],
  auditLogs:[{id:"lead-log",action:"PUBLIC_QUOTE_REQUEST",entity:"Lead",entityId:"lead-1",createdAt:at}],
  serviceOrders:[order("a",superA.id),order("b",superB.id)],
  serviceOrderChecklistItems:[{id:"item-a",serviceOrderId:"a",title:"Item A",assignedEmployeeIds:["worker-emp"],status:"PENDING",createdAt:at,updatedAt:at},{id:"item-b",serviceOrderId:"b",title:"Item B",status:"PENDING",createdAt:at,updatedAt:at}],
  serviceOrderChecklistEvents:[{id:"event-a",serviceOrderId:"a",checklistItemId:"item-a",type:"CREATED",userId:owner.id,createdAt:at},{id:"event-b",serviceOrderId:"b",checklistItemId:"item-b",type:"CREATED",userId:owner.id,createdAt:at}],
  materials:[{id:"material",name:"Detergente",currentStock:0,minStock:2}],equipment:[],
  materialRequests:[{id:"request",serviceOrderId:"a",status:"PENDING",priority:"URGENT",createdAt:at,updatedAt:at}],
  servicePayments:[{id:"payment",serviceOrderId:"a",description:"Parcela privada",amount:100,dueAt:past,receipts:[]}],
  companyFeedbacks:[{id:"feedback",submittedByUserId:"worker",category:"SEGURANCA",message:"Mensagem privada",status:"NEW",createdAt:at}],
 };
 version=at;
 globalThis.fetch=async(input,init)=>{
   const url=new URL(String(input));assert.equal(url.origin,"https://notice-fixture.invalid");
   if(url.pathname!=="/rest/v1/app_state")throw Error("Unexpected "+url.pathname);
   if(!init?.method||init.method==="GET")return Response.json([{data:structuredClone(state),updated_at:version}]);
   if(init.method==="PATCH"){if(url.searchParams.get("updated_at")!=="eq."+version)return Response.json([]);const p=JSON.parse(String(init.body));state=structuredClone(p.data);version=p.updated_at;return Response.json([{updated_at:version}]);}
   throw Error("Unexpected method");
 };
});
const req=(u:SessionUser|null,method="GET",body?:unknown,endpoint="/api/notificacoes")=>new NextRequest("http://localhost:3000"+endpoint,{method,headers:{"Content-Type":"application/json",...(u?{cookie:"floor_session="+signSessionToken(u)}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
async function feed(u:SessionUser){const r=await GET(req(u),undefined);assert.equal(r.status,200);return await r.json() as ReturnType<typeof notificationFeed>;}
test("lead count is scoped and follows actual NEW status independently of read receipts",async()=>{
 const first=await feed(owner);assert.equal(first.newLeads,1);const notice=first.notices.find(n=>n.kind==="LEAD")!;
 assert.equal((await feed(sales)).newLeads,1);assert.equal((await feed(superA)).newLeads,0);
 const read=await POST(req(owner,"POST",{action:"read",ids:[notice.id]}),undefined);assert.equal(read.status,200);
 assert.equal((await feed(owner)).newLeads,1);assert.equal((await feed(owner)).notices.find(n=>n.id===notice.id)?.read,true);assert.equal((await feed(sales)).notices.find(n=>n.id===notice.id)?.read,false);
 (state.leads as {status:string}[])[0].status="CONTACTED";assert.equal((await feed(owner)).newLeads,0);
});
test("each supervisor sees only assigned work; employee sees only own assigned item; stock and finance remain scoped",async()=>{
 const a=await feed(superA),b=await feed(superB),w=await feed(worker),s=await feed(warehouse),f=await feed(finance),m=await feed(manager);
 assert.ok(a.notices.some(n=>n.title==="Novo item no checklist"&&n.body.includes("Item A")));assert.ok(!JSON.stringify(a).includes("Item B"));
 assert.ok(b.notices.some(n=>n.body.includes("Item B")));assert.ok(!JSON.stringify(b).includes("Item A"));
 assert.ok(w.notices.some(n=>n.body.includes("Item A")));assert.ok(!JSON.stringify(w).includes("Item B"));
 assert.ok(s.notices.some(n=>n.kind==="STOCK"));assert.ok(!s.notices.some(n=>n.kind==="LEAD"||n.kind==="FINANCE"));
 assert.ok(f.notices.some(n=>n.kind==="FINANCE"));assert.ok(!m.notices.some(n=>n.kind==="FINANCE"));
 assert.ok(!JSON.stringify(m).includes("Mensagem privada"));
});
test("auth required; foreign id cannot be marked; field and web share read receipts",async()=>{
 assert.equal((await GET(req(null),undefined)).status,401);
 const a=await feed(superA),b=await feed(superB);
 const n=a.notices.find(n=>n.title==="Novo item no checklist")!,other=b.notices.find(n=>n.title==="Novo item no checklist")!;
 assert.equal((await POST(req(superA,"POST",{action:"read",ids:[other.id]}),undefined)).status,200);
 assert.ok(!(state.systemNoticeReads as {id:string}[]||[]).some(r=>r.id===other.id));
 const fieldResponse=await field.GET(req(superA,"GET",undefined,"/api/campo/notificacoes"),undefined);assert.equal(fieldResponse.status,200);const fieldData=await fieldResponse.json();assert.ok(fieldData.notices.some((x:{id:string})=>x.id===n.id));
 assert.equal((await POST(req(superA,"POST",{action:"read",ids:[n.id]}),undefined)).status,200);
 const after=await field.GET(req(superA,"GET",undefined,"/api/campo/notificacoes"),undefined);assert.equal((await after.json()).notices.find((x:{id:string})=>x.id===n.id).read,true);
 const all=await POST(req(superB,"POST",{action:"read-all"}),undefined);assert.equal((await all.json()).unread,0);
});
test("revoking assignment removes previous notices; reads persist across requests and are idempotent",async()=>{
 const old=await feed(superA),n=old.notices.find(n=>n.title==="Novo item no checklist")!;
 for(let i=0;i<2;i++)assert.equal((await POST(req(superA,"POST",{action:"read",ids:[n.id]}),undefined)).status,200);
 assert.equal((state.systemNoticeReads as {id:string,userId:string}[]).filter(r=>r.id===n.id&&r.userId===superA.id).length,1);
 (state.serviceOrders as {supervisorUserId:string}[])[0].supervisorUserId=superB.id;
 assert.ok(!(await feed(superA)).notices.some(r=>r.id===n.id));
});
test("pending conditions clear when underlying records resolve",async()=>{
 assert.ok((await feed(owner)).notices.some(n=>n.title==="Material sem estoque"));
 (state.materials as {currentStock:number}[])[0].currentStock=10;
 assert.ok(!(await feed(owner)).notices.some(n=>n.title==="Material sem estoque"));
 await runWithStore(async()=>{await ensureDatabaseReady();assert.equal(db.materials[0].currentStock,10);return Response.json({});});
});
