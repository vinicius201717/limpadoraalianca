import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { canViewCompanyFeedbacks } from "@/lib/permissions";
import { createCompanyFeedback, ensureDatabaseReady, flushDatabasePersistence, toAnonymousCompanyFeedback, toAnonymousCompanyFeedbacks } from "@/lib/store";

const companyFeedbackCategories = ["SUGESTAO", "RECLAMACAO", "ELOGIO", "MELHORIA", "SEGURANCA", "OUTROS"] as const;

const feedbackSchema = z.object({
  category: z.enum(companyFeedbackCategories).default("SUGESTAO"),
  message: z.string().trim().min(5, "Escreva pelo menos 5 caracteres.").max(1200, "Use ate 1200 caracteres."),
});

async function GETHandler(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canViewCompanyFeedbacks(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para ler feedbacks da empresa." }, { status: 403 });
  }

  await ensureDatabaseReady();
  return NextResponse.json({ feedbacks: toAnonymousCompanyFeedbacks() });
}

async function POSTHandler(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  await ensureDatabaseReady();
  const parsed = feedbackSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const feedback = createCompanyFeedback(parsed.data, auth.user);
  await flushDatabasePersistence();

  return NextResponse.json(
    {
      message: "Feedback enviado com sucesso.",
      feedback: toAnonymousCompanyFeedback(feedback),
    },
    { status: 201 },
  );
}

export const GET = withDatabase(GETHandler);
export const POST = withDatabase(POSTHandler);
