"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, IconButton, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import MicRoundedIcon from "@mui/icons-material/MicRounded";
import StopRoundedIcon from "@mui/icons-material/StopRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import CameraAltRoundedIcon from "@mui/icons-material/CameraAltRounded";
import VideocamRoundedIcon from "@mui/icons-material/VideocamRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import type { WorkHistoryEntry, WorkReport } from "@/lib/whatsapp-types";

type Order = { id: string; title: string; status: string; customer?: string };
type Data = { user: { name: string; role: string }; orders: Order[]; entries: WorkHistoryEntry[]; reports: WorkReport[] };
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const newNonce = () => crypto.randomUUID().replace(/-/g, "");
async function asJson<T>(response: Response): Promise<T> {
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((value as { message?: string }).message || "Não foi possível concluir. Tente novamente.");
  return value as T;
}
async function sampleVideoFrames(file: File): Promise<string[]> {
  const video = document.createElement("video");
  const url = URL.createObjectURL(file);
  video.muted = true;
  video.preload = "auto";
  video.playsInline = true;
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Vídeo indisponível para prévia.")), 12000);
      video.onloadedmetadata = () => { clearTimeout(timeout); resolve(); };
      video.onerror = () => { clearTimeout(timeout); reject(new Error("Não foi possível ler o vídeo.")); };
      video.load();
    });
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const targets = duration > 1 ? [0.4, duration * 0.5, Math.max(0, duration - 0.4)] : [0];
    const frames: string[] = [];
    for (const target of targets) {
      if (duration > 0) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 2500);
          video.onseeked = () => { clearTimeout(timer); resolve(); };
          video.currentTime = Math.min(Math.max(target, 0), Math.max(0, duration - 0.1));
        });
      }
      const canvas = document.createElement("canvas");
      const width = Math.min(640, video.videoWidth || 640);
      canvas.width = width; canvas.height = Math.round(width * (video.videoHeight || 360) / (video.videoWidth || 640));
      const ctx = canvas.getContext("2d");
      if (ctx && video.readyState >= 2) { ctx.drawImage(video, 0, 0, canvas.width, canvas.height); frames.push(canvas.toDataURL("image/jpeg", 0.64)); }
    }
    return frames;
  } finally { URL.revokeObjectURL(url); video.remove(); }
}
/* Video audio extraction is best-effort. Browser codecs differ; visual evidence is always saved. */
async function extractVideoSpeech(file: File): Promise<File | null> {
  if (file.size > 18 * 1024 * 1024) return null;
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    const length = Math.min(65, buffer.duration);
    if (!length) return null;
    const sampleRate = 16000;
    const samples = Math.floor(length * sampleRate);
    const data = new ArrayBuffer(44 + samples * 2);
    const v = new DataView(data);
    const letters = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) v.setUint8(offset + i, value.charCodeAt(i)); };
    letters(0, "RIFF"); v.setUint32(4, 36 + samples * 2, true); letters(8, "WAVE"); letters(12, "fmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true);
    v.setUint16(34, 16, true); letters(36, "data"); v.setUint32(40, samples * 2, true);
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, n) => buffer.getChannelData(n));
    for (let i = 0; i < samples; i++) {
      const pos = Math.min(buffer.length - 1, Math.floor(i * buffer.sampleRate / sampleRate));
      const mono = channels.reduce((sum, channel) => sum + channel[pos], 0) / channels.length;
      v.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, Math.round(mono * 32767))), true);
    }
    return new File([data], "audio-do-video.wav", { type: "audio/wav" });
  } catch { return null; }
  finally { await context.close(); }
}

