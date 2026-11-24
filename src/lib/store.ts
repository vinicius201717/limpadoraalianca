import "server-only";

import bcrypt from "bcryptjs";
import { expenseTotal, reconcileExpenseLedger, type ServicePayment } from "./finance-operations";
import { randomUUID, randomInt } from "node:crypto";
import { assertStoreReady, createStateProxy, loadState } from "./request-store";
import { newPasswordSchema } from "./password-policy";
import { getServiceOrderTransitionError } from "./service-order-transitions";

import {
  auditLogs,
  checklistTemplateItems,
  checklistTemplates,
  customers,
  dashboardMetrics,
  employees,
  equipment,
  evaluations,
  inspections,
  leads,
  materialRequestItems,
  materialRequests,
  materials,
  quotes,
  scheduleEvents,
  serviceOrderChecklistItems,
  serviceOrderChecklistEvents,
  serviceOrderChecklistPhotos,
  serviceOrderEmployees,
  serviceOrderEquipment,
  serviceExpenses,
  companyFeedbacks,
  serviceOrderMaterials,
  siteBeforeAfters,
  siteTestimonials,
  serviceOrders,
  supervisorEvaluations,
} from "./demo-data";

import {
  canAccessAllServiceOrders,
  canAccessServiceOrderByAssignment,
  canCreateUserWithRole,
  canManageEmployeeUserAccess,
  canManageTargetUserRole,
  canViewEmployeeProfileByRole,
  canViewFinancialServiceOrders,
  canViewServiceOrderFinancials,
  canViewWarehouseServiceOrders,
} from "./permissions";
import type {
  AuditLog,
  ChecklistProgress,
  ChecklistTemplate,
  ChecklistTemplateItem,
  ChecklistPhotoType,
  Employee,
  Evaluation,
  ScheduleEvent,
  ServiceMaterialRequest,
  ServiceMaterialRequestItem,
  ServiceOrder,
  ServiceOrderChecklistEvent,
  ServiceOrderChecklistItem,
  ServiceOrderChecklistPhoto,
  ServiceExpense,
  ServiceExpenseCategory,
  CompanyFeedback,
  CompanyFeedbackCategory,
  ServiceOrderMaterial,
  SiteBeforeAfter,
  SiteTestimonial,
  SessionUser,
  SupervisorEvaluation,
  SystemUser,
  UserRole,
} from "./types";

const initialDb = {
  whatsappLinks: [] as import("./whatsapp-types").WhatsAppLink[],
  whatsappMessages: [] as import("./whatsapp-types").WhatsAppMessage[],
  assistantCommands: [] as import("./whatsapp-types").AssistantCommand[],
  workHistory: [] as import("./whatsapp-types").WorkHistoryEntry[],
  warehouseJournal: [] as import("./whatsapp-types").WorkHistoryEntry[],
  officeJournal: [] as import("./whatsapp-types").WorkHistoryEntry[],
  fieldReceipts: [] as import("./field-operational-types").FieldReceipt[],
  fieldPushSubscriptions: [] as import("./field-notifications").FieldPushSubscription[],
  fieldPushDeliveries: [] as import("./field-notifications").FieldPushDelivery[],
  fieldNoticeReads: [] as import("./field-notifications").FieldNoticeRead[],
  administrativeExpenses: [] as import("./field-operational-types").AdministrativeExpense[],
  staffAttendanceReports: [] as import("./field-operational-types").StaffAttendanceReport[],
  employeeWarnings: [] as import("./whatsapp-types").EmployeeWarning[],
  financialDocuments: [] as import("./whatsapp-types").FinancialDocument[],
  workReports: [] as import("./whatsapp-types").WorkReport[],
  managementAnalyses: [] as import("./management-report-query").SavedManagementAnalysis[],
  users: [] as SystemUser[],
  servicePayments: [] as ServicePayment[],
  warranties: [] as import("./types").Warranty[],
  customers: [] as typeof customers,
  leads: [] as typeof leads,
  inspections: [] as typeof inspections,
  quotes: [] as typeof quotes,
  serviceOrders: [] as typeof serviceOrders,
  serviceOrderEmployees: [] as typeof serviceOrderEmployees,
  serviceOrderChecklistItems: [] as typeof serviceOrderChecklistItems,
  serviceOrderChecklistPhotos: [] as typeof serviceOrderChecklistPhotos,
  serviceOrderChecklistEvents: [] as typeof serviceOrderChecklistEvents,
  checklistTemplates: [] as typeof checklistTemplates,
  checklistTemplateItems: [] as typeof checklistTemplateItems,
  serviceOrderMaterials: [] as typeof serviceOrderMaterials,
  serviceOrderEquipment: [] as typeof serviceOrderEquipment,
  serviceExpenses: [] as typeof serviceExpenses,
  companyFeedbacks: [] as typeof companyFeedbacks,
  siteBeforeAfters: [] as typeof siteBeforeAfters,
  siteTestimonials: [] as typeof siteTestimonials,
  materialRequests: [] as typeof materialRequests,
  materialRequestItems: [] as typeof materialRequestItems,
  employees: [] as typeof employees,
  evaluations: [] as typeof evaluations,
  supervisorEvaluations: [] as typeof supervisorEvaluations,
  materials: [] as typeof materials,
  equipment: [] as typeof equipment,
  scheduleEvents: [] as typeof scheduleEvents,
  auditLogs: [] as typeof auditLogs,
  dashboardMetrics: [] as typeof dashboardMetrics,
};

type DemoDb = typeof initialDb;

const db = createStateProxy<DemoDb>();

type ResourceKey = keyof typeof db;
type MutableResourceKey = Exclude<ResourceKey, "dashboardMetrics">;

function makeId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizePhone(phone?: string) {
  return String(phone ?? "").replace(/\D/g, "");
}

function makeInternalEmailFromPhone(phone: string) {
  return `${normalizePhone(phone)}@telefone.alianca.local`;
}

function removePasswordHash<T extends Partial<SystemUser>>(user: T) {
  const { passwordHash, ...safeUser } = user;
  void passwordHash;
  return safeUser;
}

function sanitizeLogValue(value: unknown): unknown {
  if (typeof value === "string" && value.startsWith("data:")) return "[arquivo incorporado omitido do log]";
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeLogValue(item));
  const blockedKeys = new Set(["password", "passwordHash", "temporaryPassword", "token", "jwt", "cookie"]);
  const entries = Object.entries(value as Record<string, unknown>).filter(([key]) => !blockedKeys.has(key));
  return Object.fromEntries(entries.map(([key, item]) => [key, sanitizeLogValue(item)]));
}

export async function ensureDatabaseReady() { await loadState(initialDb); }
// Mutations are committed once, by withDatabase, before returning a successful response.
export function queueDatabasePersist() { assertStoreReady(); }
export async function flushDatabasePersistence() { assertStoreReady(); }
export function isDatabasePersistenceAvailable() { assertStoreReady(); return true; }

export function normalizeClientAccessCode(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function createClientAccessCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const makeSegment = () =>
    Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join("");

  let code = "";
  do {
    code = `ALI-${makeSegment()}-${makeSegment()}`;
  } while (
    db.serviceOrders.some(
      (order) => normalizeClientAccessCode(order.clientAccessCode ?? "") === normalizeClientAccessCode(code),
    )
  );

  return code;
}

export function ensureServiceOrderClientAccessCode(order: ServiceOrder) {
  if (order.clientAccessCode) {
    order.clientAccessEnabled = order.clientAccessEnabled ?? true;
    return order.clientAccessCode;
  }

  order.clientAccessCode = createClientAccessCode();
  order.clientAccessEnabled = true;
  queueDatabasePersist();
  return order.clientAccessCode;
}

export function findServiceOrderByClientAccessCode(code: string) {
  const normalized = normalizeClientAccessCode(code);
  if (!normalized) return null;

  return (
    db.serviceOrders.find(
      (order) =>
        order.clientAccessEnabled !== false &&
        normalizeClientAccessCode(order.clientAccessCode ?? "") === normalized,
    ) ?? null
  );
}

export function confirmClientServiceDelivery(
  code: string,
  input: {
    clientName?: string;
    rating?: number;
    feedback?: string;
    signatureDataUrl: string;
    ipAddress?: string;
  },
) {
  const order = findServiceOrderByClientAccessCode(code);
  if (!order) return { order: null, error: "NOT_FOUND" as const };
  if (order.clientDeliverySignedAt) return { order, error: "ALREADY_SIGNED" as const };
  if (getServiceOrderTransitionError(order, "DELIVERED", db, { customerAcceptance: true })) return { order: null, error: "INVALID_STATUS" as const };

  const now = new Date().toISOString();
  const oldValueJson = {
    status: order.status,
    clientDeliverySignedAt: order.clientDeliverySignedAt,
    clientRating: order.clientRating,
  };

  order.clientDeliveryAcceptedBy = input.clientName?.trim() || order.customerName;
  order.clientRating = input.rating;
  order.clientFeedback = input.feedback?.trim() ?? "";
  order.clientDeliverySignatureUrl = input.signatureDataUrl;
  order.clientDeliverySignedAt = now;
  order.clientDeliveryIp = input.ipAddress;
  order.status = "DELIVERED";

  recordAuditLog({
    action: "CLIENT_DELIVERY_CONFIRMED",
    entity: "ServiceOrder",
    entityId: order.id,
    ipAddress: input.ipAddress,
    oldValueJson,
    newValueJson: {
      status: order.status,
      clientDeliveryAcceptedBy: order.clientDeliveryAcceptedBy,
      clientDeliverySignedAt: order.clientDeliverySignedAt,
      clientRating: order.clientRating,
      clientFeedback: order.clientFeedback,
    },
  });
  queueDatabasePersist();
  return { order, error: null };
}

export function toPublicUser(user: SystemUser) {
  return removePasswordHash(user);
}

export function toPublicUsers(usersToSanitize = db.users) {
  return usersToSanitize.map((user) => toPublicUser(user));
}

export function findUserByEmail(email: string) {
  const normalized = normalizeEmail(email);
  return db.users.find((user) => normalizeEmail(user.email) === normalized) ?? null;
}

export function findUserByPhone(phone: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  return (
    db.users.find((user) => normalizePhone(user.phone) === normalized) ??
    db.users.find((user) => {
      const linkedEmployee = db.employees.find((employee) => employee.userId === user.id);
      return normalizePhone(linkedEmployee?.phone) === normalized;
    }) ??
    null
  );
}

export function findUserByLogin(login: string) {
  const normalized = login.trim();
  if (!normalized) return null;
  if (normalized.includes("@")) return findUserByEmail(normalized);
  return findUserByPhone(normalized);
}

export function getSystemUserForSession(userId: string) {
  const user = db.users.find((item) => item.id === userId && item.isActive);
  return user ? toPublicUser(user) : null;
}

export function findEmployeeByDocument(document?: string) {
  const normalized = document?.trim();
  if (!normalized) return null;
  return db.employees.find((employee) => employee.document?.trim() === normalized) ?? null;
}

export function getActiveOwnerCount() {
  return db.users.filter((user) => user.role === "OWNER" && user.isActive).length;
}

export async function verifyUserCredentials(login: string, password: string) {
  await ensureDatabaseReady();
  const user = findUserByLogin(login);
  const validPassword = user?.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !user.isActive || !validPassword) return null;

  if (!newPasswordSchema.safeParse(password).success) user.mustChangePassword = true;
  user.lastLoginAt = new Date().toISOString();
  user.updatedAt = new Date().toISOString();
  queueDatabasePersist();
  return toPublicUser(user);
}

export function listResource(resource: ResourceKey) {
  return db[resource];
}

export function findResource<T extends { id: string }>(items: T[], id: string) {
  return items.find((item) => item.id === id) ?? null;
}

