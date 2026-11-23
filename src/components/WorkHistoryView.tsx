"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Box, Button, Chip, Divider, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import type { FinancialDocument, WorkHistoryEntry, WorkReport } from "@/lib/whatsapp-types";

const kinds = { DIARY: "Diário da obra", CHECKLIST: "Checklist", ASSIGNMENT: "Responsável", TRANSFER: "Transferência", WARNING: "Advertência interna", FINANCIAL: "Financeiro" };
type HistoryData = { title: string; entries: WorkHistoryEntry[]; documents: FinancialDocument[]; reports: WorkReport[] };
async function fetchHistory(orderId: string, signal?: AbortSignal): Promise<HistoryData> {
  const response = await fetch(`/api/service-orders/${encodeURIComponent(orderId)}/history`, { cache: "no-store", signal });
  const result = await response.json(); if (!response.ok) throw new Error(result.message || "Não foi possível carregar o histórico.");
  return result;
}
export function WorkHistoryView({ orderId }: { orderId: string }) {
  const [data, setData] = useState<HistoryData | null>(null);
  const [error, setError] = useState(""); const [generating, setGenerating] = useState(false);
  useEffect(() => { const controller = new AbortController(); void fetchHistory(orderId, controller.signal).then((result) => { if (!controller.signal.aborted) setData(result); }).catch((cause) => { if (!controller.signal.aborted) setError(cause.message); }); return () => controller.abort(); }, [orderId]);
  async function report() {
    setGenerating(true); setError("");
    try { const response = await fetch(`/api/service-orders/${encodeURIComponent(orderId)}/history/report`, { method: "POST" }); const result = await response.json(); if (!response.ok) throw new Error(result.message || "Não foi possível gerar o relatório."); setData(await fetchHistory(orderId)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao gerar o relatório."); }
    finally { setGenerating(false); }
  }
  return <Stack spacing={3} sx={{ maxWidth: 1100, mx: "auto" }}>
    <Box><Typography variant="h4">Histórico da obra</Typography><Typography color="text.secondary">{data?.title || "Carregando obra…"}</Typography></Box>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}><Button component={Link} href={`/ordens-servico/${encodeURIComponent(orderId)}`}>Voltar à obra</Button><Button component={Link} href="/assistente-whatsapp">Assistente WhatsApp</Button><Button variant="contained" startIcon={<AutoAwesomeRoundedIcon />} disabled={generating || !data} onClick={() => void report()}>{generating ? "Gerando relatório…" : "Gerar relatório com IA"}</Button></Stack>
    {error && <Alert severity="error" role="alert">{error}</Alert>}{(!data && !error || generating) && <LinearProgress aria-label="Carregando histórico ou relatório" />}
    {data?.reports.slice(-3).reverse().map((entry) => <Paper key={entry.id} variant="outlined" sx={{ p: 3, borderRadius: 3 }}><Stack spacing={1.5}><Typography variant="h6">Relatório de {new Date(entry.createdAt).toLocaleString("pt-BR")}</Typography><Typography variant="body2" color="text.secondary">Gerado por IA com os registros disponíveis nessa data. Confira as fontes indicadas no texto.</Typography><Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{entry.content}</Typography></Stack></Paper>)}
    {!!data?.documents.length && <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}><Stack spacing={2}><Typography variant="h6">Comprovantes</Typography>{data.documents.slice().reverse().map((entry) => <Box key={entry.id}><Typography fontWeight={700}>{entry.description}</Typography><Typography variant="body2" color="text.secondary">{entry.direction === "ARCHIVE" ? "Arquivado, sem alteração de saldo" : entry.direction === "EXPENSE" ? "Despesa lançada" : "Recebimento registrado"}{entry.amount ? ` · R$ ${entry.amount.toFixed(2)}` : ""}</Typography><Button href={`/api/whatsapp/media/${entry.attachment.id}`} startIcon={<DownloadRoundedIcon />}>{entry.attachment.fileName}</Button></Box>)}</Stack></Paper>}
    {data?.entries.length === 0 && <Alert severity="info">Ainda não há registros no histórico. Envie um relato pelo WhatsApp e informe esta obra.</Alert>}
    {data?.entries.slice().reverse().map((entry) => <Paper key={entry.id} variant="outlined" sx={{ p: 3, borderRadius: 3 }}><Stack spacing={1.5}>
      <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Chip size="small" label={kinds[entry.kind]} /><Typography variant="caption" color="text.secondary">{entry.authorName} · {new Date(entry.createdAt).toLocaleString("pt-BR")}</Typography></Stack>
      <Typography variant="h6">{entry.title}</Typography><Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{entry.content}</Typography>
      {entry.transcript && <Box component="details"><Typography component="summary" sx={{ cursor: "pointer", color: "text.secondary" }}>Ver relato original</Typography><Typography variant="body2" sx={{ mt: 1, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{entry.transcript}</Typography></Box>}
      {entry.attachment && <Button href={`/api/whatsapp/media/${entry.attachment.id}`} startIcon={<DownloadRoundedIcon />} sx={{ alignSelf: "flex-start" }}>Baixar {entry.attachment.mimeType.startsWith("audio/") ? "áudio original" : "anexo"}</Button>}
      <Divider /><Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>Registro {entry.id}</Typography>
    </Stack></Paper>)}
  </Stack>;
}
