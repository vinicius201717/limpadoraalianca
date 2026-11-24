import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {isValidDeliverySignature} from "@/lib/delivery-signature";

import {
  confirmClientServiceDelivery,
  flushDatabasePersistence,
  normalizeClientAccessCode,
  ensureDatabaseReady,
} from "@/lib/store";

const maxSignatureLength = 600_000;

const deliverySchema = z.object({
  code: z.string().min(4).max(40),
  clientName: z.string().trim().min(2).max(120).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  feedback: z.string().trim().max(800).optional(),
  signatureDataUrl: z
    .string()
    .min(80)
    .max(maxSignatureLength)
    .refine((value) => /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value), "Assinatura invalida."),
});

function getClientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined
  );
}

async function POSTHandler(request: NextRequest) {
  await ensureDatabaseReady();

  const parsed = deliverySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados de entrega invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  if(!isValidDeliverySignature(parsed.data.signatureDataUrl))return NextResponse.json({message:"Assinatura inválida ou em branco. Assine novamente."},{status:400});
  const result = confirmClientServiceDelivery(normalizeClientAccessCode(parsed.data.code), {
    clientName: parsed.data.clientName,
    rating: parsed.data.rating,
    feedback: parsed.data.feedback,
    signatureDataUrl: parsed.data.signatureDataUrl,
    ipAddress: getClientIp(request),
  });

  if (result.error === "NOT_FOUND") {
    return NextResponse.json({ message: "Codigo nao encontrado ou acesso indisponivel." }, { status: 404 });
  }
  if (result.error === "INVALID_STATUS") return NextResponse.json({ message: "O serviço ainda não está pronto para aceite. Confira checklist, materiais e equipamentos com o responsável." }, { status: 409 });
  if (result.error === "ALREADY_SIGNED") {
    return NextResponse.json({ message: "Esta entrega ja foi confirmada pelo cliente." }, { status: 409 });
  }

  await flushDatabasePersistence();
  return NextResponse.json({
    ok: true,
    delivery: {
      signedAt: result.order?.clientDeliverySignedAt,
      signedBy: result.order?.clientDeliveryAcceptedBy,
      rating: result.order?.clientRating,
      feedback: result.order?.clientFeedback,
    },
  });
}

export const POST = withDatabase(POSTHandler);
