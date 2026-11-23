import { withDatabase } from "@/lib/with-database";
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api-handlers";
import { approvalSchema, businessDate } from "@/lib/commercial-schema";
import { canApproveQuote } from "@/lib/permissions";
import { createClientAccessCode, db, ensureDatabaseReady, flushDatabasePersistence, recordAuditLog } from "@/lib/store";
import type { ServiceOrder } from "@/lib/types";

async function POSTHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request); if (auth.response) return auth.response;
  if (!canApproveQuote(auth.user.role)) return NextResponse.json({ message: "Acesso restrito." }, { status: 403 });
  await ensureDatabaseReady();
  const { id } = await context.params;
  const quote = db.quotes.find((item) => item.id === id);
  if (!quote) return NextResponse.json({ message: "Orçamento não encontrado." }, { status: 404 });
  const existing = db.serviceOrders.find((order) => order.quoteId === quote.id);
  if (quote.status === "APPROVED" && existing) return NextResponse.json({ quote, serviceOrderId: existing.id });
  if (!["DRAFT", "SENT"].includes(quote.status)) return NextResponse.json({ message: "Somente propostas em rascunho ou enviadas podem ser aprovadas." }, { status: 409 });
  if (quote.validUntil < businessDate()) return NextResponse.json({ message: "A proposta expirou. Revise sua validade antes de aprovar." }, { status: 409 });
  const parsed = approvalSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues.map((issue) => issue.message).join(" ") }, { status: 400 });
  const customer = db.customers.find((item) => item.id === quote.customerId);
  if (!customer || !quote.title?.trim() || !quote.address?.trim() || !quote.description?.trim() || !quote.serviceType || !Number.isFinite(quote.total) || quote.total <= 0) {
    return NextResponse.json({ message: "Complete cliente, título, endereço, tipo de serviço, escopo e valor positivo antes de aprovar." }, { status: 400 });
  }
  const now = new Date().toISOString();
  const order: ServiceOrder = {
    id: `os-${randomUUID()}`, customerId: customer.id, customerName: customer.name, quoteId: quote.id,
    title: quote.title, serviceType: quote.serviceType, description: quote.description, address: quote.address,
    scheduledStart: parsed.data.scheduledStart, scheduledEnd: parsed.data.scheduledEnd, status: "SCHEDULED",
    clientAccessCode: createClientAccessCode(), clientAccessEnabled: true,
    internalNotes: `Aprovação registrada por ${auth.user.name} em ${now}: ${parsed.data.acceptanceNotes}`,
    clientNotes: quote.paymentTerms, employeeIds: [], tasks: [], revenue: quote.total, expenses: 0,
  };
  db.serviceOrders.unshift(order);
  Object.assign(quote, { status: "APPROVED", approvedAt: now, serviceOrderId: order.id });
  customer.totalValue = db.serviceOrders.filter((item) => item.customerId === customer.id && item.status !== "CANCELED").reduce((sum, item) => sum + item.revenue, 0);
  customer.lastService = order.title;
  const lead = quote.leadId ? db.leads.find((item) => item.id === quote.leadId) : undefined;
  if (lead) { lead.status = "WON"; lead.customerId = customer.id; }
  recordAuditLog({ userId: auth.user.id, action: "APPROVE_QUOTE_AND_CREATE_ORDER", entity: "Quote", entityId: id, newValueJson: { serviceOrderId: order.id, total: quote.total, acceptanceNotes: parsed.data.acceptanceNotes } });
  await flushDatabasePersistence();
  return NextResponse.json({ quote, serviceOrderId: order.id }, { status: 201 });
}

export const POST = withDatabase(POSTHandler);
