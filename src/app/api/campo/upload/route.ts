import { z } from "zod";
import { requireApiUser } from "@/lib/api-handlers";
import { withDatabase } from "@/lib/with-database";
import { FieldError, fieldOrders } from "@/lib/field-assistant";
import { createUploadTicket } from "@/lib/field-storage";
import { consumeRateLimit } from "@/lib/rate-limit";
const schema = z.object({ orderId: z.string().min(1).max(160), fileName: z.string().min(1).max(200), mimeType: z.string().min(1).max(80), sizeBytes: z.number().int().positive() });
export const POST = withDatabase(async (request) => {
  const auth = await requireApiUser(request); if (auth.response) return auth.response;
  const input = schema.parse(await request.json());
  if (!fieldOrders(auth.user).some((o) => o.id === input.orderId)) return Response.json({ message: "Obra não autorizada." }, { status: 403 });
  const retry = await consumeRateLimit("field-uploads", auth.user.id, 60, 60 * 60_000);
  if (retry) return Response.json({ message: "Limite de uploads atingido." }, { status: 429 });
  try { return Response.json(await createUploadTicket(auth.user.id, auth.user.sessionVersion ?? 0, input.orderId, input.mimeType, input.fileName, input.sizeBytes)); }
  catch (e) { return Response.json({ message: e instanceof FieldError ? e.message : "Não foi possível preparar o envio." }, { status: 400 }); }
});
