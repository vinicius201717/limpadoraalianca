import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

const blockedAuditKeys = new Set(["password", "passwordHash", "temporaryPassword", "token", "jwt", "cookie"]);

function sanitizeAuditValue(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeAuditValue(item));

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !blockedAuditKeys.has(key))
      .map(([key, item]) => [key, sanitizeAuditValue(item)]),
  );
}

function toJsonValue(value: unknown) {
  if (value === undefined) return undefined;
  return sanitizeAuditValue(value) as Prisma.InputJsonValue;
}

export type AuditLogInput = {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  oldValueJson?: unknown;
  newValueJson?: unknown;
  ipAddress?: string;
  metadata?: unknown;
};

export async function recordPrismaAuditLog(input: AuditLogInput) {
  const prisma = getPrisma();

  return prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      oldValueJson: toJsonValue(input.oldValueJson),
      newValueJson: toJsonValue(input.newValueJson),
      ipAddress: input.ipAddress,
      metadata: toJsonValue(input.metadata),
    },
  });
}
