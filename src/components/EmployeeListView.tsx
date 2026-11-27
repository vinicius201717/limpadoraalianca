"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { UserIdentityFields } from "./UserIdentityFields";
import { emptyIdentity, validCpf } from "@/lib/user-identity-schema";
import {
  Avatar,
  Alert,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box,
  Button,
  Chip,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import FormatListBulletedRoundedIcon from "@mui/icons-material/FormatListBulletedRounded";
import LockOpenRoundedIcon from "@mui/icons-material/LockOpenRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import ViewModuleRoundedIcon from "@mui/icons-material/ViewModuleRounded";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";

import { formatDate, normalizeText } from "@/lib/format";
import { labelFor } from "@/lib/labels";
import { canCreateEmployee, canEditEmployee, canPromoteEmployeeToSupervisor, canPromoteSupervisorToManager } from "@/lib/permissions";
import type { Employee, EmployeeStatus, SessionUser } from "@/lib/types";
import { StatusChip } from "./StatusChip";
import { useCurrentUser } from "./useCurrentUser";

const statusOptions: EmployeeStatus[] = ["ACTIVE", "VACATION", "ON_LEAVE", "SUSPENDED", "INACTIVE", "FIRED"];

export function EmployeeListView({ employees, users }: { employees: Employee[]; users: SessionUser[] }) {
  const { user, loading } = useCurrentUser();
  const [localEmployees, setLocalEmployees] = useState(employees);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [promotedIds, setPromotedIds] = useState<string[]>([]);
  const [managerRoleIds, setManagerRoleIds] = useState<string[]>([]);
  const [collaboratorRoleIds, setCollaboratorRoleIds] = useState<string[]>([]);
  const [accessIds, setAccessIds] = useState<string[]>([]);
  const [accessTarget, setAccessTarget] = useState<{ id: string; phone: string; promote: boolean } | null>(null);
  const [identity, setIdentity] = useState(emptyIdentity);
  const [password, setPassword] = useState("");
  const [accessBusy, setAccessBusy] = useState(false);
  const [accessError, setAccessError] = useState("");
  const [statusBusyId, setStatusBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const canCreate = canCreateEmployee(user?.role ?? "COLABORADOR");
  const canEdit = canEditEmployee(user?.role ?? "COLABORADOR");
  const canPromote = canPromoteEmployeeToSupervisor(user?.role ?? "COLABORADOR");
  const canPromoteManager = canPromoteSupervisorToManager(user?.role ?? "COLABORADOR");

  const activeEmployees = localEmployees.filter((employee) => employee.status === "ACTIVE");
  const topEmployees = localEmployees.filter((employee) => employee.averageRating >= 4.8);
  const trainingEmployees = localEmployees.filter((employee) => {
    const hasEvaluationSignal = employee.averageRating > 0 || Boolean(employee.lastEvaluationAt) || employee.serviceOrdersCount > 0;
    return Boolean(employee.needsTraining || (hasEvaluationSignal && employee.averageRating < 3.8));
  });
  const averageRating =
    activeEmployees.reduce((sum, employee) => sum + employee.averageRating, 0) / Math.max(activeEmployees.length, 1);

  const filteredEmployees = useMemo(() => {
    const normalizedQuery = normalizeText(query);

    return localEmployees.filter((employee) => {
      const matchesQuery =
        !normalizedQuery ||
        [employee.name, employee.roleName, employee.specialty, employee.status, employee.lastJob].some((value) =>
          normalizeText(value).includes(normalizedQuery),
        );
      const matchesStatus = !status || employee.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [localEmployees, query, status]);

  async function promoteToSupervisor(employeeId: string) {
    setNotice("");
    setError("");
    const employee = localEmployees.find(e => e.id === employeeId);
    if (employee && !employee.userId && !accessIds.includes(employeeId)) { openAccess(employeeId, employee.phone, true); return; }
    const response = await fetch(`/api/employees/${employeeId}/promote-to-supervisor`, { method: "POST" });
    const data = await response.json().catch(() => null);
    if (response.status === 403) {
      setError("Voce nao possui permissao para executar esta acao.");
      return;
    }
    if (!response.ok) {
      setError(data?.message ?? "Nao foi possivel promover colaborador.");
      return;
    }
    setPromotedIds((current) => [...current, employeeId]);
    setCollaboratorRoleIds((current) => current.filter((id) => id !== employeeId));
    setNotice(data?.message ?? "Colaborador promovido a supervisor.");
  }

  async function removeSupervisorRole(employeeId: string) {
    setNotice("");
    setError("");
    const response = await fetch(`/api/employees/${employeeId}/remove-supervisor-role`, { method: "POST" });
    const data = await response.json().catch(() => null);
    if (response.status === 403) {
      setError("Voce nao possui permissao para executar esta acao.");
      return;
    }
    if (!response.ok) {
      setError(data?.message ?? "Nao foi possivel remover funcao de supervisor.");
      return;
    }
    setCollaboratorRoleIds((current) => [...current, employeeId]);
    setPromotedIds((current) => current.filter((id) => id !== employeeId));
    setManagerRoleIds((current) => current.filter((id) => id !== employeeId));
    setNotice(data?.message ?? "Funcao de supervisor removida.");
  }

  async function promoteSupervisorToManager(employeeId: string) {
    setNotice("");
    setError("");
    const response = await fetch(`/api/employees/${employeeId}/promote-to-manager`, { method: "POST" });
    const data = await response.json().catch(() => null);
    if (response.status === 403) {
      setError("Voce nao possui permissao para executar esta acao.");
      return;
    }
    if (!response.ok) {
      setError(data?.message ?? "Nao foi possivel promover supervisor para gerente.");
      return;
    }
    setManagerRoleIds((current) => [...current, employeeId]);
    setPromotedIds((current) => current.filter((id) => id !== employeeId));
    setCollaboratorRoleIds((current) => current.filter((id) => id !== employeeId));
    setNotice(data?.message ?? "Supervisor promovido a gerente.");
  }

  function openAccess(id: string, phone: string, promote = false) {
    setAccessTarget({ id, phone, promote }); setIdentity(emptyIdentity()); setPassword(""); setAccessError("");
  }
  function grantAccess(id: string, phone: string) { openAccess(id, phone); }
  async function submitAccess() {
    if (!accessTarget) return;
    if (!accessTarget.phone || password.length < 4 || !validCpf(identity.cpf) || !identity.front || !identity.back) { setAccessError("Informe telefone, senha exclusiva de pelo menos 4 caracteres, CPF e as duas fotos."); return; }
    setAccessBusy(true); setAccessError("");
    try {
      const response = await fetch(`/api/employees/${accessTarget.id}/${accessTarget.promote ? "promote-to-supervisor" : "grant-access"}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: accessTarget.phone, role: "COLABORADOR", temporaryPassword: password, identity }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw Error(data?.message ?? "Nao foi possivel criar acesso.");
      setAccessIds(current => [...current, accessTarget.id]);
      if (accessTarget.promote) setPromotedIds(current => [...current, accessTarget.id]);
      if (data.employee) setLocalEmployees(current => current.map(e => e.id === accessTarget.id ? data.employee : e));
      setNotice(data?.message ?? "Acesso criado com sucesso.");
      setAccessTarget(null); setIdentity(emptyIdentity()); setPassword("");
    } catch (error) { setAccessError(error instanceof Error ? error.message : "Falha de conexao."); }
    finally { setAccessBusy(false); }
  }

  async function updateEmployeeStatus(employeeId: string, nextStatus: EmployeeStatus) {
    setNotice("");
    setError("");
    setStatusBusyId(employeeId);
    const response = await fetch(`/api/employees/${employeeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await response.json().catch(() => null);
    setStatusBusyId("");

    if (response.status === 403) {
      setError("Voce nao possui permissao para alterar status de colaboradores.");
      return;
    }
    if (!response.ok) {
      setError(data?.message ?? "Nao foi possivel atualizar o status.");
      return;
    }

    const updatedEmployee = data.employee as Employee;
    setLocalEmployees((current) => current.map((employee) => (employee.id === updatedEmployee.id ? updatedEmployee : employee)));
    setNotice(`Status de ${updatedEmployee.name} atualizado para ${labelFor(updatedEmployee.status)}.`);
  }

  return (
    <Stack spacing={3}>
      <Dialog open={Boolean(accessTarget)} onClose={() => { if (!accessBusy) { setAccessTarget(null); setIdentity(emptyIdentity()); setPassword(""); } }} fullWidth maxWidth="sm"><DialogTitle>{accessTarget?.promote ? "Criar acesso de supervisor" : "Criar acesso"}</DialogTitle><DialogContent dividers><Stack spacing={2}>{accessError && <Alert severity="error">{accessError}</Alert>}<TextField label="Telefone" value={accessTarget?.phone ?? ""} onChange={e => setAccessTarget(current => current ? { ...current, phone: e.target.value } : null)} disabled={accessBusy || Boolean(accessTarget?.promote)} /><TextField label="Senha inicial exclusiva" type="password" value={password} onChange={e => setPassword(e.target.value)} disabled={accessBusy} /><UserIdentityFields value={identity} onChange={setIdentity} disabled={accessBusy} /></Stack></DialogContent><DialogActions><Button disabled={accessBusy} onClick={() => { setAccessTarget(null); setIdentity(emptyIdentity()); setPassword(""); }}>Cancelar</Button><Button disabled={accessBusy} variant="contained" onClick={() => void submitAccess()}>Criar acesso</Button></DialogActions></Dialog>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "flex-end" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 34 }, mb: 0.8 }}>
            Colaboradores
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 860 }}>
            Visao de desempenho, especialidades, obras realizadas e sinais de treinamento da equipe operacional.
          </Typography>
        </Box>

        {!loading && canCreate && (
          <Button component={Link} href="/colaboradores/novo" variant="contained" startIcon={<AddRoundedIcon />}>
            Novo colaborador
          </Button>
        )}
      </Stack>

      {notice && <Alert severity="success">{notice}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
        <SummaryCard label="Colaboradores ativos" value={String(activeEmployees.length)} helper="Disponiveis para escalar" />
        <SummaryCard label="Media geral" value={averageRating.toFixed(1)} helper="Baseada nos ativos" icon={<StarRoundedIcon />} />
        <SummaryCard label="Destaques" value={String(topEmployees.length)} helper="Media igual ou acima de 4,8" icon={<WorkspacePremiumRoundedIcon />} />
        <SummaryCard label="Treinamento" value={String(trainingEmployees.length)} helper="Acompanhar de perto" icon={<SchoolRoundedIcon />} tone="warning" />
      </Box>

      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} alignItems={{ lg: "center" }}>
          <TextField
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome, funcao, especialidade ou ultima obra"
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
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            displayEmpty
            size="small"
            sx={{ minWidth: { xs: "100%", lg: 190 } }}
          >
            <MenuItem value="">Todos os status</MenuItem>
            {statusOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {labelFor(option)}
              </MenuItem>
            ))}
          </Select>
          <ToggleButtonGroup
            exclusive
            value={viewMode}
            onChange={(_, nextMode: "cards" | "list" | null) => {
              if (nextMode) setViewMode(nextMode);
            }}
            size="small"
            sx={{ alignSelf: { xs: "stretch", lg: "center" } }}
          >
            <ToggleButton value="cards" aria-label="Visualizacao em cards">
              <ViewModuleRoundedIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="list" aria-label="Visualizacao em lista">
              <FormatListBulletedRoundedIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
          <Chip label={`${filteredEmployees.length} colaboradores`} sx={{ alignSelf: { xs: "flex-start", lg: "center" } }} />
        </Stack>
      </Paper>

      {filteredEmployees.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 5, textAlign: "center", borderRadius: 2 }}>
          <Typography variant="h6">Nenhum colaborador encontrado</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Ajuste a busca ou os filtros para ampliar o resultado.
          </Typography>
        </Paper>
      ) : viewMode === "list" ? (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 900 }}>Colaborador</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Funcao</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 900 }} align="right">Media</TableCell>
                <TableCell sx={{ fontWeight: 900 }} align="right">Obras</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Ultima avaliacao</TableCell>
                <TableCell align="right" sx={{ fontWeight: 900 }}>Acoes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredEmployees.map((employee) => {
                const accessUser = employee.userId ? users.find((currentUser) => currentUser.id === employee.userId) : undefined;
                return (
                  <TableRow key={employee.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1.4} alignItems="center">
                        <Avatar sx={{ width: 38, height: 38, bgcolor: employee.averageRating >= 4.8 ? "success.main" : employee.needsTraining ? "warning.main" : "primary.main" }}>
                          {employee.name.slice(0, 1)}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography fontWeight={900} noWrap>{employee.name}</Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>{employee.phone || "Sem telefone"}</Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={850}>{employee.jobTitle ?? employee.roleName}</Typography>
                      <Typography variant="body2" color="text.secondary">{employee.specialty}</Typography>
                    </TableCell>
                    <TableCell sx={{ minWidth: 190 }}>
                      <EmployeeStatusSelect
                        employee={employee}
                        canEdit={canEdit}
                        busy={statusBusyId === employee.id}
                        onChange={updateEmployeeStatus}
                      />
                    </TableCell>
                    <TableCell align="right">{employee.averageRating.toFixed(1)}</TableCell>
                    <TableCell align="right">{employee.serviceOrdersCount}</TableCell>
                    <TableCell>{employee.lastEvaluationAt ? formatDate(employee.lastEvaluationAt) : "Sem avaliacao"}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        {accessUser && <Chip size="small" variant="outlined" label={labelFor(accessUser.role)} />}
                        <Button component={Link} href={`/colaboradores/${employee.id}`} size="small" endIcon={<ArrowForwardRoundedIcon />}>
                          Perfil
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
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
          {filteredEmployees.map((employee) => {
            const isTop = employee.averageRating >= 4.8;
            const hasEvaluationSignal = employee.averageRating > 0 || Boolean(employee.lastEvaluationAt) || employee.serviceOrdersCount > 0;
            const needsTraining = Boolean(employee.needsTraining || (hasEvaluationSignal && employee.averageRating < 3.8));
            const accessUser = employee.userId ? users.find((currentUser) => currentUser.id === employee.userId) : undefined;
            const hasAccess = Boolean(accessUser || accessIds.includes(employee.id));
            const accessRole = collaboratorRoleIds.includes(employee.id)
              ? "COLABORADOR"
              : managerRoleIds.includes(employee.id)
                ? "GERENTE"
                : promotedIds.includes(employee.id)
                  ? "SUPERVISOR_OBRA"
                  : accessUser?.role;
            const isSupervisor = accessRole === "SUPERVISOR_OBRA";
            const isManager = accessRole === "GERENTE";

            return (
              <Paper
                key={employee.id}
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 2,
                  borderColor: needsTraining ? "warning.main" : isTop ? "success.main" : "divider",
                  bgcolor: needsTraining ? "rgba(245, 158, 11, 0.08)" : "background.paper",
                }}
              >
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Avatar sx={{ width: 48, height: 48, bgcolor: isTop ? "success.main" : needsTraining ? "warning.main" : "primary.main" }}>
                      {employee.name.slice(0, 1)}
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography variant="h6" sx={{ fontSize: 18 }} noWrap>
                          {employee.name}
                        </Typography>
                        {isTop && <Chip size="small" color="success" icon={<WorkspacePremiumRoundedIcon />} label="Destaque" />}
                        {needsTraining && <Chip size="small" color="warning" icon={<SchoolRoundedIcon />} label="Treinamento" />}
                        <Chip size="small" color={hasAccess ? "primary" : "default"} label={hasAccess ? "Com acesso" : "Sem acesso"} />
                        {accessRole && <Chip size="small" variant="outlined" label={accessRole} />}
                      </Stack>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {employee.roleName} - {employee.specialty}
                      </Typography>
                    </Box>
                    <StatusChip value={employee.status} />
                  </Stack>

                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.2 }}>
                    <Info label="Media" value={employee.averageRating.toFixed(1)} icon={<StarRoundedIcon color="secondary" fontSize="small" />} />
                    <Info label="Obras realizadas" value={String(employee.serviceOrdersCount)} />
                    <Info label="Ultima avaliacao" value={employee.lastEvaluationAt ? formatDate(employee.lastEvaluationAt) : "Sem avaliacao"} />
                    <Info label="Ultima obra" value={employee.lastJob} />
                    <Info label="Funcao" value={employee.jobTitle ?? employee.roleName} />
                    <Info label="Acesso" value={hasAccess ? accessRole ?? "Ativo" : "Sem login"} />
                  </Box>

                  {employee.trainingAlert && (
                    <Box sx={{ p: 1.4, borderRadius: 2, bgcolor: "warning.light", color: "warning.contrastText" }}>
                      <Typography variant="body2" fontWeight={800}>
                        {employee.trainingAlert}
                      </Typography>
                    </Box>
                  )}

                  <EmployeeStatusSelect
                    employee={employee}
                    canEdit={canEdit}
                    busy={statusBusyId === employee.id}
                    onChange={updateEmployeeStatus}
                  />

                  <Button component={Link} href={`/colaboradores/${employee.id}`} variant="outlined" endIcon={<ArrowForwardRoundedIcon />}>
                    Abrir perfil
                  </Button>
                  {canPromote && !hasAccess && (
                    <Button onClick={() => grantAccess(employee.id, employee.phone)} variant="outlined" startIcon={<LockOpenRoundedIcon />}>
                      Dar acesso
                    </Button>
                  )}
                  {canPromote && !isSupervisor && !isManager && (
                    <Button onClick={() => promoteToSupervisor(employee.id)} color="secondary" variant="contained">
                      Promover a supervisor
                    </Button>
                  )}
                  {canPromoteManager && isSupervisor && (
                    <Button onClick={() => promoteSupervisorToManager(employee.id)} color="primary" variant="contained">
                      Promover a gerente
                    </Button>
                  )}
                  {canPromote && isSupervisor && (
                    <Button onClick={() => removeSupervisorRole(employee.id)} color="warning" variant="outlined">
                      Remover funcao de supervisor
                    </Button>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Box>
      )}
    </Stack>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  icon = <StarRoundedIcon />,
  tone = "primary",
}: {
  label: string;
  value: string;
  helper: string;
  icon?: React.ReactNode;
  tone?: "primary" | "warning";
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Stack direction="row" justifyContent="space-between" spacing={1.5}>
        <Box>
          <Typography variant="body2" color="text.secondary" fontWeight={800}>
            {label}
          </Typography>
          <Typography variant="h4" sx={{ fontSize: 30 }}>
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary">
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

function EmployeeStatusSelect({
  employee,
  canEdit,
  busy,
  onChange,
}: {
  employee: Employee;
  canEdit: boolean;
  busy: boolean;
  onChange: (employeeId: string, status: EmployeeStatus) => void;
}) {
  return (
    <TextField
      select
      size="small"
      label="Status"
      value={employee.status}
      onChange={(event) => onChange(employee.id, event.target.value as EmployeeStatus)}
      disabled={!canEdit || busy}
      fullWidth
      helperText={busy ? "Atualizando..." : canEdit ? "Altere disponibilidade do colaborador" : "Sem permissao"}
    >
      {statusOptions.map((option) => (
        <MenuItem key={option} value={option}>
          {labelFor(option)}
        </MenuItem>
      ))}
    </TextField>
  );
}

function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Stack direction="row" spacing={0.5} alignItems="center">
        {icon}
        <Typography fontWeight={850} noWrap>
          {value}
        </Typography>
      </Stack>
    </Box>
  );
}
