"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Chip, Divider, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import type { SessionUser } from "@/lib/types";
import { canManageWhatsAppOperations } from "@/lib/whatsapp-schema";

type Connection = {
  ready: boolean; missing: string[]; linked: boolean; phone: string | null; linkedAt: string | null; chatUrl: string | null;
  orders: Array<{ id: string; title: string }>;
  messages: Array<{ id: string; text: string; status: string; reply?: string; createdAt: string; error?: string; replySentAt?: string; replyDeliveryStatus?: string; replyErrorCodes?: number[] }>;
};
const statusLabel: Record<string, string> = { QUEUED: "Na fila", PROCESSING: "Interpretando", DONE: "Processada", FAILED: "Falha no processamento" };
function deliveryLabel(message: Connection["messages"][number]) {
  if (message.replyDeliveryStatus === "failed") return message.replyErrorCodes?.includes(130497) ? "Resposta não entregue: a Meta restringiu o envio para este país. Consulte o administrador." : `Resposta não entregue pelo WhatsApp${message.replyErrorCodes?.length ? ` (código ${message.replyErrorCodes.join(", ")})` : ""}. O resultado continua disponível aqui.`;
  if (message.replyDeliveryStatus === "read") return "Resposta lida no WhatsApp.";
  if (message.replyDeliveryStatus === "delivered") return "Resposta entregue no WhatsApp.";
  if (message.replyDeliveryStatus === "sent") return "Resposta enviada. Aguardando confirmação de entrega.";
  return message.replySentAt ? "Resposta aceita pela Meta. Entrega ainda não confirmada." : "Resposta aguardando envio ao WhatsApp.";
}
async function fetchConnection(signal?: AbortSignal): Promise<Connection> {
  const response = await fetch("/api/whatsapp/connection", { cache: "no-store", signal });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Não foi possível consultar a conexão.");
  return result;
}

