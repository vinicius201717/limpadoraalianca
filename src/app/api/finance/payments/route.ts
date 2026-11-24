import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api-handlers";
import { withDatabase } from "@/lib/with-database";
import { db, recordAuditLog } from "@/lib/store";
import { canViewServiceOrderFinancials } from "@/lib/permissions";
import { dateOnly } from "@/lib/commercial-schema";
import { addReceipt, paymentReceived, roundMoney, type ServicePayment } from "@/lib/finance-operations";
const money = z.coerce.number().finite().min(0.01).max(1e9);
const command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), serviceOrderId: z.string(), description: z.string().trim().min(3).max(200), amount: money, dueAt: dateOnly, requestId: z.string().uuid().optional() }).strict(),
  z.object({ action: z.literal("receive"), paymentId: z.string(), amount: money, paidAt: dateOnly, method: z.enum(["PIX", "CASH", "CARD", "TRANSFER", "OTHER"]), reference: z.string().trim().max(200).default("") }).strict(),
  z.object({ action: z.literal("reverse"), paymentId: z.string(), receiptId: z.string(), reason: z.string().trim().min(5).max(1000) }).strict(),
]);
export const GET = withDatabase(async (request: NextRequest) => {
  const auth = await requireApiUser(request); if (auth.response) return auth.response;
  if (!canViewServiceOrderFinancials(auth.user)) return NextResponse.json({ message: "Acesso restrito." }, { status: 403 });
  return NextResponse.json({ payments: db.servicePayments.map((payment) => ({ ...payment, received: paymentReceived(payment) })), orders: db.serviceOrders.map((order) => ({ id: order.id, title: order.title, revenue: order.revenue })) });
});
export const POST = withDatabase(async (request: NextRequest) => {
  const auth = await requireApiUser(request); if (auth.response) return auth.response;
  if (!canViewServiceOrderFinancials(auth.user)) return NextResponse.json({ message: "Acesso restrito." }, { status: 403 });
  const input = command.parse(await request.json());
  let payment: ServicePayment;
  if (input.action === "create") {
    const prior = input.requestId ? db.servicePayments.find(p=>p.requestId===input.requestId && p.createdByUserId===auth.user.id) : undefined;
    if (prior) {
      if (prior.serviceOrderId!==input.serviceOrderId || prior.amount!==roundMoney(input.amount) || prior.description!==input.description || prior.dueAt!==input.dueAt) return NextResponse.json({message:"Identificador de envio reutilizado com outros dados."},{status:409});
      return NextResponse.json({payment:prior});
    }
    const order = db.serviceOrders.find((item) => item.id === input.serviceOrderId && item.status !== "CANCELED");
    if (!order) return NextResponse.json({ message: "OS não encontrada ou cancelada." }, { status: 404 });
    const scheduled = db.servicePayments.filter((item) => item.serviceOrderId === order.id).reduce((sum, item) => sum + item.amount, 0);
    if (roundMoney(scheduled + input.amount) > roundMoney(order.revenue)) return NextResponse.json({ message: "As parcelas não podem superar o valor contratado." }, { status: 409 });
    payment = { id: `payment-${randomUUID()}`, serviceOrderId: order.id, description: input.description, amount: roundMoney(input.amount), dueAt: input.dueAt, receipts: [], createdAt: new Date().toISOString(), createdByUserId: auth.user.id, requestId: input.requestId };
    db.servicePayments.push(payment);
  } else {
    const found = db.servicePayments.find((item) => item.id === input.paymentId);
    if (!found) return NextResponse.json({ message: "Parcela não encontrada." }, { status: 404 });
    payment = found;
    if (input.action === "receive") {
      const ref = input.reference.trim().toLowerCase();
      const duplicate = db.servicePayments.some(p => p.receipts.some(r => !r.reversedAt && (ref ? r.reference.trim().toLowerCase() === ref : p.id === payment.id && r.amount === roundMoney(input.amount) && r.paidAt === input.paidAt && r.method === input.method && !r.reference.trim())));
      if (duplicate) return NextResponse.json({ message: "Recebimento ja registrado. Confira a referencia antes de repetir." }, { status: 409 });
      try { addReceipt(payment, { amount: input.amount, paidAt: input.paidAt, method: input.method, reference: input.reference }, auth.user.id); } catch (error) { return NextResponse.json({ message: (error as Error).message }, { status: 409 }); }
    } else {
      const receipt = payment.receipts.find((item) => item.id === input.receiptId);
      if (!receipt || receipt.reversedAt) return NextResponse.json({ message: "Recebimento não encontrado ou já estornado." }, { status: 409 });
      Object.assign(receipt, { reversedAt: new Date().toISOString(), reversedByUserId: auth.user.id, reversalReason: input.reason });
      for (const doc of db.fieldReceipts.filter(r => r.settlement?.direction === "RECEIPT" && r.settlement.ledgerId === receipt.id && r.status === "SETTLED")) {
        doc.status = "REVERSED"; doc.updatedAt = receipt.reversedAt!; doc.reversal = { at: doc.updatedAt, byUserId: auth.user.id, reason: input.reason };
        const linked = db.financialDocuments.find(d => d.id === doc.id); if (linked) Object.assign(linked, { direction: "ARCHIVE", amount: undefined });
        recordAuditLog({ userId: auth.user.id, action: "FIELD_RECEIPT_REVERSED", entity: "FieldReceipt", entityId: doc.id, newValueJson: doc.reversal });
      }
    }
  }
  recordAuditLog({ userId: auth.user.id, action: `PAYMENT_${input.action.toUpperCase()}`, entity: "ServicePayment", entityId: payment.id, newValueJson: input });
  return NextResponse.json({ payment }, { status: 201 });
});
