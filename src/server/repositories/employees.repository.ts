import "server-only";

import bcrypt from "bcryptjs";

import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { canCreateEmployee, canCreateUserWithRole, canPromoteEmployeeToSupervisor, canPromoteSupervisorToManager } from "@/lib/permissions";
import type { Employee, EmployeeStatus, SessionUser, UserRole } from "@/lib/types";

import { recordPrismaAuditLog } from "./audit-log.repository";

const employeeSelect = {
  id: true,
  userId: true,
  name: true,
  phone: true,
  email: true,
  document: true,
  jobTitle: true,
  roleName: true,
  specialty: true,
  status: true,
  dailyCost: true,
  hiredAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      role: true,
      isActive: true,
    },
  },
  serviceOrders: {
    select: {
      serviceOrder: {
        select: {
          title: true,
          actualEnd: true,
          scheduledStart: true,
        },
      },
    },
  },
  evaluations: {
    orderBy: {
      createdAt: "desc",
    },
    select: {
      overallScore: true,
      createdAt: true,
      needsTraining: true,
      positiveNotes: true,
      improvementNotes: true,
      punctualityScore: true,
      qualityScore: true,
      productivityScore: true,
      careScore: true,
      teamworkScore: true,
      clientPostureScore: true,
      checklistComplianceScore: true,
    },
  },
} satisfies Prisma.EmployeeSelect;

type EmployeeRow = {
  id: string;
  userId: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  document: string | null;
  jobTitle: string | null;
  roleName: string | null;
  specialty: string | null;
  status: EmployeeStatus;
  dailyCost: unknown;
  hiredAt: Date | null;
  notes: string | null;
  serviceOrders: Array<{
    serviceOrder: {
      title: string;
      actualEnd: Date | null;
      scheduledStart: Date;
    };
  }>;
  evaluations: Array<{
    overallScore: unknown;
    createdAt: Date;
    needsTraining: boolean;
    positiveNotes: string | null;
    improvementNotes: string | null;
    punctualityScore: number;
    qualityScore: number;
    productivityScore: number;
    careScore: number;
    teamworkScore: number;
    clientPostureScore: number;
    checklistComplianceScore: number;
  }>;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function decimalToNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function toEmployeeFromPrisma(row: EmployeeRow): Employee {
  const evaluations = row.evaluations;
  const lastService = row.serviceOrders
    .map((link) => link.serviceOrder)
    .sort((a, b) => (b.actualEnd ?? b.scheduledStart).getTime() - (a.actualEnd ?? a.scheduledStart).getTime())[0];

  return {
    id: row.id,
    userId: row.userId ?? undefined,
    name: row.name,
    phone: row.phone ?? "",
    email: row.email ?? "",
    document: row.document ?? "",
    jobTitle: row.jobTitle ?? row.roleName ?? "Colaborador",
    roleName: row.roleName ?? row.jobTitle ?? "Colaborador",
    specialty: row.specialty ?? "Geral",
    status: row.status,
    dailyCost: decimalToNumber(row.dailyCost),
    hiredAt: row.hiredAt?.toISOString().slice(0, 10) ?? "",
    notes: row.notes ?? "",
    averageRating: average(evaluations.map((item) => decimalToNumber(item.overallScore))),
    serviceOrdersCount: row.serviceOrders.length,
    lastJob: lastService?.title ?? "Ainda sem obra",
    lastEvaluationAt: evaluations[0]?.createdAt.toISOString(),
    needsTraining: evaluations.some((item) => item.needsTraining),
    trainingAlert: evaluations.some((item) => item.needsTraining) ? "Treinamento recomendado pela avaliacao recente." : "",
    criteriaAverages: evaluations.length
      ? {
          punctuality: average(evaluations.map((item) => item.punctualityScore)),
          quality: average(evaluations.map((item) => item.qualityScore)),
          productivity: average(evaluations.map((item) => item.productivityScore)),
          care: average(evaluations.map((item) => item.careScore)),
          teamwork: average(evaluations.map((item) => item.teamworkScore)),
          clientPosture: average(evaluations.map((item) => item.clientPostureScore)),
          checklistCompliance: average(evaluations.map((item) => item.checklistComplianceScore)),
        }
      : undefined,
    strengths: evaluations.flatMap((item) => (item.positiveNotes ? [item.positiveNotes] : [])).slice(0, 5),
    improvements: evaluations.flatMap((item) => (item.improvementNotes ? [item.improvementNotes] : [])).slice(0, 5),
  };
}

export async function listPrismaEmployees() {
  const prisma = getPrisma();
  const employees = (await prisma.employee.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: employeeSelect,
  })) as EmployeeRow[];

  return employees.map(toEmployeeFromPrisma);
}

