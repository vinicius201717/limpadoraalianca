import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api-handlers";
import { canAccessAllServiceOrders } from "@/lib/permissions";
import { createChecklistItem, db, getAccessibleServiceOrders, recordAuditLog, sanitizeServiceOrderForRole } from "@/lib/store";

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
  serviceType: z.string().optional(),
  description: z.string().optional().default(""),
  address: z.string(),
  scheduledStart: z.string(),
  scheduledEnd: z.string(),
  status: z.enum(["SCHEDULED", "PREPARING", "IN_PROGRESS", "PAUSED", "WAITING_CUSTOMER", "DONE", "DELIVERED", "CANCELED"]).optional(),
  supervisorEmployeeId: z.string().optional(),
  internalNotes: z.string().optional().default(""),
  clientNotes: z.string().optional().default(""),
  employeeIds: z.array(z.string()).optional().default([]),
  revenue: z.coerce.number().optional().default(0),
  expenses: z.coerce.number().optional().default(0),
  checklistItems: z.array(checklistInputSchema).optional().default([]),
});

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  return NextResponse.json({ serviceOrders: getAccessibleServiceOrders(auth.user) });
}

export async function POST(request: NextRequest) {
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
  const existingCustomer = data.customerId ? db.customers.find((customer) => customer.id === data.customerId) : undefined;
  const customerId = existingCustomer?.id ?? data.customerId ?? `customer-${Date.now()}`;
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
      totalValue: data.revenue,
      lastService: data.title,
    });
  }

  const supervisor = data.supervisorEmployeeId
    ? db.employees.find((employee) => employee.id === data.supervisorEmployeeId)
    : undefined;
  const supervisorUser = supervisor?.userId ? db.users.find((user) => user.id === supervisor.userId) : undefined;
  if (data.supervisorEmployeeId && (!supervisor || supervisor.status !== "ACTIVE" || supervisorUser?.role !== "SUPERVISOR_OBRA" || !supervisorUser.isActive)) {
    return NextResponse.json({ message: "Supervisor precisa ser colaborador ativo com acesso SUPERVISOR_OBRA." }, { status: 400 });
  }

  const assignedAt = supervisor ? new Date().toISOString() : undefined;
  const serviceOrder = {
    id: `os-${Date.now()}`,
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
    assignedByUserId: supervisor ? auth.user.id : undefined,
    assignedAt,
    assignedSupervisorByUserId: supervisor ? auth.user.id : undefined,
    supervisorAssignedAt: assignedAt,
    supervisorEmployeeId: supervisor?.id,
    supervisorUserId: supervisor?.userId,
    internalNotes: data.internalNotes,
    clientNotes: data.clientNotes,
    employeeIds: data.employeeIds,
    tasks: [],
    revenue: data.revenue,
    expenses: data.expenses,
  };

  db.serviceOrders.unshift(serviceOrder);
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

  return NextResponse.json({ serviceOrder: sanitizeServiceOrderForRole(auth.user.role, serviceOrder), checklistItems }, { status: 201 });
}
