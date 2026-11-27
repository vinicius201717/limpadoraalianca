"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Avatar, Box, Button, Checkbox, Chip, Divider, FormControlLabel, LinearProgress, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import LockResetRoundedIcon from "@mui/icons-material/LockResetRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";

import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { labelFor } from "@/lib/labels";
import { canEditEmployee, canEvaluateEmployeeProfileByRole, canManageEmployeeUserAccess, canViewServiceOrderFinancials } from "@/lib/permissions";
import type { Employee, EmployeeStatus, Evaluation, ServiceOrder, ServiceOrderChecklistEvent, ServiceOrderChecklistItem, SupervisorEvaluation, UserRole } from "@/lib/types";
import { StatusChip } from "./StatusChip";
import { FieldProfileAccessCard, type FieldProfileAccount } from "./FieldProfileAccessCard";
import { useCurrentUser } from "./useCurrentUser";

const criteria = [
  { label: "Pontualidade", fallbackKey: "punctuality", getScore: (evaluation: Evaluation) => evaluation.punctualityScore },
  { label: "Qualidade tecnica", fallbackKey: "quality", getScore: (evaluation: Evaluation) => evaluation.qualityScore },
  { label: "Produtividade", fallbackKey: "productivity", getScore: (evaluation: Evaluation) => evaluation.productivityScore },
  { label: "Cuidado com o imovel", fallbackKey: "care", getScore: (evaluation: Evaluation) => evaluation.careScore },
  { label: "Trabalho em equipe", fallbackKey: "teamwork", getScore: (evaluation: Evaluation) => evaluation.teamworkScore },
  { label: "Postura com o cliente", fallbackKey: "clientPosture", getScore: (evaluation: Evaluation) => evaluation.clientPostureScore },
  {
    label: "Cumprimento do checklist",
    fallbackKey: "checklistCompliance",
    getScore: (evaluation: Evaluation) => evaluation.checklistComplianceScore,
  },
] as const;

type EvaluationScoreKey =
  | "punctualityScore"
  | "qualityScore"
  | "productivityScore"
  | "careScore"
  | "teamworkScore"
  | "clientPostureScore"
  | "checklistComplianceScore";

type SupervisorEvaluationScoreKey =
  | "clarityScore"
  | "organizationScore"
  | "respectScore"
  | "taskDistributionScore"
  | "communicationScore"
  | "supportScore"
  | "leadershipScore";

const evaluationScoreFields: Array<{ key: EvaluationScoreKey; label: string }> = [
  { key: "punctualityScore", label: "Pontualidade" },
  { key: "qualityScore", label: "Qualidade tecnica" },
  { key: "productivityScore", label: "Produtividade" },
  { key: "careScore", label: "Cuidado com o imovel" },
  { key: "teamworkScore", label: "Trabalho em equipe" },
  { key: "clientPostureScore", label: "Postura com o cliente" },
  { key: "checklistComplianceScore", label: "Cumprimento do checklist" },
];

const supervisorCriteria: Array<{ label: string; getScore: (evaluation: SupervisorEvaluation) => number }> = [
  { label: "Clareza na orientacao", getScore: (evaluation) => evaluation.clarityScore },
  { label: "Organizacao da equipe", getScore: (evaluation) => evaluation.organizationScore },
  { label: "Respeito no trato", getScore: (evaluation) => evaluation.respectScore },
  { label: "Distribuicao de tarefas", getScore: (evaluation) => evaluation.taskDistributionScore },
  { label: "Comunicacao", getScore: (evaluation) => evaluation.communicationScore },
  { label: "Apoio durante o servico", getScore: (evaluation) => evaluation.supportScore },
  { label: "Lideranca", getScore: (evaluation) => evaluation.leadershipScore },
];

