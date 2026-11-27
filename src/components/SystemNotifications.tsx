"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Box, Button, Chip, CircularProgress, Divider, Drawer, IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import type { NotificationKind, SystemNotice } from "@/lib/system-notifications";

type Feed = {newLeads:number;unread:number;total:number;notices:(SystemNotice & {read:boolean})[]};
const empty:Feed = {newLeads:0,unread:0,total:0,notices:[]};
const labels:Record<NotificationKind,string>={LEAD:"Leads",CHECKLIST:"Checklist",OPERATION:"Operações",STOCK:"Estoque",FINANCE:"Financeiro",COMMERCIAL:"Comercial",PEOPLE:"Pessoas",AGENDA:"Agenda"};
export function useSystemNotifications(userId?:string, pathname?:string) {
  const [snapshot,setSnapshot]=useState<{userId:string;feed:Feed}|null>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const sequence=useRef(0);
  const currentUser=useRef(userId); useEffect(()=>{currentUser.current=userId;},[userId]);
  const mutating=useRef(false);
  const refresh=useCallback(async()=>{
    if(!userId||mutating.current)return;
    const seq=++sequence.current;
    try{
      const r=await fetch("/api/notificacoes",{cache:"no-store",signal:AbortSignal.timeout(12000)});
      if(!r.ok){if((r.status===401||r.status===403)&&seq===sequence.current&&currentUser.current===userId)setSnapshot(null);throw Error("Não foi possível atualizar as notificações.");}
      const feed:Feed=await r.json();
      if(seq===sequence.current&&currentUser.current===userId){setSnapshot({userId,feed});setError("");}
    }catch(e){if(seq===sequence.current&&currentUser.current===userId)setError(e instanceof Error?e.message:"Falha de conexão.");}
  },[userId]);
  useEffect(()=>{
    if(!userId)return;
    const update=()=>{if(document.visibilityState==="visible")void refresh();};
    update();const timer=window.setInterval(update,30000);
    window.addEventListener("focus",update);document.addEventListener("visibilitychange",update);
    return()=>{++sequence.current;window.clearInterval(timer);window.removeEventListener("focus",update);document.removeEventListener("visibilitychange",update);};
  },[userId,refresh,pathname]);
  const mark=useCallback(async(ids:string[]|"all")=>{
    if(!userId||mutating.current)return false;
    mutating.current=true;++sequence.current;setBusy(true);setError("");
    try{
      const r=await fetch("/api/notificacoes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(ids==="all"?{action:"read-all"}:{action:"read",ids}),signal:AbortSignal.timeout(15000)});
      const result=await r.json();if(!r.ok){if((r.status===401||r.status===403)&&currentUser.current===userId)setSnapshot(null);throw Error(result.message||"Não foi possível marcar como lida.");}
      if(currentUser.current===userId)setSnapshot({userId,feed:result});return currentUser.current===userId;
    }catch(e){if(currentUser.current===userId)setError(e instanceof Error?e.message:"Falha de conexão.");return false;}
    finally{mutating.current=false;setBusy(false);}
  },[userId]);
  return {feed:snapshot?.userId===userId?snapshot?.feed??empty:empty,error,busy,refresh,mark,loaded:snapshot?.userId===userId&&!!snapshot};
}
export function SystemNotifications({state}:{state:ReturnType<typeof useSystemNotifications>}) {
  const router=useRouter(),[open,setOpen]=useState(false),[unreadOnly,setUnreadOnly]=useState(false);
  const {feed,error,busy,refresh,mark,loaded}=state;
  async function choose(n:Feed["notices"][number]){
    if(n.read||await mark([n.id])){setOpen(false);router.push(n.href);}
  }
  const visible=feed.notices.filter(n=>!unreadOnly||!n.read);
  return <>
    <Tooltip title="Notificações"><IconButton aria-label={feed.unread?"Notificações: "+feed.unread+" não lidas":"Notificações"} onClick={()=>{setOpen(true);void refresh();}}><Badge badgeContent={feed.unread} max={99} color="error"><NotificationsRoundedIcon/></Badge></IconButton></Tooltip>
    <Drawer anchor="right" open={open} onClose={()=>setOpen(false)} PaperProps={{sx:{width:{xs:"100%",sm:440},p:2}}}>
      <Stack spacing={1.5}>
        <Stack direction="row" alignItems="center" justifyContent="space-between"><Box><Typography variant="h6" fontWeight={850}>Notificações</Typography><Typography variant="body2" color="text.secondary">{feed.unread} não lida(s)</Typography></Box><Stack direction="row"><Tooltip title="Atualizar"><IconButton disabled={busy} aria-label="Atualizar notificações" onClick={()=>void refresh()}><RefreshRoundedIcon/></IconButton></Tooltip><IconButton aria-label="Fechar notificações" onClick={()=>setOpen(false)}><CloseRoundedIcon/></IconButton></Stack></Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap"><Button size="small" variant={!unreadOnly?"contained":"outlined"} onClick={()=>setUnreadOnly(false)}>Todas</Button><Button size="small" variant={unreadOnly?"contained":"outlined"} onClick={()=>setUnreadOnly(true)}>Não lidas</Button><Button size="small" disabled={!feed.unread||busy} onClick={()=>void mark("all")}>Marcar todas como lidas</Button></Stack>
        <Divider/>
        {error&&<Alert severity="warning">{error}</Alert>}
        {!loaded&&!error&&<Box sx={{textAlign:"center",py:3}}><CircularProgress size={24}/></Box>}
        {loaded&&!visible.length&&<Typography color="text.secondary" sx={{py:3,textAlign:"center"}}>{unreadOnly?"Nenhuma notificação não lida.":"Nenhuma notificação no momento."}</Typography>}
        {visible.map(n=><Paper key={n.id} variant="outlined" sx={{p:1.5,borderLeft:4,borderLeftColor:n.read?"divider":n.urgent?"error.main":"primary.main",bgcolor:n.read?"background.paper":"action.hover"}}>
          <Stack spacing={.7}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}><Chip label={labels[n.kind]} size="small" variant="outlined"/>{n.urgent&&<Chip color="error" label="Atenção" size="small"/>}{!n.read&&<Box sx={{width:8,height:8,borderRadius:"50%",bgcolor:"primary.main",ml:"auto"}}/>}</Stack>
            <Typography fontWeight={n.read?650:850}>{n.title}</Typography><Typography variant="body2" color="text.secondary" sx={{overflowWrap:"anywhere"}}>{n.body}</Typography>
            {n.createdAt&&Number.isFinite(Date.parse(n.createdAt))&&<Typography variant="caption" color="text.secondary">{/^\d{4}-\d{2}-\d{2}$/.test(n.createdAt)?n.createdAt.split("-").reverse().join("/"):new Date(n.createdAt).toLocaleString("pt-BR")}</Typography>}
            <Stack direction="row" alignItems="center" justifyContent="space-between"><Button size="small" disabled={busy} onClick={()=>void choose(n)}>Abrir registro</Button>{!n.read?<Tooltip title="Marcar como lida"><IconButton size="small" disabled={busy} aria-label="Marcar como lida" onClick={()=>void mark([n.id])}><CheckCircleOutlineRoundedIcon fontSize="small"/></IconButton></Tooltip>:<Typography variant="caption" color="text.secondary">Lida</Typography>}</Stack>
          </Stack>
        </Paper>)}
        {feed.total>feed.notices.length&&<Typography variant="caption" color="text.secondary">Exibindo até 100 notificações, priorizando as não lidas. Marque as lidas para atualizar a lista.</Typography>}
      </Stack>
    </Drawer>
  </>;
}
