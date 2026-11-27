"use client";
import { useEffect, useState } from "react";
import { Autocomplete, Box, TextField, Typography } from "@mui/material";
import type { CustomerOption } from "@/lib/customer-options";

export function ServiceOrderCustomerSelect({ recent, value, onChange, onBlur, error, disabled }: {
  recent:CustomerOption[]; value:CustomerOption|null; onChange:(option:CustomerOption|null)=>void;
  onBlur:()=>void; error?:string; disabled?:boolean;
}) {
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState("");
  const [input,setInput]=useState("");
  const [result,setResult]=useState<{query:string;options:CustomerOption[]}|null>(null);
  const [failure,setFailure]=useState<{query:string;message:string}|null>(null);
  const term=query.trim();
  useEffect(()=>{
    if(!open)return;
    const controller=new AbortController();
    const timeout=window.setTimeout(async()=>{
      try {
        const response=await fetch("/api/service-orders/customer-options?q="+encodeURIComponent(term),{cache:"no-store",signal:controller.signal});
        if(!response.ok)throw Error("Não foi possível pesquisar clientes.");
        const data=await response.json() as {customers:CustomerOption[]};
        if(!controller.signal.aborted){setResult({query:term,options:data.customers});setFailure(null);}
      }catch(e){if(!controller.signal.aborted)setFailure({query:term,message:e instanceof Error?e.message:"Falha na pesquisa."});}
    },term?200:0);
    return()=>{controller.abort();window.clearTimeout(timeout);};
  },[open,term]);
  const options=failure?.query===term?[]:result?.query===term?result.options:term?[]:recent;
  const loading=open&&!!term&&result?.query!==term&&failure?.query!==term;
  return <Autocomplete<CustomerOption>
    open={open} onOpen={()=>{setOpen(true);setFailure(null);setResult(null);}} onClose={()=>setOpen(false)}
    disabled={disabled} value={value} inputValue={input}
    onChange={(_,option)=>{onChange(option);setInput(option?.name||"");setQuery("");}}
    onInputChange={(_,next,reason)=>{if(reason==="input"){setInput(next);if(value)onChange(null);setQuery(next);}else if(reason==="clear"){setInput("");setQuery("");}}}
    onBlur={()=>{setInput(value?.name||"");setQuery("");onBlur();}}
    options={value&&!options.some(o=>o.id===value.id)?[...options,value]:options} filterOptions={()=>options} getOptionLabel={option=>option.name}
    isOptionEqualToValue={(a,b)=>a.id===b.id}
    loading={loading} loadingText="Pesquisando clientes..."
    noOptionsText={failure?.query===term?failure.message:term?"Nenhum cliente encontrado.":"Nenhum cliente cadastrado."}
    renderOption={(props,option)=><Box component="li" {...props} key={option.id} sx={{display:"flex!important",flexDirection:"column",alignItems:"flex-start!important"}}><Typography fontWeight={700}>{option.name}</Typography>{(option.phone||option.email)&&<Typography variant="caption" color="text.secondary">{[option.phone,option.email].filter(Boolean).join(" • ")}</Typography>}</Box>}
    renderInput={params=><TextField {...params} label="Nome do cliente" placeholder="Selecione ou pesquise pelo nome" error={Boolean(error)} helperText={error||(!term?"5 últimos clientes cadastrados":"Digite o nome e selecione um resultado.")}/>}
  />;
}
