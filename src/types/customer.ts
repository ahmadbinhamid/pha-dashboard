import type { Order, OrderAddress } from "./orders";

export interface Customer {
  _id: string;
  name: string;
  email: string | null;
  phone: string | null;
  has_online_account: boolean;
  registered_at: string | null;
  orders_count: number;
  outstanding_invoices_count: number;
  shipping_address: OrderAddress | null;
  // null => same as shipping
  billing_address: OrderAddress | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerDetail extends Customer {
  orders: Order[];
  outstanding_invoices: Order[];
}
