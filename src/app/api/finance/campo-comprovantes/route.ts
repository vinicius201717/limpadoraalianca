import { z } from "zod";
import { requireApiUser } from "@/lib/api-handlers";
import { withDatabase } from "@/lib/with-database";
import { canViewServiceOrderFinancials } from "@/lib/permissions";
import { db, recordAuditLog } from "@/lib/store";
import { digitalReceiptSchema, receiptOverview, settleFieldReceipt } from "@/lib/field-receipts";
import { paymentReceived } from "@/lib/finance-operations";
import { FieldError } from "@/lib/field-assistant";

const patchSchema = z.object({ id: z.string().uuid(), status: z.enum(["REVIEWED", "SETTLED", "CORRECT"]),
  targetId: z.string().max(160).optional(), digital: digitalReceiptSchema.optional() });
export const GET = withDatabase(async (request) => {
  const auth = await requireApiUser(request); if (auth.response) return auth.response;
  if (!canViewServiceOrderFinancials(auth.user)) return Response.json({ message: "Sem permissao financeira." }, { status: 403 });
  return Response.json({ receipts: db.fieldReceipts.map(receiptOverview).sort((a,b) => b.createdAt.localeCompare(a.createdAt)),
    expenses: db.serviceExpenses.map(({ id, serviceOrderId, amount, notes }) => ({ id, serviceOrderId, amount, notes })),
    payments: db.servicePayments.map(p => ({ id: p.id, serviceOrderId: p.serviceOrderId, description: p.description, balance: p.amount - paymentReceived(p) })) });
});
export const PATCH = withDatabase(async (request) => {
  const auth = await requireApiUser(request); if (auth.response) return auth.response;
  if (!canViewServiceOrderFinancials(auth.user)) return Response.json({ message: "Sem permissao financeira." }, { status: 403 });
  const input = patchSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ message: "Revisao invalida." }, { status: 400 });
  const receipt = db.fieldReceipts.find(item => item.id === input.data.id);
  if (!receipt) return Response.json({ message: "Comprovante nao encontrado." }, { status: 404 });
  try {
    if (input.data.status === "SETTLED") return Response.json(receiptOverview(settleFieldReceipt(auth.user, receipt.id, input.data.targetId)));
    if (receipt.status === "SETTLED") throw new FieldError("Comprovante ja baixado.");
    if (input.data.status === "CORRECT") {
      if (!input.data.digital) throw new FieldError("Informe os dados digitais.");
      const old = receipt.digital;
      receipt.digital = input.data.digital;
      receipt.status = "PENDING_REVIEW";
      recordAuditLog({ userId: auth.user.id, action: "FIELD_RECEIPT_CORRECTED", entity: "FieldReceipt", entityId: receipt.id, oldValueJson: old, newValueJson: receipt.digital });
    } else {
      receipt.status = "REVIEWED";
      recordAuditLog({ userId: auth.user.id, action: "FIELD_RECEIPT_REVIEWED", entity: "FieldReceipt", entityId: receipt.id });
    }
    receipt.updatedAt = new Date().toISOString();
    return Response.json(receiptOverview(receipt));
  } catch (error) {
    return Response.json({ message: error instanceof FieldError ? error.message : "Nao foi possivel dar baixa." }, { status: 409 });
  }
});
