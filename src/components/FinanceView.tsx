"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  LinearProgress,
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
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import SavingsRoundedIcon from "@mui/icons-material/SavingsRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";

import { formatCurrency, formatDateTime, normalizeText } from "@/lib/format";
import { labelFor } from "@/lib/labels";
import type { Employee, ServiceExpense, ServiceExpenseCategory, ServiceOrder } from "@/lib/types";
import { StatusChip } from "./StatusChip";

function parseMoneyInput(value: string) {
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : NaN;
}

function marginFor(revenue: number, expenses: number) {
  if (revenue <= 0) return 0;
  return Math.round(((revenue - expenses) / revenue) * 100);
}

const expenseCategories: ServiceExpenseCategory[] = ["GASOLINA", "ALMOCO", "MATERIAL_OU_PRODUTO", "OUTROS"];

function FinanceKpi({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: "primary" | "success" | "warning";
}) {
  const Icon = tone === "success" ? TrendingUpRoundedIcon : tone === "warning" ? SavingsRoundedIcon : PaymentsRoundedIcon;
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.2,
        borderRadius: 3,
        bgcolor: tone === "success" ? "rgba(46, 125, 50, 0.08)" : tone === "warning" ? "rgba(237, 108, 2, 0.08)" : "background.paper",
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
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
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1.3 }}>
        {helper}
      </Typography>
    </Paper>
  );
}

