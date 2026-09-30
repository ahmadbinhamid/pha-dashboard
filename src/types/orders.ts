import type { PaymentProvider, PaymentStatus, Refund } from "@/types/payment";

// Legacy rollup; use OrderFulfillmentStatus/OrderPaymentStatus for badges.
export type OrderStatus =
  | "pending_payment"
  | "partially_paid"
  | "paid"
  | "fulfilled"
  | "cancelled"
  | "refunded"
  | "partially_refunded";

// Admin-editable lifecycle, independent of payment status.
export type OrderFulfillmentStatus = "pending" | "processing" | "on_hold" | "completed" | "cancelled";

// Derived server-side from payments/refunds, never settable by hand.
export type OrderPaymentStatus = "pending_payment" | "partially_paid" | "paid" | "partially_refunded" | "refunded";

export type OrderChannel = "storefront" | "ebay" | "manual";

export type OrderDeliveryMethod = "delivery" | "pickup";

export interface OrderCustomer {
  name: string;
  // Shown on the invoice instead of `name` when present.
  company_name: string | null;
  // Optional for manual orders (walk-ins); always set for storefront/eBay.
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
  // Stable per-item id (refund spec §1.1); older orders were backfilled.
  _id: string;
  // Null for custom lines, which exist only on this order.
  product: string | null;
  is_custom?: boolean;
  variant: string | null;
  name: string;
  sku: string | null;
  unit_price: number; // cents, GST-inclusive
  quantity: number;
  // Per-line discount (cents) — only ever set on manual/admin-created orders.
  discount_amount: number;
  // Customer-facing note for this line; only set on manual/admin-created orders.
  note: string | null;
  ebay_sync_status: "not_applicable" | "pending" | "synced" | "failed";
  ebay_sync_error: string | null;
  // Price-edit audit; original_unit_price is set once, on the first edit.
  original_unit_price: number | null;
  unit_price_updated_at: string | null;
  unit_price_updated_by: string | null;
  // Refund ledger: server-derived from succeeded, non-voided refunds.
  quantity_refunded: number;
  amount_refunded: number; // cents, this line's share only
  quantity_restocked: number; // <= quantity_refunded; restock is opt-in per refund
  // Server virtual (quantity - quantity_refunded) so the UI can't drift.
  refundable_quantity: number;
}

interface CatalogueOrderItemPayload {
  product: string;
  variant?: string | null;
  quantity: number;
  discount_amount?: number; // dollars
  note?: string | null;
}

// Order-only line typed in at POS; never becomes a catalogue product.
interface CustomOrderItemPayload {
  is_custom: true;
  name: string;
  unit_price: number; // dollars
  shipping_cost?: number; // dollars, per unit
  quantity: number;
  discount_amount?: number; // dollars
  note?: string | null;
}

export type CreateManualOrderItemPayload = CatalogueOrderItemPayload | CustomOrderItemPayload;

// Staff-only comment thread, separate from the customer-facing Order.note.
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
  // Bare zero-padded sequence ("00001"); display via formatOrderNumber().
  order_number: string;
  // Snapshotted at creation, so later prefix setting changes don't apply.
  order_number_prefix: string;
  invoice_number: string;
  invoice_number_prefix: string;
  items: OrderItem[];
  customer: OrderCustomer;
  // Linked Customer record; null for guest storefront checkouts.
  customer_id: string | null;
  delivery_method: OrderDeliveryMethod;
  // null when delivery_method is "pickup" — there's nowhere to ship.
  shipping_address: OrderAddress | null;
  billing_address: OrderAddress | null;
  // Customer-facing note for the whole order, captured once at creation.
  note: string | null;
  internal_notes: OrderInternalNote[];
  subtotal: number; // cents, GST-inclusive
  // Order-level adjustment, separate from line discounts (already in subtotal).
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
  // Set together when a delivery order is fulfilled; always null for pickup.
  tracking_number: string | null;
  carrier_name: string | null;
  // Optional customer/staff reference (e.g. a PO number), not system-made.
  reference_number: string | null;
  payment: OrderPaymentSummary | null;
  created_at: string;
  updated_at: string;
}

// Detail endpoint returns every payment, not just the one Order.payment holds.
export interface OrderDetail extends Omit<Order, "payment"> {
  payments: OrderPaymentSummary[];
  refunds: Refund[];
}

export interface OrderStats {
  totalRevenueCents: number;
  pendingFulfillmentCount: number;
  unpaidCount: number;
}
