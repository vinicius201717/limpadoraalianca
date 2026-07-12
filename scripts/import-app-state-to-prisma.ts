import "dotenv/config";

import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";

import { PrismaClient, type Prisma } from "../src/generated/prisma/client";

type LegacyUser = {
  id: string;
  name: string;
  email: string;
  passwordHash?: string;
  role: string;
  isActive?: boolean;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

type LegacyEmployee = {
  id: string;
  userId?: string;
  name: string;
  phone?: string;
  email?: string;
  document?: string;
  jobTitle?: string;
  roleName?: string;
  specialty?: string;
  status?: string;
  dailyCost?: number;
  hiredAt?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

type LegacyCustomer = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  document?: string;
  type?: string;
  source?: string;
  notes?: string;
};

type LegacyServiceOrder = {
  id: string;
  customerId?: string;
  customerName?: string;
  quoteId?: string;
  title: string;
  description?: string;
  address: string;
  scheduledStart: string;
  scheduledEnd?: string;
  status?: string;
  supervisorEmployeeId?: string;
  supervisorUserId?: string;
  assignedByUserId?: string;
  assignedAt?: string;
  assignedSupervisorByUserId?: string;
  supervisorAssignedAt?: string;
  internalNotes?: string;
  clientNotes?: string;
  createdAt?: string;
  updatedAt?: string;
};

type LegacyServiceOrderEmployee = {
  id: string;
  serviceOrderId: string;
  employeeId: string;
  roleInService?: string;
  assignedByUserId?: string;
  assignedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

type LegacyAuditLog = {
  id: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  oldValueJson?: unknown;
  newValueJson?: unknown;
  ipAddress?: string;
  metadata?: unknown;
  createdAt?: string;
};

type LegacyState = {
  users?: LegacyUser[];
  employees?: LegacyEmployee[];
  customers?: LegacyCustomer[];
  serviceOrders?: LegacyServiceOrder[];
  serviceOrderEmployees?: LegacyServiceOrderEmployee[];
  auditLogs?: LegacyAuditLog[];
};

const validUserRoles = new Set(["OWNER", "GERENTE", "SUPERVISOR_OBRA", "ALMOXARIFADO", "COMERCIAL", "TECNICO", "FINANCEIRO", "COLABORADOR"]);
const validEmployeeStatuses = new Set(["ACTIVE", "INACTIVE", "ON_LEAVE", "FIRED"]);
const validServiceOrderStatuses = new Set(["SCHEDULED", "PREPARING", "IN_PROGRESS", "PAUSED", "WAITING_CUSTOMER", "DONE", "DELIVERED", "CANCELED"]);
const validTeamRoles = new Set(["SUPERVISOR", "POLIDOR", "AUXILIAR", "TECNICO", "MOTORISTA", "ALMOXARIFADO", "OUTRO"]);
const validCustomerTypes = new Set(["PERSON", "COMPANY", "ARCHITECT", "CONSTRUCTION_COMPANY", "CONDOMINIUM", "REAL_ESTATE"]);

let prisma: PrismaClient | null = null;

function getScriptPrisma() {
  if (!prisma) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL nao configurada.");
    prisma = new PrismaClient({
      adapter: new PrismaMariaDb(databaseUrl),
    });
  }

  return prisma;
}

function asArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function toDate(value: string | undefined, fallback = new Date()) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function optionalDate(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function enumOrDefault(value: string | undefined, validValues: Set<string>, fallback: string) {
  return value && validValues.has(value) ? value : fallback;
}

function readLegacyState() {
  const databasePath = path.join(process.cwd(), "data", "floor-restoration-manager.sqlite");
  if (!existsSync(databasePath)) {
    throw new Error(`Arquivo legado nao encontrado: ${databasePath}`);
  }

  const database = new DatabaseSync(databasePath);
  const row = database.prepare("SELECT data FROM app_state WHERE id = ?").get("floor-restoration-manager") as { data?: string } | undefined;
  if (!row?.data) {
    throw new Error("Registro app_state/floor-restoration-manager nao encontrado.");
  }

  return {
    databasePath,
    databaseSize: statSync(databasePath).size,
    state: JSON.parse(row.data) as LegacyState,
  };
}

function buildReport(state: LegacyState) {
  const users = asArray(state.users);
  const employees = asArray(state.employees);
  const customers = asArray(state.customers);
  const serviceOrders = asArray(state.serviceOrders);
  const serviceOrderEmployees = asArray(state.serviceOrderEmployees);
  const auditLogs = asArray(state.auditLogs);

  return {
    counts: {
      users: users.length,
      employees: employees.length,
      customers: customers.length,
      serviceOrders: serviceOrders.length,
      serviceOrderEmployees: serviceOrderEmployees.length,
      auditLogs: auditLogs.length,
    },
    issues: {
      missingCustomerIds: serviceOrders.filter((order) => !order.customerId).length,
      orphanEmployeeUsers: employees.filter((employee) => employee.userId && !users.some((user) => user.id === employee.userId)).length,
      orphanTeamOrders: serviceOrderEmployees.filter((link) => !serviceOrders.some((order) => order.id === link.serviceOrderId)).length,
      orphanTeamEmployees: serviceOrderEmployees.filter((link) => !employees.some((employee) => employee.id === link.employeeId)).length,
      invalidSupervisorLinks: serviceOrders.filter((order) => {
        if (!order.supervisorEmployeeId) return false;
        const employee = employees.find((item) => item.id === order.supervisorEmployeeId);
        const user = employee?.userId ? users.find((item) => item.id === employee.userId) : undefined;
        return !employee || !user || user.role !== "SUPERVISOR_OBRA" || user.isActive === false;
      }).length,
    },
  };
}

async function importUsersAndEmployees(state: LegacyState) {
  const prisma = getScriptPrisma();
  const fallbackPasswordHash = await bcrypt.hash("123456", 10);

  await prisma.$transaction(async (tx) => {
    for (const user of asArray(state.users)) {
      await tx.user.upsert({
        where: { id: user.id },
        update: {
          name: user.name,
          email: user.email.trim().toLowerCase(),
          passwordHash: user.passwordHash ?? fallbackPasswordHash,
          role: enumOrDefault(user.role, validUserRoles, "COLABORADOR") as Prisma.UserCreateInput["role"],
          isActive: user.isActive ?? true,
          lastLoginAt: optionalDate(user.lastLoginAt),
          updatedAt: toDate(user.updatedAt),
        },
        create: {
          id: user.id,
          name: user.name,
          email: user.email.trim().toLowerCase(),
          passwordHash: user.passwordHash ?? fallbackPasswordHash,
          role: enumOrDefault(user.role, validUserRoles, "COLABORADOR") as Prisma.UserCreateInput["role"],
          isActive: user.isActive ?? true,
          lastLoginAt: optionalDate(user.lastLoginAt),
          createdAt: toDate(user.createdAt),
          updatedAt: toDate(user.updatedAt),
        },
      });
    }

    for (const employee of asArray(state.employees)) {
      await tx.employee.upsert({
        where: { id: employee.id },
        update: {
          userId: employee.userId || null,
          name: employee.name,
          phone: employee.phone ?? "",
          email: employee.email?.trim().toLowerCase() || null,
          document: employee.document || null,
          jobTitle: employee.jobTitle ?? employee.roleName ?? "Colaborador",
          roleName: employee.roleName ?? employee.jobTitle ?? "Colaborador",
          specialty: employee.specialty ?? "Geral",
          status: enumOrDefault(employee.status, validEmployeeStatuses, "ACTIVE") as Prisma.EmployeeCreateInput["status"],
          dailyCost: employee.dailyCost ?? 0,
          hiredAt: optionalDate(employee.hiredAt),
          notes: employee.notes ?? "",
          updatedAt: toDate(employee.updatedAt),
        },
        create: {
          id: employee.id,
          userId: employee.userId || undefined,
          name: employee.name,
          phone: employee.phone ?? "",
          email: employee.email?.trim().toLowerCase() || undefined,
          document: employee.document || undefined,
          jobTitle: employee.jobTitle ?? employee.roleName ?? "Colaborador",
          roleName: employee.roleName ?? employee.jobTitle ?? "Colaborador",
          specialty: employee.specialty ?? "Geral",
          status: enumOrDefault(employee.status, validEmployeeStatuses, "ACTIVE") as Prisma.EmployeeCreateInput["status"],
          dailyCost: employee.dailyCost ?? 0,
          hiredAt: optionalDate(employee.hiredAt),
          notes: employee.notes ?? "",
          createdAt: toDate(employee.createdAt),
          updatedAt: toDate(employee.updatedAt),
        },
      });
    }
  });
}

async function importServiceOrdersAndTeam(state: LegacyState) {
  const prisma = getScriptPrisma();
  const customers = asArray(state.customers);

  await prisma.$transaction(async (tx) => {
    for (const customer of customers) {
      await tx.customer.upsert({
        where: { id: customer.id },
        update: {
          name: customer.name,
          phone: customer.phone ?? "",
          email: customer.email || null,
          document: customer.document || null,
          type: enumOrDefault(customer.type, validCustomerTypes, "PERSON") as Prisma.CustomerCreateInput["type"],
          source: customer.source || null,
          notes: customer.notes ?? "",
        },
        create: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone ?? "",
          email: customer.email || undefined,
          document: customer.document || undefined,
          type: enumOrDefault(customer.type, validCustomerTypes, "PERSON") as Prisma.CustomerCreateInput["type"],
          source: customer.source || undefined,
          notes: customer.notes ?? "",
        },
      });
    }

    for (const order of asArray(state.serviceOrders)) {
      const customerId = order.customerId || `customer-${order.id}`;
      if (!customers.some((customer) => customer.id === customerId)) {
        await tx.customer.upsert({
          where: { id: customerId },
          update: { name: order.customerName || "Cliente sem nome", phone: "" },
          create: { id: customerId, name: order.customerName || "Cliente sem nome", phone: "" },
        });
      }

      await tx.serviceOrder.upsert({
        where: { id: order.id },
        update: {
          customerId,
          quoteId: order.quoteId || null,
          title: order.title,
          description: order.description ?? "",
          address: order.address,
          scheduledStart: toDate(order.scheduledStart),
          scheduledEnd: optionalDate(order.scheduledEnd),
          status: enumOrDefault(order.status, validServiceOrderStatuses, "SCHEDULED") as Prisma.ServiceOrderCreateInput["status"],
          supervisorEmployeeId: order.supervisorEmployeeId || null,
          supervisorUserId: order.supervisorUserId || null,
          assignedByUserId: order.assignedByUserId || null,
          assignedAt: optionalDate(order.assignedAt),
          assignedSupervisorByUserId: order.assignedSupervisorByUserId || null,
          supervisorAssignedAt: optionalDate(order.supervisorAssignedAt),
          internalNotes: order.internalNotes ?? "",
          clientNotes: order.clientNotes ?? "",
          updatedAt: toDate(order.updatedAt),
        },
        create: {
          id: order.id,
          customerId,
          quoteId: order.quoteId || undefined,
          title: order.title,
          description: order.description ?? "",
          address: order.address,
          scheduledStart: toDate(order.scheduledStart),
          scheduledEnd: optionalDate(order.scheduledEnd),
          status: enumOrDefault(order.status, validServiceOrderStatuses, "SCHEDULED") as Prisma.ServiceOrderCreateInput["status"],
          supervisorEmployeeId: order.supervisorEmployeeId || undefined,
          supervisorUserId: order.supervisorUserId || undefined,
          assignedByUserId: order.assignedByUserId || undefined,
          assignedAt: optionalDate(order.assignedAt),
          assignedSupervisorByUserId: order.assignedSupervisorByUserId || undefined,
          supervisorAssignedAt: optionalDate(order.supervisorAssignedAt),
          internalNotes: order.internalNotes ?? "",
          clientNotes: order.clientNotes ?? "",
          createdAt: toDate(order.createdAt),
          updatedAt: toDate(order.updatedAt),
        },
      });
    }

    for (const link of asArray(state.serviceOrderEmployees)) {
      await tx.serviceOrderEmployee.upsert({
        where: {
          serviceOrderId_employeeId: {
            serviceOrderId: link.serviceOrderId,
            employeeId: link.employeeId,
          },
        },
        update: {
          roleInService: enumOrDefault(link.roleInService, validTeamRoles, "OUTRO") as Prisma.ServiceOrderEmployeeCreateInput["roleInService"],
          assignedByUserId: link.assignedByUserId || null,
          assignedAt: toDate(link.assignedAt),
          updatedAt: toDate(link.updatedAt),
        },
        create: {
          id: link.id,
          serviceOrderId: link.serviceOrderId,
          employeeId: link.employeeId,
          roleInService: enumOrDefault(link.roleInService, validTeamRoles, "OUTRO") as Prisma.ServiceOrderEmployeeCreateInput["roleInService"],
          assignedByUserId: link.assignedByUserId || undefined,
          assignedAt: toDate(link.assignedAt),
          createdAt: toDate(link.createdAt),
          updatedAt: toDate(link.updatedAt),
        },
      });
    }
  });
}

async function importAuditLogs(state: LegacyState) {
  const prisma = getScriptPrisma();
  await prisma.$transaction(async (tx) => {
    for (const log of asArray(state.auditLogs)) {
      await tx.auditLog.upsert({
        where: { id: log.id },
        update: {
          userId: log.userId || null,
          action: log.action,
          entity: log.entity,
          entityId: log.entityId || null,
          oldValueJson: log.oldValueJson as Prisma.InputJsonValue,
          newValueJson: log.newValueJson as Prisma.InputJsonValue,
          ipAddress: log.ipAddress || null,
          metadata: log.metadata as Prisma.InputJsonValue,
          createdAt: toDate(log.createdAt),
        },
        create: {
          id: log.id,
          userId: log.userId || undefined,
          action: log.action,
          entity: log.entity,
          entityId: log.entityId || undefined,
          oldValueJson: log.oldValueJson as Prisma.InputJsonValue,
          newValueJson: log.newValueJson as Prisma.InputJsonValue,
          ipAddress: log.ipAddress || undefined,
          metadata: log.metadata as Prisma.InputJsonValue,
          createdAt: toDate(log.createdAt),
        },
      });
    }
  });
}

async function main() {
  const apply = process.argv.includes("--apply");
  const { databasePath, databaseSize, state } = readLegacyState();
  const report = buildReport(state);

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        databasePath,
        databaseSize,
        ...report,
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log("Dry-run concluido. Use --apply para gravar no MySQL depois de corrigir a conexao.");
    return;
  }

  await importUsersAndEmployees(state);
  await importServiceOrdersAndTeam(state);
  await importAuditLogs(state);
  console.log("Importacao concluida com sucesso.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
