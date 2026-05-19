export type InvoiceStatus = "draft" | "pending" | "paid" | "refunded";

export type PaymentMethod =
  | "cash"
  | "eftpos"
  | "bank_transfer"
  | "credit_card"
  | "afterpay"
  | "other";

export type InvoiceCustomer = {
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
  customer: InvoiceCustomer | null;
  customerAddress?: string;
  saleType?: import("./orders").SaleType;
  fulfilment?: import("./orders").FulfilmentType;
  lines: InvoiceLine[];
  shippingInclGst: number;
  discountInclGst: number;
  notes: string;
  paymentMethod: PaymentMethod;
  activity: Array<{ at: string; text: string }>;
};
