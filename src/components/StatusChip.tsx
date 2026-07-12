"use client";

import { Chip, type ChipProps } from "@mui/material";

import { labelFor } from "@/lib/labels";

const toneByStatus: Record<string, ChipProps["color"]> = {
  ACTIVE: "success",
  DONE: "success",
  DELIVERED: "success",
  DELIVERED_TO_TEAM: "success",
  SEPARATED: "success",
  RETURNED: "success",
  CONSUMED: "success",
  APPROVED: "success",
  PAID: "success",
  WON: "success",
  IN_PROGRESS: "info",
  IN_USE: "info",
  SEPARATING: "info",
  PREPARING: "info",
  CONTACTED: "info",
  QUOTE_SENT: "info",
  SENT: "info",
  SCHEDULED: "primary",
  RESERVED: "primary",
  AVAILABLE: "success",
  REQUESTED: "warning",
  INSPECTION_SCHEDULED: "primary",
  NEW: "primary",
  DRAFT: "default",
  PENDING: "warning",
  PENDING_SEPARATION: "warning",
  LOW_STOCK: "warning",
  PARTIALLY_RETURNED: "warning",
  BLOCKED: "warning",
  REOPENED: "warning",
  DELAYED: "warning",
  URGENT: "warning",
  ON_LEAVE: "warning",
  NEGOTIATION: "warning",
  WAITING_CUSTOMER: "warning",
  PARTIAL: "warning",
  OVERDUE: "error",
  LOST: "error",
  DAMAGED: "error",
  OUT_OF_STOCK: "error",
  IN_MAINTENANCE: "warning",
  UNAVAILABLE: "default",
  REJECTED: "error",
  CANCELED: "error",
  FIRED: "error",
  INACTIVE: "default",
};

export function StatusChip({ value }: { value: unknown }) {
  const key = String(value);
  return <Chip size="small" label={labelFor(value)} color={toneByStatus[key] ?? "default"} variant="outlined" />;
}