export function createResource(resource: MutableResourceKey, input: Record<string, unknown>) {
  const record = {
    ...input,
    id: makeId(resource),
  };

  (db[resource] as Array<Record<string, unknown>>).unshift(record);
  queueDatabasePersist();
  return record;
}

export function updateResource(resource: MutableResourceKey, id: string, input: Record<string, unknown>) {
  const items = db[resource] as Array<Record<string, unknown>>;
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;

  items[index] = { ...items[index], ...input, id };
  queueDatabasePersist();
  return items[index];
}

export function deleteResource(resource: MutableResourceKey, id: string) {
  const items = db[resource] as Array<Record<string, unknown>>;
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return false;

  items.splice(index, 1);
  queueDatabasePersist();
  return true;
}

export function getEmployeeByUserId(userId: string) {
  return db.employees.find((employee) => employee.userId === userId) ?? null;
}

export function getLinkedEmployeeId(user: Pick<SessionUser, "id">) {
  return getEmployeeByUserId(user.id)?.id;
}

export function getEmployeeAccessRole(employee: Pick<Employee, "userId"> & Partial<Pick<Employee, "jobTitle" | "roleName" | "specialty">>) {
  const userRole = employee.userId ? db.users.find((user) => user.id === employee.userId)?.role : null;
  if (userRole) return userRole;

  const roleText = `${employee.jobTitle ?? ""} ${employee.roleName ?? ""} ${employee.specialty ?? ""}`.toLowerCase();
  if (roleText.includes("supervisor")) return "SUPERVISOR_OBRA";
  if (roleText.includes("gerente")) return "GERENTE";
  if (roleText.includes("almox")) return "ALMOXARIFADO";
  return "COLABORADOR";
}

export function getVisibleEmployeesForUser(user: SessionUser) {
  return db.employees.filter((employee) => canViewEmployeeProfileByRole(user.role, getEmployeeAccessRole(employee)));
}

export function isOpenServiceOrderForTeam(status: ServiceOrder["status"]) {
  return !["DONE", "DELIVERED", "CANCELED"].includes(status);
}

export function isEmployeeAssignedToServiceOrder(order: Pick<ServiceOrder, "id" | "employeeIds" | "supervisorEmployeeId">, employeeId?: string) {
  if (!employeeId) return false;
  return (
    order.supervisorEmployeeId === employeeId ||
    (order.employeeIds ?? []).includes(employeeId) ||
    db.serviceOrderEmployees.some((link) => link.serviceOrderId === order.id && link.employeeId === employeeId)
  );
}

export function findEmployeeActiveServiceOrderConflict(employeeId: string, currentServiceOrderId?: string, period?: Pick<ServiceOrder, "scheduledStart" | "scheduledEnd">) {
  const target = period ?? db.serviceOrders.find((order) => order.id === currentServiceOrderId);
  return (
    db.serviceOrders.find((order) => {
      if (order.id === currentServiceOrderId || !isOpenServiceOrderForTeam(order.status)) return false;
      if (target && !(Date.parse(order.scheduledStart) < Date.parse(target.scheduledEnd) && Date.parse(order.scheduledEnd) > Date.parse(target.scheduledStart))) return false;
      return isEmployeeAssignedToServiceOrder(order, employeeId);
    }) ?? null
  );
}

export function hasAssignedServiceOrders(user: SessionUser) {
  const linkedEmployeeId = getLinkedEmployeeId(user);
  return db.serviceOrders.some((order) => isEmployeeAssignedToServiceOrder(order, linkedEmployeeId));
}

function isWarehouseRelevantServiceOrder(order: ServiceOrder) {
  const hasPendingMaterial = db.serviceOrderMaterials.some(
    (item) =>
      item.serviceOrderId === order.id &&
      !["RETURNED", "CONSUMED", "DAMAGED", "LOST", "CANCELED"].includes(item.status),
  );
  const hasPendingEquipment = db.serviceOrderEquipment.some(
    (item) =>
      item.serviceOrderId === order.id &&
      !["RETURNED", "DAMAGED", "LOST", "CANCELED"].includes(item.status),
  );
  const hasPendingRequest = db.materialRequests.some(
    (item) => item.serviceOrderId === order.id && !["REJECTED", "DELIVERED", "CANCELED"].includes(item.status),
  );
  const activeOrder = !["DONE", "DELIVERED", "CANCELED"].includes(order.status);
  return hasPendingMaterial || hasPendingEquipment || hasPendingRequest || activeOrder;
}

export function getAccessibleServiceOrders(user: SessionUser) {
  const linkedEmployeeId = getLinkedEmployeeId(user);
  if (canViewWarehouseServiceOrders(user.role)) {
    return db.serviceOrders
      .filter((order) => isWarehouseRelevantServiceOrder(order) || isEmployeeAssignedToServiceOrder(order, linkedEmployeeId))
      .map((order) => sanitizeServiceOrderForRole(user, order));
  }
  if (canViewFinancialServiceOrders(user.role)) {
    return db.serviceOrders.map((order) => sanitizeServiceOrderForRole(user, order));
  }
  if (user.role === "SUPERVISOR_OBRA") {
    return db.serviceOrders
      .filter((order) => canAccessServiceOrderByAssignment(user.role, user.id, order, linkedEmployeeId))
      .map((order) => sanitizeServiceOrderForRole(user, order));
  }
  if (user.role === "COLABORADOR") {
    return db.serviceOrders
      .filter((order) => {
        if (!linkedEmployeeId) return false;
        return isEmployeeAssignedToServiceOrder(order, linkedEmployeeId);
      })
      .map((order) => sanitizeServiceOrderForRole(user, order));
  }
  return db.serviceOrders
    .filter((order) => canAccessServiceOrderByAssignment(user.role, user.id, order, linkedEmployeeId))
    .map((order) => sanitizeServiceOrderForRole(user, order));
}

export function sanitizeServiceOrderForRole(subject: UserRole | Pick<SessionUser, "id" | "role" | "canViewFinancials">, order: ServiceOrder): ServiceOrder {
  const role = typeof subject === "string" ? subject : subject.role;
  const canShareClientTracking = role === "OWNER" || role === "GERENTE" || role === "SUPERVISOR_OBRA";
  const isAssignedWarehouseUser =
    role === "ALMOXARIFADO" &&
    typeof subject !== "string" &&
    isEmployeeAssignedToServiceOrder(order, getLinkedEmployeeId(subject));
  const scopedOrder = canAccessAllServiceOrders(role)
    ? order
    : {
        ...order,
        internalNotes: "",
        clientDeliveryIp: undefined,
        clientDeliverySignatureUrl: undefined,
        clientAccessCode: canShareClientTracking ? order.clientAccessCode : undefined,
        clientAccessEnabled: canShareClientTracking ? order.clientAccessEnabled : undefined,
      };

  if (role === "ALMOXARIFADO" && !isAssignedWarehouseUser) {
    return {
      ...scopedOrder,
      description: "",
      internalNotes: "",
      clientNotes: "",
      employeeIds: order.supervisorEmployeeId ? [order.supervisorEmployeeId] : [],
      tasks: [],
      revenue: 0,
      expenses: 0,
    };
  }

  if (role === "FINANCEIRO") {
    return {
      ...scopedOrder,
      description: "",
      internalNotes: "",
      clientNotes: "",
      employeeIds: [],
      tasks: [],
    };
  }

  if (!canViewServiceOrderFinancials(subject)) {
    return {
      ...scopedOrder,
      revenue: 0,
      expenses: 0,
    };
  }

  return scopedOrder;
}

export function canUserAccessOrder(user: SessionUser, order: ServiceOrder) {
  if (canViewWarehouseServiceOrders(user.role)) {
    return isWarehouseRelevantServiceOrder(order) || isEmployeeAssignedToServiceOrder(order, getLinkedEmployeeId(user));
  }
  if (canViewFinancialServiceOrders(user.role)) return true;
  if (user.role === "COLABORADOR") {
    const linkedEmployeeId = getLinkedEmployeeId(user);
    if (!linkedEmployeeId) return false;
    return isEmployeeAssignedToServiceOrder(order, linkedEmployeeId);
  }
  if (user.role === "SUPERVISOR_OBRA") {
    const linkedEmployeeId = getLinkedEmployeeId(user);
    return Boolean(
      linkedEmployeeId &&
        (order.supervisorEmployeeId === linkedEmployeeId ||
          order.supervisorUserId === user.id ||
          order.employeeIds.includes(linkedEmployeeId) ||
          db.serviceOrderEmployees.some((link) => link.serviceOrderId === order.id && link.employeeId === linkedEmployeeId)),
    );
  }
  return canAccessServiceOrderByAssignment(user.role, user.id, order, getLinkedEmployeeId(user));
}

export function canUserAccessEmployee(user: SessionUser, employeeId: string) {
  if (canAccessAllServiceOrders(user.role)) return true;
  const employee = db.employees.find((item) => item.id === employeeId);
  if (!employee) return false;
  return canViewEmployeeProfileByRole(user.role, getEmployeeAccessRole(employee));
}

export function recordAuditLog(input: Omit<AuditLog, "id" | "createdAt">) {
  const log: AuditLog = {
    id: makeId("audit"),
    createdAt: new Date().toISOString(),
    ...input,
    oldValueJson: sanitizeLogValue(input.oldValueJson),
    newValueJson: sanitizeLogValue(input.newValueJson),
  };
  db.auditLogs.unshift(log);
  queueDatabasePersist();
  return log;
}

export function createServiceExpense(
  input: {
    serviceOrderId: string;
    employeeId: string;
    category: ServiceExpenseCategory;
    amount: number;
    notes?: string;
  },
  actor: SessionUser,
) {
  const serviceOrder = db.serviceOrders.find((order) => order.id === input.serviceOrderId);
  if (!serviceOrder) return { expense: null, serviceOrder: null, error: "ORDER_NOT_FOUND" as const };

  const employee = db.employees.find((item) => item.id === input.employeeId);
  if (!employee) return { expense: null, serviceOrder: null, error: "EMPLOYEE_NOT_FOUND" as const };

  const amount = Math.round(input.amount * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) return { expense: null, serviceOrder: null, error: "INVALID_AMOUNT" as const };

  const now = new Date().toISOString();
  const oldValueJson = {
    expenses: serviceOrder.expenses,
    profit: serviceOrder.revenue - serviceOrder.expenses,
  };
  const expense: ServiceExpense = {
    id: makeId("exp"),
    serviceOrderId: serviceOrder.id,
    employeeId: employee.id,
    employeeName: employee.name,
    category: input.category,
    amount,
    notes: input.notes?.trim() ?? "",
    createdByUserId: actor.id,
    createdAt: now,
    updatedAt: now,
  };

  reconcileExpenseLedger(serviceOrder, db.serviceExpenses, actor.id);
  db.serviceExpenses.unshift(expense);
  serviceOrder.expenses = expenseTotal(serviceOrder.id, db.serviceExpenses);

  recordAuditLog({
    userId: actor.id,
    action: "CREATE_SERVICE_EXPENSE",
    entity: "ServiceExpense",
    entityId: expense.id,
    newValueJson: {
      expense,
      serviceOrderId: serviceOrder.id,
      previousFinancials: oldValueJson,
      nextFinancials: {
        expenses: serviceOrder.expenses,
        profit: serviceOrder.revenue - serviceOrder.expenses,
      },
    },
  });

  return { expense, serviceOrder, error: null };
}

export function toAnonymousCompanyFeedback(feedback: CompanyFeedback) {
  const { submittedByUserId, ...anonymousFeedback } = feedback;
  void submittedByUserId;
  return anonymousFeedback;
}

export function toAnonymousCompanyFeedbacks(feedbacks = db.companyFeedbacks) {
  return feedbacks.map((feedback) => toAnonymousCompanyFeedback(feedback));
}

