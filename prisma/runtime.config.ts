import "dotenv/config";
import { defineConfig } from "prisma/config";
export default defineConfig({ schema: "runtime.prisma", migrations: { path: "runtime-migrations" }, datasource: { url: process.env.DATABASE_URL } });
