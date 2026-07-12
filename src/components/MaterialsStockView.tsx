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
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";

import { formatCurrency } from "@/lib/format";
import { labelFor } from "@/lib/labels";
import { getMaterialOperationalStatus, stockStatusOptions } from "@/lib/stock-status";
import type { Material, StockItemStatus } from "@/lib/types";
import { StatusChip } from "./StatusChip";

const unitOptions = ["un", "L", "kg", "m2", "m", "cx", "par"];

function numberFromInput(value: string) {
  return Number(value.replace(",", "."));
}

export function MaterialsStockView({ initialMaterials }: { initialMaterials: Material[] }) {
  const [materials, setMaterials] = useState(initialMaterials);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("un");
  const [status, setStatus] = useState<StockItemStatus>("AVAILABLE");
  const [currentStock, setCurrentStock] = useState("0");
  const [minStock, setMinStock] = useState("0");
  const [unitCost, setUnitCost] = useState("0");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const lowStock = materials.filter((material) => ["LOW_STOCK", "OUT_OF_STOCK"].includes(getMaterialOperationalStatus(material))).length;
  const unavailable = materials.filter((material) => ["IN_MAINTENANCE", "DAMAGED", "UNAVAILABLE"].includes(getMaterialOperationalStatus(material))).length;
  const totalValue = materials.reduce((sum, material) => sum + material.currentStock * material.unitCost, 0);

  async function createMaterial() {
    setError("");
    setNotice("");

    const payload = {
      name: name.trim(),
      unit,
      status,
      currentStock: numberFromInput(currentStock),
      minStock: numberFromInput(minStock),
      unitCost: numberFromInput(unitCost),
    };

    if (!payload.name) {
      setError("Informe o nome do material.");
      return;
    }
    if ([payload.currentStock, payload.minStock, payload.unitCost].some((value) => Number.isNaN(value) || value < 0)) {
      setError("Estoque, minimo e custo precisam ser numeros maiores ou iguais a zero.");
      return;
    }

    const response = await fetch("/api/stock/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.message ?? "Nao foi possivel cadastrar o material.");
      return;
    }

    setMaterials((current) => [data.material, ...current]);
    setName("");
    setUnit("un");
    setStatus("AVAILABLE");
    setCurrentStock("0");
    setMinStock("0");
    setUnitCost("0");
    setNotice("Material cadastrado com sucesso.");
  }

  async function updateMaterialStatus(material: Material, nextStatus: StockItemStatus) {
    setError("");
    setNotice("");
    const response = await fetch("/api/stock/materials", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: material.id, status: nextStatus }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.message ?? "Nao foi possivel atualizar o status do material.");
      return;
    }
    setMaterials((current) => current.map((item) => (item.id === material.id ? data.material : item)));
    setNotice("Status do material atualizado.");
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ md: "flex-end" }}>
        <Box>
          <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 34 }, mb: 0.8 }}>
            Materiais
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 820 }}>
            Cadastre do zero os insumos usados nas obras, com estoque atual, estoque minimo e custo unitario.
          </Typography>
        </Box>
        <Chip icon={<Inventory2RoundedIcon />} label={`${materials.length} cadastrados`} color="primary" variant="outlined" />
      </Stack>

      {notice && <Alert severity="success">{notice}</Alert>}
      {error && <Alert severity="warning">{error}</Alert>}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
        <Kpi label="Itens cadastrados" value={String(materials.length)} helper="Base atual" />
        <Kpi label="Estoque baixo/em falta" value={String(lowStock)} helper="Abaixo ou no minimo" tone={lowStock ? "warning" : "success"} />
        <Kpi label="Indisponiveis" value={String(unavailable)} helper="Manutencao, dano ou bloqueio" tone={unavailable ? "warning" : "success"} />
        <Kpi label="Valor em estoque" value={formatCurrency(totalValue)} helper="Custo estimado" />
      </Box>

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
        <Stack spacing={2}>
          <Typography variant="h6">Adicionar material</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.4fr 0.55fr 0.8fr 0.7fr 0.7fr 0.75fr" }, gap: 1.5 }}>
            <TextField label="Nome do material" value={name} onChange={(event) => setName(event.target.value)} />
            <TextField select label="Unidade" value={unit} onChange={(event) => setUnit(event.target.value)}>
              {unitOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label="Status" value={status} onChange={(event) => setStatus(event.target.value as StockItemStatus)}>
              {stockStatusOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {labelFor(option)}
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Estoque atual" type="number" value={currentStock} onChange={(event) => setCurrentStock(event.target.value)} />
            <TextField label="Estoque minimo" type="number" value={minStock} onChange={(event) => setMinStock(event.target.value)} />
            <TextField label="Custo unitario" type="number" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} />
          </Box>
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={createMaterial} sx={{ alignSelf: "flex-start" }}>
            Adicionar material
          </Button>
        </Stack>
      </Paper>

      {materials.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 5, borderRadius: 2, textAlign: "center" }}>
          <Avatar variant="rounded" sx={{ bgcolor: "primary.light", color: "primary.dark", mx: "auto", mb: 1.5 }}>
            <Inventory2RoundedIcon />
          </Avatar>
          <Typography variant="h6">Nenhum material cadastrado</Typography>
          <Typography color="text.secondary">Use o formulario acima para montar o estoque da empresa do zero.</Typography>
        </Paper>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
          {materials.map((material) => {
            const materialStatus = getMaterialOperationalStatus(material);
            const isLow = materialStatus === "LOW_STOCK" || materialStatus === "OUT_OF_STOCK";
            return (
              <Paper key={material.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack spacing={1.4}>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={900}>{material.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {material.id}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="flex-end">
                      {isLow && <Chip size="small" color="warning" icon={<WarningAmberRoundedIcon />} label="Atenção" />}
                      <StatusChip value={materialStatus} />
                    </Stack>
                  </Stack>
                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                    <Info label="Estoque" value={`${material.currentStock} ${material.unit}`} />
                    <Info label="Minimo" value={`${material.minStock} ${material.unit}`} />
                    <Info label="Custo" value={formatCurrency(material.unitCost)} />
                    <Info label="Total" value={formatCurrency(material.currentStock * material.unitCost)} />
                  </Box>
                  <TextField
                    select
                    size="small"
                    label="Atualizar status"
                    value={materialStatus}
                    onChange={(event) => void updateMaterialStatus(material, event.target.value as StockItemStatus)}
                  >
                    {stockStatusOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {labelFor(option)}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
              </Paper>
            );
          })}
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography fontWeight={850}>{value}</Typography>
    </Box>
  );
}
