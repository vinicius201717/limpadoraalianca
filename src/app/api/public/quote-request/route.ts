import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createPublicQuoteLead, ensureDatabaseReady } from "@/lib/store";

const quoteRequestSchema = z.object({
  name: z.string().trim().max(120).optional().default(""),
  phone: z.string().trim().min(10).max(24),
  serviceType: z.string().trim().max(80).optional().default(""),
  message: z.string().trim().max(600).optional().default(""),
});

export async function POST(request: NextRequest) {
  await ensureDatabaseReady();

  const parsed = quoteRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Informe pelo menos um WhatsApp valido." }, { status: 400 });
  }

  const lead = createPublicQuoteLead(parsed.data);
  return NextResponse.json({ ok: true, leadId: lead.id }, { status: 201 });
}
