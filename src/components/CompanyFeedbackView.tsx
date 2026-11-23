"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddCommentRoundedIcon from "@mui/icons-material/AddCommentRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import MarkUnreadChatAltRoundedIcon from "@mui/icons-material/MarkUnreadChatAltRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";

import { formatDateTime } from "@/lib/format";
import { labelFor } from "@/lib/labels";
import type { CompanyFeedback, CompanyFeedbackCategory } from "@/lib/types";

type AnonymousCompanyFeedback = Omit<CompanyFeedback, "submittedByUserId">;

const categoryOptions: CompanyFeedbackCategory[] = ["SUGESTAO", "RECLAMACAO", "ELOGIO", "MELHORIA", "SEGURANCA", "OUTROS"];

function categoryColor(category: CompanyFeedbackCategory) {
  if (category === "RECLAMACAO" || category === "SEGURANCA") return "warning";
  if (category === "ELOGIO") return "success";
  if (category === "MELHORIA") return "info";
  return "primary";
}

export function CompanyFeedbackView({
  canReadFeedbacks,
  initialFeedbacks,
}: {
  canReadFeedbacks: boolean;
  initialFeedbacks: AnonymousCompanyFeedback[];
}) {
  const [category, setCategory] = useState<CompanyFeedbackCategory>("SUGESTAO");
  const [message, setMessage] = useState("");
  const [feedbacks, setFeedbacks] = useState(initialFeedbacks);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const stats = useMemo(() => {
    const total = feedbacks.length;
    const newItems = feedbacks.filter((feedback) => feedback.status === "NEW").length;
    const safetyItems = feedbacks.filter((feedback) => feedback.category === "SEGURANCA").length;
    return { total, newItems, safetyItems };
  }, [feedbacks]);

  async function submitFeedback(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setError("");

    if (message.trim().length < 5) {
      setError("Escreva pelo menos 5 caracteres.");
      return;
    }

    setSaving(true);
    const response = await fetch("/api/company-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, message }),
    });
    const data = await response.json().catch(() => null);
    setSaving(false);

    if (!response.ok) {
      setError(data?.message ?? "Nao foi possivel enviar o feedback.");
      return;
    }

    setMessage("");
    setCategory("SUGESTAO");
    setNotice("Feedback enviado. A gerencia vera o comentario sem identificacao na tela.");
    if (canReadFeedbacks && data?.feedback) {
      setFeedbacks((current) => [data.feedback as AnonymousCompanyFeedback, ...current]);
    }
  }

  async function refreshFeedbacks() {
    setError("");
    const response = await fetch("/api/company-feedback", { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.message ?? "Nao foi possivel atualizar os feedbacks.");
      return;
    }
    setFeedbacks(data?.feedbacks ?? []);
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "flex-end" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 34 }, mb: 0.7 }}>
            Feedback da empresa
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 760 }}>
            Canal interno para opinioes anonimas na visualizacao da gerencia.
          </Typography>
        </Box>
        <Chip icon={<ShieldRoundedIcon />} color="primary" variant="outlined" label={canReadFeedbacks ? "Leitura gerencial" : "Envio anonimo"} />
      </Stack>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: canReadFeedbacks ? "0.82fr 1.18fr" : "minmax(0, 760px)" }, gap: 2.5 }}>
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, alignSelf: "start" }}>
          <Stack component="form" spacing={2} onSubmit={submitFeedback}>
            <Stack direction="row" spacing={1.2} alignItems="center">
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 2,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                }}
              >
                <AddCommentRoundedIcon />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6">Enviar opiniao</Typography>
                <Typography variant="body2" color="text.secondary">
                  Registrado internamente, exibido como anonimo para leitura.
                </Typography>
              </Box>
            </Stack>

            {notice && <Alert severity="success">{notice}</Alert>}
            {error && <Alert severity="warning">{error}</Alert>}
            {saving && <LinearProgress />}

            <FormControl fullWidth>
              <InputLabel id="company-feedback-category-label">Tipo</InputLabel>
              <Select
                labelId="company-feedback-category-label"
                label="Tipo"
                value={category}
                onChange={(event) => setCategory(event.target.value as CompanyFeedbackCategory)}
              >
                {categoryOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {labelFor(option)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Comentario"
              placeholder="Escreva com clareza o que pode melhorar, o que preocupa ou o que merece reconhecimento."
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              multiline
              minRows={6}
              inputProps={{ maxLength: 1200 }}
              helperText={`${message.length}/1200 caracteres`}
              required
            />

            <Button type="submit" variant="contained" startIcon={<LockRoundedIcon />} disabled={saving || message.trim().length < 5}>
              {saving ? "Enviando..." : "Enviar feedback anonimo"}
            </Button>

            <Divider />
            <Stack direction="row" spacing={1} alignItems="center" color="text.secondary">
              <VisibilityOffRoundedIcon fontSize="small" />
              <Typography variant="body2">
                Na lista da gerencia nao aparece nome, telefone, e-mail ou perfil do autor.
              </Typography>
            </Stack>
          </Stack>
        </Paper>

        {canReadFeedbacks && (
          <Stack spacing={2}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 1.5 }}>
              <SummaryCard label="Recebidos" value={stats.total} />
              <SummaryCard label="Novos" value={stats.newItems} tone="primary" />
              <SummaryCard label="Seguranca" value={stats.safetyItems} tone="warning" />
            </Box>

            <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }} justifyContent="space-between">
                <Box>
                  <Typography variant="h6">Opinioes recebidas</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Visualizacao sem identificacao do autor.
                  </Typography>
                </Box>
                <Button variant="outlined" onClick={() => void refreshFeedbacks()}>
                  Atualizar
                </Button>
              </Stack>
            </Paper>

            {feedbacks.length === 0 ? (
              <Paper variant="outlined" sx={{ p: 4, textAlign: "center", borderRadius: 2 }}>
                <MarkUnreadChatAltRoundedIcon color="primary" sx={{ fontSize: 38, mb: 1 }} />
                <Typography variant="h6">Nenhum feedback recebido</Typography>
                <Typography color="text.secondary">Quando a equipe comentar, os registros aparecem aqui.</Typography>
              </Paper>
            ) : (
              <Stack spacing={1.5}>
                {feedbacks.map((feedback, index) => (
                  <Paper key={feedback.id} variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                    <Stack spacing={1.5}>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} justifyContent="space-between">
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Typography fontWeight={850}>Comentario anonimo #{feedbacks.length - index}</Typography>
                          <Chip size="small" color={categoryColor(feedback.category)} label={labelFor(feedback.category)} />
                          <Chip size="small" variant="outlined" label={labelFor(feedback.status)} />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {formatDateTime(feedback.createdAt)}
                        </Typography>
                      </Stack>
                      <Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{feedback.message}</Typography>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Stack>
        )}
      </Box>

      {!canReadFeedbacks && (
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
          <Stack direction="row" spacing={1.2} alignItems="center">
            <VisibilityOffRoundedIcon color="primary" />
            <Box>
              <Typography fontWeight={850}>Leitura restrita</Typography>
              <Typography variant="body2" color="text.secondary">
                Somente dono e gerentes acessam a lista de comentarios.
              </Typography>
            </Box>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

function SummaryCard({ label, value, tone = "secondary" }: { label: string; value: number; tone?: "primary" | "secondary" | "warning" }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h4" color={`${tone}.main`} fontWeight={900}>
        {value}
      </Typography>
    </Paper>
  );
}
