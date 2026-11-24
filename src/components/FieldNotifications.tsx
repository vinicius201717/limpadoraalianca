"use client";
import {useCallback,useEffect,useState} from "react";
import {Alert,Badge,Box,Button,Drawer,IconButton,Paper,Stack,Typography} from "@mui/material";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
type Notice={id:string;orderId:string;title:string;body:string;createdAt:string;read:boolean;kind:string};
type Info={notices:Notice[];publicKey:string;pushConfigured:boolean};
async function post(data:unknown){const r=await fetch("/api/campo/notificacoes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});if(!r.ok)throw new Error((await r.json().catch(()=>({}))).message||"Não foi possível salvar.");}
function decodeKey(s:string){const b=atob(s.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(s.length/4)*4,"="));return Uint8Array.from(b,c=>c.charCodeAt(0));}
export function FieldNotifications({userId,color,onChoose}:{userId:string;color:string;onChoose:(id:string)=>void}){
 const [info,setInfo]=useState<Info>({notices:[],publicKey:"",pushConfigured:false});
 const [open,setOpen]=useState(false),[subscribed,setSubscribed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const refresh=useCallback(async()=>{if(!userId)return;const r=await fetch("/api/campo/notificacoes",{cache:"no-store"});if(!r.ok)throw new Error("Não foi possível consultar avisos.");setInfo(await r.json());},[userId]);
 useEffect(()=>{if(!userId)return;let live=true;const update=()=>{if(live&&document.visibilityState==="visible")void refresh().catch(()=>{});};update();const timer=setInterval(update,90000);document.addEventListener("visibilitychange",update);return()=>{live=false;clearInterval(timer);document.removeEventListener("visibilitychange",update);};},[userId,refresh]);
 useEffect(()=>{if(!userId||!("serviceWorker" in navigator))return;let live=true;void navigator.serviceWorker.getRegistration("/campo").then(r=>r?.pushManager?.getSubscription()).then(s=>{if(live)setSubscribed(!!s);}).catch(()=>{});return()=>{live=false;};},[userId,open]);
 async function enable(){
  setBusy(true);setError("");
  try{
   if(!info.pushConfigured)throw new Error("Envio push ainda não ativado no servidor. Os avisos internos já funcionam.");
   if(!("Notification" in window)||!("serviceWorker" in navigator)||!("PushManager" in window))throw new Error("Instale o Aliança Campo na tela inicial e use um navegador compatível.");
   const permission=await Notification.requestPermission();if(permission!=="granted")throw new Error("Permita notificações nas configurações do dispositivo.");
   const registration=await navigator.serviceWorker.register("/campo-sw.js",{scope:"/campo"});await navigator.serviceWorker.ready;
   let sub=await registration.pushManager.getSubscription();
   if(!sub)sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(info.publicKey)});
   const json=sub.toJSON();await post({action:"subscribe",endpoint:json.endpoint,keys:json.keys});setSubscribed(true);
  }catch(e){setError(e instanceof Error?e.message:"Falha ao ativar notificações.");}finally{setBusy(false);}
 }
 const [testSent,setTestSent]=useState(false);
 async function testPush(){
  setBusy(true);setError("");setTestSent(false);
  try{
   const r=await navigator.serviceWorker.getRegistration("/campo");
   const sub=await r?.pushManager?.getSubscription();
   if(!sub)throw new Error("Ative as notificacoes neste aparelho primeiro.");
   await post({action:"test",endpoint:sub.endpoint});setTestSent(true);
  }catch(e){setError(e instanceof Error?e.message:"Falha no teste.");}finally{setBusy(false);}
 }
 async function disable(){
  setBusy(true);setError("");
  try{const r=await navigator.serviceWorker.getRegistration("/campo");const s=await r?.pushManager?.getSubscription();if(s){await post({action:"unsubscribe",endpoint:s.endpoint});await s.unsubscribe();}setSubscribed(false);}catch(e){setError(e instanceof Error?e.message:"Falha ao desativar.");}finally{setBusy(false);}
 }
 async function read(n:Notice){try{await post({action:"read",ids:[n.id]});setInfo(v=>({...v,notices:v.notices.map(x=>x.id===n.id?{...x,read:true}:x)}));if(n.kind!=="FINANCE"){onChoose(n.orderId);setOpen(false);}}catch(e){setError(e instanceof Error?e.message:"Falha ao abrir aviso.");}}
 useEffect(()=>{const show=()=>{setOpen(true);void refresh().catch(()=>{});};const listener=(e:MessageEvent)=>{if(e.data?.type==="CAMPO_OPEN_NOTICES")show();};navigator.serviceWorker?.addEventListener("message",listener);if(new URLSearchParams(location.search).has("avisos")){const t=setTimeout(show,0);return()=>{clearTimeout(t);navigator.serviceWorker?.removeEventListener("message",listener);};}return()=>navigator.serviceWorker?.removeEventListener("message",listener);},[refresh]);
 const unread=info.notices.filter(n=>!n.read).length;
 return <><IconButton size="small" title="Avisos e notificações" aria-label="Avisos e notificações" sx={{color}} onClick={()=>{setOpen(true);void refresh().catch(e=>setError(e.message));}}><Badge badgeContent={unread} color="error" max={99}><NotificationsRoundedIcon/></Badge></IconButton>
 <Drawer anchor="right" open={open} onClose={()=>setOpen(false)} sx={{zIndex:1800}} PaperProps={{sx:{width:{xs:"100%",sm:420},p:2}}}>
 <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6" fontWeight={800}>Avisos da Aliança</Typography><IconButton aria-label="Fechar avisos" onClick={()=>setOpen(false)}><CloseRoundedIcon/></IconButton></Stack>
 <Typography variant="body2" color="text.secondary" sx={{my:1}}>Lembretes de obra, organização, checklist e informações importantes.</Typography>
 {error&&<Alert severity="warning" sx={{my:1}}>{error}</Alert>}
 <Button variant="contained" disabled={busy||!info.pushConfigured} onClick={()=>void enable()}>{subscribed?"Revalidar notificações neste aparelho":"Ativar notificações no celular"}</Button>
 {subscribed&&<Button variant="outlined" disabled={busy||!info.pushConfigured} onClick={()=>void testPush()}>Enviar teste push neste aparelho</Button>}
 {testSent&&<Alert severity="success" sx={{my:1}}>Envio aceito pelo servico push. Confira se a mensagem chegou ao aparelho.</Alert>}
 {subscribed&&<Button disabled={busy} onClick={()=>void disable()}>Desativar neste aparelho</Button>}
 {!info.pushConfigured&&<Alert severity="info" sx={{my:1}}>Avisos internos ativos. Push externo aguarda configuração.</Alert>}
 <Stack gap={1.2} sx={{mt:2}}>{info.notices.length?info.notices.map(n=><Paper variant="outlined" key={n.id} sx={{p:1.5,borderLeft: n.read?undefined:"4px solid #16805c"}}><Typography fontWeight={750}>{n.title}</Typography><Typography variant="caption" color="text.secondary">{new Date(n.createdAt).toLocaleString("pt-BR")}</Typography><Typography variant="body2" sx={{my:1}}>{n.body}</Typography><Button size="small" onClick={()=>void read(n)}>{n.kind==="FINANCE"?(n.read?"Lido":"Marcar como lido"):(n.read?"Abrir":"Ler e abrir")}</Button></Paper>):<Box color="text.secondary">Nenhum aviso no momento.</Box>}</Stack>
 </Drawer></>;
}
