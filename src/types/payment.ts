export type PaymentStatus = "pending" | "requires_action" | "succeeded" | "failed" | "canceled";

// "stripe" = the API/webhook is the source of truth; "manual" = a staff
// member typed in what they collected — see PaymentMethod for the human
// detail on *how* a manual payment was taken.
export type PaymentProvider = "stripe" | "manual";

// Only meaningful when provider is "manual" — always null for Stripe, which
// is inherently a card.
export type PaymentMethod = "cash" | "online_transfer";

// The three choices staff see when creating a manual order. "payment_link"
// is not a PaymentMethod (no Payment doc is created with it as the method) —
// it means "generate a Stripe Checkout link instead of collecting now".
export type OrderPaymentChoice = PaymentMethod | "payment_link";

export interface PaymentOrderSummary {
  _id: string;
  order_number: string;
  customer: { name: string; email: string | null; phone: string | null };
  total: number; // cents
  status: string;
}

export interface Payment {
  _id: string;
  order: PaymentOrderSummary | string;
  provider: PaymentProvider;
  payment_method: PaymentMethod | null;
  stripe_payment_intent_id: string | null;
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
