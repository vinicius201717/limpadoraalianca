import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import { getPrisma } from "./prisma";

export async function readAppState(id: string) {
  const row = await getPrisma().appState.findUnique({
    where: { id },
    select: { data: true },
  });

  return row?.data ?? null;
}

export async function writeAppState(id: string, data: unknown) {
  await getPrisma().appState.upsert({
    where: { id },
    create: {
      id,
      data: data as Prisma.InputJsonValue,
    },
    update: {
      data: data as Prisma.InputJsonValue,
    },
  });
}
