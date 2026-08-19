import type { PaymentProvider, PaymentStatus, Refund } from "@/types/payment";

// Legacy, derived-only rollup of fulfillment_status + payment_status (see
// server/src/models/Order.js's `status` field comment) — still returned by
// the API and still legitimately read wherever the exact combined semantics
// (e.g. "refunded" overriding everything else) are what's needed, but never
// written to directly from the frontend anymore. Prefer OrderFulfillmentStatus
// / OrderPaymentStatus below for anything editable or badge-rendered.
export type OrderStatus =
  | "pending_payment"
  | "partially_paid"
  | "paid"
  | "fulfilled"
  | "cancelled"
  | "refunded"
  | "partially_refunded";

// Admin-editable order lifecycle — fully independent of payment status
// (matches flowpos's split). Written via updateOrderStatus/OrderStatusSelect.
export type OrderFulfillmentStatus = "pending" | "processing" | "on_hold" | "completed" | "cancelled";

// Always derived server-side from actual payments/refunds — never settable
// by hand. See OrderPaymentStatusBadge for how this renders.
export type OrderPaymentStatus = "pending_payment" | "partially_paid" | "paid" | "partially_refunded" | "refunded";

export type OrderChannel = "storefront" | "ebay" | "manual";

export type OrderDeliveryMethod = "delivery" | "pickup";

export interface OrderCustomer {
  name: string;
  // Shown on the invoice instead of `name` when present.
  company_name: string | null;
  // Optional for "manual" orders — a walk-in Customer record may have
  // neither on file. Always present for storefront/eBay orders.
  email: string | null;
  phone: string | null;
}

export interface OrderAddress {
  address: string;
  suburb: string;
  state: string;
  postcode: string;
}

export interface OrderItem {
  // orderItemSchema was `{ _id: false }` before refund-redesign-spec.md §1.1
  // — every item now carries a real, stable id (backend/models/Order.js).
  // Not optional: the schema change is live, so every item the API returns
  // from here on has one (older orders get theirs from the §6.2 backfill).
  _id: string;
  product: string;
  variant: string | null;
  name: string;
  sku: string | null;
  unit_price: number; // cents, GST-inclusive
  quantity: number;
  // Per-line discount (cents) — only ever set on manual/admin-created orders.
  discount_amount: number;
  // Customer-facing note for this specific line — only ever set on
  // manual/admin-created orders.
  note: string | null;
  ebay_sync_status: "not_applicable" | "pending" | "synced" | "failed";
  ebay_sync_error: string | null;
  // Price-edit audit trail (storefront/eBay orders only — see
  // order.service.js#updateOrderItemPrice). original_unit_price is captured
  // once, on the first edit; unit_price itself is always the current price.
  original_unit_price: number | null;
  unit_price_updated_at: string | null;
  unit_price_updated_by: string | null;
  // Refund ledger (refund-redesign-spec.md §1.1) — cumulative across every
  // succeeded, non-voided refund touching this line. Derived/recomputed
  // server-side, never something the frontend should compute itself.
  quantity_refunded: number;
  amount_refunded: number; // cents, this line's share only
  quantity_restocked: number; // <= quantity_refunded; restock is opt-in per refund
  // Virtual — quantity - quantity_refunded. Server-computed (orderItemSchema
  // virtual, serialized via toJSON/toObject virtuals:true) so nothing on the
  // frontend re-derives it and risks drifting from the same rule refund-
  // calculator.service.js uses.
  refundable_quantity: number;
}

// Internal staff comment thread — distinct from Order.note (customer-facing,
// captured once at creation).
export interface OrderInternalNote {
  _id: string;
  text: string;
  author: string | null;
  created_at: string;
}

// Populated by the backend from the linked Payment doc.
export interface OrderPaymentSummary {
  _id: string;
  provider: PaymentProvider;
  // Only set for provider "manual" — how the customer actually paid.
  payment_method: "cash" | "online_transfer" | "efpos" | null;
  status: PaymentStatus;
  amount: number; // cents
  amount_refunded: number; // cents
  card_brand: string | null;
  card_last4: string | null;
  paid_at: string | null;
}

export interface Order {
  _id: string;
  // Bare zero-padded sequence ("00001") — no prefix baked in. Format with
  // formatOrderNumber(order.order_number_prefix, order.order_number) from
  // @/utils/format, never a hardcoded "ORD-".
  order_number: string;
  // Snapshotted from TenantSettings.order_number_prefix at creation time —
  // stays whatever it was then even if the tenant's setting changes later,
  // so old orders never get relabeled.
  order_number_prefix: string;
  invoice_number: string;
  invoice_number_prefix: string;
  items: OrderItem[];
  customer: OrderCustomer;
  // Linked Customer record, when this order belongs to a known customer —
  // null for guest storefront checkouts.
  customer_id: string | null;
  delivery_method: OrderDeliveryMethod;
  // null when delivery_method is "pickup" — there's nowhere to ship.
  shipping_address: OrderAddress | null;
  billing_address: OrderAddress | null;
  // Customer-facing note for the whole order, captured once at creation.
  note: string | null;
  internal_notes: OrderInternalNote[];
  subtotal: number; // cents, GST-inclusive
  // Order-level manual adjustment (goodwill credit, negotiated discount) —
  // distinct from each line item's own discount_amount, which subtotal
  // already nets out. Zero unless an admin has set one via the order-detail
  // page's editable Discount row.
  discount_amount: number; // cents
  shipping_cost: number; // cents
  tax_amount: number; // cents — GST component of subtotal, display-only
  total: number; // cents
  currency: string;
  status: OrderStatus;
  fulfillment_status: OrderFulfillmentStatus;
  payment_status: OrderPaymentStatus;
  channel: OrderChannel;
  external_order_id: string | null;
  external_buyer_username: string | null;
  has_stock_issue: boolean;
  stock_issue_note: string | null;
  // Set together when an admin fulfils a DELIVERY order — null until then,
  // always null for PICKUP orders.
  tracking_number: string | null;
  carrier_name: string | null;
  // Optional customer/staff-supplied reference (e.g. a customer's own PO
  // number) — distinct from order_number/invoice_number, which are always
  // system-generated. Null until an admin fills it in.
  reference_number: string | null;
  payment: OrderPaymentSummary | null;
  created_at: string;
  updated_at: string;
}

// The admin order-detail endpoint returns the full payment history (every
// Payment doc for the order — a deposit plus a later top-up, for instance),
// not just the single most-recently-created one `Order.payment` points at.
export interface OrderDetail extends Omit<Order, "payment"> {
  payments: OrderPaymentSummary[];
  refunds: Refund[];
}
