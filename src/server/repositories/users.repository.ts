import "server-only";

import bcrypt from "bcryptjs";

import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { canCreateUserWithRole, canManageTargetUserRole } from "@/lib/permissions";
import type { SessionUser, SystemUser, UserRole } from "@/lib/types";

import { recordPrismaAuditLog } from "./audit-log.repository";

const userPublicSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  employeeProfile: {
    select: {
      id: true,
    },
  },
} satisfies Prisma.UserSelect;

const userAuthSelect = {
  ...userPublicSelect,
  passwordHash: true,
} satisfies Prisma.UserSelect;

type PublicUserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  employeeProfile?: { id: string } | null;
};

type AuthUserRow = PublicUserRow & {
  passwordHash: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toIsoString(date: Date | string | null | undefined) {
  if (!date) return undefined;
  return date instanceof Date ? date.toISOString() : date;
}

export function toSessionUserFromPrisma(user: PublicUserRow): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  };
}

export function toSystemUserFromPrisma(user: PublicUserRow): SystemUser {
  return {
    ...toSessionUserFromPrisma(user),
    linkedEmployeeId: user.employeeProfile?.id,
    lastLoginAt: toIsoString(user.lastLoginAt),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function findPrismaUserByEmailForAuth(email: string) {
  const prisma = getPrisma();
  return prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
    select: userAuthSelect,
  }) as Promise<AuthUserRow | null>;
}

export async function verifyPrismaUserCredentials(email: string, password: string) {
  const prisma = getPrisma();
  const user = await findPrismaUserByEmailForAuth(email);
  const validPassword = user?.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;

  if (!user || !user.isActive || !validPassword) return null;

  const updatedUser = (await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
    select: userPublicSelect,
  })) as PublicUserRow;

  return toSessionUserFromPrisma(updatedUser);
}

export async function getPrismaSystemUserForSession(userId: string) {
  const prisma = getPrisma();
  const user = (await prisma.user.findFirst({
    where: { id: userId, isActive: true },
    select: userPublicSelect,
  })) as PublicUserRow | null;

  return user ? toSystemUserFromPrisma(user) : null;
}

export async function listPrismaUsers() {
  const prisma = getPrisma();
  const users = (await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: userPublicSelect,
  })) as PublicUserRow[];

  return users.map(toSystemUserFromPrisma);
}

export async function getActiveOwnerCount() {
  const prisma = getPrisma();
  return prisma.user.count({
    where: {
      role: "OWNER",
      isActive: true,
    },
  });
}

export async function createPrismaUser(
  input: {
    id?: string;
    name: string;
    email: string;
    role: UserRole;
    isActive?: boolean;
    linkedEmployeeId?: string;
    temporaryPassword?: string;
  },
  actor?: SessionUser,
) {
  const prisma = getPrisma();
  const email = normalizeEmail(input.email);

  if (actor && !canCreateUserWithRole(actor.role, input.role)) {
    return { user: null, error: "INVALID_ACCESS_ROLE" as const };
  }

  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) return { user: null, error: "EMAIL_EXISTS" as const };

  if (input.linkedEmployeeId) {
    const employee = await prisma.employee.findUnique({
      where: { id: input.linkedEmployeeId },
      select: { id: true, userId: true },
    });
    if (!employee) return { user: null, error: "EMPLOYEE_NOT_FOUND" as const };
    if (employee.userId) return { user: null, error: "EMPLOYEE_ALREADY_HAS_ACCESS" as const };
  }

  const passwordHash = await bcrypt.hash(input.temporaryPassword ?? "123456", 10);
  const user = await prisma.$transaction(async (tx) => {
    const created = (await tx.user.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        name: input.name.trim(),
        email,
        passwordHash,
        role: input.role,
        isActive: input.isActive ?? true,
      },
      select: userPublicSelect,
    })) as PublicUserRow;

    if (input.linkedEmployeeId) {
      await tx.employee.update({
        where: { id: input.linkedEmployeeId },
        data: { userId: created.id, email },
      });
    }

    return created;
  });

  if (actor) {
    await recordPrismaAuditLog({
      userId: actor.id,
      action: "CREATE_USER",
      entity: "User",
      entityId: user.id,
      newValueJson: toSystemUserFromPrisma(user),
    });
  }

  return { user: toSystemUserFromPrisma(user), error: null };
}

export async function changePrismaUserRole(id: string, role: UserRole, actor: SessionUser) {
  const prisma = getPrisma();
  const current = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });

  if (!current) return { user: null, error: "NOT_FOUND" as const };
  if (!canManageTargetUserRole(actor.role, current.role as UserRole, role)) {
    return { user: null, error: "FORBIDDEN_ROLE" as const };
  }

  const user = (await prisma.user.update({
    where: { id },
    data: { role },
    select: userPublicSelect,
  })) as PublicUserRow;

  await recordPrismaAuditLog({
    userId: actor.id,
    action: "CHANGE_USER_ROLE",
    entity: "User",
    entityId: id,
    oldValueJson: { role: current.role },
    newValueJson: { role },
  });

  return { user: toSystemUserFromPrisma(user), error: null };
}

export async function updatePrismaUserStatus(id: string, isActive: boolean, actor: SessionUser) {
  const prisma = getPrisma();
  const current = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, isActive: true },
  });

  if (!current) return { user: null, error: "NOT_FOUND" as const };
  if (current.role === "OWNER" && !isActive && (await getActiveOwnerCount()) <= 1) {
    return { user: null, error: "LAST_OWNER" as const };
  }
  if (current.role === "OWNER" && current.id !== actor.id) {
    return { user: null, error: "PROTECTED_OWNER" as const };
  }

  const user = (await prisma.user.update({
    where: { id },
    data: { isActive },
    select: userPublicSelect,
  })) as PublicUserRow;

  await recordPrismaAuditLog({
    userId: actor.id,
    action: isActive ? "ACTIVATE_USER" : "DEACTIVATE_USER",
    entity: "User",
    entityId: id,
    oldValueJson: { isActive: current.isActive },
    newValueJson: { isActive },
  });

  return { user: toSystemUserFromPrisma(user), error: null };
}
