import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getCurrentUserFromRequest } from "./auth";
import {
  canAccessAllServiceOrders,
  canCreateCustomer,
  canCreateInspection,
  canCreateLead,
  canCreateQuote,
  canEditCustomer,
  canEditInspection,
  canEditLead,
  canEditQuote,
  canManageStock,
  canViewCustomers,
  canViewInspections,
  canViewLeads,
  canViewQuotes,
} from "./permissions";
import { createResource, db, deleteResource, updateResource } from "./store";
import type { SessionUser } from "./types";

type ResourceKey = Exclude<keyof typeof db, "dashboardMetrics">;

export async function requireApiUser(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) {
    return { user: null, response: NextResponse.json({ message: "Nao autenticado." }, { status: 401 }) };
  }

  return { user, response: null };
}

export function collectionHandlers(resource: ResourceKey, responseKey: string) {
  return {
    async GET(request: NextRequest) {
      const auth = await requireApiUser(request);
      if (auth.response) return auth.response;
      const forbidden = ensureResourcePermission(auth.user, resource, "read");
      if (forbidden) return forbidden;
      return NextResponse.json({ [responseKey]: db[resource] });
    },

    async POST(request: NextRequest) {
      const auth = await requireApiUser(request);
      if (auth.response) return auth.response;
      const forbidden = ensureResourcePermission(auth.user, resource, "write");
      if (forbidden) return forbidden;
      const body = await request.json();
      const record = createResource(resource, body);
      return NextResponse.json({ [responseKey.slice(0, -1) || "record"]: record }, { status: 201 });
    },
  };
}

export function itemHandlers(resource: ResourceKey, responseKey: string) {
  return {
    async GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
      const auth = await requireApiUser(request);
      if (auth.response) return auth.response;
      const forbidden = ensureResourcePermission(auth.user, resource, "read");
      if (forbidden) return forbidden;
      const { id } = await context.params;
      const record = (db[resource] as Array<Record<string, unknown>>).find((item) => item.id === id);
      if (!record) return NextResponse.json({ message: "Registro nao encontrado." }, { status: 404 });
      return NextResponse.json({ [responseKey]: record });
    },

    async PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
      const auth = await requireApiUser(request);
      if (auth.response) return auth.response;
      const forbidden = ensureResourcePermission(auth.user, resource, "write");
      if (forbidden) return forbidden;
      const { id } = await context.params;
      const record = updateResource(resource, id, await request.json());
      if (!record) return NextResponse.json({ message: "Registro nao encontrado." }, { status: 404 });
      return NextResponse.json({ [responseKey]: record });
    },

    async DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
      const auth = await requireApiUser(request);
      if (auth.response) return auth.response;
      const forbidden = ensureResourcePermission(auth.user, resource, "write");
      if (forbidden) return forbidden;
      const { id } = await context.params;
      const deleted = deleteResource(resource, id);
      if (!deleted) return NextResponse.json({ message: "Registro nao encontrado." }, { status: 404 });
      return NextResponse.json({ ok: true });
    },
  };
}

function ensureResourcePermission(user: SessionUser, resource: ResourceKey, mode: "read" | "write") {
  if (resource === "materials" || resource === "equipment") {
    return canManageStock(user.role)
      ? null
      : NextResponse.json({ message: "Perfil sem permissao para acessar estoque." }, { status: 403 });
  }

  if (resource === "customers") {
    const allowed = mode === "read" ? canViewCustomers(user.role) : canCreateCustomer(user.role) || canEditCustomer(user.role);
    if (!allowed) return NextResponse.json({ message: "Perfil sem permissao para acessar clientes." }, { status: 403 });
  }

  if (resource === "leads") {
    const allowed = mode === "read" ? canViewLeads(user.role) : canCreateLead(user.role) || canEditLead(user.role);
    if (!allowed) return NextResponse.json({ message: "Perfil sem permissao para acessar leads." }, { status: 403 });
  }

  if (resource === "inspections") {
    const allowed = mode === "read" ? canViewInspections(user.role) : canCreateInspection(user.role) || canEditInspection(user.role);
    if (!allowed) return NextResponse.json({ message: "Perfil sem permissao para acessar vistorias." }, { status: 403 });
  }

  if (resource === "quotes") {
    const allowed = mode === "read" ? canViewQuotes(user.role) : canCreateQuote(user.role) || canEditQuote(user.role);
    if (!allowed) return NextResponse.json({ message: "Perfil sem permissao para acessar este modulo." }, { status: 403 });
  }

  if (resource === "evaluations" && mode === "write" && !canAccessAllServiceOrders(user.role)) {
    return NextResponse.json({ message: "Use a API de avaliacao operacional com contexto de OS." }, { status: 403 });
  }

  return null;
}
