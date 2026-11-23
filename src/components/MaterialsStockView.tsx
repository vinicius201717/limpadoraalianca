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
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import SummarizeRoundedIcon from "@mui/icons-material/SummarizeRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";

import { formatDateTime, normalizeText } from "@/lib/format";
import { labelFor } from "@/lib/labels";
import { getMaterialOperationalStatus, stockStatusOptions } from "@/lib/stock-status";
import type { Employee, Material, ServiceOrder, ServiceOrderMaterial, StockItemStatus } from "@/lib/types";
import { StatusChip } from "./StatusChip";

const unitOptions = ["un", "L", "kg", "m2", "m", "cx", "par"];
const visibleStockStatusOptions = stockStatusOptions.filter((option) => option !== "LOW_STOCK");
const activeMaterialStatuses = new Set<ServiceOrderMaterial["status"]>([
  "PENDING_SEPARATION",
  "SEPARATING",
  "RESERVED",
  "SEPARATED",
  "DELIVERED_TO_TEAM",
  "PARTIALLY_RETURNED",
]);

type MaterialUsage = {
  link: ServiceOrderMaterial;
  order?: ServiceOrder;
  supervisor?: Employee;
};

function numberFromInput(value: string) {
  return Number(value.replace(",", "."));
}

function getVisibleMaterialStatus(material: Material): StockItemStatus {
  if (material.status === "OUT_OF_STOCK") return "OUT_OF_STOCK";
  return getMaterialOperationalStatus({ ...material, minStock: 0 });
}

function usageForMaterial(
  materialId: string,
  serviceOrderMaterials: ServiceOrderMaterial[],
  serviceOrders: ServiceOrder[],
  employees: Employee[],
): MaterialUsage[] {
  return serviceOrderMaterials
    .filter((item) => item.materialId === materialId && activeMaterialStatuses.has(item.status))
    .map((link) => {
      const order = serviceOrders.find((item) => item.id === link.serviceOrderId);
      return {
        link,
        order,
        supervisor: order?.supervisorEmployeeId ? employees.find((employee) => employee.id === order.supervisorEmployeeId) : undefined,
      };
    });
}

