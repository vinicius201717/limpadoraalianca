import type { NextRequest } from "next/server";
import { secureEquals } from "@/lib/whatsapp-provider";
import { drainWhatsAppQueue } from "@/lib/whatsapp-worker";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: NextRequest) {
  if (!secureEquals(request.headers.get("authorization") ?? "", process.env.WHATSAPP_WORKER_SECRET ? `Bearer ${process.env.WHATSAPP_WORKER_SECRET}` : "")) return Response.json({ message: "Não autorizado." }, { status: 401 });
  try { return Response.json(await drainWhatsAppQueue(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ message: "Processamento indisponível." }, { status: 503 }); }
}
