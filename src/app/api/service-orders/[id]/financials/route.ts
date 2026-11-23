import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { adjustExpenseTotal } from "@/lib/finance-operations";
import { requireApiUser } from "@/lib/api-handlers";
import { canViewServiceOrderFinancials } from "@/lib/permissions";
import { authorizeServiceOrderAccess, ServiceOrderAuthorizationError } from "@/lib/service-order-access";
import { db, flushDatabasePersistence, recordAuditLog, sanitizeServiceOrderForRole } from "@/lib/store";

const financialSchema = z.object({
  reason: z.string().trim().min(5).max(1000),
  revenue: z.coerce.number().finite().max(1e9).min(0, "Informe um total valido."),
  expenses: z.coerce.number().finite().max(1e9).min(0, "Informe um custo valido."),
});

function accessErrorResponse(error: ServiceOrderAuthorizationError) {
  return NextResponse.json({ message: error.message }, { status: error.status });
}

async function PATCHHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canViewServiceOrderFinancials(auth.user)) {
    return NextResponse.json({ message: "Perfil sem permissao para alterar valores financeiros da OS." }, { status: 403 });
  }

  const { id } = await context.params;
  let serviceOrder;
  try {
    serviceOrder = authorizeServiceOrderAccess(auth.user, id, "update").order;
  } catch (error) {
    if (error instanceof ServiceOrderAuthorizationError) return accessErrorResponse(error);
    throw error;
  }

  const parsed = financialSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados financeiros invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const revenue = Math.round(parsed.data.revenue * 100) / 100;
  const expenses = Math.round(parsed.data.expenses * 100) / 100;
  const oldValueJson = {
    revenue: serviceOrder.revenue,
    expenses: serviceOrder.expenses,
    profit: serviceOrder.revenue - serviceOrder.expenses,
  };

  const invoiced = db.servicePayments.filter((payment) => payment.serviceOrderId === id).reduce((sum, payment) => sum + payment.amount, 0);
  if (Math.round(invoiced * 100) > Math.round(revenue * 100)) return NextResponse.json({ message: "O total não pode ficar abaixo das parcelas registradas." }, { status: 409 });
  serviceOrder.revenue = revenue;
  adjustExpenseTotal(serviceOrder, db.serviceExpenses, expenses, parsed.data.reason, auth.user.id);

  recordAuditLog({
    userId: auth.user.id,
    action: "UPDATE_SERVICE_ORDER_FINANCIALS",
    entity: "ServiceOrder",
    entityId: serviceOrder.id,
    oldValueJson,
    newValueJson: {
      reason: parsed.data.reason,
      revenue: serviceOrder.revenue,
      expenses: serviceOrder.expenses,
      profit: serviceOrder.revenue - serviceOrder.expenses,
    },
  });
  await flushDatabasePersistence();

  return NextResponse.json({ serviceOrder: sanitizeServiceOrderForRole(auth.user, serviceOrder) });
}

export const PATCH = withDatabase(PATCHHandler);
