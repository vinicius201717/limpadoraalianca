"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  Paper,
  Rating,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CleaningServicesRoundedIcon from "@mui/icons-material/CleaningServicesRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import KeyRoundedIcon from "@mui/icons-material/KeyRounded";
import LocationOnRoundedIcon from "@mui/icons-material/LocationOnRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PhotoCameraRoundedIcon from "@mui/icons-material/PhotoCameraRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";

import { formatDateTime } from "@/lib/format";
import { labelFor } from "@/lib/labels";
import type { ChecklistItemStatus, ChecklistPhotoType, ServiceOrderStatus, ServiceType } from "@/lib/types";
import { SoapBubbleStatusEffect } from "./SoapBubbleStatusEffect";

type PublicChecklistPhoto = {
  id: string;
  checklistItemId: string;
  type: ChecklistPhotoType;
  typeLabel: string;
  url: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  caption: string;
  createdAt: string;
};

type PublicChecklistItem = {
  id: string;
  title: string;
  description: string;
  status: ChecklistItemStatus;
  statusLabel: string;
  isPriority: boolean;
  requiresPhoto: boolean;
  minimumPhotos: number;
  completedAt?: string;
  validatedAt?: string;
  updatedAt: string;
  startedAt?: string;
  photoCount: number;
  photos: PublicChecklistPhoto[];
};

type TrackingData = {
  serviceOrder: {
    id: string;
    title: string;
    customerName: string;
    serviceType?: ServiceType;
    status: ServiceOrderStatus;
    address: string;
    scheduledStart: string;
    scheduledEnd: string;
    clientNotes: string;
    lastUpdateAt: string;
    delivery: {
      signedAt?: string;
      signedBy?: string;
      rating?: number;
      feedback?: string;
      signatureUrl?: string;
    };
  };
  progress: {
    total: number;
    completed: number;
    pending: number;
    inProgress: number;
    blocked: number;
    percent: number;
    nextItemTitle: string;
  };
  checklist: PublicChecklistItem[];
};

const storageKey = "alianca-service-tracking-code";

function normalizeTypedCode(value: string) {
  return value.trim().toUpperCase();
}

function statusColor(status: ChecklistItemStatus | ServiceOrderStatus) {
  if (status === "DONE" || status === "DELIVERED") return "success";
  if (status === "IN_PROGRESS" || status === "PREPARING") return "info";
  if (status === "BLOCKED" || status === "PAUSED" || status === "WAITING_CUSTOMER") return "warning";
  if (status === "CANCELED") return "error";
  return "default";
}

function isVideoMedia(media: { url?: string; mimeType?: string; fileName?: string }) {
  const mimeType = media.mimeType?.toLowerCase() ?? "";
  const source = `${media.url ?? ""} ${media.fileName ?? ""}`.toLowerCase();
  return mimeType.startsWith("video/") || /\.(mp4|webm|mov)(?:\?|$)/i.test(source);
}

function PublicMediaPreview({
  media,
  alt,
  sx,
}: {
  media: { url?: string; mimeType?: string; fileName?: string };
  alt: string;
  sx?: SxProps<Theme>;
}) {
  if (isVideoMedia(media)) {
    return <Box component="video" src={media.url} aria-label={alt} controls playsInline preload="metadata" sx={sx} />;
  }

  return <Box component="img" src={media.url} alt={alt} loading="lazy" sx={sx} />;
}

