import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireApiUser } from "./api-handlers";
import { commercialResources, commercialSchemas, type CommercialModule } from "./commercial-schema";
import { canReadCommercial, canWriteCommercial } from "./commercial-permissions";
import { db, ensureDatabaseReady, flushDatabasePersistence, recordAuditLog } from "./store";

type Params = { params: Promise<{ id: string }> };
function rows(module: CommercialModule) { return db[commercialResources[module]] as unknown as Array<Record<string, unknown>>; }
function prepare(module: CommercialModule, input: Record<string, unknown>, previous?: Record<string, unknown>) {
  if (module === "orcamentos" && previous?.status === "APPROVED") return { error: "Proposta aprovada não pode ser alterada. Registre uma nova proposta para mudanças de escopo." };
  const schema = commercialSchemas[module];
  const currentInput = previous ? Object.fromEntries(Object.keys(schema.shape).filter((key) => previous[key] !== undefined).map((key) => [key, previous[key]])) : {};
  const parsed = schema.safeParse({ ...currentInput, ...input });
  if (!parsed.success) return { error: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") };
  const data: Record<string, unknown> = { ...parsed.data };
  if (module === "vistorias" || module === "orcamentos") {
    const customer = db.customers.find((item) => item.id === data.customerId);
    if (!customer) return { error: "Selecione um cliente cadastrado." };
    data.customerName = customer.name;
    if (data.leadId && !db.leads.some((lead) => lead.id === data.leadId && (!lead.customerId || lead.customerId === data.customerId))) return { error: "Lead não encontrado ou vinculado a outro cliente." };
    if (data.inspectionId && !db.inspections.some((item) => item.id === data.inspectionId && item.customerId === data.customerId)) return { error: "A vistoria deve pertencer ao cliente da proposta." };
  }
  if (module === "clientes" && !previous) Object.assign(data, { totalValue: 0, lastService: "" });
  if (module === "orcamentos") data.total = Math.round((Number(data.subtotal) - Number(data.discount)) * 100) / 100;
  if (module === "garantias") {
    const order = db.serviceOrders.find((item) => item.id === data.serviceOrderId);
    if (!order || order.status !== "DELIVERED") return { error: "A garantia precisa estar vinculada a um serviço entregue." };
    if (previous && previous.serviceOrderId !== data.serviceOrderId) return { error: "O vínculo da garantia não pode ser alterado." };
    if (!previous && db.warranties.some((item) => item.serviceOrderId === order.id && item.status !== "CANCELED")) return { error: "Este serviço já possui uma garantia. Atualize a garantia existente." };
    Object.assign(data, { title: order.title, customerName: order.customerName, updatedAt: new Date().toISOString() });
    if (!previous) data.createdAt = data.updatedAt;
  }
  return { data };
}

export function commercialCollection(module: CommercialModule) {
  return {
    async GET(request: NextRequest) {
      const auth = await requireApiUser(request); if (auth.response) return auth.response;
      if (!canReadCommercial(module, auth.user.role)) return NextResponse.json({ message: "Acesso restrito." }, { status: 403 });
      await ensureDatabaseReady();
      return NextResponse.json({ [commercialResources[module]]: rows(module) });
    },
    async POST(request: NextRequest) {
      const auth = await requireApiUser(request); if (auth.response) return auth.response;
      if (!canWriteCommercial(module, auth.user.role)) return NextResponse.json({ message: "Acesso restrito." }, { status: 403 });
      await ensureDatabaseReady();
      const input = await request.json().catch(() => null);
      if (!input || typeof input !== "object" || Array.isArray(input)) return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
      const result = prepare(module, input);
      if (result.error) return NextResponse.json({ message: result.error }, { status: 400 });
      const record = { ...result.data, id: `${commercialResources[module]}-${randomUUID()}` };
      rows(module).unshift(record);
      recordAuditLog({ userId: auth.user.id, action: "CREATE_COMMERCIAL_RECORD", entity: commercialResources[module], entityId: record.id, newValueJson: record });
      await flushDatabasePersistence();
      return NextResponse.json({ record }, { status: 201 });
    },
  };
}

export function commercialItem(module: CommercialModule) {
  return {
    async GET(request: NextRequest, context: Params) {
      const auth = await requireApiUser(request); if (auth.response) return auth.response;
      if (!canReadCommercial(module, auth.user.role)) return NextResponse.json({ message: "Acesso restrito." }, { status: 403 });
      await ensureDatabaseReady();
      const { id } = await context.params;
      const record = rows(module).find((item) => item.id === id);
      return record ? NextResponse.json({ record }) : NextResponse.json({ message: "Registro não encontrado." }, { status: 404 });
    },
    async PATCH(request: NextRequest, context: Params) {
      const auth = await requireApiUser(request); if (auth.response) return auth.response;
      if (!canWriteCommercial(module, auth.user.role)) return NextResponse.json({ message: "Acesso restrito." }, { status: 403 });
      await ensureDatabaseReady();
      const { id } = await context.params;
      const record = rows(module).find((item) => item.id === id);
      if (!record) return NextResponse.json({ message: "Registro não encontrado." }, { status: 404 });
      const input = await request.json().catch(() => null);
      if (!input || typeof input !== "object" || Array.isArray(input)) return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
      const result = prepare(module, input, record);
      if (result.error) return NextResponse.json({ message: result.error }, { status: 400 });
      const oldValueJson = { ...record };
      Object.assign(record, result.data);
      recordAuditLog({ userId: auth.user.id, action: "UPDATE_COMMERCIAL_RECORD", entity: commercialResources[module], entityId: id, oldValueJson, newValueJson: record });
      await flushDatabasePersistence();
      return NextResponse.json({ record });
    },
    async DELETE(request: NextRequest) {
      const auth = await requireApiUser(request); if (auth.response) return auth.response;
      return NextResponse.json({ message: "A exclusão de registros comerciais está desabilitada para preservar o histórico. Atualize a situação do registro." }, { status: 405 });
    },
  };
}