export function MaterialsStockView({
  initialMaterials,
  employees = [],
  serviceOrderMaterials = [],
  serviceOrders = [],
}: {
  initialMaterials: Material[];
  employees?: Employee[];
  serviceOrderMaterials?: ServiceOrderMaterial[];
  serviceOrders?: ServiceOrder[];
}) {
  const [materials, setMaterials] = useState(initialMaterials);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("un");
  const [status, setStatus] = useState<StockItemStatus>("AVAILABLE");
  const [currentStock, setCurrentStock] = useState("0");
  const [query, setQuery] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const summary = materials.reduce(
    (acc, material) => {
      const materialStatus = getVisibleMaterialStatus(material);
      const usage = usageForMaterial(material.id, serviceOrderMaterials, serviceOrders, employees);
      acc.total += 1;
      if (materialStatus === "AVAILABLE" || materialStatus === "RESERVED") acc.available += 1;
      if (materialStatus === "OUT_OF_STOCK") acc.outOfStock += 1;
      if (["IN_MAINTENANCE", "DAMAGED", "UNAVAILABLE"].includes(materialStatus)) acc.unavailable += 1;
      if (usage.length > 0) acc.inUse += 1;
      return acc;
    },
    { total: 0, available: 0, outOfStock: 0, unavailable: 0, inUse: 0 },
  );
  const normalizedQuery = normalizeText(query.trim());
  const filteredMaterials = materials.filter((material) => {
    if (!normalizedQuery) return true;
    const usage = usageForMaterial(material.id, serviceOrderMaterials, serviceOrders, employees);
    const searchable = [
      material.name,
      material.unit,
      labelFor(getVisibleMaterialStatus(material)),
      usage.length ? "em uso" : "livre",
      ...usage.flatMap((item) => [item.order?.title, item.order?.customerName, item.supervisor?.name]),
    ]
      .filter(Boolean)
      .join(" ");
    return normalizeText(searchable).includes(normalizedQuery);
  });

  async function createMaterial() {
    setError("");
    setNotice("");

    const payload = {
      name: name.trim(),
      unit,
      status,
      currentStock: numberFromInput(currentStock),
      minStock: 0,
      unitCost: 0,
    };

    if (!payload.name) {
      setError("Informe o nome do material.");
      return;
    }
    if (Number.isNaN(payload.currentStock) || payload.currentStock < 0) {
      setError("Informe uma quantidade valida para o estoque.");
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
    setCreateOpen(false);
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

  async function deleteMaterial(material: Material) {
    const usage = usageForMaterial(material.id, serviceOrderMaterials, serviceOrders, employees);
    if (usage.length > 0) {
      setError("Este material esta em uso. Abra o detalhe dele para ver a OS e remova do servico antes de apagar.");
      return;
    }

    setError("");
    setNotice("");
    setDeletingId(material.id);
    const response = await fetch("/api/stock/materials", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: material.id }),
    });
    const data = await response.json().catch(() => null);
    setDeletingId("");
    if (!response.ok) {
      setError(data?.message ?? "Nao foi possivel remover o material.");
      return;
    }
    setMaterials((current) => current.filter((item) => item.id !== material.id));
    if (selectedMaterial?.id === material.id) setSelectedMaterial(null);
    setNotice("Material removido do estoque.");
  }

  function renderMaterialForm() {
    return (
      <Stack spacing={2}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.4fr 0.55fr 0.85fr 0.7fr" }, gap: 1.5 }}>
          <TextField label="Nome do material" value={name} onChange={(event) => setName(event.target.value)} />
          <TextField select label="Unidade" value={unit} onChange={(event) => setUnit(event.target.value)}>
            {unitOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Status" value={status} onChange={(event) => setStatus(event.target.value as StockItemStatus)}>
            {visibleStockStatusOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {labelFor(option)}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="Quantidade" type="number" value={currentStock} onChange={(event) => setCurrentStock(event.target.value)} />
        </Box>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => void createMaterial()} sx={{ alignSelf: "flex-start" }}>
          Adicionar material
        </Button>
      </Stack>
    );
  }

  const selectedUsage = selectedMaterial ? usageForMaterial(selectedMaterial.id, serviceOrderMaterials, serviceOrders, employees) : [];

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ md: "flex-end" }}>
        <Box>
          <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 34 }, mb: 0.8 }}>
            Materiais
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 820 }}>
            Estoque interno para saber o que tem, o que esta em falta e quais itens estao separados para servicos.
          </Typography>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
          <Button variant="outlined" startIcon={<SummarizeRoundedIcon />} onClick={() => setSummaryOpen(true)}>
            Ver resumo
          </Button>
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => setCreateOpen(true)}
            sx={{ display: { xs: "inline-flex", md: "none" } }}
          >
            Adicionar material
          </Button>
          <Chip icon={<Inventory2RoundedIcon />} label={`${materials.length} cadastrados`} color="primary" variant="outlined" />
        </Stack>
      </Stack>

      {notice && <Alert severity="success">{notice}</Alert>}
      {error && <Alert severity="warning">{error}</Alert>}

      <Paper variant="outlined" sx={{ display: { xs: "none", md: "block" }, p: 2.5, borderRadius: 2 }}>
        <Stack spacing={2}>
          <Typography variant="h6">Adicionar material</Typography>
          {renderMaterialForm()}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={1.5} sx={{ mb: 1.5 }}>
          <Box>
            <Typography variant="h6">Tabela de materiais</Typography>
            <Typography variant="body2" color="text.secondary">
              Clique em um item para ver em qual servico ele esta sendo usado.
            </Typography>
          </Box>
          <TextField
            size="small"
            label="Buscar material"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            sx={{ width: { xs: "100%", md: 320 } }}
          />
        </Stack>

        {materials.length === 0 ? (
          <EmptyState onAdd={() => setCreateOpen(true)} />
        ) : filteredMaterials.length === 0 ? (
          <EmptySearchState />
        ) : (
          <TableContainer>
            <Table size="small" aria-label="Tabela de materiais do estoque" sx={{ minWidth: 680 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Material</TableCell>
                  <TableCell>Quantidade</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Uso</TableCell>
                  <TableCell align="right">Acoes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredMaterials.map((material) => {
                  const materialStatus = getVisibleMaterialStatus(material);
                  const usage = usageForMaterial(material.id, serviceOrderMaterials, serviceOrders, employees);
                  return (
                    <TableRow key={material.id} hover onClick={() => setSelectedMaterial(material)} sx={{ cursor: "pointer" }}>
                      <TableCell>
                        <Stack spacing={0.3}>
                          <Typography fontWeight={900}>{material.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Unidade: {material.unit}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight={850}>{`${material.currentStock} ${material.unit}`}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {material.currentStock > 0 ? "Tem no estoque" : "Nao tem no estoque"}
                        </Typography>
                      </TableCell>
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <TextField
                          select
                          size="small"
                          value={materialStatus === "LOW_STOCK" ? "AVAILABLE" : materialStatus}
                          onChange={(event) => void updateMaterialStatus(material, event.target.value as StockItemStatus)}
                          sx={{ minWidth: 170 }}
                        >
                          {visibleStockStatusOptions.map((option) => (
                            <MenuItem key={option} value={option}>
                              {labelFor(option)}
                            </MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" color={usage.length ? "info" : "success"} variant={usage.length ? "filled" : "outlined"} label={usage.length ? "Em uso" : "Livre"} />
                      </TableCell>
                      <TableCell align="right" onClick={(event) => event.stopPropagation()}>
                        <Tooltip title="Ver detalhes">
                          <IconButton size="small" onClick={() => setSelectedMaterial(material)}>
                            <VisibilityRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={usage.length ? "Remova do servico antes de apagar" : "Remover material"}>
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              disabled={usage.length > 0 || deletingId === material.id}
                              onClick={() => void deleteMaterial(material)}
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

      <Dialog open={summaryOpen} onClose={() => setSummaryOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Resumo dos materiais</DialogTitle>
        <DialogContent>
          <Stack spacing={1.2} sx={{ pt: 0.5 }}>
            <SummaryLine label="Materiais cadastrados" value={String(summary.total)} />
            <SummaryLine label="Com disponibilidade" value={String(summary.available)} tone="success.main" />
            <SummaryLine label="Em falta" value={String(summary.outOfStock)} tone="warning.main" />
            <SummaryLine label="Indisponiveis" value={String(summary.unavailable)} tone="error.main" />
            <SummaryLine label="Em uso em servicos" value={String(summary.inUse)} tone="info.main" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSummaryOpen(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle>Adicionar material</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 0.5 }}>{renderMaterialForm()}</Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(selectedMaterial)} onClose={() => setSelectedMaterial(null)} fullWidth maxWidth="sm">
        <DialogTitle>{selectedMaterial?.name ?? "Material"}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            {selectedMaterial && (
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 1 }}>
                <Info label="Quantidade" value={`${selectedMaterial.currentStock} ${selectedMaterial.unit}`} />
                <Info label="Unidade" value={selectedMaterial.unit} />
                <Info label="Status" value={labelFor(getVisibleMaterialStatus(selectedMaterial))} />
              </Box>
            )}
            <Typography variant="subtitle1" fontWeight={900}>
              Uso em servicos
            </Typography>
            {selectedUsage.length === 0 ? (
              <Alert severity="success">Este material nao esta em uso em nenhum servico ativo.</Alert>
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
                          {order?.scheduledStart ? formatDateTime(order.scheduledStart) : "Sem data"} | Planejado {link.plannedQuantity}
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
          <Button onClick={() => setSelectedMaterial(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 }, borderRadius: 2, textAlign: "center", bgcolor: "background.default" }}>
      <Avatar variant="rounded" sx={{ bgcolor: "primary.light", color: "primary.dark", mx: "auto", mb: 1.5 }}>
        <Inventory2RoundedIcon />
      </Avatar>
      <Typography variant="h6">Nenhum material cadastrado</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Comece cadastrando apenas os itens que existem no estoque da empresa.
      </Typography>
      <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={onAdd}>
        Adicionar material
      </Button>
    </Paper>
  );
}

function EmptySearchState() {
  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, textAlign: "center", bgcolor: "background.default" }}>
      <Typography variant="h6">Nenhum material encontrado</Typography>
      <Typography color="text.secondary">Ajuste a busca para ver outros itens do estoque.</Typography>
    </Paper>
  );
}

function SummaryLine({ label, value, tone = "primary.main" }: { label: string; value: string; tone?: string }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, p: 1.4, borderRadius: 2, bgcolor: "background.default" }}>
      <Typography fontWeight={850}>{label}</Typography>
      <Typography variant="h6" color={tone} fontWeight={950}>
        {value}
      </Typography>
    </Box>
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
