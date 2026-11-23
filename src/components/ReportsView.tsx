"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PaidRoundedIcon from "@mui/icons-material/PaidRounded";
import PendingActionsRoundedIcon from "@mui/icons-material/PendingActionsRounded";
import PhotoCameraRoundedIcon from "@mui/icons-material/PhotoCameraRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";

import { formatCurrency, formatDate, normalizeText } from "@/lib/format";
import { labelFor } from "@/lib/labels";
import type {
  Employee,
  ServiceExpense,
  ServiceOrder,
  ServiceOrderChecklistItem,
  ServiceOrderChecklistPhoto,
  SessionUser,
} from "@/lib/types";
import { StatusChip } from "./StatusChip";

type ReportKind = "IN_PROGRESS" | "FINISHED" | "FINANCIAL";

const activeStatuses = ["SCHEDULED", "PREPARING", "IN_PROGRESS", "PAUSED", "WAITING_CUSTOMER"] as const;
const finishedStatuses = ["DONE", "DELIVERED"] as const;

function marginFor(revenue: number, expenses: number) {
  if (revenue <= 0) return 0;
  return Math.round(((revenue - expenses) / revenue) * 100);
}

function daysBetween(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
  return Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));
}

function isOverdue(order: ServiceOrder) {
  return activeStatuses.includes(order.status as (typeof activeStatuses)[number]) && new Date(order.scheduledEnd).getTime() < Date.now();
}

function ReportKpi({
  label,
  value,
  helper,
  tone = "primary",
}: {
  label: string;
  value: string;
  helper: string;
  tone?: "primary" | "success" | "warning" | "error";
}) {
  const Icon =
    tone === "success"
      ? CheckCircleRoundedIcon
      : tone === "warning"
        ? WarningAmberRoundedIcon
        : tone === "error"
          ? WarningAmberRoundedIcon
          : AssessmentRoundedIcon;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 3,
        bgcolor:
          tone === "success"
            ? "rgba(46, 125, 50, 0.08)"
            : tone === "warning"
              ? "rgba(237, 108, 2, 0.08)"
              : tone === "error"
                ? "rgba(211, 47, 47, 0.08)"
                : "background.paper",
      }}
    >
      <Stack direction="row" spacing={1.4} alignItems="center">
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: 2,
            display: "grid",
            placeItems: "center",
            bgcolor: `${tone}.main`,
            color: `${tone}.contrastText`,
          }}
        >
          <Icon fontSize="small" />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary" fontWeight={850}>
            {label}
          </Typography>
          <Typography variant="h5" noWrap>
            {value}
          </Typography>
        </Box>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1.2 }}>
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
      <Typography fontWeight={900} noWrap>
        {value}
      </Typography>
    </Box>
  );
}

function EmptyReport({ title, description }: { title: string; description: string }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 3, md: 5 }, textAlign: "center", borderRadius: 3 }}>
      <AssessmentRoundedIcon sx={{ fontSize: 42, color: "text.secondary", mb: 1 }} />
      <Typography variant="h6">{title}</Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5 }}>
        {description}
      </Typography>
    </Paper>
  );
}

