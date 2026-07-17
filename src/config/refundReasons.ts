import type { RefundReason } from "@/types/payment";

// Selectable when issuing a refund — "other" is backend-only (Stripe-dashboard reconciliation).
export const REFUND_REASONS: { value: Exclude<RefundReason, "other">; label: string }[] = [
  { value: "customer_request", label: "Customer Request" },
  { value: "duplicate_payment", label: "Duplicate Payment" },
  { value: "fraud_suspected", label: "Fraud Suspected" },
  { value: "payment_error", label: "Payment Error" },
  { value: "order_cancelled", label: "Order Cancelled" },
];

export const REFUND_REASON_LABEL: Record<RefundReason, string> = {
  customer_request: "Customer Request",
  duplicate_payment: "Duplicate Payment",
  fraud_suspected: "Fraud Suspected",
  payment_error: "Payment Error",
  order_cancelled: "Order Cancelled",
  other: "Other (Stripe Dashboard)",
};
