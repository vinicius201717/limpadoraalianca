"use client";
import {useEffect,useState} from "react";
import {Alert,Box,Button,Chip,CircularProgress,MenuItem,Paper,Stack,Table,TableBody,TableCell,TableContainer,TableHead,TableRow,TextField,Typography} from "@mui/material";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import {reportKinds,reportLabels,type ManagementReport,type ReportQuery} from "@/lib/management-report-query";
const defaults:ReportQuery={kind:"services",period:"30",subject:""};
const periods=[["today","Hoje"],["7","Últimos 7 dias"],["30","Últimos 30 dias"],["month","Este mês"],["all","Todo o período"]];
export function ManagementReportsPanel({initialQuery=defaults,compact=false}:{initialQuery?:ReportQuery;compact?:boolean}){
 const [draft,setDraft]=useState<ReportQuery>(initialQuery),[query,setQuery]=useState<ReportQuery>(initialQuery),[refresh,setRefresh]=useState(0);
 const [data,setData]=useState<ManagementReport|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[page,setPage]=useState(0);
 const pageSize=compact?8:20;
 useEffect(()=>{const abort=new AbortController();void(async()=>{
  try{const params=new URLSearchParams(query);const r=await fetch("/api/relatorios/gerenciais?"+params,{cache:"no-store",signal:abort.signal});const result=await r.json();if(!r.ok)throw new Error(result.message||"Não foi possível consultar o relatório.");if(!abort.signal.aborted){setData(result.report);setError("");setLoading(false);}}
  catch(e){if(!abort.signal.aborted){setData(null);setError(e instanceof Error?e.message:"Falha ao consultar.");setLoading(false);}}
 })();return()=>abort.abort();},[query,refresh]);
 const apply=(next:ReportQuery)=>{setData(null);setError("");setLoading(true);setPage(0);setQuery(next);setRefresh(v=>v+1);};
 return <Paper variant="outlined" sx={{p:compact?1.4:{xs:2,md:2.5},borderRadius:3,minWidth:0}}>
 <Stack spacing={2}>
 <Stack direction="row" gap={1.2} alignItems="center"><AssessmentRoundedIcon color="primary"/><Box flex={1}><Typography variant={compact?"h6":"h5"} fontWeight={850}>Relatórios gerenciais</Typography><Typography variant="body2" color="text.secondary">Indicadores dos registros da empresa · Direção e gerência</Typography></Box><Button size="small" aria-label="Atualizar relatório" onClick={()=>apply(query)} startIcon={<ReplayRoundedIcon/>}>Atualizar</Button></Stack>
 <Stack direction="row" flexWrap="wrap" useFlexGap gap={.8}>{reportKinds.map(kind=><Chip key={kind} label={reportLabels[kind]} color={draft.kind===kind?"primary":"default"} variant={draft.kind===kind?"filled":"outlined"} onClick={()=>{const next={...draft,kind,subject:""};setDraft(next);apply(next);}}/>)}</Stack>
 <Box component="form" onSubmit={e=>{e.preventDefault();apply({...draft,subject:draft.subject.trim()});}} sx={{display:"flex",flexWrap:"wrap",gap:1}}>
 <TextField select size="small" label="Período" value={draft.period} onChange={e=>setDraft(v=>({...v,period:e.target.value as ReportQuery["period"]}))} sx={{minWidth:150,flex:1}}>{periods.map(([value,label])=><MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
 <TextField size="small" label="Nome, obra ou produto" value={draft.subject} onChange={e=>setDraft(v=>({...v,subject:e.target.value.slice(0,160)}))} sx={{minWidth:160,flex:2}}/>
 <Button type="submit" variant="contained">Consultar</Button></Box>
 {loading&&<Stack alignItems="center" py={3}><CircularProgress size={26}/></Stack>}
 {error&&<Alert severity="error">{error}</Alert>}
 {data&&!loading&&<><Box><Typography fontWeight={800}>{data.title}</Typography><Typography variant="caption" color="text.secondary">{data.periodLabel} · Atualizado {new Date(data.generatedAt).toLocaleString("pt-BR")}</Typography></Box>
 <Box sx={{display:"grid",gridTemplateColumns:{xs:"repeat(2,minmax(0,1fr))",md:compact?"repeat(2,minmax(0,1fr))":"repeat(4,minmax(0,1fr))"},gap:1}}>{data.metrics.map(m=><Paper key={m.label} variant="outlined" sx={{p:1.3,borderRadius:2}}><Typography variant="caption" color="text.secondary">{m.label}</Typography><Typography fontWeight={850} sx={{fontSize:{xs:18,md:22},overflowWrap:"anywhere"}}>{m.value}</Typography></Paper>)}</Box>
 <Typography variant="caption" color="text.secondary">{data.note}</Typography>
 {!data.matched?<Alert severity="info">Nenhum registro corresponde aos filtros.</Alert>:<><TableContainer sx={{maxWidth:"100%",overflowX:"auto",border:1,borderColor:"divider",borderRadius:2}}><Table size="small"><TableHead><TableRow>{data.columns.map(c=><TableCell key={c} sx={{fontWeight:800,minWidth:110}}>{c}</TableCell>)}</TableRow></TableHead><TableBody>{data.rows.slice(page*pageSize,(page+1)*pageSize).map(row=><TableRow key={row.id} hover>{row.cells.map((c,i)=><TableCell key={i} sx={{fontWeight:i===0?750:400,minWidth:i===0?150:undefined}}>{c}</TableCell>)}</TableRow>)}</TableBody></Table></TableContainer>
 <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}><Typography variant="caption">{data.matched} registros{data.matched>data.rows.length?" · primeiras 1.000 linhas":""}</Typography><Stack direction="row"><Button size="small" disabled={!page} onClick={()=>setPage(v=>v-1)}>Anterior</Button><Button size="small" disabled={(page+1)*pageSize>=data.rows.length} onClick={()=>setPage(v=>v+1)}>Próximo</Button></Stack></Stack></>}
 </>}
 </Stack></Paper>;
}
