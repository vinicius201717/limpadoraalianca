import type { Material, StockItemStatus } from "./types";

export const stockStatusOptions = [
  "AVAILABLE",
  "RESERVED",
  "LOW_STOCK",
  "OUT_OF_STOCK",
  "IN_MAINTENANCE",
  "DAMAGED",
  "UNAVAILABLE",
] as const satisfies readonly StockItemStatus[];

export function normalizeStockStatus(value: unknown): StockItemStatus {
  const key = String(value ?? "").trim().toUpperCase();
  if (stockStatusOptions.includes(key as StockItemStatus)) return key as StockItemStatus;
  if (key.includes("DISPON")) return "AVAILABLE";
  if (key.includes("RESERV") || key.includes("OBRA")) return "RESERVED";
  if (key.includes("MANUT")) return "IN_MAINTENANCE";
  if (key.includes("DANIFIC")) return "DAMAGED";
  if (key.includes("FALTA")) return "OUT_OF_STOCK";
  return "AVAILABLE";
}

export function getMaterialOperationalStatus(material: Material): StockItemStatus {
  const manualStatus = normalizeStockStatus(material.status);
  if (manualStatus === "IN_MAINTENANCE" || manualStatus === "DAMAGED" || manualStatus === "UNAVAILABLE") {
    return manualStatus;
  }
  if (material.currentStock <= 0) return "OUT_OF_STOCK";
  if (material.currentStock <= material.minStock) return "LOW_STOCK";
  return manualStatus === "RESERVED" ? "RESERVED" : "AVAILABLE";
}
