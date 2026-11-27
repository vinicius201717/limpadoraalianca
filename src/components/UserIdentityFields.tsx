"use client";
import { useState } from "react";
import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";
import { formatCpf, validCpf, MAX_DOCUMENT_BYTES, type IdentityDraft } from "@/lib/user-identity-schema";

async function prepare(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 20 * 1024 * 1024) throw Error("Use uma foto JPEG, PNG ou WebP de ate 20 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width < 300 || bitmap.height < 200) throw Error("Foto pequena demais. Fotografe o documento novamente.");
    const factor = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * factor); canvas.height = Math.round(bitmap.height * factor);
    const ctx = canvas.getContext("2d"); if (!ctx) throw Error("Nao foi possivel preparar a foto.");
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [.9, .8, .7, .6]) {
      const result = canvas.toDataURL("image/jpeg", quality);
      if (Math.ceil((result.length - result.indexOf(",") - 1) * 3 / 4) <= MAX_DOCUMENT_BYTES) return result;
    }
    throw Error("Foto muito grande. Envie uma imagem menor.");
  } finally { bitmap.close(); }
}
export function UserIdentityFields({ value, onChange, disabled = false }: { value: IdentityDraft; onChange: (value: IdentityDraft) => void; disabled?: boolean }) {
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function select(side: "front" | "back", file?: File) {
    if (!file) return;
    setError(""); setBusy(true);
    try { onChange({ ...value, [side]: await prepare(file) }); }
    catch (e) { setError(e instanceof Error ? e.message : "Nao foi possivel ler a foto."); }
    finally { setBusy(false); }
  }
  return <Stack spacing={2}>
    <Typography variant="h6">Identificacao e documentos</Typography>
    <Alert severity="info">CPF, frente e verso obrigatorios. Use fotos legiveis do documento. A documentacao e de acesso restrito.</Alert>
    {error && <Alert severity="error">{error}</Alert>}
    <TextField label="CPF" required value={value.cpf} disabled={disabled || busy} error={value.cpf.length === 14 && !validCpf(value.cpf)} helperText={value.cpf.length === 14 && !validCpf(value.cpf) ? "CPF invalido" : "000.000.000-00"} onChange={e => onChange({ ...value, cpf: formatCpf(e.target.value) })} inputProps={{ inputMode: "numeric", autoComplete: "off" }} />
    <TextField label="Endereco (opcional)" multiline minRows={2} value={value.address} disabled={disabled || busy} onChange={e => onChange({ ...value, address: e.target.value })} inputProps={{ maxLength: 500 }} />
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
      {(["front", "back"] as const).map(side => <Stack key={side} spacing={1} sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 2 }}>
        <Typography fontWeight={700}>{side === "front" ? "Frente" : "Verso"} do documento *</Typography>
        {value[side] && <Box component="img" src={value[side]} alt={side === "front" ? "Frente selecionada" : "Verso selecionado"} sx={{ width: "100%", maxHeight: 220, objectFit: "contain" }} />}
        <Button component="label" variant="outlined" disabled={disabled || busy}>{value[side] ? "Substituir foto" : "Selecionar foto"}<input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { void select(side, e.target.files?.[0]); e.target.value = ""; }} /></Button>
        <Typography variant="caption" color="text.secondary">{busy ? "Processando..." : value[side] ? "Foto selecionada" : "Foto obrigatoria"}</Typography>
      </Stack>)}
    </Box>
  </Stack>;
}
