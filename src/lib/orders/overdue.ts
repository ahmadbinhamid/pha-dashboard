import type { Order, OrderPaymentStatus } from "@/types/orders";

// Mirrors server utils/orderVisibility#overdueInvoices.
const UNPAID_PAYMENT_STATUSES: OrderPaymentStatus[] = ["pending_payment", "partially_paid"];

/** Account invoice past its due date with money still owing. */
export function isOrderOverdue(
  order: Pick<Order, "due_date" | "payment_status" | "fulfillment_status">,
  now: number = Date.now(),
): boolean {
  if (!order.due_date || order.fulfillment_status === "cancelled") return false;
  return UNPAID_PAYMENT_STATUSES.includes(order.payment_status) && new Date(order.due_date).getTime() < now;
}
