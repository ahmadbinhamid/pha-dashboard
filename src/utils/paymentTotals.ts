import type { OrderPaymentSummary } from "@/types/orders";

// Sums every succeeded payment on an order, net of its own refunds — mirrors
// the backend's payment.service.js#getTotalPaidForOrder. An order can have
// more than one Payment doc (a deposit plus a later top-up/payment-link
// remainder), so this is never just "the most recent payment's amount".
export function getTotalPaid(payments: OrderPaymentSummary[]): number {
  return payments
    .filter((p) => p.status === "succeeded")
    .reduce((sum, p) => sum + Math.max(0, p.amount - p.amount_refunded), 0);
}

// Clamped so a data inconsistency (e.g. a refund exceeding what was
// collected) can never render a negative balance due.
export function getBalanceDue(orderTotal: number, payments: OrderPaymentSummary[]): number {
  return Math.max(0, orderTotal - getTotalPaid(payments));
}