export function FieldAssistantView({ userName }: { userName: string }) {
  const [data, setData] = useState<Data>({ user: { name: userName, role: "" }, orders: [], entries: [], reports: [] });
  const [orderId, setOrderId] = useState("");
  const [draft, setDraft] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState(0);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const shouldContinue = useRef(false);
  const segmentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const uploadQueue = useRef<Promise<void>>(Promise.resolve());
  const recordingOrder = useRef("");
  const timeline = useRef<HTMLDivElement | null>(null);
  const photoInput = useRef<HTMLInputElement | null>(null);
  const videoInput = useRef<HTMLInputElement | null>(null);
  const orderRef = useRef("");
  const loadSeq = useRef(0);

  const load = useCallback(async (id: string) => {
    const sequence = ++loadSeq.current;
    const result = await asJson<Data>(await fetch(`/api/campo${id ? `?obra=${encodeURIComponent(id)}` : ""}`, { cache: "no-store" }));
    if (sequence === loadSeq.current && id === orderRef.current) setData(result);
    return result;
  }, []);
  useEffect(() => {
    let live = true;
    void fetch("/api/campo", { cache: "no-store" }).then((res) => asJson<Data>(res)).then((r) => {
      if (!live) return;
      if (r.orders.length === 1) { setOrderId(r.orders[0].id); orderRef.current = r.orders[0].id; void load(r.orders[0].id); }
      else setData(r);
    }).catch((e) => { if (live) setError(e.message); });
    const beforeInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPrompt); };
    const manifest = document.createElement("link");
    manifest.rel = "manifest"; manifest.href = "/campo.webmanifest"; document.head.appendChild(manifest);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("beforeinstallprompt", beforeInstall);
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/campo-sw.js", { scope: "/campo" }).catch(() => {});
    return () => {
      live = false; document.body.style.overflow = previous; manifest.remove();
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      shouldContinue.current = false;
      if (segmentTimer.current) clearTimeout(segmentTimer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, [load]);
  useEffect(() => { if (timeline.current) timeline.current.scrollTop = timeline.current.scrollHeight; }, [data.entries, data.reports]);
  useEffect(() => {
    if (!recording) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [recording]);

  function chooseOrder(next: string) {
    if (recording || pending || busy) return;
    setOrderId(next); orderRef.current = next; setError(""); setNotice("");
    void load(next).catch((e) => setError(e.message));
  }
  async function submitText() {
    if (!orderRef.current) { setError("Selecione a obra primeiro."); return; }
    const text = draft.trim(); if (!text || busy) return;
    const submittedOrder = orderRef.current;
    setBusy(true); setError(""); setNotice("");
    try {
      const r = await asJson<{ entry: WorkHistoryEntry }>(await fetch("/api/campo/registro", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: submittedOrder, nonce: newNonce(), text }),
      }));
      if (orderRef.current === submittedOrder) setData((s) => ({ ...s, entries: s.entries.some((x) => x.id === r.entry.id) ? s.entries : [...s.entries, r.entry] }));
      setDraft("");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao registrar texto."); }
    finally { setBusy(false); }
  }
  async function submitAudio(file: File, target: string) {
    const form = new FormData();
    form.set("audio", file); form.set("orderId", target); form.set("nonce", newNonce());
    setPending((v) => v + 1);
    try {
      const r = await asJson<{ entry: WorkHistoryEntry }>(await fetch("/api/campo/audio", { method: "POST", body: form }));
      if (orderRef.current === target) setData((s) => ({ ...s, entries: [...s.entries.filter((x) => x.id !== r.entry.id), r.entry] }));
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao transcrever. Regrave o trecho."); }
    finally { setPending((v) => v - 1); }
  }
  async function toggleRecording() {
    if (recording) {
      shouldContinue.current = false;
      if (segmentTimer.current) clearTimeout(segmentTimer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      setRecording(false); setNotice("Gravação encerrada. Salvando os últimos trechos...");
      return;
    }
    if (!orderRef.current) { setError("Selecione uma obra antes de gravar."); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Este navegador não suporta gravação. Use HTTPS no Chrome ou Safari atualizado.");
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const supported = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((type) => MediaRecorder.isTypeSupported(type));
      stream.current = media; recordingOrder.current = orderRef.current; shouldContinue.current = true;
      setError(""); setNotice("Gravando. A cada 15 segundos o trecho é transcrito e salvo automaticamente.");
      const startSegment = () => {
        if (!shouldContinue.current || !media.active) return;
        // Each segment is a self-contained recording, avoiding unplayable partial WebM blobs.
        const rec = supported ? new MediaRecorder(media, { mimeType: supported }) : new MediaRecorder(media);
        recorder.current = rec;
        rec.ondataavailable = (event) => {
          if (!event.data.size) return;
          const mime = rec.mimeType.split(";")[0] || "audio/webm";
          const file = new File([event.data], `trecho-${Date.now()}.${mime.includes("mp4") ? "m4a" : "webm"}`, { type: mime });
          const target = recordingOrder.current;
          uploadQueue.current = uploadQueue.current.then(() => submitAudio(file, target));
        };
        rec.onerror = () => {
          shouldContinue.current = false; setRecording(false);
          setError("A gravação foi interrompida."); media.getTracks().forEach((track) => track.stop());
        };
        rec.onstop = () => {
          if (segmentTimer.current) clearTimeout(segmentTimer.current);
          if (shouldContinue.current) startSegment();
          else { media.getTracks().forEach((track) => track.stop()); recorder.current = null; }
        };
        rec.start();
        segmentTimer.current = setTimeout(() => {
          if (rec.state === "recording") rec.stop();
        }, 15000);
      };
      startSegment();
      setRecording(true);
    } catch { setError("Não foi possível acessar o microfone. Verifique a permissão do navegador."); }
  }
  async function uploadFile(file: File, type: "image" | "video") {
    const target = orderRef.current;
    if (!target) { setError("Selecione uma obra antes de enviar mídias."); return; }
    if (busy || recording) return;
    const mime = file.type.split(";")[0].toLowerCase();
    setBusy(true); setError(""); setNotice("Enviando e analisando arquivo...");
    try {
      const frames = type === "video" ? await sampleVideoFrames(file).catch(() => []) : [];
      const ticket = await asJson<{ uploadUrl: string; token: string }>(await fetch("/api/campo/upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: target, fileName: file.name, mimeType: mime, sizeBytes: file.size }),
      }));
      const sent = await fetch(ticket.uploadUrl, { method: "PUT", headers: { "Content-Type": mime }, body: file });
      if (!sent.ok) throw new Error("Falha no envio ao armazenamento privado. Verifique o tamanho e a conexão.");
      const result = await asJson<{ entry: WorkHistoryEntry; analysisFailed?: boolean }>(await fetch("/api/campo/midia", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: ticket.token, nonce: newNonce(), caption: caption.trim(), frames }),
      }));
      if (orderRef.current === target) setData((s) => ({ ...s, entries: [...s.entries, result.entry] }));
      setCaption("");
      setNotice(result.analysisFailed ? "Arquivo salvo. A descrição visual automática ficou indisponível." : "Arquivo salvo e analisado na obra.");
      if (type === "video") {
        const audio = await extractVideoSpeech(file);
        if (audio) { setNotice("Vídeo salvo. Transcrevendo também o áudio que o navegador conseguiu extrair..."); await submitAudio(audio, target); }
        else setNotice("Vídeo e imagens-chave salvos. Este navegador não conseguiu extrair a fala do vídeo; grave um áudio separado se necessário.");
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível enviar o arquivo."); }
    finally { setBusy(false); }
  }
  async function generateReport() {
    if (!orderRef.current || busy || recording) return;
    setBusy(true); setError(""); setNotice("IA lendo o histórico autorizado desta obra...");
    const target = orderRef.current;
    try {
      await asJson(await fetch(`/api/service-orders/${encodeURIComponent(target)}/history/report`, { method: "POST" }));
      await load(target); setNotice("Relatório gerado e salvo no histórico da obra.");
    } catch (e) { setError(e instanceof Error ? e.message : "Erro no relatório."); }
    finally { setBusy(false); }
  }
  const selected = data.orders.find((o) => o.id === orderId);
  return (
    <Box component="main" sx={{ position: "fixed", inset: 0, height: "100dvh", width: "100vw", zIndex: 1600, bgcolor: "#071728", color: "#f6f8fa", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "var(--font-geist-sans)" }}>
      <Box sx={{ px: { xs: 1.5, sm: 3 }, py: 1.3, display: "flex", alignItems: "center", gap: 1.5, bgcolor: "#0c2138", borderBottom: "1px solid #264458", flexShrink: 0 }}>
        <Box sx={{ width: 37, height: 37, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "#163a48" }}><MicRoundedIcon sx={{ color: "#75e5ad" }} /></Box>
        <Box sx={{ flex: 1, minWidth: 0 }}><Typography fontWeight={850} sx={{ fontSize: { xs: 15, sm: 19 }, lineHeight: 1.3 }}>Aliança • Assistente de campo</Typography><Typography variant="caption" sx={{ color: "#a7bccc" }} noWrap>{userName} · diário e evidências da obra</Typography></Box>
        {installPrompt && <Button size="small" variant="outlined" sx={{ borderColor: "#5d9d89", color: "#a6eed1" }} onClick={() => void installPrompt.prompt()}>Instalar app</Button>}
        <IconButton onClick={() => void load(orderRef.current).catch((e) => setError(e.message))} aria-label="Atualizar registros" sx={{ color: "#b5cbd8" }}><ReplayRoundedIcon /></IconButton>
      </Box>
      <Box sx={{ px: { xs: 1.5, sm: 3 }, py: 1.25, bgcolor: "#102942", borderBottom: "1px solid #264458", display: "flex", flexDirection: "column", gap: 0.7, flexShrink: 0 }}>
        <Typography variant="caption" sx={{ color: "#b3cfdb", fontWeight: 700 }}>OBRA EM QUE ESTE RELATO SERÁ SALVO</Typography>
        <Select fullWidth size="small" displayEmpty value={orderId} disabled={recording || busy || pending > 0}
          onChange={(event) => chooseOrder(event.target.value)} sx={{ bgcolor: "#173650", color: "#fff", "& .MuiSvgIcon-root": { color: "#c3dee4" }, "& .MuiOutlinedInput-notchedOutline": { borderColor: "#4b7186" } }}>
          <MenuItem value="">Selecione a obra antes de registrar</MenuItem>
          {data.orders.map((o) => <MenuItem key={o.id} value={o.id}>{o.title}{o.customer ? ` · ${o.customer}` : ""}</MenuItem>)}
        </Select>
        {selected && <Typography variant="caption" sx={{ color: "#97b5c5" }}>OS selecionada: {selected.title} · {selected.status}</Typography>}
      </Box>
      <Box ref={timeline} role="log" aria-live="polite" aria-label="Transcrições e registros da obra" sx={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", px: { xs: 1.5, md: 4 }, py: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
        {!orderId && <Box sx={{ mt: "auto", mb: "auto", textAlign: "center", opacity: 0.75 }}><MicRoundedIcon sx={{ fontSize: 62, color: "#75e5ad" }} /><Typography variant="h6">Escolha uma obra</Typography><Typography variant="body2">Grave, digite ou envie fotos e vídeos. Tudo ficará no diário da obra selecionada.</Typography></Box>}
        {!!orderId && data.entries.length === 0 && <Typography sx={{ m: "auto", color: "#b0c9d8", textAlign: "center" }}>Nenhum relato nesta obra. Inicie a gravação para documentar o serviço.</Typography>}
        {data.entries.map((entry) => (
          <Box key={entry.id} sx={{ ml: "auto", width: "fit-content", maxWidth: "min(92%, 760px)", px: 2, py: 1.5, bgcolor: "#18463e", borderRadius: "16px 16px 4px 16px", boxShadow: "0 4px 14px #0002", overflowWrap: "anywhere" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.4 }}><Chip size="small" label={entry.title} sx={{ bgcolor: "#246655", color: "#eef" }}/><Typography variant="caption" sx={{ color: "#aac9c2" }}>{new Date(entry.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</Typography></Stack>
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{entry.content}</Typography>
            {entry.attachment && <Button href={entry.attachment.storagePath.startsWith("campo/") ? `/api/campo/midia/${entry.attachment.id}` : `/api/whatsapp/media/${entry.attachment.id}`} target="_blank" rel="noopener noreferrer" size="small" startIcon={<DownloadRoundedIcon />} sx={{ mt: 1, color: "#a4e2cd" }}>Abrir arquivo original</Button>}
          </Box>
        ))}
        {data.reports.slice(-1).map((report) => <Box key={report.id} sx={{ bgcolor: "#1c3049", border: "1px solid #516f84", borderRadius: 3, p: 2, whiteSpace: "pre-wrap" }}><Typography fontWeight={800} sx={{ color: "#a2e4ca", mb: 1 }}>Relatório da IA</Typography><Typography variant="body2">{report.content}</Typography></Box>)}
      </Box>
      {(error || notice) && <Box sx={{ flexShrink: 0, px: 2, pb: 0.5 }}>{error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}{notice && !error && <Typography sx={{ textAlign: "center", color: "#afe9cd", fontSize: 12 }}>{notice}</Typography>}</Box>}
      <Box sx={{ flexShrink: 0, bgcolor: "#0c2138", borderTop: "1px solid #305066", px: { xs: 1.5, sm: 3 }, pt: 1.3, pb: "max(12px, env(safe-area-inset-bottom))" }}>
        {recording && <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ mb: 1 }}><Box sx={{ height: 10, width: 10, bgcolor: "#ff4d58", borderRadius: "50%", animation: "campo-pulse 1.1s infinite" }}/><Typography fontWeight={700} sx={{ color: "#ffb1b8" }}>Gravando e transcrevendo a cada 15 segundos</Typography></Stack>}
        <Stack direction="row" alignItems="flex-end" gap={0.7}>
          <Box sx={{ flex: 1, minWidth: 0 }}><TextField fullWidth multiline maxRows={3} size="small" value={draft} onChange={(e) => setDraft(e.target.value)} disabled={!orderId || recording || busy} placeholder="Escreva seu relato da obra..." sx={{ "& .MuiOutlinedInput-root": { bgcolor: "#193a52", color: "white", borderRadius: 3 }, "& textarea::placeholder": { color: "#b9cbd7", opacity: 1 } }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitText(); } }} /></Box>
          <IconButton aria-label="Enviar mensagem" disabled={!draft.trim() || !orderId || recording || busy} onClick={() => void submitText()} sx={{ bgcolor: "#148865", color: "white", "&:hover": { bgcolor: "#187a60" }, "&.Mui-disabled": { bgcolor: "#223c48", color: "#69828a" } }}><SendRoundedIcon /></IconButton>
        </Stack>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pt: 1.1 }} gap={1}>
          <Stack direction="row" spacing={0.4}>
            <IconButton aria-label="Enviar foto" disabled={!orderId || recording || busy || pending > 0} onClick={() => photoInput.current?.click()} sx={{ color: "#b7d4d9" }}><CameraAltRoundedIcon /></IconButton>
            <IconButton aria-label="Enviar vídeo" disabled={!orderId || recording || busy || pending > 0} onClick={() => videoInput.current?.click()} sx={{ color: "#b7d4d9" }}><VideocamRoundedIcon /></IconButton>
            <IconButton aria-label="Gerar relatório IA" disabled={!orderId || recording || busy || pending > 0} onClick={() => void generateReport()} sx={{ color: "#b7d4d9" }}><AutoAwesomeRoundedIcon /></IconButton>
          </Stack>
          <Button variant="contained" color={recording ? "error" : "success"} disabled={busy || (!orderId && !recording)} onClick={() => void toggleRecording()} startIcon={recording ? <StopRoundedIcon /> : <MicRoundedIcon />} sx={{ borderRadius: 9, px: { xs: 2, sm: 3 }, py: 1.2, fontWeight: 850, minWidth: 142 }}>
            {recording ? "PARAR" : "GRAVAR"}
          </Button>
          {pending > 0 || busy ? <CircularProgress size={20} sx={{ color: "#91d9be" }}/> : <Box sx={{ width: 20 }}/>}
        </Stack>
        <Box sx={{ mt: 1 }}><TextField fullWidth size="small" value={caption} onChange={(e) => setCaption(e.target.value)} disabled={recording || busy} placeholder="Descrição opcional para a próxima foto ou vídeo..." sx={{ "& .MuiOutlinedInput-root": { fontSize: 12, bgcolor: "#112b40", color: "#e1f5ee" }, "& input::placeholder": { color: "#87a7b6", opacity: 1 } }} /></Box>
        <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadFile(f, "image"); }}/>
        <input ref={videoInput} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadFile(f, "video"); }}/>
      </Box>
      <style>{`@keyframes campo-pulse{0%,100%{opacity:1}50%{opacity:.28}}`}</style>
    </Box>
  );
}
