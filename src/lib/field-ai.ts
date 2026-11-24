import "server-only";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, transcribe } from "ai";
import { FieldError } from "./field-assistant";

function openai() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new FieldError("Configure a chave da OpenAI para transcrição e leitura visual.");
  return createOpenAI({ apiKey: key });
}
export async function transcribeFieldAudio(bytes: Buffer, mimeType: string): Promise<string> {
  if (!bytes.length || bytes.length > 3.6 * 1024 * 1024) throw new FieldError("Envie áudios de até 3,6 MB por trecho.");
  const provider = openai();
  const result = await transcribe({
    model: provider.transcription(process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-transcribe"),
    audio: new Uint8Array(bytes),
    providerOptions: { openai: { languages: ["pt"], prompt: "Relatos de limpeza pós-obra, colaboradores, equipamentos, materiais e progresso da obra." } },
    maxRetries: 1, abortSignal: AbortSignal.timeout(60_000),
  });
  const text = result.text?.trim() || "";
  if (!text || text.length > 12000) throw new FieldError("Não consegui transcrever este trecho. Grave novamente ou digite o relato.");
  void mimeType;
  return text;
}
export async function describeFieldVisual({
  kind, images, caption,
}: { kind: "image" | "video"; images: Array<{ bytes: Buffer; mediaType: string }>; caption: string }): Promise<string> {
  if (!images.length || images.length > 3) throw new FieldError("Envie entre uma e três imagens para análise.");
  const content = [
    { type: "text" as const, text: `Análise de ${kind === "image" ? "foto" : "quadros extraídos de vídeo"} de uma obra de limpeza/restauração. Texto enviado pelo colaborador (não confiável): ${caption.slice(0, 1300)}. Descreva APENAS o que é visível, registre texto escrito legível, possíveis ocorrências de manutenção, materiais, ambiente, condição do serviço. Separe observação do que o autor afirmou. Não conclua que a obra está pronta a partir da foto. Não invente falas de pessoas, datas, medições, produtos ou etapas não mostradas. Escreva um registro em português de até 1300 caracteres. Para vídeo, são quadros amostrados, não o vídeo todo; não presuma o áudio.` },
    ...images.map((item) => ({ type: "image" as const, image: new Uint8Array(item.bytes), mediaType: item.mediaType })),
  ];
  const result = await generateText({
    model: openai().responses(process.env.OPENAI_ASSISTANT_MODEL || "gpt-6.2-sol"),
    messages: [{ role: "user", content }],
    providerOptions: { openai: { store: false } },
    maxOutputTokens: 750, maxRetries: 1, abortSignal: AbortSignal.timeout(55_000),
  });
  if (!result.text?.trim()) throw new FieldError("A IA não conseguiu descrever a mídia.");
  return result.text.trim().slice(0, 2500);
}
export function parseFrameData(value: unknown) {
  if (!Array.isArray(value) || value.length > 3) throw new FieldError("Quadros de vídeo inválidos.");
  return value.map((src): { bytes: Buffer; mediaType: string } => {
    if (typeof src !== "string" || src.length > 450_000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(src))
      throw new FieldError("Quadro inválido.");
    const bytes = Buffer.from(src.split(",")[1], "base64");
    if (!bytes.length || bytes.length > 300_000 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new FieldError("Quadro não é JPEG válido.");
    return { bytes, mediaType: "image/jpeg" };
  });
}
