import type { Equipment, Material, ServiceMaterialRequest, ServiceMaterialRequestItem, ServiceOrderEquipment, ServiceOrderMaterial } from "./types";

export class InventoryError extends Error {}

export const terminalMaterialStatuses = ["RETURNED", "CONSUMED", "DAMAGED", "LOST", "CANCELED"];
export const terminalEquipmentStatuses = ["RETURNED", "DAMAGED", "LOST", "CANCELED"];
export function isArchivedStockItem(item: Material | Equipment) {
  return Boolean((item as (Material | Equipment) & { archivedAt?: string }).archivedAt);
}

const materialTransitions: Record<ServiceOrderMaterial["status"], ServiceOrderMaterial["status"][]> = {
  PENDING_SEPARATION: ["SEPARATING", "RESERVED", "SEPARATED", "CANCELED"],
  SEPARATING: ["RESERVED", "SEPARATED", "CANCELED"],
  RESERVED: ["SEPARATED", "DELIVERED_TO_TEAM", "CANCELED"],
  SEPARATED: ["RESERVED", "DELIVERED_TO_TEAM", "CANCELED"],
  DELIVERED_TO_TEAM: ["PARTIALLY_RETURNED", "RETURNED", "CONSUMED", "DAMAGED", "LOST"],
  PARTIALLY_RETURNED: ["RETURNED", "CONSUMED", "DAMAGED", "LOST"],
  RETURNED: [], CONSUMED: [], DAMAGED: [], LOST: [], CANCELED: [],
};
const quantities = ["plannedQuantity", "separatedQuantity", "deliveredQuantity", "returnedQuantity", "consumedQuantity", "damagedQuantity", "lostQuantity"] as const;
export type MaterialPatch = Partial<Pick<ServiceOrderMaterial, typeof quantities[number] | "status" | "notes">>;
const roundQuantity = (value: number) => Math.round(value * 1e6) / 1e6;

