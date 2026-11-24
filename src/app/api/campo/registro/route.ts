import { z } from "zod";
import { requireApiUser } from "@/lib/api-handlers";
import { withDatabase } from "@/lib/with-database";
import { appendFieldEntry, FieldError } from "@/lib/field-assistant";
import { consumeRateLimit } from "@/lib/rate-limit";

const schema = z.object({ orderId: z.string().min(1).max(160), nonce: z.string().regex(/^[a-zA-Z0-9_-]{12,100}$/), text: z.string().trim().min(1).max(12000) });
export const POST = withDatabase(async (request) => {
  const auth = await requireApiUser(request); if (auth.response) return auth.response;
  const retry = await consumeRateLimit("field-text", auth.user.id, 180, 60 * 60_000);
  if (retry) return Response.json({ message: "Muitas mensagens em pouco tempo." }, { status: 429 });
  const input = schema.parse(await request.json());
  try { return Response.json({ entry: appendFieldEntry({ user: auth.user, orderId: input.orderId, nonce: input.nonce, title: "Mensagem de campo", content: input.text, transcript: input.text }) }); }
  catch (e) { return Response.json({ message: e instanceof FieldError ? e.message : "Sem acesso à obra." }, { status: 403 }); }
});
