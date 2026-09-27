export type PaymentStatus = "pending" | "requires_action" | "succeeded" | "failed" | "canceled";

// "stripe" = API/webhook is the source of truth; "manual" = staff typed in what they collected (see PaymentMethod for how); "ebay" = auto-created on import since eBay collects payment itself.
export type PaymentProvider = "stripe" | "manual" | "ebay";

// Only meaningful when provider is "manual"; always null for Stripe, which is inherently a card.
export type PaymentMethod = "cash" | "online_transfer" | "efpos";

// The three choices staff see when creating a manual order. "payment_link" isn't a real PaymentMethod — it means "generate a Stripe Checkout link instead of collecting now".
export type OrderPaymentChoice = PaymentMethod | "payment_link";

export interface PaymentOrderSummary {
  _id: string;
  order_number: string;
  order_number_prefix: string;
  invoice_number: string;
  invoice_number_prefix: string;
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

// Moved to types/refund.ts (refund-redesign-spec.md §1.3/§1.4) — order-scoped now, not just "the refund a Payment has." Re-exported so old imports from "@/types/payment" keep working.
export type { RefundReason, RefundStatus, Refund } from "@/types/refund";
import type { Refund } from "@/types/refund";

export interface PaymentDetail extends Payment {
  refunds: Refund[];
}
