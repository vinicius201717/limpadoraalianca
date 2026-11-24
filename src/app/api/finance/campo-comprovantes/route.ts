import { z } from "zod";
import { requireApiUser } from "@/lib/api-handlers";
import { withDatabase } from "@/lib/with-database";
import { canViewServiceOrderFinancials } from "@/lib/permissions";
import { db, recordAuditLog } from "@/lib/store";
import { readFieldImage } from "@/lib/field-storage";
import { consumeRateLimit } from "@/lib/rate-limit";
import { digitalReceiptSchema, extractDigitalReceipt, receiptOverview, settleFieldReceipt } from "@/lib/field-receipts";
import { paymentReceived } from "@/lib/finance-operations";
import { FieldError } from "@/lib/field-assistant";

export const maxDuration = 120;
const patchSchema = z.object({ id: z.string().uuid(), status: z.enum(["REVIEWED", "SETTLED", "CORRECT", "RETRY_EXTRACTION"]),
  targetId: z.string().max(160).optional(), digital: digitalReceiptSchema.optional(), expectedUpdatedAt: z.string().optional(), costCenter: z.enum(["ADMINISTRACAO", "TRANSPORTE", "MANUTENCAO", "ALUGUEL", "OUTROS"]).optional() });
export const GET = withDatabase(async (request) => {
  const auth = await requireApiUser(request); if (auth.response) return auth.response;
  if (!canViewServiceOrderFinancials(auth.user)) return Response.json({ message: "Sem permissao financeira." }, { status: 403 });
  const offset = Math.max(0, Math.min(1000000, Number.parseInt(request.nextUrl.searchParams.get("offset") || "0", 10) || 0));
  const sorted = [...db.fieldReceipts].sort((a,b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  const page = sorted.slice(offset, offset + 50); const orderIds = new Set(page.map(r => r.serviceOrderId));
  return Response.json({ receipts: page.map(receiptOverview), total: sorted.length, pending: sorted.filter(r => ["PENDING_REVIEW", "REVIEWED"].includes(r.status)).length, administrativeTotal: db.administrativeExpenses.reduce((s,e) => s+e.amount,0),
    expenses: db.serviceExpenses.filter(e => orderIds.has(e.serviceOrderId)).map(({ id, serviceOrderId, amount, notes }) => ({ id, serviceOrderId, amount, notes })),
    payments: db.servicePayments.filter(p => orderIds.has(p.serviceOrderId)).map(p => ({ id: p.id, serviceOrderId: p.serviceOrderId, description: p.description, balance: p.amount - paymentReceived(p) })) });
});
export const PATCH = withDatabase(async (request) => {
  const auth = await requireApiUser(request); if (auth.response) return auth.response;
  if (!canViewServiceOrderFinancials(auth.user)) return Response.json({ message: "Sem permissao financeira." }, { status: 403 });
  const input = patchSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ message: "Revisao invalida." }, { status: 400 });
  const receipt = db.fieldReceipts.find(item => item.id === input.data.id);
  if (!receipt) return Response.json({ message: "Comprovante nao encontrado." }, { status: 404 });
  try {
    if (input.data.expectedUpdatedAt && input.data.expectedUpdatedAt !== receipt.updatedAt) throw new FieldError("O comprovante mudou. Atualize e confira novamente.");
    if (input.data.status === "SETTLED") return Response.json(receiptOverview(settleFieldReceipt(auth.user, receipt.id, input.data.targetId)));
    if (["SETTLED", "REVERSED"].includes(receipt.status)) throw new FieldError("Comprovante encerrado.");
    if (input.data.status === "RETRY_EXTRACTION") {
      if (receipt.digital?.confidence === "HIGH") throw new FieldError("Dados ja disponiveis. Revise manualmente.");
      const retry = await consumeRateLimit("receipt-extraction-retry", auth.user.id, 10, 3600000);
      if (retry) return Response.json({message:"Limite de novas leituras atingido."},{status:429});
      const old = receipt.digital;
      const digital = await readFieldImage(receipt.attachment.storagePath, 15*1024*1024).then(bytes=>extractDigitalReceipt(bytes,receipt.attachment.mimeType,receipt.description)).catch(()=>undefined);
      if (digital) receipt.digital = digital;
      receipt.extraction = {status:digital?"READY":"FAILED",attempts:(receipt.extraction?.attempts??0)+1,attemptedAt:new Date().toISOString()};
      receipt.status="PENDING_REVIEW";
      recordAuditLog({userId:auth.user.id,action:"FIELD_RECEIPT_REEXTRACTED",entity:"FieldReceipt",entityId:receipt.id,oldValueJson:old,newValueJson:{extraction:receipt.extraction}});
    } else if (input.data.status === "CORRECT") {
      if (!input.data.digital) throw new FieldError("Informe os dados digitais.");
      const old = receipt.digital;
      receipt.digital = input.data.digital;
      if (!receipt.serviceOrderId && input.data.costCenter) receipt.costCenter = input.data.costCenter;
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
