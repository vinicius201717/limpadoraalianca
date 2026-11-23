import { withDatabase } from "@/lib/with-database";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { dateTime, serviceTypes } from "@/lib/commercial-schema";

import { requireApiUser } from "@/lib/api-handlers";
import { canAccessAllServiceOrders, canViewServiceOrderFinancials } from "@/lib/permissions";
import { createChecklistItem, createClientAccessCode, db, findEmployeeActiveServiceOrderConflict, flushDatabasePersistence, getAccessibleServiceOrders, recordAuditLog, sanitizeServiceOrderForRole } from "@/lib/store";
import type { ServiceOrderEmployee } from "@/lib/types";

const checklistInputSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional().default(""),
  isRequired: z.boolean().optional().default(true),
  isPriority: z.boolean().optional().default(false),
  requiresPhoto: z.boolean().optional().default(false),
  minimumPhotos: z.coerce.number().int().min(0).max(20).optional(),
  allowCollaboratorAction: z.boolean().optional().default(false),
});

const serviceOrderSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().min(2),
  customerPhone: z.string().optional().default(""),
  customerEmail: z.string().email().optional().or(z.literal("")).default(""),
  quoteId: z.string().optional().default(""),
  title: z.string().min(3),
  serviceType: z.enum(serviceTypes).optional(),
  description: z.string().optional().default(""),
  address: z.string(),
  scheduledStart: dateTime,
  scheduledEnd: dateTime,
  status: z.enum(["SCHEDULED", "PREPARING"]).optional(),
  supervisorEmployeeId: z.string().optional(),
  internalNotes: z.string().optional().default(""),
  clientNotes: z.string().optional().default(""),
  employeeIds: z.array(z.string()).optional().default([]),
  revenue: z.coerce.number().finite().min(0).max(1_000_000_000).optional().default(0),
  expenses: z.coerce.number().finite().min(0).max(1_000_000_000).optional().default(0),
  checklistItems: z.array(checklistInputSchema).optional().default([]),
});

async function GETHandler(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  return NextResponse.json({ serviceOrders: getAccessibleServiceOrders(auth.user) });
}