export function WhatsAppAssistantView({ user }: { user: SessionUser }) {
  const [data, setData] = useState<Connection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await fetchConnection(signal);
      if (!signal?.aborted) { setData(result); setError(""); }
    } catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Falha de conexão."); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const update = () => fetchConnection(controller.signal).then((result) => { if (!controller.signal.aborted) setData(result); }).catch((cause) => { if (!controller.signal.aborted) setError(cause.message); });
    void update();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void update(); }, 15000);
    return () => { controller.abort(); clearInterval(timer); };
  }, []);
  async function changeLink(method: "POST" | "DELETE") {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/whatsapp/connection", { method });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Não foi possível alterar o vínculo.");
      setLink(method === "POST" ? result : null); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha de conexão."); }
    finally { setBusy(false); }
  }
  return <Stack spacing={3} sx={{ maxWidth: 1100, mx: "auto" }}>
    <Stack direction="row" spacing={2} alignItems="center">
      <Box sx={{ bgcolor: "success.main", color: "white", p: 1.5, borderRadius: 3, display: "flex" }}><WhatsAppIcon fontSize="large" /></Box>
      <Box><Typography variant="h4" sx={{ fontSize: { xs: 26, md: 34 } }}>Assistente WhatsApp</Typography><Typography color="text.secondary">Fale sobre a obra. Acompanhe os registros por aqui.</Typography></Box>
    </Stack>
    {error && <Alert severity="error" role="alert">{error}</Alert>}
    {!data && !error && <LinearProgress aria-label="Carregando conexão" />}
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}><Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} flexWrap="wrap"><Typography variant="h6">Seu WhatsApp, {user.name.split(" ")[0]}</Typography><Chip label={data?.linked ? "Vinculado" : data?.ready ? "Pronto para vincular" : "Aguardando ativação"} color={data?.linked ? "success" : "default"} /></Stack>
      {data && !data.ready && <Alert severity="info">A integração está aguardando configuração pelo administrador. Assim que for ativada, você poderá vincular sua conta e enviar mensagens.</Alert>}
      <Typography color="text.secondary">Vincule seu número enviando a mensagem gerada pelo sistema. O WhatsApp ficará associado somente à sua conta autenticada e às obras autorizadas para o seu perfil.</Typography>
      {data?.linked && <Typography>Conectado ao número +{data.phone}.</Typography>}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        {data?.linked && data.chatUrl ? <Button variant="contained" color="success" href={data.chatUrl} target="_blank" rel="noopener noreferrer" startIcon={<WhatsAppIcon />}>Conversar no WhatsApp</Button> : <Button variant="contained" color="success" disabled={busy || !data?.ready} onClick={() => void changeLink("POST")} startIcon={<WhatsAppIcon />}>{busy ? "Preparando vínculo…" : "Vincular meu WhatsApp"}</Button>}
        {data?.linked && <Button color="inherit" disabled={busy} onClick={() => void changeLink("DELETE")}>Desvincular</Button>}
        <Button startIcon={<RefreshRoundedIcon />} onClick={() => void refresh()} disabled={busy}>Atualizar</Button>
      </Stack>
      {link && !data?.linked && <Alert severity="info"><Stack spacing={1}><Typography>Envie a mensagem preparada pelo seu próprio WhatsApp para confirmar a posse do número. Ela vale até {new Date(link.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.</Typography><Button variant="outlined" color="success" href={link.url} target="_blank" rel="noopener noreferrer">Abrir WhatsApp e enviar vínculo</Button><Typography variant="caption">O vínculo só será concluído quando a Meta entregar essa mensagem ao servidor. O número de teste pode ter restrições de recebimento e não substitui essa confirmação.</Typography></Stack></Alert>}
    </Stack></Paper>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}><Stack spacing={1.5}><Typography variant="h6">O que você pode pedir</Typography>
        {canManageWhatsAppOperations(user.role) && <Typography>“Na obra do João, crie um item para polir a sala e coloque o Carlos como responsável.”</Typography>}
        {user.role !== "FINANCEIRO" && <Typography>“Registre no diário: hoje concluímos a preparação do piso, mas faltou material para o corredor.”</Typography>}
        {canManageWhatsAppOperations(user.role) && <Typography>“Registre uma advertência para o Carlos, da obra do João, pelo atraso de hoje.”</Typography>}
        {["OWNER", "GERENTE"].includes(user.role) && <Typography>“Transfira o Carlos da obra do João para a obra da Maria.”</Typography>}
        {(user.role === "FINANCEIRO" || user.role === "OWNER" || user.canViewFinancials) && <Typography>Envie o comprovante e diga: “Arquive na obra da Maria, referente à compra de material.” Para lançar uma despesa ou receber uma parcela, diga também o valor e a data.</Typography>}
        <Typography>“Gere um relatório da obra da Maria.”</Typography>
        <Divider /><Typography variant="body2" color="text.secondary">Áudios são transcritos. O diário guarda o relato original e o resumo organizado. Ações permitidas ao seu cargo exigem confirmação. Advertências ficam como registros internos, sem envio automático ao colaborador.</Typography>
      </Stack></Paper>
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}><Stack spacing={1.5}><Typography variant="h6">Histórico das obras</Typography><Typography color="text.secondary">Consulte relatos, comprovantes e relatórios de cada serviço.</Typography>
        {data?.orders.length === 0 && <Typography color="text.secondary">Nenhuma obra disponível para seu perfil.</Typography>}
        {data?.orders.map((order) => <Button key={order.id} component={Link} href={`/ordens-servico/${encodeURIComponent(order.id)}/historico`} startIcon={<HistoryRoundedIcon />} sx={{ justifyContent: "flex-start", textAlign: "left" }}>{order.title}</Button>)}
      </Stack></Paper>
    </Box>
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}><Stack spacing={2}><Typography variant="h6">Suas últimas mensagens</Typography>
      {data?.messages.length === 0 && <Typography color="text.secondary">Suas mensagens aparecerão aqui após o vínculo com o WhatsApp.</Typography>}
      {data?.messages.map((message) => <Box key={message.id} sx={{ borderBottom: 1, borderColor: "divider", pb: 2 }}><Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Chip size="small" label={statusLabel[message.status] || message.status} color={message.status === "FAILED" ? "error" : "default"} /><Typography variant="caption" color="text.secondary">{new Date(message.createdAt).toLocaleString("pt-BR")}</Typography></Stack><Typography sx={{ mt: 1, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{message.text || "Arquivo recebido"}</Typography>{message.reply && <><Typography sx={{ mt: 1, whiteSpace: "pre-wrap", color: "text.secondary", overflowWrap: "anywhere" }}>{message.reply}</Typography><Typography variant="caption" color={message.replyDeliveryStatus === "failed" ? "error.main" : ["delivered", "read"].includes(message.replyDeliveryStatus ?? "") ? "success.main" : "text.secondary"}>{deliveryLabel(message)}</Typography></>}</Box>)}
    </Stack></Paper>
  </Stack>;
}
