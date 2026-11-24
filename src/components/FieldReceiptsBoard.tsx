"use client";
import { useState } from "react";
import { Alert, Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import type { FieldReceipt } from "@/lib/field-operational-types";

type Row = Omit<FieldReceipt, "attachment"> & { fileName: string; mimeType: string; sizeBytes: number };
export function FieldReceiptsBoard({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState("");
  async function review(id: string) {
    setLoading(id); setError("");
    try {
      const response = await fetch("/api/finance/campo-comprovantes", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "REVIEWED" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Não foi possível marcar a revisão.");
      setRows((previous) => previous.map((row) => row.id === id ? { ...row, status: "REVIEWED" } : row));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro de revisão."); }
    finally { setLoading(""); }
  }
  const pending = rows.filter((row) => row.status === "PENDING_REVIEW").length;
  return <Box sx={{ maxWidth: 1000, mx: "auto", p: { xs: 2, sm: 4 } }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} flexWrap="wrap" sx={{ mb: 3 }}>
      <Box><Typography variant="h4" fontWeight={850}>Comprovantes do campo</Typography>
        <Typography color="text.secondary">Arquivos enviados pelos perfis autorizados no PWA. Não geram despesas nem recebimentos sem conferência.</Typography></Box>
      <Chip color="warning" icon={<ReceiptLongRoundedIcon/>} label={pending + " aguardando conferência"} />
    </Stack>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Stack spacing={1.5}>
      {rows.length === 0 && <Alert severity="info">Nenhum comprovante enviado pelo Assistente de Campo.</Alert>}
      {rows.map((row) => <Paper key={row.id} variant="outlined" sx={{ p: 2.3, borderRadius: 3 }}>
        <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" gap={2}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
              <Typography fontWeight={800} sx={{ overflowWrap: "anywhere" }}>{row.fileName}</Typography>
              <Chip size="small" label={row.status === "REVIEWED" ? "Conferido" : "Pendente de conferência"}
                color={row.status === "REVIEWED" ? "success" : "warning"} variant="outlined" />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {row.uploadedByName} · {new Date(row.createdAt).toLocaleString("pt-BR")} · {row.serviceOrderId || "Sem obra vinculada"}
            </Typography>
            <Typography sx={{ whiteSpace: "pre-wrap", mt: 1 }}>{row.description || "Sem descrição, solicite esclarecimento ao emissor."}</Typography>
          </Box>
          <Stack spacing={1}>
            <Button href={`/api/finance/campo-comprovantes/${row.id}`} target="_blank" rel="noopener noreferrer" variant="outlined">Abrir comprovante</Button>
            {row.status === "PENDING_REVIEW" && <Button variant="contained" color="success" disabled={loading === row.id}
              onClick={() => void review(row.id)}>Marcar conferido</Button>}
          </Stack>
        </Stack>
      </Paper>)}
    </Stack>
  </Box>;
}
