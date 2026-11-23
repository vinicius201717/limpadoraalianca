import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api-handlers";
import { withDatabase } from "@/lib/with-database";
import { db, getAccessibleServiceOrders, recordAuditLog } from "@/lib/store";
import { actorForPhone, createLink, replyAccess } from "@/lib/whatsapp-operations";
import { canUseWhatsApp } from "@/lib/whatsapp-schema";
import { whatsappConfiguration } from "@/lib/whatsapp-provider";
import { consumeRateLimit } from "@/lib/rate-limit";

async function authenticate(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth;
  if (!canUseWhatsApp(auth.user.role)) return { response: Response.json({ message: "Perfil sem acesso ao assistente." }, { status: 403 }), user: null };
  return auth;
}
export const GET = withDatabase(async (request) => {
  const auth = await authenticate(request); if (auth.response) return auth.response;
  const user = auth.user!; const config = whatsappConfiguration();
  const link = db.whatsappLinks.find((entry) => entry.userId === user.id);
  const linked = Boolean(link?.phone && actorForPhone(link.phone)?.id === user.id);
  const scope = replyAccess(user);
  return Response.json({ ready: config.ready, missing: user.role === "OWNER" ? config.missing : [], linked, phone: linked ? link?.phone : null, linkedAt: linked ? link?.linkedAt : null, chatUrl: config.businessNumber ? `https://wa.me/${config.businessNumber}` : null,
    orders: getAccessibleServiceOrders(user).map(({ id, title }) => ({ id, title })),
    messages: db.whatsappMessages.filter((entry) => entry.userId === user.id).slice(-20).reverse().map(({ id, text, transcript, status, reply, replyAccess: access, createdAt, error, replySentAt, replyDeliveryStatus, replyErrorCodes }) => ({ id, text: transcript || text, status, reply: access === scope ? reply : undefined, createdAt, error, replySentAt, replyDeliveryStatus, replyErrorCodes })),
  });
});
export const POST = withDatabase(async (request) => {
  const auth = await authenticate(request); if (auth.response) return auth.response;
  if (!whatsappConfiguration().ready) return Response.json({ message: "O administrador precisa concluir a configuração da integração antes de vincular." }, { status: 503 });
  const retry = await consumeRateLimit("whatsapp-link", auth.user!.id, 10, 15 * 60_000);
  if (retry) return Response.json({ message: "Aguarde antes de gerar outro vínculo." }, { status: 429 });
  const result = createLink(auth.user!);
  return Response.json({ url: `https://wa.me/${whatsappConfiguration().businessNumber}?text=${encodeURIComponent(`VINCULAR ${result.token}`)}`, expiresAt: result.expiresAt });
});
export const DELETE = withDatabase(async (request) => {
  const auth = await authenticate(request); if (auth.response) return auth.response;
  db.whatsappLinks = db.whatsappLinks.filter((entry) => entry.userId !== auth.user!.id);
  for (const command of db.assistantCommands) if (command.userId === auth.user!.id && command.status === "PENDING") command.status = "CANCELED";
  recordAuditLog({ userId: auth.user!.id, action: "WHATSAPP_UNLINKED", entity: "User", entityId: auth.user!.id });
  return Response.json({ message: "WhatsApp desvinculado." });
});