export function createCompanyFeedback(input: { category: CompanyFeedbackCategory; message: string }, actor: SessionUser) {
  const now = new Date().toISOString();
  const feedback: CompanyFeedback = {
    id: makeId("fbk"),
    submittedByUserId: actor.id,
    category: input.category,
    message: input.message.trim(),
    status: "NEW",
    createdAt: now,
    updatedAt: now,
  };

  db.companyFeedbacks.unshift(feedback);
  recordAuditLog({
    userId: actor.id,
    action: "CREATE_COMPANY_FEEDBACK",
    entity: "CompanyFeedback",
    entityId: feedback.id,
    newValueJson: feedback,
  });

  return feedback;
}

export function createSystemUser(input: {
  name: string;
  email?: string;
  phone?: string;
  role: UserRole;
  isActive?: boolean;
  linkedEmployeeId?: string;
  temporaryPassword?: string;
  canViewFinancials?: boolean;
}) {
  const phone = normalizePhone(input.phone);
  const email = input.email?.trim() ? normalizeEmail(input.email) : phone ? makeInternalEmailFromPhone(phone) : "";
  if (!email) return { user: null, error: "LOGIN_REQUIRED" as const };
  if (findUserByEmail(email)) return { user: null, error: "EMAIL_EXISTS" as const };
  if (phone && findUserByPhone(phone)) return { user: null, error: "PHONE_EXISTS" as const };

  if (input.linkedEmployeeId) {
    const linked = db.employees.find((item) => item.id === input.linkedEmployeeId);
    if (!linked || linked.userId) return { user: null, error: "INVALID_EMPLOYEE_LINK" as const };
  }
  const user: SystemUser = {
    id: makeId("usr"),
    name: input.name,
    email,
    phone,
    passwordHash: bcrypt.hashSync(newPasswordSchema.parse(input.temporaryPassword), 12),
    sessionVersion: 0,
    mustChangePassword: true,
    role: input.role,
    isActive: input.isActive ?? true,
    canViewFinancials:
      input.role === "OWNER" || input.role === "FINANCEIRO" || (input.role === "GERENTE" && Boolean(input.canViewFinancials)),
    linkedEmployeeId: input.linkedEmployeeId,
    lastLoginAt: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.users.unshift(user);

  if (input.linkedEmployeeId) {
    for (const previous of db.employees) if (previous.userId === user.id && previous.id !== input.linkedEmployeeId) previous.userId = undefined;
    const employee = db.employees.find((item) => item.id === input.linkedEmployeeId);
    if (employee) {
      employee.userId = user.id;
      if (phone && !employee.phone) employee.phone = phone;
    }
  }

  queueDatabasePersist();
  return { user, error: null };
}

export async function changeEmployeeAccessPassword(
  employeeId: string,
  input: { currentPassword?: string; newPassword: string },
  actor: SessionUser,
) {
  const employee = db.employees.find((item) => item.id === employeeId);
  if (!employee) return { user: null, error: "NOT_FOUND" as const };
  if (!employee.userId) return { user: null, error: "NO_USER" as const };

  const user = db.users.find((item) => item.id === employee.userId);
  if (!user) return { user: null, error: "NO_USER" as const };

  const isSelf = user.id === actor.id;
  const canResetByRole =
    canManageEmployeeUserAccess(actor.role) &&
    user.role !== "OWNER" &&
    (actor.role === "OWNER" || user.role !== "GERENTE");

  if (!isSelf && !canResetByRole) return { user: null, error: "FORBIDDEN" as const };

  if (isSelf) {
    if (!input.currentPassword) return { user: null, error: "CURRENT_PASSWORD_REQUIRED" as const };
    const validCurrentPassword = user.passwordHash ? await bcrypt.compare(input.currentPassword, user.passwordHash) : false;
    if (!validCurrentPassword) return { user: null, error: "INVALID_CURRENT_PASSWORD" as const };
  }

  user.passwordHash = await bcrypt.hash(newPasswordSchema.parse(input.newPassword), 12);
  user.sessionVersion = (user.sessionVersion ?? 0) + 1;
  user.mustChangePassword = !isSelf;
  user.updatedAt = new Date().toISOString();
  recordAuditLog({
    userId: actor.id,
    action: isSelf ? "CHANGE_OWN_PASSWORD" : "RESET_EMPLOYEE_PASSWORD",
    entity: "User",
    entityId: user.id,
    metadata: {
      employeeId,
      targetRole: user.role,
    },
  });

  return { user, error: null };
}

export async function changeOwnPassword(
  userId: string,
  input: { currentPassword: string; newPassword: string },
) {
  const user = db.users.find((item) => item.id === userId);
  if (!user) return { user: null, error: "NOT_FOUND" as const };

  const validCurrentPassword = user.passwordHash ? await bcrypt.compare(input.currentPassword, user.passwordHash) : false;
  if (!validCurrentPassword) return { user: null, error: "INVALID_CURRENT_PASSWORD" as const };

  user.passwordHash = await bcrypt.hash(newPasswordSchema.parse(input.newPassword), 12);
  user.sessionVersion = (user.sessionVersion ?? 0) + 1;
  user.mustChangePassword = false;
  user.updatedAt = new Date().toISOString();
  recordAuditLog({
    userId,
    action: "CHANGE_OWN_PASSWORD",
    entity: "User",
    entityId: user.id,
  });

  return { user, error: null };
}

export function changeUserRole(id: string, role: UserRole, actor: SessionUser) {
  const user = db.users.find((item) => item.id === id);
  if (!user) return null;
  if (!canManageTargetUserRole(actor.role, user.role, role)) return null;

  const oldValueJson = { role: user.role };
  user.role = role;
  user.sessionVersion = (user.sessionVersion ?? 0) + 1;
  user.canViewFinancials = role === "FINANCEIRO";
  user.updatedAt = new Date().toISOString();
  recordAuditLog({
    userId: actor.id,
    action: "CHANGE_USER_ROLE",
    entity: "User",
    entityId: id,
    oldValueJson,
    newValueJson: { role },
  });
  queueDatabasePersist();
  return user;
}

export function updateUserStatus(id: string, isActive: boolean, actor: SessionUser) {
  const user = db.users.find((item) => item.id === id);
  if (!user) return { user: null, error: "NOT_FOUND" as const };
  if (user.role === "OWNER") {
    if (!isActive && getActiveOwnerCount() <= 1) return { user: null, error: "LAST_OWNER" as const };
    return { user: null, error: "PROTECTED_OWNER" as const };
  }

  if (!canManageTargetUserRole(actor.role, user.role, user.role)) return { user: null, error: "FORBIDDEN" as const };
  const oldValueJson = { isActive: user.isActive };
  user.isActive = isActive;
  user.sessionVersion = (user.sessionVersion ?? 0) + 1;
  user.updatedAt = new Date().toISOString();
  recordAuditLog({
    userId: actor.id,
    action: isActive ? "ACTIVATE_USER" : "DEACTIVATE_USER",
    entity: "User",
    entityId: user.id,
    oldValueJson,
    newValueJson: { isActive },
  });

  queueDatabasePersist();
  return { user, error: null };
}

export function updateSystemUser(
  id: string,
  input: Partial<Pick<SystemUser, "name" | "email" | "phone" | "role" | "isActive" | "linkedEmployeeId" | "canViewFinancials">>,
  actor: SessionUser,
) {
  const user = db.users.find((item) => item.id === id);
  if (!user) return { user: null, error: "NOT_FOUND" as const };
  if (user.role === "OWNER") {
    if (input.isActive === false && getActiveOwnerCount() <= 1) return { user: null, error: "LAST_OWNER" as const };
    return { user: null, error: "PROTECTED_OWNER" as const };
  }
  if (input.role && id === actor.id && input.role !== user.role) return { user: null, error: "SELF_ROLE_CHANGE" as const };
  if (input.role && !canManageTargetUserRole(actor.role, user.role, input.role)) {
    return { user: null, error: "FORBIDDEN_ROLE" as const };
  }
  if (!canManageTargetUserRole(actor.role, user.role, input.role ?? user.role)) return { user: null, error: "FORBIDDEN_ROLE" as const };
  if (input.canViewFinancials !== undefined && actor.role !== "OWNER") return { user: null, error: "FORBIDDEN_ROLE" as const };
  if (input.linkedEmployeeId && input.linkedEmployeeId !== user.linkedEmployeeId) {
    const linked = db.employees.find((item) => item.id === input.linkedEmployeeId);
    if (!linked || linked.userId) return { user: null, error: "INVALID_EMPLOYEE_LINK" as const };
  }
  const requestedEmail = input.email?.trim();
  if (requestedEmail && normalizeEmail(requestedEmail) !== normalizeEmail(user.email) && findUserByEmail(requestedEmail)) {
    return { user: null, error: "EMAIL_EXISTS" as const };
  }
  const nextPhone = input.phone !== undefined ? normalizePhone(input.phone) : undefined;
  if (nextPhone && normalizePhone(user.phone) !== nextPhone && findUserByPhone(nextPhone)) {
    return { user: null, error: "PHONE_EXISTS" as const };
  }

  const oldValueJson = { ...user };
  Object.assign(user, input, {
    email: requestedEmail ? normalizeEmail(requestedEmail) : user.email,
    phone: nextPhone ?? user.phone,
    updatedAt: new Date().toISOString(),
  });
  if (input.role || typeof input.canViewFinancials === "boolean") {
    user.canViewFinancials =
      user.role === "FINANCEIRO" || (user.role === "GERENTE" && Boolean(input.canViewFinancials));
  }
  if (input.linkedEmployeeId) {
    for (const previous of db.employees) if (previous.userId === user.id && previous.id !== input.linkedEmployeeId) previous.userId = undefined;
    const employee = db.employees.find((item) => item.id === input.linkedEmployeeId);
    if (employee) {
      employee.userId = user.id;
      if (user.phone && !employee.phone) employee.phone = user.phone;
    }
  }

  recordAuditLog({
    userId: actor.id,
    action: input.role && input.role !== oldValueJson.role ? "CHANGE_USER_ROLE" : "UPDATE_USER",
    entity: "User",
    entityId: user.id,
    oldValueJson,
    newValueJson: user,
  });

  queueDatabasePersist();
  return { user, error: null };
}

export function createEmployee(
  input: Partial<Employee> & {
    createAccess?: boolean;
    accessRole?: UserRole;
    temporaryPassword?: string;
    canViewFinancials?: boolean;
  },
  actor?: SessionUser,
) {
  const existingDocument = findEmployeeByDocument(input.document);
  if (existingDocument) return { employee: null, user: null, error: "DOCUMENT_EXISTS" as const };

  const accessRole = input.accessRole ?? "COLABORADOR";
  if (input.createAccess && (!actor || !canCreateUserWithRole(actor.role, accessRole) || (input.canViewFinancials && actor.role !== "OWNER"))) return { employee: null, user: null, error: "INVALID_ACCESS_ROLE" as const };
  if (input.createAccess && !["COLABORADOR", "SUPERVISOR_OBRA", "GERENTE", "ALMOXARIFADO"].includes(accessRole)) {
    return { employee: null, user: null, error: "INVALID_ACCESS_ROLE" as const };
  }
  if (input.createAccess && input.email && findUserByEmail(input.email)) {
    return { employee: null, user: null, error: "EMAIL_EXISTS" as const };
  }
  if (input.createAccess && input.phone && findUserByPhone(input.phone)) {
    return { employee: null, user: null, error: "PHONE_EXISTS" as const };
  }

  const employee: Employee = {
    id: makeId("emp"),
    userId: undefined,
    name: input.name ?? "Novo colaborador",
    phone: input.phone ?? "",
    email: input.email ?? "",
    document: input.document ?? "",
    jobTitle: input.jobTitle ?? input.roleName ?? "Colaborador",
    roleName: input.roleName ?? "Colaborador",
    specialty: input.specialty ?? "Auxiliar geral",
    status: input.status ?? "ACTIVE",
    dailyCost: Number(input.dailyCost ?? 0),
    hiredAt: input.hiredAt ?? new Date().toISOString().slice(0, 10),
    notes: input.notes ?? "",
    averageRating: 0,
    serviceOrdersCount: 0,
    lastJob: "Ainda sem obra",
    lastEvaluationAt: undefined,
    needsTraining: false,
    trainingAlert: "",
    criteriaAverages: undefined,
    strengths: [],
    improvements: [],
  };

  db.employees.unshift(employee);
  let createdUser: SystemUser | null = null;
  if (input.createAccess) {
    const result = createSystemUser({
      name: employee.name,
      email: employee.email || undefined,
      phone: employee.phone,
      role: accessRole,
      linkedEmployeeId: employee.id,
      temporaryPassword: input.temporaryPassword,
      canViewFinancials: input.canViewFinancials,
    });
    if (result.error) {
      db.employees.splice(db.employees.findIndex((item) => item.id === employee.id), 1);
      return { employee: null, user: null, error: result.error };
    }
    createdUser = result.user;
    employee.userId = createdUser?.id;
  }

  if (actor) {
    recordAuditLog({
      userId: actor.id,
      action: input.createAccess ? "CREATE_EMPLOYEE_WITH_ACCESS" : "CREATE_EMPLOYEE",
      entity: "Employee",
      entityId: employee.id,
      newValueJson: { employee, user: createdUser ? toPublicUser(createdUser) : undefined },
    });
  }

  queueDatabasePersist();
  return { employee, user: createdUser, error: null };
}

export function grantEmployeeAccess(
  employeeId: string,
  input: { email?: string; phone?: string; role: UserRole; temporaryPassword?: string; canViewFinancials?: boolean },
  actor: SessionUser,
) {
  const employee = db.employees.find((item) => item.id === employeeId);
  if (!employee) return { employee: null, user: null, error: "NOT_FOUND" as const };
  if (employee.userId) return { employee: null, user: null, error: "ALREADY_HAS_ACCESS" as const };
  if (employee.status !== "ACTIVE") return { employee: null, user: null, error: "EMPLOYEE_NOT_ACTIVE" as const };
  if (!["COLABORADOR", "SUPERVISOR_OBRA", "GERENTE", "ALMOXARIFADO"].includes(input.role)) {
    return { employee: null, user: null, error: "INVALID_ACCESS_ROLE" as const };
  }
  if (!canCreateUserWithRole(actor.role, input.role)) {
    return { employee: null, user: null, error: "INVALID_ACCESS_ROLE" as const };
  }
  const phone = normalizePhone(input.phone || employee.phone);
  const result = createSystemUser({
    name: employee.name,
    email: input.email,
    phone,
    role: input.role,
    linkedEmployeeId: employee.id,
    temporaryPassword: input.temporaryPassword,
    canViewFinancials: input.canViewFinancials,
  });
  if (result.error) return { employee: null, user: null, error: result.error };
  employee.userId = result.user.id;
  if (phone && !employee.phone) employee.phone = phone;
  recordAuditLog({
    userId: actor.id,
    action: "GRANT_EMPLOYEE_ACCESS",
    entity: "Employee",
    entityId: employee.id,
    newValueJson: { userId: result.user.id, role: result.user.role, email: result.user.email, phone: result.user.phone },
  });
  queueDatabasePersist();
  return { employee, user: result.user, error: null };
}

export function promoteEmployeeToSupervisor(employeeId: string, actor: SessionUser, input?: { email?: string; temporaryPassword?: string }) {
  const employee = db.employees.find((item) => item.id === employeeId);
  if (!employee) return { employee: null, user: null, error: "NOT_FOUND" as const };
  if (employee.status === "FIRED") return { employee: null, user: null, error: "EMPLOYEE_NOT_ACTIVE" as const };

  const targetUser = employee.userId ? db.users.find((item) => item.id === employee.userId) : undefined;
  if (!canCreateUserWithRole(actor.role, "SUPERVISOR_OBRA") || (targetUser && !canManageTargetUserRole(actor.role, targetUser.role, "SUPERVISOR_OBRA"))) return { employee: null, user: null, error: "FORBIDDEN" as const };
  const oldValueJson = { employee: { ...employee }, user: employee.userId ? db.users.find((item) => item.id === employee.userId) : undefined };
  let user = employee.userId ? db.users.find((item) => item.id === employee.userId) : undefined;
  if (!user) {
    const result = createSystemUser({
      name: employee.name,
      email: input?.email || employee.email || `${employee.id}@empresa.com`,
      phone: employee.phone,
      role: "SUPERVISOR_OBRA",
      linkedEmployeeId: employee.id,
      temporaryPassword: input?.temporaryPassword,
    });
    if (result.error) return { employee: null, user: null, error: result.error };
    user = result.user;
  } else {
    user.role = "SUPERVISOR_OBRA";
    user.canViewFinancials = false;
    user.linkedEmployeeId = employee.id;
    user.updatedAt = new Date().toISOString();
  }

  employee.userId = user.id;
  employee.status = employee.status === "ACTIVE" ? employee.status : "ACTIVE";
  employee.roleName = "Supervisor de obra";
  employee.jobTitle = "Supervisor de obra";
  employee.specialty = employee.specialty.includes("Supervis")
    ? employee.specialty
    : `${employee.specialty} / Supervisao`;

  recordAuditLog({
    userId: actor.id,
    action: "PROMOTE_EMPLOYEE_TO_SUPERVISOR",
    entity: "Employee",
    entityId: employee.id,
    oldValueJson,
    newValueJson: { employee, user: toPublicUser(user) },
  });

  return { employee, user, error: null };
}

export function promoteSupervisorToManager(employeeId: string, actor: SessionUser) {
  const employee = db.employees.find((item) => item.id === employeeId);
  if (!employee) return { employee: null, user: null, error: "NOT_FOUND" as const };
  if (employee.status === "FIRED") return { employee: null, user: null, error: "EMPLOYEE_NOT_ACTIVE" as const };
  if (!employee.userId) return { employee: null, user: null, error: "NO_USER" as const };

  const user = db.users.find((item) => item.id === employee.userId);
  if (!user) return { employee: null, user: null, error: "NO_USER" as const };
  if (user.role !== "SUPERVISOR_OBRA") return { employee: null, user: null, error: "NOT_SUPERVISOR" as const };

  const oldValueJson = { employee: { ...employee }, user: { ...user } };
  user.role = "GERENTE";
  user.canViewFinancials = false;
  user.linkedEmployeeId = employee.id;
  user.updatedAt = new Date().toISOString();
  employee.userId = user.id;
  employee.status = employee.status === "ACTIVE" ? employee.status : "ACTIVE";
  employee.roleName = "Gerente";
  employee.jobTitle = "Gerente";
  employee.specialty = "Gestao operacional";

  recordAuditLog({
    userId: actor.id,
    action: "PROMOTE_SUPERVISOR_TO_MANAGER",
    entity: "Employee",
    entityId: employee.id,
    oldValueJson,
    newValueJson: { employee, user: toPublicUser(user) },
  });

  return { employee, user, error: null };
}

export function removeSupervisorRole(employeeId: string, actor: SessionUser) {
  const employee = db.employees.find((item) => item.id === employeeId);
  if (!employee) return { employee: null, user: null, error: "NOT_FOUND" as const };
  if (!employee.userId) return { employee: null, user: null, error: "NO_USER" as const };
  const user = db.users.find((item) => item.id === employee.userId);
  if (!user) return { employee: null, user: null, error: "NO_USER" as const };
  if (user.role !== "SUPERVISOR_OBRA") return { employee: null, user: null, error: "NOT_SUPERVISOR" as const };

  const oldValueJson = { employee: { ...employee }, user: { ...user } };
  user.role = "COLABORADOR";
  user.canViewFinancials = false;
  user.updatedAt = new Date().toISOString();
  employee.roleName = "Colaborador";
  employee.jobTitle = employee.jobTitle === "Supervisor de obra" ? "Colaborador" : employee.jobTitle;
  recordAuditLog({
    userId: actor.id,
    action: "REMOVE_SUPERVISOR_ROLE",
    entity: "Employee",
    entityId: employee.id,
    oldValueJson,
    newValueJson: { employee, user: toPublicUser(user) },
  });

  return { employee, user, error: null };
}

export function assignSupervisorToServiceOrder(orderId: string, supervisorEmployeeId: string, actor: SessionUser) {
  const order = db.serviceOrders.find((item) => item.id === orderId);
  const supervisor = db.employees.find((employee) => employee.id === supervisorEmployeeId);
  if (!order || !supervisor) return { serviceOrder: null, error: "NOT_FOUND" as const };
  const supervisorUser = supervisor.userId ? db.users.find((user) => user.id === supervisor.userId) : undefined;
  if (supervisor.status !== "ACTIVE" || supervisorUser?.role !== "SUPERVISOR_OBRA" || !supervisorUser.isActive) {
    return { serviceOrder: null, error: "INVALID_SUPERVISOR" as const };
  }
  const conflict = findEmployeeActiveServiceOrderConflict(supervisorEmployeeId, orderId);
  if (conflict) return { serviceOrder: null, error: "TEAM_CONFLICT" as const, conflict };

  const oldValueJson = {
    supervisorEmployeeId: order.supervisorEmployeeId,
    supervisorUserId: order.supervisorUserId,
    assignedSupervisorByUserId: order.assignedSupervisorByUserId ?? order.assignedByUserId,
    supervisorAssignedAt: order.supervisorAssignedAt ?? order.assignedAt,
  };

  order.supervisorEmployeeId = supervisorEmployeeId;
  order.supervisorUserId = supervisor.userId;
  order.assignedByUserId = actor.id;
  order.assignedAt = new Date().toISOString();
  order.assignedSupervisorByUserId = actor.id;
  order.supervisorAssignedAt = order.assignedAt;

  if (!order.employeeIds.includes(supervisorEmployeeId)) {
    order.employeeIds.unshift(supervisorEmployeeId);
  }

  const existingTeamLink = db.serviceOrderEmployees.find(
    (item) => item.serviceOrderId === orderId && item.employeeId === supervisorEmployeeId,
  );
  if (!existingTeamLink) {
    db.serviceOrderEmployees.unshift({
      id: makeId("soe"),
      serviceOrderId: orderId,
      employeeId: supervisorEmployeeId,
      roleInService: "SUPERVISOR",
      assignedByUserId: actor.id,
      assignedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  recordAuditLog({
    userId: actor.id,
    action: "ASSIGN_SUPERVISOR",
    entity: "ServiceOrder",
    entityId: orderId,
    oldValueJson,
    newValueJson: { supervisorEmployeeId, supervisorUserId: supervisor.userId, assignedSupervisorByUserId: actor.id },
  });

  return { serviceOrder: order, error: null };
}

export function removeSupervisorFromServiceOrder(orderId: string, actor: SessionUser) {
  const order = db.serviceOrders.find((item) => item.id === orderId);
  if (!order) return { serviceOrder: null, error: "NOT_FOUND" as const };

  const oldValueJson = {
    supervisorEmployeeId: order.supervisorEmployeeId,
    supervisorUserId: order.supervisorUserId,
    assignedSupervisorByUserId: order.assignedSupervisorByUserId ?? order.assignedByUserId,
    supervisorAssignedAt: order.supervisorAssignedAt ?? order.assignedAt,
  };

  order.supervisorEmployeeId = undefined;
  order.supervisorUserId = undefined;
  order.assignedSupervisorByUserId = actor.id;
  order.supervisorAssignedAt = new Date().toISOString();
  order.assignedByUserId = actor.id;
  order.assignedAt = order.supervisorAssignedAt;

  recordAuditLog({
    userId: actor.id,
    action: "REMOVE_SERVICE_ORDER_SUPERVISOR",
    entity: "ServiceOrder",
    entityId: orderId,
    oldValueJson,
    newValueJson: {
      supervisorEmployeeId: order.supervisorEmployeeId,
      supervisorUserId: order.supervisorUserId,
      assignedSupervisorByUserId: actor.id,
    },
  });

  return { serviceOrder: order, error: null };
}

export function createEvaluation(input: Partial<Evaluation>) {
  const scores = [
    input.punctualityScore,
    input.qualityScore,
    input.productivityScore,
    input.careScore,
    input.teamworkScore,
    input.clientPostureScore,
    input.checklistComplianceScore,
  ].map((score) => Number(score ?? 5));

  const overallScore = Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1));

  const evaluation: Evaluation = {
    id: `eval-${Date.now()}`,
    serviceOrderId: input.serviceOrderId ?? "",
    employeeId: input.employeeId ?? "",
    employeeName: input.employeeName ?? "Colaborador",
    supervisorUserId: input.supervisorUserId ?? "usr-supervisor",
    supervisorName: input.supervisorName ?? "Supervisor",
    punctualityScore: scores[0],
    qualityScore: scores[1],
    productivityScore: scores[2],
    careScore: scores[3],
    teamworkScore: scores[4],
    clientPostureScore: scores[5],
    checklistComplianceScore: scores[6],
    overallScore,
    positiveNotes: input.positiveNotes ?? "",
    improvementNotes: input.improvementNotes ?? "",
    seriousIssue: Boolean(input.seriousIssue),
    needsTraining: Boolean(input.needsTraining),
    createdAt: new Date().toISOString().slice(0, 10),
  };

  db.evaluations.unshift(evaluation);
  const employee = db.employees.find((item) => item.id === evaluation.employeeId);
  if (employee) {
    const employeeEvaluations = db.evaluations.filter((item) => item.employeeId === employee.id);
    employee.averageRating = Number((employeeEvaluations.reduce((sum, item) => sum + item.overallScore, 0) / employeeEvaluations.length).toFixed(1));
    employee.lastEvaluationAt = evaluation.createdAt;
    employee.needsTraining = Boolean(evaluation.needsTraining || evaluation.seriousIssue || employee.averageRating < 3.8);
    if (evaluation.positiveNotes.trim()) {
      employee.strengths = Array.from(new Set([evaluation.positiveNotes.trim(), ...employee.strengths])).slice(0, 5);
    }
    if (evaluation.improvementNotes.trim()) {
      employee.improvements = Array.from(new Set([evaluation.improvementNotes.trim(), ...employee.improvements])).slice(0, 5);
    }
  }
  recordAuditLog({
    userId: evaluation.supervisorUserId,
    action: "EVALUATE_EMPLOYEE",
    entity: "EmployeeEvaluation",
    entityId: evaluation.id,
    newValueJson: { serviceOrderId: evaluation.serviceOrderId, employeeId: evaluation.employeeId, overallScore },
  });
  return evaluation;
}

function getOrderById(orderId: string) {
  return db.serviceOrders.find((order) => order.id === orderId) ?? null;
}

function getChecklistItem(orderId: string, itemId: string) {
  return db.serviceOrderChecklistItems.find((item) => item.serviceOrderId === orderId && item.id === itemId) ?? null;
}

function getOrderTeamEmployeeIds(orderId: string) {
  const order = getOrderById(orderId);
  const ids = new Set(order?.employeeIds ?? []);
  if (order?.supervisorEmployeeId) ids.add(order.supervisorEmployeeId);
  db.serviceOrderEmployees
    .filter((link) => link.serviceOrderId === orderId)
    .forEach((link) => ids.add(link.employeeId));
  return ids;
}

function isEmployeeInServiceOrder(orderId: string, employeeId?: string) {
  if (!employeeId) return false;
  return getOrderTeamEmployeeIds(orderId).has(employeeId);
}

function isActiveEmployeeInServiceOrder(orderId: string, employeeId?: string) {
  if (!isEmployeeInServiceOrder(orderId, employeeId)) return false;
  return db.employees.some((employee) => employee.id === employeeId && employee.status === "ACTIVE");
}

function uniqueEmployeeIds(employeeIds?: string[]) {
  return Array.from(new Set((employeeIds ?? []).filter(Boolean)));
}

function getAssignedEmployeeIds(item: ServiceOrderChecklistItem) {
  return uniqueEmployeeIds([...(item.assignedEmployeeIds ?? []), item.assignedEmployeeId].filter(Boolean) as string[]);
}

function areActiveEmployeesInServiceOrder(orderId: string, employeeIds?: string[]) {
  return uniqueEmployeeIds(employeeIds).every((employeeId) => isActiveEmployeeInServiceOrder(orderId, employeeId));
}

function isServiceOrderClosed(order: ServiceOrder) {
  return !isOpenServiceOrderForTeam(order.status);
}

function canActorDirectlyOperateAssignedItem(actor: SessionUser, item: ServiceOrderChecklistItem) {
  const linkedEmployeeId = getLinkedEmployeeId(actor);
  return Boolean(
      actor.role === "COLABORADOR" &&
      linkedEmployeeId &&
      item.allowCollaboratorAction &&
      getAssignedEmployeeIds(item).includes(linkedEmployeeId),
  );
}

function validatePhotoInput(photo: {
  url: string;
  type?: ChecklistPhotoType;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
}) {
  const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "video/mp4", "video/webm", "video/quicktime"]);
  const url = photo.url.trim();
  const fileName = photo.fileName?.trim() || url.split("/").pop() || "evidencia.jpg";
  const dataUrlMime = url.match(/^data:(image\/(?:jpeg|png|webp));base64,/i)?.[1]?.toLowerCase();
  const dataUrlOk = Boolean(dataUrlMime && url.length > `data:${dataUrlMime};base64,`.length);
  const extensionOk = /\.(jpe?g|png|webp|heic|heif|mp4|webm|mov)$/i.test(fileName) || /\.(jpe?g|png|webp|heic|heif|mp4|webm|mov)(?:\?|$)/i.test(url);
  const localUrlOk = url.startsWith("/api/checklist-media?");
  const localhostOk = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/uploads\//i.test(url);
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const supabaseStorageOk = Boolean(supabaseUrl && url.startsWith(`${supabaseUrl}/storage/v1/object/public/`));
  const mimeOk = (!photo.mimeType || allowedMimeTypes.has(photo.mimeType)) && (!dataUrlMime || allowedMimeTypes.has(dataUrlMime));
  const configuredMaxBytes = Number(process.env.CHECKLIST_MAX_MEDIA_BYTES ?? process.env.CHECKLIST_MAX_PHOTO_BYTES ?? 0);
  const maxMediaBytes = Number.isFinite(configuredMaxBytes) && configuredMaxBytes > 0 ? Math.min(configuredMaxBytes, 200 * 1024 * 1024) : 20 * 1024 * 1024;
  const sizeOk = !photo.sizeBytes || photo.sizeBytes <= maxMediaBytes;
  return (extensionOk || dataUrlOk) && (localUrlOk || localhostOk || supabaseStorageOk || dataUrlOk) && mimeOk && sizeOk;
}

