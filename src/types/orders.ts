export type OrderStatus = "paid" | "processing" | "shipped" | "cancelled" | "refunded";
export type OrderChannel = "counter" | "web" | "ebay";
export type PaymentStatus = "paid" | "unpaid";
export type FulfilmentType = "pickup" | "delivery";
export type SaleType = "walk_in" | "online" | "ebay";

export type Order = {
  id: string;
  date: string;
  customer: { name: string; email: string; phone?: string; address?: string };
  channel: OrderChannel;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  saleType: SaleType;
  fulfilment: FulfilmentType;
  total: number;
  tracking?: string;
};
