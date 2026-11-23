"use client";

import { useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import HandymanRoundedIcon from "@mui/icons-material/HandymanRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";

import { formatDateTime, normalizeText } from "@/lib/format";
import { labelFor } from "@/lib/labels";
import { normalizeStockStatus, stockStatusOptions } from "@/lib/stock-status";
import type { Employee, Equipment, ServiceOrder, ServiceOrderEquipment, StockItemStatus } from "@/lib/types";
import { StatusChip } from "./StatusChip";

const activeEquipmentStatuses = new Set<ServiceOrderEquipment["status"]>(["REQUESTED", "RESERVED", "DELIVERED", "IN_USE"]);

type EquipmentUsage = {
  link: ServiceOrderEquipment;
  order?: ServiceOrder;
  supervisor?: Employee;
};

function usageForEquipment(
  equipmentId: string,
  serviceOrderEquipment: ServiceOrderEquipment[],
  serviceOrders: ServiceOrder[],
  employees: Employee[],
): EquipmentUsage[] {
  return serviceOrderEquipment
    .filter((item) => item.equipmentId === equipmentId && activeEquipmentStatuses.has(item.status))
    .map((link) => {
      const order = serviceOrders.find((item) => item.id === link.serviceOrderId);
      return {
        link,
        order,
        supervisor: order?.supervisorEmployeeId ? employees.find((employee) => employee.id === order.supervisorEmployeeId) : undefined,
      };
    });
}

export function EquipmentStockView({
  employees = [],
  initialEquipment,
  serviceOrderEquipment = [],
  serviceOrders = [],
}: {
  employees?: Employee[];
  initialEquipment: Equipment[];
  serviceOrderEquipment?: ServiceOrderEquipment[];
  serviceOrders?: ServiceOrder[];
}) {
  const [equipment, setEquipment] = useState(initialEquipment.map((item) => ({ ...item, status: normalizeStockStatus(item.status) })));
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<StockItemStatus>("AVAILABLE");
  const [notes, setNotes] = useState("");
  const [query, setQuery] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const available = equipment.filter((item) => item.status === "AVAILABLE").length;
  const activeUses = serviceOrderEquipment.filter((item) => activeEquipmentStatuses.has(item.status)).length;
  const maintenance = equipment.filter((item) => ["IN_MAINTENANCE", "DAMAGED", "UNAVAILABLE"].includes(item.status)).length;
  const normalizedQuery = normalizeText(query.trim());
  const filteredEquipment = equipment.filter((item) => {
    if (!normalizedQuery) return true;
    const usage = usageForEquipment(item.id, serviceOrderEquipment, serviceOrders, employees);
    const searchable = [
      item.name,
      item.code,
      item.notes,
      labelFor(item.status),
      usage.length ? "em uso" : "livre",
      ...usage.flatMap((usageItem) => [usageItem.order?.title, usageItem.order?.customerName, usageItem.supervisor?.name]),
    ]
      .filter(Boolean)
      .join(" ");
    return normalizeText(searchable).includes(normalizedQuery);
  });

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

  async function deleteEquipment(item: Equipment) {
    const usage = usageForEquipment(item.id, serviceOrderEquipment, serviceOrders, employees);
    if (usage.length > 0) {
      setError("Este equipamento esta em uso. Abra o detalhe dele para ver a OS e remova do servico antes de apagar.");
      return;
    }

    setError("");
    setNotice("");
    setDeletingId(item.id);
    const response = await fetch("/api/stock/equipment", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    });
    const data = await response.json().catch(() => null);
    setDeletingId("");
    if (!response.ok) {
      setError(data?.message ?? "Nao foi possivel remover o equipamento.");
      return;
    }
    setEquipment((current) => current.filter((candidate) => candidate.id !== item.id));
    if (selectedEquipment?.id === item.id) setSelectedEquipment(null);
    setNotice("Equipamento removido do estoque.");
  }

  const selectedUsage = selectedEquipment ? usageForEquipment(selectedEquipment.id, serviceOrderEquipment, serviceOrders, employees) : [];

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ md: "flex-end" }}>
        <Box>
          <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 34 }, mb: 0.8 }}>
            Equipamentos
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 820 }}>
            Inventario simples para cadastrar, buscar, liberar para uso e identificar rapidamente equipamentos ocupados.
          </Typography>
        </Box>
        <Chip icon={<BuildRoundedIcon />} label={`${equipment.length} cadastrados`} color="primary" variant="outlined" />
      </Stack>

      {notice && <Alert severity="success">{notice}</Alert>}
      {error && <Alert severity="warning">{error}</Alert>}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
        <Kpi label="Equipamentos" value={String(equipment.length)} helper="Base atual" />
        <Kpi label="Disponiveis" value={String(available)} helper="Prontos para uso" tone="success" />
        <Kpi label="Em uso/reservados" value={String(activeUses)} helper="Vinculados a obra" />
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

      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={1.5} sx={{ mb: 1.5 }}>
          <Box>
            <Typography variant="h6">Tabela de equipamentos</Typography>
            <Typography variant="body2" color="text.secondary">
              Clique em um equipamento para ver servico, cliente e supervisor quando estiver em uso.
            </Typography>
          </Box>
          <TextField
            size="small"
            label="Buscar equipamento"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            sx={{ width: { xs: "100%", md: 320 } }}
          />
        </Stack>

        {equipment.length === 0 ? (
          <EmptyState />
        ) : (
          <TableContainer>
            <Table size="small" aria-label="Tabela de equipamentos do estoque">
              <TableHead>
                <TableRow>
                  <TableCell>Equipamento</TableCell>
                  <TableCell>Codigo</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Uso</TableCell>
                  <TableCell>Observacao</TableCell>
                  <TableCell align="right">Acoes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEquipment.map((item) => {
                  const usage = usageForEquipment(item.id, serviceOrderEquipment, serviceOrders, employees);
                  return (
                    <TableRow key={item.id} hover onClick={() => setSelectedEquipment(item)} sx={{ cursor: "pointer" }}>
                      <TableCell>
                        <Typography fontWeight={900}>{item.name}</Typography>
                      </TableCell>
                      <TableCell>{item.code || "-"}</TableCell>
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <TextField
                          select
                          size="small"
                          value={item.status}
                          onChange={(event) => void updateEquipmentStatus(item, event.target.value as StockItemStatus)}
                          sx={{ minWidth: 170 }}
                        >
                          {stockStatusOptions.map((option) => (
                            <MenuItem key={option} value={option}>
                              {labelFor(option)}
                            </MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" color={usage.length ? "info" : "success"} variant={usage.length ? "filled" : "outlined"} label={usage.length ? "Em uso" : "Livre"} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 260 }}>
                          {item.notes || "Sem observacao"}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" onClick={(event) => event.stopPropagation()}>
                        <Tooltip title="Ver detalhes">
                          <IconButton size="small" onClick={() => setSelectedEquipment(item)}>
                            <VisibilityRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={usage.length ? "Remova do servico antes de apagar" : "Remover equipamento"}>
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              disabled={usage.length > 0 || deletingId === item.id}
                              onClick={() => void deleteEquipment(item)}
                            >
                              <DeleteOutlineRoundedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={Boolean(selectedEquipment)} onClose={() => setSelectedEquipment(null)} fullWidth maxWidth="sm">
        <DialogTitle>{selectedEquipment?.name ?? "Equipamento"}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            {selectedEquipment && (
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 1 }}>
                <Info label="Codigo" value={selectedEquipment.code || "-"} />
                <Info label="Status" value={labelFor(selectedEquipment.status)} />
                <Info label="Observacao" value={selectedEquipment.notes || "-"} />
              </Box>
            )}
            <Typography variant="subtitle1" fontWeight={900}>
              Uso em servicos
            </Typography>
            {selectedUsage.length === 0 ? (
              <Alert severity="success">Este equipamento nao esta em uso em nenhum servico ativo.</Alert>
            ) : (
              <Stack spacing={1}>
                {selectedUsage.map(({ link, order, supervisor }) => (
                  <Box key={link.id} sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: "divider", bgcolor: "background.default" }}>
                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
                      <Box>
                        <Typography fontWeight={900}>{order?.title ?? "Servico"}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {order?.customerName ?? "Cliente"} - Supervisor: {supervisor?.name ?? "Nao definido"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {order?.scheduledStart ? formatDateTime(order.scheduledStart) : "Sem data"} | {link.conditionBefore}
                        </Typography>
                      </Box>
                      <StatusChip value={link.status} />
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedEquipment(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function EmptyState() {
  return (
    <Paper variant="outlined" sx={{ p: 5, borderRadius: 2, textAlign: "center", bgcolor: "background.default" }}>
      <Avatar variant="rounded" sx={{ bgcolor: "primary.light", color: "primary.dark", mx: "auto", mb: 1.5 }}>
        <HandymanRoundedIcon />
      </Avatar>
      <Typography variant="h6">Nenhum equipamento cadastrado</Typography>
      <Typography color="text.secondary">Use o formulario acima para montar o inventario da empresa do zero.</Typography>
    </Paper>
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
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography fontWeight={850} sx={{ wordBreak: "break-word" }}>
        {value}
      </Typography>
    </Box>
  );
}
