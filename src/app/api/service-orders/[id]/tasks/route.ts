import { NextResponse, type NextRequest } from "next/server";

import { requireApiUser } from "@/lib/api-handlers";
import { canAccessAllServiceOrders } from "@/lib/permissions";
import { authorizeServiceOrderAccess, ServiceOrderAuthorizationError } from "@/lib/service-order-access";
import { db, queueDatabasePersist } from "@/lib/store";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  let order;
  try {
    order = authorizeServiceOrderAccess(auth.user, id, "read").order;
  } catch (error) {
    if (error instanceof ServiceOrderAuthorizationError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    throw error;
  }

  return NextResponse.json({ tasks: order.tasks });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  if (!canAccessAllServiceOrders(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para criar tarefas de OS." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const order = db.serviceOrders.find((item) => item.id === id);
  if (!order) return NextResponse.json({ message: "OS nao encontrada." }, { status: 404 });

  const task = { id: `task-${Date.now()}`, title: String(body.title ?? "Nova tarefa"), done: false };
  order.tasks.push(task);
  queueDatabasePersist();

  return NextResponse.json({ task }, { status: 201 });
}
