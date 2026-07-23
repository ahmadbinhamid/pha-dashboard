import type { Order } from "./orders";

export interface Customer {
  _id: string;
  name: string;
  email: string | null;
  phone: string | null;
  has_online_account: boolean;
  registered_at: string | null;
  orders_count: number;
  outstanding_invoices_count: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerDetail extends Customer {
  orders: Order[];
  outstanding_invoices: Order[];
}

export interface CustomerFormState {
  name: string;
  email: string;
  phone: string;
}