export function FinanceView({
  initialOrders,
  employees,
  initialExpenses,
}: {
  initialOrders: ServiceOrder[];
  employees: Employee[];
  initialExpenses: ServiceExpense[];
}) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [orders, setOrders] = useState(initialOrders);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [query, setQuery] = useState("");
  const [editingOrder, setEditingOrder] = useState<ServiceOrder | null>(null);
  const [revenueInput, setRevenueInput] = useState("0");
  const [expensesInput, setExpensesInput] = useState("0");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const expenseAttempt = useRef<{key:string; payload:string}|null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [expenseServiceOrderId, setExpenseServiceOrderId] = useState(initialOrders[0]?.id ?? "");
  const [expenseEmployeeId, setExpenseEmployeeId] = useState(employees[0]?.id ?? "");
  const [expenseCategory, setExpenseCategory] = useState<ServiceExpenseCategory>("GASOLINA");
  const [expenseAmountInput, setExpenseAmountInput] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expenseError, setExpenseError] = useState("");

  const filteredOrders = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    return orders.filter((order) => {
      if (!normalizedQuery) return true;
      return [order.title, order.customerName, order.address, order.status]
        .some((value) => normalizeText(String(value ?? "")).includes(normalizedQuery));
    });
  }, [orders, query]);

  const totals = useMemo(() => {
    const revenue = orders.reduce((sum, order) => sum + order.revenue, 0);
    const expenses = orders.reduce((sum, order) => sum + order.expenses, 0);
    const profit = revenue - expenses;
    return { revenue, expenses, profit, margin: marginFor(revenue, expenses) };
  }, [orders]);

  const orderById = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);
  const recentExpenses = useMemo(() => expenses.slice(0, 8), [expenses]);
  const selectedExpenseOrder = orderById.get(expenseServiceOrderId);
  const expenseAmount = parseMoneyInput(expenseAmountInput);
  const expensePreviewValue = Number.isFinite(expenseAmount) && expenseAmount > 0 ? expenseAmount : 0;
  const editingRevenue = parseMoneyInput(revenueInput);
  const editingExpenses = parseMoneyInput(expensesInput);
  const editingProfit = Number.isFinite(editingRevenue) && Number.isFinite(editingExpenses) ? editingRevenue - editingExpenses : 0;
  const editingMargin = Number.isFinite(editingRevenue) && Number.isFinite(editingExpenses) ? marginFor(editingRevenue, editingExpenses) : 0;

  function openEditor(order: ServiceOrder) {
    setEditingOrder(order);
    setAdjustmentReason("");
    setRevenueInput(String(order.revenue));
    setExpensesInput(String(order.expenses));
    setError("");
    setNotice("");
  }

  function openExpenseDialog() {
    setExpenseDialogOpen(true);
    setExpenseServiceOrderId((current) => current || (orders[0]?.id ?? ""));
    setExpenseEmployeeId((current) => current || (employees[0]?.id ?? ""));
    setExpenseError("");
    setNotice("");
  }

  async function saveFinancials() {
    if (!editingOrder) return;

    const revenue = parseMoneyInput(revenueInput);
    const expenses = parseMoneyInput(expensesInput);
    if (!Number.isFinite(revenue) || revenue < 0 || !Number.isFinite(expenses) || expenses < 0) {
      setError("Informe valores positivos para total e custo.");
      return;
    }

    if (adjustmentReason.trim().length < 5) { setError("Informe o motivo do ajuste (minimo 5 caracteres)."); return; }
    setSaving(true);
    setError("");
    try {
    const response = await fetch(`/api/service-orders/${editingOrder.id}/financials`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revenue, expenses, reason: adjustmentReason.trim() }),
    });
    const data = await response.json().catch(() => null);
    setSaving(false);

    if (!response.ok) {
      setError(data?.message ?? "Nao foi possivel atualizar os valores financeiros.");
      return;
    }

    const updatedOrder = data.serviceOrder as ServiceOrder;
    setOrders((current) => current.map((order) => (order.id === updatedOrder.id ? updatedOrder : order)));
    setEditingOrder(updatedOrder);
    setRevenueInput(String(updatedOrder.revenue));
    setExpensesInput(String(updatedOrder.expenses));
    setNotice("Valores financeiros atualizados com sucesso.");
    setAdjustmentReason("");
    } catch { setError("Falha de comunicacao. Confira os valores antes de reenviar."); } finally { setSaving(false); }
  }

  async function saveExpense() {
    const amount = parseMoneyInput(expenseAmountInput);
    if (!expenseServiceOrderId) {
      setExpenseError("Selecione a ordem de servico.");
      return;
    }
    if (!expenseEmployeeId) {
      setExpenseError("Selecione o colaborador que pediu o gasto.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setExpenseError("Informe um valor maior que zero.");
      return;
    }

    const payload = { serviceOrderId:expenseServiceOrderId,employeeId:expenseEmployeeId,category:expenseCategory,amount,notes:expenseNotes };
    const fingerprint=JSON.stringify(payload);
    if (expenseAttempt.current?.payload!==fingerprint) expenseAttempt.current={key:crypto.randomUUID(),payload:fingerprint};
    setExpenseSaving(true);
    setExpenseError("");
    try {
    const response = await fetch("/api/finance/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({...payload,requestId:expenseAttempt.current.key}),
    });
    const data = await response.json().catch(() => null);
    setExpenseSaving(false);

    if (!response.ok) {
      setExpenseError(data?.message ?? "Nao foi possivel registrar o gasto.");
      return;
    }

    const updatedOrder = data.serviceOrder as ServiceOrder;
    const expense = data.expense as ServiceExpense;
    setOrders((current) => current.map((order) => (order.id === updatedOrder.id ? updatedOrder : order)));
    expenseAttempt.current=null;
    setExpenses((current) => [expense, ...current.filter(e=>e.id!==expense.id)]);
    setExpenseDialogOpen(false);
    setExpenseAmountInput("");
    setExpenseNotes("");
    setNotice("Gasto registrado e custo da OS atualizado.");
    } catch { setExpenseError("Falha de conexao. Reenvie os mesmos dados para consultar ou concluir o lancamento."); } finally { setExpenseSaving(false); }
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "flex-end" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 34 }, mb: 0.8 }}>
            Financeiro
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 860 }}>
            Atualize total contratado, custo da obra e acompanhe lucro calculado por ordem de servico.
          </Typography>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
          <Chip color="success" icon={<PaymentsRoundedIcon />} label="Acesso financeiro liberado" variant="outlined" />
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={openExpenseDialog}
            disabled={orders.length === 0 || employees.length === 0}
          >
            Adicionar gasto
          </Button>
        </Stack>
      </Stack>

      {notice && <Alert severity="success">{notice}</Alert>}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
        <FinanceKpi label="Total contratado" value={formatCurrency(totals.revenue)} helper={`${orders.length} ordens com controle financeiro`} tone="primary" />
        <FinanceKpi label="Custo atualizado" value={formatCurrency(totals.expenses)} helper="Custos registrados nas OS" tone="warning" />
        <FinanceKpi label="Lucro estimado" value={formatCurrency(totals.profit)} helper="Calculado automaticamente" tone="success" />
        <FinanceKpi label="Margem geral" value={`${totals.margin}%`} helper="Lucro dividido pelo total contratado" tone="success" />
      </Box>

      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 3 }}>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} alignItems={{ lg: "center" }}>
          <TextField
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar OS, cliente, endereco ou status"
            fullWidth
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <Chip label={`${filteredOrders.length} registros`} sx={{ alignSelf: { xs: "flex-start", lg: "center" } }} />
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 1.8, md: 2.4 }, borderRadius: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }} justifyContent="space-between">
          <Box>
            <Typography variant="h6">Gastos registrados</Typography>
            <Typography variant="body2" color="text.secondary">
              Lancamentos que entram automaticamente no custo da ordem de servico.
            </Typography>
          </Box>
          <Chip icon={<ReceiptLongRoundedIcon />} label={`${expenses.length} lancamentos`} variant="outlined" sx={{ alignSelf: { xs: "flex-start", md: "center" } }} />
        </Stack>

        {recentExpenses.length === 0 ? (
          <Box sx={{ mt: 2, p: 2.5, borderRadius: 2, bgcolor: "background.default", textAlign: "center" }}>
            <Typography fontWeight={900}>Nenhum gasto registrado ainda</Typography>
            <Typography variant="body2" color="text.secondary">
              Use o botao Adicionar gasto para registrar gasolina, almoco, material, produto ou outro custo da obra.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ mt: 2, display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 1.4 }}>
            {recentExpenses.map((expense) => {
              const order = orderById.get(expense.serviceOrderId);
              return (
                <Paper key={expense.id} variant="outlined" sx={{ p: 1.7, borderRadius: 2.5, bgcolor: "background.default" }}>
                  <Stack direction="row" spacing={1.5} justifyContent="space-between" alignItems="flex-start">
                    <Box sx={{ minWidth: 0 }}>
                      <Chip size="small" label={labelFor(expense.category)} color={expense.category === "GASOLINA" ? "warning" : "primary"} variant="outlined" />
                      <Typography fontWeight={900} sx={{ mt: 1 }}>
                        {expense.employeeName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {order ? `${order.title} - ${order.customerName}` : "OS nao encontrada"}
                      </Typography>
                    </Box>
                    <Typography color="error.main" fontWeight={950} sx={{ whiteSpace: "nowrap" }}>
                      {formatCurrency(expense.amount)}
                    </Typography>
                  </Stack>
                  {expense.notes && (
                    <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
                      {expense.notes}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                    {formatDateTime(expense.createdAt)}
                  </Typography>
                </Paper>
              );
            })}
          </Box>
        )}
      </Paper>

      {filteredOrders.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 5, textAlign: "center", borderRadius: 3 }}>
          <Typography variant="h6">Nenhuma OS financeira encontrada</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Ajuste a busca para localizar uma ordem de servico.
          </Typography>
        </Paper>
      ) : isDesktop ? (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 900 }}>Ordem de servico</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 900 }} align="right">Total</TableCell>
                <TableCell sx={{ fontWeight: 900 }} align="right">Custo</TableCell>
                <TableCell sx={{ fontWeight: 900 }} align="right">Lucro</TableCell>
                <TableCell sx={{ fontWeight: 900 }} align="right">Margem</TableCell>
                <TableCell align="right" sx={{ fontWeight: 900 }}>Acoes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOrders.map((order) => {
                const profit = order.revenue - order.expenses;
                const margin = marginFor(order.revenue, order.expenses);
                return (
                  <TableRow key={order.id} hover>
                    <TableCell>
                      <Typography fontWeight={900}>{order.title}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {order.customerName} - {formatDateTime(order.scheduledStart)}
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
                    <TableCell align="right">{margin}%</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button size="small" variant="outlined" startIcon={<EditRoundedIcon />} onClick={() => openEditor(order)}>
                          Editar
                        </Button>
                        <Button component={Link} href={`/ordens-servico/${order.id}`} size="small" endIcon={<ArrowForwardRoundedIcon />}>
                          OS
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Stack spacing={1.5}>
          {filteredOrders.map((order) => {
            const profit = order.revenue - order.expenses;
            const margin = marginFor(order.revenue, order.expenses);
            return (
              <Paper key={order.id} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                <Stack spacing={1.4}>
                  <Stack direction="row" justifyContent="space-between" gap={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={900}>{order.title}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {order.customerName}
                      </Typography>
                    </Box>
                    <StatusChip value={order.status} />
                  </Stack>
                  <Divider />
                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.2 }}>
                    <Info label="Total" value={formatCurrency(order.revenue)} />
                    <Info label="Custo" value={formatCurrency(order.expenses)} />
                    <Info label="Lucro" value={formatCurrency(profit)} />
                    <Info label="Margem" value={`${margin}%`} />
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Button fullWidth variant="contained" startIcon={<EditRoundedIcon />} onClick={() => openEditor(order)}>
                      Editar
                    </Button>
                    <Button component={Link} href={`/ordens-servico/${order.id}`} fullWidth variant="outlined">
                      Abrir OS
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}

      <Dialog open={Boolean(editingOrder)} onClose={() => setEditingOrder(null)} fullWidth maxWidth="sm">
        <DialogTitle>Atualizar financeiro da OS</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {editingOrder && (
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "background.default" }}>
                <Typography fontWeight={900}>{editingOrder.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {editingOrder.customerName} - {labelFor(editingOrder.status)}
                </Typography>
              </Paper>
            )}
            {error && <Alert severity="warning">{error}</Alert>}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
              <TextField
                label="Total contratado"
                type="number"
                value={revenueInput}
                onChange={(event) => setRevenueInput(event.target.value)}
                inputProps={{ min: 0, step: "0.01" }}
                fullWidth
              />
              <TextField
                label="Custo total"
                type="number"
                value={expensesInput}
                onChange={(event) => setExpensesInput(event.target.value)}
                inputProps={{ min: 0, step: "0.01" }}
                fullWidth
              />
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Info label="Lucro calculado" value={formatCurrency(editingProfit)} />
              </Paper>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Info label="Margem calculada" value={`${editingMargin}%`} />
              </Paper>
            </Box>
            <TextField label="Motivo do ajuste" required multiline value={adjustmentReason} onChange={e => setAdjustmentReason(e.target.value)} inputProps={{ minLength: 5, maxLength: 1000 }} />
            {saving && <LinearProgress sx={{ height: 7, borderRadius: 999 }} />}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingOrder(null)}>Fechar</Button>
          <Button variant="contained" onClick={saveFinancials} disabled={saving || adjustmentReason.trim().length < 5}>
            Salvar valores
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={expenseDialogOpen} onClose={() => !expenseSaving && setExpenseDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Registrar gasto da obra</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {expenseError && <Alert severity="warning">{expenseError}</Alert>}
            <TextField
              select
              label="Servico / OS"
              value={expenseServiceOrderId}
              onChange={(event) => setExpenseServiceOrderId(event.target.value)}
              fullWidth
            >
              {orders.map((order) => (
                <MenuItem key={order.id} value={order.id}>
                  {order.title} - {order.customerName}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Colaborador que pediu"
              value={expenseEmployeeId}
              onChange={(event) => setExpenseEmployeeId(event.target.value)}
              fullWidth
            >
              {employees.map((employee) => (
                <MenuItem key={employee.id} value={employee.id}>
                  {employee.name} - {employee.roleName}
                </MenuItem>
              ))}
            </TextField>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
              <TextField
                select
                label="Tipo do gasto"
                value={expenseCategory}
                onChange={(event) => setExpenseCategory(event.target.value as ServiceExpenseCategory)}
                fullWidth
              >
                {expenseCategories.map((category) => (
                  <MenuItem key={category} value={category}>
                    {labelFor(category)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Valor do gasto"
                type="number"
                value={expenseAmountInput}
                onChange={(event) => setExpenseAmountInput(event.target.value)}
                inputProps={{ min: 0, step: "0.01" }}
                fullWidth
              />
            </Box>
            <TextField
              label="Observacao opcional"
              value={expenseNotes}
              onChange={(event) => setExpenseNotes(event.target.value)}
              multiline
              minRows={3}
              fullWidth
            />
            {selectedExpenseOrder && (
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "background.default" }}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} divider={<Divider flexItem orientation={isDesktop ? "vertical" : "horizontal"} />}>
                  <Info label="Custo atual" value={formatCurrency(selectedExpenseOrder.expenses)} />
                  <Info label="Novo custo" value={formatCurrency(selectedExpenseOrder.expenses + expensePreviewValue)} />
                  <Info label="Lucro apos gasto" value={formatCurrency(selectedExpenseOrder.revenue - selectedExpenseOrder.expenses - expensePreviewValue)} />
                </Stack>
              </Paper>
            )}
            {expenseSaving && <LinearProgress sx={{ height: 7, borderRadius: 999 }} />}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExpenseDialogOpen(false)} disabled={expenseSaving}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={saveExpense} disabled={expenseSaving || !expenseServiceOrderId || !expenseEmployeeId}>
            Registrar gasto
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography fontWeight={900} sx={{ wordBreak: "break-word" }}>
        {value}
      </Typography>
    </Box>
  );
}
