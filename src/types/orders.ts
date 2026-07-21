import type { PaymentStatus, Refund } from "@/types/payment";

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "fulfilled"
  | "cancelled"
  | "refunded"
  | "partially_refunded";

export type OrderChannel = "storefront" | "ebay";

export interface OrderCustomer {
  name: string;
  email: string;
  phone: string;
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
  ebay_sync_status: "not_applicable" | "pending" | "synced" | "failed";
  ebay_sync_error: string | null;
}

// Populated by the backend from the linked Payment doc.
export interface OrderPaymentSummary {
  _id: string;
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
  shipping_address: OrderAddress;
  billing_address: OrderAddress | null;
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
  payment: OrderPaymentSummary | null;
  created_at: string;
  updated_at: string;
}

export interface OrderDetail extends Order {
  refunds: Refund[];
}
