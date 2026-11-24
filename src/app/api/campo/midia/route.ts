import { z } from "zod";
import { requireApiUser } from "@/lib/api-handlers";
import { withDatabase } from "@/lib/with-database";
import { FieldError, appendFieldEntry, fieldOrders } from "@/lib/field-assistant";
import { describeFieldVisual, parseFrameData } from "@/lib/field-ai";
import { fieldAttachment, readFieldImage, verifyUploadedMedia, verifyUploadTicket } from "@/lib/field-storage";
import { consumeRateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/store";

const schema = z.object({
  ticket: z.string().min(20).max(3000),
  nonce: z.string().regex(/^[a-zA-Z0-9_-]{12,100}$/),
  caption: z.string().max(1800).default(""),
  frames: z.array(z.string()).max(3).default([]),
});
export const maxDuration = 95;
export const POST = withDatabase(async (request) => {
  const auth = await requireApiUser(request); if (auth.response) return auth.response;
  const input = schema.parse(await request.json());
  const retry = await consumeRateLimit("field-analyze", auth.user.id, 70, 60 * 60_000);
  if (retry) return Response.json({ message: "Muitos anexos. Tente novamente mais tarde." }, { status: 429 });
  try {
    const claim = verifyUploadTicket(input.ticket);
    if (claim.userId !== auth.user.id || claim.sessionVersion !== (auth.user.sessionVersion ?? 0) || !fieldOrders(auth.user).some((o) => o.id === claim.orderId))
      throw new FieldError("Anexo não pertence à sua conta ou obra.");
    const previous = db.workHistory.find((entry) => entry.messageId === `campo:${auth.user.id}:${input.nonce}`);
    if (previous) return Response.json({ entry: previous });
    await verifyUploadedMedia(claim);
    let analysis = ""; let analysisFailed = false;
    try {
      const images = claim.type === "image"
        ? [{ bytes: await readFieldImage(claim.path), mediaType: claim.mimeType }]
        : parseFrameData(input.frames);
      if (images.length) analysis = await describeFieldVisual({ kind: claim.type, images, caption: input.caption });
      else analysisFailed = true;
    } catch { analysisFailed = true; }
    const content = [
      input.caption.trim() ? `Relato do colaborador: ${input.caption.trim()}` : "",
      analysis ? `Descrição visual por IA: ${analysis}` : "",
      analysisFailed ? "Análise visual automática indisponível; anexo original preservado." : "",
      claim.type === "video" ? "Vídeo anexado. A descrição visual usa quadros amostrados; a fala só será transcrita quando a extração do áudio for compatível." : "",
    ].filter(Boolean).join("\n\n") || "Arquivo enviado para a obra.";
    const entry = appendFieldEntry({
      user: auth.user, orderId: claim.orderId, nonce: input.nonce,
      title: claim.type === "image" ? "Foto da obra" : "Vídeo da obra",
      content, transcript: input.caption.trim(), attachment: fieldAttachment(claim),
    });
    return Response.json({ entry, analysisFailed });
  } catch (e) { return Response.json({ message: e instanceof FieldError ? e.message : "Falha ao arquivar mídia." }, { status: 400 }); }
});
