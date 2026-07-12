import "server-only";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "@/generated/prisma/client";

const globalPrisma = globalThis as typeof globalThis & {
  __floorRestorationPrisma?: PrismaClient;
};

export function getPrisma() {
  if (!globalPrisma.__floorRestorationPrisma) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL nao configurada.");
    }

    globalPrisma.__floorRestorationPrisma = new PrismaClient({
      adapter: new PrismaMariaDb(databaseUrl),
    });
  }

  return globalPrisma.__floorRestorationPrisma;
}
