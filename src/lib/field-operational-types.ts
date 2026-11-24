import type { AssistantAttachment } from "./whatsapp-types";
export type FieldReceipt = {
  id: string; serviceOrderId: string | null; uploadedByUserId: string; uploadedByName: string;
  description: string; attachment: AssistantAttachment; sourceMessageId: string;
  status: "PENDING_REVIEW" | "REVIEWED"; createdAt: string; updatedAt: string;
};
export type StaffAttendanceReport = {
  id: string; serviceOrderId: string | null; employeeId: string; employeeName: string;
  kind: "ABSENCE" | "EARLY_LEAVE"; occurredOn: string; occurredAt?: string;
  description: string; reportedByUserId: string; reportedByName: string;
  sourceMessageId: string; status: "REPORTED"; createdAt: string;
};
