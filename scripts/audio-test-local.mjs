// Isolated test database and localhost gateway. No production database or WhatsApp connections.
import { DatabaseSync } from "node:sqlite";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { audioTestData } from "./audio-test-data.mjs";
if(process.env.VERCEL)throw new Error("Local only.");
const mainId="floor-restoration-manager-owner-only";
const file=resolve("data","audio-test.sqlite");mkdirSync(resolve("data"),{recursive:true});
const database=new DatabaseSync(file);
database.exec("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS app_state (id TEXT PRIMARY KEY,data TEXT NOT NULL,updated_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS media (path TEXT PRIMARY KEY,content BLOB NOT NULL,mime TEXT NOT NULL,token TEXT NOT NULL)");
const get=database.prepare("SELECT data,updated_at FROM app_state WHERE id=?");
const insert=database.prepare("INSERT INTO app_state(id,data,updated_at) VALUES(?,?,?)");
const update=database.prepare("UPDATE app_state SET data=?,updated_at=? WHERE id=? AND updated_at=?");
if(!get.get(mainId)){const data=await audioTestData();insert.run(mainId,JSON.stringify(data),new Date().toISOString());}
const state=JSON.parse(get.get(mainId).data);
console.log("Base de ensaio:",file);
console.log(JSON.stringify(Object.fromEntries(Object.entries(state).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,v.length])),null,2));
if(process.argv.includes("--seed-only")){database.close();process.exit(0);}
const port=3328, appPort=3327, gatewayKey=randomBytes(32).toString("hex");
const origin="http://127.0.0.1:"+port;
function json(res,status,body){res.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store"});res.end(JSON.stringify(body));}
async function body(req,max=20*1024*1024){const chunks=[];let len=0;for await(const chunk of req){len+=chunk.length;if(len>max)throw new Error("too large");chunks.push(chunk);}return Buffer.concat(chunks);}
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,origin);
    const authorized=req.headers.authorization==="Bearer "+gatewayKey&&req.headers.apikey===gatewayKey;
    const readMedia=/^\/storage\/v1\/object\/sign\/([^/]+)\/(campo\/[0-9a-f-]{36})$/.exec(url.pathname);
    if(req.method==="GET"&&readMedia){
      const row=database.prepare("SELECT * FROM media WHERE path=?").get(readMedia[2]);
      if(!row||url.searchParams.get("token")!==row.token)return json(res,403,{});
      res.writeHead(200,{"Content-Type":row.mime,"Content-Length":row.content.length,"Cache-Control":"no-store"});return res.end(row.content);
    }
    if(!authorized)return json(res,401,{});
    if(url.pathname==="/rest/v1/app_state"){
      const id=url.searchParams.get("id")?.replace(/^eq\./,"");
      const allowed=x=>x===mainId||/^security-rate-[a-z0-9-]+$/.test(x||"");
      if(req.method==="GET"&&allowed(id)){const row=get.get(id);return json(res,200,row?[{data:JSON.parse(row.data),updated_at:row.updated_at}]:[]);}
      const p=JSON.parse((await body(req)).toString());
      if(req.method==="POST"&&allowed(p.id)){if(get.get(p.id))return json(res,409,{});insert.run(p.id,JSON.stringify(p.data),p.updated_at);return json(res,201,p);}
      if(req.method==="PATCH"&&allowed(id)){const changed=update.run(JSON.stringify(p.data),p.updated_at,id,url.searchParams.get("updated_at")?.replace(/^eq\./,""));return json(res,200,changed.changes?[{updated_at:p.updated_at}]:[]);}
      return json(res,400,{});
    }
    if(url.pathname.startsWith("/storage/v1/bucket/"))return json(res,200,{public:false});
    const media=/^\/storage\/v1\/object\/(?:authenticated\/)?([^/]+)\/(campo\/[0-9a-f-]{36})$/.exec(url.pathname);
    if(media&&req.method==="POST"){
      const bytes=await body(req,4*1024*1024);database.prepare("INSERT INTO media(path,content,mime,token) VALUES(?,?,?,?)").run(media[2],bytes,req.headers["content-type"]||"application/octet-stream",randomBytes(32).toString("hex"));return json(res,200,{Key:media[2]});
    }
    if(media&&["GET","HEAD"].includes(req.method)){
      const row=database.prepare("SELECT * FROM media WHERE path=?").get(media[2]);if(!row)return json(res,404,{});
      res.writeHead(200,{"Content-Type":row.mime,"Content-Length":row.content.length});return res.end(req.method==="HEAD"?undefined:row.content);
    }
    if(readMedia&&req.method==="POST"){
      const row=database.prepare("SELECT token FROM media WHERE path=?").get(readMedia[2]);if(!row)return json(res,404,{});
      return json(res,200,{signedURL:url.pathname+"?token="+row.token});
    }
    return json(res,404,{});
  }catch{return json(res,500,{message:"Erro no banco local de ensaio"});}
});
await new Promise((ok,no)=>{server.once("error",no);server.listen(port,"127.0.0.1",ok);});
const env={...process.env,DATABASE_URL:"",SUPABASE_URL:origin,SUPABASE_SERVICE_ROLE_KEY:gatewayKey,JWT_SECRET:randomBytes(32).toString("hex"),APP_URL:"http://localhost:"+appPort,OPENAI_TRANSCRIPTION_MODEL:"gpt-transcribe",OPENAI_ASSISTANT_MODEL:"gpt-4.1-mini",FIELD_VAPID_PUBLIC_KEY:"",FIELD_VAPID_PRIVATE_KEY:"",CRON_SECRET:"",WHATSAPP_ACCESS_TOKEN:"",WHATSAPP_PHONE_NUMBER_ID:"",WHATSAPP_APP_SECRET:"",WHATSAPP_WORKER_SECRET:""};
console.log(env.OPENAI_API_KEY?"OpenAI: chave local disponível, chamadas reais habilitadas.":"OpenAI: sem chave local, teste de áudio real indisponível.");
console.log("PWA de TESTE: http://localhost:"+appPort+"/campo");
const mode=process.argv.includes("--use-build")&&existsSync(".next/BUILD_ID")?["start"]:["dev","--webpack"];
const child=spawn(process.execPath,["node_modules/next/dist/bin/next",...mode,"-H","127.0.0.1","-p",String(appPort)],{env,stdio:"inherit"});
function close(){child.kill();server.close();database.close();}
process.on("SIGINT",close);process.on("SIGTERM",close);
child.on("exit",code=>{server.close();database.close();process.exitCode=code||0;});
