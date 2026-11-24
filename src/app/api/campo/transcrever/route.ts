import { requireApiUser } from "@/lib/api-handlers";
import { withDatabase } from "@/lib/with-database";
import { fieldActor, FieldError } from "@/lib/field-assistant";
import { transcribeFieldAudio } from "@/lib/field-ai";
import { consumeRateLimit } from "@/lib/rate-limit";

export const maxDuration = 85;
export const POST = withDatabase(async (request) => {
  const auth = await requireApiUser(request); if (auth.response) return auth.response;
  try { fieldActor(auth.user); }
  catch { return Response.json({ message: "Seu perfil não pode ditar descrições." }, { status: 403 }); }
  const retry = await consumeRateLimit("field-dictation", auth.user.id, 90, 60 * 60_000);
  if (retry) return Response.json({ message: "Limite de ditados atingido." }, { status: 429 });
  const data = await request.formData();
  const file = data.get("audio");
  if (!(file instanceof File) || file.size > 3.6 * 1024 * 1024 ||
    !["audio/webm", "audio/mp4", "audio/wav", "audio/ogg", "audio/mpeg", "audio/aac"].includes(file.type.split(";")[0]))
    return Response.json({ message: "Áudio inválido para ditado." }, { status: 400 });
  try {
    const text = await transcribeFieldAudio(Buffer.from(await file.arrayBuffer()), file.type.split(";")[0]);
    return Response.json({ text });
  } catch (error) {
    return Response.json({ message: error instanceof FieldError ? error.message : "Falha ao transcrever descrição." }, { status: 503 });
  }
});
