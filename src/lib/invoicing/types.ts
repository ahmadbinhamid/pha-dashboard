export type InvoiceStatus = "draft" | "pending" | "paid" | "refunded";

export type SaleType = "walk_in" | "online" | "ebay";
export type FulfilmentType = "pickup" | "delivery";

export type PaymentMethod =
  | "cash"
  | "eftpos"
  | "bank_transfer"
  | "credit_card"
  | "afterpay"
  | "other";

export type Customer = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
};

export type InvoiceLine = {
  productId: string;
  sku: string;
  title: string;
  qty: number;
  unitPriceInclGst: number;
};

export type InvoiceDraft = {
  invoiceNumber: string;
  status: InvoiceStatus;
  createdAt: string;
  customer: Customer | null;
  customerAddress?: string;
  saleType?: SaleType;
  fulfilment?: FulfilmentType;
  lines: InvoiceLine[];
  shippingInclGst: number;
  discountInclGst: number;
  notes: string;
  paymentMethod: PaymentMethod;
  activity: Array<{ at: string; text: string }>;
};