export function ClientServiceTrackingView() {
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [code, setCode] = useState("");
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientRating, setClientRating] = useState<number | null>(5);
  const [clientFeedback, setClientFeedback] = useState("");
  const [signatureTouched, setSignatureTouched] = useState(false);
  const [deliverySubmitting, setDeliverySubmitting] = useState(false);
  const [deliveryError, setDeliveryError] = useState("");
  const [deliverySuccess, setDeliverySuccess] = useState("");

  const fetchTracking = useCallback(async (nextCode: string) => {
    const normalized = normalizeTypedCode(nextCode);
    if (!normalized) {
      setError("Informe o codigo recebido pela equipe.");
      setData(null);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/public/service-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setData(null);
        setError(payload?.message ?? "Nao foi possivel localizar este acompanhamento.");
        return;
      }

      setData(payload as TrackingData);
      setClientName((payload as TrackingData).serviceOrder.customerName ?? "");
      setCode(normalized);
      window.localStorage.setItem(storageKey, normalized);
    } catch {
      setData(null);
      setError("Nao foi possivel consultar agora. Tente novamente em instantes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const queryCode = new URLSearchParams(window.location.search).get("codigo");
    const savedCode = window.localStorage.getItem(storageKey);
    const initialCode = queryCode || savedCode || "";
    if (!initialCode) return;
    const timeoutId = window.setTimeout(() => {
      void fetchTracking(initialCode);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchTracking]);

  const progressLabel = useMemo(() => {
    if (!data) return "Aguardando codigo";
    if (data.progress.total === 0) return "Checklist ainda nao cadastrado";
    return `${data.progress.completed} de ${data.progress.total} etapas concluidas`;
  }, [data]);

  function clearCode() {
    window.localStorage.removeItem(storageKey);
    setCode("");
    setData(null);
    setError("");
    clearSignature();
    setDeliveryError("");
    setDeliverySuccess("");
  }

  function canvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function prepareSignatureCanvas() {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return null;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.lineWidth = 3.4;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#10203d";
    return context;
  }

  function startSignature(event: React.PointerEvent<HTMLCanvasElement>) {
    const context = prepareSignatureCanvas();
    const point = canvasPoint(event);
    if (!context || !point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    context.beginPath();
    context.moveTo(point.x, point.y);
  }

  function drawSignature(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const context = prepareSignatureCanvas();
    const point = canvasPoint(event);
    if (!context || !point) return;
    context.lineTo(point.x, point.y);
    context.stroke();
    setSignatureTouched(true);
  }

  function endSignature(event?: React.PointerEvent<HTMLCanvasElement>) {
    if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drawingRef.current = false;
  }

  function clearSignature() {
    const canvas = signatureCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureTouched(false);
  }

  async function submitDeliveryConfirmation() {
    if (!data) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas || !signatureTouched) {
      setDeliveryError("Assine no campo para confirmar a entrega.");
      return;
    }

    setDeliverySubmitting(true);
    setDeliveryError("");
    setDeliverySuccess("");

    const response = await fetch("/api/public/service-tracking/delivery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        clientName,
        rating: clientRating ?? undefined,
        feedback: clientFeedback,
        signatureDataUrl: canvas.toDataURL("image/png"),
      }),
    });
    const payload = await response.json().catch(() => null);
    setDeliverySubmitting(false);

    if (!response.ok) {
      setDeliveryError(payload?.message ?? "Nao foi possivel confirmar a entrega.");
      return;
    }

    setDeliverySuccess("Entrega confirmada com sucesso. Obrigado pela avaliacao.");
    await fetchTracking(code);
  }

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100vh",
        bgcolor: "#f5fbff",
        background:
          "radial-gradient(circle at top left, rgba(0,168,232,.16), transparent 34%), radial-gradient(circle at bottom right, rgba(37,199,131,.16), transparent 28%), #f5fbff",
        color: "#10203d",
        py: { xs: 2, md: 5 },
        px: { xs: 1.5, md: 3 },
      }}
    >
      <Box sx={{ width: "min(1180px, 100%)", mx: "auto" }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 3 },
            borderRadius: 3,
            border: "1px solid rgba(0,168,232,.14)",
            boxShadow: "0 24px 80px rgba(16, 32, 61, .10)",
            overflow: "hidden",
          }}
        >
          <Stack spacing={3}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={2}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box component="img" src="/logo-alianca.png" alt="Alianca Limpeza e Restauracao" sx={{ width: 58, height: 58, objectFit: "contain", borderRadius: 2, bgcolor: "white" }} />
                <Box>
                  <Typography fontWeight={950}>Alianca</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Acompanhamento do servico
                  </Typography>
                </Box>
              </Stack>
              <Chip icon={<LockRoundedIcon />} label="Area do cliente" color="primary" variant="outlined" />
            </Stack>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: data ? "0.72fr 1.28fr" : "1fr" }, gap: 2.5 }}>
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="overline" sx={{ color: "#009fda", fontWeight: 900 }}>
                    Acompanhe o servico
                  </Typography>
                  <Typography variant="h3" sx={{ maxWidth: 760, fontWeight: 950, fontSize: { xs: 34, md: 54 }, lineHeight: 1.03 }}>
                    Veja o progresso da sua obra com clareza.
                  </Typography>
                  <Typography sx={{ mt: 1.5, maxWidth: 720, color: "text.secondary", fontSize: { xs: 16, md: 18 } }}>
                    Digite o codigo enviado pela equipe da Alianca para consultar status, prazo, checklist, fotos, videos e observacoes de entrega.
                  </Typography>
                </Box>

                <Box component="form" onSubmit={(event) => {
                  event.preventDefault();
                  void fetchTracking(code);
                }}>
                  <Paper variant="outlined" sx={{ p: 1, borderRadius: 2.5, bgcolor: "white" }}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <TextField
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                        label="Codigo de acompanhamento"
                        placeholder="Ex: ALI-123-ABC"
                        fullWidth
                        InputProps={{ startAdornment: <KeyRoundedIcon sx={{ mr: 1, color: "text.secondary" }} /> }}
                      />
                      <Button type="submit" variant="contained" size="large" disabled={loading} sx={{ px: 3, minHeight: 56 }}>
                        {loading ? <CircularProgress size={22} color="inherit" /> : "Acompanhar"}
                      </Button>
                    </Stack>
                  </Paper>
                  {error && (
                    <Alert severity="warning" sx={{ mt: 1.5, borderRadius: 2 }}>
                      {error}
                    </Alert>
                  )}
                </Box>

                {data && (
                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2.5, bgcolor: "#10203d", color: "white" }}>
                    <Stack spacing={2}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
                        <Box>
                          <Typography variant="body2" sx={{ color: "rgba(255,255,255,.68)" }}>
                            Progresso geral
                          </Typography>
                          <Typography variant="h4" fontWeight={950}>
                            {data.progress.percent}%
                          </Typography>
                        </Box>
                        <Chip label={labelFor(data.serviceOrder.status)} color={statusColor(data.serviceOrder.status)} />
                      </Stack>
                      <LinearProgress variant="determinate" value={data.progress.percent} sx={{ height: 11, borderRadius: 999, bgcolor: "rgba(255,255,255,.16)" }} />
                      <Typography variant="body2" sx={{ color: "rgba(255,255,255,.76)" }}>
                        {progressLabel}
                        {data.progress.nextItemTitle ? ` • Proxima etapa: ${data.progress.nextItemTitle}` : ""}
                      </Typography>
                    </Stack>
                  </Paper>
                )}
              </Stack>

              {data && (
                <Stack spacing={2}>
                  <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2.5 }}>
                    <Stack spacing={2}>
                      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
                        <Box>
                          <Typography variant="h5" fontWeight={950}>
                            {data.serviceOrder.title}
                          </Typography>
                          <Typography color="text.secondary">
                            {data.serviceOrder.customerName} • {labelFor(data.serviceOrder.serviceType)}
                          </Typography>
                        </Box>
                        <Button variant="outlined" startIcon={<RestartAltRoundedIcon />} onClick={clearCode}>
                          Trocar codigo
                        </Button>
                      </Stack>
                      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 1.25 }}>
                        <InfoCard icon={<CleaningServicesRoundedIcon />} label="Status" value={labelFor(data.serviceOrder.status)} />
                        <InfoCard icon={<AccessTimeRoundedIcon />} label="Previsao" value={formatDateTime(data.serviceOrder.scheduledEnd)} />
                        <InfoCard icon={<ShieldRoundedIcon />} label="Ultima atualizacao" value={formatDateTime(data.serviceOrder.lastUpdateAt)} />
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ color: "text.secondary" }}>
                        <LocationOnRoundedIcon fontSize="small" />
                        <Typography variant="body2">{data.serviceOrder.address}</Typography>
                      </Stack>
                      {data.serviceOrder.clientNotes && (
                        <Alert severity="info" sx={{ borderRadius: 2 }}>
                          {data.serviceOrder.clientNotes}
                        </Alert>
                      )}
                    </Stack>
                  </Paper>

                  <Paper variant="outlined" sx={{ p: { xs: 1.25, md: 2 }, borderRadius: 2.5 }}>
                    <Stack spacing={1.5}>
                      <Box sx={{ px: { xs: 0.75, md: 0 } }}>
                        <Typography variant="h6" fontWeight={950}>
                          Checklist do servico
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Etapas registradas pela equipe durante a execucao.
                        </Typography>
                      </Box>
                      {data.checklist.length === 0 ? (
                        <Alert severity="info" sx={{ borderRadius: 2 }}>
                          O checklist ainda nao foi cadastrado para esta ordem de servico.
                        </Alert>
                      ) : (
                        <Stack spacing={1}>
                          {data.checklist.map((item) => (
                            <Accordion
                              key={item.id}
                              disableGutters
                              sx={{
                                position: "relative",
                                border: 1,
                                borderColor: item.status === "IN_PROGRESS" ? "info.main" : "divider",
                                borderRadius: "12px !important",
                                overflow: "hidden",
                                boxShadow: item.status === "IN_PROGRESS" ? "0 10px 28px rgba(0, 168, 232, .12)" : "none",
                                "&:before": { display: "none" },
                              }}
                            >
                              {item.status === "IN_PROGRESS" && <SoapBubbleStatusEffect />}
                              <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />} sx={{ position: "relative", zIndex: 1 }}>
                                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }} sx={{ width: "100%" }}>
                                  <Typography fontWeight={900} sx={{ flex: 1 }}>
                                    {item.title}
                                  </Typography>
                                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                    {item.isPriority && <Chip size="small" color="error" label="Prioridade" />}
                                    <Chip size="small" color={statusColor(item.status)} label={item.statusLabel} />
                                    {item.photoCount > 0 && <Chip size="small" icon={<PhotoCameraRoundedIcon />} label={`${item.photoCount} midia${item.photoCount > 1 ? "s" : ""}`} />}
                                  </Stack>
                                </Stack>
                              </AccordionSummary>
                              <AccordionDetails>
                                <Stack spacing={1.5}>
                                  {item.description && <Typography color="text.secondary">{item.description}</Typography>}
                                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1 }}>
                                    <MiniInfo label="Iniciado em" value={item.startedAt ? formatDateTime(item.startedAt) : "Pendente"} />
                                    <MiniInfo label="Atualizado em" value={formatDateTime(item.updatedAt)} />
                                    <MiniInfo label="Concluido em" value={item.completedAt ? formatDateTime(item.completedAt) : "Pendente"} />
                                  </Box>
                                  {item.validatedAt && (
                                    <Chip icon={<CheckCircleRoundedIcon />} color="success" label={`Validado em ${formatDateTime(item.validatedAt)}`} sx={{ alignSelf: "flex-start" }} />
                                  )}
                                  {item.photos.length > 0 && (
                                    <>
                                      <Divider />
                                      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1.25 }}>
                                        {item.photos.map((photo) => (
                                          <Box key={photo.id} sx={{ borderRadius: 2, overflow: "hidden", border: 1, borderColor: "divider", bgcolor: "background.default" }}>
                                            <PublicMediaPreview media={photo} alt={photo.caption || photo.typeLabel} sx={{ width: "100%", aspectRatio: "16 / 10", objectFit: "cover", display: "block" }} />
                                            <Box sx={{ p: 1 }}>
                                              <Typography variant="caption" color="text.secondary">
                                                {photo.typeLabel} • {formatDateTime(photo.createdAt)}
                                              </Typography>
                                              {photo.caption && <Typography fontWeight={800}>{photo.caption}</Typography>}
                                            </Box>
                                          </Box>
                                        ))}
                                      </Box>
                                    </>
                                  )}
                                </Stack>
                              </AccordionDetails>
                            </Accordion>
                          ))}
                        </Stack>
                      )}
                    </Stack>
                  </Paper>

                  <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2.5 }}>
                    {data.serviceOrder.delivery.signedAt ? (
                      <Stack spacing={2}>
                        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5}>
                          <Box>
                            <Typography variant="h6" fontWeight={950}>
                              Entrega confirmada
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Assinada por {data.serviceOrder.delivery.signedBy || data.serviceOrder.customerName} em {formatDateTime(data.serviceOrder.delivery.signedAt)}.
                            </Typography>
                          </Box>
                          <Chip color="success" icon={<CheckCircleRoundedIcon />} label="Serviço entregue" />
                        </Stack>
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Avaliação do cliente
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                              <Rating value={data.serviceOrder.delivery.rating ?? 0} readOnly />
                              <Typography fontWeight={900}>{data.serviceOrder.delivery.rating ?? "-"}/5</Typography>
                            </Stack>
                            {data.serviceOrder.delivery.feedback && (
                              <Alert severity="success" sx={{ mt: 1.5, borderRadius: 2 }}>
                                {data.serviceOrder.delivery.feedback}
                              </Alert>
                            )}
                          </Box>
                          {data.serviceOrder.delivery.signatureUrl && (
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                Assinatura de entrega
                              </Typography>
                              <Box
                                component="img"
                                src={data.serviceOrder.delivery.signatureUrl}
                                alt="Assinatura do cliente"
                                sx={{ display: "block", width: "100%", mt: 0.8, borderRadius: 2, border: 1, borderColor: "divider", bgcolor: "white" }}
                              />
                            </Box>
                          )}
                        </Box>
                      </Stack>
                    ) : (
                      <Stack spacing={2}>
                        <Box>
                          <Typography variant="h6" fontWeight={950}>
                            Confirmar entrega do serviço
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Assine com o dedo na tela do celular para confirmar que o serviço foi entregue.
                          </Typography>
                        </Box>
                        {data.progress.percent < 100 && (
                          <Alert severity="warning" sx={{ borderRadius: 2 }}>
                            O checklist ainda nao esta 100% concluido. Confirme a entrega apenas se a equipe finalizou o servico presencialmente.
                          </Alert>
                        )}
                        <TextField label="Nome de quem confirma" value={clientName} onChange={(event) => setClientName(event.target.value)} fullWidth />
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Nota do atendimento
                          </Typography>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.8 }}>
                            <Rating value={clientRating} onChange={(_, value) => setClientRating(value)} />
                            <Typography fontWeight={900}>{clientRating ?? "-"}/5</Typography>
                          </Stack>
                        </Box>
                        <TextField
                          label="Comentário sobre o serviço (opcional)"
                          value={clientFeedback}
                          onChange={(event) => setClientFeedback(event.target.value)}
                          multiline
                          minRows={3}
                          fullWidth
                        />
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Assinatura de confirmação
                          </Typography>
                          <Box
                            component="canvas"
                            ref={signatureCanvasRef}
                            width={720}
                            height={240}
                            onPointerDown={startSignature}
                            onPointerMove={drawSignature}
                            onPointerUp={endSignature}
                            onPointerLeave={endSignature}
                            sx={{
                              display: "block",
                              width: "100%",
                              height: { xs: 178, sm: 210 },
                              mt: 0.8,
                              borderRadius: 2,
                              border: "1px dashed rgba(16,32,61,.35)",
                              bgcolor: "white",
                              touchAction: "none",
                              cursor: "crosshair",
                            }}
                          />
                        </Box>
                        {deliveryError && <Alert severity="error">{deliveryError}</Alert>}
                        {deliverySuccess && <Alert severity="success">{deliverySuccess}</Alert>}
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                          <Button variant="outlined" onClick={clearSignature}>
                            Limpar assinatura
                          </Button>
                          <Button variant="contained" onClick={submitDeliveryConfirmation} disabled={deliverySubmitting}>
                            {deliverySubmitting ? "Enviando..." : "Confirmar entrega"}
                          </Button>
                        </Stack>
                      </Stack>
                    )}
                  </Paper>
                </Stack>
              )}
            </Box>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "background.default", border: 1, borderColor: "divider" }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "primary.main" }}>
        {icon}
        <Typography variant="caption" color="text.secondary" fontWeight={850}>
          {label}
        </Typography>
      </Stack>
      <Typography fontWeight={900} sx={{ mt: 0.75, wordBreak: "break-word" }}>
        {value}
      </Typography>
    </Box>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: "background.default" }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography fontWeight={850}>{value}</Typography>
    </Box>
  );
}
