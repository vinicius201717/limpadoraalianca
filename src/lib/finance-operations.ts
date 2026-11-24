import { randomUUID } from "node:crypto";
import type { ServiceExpense, ServiceOrder } from "./types";
export const roundMoney = (value: number) => Math.round(value * 100) / 100;
export type ServicePayment = {
  id: string; serviceOrderId: string; description: string; amount: number; dueAt: string; createdAt: string; createdByUserId: string; requestId?: string;
  receipts: Array<{ id: string; amount: number; paidAt: string; method: string; reference: string; createdAt: string; createdByUserId: string; reversedAt?: string; reversedByUserId?: string; reversalReason?: string }>;
};
export function expenseTotal(orderId: string, expenses: ServiceExpense[]) { return roundMoney(expenses.filter((item) => item.serviceOrderId === orderId).reduce((total, item) => total + item.amount, 0)); }
export function reconcileExpenseLedger(order: ServiceOrder, expenses: ServiceExpense[], actorId: string) {
  const delta = roundMoney(order.expenses - expenseTotal(order.id, expenses));
  if (!delta) return;
  const now = new Date().toISOString();
  expenses.push({ id: `expense-opening-${randomUUID()}`, serviceOrderId: order.id, employeeId: "", employeeName: "Saldo anterior", category: "OUTROS", amount: delta, notes: "Conciliação do total registrado antes da adoção do livro de despesas.", createdByUserId: actorId, createdAt: now, updatedAt: now });
}
export function adjustExpenseTotal(order: ServiceOrder, expenses: ServiceExpense[], amount: number, reason: string, actorId: string) {
  if (!Number.isFinite(amount) || amount < 0 || reason.trim().length < 5) throw new Error("Informe valor válido e motivo do ajuste.");
  reconcileExpenseLedger(order, expenses, actorId);
  const delta = roundMoney(amount - expenseTotal(order.id, expenses));
  if (delta) {
    const now = new Date().toISOString();
    expenses.push({ id: `expense-adjustment-${randomUUID()}`, serviceOrderId: order.id, employeeId: "", employeeName: "Ajuste financeiro", category: "OUTROS", amount: delta, notes: reason.trim(), createdByUserId: actorId, createdAt: now, updatedAt: now });
  }
  order.expenses = expenseTotal(order.id, expenses);
}
export function paymentReceived(payment: ServicePayment) { return roundMoney(payment.receipts.filter((receipt) => !receipt.reversedAt).reduce((sum, receipt) => sum + receipt.amount, 0)); }
export function addReceipt(payment: ServicePayment, input: { amount: number; paidAt: string; method: string; reference: string }, actorId: string) {
  const amount = roundMoney(input.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > roundMoney(payment.amount - paymentReceived(payment))) throw new Error("Recebimento deve ser positivo e não pode superar o saldo da parcela.");
  const receipt = { ...input, amount, id: `receipt-${randomUUID()}`, createdAt: new Date().toISOString(), createdByUserId: actorId };
  payment.receipts.push(receipt);
  return receipt;
}
