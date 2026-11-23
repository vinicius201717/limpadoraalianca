"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { commercialFields, commercialResources, type CommercialModule } from "@/lib/commercial-schema";
import { labelFor } from "@/lib/labels";

type Choice = { id: string; label: string };
export function CommercialForm({ module, title, initial, customers, orders, writable, approvable }: {
  module: CommercialModule; title: string; initial?: Record<string, unknown>; customers: Choice[]; orders: Choice[]; writable: boolean; approvable: boolean;
}) {
  const router = useRouter();
  const fields = commercialFields[module];
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((field) => {
    let value = String(initial?.[field.key] ?? field.defaultValue ?? "");
    if (value && field.type === "datetime-local") { const date = new Date(value); value = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
    return [field.key, value];
  })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [approval, setApproval] = useState({ scheduledStart: "", scheduledEnd: "", acceptanceNotes: "" });
  const endpoint = `/api/${commercialResources[module]}`;
  const approved = module === "orcamentos" && initial?.status === "APPROVED";
  async function submit(path: string, method: string, body: unknown) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Não foi possível salvar.");
      setMessage("Alterações salvas.");
      if (result.serviceOrderId) router.push(`/ordens-servico/${result.serviceOrderId}`);
      else if (result.customer) router.push(`/clientes/${result.customer.id}`);
      else if (result.record?.id) router.push(`/${module}/${result.record.id}`);
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha de comunicação."); }
    finally { setBusy(false); }
  }
  return <Stack spacing={2}>
    <Typography variant="h4">{title}</Typography>
    <Button component={Link} href={`/${module}`} sx={{ alignSelf: "flex-start" }}>Voltar para a lista</Button>
    {error && <Alert severity="error">{error}</Alert>}
    {message && <Alert severity="success">{message}</Alert>}
    {approved && <Alert severity="info">Proposta aprovada. {initial?.serviceOrderId ? <Link href={`/ordens-servico/${initial.serviceOrderId}`}>Abrir ordem de serviço</Link> : "Consulte a ordem de serviço vinculada."}</Alert>}
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack component="form" spacing={2} onSubmit={(event) => {
        event.preventDefault();
        const body = Object.fromEntries(fields.map((field) => [field.key, field.type === "number" ? Number(values[field.key]) : field.type === "datetime-local" && values[field.key] ? new Date(values[field.key]).toISOString() : values[field.key]]));
        void submit(initial ? `${endpoint}/${initial.id}` : endpoint, initial ? "PATCH" : "POST", body);
      }}>
        {fields.map((field) => <TextField key={field.key} label={field.label} required={field.required} type={field.type ?? "text"} select={Boolean(field.options || field.relation)} value={values[field.key]} disabled={busy || !writable || approved} multiline={field.multiline} minRows={field.multiline ? 3 : undefined} InputLabelProps={{ shrink: true }} inputProps={field.type === "number" ? { min: 0, step: "any" } : undefined} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}>
          {field.options?.map((option) => <MenuItem key={option} value={option}>{labelFor(option)}</MenuItem>)}
          {field.relation && <MenuItem value="">Selecione</MenuItem>}
          {field.relation && (field.relation === "customers" ? customers : orders).map((choice) => <MenuItem key={choice.id} value={choice.id}>{choice.label}</MenuItem>)}
        </TextField>)}
        {writable && !approved && <Button type="submit" variant="contained" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>}
      </Stack>
    </Paper>
    {initial && writable && module === "leads" && <Button disabled={busy} variant="outlined" onClick={() => void submit(`${endpoint}/${initial.id}/convert`, "POST", {})}>{initial.customerId ? "Abrir cliente convertido" : "Converter em cliente"}</Button>}
    {initial && approvable && module === "orcamentos" && ["DRAFT", "SENT"].includes(String(initial.status)) && <Paper variant="outlined" sx={{ p: 3 }}><Stack component="form" spacing={2} onSubmit={(event) => { event.preventDefault(); void submit(`${endpoint}/${initial.id}/approve`, "POST", { ...approval, scheduledStart: new Date(approval.scheduledStart).toISOString(), scheduledEnd: new Date(approval.scheduledEnd).toISOString() }); }}>
      <Typography variant="h6">Aprovar e criar ordem de serviço</Typography>
      <TextField label="Início previsto" type="datetime-local" required InputLabelProps={{ shrink: true }} value={approval.scheduledStart} onChange={(event) => setApproval({ ...approval, scheduledStart: event.target.value })} />
      <TextField label="Fim previsto" type="datetime-local" required InputLabelProps={{ shrink: true }} value={approval.scheduledEnd} onChange={(event) => setApproval({ ...approval, scheduledEnd: event.target.value })} />
      <TextField label="Como o cliente aprovou a proposta" required multiline value={approval.acceptanceNotes} onChange={(event) => setApproval({ ...approval, acceptanceNotes: event.target.value })} />
      <Button type="submit" variant="contained" disabled={busy}>Registrar aprovação</Button>
    </Stack></Paper>}
  </Stack>;
}
