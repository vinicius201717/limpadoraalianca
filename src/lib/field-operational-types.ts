import type { AssistantAttachment } from "./whatsapp-types";
export type FieldReceipt = {
  id: string; serviceOrderId: string | null; uploadedByUserId: string; uploadedByName: string;
  description: string; attachment: AssistantAttachment; sourceMessageId: string;
  digital?: import("./field-receipts").DigitalReceipt; fileHash?: string;
  extraction?: { status: "READY" | "FAILED"; attempts: number; attemptedAt: string };
  settlement?: { ledgerId: string; byUserId: string; byName: string; at: string; amount: number; direction: "EXPENSE" | "RECEIPT" };
  costCenter?: "ADMINISTRACAO" | "TRANSPORTE" | "MANUTENCAO" | "ALUGUEL" | "OUTROS";
  reversal?: { at: string; byUserId: string; reason: string };
  status: "PENDING_REVIEW" | "REVIEWED" | "SETTLED" | "REVERSED"; createdAt: string; updatedAt: string;
};
export type AdministrativeExpense = { id: string; receiptId: string; costCenter: NonNullable<FieldReceipt["costCenter"]>; amount: number; paidAt: string; description: string; createdByUserId: string; createdAt: string };
export type StaffAttendanceReport = {
  id: string; serviceOrderId: string | null; employeeId: string; employeeName: string;
  kind: "ABSENCE" | "EARLY_LEAVE"; occurredOn: string; occurredAt?: string;
  description: string; reportedByUserId: string; reportedByName: string;
  sourceMessageId: string; status: "REPORTED"; createdAt: string;
};
