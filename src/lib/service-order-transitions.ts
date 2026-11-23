import type { ServiceMaterialRequest, ServiceOrder, ServiceOrderChecklistItem, ServiceOrderChecklistPhoto, ServiceOrderEquipment, ServiceOrderMaterial, ServiceOrderStatus } from "./types";
import { terminalEquipmentStatuses, terminalMaterialStatuses } from "./inventory-operations";

export type ServiceOrderTransitionContext = {
  serviceOrderChecklistItems: ServiceOrderChecklistItem[];
  serviceOrderChecklistPhotos: ServiceOrderChecklistPhoto[];
  serviceOrderMaterials: ServiceOrderMaterial[];
  serviceOrderEquipment: ServiceOrderEquipment[];
  materialRequests: ServiceMaterialRequest[];
};
export const serviceOrderTransitions: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
  SCHEDULED: ["PREPARING", "IN_PROGRESS", "CANCELED"],
  PREPARING: ["IN_PROGRESS", "CANCELED"],
  IN_PROGRESS: ["PAUSED", "WAITING_CUSTOMER", "DONE", "CANCELED"],
  PAUSED: ["IN_PROGRESS", "WAITING_CUSTOMER", "CANCELED"],
  WAITING_CUSTOMER: ["IN_PROGRESS", "DONE", "CANCELED"],
  DONE: ["DELIVERED", "IN_PROGRESS"],
  DELIVERED: [], CANCELED: [],
};

export function getServiceOrderTransitionError(order: ServiceOrder, next: ServiceOrderStatus, context: ServiceOrderTransitionContext, options: { customerAcceptance?: boolean } = {}): string | null {
  if (next === order.status) return null;
  if (!serviceOrderTransitions[order.status]?.includes(next)) return "Transicao de status invalida para a situacao atual da OS.";
  if (["DONE", "DELIVERED"].includes(next)) {
    const required = context.serviceOrderChecklistItems.filter((item) => item.serviceOrderId === order.id && item.isRequired);
    if (required.some((item) => item.status !== "DONE" || !item.validatedAt || !item.validatedByUserId)) return "Conclua e valide todos os itens obrigatorios do checklist antes de encerrar.";
    if (required.some((item) => {
      const count = context.serviceOrderChecklistPhotos.filter((photo) => photo.checklistItemId === item.id && photo.serviceOrderId === order.id).length;
      return count < Math.max(item.requiresPhoto ? 1 : 0, item.minimumPhotos);
    })) return "Faltam evidencias fotograficas obrigatorias no checklist.";
    if (order.tasks.some((task) => !task.done)) return "Conclua as tarefas pendentes da OS antes de encerrar.";
  }
  if (["DONE", "DELIVERED", "CANCELED"].includes(next)) {
    if (context.serviceOrderMaterials.some((item) => item.serviceOrderId === order.id && !terminalMaterialStatuses.includes(item.status))) return "Concilie reservas, devolucoes e consumo de todos os materiais antes de encerrar.";
    if (context.serviceOrderEquipment.some((item) => item.serviceOrderId === order.id && !terminalEquipmentStatuses.includes(item.status))) return "Registre retorno, dano ou perda dos equipamentos antes de encerrar.";
    if (context.materialRequests.some((item) => item.serviceOrderId === order.id && !["DELIVERED", "REJECTED", "CANCELED"].includes(item.status))) return "Resolva as solicitacoes de materiais pendentes antes de encerrar.";
  }
  if (next === "DELIVERED" && !options.customerAcceptance && (!order.clientDeliverySignedAt || !order.clientDeliverySignatureUrl)) return "A entrega precisa do aceite assinado do cliente.";
  return null;
}
