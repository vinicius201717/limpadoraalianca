"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CameraAltRoundedIcon from "@mui/icons-material/CameraAltRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";

import {
  customers as demoCustomers,
  employees as demoEmployees,
  equipment as demoEquipment,
  evaluations as demoEvaluations,
  materialRequestItems as demoMaterialRequestItems,
  materialRequests as demoMaterialRequests,
  materials as demoMaterials,
  serviceOrderChecklistItems as demoServiceOrderChecklistItems,
  serviceOrderChecklistPhotos as demoServiceOrderChecklistPhotos,
  serviceOrderEquipment as demoServiceOrderEquipment,
  serviceOrderMaterials as demoServiceOrderMaterials,
} from "@/lib/demo-data";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { labelFor } from "@/lib/labels";
import { canCreateChecklist, canManageServiceOrderTeam, canOperateChecklist, canRequestServiceMaterials, canUpdateServiceOrderStatus, canValidateChecklistItem, canEvaluateEmployees, canViewServiceOrderFinancials } from "@/lib/permissions";
import { getMaterialOperationalStatus, normalizeStockStatus } from "@/lib/stock-status";
import type {
  ChecklistPhotoType,
  Customer,
  Employee,
  Equipment,
  Evaluation,
  MaterialRequestPriority,
  Material,
  ServiceMaterialRequest,
  ServiceMaterialRequestItem,
  ServiceTeamRole,
  ServiceOrder,
  ServiceOrderStatus,
  ServiceOrderChecklistItem,
  ServiceOrderChecklistPhoto,
  ServiceOrderEquipment,
  ServiceOrderMaterial,
  SessionUser,
} from "@/lib/types";
import { StatusChip } from "./StatusChip";
import { useCurrentUser } from "./useCurrentUser";

const tabLabels = ["Resumo", "Cliente", "Equipe", "Checklist", "Fotos", "Materiais", "Equipamentos", "Financeiro", "Avaliacoes", "Historico"];
const checklistStatusFilters = ["ALL", "PENDING", "IN_PROGRESS", "DONE", "BLOCKED", "REOPENED"] as const;
const serviceTeamRoleOptions: ServiceTeamRole[] = ["POLIDOR", "AUXILIAR", "TECNICO", "MOTORISTA", "ALMOXARIFADO", "OUTRO"];
const serviceOrderStatusOptions: ServiceOrderStatus[] = ["SCHEDULED", "PREPARING", "IN_PROGRESS", "PAUSED", "WAITING_CUSTOMER", "DONE", "DELIVERED", "CANCELED"];
type ChecklistActionMode = "assign" | "complete" | "block" | "reopen" | "photo";
type PendingChecklistPhoto = {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  caption: string;
};

const demoNowTime = Date.parse("2026-07-04T12:00:00");
const maxChecklistPhotoBytes = 6_000_000;
const allowedChecklistPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function assignedIdsFor(item: ServiceOrderChecklistItem) {
  return Array.from(new Set([...(item.assignedEmployeeIds ?? []), item.assignedEmployeeId].filter(Boolean))) as string[];
}

