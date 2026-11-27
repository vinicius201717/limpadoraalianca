"use client";
import { useState } from "react";
import { Alert, Box, Button, Chip, Paper, Stack, Tab, Tabs, Typography } from "@mui/material";
import { UserIdentityFields } from "./UserIdentityFields";
import { emptyIdentity, formatCpf, validCpf } from "@/lib/user-identity-schema";

type Summary = { cpf: string; address: string; updatedAt: string };
export function UserIdentitySummary({ userId, complete }: { userId: string; complete: boolean }) {
  const [tab, setTab] = useState(0), [summary, setSummary] = useState<Summary | null>(null), [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState(emptyIdentity), [editing, setEditing] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [photos, setPhotos] = useState<{ front: string; back: string } | null>(null), [hasIdentity, setHasIdentity] = useState(complete);
  async function togglePhotos() {
    if (photos) { setPhotos(null); return; }
    setBusy(true); setError("");
    try { const r = await fetch(endpoint + "?side=both", { cache: "no-store" }); const data = await r.json(); if (!r.ok) throw Error(data.message); setPhotos({ front: data.front, back: data.back }); }
    catch (e) { setError(e instanceof Error ? e.message : "Falha ao consultar fotos."); } finally { setBusy(false); }
  }
  const endpoint = "/api/users/" + encodeURIComponent(userId) + "/identity";
  async function load() {
    setBusy(true); setError("");
    try {
      const r = await fetch(endpoint, { cache: "no-store" }), data = await r.json();
      if (!r.ok) throw Error(data.message);
      setSummary(data.identity); setHasIdentity(Boolean(data.identity)); setLoaded(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao consultar documentacao."); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!validCpf(draft.cpf) || !draft.front || !draft.back) { setError("Informe CPF valido e frente e verso."); return; }
    setBusy(true); setError("");
    try {
      const r = await fetch(endpoint, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) }), data = await r.json();
      if (!r.ok) throw Error(data.message);
      setEditing(false); setDraft(emptyIdentity()); setPhotos(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao salvar documentacao."); }
    finally { setBusy(false); }
  }
  return <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}><Stack spacing={2}>
    <Typography variant="h5">Ficha cadastral</Typography>
    <Tabs value={tab} onChange={(_, value: number) => { if (busy) return; setTab(value); setPhotos(null); setSummary(null); setLoaded(false); setEditing(false); setDraft(emptyIdentity()); setError(""); }}>
      <Tab label="Resumo" /><Tab label="Documentacao" />
    </Tabs>
    {error && <Alert severity="error">{error}</Alert>}
    {tab === 0 ? <Stack spacing={1}><Box><Chip color={hasIdentity ? "success" : "warning"} label={hasIdentity ? "Documentacao cadastrada" : "Documentacao pendente"} /></Box><Typography color="text.secondary">CPF e fotos ficam protegidos. Consulte a aba Documentacao para visualizar ou atualizar.</Typography></Stack> :
      <Stack spacing={2}>
        {!loaded && <Button variant="outlined" disabled={busy} onClick={() => void load()}>Consultar dados protegidos</Button>}
        {loaded && !editing && (summary ? <Stack spacing={1}><Typography>CPF: {formatCpf(summary.cpf)}</Typography><Typography>Endereco: {summary.address || "Nao informado"}</Typography><Typography variant="caption">Atualizado em {new Date(summary.updatedAt).toLocaleString("pt-BR")}</Typography><Button disabled={busy} onClick={() => void togglePhotos()}>{photos ? "Ocultar fotos" : "Visualizar documentos"}</Button></Stack> : <Alert severity="warning">Cadastro anterior sem documentacao. Regularize o registro.</Alert>)}
        {photos && !editing && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>{(["front", "back"] as const).map(side => <Stack key={side}><Typography>{side === "front" ? "Frente" : "Verso"}</Typography><Box component="img" alt={"Documento: " + side} src={photos[side]} sx={{ width: "100%", maxHeight: 420, objectFit: "contain" }} /></Stack>)}</Box>}
        {loaded && !editing && <Button variant="contained" disabled={busy} onClick={() => { setDraft({ ...emptyIdentity(), cpf: formatCpf(summary?.cpf || ""), address: summary?.address || "" }); setEditing(true); setPhotos(null); }}>{summary ? "Atualizar documentacao" : "Completar cadastro"}</Button>}
        {editing && <><UserIdentityFields value={draft} onChange={setDraft} disabled={busy} /><Stack direction="row" gap={1}><Button disabled={busy} onClick={() => { setEditing(false); setDraft(emptyIdentity()); }}>Cancelar</Button><Button variant="contained" disabled={busy} onClick={() => void save()}>Salvar documentacao</Button></Stack></>}
      </Stack>}
  </Stack></Paper>;
}