async function POSTHandler(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  if (!canAccessAllServiceOrders(auth.user.role)) {
    return NextResponse.json({ message: "Perfil sem permissao para criar ordens de servico." }, { status: 403 });
  }

  const parsed = serviceOrderSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados invalidos.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  if (Date.parse(data.scheduledEnd) <= Date.parse(data.scheduledStart)) return NextResponse.json({ message: "O fim precisa ser posterior ao início." }, { status: 400 });
  if (data.quoteId && !db.quotes.some((quote) => quote.id === data.quoteId && quote.customerId === data.customerId)) return NextResponse.json({ message: "Proposta inválida para o cliente." }, { status: 400 });
  const canSetFinancialValues = canViewServiceOrderFinancials(auth.user);
  const revenue = canSetFinancialValues ? data.revenue : 0;
  const expenses = canSetFinancialValues ? data.expenses : 0;
  const existingCustomer = data.customerId ? db.customers.find((customer) => customer.id === data.customerId) : undefined;
  if (data.customerId && !existingCustomer) return NextResponse.json({ message: "Cliente não encontrado." }, { status: 404 });
  const customerId = existingCustomer?.id ?? `customer-${randomUUID()}`;

  const supervisor = data.supervisorEmployeeId
    ? db.employees.find((employee) => employee.id === data.supervisorEmployeeId)
    : undefined;
  const supervisorUser = supervisor?.userId ? db.users.find((user) => user.id === supervisor.userId) : undefined;
  if (data.supervisorEmployeeId && (!supervisor || supervisor.status !== "ACTIVE" || supervisorUser?.role !== "SUPERVISOR_OBRA" || !supervisorUser.isActive)) {
    return NextResponse.json({ message: "Supervisor precisa ser colaborador ativo com acesso SUPERVISOR_OBRA." }, { status: 400 });
  }

  const requestedEmployeeIds = Array.from(
    new Set([...(data.employeeIds ?? []), ...(supervisor?.id ? [supervisor.id] : [])].filter((employeeId): employeeId is string => Boolean(employeeId))),
  );
  const missingEmployeeId = requestedEmployeeIds.find((employeeId) => !db.employees.some((employee) => employee.id === employeeId));
  if (missingEmployeeId) {
    return NextResponse.json({ message: "Um dos colaboradores informados nao foi encontrado." }, { status: 400 });
  }
  const invalidEmployee = requestedEmployeeIds
    .map((employeeId) => db.employees.find((employee) => employee.id === employeeId))
    .find((employee) => employee && employee.status !== "ACTIVE");
  if (invalidEmployee) {
    return NextResponse.json({ message: `${invalidEmployee.name} precisa estar ativo para entrar na equipe.` }, { status: 400 });
  }

  const teamConflict = requestedEmployeeIds.reduce<{
    employee: NonNullable<(typeof db.employees)[number]>;
    conflict: NonNullable<ReturnType<typeof findEmployeeActiveServiceOrderConflict>>;
  } | null>((currentConflict, employeeId) => {
    if (currentConflict) return currentConflict;
    const employee = db.employees.find((item) => item.id === employeeId);
    const conflict = findEmployeeActiveServiceOrderConflict(employeeId, undefined, data);
    return employee && conflict ? { employee, conflict } : null;
  }, null);
  if (teamConflict) {
    return NextResponse.json(
      {
        message: `${teamConflict.employee.name} ja esta escalado em outra OS ativa: ${teamConflict.conflict.title}. Remova da outra equipe antes de adicionar aqui.`,
        conflict: { serviceOrderId: teamConflict.conflict.id, title: teamConflict.conflict.title },
      },
      { status: 409 },
    );
  }

  if (!existingCustomer) {
    db.customers.unshift({
      id: customerId,
      name: data.customerName,
      phone: data.customerPhone,
      email: data.customerEmail,
      document: "",
      type: "PERSON",
      source: "Cadastro manual",
      notes: "",
      totalValue: revenue,
      lastService: data.title,
    });
  }

  const assignedAt = supervisor ? new Date().toISOString() : undefined;
  const serviceOrder = {
    id: `os-${randomUUID()}`,
    customerId,
    customerName: existingCustomer?.name ?? data.customerName,
    quoteId: data.quoteId,
    title: data.title,
    serviceType: data.serviceType,
    description: data.description,
    address: data.address,
    scheduledStart: data.scheduledStart,
    scheduledEnd: data.scheduledEnd,
    status: data.status ?? "SCHEDULED",
    clientAccessCode: createClientAccessCode(),
    clientAccessEnabled: true,
    assignedByUserId: supervisor ? auth.user.id : undefined,
    assignedAt,
    assignedSupervisorByUserId: supervisor ? auth.user.id : undefined,
    supervisorAssignedAt: assignedAt,
    supervisorEmployeeId: supervisor?.id,
    supervisorUserId: supervisor?.userId,
    internalNotes: data.internalNotes,
    clientNotes: data.clientNotes,
    employeeIds: requestedEmployeeIds,
    tasks: [],
    revenue,
    expenses,
  };

  db.serviceOrders.unshift(serviceOrder);
  requestedEmployeeIds.forEach((employeeId, index) => {
    const now = new Date().toISOString();
    db.serviceOrderEmployees.unshift({
      id: `soe-${Date.now()}-${index}`,
      serviceOrderId: serviceOrder.id,
      employeeId,
      roleInService: employeeId === supervisor?.id ? "SUPERVISOR" : "OUTRO",
      assignedByUserId: auth.user.id,
      assignedAt: now,
      createdAt: now,
      updatedAt: now,
    } satisfies ServiceOrderEmployee);
  });
  const checklistItems = data.checklistItems
    .filter((item) => item.title.trim())
    .map((item, index) =>
      createChecklistItem(
        serviceOrder.id,
        {
          ...item,
          sortOrder: index + 1,
          minimumPhotos: item.minimumPhotos ?? (item.requiresPhoto ? 1 : 0),
        },
        auth.user,
      ),
    )
    .map((result) => result.item)
    .filter(Boolean);
  recordAuditLog({
    userId: auth.user.id,
    action: "CREATE_SERVICE_ORDER",
    entity: "ServiceOrder",
    entityId: serviceOrder.id,
    newValueJson: serviceOrder,
  });
  await flushDatabasePersistence();

  return NextResponse.json({ serviceOrder: sanitizeServiceOrderForRole(auth.user, serviceOrder), checklistItems }, { status: 201 });
}

export const GET = withDatabase(GETHandler);
export const POST = withDatabase(POSTHandler);
