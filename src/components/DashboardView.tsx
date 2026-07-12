"use client";

import Link from "next/link";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import AssignmentLateRoundedIcon from "@mui/icons-material/AssignmentLateRounded";
import BarChartRoundedIcon from "@mui/icons-material/BarChartRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ConstructionRoundedIcon from "@mui/icons-material/ConstructionRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import PaidRoundedIcon from "@mui/icons-material/PaidRounded";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";

import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  employees as demoEmployees,
  materialRequests as demoMaterialRequests,
  materials as demoMaterials,
  serviceOrderChecklistItems as demoServiceOrderChecklistItems,
  serviceOrderChecklistPhotos as demoServiceOrderChecklistPhotos,
  serviceOrderEmployees as demoServiceOrderEmployees,
  serviceOrderMaterials as demoServiceOrderMaterials,
  serviceOrders as demoServiceOrders,
} from "@/lib/demo-data";
import type {
  AttentionItem,
  ChartPoint,
  DashboardData,
  DashboardMetric,
  Employee,
  Material,
  ServiceMaterialRequest,
  ServiceOrder,
  ServiceOrderChecklistItem,
  ServiceOrderChecklistPhoto,
  ServiceOrderEmployee,
  ServiceOrderMaterial,
  SiteBeforeAfter,
  SiteTestimonial,
} from "@/lib/types";
import { SiteContentManager } from "./SiteContentManager";
import { StatusChip } from "./StatusChip";
import { useCurrentUser } from "./useCurrentUser";

function metricIcon(label: string) {
  if (label.includes("Leads")) return <PersonAddAltRoundedIcon />;
  if (label.includes("Orcamentos")) return <ReceiptLongRoundedIcon />;
  if (label.includes("execucao")) return <ConstructionRoundedIcon />;
  if (label.includes("avaliacao")) return <AssignmentLateRoundedIcon />;
  if (label.includes("Media")) return <StarRoundedIcon />;
  if (label.includes("Receita")) return <PaidRoundedIcon />;
  if (label.includes("finalizados")) return <CheckCircleRoundedIcon />;
  return <GroupsRoundedIcon />;
}

function MetricCard({ metric }: { metric: DashboardMetric }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2,
        minHeight: 148,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1.5}>
        <Typography color="text.secondary" fontWeight={800} variant="body2">
          {metric.label}
        </Typography>
        <Avatar
          variant="rounded"
          sx={{
            width: 36,
            height: 36,
            bgcolor: `${metric.tone}.light`,
            color: `${metric.tone}.dark`,
          }}
        >
          {metricIcon(metric.label)}
        </Avatar>
      </Stack>
      <Box>
        <Typography variant="h4" sx={{ fontSize: { xs: 25, md: 29 }, lineHeight: 1.1, mb: 0.8 }}>
          {metric.value}
        </Typography>
        <Typography color={`${metric.tone}.main`} variant="body2" fontWeight={850}>
          {metric.trend}
        </Typography>
      </Box>
    </Paper>
  );
}

