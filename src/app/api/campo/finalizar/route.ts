import { z } from "zod";
import { requireApiUser } from "@/lib/api-handlers";
import { withDatabase } from "@/lib/with-database";
import { authorizeFieldContext, FieldError } from "@/lib/field-assistant";
import { processFieldStatement } from "@/lib/field-automation";
import { diaryAction } from "@/lib/field-action-schema";
import { consumeRateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/store";
import { authorizeServiceOrderAccess } from "@/lib/service-order-access";
import { canViewServiceOrderFinancials } from "@/lib/permissions";

export const maxDuration = 110;
const schema = z.object({
  orderId: z.string().min(1).max(160),
  sessionId: z.string().regex(/^[a-zA-Z0-9_-]{12,90}$/),
});

/** Interpret the full recorded instruction only after every self-contained audio part was committed. */
export const POST = withDatabase(async (request) => {
  const auth = await requireApiUser(request); if (auth.response) return auth.response;
  const input = schema.parse(await request.json());
  const nonce = "sess_" + input.sessionId;
  const source = "campo:" + auth.user.id + ":" + nonce;
  const persisted = [...db.workHistory, ...db.warehouseJournal, ...db.officeJournal].find((entry) => entry.messageId === source);
  if (persisted) {
    try {
      if(persisted.serviceOrderId!==input.orderId || (persisted.kind==="FINANCIAL"&&!canViewServiceOrderFinancials(auth.user)))throw new FieldError("Sem acesso ao registro.");
      if(["office","warehouse"].includes(input.orderId))authorizeFieldContext(auth.user,input.orderId);
      else authorizeServiceOrderAccess(auth.user,input.orderId,"history");
    }catch{return Response.json({message:"Sem acesso à gravação."},{status:403});}
    return Response.json({ entry: persisted, operation: { status: "diary", message: persisted.assistantReply || "Gravação já consolidada, sem duplicar ações." } });
  }
  try { authorizeFieldContext(auth.user, input.orderId); }
  catch { return Response.json({ message: "A gravação não pertence à sua obra ativa." }, { status: 403 }); }
  const retry = await consumeRateLimit("field-finalize", auth.user.id, 45, 60 * 60_000);
  if (retry) return Response.json({ message: "Muitas gravações finalizadas nesta hora." }, { status: 429 });
  const entries = [...db.workHistory, ...db.warehouseJournal, ...db.officeJournal]
    .filter((entry) => entry.userId === auth.user.id && entry.serviceOrderId === input.orderId &&
      entry.recordingSessionId === input.sessionId &&
      entry.messageId.startsWith("campo:" + auth.user.id + ":"))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (!entries.length) return Response.json({ message: "Não há trechos desta gravação para consolidar." }, { status: 409 });
  const text = entries.filter((entry) => entry.transcript.trim()).map((entry) => entry.transcript.trim()).join(" ");
  if (!text.trim()) return Response.json({ operation: { status: "pending", message: "Áudio preservado, mas sem transcrição válida." } });
  const incomplete = entries.some((entry) => !entry.transcript.trim()) || entries.length > 30 || text.length > 12000;
  try {
    const result = await processFieldStatement({
      user: auth.user, orderId: input.orderId, nonce, text: text.slice(0, 12000),
      summaryOnly: true,
      modelOverride: incomplete ? {
        ...diaryAction(), action: "CLARIFY", confidence: "LOW",
        question: "Gravação longa ou com trecho não transcrito. O conteúdo foi preservado, mas nenhum comando foi executado. Repita o pedido em um áudio curto.",
      } : undefined,
    });
    if (result.entry.kind === "FINANCIAL") for (const entry of entries) entry.kind = "FINANCIAL";
    return Response.json(result);
  } catch (error) {
    return Response.json({ message: error instanceof FieldError ? error.message : "Falha ao consolidar gravação." }, { status: 503 });
  }
});