/** Validate the complete next state before touching either stock or its allocation. */
export function applyMaterialMovement(stock: Material, allocation: ServiceOrderMaterial, input: MaterialPatch, actorId: string, now = new Date().toISOString()) {
  const status = input.status ?? allocation.status;
  if (status !== allocation.status && !materialTransitions[allocation.status]?.includes(status)) {
    throw new InventoryError("Transicao de material invalida. Confira entrega e retorno antes de encerrar.");
  }
  if (terminalMaterialStatuses.includes(allocation.status)) {
    if (Object.entries(input).some(([key, value]) => value !== undefined && allocation[key as keyof ServiceOrderMaterial] !== value)) {
      throw new InventoryError("Movimento encerrado. O historico nao pode ser reaberto ou alterado.");
    }
    return allocation;
  }
  const next = { ...allocation, ...input, status, updatedAt: now };
  if (["RESERVED", "SEPARATED"].includes(status)) {
    if (isArchivedStockItem(stock) || ["IN_MAINTENANCE", "DAMAGED", "UNAVAILABLE"].includes(stock.status ?? "")) {
      throw new InventoryError("Material indisponivel para reserva.");
    }
    next.separatedQuantity = input.separatedQuantity ?? (allocation.separatedQuantity || next.plannedQuantity);
    next.preparedByUserId = actorId;
  }
  if (status === "DELIVERED_TO_TEAM") {
    next.deliveredQuantity = input.deliveredQuantity ?? allocation.separatedQuantity;
    next.deliveredByUserId = actorId;
  }
  if (status === "RETURNED") next.returnedQuantity = input.returnedQuantity ?? next.deliveredQuantity - next.consumedQuantity - next.damagedQuantity - next.lostQuantity;
  if (status === "CONSUMED") next.consumedQuantity = input.consumedQuantity ?? next.deliveredQuantity - next.returnedQuantity - next.damagedQuantity - next.lostQuantity;
  if (status === "DAMAGED") next.damagedQuantity = input.damagedQuantity ?? next.deliveredQuantity - next.returnedQuantity - next.consumedQuantity - next.lostQuantity;
  if (status === "LOST") next.lostQuantity = input.lostQuantity ?? next.deliveredQuantity - next.returnedQuantity - next.consumedQuantity - next.damagedQuantity;
  if (status === "CANCELED") {
    if (allocation.deliveredQuantity > 0) throw new InventoryError("Material entregue precisa de retorno ou baixa, nao cancelamento.");
    next.separatedQuantity = 0;
  }
  for (const field of quantities) {
    if (!Number.isFinite(next[field]) || next[field] < 0) throw new InventoryError("Quantidades devem ser numeros finitos maiores ou iguais a zero.");
    next[field] = roundQuantity(next[field]);
  }
  if (next.separatedQuantity > next.plannedQuantity || next.deliveredQuantity > next.separatedQuantity) {
    throw new InventoryError("Entrega nao pode exceder reserva; reserva nao pode exceder planejamento.");
  }
  if (["PENDING_SEPARATION", "SEPARATING"].includes(status) && quantities.slice(1).some((field) => next[field] > 0)) {
    throw new InventoryError("Reserve o material antes de informar quantidades operacionais.");
  }
  if (["RESERVED", "SEPARATED", "CANCELED"].includes(status) && (next.deliveredQuantity > 0 || next.returnedQuantity + next.consumedQuantity + next.damagedQuantity + next.lostQuantity > 0)) {
    throw new InventoryError("Registre a entrega antes de informar consumo ou retorno.");
  }
  if (allocation.deliveredQuantity > 0) {
    if (next.separatedQuantity !== allocation.separatedQuantity || next.deliveredQuantity < allocation.deliveredQuantity) throw new InventoryError("Nao reduza reserva ou entrega de material ja entregue.");
    for (const field of ["returnedQuantity", "consumedQuantity", "damagedQuantity", "lostQuantity"] as const) {
      if (next[field] < allocation[field]) throw new InventoryError("Baixas e devolucoes sao cumulativas e nao podem ser reduzidas.");
    }
  }
  const accounted = roundQuantity(next.returnedQuantity + next.consumedQuantity + next.damagedQuantity + next.lostQuantity);
  if (accounted > next.deliveredQuantity) throw new InventoryError("Retorno, consumo, dano e perda excedem a quantidade entregue.");
  if (terminalMaterialStatuses.includes(status) && status !== "CANCELED" && (accounted !== next.deliveredQuantity || next.deliveredQuantity !== next.separatedQuantity)) {
    throw new InventoryError("Para encerrar, confira toda a quantidade reservada e entregue.");
  }
  if (status === "PARTIALLY_RETURNED" && (next.returnedQuantity <= 0 || accounted >= next.deliveredQuantity)) throw new InventoryError("Informe uma devolucao parcial valida.");
  const stockDelta = roundQuantity(allocation.separatedQuantity - allocation.returnedQuantity - (next.separatedQuantity - next.returnedQuantity));
  const available = roundQuantity(stock.currentStock + stockDelta);
  if (!Number.isFinite(available) || available < 0) throw new InventoryError("Estoque insuficiente para reservar esta quantidade.");
  stock.currentStock = available;
  if (!["DAMAGED", "IN_MAINTENANCE", "UNAVAILABLE"].includes(stock.status ?? "")) stock.status = available <= 0 ? "OUT_OF_STOCK" : available <= stock.minStock ? "LOW_STOCK" : "AVAILABLE";
  Object.assign(allocation, next);
  return allocation;
}

const equipmentTransitions: Record<ServiceOrderEquipment["status"], ServiceOrderEquipment["status"][]> = {
  REQUESTED: ["RESERVED", "CANCELED"], RESERVED: ["DELIVERED", "CANCELED"],
  DELIVERED: ["IN_USE", "RETURNED", "DAMAGED", "LOST"], IN_USE: ["RETURNED", "DAMAGED", "LOST"],
  RETURNED: [], DAMAGED: [], LOST: [], CANCELED: [],
};
export function applyEquipmentMovement(stock: Equipment, link: ServiceOrderEquipment, input: Pick<ServiceOrderEquipment, "status"> & Partial<Pick<ServiceOrderEquipment, "conditionBefore" | "conditionAfter" | "notes">>, allLinks: ServiceOrderEquipment[], actorId: string) {
  if (input.status === link.status) return link;
  if (!equipmentTransitions[link.status]?.includes(input.status)) throw new InventoryError("Transicao de equipamento invalida. Registre reserva, entrega e retorno na sequencia.");
  if (["RESERVED", "DELIVERED", "IN_USE"].includes(input.status)) {
    if (isArchivedStockItem(stock) || ["DAMAGED", "IN_MAINTENANCE", "UNAVAILABLE"].includes(stock.status)) throw new InventoryError("Equipamento indisponivel.");
    if (allLinks.some((other) => other.id !== link.id && other.equipmentId === link.equipmentId && !terminalEquipmentStatuses.includes(other.status))) throw new InventoryError("Equipamento vinculado a outra solicitacao ativa.");
  }
  const now = new Date().toISOString();
  Object.assign(link, input, { updatedAt: now });
  if (input.status === "RESERVED") link.reservedAt = now;
  if (["DELIVERED", "IN_USE"].includes(input.status)) { link.deliveredAt ??= now; link.deliveredByUserId = actorId; }
  if (input.status === "RETURNED") { link.returnedAt = now; link.returnedByUserId = actorId; }
  stock.status = input.status === "DAMAGED" ? "DAMAGED" : input.status === "LOST" ? "UNAVAILABLE" : ["RETURNED", "CANCELED"].includes(input.status) ? "AVAILABLE" : "RESERVED";
  return link;
}

