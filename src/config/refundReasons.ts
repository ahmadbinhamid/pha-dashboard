import type { RefundReason } from "@/types/refund";

// refund-redesign-spec.md §1.4: one unified reason list for the unified refund dialog (§7), replacing the old Stripe-only/manual-only split, since the dialog no longer branches on settlement method.
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

// UI default only: pre-checks the restock checkbox when the reason implies goods are coming back. Server never infers restock from reason (§3.5); an admin can always override per line.
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
