"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Avatar,
  Alert,
  Box,
  Button,
  Chip,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import LockOpenRoundedIcon from "@mui/icons-material/LockOpenRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";

import { formatDate, normalizeText } from "@/lib/format";
import { labelFor } from "@/lib/labels";
import { canCreateEmployee, canPromoteEmployeeToSupervisor, canPromoteSupervisorToManager } from "@/lib/permissions";
import type { Employee, SessionUser } from "@/lib/types";
import { StatusChip } from "./StatusChip";
import { useCurrentUser } from "./useCurrentUser";

const statusOptions = ["ACTIVE", "ON_LEAVE", "INACTIVE", "FIRED"];

export function EmployeeListView({ employees, users }: { employees: Employee[]; users: SessionUser[] }) {
  const { user, loading } = useCurrentUser();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [promotedIds, setPromotedIds] = useState<string[]>([]);
  const [managerRoleIds, setManagerRoleIds] = useState<string[]>([]);
  const [collaboratorRoleIds, setCollaboratorRoleIds] = useState<string[]>([]);
  const [accessIds, setAccessIds] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const canCreate = canCreateEmployee(user?.role ?? "COLABORADOR");
  const canPromote = canPromoteEmployeeToSupervisor(user?.role ?? "COLABORADOR");
  const canPromoteManager = canPromoteSupervisorToManager(user?.role ?? "COLABORADOR");

  const activeEmployees = employees.filter((employee) => employee.status === "ACTIVE");
  const topEmployees = employees.filter((employee) => employee.averageRating >= 4.8);
  const trainingEmployees = employees.filter((employee) => {
    const hasEvaluationSignal = employee.averageRating > 0 || Boolean(employee.lastEvaluationAt) || employee.serviceOrdersCount > 0;
    return Boolean(employee.needsTraining || (hasEvaluationSignal && employee.averageRating < 3.8));
  });
  const averageRating =
    activeEmployees.reduce((sum, employee) => sum + employee.averageRating, 0) / Math.max(activeEmployees.length, 1);

  const filteredEmployees = useMemo(() => {
    const normalizedQuery = normalizeText(query);

    return employees.filter((employee) => {
      const matchesQuery =
        !normalizedQuery ||
        [employee.name, employee.roleName, employee.specialty, employee.status, employee.lastJob].some((value) =>
          normalizeText(value).includes(normalizedQuery),
        );
      const matchesStatus = !status || employee.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [employees, query, status]);

  async function promoteToSupervisor(employeeId: string) {
    setNotice("");
    setError("");
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

  async function grantAccess(employeeId: string, email: string) {
    setNotice("");
    setError("");
    if (!email) {
      setError("Informe e-mail do colaborador antes de criar acesso.");
      return;
    }
    const response = await fetch(`/api/employees/${employeeId}/grant-access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role: "COLABORADOR", temporaryPassword: "123456" }),
    });
    const data = await response.json().catch(() => null);
    if (response.status === 403) {
      setError("Voce nao possui permissao para executar esta acao.");
      return;
    }
    if (!response.ok) {
      setError(data?.message ?? "Nao foi possivel criar acesso.");
      return;
    }
    setAccessIds((current) => [...current, employeeId]);
    setNotice(data?.message ?? "Acesso criado com sucesso.");
  }

  return (
    <Stack spacing={3}>
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

                  <Button component={Link} href={`/colaboradores/${employee.id}`} variant="outlined" endIcon={<ArrowForwardRoundedIcon />}>
                    Abrir perfil
                  </Button>
                  {canPromote && !hasAccess && (
                    <Button onClick={() => grantAccess(employee.id, employee.email)} variant="outlined" startIcon={<LockOpenRoundedIcon />}>
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
