"use client";

import Link from "next/link";
import { useState } from "react";
import { EvaluationButton } from "./EvaluationButton";
import { ServiceTasks } from "./ServiceTasks";
import { canUseWhatsApp } from "@/lib/whatsapp-schema";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  Collapse,
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
import type { SxProps, Theme } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CameraAltRoundedIcon from "@mui/icons-material/CameraAltRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
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
  serviceOrders as demoServiceOrders,
} from "@/lib/demo-data";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { labelFor } from "@/lib/labels";
import { canCreateChecklist, canEditChecklist, canManageServiceOrderTeam, canOperateChecklist, canRequestServiceMaterials, canUpdateServiceOrderStatus, canValidateChecklistItem, canEvaluateEmployees, canViewServiceOrderFinancials } from "@/lib/permissions";
import { getMaterialOperationalStatus, normalizeStockStatus } from "@/lib/stock-status";
import type {
  ChecklistItemStatus,
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
  ServiceOrderEquipmentStatus,
  ServiceOrderMaterial,
  ServiceOrderMaterialStatus,
  SessionUser,
} from "@/lib/types";
import { StatusChip } from "./StatusChip";
import { SoapBubbleStatusEffect } from "./SoapBubbleStatusEffect";
import { useCurrentUser } from "./useCurrentUser";

const tabLabels = ["Resumo", "Cliente", "Equipe", "Checklist", "Midias", "Materiais", "Equipamentos", "Financeiro", "Avaliacoes", "Historico"];
const checklistStatusFilters = ["ALL", "PENDING", "IN_PROGRESS", "DONE", "BLOCKED", "REOPENED"] as const;
const serviceTeamRoleOptions: ServiceTeamRole[] = ["POLIDOR", "AUXILIAR", "TECNICO", "MOTORISTA", "ALMOXARIFADO", "OUTRO"];
const serviceOrderStatusOptions: ServiceOrderStatus[] = ["SCHEDULED", "PREPARING", "IN_PROGRESS", "PAUSED", "WAITING_CUSTOMER", "DONE", "DELIVERED", "CANCELED"];
const clientTrackingPublicOrigin = (process.env.NEXT_PUBLIC_APP_URL ?? "https://limpadoraalianca.vercel.app").replace(/\/+$/, "");
const supervisorMaterialStatusOptions: ServiceOrderMaterialStatus[] = ["PENDING_SEPARATION", "CANCELED"];
const warehouseMaterialStatusOptions: ServiceOrderMaterialStatus[] = ["PENDING_SEPARATION", "SEPARATING", "RESERVED", "SEPARATED", "DELIVERED_TO_TEAM", "PARTIALLY_RETURNED", "RETURNED", "CONSUMED", "DAMAGED", "LOST", "CANCELED"];
const supervisorEquipmentStatusOptions: ServiceOrderEquipmentStatus[] = ["REQUESTED", "IN_USE", "CANCELED"];
const warehouseEquipmentStatusOptions: ServiceOrderEquipmentStatus[] = ["REQUESTED", "RESERVED", "DELIVERED", "IN_USE", "RETURNED", "DAMAGED", "LOST", "CANCELED"];
const photoGalleryStages: Array<{ type: ChecklistPhotoType; title: string; description: string; tone: "primary" | "success" | "warning" | "error" | "info" }> = [
  { type: "BEFORE", title: "Antes", description: "Condicao inicial registrada pela equipe.", tone: "info" },
  { type: "DURING", title: "Durante", description: "Execucao, etapas tecnicas e acompanhamento.", tone: "primary" },
  { type: "AFTER", title: "Depois", description: "Resultado final e entrega documentada.", tone: "success" },
  { type: "EVIDENCE", title: "Evidencias", description: "Registros complementares vinculados ao checklist.", tone: "warning" },
  { type: "PROBLEM", title: "Problemas", description: "Ocorrencias, danos ou pontos de atencao.", tone: "error" },
];
type ChecklistActionMode = "assign" | "complete" | "block" | "reopen" | "photo";
type PendingChecklistPhoto = {
  id: string;
  previewUrl: string;
  file: File;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds?: number;
  caption: string;
};
type ChecklistPhotoUploadPayload = {
  url: string;
  type: ChecklistPhotoType;
  caption: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  durationSeconds?: number;
};
type ChecklistPhotoUploadEntry = {
  progressId: string;
  file?: File;
  payload: ChecklistPhotoUploadPayload;
};
type ChecklistPhotoUploadProgress = {
  id: string;
  checklistItemId: string;
  checklistItemTitle: string;
  fileName: string;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
};
type SignedChecklistUpload = {
  uploadUrl: string;
  publicUrl: string;
  fileName?: string;
};



const maxChecklistVideoSeconds = 30;
const allowedChecklistPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "video/mp4", "video/webm", "video/quicktime"]);
const allowedChecklistVideoTypes = new Set(["video/mp4", "video/webm", "video/quicktime"]);

class DirectUploadUnavailableError extends Error {}

function checklistStatusLabel(status: ChecklistItemStatus | "ALL") {
  if (status === "ALL") return "Todos";
  if (status === "PENDING" || status === "REOPENED") return "Pendente";
  if (status === "IN_PROGRESS") return "Iniciado";
  if (status === "DONE") return "Concluido";
  return labelFor(status);
}

function checklistStatusColor(status: ChecklistItemStatus) {
  if (status === "DONE") return "success";
  if (status === "IN_PROGRESS") return "info";
  if (status === "BLOCKED") return "warning";
  if (status === "CANCELED") return "error";
  return "default";
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function makeClientId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatPhotoSize(bytes?: number) {
  if (!bytes) return "-";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function isVideoMedia(media: { url?: string; mimeType?: string; fileName?: string }) {
  const mimeType = media.mimeType?.toLowerCase() ?? "";
  const source = `${media.url ?? ""} ${media.fileName ?? ""}`.toLowerCase();
  return mimeType.startsWith("video/") || /\.(mp4|webm|mov)(?:\?|$)/i.test(source);
}

function getVideoDurationSeconds(file: File) {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Nao foi possivel ler a duracao do video."));
    };
    video.src = url;
  });
}

function assignedIdsFor(item: ServiceOrderChecklistItem) {
  return Array.from(new Set([...(item.assignedEmployeeIds ?? []), item.assignedEmployeeId].filter(Boolean))) as string[];
}

function completedIdsFor(item: ServiceOrderChecklistItem) {
  return Array.from(new Set([...(item.completedByEmployeeIds ?? []), item.completedByEmployeeId].filter(Boolean))) as string[];
}

const openTeamStatuses = new Set<ServiceOrderStatus>(["SCHEDULED", "PREPARING", "IN_PROGRESS", "PAUSED", "WAITING_CUSTOMER"]);

