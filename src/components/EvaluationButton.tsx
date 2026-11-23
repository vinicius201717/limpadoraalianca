"use client";
import { useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from "@mui/material";
import type { Evaluation } from "@/lib/types";
const criteria = { punctualityScore: "Pontualidade", qualityScore: "Qualidade", productivityScore: "Produtividade", careScore: "Cuidado com o imóvel", teamworkScore: "Trabalho em equipe", clientPostureScore: "Postura com o cliente", checklistComplianceScore: "Cumprimento do checklist" };
export function EvaluationButton({ orderId, employeeId, name, disabled, onSaved }: { orderId: string; employeeId: string; name: string; disabled: boolean; onSaved: (evaluation: Evaluation) => void }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [improvements, setImprovements] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <><Button variant="contained" disabled={disabled} onClick={() => setOpen(true)}>Avaliar</Button>
    <Dialog open={open} onClose={() => !busy && setOpen(false)} fullWidth maxWidth="sm">
      <Stack component="form" onSubmit={async (event) => {
        event.preventDefault(); setBusy(true); setError("");
        try {
          const response = await fetch("/api/evaluations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceOrderId: orderId, employeeId, ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Number(value)])), positiveNotes: notes, improvementNotes: improvements }) });
          const result = await response.json(); if (!response.ok) throw new Error(result.message || "Não foi possível registrar a avaliação.");
          onSaved(result.evaluation); setOpen(false);
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha de comunicação."); }
        finally { setBusy(false); }
      }}>
        <DialogTitle>Avaliar {name}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {Object.entries(criteria).map(([key, label]) => <TextField key={key} label={label} select required value={values[key] ?? ""} disabled={busy} onChange={(event) => setValues({ ...values, [key]: event.target.value })}><MenuItem value="">Selecione uma nota</MenuItem>{[1, 2, 3, 4, 5].map((score) => <MenuItem key={score} value={String(score)}>{score}</MenuItem>)}</TextField>)}
          <TextField label="Pontos positivos observados" multiline value={notes} onChange={(event) => setNotes(event.target.value)} />
          <TextField label="Oportunidades de melhoria" multiline value={improvements} onChange={(event) => setImprovements(event.target.value)} />
        </Stack></DialogContent>
        <DialogActions><Button disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={busy} variant="contained">Registrar avaliação</Button></DialogActions>
      </Stack>
    </Dialog></>;
}