export async function getPrismaEmployeeById(id: string) {
  const prisma = getPrisma();
  const employee = (await prisma.employee.findUnique({
    where: { id },
    select: employeeSelect,
  })) as EmployeeRow | null;

  return employee ? toEmployeeFromPrisma(employee) : null;
}

export async function createPrismaEmployee(
  input: {
    id?: string;
    name: string;
    email?: string;
    phone?: string;
    jobTitle?: string;
    roleName?: string;
    specialty?: string;
    status?: EmployeeStatus;
    dailyCost?: number;
    hiredAt?: string;
    notes?: string;
    createAccess?: boolean;
    accessRole?: UserRole;
    temporaryPassword?: string;
  },
  actor: SessionUser,
) {
  const prisma = getPrisma();
  if (!canCreateEmployee(actor.role)) {
    return { employee: null, user: null, error: "FORBIDDEN" as const };
  }

  const accessRole = input.accessRole ?? "COLABORADOR";
  if (input.createAccess && !canCreateUserWithRole(actor.role, accessRole)) {
    return { employee: null, user: null, error: "INVALID_ACCESS_ROLE" as const };
  }

  const normalizedEmail = input.email ? normalizeEmail(input.email) : undefined;
  if (input.createAccess && !normalizedEmail) {
    return { employee: null, user: null, error: "EMAIL_REQUIRED" as const };
  }

  if (normalizedEmail) {
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
    if (existingUser) return { employee: null, user: null, error: "EMAIL_EXISTS" as const };
  }

  const result = await prisma.$transaction(async (tx) => {
    const employee = await tx.employee.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        name: input.name.trim(),
        email: normalizedEmail,
        phone: input.phone?.trim(),
        jobTitle: input.jobTitle?.trim() || input.roleName?.trim() || "Colaborador",
        roleName: input.roleName?.trim() || input.jobTitle?.trim() || "Colaborador",
        specialty: input.specialty?.trim() || "Geral",
        status: input.status ?? "ACTIVE",
        dailyCost: input.dailyCost ?? 0,
        hiredAt: input.hiredAt ? new Date(input.hiredAt) : undefined,
        notes: input.notes ?? "",
      },
      select: employeeSelect,
    });

    if (!input.createAccess || !normalizedEmail) {
      return { employee: employee as EmployeeRow, user: null };
    }

    const user = await tx.user.create({
      data: {
        name: input.name.trim(),
        email: normalizedEmail,
        passwordHash: await bcrypt.hash(input.temporaryPassword ?? "123456", 10),
        role: accessRole,
        isActive: true,
      },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    const linkedEmployee = await tx.employee.update({
      where: { id: employee.id },
      data: { userId: user.id },
      select: employeeSelect,
    });

    return { employee: linkedEmployee as EmployeeRow, user };
  });

  await recordPrismaAuditLog({
    userId: actor.id,
    action: result.user ? "CREATE_EMPLOYEE_WITH_ACCESS" : "CREATE_EMPLOYEE",
    entity: "Employee",
    entityId: result.employee.id,
    newValueJson: { employee: toEmployeeFromPrisma(result.employee), user: result.user },
  });

  return { employee: toEmployeeFromPrisma(result.employee), user: result.user, error: null };
}

export async function updatePrismaEmployeeStatus(id: string, status: EmployeeStatus, actor: SessionUser) {
  const prisma = getPrisma();
  if (!canCreateEmployee(actor.role)) return { employee: null, error: "FORBIDDEN" as const };

  const current = await prisma.employee.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!current) return { employee: null, error: "NOT_FOUND" as const };

  const employee = (await prisma.employee.update({
    where: { id },
    data: { status },
    select: employeeSelect,
  })) as EmployeeRow;

  await recordPrismaAuditLog({
    userId: actor.id,
    action: "UPDATE_EMPLOYEE_STATUS",
    entity: "Employee",
    entityId: id,
    oldValueJson: { status: current.status },
    newValueJson: { status },
  });

  return { employee: toEmployeeFromPrisma(employee), error: null };
}

