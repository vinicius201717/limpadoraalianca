import { z } from "zod";
import { requireApiUser } from "@/lib/api-handlers";
import { withDatabase } from "@/lib/with-database";
import { canViewServiceOrderFinancials } from "@/lib/permissions";
import { db, recordAuditLog } from "@/lib/store";

const patchSchema = z.object({ id: z.string().uuid(), status: z.literal("REVIEWED") });
export const GET = withDatabase(async (request) => {
  const auth = await requireApiUser(request); if (auth.response) return auth.response;
  if (!canViewServiceOrderFinancials(auth.user)) return Response.json({ message: "Sem permissão financeira." }, { status: 403 });
  return Response.json({ receipts: db.fieldReceipts.map(({ attachment, ...receipt }) =>
    ({ ...receipt, fileName: attachment.fileName, mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
});
export const PATCH = withDatabase(async (request) => {
  const auth = await requireApiUser(request); if (auth.response) return auth.response;
  if (!canViewServiceOrderFinancials(auth.user)) return Response.json({ message: "Sem permissão financeira." }, { status: 403 });
  const input = patchSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ message: "Revisão inválida." }, { status: 400 });
  const receipt = db.fieldReceipts.find((item) => item.id === input.data.id);
  if (!receipt) return Response.json({ message: "Comprovante não encontrado." }, { status: 404 });
  if (receipt.status === "REVIEWED") return Response.json({ id: receipt.id, status: receipt.status });
  receipt.status = "REVIEWED";
  receipt.updatedAt = new Date().toISOString();
  recordAuditLog({ userId: auth.user.id, action: "FIELD_RECEIPT_REVIEWED", entity: "FieldReceipt", entityId: receipt.id });
  return Response.json({ id: receipt.id, status: receipt.status });
});
