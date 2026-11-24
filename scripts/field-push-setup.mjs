// Run locally. Generates NEW keys only; do not rotate existing subscriptions.
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { generateVAPIDKeys } from "web-push";
const subject=process.argv[2];
if(!subject||!(/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(subject)||/^https:\/\/[^\s]+$/.test(subject)))throw new Error("Informe mailto:email da empresa ou URL HTTPS oficial.");
const keys=generateVAPIDKeys();
const path=".env.push.local";
writeFileSync(path,["FIELD_VAPID_PUBLIC_KEY="+keys.publicKey,"FIELD_VAPID_PRIVATE_KEY="+keys.privateKey,"FIELD_VAPID_SUBJECT="+subject,"CRON_SECRET="+randomBytes(32).toString("hex"),"FIELD_REMINDER_HOURS=9,12,16"].join("\n")+"\n",{flag:"wx",mode:0o600});
console.log("Arquivo local criado: "+path+". Não envie para Git nem chat. Configure as variáveis na Vercel, preservando CRON_SECRET existente se houver.");