export function ReportsView({
  user,
  serviceOrders,
  employees,
  checklistItems,
  checklistPhotos,
  expenses,
  canViewOperations,
  canViewFinancials,
}: {
  user: SessionUser;
  serviceOrders: ServiceOrder[];
  employees: Employee[];
  checklistItems: ServiceOrderChecklistItem[];
  checklistPhotos: ServiceOrderChecklistPhoto[];
  expenses: ServiceExpense[];
  canViewOperations: boolean;
  canViewFinancials: boolean;
}) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [reportKind, setReportKind] = useState<ReportKind>(canViewOperations ? "IN_PROGRESS" : "FINANCIAL");
  const [query, setQuery] = useState("");

  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const checklistByOrder = useMemo(() => {
    const map = new Map<string, ServiceOrderChecklistItem[]>();
    checklistItems.forEach((item) => {
      const items = map.get(item.serviceOrderId) ?? [];
      items.push(item);
      map.set(item.serviceOrderId, items);
    });
    return map;
  }, [checklistItems]);
  const photosByOrder = useMemo(() => {
    const map = new Map<string, number>();
    checklistPhotos.forEach((photo) => map.set(photo.serviceOrderId, (map.get(photo.serviceOrderId) ?? 0) + 1));
    return map;
  }, [checklistPhotos]);

  const activeOrders = useMemo(
    () => serviceOrders.filter((order) => activeStatuses.includes(order.status as (typeof activeStatuses)[number])),
    [serviceOrders],
  );
  const finishedOrders = useMemo(
    () => serviceOrders.filter((order) => finishedStatuses.includes(order.status as (typeof finishedStatuses)[number])),
    [serviceOrders],
  );

  const filteredActiveOrders = useMemo(() => filterOrders(activeOrders, query), [activeOrders, query]);
  const filteredFinishedOrders = useMemo(() => filterOrders(finishedOrders, query), [finishedOrders, query]);
  const filteredFinancialOrders = useMemo(() => filterOrders(serviceOrders, query), [serviceOrders, query]);

  const activeStats = useMemo(() => {
    const overdue = activeOrders.filter(isOverdue).length;
    const pendingChecklist = activeOrders.reduce((total, order) => {
      const items = checklistByOrder.get(order.id) ?? [];
      return total + items.filter((item) => item.status !== "DONE").length;
    }, 0);
    const supervisors = new Set(activeOrders.map((order) => order.supervisorEmployeeId).filter(Boolean)).size;
    return { overdue, pendingChecklist, supervisors };
  }, [activeOrders, checklistByOrder]);

  const finishedStats = useMemo(() => {
    const delivered = finishedOrders.filter((order) => order.status === "DELIVERED").length;
    const averageDays =
      finishedOrders.length === 0
        ? 0
        : Math.round(finishedOrders.reduce((total, order) => total + daysBetween(order.scheduledStart, order.scheduledEnd), 0) / finishedOrders.length);
    const photos = finishedOrders.reduce((total, order) => total + (photosByOrder.get(order.id) ?? 0), 0);
    return { delivered, averageDays, photos };
  }, [finishedOrders, photosByOrder]);

  const financialStats = useMemo(() => {
    const revenue = serviceOrders.reduce((sum, order) => sum + order.revenue, 0);
    const costs = serviceOrders.reduce((sum, order) => sum + order.expenses, 0);
    const profit = revenue - costs;
    const byCategory = expenses.reduce<Record<string, number>>((acc, expense) => {
      acc[expense.category] = (acc[expense.category] ?? 0) + expense.amount;
      return acc;
    }, {});
    return { revenue, costs, profit, margin: marginFor(revenue, costs), byCategory };
  }, [expenses, serviceOrders]);

  const currentOrders =
    reportKind === "FINISHED" ? filteredFinishedOrders : reportKind === "IN_PROGRESS" ? filteredActiveOrders : filteredFinancialOrders;

  const reportOptions = [
    ...(canViewOperations
      ? [
          { value: "IN_PROGRESS" as ReportKind, label: "Em andamento", icon: <PendingActionsRoundedIcon fontSize="small" /> },
          { value: "FINISHED" as ReportKind, label: "Finalizados", icon: <CheckCircleRoundedIcon fontSize="small" /> },
        ]
      : []),
    { value: "FINANCIAL" as ReportKind, label: canViewFinancials ? "Financeiro" : "Financeiro restrito", icon: canViewFinancials ? <PaidRoundedIcon fontSize="small" /> : <LockRoundedIcon fontSize="small" /> },
  ];

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "flex-end" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <AssessmentRoundedIcon color="primary" />
            <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 34 } }}>
              Relatorios
            </Typography>
          </Stack>
          <Typography color="text.secondary" sx={{ maxWidth: 860 }}>
            Acompanhe servicos em andamento, obras finalizadas e indicadores financeiros com a visao permitida para o seu perfil.
          </Typography>
        </Box>
        <Chip label={`${user.name} - ${labelFor(user.role)}`} color="primary" variant="outlined" sx={{ alignSelf: { xs: "flex-start", md: "center" } }} />
      </Stack>

      <Paper variant="outlined" sx={{ p: { xs: 1.3, md: 1.6 }, borderRadius: 3 }}>
        {isDesktop ? (
          <Tabs value={reportKind} onChange={(_, value) => setReportKind(value)} variant="scrollable" scrollButtons="auto">
            {reportOptions.map((option) => (
              <Tab
                key={option.value}
                value={option.value}
                icon={option.icon}
                iconPosition="start"
                label={option.label}
                sx={{ minHeight: 48, fontWeight: 900 }}
              />
            ))}
          </Tabs>
        ) : (
          <TextField
            select
            label="Tipo de relatorio"
            value={reportKind}
            onChange={(event) => setReportKind(event.target.value as ReportKind)}
            fullWidth
            size="small"
          >
            {reportOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        )}
      </Paper>

      {reportKind === "FINANCIAL" && !canViewFinancials ? (
        <Alert severity="info" icon={<LockRoundedIcon />}>
          Relatorio financeiro restrito. Apenas dono, perfil financeiro e gerente liberado pelo dono podem ver total, custo, lucro e margem.
        </Alert>
      ) : (
        <>
          {reportKind === "IN_PROGRESS" && (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
              <ReportKpi label="Servicos em andamento" value={String(activeOrders.length)} helper="OS ainda nao finalizadas" />
              <ReportKpi label="Atrasados" value={String(activeStats.overdue)} helper="Prazo vencido e OS aberta" tone={activeStats.overdue > 0 ? "warning" : "success"} />
              <ReportKpi label="Checklist pendente" value={String(activeStats.pendingChecklist)} helper="Itens ainda nao concluidos" tone="warning" />
              <ReportKpi label="Supervisores envolvidos" value={String(activeStats.supervisors)} helper="Responsaveis pelas obras ativas" tone="success" />
            </Box>
          )}

          {reportKind === "FINISHED" && (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
              <ReportKpi label="Servicos finalizados" value={String(finishedOrders.length)} helper="OS concluidas ou entregues" tone="success" />
              <ReportKpi label="Entregues ao cliente" value={String(finishedStats.delivered)} helper="Servico com status entregue" tone="success" />
              <ReportKpi label="Prazo medio" value={`${finishedStats.averageDays} dia(s)`} helper="Entre inicio e termino previsto" />
              <ReportKpi label="Fotos registradas" value={String(finishedStats.photos)} helper="Evidencias anexadas ao checklist" />
            </Box>
          )}

          {reportKind === "FINANCIAL" && (
            <Stack spacing={2}>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
                <ReportKpi label="Total contratado" value={formatCurrency(financialStats.revenue)} helper={`${serviceOrders.length} ordens no relatorio`} />
                <ReportKpi label="Custo total" value={formatCurrency(financialStats.costs)} helper="Custos atualizados nas OS" tone="warning" />
                <ReportKpi label="Lucro estimado" value={formatCurrency(financialStats.profit)} helper="Total menos custo" tone={financialStats.profit >= 0 ? "success" : "error"} />
                <ReportKpi label="Margem geral" value={`${financialStats.margin}%`} helper="Lucro sobre o total contratado" tone="success" />
              </Box>

              <Paper variant="outlined" sx={{ p: { xs: 1.8, md: 2.2 }, borderRadius: 3 }}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} alignItems={{ md: "center" }} justifyContent="space-between">
                  <Box>
                    <Typography variant="h6">Gastos por categoria</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Lancamentos registrados no financeiro das ordens de servico.
                    </Typography>
                  </Box>
                  <Chip icon={<PaidRoundedIcon />} label={`${expenses.length} lancamento(s)`} variant="outlined" sx={{ alignSelf: { xs: "flex-start", md: "center" } }} />
                </Stack>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 2 }}>
                  {Object.keys(financialStats.byCategory).length === 0 ? (
                    <Chip label="Sem gastos categorizados" />
                  ) : (
                    Object.entries(financialStats.byCategory).map(([category, amount]) => (
                      <Chip key={category} label={`${labelFor(category)}: ${formatCurrency(amount)}`} color="primary" variant="outlined" />
                    ))
                  )}
                </Stack>
              </Paper>
            </Stack>
          )}

          <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 3 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }} justifyContent="space-between">
              <TextField
                label="Buscar no relatorio"
                placeholder="Cliente, servico, local ou status"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                fullWidth
                size="small"
              />
              <Chip label={`${currentOrders.length} registro(s)`} sx={{ alignSelf: { xs: "flex-start", md: "center" } }} />
            </Stack>
          </Paper>

          {currentOrders.length === 0 ? (
            <EmptyReport title="Nenhum registro encontrado" description="Ajuste a busca ou cadastre ordens de servico para gerar este relatorio." />
          ) : reportKind === "FINANCIAL" ? (
            <FinancialOrdersTable orders={currentOrders} isDesktop={isDesktop} />
          ) : (
            <OperationalOrdersTable
              orders={currentOrders}
              isDesktop={isDesktop}
              employeeById={employeeById}
              checklistByOrder={checklistByOrder}
              photosByOrder={photosByOrder}
            />
          )}
        </>
      )}
    </Stack>
  );
}