export function recordChecklistEvent(input: Omit<ServiceOrderChecklistEvent, "id" | "createdAt">) {
  const event: ServiceOrderChecklistEvent = {
    id: makeId("chk-event"),
    createdAt: new Date().toISOString(),
    ...input,
  };
  db.serviceOrderChecklistEvents.unshift(event);
  return event;
}

export function getChecklistProgress(serviceOrderId: string): ChecklistProgress {
  const items = db.serviceOrderChecklistItems.filter((item) => item.serviceOrderId === serviceOrderId);
  const activeItems = items.filter((item) => item.status !== "CANCELED");
  const requiredItems = activeItems.filter((item) => item.isRequired);
  const completedRequiredItems = requiredItems.filter((item) => item.status === "DONE").length;
  const validatedItems = activeItems.filter((item) => item.validatedAt || item.validatedByUserId).length;
  const pendingPhotoItems = activeItems.filter((item) => {
    if (!item.requiresPhoto) return false;
    const photoCount = db.serviceOrderChecklistPhotos.filter((photo) => photo.checklistItemId === item.id).length;
    return photoCount < Math.max(item.minimumPhotos, 1);
  }).length;
  const now = Date.now();
  const overdueItems = activeItems.filter((item) => {
    if (!item.dueAt || item.status === "DONE") return false;
    return new Date(item.dueAt).getTime() < now;
  }).length;

  return {
    totalRequiredItems: requiredItems.length,
    completedRequiredItems,
    validatedItems,
    blockedItems: activeItems.filter((item) => item.status === "BLOCKED").length,
    pendingItems: activeItems.filter((item) => item.status === "PENDING" || item.status === "REOPENED").length,
    progressPercent: requiredItems.length ? Math.round((completedRequiredItems / requiredItems.length) * 100) : 0,
    validatedPercent: activeItems.length ? Math.round((validatedItems / activeItems.length) * 100) : 0,
    pendingPhotoItems,
    overdueItems,
  };
}