export type RequestInventory = { materials: Material[]; serviceOrderMaterials: ServiceOrderMaterial[]; materialRequestItems: ServiceMaterialRequestItem[] };
/** A request is the idempotency key. All lines are staged and validated before commit. */
export function moveMaterialRequest(state: RequestInventory, request: ServiceMaterialRequest, status: ServiceMaterialRequest["status"], actorId: string) {
  const items = state.materialRequestItems.filter((item) => item.requestId === request.id);
  const linkIds = new Set(items.map((item) => `som-request-${item.id}`));
  if (status === request.status) return state.serviceOrderMaterials.filter((item) => linkIds.has(item.id));
  const allowed: Record<ServiceMaterialRequest["status"], ServiceMaterialRequest["status"][]> = {
    PENDING: ["APPROVED", "REJECTED", "SEPARATED", "CANCELED"], APPROVED: ["REJECTED", "SEPARATED", "CANCELED"],
    SEPARATED: ["DELIVERED", "CANCELED"], REJECTED: [], DELIVERED: [], CANCELED: [],
  };
  if (!allowed[request.status]?.includes(status)) throw new InventoryError("Transicao da solicitacao invalida.");
  const materials = state.materials.map((item) => ({ ...item }));
  const links = state.serviceOrderMaterials.map((item) => ({ ...item }));
  if (["SEPARATED", "DELIVERED"].includes(status) || (status === "CANCELED" && request.status === "SEPARATED")) {
    if (!items.length) throw new InventoryError("Solicitacao sem itens.");
    for (const item of items) {
      const stock = materials.find((candidate) => candidate.id === item.materialId);
      if (!stock) throw new InventoryError("Material da solicitacao nao encontrado.");
      const id = `som-request-${item.id}`;
      let allocation = links.find((candidate) => candidate.id === id);
      if (!allocation && status === "SEPARATED") {
        const now = new Date().toISOString();
        allocation = { id, serviceOrderId: request.serviceOrderId, materialId: item.materialId, plannedQuantity: item.quantity, separatedQuantity: 0, deliveredQuantity: 0, returnedQuantity: 0, consumedQuantity: 0, damagedQuantity: 0, lostQuantity: 0, status: "PENDING_SEPARATION", notes: item.notes, createdAt: now, updatedAt: now };
        links.push(allocation);
      }
      if (!allocation) throw new InventoryError("Reserva da solicitacao nao encontrada. Confira o historico antes de prosseguir.");
      applyMaterialMovement(stock, allocation, { status: status === "DELIVERED" ? "DELIVERED_TO_TEAM" : status === "SEPARATED" ? "SEPARATED" : "CANCELED", ...(status === "SEPARATED" ? { separatedQuantity: item.quantity } : {}) }, actorId);
    }
  }
  for (const next of materials) Object.assign(state.materials.find((item) => item.id === next.id)!, next);
  for (const next of links) {
    const existing = state.serviceOrderMaterials.find((item) => item.id === next.id);
    if (existing) Object.assign(existing, next); else state.serviceOrderMaterials.push(next);
  }
  request.status = status;
  request.updatedAt = new Date().toISOString();
  return state.serviceOrderMaterials.filter((item) => linkIds.has(item.id));
}