function filterOrders(orders: ServiceOrder[], query: string) {
  const normalized = normalizeText(query);
  if (!normalized) return orders;
  return orders.filter((order) =>
    [order.title, order.customerName, order.address, order.status, order.serviceType]
      .some((value) => normalizeText(String(value ?? "")).includes(normalized)),
  );
}

function checklistProgress(order: ServiceOrder, checklistByOrder: Map<string, ServiceOrderChecklistItem[]>) {
  const items = checklistByOrder.get(order.id) ?? [];
  const done = items.filter((item) => item.status === "DONE").length;
  const percent = items.length === 0 ? 0 : Math.round((done / items.length) * 100);
  return { done, total: items.length, percent };
}

function OperationalOrdersTable({
  orders,
  isDesktop,
  employeeById,
  checklistByOrder,
  photosByOrder,
}: {
  orders: ServiceOrder[];
  isDesktop: boolean;
  employeeById: Map<string, Employee>;
  checklistByOrder: Map<string, ServiceOrderChecklistItem[]>;
  photosByOrder: Map<string, number>;
}) {
  if (!isDesktop) {
    return (
      <Stack spacing={1.5}>
        {orders.map((order) => {
          const progress = checklistProgress(order, checklistByOrder);
          const supervisor = order.supervisorEmployeeId ? employeeById.get(order.supervisorEmployeeId) : undefined;
          return (
            <Paper key={order.id} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
              <Stack spacing={1.3}>
                <Stack direction="row" justifyContent="space-between" gap={1} alignItems="flex-start">
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={950}>{order.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {order.customerName}
                    </Typography>
                  </Box>
                  <StatusChip value={order.status} />
                </Stack>
                <Divider />
                <Info label="Supervisor" value={supervisor?.name ?? "Sem supervisor"} />
                <Info label="Data" value={`${formatDate(order.scheduledStart)} - ${formatDate(order.scheduledEnd)}`} />
                <Info label="Local" value={order.address || "Sem local"} />
                <Stack spacing={0.6}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">
                      Checklist
                    </Typography>
                    <Typography variant="caption" fontWeight={900}>
                      {progress.done}/{progress.total}
                    </Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={progress.percent} sx={{ height: 7, borderRadius: 99 }} />
                </Stack>
                <Button component={Link} href={`/ordens-servico/${order.id}`} variant="contained" endIcon={<ArrowForwardRoundedIcon />}>
                  Abrir OS
                </Button>
              </Stack>
            </Paper>
          );
        })}
      </Stack>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 900 }}>Servico</TableCell>
            <TableCell sx={{ fontWeight: 900 }}>Supervisor</TableCell>
            <TableCell sx={{ fontWeight: 900 }}>Prazo</TableCell>
            <TableCell sx={{ fontWeight: 900 }}>Checklist</TableCell>
            <TableCell sx={{ fontWeight: 900 }}>Fotos</TableCell>
            <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
            <TableCell align="right" sx={{ fontWeight: 900 }}>Acao</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {orders.map((order) => {
            const progress = checklistProgress(order, checklistByOrder);
            const supervisor = order.supervisorEmployeeId ? employeeById.get(order.supervisorEmployeeId) : undefined;
            return (
              <TableRow key={order.id} hover>
                <TableCell>
                  <Typography fontWeight={900}>{order.title}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {order.customerName} - {order.address}
                  </Typography>
                </TableCell>
                <TableCell>{supervisor?.name ?? "Sem supervisor"}</TableCell>
                <TableCell>
                  {formatDate(order.scheduledStart)}
                  <Typography variant="body2" color="text.secondary">
                    ate {formatDate(order.scheduledEnd)}
                  </Typography>
                </TableCell>
                <TableCell sx={{ minWidth: 160 }}>
                  <Stack spacing={0.5}>
                    <Typography variant="caption" fontWeight={900}>
                      {progress.done}/{progress.total} itens
                    </Typography>
                    <LinearProgress variant="determinate" value={progress.percent} sx={{ height: 7, borderRadius: 99 }} />
                  </Stack>
                </TableCell>
                <TableCell>
                  <Chip icon={<PhotoCameraRoundedIcon />} label={photosByOrder.get(order.id) ?? 0} variant="outlined" size="small" />
                </TableCell>
                <TableCell><StatusChip value={order.status} /></TableCell>
                <TableCell align="right">
                  <Button component={Link} href={`/ordens-servico/${order.id}`} size="small" endIcon={<ArrowForwardRoundedIcon />}>
                    Abrir
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function FinancialOrdersTable({ orders, isDesktop }: { orders: ServiceOrder[]; isDesktop: boolean }) {
  if (!isDesktop) {
    return (
      <Stack spacing={1.5}>
        {orders.map((order) => {
          const profit = order.revenue - order.expenses;
          return (
            <Paper key={order.id} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
              <Stack spacing={1.3}>
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={950}>{order.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {order.customerName}
                    </Typography>
                  </Box>
                  <StatusChip value={order.status} />
                </Stack>
                <Divider />
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.1 }}>
                  <Info label="Total" value={formatCurrency(order.revenue)} />
                  <Info label="Custo" value={formatCurrency(order.expenses)} />
                  <Info label="Lucro" value={formatCurrency(profit)} />
                  <Info label="Margem" value={`${marginFor(order.revenue, order.expenses)}%`} />
                </Box>
                <Button component={Link} href={`/ordens-servico/${order.id}`} variant="contained" endIcon={<ArrowForwardRoundedIcon />}>
                  Abrir OS
                </Button>
              </Stack>
            </Paper>
          );
        })}
      </Stack>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 900 }}>Ordem</TableCell>
            <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
            <TableCell align="right" sx={{ fontWeight: 900 }}>Total</TableCell>
            <TableCell align="right" sx={{ fontWeight: 900 }}>Custo</TableCell>
            <TableCell align="right" sx={{ fontWeight: 900 }}>Lucro</TableCell>
            <TableCell align="right" sx={{ fontWeight: 900 }}>Margem</TableCell>
            <TableCell align="right" sx={{ fontWeight: 900 }}>Acao</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {orders.map((order) => {
            const profit = order.revenue - order.expenses;
            return (
              <TableRow key={order.id} hover>
                <TableCell>
                  <Typography fontWeight={900}>{order.title}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {order.customerName} - {formatDate(order.scheduledStart)}
                  </Typography>
                </TableCell>
                <TableCell><StatusChip value={order.status} /></TableCell>
                <TableCell align="right">{formatCurrency(order.revenue)}</TableCell>
                <TableCell align="right">{formatCurrency(order.expenses)}</TableCell>
                <TableCell align="right">
                  <Typography color={profit >= 0 ? "success.main" : "error.main"} fontWeight={900}>
                    {formatCurrency(profit)}
                  </Typography>
                </TableCell>
                <TableCell align="right">{marginFor(order.revenue, order.expenses)}%</TableCell>
                <TableCell align="right">
                  <Button component={Link} href={`/ordens-servico/${order.id}`} size="small" endIcon={<ArrowForwardRoundedIcon />}>
                    Abrir
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