export function getChecklistForServiceOrder(serviceOrderId: string) {
  const progress = getChecklistProgress(serviceOrderId);
  const checklist = db.serviceOrderChecklistItems
    .filter((item) => item.serviceOrderId === serviceOrderId)
    .sort((a, b) => Number(Boolean(b.isPriority)) - Number(Boolean(a.isPriority)) || a.sortOrder - b.sortOrder)
    .map((item) => ({
      ...item,
      assignedEmployeeIds: getAssignedEmployeeIds(item),
      assignedEmployee: item.assignedEmployeeId ? db.employees.find((employee) => employee.id === item.assignedEmployeeId) : undefined,
      assignedEmployees: getAssignedEmployeeIds(item)
        .map((employeeId) => db.employees.find((employee) => employee.id === employeeId))
        .filter(Boolean),
      completedByEmployee: item.completedByEmployeeId ? db.employees.find((employee) => employee.id === item.completedByEmployeeId) : undefined,
      photos: db.serviceOrderChecklistPhotos.filter((photo) => photo.checklistItemId === item.id),
      events: db.serviceOrderChecklistEvents.filter((event) => event.checklistItemId === item.id),
    }));
  return { checklist, progress };
}

export function createChecklistItem(
  serviceOrderId: string,
  input: Partial<ServiceOrderChecklistItem>,
  actor: SessionUser,
) {
  const order = getOrderById(serviceOrderId);
  if (!order) return { item: null, error: "ORDER_NOT_FOUND" as const };
  const assignedEmployeeIds = uniqueEmployeeIds(input.assignedEmployeeIds ?? (input.assignedEmployeeId ? [input.assignedEmployeeId] : []));
  if (!areActiveEmployeesInServiceOrder(serviceOrderId, assignedEmployeeIds)) {
    return { item: null, error: "EMPLOYEE_NOT_IN_TEAM" as const };
  }

  const now = new Date().toISOString();
  const item: ServiceOrderChecklistItem = {
    id: makeId("chk"),
    serviceOrderId,
    title: input.title ?? "Novo item",
    description: input.description ?? "",
    sortOrder: Number(input.sortOrder ?? db.serviceOrderChecklistItems.filter((candidate) => candidate.serviceOrderId === serviceOrderId).length + 1),
    status: input.status ?? "PENDING",
    isRequired: input.isRequired ?? true,
    isPriority: input.isPriority ?? false,
    requiresPhoto: input.requiresPhoto ?? false,
    minimumPhotos: Number(input.minimumPhotos ?? (input.requiresPhoto ? 1 : 0)),
    assignedEmployeeId: assignedEmployeeIds[0],
    assignedEmployeeIds,
    completedByEmployeeId: undefined,
    startedByUserId: undefined,
    completedByUserId: undefined,
    validatedByUserId: undefined,
    startedAt: undefined,
    completedAt: undefined,
    validatedAt: undefined,
    completionNotes: input.completionNotes ?? "",
    problemDescription: input.problemDescription ?? "",
    blockedReason: input.blockedReason ?? "",
    notes: input.notes ?? "",
    createdByUserId: actor.id,
    origin: input.origin,
    sourceMessageId: input.sourceMessageId,
    plannedStartAt: input.plannedStartAt,
    dueAt: input.dueAt,
    allowCollaboratorAction: input.allowCollaboratorAction ?? false,
    createdAt: now,
    updatedAt: now,
  };
  db.serviceOrderChecklistItems.push(item);
  recordChecklistEvent({
    checklistItemId: item.id,
    serviceOrderId,
    userId: actor.id,
    employeeId: item.assignedEmployeeId,
    type: "CREATED",
    message: "Item criado no checklist da OS.",
    newStatus: item.status,
    metadataJson: { title: item.title, sortOrder: item.sortOrder, assignedEmployeeIds, isPriority: item.isPriority },
  });
  recordAuditLog({
    userId: actor.id,
    action: "CREATE_CHECKLIST_ITEM",
    entity: "ServiceOrderChecklistItem",
    entityId: item.id,
    newValueJson: item,
  });
  return { item, error: null };
}

