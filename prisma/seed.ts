import bcrypt from "bcryptjs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import {
  checklistTemplateItems,
  checklistTemplates,
  customers,
  employees,
  equipment,
  evaluations,
  inspections,
  leads,
  scheduleEvents,
  materials,
  quotes,
  serviceOrderChecklistEvents,
  serviceOrderChecklistItems,
  serviceOrderChecklistPhotos,
  serviceOrderEquipment,
  serviceOrderMaterials,
  serviceOrders,
  supervisorEvaluations,
  users,
} from "../src/lib/demo-data";
import {
  CustomerType,
  EmployeeStatus,
  LeadStatus,
  Prisma,
  PrismaClient,
  QuoteStatus,
  ServiceOrderStatus,
  ServiceType,
  SurfaceType,
  UserRole,
} from "../src/generated/prisma/client";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL ?? "");
const prisma = new PrismaClient({ adapter });

async function clearDatabase() {
  await prisma.appState.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.scheduleEvent.deleteMany();
  await prisma.serviceOrderChecklistEvent.deleteMany();
  await prisma.supervisorEvaluation.deleteMany();
  await prisma.employeeEvaluationItem.deleteMany();
  await prisma.employeeEvaluation.deleteMany();
  await prisma.serviceOrderChecklistPhoto.deleteMany();
  await prisma.serviceOrderChecklistItem.deleteMany();
  await prisma.checklistTemplateItem.deleteMany();
  await prisma.checklistTemplate.deleteMany();
  await prisma.serviceMaterialRequestItem.deleteMany();
  await prisma.serviceMaterialRequest.deleteMany();
  await prisma.serviceOrderMaterial.deleteMany();
  await prisma.serviceOrderEquipment.deleteMany();
  await prisma.serviceOrderEmployee.deleteMany();
  await prisma.serviceOrderPhoto.deleteMany();
  await prisma.serviceOrderTask.deleteMany();
  await prisma.materialStockMovement.deleteMany();
  await prisma.equipmentUsage.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.warranty.deleteMany();
  await prisma.serviceOrder.deleteMany();
  await prisma.quoteItem.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.inspectionPhoto.deleteMany();
  await prisma.inspection.deleteMany();
  await prisma.property.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.material.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await clearDatabase();

  const passwordHash = await bcrypt.hash("123456", 10);
  const customerIdByName = new Map(customers.map((customer) => [customer.name, customer.id]));

  await prisma.user.createMany({
    data: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      passwordHash,
      role: user.role as UserRole,
      isActive: user.isActive,
      lastLoginAt: undefined,
    })),
  });

  await prisma.customer.createMany({
    data: customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      document: customer.document,
      type: customer.type as CustomerType,
      source: customer.source,
      notes: customer.notes,
    })),
  });

  await prisma.lead.createMany({
    data: leads.map((lead) => ({
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      source: lead.source,
      status: lead.status as LeadStatus,
      estimatedValue: lead.estimatedValue,
      nextFollowUpAt: new Date(lead.nextFollowUpAt),
      notes: lead.notes,
    })),
  });

  await prisma.inspection.createMany({
    data: inspections.map((inspection) => ({
      id: inspection.id,
      customerId: customerIdByName.get(inspection.customerName) ?? "cus-aurora",
      surfaceType: inspection.surfaceType as SurfaceType,
      serviceType: inspection.serviceType as ServiceType,
      areaM2: inspection.areaM2,
      currentState: inspection.currentState,
      technicalRisk: inspection.technicalRisk,
      inspectionDate: new Date(inspection.inspectionDate),
    })),
  });

  await prisma.employee.createMany({
    data: employees.map((employee) => ({
      id: employee.id,
      userId: employee.userId,
      name: employee.name,
      phone: employee.phone,
      email: employee.email,
      document: employee.document,
      jobTitle: employee.jobTitle ?? employee.roleName,
      roleName: employee.roleName,
      specialty: employee.specialty,
      status: employee.status as EmployeeStatus,
      dailyCost: employee.dailyCost,
      hiredAt: new Date(employee.hiredAt),
      notes: employee.notes,
    })),
  });

  await prisma.quote.createMany({
    data: quotes.map((quote) => ({
      id: quote.id,
      customerId: customerIdByName.get(quote.customerName) ?? "cus-aurora",
      status: quote.status as QuoteStatus,
      validUntil: new Date(quote.validUntil),
      paymentTerms: quote.paymentTerms,
      subtotal: quote.subtotal,
      discount: quote.discount,
      total: quote.total,
    })),
  });

  for (const order of serviceOrders) {
    await prisma.serviceOrder.create({
      data: {
        id: order.id,
        customerId: order.customerId,
        quoteId: order.quoteId,
        title: order.title,
        description: order.description,
        address: order.address,
        scheduledStart: new Date(order.scheduledStart),
        scheduledEnd: new Date(order.scheduledEnd),
        status: order.status as ServiceOrderStatus,
        supervisorEmployeeId: order.supervisorEmployeeId,
        supervisorUserId: order.supervisorUserId,
        assignedByUserId: order.assignedByUserId,
        assignedAt: order.assignedAt ? new Date(order.assignedAt) : undefined,
        assignedSupervisorByUserId: order.assignedSupervisorByUserId ?? order.assignedByUserId,
        supervisorAssignedAt: order.supervisorAssignedAt
          ? new Date(order.supervisorAssignedAt)
          : order.assignedAt
            ? new Date(order.assignedAt)
            : undefined,
        internalNotes: order.internalNotes,
        clientNotes: order.clientNotes,
        employees: {
          create: order.employeeIds.map((employeeId) => ({
            employeeId,
            roleInService: employeeId === order.supervisorEmployeeId ? "SUPERVISOR" : "OUTRO",
            assignedByUserId: order.assignedByUserId,
          })),
        },
        tasks: {
          create: order.tasks.map((task) => ({
            id: task.id,
            title: task.title,
            isDone: task.done,
            doneAt: task.done ? new Date(order.scheduledEnd) : undefined,
          })),
        },
        photos: {
          create: [
            { stage: "Antes", url: `/demo/${order.id}-antes.jpg`, notes: "Registro de entrada da obra." },
            { stage: "Depois", url: `/demo/${order.id}-depois.jpg`, notes: "Registro de entrega e garantia." },
          ],
        },
        expenses: {
          create: [
            {
              category: "Materiais",
              description: "Insumos e consumiveis da OS",
              amount: Math.round(order.expenses * 0.38),
              paidAt: new Date(order.scheduledStart),
            },
            {
              category: "Equipe",
              description: "Custo estimado da equipe",
              amount: Math.round(order.expenses * 0.62),
              paidAt: new Date(order.scheduledEnd),
            },
          ],
        },
      },
    });
  }

  await prisma.employeeEvaluation.createMany({
    data: evaluations.map((evaluation) => ({
      id: evaluation.id,
      serviceOrderId: evaluation.serviceOrderId,
      employeeId: evaluation.employeeId,
      supervisorUserId: evaluation.supervisorUserId,
      punctualityScore: evaluation.punctualityScore,
      qualityScore: evaluation.qualityScore,
      productivityScore: evaluation.productivityScore,
      careScore: evaluation.careScore,
      teamworkScore: evaluation.teamworkScore,
      clientPostureScore: evaluation.clientPostureScore,
      checklistComplianceScore: evaluation.checklistComplianceScore,
      overallScore: evaluation.overallScore,
      positiveNotes: evaluation.positiveNotes,
      improvementNotes: evaluation.improvementNotes,
      seriousIssue: evaluation.seriousIssue,
      needsTraining: evaluation.needsTraining,
      createdAt: new Date(evaluation.createdAt),
    })),
  });

  await prisma.serviceOrderChecklistItem.createMany({
    data: serviceOrderChecklistItems.map((item) => ({
      id: item.id,
      serviceOrderId: item.serviceOrderId,
      title: item.title,
      description: item.description,
      sortOrder: item.sortOrder,
      status: item.status,
      isRequired: item.isRequired,
      requiresPhoto: item.requiresPhoto,
      minimumPhotos: item.minimumPhotos,
      assignedEmployeeId: item.assignedEmployeeId,
      assignedEmployeeIds: item.assignedEmployeeIds,
      completedByEmployeeId: item.completedByEmployeeId,
      startedByUserId: item.startedByUserId,
      completedByUserId: item.completedByUserId,
      validatedByUserId: item.validatedByUserId,
      startedAt: item.startedAt ? new Date(item.startedAt) : undefined,
      completedAt: item.completedAt ? new Date(item.completedAt) : undefined,
      validatedAt: item.validatedAt ? new Date(item.validatedAt) : undefined,
      completionNotes: item.completionNotes,
      problemDescription: item.problemDescription,
      blockedReason: item.blockedReason,
      notes: item.notes,
      createdByUserId: item.createdByUserId,
      plannedStartAt: item.plannedStartAt ? new Date(item.plannedStartAt) : undefined,
      dueAt: item.dueAt ? new Date(item.dueAt) : undefined,
      allowCollaboratorAction: item.allowCollaboratorAction ?? false,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
    })),
  });

  await prisma.serviceOrderChecklistPhoto.createMany({
    data: serviceOrderChecklistPhotos.map((photo) => ({
      id: photo.id,
      checklistItemId: photo.checklistItemId,
      serviceOrderId: photo.serviceOrderId,
      uploadedByUserId: photo.uploadedByUserId,
      employeeId: photo.employeeId,
      type: photo.type,
      url: photo.url,
      fileName: photo.fileName,
      mimeType: photo.mimeType,
      sizeBytes: photo.sizeBytes,
      caption: photo.caption,
      createdAt: new Date(photo.createdAt),
    })),
  });

  await prisma.serviceOrderChecklistEvent.createMany({
    data: serviceOrderChecklistEvents.map((event) => ({
      id: event.id,
      checklistItemId: event.checklistItemId,
      serviceOrderId: event.serviceOrderId,
      userId: event.userId,
      employeeId: event.employeeId,
      type: event.type,
      message: event.message,
      previousStatus: event.previousStatus,
      newStatus: event.newStatus,
      metadataJson: event.metadataJson === undefined ? undefined : (event.metadataJson as Prisma.InputJsonValue),
      createdAt: new Date(event.createdAt),
    })),
  });

  await prisma.checklistTemplate.createMany({
    data: checklistTemplates.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      serviceType: template.serviceType as ServiceType,
      isActive: template.isActive,
      createdByUserId: template.createdByUserId,
      createdAt: new Date(template.createdAt),
      updatedAt: new Date(template.updatedAt),
    })),
  });

  await prisma.checklistTemplateItem.createMany({
    data: checklistTemplateItems.map((item) => ({
      id: item.id,
      templateId: item.templateId,
      title: item.title,
      description: item.description,
      sortOrder: item.sortOrder,
      isRequired: item.isRequired,
      requiresPhoto: item.requiresPhoto,
      minimumPhotos: item.minimumPhotos,
    })),
  });

  await prisma.material.createMany({
    data: materials.map((material) => ({
      id: material.id,
      name: material.name,
      unit: material.unit,
      status: material.status ?? "AVAILABLE",
      currentStock: material.currentStock,
      minStock: material.minStock,
      unitCost: material.unitCost,
    })),
  });

  await prisma.equipment.createMany({
    data: equipment.map((item) => ({
      id: item.id,
      name: item.name,
      code: item.code,
      status: item.status,
      notes: item.notes,
    })),
  });

  await prisma.serviceOrderMaterial.createMany({
    data: serviceOrderMaterials.map((item) => ({
      id: item.id,
      serviceOrderId: item.serviceOrderId,
      materialId: item.materialId,
      plannedQuantity: item.plannedQuantity,
      separatedQuantity: item.separatedQuantity,
      deliveredQuantity: item.deliveredQuantity,
      returnedQuantity: item.returnedQuantity,
      consumedQuantity: item.consumedQuantity,
      damagedQuantity: item.damagedQuantity,
      lostQuantity: item.lostQuantity,
      status: item.status,
      notes: item.notes,
      preparedByUserId: item.preparedByUserId,
      deliveredByUserId: item.deliveredByUserId,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
    })),
  });

  await prisma.serviceOrderEquipment.createMany({
    data: serviceOrderEquipment.map((item) => ({
      id: item.id,
      serviceOrderId: item.serviceOrderId,
      equipmentId: item.equipmentId,
      status: item.status,
      reservedAt: new Date(item.reservedAt),
      deliveredAt: item.deliveredAt ? new Date(item.deliveredAt) : undefined,
      returnedAt: item.returnedAt ? new Date(item.returnedAt) : undefined,
      deliveredByUserId: item.deliveredByUserId,
      returnedByUserId: item.returnedByUserId,
      conditionBefore: item.conditionBefore,
      conditionAfter: item.conditionAfter,
      notes: item.notes,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
    })),
  });

  await prisma.supervisorEvaluation.createMany({
    data: supervisorEvaluations.map((item) => ({
      id: item.id,
      serviceOrderId: item.serviceOrderId,
      supervisorEmployeeId: item.supervisorEmployeeId,
      supervisorUserId: item.supervisorUserId,
      employeeId: item.employeeId,
      employeeUserId: item.employeeUserId,
      clarityScore: item.clarityScore,
      organizationScore: item.organizationScore,
      respectScore: item.respectScore,
      taskDistributionScore: item.taskDistributionScore,
      communicationScore: item.communicationScore,
      supportScore: item.supportScore,
      leadershipScore: item.leadershipScore,
      overallScore: item.overallScore,
      positiveNotes: item.positiveNotes,
      improvementNotes: item.improvementNotes,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
    })),
  });

  await prisma.scheduleEvent.createMany({
    data: scheduleEvents.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      type: event.type,
      serviceOrderId: event.serviceOrderId,
      inspectionId: event.inspectionId,
      assignedUserId: event.assignedUserId,
      assignedEmployeeId: event.assignedEmployeeId,
      startsAt: new Date(event.startsAt),
      endsAt: new Date(event.endsAt),
      status: event.status,
      priority: event.priority,
      createdAt: new Date(event.createdAt),
      updatedAt: new Date(event.updatedAt),
    })),
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
