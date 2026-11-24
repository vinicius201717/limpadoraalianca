import { requireApiUser } from "@/lib/api-handlers";
import { withDatabase } from "@/lib/with-database";
import { FieldError, appendFieldEntry, authorizeFieldContext } from "@/lib/field-assistant";
import { processFieldStatement } from "@/lib/field-automation";
import { transcribeFieldAudio } from "@/lib/field-ai";
import { writeFieldAudio } from "@/lib/field-storage";
import { consumeRateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/store";

export const maxDuration = 150;
export const POST = withDatabase(async (request) => {
  const auth = await requireApiUser(request); if (auth.response) return auth.response;
  const form = await request.formData();
  const orderId = String(form.get("orderId") || "");
  const nonce = String(form.get("nonce") || "");
  const sessionId = String(form.get("sessionId") || "");
  const file = form.get("audio");
  try { authorizeFieldContext(auth.user, orderId); }
  catch { return Response.json({ message: "Seu perfil não está designado a essa obra." }, { status: 403 }); }
  if (!/^[a-zA-Z0-9_-]{12,100}$/.test(nonce) || (sessionId && !/^[a-zA-Z0-9_-]{12,90}$/.test(sessionId)) || !(file instanceof File)) return Response.json({ message: "Gravação inválida." }, { status: 400 });
  const source = "campo:" + auth.user.id + ":" + nonce;
  const previous = [...db.workHistory, ...db.warehouseJournal, ...db.officeJournal].find((entry) => entry.messageId === source);
  if (previous) return Response.json({ entry: previous, operation: { status: "diary", message: "Trecho já salvo, sem duplicar." } });
  const retry = await consumeRateLimit("field-audio", auth.user.id, 180, 60 * 60_000);
  if (retry) return Response.json({ message: "Limite de trechos de áudio atingido." }, { status: 429 });
  const mime = file.type.split(";")[0].trim().toLowerCase();
  if (file.size > 3.6 * 1024 * 1024 || !["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg", "audio/wav", "audio/aac"].includes(mime))
    return Response.json({ message: "Trecho de áudio inválido ou acima do limite." }, { status: 413 });
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const attachment = await writeFieldAudio(bytes, mime, file.name || "gravacao");
    let text = "";
    try { text = await transcribeFieldAudio(bytes, mime); }
    catch {
      const entry = appendFieldEntry({ user: auth.user, orderId, nonce, title: "Áudio salvo, transcrição pendente",
        content: "Gravação original preservada. Não foi possível transcrever este trecho. Nenhum comando foi executado.",
        attachment, recordingSessionId: sessionId || undefined });
      return Response.json({ entry, operation: { status: "pending", message: "Áudio preservado, sem transcrição. Reenvie o trecho ou digite o relato." } });
    }
    if (sessionId) {
      const entry = appendFieldEntry({ user: auth.user, orderId, nonce, title: "Trecho de gravação transcrito",
        content: text, transcript: text, attachment, recordingSessionId: sessionId });
      return Response.json({ entry, operation: { status: "diary", message: "Trecho transcrito. O comando completo será processado quando a gravação terminar." } });
    }
    return Response.json(await processFieldStatement({ user: auth.user, orderId, nonce, text, attachment }));
  } catch (error) { return Response.json({ message: error instanceof FieldError ? error.message : "Não foi possível salvar o áudio." }, { status: 503 }); }
});