function AttentionCard({ item }: { item: AttentionItem }) {
  const icon = item.title.includes("Materiais") ? (
    <Inventory2RoundedIcon />
  ) : item.tone === "error" ? (
    <WarningAmberRoundedIcon />
  ) : (
    <AssignmentLateRoundedIcon />
  );

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: "100%" }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ height: "100%" }}>
        <Avatar variant="rounded" sx={{ bgcolor: `${item.tone}.light`, color: `${item.tone}.dark`, width: 38, height: 38 }}>
          {icon}
        </Avatar>
        <Stack spacing={0.9} sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Typography fontWeight={900}>{item.title}</Typography>
            <Chip size="small" color={item.tone} label={item.value} />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {item.description}
          </Typography>
          {item.href && (
            <Button component={Link} href={item.href} size="small" endIcon={<ArrowForwardRoundedIcon />} sx={{ alignSelf: "flex-start" }}>
              Ver detalhe
            </Button>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}

function BarPanel({
  title,
  data,
  suffix = "",
  emptyMessage = "Sem dados para exibir neste momento.",
}: {
  title: string;
  data: ChartPoint[];
  suffix?: string;
  emptyMessage?: string;
}) {
  const theme = useTheme();
  const hasData = data.some((item) => item.value > 0);
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {title}
      </Typography>
      {hasData ? (
        <Stack spacing={1.5}>
          {data.map((item, index) => (
            <Box key={item.label}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.6 }} gap={1}>
                <Typography variant="body2" fontWeight={800} noWrap>
                  {item.label}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                  {item.value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                  {suffix}
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={(item.value / max) * 100}
                sx={{
                  height: 9,
                  borderRadius: 999,
                  bgcolor: theme.palette.action.hover,
                  "& .MuiLinearProgress-bar": {
                    borderRadius: 999,
                    bgcolor: [
                      theme.palette.primary.main,
                      theme.palette.secondary.main,
                      theme.palette.info.main,
                      theme.palette.success.main,
                    ][index % 4],
                  },
                }}
              />
            </Box>
          ))}
        </Stack>
      ) : (
        <Stack
          spacing={1.2}
          alignItems="center"
          justifyContent="center"
          sx={{
            minHeight: 148,
            borderRadius: 2,
            border: 1,
            borderColor: "divider",
            bgcolor: "background.default",
            px: 2,
            textAlign: "center",
          }}
        >
          <Avatar variant="rounded" sx={{ bgcolor: "action.hover", color: "text.secondary" }}>
            <BarChartRoundedIcon />
          </Avatar>
          <Typography variant="body2" color="text.secondary">
            {emptyMessage}
          </Typography>
        </Stack>
      )}
    </Paper>
  );
}

function Kpi({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.6, borderRadius: 2, bgcolor: "background.default" }}>
      <Typography variant="caption" color="text.secondary" fontWeight={850}>
        {label}
      </Typography>
      <Typography fontWeight={900} sx={{ mt: 0.4 }} noWrap>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {helper}
      </Typography>
    </Paper>
  );
}

function getSupervisorName(order: ServiceOrder, employees: Employee[]) {
  return employees.find((employee) => employee.id === order.supervisorEmployeeId)?.name ?? "Supervisor pendente";
}

function getChecklistProgress(orderId: string, serviceOrderChecklistItems: ServiceOrderChecklistItem[], serviceOrderChecklistPhotos: ServiceOrderChecklistPhoto[]) {
  const items = serviceOrderChecklistItems.filter((item) => item.serviceOrderId === orderId);
  const done = items.filter((item) => item.status === "DONE").length;
  const activeItems = items.filter((item) => item.status !== "CANCELED");
  const pendingPhotos = activeItems.filter((item) => {
    if (!item.requiresPhoto) return false;
    const photos = serviceOrderChecklistPhotos.filter((photo) => photo.checklistItemId === item.id).length;
    return photos < Math.max(item.minimumPhotos, 1);
  }).length;
  return {
    total: items.length,
    pending: items.length - done,
    blocked: activeItems.filter((item) => item.status === "BLOCKED").length,
    unassigned: activeItems.filter((item) => !item.assignedEmployeeId && !(item.assignedEmployeeIds?.length)).length,
    overdue: activeItems.filter((item) => item.dueAt && new Date(item.dueAt).getTime() < Date.now() && item.status !== "DONE").length,
    pendingPhotos,
    progress: items.length ? Math.round((done / items.length) * 100) : 0,
  };
}

