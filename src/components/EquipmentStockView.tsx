"use client";

import { useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import HandymanRoundedIcon from "@mui/icons-material/HandymanRounded";

import { labelFor } from "@/lib/labels";
import { normalizeStockStatus, stockStatusOptions } from "@/lib/stock-status";
import type { Equipment, StockItemStatus } from "@/lib/types";
import { StatusChip } from "./StatusChip";

export function EquipmentStockView({ initialEquipment }: { initialEquipment: Equipment[] }) {
  const [equipment, setEquipment] = useState(initialEquipment.map((item) => ({ ...item, status: normalizeStockStatus(item.status) })));
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<StockItemStatus>("AVAILABLE");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const available = equipment.filter((item) => item.status === "AVAILABLE").length;
  const inUse = equipment.filter((item) => item.status === "RESERVED").length;
  const maintenance = equipment.filter((item) => ["IN_MAINTENANCE", "DAMAGED", "UNAVAILABLE"].includes(item.status)).length;

  async function createEquipment() {
    setError("");
    setNotice("");

    const payload = {
      name: name.trim(),
      code: code.trim(),
      status,
      notes: notes.trim(),
    };

    if (!payload.name) {
      setError("Informe o nome do equipamento.");
      return;
    }

    const response = await fetch("/api/stock/equipment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.message ?? "Nao foi possivel cadastrar o equipamento.");
      return;
    }

    setEquipment((current) => [data.equipment, ...current]);
    setName("");
    setCode("");
    setStatus("AVAILABLE");
    setNotes("");
    setNotice("Equipamento cadastrado com sucesso.");
  }

  async function updateEquipmentStatus(item: Equipment, nextStatus: StockItemStatus) {
    setError("");
    setNotice("");
    const response = await fetch("/api/stock/equipment", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, status: nextStatus }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.message ?? "Nao foi possivel atualizar o status do equipamento.");
      return;
    }
    setEquipment((current) => current.map((candidate) => (candidate.id === item.id ? data.equipment : candidate)));
    setNotice("Status do equipamento atualizado.");
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ md: "flex-end" }}>
        <Box>
          <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 34 }, mb: 0.8 }}>
            Equipamentos
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 820 }}>
            Cadastre maquinas, ferramentas e equipamentos da empresa para controlar disponibilidade e uso por obra.
          </Typography>
        </Box>
        <Chip icon={<BuildRoundedIcon />} label={`${equipment.length} cadastrados`} color="primary" variant="outlined" />
      </Stack>

      {notice && <Alert severity="success">{notice}</Alert>}
      {error && <Alert severity="warning">{error}</Alert>}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
        <Kpi label="Equipamentos" value={String(equipment.length)} helper="Base atual" />
        <Kpi label="Disponiveis" value={String(available)} helper="Prontos para uso" tone="success" />
        <Kpi label="Em uso/reservados" value={String(inUse)} helper="Vinculados a obra" />
        <Kpi label="Manutencao" value={String(maintenance)} helper="Acompanhar antes de liberar" tone={maintenance ? "warning" : "success"} />
      </Box>

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
        <Stack spacing={2}>
          <Typography variant="h6">Adicionar equipamento</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.2fr 0.7fr 0.8fr" }, gap: 1.5 }}>
            <TextField label="Nome do equipamento" value={name} onChange={(event) => setName(event.target.value)} />
            <TextField label="Codigo" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Ex: POL-01" />
            <TextField select label="Status" value={status} onChange={(event) => setStatus(event.target.value as StockItemStatus)}>
              {stockStatusOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {labelFor(option)}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          <TextField label="Observacoes" value={notes} onChange={(event) => setNotes(event.target.value)} multiline minRows={2} />
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={createEquipment} sx={{ alignSelf: "flex-start" }}>
            Adicionar equipamento
          </Button>
        </Stack>
      </Paper>

      {equipment.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 5, borderRadius: 2, textAlign: "center" }}>
          <Avatar variant="rounded" sx={{ bgcolor: "primary.light", color: "primary.dark", mx: "auto", mb: 1.5 }}>
            <HandymanRoundedIcon />
          </Avatar>
          <Typography variant="h6">Nenhum equipamento cadastrado</Typography>
          <Typography color="text.secondary">Use o formulario acima para montar o inventario da empresa do zero.</Typography>
        </Paper>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
          {equipment.map((item) => (
            <Paper key={item.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Stack spacing={1.4}>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={900}>{item.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {item.code}
                    </Typography>
                  </Box>
                  <StatusChip value={item.status} />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {item.notes || "Sem observacoes."}
                </Typography>
                <TextField
                  select
                  size="small"
                  label="Atualizar status"
                  value={item.status}
                  onChange={(event) => void updateEquipmentStatus(item, event.target.value as StockItemStatus)}
                >
                  {stockStatusOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {labelFor(option)}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
            </Paper>
          ))}
        </Box>
      )}
    </Stack>
  );
}

function Kpi({ label, value, helper, tone = "primary" }: { label: string; value: string; helper: string; tone?: "primary" | "success" | "warning" }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Typography variant="body2" color="text.secondary" fontWeight={850}>
        {label}
      </Typography>
      <Typography variant="h5" sx={{ mt: 0.5 }} color={`${tone}.main`}>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {helper}
      </Typography>
    </Paper>
  );
}
