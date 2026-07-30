// types/refund.ts
//
// refund-redesign-spec.md §1.3/§1.4/§2 — order-scoped refunds with three
// scopes (whole invoice, specific line items, bare amount) and a settlement
// adapter chosen by each allocation's own provider. Split out of
// types/payment.ts since this is now a substantial, distinct domain, not
// just "the refund a Payment has."

import type { PaymentProvider } from "@/types/payment";

export type RefundScope = "full_order" | "line_items" | "amount";

export type RefundStatus = "pending" | "processing" | "succeeded" | "failed" | "canceled" | "voided";

export type RefundReason =
  // Goods physically returned — restock defaults ON in the UI (see
  // config/refundReasons.ts's RESTOCK_DEFAULT_REASONS).
  | "customer_return"
  | "order_cancelled"
  | "wrong_item_sent"
  // Goods not returned or unsellable — restock defaults OFF.
  | "damaged_on_arrival"
  | "customer_request"
  | "goodwill"
  | "price_adjustment"
  | "duplicate_payment"
  | "fraud_suspected"
  | "payment_error"
  | "other"; // only ever set by the backend reconciling a Stripe-dashboard-issued refund

export type EbaySyncStatus = "not_applicable" | "pending" | "synced" | "failed";

export interface RefundLine {
  order_item_id: string;
  sku: string | null;
  name: string | null;
  quantity: number;
  unit_price: number; // cents, GST-inclusive
  line_discount: number; // this item's own discount, apportioned to quantity
  order_discount_share: number; // this line's share of the order-level discount, this refund only
  line_amount: number; // gross - line_discount - order_discount_share
  gst_amount: number;
  restock: boolean;
  restock_applied_at: string | null;
  ebay_sync_status: EbaySyncStatus;
  ebay_sync_error: string | null;
}

export interface PaymentAllocation {
  payment: string;
  amount: number; // cents
  provider: PaymentProvider;
  stripe_refund_id: string | null;
  settled: boolean;
}

export interface Refund {
  _id: string;
  order: string;
  refund_number: string; // "CN-00001"
  scope: RefundScope;
  lines: RefundLine[];
  payment_allocations: PaymentAllocation[];

  shipping_amount: number; // cents
  adjustment_amount: number; // signed cents: + goodwill, - restocking fee (or a rounding plug)
  items_amount: number;
  gst_amount: number;
  total_amount: number; // cents — the authoritative figure; never computed client-side

  reason: RefundReason;
  internal_note: string | null;

  status: RefundStatus;
  failure_reason: string | null;

  // Set once the restock/eBay leg has been attempted — NOT a correctness
  // guard on money (that's always derived/idempotent server-side).
  effects_applied_at: string | null;

  // True for a refund reconciled from a Stripe-dashboard-issued refund we
  // didn't create ourselves — no line data, no restock option was ever
  // presented, badge it as needing manual reconciliation.
  needs_reconciliation: boolean;

  // §5 — set true when this refund touches an eBay payment allocation; the
  // admin explicitly confirmed (via RefundEbayConfirmation) the refund was
  // already issued in eBay Seller Hub. Always false for a refund with no
  // eBay allocation.
  ebay_refund_confirmed: boolean;

  initiated_via: "admin_api" | "stripe_dashboard" | "manual";
  initiated_by: string | null;

  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;

  created_at: string;
  updated_at: string;
}

// ── GET /order/:orderId/refundable — server tells the UI what's possible;
// the UI computes nothing (§2.1). ─────────────────────────────────────────

export interface RefundableLine {
  order_item_id: string;
  name: string;
  sku: string | null;
  quantity: number;
  quantity_refunded: number;
  refundable_quantity: number;
  unit_price: number;
  effective_unit_price: number; // net of item-level discount
  refundable_amount: number; // display estimate — POST /refunds computes the authoritative figure
  has_inventory_record: boolean;
  has_ebay_listing: boolean;
}

export interface RefundablePayment {
  payment_id: string;
  provider: PaymentProvider;
  method: string | null;
  amount: number;
  amount_refunded: number;
  refundable: number;
  stripe_refundable?: number;
  stripe_window_open?: boolean;
  settlement: "stripe" | "manual";
}

// A refund whose reservation is stuck long enough to be worth an admin's
// attention — see getRefundableSummary's own comment server-side for why a
// PENDING one has already stopped counting toward max_refundable above
// while a PROCESSING one is still fully counted (Stripe already accepted
// it — see `still_reserved`).
export interface StuckRefund {
  refund_number: string;
  status: RefundStatus;
  created_at: string;
  total_amount: number;
  still_reserved: boolean;
}

export interface RefundableSummary {
  order_total: number;
  total_paid: number;
  total_refunded: number;
  max_refundable: number;
  shipping: { amount: number; refunded: number; refundable: number };
  lines: RefundableLine[];
  payments: RefundablePayment[];
  stuck_refunds: StuckRefund[];
}

// ── POST /order/:orderId/refunds request body (§2.2) — the client NEVER
// sends money amounts for item or full-invoice refunds; it sends
// order_item_id + quantity + restock, and the server derives every cent.
// `amount` only applies to scope: "amount". ───────────────────────────────

export interface CreateRefundLineInput {
  order_item_id: string;
  quantity: number;
  restock: boolean;
}

export interface CreateRefundPayload {
  idempotency_key: string;
  scope: RefundScope;
  lines?: CreateRefundLineInput[]; // required for line_items, forbidden otherwise
  refund_shipping?: boolean; // full_order only
  restock_all?: boolean; // full_order only
  amount?: number; // cents — required for scope "amount", forbidden otherwise
  adjustment_amount?: number; // signed cents, optional
  reason: RefundReason;
  internal_note?: string | null;
  payment_allocations?: { payment_id: string; amount: number }[]; // optional — server auto-allocates
  // §5 — required true whenever this refund resolves to an eBay payment
  // allocation; the server rejects otherwise (see RefundEbayConfirmation).
  ebay_refund_confirmed?: boolean;
}