export function updateChecklistItem(
  serviceOrderId: string,
  itemId: string,
  input: Partial<ServiceOrderChecklistItem>,
  actor: SessionUser,
) {
  const item = getChecklistItem(serviceOrderId, itemId);
  if (!item) return { item: null, error: "NOT_FOUND" as const };
  const assignedEmployeeIds = input.assignedEmployeeIds
    ? uniqueEmployeeIds(input.assignedEmployeeIds)
    : input.assignedEmployeeId
      ? uniqueEmployeeIds([input.assignedEmployeeId])
      : getAssignedEmployeeIds(item);
  if (!areActiveEmployeesInServiceOrder(serviceOrderId, assignedEmployeeIds)) {
    return { item: null, error: "EMPLOYEE_NOT_IN_TEAM" as const };
  }
  const oldValueJson = { ...item };
  Object.assign(item, {
    title: input.title ?? item.title,
    description: input.description ?? item.description,
    sortOrder: input.sortOrder ?? item.sortOrder,
    isRequired: input.isRequired ?? item.isRequired,
    isPriority: input.isPriority ?? item.isPriority,
    requiresPhoto: input.requiresPhoto ?? item.requiresPhoto,
    minimumPhotos: input.minimumPhotos ?? item.minimumPhotos,
    assignedEmployeeId: assignedEmployeeIds[0],
    assignedEmployeeIds,
    completionNotes: input.completionNotes ?? item.completionNotes,
    problemDescription: input.problemDescription ?? item.problemDescription,
    blockedReason: input.blockedReason ?? item.blockedReason,
    notes: input.notes ?? item.notes,
    plannedStartAt: input.plannedStartAt ?? item.plannedStartAt,
    dueAt: input.dueAt ?? item.dueAt,
    allowCollaboratorAction: input.allowCollaboratorAction ?? item.allowCollaboratorAction,
    updatedAt: new Date().toISOString(),
  });
  recordChecklistEvent({
    checklistItemId: item.id,
    serviceOrderId,
    userId: actor.id,
    employeeId: item.assignedEmployeeId,
    type: JSON.stringify(getAssignedEmployeeIds(oldValueJson)) !== JSON.stringify(assignedEmployeeIds) ? "ASSIGNED" : "UPDATED",
    message: JSON.stringify(getAssignedEmployeeIds(oldValueJson)) !== JSON.stringify(assignedEmployeeIds) ? "Responsaveis do item alterados." : "Item atualizado.",
    previousStatus: oldValueJson.status,
    newStatus: item.status,
    metadataJson: { oldValueJson, newValueJson: item },
  });
  recordAuditLog({
    userId: actor.id,
    action: "UPDATE_CHECKLIST_ITEM",
    entity: "ServiceOrderChecklistItem",
    entityId: item.id,
    oldValueJson,
    newValueJson: item,
  });
  return { item, error: null };
}

export function deleteOrCancelChecklistItem(serviceOrderId: string, itemId: string, actor: SessionUser) {
  const item = getChecklistItem(serviceOrderId, itemId);
  if (!item) return { item: null, deleted: false, error: "NOT_FOUND" as const };
  const photos = db.serviceOrderChecklistPhotos.some((photo) => photo.checklistItemId === item.id);
  const events = db.serviceOrderChecklistEvents.some((event) => event.checklistItemId === item.id);
  if (photos || events || item.status === "DONE") {
    const oldValueJson = { ...item };
    item.status = "CANCELED";
    item.updatedAt = new Date().toISOString();
    recordChecklistEvent({
      checklistItemId: item.id,
      serviceOrderId,
      userId: actor.id,
      employeeId: item.assignedEmployeeId,
      type: "CANCELED",
      message: "Item cancelado logicamente para preservar historico.",
      previousStatus: oldValueJson.status,
      newStatus: item.status,
    });
    recordAuditLog({
      userId: actor.id,
      action: "CANCEL_CHECKLIST_ITEM",
      entity: "ServiceOrderChecklistItem",
      entityId: item.id,
      oldValueJson,
      newValueJson: item,
    });
    return { item, deleted: false, error: null };
  }

  db.serviceOrderChecklistItems.splice(db.serviceOrderChecklistItems.findIndex((candidate) => candidate.id === item.id), 1);
  recordAuditLog({
    userId: actor.id,
    action: "DELETE_CHECKLIST_ITEM",
    entity: "ServiceOrderChecklistItem",
    entityId: item.id,
    oldValueJson: item,
  });
  return { item, deleted: true, error: null };
}

export function reorderChecklistItems(serviceOrderId: string, itemIds: string[], actor: SessionUser) {
  const existingIds = new Set(db.serviceOrderChecklistItems.filter((item) => item.serviceOrderId === serviceOrderId).map((item) => item.id));
  if (itemIds.some((id) => !existingIds.has(id))) return { items: [], error: "INVALID_ITEMS" as const };
  const items = db.serviceOrderChecklistItems.filter((item) => item.serviceOrderId === serviceOrderId);
  itemIds.forEach((id, index) => {
    const item = items.find((candidate) => candidate.id === id);
    if (item) {
      item.sortOrder = index + 1;
      item.updatedAt = new Date().toISOString();
    }
  });
  recordAuditLog({
    userId: actor.id,
    action: "REORDER_CHECKLIST",
    entity: "ServiceOrder",
    entityId: serviceOrderId,
    newValueJson: { itemIds },
  });
  return { items: items.sort((a, b) => a.sortOrder - b.sortOrder), error: null };
}

export function assignChecklistItem(serviceOrderId: string, itemId: string, employeeIds: string[], actor: SessionUser) {
  const item = getChecklistItem(serviceOrderId, itemId);
  if (!item) return { item: null, error: "NOT_FOUND" as const };
  const nextEmployeeIds = uniqueEmployeeIds(employeeIds);
  if (!areActiveEmployeesInServiceOrder(serviceOrderId, nextEmployeeIds)) return { item: null, error: "EMPLOYEE_NOT_IN_TEAM" as const };
  const oldEmployeeIds = getAssignedEmployeeIds(item);
  item.assignedEmployeeId = nextEmployeeIds[0];
  item.assignedEmployeeIds = nextEmployeeIds;
  item.updatedAt = new Date().toISOString();
  recordChecklistEvent({
    checklistItemId: item.id,
    serviceOrderId,
    userId: actor.id,
    employeeId: item.assignedEmployeeId,
    type: "ASSIGNED",
    message: "Colaboradores atribuidos ao item.",
    previousStatus: item.status,
    newStatus: item.status,
    metadataJson: { oldEmployeeIds, newEmployeeIds: nextEmployeeIds },
  });
  recordAuditLog({
    userId: actor.id,
    action: "ASSIGN_CHECKLIST_ITEM",
    entity: "ServiceOrderChecklistItem",
    entityId: item.id,
    oldValueJson: { assignedEmployeeIds: oldEmployeeIds },
    newValueJson: { assignedEmployeeIds: nextEmployeeIds },
  });
  return { item, error: null };
}

export function startChecklistItem(serviceOrderId: string, itemId: string, actor: SessionUser) {
  const order = getOrderById(serviceOrderId);
  const item = getChecklistItem(serviceOrderId, itemId);
  if (!order || !item) return { item: null, error: "NOT_FOUND" as const };
  if (isServiceOrderClosed(order)) return { item: null, error: "ORDER_CLOSED" as const };
  if (item.status === "CANCELED") return { item: null, error: "ITEM_CANCELED" as const };
  if (item.startedByUserId && item.startedByUserId !== actor.id && item.status === "IN_PROGRESS") {
    return { item: null, error: "ITEM_ALREADY_STARTED" as const };
  }
  if (item.status !== "PENDING" && item.status !== "REOPENED") {
    return { item: null, error: "INVALID_STATUS" as const };
  }
  if (actor.role === "COLABORADOR" && !canActorDirectlyOperateAssignedItem(actor, item)) {
    return { item: null, error: "FORBIDDEN" as const };
  }
  const oldStatus = item.status;
  item.status = "IN_PROGRESS";
  item.startedAt = new Date().toISOString();
  item.startedByUserId = actor.id;
  item.updatedAt = item.startedAt;
  recordChecklistEvent({
    checklistItemId: item.id,
    serviceOrderId,
    userId: actor.id,
    employeeId: item.assignedEmployeeId,
    type: "STARTED",
    message: "Item iniciado.",
    previousStatus: oldStatus,
    newStatus: item.status,
  });
  recordAuditLog({
    userId: actor.id,
    action: "START_CHECKLIST_ITEM",
    entity: "ServiceOrderChecklistItem",
    entityId: item.id,
    oldValueJson: { status: oldStatus },
    newValueJson: { status: item.status, startedAt: item.startedAt },
  });
  queueDatabasePersist();
  return { item, error: null };
}

export function addChecklistPhoto(
  serviceOrderId: string,
  itemId: string,
  input: {
    url: string;
    type?: ChecklistPhotoType;
    caption?: string;
    employeeId?: string;
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
  },
  actor: SessionUser,
) {
  const item = getChecklistItem(serviceOrderId, itemId);
  if (!item) return { photo: null, error: "NOT_FOUND" as const };
  if (input.employeeId && !isEmployeeInServiceOrder(serviceOrderId, input.employeeId)) {
    return { photo: null, error: "EMPLOYEE_NOT_IN_TEAM" as const };
  }
  if (!validatePhotoInput(input)) return { photo: null, error: "INVALID_PHOTO" as const };
  const photo: ServiceOrderChecklistPhoto = {
    id: makeId("chk-photo"),
    checklistItemId: item.id,
    serviceOrderId,
    uploadedByUserId: actor.id,
    employeeId: input.employeeId,
    type: input.type ?? "EVIDENCE",
    url: input.url.trim(),
    fileName: input.fileName?.trim() || input.url.split("/").pop() || "evidencia.jpg",
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    caption: input.caption ?? "",
    createdAt: new Date().toISOString(),
  };
  db.serviceOrderChecklistPhotos.unshift(photo);
  recordChecklistEvent({
    checklistItemId: item.id,
    serviceOrderId,
    userId: actor.id,
    employeeId: photo.employeeId,
    type: "PHOTO_ADDED",
    message: photo.caption || "Foto adicionada ao item.",
    previousStatus: item.status,
    newStatus: item.status,
    metadataJson: { photoId: photo.id, url: photo.url, type: photo.type },
  });
  recordAuditLog({
    userId: actor.id,
    action: "ADD_CHECKLIST_PHOTO",
    entity: "ServiceOrderChecklistPhoto",
    entityId: photo.id,
    newValueJson: { ...photo, binary: undefined },
  });
  return { photo, error: null };
}

