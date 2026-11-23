import { after, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { assistantTransaction, enqueueWhatsAppMessages, recordWhatsAppDelivery } from "@/lib/whatsapp-operations";
import { boundedBytes, parseWhatsAppDeliveryUpdates, parseWhatsAppMessages, secureEquals, verifyWhatsAppSignature } from "@/lib/whatsapp-provider";
import { drainWhatsAppQueue } from "@/lib/whatsapp-worker";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  if (query.get("hub.mode") !== "subscribe" || !secureEquals(query.get("hub.verify_token") ?? "", process.env.WHATSAPP_VERIFY_TOKEN ?? "")) return new Response("Forbidden", { status: 403 });
  return new Response(query.get("hub.challenge") ?? "", { headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
}
export async function POST(request: NextRequest) {
  if (!process.env.WHATSAPP_APP_SECRET) return Response.json({ message: "Integração indisponível." }, { status: 503 });
  let raw: Buffer;
  try { raw = await boundedBytes(new Response(request.body, { headers: request.headers }), 1024 * 1024); }
  catch { return Response.json({ message: "Corpo inválido ou acima de 1 MB." }, { status: 413 }); }
  if (!verifyWhatsAppSignature(raw, request.headers.get("x-hub-signature-256"))) return Response.json({ message: "Assinatura inválida." }, { status: 401 });
  try {
    const payload: unknown = JSON.parse(raw.toString("utf8"));
    const messages = parseWhatsAppMessages(payload);
    const updates = parseWhatsAppDeliveryUpdates(payload);
    if (messages.length || updates.length) await assistantTransaction(() => { enqueueWhatsAppMessages(messages); recordWhatsAppDelivery(updates); });
    if (messages.length) {
      after(async () => { try { await drainWhatsAppQueue(); } catch { console.error("whatsapp_worker_unavailable"); } });
    }
    return Response.json({ received: true });
  } catch (error) {
    return Response.json({ message: "Não foi possível receber a mensagem." }, { status: error instanceof SyntaxError || error instanceof ZodError ? 400 : 503 });
  }
}
