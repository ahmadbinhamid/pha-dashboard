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

export const ORDERS: Order[] = [
  {
    id: "PPG-10513",
    date: "2026-05-09 14:22",
    customer: { name: "Mia Alvarez", email: "mia.alvarez@example.com" },
    channel: "ebay",
    status: "processing",
    paymentStatus: "unpaid",
    saleType: "ebay",
    fulfilment: "delivery",
    total: 289.5,
    tracking: "—",
  },
  {
    id: "PPG-10512",
    date: "2026-05-09 13:58",
    customer: { name: "Dylan Park", email: "dylan.park@example.com" },
    channel: "web",
    status: "paid",
    paymentStatus: "paid",
    saleType: "online",
    fulfilment: "delivery",
    total: 79.95,
  },
  {
    id: "PPG-10511",
    date: "2026-05-09 12:31",
    customer: { name: "Sofia Nguyen", email: "sofia.nguyen@example.com" },
    channel: "counter",
    status: "shipped",
    paymentStatus: "paid",
    saleType: "walk_in",
    fulfilment: "pickup",
    total: 1420.0,
    tracking: "1Z9A…2K1",
  },
  {
    id: "PPG-10510",
    date: "2026-05-09 10:12",
    customer: { name: "Oliver Smith", email: "oliver.smith@example.com" },
    channel: "web",
    status: "refunded",
    paymentStatus: "paid",
    saleType: "online",
    fulfilment: "delivery",
    total: 19.99,
  },
  {
    id: "PPG-10509",
    date: "2026-05-09 09:03",
    customer: { name: "Harper Wilson", email: "harper.wilson@example.com" },
    channel: "ebay",
    status: "cancelled",
    paymentStatus: "unpaid",
    saleType: "ebay",
    fulfilment: "delivery",
    total: 229.0,
  },
];

