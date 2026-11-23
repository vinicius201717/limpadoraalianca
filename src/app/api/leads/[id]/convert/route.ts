import { withDatabase } from "@/lib/with-database";
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api-handlers";
import { canConvertLead } from "@/lib/permissions";
import { db, ensureDatabaseReady, flushDatabasePersistence, recordAuditLog } from "@/lib/store";

async function POSTHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request); if (auth.response) return auth.response;
  if (!canConvertLead(auth.user.role)) return NextResponse.json({ message: "Acesso restrito." }, { status: 403 });
  await ensureDatabaseReady();
  const { id } = await context.params;
  const lead = db.leads.find((item) => item.id === id);
  if (!lead) return NextResponse.json({ message: "Lead não encontrado." }, { status: 404 });
  const existing = lead.customerId ? db.customers.find((item) => item.id === lead.customerId) : undefined;
  if (existing) return NextResponse.json({ customer: existing });
  if (!lead.name?.trim() || !lead.phone?.trim()) return NextResponse.json({ message: "Complete nome e telefone antes de converter." }, { status: 400 });
  const customer = { id: `customer-${randomUUID()}`, name: lead.name, phone: lead.phone, email: lead.email || "", document: "", type: "PERSON", source: lead.source, address: "", notes: lead.notes, totalValue: 0, lastService: "" };
  db.customers.unshift(customer);
  lead.customerId = customer.id;
  if (lead.status === "NEW") lead.status = "CONTACTED";
  recordAuditLog({ userId: auth.user.id, action: "CONVERT_LEAD", entity: "Lead", entityId: id, newValueJson: { customerId: customer.id } });
  await flushDatabasePersistence();
  return NextResponse.json({ customer }, { status: 201 });
}

export const POST = withDatabase(POSTHandler);
