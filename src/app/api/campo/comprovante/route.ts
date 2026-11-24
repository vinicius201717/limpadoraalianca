import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireApiUser } from "@/lib/api-handlers";
import { withDatabase } from "@/lib/with-database";
import { appendFieldEntry, authorizeFieldContext, FieldError } from "@/lib/field-assistant";
import { fieldAttachment, readFieldImage, verifyUploadedMedia, verifyUploadTicket } from "@/lib/field-storage";
import { consumeRateLimit } from "@/lib/rate-limit";
import { db, recordAuditLog } from "@/lib/store";

import { extractDigitalReceipt, receiptHash } from "@/lib/field-receipts";

const schema = z.object({
  ticket: z.string().min(20).max(3000),
  nonce: z.string().regex(/^[a-zA-Z0-9_-]{12,100}$/),
  description: z.string().trim().max(2400).default(""),
});
function recognizedDocument(bytes: Buffer, type: string) {
  if (type === "application/pdf") return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (type === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (type === "image/webp") return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

export const maxDuration = 120;
export const POST = withDatabase(async (request) => {
  const auth = await requireApiUser(request); if (auth.response) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "Dados do comprovante inválidos." }, { status: 400 });
  const input = parsed.data;
  try {
    const claim = verifyUploadTicket(input.ticket);
    authorizeFieldContext(auth.user, claim.orderId);
    if (claim.userId !== auth.user.id || claim.sessionVersion !== (auth.user.sessionVersion ?? 0))
      throw new FieldError("Este comprovante não pertence à sua sessão.");
    if (!["image", "document"].includes(claim.type))
      throw new FieldError("Comprovantes precisam ser PDF, JPG, PNG ou WEBP.");
    const source = "campo:" + auth.user.id + ":" + input.nonce;
    const previous = db.fieldReceipts.find((item) => item.sourceMessageId === source || item.attachment.storagePath === claim.path);
    if (previous) {
      if (previous.uploadedByUserId !== auth.user.id || (previous.serviceOrderId || "office") !== (claim.orderId === "warehouse" ? "office" : claim.orderId))
        throw new FieldError("Este arquivo já está vinculado a outro lançamento.");
      return Response.json({ receipt: { id: previous.id, status: previous.status }, duplicate: true });
    }
    const retry = await consumeRateLimit("field-receipt", auth.user.id, 60, 60 * 60_000);
    if (retry) return Response.json({ message: "Limite de comprovantes por hora atingido." }, { status: 429 });
    await verifyUploadedMedia(claim);
    const bytes = await readFieldImage(claim.path, 15 * 1024 * 1024);
    if (!recognizedDocument(bytes, claim.mimeType)) throw new FieldError("O arquivo não parece corresponder ao formato enviado.");
    const fileHash = receiptHash(bytes);
    const digital = await extractDigitalReceipt(bytes, claim.mimeType, input.description).catch(() => undefined);
    const now = new Date().toISOString();
    const receipt = {
      id: randomUUID(), serviceOrderId: ["warehouse", "office"].includes(claim.orderId) ? null : claim.orderId,
      uploadedByUserId: auth.user.id, uploadedByName: auth.user.name,
      description: input.description.trim() || digital?.merchant || "Comprovante enviado sem descricao", attachment: fieldAttachment(claim), digital, fileHash,
      extraction: { status: digital ? "READY" as const : "FAILED" as const, attempts: 1, attemptedAt: now },
      sourceMessageId: source, status: "PENDING_REVIEW" as const, createdAt: now, updatedAt: now,
    };
    db.fieldReceipts.push(receipt);
    if (receipt.serviceOrderId) {
      db.financialDocuments.push({
        id: receipt.id, serviceOrderId: receipt.serviceOrderId,
        description: receipt.description || "Comprovante aguardando descrição",
        direction: "ARCHIVE", userId: auth.user.id, messageId: source,
        attachment: receipt.attachment, createdAt: now,
      });
    }
    appendFieldEntry({
      user: auth.user, orderId: claim.orderId, nonce: input.nonce,
      title: "Comprovante encaminhado ao financeiro",
      content: "Documento arquivado no financeiro, pendente de conferência. Protocolo " + receipt.id + ". Não foi criado gasto nem recebimento automaticamente.",
    });
    recordAuditLog({
      userId: auth.user.id, action: "FIELD_RECEIPT_SUBMITTED", entity: "FieldReceipt",
      entityId: receipt.id, newValueJson: {
        serviceOrderId: receipt.serviceOrderId, uploadedByUserId: receipt.uploadedByUserId,
        fileName: receipt.attachment.fileName, status: receipt.status,
      },
    });
    return Response.json({ receipt: { id: receipt.id, status: receipt.status, description: receipt.description }, message: "Comprovante salvo no financeiro para conferência." });
  } catch (error) {
    return Response.json({ message: error instanceof FieldError ? error.message : "Falha ao registrar comprovante." }, { status: 400 });
  }
});
