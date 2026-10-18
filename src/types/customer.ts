import type { Order, OrderAddress } from "./orders";
import type { Business } from "./business";

// staff: added in the dashboard, storefront: captured from a website order.
export type CustomerSource = "staff" | "storefront";

export interface Customer {
  _id: string;
  name: string;
  // Reps of one business are separate customers sharing this id.
  business_id: string | null;
  business: Business | null;
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

// Another customer of the same business, as listed on a profile.
export type CustomerRepresentative = Pick<Customer, "_id" | "name" | "email" | "phone">;

export interface CustomerDetail extends Customer {
  orders: Order[];
  outstanding_invoices: Order[];
  representatives: CustomerRepresentative[];
}

// GET /customer/stats.
export interface CustomerStats {
  totalCustomers: number;
  onlineAccounts: number;
  newThisMonth: number;
  withUnpaidInvoices: number;
}
