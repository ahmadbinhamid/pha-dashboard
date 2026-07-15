export type PaymentStatus = "pending" | "requires_action" | "succeeded" | "failed" | "canceled";

export interface PaymentOrderSummary {
  _id: string;
  order_number: string;
  customer: { name: string; email: string; phone: string };
  total: number; // cents
  status: string;
}

export interface Payment {
  _id: string;
  order: PaymentOrderSummary | string;
  provider: string;
  stripe_payment_intent_id: string;
  amount: number; // cents
  amount_refunded: number; // cents
  currency: string;
  status: PaymentStatus;
  card_brand: string | null;
  card_last4: string | null;
  failure_reason: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export type RefundReason =
  | "customer_request"
  | "duplicate_payment"
  | "fraud_suspected"
  | "payment_error"
  | "order_cancelled"
  | "other"; // "other" is only ever set by the backend reconciling a Stripe-dashboard-issued refund

export type RefundStatus = "pending" | "succeeded" | "failed";

export interface Refund {
  _id: string;
  payment: string;
  order: string;
  stripe_refund_id: string | null;
  amount: number; // cents
  reason: RefundReason;
  status: RefundStatus;
  failure_reason: string | null;
  initiated_via: "admin_api" | "stripe_dashboard";
  initiated_by: string | null;
  created_at: string;
}

export interface PaymentDetail extends Payment {
  refunds: Refund[];
}
