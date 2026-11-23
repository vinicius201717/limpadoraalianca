import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";

import { requireApiUser } from "@/lib/api-handlers";
import { canAccessAllServiceOrders } from "@/lib/permissions";
import { authorizeServiceOrderAccess, ServiceOrderAuthorizationError } from "@/lib/service-order-access";
import { db, recordAuditLog } from "@/lib/store";

const createSchema = z.object({ title: z.string().trim().min(2).max(300) }).strict();
const updateSchema = z.object({ taskId: z.string().min(1), done: z.boolean() }).strict();

async function GETHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

async function POSTHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  if (!canAccessAllServiceOrders(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para criar tarefas de OS." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = createSchema.parse(await request.json());
  const order = db.serviceOrders.find((item) => item.id === id);
  if (!order) return NextResponse.json({ message: "OS nao encontrada." }, { status: 404 });

  if (["DONE", "DELIVERED", "CANCELED"].includes(order.status)) return NextResponse.json({ message: "A OS esta encerrada." }, { status: 409 });
  const task = { id: `task-${randomUUID()}`, title: body.title, done: false };
  order.tasks.push(task);
  recordAuditLog({ userId: auth.user.id, action: "CREATE_SERVICE_TASK", entity: "ServiceOrder", entityId: id, newValueJson: task });

  return NextResponse.json({ task, tasks: order.tasks }, { status: 201 });
}

async function PATCHHandler(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  try {
    const { order } = authorizeServiceOrderAccess(auth.user, id, "read");
    if (!["OWNER", "GERENTE", "SUPERVISOR_OBRA"].includes(auth.user.role)) return NextResponse.json({ message: "Perfil sem permissao para alterar tarefas." }, { status: 403 });
    if (["DONE", "DELIVERED", "CANCELED"].includes(order.status)) return NextResponse.json({ message: "A OS esta encerrada. Reabra a execucao antes de alterar tarefas." }, { status: 409 });
    const { taskId, done } = updateSchema.parse(await request.json());
    const task = order.tasks.find((item) => item.id === taskId);
    if (!task) return NextResponse.json({ message: "Tarefa nao encontrada." }, { status: 404 });
    if (task.done !== done) {
      const previous = { ...task };
      task.done = done;
      recordAuditLog({ userId: auth.user.id, action: "UPDATE_SERVICE_TASK", entity: "ServiceOrder", entityId: id, oldValueJson: previous, newValueJson: task });
    }
    return NextResponse.json({ task, tasks: order.tasks });
  } catch (error) {
    if (error instanceof ServiceOrderAuthorizationError) return NextResponse.json({ message: error.message }, { status: error.status });
    throw error;
  }
}

export const GET = withDatabase(GETHandler);
export const POST = withDatabase(POSTHandler);
export const PATCH = withDatabase(PATCHHandler);