function OperationalOrderCard({
  order,
  actionLabel = "Abrir",
  actionHref,
  employees,
  serviceOrderChecklistItems,
  serviceOrderChecklistPhotos,
}: {
  order: ServiceOrder;
  actionLabel?: string;
  actionHref?: string;
  employees: Employee[];
  serviceOrderChecklistItems: ServiceOrderChecklistItem[];
  serviceOrderChecklistPhotos: ServiceOrderChecklistPhoto[];
}) {
  const checklist = getChecklistProgress(order.id, serviceOrderChecklistItems, serviceOrderChecklistPhotos);

  return (
    <Box sx={{ p: 1.6, borderRadius: 2, bgcolor: "background.default", border: 1, borderColor: "divider" }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography fontWeight={900} noWrap>
            {order.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {order.customerName} - {formatDateTime(order.scheduledStart)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {getSupervisorName(order, employees)} - {checklist.pending} checklist pendente
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <StatusChip value={order.status} />
          <Button component={Link} href={actionHref ?? `/ordens-servico/${order.id}`} size="small" endIcon={<ArrowForwardRoundedIcon />}>
            {actionLabel}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export function DashboardView({
  data,
  employees = demoEmployees,
  serviceOrders = demoServiceOrders,
  serviceOrderEmployees = demoServiceOrderEmployees,
  serviceOrderChecklistItems = demoServiceOrderChecklistItems,
  serviceOrderChecklistPhotos = demoServiceOrderChecklistPhotos,
  serviceOrderMaterials = demoServiceOrderMaterials,
  materialRequests = demoMaterialRequests,
  materials = demoMaterials,
  siteBeforeAfters = [],
  siteTestimonials = [],
}: {
  data: DashboardData;
  employees?: Employee[];
  serviceOrders?: ServiceOrder[];
  serviceOrderEmployees?: ServiceOrderEmployee[];
  serviceOrderChecklistItems?: ServiceOrderChecklistItem[];
  serviceOrderChecklistPhotos?: ServiceOrderChecklistPhoto[];
  serviceOrderMaterials?: ServiceOrderMaterial[];
  materialRequests?: ServiceMaterialRequest[];
  materials?: Material[];
  siteBeforeAfters?: SiteBeforeAfter[];
  siteTestimonials?: SiteTestimonial[];
}) {
  const { user } = useCurrentUser();
  const linkedEmployee = employees.find((employee) => employee.userId === user?.id);
  const assignedOrders =
    user?.role === "SUPERVISOR_OBRA"
      ? serviceOrders.filter(
          (order) =>
            order.supervisorUserId === user.id ||
            order.supervisorEmployeeId === linkedEmployee?.id ||
            Boolean(linkedEmployee && serviceOrderEmployees.some((link) => link.serviceOrderId === order.id && link.employeeId === linkedEmployee.id)),
        )
      : user?.role === "COLABORADOR"
        ? serviceOrders.filter((order) => Boolean(linkedEmployee && order.employeeIds.includes(linkedEmployee.id)))
        : data.nextOrders;
  const materialPending = serviceOrderMaterials.filter((item) => item.status === "PENDING_SEPARATION" || item.status === "SEPARATING");
  const roleSummary =
    user?.role === "SUPERVISOR_OBRA"
      ? {
          title: "Servicos designados a voce",
          description: "Checklist, fotos, materiais e prazo das obras sob sua supervisao.",
          chips: [`${assignedOrders.length} OS`, `${serviceOrderChecklistItems.filter((item) => assignedOrders.some((order) => order.id === item.serviceOrderId) && item.status !== "DONE").length} checklist pendente`],
        }
      : user?.role === "ALMOXARIFADO"
        ? {
            title: "Fila do almoxarifado",
            description: "Separacao, entrega, devolucao e solicitacoes extras de material.",
            chips: [`${materialPending.length} a separar`, `${materialRequests.length} solicitacoes`],
          }
        : user?.role === "COLABORADOR"
          ? {
              title: "Suas obras e tarefas",
              description: "Servicos em que voce esta escalado, horario, endereco e avaliacao de supervisor.",
              chips: [`${assignedOrders.length} servicos`, "avaliacao de supervisor pendente"],
            }
          : {
              title: "Visao executiva completa",
              description: "Operacao, equipe, financeiro, estoque, agenda e avaliacoes em uma leitura unica.",
              chips: ["acesso completo", "alertas operacionais"],
            };

  if (user?.role === "ALMOXARIFADO") {
    const operationalOrders = serviceOrders
      .filter((order) => !["DONE", "DELIVERED", "CANCELED"].includes(order.status))
      .slice()
      .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());
    const pendingMaterials = serviceOrderMaterials.filter((item) => item.status === "PENDING_SEPARATION" || item.status === "SEPARATING");
    const pendingRequests = materialRequests.filter((request) => request.status === "PENDING");

    return (
      <Stack spacing={3}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2} alignItems={{ md: "flex-end" }}>
          <Box>
            <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 36 }, mb: 0.8 }}>
              Painel do almoxarifado
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 820 }}>
              Separacao de materiais, entregas para equipe e solicitacoes extras das obras em andamento.
            </Typography>
          </Box>
          <Chip label={`${pendingMaterials.length} itens na fila`} color="warning" variant="outlined" />
        </Stack>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
          <Kpi label="OS ativas" value={String(operationalOrders.length)} helper="Sem valores financeiros" />
          <Kpi label="Materiais pendentes" value={String(pendingMaterials.length)} helper="Separacao ou conferencia" />
          <Kpi label="Solicitacoes extras" value={String(pendingRequests.length)} helper="Aguardando aprovacao" />
          <Kpi label="Entregas proximas" value={String(operationalOrders.slice(0, 4).length)} helper="Prioridade da agenda" />
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "1.1fr 0.9fr" }, gap: 2 }}>
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Obras que precisam de material
            </Typography>
            <Stack spacing={1.5}>
              {operationalOrders.slice(0, 6).map((order) => (
                <OperationalOrderCard
                  key={order.id}
                  order={order}
                  actionLabel="Separar"
                  actionHref={`/almoxarifado/servicos/${order.id}`}
                  employees={employees}
                  serviceOrderChecklistItems={serviceOrderChecklistItems}
                  serviceOrderChecklistPhotos={serviceOrderChecklistPhotos}
                />
              ))}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Fila de separacao
            </Typography>
            <Stack spacing={1.4}>
              {pendingMaterials.slice(0, 7).map((item) => {
                const material = materials.find((candidate) => candidate.id === item.materialId);
                const order = serviceOrders.find((candidate) => candidate.id === item.serviceOrderId);

                return (
                  <Box key={item.id} sx={{ p: 1.4, borderRadius: 2, bgcolor: "background.default", border: 1, borderColor: "divider" }}>
                    <Stack direction="row" justifyContent="space-between" gap={1} alignItems="flex-start">
                      <Box sx={{ minWidth: 0 }}>
                        <Typography fontWeight={900} noWrap>
                          {material?.name ?? "Material"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {order?.title ?? "OS"} - {item.plannedQuantity} {material?.unit ?? "un"}
                        </Typography>
                      </Box>
                      <StatusChip value={item.status} />
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          </Paper>
        </Box>

        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h6">Solicitacoes extras</Typography>
              <Typography variant="body2" color="text.secondary">
                Pedidos feitos pela equipe durante a execucao, sem exposicao de dados financeiros.
              </Typography>
            </Box>
            <Button component={Link} href="/materiais" variant="outlined" endIcon={<ArrowForwardRoundedIcon />}>
              Abrir materiais
            </Button>
          </Stack>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
            {materialRequests.slice(0, 3).map((request) => {
              const order = serviceOrders.find((candidate) => candidate.id === request.serviceOrderId);

              return (
                <Box key={request.id} sx={{ p: 1.5, borderRadius: 2, bgcolor: "background.default", border: 1, borderColor: "divider" }}>
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" gap={1}>
                      <Typography fontWeight={900}>{order?.title ?? "Solicitacao"}</Typography>
                      <StatusChip value={request.priority} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {request.reason}
                    </Typography>
                  </Stack>
                </Box>
              );
            })}
          </Box>
        </Paper>
      </Stack>
    );
  }

  if (user?.role === "COLABORADOR") {
    const sortedAssignedOrders = assignedOrders
      .slice()
      .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());
    const nextOrder =
      sortedAssignedOrders.find((order) => !["DONE", "DELIVERED", "CANCELED"].includes(order.status)) ?? sortedAssignedOrders[0];
    const assignedChecklist = serviceOrderChecklistItems.filter((item) =>
      sortedAssignedOrders.some((order) => order.id === item.serviceOrderId),
    );
    const checklistDone = assignedChecklist.filter((item) => item.status === "DONE").length;
    const checklistProgress = assignedChecklist.length ? Math.round((checklistDone / assignedChecklist.length) * 100) : 0;

    return (
      <Stack spacing={3}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2} alignItems={{ md: "flex-end" }}>
          <Box>
            <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 36 }, mb: 0.8 }}>
              Minha operacao
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 820 }}>
              Sua escala de obras, tarefas de checklist e informacoes essenciais para executar o servico.
            </Typography>
          </Box>
          <Chip label={linkedEmployee?.name ?? "Colaborador sem vinculo"} color={linkedEmployee ? "primary" : "warning"} variant="outlined" />
        </Stack>

        {!linkedEmployee ? (
          <Paper variant="outlined" sx={{ p: 4, borderRadius: 2, textAlign: "center" }}>
            <Typography variant="h6">Perfil sem colaborador vinculado</Typography>
            <Typography color="text.secondary">
              O acesso existe, mas ainda falta vincular este usuario a um cadastro de colaborador.
            </Typography>
          </Paper>
        ) : (
          <>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
              <Kpi label="Obras vinculadas" value={String(sortedAssignedOrders.length)} helper="Somente sua escala" />
              <Kpi label="Checklist geral" value={`${checklistProgress}%`} helper={`${assignedChecklist.length - checklistDone} itens pendentes`} />
              <Kpi label="Avaliacao media" value={linkedEmployee.averageRating.toFixed(1)} helper="Historico do colaborador" />
              <Kpi label="Ultima avaliacao" value={linkedEmployee.lastEvaluationAt ? formatDateTime(linkedEmployee.lastEvaluationAt) : "Pendente"} helper="Feedback de obra" />
            </Box>

            {nextOrder ? (
              <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                <Stack spacing={2}>
                  <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="h5">Proxima obra</Typography>
                      <Typography variant="h6" sx={{ mt: 0.8 }}>
                        {nextOrder.title}
                      </Typography>
                      <Typography color="text.secondary">{nextOrder.customerName}</Typography>
                    </Box>
                    <StatusChip value={nextOrder.status} />
                  </Stack>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
                    <Kpi label="Endereco" value={nextOrder.address} helper="Local da obra" />
                    <Kpi label="Inicio" value={formatDateTime(nextOrder.scheduledStart)} helper="Apresentacao da equipe" />
                    <Kpi label="Entrega" value={formatDateTime(nextOrder.scheduledEnd)} helper="Prazo previsto" />
                    <Kpi label="Supervisor" value={getSupervisorName(nextOrder, employees)} helper="Responsavel na obra" />
                  </Box>
                  <Button component={Link} href={`/ordens-servico/${nextOrder.id}`} variant="contained" endIcon={<ArrowForwardRoundedIcon />} sx={{ alignSelf: "flex-start" }}>
                    Abrir minha OS
                  </Button>
                </Stack>
              </Paper>
            ) : (
              <Paper variant="outlined" sx={{ p: 4, borderRadius: 2, textAlign: "center" }}>
                <Typography variant="h6">Nenhuma obra vinculada</Typography>
                <Typography color="text.secondary">Quando voce for escalado, as informacoes aparecem aqui.</Typography>
              </Paper>
            )}

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "1fr 1fr" }, gap: 2 }}>
              <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Minha escala
                </Typography>
                <Stack spacing={1.5}>
                  {sortedAssignedOrders.map((order) => (
                    <OperationalOrderCard
                      key={order.id}
                      order={order}
                      employees={employees}
                      serviceOrderChecklistItems={serviceOrderChecklistItems}
                      serviceOrderChecklistPhotos={serviceOrderChecklistPhotos}
                    />
                  ))}
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Checklist pendente
                </Typography>
                <Stack spacing={1.4}>
                  {assignedChecklist
                    .filter((item) => item.status !== "DONE")
                    .slice(0, 6)
                    .map((item) => {
                      const order = serviceOrders.find((candidate) => candidate.id === item.serviceOrderId);

                      return (
                        <Box key={item.id} sx={{ p: 1.4, borderRadius: 2, bgcolor: "background.default", border: 1, borderColor: "divider" }}>
                          <Stack direction="row" justifyContent="space-between" gap={1}>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography fontWeight={900}>{item.title}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {order?.title ?? "OS"} {item.requiresPhoto ? "- requer foto" : ""}
                              </Typography>
                            </Box>
                            <StatusChip value={item.status} />
                          </Stack>
                        </Box>
                      );
                    })}
                </Stack>
              </Paper>
            </Box>
          </>
        )}
      </Stack>
    );
  }

  if (user?.role === "SUPERVISOR_OBRA") {
    const sortedAssignedOrders = assignedOrders
      .slice()
      .sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());
    const mainOrder =
      sortedAssignedOrders.find((order) => order.status === "IN_PROGRESS") ??
      sortedAssignedOrders.find((order) => !["DONE", "DELIVERED", "CANCELED"].includes(order.status)) ??
      sortedAssignedOrders[0];
    const checklistForMain = mainOrder ? serviceOrderChecklistItems.filter((item) => item.serviceOrderId === mainOrder.id) : [];
    const checklistDone = checklistForMain.filter((item) => item.status === "DONE").length;
    const checklistProgress = checklistForMain.length ? Math.round((checklistDone / checklistForMain.length) * 100) : 0;
    const mainChecklistAlerts = mainOrder ? getChecklistProgress(mainOrder.id, serviceOrderChecklistItems, serviceOrderChecklistPhotos) : null;

    return (
      <Stack spacing={3}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2} alignItems={{ md: "flex-end" }}>
          <Box>
            <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 36 }, mb: 0.8 }}>
              Painel do supervisor
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 820 }}>
              Obras atribuidas ao seu perfil, equipe escalada, prazo e checklist operacional.
            </Typography>
          </Box>
          <Chip label={`${assignedOrders.length} servicos atribuidos`} color="primary" variant="outlined" />
        </Stack>

        {mainOrder ? (
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h5">Servico principal</Typography>
                  <Typography variant="h6" sx={{ mt: 0.8 }}>
                    {mainOrder.title}
                  </Typography>
                  <Typography color="text.secondary">{mainOrder.customerName}</Typography>
                </Box>
                <StatusChip value={mainOrder.status} />
              </Stack>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
                <Kpi label="Endereco" value={mainOrder.address} helper="Local da obra" />
                <Kpi label="Inicio" value={formatDateTime(mainOrder.scheduledStart)} helper="Agenda da equipe" />
                <Kpi label="Entrega" value={formatDateTime(mainOrder.scheduledEnd)} helper="Prazo previsto" />
                <Kpi label="Equipe" value={String(mainOrder.employeeIds.length)} helper="Colaboradores vinculados" />
              </Box>
              <Box>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.8 }}>
                  <Typography fontWeight={850}>Progresso do checklist</Typography>
                  <Typography color="text.secondary">{checklistProgress}%</Typography>
                </Stack>
                <LinearProgress value={checklistProgress} variant="determinate" sx={{ height: 10, borderRadius: 999 }} />
              </Box>
              {mainChecklistAlerts && (
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
                  <Kpi label="Itens atrasados" value={String(mainChecklistAlerts.overdue)} helper="Prazo vencido" />
                  <Kpi label="Itens bloqueados" value={String(mainChecklistAlerts.blocked)} helper="Exigem destrave" />
                  <Kpi label="Sem responsavel" value={String(mainChecklistAlerts.unassigned)} helper="Atribuicao pendente" />
                  <Kpi label="Foto pendente" value={String(mainChecklistAlerts.pendingPhotos)} helper="Evidencia obrigatoria" />
                </Box>
              )}
              <Button component={Link} href={`/ordens-servico/${mainOrder.id}`} variant="contained" endIcon={<ArrowForwardRoundedIcon />} sx={{ alignSelf: "flex-start" }}>
                Continuar execucao
              </Button>
            </Stack>
          </Paper>
        ) : (
          <Paper variant="outlined" sx={{ p: 4, borderRadius: 2, textAlign: "center" }}>
            <Typography variant="h6">Nenhum servico atribuido</Typography>
            <Typography color="text.secondary">Quando uma OS for designada a voce, ela aparecera aqui.</Typography>
          </Paper>
        )}

        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Outros servicos atribuidos
          </Typography>
          <Stack spacing={1.5}>
            {sortedAssignedOrders
              .filter((order) => order.id !== mainOrder?.id)
              .map((order) => (
                <Box key={order.id} sx={{ p: 1.6, borderRadius: 2, bgcolor: "background.default", border: 1, borderColor: "divider" }}>
                  <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={900}>{order.title}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {order.customerName} - {formatDateTime(order.scheduledStart)}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <StatusChip value={order.status} />
                      <Button component={Link} href={`/ordens-servico/${order.id}`} size="small">
                        Abrir
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              ))}
          </Stack>
        </Paper>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2} alignItems={{ md: "flex-end" }}>
        <Box>
          <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 36 }, mb: 0.8 }}>
            Painel operacional
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 820 }}>
            Visao executiva do funil, agenda, equipes, qualidade e financeiro para decidir o dia de trabalho sem ruído.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label={data.sourceLabel} color="primary" variant="outlined" />
          <Button component={Link} href="/apresentacao" variant="contained" endIcon={<ArrowForwardRoundedIcon />}>
            Ver apresentacao
          </Button>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
          <Box>
            <Typography variant="h6">{roleSummary.title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {roleSummary.description}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {roleSummary.chips.map((chip) => (
              <Chip key={chip} label={chip} color="primary" variant="outlined" />
            ))}
          </Stack>
        </Stack>
      </Paper>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" },
          gap: 2,
        }}
      >
        {data.metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </Box>

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h6">Atencao necessaria</Typography>
            <Typography variant="body2" color="text.secondary">
              Pontos que impedem a operacao de fechar ciclo: prazo, comercial, equipe e estoque.
            </Typography>
          </Box>
          <Chip icon={<WarningAmberRoundedIcon />} color="warning" label="Prioridades do dia" />
        </Stack>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
          {data.attentionItems.map((item) => (
            <AttentionCard key={item.title} item={item} />
          ))}
        </Box>
      </Paper>

      {(user?.role === "OWNER" || user?.role === "GERENTE") && (
        <SiteContentManager beforeAfters={siteBeforeAfters} testimonials={siteTestimonials} />
      )}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "1.15fr 0.85fr" }, gap: 2 }}>
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 2, sm: 2.5 },
            borderRadius: 2,
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
            gap: 2.5,
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Proximas execucoes
            </Typography>
            <Stack spacing={1.5}>
              {data.nextOrders.map((order) => (
                <Box key={order.id} sx={{ p: 1.6, borderRadius: 2, bgcolor: "background.default", border: 1, borderColor: "divider" }}>
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <ConstructionRoundedIcon color={order.status === "IN_PROGRESS" ? "info" : "primary"} />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <Typography fontWeight={900} noWrap>
                          {order.title}
                        </Typography>
                        <StatusChip value={order.status} />
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {order.customerName} - {formatDateTime(order.scheduledStart)}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Resultado previsto
            </Typography>
            <Stack spacing={2}>
              {data.financialOrders.map((order) => {
                const profit = order.revenue - order.expenses;
                const margin = Math.round((profit / order.revenue) * 100);

                return (
                  <Box key={order.id}>
                    <Stack direction="row" justifyContent="space-between" gap={1}>
                      <Typography variant="body2" fontWeight={850} noWrap>
                        {order.customerName}
                      </Typography>
                      <Typography variant="body2" color="success.main" fontWeight={900}>
                        {formatCurrency(profit)}
                      </Typography>
                    </Stack>
                    <LinearProgress value={margin} variant="determinate" sx={{ mt: 0.8, height: 8, borderRadius: 999 }} />
                    <Typography variant="caption" color="text.secondary">
                      Margem de {margin}% sobre {formatCurrency(order.revenue)}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Melhores avaliados
          </Typography>
          <Stack spacing={1.5}>
            {data.topEmployees.map((employee, index) => (
              <Stack key={employee.id} direction="row" spacing={1.5} alignItems="center">
                <Avatar sx={{ bgcolor: index < 2 ? "success.main" : "primary.main" }}>{employee.name.slice(0, 1)}</Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography fontWeight={900} noWrap>
                    {employee.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {employee.specialty}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.4} alignItems="center">
                  <StarRoundedIcon color="secondary" fontSize="small" />
                  <Typography fontWeight={900}>{employee.averageRating.toFixed(1)}</Typography>
                </Stack>
              </Stack>
            ))}
          </Stack>
          <Divider sx={{ my: 2 }} />
          <Button component={Link} href="/colaboradores" fullWidth variant="outlined" endIcon={<ArrowForwardRoundedIcon />}>
            Abrir gestao da equipe
          </Button>
        </Paper>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
        <BarPanel
          title="Faturamento por mes"
          data={data.revenueByMonth}
          suffix="k"
          emptyMessage="Sem faturamento registrado ainda. Ao criar uma OS com valor fechado, o grafico passa a mostrar o total por mes."
        />
        <BarPanel
          title="Servicos por status"
          data={data.servicesByStatus}
          emptyMessage="Sem ordens de servico cadastradas ainda. Os status aparecem conforme a simulacao avancar."
        />
        <BarPanel
          title="Avaliacao media por criterio"
          data={data.averageRatings.slice(0, 5)}
          emptyMessage="Sem avaliacoes registradas ainda. Quando a equipe for avaliada, as medias por criterio aparecem aqui."
        />
      </Box>

      <BarPanel
        title="Servicos mais executados"
        data={data.mostExecutedServices}
        emptyMessage="Sem servicos cadastrados ainda. Os tipos mais executados aparecem automaticamente a partir das OS criadas."
      />
    </Stack>
  );
}
