import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { canViewServiceOrderFinancials } from "@/lib/permissions";
import { roundMoney } from "@/lib/finance-operations";
import { createServiceExpense, db, flushDatabasePersistence, sanitizeServiceOrderForRole } from "@/lib/store";

const expenseSchema = z.object({
  serviceOrderId: z.string().min(1),
  employeeId: z.string().min(1),
  category: z.enum(["GASOLINA", "ALMOCO", "MATERIAL_OU_PRODUTO", "OUTROS"]),
  amount: z.coerce.number().finite().min(0.01).max(1e9),
  requestId: z.string().uuid().optional(),
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

  const previous = parsed.data.requestId ? db.serviceExpenses.find(e => e.requestId === parsed.data.requestId && e.createdByUserId === auth.user.id) : undefined;
  if (previous) {
    if (previous.serviceOrderId !== parsed.data.serviceOrderId || previous.employeeId !== parsed.data.employeeId || previous.amount !== roundMoney(parsed.data.amount) || previous.category !== parsed.data.category || previous.notes !== parsed.data.notes.trim()) return NextResponse.json({message:"Identificador de envio ja utilizado com outros dados."},{status:409});
    const order = db.serviceOrders.find(o=>o.id===previous.serviceOrderId);
    if (!order) return NextResponse.json({message:"Obra nao encontrada."},{status:404});
    return NextResponse.json({expense:previous,serviceOrder:sanitizeServiceOrderForRole(auth.user,order)});
  }
  const result = createServiceExpense(parsed.data, auth.user);
  if (result.error === "ORDER_NOT_FOUND") return NextResponse.json({ message: "OS nao encontrada." }, { status: 404 });
  if (result.error === "EMPLOYEE_NOT_FOUND") return NextResponse.json({ message: "Colaborador nao encontrado." }, { status: 404 });
  if (result.error === "INVALID_AMOUNT") return NextResponse.json({ message: "Informe um valor maior que zero." }, { status: 400 });
  if (!result.expense || !result.serviceOrder) {
    return NextResponse.json({ message: "Nao foi possivel registrar o gasto." }, { status: 400 });
  }

  result.expense.requestId = parsed.data.requestId;
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