export function completeChecklistItem(input: {
  serviceOrderId: string;
  itemId: string;
  completedByEmployeeId: string;
  completedByEmployeeIds?: string[];
  completedByUserId: string;
  actor?: SessionUser;
  completionNotes?: string;
  notes?: string;
  photos?: Array<{ url: string; type?: ChecklistPhotoType; caption?: string; fileName?: string; mimeType?: string; sizeBytes?: number }>;
}) {
  const actor = input.actor ?? db.users.find((user) => user.id === input.completedByUserId);
  const order = getOrderById(input.serviceOrderId);
  const item = getChecklistItem(input.serviceOrderId, input.itemId);
  if (!order || !item || !actor) return { item: null, photos: [], error: "NOT_FOUND" as const };
  if (isServiceOrderClosed(order)) return { item: null, photos: [], error: "ORDER_CLOSED" as const };
  if (item.status === "BLOCKED" || item.status === "CANCELED" || item.status === "DONE") {
    return { item: null, photos: [], error: "INVALID_STATUS" as const };
  }
  if (actor.role === "COLABORADOR" && item.startedByUserId && item.startedByUserId !== actor.id) {
    return { item: null, photos: [], error: "ITEM_ALREADY_STARTED" as const };
  }
  const requestedCompletedEmployeeIds = uniqueEmployeeIds(
    input.completedByEmployeeIds?.length ? input.completedByEmployeeIds : [input.completedByEmployeeId],
  );
  const linkedEmployeeId = actor.role === "COLABORADOR" ? getLinkedEmployeeId(actor) : undefined;
  const primaryCompletedByEmployeeId =
    actor.role === "COLABORADOR" && linkedEmployeeId
      ? linkedEmployeeId
      : input.completedByEmployeeId || requestedCompletedEmployeeIds[0];
  const completedEmployeeIds = uniqueEmployeeIds([primaryCompletedByEmployeeId, ...requestedCompletedEmployeeIds]);

  if (actor.role === "COLABORADOR") {
    if (!linkedEmployeeId || !canActorDirectlyOperateAssignedItem(actor, item) || !completedEmployeeIds.includes(linkedEmployeeId)) {
      return { item: null, photos: [], error: "FORBIDDEN" as const };
    }
  }
  if (!primaryCompletedByEmployeeId || !areActiveEmployeesInServiceOrder(input.serviceOrderId, completedEmployeeIds)) {
    return { item: null, photos: [], error: "EMPLOYEE_NOT_IN_TEAM" as const };
  }

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  if (db.staffAttendanceReports.some(r => r.kind === "ABSENCE" && r.status === "REPORTED" && r.occurredOn === today && completedEmployeeIds.includes(r.employeeId))) {
    return { item: null, photos: [], error: "ATTENDANCE_CONFLICT" as const };
  }

  const incomingPhotos = input.photos ?? [];
  if (incomingPhotos.some((photo) => !validatePhotoInput(photo))) {
    return { item: null, photos: [], error: "INVALID_PHOTO" as const };
  }
  const existingPhotoCount = db.serviceOrderChecklistPhotos.filter((photo) => photo.checklistItemId === item.id).length;
  const minimumPhotos = item.requiresPhoto ? Math.max(item.minimumPhotos, 1) : item.minimumPhotos;
  if (minimumPhotos > 0 && existingPhotoCount + incomingPhotos.length < minimumPhotos) {
    return { item: null, photos: [], error: "PHOTO_REQUIRED" as const };
  }

  const oldValueJson = { ...item };
  item.status = "DONE";
  item.completedByEmployeeId = primaryCompletedByEmployeeId;
  item.completedByEmployeeIds = completedEmployeeIds;
  item.completedByUserId = input.completedByUserId;
  item.completedAt = new Date().toISOString();
  item.completionNotes = input.completionNotes ?? input.notes ?? item.completionNotes;
  item.notes = input.notes ?? input.completionNotes ?? item.notes;
  item.updatedAt = item.completedAt;

  const photos: ServiceOrderChecklistPhoto[] = [];
  incomingPhotos.forEach((photoInput) => {
    const photoResult = addChecklistPhoto(input.serviceOrderId, input.itemId, {
      ...photoInput,
      employeeId: primaryCompletedByEmployeeId,
    }, actor);
    if (photoResult.photo) photos.push(photoResult.photo);
  });

  const legacyTask = order.tasks.find((task) => task.id === input.itemId || task.title === item.title);
  if (legacyTask) legacyTask.done = true;

  recordChecklistEvent({
    checklistItemId: item.id,
    serviceOrderId: input.serviceOrderId,
    userId: input.completedByUserId,
    employeeId: primaryCompletedByEmployeeId,
    type: "COMPLETED",
    message: item.completionNotes || "Item concluido.",
    previousStatus: oldValueJson.status,
    newStatus: item.status,
    metadataJson: {
      serviceOrderId: order.id,
      serviceOrderTitle: order.title,
      customerName: order.customerName,
      checklistItemId: item.id,
      checklistItemTitle: item.title,
      completedByEmployeeId: primaryCompletedByEmployeeId,
      completedByEmployeeIds: completedEmployeeIds,
      completedByUserId: input.completedByUserId,
      completedAt: item.completedAt,
      progress: getChecklistProgress(input.serviceOrderId),
    },
  });
  recordAuditLog({
    userId: input.completedByUserId,
    action: "COMPLETE_CHECKLIST_ITEM",
    entity: "ServiceOrderChecklistItem",
    entityId: item.id,
    oldValueJson,
    newValueJson: { status: item.status, completedByEmployeeId: primaryCompletedByEmployeeId, completedByEmployeeIds: completedEmployeeIds, photos: photos.length },
  });

  return { item, photos, error: null };
}

export function validateChecklistItem(serviceOrderId: string, itemId: string, actor: SessionUser) {
  const item = getChecklistItem(serviceOrderId, itemId);
  if (!item) return { item: null, error: "NOT_FOUND" as const };
  if (item.status !== "DONE") return { item: null, error: "NOT_DONE" as const };
  if (item.validatedAt && item.validatedByUserId) return { item, error: null };
  const oldValueJson = { ...item };
  item.validatedByUserId = actor.id;
  item.validatedAt = new Date().toISOString();
  item.updatedAt = item.validatedAt;
  recordChecklistEvent({
    checklistItemId: item.id,
    serviceOrderId,
    userId: actor.id,
    employeeId: item.completedByEmployeeId,
    type: "VALIDATED",
    message: "Item validado pela supervisao.",
    previousStatus: item.status,
    newStatus: item.status,
  });
  recordAuditLog({
    userId: actor.id,
    action: "VALIDATE_CHECKLIST_ITEM",
    entity: "ServiceOrderChecklistItem",
    entityId: item.id,
    oldValueJson,
    newValueJson: item,
  });
  return { item, error: null };
}

export function reopenChecklistItem(serviceOrderId: string, itemId: string, reason: string, actor: SessionUser) {
  const item = getChecklistItem(serviceOrderId, itemId);
  if (!item) return { item: null, error: "NOT_FOUND" as const };
  const trimmedReason = reason.trim();
  if (!trimmedReason) return { item: null, error: "REASON_REQUIRED" as const };
  const oldValueJson = { ...item };
  item.status = "REOPENED";
  item.validatedAt = undefined;
  item.validatedByUserId = undefined;
  item.problemDescription = trimmedReason;
  item.updatedAt = new Date().toISOString();
  recordChecklistEvent({
    checklistItemId: item.id,
    serviceOrderId,
    userId: actor.id,
    employeeId: item.assignedEmployeeId ?? item.completedByEmployeeId,
    type: "REOPENED",
    message: trimmedReason,
    previousStatus: oldValueJson.status,
    newStatus: item.status,
  });
  recordAuditLog({
    userId: actor.id,
    action: "REOPEN_CHECKLIST_ITEM",
    entity: "ServiceOrderChecklistItem",
    entityId: item.id,
    oldValueJson,
    newValueJson: item,
  });
  return { item, error: null };
}

export function blockChecklistItem(serviceOrderId: string, itemId: string, reason: string, actor: SessionUser) {
  const item = getChecklistItem(serviceOrderId, itemId);
  if (!item) return { item: null, error: "NOT_FOUND" as const };
  const trimmedReason = reason.trim();
  if (!trimmedReason) return { item: null, error: "REASON_REQUIRED" as const };
  const oldValueJson = { ...item };
  item.status = "BLOCKED";
  item.blockedReason = trimmedReason;
  item.problemDescription = trimmedReason;
  item.updatedAt = new Date().toISOString();
  recordChecklistEvent({
    checklistItemId: item.id,
    serviceOrderId,
    userId: actor.id,
    employeeId: item.assignedEmployeeId,
    type: "BLOCKED",
    message: trimmedReason,
    previousStatus: oldValueJson.status,
    newStatus: item.status,
  });
  recordAuditLog({
    userId: actor.id,
    action: "BLOCK_CHECKLIST_ITEM",
    entity: "ServiceOrderChecklistItem",
    entityId: item.id,
    oldValueJson,
    newValueJson: item,
  });
  return { item, error: null };
}

export function unblockChecklistItem(serviceOrderId: string, itemId: string, actor: SessionUser) {
  const item = getChecklistItem(serviceOrderId, itemId);
  if (!item) return { item: null, error: "NOT_FOUND" as const };
  if (item.status !== "BLOCKED") return { item: null, error: "NOT_BLOCKED" as const };
  const oldValueJson = { ...item };
  item.status = "REOPENED";
  item.blockedReason = "";
  item.updatedAt = new Date().toISOString();
  recordChecklistEvent({
    checklistItemId: item.id,
    serviceOrderId,
    userId: actor.id,
    employeeId: item.assignedEmployeeId,
    type: "REOPENED",
    message: "Bloqueio removido.",
    previousStatus: oldValueJson.status,
    newStatus: item.status,
  });
  recordAuditLog({
    userId: actor.id,
    action: "UNBLOCK_CHECKLIST_ITEM",
    entity: "ServiceOrderChecklistItem",
    entityId: item.id,
    oldValueJson,
    newValueJson: item,
  });
  return { item, error: null };
}

export function removeChecklistPhoto(serviceOrderId: string, itemId: string, photoId: string, actor: SessionUser) {
  const photoIndex = db.serviceOrderChecklistPhotos.findIndex(
    (photo) => photo.id === photoId && photo.serviceOrderId === serviceOrderId && photo.checklistItemId === itemId,
  );
  if (photoIndex === -1) return { photo: null, error: "NOT_FOUND" as const };
  const [photo] = db.serviceOrderChecklistPhotos.splice(photoIndex, 1);
  const item = getChecklistItem(serviceOrderId, itemId);
  if (item) {
    recordChecklistEvent({
      checklistItemId: item.id,
      serviceOrderId,
      userId: actor.id,
      employeeId: photo.employeeId,
      type: "PHOTO_REMOVED",
      message: "Foto removida do item.",
      previousStatus: item.status,
      newStatus: item.status,
      metadataJson: { photoId },
    });
  }
  recordAuditLog({
    userId: actor.id,
    action: "REMOVE_CHECKLIST_PHOTO",
    entity: "ServiceOrderChecklistPhoto",
    entityId: photoId,
    oldValueJson: photo,
  });
  return { photo, error: null };
}

