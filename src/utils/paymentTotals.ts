import type { OrderPaymentSummary, OrderStatus } from "@/types/orders";

// Sums every succeeded payment on an order, net of its own refunds — mirrors
// the backend's payment.service.js#getTotalPaidForOrder. An order can have
// more than one Payment doc (a deposit plus a later top-up/payment-link
// remainder), so this is never just "the most recent payment's amount".
export function getTotalPaid(payments: OrderPaymentSummary[]): number {
  return payments
    .filter((p) => p.status === "succeeded")
    .reduce((sum, p) => sum + Math.max(0, p.amount - p.amount_refunded), 0);
}

// Sums every payment's own amount_refunded, regardless of that payment's
// current status — a refund only ever reduces its own payment's
// contribution to getTotalPaid, so this is the other half of that same
// number, not a separate ledger.
export function getTotalRefunded(payments: OrderPaymentSummary[]): number {
  return payments.reduce((sum, p) => sum + p.amount_refunded, 0);
}

// A refund does NOT always mean "nothing more is owed" — it depends on
// whether the order was ever actually paid in full before the refund:
//
//   - Paid in full, then refunded (in part or in full): the sale was
//     already complete, and the refund was a deliberate decision afterward
//     (goodwill credit, cancellation) — not an unpaid balance. Due is 0,
//     regardless of what the raw total-minus-net-paid arithmetic says,
//     since that arithmetic can't distinguish "still owed" from "given
//     back on purpose". getTotalPaid(payments) + getTotalRefunded(payments)
//     reconstructs the gross amount ever collected (refunds only ever
//     reduce their own payment's net contribution, never exceed it in a
//     healthy dataset) — comparing that against orderTotal is what
//     determines "was this ever paid in full".
//   - Never paid in full, and then some of that partial payment gets
//     refunded on top (see refund.service.js#finalizeSucceededRefund —
//     status only reaches "refunded" once one payment's own
//     amount_refunded reaches its own amount, independent of whether that
//     payment ever covered the whole order): the customer still genuinely
//     owes the gap, and net paid is now even lower than before, so due is
//     the real remainder (orderTotal - net paid), not 0.
//   - status === "refunded" (a payment refunded in full — see
//     refund.service.js, this is also how a cancelled sale gets restocked)
//     is treated as "this order is void" regardless of whether the order
//     total was ever fully collected — nothing further should ever be
//     chased on a fully-refunded order.
export function getBalanceDue(orderTotal: number, payments: OrderPaymentSummary[], status?: OrderStatus): number {
  const netPaid = getTotalPaid(payments);
  const grossPaid = netPaid + getTotalRefunded(payments);
  const wasEverPaidInFull = grossPaid >= orderTotal;
  const isFullyRefunded = status === "refunded";
  if (wasEverPaidInFull || isFullyRefunded) return 0;
  return Math.max(0, orderTotal - netPaid);
}
