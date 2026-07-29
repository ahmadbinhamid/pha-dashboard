import type { RefundReason } from "@/types/refund";

// refund-redesign-spec.md §1.4 — one unified reason list for the one
// unified refund dialog (§7), replacing the old split between a
// Stripe-only list (REFUND_REASONS, "other" excluded) and a manual-only one
// (MANUAL_REFUND_REASONS, "other" included) — the new dialog doesn't branch
// on settlement method at all, so neither should this.
export const REFUND_REASONS: { value: RefundReason; label: string }[] = [
  { value: "customer_return", label: "Customer Return" },
  { value: "order_cancelled", label: "Order Cancelled" },
  { value: "wrong_item_sent", label: "Wrong Item Sent" },
  { value: "damaged_on_arrival", label: "Damaged on Arrival" },
  { value: "customer_request", label: "Customer Request" },
  { value: "goodwill", label: "Goodwill" },
  { value: "price_adjustment", label: "Price Adjustment" },
  { value: "duplicate_payment", label: "Duplicate Payment" },
  { value: "fraud_suspected", label: "Fraud Suspected" },
  { value: "payment_error", label: "Payment Error" },
  { value: "other", label: "Other" },
];

// UI default only — pre-checks each refund line's restock checkbox when the
// selected reason implies goods are physically coming back. The server
// never infers restock from reason (§3.5) — this only ever sets the
// checkbox's *starting* state; an admin can always override it per line.
export const RESTOCK_DEFAULT_REASONS = new Set<RefundReason>([
  "customer_return",
  "order_cancelled",
  "wrong_item_sent",
]);

export const REFUND_REASON_LABEL: Record<RefundReason, string> = {
  customer_return: "Customer Return",
  order_cancelled: "Order Cancelled",
  wrong_item_sent: "Wrong Item Sent",
  damaged_on_arrival: "Damaged on Arrival",
  customer_request: "Customer Request",
  goodwill: "Goodwill",
  price_adjustment: "Price Adjustment",
  duplicate_payment: "Duplicate Payment",
  fraud_suspected: "Fraud Suspected",
  payment_error: "Payment Error",
  other: "Other (Stripe Dashboard)",
};