export async function promotePrismaEmployeeToSupervisor(
  employeeId: string,
  actor: SessionUser,
  input?: { email?: string; temporaryPassword?: string },
) {
  const prisma = getPrisma();
  if (!canPromoteEmployeeToSupervisor(actor.role)) return { employee: null, user: null, error: "FORBIDDEN" as const };

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, name: true, email: true, userId: true },
  });
  if (!employee) return { employee: null, user: null, error: "NOT_FOUND" as const };

  const email = normalizeEmail(input?.email ?? employee.email ?? "");
  if (!email) return { employee: null, user: null, error: "EMAIL_REQUIRED" as const };

  const result = await prisma.$transaction(async (tx) => {
    const user = employee.userId
      ? await tx.user.update({
          where: { id: employee.userId },
          data: { role: "SUPERVISOR_OBRA", isActive: true, email },
          select: { id: true, name: true, email: true, role: true, isActive: true },
        })
      : await tx.user.create({
          data: {
            name: employee.name,
            email,
            role: "SUPERVISOR_OBRA",
            isActive: true,
            passwordHash: await bcrypt.hash(input?.temporaryPassword ?? "123456", 10),
          },
          select: { id: true, name: true, email: true, role: true, isActive: true },
        });

    const updatedEmployee = (await tx.employee.update({
      where: { id: employee.id },
      data: {
        userId: user.id,
        email,
        roleName: "Supervisor de obra",
        jobTitle: "Supervisor de obra",
        status: "ACTIVE",
      },
      select: employeeSelect,
    })) as EmployeeRow;

    return { employee: updatedEmployee, user };
  });

  await recordPrismaAuditLog({
    userId: actor.id,
    action: "PROMOTE_EMPLOYEE_TO_SUPERVISOR",
    entity: "Employee",
    entityId: employeeId,
    newValueJson: { user: result.user },
  });

  return { employee: toEmployeeFromPrisma(result.employee), user: result.user, error: null };
}

export async function promotePrismaSupervisorToManager(employeeId: string, actor: SessionUser) {
  const prisma = getPrisma();
  if (!canPromoteSupervisorToManager(actor.role)) return { employee: null, user: null, error: "FORBIDDEN" as const };

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, userId: true } });
  if (!employee?.userId) return { employee: null, user: null, error: "USER_REQUIRED" as const };

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: employee.userId ?? "" },
      data: { role: "GERENTE", isActive: true },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    const updatedEmployee = (await tx.employee.update({
      where: { id: employee.id },
      data: { roleName: "Gerente", jobTitle: "Gerente" },
      select: employeeSelect,
    })) as EmployeeRow;

    return { employee: updatedEmployee, user };
  });

  await recordPrismaAuditLog({
    userId: actor.id,
    action: "PROMOTE_SUPERVISOR_TO_MANAGER",
    entity: "Employee",
    entityId: employeeId,
    newValueJson: { user: result.user },
  });

  return { employee: toEmployeeFromPrisma(result.employee), user: result.user, error: null };
}

export async function removePrismaSupervisorRole(employeeId: string, actor: SessionUser) {
  const prisma = getPrisma();
  if (!canPromoteEmployeeToSupervisor(actor.role)) return { employee: null, user: null, error: "FORBIDDEN" as const };

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, userId: true } });
  if (!employee) return { employee: null, user: null, error: "NOT_FOUND" as const };

  const result = await prisma.$transaction(async (tx) => {
    const user = employee.userId
      ? await tx.user.update({
          where: { id: employee.userId },
          data: { role: "COLABORADOR" },
          select: { id: true, name: true, email: true, role: true, isActive: true },
        })
      : null;
    const updatedEmployee = (await tx.employee.update({
      where: { id: employee.id },
      data: { roleName: "Colaborador", jobTitle: "Colaborador" },
      select: employeeSelect,
    })) as EmployeeRow;

    return { employee: updatedEmployee, user };
  });

  await recordPrismaAuditLog({
    userId: actor.id,
    action: "REMOVE_SUPERVISOR_ROLE",
    entity: "Employee",
    entityId: employeeId,
    newValueJson: { user: result.user },
  });

  return { employee: toEmployeeFromPrisma(result.employee), user: result.user, error: null };
}
