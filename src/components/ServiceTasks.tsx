"use client";

import { useState } from "react";
import { Alert, Button, Checkbox, FormControlLabel, Paper, Stack, TextField, Typography } from "@mui/material";
import type { ServiceOrder } from "@/lib/types";

export function ServiceTasks({ order, canManage, canCreate, onChange }: { order: ServiceOrder; canManage: boolean; canCreate: boolean; onChange: (tasks: ServiceOrder["tasks"]) => void }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const editable = canManage && !["DONE", "DELIVERED", "CANCELED"].includes(order.status);
  async function save(method: "POST" | "PATCH", body: unknown) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/service-orders/${order.id}/tasks`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Nao foi possivel salvar a tarefa.");
      onChange(data.tasks);
      if (method === "POST") setTitle("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao salvar tarefa."); }
    finally { setBusy(false); }
  }
  return <Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={1.5}>
    <Typography variant="h6">Tarefas da OS</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    {order.tasks.length === 0 && <Typography color="text.secondary">Nenhuma tarefa adicional cadastrada.</Typography>}
    {order.tasks.map((task) => <FormControlLabel key={task.id} label={task.title} control={<Checkbox checked={task.done} disabled={!editable || busy} onChange={(_, done) => void save("PATCH", { taskId: task.id, done })} />} />)}
    {editable && canCreate && <Stack component="form" direction={{ xs: "column", sm: "row" }} spacing={1} onSubmit={(event) => { event.preventDefault(); void save("POST", { title }); }}>
      <TextField label="Nova tarefa" value={title} onChange={(event) => setTitle(event.target.value)} required inputProps={{ minLength: 2, maxLength: 300 }} fullWidth disabled={busy} />
      <Button type="submit" disabled={busy || title.trim().length < 2}>Adicionar</Button>
    </Stack>}
  </Stack></Paper>;
}
