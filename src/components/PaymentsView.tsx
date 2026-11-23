"use client";
import { useState } from "react";
import { Alert, Button, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import type { ServicePayment } from "@/lib/finance-operations";
import { formatCurrency } from "@/lib/format";

export function PaymentsView({ initialPayments, orders }: { initialPayments: ServicePayment[]; orders: Array<{ id: string; title: string }> }) {
  const [payments, setPayments] = useState(initialPayments);
  const [action, setAction] = useState("create");
  const [paymentId, setPaymentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const payment = payments.find((item) => item.id === paymentId);
  return <Stack spacing={2} sx={{ mt: 4 }}>
    <Typography variant="h5">Parcelas e recebimentos</Typography>
    {error && <Alert severity="error">{error}</Alert>}{notice && <Alert severity="success">{notice}</Alert>}
    <Paper variant="outlined" sx={{ p: 2 }}><Stack component="form" spacing={2} onSubmit={async (event) => {
      event.preventDefault(); const form = event.currentTarget; const body = Object.fromEntries(new FormData(form));
      setBusy(true); setError(""); setNotice("");
      try {
        const response = await fetch("/api/finance/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, action }) });
        const result = await response.json(); if (!response.ok) throw new Error(result.message || "Falha ao salvar.");
        setPayments((current) => [result.payment, ...current.filter((item) => item.id !== result.payment.id)]); setNotice("Lançamento registrado."); form.reset();
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha de comunicação."); } finally { setBusy(false); }
    }}>
      <TextField select label="Operação" value={action} onChange={(event) => setAction(event.target.value)} disabled={busy}><MenuItem value="create">Programar parcela</MenuItem><MenuItem value="receive">Registrar recebimento</MenuItem><MenuItem value="reverse">Estornar recebimento</MenuItem></TextField>
      {action === "create" ? <>
        <TextField select label="Ordem de serviço" name="serviceOrderId" defaultValue="" required><MenuItem value="">Selecione</MenuItem>{orders.map((order) => <MenuItem key={order.id} value={order.id}>{order.title}</MenuItem>)}</TextField>
        <TextField label="Descrição da parcela" name="description" required inputProps={{ minLength: 3, maxLength: 200 }} />
        <TextField label="Vencimento" type="date" name="dueAt" InputLabelProps={{ shrink: true }} required />
      </> : <TextField select label="Parcela" name="paymentId" value={paymentId} onChange={(event) => setPaymentId(event.target.value)} required><MenuItem value="">Selecione</MenuItem>{payments.map((item) => <MenuItem key={item.id} value={item.id}>{orders.find((order) => order.id === item.serviceOrderId)?.title} · {item.description}</MenuItem>)}</TextField>}
      {action !== "reverse" && <TextField label="Valor (R$)" name="amount" type="number" inputProps={{ min: 0.01, step: 0.01 }} required />}
      {action === "receive" && <>
        <TextField label="Data do recebimento" name="paidAt" type="date" required InputLabelProps={{ shrink: true }} />
        <TextField label="Forma de pagamento" name="method" select defaultValue="PIX"><MenuItem value="PIX">PIX</MenuItem><MenuItem value="CASH">Dinheiro</MenuItem><MenuItem value="CARD">Cartão</MenuItem><MenuItem value="TRANSFER">Transferência</MenuItem><MenuItem value="OTHER">Outro</MenuItem></TextField>
        <TextField label="Referência / comprovante" name="reference" />
      </>}
      {action === "reverse" && <>
        <TextField key={paymentId} label="Recebimento" name="receiptId" select defaultValue="" required><MenuItem value="">Selecione</MenuItem>{payment?.receipts.filter((item) => !item.reversedAt).map((item) => <MenuItem key={item.id} value={item.id}>{item.paidAt} · {formatCurrency(item.amount)} · {item.method}</MenuItem>)}</TextField>
        <TextField label="Motivo do estorno" name="reason" required inputProps={{ minLength: 5 }} />
      </>}
      <Button variant="contained" type="submit" disabled={busy}>{busy ? "Salvando…" : "Registrar"}</Button>
    </Stack></Paper>
    {!payments.length && <Alert severity="info">Nenhuma parcela registrada.</Alert>}
    {payments.map((item) => {
      const received = item.receipts.filter((receipt) => !receipt.reversedAt).reduce((sum, receipt) => sum + receipt.amount, 0);
      return <Paper key={item.id} variant="outlined" sx={{ p: 2 }}><Typography fontWeight={700}>{orders.find((order) => order.id === item.serviceOrderId)?.title} · {item.description}</Typography><Typography>Vencimento: {item.dueAt} · Valor: {formatCurrency(item.amount)} · Recebido: {formatCurrency(received)} · Saldo: {formatCurrency(item.amount - received)}</Typography>{item.receipts.map((receipt) => <Typography variant="body2" key={receipt.id}>{receipt.paidAt} · {formatCurrency(receipt.amount)} · {receipt.method} · {receipt.reference}{receipt.reversedAt ? ` · Estornado: ${receipt.reversalReason}` : ""}</Typography>)}</Paper>;
    })}
  </Stack>;
}
