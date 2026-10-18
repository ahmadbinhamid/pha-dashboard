import type { Order, OrderAddress } from "./orders";

// staff: added in the dashboard, storefront: captured from a website order.
export type CustomerSource = "staff" | "storefront";

export interface Customer {
  _id: string;
  name: string;
  // Shown on invoices instead of `name` when present.
  company_name: string | null;
  email: string | null;
  phone: string | null;
  has_online_account: boolean;
  registered_at: string | null;
  orders_count: number;
  outstanding_invoices_count: number;
  source: CustomerSource;
  // Ticked "email me offers" at checkout, campaigns only email these.
  marketing_opt_in: boolean;
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

// GET /customer/stats.
export interface CustomerStats {
  totalCustomers: number;
  onlineAccounts: number;
  newThisMonth: number;
  withUnpaidInvoices: number;
}
