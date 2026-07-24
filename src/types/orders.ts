import type { PaymentStatus, Refund } from "@/types/payment";

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "fulfilled"
  | "cancelled"
  | "refunded"
  | "partially_refunded";

export type OrderChannel = "storefront" | "ebay" | "manual";

export type OrderDeliveryMethod = "delivery" | "pickup";

export interface OrderCustomer {
  name: string;
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
  provider: "stripe" | "manual";
  // Only set for provider "manual" — how the customer actually paid.
  payment_method: "cash" | "online_transfer" | null;
  status: PaymentStatus;
  amount: number; // cents
  amount_refunded: number; // cents
  card_brand: string | null;
  card_last4: string | null;
  paid_at: string | null;
}

export interface Order {
  _id: string;
  order_number: string;
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
  shipping_cost: number; // cents
  tax_amount: number; // cents — GST component of subtotal, display-only
  total: number; // cents
  currency: string;
  status: OrderStatus;
  channel: OrderChannel;
  external_order_id: string | null;
  external_buyer_username: string | null;
  has_stock_issue: boolean;
  stock_issue_note: string | null;
  // Set together when an admin fulfils a DELIVERY order — null until then,
  // always null for PICKUP orders.
  tracking_number: string | null;
  carrier_name: string | null;
  payment: OrderPaymentSummary | null;
  created_at: string;
  updated_at: string;
}

export interface OrderDetail extends Order {
  refunds: Refund[];
}
