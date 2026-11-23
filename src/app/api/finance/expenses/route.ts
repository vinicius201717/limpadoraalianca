import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { canViewServiceOrderFinancials } from "@/lib/permissions";
import { createServiceExpense, db, flushDatabasePersistence, sanitizeServiceOrderForRole } from "@/lib/store";

const expenseSchema = z.object({
  serviceOrderId: z.string().min(1),
  employeeId: z.string().min(1),
  category: z.enum(["GASOLINA", "ALMOCO", "MATERIAL_OU_PRODUTO", "OUTROS"]),
  amount: z.coerce.number().positive("Informe um valor maior que zero."),
  notes: z.string().optional().default(""),
});

async function GETHandler(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canViewServiceOrderFinancials(auth.user)) {
    return NextResponse.json({ message: "Perfil sem permissao para acessar gastos financeiros." }, { status: 403 });
  }

  return NextResponse.json({ expenses: db.serviceExpenses });
}

async function POSTHandler(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canViewServiceOrderFinancials(auth.user)) {
    return NextResponse.json({ message: "Perfil sem permissao para registrar gastos financeiros." }, { status: 403 });
  }

  const parsed = expenseSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados do gasto invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const result = createServiceExpense(parsed.data, auth.user);
  if (result.error === "ORDER_NOT_FOUND") return NextResponse.json({ message: "OS nao encontrada." }, { status: 404 });
  if (result.error === "EMPLOYEE_NOT_FOUND") return NextResponse.json({ message: "Colaborador nao encontrado." }, { status: 404 });
  if (result.error === "INVALID_AMOUNT") return NextResponse.json({ message: "Informe um valor maior que zero." }, { status: 400 });
  if (!result.expense || !result.serviceOrder) {
    return NextResponse.json({ message: "Nao foi possivel registrar o gasto." }, { status: 400 });
  }

  await flushDatabasePersistence();

  return NextResponse.json(
    {
      expense: result.expense,
      serviceOrder: sanitizeServiceOrderForRole(auth.user, result.serviceOrder),
    },
    { status: 201 },
  );
}

export const GET = withDatabase(GETHandler);
export const POST = withDatabase(POSTHandler);
