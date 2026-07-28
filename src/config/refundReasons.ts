import type { RefundReason } from "@/types/payment";

// Selectable when issuing a Stripe refund — "other" is backend-only there
// (reserved for reconciling a refund issued directly from the Stripe dashboard).
export const REFUND_REASONS: { value: Exclude<RefundReason, "other">; label: string }[] = [
  { value: "customer_request", label: "Customer Request" },
  { value: "duplicate_payment", label: "Duplicate Payment" },
  { value: "fraud_suspected", label: "Fraud Suspected" },
  { value: "payment_error", label: "Payment Error" },
  { value: "order_cancelled", label: "Order Cancelled" },
];

// Selectable when recording a manual refund — "other" is a real staff-entered
// choice here, unlike the Stripe flow (no dashboard-reconciliation case to
// keep it reserved for), so it's included with a plain, non-Stripe label.
export const MANUAL_REFUND_REASONS: { value: RefundReason; label: string }[] = [
  ...REFUND_REASONS,
  { value: "other", label: "Other" },
];

export const REFUND_REASON_LABEL: Record<RefundReason, string> = {
  customer_request: "Customer Request",
  duplicate_payment: "Duplicate Payment",
  fraud_suspected: "Fraud Suspected",
  payment_error: "Payment Error",
  order_cancelled: "Order Cancelled",
  other: "Other (Stripe Dashboard)",
};
