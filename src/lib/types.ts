export type UserRole =
  | "OWNER"
  | "GERENTE"
  | "SUPERVISOR_OBRA"
  | "ALMOXARIFADO"
  | "COMERCIAL"
  | "TECNICO"
  | "FINANCEIRO"
  | "COLABORADOR";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
};

export type SystemUser = SessionUser & {
  passwordHash?: string;
  linkedEmployeeId?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeStatus = "ACTIVE" | "INACTIVE" | "ON_LEAVE" | "FIRED";
export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "INSPECTION_SCHEDULED"
  | "INSPECTION_DONE"
  | "QUOTE_SENT"
  | "NEGOTIATION"
  | "WON"
  | "LOST";
export type QuoteStatus = "DRAFT" | "SENT" | "APPROVED" | "REJECTED" | "EXPIRED";
export type ServiceOrderStatus =
  | "SCHEDULED"
  | "PREPARING"
  | "IN_PROGRESS"
  | "PAUSED"
  | "WAITING_CUSTOMER"
  | "DONE"
  | "DELIVERED"
  | "CANCELED";

export type ChecklistItemStatus = "PENDING" | "IN_PROGRESS" | "DONE" | "BLOCKED" | "REOPENED" | "CANCELED";
export type ChecklistPhotoType = "BEFORE" | "DURING" | "AFTER" | "EVIDENCE" | "PROBLEM";
export type ChecklistEventType =
  | "CREATED"
  | "UPDATED"
  | "ASSIGNED"
  | "STARTED"
  | "COMPLETED"
  | "VALIDATED"
  | "REOPENED"
  | "BLOCKED"
  | "CANCELED"
  | "PHOTO_ADDED"
  | "PHOTO_REMOVED"
  | "COMMENT_ADDED";
export type ServiceType =
  | "POST_CONSTRUCTION_CLEANING"
  | "POLISHING"
  | "RESTORATION"
  | "CRYSTALLIZATION"
  | "WATERPROOFING"
  | "STAIN_REMOVAL"
  | "GROUT_CLEANING"
  | "MAINTENANCE"
  | "OTHER";
export type ServiceTeamRole = "SUPERVISOR" | "POLIDOR" | "AUXILIAR" | "TECNICO" | "MOTORISTA" | "ALMOXARIFADO" | "OUTRO";
export type ServiceOrderMaterialStatus =
  | "PENDING_SEPARATION"
  | "SEPARATING"
  | "RESERVED"
  | "SEPARATED"
  | "DELIVERED_TO_TEAM"
  | "PARTIALLY_RETURNED"
  | "RETURNED"
  | "CONSUMED"
  | "DAMAGED"
  | "LOST"
  | "CANCELED";
export type ServiceOrderEquipmentStatus = "REQUESTED" | "RESERVED" | "DELIVERED" | "IN_USE" | "RETURNED" | "DAMAGED" | "LOST" | "CANCELED";
export type StockItemStatus = "AVAILABLE" | "RESERVED" | "LOW_STOCK" | "OUT_OF_STOCK" | "IN_MAINTENANCE" | "DAMAGED" | "UNAVAILABLE";
export type MaterialRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "SEPARATED" | "DELIVERED" | "CANCELED";
export type MaterialRequestPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type ScheduleEventType =
  | "INSPECTION"
  | "SERVICE_ORDER"
  | "MATERIAL_PREPARATION"
  | "EQUIPMENT_RETURN"
  | "WARRANTY_RETURN"
  | "AFTER_SALES"
  | "INTERNAL_TASK";
export type ScheduleEventStatus = "SCHEDULED" | "IN_PROGRESS" | "DONE" | "CANCELED" | "DELAYED";

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  document: string;
  type: string;
  source: string;
  notes: string;
  totalValue: number;
  lastService: string;
};

export type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string;
  source: string;
  status: LeadStatus;
  estimatedValue: number;
  nextFollowUpAt: string;
  notes: string;
};

export type Inspection = {
  id: string;
  customerName: string;
  surfaceType: string;
  serviceType: string;
  areaM2: number;
  currentState: string;
  technicalRisk: string;
  inspectionDate: string;
};