const supervisorEvaluationScoreFields: Array<{ key: SupervisorEvaluationScoreKey; label: string }> = [
  { key: "clarityScore", label: "Clareza na orientacao" },
  { key: "organizationScore", label: "Organizacao" },
  { key: "respectScore", label: "Respeito" },
  { key: "taskDistributionScore", label: "Distribuicao de tarefas" },
  { key: "communicationScore", label: "Comunicacao" },
  { key: "supportScore", label: "Apoio" },
  { key: "leadershipScore", label: "Lideranca" },
];

const employeeStatusOptions: EmployeeStatus[] = ["ACTIVE", "VACATION", "ON_LEAVE", "SUSPENDED", "INACTIVE", "FIRED"];

const defaultScores: Record<EvaluationScoreKey, number> = {
  punctualityScore: 5,
  qualityScore: 5,
  productivityScore: 5,
  careScore: 5,
  teamworkScore: 5,
  clientPostureScore: 5,
  checklistComplianceScore: 5,
};

const defaultSupervisorScores: Record<SupervisorEvaluationScoreKey, number> = {
  clarityScore: 5,
  organizationScore: 5,
  respectScore: 5,
  taskDistributionScore: 5,
  communicationScore: 5,
  supportScore: 5,
  leadershipScore: 5,
};

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function EmployeeDetailView({
  employee,
  fieldAccount,
  targetAccessRole,
  evaluations,
  supervisorEvaluations = [],
  serviceOrders,
  checklistEvents = [],
  checklistItems = [],
}: {
  employee: Employee;
  fieldAccount?: FieldProfileAccount;
  targetAccessRole?: UserRole | null;
  evaluations: Evaluation[];
  supervisorEvaluations?: SupervisorEvaluation[];
  serviceOrders: ServiceOrder[];
  checklistEvents?: ServiceOrderChecklistEvent[];
  checklistItems?: ServiceOrderChecklistItem[];
}) {
  const { user } = useCurrentUser();
  const [localEvaluations, setLocalEvaluations] = useState(evaluations);
  const [localSupervisorEvaluations, setLocalSupervisorEvaluations] = useState(supervisorEvaluations);
  const [employeeStatus, setEmployeeStatus] = useState<EmployeeStatus>(employee.status);
  const [statusInput, setStatusInput] = useState<EmployeeStatus>(employee.status);
  const [statusError, setStatusError] = useState("");
  const [statusNotice, setStatusNotice] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);
  const employeeOrders = serviceOrders.filter((order) => order.employeeIds.includes(employee.id) || order.supervisorEmployeeId === employee.id);
  const orderById = new Map(serviceOrders.map((order) => [order.id, order]));
  const checklistItemById = new Map(checklistItems.map((item) => [item.id, item]));
  const completedChecklistEvents = checklistEvents
    .filter((event) => event.type === "COMPLETED" && event.employeeId === employee.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const [selectedServiceOrderId, setSelectedServiceOrderId] = useState(employeeOrders[0]?.id ?? "");
  const [scores, setScores] = useState<Record<EvaluationScoreKey, number>>(defaultScores);
  const [supervisorScores, setSupervisorScores] = useState<Record<SupervisorEvaluationScoreKey, number>>(defaultSupervisorScores);
  const [positiveNotes, setPositiveNotes] = useState("");
  const [improvementNotes, setImprovementNotes] = useState("");
  const [seriousIssue, setSeriousIssue] = useState(false);
  const [needsTrainingInput, setNeedsTrainingInput] = useState(false);
  const [evaluationError, setEvaluationError] = useState("");
  const [evaluationNotice, setEvaluationNotice] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const canEvaluate = Boolean(user && canEvaluateEmployeeProfileByRole(user.role, targetAccessRole));
  const usesSupervisorEvaluationFlow = Boolean(user?.role === "COLABORADOR" && targetAccessRole === "SUPERVISOR_OBRA");
  const canEditStatus = canEditEmployee(user?.role ?? "COLABORADOR");
  const canManagePassword = canManageEmployeeUserAccess(user?.role ?? "COLABORADOR");
  const canViewFinancials = canViewServiceOrderFinancials(user);
  const isOwnAccessProfile = Boolean(user?.id && employee.userId === user.id);
  const canChangePassword = Boolean(employee.userId && (canManagePassword || isOwnAccessProfile));
  const requiresCurrentPassword = isOwnAccessProfile;
  const employeeEvaluations = localEvaluations
    .filter((evaluation) => evaluation.employeeId === employee.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const targetSupervisorEvaluations = localSupervisorEvaluations
    .filter((evaluation) => evaluation.supervisorEmployeeId === employee.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const calculatedAverage =
    targetAccessRole === "SUPERVISOR_OBRA"
      ? average(targetSupervisorEvaluations.map((evaluation) => evaluation.overallScore))
      : average(employeeEvaluations.map((evaluation) => evaluation.overallScore));
  const currentAverage = calculatedAverage || employee.supervisorAverageRating || employee.averageRating;
  const lastEvaluationAt =
    targetAccessRole === "SUPERVISOR_OBRA"
      ? targetSupervisorEvaluations[0]?.createdAt ?? employee.lastEvaluationAt
      : employeeEvaluations[0]?.createdAt ?? employee.lastEvaluationAt;
  const hasEvaluationSignal = employeeEvaluations.length > 0 || employee.averageRating > 0 || Boolean(employee.lastEvaluationAt) || employee.serviceOrdersCount > 0;
  const needsTraining = Boolean(employee.needsTraining || (hasEvaluationSignal && currentAverage < 3.8));
  const completedOrders = employeeOrders.filter((order) => order.status === "DONE" || order.status === "DELIVERED").length;
  const estimatedGeneratedRevenue = employeeOrders.reduce((sum, order) => sum + order.revenue / Math.max(order.employeeIds.length, 1), 0);
  const evaluationTargetLabel = targetAccessRole === "SUPERVISOR_OBRA" ? "supervisor" : "colaborador";

  const criteriaScores =
    targetAccessRole === "SUPERVISOR_OBRA"
      ? supervisorCriteria.map((item) => {
          const evaluatedAverage = average(targetSupervisorEvaluations.map(item.getScore));
          const fallbackValue = employee.supervisorAverageRating ?? employee.averageRating;
          return { label: item.label, value: Number((evaluatedAverage || fallbackValue).toFixed(1)) };
        })
      : criteria.map((item) => {
          const evaluatedAverage = average(employeeEvaluations.map(item.getScore));
          const fallbackValue = employee.criteriaAverages?.[item.fallbackKey] ?? employee.averageRating;
          return { label: item.label, value: Number((evaluatedAverage || fallbackValue).toFixed(1)) };
        });
  const timelineEvaluations =
    targetAccessRole === "SUPERVISOR_OBRA"
      ? targetSupervisorEvaluations.map((evaluation) => ({
          id: evaluation.id,
          createdAt: evaluation.createdAt,
          overallScore: evaluation.overallScore,
          positiveNotes: evaluation.positiveNotes,
          improvementNotes: evaluation.improvementNotes,
          needsTraining: false,
        }))
      : employeeEvaluations;

  async function submitEvaluation() {
    setEvaluationError("");
    setEvaluationNotice("");
    if (!selectedServiceOrderId) {
      setEvaluationError("Selecione uma OS para vincular a avaliacao.");
      return;
    }

    if (usesSupervisorEvaluationFlow) {
      const response = await fetch(`/api/service-orders/${selectedServiceOrderId}/evaluate-supervisor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...supervisorScores,
          positiveNotes,
          improvementNotes,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setEvaluationError(data?.message ?? "Nao foi possivel registrar a avaliacao.");
        return;
      }

      setLocalSupervisorEvaluations((current) => [data.evaluation, ...current]);
      setEvaluationNotice(`Avaliacao registrada com media ${data.evaluation.overallScore.toFixed(1)}.`);
      setPositiveNotes("");
      setImprovementNotes("");
      return;
    }

    const response = await fetch("/api/evaluations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceOrderId: selectedServiceOrderId,
        employeeId: employee.id,
        employeeName: employee.name,
        ...scores,
        positiveNotes,
        improvementNotes,
        seriousIssue,
        needsTraining: needsTrainingInput,
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setEvaluationError(data?.message ?? "Nao foi possivel registrar a avaliacao.");
      return;
    }

    setLocalEvaluations((current) => [data.evaluation, ...current]);
    setEvaluationNotice(`Avaliacao registrada com media ${data.evaluation.overallScore.toFixed(1)}.`);
    setPositiveNotes("");
    setImprovementNotes("");
    setSeriousIssue(false);
    setNeedsTrainingInput(false);
  }

  async function submitPasswordChange() {
    setPasswordError("");
    setPasswordNotice("");

    if (!canChangePassword) {
      setPasswordError("Perfil sem permissao para alterar esta senha.");
      return;
    }
    if (newPassword.length < 4) {
      setPasswordError("A nova senha deve ter pelo menos 4 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("A confirmacao nao confere com a nova senha.");
      return;
    }

    setPasswordBusy(true);
    const response = await fetch(`/api/employees/${employee.id}/password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: requiresCurrentPassword ? currentPassword : undefined,
        newPassword,
      }),
    });
    const data = await response.json().catch(() => null);
    setPasswordBusy(false);

    if (!response.ok) {
      setPasswordError(data?.message ?? "Nao foi possivel atualizar a senha.");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordNotice("Senha atualizada com sucesso.");
  }

  async function submitStatusChange() {
    setStatusError("");
    setStatusNotice("");
    setStatusBusy(true);
    const response = await fetch(`/api/employees/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: statusInput }),
    });
    const data = await response.json().catch(() => null);
    setStatusBusy(false);

    if (response.status === 403) {
      setStatusError("Voce nao possui permissao para alterar status deste colaborador.");
      return;
    }
    if (!response.ok) {
      setStatusError(data?.message ?? "Nao foi possivel atualizar o status.");
      return;
    }

    const updatedEmployee = data.employee as Employee;
    setEmployeeStatus(updatedEmployee.status);
    setStatusInput(updatedEmployee.status);
    setStatusNotice(`Status atualizado para ${labelFor(updatedEmployee.status)}.`);
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={2}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0 }}>
          <Avatar sx={{ width: 62, height: 62, bgcolor: needsTraining ? "warning.main" : "primary.main", fontSize: 24 }}>
            {employee.name.slice(0, 1)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 34 } }} noWrap>
                {employee.name}
              </Typography>
              {employee.averageRating >= 4.8 && <Chip color="success" label="Alto desempenho" size="small" />}
              {needsTraining && <Chip color="warning" icon={<SchoolRoundedIcon />} label="Treinamento" size="small" />}
              <StatusChip value={employeeStatus} />
            </Stack>
            <Typography color="text.secondary" noWrap>
              {employee.roleName} - {employee.specialty}
            </Typography>
          </Box>
        </Stack>
        <Button component={Link} href="/colaboradores" startIcon={<ArrowBackRoundedIcon />}>
          Voltar
        </Button>
      </Stack>

      {user && fieldAccount && <FieldProfileAccessCard account={fieldAccount} viewerUserId={user.id} />}

      {needsTraining && (
        <Alert severity="warning" icon={<SchoolRoundedIcon />}>
          {employee.trainingAlert ?? "Colaborador com pontos de desenvolvimento que precisam de acompanhamento da supervisao."}
        </Alert>
      )}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
        <Kpi label="Media geral" value={currentAverage.toFixed(1)} helper="Nota consolidada" icon={<StarRoundedIcon />} />
        <Kpi label="Obras realizadas" value={String(employee.serviceOrdersCount)} helper={`${completedOrders} finalizadas, ${completedChecklistEvents.length} itens concluidos`} icon={<AssignmentTurnedInRoundedIcon />} />
        <Kpi label="Ultima avaliacao" value={lastEvaluationAt ? formatDate(lastEvaluationAt) : "Sem data"} helper="Acompanhamento da lideranca" icon={<TimelineRoundedIcon />} />
        <Kpi
          label="Receita atribuida"
          value={canViewFinancials ? formatCurrency(estimatedGeneratedRevenue) : "Restrito"}
          helper={canViewFinancials ? "Rateio demonstrativo por equipe" : "Visivel apenas para financeiro autorizado"}
          icon={<StarRoundedIcon />}
        />
      </Box>

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <SecurityRoundedIcon color="primary" />
                <Typography variant="h6">Segurança de acesso</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Atualize a senha usada por este colaborador para entrar no sistema.
              </Typography>
            </Box>
            <Chip
              color={employee.userId ? canChangePassword ? "primary" : "warning" : "default"}
              label={employee.userId ? canChangePassword ? "Troca liberada" : "Sem permissao" : "Sem acesso ao sistema"}
              variant="outlined"
            />
          </Stack>

          {passwordNotice && <Alert severity="success">{passwordNotice}</Alert>}
          {passwordError && <Alert severity="warning">{passwordError}</Alert>}
          {!employee.userId ? (
            <Alert severity="info">Este colaborador ainda nao possui usuario de acesso. Libere o acesso antes de definir uma senha.</Alert>
          ) : !canChangePassword ? (
            <Alert severity="info">Somente OWNER, GERENTE ou o proprio usuario vinculado podem alterar esta senha.</Alert>
          ) : (
            <Stack spacing={2}>
              {requiresCurrentPassword && (
                <TextField
                  label="Senha atual"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  fullWidth
                />
              )}
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
                <TextField
                  label="Nova senha"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  fullWidth
                />
                <TextField
                  label="Confirmar nova senha"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  fullWidth
                />
              </Box>
              <Button
                variant="contained"
                startIcon={<LockResetRoundedIcon />}
                onClick={submitPasswordChange}
                disabled={passwordBusy || !newPassword || !confirmPassword || (requiresCurrentPassword && !currentPassword)}
                sx={{ alignSelf: "flex-start" }}
              >
                {passwordBusy ? "Atualizando..." : "Alterar senha"}
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
            <Box>
              <Typography variant="h6">Avaliar {evaluationTargetLabel}</Typography>
              <Typography variant="body2" color="text.secondary">
                Registre a avaliacao operacional vinculada a uma OS compartilhada com este {evaluationTargetLabel}.
              </Typography>
            </Box>
            <Chip color={canEvaluate ? "primary" : "warning"} label={canEvaluate ? "Permitido para seu perfil" : "Sem permissao"} variant="outlined" />
          </Stack>
          {evaluationNotice && <Alert severity="success">{evaluationNotice}</Alert>}
          {evaluationError && <Alert severity="warning">{evaluationError}</Alert>}
          {!canEvaluate && <Alert severity="info">Seu perfil nao possui permissao para avaliar este {evaluationTargetLabel}.</Alert>}
          {employeeOrders.length === 0 ? (
            <Alert severity="info">Nao ha OS compartilhada disponivel para avaliar este {evaluationTargetLabel}.</Alert>
          ) : (
            <Stack spacing={2}>
              <TextField
                select
                label="OS vinculada"
                value={selectedServiceOrderId}
                onChange={(event) => setSelectedServiceOrderId(event.target.value)}
                fullWidth
              >
                {employeeOrders.map((order) => (
                  <MenuItem key={order.id} value={order.id}>
                    {order.title} - {order.customerName} - {labelFor(order.status)}
                  </MenuItem>
                ))}
              </TextField>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 1.5 }}>
                {usesSupervisorEvaluationFlow
                  ? supervisorEvaluationScoreFields.map((field) => (
                      <TextField
                        key={field.key}
                        select
                        label={field.label}
                        value={supervisorScores[field.key]}
                        onChange={(event) => setSupervisorScores((current) => ({ ...current, [field.key]: Number(event.target.value) }))}
                      >
                        {[1, 2, 3, 4, 5].map((score) => (
                          <MenuItem key={score} value={score}>
                            {score}
                          </MenuItem>
                        ))}
                      </TextField>
                    ))
                  : evaluationScoreFields.map((field) => (
                      <TextField
                        key={field.key}
                        select
                        label={field.label}
                        value={scores[field.key]}
                        onChange={(event) => setScores((current) => ({ ...current, [field.key]: Number(event.target.value) }))}
                      >
                        {[1, 2, 3, 4, 5].map((score) => (
                          <MenuItem key={score} value={score}>
                            {score}
                          </MenuItem>
                        ))}
                      </TextField>
                    ))}
              </Box>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
                <TextField label="Pontos positivos" value={positiveNotes} onChange={(event) => setPositiveNotes(event.target.value)} multiline minRows={3} />
                <TextField label="Pontos a melhorar" value={improvementNotes} onChange={(event) => setImprovementNotes(event.target.value)} multiline minRows={3} />
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ sm: "center" }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <FormControlLabel control={<Checkbox checked={needsTrainingInput} onChange={(event) => setNeedsTrainingInput(event.target.checked)} />} label="Precisa de treinamento" />
                  <FormControlLabel control={<Checkbox checked={seriousIssue} onChange={(event) => setSeriousIssue(event.target.checked)} />} label="Problema serio" />
                </Stack>
                <Button variant="contained" startIcon={<StarRoundedIcon />} onClick={submitEvaluation} disabled={!canEvaluate}>
                  Registrar avaliacao
                </Button>
              </Stack>
            </Stack>
          )}
        </Stack>
      </Paper>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "0.95fr 1.05fr" }, gap: 2 }}>
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Dados principais</Typography>
              <StatusChip value={employeeStatus} />
            </Stack>
            <Divider />
            {statusNotice && <Alert severity="success">{statusNotice}</Alert>}
            {statusError && <Alert severity="warning">{statusError}</Alert>}
            <Box sx={{ p: 1.6, borderRadius: 2, bgcolor: "background.default", border: 1, borderColor: "divider" }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.3} alignItems={{ sm: "center" }}>
                <TextField
                  select
                  label="Atualizar status"
                  value={statusInput}
                  onChange={(event) => setStatusInput(event.target.value as EmployeeStatus)}
                  disabled={!canEditStatus || statusBusy}
                  size="small"
                  sx={{ minWidth: { xs: "100%", sm: 220 } }}
                >
                  {employeeStatusOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {labelFor(option)}
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  variant="contained"
                  onClick={submitStatusChange}
                  disabled={!canEditStatus || statusBusy || statusInput === employeeStatus}
                >
                  {statusBusy ? "Atualizando..." : "Salvar status"}
                </Button>
                {!canEditStatus && (
                  <Typography variant="body2" color="text.secondary">
                    Somente OWNER e GERENTE podem alterar status.
                  </Typography>
                )}
              </Stack>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <Info label="Telefone" value={employee.phone} />
              <Info label="E-mail" value={employee.email} />
              <Info label="Documento" value={employee.document} />
              <Info label="Admissao" value={formatDate(employee.hiredAt)} />
              <Info label="Custo diario" value={formatCurrency(employee.dailyCost)} />
              <Info label="Ultima obra" value={employee.lastJob} />
            </Box>
            <Info label="Observacoes internas" value={employee.notes} />
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6">Media por criterio</Typography>
              <Typography variant="body2" color="text.secondary">
                Leitura objetiva do padrao operacional do {evaluationTargetLabel}.
              </Typography>
            </Box>
            {criteriaScores.map((item) => (
              <Box key={item.label}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.6 }} gap={1}>
                  <Typography variant="body2" fontWeight={850}>
                    {item.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.value.toFixed(1)}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={(item.value / 5) * 100}
                  color={item.value < 3.8 ? "warning" : "primary"}
                  sx={{ height: 8, borderRadius: 999 }}
                />
              </Box>
            ))}
          </Stack>
        </Paper>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2 }}>
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Historico de obras
          </Typography>
          <Stack spacing={1.3}>
            {employeeOrders.map((order) => (
              <Box key={order.id} sx={{ p: 1.6, borderRadius: 2, bgcolor: "background.default", border: 1, borderColor: "divider" }}>
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={900} noWrap>
                      {order.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {order.customerName} - {formatDate(order.scheduledStart)}
                    </Typography>
                  </Box>
                  <StatusChip value={order.status} />
                </Stack>
              </Box>
            ))}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1} sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h6">Historico de checklist</Typography>
              <Typography variant="body2" color="text.secondary">
                Itens finalizados por este colaborador.
              </Typography>
            </Box>
            <Chip color="success" variant="outlined" label={`${completedChecklistEvents.length} concluidos`} />
          </Stack>
          {completedChecklistEvents.length === 0 ? (
            <Alert severity="info">Ainda nao ha item de checklist concluido por este colaborador.</Alert>
          ) : (
            <Stack spacing={1.3}>
              {completedChecklistEvents.slice(0, 10).map((event) => {
                const order = orderById.get(event.serviceOrderId);
                const checklistItem = checklistItemById.get(event.checklistItemId);
                return (
                  <Box key={event.id} sx={{ p: 1.6, borderRadius: 2, bgcolor: "background.default", border: 1, borderColor: "divider" }}>
                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography fontWeight={900} sx={{ wordBreak: "break-word" }}>
                          {checklistItem?.title ?? "Item de checklist"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {order?.title ?? "OS"} - {order?.customerName ?? "Cliente"}
                        </Typography>
                        {event.message && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                            {event.message}
                          </Typography>
                        )}
                      </Box>
                      <Chip size="small" color="success" label={formatDateTime(event.createdAt)} />
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Paper>

        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Desenvolvimento
          </Typography>
          <Stack spacing={2}>
            <TagGroup title="Pontos positivos" color="success" items={employee.strengths} />
            <TagGroup title="Pontos a melhorar" color="warning" items={employee.improvements} />
            <Divider />
            <Typography variant="subtitle1" fontWeight={900}>
              Linha do tempo de avaliacoes
            </Typography>
            {timelineEvaluations.length === 0 ? (
              <Typography color="text.secondary">Ainda nao ha avaliacao registrada para este {evaluationTargetLabel}.</Typography>
            ) : (
              timelineEvaluations.map((evaluation) => (
                <Box key={evaluation.id} sx={{ pl: 2, borderLeft: 3, borderColor: evaluation.needsTraining ? "warning.main" : "success.main" }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography fontWeight={900}>{formatDate(evaluation.createdAt)}</Typography>
                    <Chip size="small" color={evaluation.needsTraining ? "warning" : "success"} label={`Media ${evaluation.overallScore.toFixed(1)}`} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {evaluation.positiveNotes}
                  </Typography>
                  <Typography variant="body2" color={evaluation.needsTraining ? "warning.main" : "text.secondary"} sx={{ mt: 0.4 }}>
                    {evaluation.improvementNotes}
                  </Typography>
                </Box>
              ))
            )}
          </Stack>
        </Paper>
      </Box>
    </Stack>
  );
}

function Kpi({ label, value, helper, icon }: { label: string; value: string; helper: string; icon: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Stack direction="row" spacing={1.5} justifyContent="space-between">
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary" fontWeight={850}>
            {label}
          </Typography>
          <Typography variant="h5" sx={{ mt: 0.4 }} noWrap>
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {helper}
          </Typography>
        </Box>
        <Avatar variant="rounded" sx={{ bgcolor: "primary.light", color: "primary.dark" }}>
          {icon}
        </Avatar>
      </Stack>
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

function TagGroup({ title, items, color }: { title: string; items: string[]; color: "success" | "warning" }) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {title}
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {items.map((item) => (
          <Chip key={item} color={color} variant="outlined" label={item} />
        ))}
      </Stack>
    </Box>
  );
}
