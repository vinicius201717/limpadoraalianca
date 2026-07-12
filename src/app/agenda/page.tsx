import { ScheduleView } from "@/components/ScheduleView";
import { getCurrentUser } from "@/lib/auth";
import { db, ensureDatabaseReady, getAccessibleServiceOrders } from "@/lib/store";
import type { ScheduleEvent, ServiceOrder, ServiceOrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

function scheduleStatusFromOrder(status: ServiceOrderStatus): ScheduleEvent["status"] {
  if (status === "IN_PROGRESS") return "IN_PROGRESS";
  if (status === "DONE" || status === "DELIVERED") return "DONE";
  if (status === "CANCELED") return "CANCELED";
  return "SCHEDULED";
}

function serviceOrderEvent(order: ServiceOrder): ScheduleEvent {
  return {
    id: `schedule-os-${order.id}`,
    title: order.title,
    description: `${order.customerName} - ${order.address}`,
    type: "SERVICE_ORDER",
    serviceOrderId: order.id,
    startsAt: order.scheduledStart,
    endsAt: order.scheduledEnd,
    status: scheduleStatusFromOrder(order.status),
    priority: order.status === "PAUSED" || order.status === "WAITING_CUSTOMER" ? "HIGH" : "NORMAL",
    createdAt: order.scheduledStart,
    updatedAt: order.scheduledStart,
  };
}

function buildScheduleEvents(serviceOrders: ServiceOrder[], includeInspections: boolean) {
  const visibleOrderIds = new Set(serviceOrders.map((order) => order.id));
  const savedEvents = db.scheduleEvents.filter((event) => !event.serviceOrderId || visibleOrderIds.has(event.serviceOrderId));
  const savedServiceEventOrderIds = new Set(
    savedEvents.filter((event) => event.type === "SERVICE_ORDER" && event.serviceOrderId).map((event) => event.serviceOrderId),
  );
  const orderEvents = serviceOrders
    .filter((order) => !savedServiceEventOrderIds.has(order.id))
    .map(serviceOrderEvent);

  const inspectionEvents: ScheduleEvent[] = includeInspections
    ? db.inspections.map((inspection) => ({
        id: `schedule-inspection-${inspection.id}`,
        title: `Vistoria - ${inspection.customerName}`,
        description: `${inspection.serviceType} em ${inspection.surfaceType}`,
        type: "INSPECTION",
        inspectionId: inspection.id,
        startsAt: inspection.inspectionDate,
        endsAt: inspection.inspectionDate,
        status: "SCHEDULED",
        priority: inspection.technicalRisk === "HIGH" ? "HIGH" : "NORMAL",
        createdAt: inspection.inspectionDate,
        updatedAt: inspection.inspectionDate,
      }))
    : [];

  const materialEvents: ScheduleEvent[] = db.serviceOrderMaterials
    .filter((item) => visibleOrderIds.has(item.serviceOrderId) && (item.status === "PENDING_SEPARATION" || item.status === "SEPARATING"))
    .map((item) => {
      const order = serviceOrders.find((candidate) => candidate.id === item.serviceOrderId);
      const material = db.materials.find((candidate) => candidate.id === item.materialId);
      return {
        id: `schedule-material-${item.id}`,
        title: `Separar material - ${material?.name ?? "Material"}`,
        description: order ? `OS ${order.title}` : "Separacao de material",
        type: "MATERIAL_PREPARATION",
        serviceOrderId: item.serviceOrderId,
        startsAt: order?.scheduledStart ?? item.createdAt,
        endsAt: order?.scheduledStart ?? item.createdAt,
        status: item.status === "SEPARATING" ? "IN_PROGRESS" : "SCHEDULED",
        priority: "NORMAL",
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });

  const equipmentEvents: ScheduleEvent[] = db.serviceOrderEquipment
    .filter((item) => visibleOrderIds.has(item.serviceOrderId) && ["DELIVERED", "IN_USE"].includes(item.status))
    .map((item) => {
      const order = serviceOrders.find((candidate) => candidate.id === item.serviceOrderId);
      const equipment = db.equipment.find((candidate) => candidate.id === item.equipmentId);
      return {
        id: `schedule-equipment-${item.id}`,
        title: `Devolucao de equipamento - ${equipment?.name ?? "Equipamento"}`,
        description: order ? `OS ${order.title}` : "Devolucao de equipamento",
        type: "EQUIPMENT_RETURN",
        serviceOrderId: item.serviceOrderId,
        startsAt: order?.scheduledEnd ?? item.updatedAt,
        endsAt: order?.scheduledEnd ?? item.updatedAt,
        status: "SCHEDULED",
        priority: "NORMAL",
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });

  return [...savedEvents, ...orderEvents, ...inspectionEvents, ...materialEvents, ...equipmentEvents].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
}

export default async function AgendaPage() {
  await ensureDatabaseReady();
  const user = await getCurrentUser();
  const serviceOrders = user ? getAccessibleServiceOrders(user) : [];
  const includeInspections = Boolean(user && ["OWNER", "GERENTE", "COMERCIAL", "TECNICO"].includes(user.role));

  return (
    <ScheduleView
      employees={db.employees}
      scheduleEvents={buildScheduleEvents(serviceOrders, includeInspections)}
      serviceOrderChecklistItems={db.serviceOrderChecklistItems}
      serviceOrderMaterials={db.serviceOrderMaterials}
      serviceOrders={serviceOrders}
      referenceTime={new Date().toISOString()}
    />
  );
}