export function getChecklistItemHistory(serviceOrderId: string, itemId: string) {
  return db.serviceOrderChecklistEvents
    .filter((event) => event.serviceOrderId === serviceOrderId && event.checklistItemId === itemId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function createChecklistTemplate(
  input: Pick<ChecklistTemplate, "name" | "description" | "serviceType"> & { items?: Partial<ChecklistTemplateItem>[] },
  actor: SessionUser,
) {
  const now = new Date().toISOString();
  const template: ChecklistTemplate = {
    id: makeId("tpl"),
    name: input.name,
    description: input.description ?? "",
    serviceType: input.serviceType,
    isActive: true,
    createdByUserId: actor.id,
    createdAt: now,
    updatedAt: now,
  };
  db.checklistTemplates.unshift(template);
  const items = (input.items ?? []).map((item, index): ChecklistTemplateItem => ({
    id: makeId("tpl-item"),
    templateId: template.id,
    title: item.title ?? `Etapa ${index + 1}`,
    description: item.description ?? "",
    sortOrder: item.sortOrder ?? index + 1,
    isRequired: item.isRequired ?? true,
    requiresPhoto: item.requiresPhoto ?? false,
    minimumPhotos: item.minimumPhotos ?? (item.requiresPhoto ? 1 : 0),
  }));
  db.checklistTemplateItems.unshift(...items);
  recordAuditLog({
    userId: actor.id,
    action: "CREATE_CHECKLIST_TEMPLATE",
    entity: "ChecklistTemplate",
    entityId: template.id,
    newValueJson: { template, items },
  });
  return { template, items };
}

export function updateChecklistTemplate(
  templateId: string,
  input: Partial<ChecklistTemplate> & { items?: Partial<ChecklistTemplateItem>[] },
  actor: SessionUser,
) {
  const template = db.checklistTemplates.find((item) => item.id === templateId);
  if (!template) return { template: null, items: [], error: "NOT_FOUND" as const };
  const oldValueJson = { ...template, items: db.checklistTemplateItems.filter((item) => item.templateId === templateId) };
  Object.assign(template, {
    name: input.name ?? template.name,
    description: input.description ?? template.description,
    serviceType: input.serviceType ?? template.serviceType,
    isActive: input.isActive ?? template.isActive,
    updatedAt: new Date().toISOString(),
  });
  if (input.items) {
    db.checklistTemplateItems = db.checklistTemplateItems.filter((item) => item.templateId !== templateId);
    db.checklistTemplateItems.unshift(
      ...input.items.map((item, index): ChecklistTemplateItem => ({
        id: item.id ?? makeId("tpl-item"),
        templateId,
        title: item.title ?? `Etapa ${index + 1}`,
        description: item.description ?? "",
        sortOrder: item.sortOrder ?? index + 1,
        isRequired: item.isRequired ?? true,
        requiresPhoto: item.requiresPhoto ?? false,
        minimumPhotos: item.minimumPhotos ?? (item.requiresPhoto ? 1 : 0),
      })),
    );
  }
  const items = db.checklistTemplateItems.filter((item) => item.templateId === templateId);
  recordAuditLog({
    userId: actor.id,
    action: "UPDATE_CHECKLIST_TEMPLATE",
    entity: "ChecklistTemplate",
    entityId: template.id,
    oldValueJson,
    newValueJson: { template, items },
  });
  return { template, items, error: null };
}

export function deleteChecklistTemplate(templateId: string, actor: SessionUser) {
  const template = db.checklistTemplates.find((item) => item.id === templateId);
  if (!template) return { template: null, error: "NOT_FOUND" as const };
  const oldValueJson = { ...template };
  template.isActive = false;
  template.updatedAt = new Date().toISOString();
  recordAuditLog({
    userId: actor.id,
    action: "DEACTIVATE_CHECKLIST_TEMPLATE",
    entity: "ChecklistTemplate",
    entityId: template.id,
    oldValueJson,
    newValueJson: template,
  });
  return { template, error: null };
}

export function applyChecklistTemplate(serviceOrderId: string, templateId: string, actor: SessionUser) {
  const order = getOrderById(serviceOrderId);
  const template = db.checklistTemplates.find((item) => item.id === templateId && item.isActive);
  if (!order || !template) return { items: [], error: "NOT_FOUND" as const };
  const templateItems = db.checklistTemplateItems
    .filter((item) => item.templateId === templateId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  if (!templateItems.length) return { items: [], error: "EMPTY_TEMPLATE" as const };
  const maxSortOrder = Math.max(0, ...db.serviceOrderChecklistItems.filter((item) => item.serviceOrderId === serviceOrderId).map((item) => item.sortOrder));
  const now = new Date().toISOString();
  const items = templateItems.map((templateItem, index): ServiceOrderChecklistItem => ({
    id: makeId("chk"),
    serviceOrderId,
    title: templateItem.title,
    description: templateItem.description ?? "",
    sortOrder: maxSortOrder + index + 1,
    status: "PENDING",
    isRequired: templateItem.isRequired,
    isPriority: false,
    requiresPhoto: templateItem.requiresPhoto,
    minimumPhotos: templateItem.minimumPhotos,
    assignedEmployeeId: undefined,
    assignedEmployeeIds: [],
    completedByEmployeeId: undefined,
    startedByUserId: undefined,
    completedByUserId: undefined,
    validatedByUserId: undefined,
    startedAt: undefined,
    completedAt: undefined,
    validatedAt: undefined,
    completionNotes: "",
    problemDescription: "",
    blockedReason: "",
    notes: "",
    createdByUserId: actor.id,
    plannedStartAt: undefined,
    dueAt: undefined,
    allowCollaboratorAction: false,
    createdAt: now,
    updatedAt: now,
  }));
  db.serviceOrderChecklistItems.push(...items);
  items.forEach((item) => {
    recordChecklistEvent({
      checklistItemId: item.id,
      serviceOrderId,
      userId: actor.id,
      type: "CREATED",
      message: `Item copiado do template ${template.name}.`,
      newStatus: item.status,
      metadataJson: { templateId },
    });
  });
  recordAuditLog({
    userId: actor.id,
    action: "APPLY_CHECKLIST_TEMPLATE",
    entity: "ServiceOrder",
    entityId: serviceOrderId,
    newValueJson: { templateId, items: items.length },
  });
  return { items, error: null };
}

export function createMaterialRequest(input: {
  serviceOrderId: string;
  requestedByUserId: string;
  reason: string;
  priority?: ServiceMaterialRequest["priority"];
  items: Array<{ materialId: string; quantity: number; notes?: string }>;
}) {
  const request: ServiceMaterialRequest = {
    id: makeId("req"),
    serviceOrderId: input.serviceOrderId,
    requestedByUserId: input.requestedByUserId,
    status: "PENDING",
    priority: input.priority ?? "NORMAL",
    reason: input.reason,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const items: ServiceMaterialRequestItem[] = input.items.map((item) => ({
    id: makeId("reqitem"),
    requestId: request.id,
    materialId: item.materialId,
    quantity: item.quantity,
    notes: item.notes ?? "",
  }));

  db.materialRequests.unshift(request);
  db.materialRequestItems.unshift(...items);
  recordAuditLog({
    userId: input.requestedByUserId,
    action: "REQUEST_EXTRA_MATERIAL",
    entity: "ServiceMaterialRequest",
    entityId: request.id,
    newValueJson: { serviceOrderId: request.serviceOrderId, items: items.length },
  });
  return { request, items };
}

export function updateServiceOrderMaterial(id: string, input: Partial<ServiceOrderMaterial>, actor: SessionUser) {
  const item = db.serviceOrderMaterials.find((candidate) => candidate.id === id);
  if (!item) return null;
  const oldValueJson = { ...item };
  Object.assign(item, input, { updatedAt: new Date().toISOString() });

  recordAuditLog({
    userId: actor.id,
    action: "UPDATE_SERVICE_ORDER_MATERIAL",
    entity: "ServiceOrderMaterial",
    entityId: id,
    oldValueJson,
    newValueJson: item,
  });
  return item;
}

export function createSupervisorEvaluation(input: Omit<SupervisorEvaluation, "id" | "createdAt" | "updatedAt" | "overallScore">) {
  const scores = [
    input.clarityScore,
    input.organizationScore,
    input.respectScore,
    input.taskDistributionScore,
    input.communicationScore,
    input.supportScore,
    input.leadershipScore,
  ];
  const evaluation: SupervisorEvaluation = {
    ...input,
    id: makeId("seval"),
    overallScore: Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1)),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.supervisorEvaluations.unshift(evaluation);
  recordAuditLog({
    userId: input.employeeUserId,
    action: "EVALUATE_SUPERVISOR",
    entity: "SupervisorEvaluation",
    entityId: evaluation.id,
    newValueJson: { serviceOrderId: evaluation.serviceOrderId, supervisorUserId: evaluation.supervisorUserId },
  });
  queueDatabasePersist();
  return evaluation;
}

export function upsertScheduleEvent(input: Partial<ScheduleEvent> & { title: string; startsAt: string; endsAt: string }, actor: SessionUser) {
  const event: ScheduleEvent = {
    id: input.id ?? makeId("sch"),
    title: input.title,
    description: input.description ?? "",
    type: input.type ?? "INTERNAL_TASK",
    serviceOrderId: input.serviceOrderId,
    inspectionId: input.inspectionId,
    assignedUserId: input.assignedUserId,
    assignedEmployeeId: input.assignedEmployeeId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    status: input.status ?? "SCHEDULED",
    priority: input.priority ?? "NORMAL",
    createdAt: input.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const index = db.scheduleEvents.findIndex((item) => item.id === event.id);
  if (index >= 0) db.scheduleEvents[index] = event;
  else db.scheduleEvents.unshift(event);

  recordAuditLog({
    userId: actor.id,
    action: index >= 0 ? "UPDATE_SCHEDULE_EVENT" : "CREATE_SCHEDULE_EVENT",
    entity: "ScheduleEvent",
    entityId: event.id,
    newValueJson: event,
  });
  return event;
}

export function createPublicQuoteLead(input: {
  name?: string;
  phone: string;
  serviceType?: string;
  message?: string;
}) {
  const now = new Date();
  const lead = {
    id: makeId("lead-site"),
    name: input.name?.trim() || "Cliente do site",
    phone: input.phone.trim(),
    email: "",
    source: "Site publico",
    status: "NEW" as const,
    estimatedValue: 0,
    nextFollowUpAt: now.toISOString().slice(0, 10),
    notes: [input.serviceType ? `Servico: ${input.serviceType}` : "", input.message?.trim() || ""].filter(Boolean).join(" | "),
  };

  db.leads.unshift(lead);
  recordAuditLog({
    action: "PUBLIC_QUOTE_REQUEST",
    entity: "Lead",
    entityId: lead.id,
    newValueJson: { name: lead.name, phone: lead.phone, source: lead.source, serviceType: input.serviceType },
  });
  queueDatabasePersist();
  return lead;
}

export function createSiteBeforeAfter(input: Omit<SiteBeforeAfter, "id" | "createdAt" | "isPublished"> & { isPublished?: boolean }, actor: SessionUser) {
  const record: SiteBeforeAfter = {
    id: makeId("ba"),
    title: input.title.trim(),
    serviceType: input.serviceType.trim(),
    location: input.location.trim(),
    beforeImageUrl: input.beforeImageUrl.trim(),
    afterImageUrl: input.afterImageUrl.trim(),
    description: input.description.trim(),
    isPublished: input.isPublished ?? true,
    createdAt: new Date().toISOString(),
  };

  db.siteBeforeAfters.unshift(record);
  recordAuditLog({
    userId: actor.id,
    action: "CREATE_SITE_BEFORE_AFTER",
    entity: "SiteBeforeAfter",
    entityId: record.id,
    newValueJson: record,
  });
  queueDatabasePersist();
  return record;
}

export function createSiteTestimonial(input: Omit<SiteTestimonial, "id" | "createdAt" | "isPublished"> & { isPublished?: boolean }, actor: SessionUser) {
  const record: SiteTestimonial = {
    id: makeId("test"),
    customerName: input.customerName.trim(),
    roleOrNeighborhood: input.roleOrNeighborhood.trim(),
    rating: Math.min(5, Math.max(1, Number(input.rating || 5))),
    quote: input.quote.trim(),
    serviceType: input.serviceType.trim(),
    isPublished: input.isPublished ?? true,
    createdAt: new Date().toISOString(),
  };

  db.siteTestimonials.unshift(record);
  recordAuditLog({
    userId: actor.id,
    action: "CREATE_SITE_TESTIMONIAL",
    entity: "SiteTestimonial",
    entityId: record.id,
    newValueJson: record,
  });
  queueDatabasePersist();
  return record;
}

export { db };
