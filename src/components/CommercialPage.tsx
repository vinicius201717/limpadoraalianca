import { notFound, redirect } from "next/navigation";
import { Alert } from "@mui/material";
import { getCurrentUser } from "@/lib/auth";
import { db, ensureDatabaseReady } from "@/lib/store";
import { commercialResources, type CommercialModule } from "@/lib/commercial-schema";
import { canReadCommercial, canWriteCommercial } from "@/lib/commercial-permissions";
import { canApproveQuote } from "@/lib/permissions";
import { getModuleConfig } from "@/lib/module-config";
import { ModuleScreen } from "./ModuleScreen";
import { CommercialForm } from "./CommercialForm";

export async function CommercialPage({ module, id }: { module: CommercialModule; id?: string }) {
  await ensureDatabaseReady();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canReadCommercial(module, user.role)) return <Alert severity="error">Acesso restrito a este módulo.</Alert>;
  const writable = canWriteCommercial(module, user.role);
  const rows = db[commercialResources[module]] as unknown as Array<Record<string, unknown>>;
  const config = getModuleConfig(module);
  if (!id) return <ModuleScreen config={{ ...config, rows, newPath: writable ? `/${module}/novo` : undefined, detailBasePath: `/${module}` }} />;
  if (id === "novo" && !writable) return <Alert severity="error">Seu perfil permite somente consulta.</Alert>;
  const initial = id === "novo" ? undefined : rows.find((row) => row.id === id);
  if (id !== "novo" && !initial) notFound();
  return <CommercialForm key={id} module={module} title={`${id === "novo" ? "Novo registro" : "Detalhes"} · ${config.title}`} initial={initial} writable={writable} approvable={canApproveQuote(user.role)} customers={db.customers.map((item) => ({ id: item.id, label: item.name }))} orders={db.serviceOrders.filter((item) => item.status === "DELIVERED").map((item) => ({ id: item.id, label: item.title }))} />;
}
