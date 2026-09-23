import type { OrderPaymentSummary, OrderPaymentStatus } from "@/types/orders";

// Sums every succeeded payment on an order, net of its own refunds — mirrors payment.service.js#getTotalPaidForOrder. An order can have multiple Payment docs, so never just "the latest payment's amount".
export function getTotalPaid(payments: OrderPaymentSummary[]): number {
  return payments
    .filter((p) => p.status === "succeeded")
    .reduce((sum, p) => sum + Math.max(0, p.amount - p.amount_refunded), 0);
}

// Sums every payment's own amount_refunded, regardless of status — a refund only reduces its own payment's contribution to getTotalPaid, so this is the other half of that number, not a separate ledger.
export function getTotalRefunded(payments: OrderPaymentSummary[]): number {
  return payments.reduce((sum, p) => sum + p.amount_refunded, 0);
}

// A refund doesn't always mean "nothing more owed" — depends on whether the order was ever paid in full before the refund. Paid-in-full-then-refunded: due is 0 (a deliberate decision, not an unpaid balance) — grossPaid (net paid + refunded) vs orderTotal decides this. Never-paid-in-full-then-partially-refunded: due is the real remainder. paymentStatus === "refunded" (fully refunded, order void) always means due is 0.
export function getBalanceDue(orderTotal: number, payments: OrderPaymentSummary[], paymentStatus?: OrderPaymentStatus): number {
  const netPaid = getTotalPaid(payments);
  const grossPaid = netPaid + getTotalRefunded(payments);
  const wasEverPaidInFull = grossPaid >= orderTotal;
  const isFullyRefunded = paymentStatus === "refunded";
  if (wasEverPaidInFull || isFullyRefunded) return 0;
  return Math.max(0, orderTotal - netPaid);
}
