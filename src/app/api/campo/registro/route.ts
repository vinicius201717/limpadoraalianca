import { z } from "zod";
import { requireApiUser } from "@/lib/api-handlers";
import { withDatabase } from "@/lib/with-database";
import { FieldError } from "@/lib/field-assistant";
import { processFieldStatement } from "@/lib/field-automation";
import { consumeRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  orderId: z.string().min(1).max(160),
  nonce: z.string().regex(/^[a-zA-Z0-9_-]{12,100}$/),
  text: z.string().trim().min(1).max(12000),
});
export const maxDuration = 110;
export const POST = withDatabase(async (request) => {
  const auth = await requireApiUser(request); if (auth.response) return auth.response;
  const input = schema.parse(await request.json());
  const retry = await consumeRateLimit("field-text", auth.user.id, 180, 60 * 60_000);
  if (retry) return Response.json({ message: "Limite de relatos por hora atingido." }, { status: 429 });
  try { return Response.json(await processFieldStatement({ user: auth.user, orderId: input.orderId, nonce: input.nonce, text: input.text })); }
  catch (error) { return Response.json({ message: error instanceof FieldError ? error.message : "Não foi possível registrar o relato." }, { status: 403 }); }
});
