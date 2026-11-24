"use client";
import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import type { FieldReceipt } from "@/lib/field-operational-types";
import type { DigitalReceipt } from "@/lib/field-receipts";

type Row = Omit<FieldReceipt, "attachment"> & { fileName: string; mimeType: string; sizeBytes: number; orderTitle?: string };
type Targets = { expenses: { id: string; serviceOrderId: string; amount: number; notes: string }[];
  payments: { id: string; serviceOrderId: string; description: string; balance: number }[] };
const empty = (): DigitalReceipt => ({ transcript: "", amount: null, paidAt: null, merchant: "", reference: "", direction: "UNKNOWN", category: "OUTROS", method: null, confidence: "LOW" });
const money = (amount: number) => amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function FieldReceiptsBoard({ initial = [], compact = false }: { initial?: Row[]; compact?: boolean }) {
  const [rows, setRows] = useState(initial);
  const [targets, setTargets] = useState<Targets>({ expenses: [], payments: [] });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState("");
  const [editing, setEditing] = useState("");
  const [digital, setDigital] = useState<DigitalReceipt>(empty);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const refresh = useCallback(async () => {
    setLoading("refresh"); setError("");
    try {
      const response = await fetch("/api/finance/campo-comprovantes", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setRows(data.receipts); setTargets({ expenses: data.expenses, payments: data.payments });
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao consultar comprovantes."); }
    finally { setLoading(""); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  async function update(id: string, status: "CORRECT" | "SETTLED") {
    setLoading(id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/finance/campo-comprovantes", { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, ...(status === "CORRECT" ? { digital: { ...digital, confidence: "HIGH" } } : { targetId: selected[id] || undefined }) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setRows(prev => prev.map(row => row.id === id ? data : row));
      setEditing(""); setNotice(status === "SETTLED" ? "Baixa registrada no financeiro." : "Dados revisados. Aguardando autorizacao de baixa.");
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Falha na operacao."); }
    finally { setLoading(""); }
  }
  return <Box sx={{ maxWidth: 1000, mx: "auto", p: compact ? 0 : { xs: 2, sm: 4 } }}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} flexWrap="wrap" sx={{ mb: 2 }}>
      {!compact && <Typography variant="h4" fontWeight={850}>Comprovantes digitais</Typography>}
      <Chip color="warning" label={rows.filter(r => r.status !== "SETTLED").length + " aguardando baixa"} />
      <Button onClick={() => void refresh()} disabled={!!loading}>Atualizar</Button>
    </Stack>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>A IA extrai os dados do arquivo. Confira antes de autorizar a baixa. O original fica no arquivo privado para auditoria.</Typography>
    {loading === "refresh" && <CircularProgress size={20}/>}
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
    {!rows.length && !loading && <Alert severity="info">Nenhum comprovante recebido.</Alert>}
    <Stack spacing={2}>{rows.map(row => {
      const d = row.digital;
      const options = d?.direction === "EXPENSE" ? targets.expenses.filter(t => t.serviceOrderId === row.serviceOrderId && t.amount === d.amount).map(t => ({ id: t.id, label: money(t.amount) + " - " + t.notes + " (" + t.id + ")" })) :
        d?.direction === "RECEIPT" ? targets.payments.filter(t => t.serviceOrderId === row.serviceOrderId && t.balance >= (d.amount || 0)).map(t => ({ id: t.id, label: t.description + " - saldo " + money(t.balance) })) : [];
      return <Paper key={row.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Stack spacing={1.2}>
          <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
            <Typography fontWeight={800} sx={{ overflowWrap: "anywhere" }}>{row.fileName}</Typography>
            <Chip size="small" color={row.status === "SETTLED" ? "success" : "warning"} label={row.status === "SETTLED" ? "Baixado" : "Pendente de baixa"}/>
          </Stack>
          <Typography variant="caption">{row.uploadedByName} | {row.orderTitle || row.serviceOrderId || "Sem obra"} | {new Date(row.createdAt).toLocaleString("pt-BR")}</Typography>
          <Typography>{row.description}</Typography>
          {d ? <Box><Typography variant="h6">{d.amount === null ? "Valor a revisar" : money(d.amount)}</Typography>
            <Typography variant="body2">{d.merchant || "Favorecido nao identificado"} | {d.paidAt || "Data a revisar"} | {d.direction === "EXPENSE" ? "Despesa" : d.direction === "RECEIPT" ? "Recebimento" : "Tipo a revisar"} | {d.method || "Meio a revisar"}</Typography>
            <Typography variant="caption">Referencia: {d.reference || "Nao identificada"}</Typography>
            <Box component="details" sx={{ mt: 1 }}><summary>Transcricao digital</summary><Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{d.transcript || "Sem texto legivel"}</Typography></Box>
            {d.confidence === "LOW" && <Alert severity="warning">Leitura incerta. Revise os dados.</Alert>}
          </Box> : <Alert severity="warning">Leitura automatica indisponivel. Confira o original e preencha os dados.</Alert>}
          {row.settlement && <Typography variant="body2">Baixado por {row.settlement.byName} em {new Date(row.settlement.at).toLocaleString("pt-BR")} | {money(row.settlement.amount)}</Typography>}
          <Button href={"/api/finance/campo-comprovantes/" + row.id} target="_blank" rel="noopener noreferrer">Consultar original</Button>
          {row.status !== "SETTLED" && editing === row.id && <>
            <TextField label="Transcricao" multiline minRows={2} value={digital.transcript} onChange={e => setDigital(v => ({ ...v, transcript: e.target.value }))}/>
            <TextField label="Valor em reais" type="number" value={digital.amount ?? ""} onChange={e => setDigital(v => ({ ...v, amount: e.target.value ? Number(e.target.value) : null }))}/>
            <TextField label="Data do pagamento" type="date" InputLabelProps={{ shrink: true }} value={digital.paidAt || ""} onChange={e => setDigital(v => ({ ...v, paidAt: e.target.value || null }))}/>
            <TextField label="Favorecido / emissor" value={digital.merchant} onChange={e => setDigital(v => ({ ...v, merchant: e.target.value }))}/>
            <TextField label="Referencia da transacao" value={digital.reference} onChange={e => setDigital(v => ({ ...v, reference: e.target.value }))}/>
            <TextField select SelectProps={{ MenuProps: { sx: { zIndex: 1900 } } }} label="Tipo" value={digital.direction} onChange={e => setDigital(v => ({ ...v, direction: e.target.value as DigitalReceipt["direction"] }))}>
              <MenuItem value="UNKNOWN">Indefinido</MenuItem><MenuItem value="EXPENSE">Despesa</MenuItem><MenuItem value="RECEIPT">Recebimento</MenuItem>
            </TextField>
            <TextField select SelectProps={{ MenuProps: { sx: { zIndex: 1900 } } }} label="Categoria" value={digital.category} onChange={e => setDigital(v => ({ ...v, category: e.target.value as DigitalReceipt["category"] }))}>
              <MenuItem value="GASOLINA">Gasolina</MenuItem><MenuItem value="ALMOCO">Almoco</MenuItem><MenuItem value="MATERIAL_OU_PRODUTO">Material ou produto</MenuItem><MenuItem value="OUTROS">Outros</MenuItem>
            </TextField>
            <TextField select SelectProps={{ MenuProps: { sx: { zIndex: 1900 } } }} label="Forma de pagamento" value={digital.method || ""} onChange={e => setDigital(v => ({ ...v, method: (e.target.value || null) as DigitalReceipt["method"] }))}>
              {["", "PIX", "CASH", "CARD", "TRANSFER", "OTHER"].map(x => <MenuItem key={x} value={x}>{x || "Indefinida"}</MenuItem>)}
            </TextField>
            <Button onClick={() => void update(row.id, "CORRECT")} disabled={!!loading}>Salvar dados conferidos</Button>
            <Button onClick={() => setEditing("")}>Cancelar</Button>
          </>}
          {row.status !== "SETTLED" && editing !== row.id && <>
            <Button onClick={() => { setDigital(d || empty()); setEditing(row.id); }}>Revisar dados digitais</Button>
            {!!options.length && <TextField select SelectProps={{ MenuProps: { sx: { zIndex: 1900 } } }} label="Vincular lancamento" value={selected[row.id] || ""} onChange={e => setSelected(v => ({ ...v, [row.id]: e.target.value }))}>
              <MenuItem value="">Selecionar</MenuItem>{options.map(o => <MenuItem key={o.id} value={o.id}>{o.label}</MenuItem>)}
            </TextField>}
            <Button variant="contained" color="success" disabled={!!loading || !d || d.confidence !== "HIGH" || !d.amount || !d.paidAt || d.direction === "UNKNOWN"}
              onClick={() => void update(row.id, "SETTLED")}>Dar baixa {d?.amount ? money(d.amount) : ""}</Button>
          </>}
        </Stack>
      </Paper>;
    })}</Stack>
  </Box>;
}
