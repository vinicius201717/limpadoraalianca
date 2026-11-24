"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, IconButton, InputBase, Menu, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import MicRoundedIcon from "@mui/icons-material/MicRounded";
import StopRoundedIcon from "@mui/icons-material/StopRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import CameraAltRoundedIcon from "@mui/icons-material/CameraAltRounded";
import VideocamRoundedIcon from "@mui/icons-material/VideocamRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import AttachFileRoundedIcon from "@mui/icons-material/AttachFileRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import DoneAllRoundedIcon from "@mui/icons-material/DoneAllRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import { FieldReceiptsBoard } from "./FieldReceiptsBoard";
import { FieldNotifications } from "./FieldNotifications";
import type { WorkHistoryEntry, WorkReport } from "@/lib/whatsapp-types";

type Order = { id: string; title: string; status: string; customer?: string };
type Data = { user: { id?: string; name: string; role: string; canViewFinancials?: boolean }; orders: Order[]; entries: WorkHistoryEntry[];
  reports: WorkReport[]; warehouseJournal?: WorkHistoryEntry[];
  locked?: boolean; assignedOrderId?: string | null; assignmentProblem?: string | null };
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type StaffReport = { id: string; employeeName: string; occurredOn: string; occurredAt?: string; kind: "ABSENCE" | "EARLY_LEAVE"; description: string; reportedByName: string };
type FieldOperation = { status: string; message: string; ui?: { kind: "THEME" | "ORDER" | "REPORT"; value: string } };
type FieldColor = "dark" | "light";
const newNonce = () => crypto.randomUUID().replace(/-/g, "");
async function retryCommit(send: () => Promise<Response>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await send();
    if (![409, 503].includes(response.status) || attempt === 2) return response;
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  throw new Error("Tentativas esgotadas.");
}
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
  const [finalizing, setFinalizing] = useState(false);
  const [pending, setPending] = useState(0);
  const [warehouseOpen, setWarehouseOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<FieldColor>("dark");
  const [attachmentAnchor, setAttachmentAnchor] = useState<HTMLElement | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptDescription, setReceiptDescription] = useState("");
  const [dictating, setDictating] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);
  const [staffReports, setStaffReports] = useState<StaffReport[]>([]);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState("");
  const [warehouseLoading, setWarehouseLoading] = useState(false);
  const [warehouseError, setWarehouseError] = useState("");
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const shouldContinue = useRef(false);
  const segmentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const uploadQueue = useRef<Promise<void>>(Promise.resolve());
  const recordingOrder = useRef("");
  const recordingSession = useRef("");
  const failedSegments = useRef(0);
  const timeline = useRef<HTMLDivElement | null>(null);
  const photoInput = useRef<HTMLInputElement | null>(null);
  const videoInput = useRef<HTMLInputElement | null>(null);
  const cameraInput = useRef<HTMLInputElement | null>(null);
  const receiptFileInput = useRef<HTMLInputElement | null>(null);
  const receiptCameraInput = useRef<HTMLInputElement | null>(null);
  const dictateRecorder = useRef<MediaRecorder | null>(null);
  const dictateStream = useRef<MediaStream | null>(null);
  const orderRef = useRef("");
  const loadSeq = useRef(0);
  const textAttempt=useRef<{key:string;payload:string}|null>(null);
  const receiptAttempt=useRef<{file:File;target:string;nonce:string;ticket?:string}|null>(null);

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
      const autoId = r.assignedOrderId || (r.orders.length === 1 ? r.orders[0].id : null);
      if (autoId) { setOrderId(autoId); orderRef.current = autoId; void load(autoId); }
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
    const choice = localStorage.getItem("alianca-campo-theme");
    if (choice !== "light" && choice !== "dark") return;
    const frame = requestAnimationFrame(() => setThemeMode(choice));
    return () => cancelAnimationFrame(frame);
  }, []);
  function changeTheme() {
    const next = themeMode === "dark" ? "light" : "dark";
    setThemeMode(next);
    localStorage.setItem("alianca-campo-theme", next);
  }
  useEffect(() => {
    if (!recording && !finalizing && !pending && !busy && !dictating) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [recording, finalizing, pending, busy, dictating]);

  function chooseOrder(next: string) {
    if (recording || finalizing || pending || busy || data.locked) return;
    setOrderId(next); orderRef.current = next; setError(""); setNotice("");
    void load(next).catch((e) => setError(e.message));
  }
  function handleVoiceUi(operation?: FieldOperation) {
    const ui = operation?.ui;
    if (!ui) return;
    if (ui.kind === "THEME" && (ui.value === "light" || ui.value === "dark")) {
      setThemeMode(ui.value); localStorage.setItem("alianca-campo-theme", ui.value);
    }
    if (ui.kind === "ORDER" && data.orders.some((order) => order.id === ui.value) && !data.locked) {
      orderRef.current = ui.value;
      setOrderId(ui.value);
      void load(ui.value).catch((cause) => setError(cause instanceof Error ? cause.message : "Falha ao mudar de obra."));
    }
    if (ui.kind === "REPORT" && ui.value === orderRef.current && !["office", "warehouse"].includes(ui.value)) {
      const target = ui.value;
      setNotice("Gerando relatório por comando de voz...");
      void (async () => {
        try {
          await asJson(await fetch(`/api/service-orders/${encodeURIComponent(target)}/history/report`, { method: "POST" }));
          await load(target);
          setNotice("Relatório gerado e salvo no histórico.");
        } catch (error) { setError(error instanceof Error ? error.message : "Falha ao gerar relatório."); }
      })();
    }
  }
  async function submitText() {
    if (!orderRef.current) { setError("Selecione a obra primeiro."); return; }
    const text = draft.trim(); if (!text || busy || finalizing) return;
    const submittedOrder = orderRef.current;
    setBusy(true); setError(""); setNotice("");
    try {
      const fingerprint=JSON.stringify([submittedOrder,text]);
      if(textAttempt.current?.payload!==fingerprint) textAttempt.current={key:newNonce(),payload:fingerprint};
      const body = JSON.stringify({ orderId: submittedOrder, nonce:textAttempt.current.key, text });
      const r = await asJson<{ entry: WorkHistoryEntry; operation?: FieldOperation }>(await retryCommit(() => fetch("/api/campo/registro", {
        method: "POST", headers: { "Content-Type": "application/json" }, body,
      })));
      if (orderRef.current === submittedOrder) setData((s) => ({ ...s, entries: s.entries.some((x) => x.id === r.entry.id) ? s.entries : [...s.entries, r.entry] }));
      textAttempt.current=null;
      setDraft("");
      if (r.operation) handleVoiceUi(r.operation);
      if (r.entry.checklistReply) setNotice("");
      else if (r.operation) setNotice(r.operation.status === "executed" ? r.operation.message
        : r.operation.status === "pending" ? "Ação pendente: " + r.operation.message : "Relato salvo no diário.");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao registrar texto."); }
    finally { setBusy(false); }
  }
  async function submitAudio(file: File, target: string, sessionId?: string) {
    const form = new FormData();
    form.set("audio", file); form.set("orderId", target); form.set("nonce", newNonce());
    if (sessionId) form.set("sessionId", sessionId);
    setPending((v) => v + 1);
    try {
      const r = await asJson<{ entry: WorkHistoryEntry; operation?: FieldOperation }>(await retryCommit(() => fetch("/api/campo/audio", { method: "POST", body: form })));
      if (orderRef.current === target) setData((s) => ({ ...s, entries: [...s.entries.filter((x) => x.id !== r.entry.id), r.entry] }));
      if (r.operation) handleVoiceUi(r.operation);
      if (r.operation?.status === "pending") setNotice("Ação pendente: " + r.operation.message);
      else if (r.operation?.status === "executed") setNotice(r.operation.message);
    } catch (e) { if (sessionId) failedSegments.current++; setError(e instanceof Error ? e.message : "Falha ao transcrever. Regrave o trecho."); }
    finally { setPending((v) => v - 1); }
  }
  async function finalizeRecording(target: string, sessionId: string) {
    if (!sessionId) { setFinalizing(false); return; }
    if (failedSegments.current) {
      setNotice("Alguns trechos não foram salvos. Nenhum comando automático será executado. Repita a instrução em outra gravação.");
      setFinalizing(false); return;
    }
    setPending((value) => value + 1);
    setNotice("Transcrição salva. IA interpretando a instrução completa...");
    try {
      const payload = JSON.stringify({ orderId: target, sessionId });
      const result = await asJson<{ entry?: WorkHistoryEntry; operation?: FieldOperation }>(
        await retryCommit(() => fetch("/api/campo/finalizar", { method: "POST",
          headers: { "Content-Type": "application/json" }, body: payload })));
      if (result.entry?.kind === "FINANCIAL" && orderRef.current === target) void load(target).catch(()=>{});
      if (result.entry && orderRef.current === target) setData((state) => ({
        ...state, entries: state.entries.some((e) => e.id === result.entry!.id) ? state.entries : [...state.entries, result.entry!],
      }));
      if (result.operation) handleVoiceUi(result.operation);
      if (result.entry?.checklistReply) setNotice("");
      else if (result.operation) setNotice(result.operation.status === "executed"
        ? result.operation.message : result.operation.status === "pending"
          ? "Pendente: " + result.operation.message : "Gravação registrada no diário.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "A consolidação falhou. Os trechos transcritos permanecem no diário.");
    } finally { setPending((value) => value - 1); setFinalizing(false); }
  }
  async function toggleRecording() {
    if (recording) {
      shouldContinue.current = false;
      if (segmentTimer.current) clearTimeout(segmentTimer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      setRecording(false); setFinalizing(true); setNotice("Gravação encerrada. Salvando os últimos trechos...");
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
      stream.current = media; recordingOrder.current = orderRef.current; recordingSession.current = newNonce();
      failedSegments.current = 0; shouldContinue.current = true;
      setError(""); setNotice("Gravando e transcrevendo a cada 15 segundos. As ações serão executadas ao parar a gravação.");
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
          const sessionId = recordingSession.current;
          uploadQueue.current = uploadQueue.current.then(() => submitAudio(file, target, sessionId));
        };
        rec.onerror = () => {
          shouldContinue.current = false; setRecording(false);
          setError("A gravação foi interrompida."); media.getTracks().forEach((track) => track.stop());
        };
        rec.onstop = () => {
          if (segmentTimer.current) clearTimeout(segmentTimer.current);
          if (shouldContinue.current) startSegment();
          else {
            media.getTracks().forEach((track) => track.stop()); recorder.current = null;
            const target = recordingOrder.current; const sessionId = recordingSession.current;
            void uploadQueue.current.then(() => finalizeRecording(target, sessionId));
          }
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
  function selectReceipt(file: File | undefined) {
    setAttachmentAnchor(null);
    if (!file) return;
    const mime = file.type.split(";")[0].toLowerCase();
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(mime) || file.size > (mime === "application/pdf" ? 15 : 10) * 1024 * 1024) {
      setError("Comprovante precisa ser JPG, PNG ou WEBP (até 10 MB), ou PDF (até 15 MB)."); return;
    }
    if (!orderRef.current) { setError("Selecione a obra ou diário antes de enviar."); return; }
    receiptAttempt.current=null;
    setReceiptFile(file); setReceiptDescription(draft.trim()); setReceiptOpen(true);
  }
  async function sendReceipt() {
    const file = receiptFile; const target = orderRef.current;
    if (!file || !target || busy || dictating) return;
    setBusy(true); setError(""); setNotice("Enviando comprovante ao financeiro...");
    try {
      const mime = file.type.split(";")[0].toLowerCase();
      const ticket = await asJson<{ uploadUrl: string; token: string }>(await fetch("/api/campo/upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: target, fileName: file.name, mimeType: mime, sizeBytes: file.size }),
      }));
      const sent = await fetch(ticket.uploadUrl, { method: "PUT", headers: { "Content-Type": mime }, body: file });
      if (!sent.ok) throw new Error("Não foi possível enviar o arquivo ao armazenamento privado.");
      if(receiptAttempt.current?.file!==file || receiptAttempt.current?.target!==target) receiptAttempt.current={file,target,nonce:newNonce()};
      const payload = JSON.stringify({ ticket: ticket.token, nonce:receiptAttempt.current.nonce, description: receiptDescription.trim() });
      const response = await asJson<{ message: string; receipt: { id: string; status: string } }>(
        await retryCommit(() => fetch("/api/campo/comprovante", { method: "POST",
          headers: { "Content-Type": "application/json" }, body: payload })));
      receiptAttempt.current=null;
      setReceiptOpen(false); setReceiptFile(null); setReceiptDescription(""); setDraft("");
      setNotice(response.message);
      if (orderRef.current === target) void load(target).catch(() => {});
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao salvar o comprovante."); }
    finally { setBusy(false); }
  }
  async function toggleDictation() {
    if (dictateRecorder.current?.state === "recording") { dictateRecorder.current.stop(); setDictating(false); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Ditado indisponível neste navegador."); return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mime ? new MediaRecorder(media, { mimeType: mime }) : new MediaRecorder(media);
      const buffers: Blob[] = []; dictateRecorder.current = recorder; dictateStream.current = media;
      recorder.ondataavailable = (event) => { if (event.data.size) buffers.push(event.data); };
      recorder.onstop = () => {
        setDictating(false);
        const type = recorder.mimeType.split(";")[0] || "audio/webm";
        const audio = new File(buffers, type.includes("mp4") ? "ditado.m4a" : "ditado.webm", { type });
        media.getTracks().forEach((track) => track.stop());
        if (!audio.size) return;
        void (async () => {
          setBusy(true); setNotice("Transcrevendo descrição do comprovante...");
          try {
            const form = new FormData(); form.set("audio", audio);
            const result = await asJson<{ text: string }>(await fetch("/api/campo/transcrever", { method: "POST", body: form }));
            setReceiptDescription((current) => (current.trim() ? current.trim() + " " : "") + result.text.trim());
            setNotice("Descrição ditada e pronta para anexar.");
          } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível transcrever o ditado."); }
          finally { setBusy(false); }
        })();
      };
      recorder.start();
      setDictating(true); setError("");
      setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 15000);
    } catch { setError("Autorize o microfone para ditar a descrição."); }
  }
  async function openStaff() {
    setStaffOpen(true); setStaffLoading(true); setStaffError("");
    try {
      const result = await asJson<{ reports: StaffReport[] }>(await fetch("/api/campo/ocorrencias", { cache: "no-store" }));
      setStaffReports(result.reports);
    } catch (cause) { setStaffError(cause instanceof Error ? cause.message : "Falha ao carregar ocorrências."); }
    finally { setStaffLoading(false); }
  }
  function openFinance() { setFinanceOpen(true); }
  async function openWarehouse() {
    setWarehouseOpen(true); setWarehouseLoading(true); setWarehouseError("");
    try { await load(orderRef.current); }
    catch (cause) { setWarehouseError(cause instanceof Error ? cause.message : "Falha ao carregar almoxarifado."); }
    finally { setWarehouseLoading(false); }
  }
  async function uploadFile(file: File, type: "image" | "video") {
    const target = orderRef.current;
    if (!target) { setError("Selecione uma obra antes de enviar mídias."); return; }
    if (busy || recording || finalizing) return;
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
        body: JSON.stringify({ ticket: ticket.token, nonce: newNonce(), caption: (draft.trim() || caption.trim()), frames }),
      }));
      if (orderRef.current === target) setData((s) => ({ ...s, entries: [...s.entries, result.entry] }));
      setCaption(""); setDraft("");
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
  const colors = themeMode === "dark" ? {
    page: "#071a21", header: "#123238", bar: "#123b42", wallpaper: "#0b252c",
    border: "#285157", text: "#effbf5", muted: "#afc9c7", accent: "#17a778",
    bubble: "#185745", incoming: "#17353c", input: "#204048",
    shadow: "rgba(0,0,0,.22)", notice: "#c6f4db", dialog: "#123238",
  } : {
    page: "#f0f6f2", header: "#e5f3ec", bar: "#e7f4ed", wallpaper: "#edf6f0",
    border: "#cbded5", text: "#163b37", muted: "#577b72", accent: "#0b8864",
    bubble: "#d2f2df", incoming: "#ffffff", input: "#ffffff",
    shadow: "rgba(22,65,50,.09)", notice: "#186b54", dialog: "#f6fbf7",
  };
  const canStaff = ["OWNER", "GERENTE", "SUPERVISOR_OBRA", "ALMOXARIFADO"].includes(data.user.role);
  const canFinance = data.user.role === "OWNER" || data.user.role === "FINANCEIRO" || (data.user.role === "GERENTE" && data.user.canViewFinancials === true);

  return (
    <Box component="main" data-alianca-theme={themeMode} sx={{
      position: "fixed", inset: 0, width: "100vw", height: "100dvh", zIndex: 1600,
      display: "flex", flexDirection: "column", bgcolor: colors.page, color: colors.text,
      overflow: "hidden", fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
    }}>
      {/* WhatsApp-like compact messenger header, with Aliança colours and own branding. */}
      <Box sx={{
        display: "flex", alignItems: "center", gap: 1.2,
        px: { xs: 1.5, sm: 2.5 }, py: 1.2, flexShrink: 0,
        bgcolor: colors.header, borderBottom: `1px solid ${colors.border}`,
      }}>
        <Box sx={{
          display: "grid", placeItems: "center", bgcolor: colors.accent, color: "#fff",
          height: { xs: 43, sm: 48 }, width: { xs: 43, sm: 48 }, borderRadius: "50%",
          boxShadow: "0 1px 7px #0002", flexShrink: 0,
        }}><MicRoundedIcon sx={{ fontSize: 26 }} /></Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography fontWeight={850} sx={{ fontSize: { xs: 16, sm: 18 }, lineHeight: 1.2, color: colors.text }}>
            Aliança Campo
          </Typography>
          <Typography variant="caption" sx={{ display: "block", color: colors.muted }} noWrap>
            {recording ? "Gravando mensagem de voz..." : finalizing ? "Organizando registro..." : userName + " · registro operacional"}
          </Typography>
        </Box>
        {!!data.user.id && <FieldNotifications key={data.user.id} userId={data.user.id} color={colors.text} onChoose={id=>{if(data.orders.some(o=>o.id===id)&&orderRef.current!==id)chooseOrder(id);}}/>}
        {canStaff && <IconButton size="small" onClick={() => void openStaff()} title="Ocorrências da equipe" aria-label="Ver faltas e saídas antecipadas"
          sx={{ color: colors.text }}><PeopleAltRoundedIcon /></IconButton>}
        {canFinance && <IconButton size="small" onClick={() => void openFinance()} aria-label="Ver comprovantes do financeiro"
          sx={{ color: colors.text }}><ReceiptLongRoundedIcon /></IconButton>}
        {["OWNER", "GERENTE", "ALMOXARIFADO"].includes(data.user.role) && <IconButton size="small" onClick={() => void openWarehouse()}
          title="Movimentos do almoxarifado" aria-label="Ver almoxarifado" sx={{ color: colors.text }}><Inventory2RoundedIcon /></IconButton>}
        <IconButton size="small" onClick={changeTheme} aria-label={themeMode === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
          sx={{ color: colors.text }}>{themeMode === "dark" ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}</IconButton>
        <IconButton size="small" onClick={() => void load(orderRef.current).catch((e) => setError(e.message))}
          aria-label="Atualizar histórico" sx={{ color: colors.text }}><ReplayRoundedIcon /></IconButton>
      </Box>
      <Box sx={{
        flexShrink: 0, bgcolor: colors.bar, px: { xs: 1.5, sm: 3 }, py: 1.05,
        borderBottom: `1px solid ${colors.border}`,
        display: "flex", alignItems: "center", gap: 1.2,
      }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ color: colors.muted, fontSize: 10, fontWeight: 850, letterSpacing: ".11em" }}>
            {data.user.role === "SUPERVISOR_OBRA" ? "OBRA SOB SUA SUPERVISÃO" :
              orderId === "warehouse" ? "ALMOXARIFADO" : "CONVERSA VINCULADA À"}
          </Typography>
          {data.locked ? <Typography noWrap fontWeight={750} sx={{ fontSize: 13.5, color: colors.text }}>
            {selected?.title || "Sem obra atribuída"}
          </Typography> :
          <Select MenuProps={{ sx: { zIndex: 1800 } }} size="small" fullWidth displayEmpty value={orderId} disabled={recording || finalizing || busy || pending > 0}
            onChange={(event) => chooseOrder(event.target.value)}
            sx={{
              height: 35, bgcolor: colors.input, color: colors.text, borderRadius: 2, fontWeight: 750,
              "& .MuiSvgIcon-root": { color: colors.text },
              "& .MuiOutlinedInput-notchedOutline": { borderColor: colors.border },
            }}>
            <MenuItem value="">Selecione uma obra ou diário</MenuItem>
            {data.orders.map((order) => <MenuItem key={order.id} value={order.id}>
              {order.title}{order.customer ? " · " + order.customer : ""}
            </MenuItem>)}
          </Select>}
        </Box>
        {installPrompt && <Button onClick={() => void installPrompt.prompt()} size="small"
          sx={{ color: colors.accent, minWidth: 0, fontSize: 12, textTransform: "none", fontWeight: 800 }}>
          Instalar
        </Button>}
      </Box>
      <Box ref={timeline} role="log" aria-live="polite" aria-label="Conversa, transcrições e registros"
        sx={{
          flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain",
          bgcolor: colors.wallpaper,
          backgroundImage: themeMode === "dark" ?
            "radial-gradient(circle at 20px 20px,rgba(100,170,143,.07) 1px,transparent 2px),radial-gradient(circle at 75px 70px,rgba(100,170,143,.045) 1px,transparent 2px)" :
            "radial-gradient(circle at 20px 20px,rgba(60,140,90,.09) 1px,transparent 2px),radial-gradient(circle at 75px 70px,rgba(60,140,90,.05) 1px,transparent 2px)",
          backgroundSize: "92px 92px",
          px: { xs: 1.1, sm: 3, md: 5 }, py: 1.8,
          display: "flex", flexDirection: "column", gap: 1,
        }}>
        <Box sx={{
          mx: "auto", mb: 1.5, px: 2, py: 0.65, borderRadius: 10, bgcolor: colors.incoming,
          color: colors.muted, fontSize: 11, boxShadow: `0 1px 3px ${colors.shadow}`, fontWeight: 750,
        }}>
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </Box>
        {data.assignmentProblem && <Alert severity="warning" sx={{ maxWidth: 560, mx: "auto" }}>{data.assignmentProblem}</Alert>}
        {!orderId && !data.assignmentProblem && <Box sx={{ m: "auto", textAlign: "center", maxWidth: 320 }}>
          <MicRoundedIcon sx={{ fontSize: 56, color: colors.accent }} />
          <Typography fontWeight={750} sx={{ fontSize: 17, mt: 0.6 }}>Sua conversa começa aqui</Typography>
          <Typography sx={{ color: colors.muted, fontSize: 13, mt: 0.8 }}>
            Selecione a obra ou diário acima para falar, digitar, fotografar ou enviar comprovantes.
          </Typography>
        </Box>}
        {!!orderId && data.entries.length === 0 && <Box sx={{ m: "auto", textAlign: "center", maxWidth: 310 }}>
          <Typography sx={{ color: colors.muted, fontSize: 13 }}>
            Conte o que aconteceu. Os relatos e as ações autorizadas ficarão registrados aqui.
          </Typography>
        </Box>}
        {data.entries.map((entry) => {
          const own = entry.userId === data.user.id;
          const senderRight = own;
          const extra = /Ação executada:|Pendente, sem alteração automática:/.test(entry.content);
          return <Box key={entry.id} sx={{ display:"contents" }}><Box sx={{
            alignSelf: senderRight ? "flex-end" : "flex-start",
            maxWidth: "min(92%, 650px)", minWidth: 110, width: "fit-content",
            bgcolor: senderRight ? colors.bubble : colors.incoming,
            borderRadius: senderRight ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
            px: 1.55, py: 1.15, boxShadow: `0 1px 5px ${colors.shadow}`,
            overflowWrap: "anywhere", border: themeMode === "light" ? `1px solid ${colors.border}` : "none",
          }}>
            <Typography sx={{ fontSize: 11, color: colors.accent, fontWeight: 850, mb: 0.3 }}>{entry.authorName}</Typography>
            {entry.transcript && entry.title.toLowerCase().includes("áudio") && <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 0.6 }}>
              <MicRoundedIcon sx={{ fontSize: 16, color: colors.accent }} />
              <Typography sx={{ fontSize: 11, color: colors.muted }}>Áudio transcrito</Typography>
            </Stack>}
            <Typography sx={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap", color: colors.text }}>
              {entry.assistantReply ? (entry.transcript || (entry.title.includes("áudio") ? "Mensagem de voz" : "Solicitação registrada")) : entry.content}
            </Typography>
            {entry.attachment && <Button
              href={entry.attachment.storagePath.startsWith("campo/") ? `/api/campo/midia/${entry.attachment.id}` : `/api/whatsapp/media/${entry.attachment.id}`}
              target="_blank" rel="noopener noreferrer" startIcon={<DescriptionRoundedIcon />}
              sx={{ color: colors.accent, fontSize: 11, mt: 0.3, textTransform: "none" }}>
              Abrir anexo
            </Button>}
            <Stack direction="row" justifyContent="flex-end" alignItems="center" gap={0.5} sx={{ pt: 0.4 }}>
              {extra && !entry.assistantReply && <Chip size="small" label="Ação registrada" sx={{ color: colors.accent, height: 19, fontSize: 9, bgcolor: colors.input }} />}
              <Typography sx={{ fontSize: 10, color: colors.muted }}>
                {new Date(entry.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </Typography>
              {senderRight && <DoneAllRoundedIcon sx={{ fontSize: 14, color: colors.accent }} />}
            </Stack>
          </Box>{entry.assistantReply && <Box sx={{alignSelf:"flex-start",maxWidth:"min(94%,760px)",width:"fit-content",bgcolor:colors.incoming,borderRadius:"12px 12px 12px 3px",px:1.6,py:1.3,color:colors.text}}><Typography fontSize={11} color={colors.accent} fontWeight={850}>Assistente Aliança</Typography><Typography sx={{whiteSpace:"pre-wrap",fontSize:13.5,my:.5}}>{entry.assistantReply}</Typography>{entry.checklistReply&&<Stack gap={.7}><Typography fontWeight={800}>{entry.checklistReply.orderTitle}</Typography><Typography variant="caption" color={colors.muted}>{entry.checklistReply.done} de {entry.checklistReply.total} itens ativos concluídos e validados · {entry.checklistReply.pendingOnly?"Somente pendências":"Checklist completo"}</Typography>{entry.checklistReply.items.map(i=><Box key={i.id} sx={{p:1,borderRadius:1.5,bgcolor:colors.input}}><Typography fontWeight={750} fontSize={13}>{i.status==="DONE"?"✓":i.status==="BLOCKED"?"⚠":"○"} {i.title}</Typography><Typography sx={{fontSize:11,color:colors.muted}}>{({DONE:"Validado",AWAITING_VALIDATION:"Aguardando validação",PENDING:"Pendente",IN_PROGRESS:"Em andamento",BLOCKED:"Bloqueado",REOPENED:"Reaberto",CANCELED:"Cancelado"} as Record<string,string>)[i.status]||i.status} · {i.responsible.join(", ")||"Sem responsável"}</Typography>{i.blockedReason&&<Typography sx={{fontSize:12}}>Motivo: {i.blockedReason}</Typography>}</Box>)}</Stack>}</Box>}</Box>;
        })}
        {data.reports.slice(-1).map((report) => <Box key={report.id} sx={{
          alignSelf: "flex-start", maxWidth: "min(94%, 760px)", bgcolor: colors.incoming,
          color: colors.text, borderRadius: 2.5, px: 2, py: 1.5, boxShadow: `0 1px 4px ${colors.shadow}`,
        }}>
          <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}><AutoAwesomeRoundedIcon sx={{ fontSize: 18, color: colors.accent }}/><Typography fontWeight={850}>Relatório da Aliança</Typography></Stack>
          <Typography sx={{ fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{report.content}</Typography>
        </Box>)}
      </Box>
      <Box sx={{
        flexShrink: 0, bgcolor: colors.header, px: { xs: 1.1, sm: 2.5 },
        pt: 1.05, pb: "max(9px,env(safe-area-inset-bottom))",
        borderTop: `1px solid ${colors.border}`,
      }}>
        {(error || notice) && <Box sx={{ mb: 0.7 }}>
          {error && <Alert severity="error" onClose={() => setError("")} sx={{ fontSize: 12, py: 0.1 }}>{error}</Alert>}
          {!error && notice && <Typography sx={{ textAlign: "center", color: colors.notice, fontSize: 12, fontWeight: 650 }}>{notice}</Typography>}
        </Box>}
        {recording && <Stack direction="row" alignItems="center" justifyContent="center" gap={1} sx={{ mb: 0.9 }}>
          <Box sx={{ bgcolor: "#f35c62", height: 9, width: 9, borderRadius: "50%", animation: "campo-pulse 1s infinite" }} />
          <Typography sx={{ color: "#ff8f93", fontSize: 12, fontWeight: 750 }}>Gravando · transcrição a cada 15 segundos</Typography>
        </Stack>}
        <Stack direction="row" alignItems="flex-end" gap={0.8}>
          <Box sx={{
            bgcolor: colors.input, color: colors.text, minHeight: 45, flex: 1,
            display: "flex", alignItems: "center", borderRadius: "24px", px: 0.2,
            border: themeMode === "light" ? `1px solid ${colors.border}` : "none",
          }}>
            <IconButton size="small" aria-label="Anexar foto, vídeo ou comprovante"
              disabled={!orderId || recording || finalizing || busy}
              onClick={(event) => setAttachmentAnchor(event.currentTarget)}
              sx={{ color: colors.muted, ml: 0.4 }}><AttachFileRoundedIcon /></IconButton>
            <InputBase fullWidth multiline maxRows={4} value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={!orderId || recording || finalizing || busy}
              placeholder={recording ? "Gravando..." : "Mensagem"}
              sx={{
                flex: 1, minWidth: 0, color: colors.text, fontSize: 14,
                py: 0.8, px: 0.5, "& textarea::placeholder": { color: colors.muted, opacity: 1 },
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault(); void submitText();
                }
              }} />
            <IconButton size="small" aria-label="Tirar foto agora" disabled={!orderId || recording || finalizing || busy}
              onClick={() => cameraInput.current?.click()} sx={{ color: colors.muted, mr: 0.5 }}>
              <CameraAltRoundedIcon />
            </IconButton>
          </Box>
          <IconButton aria-label={recording ? "Parar gravação" : draft.trim() ? "Enviar mensagem" : "Gravar comando de voz"}
            disabled={!orderId || busy || finalizing}
            onClick={() => { if (draft.trim() && !recording) void submitText(); else void toggleRecording(); }}
            sx={{
              width: 46, height: 46, borderRadius: "50%", bgcolor: recording ? "#cf4e53" : colors.accent,
              color: "#fff", flexShrink: 0,
              "&:hover": { bgcolor: recording ? "#bc353a" : "#087655" },
              "&.Mui-disabled": { bgcolor: colors.border, color: colors.muted },
            }}>
            {recording ? <StopRoundedIcon /> : draft.trim() ? <SendRoundedIcon /> : <MicRoundedIcon />}
          </IconButton>
        </Stack>
        {pending > 0 || busy || finalizing ? <Typography sx={{ mt: 0.6, color: colors.muted, fontSize: 11, textAlign: "center" }}>
          <CircularProgress size={10} sx={{ mr: 0.6, color: colors.accent }} /> Salvando e processando...
        </Typography> : null}
      </Box>
      <Menu sx={{ zIndex: 1800 }} anchorEl={attachmentAnchor} open={Boolean(attachmentAnchor)} onClose={() => setAttachmentAnchor(null)}
        PaperProps={{ sx: { bgcolor: colors.dialog, color: colors.text, borderRadius: 3, minWidth: 225, border: `1px solid ${colors.border}` } }}>
        <MenuItem onClick={() => { setAttachmentAnchor(null); photoInput.current?.click(); }}><ImageRoundedIcon sx={{ mr: 1.3, color: colors.accent }}/> Foto da obra</MenuItem>
        <MenuItem onClick={() => { setAttachmentAnchor(null); videoInput.current?.click(); }}><VideocamRoundedIcon sx={{ mr: 1.3, color: colors.accent }}/> Vídeo da obra</MenuItem>
        <MenuItem onClick={() => { setAttachmentAnchor(null); receiptCameraInput.current?.click(); }}><CameraAltRoundedIcon sx={{ mr: 1.3, color: colors.accent }}/> Fotografar comprovante</MenuItem>
        <MenuItem onClick={() => { setAttachmentAnchor(null); receiptFileInput.current?.click(); }}><ReceiptLongRoundedIcon sx={{ mr: 1.3, color: colors.accent }}/> Enviar comprovante / PDF</MenuItem>
        {orderId !== "office" && orderId !== "warehouse" && <MenuItem onClick={() => { setAttachmentAnchor(null); void generateReport(); }}><AutoAwesomeRoundedIcon sx={{ mr: 1.3, color: colors.accent }}/> Gerar relatório da obra</MenuItem>}
      </Menu>
      <input ref={cameraInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden
        onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void uploadFile(file, "image"); }} />
      <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" hidden
        onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void uploadFile(file, "image"); }} />
      <input ref={videoInput} type="file" accept="video/mp4,video/webm,video/quicktime" hidden
        onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void uploadFile(file, "video"); }} />
      <input ref={receiptFileInput} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden
        onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; selectReceipt(file); }} />
      <input ref={receiptCameraInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden
        onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; selectReceipt(file); }} />

      <Dialog sx={{ zIndex: 1800 }} open={receiptOpen} onClose={busy || dictating ? undefined : () => { setReceiptOpen(false); setReceiptFile(null); }}
        fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: colors.dialog, color: colors.text, borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 850, display: "flex", alignItems: "center", gap: 1 }}>
          <ReceiptLongRoundedIcon sx={{ color: colors.accent }}/> Comprovante para o financeiro
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: colors.muted, fontSize: 13, mb: 1.5 }}>
            {receiptFile?.name || "Documento"} · Será salvo como pendente de conferência, sem movimentar o caixa automaticamente.
          </Typography>
          <TextField fullWidth multiline minRows={3} maxRows={6} value={receiptDescription}
            onChange={(event) => setReceiptDescription(event.target.value)}
            placeholder="Descrição opcional. A IA lerá o comprovante; você também pode ditar o contexto."
            disabled={busy || dictating} InputProps={{ sx: { color: colors.text, bgcolor: colors.input } }}
            sx={{ "& .MuiOutlinedInput-notchedOutline": { borderColor: colors.border },
              "& textarea::placeholder": { color: colors.muted, opacity: 1 } }}
          />
          <Button startIcon={dictating ? <StopRoundedIcon /> : <MicRoundedIcon />}
            onClick={() => void toggleDictation()} disabled={busy}
            color={dictating ? "error" : "success"} variant="outlined" sx={{ mt: 1.5 }}>
            {dictating ? "Parar ditado" : "Ditar descrição"}
          </Button>
          {dictating && <Typography sx={{ color: colors.muted, fontSize: 12, mt: 1 }}>Diga o fornecedor, a finalidade, o valor se souber e a obra. O áudio será transcrito no campo acima.</Typography>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button sx={{ color: colors.muted }} disabled={busy || dictating} onClick={() => { setReceiptOpen(false); setReceiptFile(null); }}>Cancelar</Button>
          <Button variant="contained" color="success" disabled={!receiptFile || busy || dictating}
            onClick={() => void sendReceipt()}>{busy ? "Salvando..." : "Enviar ao financeiro"}</Button>
        </DialogActions>
      </Dialog>
      <Drawer sx={{ zIndex: 1800 }} anchor="right" open={staffOpen} onClose={() => setStaffOpen(false)}
        PaperProps={{ sx: { width: "min(100vw, 460px)", bgcolor: colors.dialog, color: colors.text, p: 2, overflow: "auto" } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography fontWeight={850} variant="h6">Faltas e saídas antecipadas</Typography>
          <IconButton aria-label="Fechar ocorrências" sx={{ color: colors.text }} onClick={() => setStaffOpen(false)}><CloseRoundedIcon /></IconButton>
        </Stack>
        <Typography sx={{ color: colors.muted, fontSize: 12, mb: 2 }}>Ocorrências informadas por voz, sem descontos ou punições automáticas.</Typography>
        <Button onClick={() => void openStaff()} disabled={staffLoading}>Atualizar ocorrências</Button>
        {staffLoading && <CircularProgress size={22}/>}
        {staffError && <Alert severity="error">{staffError}</Alert>}
        {!staffLoading && !staffError && !staffReports.length && <Typography sx={{ color: colors.muted }}>Nenhuma ocorrência registrada. No chat, relate uma falta ou saída antecipada, informando nome e data.</Typography>}
        <Stack gap={1.3}>{staffReports.map((report) => <Box key={report.id} sx={{ bgcolor: colors.incoming, p: 2, borderRadius: 2 }}>
          <Typography fontWeight={750}>{report.employeeName} · {report.kind === "ABSENCE" ? "Falta informada" : "Saída antecipada"}</Typography>
          <Typography sx={{ color: colors.muted, fontSize: 12 }}>{report.occurredOn}{report.occurredAt ? " às " + report.occurredAt : ""} · {report.reportedByName}</Typography>
          {report.description && <Typography sx={{ fontSize: 13, mt: 0.6, whiteSpace: "pre-wrap" }}>{report.description}</Typography>}
        </Box>)}</Stack>
      </Drawer>
      <Drawer sx={{ zIndex: 1800 }} anchor="right" open={financeOpen} onClose={() => setFinanceOpen(false)}
        PaperProps={{ sx: { width: "min(100vw, 480px)", bgcolor: colors.dialog, color: colors.text, p: 2, overflow: "auto" } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="h6" fontWeight={850}>Comprovantes do financeiro</Typography>
          <IconButton aria-label="Fechar comprovantes" sx={{ color: colors.text }} onClick={() => setFinanceOpen(false)}><CloseRoundedIcon /></IconButton>
        </Stack>
        <Typography sx={{ color: colors.muted, fontSize: 12, mb: 2 }}>Dê baixa aqui ou consulte comprovantes pendentes no chat e confirme por voz ou texto.</Typography>
        {financeOpen && <FieldReceiptsBoard compact />}
      </Drawer>
      <Drawer sx={{ zIndex: 1800 }} anchor="right" open={warehouseOpen} onClose={() => setWarehouseOpen(false)}
        PaperProps={{ sx: { width: "min(100vw, 450px)", bgcolor: colors.dialog, color: colors.text, p: 2, overflow: "auto" } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="h6" fontWeight={850}>Movimentos do almoxarifado</Typography>
          <IconButton aria-label="Fechar almoxarifado" onClick={() => setWarehouseOpen(false)} sx={{ color: colors.text }}><CloseRoundedIcon /></IconButton>
        </Stack>
        <Typography sx={{ color: colors.muted, fontSize: 12, mb: 2 }}>Registros de entradas, retiradas, devoluções e equipamentos.</Typography>
        <Button onClick={() => void openWarehouse()} disabled={warehouseLoading}>Atualizar movimentos</Button>
        {warehouseLoading && <CircularProgress size={22}/>}
        {warehouseError && <Alert severity="error">{warehouseError}</Alert>}
        {!warehouseLoading && !warehouseError && !data.warehouseJournal?.length && <Typography sx={{ color: colors.muted }}>Nenhum movimento recente. Registre entradas, retiradas ou devoluções pelo chat.</Typography>}
        <Stack gap={1.2}>{data.warehouseJournal?.slice(-60).reverse().map((entry) => <Box key={entry.id} sx={{ bgcolor: colors.incoming, borderRadius: 2, p: 1.5 }}>
          <Typography fontWeight={750} sx={{ fontSize: 12 }}>{entry.authorName} · {new Date(entry.createdAt).toLocaleString("pt-BR")}</Typography>
          <Typography sx={{ fontSize: 13, whiteSpace: "pre-wrap", mt: 0.5 }}>{entry.content}</Typography>
        </Box>)}</Stack>
      </Drawer>
      <style>{`@keyframes campo-pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </Box>
  );
}
