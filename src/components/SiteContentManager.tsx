"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddPhotoAlternateRoundedIcon from "@mui/icons-material/AddPhotoAlternateRounded";
import RateReviewRoundedIcon from "@mui/icons-material/RateReviewRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";

import type { SiteBeforeAfter, SiteTestimonial } from "@/lib/types";

const serviceOptions = [
  "Limpeza pós-obra",
  "Restauração de mármore",
  "Polimento de granito",
  "Impermeabilizacao",
  "Cristalizacao",
  "Limpeza fina para entrega",
];

export function SiteContentManager({
  beforeAfters,
  testimonials,
}: {
  beforeAfters: SiteBeforeAfter[];
  testimonials: SiteTestimonial[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [beforeAfter, setBeforeAfter] = useState({
    title: "",
    serviceType: "Limpeza pós-obra",
    location: "",
    beforeImageUrl: "",
    afterImageUrl: "",
    description: "",
  });
  const [testimonial, setTestimonial] = useState({
    customerName: "",
    roleOrNeighborhood: "",
    rating: 5,
    quote: "",
    serviceType: "Limpeza pós-obra",
  });

  async function uploadSiteImage(file: File) {
    const body = new FormData();
    body.append("file", file);

    const response = await fetch("/api/site-content/upload", {
      method: "POST",
      body,
    });

    if (!response.ok) {
      throw new Error("Nao foi possivel enviar a imagem.");
    }

    const data = (await response.json()) as { url: string };
    return data.url;
  }

  async function postContent(payload: Record<string, unknown>) {
    const response = await fetch("/api/site-content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Nao foi possivel publicar. Verifique os campos e tente novamente.");
    }

    return true;
  }

  async function submitBeforeAfter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!beforeFile && !beforeAfter.beforeImageUrl.trim()) {
      setError("Envie a imagem de antes ou informe uma URL.");
      return;
    }

    if (!afterFile && !beforeAfter.afterImageUrl.trim()) {
      setError("Envie a imagem de depois ou informe uma URL.");
      return;
    }

    setSaving(true);
    try {
      const payload = { ...beforeAfter };
      if (beforeFile) payload.beforeImageUrl = await uploadSiteImage(beforeFile);
      if (afterFile) payload.afterImageUrl = await uploadSiteImage(afterFile);

      await postContent({ type: "beforeAfter", ...payload });
      setBeforeAfter({
        title: "",
        serviceType: "Limpeza pós-obra",
        location: "",
        beforeImageUrl: "",
        afterImageUrl: "",
        description: "",
      });
      setBeforeFile(null);
      setAfterFile(null);
      setMessage("Antes/depois publicado no site.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel publicar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function submitTestimonial(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setSaving(true);
    try {
      await postContent({ type: "testimonial", ...testimonial });
      setTestimonial({
        customerName: "",
        roleOrNeighborhood: "",
        rating: 5,
        quote: "",
        serviceType: "Limpeza pós-obra",
      });
      setMessage("Feedback publicado no site.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel publicar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
      <Stack spacing={2.5}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1.5}>
          <Box>
            <Typography variant="h6">Site publico</Typography>
            <Typography variant="body2" color="text.secondary">
              Publique provas visuais e feedbacks que aparecem automaticamente na home de clientes.
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {beforeAfters.length} antes/depois - {testimonials.length} depoimentos
          </Typography>
        </Stack>

        {message && <Alert severity="success">{message}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "1fr 1fr" }, gap: 2 }}>
          <Box component="form" onSubmit={submitBeforeAfter} sx={{ p: 2, borderRadius: 2, bgcolor: "background.default", border: 1, borderColor: "divider" }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <AddPhotoAlternateRoundedIcon color="primary" />
                <Typography fontWeight={900}>Antes e depois</Typography>
              </Stack>
              <TextField label="Titulo" required value={beforeAfter.title} onChange={(event) => setBeforeAfter((current) => ({ ...current, title: event.target.value }))} />
              <TextField select label="Servico" value={beforeAfter.serviceType} onChange={(event) => setBeforeAfter((current) => ({ ...current, serviceType: event.target.value }))}>
                {serviceOptions.map((service) => (
                  <MenuItem key={service} value={service}>
                    {service}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label="Local" required value={beforeAfter.location} onChange={(event) => setBeforeAfter((current) => ({ ...current, location: event.target.value }))} />
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
                <Stack spacing={1}>
                  <Button component="label" variant="outlined" startIcon={<AddPhotoAlternateRoundedIcon />}>
                    Enviar imagem antes
                    <input
                      hidden
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      onChange={(event) => setBeforeFile(event.target.files?.[0] ?? null)}
                    />
                  </Button>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {beforeFile?.name ?? "Nenhum arquivo selecionado"}
                  </Typography>
                </Stack>
                <Stack spacing={1}>
                  <Button component="label" variant="outlined" startIcon={<AddPhotoAlternateRoundedIcon />}>
                    Enviar imagem depois
                    <input
                      hidden
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      onChange={(event) => setAfterFile(event.target.files?.[0] ?? null)}
                    />
                  </Button>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {afterFile?.name ?? "Nenhum arquivo selecionado"}
                  </Typography>
                </Stack>
              </Box>
              <TextField label="URL da imagem antes (opcional)" value={beforeAfter.beforeImageUrl} onChange={(event) => setBeforeAfter((current) => ({ ...current, beforeImageUrl: event.target.value }))} />
              <TextField label="URL da imagem depois (opcional)" value={beforeAfter.afterImageUrl} onChange={(event) => setBeforeAfter((current) => ({ ...current, afterImageUrl: event.target.value }))} />
              <TextField label="Descricao" required multiline minRows={3} value={beforeAfter.description} onChange={(event) => setBeforeAfter((current) => ({ ...current, description: event.target.value }))} />
              <Button type="submit" variant="contained" startIcon={<SaveRoundedIcon />} disabled={saving}>
                Publicar antes/depois
              </Button>
            </Stack>
          </Box>

          <Box component="form" onSubmit={submitTestimonial} sx={{ p: 2, borderRadius: 2, bgcolor: "background.default", border: 1, borderColor: "divider" }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <RateReviewRoundedIcon color="primary" />
                <Typography fontWeight={900}>Feedback de cliente</Typography>
              </Stack>
              <TextField label="Nome do cliente" required value={testimonial.customerName} onChange={(event) => setTestimonial((current) => ({ ...current, customerName: event.target.value }))} />
              <TextField label="Bairro, condominio ou perfil" required value={testimonial.roleOrNeighborhood} onChange={(event) => setTestimonial((current) => ({ ...current, roleOrNeighborhood: event.target.value }))} />
              <TextField select label="Servico" value={testimonial.serviceType} onChange={(event) => setTestimonial((current) => ({ ...current, serviceType: event.target.value }))}>
                {serviceOptions.map((service) => (
                  <MenuItem key={service} value={service}>
                    {service}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label="Nota" type="number" inputProps={{ min: 1, max: 5 }} value={testimonial.rating} onChange={(event) => setTestimonial((current) => ({ ...current, rating: Number(event.target.value) }))} />
              <TextField label="Depoimento" required multiline minRows={4} value={testimonial.quote} onChange={(event) => setTestimonial((current) => ({ ...current, quote: event.target.value }))} />
              <Button type="submit" variant="contained" startIcon={<SaveRoundedIcon />} disabled={saving}>
                Publicar feedback
              </Button>
            </Stack>
          </Box>
        </Box>

        <Divider />

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
          <Box>
            <Typography fontWeight={900} sx={{ mb: 1 }}>
              Ultimos antes/depois
            </Typography>
            <Stack spacing={1}>
              {beforeAfters.slice(0, 3).map((item) => (
                <Typography key={item.id} variant="body2" color="text.secondary">
                  {item.title} - {item.serviceType}
                </Typography>
              ))}
            </Stack>
          </Box>
          <Box>
            <Typography fontWeight={900} sx={{ mb: 1 }}>
              Ultimos feedbacks
            </Typography>
            <Stack spacing={1}>
              {testimonials.slice(0, 3).map((item) => (
                <Typography key={item.id} variant="body2" color="text.secondary">
                  {item.customerName} - {item.rating}/5
                </Typography>
              ))}
            </Stack>
          </Box>
        </Box>
      </Stack>
    </Paper>
  );
}
