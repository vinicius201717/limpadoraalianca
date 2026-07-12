"use client";

import Link from "next/link";
import { Avatar, Box, Button, Chip, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";
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

export function WarehouseView({
  equipment,
  materialRequestItems,
  materialRequests,
  materials,
  serviceOrderEquipment,
  serviceOrderMaterials,
  serviceOrders,
}: {
  equipment: Equipment[];
  materialRequestItems: ServiceMaterialRequestItem[];
  materialRequests: ServiceMaterialRequest[];
  materials: Material[];
  serviceOrderEquipment: ServiceOrderEquipment[];
  serviceOrderMaterials: ServiceOrderMaterial[];
  serviceOrders: ServiceOrder[];
}) {
  const lowStock = materials.filter((material) => ["LOW_STOCK", "OUT_OF_STOCK"].includes(getMaterialOperationalStatus(material)));
  const pendingMaterials = serviceOrderMaterials.filter((item) => item.status === "PENDING_SEPARATION" || item.status === "SEPARATING");
  const reservedMaterials = serviceOrderMaterials.filter((item) => item.status === "RESERVED" || item.status === "SEPARATED");
  const requestedEquipment = serviceOrderEquipment.filter((item) => item.status === "REQUESTED");
  const reservedEquipment = serviceOrderEquipment.filter((item) => item.status === "RESERVED");
  const pendingRequests = materialRequests.filter((request) => request.status === "PENDING" || request.status === "APPROVED");
  const activeOrders = serviceOrders
    .filter((order) => !["DONE", "DELIVERED", "CANCELED"].includes(order.status))
    .filter((order) => {
      const hasMaterials = serviceOrderMaterials.some((item) => item.serviceOrderId === order.id && !["DELIVERED_TO_TEAM", "RETURNED", "CONSUMED", "CANCELED"].includes(item.status));
      const hasEquipment = serviceOrderEquipment.some((item) => item.serviceOrderId === order.id && !["RETURNED", "DAMAGED", "LOST", "CANCELED"].includes(item.status));
      const hasRequests = pendingRequests.some((request) => request.serviceOrderId === order.id);
      return hasMaterials || hasEquipment || hasRequests;
    })
    .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} alignItems={{ md: "flex-end" }}>
        <Box>
          <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 34 }, mb: 0.8 }}>
            Almoxarifado
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 860 }}>
            Fila de separacao por ordem de servico, com materiais solicitados, equipamentos a reservar e alertas de estoque.
          </Typography>
        </Box>
        <Button component={Link} href="/almoxarifado/servicos" variant="contained" endIcon={<ArrowForwardRoundedIcon />}>
          Servicos para preparar
        </Button>
      </Stack>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
        <WarehouseKpi label="Materiais a reservar" value={String(pendingMaterials.length)} icon={<Inventory2RoundedIcon />} tone="warning" />
        <WarehouseKpi label="Equipamentos solicitados" value={String(requestedEquipment.length)} icon={<BuildRoundedIcon />} tone="warning" />
        <WarehouseKpi label="Itens reservados" value={String(reservedMaterials.length + reservedEquipment.length)} icon={<AssignmentTurnedInRoundedIcon />} tone="success" />
        <WarehouseKpi label="Estoque baixo/em falta" value={String(lowStock.length)} icon={<WarningAmberRoundedIcon />} tone={lowStock.length ? "warning" : "success"} />
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "1.1fr 0.9fr" }, gap: 2 }}>
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1.5} sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h6">Servicos com separacao pendente</Typography>
              <Typography variant="body2" color="text.secondary">
                Abra cada servico para reservar materiais e equipamentos solicitados.
              </Typography>
            </Box>
            <Chip color="primary" variant="outlined" label={`${activeOrders.length} na fila`} />
          </Stack>

          {activeOrders.length === 0 ? (
            <EmptyState title="Nenhum servico aguardando almoxarifado" text="Quando gerente, dono ou supervisor solicitarem materiais ou equipamentos, eles aparecem aqui." />
          ) : (
            <Stack spacing={1.5}>
              {activeOrders.map((order) => {
                const orderMaterials = serviceOrderMaterials.filter((item) => item.serviceOrderId === order.id);
                const orderEquipment = serviceOrderEquipment.filter((item) => item.serviceOrderId === order.id);
                const orderRequests = pendingRequests.filter((request) => request.serviceOrderId === order.id);
                const readyMaterials = orderMaterials.filter((item) => ["RESERVED", "SEPARATED", "DELIVERED_TO_TEAM"].includes(item.status)).length;
                const readyEquipment = orderEquipment.filter((item) => ["RESERVED", "DELIVERED", "IN_USE"].includes(item.status)).length;
                const totalItems = orderMaterials.length + orderEquipment.length + orderRequests.length;
                const progress = totalItems ? Math.round(((readyMaterials + readyEquipment) / totalItems) * 100) : 0;

                return (
                  <Paper key={order.id} variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "background.default" }}>
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography fontWeight={900} noWrap>
                          {order.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {order.customerName} - {formatDateTime(order.scheduledStart)}
                        </Typography>
                      </Box>
                      <StatusChip value={order.status} />
                    </Stack>
                    <LinearProgress value={progress} variant="determinate" sx={{ my: 1.2, height: 8, borderRadius: 999 }} />
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                      <Chip size="small" label={`${orderMaterials.length} materiais`} />
                      <Chip size="small" label={`${orderEquipment.length} equipamentos`} />
                      <Chip size="small" color={orderRequests.length ? "warning" : "default"} label={`${orderRequests.length} solicitacoes`} />
                      <Button component={Link} href={`/almoxarifado/servicos/${order.id}`} size="small" endIcon={<ArrowForwardRoundedIcon />} sx={{ ml: { md: "auto" } }}>
                        Separar
                      </Button>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Paper>

        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
              <WarningAmberRoundedIcon color="warning" />
              <Typography variant="h6">Materiais baixos ou em falta</Typography>
            </Stack>
            {lowStock.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nenhum material abaixo do minimo agora.
              </Typography>
            ) : (
              <Stack spacing={1.2}>
                {lowStock.slice(0, 6).map((material) => (
                  <Box key={material.id} sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: "divider", bgcolor: "background.default" }}>
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography fontWeight={850} noWrap>{material.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Minimo {material.minStock} {material.unit}
                        </Typography>
                      </Box>
                      <Chip size="small" color="warning" label={`${material.currentStock} ${material.unit}`} />
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Solicitacoes extras
            </Typography>
            {pendingRequests.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nenhuma solicitacao extra pendente.
              </Typography>
            ) : (
              <Stack spacing={1.2}>
                {pendingRequests.slice(0, 5).map((request) => {
                  const order = serviceOrders.find((item) => item.id === request.serviceOrderId);
                  const items = materialRequestItems.filter((item) => item.requestId === request.id);
                  return (
                    <Box key={request.id} sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: "divider", bgcolor: "background.default" }}>
                      <Stack spacing={0.7}>
                        <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                          <Typography fontWeight={850}>{order?.customerName ?? "OS"}</Typography>
                          <StatusChip value={request.priority} />
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {items.length} item(ns) - {request.reason}
                        </Typography>
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Paper>
        </Stack>
      </Box>

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Equipamentos reservados e em uso
        </Typography>
        {serviceOrderEquipment.length === 0 ? (
          <EmptyState title="Nenhum equipamento vinculado" text="Os equipamentos solicitados por OS aparecem aqui para reserva e entrega." />
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
            {serviceOrderEquipment.slice(0, 6).map((link) => {
              const item = equipment.find((candidate) => candidate.id === link.equipmentId);
              const order = serviceOrders.find((candidate) => candidate.id === link.serviceOrderId);
              return (
                <Paper key={link.id} variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "background.default" }}>
                  <Stack spacing={1}>
                    <Typography fontWeight={900}>{item?.name ?? "Equipamento"}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {order?.title ?? "OS"} - {item?.code ?? "sem codigo"}
                    </Typography>
                    <StatusChip value={link.status} />
                  </Stack>
                </Paper>
              );
            })}
          </Box>
        )}
      </Paper>
    </Stack>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 4, borderRadius: 2, textAlign: "center", bgcolor: "background.default" }}>
      <Avatar variant="rounded" sx={{ bgcolor: "primary.light", color: "primary.dark", mx: "auto", mb: 1.5 }}>
        <LocalShippingRoundedIcon />
      </Avatar>
      <Typography variant="h6">{title}</Typography>
      <Typography color="text.secondary">{text}</Typography>
    </Paper>
  );
}

function WarehouseKpi({
  label,
  value,
  icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "primary" | "warning" | "success";
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Stack direction="row" justifyContent="space-between" spacing={1.5}>
        <Box>
          <Typography variant="body2" color="text.secondary" fontWeight={850}>
            {label}
          </Typography>
          <Typography variant="h4" sx={{ fontSize: 30 }}>
            {value}
          </Typography>
        </Box>
        <Avatar variant="rounded" sx={{ bgcolor: `${tone}.light`, color: `${tone}.dark` }}>
          {icon}
        </Avatar>
      </Stack>
    </Paper>
  );
}