export function ServiceOrderDetailView({
  order: initialOrder,
  maxMediaBytes = 20 * 1024 * 1024,
  serviceOrders = demoServiceOrders,
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
  maxMediaBytes?: number;
  serviceOrders?: ServiceOrder[];
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
  const [referenceNow] = useState(() => Date.now());
  const [tab, setTab] = useState(3);
  const [localEvaluations, setLocalEvaluations] = useState<Evaluation[]>(evaluations);
  const [localChecklist, setLocalChecklist] = useState<ServiceOrderChecklistItem[]>(serviceOrderChecklistItems);
  const [localChecklistPhotos, setLocalChecklistPhotos] = useState<ServiceOrderChecklistPhoto[]>(serviceOrderChecklistPhotos);
  const [localServiceOrderMaterials, setLocalServiceOrderMaterials] = useState<ServiceOrderMaterial[]>(serviceOrderMaterials);
  const [localServiceOrderEquipment, setLocalServiceOrderEquipment] = useState<ServiceOrderEquipment[]>(serviceOrderEquipment);
  const [localMaterialRequests, setLocalMaterialRequests] = useState<ServiceMaterialRequest[]>(materialRequests);
  const [localMaterialRequestItems, setLocalMaterialRequestItems] = useState<ServiceMaterialRequestItem[]>(materialRequestItems);
  const [notice, setNotice] = useState("");
  const [statusInput, setStatusInput] = useState<ServiceOrderStatus>(initialOrder.status);
  const [statusReason, setStatusReason] = useState("");
  const [statusError, setStatusError] = useState("");
  const [financialRevenueInput, setFinancialRevenueInput] = useState(String(initialOrder.revenue));
  const [financialExpensesInput, setFinancialExpensesInput] = useState(String(initialOrder.expenses));
  const [financialReason, setFinancialReason] = useState("");
  const [financialError, setFinancialError] = useState("");
  const [financialSaving, setFinancialSaving] = useState(false);
  const [activeChecklistItem, setActiveChecklistItem] = useState<ServiceOrderChecklistItem | null>(null);
  const [checklistItemToDelete, setChecklistItemToDelete] = useState<ServiceOrderChecklistItem | null>(null);
  const [checklistDeleting, setChecklistDeleting] = useState(false);
  const [checklistDeleteError, setChecklistDeleteError] = useState("");
  const [checklistActionMode, setChecklistActionMode] = useState<ChecklistActionMode>("complete");
  const [checklistFilter, setChecklistFilter] = useState<(typeof checklistStatusFilters)[number]>("ALL");
  const [checklistCreateOpen, setChecklistCreateOpen] = useState(false);
  const [checklistSummaryOpen, setChecklistSummaryOpen] = useState(false);
  const [expandedChecklistItemId, setExpandedChecklistItemId] = useState<string | null>(null);
  const [completedByEmployeeId, setCompletedByEmployeeId] = useState(order.employeeIds[0] ?? "");
  const [completedByEmployeeIdsInput, setCompletedByEmployeeIdsInput] = useState<string[]>([]);
  const [assignedEmployeeIdsInput, setAssignedEmployeeIdsInput] = useState<string[]>([]);
  const [completionNotes, setCompletionNotes] = useState("");
  const [actionReason, setActionReason] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoType, setPhotoType] = useState<ChecklistPhotoType>("EVIDENCE");
  const [photoCaption, setPhotoCaption] = useState("");
  const [photoGalleryType, setPhotoGalleryType] = useState<ChecklistPhotoType | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<PendingChecklistPhoto[]>([]);
  const [photoUploads, setPhotoUploads] = useState<ChecklistPhotoUploadProgress[]>([]);
  const [deletingPhotoId, setDeletingPhotoId] = useState("");
  const [photoDeleteError, setPhotoDeleteError] = useState("");
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
  const [serviceMaterialId, setServiceMaterialId] = useState(materials[0]?.id ?? "");
  const [serviceMaterialQuantity, setServiceMaterialQuantity] = useState("1");
  const [serviceMaterialNotes, setServiceMaterialNotes] = useState("");
  const [resourceError, setResourceError] = useState("");
  const [resourceSaving, setResourceSaving] = useState(false);
  const [equipmentConditionBefore, setEquipmentConditionBefore] = useState("Aguardando conferencia do almoxarifado");
  const [equipmentNotes, setEquipmentNotes] = useState("");
  const [teamEmployeeId, setTeamEmployeeId] = useState("");
  const [teamRole, setTeamRole] = useState<ServiceTeamRole>("AUXILIAR");
  const [supervisorEmployeeId, setSupervisorEmployeeId] = useState(initialOrder.supervisorEmployeeId ?? "");
  const [removingTeamEmployeeId, setRemovingTeamEmployeeId] = useState("");
  const [teamError, setTeamError] = useState("");
  const team = employees.filter((employee) => order.employeeIds.includes(employee.id));
  const linkedEmployee = employees.find((employee) => employee.userId === user?.id);
  const customer = customers.find((item) => item.id === order.customerId);
  const canManageTeam = canManageServiceOrderTeam(user?.role ?? "COLABORADOR");
  const canAddChecklistItems = canCreateChecklist(user?.role ?? "COLABORADOR");
  const canDeleteChecklistItems = canEditChecklist(user?.role ?? "COLABORADOR");
  const canEvaluate = canEvaluateEmployees(user?.role ?? "COLABORADOR");
  const canOperate = canOperateChecklist(user?.role ?? "COLABORADOR");
  const canRequestMaterials = canRequestServiceMaterials(user?.role ?? "COLABORADOR");
  const canUpdateStatus = canUpdateServiceOrderStatus(user?.role ?? "COLABORADOR");
  const canValidate = canValidateChecklistItem(user?.role ?? "COLABORADOR");
  const canViewFinancials = canViewServiceOrderFinancials(user);
  const canShareClientTracking = user?.role === "OWNER" || user?.role === "GERENTE" || user?.role === "SUPERVISOR_OBRA";
  const findTeamConflict = (employeeId: string) =>
    serviceOrders.find(
      (serviceOrder) =>
        serviceOrder.id !== order.id &&
        openTeamStatuses.has(serviceOrder.status) &&
        (serviceOrder.supervisorEmployeeId === employeeId || serviceOrder.employeeIds.includes(employeeId)),
    );
  const checklist = localChecklist
    .filter((item) => item.serviceOrderId === order.id && item.status !== "CANCELED")
    .sort((a, b) => Number(Boolean(b.isPriority)) - Number(Boolean(a.isPriority)) || a.sortOrder - b.sortOrder);
  const orderChecklistPhotos = localChecklistPhotos
    .filter((photo) => photo.serviceOrderId === order.id)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const selectedGalleryStage = photoGalleryStages.find((stage) => stage.type === photoGalleryType);
  const selectedGallerySeverity = selectedGalleryStage?.tone === "primary" ? "info" : selectedGalleryStage?.tone ?? "info";
  const selectedGalleryPhotos = photoGalleryType
    ? orderChecklistPhotos.filter((photo) => photo.type === photoGalleryType)
    : [];
  const filteredChecklist = checklist.filter((item) => checklistFilter === "ALL" || item.status === checklistFilter);
  const orderMaterials = localServiceOrderMaterials.filter((item) => item.serviceOrderId === order.id && item.status !== "CANCELED");
  const orderEquipment = localServiceOrderEquipment.filter((item) => item.serviceOrderId === order.id && item.status !== "CANCELED");
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
    return linkedUser?.role === "SUPERVISOR_OBRA" && linkedUser.isActive && !findTeamConflict(employee.id);
  });
  const assignableEmployees = employees.filter((employee) => employee.status === "ACTIVE" && !order.employeeIds.includes(employee.id) && !findTeamConflict(employee.id));
  const canManageServiceResources = canRequestMaterials;
  const canPrepareServiceResources = user?.role === "OWNER" || user?.role === "GERENTE" || user?.role === "ALMOXARIFADO";
  const materialStatusOptions = canPrepareServiceResources ? warehouseMaterialStatusOptions : supervisorMaterialStatusOptions;
  const equipmentStatusOptions = canPrepareServiceResources ? warehouseEquipmentStatusOptions : supervisorEquipmentStatusOptions;

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
      return new Date(item.dueAt).getTime() < referenceNow;
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
  const financialRevenue = Number(financialRevenueInput.replace(",", "."));
  const financialExpenses = Number(financialExpensesInput.replace(",", "."));
  const financialPreviewReady = Number.isFinite(financialRevenue) && Number.isFinite(financialExpenses);
  const financialProfitPreview = financialPreviewReady ? financialRevenue - financialExpenses : 0;
  const financialMarginPreview = financialPreviewReady && financialRevenue > 0 ? Math.round((financialProfitPreview / financialRevenue) * 100) : 0;
  const clientTrackingCode = order.clientAccessCode ?? "";
  const clientTrackingHref = clientTrackingCode
    ? `/acompanhe-servico?codigo=${encodeURIComponent(clientTrackingCode)}`
    : "/acompanhe-servico";
  const clientTrackingAbsoluteHref = clientTrackingCode ? `${clientTrackingPublicOrigin}${clientTrackingHref}` : "";
  const clientTrackingQrSrc = clientTrackingAbsoluteHref
    ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&format=svg&margin=16&data=${encodeURIComponent(clientTrackingAbsoluteHref)}`
    : "";
  const customerPhoneDigits = (customer?.phone ?? "").replace(/\D/g, "");
  const customerWhatsAppPhone =
    customerPhoneDigits.length >= 10 && !customerPhoneDigits.startsWith("55")
      ? `55${customerPhoneDigits}`
      : customerPhoneDigits;

  function userName(userId?: string) {
    return users.find((item) => item.id === userId)?.name ?? "Usuario do sistema";
  }

  function employeeName(employeeId?: string) {
    return employees.find((item) => item.id === employeeId)?.name ?? "";
  }

  function checklistItemTitle(checklistItemId: string) {
    return localChecklist.find((item) => item.id === checklistItemId)?.title ?? "Item do checklist";
  }

  async function copyClientTrackingLink() {
    if (!clientTrackingCode || typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${clientTrackingHref}`);
      setNotice("Link de acompanhamento do cliente copiado.");
    } catch {
      setNotice("Nao foi possivel copiar automaticamente. Abra a pagina do cliente e copie o link do navegador.");
    }
  }

  function sendClientTrackingByWhatsApp() {
    if (!clientTrackingCode || !customerWhatsAppPhone || typeof window === "undefined") return;
    const trackingUrl = `${window.location.origin}${clientTrackingHref}`;
    const message = `Ola, ${order.customerName}! Voce pode acompanhar o andamento do servico pelo link: ${trackingUrl}`;
    window.open(`https://wa.me/${customerWhatsAppPhone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
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

  async function removeTeamEmployee(employeeId: string) {
    setTeamError("");
    setNotice("");
    setRemovingTeamEmployeeId(employeeId);
    const response = await fetch(`/api/service-orders/${order.id}/employees?employeeId=${encodeURIComponent(employeeId)}`, {
      method: "DELETE",
    });
    const data = await response.json().catch(() => null);
    setRemovingTeamEmployeeId("");

    if (!response.ok) {
      setTeamError(data?.message ?? "Nao foi possivel remover colaborador da equipe.");
      return;
    }

    setOrder(data.serviceOrder);
    setLocalChecklist((current) =>
      current.map((item) =>
        item.serviceOrderId === order.id
          ? {
              ...item,
              assignedEmployeeIds: (item.assignedEmployeeIds ?? []).filter((currentId) => currentId !== employeeId),
              completedByEmployeeIds: (item.completedByEmployeeIds ?? []).filter((currentId) => currentId !== employeeId),
            }
          : item,
      ),
    );
    if (completedByEmployeeId === employeeId) setCompletedByEmployeeId(data.serviceOrder.employeeIds[0] ?? "");
    setCompletedByEmployeeIdsInput((current) => current.filter((currentId) => currentId !== employeeId));
    setNotice(data?.message ?? "Colaborador removido da equipe.");
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

  async function updateFinancials() {
    setFinancialError("");
    setNotice("");

    if (!financialPreviewReady || financialRevenue < 0 || financialExpenses < 0) {
      setFinancialError("Informe total e custo com valores positivos.");
      return;
    }

    setFinancialSaving(true);
    const response = await fetch(`/api/service-orders/${order.id}/financials`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revenue: financialRevenue, expenses: financialExpenses, reason: financialReason }),
    });
    const data = await response.json().catch(() => null);
    setFinancialSaving(false);

    if (!response.ok) {
      setFinancialError(data?.message ?? "Nao foi possivel atualizar os valores financeiros.");
      return;
    }

    setOrder(data.serviceOrder);
    setFinancialRevenueInput(String(data.serviceOrder.revenue));
    setFinancialExpensesInput(String(data.serviceOrder.expenses));
    setNotice("Financeiro da OS atualizado com sucesso.");
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

  async function addServiceMaterial() {
    setResourceError("");
    setNotice("");
    const quantity = Number(serviceMaterialQuantity);
    if (!serviceMaterialId) {
      setResourceError("Selecione um material.");
      return;
    }
    if (!quantity || quantity <= 0) {
      setResourceError("Informe uma quantidade maior que zero.");
      return;
    }

    setResourceSaving(true);
    const response = await fetch(`/api/service-orders/${order.id}/materials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        materialId: serviceMaterialId,
        plannedQuantity: quantity,
        notes: serviceMaterialNotes,
      }),
    });
    const data = await response.json().catch(() => null);
    setResourceSaving(false);
    if (!response.ok) {
      setResourceError(data?.message ?? "Nao foi possivel acrescentar material ao servico.");
      return;
    }

    setLocalServiceOrderMaterials((current) => [data.material, ...current]);
    setServiceMaterialQuantity("1");
    setServiceMaterialNotes("");
    setNotice("Material acrescentado ao servico.");
  }

  async function patchServiceMaterial(item: ServiceOrderMaterial, patch: Partial<ServiceOrderMaterial>) {
    setResourceError("");
    setNotice("");
    setResourceSaving(true);
    const response = await fetch(`/api/service-orders/${order.id}/materials`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, ...patch }),
    });
    const data = await response.json().catch(() => null);
    setResourceSaving(false);
    if (!response.ok) {
      setResourceError(data?.message ?? "Nao foi possivel atualizar o material.");
      return;
    }

    setLocalServiceOrderMaterials((current) => current.map((candidate) => (candidate.id === item.id ? data.material : candidate)));
    setNotice(patch.status === "CANCELED" ? "Material removido do servico." : "Material atualizado no servico.");
  }

  async function requestEquipment(equipmentId: string) {
    setEquipmentRequestError("");
    setResourceError("");
    setNotice("");
    const response = await fetch(`/api/service-orders/${order.id}/equipment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        equipmentId,
        conditionBefore: equipmentConditionBefore,
        notes: equipmentNotes || "Solicitado pela equipe da OS.",
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setEquipmentRequestError(data?.message ?? "Nao foi possivel solicitar o equipamento.");
      return;
    }
    setLocalServiceOrderEquipment((current) => [data.equipment, ...current]);
    setEquipmentNotes("");
    setEquipmentConditionBefore("Aguardando conferencia do almoxarifado");
    setNotice("Equipamento solicitado ao almoxarifado.");
  }

  async function patchServiceEquipment(item: ServiceOrderEquipment, patch: Partial<ServiceOrderEquipment>) {
    setEquipmentRequestError("");
    setResourceError("");
    setNotice("");
    setResourceSaving(true);
    const response = await fetch(`/api/service-orders/${order.id}/equipment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, ...patch }),
    });
    const data = await response.json().catch(() => null);
    setResourceSaving(false);
    if (!response.ok) {
      setEquipmentRequestError(data?.message ?? "Nao foi possivel atualizar o equipamento.");
      return;
    }

    setLocalServiceOrderEquipment((current) => current.map((candidate) => (candidate.id === item.id ? data.equipment : candidate)));
    setNotice(patch.status === "CANCELED" ? "Equipamento removido do servico." : "Equipamento atualizado no servico.");
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
    setChecklistCreateOpen(false);
    setNotice("Item acrescentado ao checklist com autoria registrada.");
  }

  function updateChecklistItemFromApi(item: ServiceOrderChecklistItem) {
    setLocalChecklist((current) => current.map((candidate) => (candidate.id === item.id ? item : candidate)));
  }

  function openChecklistAction(item: ServiceOrderChecklistItem, mode: ChecklistActionMode) {
    const assignedIds = assignedIdsFor(item);
    const completedIds = completedIdsFor(item);
    const fallbackCompletedIds = completedIds.length ? completedIds : assignedIds;
    const preferredPrimaryEmployeeId =
      user?.role === "COLABORADOR" && linkedEmployee?.id && fallbackCompletedIds.includes(linkedEmployee.id)
        ? linkedEmployee.id
        : item.completedByEmployeeId ?? fallbackCompletedIds[0] ?? linkedEmployee?.id ?? order.employeeIds[0] ?? "";
    revokePendingPhotoPreviews(pendingPhotos);
    setActiveChecklistItem(item);
    setChecklistActionMode(mode);
    setAssignedEmployeeIdsInput(assignedIds);
    setCompletedByEmployeeId(preferredPrimaryEmployeeId);
    setCompletedByEmployeeIdsInput(
      fallbackCompletedIds.length
        ? fallbackCompletedIds
        : preferredPrimaryEmployeeId
          ? [preferredPrimaryEmployeeId]
          : [],
    );
    setCompletionNotes(item.completionNotes ?? item.notes ?? "");
    setActionReason("");
    setPhotoUrl("");
    setPhotoType(item.status === "PENDING" ? "BEFORE" : "EVIDENCE");
    setPhotoCaption("");
    setPendingPhotos([]);
  }

  function revokePendingPhotoPreviews(photos: PendingChecklistPhoto[]) {
    photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
  }

  function closeChecklistDialogAfterUploadStart(photosToRevoke: PendingChecklistPhoto[]) {
    setActiveChecklistItem(null);
    setPhotoUrl("");
    setPhotoCaption("");
    setActionReason("");
    setPendingPhotos([]);
    revokePendingPhotoPreviews(photosToRevoke);
  }

  function updateChecklistUploadProgress(
    uploadId: string,
    patch: Partial<Pick<ChecklistPhotoUploadProgress, "progress" | "status" | "error">>,
  ) {
    setPhotoUploads((current) => current.map((upload) => (upload.id === uploadId ? { ...upload, ...patch } : upload)));
  }

  function enqueueChecklistUploadProgress(item: ServiceOrderChecklistItem, entries: ChecklistPhotoUploadEntry[]) {
    const rows = entries.map((entry) => ({
      id: entry.progressId,
      checklistItemId: item.id,
      checklistItemTitle: item.title,
      fileName: entry.payload.fileName || entry.payload.caption || "midia",
      progress: 0,
      status: "uploading" as const,
    }));
    setPhotoUploads((current) => [...rows, ...current]);
  }

  function clearFinishedPhotoUploads() {
    setPhotoUploads((current) => current.filter((upload) => upload.status === "uploading"));
  }

  function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error("Nao foi possivel ler a midia."));
      reader.readAsDataURL(file);
    });
  }

  function postJsonWithUploadProgress(path: string, body: unknown, onProgress: (progress: number) => void) {
    return new Promise<unknown>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", path);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      };
      xhr.onload = () => {
        let data: { message?: string } | null = null;
        try {
          data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        } catch {
          data = null;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100);
          resolve(data);
          return;
        }
        reject(new Error(data?.message ?? "Nao foi possivel enviar a midia."));
      };
      xhr.onerror = () => reject(new Error("Falha de conexao ao enviar a midia."));
      xhr.send(JSON.stringify(body));
    });
  }

  async function requestSignedChecklistUpload(itemId: string, file: File, durationSeconds?: number) {
    const response = await fetch(`/api/service-orders/${order.id}/checklist/${itemId}/photos/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        durationSeconds,
      }),
    });
    const data = await response.json().catch(() => null);
    if (response.status === 501) {
      throw new DirectUploadUnavailableError(data?.message ?? "Upload direto nao configurado.");
    }
    if (!response.ok) {
      throw new Error(data?.message ?? "Nao foi possivel preparar o upload da midia.");
    }
    return data as SignedChecklistUpload;
  }

  function uploadFileToSignedUrl(uploadUrl: string, file: File, onProgress: (progress: number) => void) {
    return new Promise<void>((resolve, reject) => {
      const formData = new FormData();
      formData.append("cacheControl", "3600");
      formData.append("", file);

      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("x-upsert", "false");
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100);
          resolve();
          return;
        }
        reject(new Error("Nao foi possivel enviar a midia para o storage."));
      };
      xhr.onerror = () => reject(new Error("Falha de conexao ao enviar a midia para o storage."));
      xhr.send(formData);
    });
  }

  async function prepareChecklistPhotoPayload(item: ServiceOrderChecklistItem, entry: ChecklistPhotoUploadEntry) {
    if (!entry.file) {
      updateChecklistUploadProgress(entry.progressId, { progress: 95 });
      return entry.payload;
    }

    try {
      updateChecklistUploadProgress(entry.progressId, { progress: 3 });
      const signedUpload = await requestSignedChecklistUpload(item.id, entry.file, entry.payload.durationSeconds);
      await uploadFileToSignedUrl(signedUpload.uploadUrl, entry.file, (progress) => {
        updateChecklistUploadProgress(entry.progressId, { progress: Math.min(94, Math.max(4, Math.round(progress * 0.94))) });
      });
      updateChecklistUploadProgress(entry.progressId, { progress: 96 });
      return {
        ...entry.payload,
        url: signedUpload.publicUrl,
        fileName: signedUpload.fileName ?? entry.payload.fileName,
      };
    } catch (error) {
      if (!(error instanceof DirectUploadUnavailableError)) throw error;
      if (isVideoMedia({ mimeType: entry.file.type, fileName: entry.file.name })) {
        throw new Error("Upload de video precisa do armazenamento Supabase configurado.");
      }
      updateChecklistUploadProgress(entry.progressId, { progress: 5 });
      const dataUrl = await readFileAsDataUrl(entry.file);
      updateChecklistUploadProgress(entry.progressId, { progress: 12 });
      return { ...entry.payload, url: dataUrl };
    }
  }

  async function handleChecklistPhotoUpload(files: FileList | null) {
    if (!files?.length) return;

    const selectedFiles = Array.from(files);
    const validFiles: Array<{ file: File; durationSeconds?: number }> = [];
    let ignoredByType = 0;
    let ignoredBySize = 0;
    let ignoredByDuration = 0;

    for (const file of selectedFiles) {
      if (!allowedChecklistPhotoTypes.has(file.type)) {
        ignoredByType += 1;
        continue;
      }
      if (file.size > maxMediaBytes) {
        ignoredBySize += 1;
        continue;
      }

      if (allowedChecklistVideoTypes.has(file.type)) {
        try {
          const durationSeconds = await getVideoDurationSeconds(file);
          if (!Number.isFinite(durationSeconds) || durationSeconds > maxChecklistVideoSeconds) {
            ignoredByDuration += 1;
            continue;
          }
          validFiles.push({ file, durationSeconds });
        } catch {
          ignoredByDuration += 1;
        }
        continue;
      }

      validFiles.push({ file });
    }

    if (ignoredByType || ignoredBySize || ignoredByDuration) {
      const reasons = [
        ignoredByType ? "tipo nao permitido" : "",
        ignoredBySize ? `acima de ${Math.floor(maxMediaBytes / 1024 / 1024)} MB` : "",
        ignoredByDuration ? `video com mais de ${maxChecklistVideoSeconds}s ou sem duracao valida` : "",
      ].filter(Boolean);
      setNotice(`Algumas midias foram ignoradas: ${reasons.join(", ")}. Use JPEG, PNG, WebP, HEIC ou videos MP4, WebM e MOV de ate ${maxChecklistVideoSeconds}s.`);
    }

    const uploadedPhotos = validFiles.map(({ file, durationSeconds }, index) => ({
        id: `${file.name}-${file.lastModified}-${Date.now()}-${index}`,
        previewUrl: URL.createObjectURL(file),
        file,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        durationSeconds,
        caption: "",
      }));

    setPendingPhotos((current) => [...current, ...uploadedPhotos]);
  }

  function updatePendingPhotoCaption(photoId: string, caption: string) {
    setPendingPhotos((current) => current.map((photo) => (photo.id === photoId ? { ...photo, caption } : photo)));
  }

  function removePendingPhoto(photoId: string) {
    setPendingPhotos((current) => {
      const removed = current.find((photo) => photo.id === photoId);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((photo) => photo.id !== photoId);
    });
  }

  async function deleteChecklistPhoto(photo: ServiceOrderChecklistPhoto) {
    setPhotoDeleteError("");
    setNotice("");
    setDeletingPhotoId(photo.id);
    const response = await fetch(`/api/service-orders/${order.id}/checklist/${photo.checklistItemId}/photos/${photo.id}`, {
      method: "DELETE",
    });
    const data = await response.json().catch(() => null);
    setDeletingPhotoId("");

    if (!response.ok) {
      setPhotoDeleteError(data?.message ?? "Nao foi possivel apagar a midia.");
      return;
    }

    setLocalChecklistPhotos((current) => current.filter((candidate) => candidate.id !== photo.id));
    setNotice("Midia apagada do checklist.");
  }

  function buildChecklistPhotoEntries() {
    const manualPhotoUrl = photoUrl.trim();
    return [
      ...pendingPhotos.map((photo) => ({
        progressId: makeClientId("photo-upload"),
        file: photo.file,
        payload: {
          url: "",
          type: photoType,
          caption: photo.caption.trim(),
          fileName: photo.fileName,
          mimeType: photo.mimeType,
          sizeBytes: photo.sizeBytes,
          durationSeconds: photo.durationSeconds,
        },
      })),
      ...(manualPhotoUrl
        ? [
            {
              progressId: makeClientId("photo-upload"),
              payload: {
                url: manualPhotoUrl,
                type: photoType,
                caption: photoCaption || "Evidencia anexada ao item",
                fileName: manualPhotoUrl.split("/").pop(),
              },
            },
          ]
        : []),
    ] satisfies ChecklistPhotoUploadEntry[];
  }

  function applyChecklistActionData(data: {
    item?: ServiceOrderChecklistItem;
    photo?: ServiceOrderChecklistPhoto;
    photos?: ServiceOrderChecklistPhoto[];
  } | null) {
    if (data?.item) updateChecklistItemFromApi(data.item);
    if (data?.photo) setLocalChecklistPhotos((current) => [data.photo as ServiceOrderChecklistPhoto, ...current]);
    if (data?.photos?.length) setLocalChecklistPhotos((current) => [...(data.photos as ServiceOrderChecklistPhoto[]), ...current]);
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
    applyChecklistActionData(data);
    return data;
  }

  async function completeChecklist() {
    if (!activeChecklistItem) return;
    setNotice("");
    const item = activeChecklistItem;
    const completedEmployeeIds = Array.from(
      new Set((completedByEmployeeIdsInput.length ? completedByEmployeeIdsInput : [completedByEmployeeId]).filter(Boolean)),
    );
    const primaryCompletedByEmployeeId =
      user?.role === "COLABORADOR" && linkedEmployee?.id && completedEmployeeIds.includes(linkedEmployee.id)
        ? linkedEmployee.id
        : completedByEmployeeId || completedEmployeeIds[0] || "";
    if (!primaryCompletedByEmployeeId || completedEmployeeIds.length === 0) {
      setNotice("Selecione ao menos um colaborador que executou o item.");
      return;
    }
    const photoEntries = buildChecklistPhotoEntries();
    const photosToRevoke = pendingPhotos;

    if (photoEntries.length > 0) {
      enqueueChecklistUploadProgress(item, photoEntries);
      closeChecklistDialogAfterUploadStart(photosToRevoke);
      try {
        const photos = await Promise.all(photoEntries.map((entry) => prepareChecklistPhotoPayload(item, entry)));
        const data = await postJsonWithUploadProgress(
          `/api/service-orders/${order.id}/checklist/${item.id}/complete`,
          {
            completedByEmployeeId: primaryCompletedByEmployeeId,
            completedByEmployeeIds: completedEmployeeIds,
            completionNotes,
            photos,
          },
          (progress) => {
            photoEntries.forEach((entry) => updateChecklistUploadProgress(entry.progressId, { progress: Math.min(99, 96 + Math.round(progress * 0.03)) }));
          },
        );
        applyChecklistActionData(data as { item?: ServiceOrderChecklistItem; photos?: ServiceOrderChecklistPhoto[] });
        photoEntries.forEach((entry) => updateChecklistUploadProgress(entry.progressId, { progress: 100, status: "done" }));
        setNotice("Item de checklist concluido com responsavel e evidencia.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Nao foi possivel concluir o item com as midias.";
        photoEntries.forEach((entry) => updateChecklistUploadProgress(entry.progressId, { status: "error", error: message }));
        setNotice(message);
      }
      return;
    }

    const data = await runChecklistAction(`/api/service-orders/${order.id}/checklist/${item.id}/complete`, {
        completedByEmployeeId: primaryCompletedByEmployeeId,
        completedByEmployeeIds: completedEmployeeIds,
        completionNotes,
        photos: [],
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
    const item = activeChecklistItem;
    const photoEntries = buildChecklistPhotoEntries();
    const photosToRevoke = pendingPhotos;

    if (photoEntries.length === 0) {
      setNotice("Selecione ao menos uma midia para anexar ao item.");
      return;
    }

    enqueueChecklistUploadProgress(item, photoEntries);
    closeChecklistDialogAfterUploadStart(photosToRevoke);

    let failedUploads = 0;
    for (const entry of photoEntries) {
        try {
          const payload = await prepareChecklistPhotoPayload(item, entry);
          if (payload.url.startsWith("data:")) {
            const data = await postJsonWithUploadProgress(
              `/api/service-orders/${order.id}/checklist/${item.id}/photos`,
              payload,
              (progress) => updateChecklistUploadProgress(entry.progressId, { progress: Math.min(99, Math.max(12, progress)) }),
            );
            applyChecklistActionData(data as { photo?: ServiceOrderChecklistPhoto });
          } else {
            updateChecklistUploadProgress(entry.progressId, { progress: 98 });
            const data = await runChecklistAction(`/api/service-orders/${order.id}/checklist/${item.id}/photos`, payload);
            if (!data) throw new Error("Nao foi possivel registrar a midia no checklist.");
          }
          updateChecklistUploadProgress(entry.progressId, { progress: 100, status: "done" });
        } catch (error) {
          failedUploads += 1;
          const message = error instanceof Error ? error.message : "Nao foi possivel enviar a midia.";
          updateChecklistUploadProgress(entry.progressId, { status: "error", error: message });
        }
    }

    setNotice(failedUploads ? `${failedUploads} midia(s) nao foram enviadas. Verifique a fila de uploads.` : "Midia(s) anexada(s) ao item do checklist.");
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

  async function deleteChecklistItem() {
    if (!checklistItemToDelete) return;

    setChecklistDeleting(true);
    setChecklistDeleteError("");
    setNotice("");

    const response = await fetch(`/api/service-orders/${order.id}/checklist/${checklistItemToDelete.id}`, {
      method: "DELETE",
    });
    const data = await response.json().catch(() => null);
    setChecklistDeleting(false);

    if (!response.ok) {
      setChecklistDeleteError(data?.message ?? "Nao foi possivel apagar o item do checklist.");
      return;
    }

    const deletedItem = data?.item as ServiceOrderChecklistItem | undefined;
    setLocalChecklist((current) =>
      deletedItem
        ? current.map((item) => (item.id === deletedItem.id ? deletedItem : item))
        : current.filter((item) => item.id !== checklistItemToDelete.id),
    );
    setChecklistItemToDelete(null);
    setNotice("Item apagado do checklist operacional.");
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={2} sx={{ display: { xs: "none", sm: "flex" } }}>
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

      {user && canUseWhatsApp(user.role) && <Button component={Link} href={`/ordens-servico/${order.id}/historico`} variant="outlined" sx={{ alignSelf: "flex-start" }}>Histórico da obra e relatórios com IA</Button>}
      {notice && <Alert severity={notice.includes("Nao") ? "warning" : "success"}>{notice}</Alert>}
      {statusError && <Alert severity="warning">{statusError}</Alert>}
      {photoDeleteError && <Alert severity="warning">{photoDeleteError}</Alert>}

      {photoUploads.length > 0 && (
        <Paper
          variant="outlined"
          sx={{
            position: "fixed",
            right: { xs: 12, sm: 24 },
            bottom: { xs: 12, sm: 24 },
            left: { xs: 12, sm: "auto" },
            width: { xs: "auto", sm: 390 },
            maxHeight: "min(58vh, 520px)",
            overflowY: "auto",
            p: { xs: 1.5, sm: 2 },
            borderRadius: 2,
            bgcolor: "background.paper",
            boxShadow: 8,
            zIndex: 1600,
          }}
        >
          <Stack spacing={1.5}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1} alignItems={{ sm: "center" }}>
              <Box>
                <Typography variant="h6">Upload de midias</Typography>
                <Typography variant="body2" color="text.secondary">
                  O modal ja pode ficar fechado. As midias continuam subindo em segundo plano.
                </Typography>
              </Box>
              <Button size="small" variant="outlined" onClick={clearFinishedPhotoUploads} disabled={photoUploads.every((upload) => upload.status === "uploading")}>
                Limpar finalizados
              </Button>
            </Stack>
            <Stack spacing={1}>
              {photoUploads.map((upload) => (
                <Box key={upload.id} sx={{ p: 1.2, borderRadius: 2, border: 1, borderColor: upload.status === "error" ? "error.light" : "divider", bgcolor: "background.paper" }}>
                  <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={0.8}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={900} noWrap>
                        {upload.fileName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                        {upload.checklistItemTitle}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      color={upload.status === "error" ? "error" : upload.status === "done" ? "success" : "primary"}
                      label={upload.status === "error" ? "Erro" : upload.status === "done" ? "Concluido" : `${upload.progress}%`}
                    />
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={upload.progress}
                    color={upload.status === "error" ? "error" : upload.status === "done" ? "success" : "primary"}
                    sx={{ height: 7, borderRadius: 999, mt: 1 }}
                  />
                  {upload.error && (
                    <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.7 }}>
                      {upload.error}
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
          </Stack>
        </Paper>
      )}

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
              <Button variant="contained" onClick={updateServiceOrderStatus} disabled={statusInput === order.status && !statusReason.trim()} sx={{ minHeight: 40 }}>
                Atualizar
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      <Box sx={{ display: { xs: "none", sm: "grid" }, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
        <Kpi label="Checklist" value={`${progress}%`} helper={`${checklist.filter((task) => task.status === "DONE").length}/${checklist.length} etapas`} />
        <Kpi label="Equipe" value={String(team.length)} helper={`${evaluatedTeam.length} avaliados`} />
        <Kpi label={canViewFinancials ? "Receita" : "Financeiro"} value={canViewFinancials ? formatCurrency(order.revenue) : "Restrito"} helper={canViewFinancials ? `Margem ${marginLabel}` : "Visivel apenas para dono, financeiro e gerente autorizado"} />
        <Kpi label="Supervisor" value={employees.find((employee) => employee.id === order.supervisorEmployeeId)?.name ?? "Pendente"} helper="Responsavel principal" />
      </Box>

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        <Box sx={{ display: { xs: "block", sm: "none" }, position: "sticky", top: 64, zIndex: 8, p: 1.5, borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
          <TextField
            select
            label="Secao da OS"
            value={tab}
            onChange={(event) => setTab(Number(event.target.value))}
            fullWidth
            size="small"
          >
            {tabLabels.map((label, index) => (
              <MenuItem key={label} value={index}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          {tab === 3 && canAddChecklistItems && (
            <Button
              fullWidth
              variant="contained"
              startIcon={<AddRoundedIcon />}
              onClick={() => setChecklistCreateOpen(true)}
              sx={{ mt: 1 }}
            >
              Acrescentar item ao checklist
            </Button>
          )}
        </Box>
        <Tabs value={tab} onChange={(_, value: number) => setTab(value)} variant="scrollable" scrollButtons="auto" sx={{ px: 1, borderBottom: 1, borderColor: "divider", display: { xs: "none", sm: "flex" } }}>
          {tabLabels.map((label) => (
            <Tab key={label} label={label} />
          ))}
        </Tabs>

        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          {tab === 0 && (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 0.9fr" }, gap: 2.5 }}>
              <Stack spacing={2}>
                <Typography variant="h6">Resumo da OS</Typography>
                <ServiceTasks order={order} canManage={Boolean(user && ["OWNER", "GERENTE", "SUPERVISOR_OBRA"].includes(user.role))} canCreate={Boolean(user && ["OWNER", "GERENTE"].includes(user.role))} onChange={(tasks) => setOrder((current) => ({ ...current, tasks }))} />
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
            <Stack spacing={2}>
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
              {canShareClientTracking && (
                <Paper
                  variant="outlined"
                  sx={{
                    p: { xs: 2, sm: 2.5 },
                    borderRadius: 2,
                    background: "linear-gradient(135deg, rgba(0,168,232,.08), rgba(37,199,131,.08))",
                    borderColor: "primary.light",
                  }}
                >
                  <Stack spacing={1.5}>
                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5}>
                      <Box>
                        <Typography variant="h6">Acesso do cliente</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Envie este codigo para o cliente acompanhar progresso, checklist, fotos e videos da OS fora do dashboard.
                        </Typography>
                      </Box>
                      <Chip color={clientTrackingCode ? "success" : "default"} label={clientTrackingCode ? "Acesso ativo" : "Sem codigo"} />
                    </Stack>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "190px 0.8fr 1.2fr" }, gap: 1.5 }}>
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          bgcolor: "background.paper",
                          border: 1,
                          borderColor: "divider",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 1,
                          textAlign: "center",
                        }}
                      >
                        <Stack direction="row" spacing={0.8} alignItems="center" justifyContent="center">
                          <QrCode2RoundedIcon color="primary" fontSize="small" />
                          <Typography fontWeight={900}>QR Code</Typography>
                        </Stack>
                        {clientTrackingQrSrc ? (
                          <Box
                            component="img"
                            src={clientTrackingQrSrc}
                            alt={`QR Code de acompanhamento da OS ${order.id}`}
                            loading="lazy"
                            sx={{
                              width: 132,
                              height: 132,
                              borderRadius: 2,
                              border: 1,
                              borderColor: "divider",
                              bgcolor: "common.white",
                              p: 1,
                              boxShadow: "0 14px 34px rgba(15, 23, 42, 0.14)",
                            }}
                          />
                        ) : (
                          <Box
                            sx={{
                              width: 132,
                              height: 132,
                              borderRadius: 2,
                              border: 1,
                              borderColor: "divider",
                              bgcolor: "action.hover",
                              display: "grid",
                              placeItems: "center",
                            }}
                          >
                            <QrCode2RoundedIcon color="disabled" sx={{ fontSize: 46 }} />
                          </Box>
                        )}
                        <Typography variant="caption" color="text.secondary">
                          Cliente escaneia e abre o acompanhamento direto.
                        </Typography>
                      </Box>
                      <Box sx={{ p: 2, borderRadius: 2, bgcolor: "background.paper", border: 1, borderColor: "divider" }}>
                        <Info label="Codigo" value={clientTrackingCode || "Nao gerado"} />
                      </Box>
                      <Box sx={{ p: 2, borderRadius: 2, bgcolor: "background.paper", border: 1, borderColor: "divider" }}>
                        <Info label="Pagina" value="/acompanhe-servico" />
                      </Box>
                    </Box>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <Button
                        component={Link}
                        href={clientTrackingHref}
                        target="_blank"
                        variant="contained"
                        disabled={!clientTrackingCode}
                      >
                        Abrir pagina do cliente
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<ContentCopyRoundedIcon />}
                        disabled={!clientTrackingCode}
                        onClick={() => {
                          void copyClientTrackingLink();
                        }}
                      >
                        Copiar link
                      </Button>
                      <Button
                        variant="outlined"
                        disabled={!clientTrackingCode || !customerWhatsAppPhone}
                        onClick={sendClientTrackingByWhatsApp}
                      >
                        Enviar pelo WhatsApp
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              )}
              {order.clientDeliverySignedAt && (
                <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, bgcolor: "background.default" }}>
                  <Stack spacing={2}>
                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5}>
                      <Box>
                        <Typography variant="h6">Entrega assinada pelo cliente</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Confirmada por {order.clientDeliveryAcceptedBy || order.customerName} em {formatDateTime(order.clientDeliverySignedAt)}.
                        </Typography>
                      </Box>
                      <Chip color="success" icon={<CheckCircleRoundedIcon />} label="Entrega confirmada" />
                    </Stack>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
                      <Box>
                        <Info label="Nota do cliente" value={order.clientRating ? `${order.clientRating}/5` : "Sem nota"} />
                        {order.clientFeedback && (
                          <Alert severity="success" sx={{ mt: 1.5 }}>
                            {order.clientFeedback}
                          </Alert>
                        )}
                      </Box>
                      {order.clientDeliverySignatureUrl && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Assinatura
                          </Typography>
                          <Box
                            component="img"
                            src={order.clientDeliverySignatureUrl}
                            alt="Assinatura de entrega do cliente"
                            sx={{ display: "block", width: "100%", mt: 0.8, borderRadius: 2, border: 1, borderColor: "divider", bgcolor: "background.paper" }}
                          />
                        </Box>
                      )}
                    </Box>
                  </Stack>
                </Paper>
              )}
            </Stack>
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
                    <Typography variant="caption" color="text.secondary">
                      Ao adicionar, o sistema confere se o colaborador ja esta escalado em outra OS ativa.
                    </Typography>
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
                      {canManageTeam && (
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          startIcon={<DeleteOutlineRoundedIcon />}
                          onClick={() => removeTeamEmployee(employee.id)}
                          disabled={removingTeamEmployeeId === employee.id}
                        >
                          {removingTeamEmployeeId === employee.id ? "Removendo..." : "Remover"}
                        </Button>
                      )}
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
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ sm: "center" }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap sx={{ width: { xs: "100%", sm: "auto" } }}>
                  {canAddChecklistItems && (
                    <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setChecklistCreateOpen(true)} sx={{ display: { xs: "none", sm: "inline-flex" }, width: { xs: "100%", sm: "auto" } }}>
                      Acrescentar item
                    </Button>
                  )}
                  <Button variant="outlined" onClick={() => setChecklistSummaryOpen((current) => !current)} sx={{ width: { xs: "100%", sm: "auto" } }}>
                    {checklistSummaryOpen ? "Ocultar resumo" : "Ver resumo"}
                  </Button>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {filteredChecklist.length} de {checklist.length} itens exibidos
                </Typography>
              </Stack>

              <Collapse in={checklistSummaryOpen}>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(5, minmax(0, 1fr))" }, gap: 1.5 }}>
                  <Kpi label="Execucao" value={`${checklistStats.progress}%`} helper={`${checklistStats.completedRequired}/${checklistStats.requiredTotal} obrigatorios`} />
                  <Kpi label="Validado" value={`${checklistStats.validatedPercent}%`} helper="Conferencia da supervisao" />
                  <Kpi label="Bloqueados" value={String(checklistStats.blocked)} helper="Precisam de destrave" />
                <Kpi label="Midias pendentes" value={String(checklistStats.pendingPhotoItems)} helper="Evidencia obrigatoria" />
                  <Kpi label="Atrasados" value={String(checklistStats.overdueItems)} helper="Prazo vencido" />
                </Box>
              </Collapse>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {checklistStatusFilters.map((filter) => (
                  <Chip
                    key={filter}
                    label={checklistStatusLabel(filter)}
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
                const completedIds = completedIdsFor(item);
                const completedTeam = employees.filter((employee) => completedIds.includes(employee.id));
                const overdue = Boolean(item.dueAt && new Date(item.dueAt).getTime() < referenceNow && item.status !== "DONE" && item.status !== "CANCELED");
                const isExpanded = expandedChecklistItemId === item.id;
                const isStarted = item.status === "IN_PROGRESS";
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
                      position: "relative",
                      overflow: "hidden",
                      p: 2,
                      borderRadius: 2,
                      bgcolor: isAssignedToLoggedCollaborator ? "action.selected" : "background.default",
                      borderColor: isAssignedToLoggedCollaborator ? "primary.main" : "divider",
                      boxShadow: isAssignedToLoggedCollaborator ? "0 0 0 1px rgba(0, 121, 107, 0.28), 0 10px 24px rgba(15, 23, 42, 0.08)" : "none",
                      transition: "border-color .2s, box-shadow .2s, background-color .2s",
                    }}
                  >
                    {isStarted && <SoapBubbleStatusEffect />}
                    <Stack spacing={1.5} sx={{ position: "relative", zIndex: 1 }}>
                      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                            <Typography fontWeight={900}>{item.sortOrder}. {item.title}</Typography>
                            {isAssignedToLoggedCollaborator && <Chip size="small" color="primary" icon={<PersonRoundedIcon />} label="Minha tarefa" />}
                            {item.isPriority && <Chip size="small" color="error" icon={<WarningAmberRoundedIcon />} label="Prioridade" />}
                            <Chip size="small" color={checklistStatusColor(item.status)} label={checklistStatusLabel(item.status)} />
                            {item.requiresPhoto && <Chip size="small" icon={<CameraAltRoundedIcon />} label={`${photos.length}/${Math.max(item.minimumPhotos, 1)} midias`} />}
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
                          {canDeleteChecklistItems && (
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<DeleteOutlineRoundedIcon />}
                              onClick={() => {
                                setChecklistDeleteError("");
                                setChecklistItemToDelete(item);
                              }}
                            >
                              Apagar
                            </Button>
                          )}
                        </Stack>
                      </Stack>
                      {isExpanded && (
                        <>
                          <Typography variant="body2" color="text.secondary">
                            {item.description || "Sem descricao detalhada."}
                          </Typography>
                      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" }, gap: 1.2 }}>
                        <Info label="Atribuido a" value={assignedTeam.map((employee) => employee.name).join(", ") || "Sem responsavel"} />
                        <Info label="Executado por" value={completedTeam.map((employee) => employee.name).join(", ") || "Pendente"} />
                        <Info label="Acrescentado por" value={userName(item.createdByUserId)} />
                        <Info label="Prazo" value={item.dueAt ? formatDateTime(item.dueAt) : "Sem prazo"} />
                        <Info label="Inicio" value={item.startedAt ? formatDateTime(item.startedAt) : "Pendente"} />
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
                          Enviar midias
                        </Button>
                        <Button size="small" variant="outlined" disabled={!canValidate || item.status === "CANCELED"} startIcon={<ReplayRoundedIcon />} onClick={() => openChecklistAction(item, "reopen")}>
                          Reabrir
                        </Button>
                      </Stack>
                      {photos.length > 0 && (
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          {photos.map((photo) => (
                            <Chip
                              key={photo.id}
                              size="small"
                              icon={<CameraAltRoundedIcon />}
                              label={`${labelFor(photo.type)}: ${photo.caption || photo.fileName || "midia"}`}
                              disabled={deletingPhotoId === photo.id}
                              onDelete={canOperate ? () => void deleteChecklistPhoto(photo) : undefined}
                            />
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
            <Stack spacing={2}>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 1.5 }}>
                <Kpi label="Midias da OS" value={String(orderChecklistPhotos.length)} helper="Fotos e videos salvos no banco" />
                <Kpi label="Antes" value={String(orderChecklistPhotos.filter((photo) => photo.type === "BEFORE").length)} helper="Condicao inicial" />
                <Kpi label="Depois" value={String(orderChecklistPhotos.filter((photo) => photo.type === "AFTER").length)} helper="Entrega final" />
              </Box>

              {orderChecklistPhotos.length === 0 ? (
                <Alert severity="info">Nenhuma midia foi enviada para esta OS ainda. Fotos e videos aparecem aqui assim que forem anexados nos itens do checklist.</Alert>
              ) : (
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
                  {photoGalleryStages.map((stage) => {
                    const photos = orderChecklistPhotos.filter((photo) => photo.type === stage.type);
                    const cover = photos[0];
                    return (
                      <Paper
                        key={stage.type}
                        variant="outlined"
                        role={photos.length ? "button" : undefined}
                        tabIndex={photos.length ? 0 : -1}
                        onClick={() => {
                          if (photos.length) setPhotoGalleryType(stage.type);
                        }}
                        onKeyDown={(event) => {
                          if (photos.length && (event.key === "Enter" || event.key === " ")) {
                            event.preventDefault();
                            setPhotoGalleryType(stage.type);
                          }
                        }}
                        sx={{
                          borderRadius: 2,
                          overflow: "hidden",
                          cursor: photos.length ? "pointer" : "default",
                          opacity: photos.length ? 1 : 0.72,
                          transition: "border-color .18s ease, transform .18s ease, box-shadow .18s ease",
                          "&:hover": photos.length
                            ? {
                                borderColor: `${stage.tone}.main`,
                                boxShadow: 3,
                                transform: "translateY(-2px)",
                              }
                            : undefined,
                        }}
                      >
                        <Box sx={{ height: 174, bgcolor: "action.hover", position: "relative", display: "grid", placeItems: "center" }}>
                          {cover ? (
                            <ChecklistMediaPreview media={cover} alt={cover.caption || cover.fileName || stage.title} sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                          ) : (
                            <CameraAltRoundedIcon sx={{ fontSize: 44, color: "text.secondary" }} />
                          )}
                          <Chip
                            size="small"
                            color={stage.tone}
                            label={`${photos.length} midia${photos.length === 1 ? "" : "s"}`}
                            sx={{ position: "absolute", left: 12, top: 12, fontWeight: 900 }}
                          />
                        </Box>
                        <Box sx={{ p: 2 }}>
                          <Typography variant="h6">{stage.title}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {stage.description}
                          </Typography>
                          {cover && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                              Ultima midia: {formatDateTime(cover.createdAt)}
                            </Typography>
                          )}
                        </Box>
                      </Paper>
                    );
                  })}
                </Box>
              )}

              {orderChecklistPhotos.length > 0 && (
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "background.default" }}>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    Midias recentes
                  </Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, minmax(0, 1fr))" }, gap: 1.4 }}>
                    {orderChecklistPhotos.slice(0, 8).map((photo) => (
                      <Box key={photo.id} sx={{ minWidth: 0 }}>
                        <ChecklistMediaPreview
                          media={photo}
                          alt={photo.caption || photo.fileName || labelFor(photo.type)}
                          sx={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 1.5, border: 1, borderColor: "divider", bgcolor: "action.hover", display: "block" }}
                        />
                        <Typography variant="caption" fontWeight={850} noWrap sx={{ display: "block", mt: 0.6 }}>
                          {labelFor(photo.type)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                          {checklistItemTitle(photo.checklistItemId)}
                        </Typography>
                        {canOperate && (
                          <Button
                            size="small"
                            color="error"
                            variant="text"
                            startIcon={<DeleteOutlineRoundedIcon />}
                            onClick={() => void deleteChecklistPhoto(photo)}
                            disabled={deletingPhotoId === photo.id}
                            sx={{ mt: 0.5, px: 0 }}
                          >
                            {deletingPhotoId === photo.id ? "Apagando..." : "Apagar"}
                          </Button>
                        )}
                      </Box>
                    ))}
                  </Box>
                </Paper>
              )}
            </Stack>
          )}

          {tab === 5 && (
            <Stack spacing={2}>
              {resourceError && <Alert severity="warning">{resourceError}</Alert>}
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 1.5 }}>
                <Kpi label="Materiais da empresa" value={String(materials.length)} helper="Cadastro completo" />
                <Kpi label="Disponiveis" value={String(availableMaterials.length)} helper="Com estoque positivo" />
                <Kpi label="Nesta OS" value={String(orderMaterials.length)} helper="Planejado ou entregue" />
              </Box>

              {canManageServiceResources && (
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Stack spacing={1.5}>
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1}>
                      <Box>
                        <Typography variant="h6">Gerenciar materiais do servico</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Acrescente material na OS ou ajuste o que ja esta planejado para a equipe.
                        </Typography>
                      </Box>
                      <Chip color="primary" variant="outlined" label={canPrepareServiceResources ? "Gestao completa" : "Supervisor da OS"} />
                    </Stack>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.4fr .5fr 1.4fr auto" }, gap: 1.2, alignItems: "center" }}>
                      <TextField select size="small" label="Material" value={serviceMaterialId} onChange={(event) => setServiceMaterialId(event.target.value)}>
                        {materials.map((material) => (
                          <MenuItem key={material.id} value={material.id}>
                            {material.name} - {material.currentStock} {material.unit}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField size="small" label="Qtd." type="number" value={serviceMaterialQuantity} onChange={(event) => setServiceMaterialQuantity(event.target.value)} />
                      <TextField size="small" label="Observacao" value={serviceMaterialNotes} onChange={(event) => setServiceMaterialNotes(event.target.value)} />
                      <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={addServiceMaterial} disabled={resourceSaving || !materials.length}>
                        Acrescentar
                      </Button>
                    </Box>
                  </Stack>
                </Paper>
              )}

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
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                              {canManageServiceResources ? (
                                <>
                                  <TextField
                                    select
                                    size="small"
                                    label="Status"
                                    value={item.status}
                                    onChange={(event) => void patchServiceMaterial(item, { status: event.target.value as ServiceOrderMaterialStatus })}
                                    sx={{ minWidth: 180 }}
                                    disabled={resourceSaving}
                                  >
                                    {materialStatusOptions.map((status) => (
                                      <MenuItem key={status} value={status}>
                                        {labelFor(status)}
                                      </MenuItem>
                                    ))}
                                  </TextField>
                                  <TextField
                                    size="small"
                                    label="Planejado"
                                    type="number"
                                    defaultValue={item.plannedQuantity}
                                    onBlur={(event) => {
                                      const nextQuantity = Number(event.target.value);
                                      if (Number.isFinite(nextQuantity) && nextQuantity >= 0 && nextQuantity !== item.plannedQuantity) {
                                        void patchServiceMaterial(item, { plannedQuantity: nextQuantity });
                                      }
                                    }}
                                    sx={{ width: 120 }}
                                    disabled={resourceSaving}
                                  />
                                  <Button
                                    size="small"
                                    color="error"
                                    variant="outlined"
                                    startIcon={<DeleteOutlineRoundedIcon />}
                                    onClick={() => void patchServiceMaterial(item, { status: "CANCELED" })}
                                    disabled={resourceSaving}
                                  >
                                    Remover
                                  </Button>
                                </>
                              ) : (
                                <StatusChip value={item.status} />
                              )}
                            </Stack>
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
              {resourceError && <Alert severity="warning">{resourceError}</Alert>}
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 1.5 }}>
                <Kpi label="Equipamentos da empresa" value={String(equipment.length)} helper="Cadastro completo" />
                <Kpi label="Disponiveis" value={String(availableEquipment.length)} helper="Livres para reserva" />
                <Kpi label="Nesta OS" value={String(orderEquipment.length)} helper="Reservados ou em uso" />
              </Box>

              {canManageServiceResources && (
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Stack spacing={1.5}>
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1}>
                      <Box>
                        <Typography variant="h6">Gerenciar equipamentos do servico</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Use os equipamentos disponiveis abaixo para solicitar e acompanhar o uso na OS.
                        </Typography>
                      </Box>
                      <Chip color="primary" variant="outlined" label={canPrepareServiceResources ? "Gestao completa" : "Supervisor da OS"} />
                    </Stack>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.2 }}>
                      <TextField
                        size="small"
                        label="Condicao antes"
                        value={equipmentConditionBefore}
                        onChange={(event) => setEquipmentConditionBefore(event.target.value)}
                      />
                      <TextField
                        size="small"
                        label="Observacao ao almoxarifado"
                        value={equipmentNotes}
                        onChange={(event) => setEquipmentNotes(event.target.value)}
                      />
                    </Box>
                  </Stack>
                </Paper>
              )}

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
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                              {canManageServiceResources ? (
                                <>
                                  <TextField
                                    select
                                    size="small"
                                    label="Status"
                                    value={item.status}
                                    onChange={(event) => void patchServiceEquipment(item, { status: event.target.value as ServiceOrderEquipmentStatus })}
                                    sx={{ minWidth: 170 }}
                                    disabled={resourceSaving}
                                  >
                                    {equipmentStatusOptions.map((status) => (
                                      <MenuItem key={status} value={status}>
                                        {labelFor(status)}
                                      </MenuItem>
                                    ))}
                                  </TextField>
                                  <Button
                                    size="small"
                                    color="error"
                                    variant="outlined"
                                    startIcon={<DeleteOutlineRoundedIcon />}
                                    onClick={() => void patchServiceEquipment(item, { status: "CANCELED" })}
                                    disabled={resourceSaving}
                                  >
                                    Remover
                                  </Button>
                                </>
                              ) : (
                                <StatusChip value={item.status} />
                              )}
                            </Stack>
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
                              <Button size="small" variant="contained" disabled={!canManageServiceResources || resourceSaving} onClick={() => void requestEquipment(item.id)}>
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
              <Stack spacing={2}>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
                  <Kpi label="Total contratado" value={formatCurrency(order.revenue)} helper="Valor fechado da OS" />
                  <Kpi label="Custo atualizado" value={formatCurrency(order.expenses)} helper="Custo operacional informado" />
                  <Kpi label="Lucro calculado" value={formatCurrency(order.revenue - order.expenses)} helper="Total menos custo" />
                  <Kpi label="Margem" value={marginLabel} helper="Lucro sobre total" />
                </Box>

                <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, bgcolor: "background.default" }}>
                  <Stack direction={{ xs: "column", lg: "row" }} spacing={2} alignItems={{ lg: "center" }} justifyContent="space-between">
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar variant="rounded" sx={{ bgcolor: "success.light", color: "success.dark" }}>
                        <PaymentsRoundedIcon />
                      </Avatar>
                      <Box>
                        <Typography fontWeight={900}>Atualizar financeiro da OS</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Dono, financeiro e gerente autorizado podem editar total e custo. O lucro e calculado automaticamente.
                        </Typography>
                      </Box>
                    </Stack>
                    <Button component={Link} href="/financeiro" variant="outlined" endIcon={<ArrowForwardRoundedIcon />}>
                      Abrir financeiro
                    </Button>
                  </Stack>

                  <TextField label="Motivo do ajuste financeiro" fullWidth required value={financialReason} onChange={(event) => setFinancialReason(event.target.value)} sx={{ mt: 2 }} />
                  {financialError && <Alert severity="warning" sx={{ mt: 2 }}>{financialError}</Alert>}

                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5, mt: 2 }}>
                    <TextField
                      label="Total contratado"
                      type="number"
                      value={financialRevenueInput}
                      onChange={(event) => setFinancialRevenueInput(event.target.value)}
                      inputProps={{ min: 0, step: "0.01" }}
                      fullWidth
                    />
                    <TextField
                      label="Custo total"
                      type="number"
                      value={financialExpensesInput}
                      onChange={(event) => setFinancialExpensesInput(event.target.value)}
                      inputProps={{ min: 0, step: "0.01" }}
                      fullWidth
                    />
                  </Box>

                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1.5, mt: 2 }}>
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                      <Info label="Lucro apos atualizacao" value={formatCurrency(financialProfitPreview)} />
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                      <Info label="Margem apos atualizacao" value={`${financialMarginPreview}%`} />
                    </Paper>
                  </Box>

                  {financialSaving && <LinearProgress sx={{ mt: 2, height: 7, borderRadius: 999 }} />}

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} justifyContent="flex-end" sx={{ mt: 2 }}>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setFinancialRevenueInput(String(order.revenue));
                        setFinancialExpensesInput(String(order.expenses));
                        setFinancialError("");
                      }}
                    >
                      Desfazer
                    </Button>
                    <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={updateFinancials} disabled={financialSaving}>
                      Salvar valores
                    </Button>
                  </Stack>
                </Paper>
              </Stack>
            ) : (
              <Alert severity="info" icon={<LockRoundedIcon />}>
                Valores financeiros desta OS ficam restritos ao dono, ao financeiro e a gerentes autorizados.
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
                          <EvaluationButton orderId={order.id} employeeId={employee.id} name={employee.name} disabled={!canEvaluate} onSaved={(evaluation) => { setLocalEvaluations((current) => [evaluation, ...current]); setNotice("Avaliação registrada."); }} />
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

      <Dialog open={checklistCreateOpen} onClose={() => setChecklistCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Acrescentar item ao checklist</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Item do checklist"
              value={newChecklistTitle}
              onChange={(event) => setNewChecklistTitle(event.target.value)}
              autoFocus
              fullWidth
            />
            <TextField
              label="Detalhes do item"
              value={newChecklistDescription}
              onChange={(event) => setNewChecklistDescription(event.target.value)}
              multiline
              minRows={3}
              fullWidth
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap>
              <FormControlLabel
                control={<Checkbox checked={newChecklistPriority} onChange={(event) => setNewChecklistPriority(event.target.checked)} />}
                label="Prioridade"
              />
              <FormControlLabel
                control={<Checkbox checked={newChecklistRequiresPhoto} onChange={(event) => setNewChecklistRequiresPhoto(event.target.checked)} />}
                label="Exigir midia"
              />
              <FormControlLabel
                control={<Checkbox checked={newChecklistAllowCollaborator} onChange={(event) => setNewChecklistAllowCollaborator(event.target.checked)} />}
                label="Colaborador pode executar"
              />
            </Stack>
            {checklistError && <Alert severity="error">{checklistError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChecklistCreateOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => {
              void createChecklistItemFromForm();
            }}
          >
            Adicionar item
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(checklistItemToDelete)} onClose={() => (checklistDeleting ? undefined : setChecklistItemToDelete(null))} fullWidth maxWidth="xs">
        <DialogTitle>Apagar item do checklist?</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="warning">
              Esta acao remove o item da lista operacional. O historico tecnico fica preservado quando o item ja possui movimentacao.
            </Alert>
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: "background.default", border: 1, borderColor: "divider" }}>
              <Typography variant="caption" color="text.secondary">
                Item selecionado
              </Typography>
              <Typography fontWeight={900}>
                {checklistItemToDelete?.sortOrder}. {checklistItemToDelete?.title}
              </Typography>
            </Box>
            {checklistDeleteError && <Alert severity="error">{checklistDeleteError}</Alert>}
            {checklistDeleting && <LinearProgress sx={{ height: 7, borderRadius: 999 }} />}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={checklistDeleting} onClick={() => setChecklistItemToDelete(null)}>
            Cancelar
          </Button>
          <Button color="error" variant="contained" disabled={checklistDeleting} startIcon={<DeleteOutlineRoundedIcon />} onClick={deleteChecklistItem}>
            Apagar item
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(activeChecklistItem)} onClose={() => closeChecklistDialogAfterUploadStart(pendingPhotos)} fullWidth maxWidth="sm">
        <DialogTitle>
          {checklistActionMode === "assign"
            ? "Atribuir responsavel"
            : checklistActionMode === "block"
              ? "Bloquear item"
              : checklistActionMode === "reopen"
                ? "Reabrir item"
                : checklistActionMode === "photo"
                  ? "Enviar midias do item"
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
              <Stack spacing={1.2}>
                <TextField
                  select
                  label="Colaboradores que executaram"
                  value={completedByEmployeeIdsInput}
                  onChange={(event) => {
                    const value = event.target.value;
                    const nextIds = typeof value === "string" ? value.split(",") : value;
                    setCompletedByEmployeeIdsInput(nextIds);
                    setCompletedByEmployeeId((current) => (nextIds.includes(current) ? current : nextIds[0] ?? ""));
                  }}
                  SelectProps={{ multiple: true }}
                  helperText="Os colaboradores atribuidos ao item entram pre-selecionados."
                  fullWidth
                >
                  {team.map((employee) => (
                    <MenuItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </MenuItem>
                  ))}
                </TextField>
                {completedByEmployeeIdsInput.length > 0 && (
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {completedByEmployeeIdsInput.map((employeeId) => {
                      const employee = employees.find((item) => item.id === employeeId);
                      return employee ? <Chip key={employeeId} size="small" color="primary" variant="outlined" label={employee.name} /> : null;
                    })}
                  </Stack>
                )}
              </Stack>
            )}
            {(checklistActionMode === "complete" || checklistActionMode === "photo") && (
              <>
                {checklistActionMode === "complete" && (
                  <TextField label="Observacao de conclusao" value={completionNotes} onChange={(event) => setCompletionNotes(event.target.value)} multiline minRows={3} />
                )}
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "0.8fr 1.2fr" }, gap: 1.5 }}>
                  <TextField select label="Tipo da midia" value={photoType} onChange={(event) => setPhotoType(event.target.value as ChecklistPhotoType)}>
                    {["BEFORE", "DURING", "AFTER", "EVIDENCE", "PROBLEM"].map((type) => (
                      <MenuItem key={type} value={type}>
                        {labelFor(type)}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button component="label" variant="outlined" startIcon={<CameraAltRoundedIcon />} sx={{ minHeight: 56 }}>
                    Enviar midias
                    <input
                      hidden
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/webm,video/quicktime"
                      multiple
                      onChange={(event) => {
                        void handleChecklistPhotoUpload(event.target.files);
                        event.target.value = "";
                      }}
                    />
                  </Button>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Voce pode enviar varias midias de uma vez. A descricao e opcional. Use fotos JPEG, PNG, WebP ou HEIC com ate {Math.floor(maxMediaBytes / 1024 / 1024)} MB, ou videos MP4, WebM e MOV de ate {maxChecklistVideoSeconds}s.
                  {activeChecklistItem?.requiresPhoto ? ` Minimo: ${Math.max(activeChecklistItem.minimumPhotos, 1)} midia(s).` : ""}
                </Typography>
                {pendingPhotos.length > 0 && (
                  <Stack spacing={1}>
                    {pendingPhotos.map((photo) => (
                      <Paper key={photo.id} variant="outlined" sx={{ p: 1.2, borderRadius: 2, bgcolor: "background.default" }}>
                        <Stack direction="row" spacing={1.2} alignItems="center">
                          <ChecklistMediaPreview
                            media={{ url: photo.previewUrl, mimeType: photo.mimeType, fileName: photo.fileName }}
                            alt={photo.caption || photo.fileName}
                            sx={{ width: 58, height: 46, borderRadius: 1.2, objectFit: "cover", bgcolor: "action.hover", flexShrink: 0, display: "block" }}
                          />
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="body2" fontWeight={850} noWrap>
                              {photo.fileName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatPhotoSize(photo.sizeBytes)}
                              {photo.durationSeconds ? ` | ${Math.round(photo.durationSeconds)}s` : ""}
                            </Typography>
                          </Box>
                          <Button size="small" color="warning" onClick={() => removePendingPhoto(photo.id)}>
                            Remover
                          </Button>
                        </Stack>
                        <TextField
                          size="small"
                          label="Descricao da midia (opcional)"
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
          <Button onClick={() => closeChecklistDialogAfterUploadStart(pendingPhotos)}>Cancelar</Button>
          <Button variant="contained" onClick={submitChecklistDialog} startIcon={<CheckCircleRoundedIcon />}>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(photoGalleryType)} onClose={() => setPhotoGalleryType(null)} fullWidth maxWidth="lg">
        <DialogTitle>
          Midias - {selectedGalleryStage?.title ?? "OS"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity={selectedGallerySeverity}>
              {selectedGalleryStage?.description ?? "Registros vinculados ao checklist desta ordem de servico."}
            </Alert>

            {selectedGalleryPhotos.length === 0 ? (
              <Alert severity="info">Nenhuma midia desta etapa foi enviada ainda.</Alert>
            ) : (
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
                {selectedGalleryPhotos.map((photo) => (
                  <Paper key={photo.id} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
                    <Box sx={{ display: "block", bgcolor: "action.hover" }}>
                      <ChecklistMediaPreview
                        media={photo}
                        alt={photo.caption || photo.fileName || labelFor(photo.type)}
                        controls={isVideoMedia(photo)}
                        sx={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", display: "block" }}
                      />
                    </Box>
                    <Stack spacing={1} sx={{ p: 1.5 }}>
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                        <Chip size="small" label={labelFor(photo.type)} />
                        <Typography variant="caption" color="text.secondary">
                          {formatDateTime(photo.createdAt)}
                        </Typography>
                      </Stack>
                      <Box>
                        <Typography fontWeight={900} noWrap>
                          {checklistItemTitle(photo.checklistItemId)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-word" }}>
                          {photo.caption || photo.fileName || "Midia sem descricao"}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        Enviado por {userName(photo.uploadedByUserId)}
                        {photo.employeeId ? ` | Colaborador: ${employeeName(photo.employeeId) || "Nao informado"}` : ""}
                      </Typography>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                        <Button component="a" href={photo.url} target="_blank" rel="noreferrer" size="small" variant="outlined">
                          Abrir midia
                        </Button>
                        {canOperate && (
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            startIcon={<DeleteOutlineRoundedIcon />}
                            onClick={() => void deleteChecklistPhoto(photo)}
                            disabled={deletingPhotoId === photo.id}
                          >
                            {deletingPhotoId === photo.id ? "Apagando..." : "Apagar"}
                          </Button>
                        )}
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPhotoGalleryType(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function ChecklistMediaPreview({
  media,
  alt,
  controls = false,
  sx,
}: {
  media: { url?: string; mimeType?: string; fileName?: string };
  alt: string;
  controls?: boolean;
  sx?: SxProps<Theme>;
}) {
  if (isVideoMedia(media)) {
    return (
      <Box
        component="video"
        src={media.url}
        aria-label={alt}
        controls={controls}
        muted={!controls}
        playsInline
        preload="metadata"
        sx={sx}
      />
    );
  }

  return <Box component="img" src={media.url} alt={alt} loading="lazy" sx={sx} />;
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
