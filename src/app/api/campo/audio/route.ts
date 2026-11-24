import { requireApiUser } from "@/lib/api-handlers";
import { withDatabase } from "@/lib/with-database";
import { FieldError, appendFieldEntry, fieldOrders } from "@/lib/field-assistant";
import { transcribeFieldAudio } from "@/lib/field-ai";
import { writeFieldAudio } from "@/lib/field-storage";
import { consumeRateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/store";

export const maxDuration = 90;
export const POST = withDatabase(async (request) => {
  const auth = await requireApiUser(request); if (auth.response) return auth.response;
  const retry = await consumeRateLimit("field-audio", auth.user.id, 180, 60 * 60_000);
  if (retry) return Response.json({ message: "Limite de trechos de áudio atingido." }, { status: 429 });
  const form = await request.formData();
  const orderId = String(form.get("orderId") || "");
  const nonce = String(form.get("nonce") || "");
  const file = form.get("audio");
  if (!fieldOrders(auth.user).some((o) => o.id === orderId)) return Response.json({ message: "Obra não autorizada." }, { status: 403 });
  if (!/^[a-zA-Z0-9_-]{12,100}$/.test(nonce) || !(file instanceof File)) return Response.json({ message: "Arquivo ou envio inválido." }, { status: 400 });
  const previous = db.workHistory.find((entry) => entry.messageId === `campo:${auth.user.id}:${nonce}`);
  if (previous) return Response.json({ entry: previous });
  const mime = file.type.split(";")[0].trim().toLowerCase();
  if (file.size > 3.6 * 1024 * 1024 || !["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg", "audio/wav", "audio/aac"].includes(mime))
    return Response.json({ message: "Trecho de áudio inválido ou muito grande." }, { status: 413 });
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const text = await transcribeFieldAudio(bytes, mime);
    const attachment = await writeFieldAudio(bytes, mime, file.name || "gravacao");
    return Response.json({ entry: appendFieldEntry({ user: auth.user, orderId, nonce, title: "Áudio transcrito", content: text, transcript: text, attachment }) });
  } catch (e) { return Response.json({ message: e instanceof FieldError ? e.message : "Falha ao transcrever ou salvar áudio." }, { status: 503 }); }
});