export function ServiceOrderDetailView({
  order: initialOrder,
  customers = demoCustomers,
  employees = demoEmployees,
  users = [],
  equipment = demoEquipment,
  evaluations = demoEvaluations,
  materials = demoMaterials,
  materialRequests = demoMaterialRequests,
  materialRequestItems = demoMaterialRequestItems,
  serviceOrderChecklistItems = demoServiceOrderChecklistItems,
  serviceOrderChecklistPhotos = demoServiceOrderChecklistPhotos,
  serviceOrderEquipment = demoServiceOrderEquipment,
  serviceOrderMaterials = demoServiceOrderMaterials,
}: {
  order: ServiceOrder;
  customers?: Customer[];
  employees?: Employee[];
  users?: SessionUser[];
  equipment?: Equipment[];
  evaluations?: Evaluation[];
  materials?: Material[];
  materialRequests?: ServiceMaterialRequest[];
  materialRequestItems?: ServiceMaterialRequestItem[];
  serviceOrderChecklistItems?: ServiceOrderChecklistItem[];
  serviceOrderChecklistPhotos?: ServiceOrderChecklistPhoto[];
  serviceOrderEquipment?: ServiceOrderEquipment[];
  serviceOrderMaterials?: ServiceOrderMaterial[];
}) {
  const { user } = useCurrentUser();
  const [order, setOrder] = useState(initialOrder);
  const [tab, setTab] = useState(0);
  const [localEvaluations, setLocalEvaluations] = useState<Evaluation[]>(evaluations);
  const [localChecklist, setLocalChecklist] = useState<ServiceOrderChecklistItem[]>(serviceOrderChecklistItems);
  const [localChecklistPhotos, setLocalChecklistPhotos] = useState<ServiceOrderChecklistPhoto[]>(serviceOrderChecklistPhotos);
  const [localServiceOrderEquipment, setLocalServiceOrderEquipment] = useState<ServiceOrderEquipment[]>(serviceOrderEquipment);
  const [localMaterialRequests, setLocalMaterialRequests] = useState<ServiceMaterialRequest[]>(materialRequests);
  const [localMaterialRequestItems, setLocalMaterialRequestItems] = useState<ServiceMaterialRequestItem[]>(materialRequestItems);
  const [notice, setNotice] = useState("");
  const [statusInput, setStatusInput] = useState<ServiceOrderStatus>(initialOrder.status);
  const [statusReason, setStatusReason] = useState("");
  const [statusError, setStatusError] = useState("");
  const [activeChecklistItem, setActiveChecklistItem] = useState<ServiceOrderChecklistItem | null>(null);
  const [checklistActionMode, setChecklistActionMode] = useState<ChecklistActionMode>("complete");
  const [checklistFilter, setChecklistFilter] = useState<(typeof checklistStatusFilters)[number]>("ALL");
  const [expandedChecklistItemId, setExpandedChecklistItemId] = useState<string | null>(null);
  const [completedByEmployeeId, setCompletedByEmployeeId] = useState(order.employeeIds[0] ?? "");
  const [assignedEmployeeIdsInput, setAssignedEmployeeIdsInput] = useState<string[]>([]);
  const [completionNotes, setCompletionNotes] = useState("");
  const [actionReason, setActionReason] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoType, setPhotoType] = useState<ChecklistPhotoType>("EVIDENCE");
  const [photoCaption, setPhotoCaption] = useState("");
  const [pendingPhotos, setPendingPhotos] = useState<PendingChecklistPhoto[]>([]);
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [newChecklistDescription, setNewChecklistDescription] = useState("");
  const [newChecklistPriority, setNewChecklistPriority] = useState(false);
  const [newChecklistRequiresPhoto, setNewChecklistRequiresPhoto] = useState(false);
  const [newChecklistAllowCollaborator, setNewChecklistAllowCollaborator] = useState(true);
  const [checklistError, setChecklistError] = useState("");
  const [materialRequestMaterialId, setMaterialRequestMaterialId] = useState(materials[0]?.id ?? "");
  const [materialRequestQuantity, setMaterialRequestQuantity] = useState("1");
  const [materialRequestPriority, setMaterialRequestPriority] = useState<MaterialRequestPriority>("NORMAL");
  const [materialRequestReason, setMaterialRequestReason] = useState("");
  const [materialRequestNotes, setMaterialRequestNotes] = useState("");
  const [materialRequestError, setMaterialRequestError] = useState("");
  const [equipmentRequestError, setEquipmentRequestError] = useState("");
  const [teamEmployeeId, setTeamEmployeeId] = useState("");
  const [teamRole, setTeamRole] = useState<ServiceTeamRole>("AUXILIAR");
  const [supervisorEmployeeId, setSupervisorEmployeeId] = useState(initialOrder.supervisorEmployeeId ?? "");
  const [teamError, setTeamError] = useState("");
  const team = employees.filter((employee) => order.employeeIds.includes(employee.id));
  const linkedEmployee = employees.find((employee) => employee.userId === user?.id);
  const customer = customers.find((item) => item.id === order.customerId);
  const canManageTeam = canManageServiceOrderTeam(user?.role ?? "COLABORADOR");
  const canAddChecklistItems = canCreateChecklist(user?.role ?? "COLABORADOR");
  const canEvaluate = canEvaluateEmployees(user?.role ?? "COLABORADOR");
  const canOperate = canOperateChecklist(user?.role ?? "COLABORADOR");
  const canRequestMaterials = canRequestServiceMaterials(user?.role ?? "COLABORADOR");
  const canUpdateStatus = canUpdateServiceOrderStatus(user?.role ?? "COLABORADOR");
  const canValidate = canValidateChecklistItem(user?.role ?? "COLABORADOR");
  const canViewFinancials = canViewServiceOrderFinancials(user?.role ?? "COLABORADOR");
  const checklist = localChecklist
    .filter((item) => item.serviceOrderId === order.id)
    .sort((a, b) => Number(Boolean(b.isPriority)) - Number(Boolean(a.isPriority)) || a.sortOrder - b.sortOrder);
  const filteredChecklist = checklist.filter((item) => checklistFilter === "ALL" || item.status === checklistFilter);
  const orderMaterials = serviceOrderMaterials.filter((item) => item.serviceOrderId === order.id);
  const orderEquipment = localServiceOrderEquipment.filter((item) => item.serviceOrderId === order.id);
  const orderMaterialRequests = localMaterialRequests.filter((item) => item.serviceOrderId === order.id);
  const availableMaterials = materials.filter(
    (material) =>
      material.currentStock > 0 &&
      !["IN_MAINTENANCE", "DAMAGED", "UNAVAILABLE", "OUT_OF_STOCK"].includes(getMaterialOperationalStatus(material)),
  );
  const activeEquipmentIds = new Set(
    localServiceOrderEquipment
      .filter((item) => item.status === "REQUESTED" || item.status === "RESERVED" || item.status === "DELIVERED" || item.status === "IN_USE")
      .map((item) => item.equipmentId),
  );
  const availableEquipment = equipment.filter((item) => {
    return !activeEquipmentIds.has(item.id) && normalizeStockStatus(item.status) === "AVAILABLE";
  });
  const supervisorOptions = employees.filter((employee) => {
    if (employee.status !== "ACTIVE" || !employee.userId) return false;
    const linkedUser = users.find((item) => item.id === employee.userId);
    return linkedUser?.role === "SUPERVISOR_OBRA" && linkedUser.isActive;
  });
  const assignableEmployees = employees.filter((employee) => employee.status === "ACTIVE" && !order.employeeIds.includes(employee.id));

  const checklistStats = (() => {
    const activeItems = checklist.filter((item) => item.status !== "CANCELED");
    const requiredItems = activeItems.filter((item) => item.isRequired);
    const completedRequired = requiredItems.filter((task) => task.status === "DONE").length;
    const validatedItems = activeItems.filter((item) => item.validatedAt || item.validatedByUserId).length;
    const pendingPhotoItems = activeItems.filter((item) => {
      if (!item.requiresPhoto) return false;
      const photoCount = localChecklistPhotos.filter((photo) => photo.checklistItemId === item.id).length;
      return photoCount < Math.max(item.minimumPhotos, 1);
    }).length;
    const overdueItems = activeItems.filter((item) => {
      if (!item.dueAt || item.status === "DONE") return false;
      return new Date(item.dueAt).getTime() < demoNowTime;
    }).length;

    return {
      progress: requiredItems.length ? Math.round((completedRequired / requiredItems.length) * 100) : 0,
      validatedPercent: activeItems.length ? Math.round((validatedItems / activeItems.length) * 100) : 0,
      completedRequired,
      requiredTotal: requiredItems.length,
      blocked: activeItems.filter((item) => item.status === "BLOCKED").length,
      pending: activeItems.filter((item) => item.status === "PENDING" || item.status === "REOPENED").length,
      pendingPhotoItems,
      overdueItems,
    };
  })();
  const progress = checklistStats.progress;

  const orderEvaluations = localEvaluations.filter((evaluation) => evaluation.serviceOrderId === order.id);
  const evaluatedTeam = team.filter((employee) =>
    orderEvaluations.some((evaluation) => evaluation.employeeId === employee.id),
  );
  const teamAverage = average(orderEvaluations.map((evaluation) => evaluation.overallScore));
  const marginLabel = order.revenue > 0 ? `${Math.round(((order.revenue - order.expenses) / order.revenue) * 100)}%` : "-";

  function userName(userId?: string) {
    return users.find((item) => item.id === userId)?.name ?? "Usuario do sistema";
  }

  async function assignSupervisor() {
    setTeamError("");
    setNotice("");
    if (!supervisorEmployeeId) {
      setTeamError("Selecione um supervisor para a obra.");
      return;
    }

    const response = await fetch(`/api/service-orders/${order.id}/assign-supervisor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supervisorEmployeeId }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setTeamError(data?.message ?? "Nao foi possivel designar supervisor.");
      return;
    }

    setOrder(data.serviceOrder);
    setNotice(data?.message ?? "Supervisor designado para a obra.");
  }

  async function addTeamEmployee() {
    setTeamError("");
    setNotice("");
    if (!teamEmployeeId) {
      setTeamError("Selecione um colaborador para adicionar a equipe.");
      return;
    }

    const response = await fetch(`/api/service-orders/${order.id}/employees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: teamEmployeeId, roleInService: teamRole }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setTeamError(data?.message ?? "Nao foi possivel adicionar colaborador.");
      return;
    }

    setOrder((current) => ({
      ...current,
      employeeIds: current.employeeIds.includes(teamEmployeeId) ? current.employeeIds : [...current.employeeIds, teamEmployeeId],
    }));
    setTeamEmployeeId("");
    setNotice(data?.message ?? "Colaborador adicionado a equipe.");
  }

  async function updateServiceOrderStatus() {
    setStatusError("");
    setNotice("");

    const response = await fetch(`/api/service-orders/${order.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: statusInput, reason: statusReason }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setStatusError(data?.message ?? "Nao foi possivel atualizar o status da OS.");
      return;
    }

    setOrder(data.serviceOrder);
    setStatusInput(data.serviceOrder.status);
    setStatusReason("");
    setNotice(`Status atualizado para ${labelFor(data.serviceOrder.status)}.`);
  }

  async function submitMaterialRequest() {
    setMaterialRequestError("");
    setNotice("");
    const quantity = Number(materialRequestQuantity);
    if (!materialRequestMaterialId) {
      setMaterialRequestError("Selecione um material.");
      return;
    }
    if (!quantity || quantity <= 0) {
      setMaterialRequestError("Informe uma quantidade maior que zero.");
      return;
    }
    if (materialRequestReason.trim().length < 3) {
      setMaterialRequestError("Informe o motivo da solicitacao.");
      return;
    }

    const response = await fetch(`/api/service-orders/${order.id}/material-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: materialRequestReason,
        priority: materialRequestPriority,
        items: [
          {
            materialId: materialRequestMaterialId,
            quantity,
            notes: materialRequestNotes,
          },
        ],
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setMaterialRequestError(data?.message ?? "Nao foi possivel solicitar material extra.");
      return;
    }

    setLocalMaterialRequests((current) => [data.request, ...current]);
    setLocalMaterialRequestItems((current) => [...(data.items ?? []), ...current]);
    setMaterialRequestQuantity("1");
    setMaterialRequestReason("");
    setMaterialRequestNotes("");
    setNotice("Solicitacao de material extra enviada para o almoxarifado.");
  }

  async function requestEquipment(equipmentId: string) {
    setEquipmentRequestError("");
    setNotice("");
    const response = await fetch(`/api/service-orders/${order.id}/equipment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        equipmentId,
        conditionBefore: "Aguardando conferencia do almoxarifado",
        notes: "Solicitado pela equipe da OS.",
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setEquipmentRequestError(data?.message ?? "Nao foi possivel solicitar o equipamento.");
      return;
    }
    setLocalServiceOrderEquipment((current) => [data.equipment, ...current]);
    setNotice("Equipamento solicitado ao almoxarifado.");
  }

  async function quickEvaluate(employeeId: string, employeeName: string) {
    setNotice("");

    const response = await fetch("/api/evaluations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceOrderId: order.id,
        employeeId,
        employeeName,
        punctualityScore: 5,
        qualityScore: 5,
        productivityScore: 4,
        careScore: 5,
        teamworkScore: 5,
        clientPostureScore: 5,
        checklistComplianceScore: 5,
        positiveNotes: "Avaliacao registrada pela supervisao na OS.",
        improvementNotes: "Manter padrao e complementar relatorio fotografico quando necessario.",
        seriousIssue: false,
        needsTraining: false,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      setLocalEvaluations((current) => [data.evaluation, ...current]);
      setNotice(`${employeeName} avaliado com sucesso. Media calculada automaticamente.`);
    }
  }

  async function createChecklistItemFromForm() {
    setChecklistError("");
    setNotice("");
    const title = newChecklistTitle.trim();
    if (!title) {
      setChecklistError("Informe o titulo do item do checklist.");
      return;
    }

    const response = await fetch(`/api/service-orders/${order.id}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: newChecklistDescription,
        sortOrder: checklist.length + 1,
        isRequired: true,
        isPriority: newChecklistPriority,
        requiresPhoto: newChecklistRequiresPhoto,
        minimumPhotos: newChecklistRequiresPhoto ? 1 : 0,
        allowCollaboratorAction: newChecklistAllowCollaborator,
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setChecklistError(data?.message ?? "Nao foi possivel acrescentar item ao checklist.");
      return;
    }

    setLocalChecklist((current) => [data.item, ...current]);
    setNewChecklistTitle("");
    setNewChecklistDescription("");
    setNewChecklistPriority(false);
    setNewChecklistRequiresPhoto(false);
    setNewChecklistAllowCollaborator(true);
    setNotice("Item acrescentado ao checklist com autoria registrada.");
  }

  function updateChecklistItemFromApi(item: ServiceOrderChecklistItem) {
    setLocalChecklist((current) => current.map((candidate) => (candidate.id === item.id ? item : candidate)));
  }

  function openChecklistAction(item: ServiceOrderChecklistItem, mode: ChecklistActionMode) {
    const assignedIds = assignedIdsFor(item);
    setActiveChecklistItem(item);
    setChecklistActionMode(mode);
    setAssignedEmployeeIdsInput(assignedIds);
    setCompletedByEmployeeId(item.completedByEmployeeId ?? assignedIds[0] ?? linkedEmployee?.id ?? order.employeeIds[0] ?? "");
    setCompletionNotes(item.completionNotes ?? item.notes ?? "");
    setActionReason("");
    setPhotoUrl("");
    setPhotoType(item.status === "PENDING" ? "BEFORE" : "EVIDENCE");
    setPhotoCaption("");
    setPendingPhotos([]);
  }

  function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error("Nao foi possivel ler a imagem."));
      reader.readAsDataURL(file);
    });
  }

  async function handleChecklistPhotoUpload(files: FileList | null) {
    if (!files?.length) return;

    const selectedFiles = Array.from(files);
    const validFiles = selectedFiles.filter((file) => allowedChecklistPhotoTypes.has(file.type) && file.size <= maxChecklistPhotoBytes);
    if (validFiles.length !== selectedFiles.length) {
      setNotice("Algumas imagens foram ignoradas. Use JPEG, PNG ou WebP com ate 6 MB por arquivo.");
    }

    const uploadedPhotos = await Promise.all(
      validFiles.map(async (file, index) => ({
        id: `${file.name}-${file.lastModified}-${Date.now()}-${index}`,
        url: await readFileAsDataUrl(file),
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        caption: "",
      })),
    );

    setPendingPhotos((current) => [...current, ...uploadedPhotos]);
  }

  function updatePendingPhotoCaption(photoId: string, caption: string) {
    setPendingPhotos((current) => current.map((photo) => (photo.id === photoId ? { ...photo, caption } : photo)));
  }

  function removePendingPhoto(photoId: string) {
    setPendingPhotos((current) => current.filter((photo) => photo.id !== photoId));
  }

  function buildChecklistPhotoPayloads() {
    const manualPhotoUrl = photoUrl.trim();
    return [
      ...pendingPhotos.map((photo) => ({
        url: photo.url,
        type: photoType,
        caption: photo.caption.trim(),
        fileName: photo.fileName,
        mimeType: photo.mimeType,
        sizeBytes: photo.sizeBytes,
      })),
      ...(manualPhotoUrl
        ? [
            {
              url: manualPhotoUrl,
              type: photoType,
              caption: photoCaption || "Evidencia anexada ao item",
              fileName: manualPhotoUrl.split("/").pop(),
            },
          ]
        : []),
    ];
  }

  async function runChecklistAction(path: string, body?: Record<string, unknown>) {
    const response = await fetch(path, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setNotice(data?.message ?? "Nao foi possivel executar a acao do checklist.");
      return null;
    }
    if (data?.item) updateChecklistItemFromApi(data.item);
    if (data?.photo) setLocalChecklistPhotos((current) => [data.photo, ...current]);
    if (data?.photos?.length) setLocalChecklistPhotos((current) => [...data.photos, ...current]);
    return data;
  }

  async function completeChecklist() {
    if (!activeChecklistItem) return;
    setNotice("");
    const photos = buildChecklistPhotoPayloads();

    const data = await runChecklistAction(`/api/service-orders/${order.id}/checklist/${activeChecklistItem.id}/complete`, {
        completedByEmployeeId,
        completionNotes,
        photos,
      });
    if (!data) return;
    setNotice("Item de checklist concluido com responsavel e evidencia.");
    setActiveChecklistItem(null);
    setCompletionNotes("");
    setPhotoUrl("");
    setPhotoCaption("");
    setPendingPhotos([]);
  }

  async function uploadChecklistPhotos() {
    if (!activeChecklistItem) return;
    setNotice("");
    const photos = buildChecklistPhotoPayloads();

    if (photos.length === 0) {
      setNotice("Selecione ao menos uma imagem para anexar ao item.");
      return;
    }

    for (const photo of photos) {
      const data = await runChecklistAction(`/api/service-orders/${order.id}/checklist/${activeChecklistItem.id}/photos`, photo);
      if (!data) return;
    }

    setNotice("Imagem(ns) anexada(s) ao item do checklist.");
    setActiveChecklistItem(null);
    setPhotoUrl("");
    setPhotoCaption("");
    setPendingPhotos([]);
  }

  async function submitChecklistDialog() {
    if (!activeChecklistItem) return;
    setNotice("");

    if (checklistActionMode === "assign") {
      const data = await runChecklistAction(`/api/service-orders/${order.id}/checklist/${activeChecklistItem.id}/assign`, {
        employeeIds: assignedEmployeeIdsInput,
      });
      if (data) {
        setNotice("Colaboradores atribuidos ao item.");
        setActiveChecklistItem(null);
      }
      return;
    }

    if (checklistActionMode === "complete") {
      await completeChecklist();
      return;
    }

    if (checklistActionMode === "photo") {
      await uploadChecklistPhotos();
      return;
    }

    const endpoint = checklistActionMode === "block" ? "block" : "reopen";
    const data = await runChecklistAction(`/api/service-orders/${order.id}/checklist/${activeChecklistItem.id}/${endpoint}`, {
      reason: actionReason,
    });
    if (data) {
      setNotice(checklistActionMode === "block" ? "Item bloqueado com motivo registrado." : "Item reaberto para correcao.");
      setActiveChecklistItem(null);
      setActionReason("");
    }
  }

  async function quickChecklistAction(item: ServiceOrderChecklistItem, action: "start" | "validate" | "unblock") {
    setNotice("");
    const data = await runChecklistAction(`/api/service-orders/${order.id}/checklist/${item.id}/${action}`);
    if (data) {
      const label = action === "start" ? "iniciado" : action === "validate" ? "validado" : "desbloqueado";
      setNotice(`Item ${label} com sucesso.`);
    }
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={2}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="h4" sx={{ fontSize: { xs: 28, md: 34 } }} noWrap>
              {order.title}
            </Typography>
            <StatusChip value={order.status} />
          </Stack>
          <Typography color="text.secondary" noWrap>
            {order.customerName} - {order.address}
          </Typography>
        </Box>
        <Button component={Link} href="/ordens-servico" startIcon={<ArrowBackRoundedIcon />}>
          Voltar
        </Button>
      </Stack>

      {notice && <Alert severity={notice.includes("Nao") ? "warning" : "success"}>{notice}</Alert>}
      {statusError && <Alert severity="warning">{statusError}</Alert>}

      {canUpdateStatus && (
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
          <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} alignItems={{ lg: "center" }} justifyContent="space-between">
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6">Status do servico</Typography>
              <Typography variant="body2" color="text.secondary">
                Atualize o andamento operacional da OS para manter dashboard, equipe e historico alinhados.
              </Typography>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} sx={{ width: { xs: "100%", lg: "auto" } }}>
              <TextField
                select
                size="small"
                label="Novo status"
                value={statusInput}
                onChange={(event) => setStatusInput(event.target.value as ServiceOrderStatus)}
                sx={{ minWidth: { xs: "100%", sm: 210 } }}
              >
                {serviceOrderStatusOptions.map((status) => (
                  <MenuItem key={status} value={status}>
                    {labelFor(status)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                label="Motivo/observacao"
                value={statusReason}
                onChange={(event) => setStatusReason(event.target.value)}
                sx={{ minWidth: { xs: "100%", sm: 260 } }}
              />
              <Button variant="contained" onClick={updateServiceOrderStatus} disabled={statusInput === order.status && !statusReason.trim()}>
                Atualizar
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
        <Kpi label="Checklist" value={`${progress}%`} helper={`${checklist.filter((task) => task.status === "DONE").length}/${checklist.length} etapas`} />
        <Kpi label="Equipe" value={String(team.length)} helper={`${evaluatedTeam.length} avaliados`} />
        <Kpi label={canViewFinancials ? "Receita" : "Financeiro"} value={canViewFinancials ? formatCurrency(order.revenue) : "Restrito"} helper={canViewFinancials ? `Margem ${marginLabel}` : "Visivel apenas para dono e financeiro"} />
        <Kpi label="Supervisor" value={employees.find((employee) => employee.id === order.supervisorEmployeeId)?.name ?? "Pendente"} helper="Responsavel principal" />
      </Box>

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        <Tabs value={tab} onChange={(_, value: number) => setTab(value)} variant="scrollable" scrollButtons="auto" sx={{ px: 1, borderBottom: 1, borderColor: "divider" }}>
          {tabLabels.map((label) => (
            <Tab key={label} label={label} />
          ))}
        </Tabs>

        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          {tab === 0 && (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 0.9fr" }, gap: 2.5 }}>
              <Stack spacing={2}>
                <Typography variant="h6">Resumo da OS</Typography>
                <Typography color="text.secondary">{order.description}</Typography>
                <Divider />
                <InfoGrid
                  items={[
                    ["Tipo de servico", labelFor(order.serviceType ?? "-")],
                    ["Inicio previsto", formatDateTime(order.scheduledStart)],
                    ["Fim previsto", formatDateTime(order.scheduledEnd)],
                    ["Endereco", order.address],
                    ["Observacoes internas", order.internalNotes],
                  ]}
                />
              </Stack>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "background.default" }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Execucao
                </Typography>
                <Stack spacing={1.5}>
                  <LinearProgress variant="determinate" value={progress} sx={{ height: 10, borderRadius: 999 }} />
                  <Typography variant="body2" color="text.secondary">
                    {progress}% do checklist concluido
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {team.map((employee) => (
                      <Chip key={employee.id} label={employee.name} variant="outlined" />
                    ))}
                  </Stack>
                </Stack>
              </Paper>
            </Box>
          )}

          {tab === 1 && (
            <InfoGrid
              items={[
                ["Cliente", order.customerName],
                ["Telefone", customer?.phone ?? "-"],
                ["E-mail", customer?.email ?? "-"],
                ["Origem", customer?.source ?? "-"],
                ["Endereco", order.address],
                ["Notas ao cliente", order.clientNotes],
              ]}
            />
          )}

          {tab === 2 && (
            <Stack spacing={1.5}>
              {canManageTeam && (
                <Box sx={{ p: 2, borderRadius: 2, bgcolor: "background.default", border: 1, borderColor: "divider" }}>
                  <Stack spacing={2}>
                    <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} alignItems={{ lg: "center" }}>
                      <TextField
                        select
                        label="Supervisor principal"
                        value={supervisorEmployeeId}
                        onChange={(event) => setSupervisorEmployeeId(event.target.value)}
                        size="small"
                        sx={{ minWidth: { xs: "100%", lg: 280 } }}
                      >
                        <MenuItem value="">Selecione</MenuItem>
                        {supervisorOptions.map((employee) => (
                          <MenuItem key={employee.id} value={employee.id}>
                            {employee.name}
                          </MenuItem>
                        ))}
                      </TextField>
                      <Button variant="outlined" onClick={assignSupervisor} disabled={!supervisorEmployeeId}>
                        Definir supervisor
                      </Button>
                    </Stack>

                    <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} alignItems={{ lg: "center" }}>
                      <TextField
                        select
                        label="Adicionar colaborador"
                        value={teamEmployeeId}
                        onChange={(event) => setTeamEmployeeId(event.target.value)}
                        size="small"
                        sx={{ minWidth: { xs: "100%", lg: 280 } }}
                      >
                        <MenuItem value="">Selecione</MenuItem>
                        {assignableEmployees.map((employee) => (
                          <MenuItem key={employee.id} value={employee.id}>
                            {employee.name} - {employee.roleName}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        select
                        label="Funcao na obra"
                        value={teamRole}
                        onChange={(event) => setTeamRole(event.target.value as ServiceTeamRole)}
                        size="small"
                        sx={{ minWidth: { xs: "100%", lg: 190 } }}
                      >
                        {serviceTeamRoleOptions.map((role) => (
                          <MenuItem key={role} value={role}>
                            {labelFor(role)}
                          </MenuItem>
                        ))}
                      </TextField>
                      <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={addTeamEmployee} disabled={!teamEmployeeId}>
                        Adicionar a equipe
                      </Button>
                    </Stack>
                    {teamError && <Alert severity="error">{teamError}</Alert>}
                  </Stack>
                </Box>
              )}

              {team.length === 0 && (
                <Alert severity="info">Nenhum colaborador foi designado para esta obra ainda.</Alert>
              )}

              {team.map((employee) => (
                <Box key={employee.id} sx={{ p: 2, borderRadius: 2, bgcolor: "background.default", border: 1, borderColor: "divider" }}>
                  <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1.5}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar sx={{ bgcolor: employee.id === order.supervisorEmployeeId ? "secondary.main" : employee.needsTraining ? "warning.main" : "primary.main" }}>{employee.name.slice(0, 1)}</Avatar>
                      <Box>
                        <Typography fontWeight={900}>{employee.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {employee.id === order.supervisorEmployeeId ? "Supervisor principal" : employee.specialty}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Chip icon={<StarRoundedIcon />} label={employee.averageRating.toFixed(1)} color="secondary" variant="outlined" />
                      {employee.needsTraining && <Chip icon={<WarningAmberRoundedIcon />} label="Treinamento" color="warning" />}
                    </Stack>
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}

          {tab === 3 && (
            <Stack spacing={2}>
              {!canOperate && user?.role !== "COLABORADOR" && (
                <Alert severity="warning" icon={<LockRoundedIcon />}>
                  Seu perfil pode consultar o checklist, mas nao pode alterar a execucao operacional.
                </Alert>
              )}
              {canAddChecklistItems && (
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "background.default" }}>
                  <Stack spacing={1.5}>
                    <Typography variant="h6">Acrescentar item ao checklist</Typography>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.4fr 2fr" }, gap: 1.5 }}>
                      <TextField
                        label="Item do checklist"
                        value={newChecklistTitle}
                        onChange={(event) => setNewChecklistTitle(event.target.value)}
                        size="small"
                      />
                      <TextField
                        label="Detalhes do item"
                        value={newChecklistDescription}
                        onChange={(event) => setNewChecklistDescription(event.target.value)}
                        size="small"
                      />
                    </Box>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap>
                      <FormControlLabel
                        control={<Checkbox checked={newChecklistPriority} onChange={(event) => setNewChecklistPriority(event.target.checked)} />}
                        label="Prioridade"
                      />
                      <FormControlLabel
                        control={<Checkbox checked={newChecklistRequiresPhoto} onChange={(event) => setNewChecklistRequiresPhoto(event.target.checked)} />}
                        label="Exigir foto"
                      />
                      <FormControlLabel
                        control={<Checkbox checked={newChecklistAllowCollaborator} onChange={(event) => setNewChecklistAllowCollaborator(event.target.checked)} />}
                        label="Colaborador pode executar"
                      />
                    </Stack>
                    {checklistError && <Alert severity="error">{checklistError}</Alert>}
                    <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={createChecklistItemFromForm} sx={{ alignSelf: "flex-start" }}>
                      Adicionar item
                    </Button>
                  </Stack>
                </Paper>
              )}

              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(5, minmax(0, 1fr))" }, gap: 1.5 }}>
                <Kpi label="Execucao" value={`${checklistStats.progress}%`} helper={`${checklistStats.completedRequired}/${checklistStats.requiredTotal} obrigatorios`} />
                <Kpi label="Validado" value={`${checklistStats.validatedPercent}%`} helper="Conferencia da supervisao" />
                <Kpi label="Bloqueados" value={String(checklistStats.blocked)} helper="Precisam de destrave" />
                <Kpi label="Fotos pendentes" value={String(checklistStats.pendingPhotoItems)} helper="Evidencia obrigatoria" />
                <Kpi label="Atrasados" value={String(checklistStats.overdueItems)} helper="Prazo vencido" />
              </Box>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {checklistStatusFilters.map((filter) => (
                  <Chip
                    key={filter}
                    label={labelFor(filter)}
                    color={checklistFilter === filter ? "primary" : "default"}
                    variant={checklistFilter === filter ? "filled" : "outlined"}
                    onClick={() => setChecklistFilter(filter)}
                  />
                ))}
              </Stack>

              {filteredChecklist.map((item) => {
                const photos = localChecklistPhotos.filter((photo) => photo.checklistItemId === item.id);
                const assignedIds = assignedIdsFor(item);
                const assignedTeam = team.filter((employee) => assignedIds.includes(employee.id));
                const responsible = employees.find((employee) => employee.id === item.completedByEmployeeId);
                const overdue = Boolean(item.dueAt && new Date(item.dueAt).getTime() < demoNowTime && item.status !== "DONE" && item.status !== "CANCELED");
                const isExpanded = expandedChecklistItemId === item.id;
                const startedByOther = Boolean(user?.role === "COLABORADOR" && item.startedByUserId && item.startedByUserId !== user.id);
                const isAvailable = item.status === "PENDING" || item.status === "REOPENED";
                const userCanOperateItem =
                  canOperate ||
                  Boolean(
                    user?.role === "COLABORADOR" &&
                      linkedEmployee?.id &&
                      item.allowCollaboratorAction &&
                      assignedIds.includes(linkedEmployee.id),
                  );
                const isAssignedToLoggedCollaborator = Boolean(user?.role === "COLABORADOR" && linkedEmployee?.id && assignedIds.includes(linkedEmployee.id));
                return (
                  <Paper
                    key={item.id}
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: isAssignedToLoggedCollaborator ? "action.selected" : "background.default",
                      borderColor: isAssignedToLoggedCollaborator ? "primary.main" : "divider",
                      boxShadow: isAssignedToLoggedCollaborator ? "0 0 0 1px rgba(0, 121, 107, 0.28), 0 10px 24px rgba(15, 23, 42, 0.08)" : "none",
                      transition: "border-color .2s, box-shadow .2s, background-color .2s",
                    }}
                  >
                    <Stack spacing={1.5}>
                      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                            <Typography fontWeight={900}>{item.sortOrder}. {item.title}</Typography>
                            {isAssignedToLoggedCollaborator && <Chip size="small" color="primary" icon={<PersonRoundedIcon />} label="Minha tarefa" />}
                            {item.isPriority && <Chip size="small" color="error" icon={<WarningAmberRoundedIcon />} label="Prioridade" />}
                            <StatusChip value={item.status} />
                            {item.requiresPhoto && <Chip size="small" icon={<CameraAltRoundedIcon />} label={`${photos.length}/${Math.max(item.minimumPhotos, 1)} fotos`} />}
                            {item.validatedAt && <Chip size="small" color="success" icon={<VerifiedRoundedIcon />} label="Validado" />}
                            {overdue && <Chip size="small" color="error" icon={<WarningAmberRoundedIcon />} label="Atrasado" />}
                          </Stack>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {assignedTeam.length ? `Equipe: ${assignedTeam.map((employee) => employee.name).join(", ")}` : "Sem responsavel definido"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Acrescentado por {userName(item.createdByUserId)}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent={{ md: "flex-end" }}>
                          <Button
                            size="small"
                            variant="text"
                            endIcon={<ExpandMoreRoundedIcon sx={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform .2s" }} />}
                            onClick={() => setExpandedChecklistItemId(isExpanded ? null : item.id)}
                          >
                            {isExpanded ? "Ver menos" : "Ver mais"}
                          </Button>
                          <Button size="small" variant="outlined" disabled={!canOperate} onClick={() => openChecklistAction(item, "assign")}>
                            Atribuir
                          </Button>
                          <Button size="small" variant="outlined" startIcon={<PlayArrowRoundedIcon />} disabled={!userCanOperateItem || !isAvailable || startedByOther} onClick={() => quickChecklistAction(item, "start")}>
                            Iniciar
                          </Button>
                          <Button size="small" variant="contained" startIcon={<CheckCircleRoundedIcon />} disabled={!userCanOperateItem || startedByOther || item.status === "DONE" || item.status === "BLOCKED" || item.status === "CANCELED"} onClick={() => openChecklistAction(item, "complete")}>
                            Concluir
                          </Button>
                        </Stack>
                      </Stack>
                      {isExpanded && (
                        <>
                          <Typography variant="body2" color="text.secondary">
                            {item.description || "Sem descricao detalhada."}
                          </Typography>
                      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" }, gap: 1.2 }}>
                        <Info label="Atribuido a" value={assignedTeam.map((employee) => employee.name).join(", ") || "Sem responsavel"} />
                        <Info label="Executado por" value={responsible?.name ?? "Pendente"} />
                        <Info label="Acrescentado por" value={userName(item.createdByUserId)} />
                        <Info label="Prazo" value={item.dueAt ? formatDateTime(item.dueAt) : "Sem prazo"} />
                        <Info label="Conclusao" value={item.completedAt ? formatDateTime(item.completedAt) : "Pendente"} />
                      </Box>
                      {startedByOther && (
                        <Alert severity="info">Este item ja foi iniciado por outro usuario e nao esta disponivel para selecao.</Alert>
                      )}
                      {(item.completionNotes || item.problemDescription || item.blockedReason) && (
                        <Alert severity={item.status === "BLOCKED" ? "warning" : "info"}>
                          {item.blockedReason || item.problemDescription || item.completionNotes}
                        </Alert>
                      )}
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Button size="small" variant="outlined" disabled={!canValidate || item.status !== "DONE" || Boolean(item.validatedAt)} startIcon={<VerifiedRoundedIcon />} onClick={() => quickChecklistAction(item, "validate")}>
                          Validar
                        </Button>
                        {item.status === "BLOCKED" ? (
                          <Button size="small" variant="outlined" disabled={!canOperate} onClick={() => quickChecklistAction(item, "unblock")}>
                            Desbloquear
                          </Button>
                        ) : (
                          <Button size="small" variant="outlined" disabled={!canOperate || item.status === "DONE" || item.status === "CANCELED"} startIcon={<BlockRoundedIcon />} onClick={() => openChecklistAction(item, "block")}>
                            Bloquear
                          </Button>
                        )}
                        <Button size="small" variant="outlined" disabled={!userCanOperateItem || startedByOther || item.status === "CANCELED"} startIcon={<CameraAltRoundedIcon />} onClick={() => openChecklistAction(item, "photo")}>
                          Enviar fotos
                        </Button>
                        <Button size="small" variant="outlined" disabled={!canValidate || item.status === "CANCELED"} startIcon={<ReplayRoundedIcon />} onClick={() => openChecklistAction(item, "reopen")}>
                          Reabrir
                        </Button>
                      </Stack>
                      {photos.length > 0 && (
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          {photos.map((photo) => (
                            <Chip key={photo.id} size="small" icon={<CameraAltRoundedIcon />} label={`${labelFor(photo.type)}: ${photo.caption || photo.fileName || "foto"}`} />
                          ))}
                        </Stack>
                      )}
                        </>
                      )}
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}

          {tab === 4 && (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
              {["Antes", "Durante", "Depois"].map((stage, index) => (
                <Paper key={stage} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
                  <Box sx={{ minHeight: 154, bgcolor: index === 0 ? "action.hover" : index === 1 ? "primary.light" : "success.light", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CameraAltRoundedIcon sx={{ fontSize: 42, color: index === 0 ? "text.secondary" : "common.white" }} />
                  </Box>
                  <Box sx={{ p: 2 }}>
                    <Typography variant="h6">{stage}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Fotos de {stage.toLowerCase()} vinculadas ao checklist e garantia.
                    </Typography>
                    <Chip sx={{ mt: 1.2 }} size="small" label={`${8 + index * 5} fotos`} />
                  </Box>
                </Paper>
              ))}
            </Box>
          )}

          {tab === 5 && (
            <Stack spacing={2}>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 1.5 }}>
                <Kpi label="Materiais da empresa" value={String(materials.length)} helper="Cadastro completo" />
                <Kpi label="Disponiveis" value={String(availableMaterials.length)} helper="Com estoque positivo" />
                <Kpi label="Nesta OS" value={String(orderMaterials.length)} helper="Planejado ou entregue" />
              </Box>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "background.default" }}>
                <Typography variant="h6" sx={{ mb: 1.5 }}>
                  Materiais sendo usados neste servico
                </Typography>
                {orderMaterials.length === 0 ? (
                  <Alert severity="info">Nenhum material foi vinculado a esta OS ainda.</Alert>
                ) : (
                  <Stack spacing={1.2}>
                    {orderMaterials.map((item) => {
                      const material = materials.find((candidate) => candidate.id === item.materialId);
                      return (
                        <Box key={item.id} sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: "divider" }}>
                          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
                            <Box>
                              <Typography fontWeight={900}>{material?.name ?? "Material"}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                Planejado {item.plannedQuantity} {material?.unit ?? ""} | Separado {item.separatedQuantity} | Entregue {item.deliveredQuantity} | Consumido {item.consumedQuantity}
                              </Typography>
                              {item.notes && (
                                <Typography variant="caption" color="text.secondary">
                                  {item.notes}
                                </Typography>
                              )}
                            </Box>
                            <StatusChip value={item.status} />
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </Paper>

              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "1fr 1fr" }, gap: 2 }}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    Todos os materiais da empresa
                  </Typography>
                  {materials.length === 0 ? (
                    <Typography color="text.secondary">Nenhum material cadastrado.</Typography>
                  ) : (
                    <Stack spacing={1}>
                      {materials.map((material) => (
                        <Box key={material.id} sx={{ p: 1.2, borderRadius: 2, bgcolor: "background.default", border: 1, borderColor: "divider" }}>
                          <Stack direction="row" justifyContent="space-between" gap={1}>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography fontWeight={900}>{material.name}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                Estoque {material.currentStock} {material.unit} | minimo {material.minStock} {material.unit}
                              </Typography>
                            </Box>
                            <Chip size="small" color={material.currentStock <= material.minStock ? "warning" : "success"} label={material.currentStock <= material.minStock ? "Baixo" : "OK"} />
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Paper>

                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    Materiais disponiveis
                  </Typography>
                  {availableMaterials.length === 0 ? (
                    <Typography color="text.secondary">Nenhum material com estoque positivo.</Typography>
                  ) : (
                    <Stack spacing={1}>
                      {availableMaterials.map((material) => (
                        <Box key={material.id} sx={{ p: 1.2, borderRadius: 2, bgcolor: "background.default", border: 1, borderColor: "divider" }}>
                          <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
                            <Box sx={{ minWidth: 0 }}>
                              <Typography fontWeight={900}>{material.name}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {material.currentStock} {material.unit} em estoque
                              </Typography>
                            </Box>
                            <Chip size="small" color="primary" label="Disponivel" />
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Paper>
              </Box>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack spacing={1.5}>
                  <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1}>
                    <Box>
                      <Typography variant="h6">Solicitar mais materiais</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Pedido enviado para o almoxarifado avaliar separacao e entrega.
                      </Typography>
                    </Box>
                    <Chip color={canRequestMaterials ? "primary" : "warning"} icon={<Inventory2RoundedIcon />} label={canRequestMaterials ? "Solicitacao liberada" : "Sem permissao"} variant="outlined" />
                  </Stack>
                  {materialRequestError && <Alert severity="warning">{materialRequestError}</Alert>}
                  {!canRequestMaterials ? (
                    <Alert severity="info">Somente dono, gerente, supervisor de obra e almoxarifado podem solicitar material extra.</Alert>
                  ) : (
                    <Stack spacing={1.5}>
                      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.2fr 0.5fr 0.7fr" }, gap: 1.2 }}>
                        <TextField select label="Material" value={materialRequestMaterialId} onChange={(event) => setMaterialRequestMaterialId(event.target.value)} size="small">
                          {materials.map((material) => (
                            <MenuItem key={material.id} value={material.id}>
                              {material.name} - {material.currentStock} {material.unit}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField label="Quantidade" value={materialRequestQuantity} onChange={(event) => setMaterialRequestQuantity(event.target.value)} size="small" type="number" />
                        <TextField select label="Prioridade" value={materialRequestPriority} onChange={(event) => setMaterialRequestPriority(event.target.value as MaterialRequestPriority)} size="small">
                          {["LOW", "NORMAL", "HIGH", "URGENT"].map((priority) => (
                            <MenuItem key={priority} value={priority}>
                              {labelFor(priority)}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Box>
                      <TextField label="Motivo" value={materialRequestReason} onChange={(event) => setMaterialRequestReason(event.target.value)} multiline minRows={2} />
                      <TextField label="Observacao do item (opcional)" value={materialRequestNotes} onChange={(event) => setMaterialRequestNotes(event.target.value)} />
                      <Button variant="contained" startIcon={<Inventory2RoundedIcon />} onClick={submitMaterialRequest} disabled={!materials.length}>
                        Solicitar material extra
                      </Button>
                    </Stack>
                  )}
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="h6" sx={{ mb: 1.5 }}>
                  Solicitacoes desta OS
                </Typography>
                {orderMaterialRequests.length === 0 ? (
                  <Typography color="text.secondary">Nenhuma solicitacao extra registrada.</Typography>
                ) : (
                  <Stack spacing={1.2}>
                    {orderMaterialRequests.map((request) => {
                      const requestItems = localMaterialRequestItems.filter((item) => item.requestId === request.id);
                      return (
                        <Box key={request.id} sx={{ p: 1.4, borderRadius: 2, bgcolor: "background.default", border: 1, borderColor: "divider" }}>
                          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.2}>
                            <Box>
                              <Typography fontWeight={900}>{request.reason}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {requestItems.map((item) => `${materials.find((material) => material.id === item.materialId)?.name ?? "Material"}: ${item.quantity}`).join(" | ")}
                              </Typography>
                            </Box>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                              <StatusChip value={request.priority} />
                              <StatusChip value={request.status} />
                            </Stack>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </Paper>
            </Stack>
          )}

          {tab === 6 && (
            <Stack spacing={2}>
              {equipmentRequestError && <Alert severity="warning">{equipmentRequestError}</Alert>}
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 1.5 }}>
                <Kpi label="Equipamentos da empresa" value={String(equipment.length)} helper="Cadastro completo" />
                <Kpi label="Disponiveis" value={String(availableEquipment.length)} helper="Livres para reserva" />
                <Kpi label="Nesta OS" value={String(orderEquipment.length)} helper="Reservados ou em uso" />
              </Box>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "background.default" }}>
                <Typography variant="h6" sx={{ mb: 1.5 }}>
                  Equipamentos sendo usados neste servico
                </Typography>
                {orderEquipment.length === 0 ? (
                  <Alert severity="info">Nenhum equipamento foi vinculado a esta OS ainda.</Alert>
                ) : (
                  <Stack spacing={1.2}>
                    {orderEquipment.map((item) => {
                      const linkedEquipment = equipment.find((candidate) => candidate.id === item.equipmentId);
                      return (
                        <Box key={item.id} sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: "divider" }}>
                          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
                            <Box>
                              <Typography fontWeight={900}>{linkedEquipment?.name ?? "Equipamento"}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                Codigo {linkedEquipment?.code ?? "-"} | Condicao antes: {item.conditionBefore} | Retorno: {item.returnedAt ? formatDateTime(item.returnedAt) : "pendente"}
                              </Typography>
                              {item.notes && (
                                <Typography variant="caption" color="text.secondary">
                                  {item.notes}
                                </Typography>
                              )}
                            </Box>
                            <StatusChip value={item.status} />
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </Paper>

              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "1fr 1fr" }, gap: 2 }}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    Todos os equipamentos da empresa
                  </Typography>
                  {equipment.length === 0 ? (
                    <Typography color="text.secondary">Nenhum equipamento cadastrado.</Typography>
                  ) : (
                    <Stack spacing={1}>
                      {equipment.map((item) => (
                        <Box key={item.id} sx={{ p: 1.2, borderRadius: 2, bgcolor: "background.default", border: 1, borderColor: "divider" }}>
                          <Stack direction="row" justifyContent="space-between" gap={1}>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography fontWeight={900}>{item.name}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {item.code} - {item.notes || "Sem observacao"}
                              </Typography>
                            </Box>
                            <StatusChip value={item.status} />
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Paper>

                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1} sx={{ mb: 1.5 }}>
                    <Box>
                      <Typography variant="h6">Equipamentos disponiveis</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Solicite para o almoxarifado reservar para esta OS.
                      </Typography>
                    </Box>
                    <Chip color={canRequestMaterials ? "primary" : "warning"} label={canRequestMaterials ? "Solicitacao liberada" : "Sem permissao"} variant="outlined" />
                  </Stack>
                  {availableEquipment.length === 0 ? (
                    <Typography color="text.secondary">Nenhum equipamento disponivel para reserva agora.</Typography>
                  ) : (
                    <Stack spacing={1}>
                      {availableEquipment.map((item) => (
                        <Box key={item.id} sx={{ p: 1.2, borderRadius: 2, bgcolor: "background.default", border: 1, borderColor: "divider" }}>
                          <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
                            <Box sx={{ minWidth: 0 }}>
                              <Typography fontWeight={900}>{item.name}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {item.code}
                              </Typography>
                            </Box>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Chip size="small" color="primary" label="Disponivel" />
                              <Button size="small" variant="contained" disabled={!canRequestMaterials} onClick={() => void requestEquipment(item.id)}>
                                Solicitar
                              </Button>
                            </Stack>
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Paper>
              </Box>
            </Stack>
          )}

          {tab === 7 && (
            canViewFinancials ? (
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
                <InfoGrid
                  items={[
                    ["Receita contratada", formatCurrency(order.revenue)],
                    ["Despesas estimadas", formatCurrency(order.expenses)],
                    ["Lucro estimado", formatCurrency(order.revenue - order.expenses)],
                    ["Margem", marginLabel],
                  ]}
                />
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "background.default" }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar variant="rounded" sx={{ bgcolor: "success.light", color: "success.dark" }}>
                      <PaymentsRoundedIcon />
                    </Avatar>
                    <Box>
                      <Typography fontWeight={900}>Controle financeiro da OS</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Margem, entrada, despesas e faturamento ficam vinculados a obra para reduzir perda operacional.
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Box>
            ) : (
              <Alert severity="info" icon={<LockRoundedIcon />}>
                Valores financeiros desta OS ficam restritos ao dono e ao financeiro.
              </Alert>
            )
          )}

          {tab === 8 && (
            <Stack spacing={2}>
              {!canEvaluate && (
                <Alert severity="warning" icon={<LockRoundedIcon />}>
                  Apenas OWNER, GERENTE e SUPERVISOR_OBRA podem avaliar colaboradores.
                </Alert>
              )}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "background.default" }}>
                <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
                  <Box>
                    <Typography variant="h6">Media geral da equipe</Typography>
                    <Typography variant="body2" color="text.secondary">
                      A nota geral e calculada automaticamente a partir dos sete criterios.
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip color={teamAverage ? "success" : "warning"} icon={<StarRoundedIcon />} label={teamAverage ? teamAverage.toFixed(1) : "Pendente"} />
                    <Chip label={`${evaluatedTeam.length}/${team.length} avaliados`} />
                  </Stack>
                </Stack>
              </Paper>
              {team.map((employee) => {
                const evaluation = orderEvaluations.find((item) => item.employeeId === employee.id);
                return (
                  <Box key={employee.id} sx={{ p: 2, borderRadius: 2, bgcolor: "background.default", border: 1, borderColor: "divider" }}>
                    <Stack direction={{ xs: "column", md: "row" }} alignItems={{ md: "center" }} justifyContent="space-between" gap={1.5}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar sx={{ bgcolor: evaluation ? "success.main" : "warning.main" }}>
                          {evaluation ? <CheckCircleRoundedIcon /> : <PersonRoundedIcon />}
                        </Avatar>
                        <Box>
                          <Typography fontWeight={900}>{employee.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {employee.specialty}
                          </Typography>
                        </Box>
                      </Stack>
                      {evaluation ? (
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Chip color="success" icon={<CheckCircleRoundedIcon />} label="Avaliado" />
                          <Chip icon={<StarRoundedIcon />} label={`Media ${evaluation.overallScore.toFixed(1)}`} />
                        </Stack>
                      ) : (
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Chip color="warning" label="Pendente" />
                          <Button variant="contained" disabled={!canEvaluate} startIcon={<StarRoundedIcon />} onClick={() => quickEvaluate(employee.id, employee.name)}>
                            Avaliar
                          </Button>
                        </Stack>
                      )}
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          )}

          {tab === 9 && (
            <Stack spacing={1.5}>
              {[
                ["OS criada", formatDate(order.scheduledStart), true],
                ["Supervisor designado", employees.find((employee) => employee.id === order.supervisorEmployeeId)?.name ?? "Pendente", Boolean(order.supervisorEmployeeId)],
                ["Equipe atribuida", `${team.length} colaboradores`, true],
                ["Checklist", `${progress}% concluido`, progress === 100],
                ["Materiais", `${orderMaterials.length} itens planejados`, orderMaterials.length > 0],
                ["Avaliacao da equipe", `${evaluatedTeam.length}/${team.length} avaliados`, evaluatedTeam.length === team.length],
              ].map(([item, detail, done]) => (
                <Stack key={String(item)} direction="row" spacing={1.2} alignItems="center">
                  <CheckCircleRoundedIcon color={done ? "success" : "disabled"} />
                  <Box>
                    <Typography fontWeight={850}>{item}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {detail}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          )}
        </Box>
      </Paper>

      <Dialog open={Boolean(activeChecklistItem)} onClose={() => setActiveChecklistItem(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          {checklistActionMode === "assign"
            ? "Atribuir responsavel"
            : checklistActionMode === "block"
              ? "Bloquear item"
              : checklistActionMode === "reopen"
                ? "Reabrir item"
                : checklistActionMode === "photo"
                  ? "Enviar fotos do item"
                  : "Concluir item do checklist"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography color="text.secondary">{activeChecklistItem?.title}</Typography>
            {checklistActionMode === "assign" && (
              <TextField
                select
                label="Colaboradores responsaveis"
                value={assignedEmployeeIdsInput}
                onChange={(event) => {
                  const value = event.target.value;
                  setAssignedEmployeeIdsInput(typeof value === "string" ? value.split(",") : value);
                }}
                SelectProps={{ multiple: true }}
                fullWidth
              >
                {team.map((employee) => (
                  <MenuItem key={employee.id} value={employee.id}>
                    {employee.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {checklistActionMode === "complete" && (
              <TextField select label="Colaborador que executou" value={completedByEmployeeId} onChange={(event) => setCompletedByEmployeeId(event.target.value)} fullWidth>
                {team.map((employee) => (
                  <MenuItem key={employee.id} value={employee.id}>
                    {employee.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {(checklistActionMode === "complete" || checklistActionMode === "photo") && (
              <>
                {checklistActionMode === "complete" && (
                  <TextField label="Observacao de conclusao" value={completionNotes} onChange={(event) => setCompletionNotes(event.target.value)} multiline minRows={3} />
                )}
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "0.8fr 1.2fr" }, gap: 1.5 }}>
                  <TextField select label="Tipo da foto" value={photoType} onChange={(event) => setPhotoType(event.target.value as ChecklistPhotoType)}>
                    {["BEFORE", "DURING", "AFTER", "EVIDENCE", "PROBLEM"].map((type) => (
                      <MenuItem key={type} value={type}>
                        {labelFor(type)}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button component="label" variant="outlined" startIcon={<CameraAltRoundedIcon />} sx={{ minHeight: 56 }}>
                    Enviar imagens
                    <input
                      hidden
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={(event) => {
                        void handleChecklistPhotoUpload(event.target.files);
                        event.target.value = "";
                      }}
                    />
                  </Button>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Titulos opcionais. Use JPEG, PNG ou WebP com ate 6 MB por arquivo.
                  {activeChecklistItem?.requiresPhoto ? ` Minimo: ${Math.max(activeChecklistItem.minimumPhotos, 1)} foto(s).` : ""}
                </Typography>
                {pendingPhotos.length > 0 && (
                  <Stack spacing={1}>
                    {pendingPhotos.map((photo) => (
                      <Paper key={photo.id} variant="outlined" sx={{ p: 1.2, borderRadius: 2, bgcolor: "background.default" }}>
                        <Stack direction="row" spacing={1.2} alignItems="center">
                          <Box
                            component="img"
                            src={photo.url}
                            alt={photo.caption || photo.fileName}
                            sx={{ width: 58, height: 46, borderRadius: 1.2, objectFit: "cover", bgcolor: "action.hover", flexShrink: 0 }}
                          />
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="body2" fontWeight={850} noWrap>
                              {photo.fileName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {Math.max(1, Math.round(photo.sizeBytes / 1024))} KB
                            </Typography>
                          </Box>
                          <Button size="small" color="warning" onClick={() => removePendingPhoto(photo.id)}>
                            Remover
                          </Button>
                        </Stack>
                        <TextField
                          size="small"
                          label="Titulo da imagem (opcional)"
                          value={photo.caption}
                          onChange={(event) => updatePendingPhotoCaption(photo.id, event.target.value)}
                          fullWidth
                          sx={{ mt: 1 }}
                        />
                      </Paper>
                    ))}
                  </Stack>
                )}
              </>
            )}
            {(checklistActionMode === "block" || checklistActionMode === "reopen") && (
              <TextField
                label={checklistActionMode === "block" ? "Motivo do bloqueio" : "Motivo da reabertura"}
                value={actionReason}
                onChange={(event) => setActionReason(event.target.value)}
                multiline
                minRows={3}
                required
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActiveChecklistItem(null)}>Cancelar</Button>
          <Button variant="contained" onClick={submitChecklistDialog} startIcon={<CheckCircleRoundedIcon />}>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function Kpi({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Typography variant="body2" color="text.secondary" fontWeight={850}>
        {label}
      </Typography>
      <Typography variant="h5" sx={{ mt: 0.5 }} noWrap>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary" noWrap>
        {helper}
      </Typography>
    </Paper>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography fontWeight={850} sx={{ wordBreak: "break-word" }}>
        {value}
      </Typography>
    </Box>
  );
}

function InfoGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
      {items.map(([label, value]) => (
        <Box key={label} sx={{ p: 2, borderRadius: 2, bgcolor: "background.default", border: 1, borderColor: "divider" }}>
          <Info label={label} value={value} />
        </Box>
      ))}
    </Box>
  );
}
