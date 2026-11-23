import "server-only";
import { randomUUID } from "node:crypto";
import { actorForPhone, AssistantError, assistantContext, assistantTransaction, confirmCommand, consumeLink, proposeCommand, replyAccess, saveDiary, validateIntent } from "./whatsapp-operations";
import { db } from "./store";
import { interpretWhatsApp, transcribeWhatsAppAudio } from "./whatsapp-ai";
import { downloadWhatsAppMedia, readAssistantMedia, sendWhatsAppReply, storeAssistantMedia } from "./whatsapp-provider";
import { canManageWhatsAppFinance } from "./whatsapp-schema";
import { createWorkReport } from "./work-reports";
import { consumeRateLimit } from "./rate-limit";
import type { WhatsAppMessage } from "./whatsapp-types";

const leaseMs = 6 * 60_000;
function claimMessage() {
  const now = Date.now();
  for (const message of db.whatsappMessages) {
    if (message.status === "DONE" || message.status === "FAILED" || Date.parse(message.leaseUntil ?? "") > now || Date.parse(message.retryAt ?? "") > now) continue;
    // Serialize per sender, including delayed retries, so caption/audio pairs stay ordered.
    if (db.whatsappMessages.some((other) => other.from === message.from && other.id !== message.id && ["QUEUED", "PROCESSING"].includes(other.status) && (Date.parse(other.createdAt) < Date.parse(message.createdAt) || (other.createdAt === message.createdAt && db.whatsappMessages.indexOf(other) < db.whatsappMessages.indexOf(message))))) continue;
    if (message.attempts >= 4) { message.status = "FAILED"; message.reply = "Não consegui processar a mensagem após novas tentativas. Envie o pedido novamente."; continue; }
    message.status = "PROCESSING"; message.lease = randomUUID(); message.leaseUntil = new Date(now + leaseMs).toISOString(); message.attempts++;
    return structuredClone(message);
  }
  return null;
}
function currentMessage(claim: WhatsAppMessage) {
  const message = db.whatsappMessages.find((entry) => entry.id === claim.id);
  if (!message || message.lease !== claim.lease || message.status !== "PROCESSING") throw new Error("Message lease lost");
  return message;
}
function finish(claim: WhatsAppMessage, reply: string) {
  const message = currentMessage(claim); message.reply = reply; message.status = "DONE"; delete message.lease; delete message.leaseUntil; delete message.error;
  const actor = actorForPhone(message.from); if (actor) message.replyAccess = replyAccess(actor);
}
async function processMessage(claim: WhatsAppMessage) {
  const linkMatch = claim.type === "text" && /^vincular\s+([a-f0-9]{64})$/i.exec(claim.text.trim());
  if (linkMatch) {
    await assistantTransaction(() => {
      const message = currentMessage(claim);
      try { const user = consumeLink(claim.from, linkMatch[1]); message.userId = user.id; finish(claim, `WhatsApp vinculado a ${user.name}. Envie texto ou áudio com o nome da obra e o que deseja registrar. Para comprovantes, envie PDF ou foto e diga a obra e a finalidade. Alterações serão apresentadas para confirmar.`); }
      catch (error) { if (!(error instanceof AssistantError)) throw error; finish(claim, error.message); }
      message.text = "[Solicitação de vínculo]";
    });
    return;
  }
  const snapshot = await assistantTransaction(() => {
    const message = currentMessage(claim); const user = actorForPhone(claim.from);
    if (!user) { finish(claim, "Abra o sistema com sua conta e use Assistente WhatsApp para vincular este número."); return null; }
    message.userId = user.id;
    return { user: { id: user.id, version: user.sessionVersion ?? 0, role: user.role }, context: assistantContext(user), finance: canManageWhatsAppFinance(user), recent: db.whatsappMessages.filter((entry) => entry.id !== claim.id && entry.from === claim.from && entry.userId === user.id && entry.status === "DONE" && Date.parse(entry.createdAt) > Date.now() - 30 * 60_000 && entry.text !== "[Solicitação de vínculo]").slice(-6).map((entry) => entry.transcript || entry.text), previousAttachment: canManageWhatsAppFinance(user) ? db.whatsappMessages.filter((entry) => entry.from === claim.from && entry.userId === user.id && entry.attachment && !entry.attachment.mimeType.startsWith("audio/") && Date.parse(entry.createdAt) > Date.now() - 30 * 60_000 && !db.financialDocuments.some((document) => document.attachment.id === entry.attachment!.id)).at(-1)?.attachment : undefined };
  });
  if (!snapshot) return;
  const currentActor = () => {
    const user = actorForPhone(claim.from);
    if (!user || user.id !== snapshot.user.id || (user.sessionVersion ?? 0) !== snapshot.user.version || user.role !== snapshot.user.role || canManageWhatsAppFinance(user) !== snapshot.finance) throw new AssistantError("Sua conta ou vínculo mudou. Abra o assistente no sistema novamente.");
    return user;
  };
  const confirm = claim.type === "text" && /^(confirmar|cancelar)\s+([a-f0-9]{12})$/i.exec(claim.text.trim());
  if (confirm) {
    await assistantTransaction(() => { const user = currentActor(); finish(claim, confirmCommand(user, claim.from, confirm[2].toUpperCase(), confirm[1].toLowerCase() === "cancelar")); }); return;
  }
  if (!['text', 'audio', 'image', 'document'].includes(claim.type)) throw new AssistantError("Envie texto, áudio, imagem JPG/PNG ou documento PDF.");
  if (await consumeRateLimit("whatsapp-ai", snapshot.user.id, 60, 60 * 60_000)) throw new AssistantError("Você atingiu o limite de 60 solicitações por hora. Aguarde para enviar novos pedidos; confirmações continuam disponíveis.");
  let attachment = claim.attachment;
  let text = claim.transcript || claim.text;
  if (claim.mediaId) {
    if (claim.type !== "audio" && !snapshot.finance) throw new AssistantError("O envio de comprovantes está disponível para o financeiro e perfis com permissão financeira. Para o diário da obra, envie áudio ou texto.");
    let bytes: Buffer;
    if (attachment) bytes = await readAssistantMedia(attachment);
    else {
      const downloaded = await downloadWhatsAppMedia(claim); bytes = downloaded.bytes;
      attachment = await storeAssistantMedia(claim, bytes, downloaded.mime);
      await assistantTransaction(() => { currentActor(); currentMessage(claim).attachment = attachment; });
    }
    if (claim.type === "audio" && !claim.transcript) {
      text = await transcribeWhatsAppAudio(bytes);
      await assistantTransaction(() => { currentActor(); currentMessage(claim).transcript = text; });
    }
  }
  const receipt = attachment && !attachment.mimeType.startsWith("audio/") ? attachment : snapshot.previousAttachment;
  const receiptInput = receipt ? { bytes: await readAssistantMedia(receipt), mimeType: receipt.mimeType, fileName: receipt.fileName } : undefined;
  const intent = await interpretWhatsApp({ text, context: snapshot.context, recent: snapshot.recent, attachment: receiptInput });
  if (intent.action === "REPORT") {
    await assistantTransaction(() => { validateIntent(currentActor(), intent); });
    const report = await createWorkReport(snapshot.user.id, intent.serviceOrderId!);
    await assistantTransaction(() => { validateIntent(currentActor(), intent); finish(claim, report.content); }); return;
  }
  await assistantTransaction(() => {
    const user = currentActor();
    if (intent.action === "CLARIFY") { finish(claim, intent.question || "Informe o nome da obra e a ação desejada."); return; }
    if (intent.action === "DIARY") {
      const entry = saveDiary(user, intent, claim.id, text, attachment);
      const order = db.serviceOrders.find((item) => item.id === entry.serviceOrderId)!;
      finish(claim, `Salvo no histórico de ${order.title}.\n${entry.title}\n${entry.content.slice(0, 2800)}${entry.content.length > 2800 ? "\nRelato completo disponível no histórico da obra." : ""}`); return;
    }
    const command = proposeCommand(user, claim.from, intent, claim.id, text, intent.action === "FILE_RECEIPT" ? receipt : attachment);
    finish(claim, `Confira antes de registrar:\n${command.summary}\n\nResponda CONFIRMAR ${command.code} ou CANCELAR ${command.code}. Válido por 30 minutos.`);
  });
}
async function deliverReply() {
  const delivery = await assistantTransaction(() => {
    const message = db.whatsappMessages.find((entry) => ["DONE", "FAILED"].includes(entry.status) && entry.reply && !entry.replySentAt && (entry.deliveryAttempts ?? 0) < 5 && !(Date.parse(entry.leaseUntil ?? "") > Date.now()) && !(Date.parse(entry.retryAt ?? "") > Date.now()) && Number(entry.timestamp) * 1000 > Date.now() - 23 * 60 * 60_000);
    if (!message) return null;
    message.lease = randomUUID(); message.leaseUntil = new Date(Date.now() + 60_000).toISOString(); message.deliveryAttempts = (message.deliveryAttempts ?? 0) + 1;
    const actor = actorForPhone(message.from);
    // Do not deliver a stored report/confirmation after the account loses access.
    const reply = message.userId && (actor?.id !== message.userId || (message.replyAccess && (!actor || replyAccess(actor) !== message.replyAccess))) ? "Seu vínculo ou suas permissões mudaram. Confira sua conta no sistema." : message.reply!;
    message.replyTrackingId = message.lease;
    return { id: message.id, lease: message.lease, from: message.from, reply };
  });
  if (!delivery) return false;
  try {
    const replyMessageId = await sendWhatsAppReply(delivery.from, delivery.reply, delivery.lease);
    await assistantTransaction(() => { const message = db.whatsappMessages.find((entry) => entry.id === delivery.id); if (message?.lease === delivery.lease) { message.replySentAt ??= new Date().toISOString(); message.replyMessageId = replyMessageId; message.replyDeliveryStatus ??= "accepted"; delete message.lease; delete message.leaseUntil; if (message.error === "REPLY_DELIVERY_FAILED") delete message.error; } });
  } catch {
    await assistantTransaction(() => { const message = db.whatsappMessages.find((entry) => entry.id === delivery.id); if (message?.lease === delivery.lease) { message.error = "REPLY_DELIVERY_FAILED"; message.retryAt = new Date(Date.now() + 60_000).toISOString(); delete message.lease; delete message.leaseUntil; } });
  }
  return true;
}
export async function drainWhatsAppQueue(maxMessages = 3) {
  const started = Date.now(); let processed = 0;
  for (let index = 0; index < maxMessages && Date.now() - started < 180_000; index++) {
    await deliverReply();
    const claim = await assistantTransaction(claimMessage);
    if (!claim) break;
    try { await processMessage(claim); }
    catch (error) {
      await assistantTransaction(() => {
        const message = currentMessage(claim);
        if (error instanceof AssistantError) finish(claim, error.message);
        else {
          message.error = "PROCESSING_FAILED"; message.status = message.attempts >= 4 ? "FAILED" : "QUEUED";
          message.retryAt = new Date(Date.now() + 60_000 * message.attempts).toISOString(); delete message.lease; delete message.leaseUntil;
          if (message.status === "FAILED") message.reply = "Não foi possível concluir o processamento. Envie o pedido novamente ou consulte o assistente no sistema.";
        }
      });
    }
    processed++; await deliverReply();
  }
  return { processed };
}
