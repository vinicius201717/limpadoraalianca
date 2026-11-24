import type { SessionUser } from "./types";
import type { AssistantIntent } from "./whatsapp-schema";

export type WhatsAppLink = {
  userId: string; phone?: string; tokenHash?: string; tokenExpiresAt?: string;
  sessionVersion: number; linkedAt?: string;
};
export type AssistantAttachment = {
  id: string; storagePath: string; mimeType: string; fileName: string; sizeBytes: number;
  storageProvider?: "supabase" | "local";
};
export type WhatsAppMessage = {
  id: string; from: string; type: string; text: string; timestamp: string;
  mediaId?: string; mimeType?: string; fileName?: string; userId?: string;
  attachment?: AssistantAttachment; transcript?: string;
  status: "QUEUED" | "PROCESSING" | "DONE" | "FAILED";
  attempts: number; lease?: string; leaseUntil?: string; retryAt?: string;
  reply?: string; replySentAt?: string; deliveryAttempts?: number; replyAccess?: string;
  replyMessageId?: string; replyTrackingId?: string;
  replyDeliveryStatus?: "accepted" | "sent" | "delivered" | "read" | "failed";
  replyStatusAt?: string; replyErrorCodes?: number[];
  createdAt: string; error?: string;
};
export type WhatsAppDeliveryUpdate = {
  id: string; trackingId?: string; status: "sent" | "delivered" | "read" | "failed";
  timestamp: string; errorCodes: number[];
};
export type AssistantCommand = {
  id: string; code: string; userId: string; phone: string; sessionVersion: number;
  messageId: string; intent: AssistantIntent; attachment?: AssistantAttachment;
  transcript: string; summary: string; createdAt: string; expiresAt: string;
  status: "PENDING" | "CONFIRMED" | "CANCELED"; confirmedAt?: string;
};
export type WorkHistoryEntry = {
  id: string; serviceOrderId: string; userId: string; authorName: string;
  kind: "DIARY" | "CHECKLIST" | "ASSIGNMENT" | "TRANSFER" | "WARNING" | "FINANCIAL";
  title: string; content: string; transcript: string; messageId: string;
  attachment?: AssistantAttachment; recordingSessionId?: string; createdAt: string;
  receiptConfirmation?: { id: string; updatedAt: string; amount: number; sessionVersion: number };
  assistantReply?: string;
  checklistReply?: { orderTitle: string; pendingOnly: boolean; total: number; done: number; items: Array<{id:string;title:string;status:string;responsible:string[];blockedReason?:string}> };
};
export type EmployeeWarning = {
  id: string; serviceOrderId: string; employeeId: string; employeeName: string;
  reason: string; userId: string; authorName: string; messageId: string; createdAt: string;
};
export type FinancialDocument = {
  id: string; serviceOrderId: string; description: string; direction: "ARCHIVE" | "EXPENSE" | "PAYMENT";
  amount?: number; paymentId?: string; expenseId?: string; receiptId?: string;
  userId: string; messageId: string; attachment: AssistantAttachment; createdAt: string;
};
export type WorkReport = {
  id: string; serviceOrderId: string; userId: string; content: string;
  sourceIds: string[]; scope: string; createdAt: string; model: string;
};
export type AssistantActor = Pick<SessionUser, "id" | "name" | "role" | "isActive" | "sessionVersion" | "mustChangePassword" | "canViewFinancials">;
