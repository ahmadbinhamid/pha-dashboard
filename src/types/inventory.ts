export type InventoryAdjustType =
  | "restock"
  | "damaged"
  | "lost"
  | "stolen"
  | "correction"
  | "transfer_in"
  | "transfer_out"
  | "other";
export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export interface InventoryRecord {
  _id: string;
  id: string;
  product: {
    _id: string;
    id: string;
    title: string;
    slug: string;
    sku: string | null;
    attachments: import("./product").Attachment[];
  };
  variant: import("./product").ProductVariant | null;
  location: import("./product").Location;
  stock_count: number;
  stock_reserved: number;
  stock_status: StockStatus; // computed on FE
  updated_at: string;
  created_at: string;
}

export interface InventoryHistoryRecord {
  _id: string;
  id: string;
  inventory: string;
  product: string;
  variant: string | null;
  location: import("./product").Location;
  adjustment: number;
  stock_before: number;
  stock_after: number;
  reason: string | null;
  type: InventoryAdjustType;
  user: {
    _id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  created_at: string;
}

export interface InventorySettings {
  _id: string;
  low_stock_threshold: number;
  email_notifications: boolean;
  notification_email: string | null;
  notification_send_time: string;
}
