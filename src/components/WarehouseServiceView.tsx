"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Avatar, Box, Button, Chip, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";

import { formatDateTime } from "@/lib/format";
import { getMaterialOperationalStatus } from "@/lib/stock-status";
import type {
  Equipment,
  Material,
  ServiceMaterialRequest,
  ServiceMaterialRequestItem,
  ServiceOrder,
  ServiceOrderEquipment,
  ServiceOrderMaterial,
} from "@/lib/types";
import { StatusChip } from "./StatusChip";

export function WarehouseServiceView({
  order,
  equipment,
  materialRequestItems,
  materialRequests,
  materials,
  serviceOrderEquipment,
  serviceOrderMaterials,
}: {
  order: ServiceOrder;
  equipment: Equipment[];
  materialRequestItems: ServiceMaterialRequestItem[];
  materialRequests: ServiceMaterialRequest[];
  materials: Material[];
  serviceOrderEquipment: ServiceOrderEquipment[];
  serviceOrderMaterials: ServiceOrderMaterial[];
}) {
  const [localMaterials, setLocalMaterials] = useState(materials);
  const [localEquipment, setLocalEquipment] = useState(equipment);
  const [localOrderMaterials, setLocalOrderMaterials] = useState(serviceOrderMaterials);
  const [localOrderEquipment, setLocalOrderEquipment] = useState(serviceOrderEquipment);
  const [localRequests, setLocalRequests] = useState(materialRequests);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyKey, setBusyKey] = useState("");

  const orderMaterials = localOrderMaterials.filter((item) => item.serviceOrderId === order.id);
  const orderEquipment = localOrderEquipment.filter((item) => item.serviceOrderId === order.id);
  const orderRequests = localRequests.filter((item) => item.serviceOrderId === order.id);
  const pendingRequests = orderRequests.filter((item) => item.status === "PENDING" || item.status === "APPROVED");
  const readyMaterials = orderMaterials.filter((item) => ["RESERVED", "SEPARATED", "DELIVERED_TO_TEAM"].includes(item.status)).length;
  const readyEquipment = orderEquipment.filter((item) => ["RESERVED", "DELIVERED", "IN_USE"].includes(item.status)).length;
  const totalPreparationItems = orderMaterials.length + orderEquipment.length + pendingRequests.length;
  const progress = totalPreparationItems ? Math.round(((readyMaterials + readyEquipment) / totalPreparationItems) * 100) : 0;

  function updateOrderMaterial(next: ServiceOrderMaterial) {
    setLocalOrderMaterials((current) => current.map((item) => (item.id === next.id ? next : item)));
  }

  function updateStockMaterial(next?: Material) {
    if (!next) return;
    setLocalMaterials((current) => current.map((item) => (item.id === next.id ? next : item)));
  }

  function updateOrderEquipment(next: ServiceOrderEquipment) {
    setLocalOrderEquipment((current) => current.map((item) => (item.id === next.id ? next : item)));
  }

  function updateStockEquipment(next?: Equipment) {
    if (!next) return;
    setLocalEquipment((current) => current.map((item) => (item.id === next.id ? next : item)));
  }

  async function patchMaterial(item: ServiceOrderMaterial, status: ServiceOrderMaterial["status"]) {
    setError("");
    setNotice("");
    setBusyKey(`${item.id}-${status}`);
    const response = await fetch(`/api/service-orders/${order.id}/materials`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: item.id,
        status,
        separatedQuantity: status === "RESERVED" || status === "SEPARATED" ? item.plannedQuantity : item.separatedQuantity,
      }),
    });
    const data = await response.json().catch(() => null);
    setBusyKey("");
    if (!response.ok) {
      setError(data?.message ?? "Nao foi possivel atualizar o material.");
      return null;
    }
    updateOrderMaterial(data.material);
    updateStockMaterial(data.stockMaterial);
    setNotice(status === "RESERVED" ? "Material reservado e estoque atualizado." : "Material atualizado.");
    return data.material as ServiceOrderMaterial;
  }

  async function reserveRequest(request: ServiceMaterialRequest) {
    setError("");
    setNotice("");
    setBusyKey(request.id);
    const items = materialRequestItems.filter((item) => item.requestId === request.id);
    const createdItems: ServiceOrderMaterial[] = [];

    for (const requestItem of items) {
      const postResponse = await fetch(`/api/service-orders/${order.id}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: requestItem.materialId,
          plannedQuantity: requestItem.quantity,
          notes: requestItem.notes,
        }),
      });
      const postData = await postResponse.json().catch(() => null);
      if (!postResponse.ok) {
        setBusyKey("");
        setError(postData?.message ?? "Nao foi possivel criar o item solicitado.");
        return;
      }

      const patchResponse = await fetch(`/api/service-orders/${order.id}/materials`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: postData.material.id,
          status: "RESERVED",
          separatedQuantity: requestItem.quantity,
        }),
      });
      const patchData = await patchResponse.json().catch(() => null);
      if (!patchResponse.ok) {
        setBusyKey("");
        setError(patchData?.message ?? "Nao foi possivel reservar o item solicitado.");
        return;
      }
      createdItems.push(patchData.material);
      updateStockMaterial(patchData.stockMaterial);
    }

    const requestResponse = await fetch(`/api/service-orders/${order.id}/material-requests`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: request.id, status: "SEPARATED" }),
    });
    const requestData = await requestResponse.json().catch(() => null);
    setBusyKey("");
    if (!requestResponse.ok) {
      setError(requestData?.message ?? "Itens reservados, mas nao foi possivel atualizar a solicitacao.");
      return;
    }

    setLocalOrderMaterials((current) => [...createdItems, ...current]);
    setLocalRequests((current) => current.map((item) => (item.id === request.id ? requestData.request : item)));
    setNotice("Solicitacao reservada e marcada como separada.");
  }

  async function patchEquipment(item: ServiceOrderEquipment, status: ServiceOrderEquipment["status"]) {
    setError("");
    setNotice("");
    setBusyKey(`${item.id}-${status}`);
    const response = await fetch(`/api/service-orders/${order.id}/equipment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, status }),
    });
    const data = await response.json().catch(() => null);
    setBusyKey("");
    if (!response.ok) {
      setError(data?.message ?? "Nao foi possivel atualizar o equipamento.");
      return;
    }
    updateOrderEquipment(data.equipment);
    updateStockEquipment(data.stockEquipment);
    setNotice(status === "RESERVED" ? "Equipamento reservado para a obra." : "Equipamento atualizado.");
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={2}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 34 } }} noWrap>
            {order.title}
          </Typography>
          <Typography color="text.secondary" noWrap>
            {order.customerName} - {formatDateTime(order.scheduledStart)}
          </Typography>
        </Box>
        <Button component={Link} href="/almoxarifado" startIcon={<ArrowBackRoundedIcon />}>
          Voltar
        </Button>
      </Stack>

      {notice && <Alert severity="success">{notice}</Alert>}
      {error && <Alert severity="warning">{error}</Alert>}

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
          <Box>
            <Typography variant="h6">Preparacao do servico</Typography>
            <Typography variant="body2" color="text.secondary">
              Materiais, solicitacoes extras e equipamentos precisam ficar reservados antes da saida da equipe.
            </Typography>
          </Box>
          <Chip color={progress === 100 ? "success" : "warning"} label={`${progress}% pronto`} />
        </Stack>
        <LinearProgress value={progress} variant="determinate" sx={{ mt: 2, height: 9, borderRadius: 999 }} />
      </Paper>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
        <Kpi label="Materiais planejados" value={String(orderMaterials.length)} helper={`${readyMaterials} reservados`} icon={<Inventory2RoundedIcon />} />
        <Kpi label="Solicitacoes extras" value={String(pendingRequests.length)} helper="Aguardando reserva" icon={<WarningAmberRoundedIcon />} tone={pendingRequests.length ? "warning" : "success"} />
        <Kpi label="Equipamentos" value={String(orderEquipment.length)} helper={`${readyEquipment} reservados`} icon={<BuildRoundedIcon />} />
        <Kpi label="Entrega" value={progress === 100 ? "Pronto" : "Pendente"} helper="Status da separacao" icon={<LocalShippingRoundedIcon />} tone={progress === 100 ? "success" : "warning"} />
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "1.1fr 0.9fr" }, gap: 2 }}>
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Materiais planejados
            </Typography>
            {orderMaterials.length === 0 ? (
              <EmptyState title="Nenhum material planejado" text="Materiais solicitados na OS aparecem aqui para reserva." />
            ) : (
              <Stack spacing={1.5}>
                {orderMaterials.map((item) => {
                  const material = localMaterials.find((candidate) => candidate.id === item.materialId);
                  const stockStatus = material ? getMaterialOperationalStatus(material) : "UNAVAILABLE";
                  const canReserve = item.status === "PENDING_SEPARATION" || item.status === "SEPARATING";
                  const canDeliver = item.status === "RESERVED" || item.status === "SEPARATED";

                  return (
                    <Paper key={item.id} variant="outlined" sx={{ p: 1.7, borderRadius: 2, bgcolor: "background.default" }}>
                      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1.5}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography fontWeight={900}>{material?.name ?? "Material"}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Planejado {item.plannedQuantity} {material?.unit ?? "un"} | estoque {material?.currentStock ?? 0} {material?.unit ?? "un"}
                          </Typography>
                          {item.notes && <Typography variant="caption" color="text.secondary">{item.notes}</Typography>}
                        </Box>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                          <StatusChip value={stockStatus} />
                          <StatusChip value={item.status} />
                          <Button size="small" variant="contained" disabled={!canReserve || busyKey === `${item.id}-RESERVED`} onClick={() => void patchMaterial(item, "RESERVED")}>
                            Reservar
                          </Button>
                          <Button size="small" variant="outlined" disabled={!canDeliver || busyKey === `${item.id}-DELIVERED_TO_TEAM`} onClick={() => void patchMaterial(item, "DELIVERED_TO_TEAM")}>
                            Entregar
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Solicitacoes extras
            </Typography>
            {orderRequests.length === 0 ? (
              <EmptyState title="Nenhuma solicitacao extra" text="Pedidos feitos pelo supervisor, gerente ou dono aparecem aqui." />
            ) : (
              <Stack spacing={1.5}>
                {orderRequests.map((request) => {
                  const items = materialRequestItems.filter((item) => item.requestId === request.id);
                  const canReserve = request.status === "PENDING" || request.status === "APPROVED";
                  return (
                    <Paper key={request.id} variant="outlined" sx={{ p: 1.7, borderRadius: 2, bgcolor: "background.default" }}>
                      <Stack spacing={1.2}>
                        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1}>
                          <Box>
                            <Typography fontWeight={900}>{request.reason}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {items.map((item) => `${localMaterials.find((material) => material.id === item.materialId)?.name ?? "Material"}: ${item.quantity}`).join(" | ")}
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <StatusChip value={request.priority} />
                            <StatusChip value={request.status} />
                          </Stack>
                        </Stack>
                        <Button variant="contained" startIcon={<AssignmentTurnedInRoundedIcon />} disabled={!canReserve || busyKey === request.id} onClick={() => void reserveRequest(request)} sx={{ alignSelf: "flex-start" }}>
                          Reservar solicitacao
                        </Button>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Paper>
        </Stack>

        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Equipamentos solicitados
            </Typography>
            {orderEquipment.length === 0 ? (
              <EmptyState title="Nenhum equipamento solicitado" text="Equipamentos pedidos na OS aparecem aqui para reserva." />
            ) : (
              <Stack spacing={1.5}>
                {orderEquipment.map((item) => {
                  const stockItem = localEquipment.find((candidate) => candidate.id === item.equipmentId);
                  const canReserve = item.status === "REQUESTED";
                  const canDeliver = item.status === "RESERVED";
                  const canReturn = item.status === "DELIVERED" || item.status === "IN_USE";

                  return (
                    <Paper key={item.id} variant="outlined" sx={{ p: 1.7, borderRadius: 2, bgcolor: "background.default" }}>
                      <Stack spacing={1.2}>
                        <Stack direction="row" justifyContent="space-between" gap={1}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography fontWeight={900}>{stockItem?.name ?? "Equipamento"}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {stockItem?.code ?? "sem codigo"} - {item.notes || "Sem observacao"}
                            </Typography>
                          </Box>
                          <StatusChip value={item.status} />
                        </Stack>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          <Button size="small" variant="contained" disabled={!canReserve || busyKey === `${item.id}-RESERVED`} startIcon={<BuildRoundedIcon />} onClick={() => void patchEquipment(item, "RESERVED")}>
                            Reservar
                          </Button>
                          <Button size="small" variant="outlined" disabled={!canDeliver || busyKey === `${item.id}-DELIVERED`} startIcon={<LocalShippingRoundedIcon />} onClick={() => void patchEquipment(item, "DELIVERED")}>
                            Entregar
                          </Button>
                          <Button size="small" variant="outlined" disabled={!canReturn || busyKey === `${item.id}-RETURNED`} startIcon={<ReplayRoundedIcon />} onClick={() => void patchEquipment(item, "RETURNED")}>
                            Devolver
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Estoque relacionado
            </Typography>
            <Stack spacing={1.2}>
              {orderMaterials.slice(0, 6).map((item) => {
                const material = localMaterials.find((candidate) => candidate.id === item.materialId);
                if (!material) return null;
                return (
                  <Box key={item.id} sx={{ p: 1.3, borderRadius: 2, bgcolor: "background.default", border: 1, borderColor: "divider" }}>
                    <Stack direction="row" justifyContent="space-between" gap={1}>
                      <Typography fontWeight={850}>{material.name}</Typography>
                      <Chip size="small" label={`${material.currentStock} ${material.unit}`} />
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </Stack>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, textAlign: "center", bgcolor: "background.default" }}>
      <Avatar variant="rounded" sx={{ bgcolor: "primary.light", color: "primary.dark", mx: "auto", mb: 1.5 }}>
        <Inventory2RoundedIcon />
      </Avatar>
      <Typography variant="h6">{title}</Typography>
      <Typography variant="body2" color="text.secondary">
        {text}
      </Typography>
    </Paper>
  );
}

function Kpi({
  label,
  value,
  helper,
  icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  tone?: "primary" | "warning" | "success";
}) {
  return (
    <Paper variant="outlined" sx={{ p: 1.8, borderRadius: 2 }}>
      <Stack direction="row" justifyContent="space-between" spacing={1.2}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={850}>
            {label}
          </Typography>
          <Typography fontWeight={900} noWrap>{value}</Typography>
          <Typography variant="caption" color="text.secondary">
            {helper}
          </Typography>
        </Box>
        <Avatar variant="rounded" sx={{ bgcolor: `${tone}.light`, color: `${tone}.dark`, width: 38, height: 38 }}>
          {icon}
        </Avatar>
      </Stack>
    </Paper>
  );
}
