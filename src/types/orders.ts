import type { PaymentProvider, PaymentStatus, Refund } from "@/types/payment";

// Legacy rollup of fulfillment+payment status; use OrderFulfillmentStatus/OrderPaymentStatus for editing/badges instead.
export type OrderStatus =
  | "pending_payment"
  | "partially_paid"
  | "paid"
  | "fulfilled"
  | "cancelled"
  | "refunded"
  | "partially_refunded";

// Admin-editable lifecycle, independent of payment status; written via updateOrderStatus/OrderStatusSelect.
export type OrderFulfillmentStatus = "pending" | "processing" | "on_hold" | "completed" | "cancelled";

// Derived server-side from payments/refunds, never settable by hand (see OrderPaymentStatusBadge).
export type OrderPaymentStatus = "pending_payment" | "partially_paid" | "paid" | "partially_refunded" | "refunded";

export type OrderChannel = "storefront" | "ebay" | "manual";

export type OrderDeliveryMethod = "delivery" | "pickup";

export interface OrderCustomer {
  name: string;
  // Shown on the invoice instead of `name` when present.
  company_name: string | null;
  // Optional for manual orders (walk-in customers); always present for storefront/eBay orders.
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
  // Every item has a stable _id per refund-redesign-spec.md §1.1; older orders backfilled per §6.2.
  _id: string;
  product: string;
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
  // Price-edit audit trail (storefront/eBay only, see order.service.js#updateOrderItemPrice); original_unit_price set once on first edit.
  original_unit_price: number | null;
  unit_price_updated_at: string | null;
  unit_price_updated_by: string | null;
  // Refund ledger (spec §1.1): cumulative across succeeded, non-voided refunds; server-derived, never frontend-computed.
  quantity_refunded: number;
  amount_refunded: number; // cents, this line's share only
  quantity_restocked: number; // <= quantity_refunded; restock is opt-in per refund
  // Virtual (quantity - quantity_refunded), server-computed so the frontend can't drift from refund-calculator.service.js.
  refundable_quantity: number;
}

// Internal staff comment thread, distinct from Order.note (customer-facing, set at creation).
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
  // Bare zero-padded sequence ("00001"); format via formatOrderNumber() from @/utils/format, never a hardcoded prefix.
  order_number: string;
  // Snapshotted from TenantSettings.order_number_prefix at creation; stays fixed even if the setting later changes.
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
