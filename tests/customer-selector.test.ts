import assert from "node:assert/strict";
import {beforeEach,test} from "node:test";
import {NextRequest} from "next/server";
import {customerOptions} from "../src/lib/customer-options";
import type {Customer,SessionUser} from "../src/lib/types";
process.env.DATABASE_URL="";
process.env.SUPABASE_URL="https://customer-fixture.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY="test-only";
process.env.JWT_SECRET="test-only-secret-at-least-thirty-two-characters";
process.env.APP_URL="http://localhost:3000";
const {GET}=await import("../src/app/api/service-orders/customer-options/route");
const {POST}=await import("../src/app/api/service-orders/route");
const {signSessionToken}=await import("../src/lib/session-token");
const owner:SessionUser={id:"owner",name:"Owner",email:"owner@example.test",role:"OWNER",isActive:true};
const manager:SessionUser={...owner,id:"manager",role:"GERENTE"};
const worker:SessionUser={...owner,id:"worker",role:"COLABORADOR"};
const customer=(id:string,name:string):Customer=>({id,name,phone:"62999999999",email:"",document:"secret",notes:"secret",type:"PERSON",source:"test",totalValue:0,lastService:""});
const customers=[customer("8","Ana"),customer("7","Maria"),customer("6","José Silva"),customer("5","Paulo"),customer("4","Alice"),customer("3","João Silva"),customer("2","José Silva"),customer("1","Beatriz")];
let state:Record<string,unknown>,version:string;
beforeEach(()=>{
 state={users:[owner,manager,worker].map(u=>({...u,createdAt:"2026-01-01",updatedAt:"2026-01-01"})),customers:structuredClone(customers),serviceOrders:[]};version="2026-01-01T00:00:00.000Z";
 globalThis.fetch=async(input,init)=>{
  const url=new URL(String(input));assert.equal(url.origin,"https://customer-fixture.invalid");
  assert.equal(url.pathname,"/rest/v1/app_state");
  if(!init?.method||init.method==="GET")return Response.json([{data:structuredClone(state),updated_at:version}]);
  if(init.method==="PATCH"){if(url.searchParams.get("updated_at")!=="eq."+version)return Response.json([]);const p=JSON.parse(String(init.body));state=structuredClone(p.data);version=p.updated_at;return Response.json([{updated_at:version}]);}
  throw Error("Unexpected method");
 };
});
function request(path:string,user:SessionUser|null=owner,body?:unknown){return new NextRequest("http://localhost:3000"+path,{method:body?"POST":"GET",headers:{"Content-Type":"application/json",...(user?{cookie:"floor_session="+signSessionToken(user)}:{})},...(body?{body:JSON.stringify(body)}:{})});}
test("five latest, whole database, accent insensitive and homonyms",()=>{
 assert.deepEqual(customerOptions(customers).map(c=>c.id),["8","7","6","5","4"]);
 assert.deepEqual(customerOptions(customers,"joao si").map(c=>c.id),["3"]);
 assert.deepEqual(customerOptions(customers,"jose silva").map(c=>c.id),["6","2"]);
 assert.deepEqual(customerOptions(customers,"não existe"),[]);
 assert.ok(!("document" in customerOptions(customers)[0]));
});
test("search endpoint authorizes only owner and manager and exposes minimal fields",async()=>{
 assert.equal((await GET(request("/api/service-orders/customer-options",null),undefined)).status,401);
 assert.equal((await GET(request("/api/service-orders/customer-options",worker),undefined)).status,403);
 const res=await GET(request("/api/service-orders/customer-options?q=joao",manager),undefined);
 assert.equal(res.status,200);assert.deepEqual((await res.json()).customers,[{id:"3",name:"João Silva",phone:"62999999999",email:""}]);
});
test("order requires existing customer ID and uses canonical name without duplicate creation",async()=>{
 const base={title:"Limpeza da obra",address:"Rua de teste",scheduledStart:"2026-12-01T09:00:00Z",scheduledEnd:"2026-12-01T11:00:00Z",customerName:"Nome adulterado"};
 assert.equal((await POST(request("/api/service-orders",owner,base),undefined)).status,400);
 assert.equal((await POST(request("/api/service-orders",owner,{...base,customerId:"inexistente"}),undefined)).status,404);
 const res=await POST(request("/api/service-orders",owner,{...base,customerId:"2"}),undefined);
 assert.equal(res.status,201);const order=(await res.json()).serviceOrder;assert.equal(order.customerId,"2");assert.equal(order.customerName,"José Silva");assert.equal((state.customers as Customer[]).length,8);assert.equal((state.serviceOrders as unknown[]).length,1);
});