export type Quote = {
  id: string;
  customerName: string;
  status: QuoteStatus;
  validUntil: string;
  subtotal: number;
  discount: number;
  total: number;
  paymentTerms: string;
};

export type Employee = {
  id: string;
  userId?: string;
  name: string;
  phone: string;
  email: string;
  document: string;
  jobTitle?: string;
  roleName: string;
  specialty: string;
  status: EmployeeStatus;
  dailyCost: number;
  hiredAt: string;
  notes: string;
  averageRating: number;
  serviceOrdersCount: number;
  lastJob: string;
  lastEvaluationAt?: string;
  supervisorAverageRating?: number;
  needsTraining?: boolean;
  trainingAlert?: string;
  criteriaAverages?: PerformanceScores;
  strengths: string[];
  improvements: string[];
};

export type PerformanceScores = {
  punctuality: number;
  quality: number;
  productivity: number;
  care: number;
  teamwork: number;
  clientPosture: number;
  checklistCompliance: number;
};

export type ServiceOrderTask = {
  id: string;
  title: string;
  done: boolean;
};

export type ServiceOrderChecklistItem = {
  id: string;
  serviceOrderId: string;
  title: string;
  description: string;
  sortOrder: number;
  status: ChecklistItemStatus;
  isRequired: boolean;
  isPriority?: boolean;
  requiresPhoto: boolean;
  minimumPhotos: number;
  assignedEmployeeId?: string;
  assignedEmployeeIds?: string[];
  completedByEmployeeId?: string;
  startedByUserId?: string;
  completedByUserId?: string;
  validatedByUserId?: string;
  startedAt?: string;
  completedAt?: string;
  validatedAt?: string;
  completionNotes?: string;
  problemDescription?: string;
  blockedReason?: string;
  notes?: string;
  createdByUserId: string;
  plannedStartAt?: string;
  dueAt?: string;
  allowCollaboratorAction?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ServiceOrderChecklistPhoto = {
  id: string;
  checklistItemId: string;
  serviceOrderId: string;
  uploadedByUserId: string;
  employeeId?: string;
  type: ChecklistPhotoType;
  url: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  caption: string;
  createdAt: string;
};

export type ServiceOrderChecklistEvent = {
  id: string;
  checklistItemId: string;
  serviceOrderId: string;
  userId: string;
  employeeId?: string;
  type: ChecklistEventType;
  message?: string;
  previousStatus?: ChecklistItemStatus;
  newStatus?: ChecklistItemStatus;
  metadataJson?: unknown;
  createdAt: string;
};

export type ChecklistTemplate = {
  id: string;
  name: string;
  description?: string;
  serviceType?: ServiceType;
  isActive: boolean;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type ChecklistTemplateItem = {
  id: string;
  templateId: string;
  title: string;
  description?: string;
  sortOrder: number;
  isRequired: boolean;
  requiresPhoto: boolean;
  minimumPhotos: number;
};

export type ChecklistProgress = {
  totalRequiredItems: number;
  completedRequiredItems: number;
  validatedItems: number;
  blockedItems: number;
  pendingItems: number;
  progressPercent: number;
  validatedPercent: number;
  pendingPhotoItems: number;
  overdueItems: number;
};

export type ServiceOrderEmployee = {
  id: string;
  serviceOrderId: string;
  employeeId: string;
  roleInService: ServiceTeamRole;
  assignedByUserId: string;
  assignedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ServiceOrderMaterial = {
  id: string;
  serviceOrderId: string;
  materialId: string;
  plannedQuantity: number;
  separatedQuantity: number;
  deliveredQuantity: number;
  returnedQuantity: number;
  consumedQuantity: number;
  damagedQuantity: number;
  lostQuantity: number;
  status: ServiceOrderMaterialStatus;
  notes: string;
  preparedByUserId?: string;
  deliveredByUserId?: string;
  createdAt: string;
  updatedAt: string;
};

export type ServiceOrderEquipment = {
  id: string;
  serviceOrderId: string;
  equipmentId: string;
  status: ServiceOrderEquipmentStatus;
  reservedAt: string;
  deliveredAt?: string;
  returnedAt?: string;
  deliveredByUserId?: string;
  returnedByUserId?: string;
  conditionBefore: string;
  conditionAfter?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ServiceMaterialRequest = {
  id: string;
  serviceOrderId: string;
  requestedByUserId: string;
  status: MaterialRequestStatus;
  priority: MaterialRequestPriority;
  reason: string;
  createdAt: string;
  updatedAt: string;
};

export type ServiceMaterialRequestItem = {
  id: string;
  requestId: string;
  materialId: string;
  quantity: number;
  notes: string;
};

export type ServiceOrder = {
  id: string;
  customerId: string;
  customerName: string;
  quoteId: string;
  title: string;
  serviceType?: string;
  description: string;
  address: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: ServiceOrderStatus;
  supervisorEmployeeId?: string;
  supervisorUserId?: string;
  assignedByUserId?: string;
  assignedAt?: string;
  assignedSupervisorByUserId?: string;
  supervisorAssignedAt?: string;
  internalNotes: string;
  clientNotes: string;
  employeeIds: string[];
  tasks: ServiceOrderTask[];
  revenue: number;
  expenses: number;
};

export type Evaluation = {
  id: string;
  serviceOrderId: string;
  employeeId: string;
  employeeName: string;
  supervisorUserId: string;
  supervisorName: string;
  punctualityScore: number;
  qualityScore: number;
  productivityScore: number;
  careScore: number;
  teamworkScore: number;
  clientPostureScore: number;
  checklistComplianceScore: number;
  overallScore: number;
  positiveNotes: string;
  improvementNotes: string;
  seriousIssue: boolean;
  needsTraining: boolean;
  createdAt: string;
};

export type SupervisorEvaluation = {
  id: string;
  serviceOrderId: string;
  supervisorEmployeeId: string;
  supervisorUserId: string;
  employeeId: string;
  employeeUserId: string;
  clarityScore: number;
  organizationScore: number;
  respectScore: number;
  taskDistributionScore: number;
  communicationScore: number;
  supportScore: number;
  leadershipScore: number;
  overallScore: number;
  positiveNotes: string;
  improvementNotes: string;
  createdAt: string;
  updatedAt: string;
};

export type Material = {
  id: string;
  name: string;
  unit: string;
  status?: StockItemStatus;
  currentStock: number;
  minStock: number;
  unitCost: number;
};

export type Equipment = {
  id: string;
  name: string;
  code: string;
  status: StockItemStatus;
  notes: string;
};

export type ScheduleEvent = {
  id: string;
  title: string;
  description: string;
  type: ScheduleEventType;
  serviceOrderId?: string;
  inspectionId?: string;
  assignedUserId?: string;
  assignedEmployeeId?: string;
  startsAt: string;
  endsAt: string;
  status: ScheduleEventStatus;
  priority: MaterialRequestPriority;
  createdAt: string;
  updatedAt: string;
};

export type AuditLog = {
  id: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  oldValueJson?: unknown;
  newValueJson?: unknown;
  ipAddress?: string;
  metadata?: unknown;
  createdAt: string;
};

export type DashboardMetric = {
  label: string;
  value: string;
  trend: string;
  tone: "primary" | "success" | "warning" | "error" | "info";
};

export type ChartPoint = {
  label: string;
  value: number;
};

export type AttentionItem = {
  title: string;
  description: string;
  value: string;
  tone: "warning" | "error" | "info" | "success";
  href?: string;
};

export type SiteBeforeAfter = {
  id: string;
  title: string;
  serviceType: string;
  location: string;
  beforeImageUrl: string;
  afterImageUrl: string;
  description: string;
  isPublished: boolean;
  createdAt: string;
};

export type SiteTestimonial = {
  id: string;
  customerName: string;
  roleOrNeighborhood: string;
  rating: number;
  quote: string;
  serviceType: string;
  isPublished: boolean;
  createdAt: string;
};

export type DashboardData = {
  metrics: DashboardMetric[];
  attentionItems: AttentionItem[];
  revenueByMonth: ChartPoint[];
  servicesByStatus: ChartPoint[];
  averageRatings: ChartPoint[];
  mostExecutedServices: ChartPoint[];
  nextOrders: ServiceOrder[];
  financialOrders: ServiceOrder[];
  topEmployees: Employee[];
  sourceLabel: string;
};
