import type { PaginatedData } from "@/lib/api/base";
import type { OrderChannel } from "@/types/orders";

// Mirrors server NOTIFICATION_TYPE.
export type NotificationType = "order.new" | "order.overdue";

// Bell tabs; "all" is the unfiltered feed, not a server category.
export type NotificationCategory = "orders" | "invoices";
export type NotificationTab = "all" | NotificationCategory;

// Mirrors server NOTIFICATION_EVENT: what a user can opt out of.
export type NotificationEvent = "storefront_orders" | "ebay_orders" | "in_store_orders" | "overdue_invoices";

export interface NotificationData {
  order_id: string;
  order_number: string;
  channel: OrderChannel;
  total: number;
  customer_name: string | null;
}

export interface AppNotification {
  _id: string;
  tenant_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: NotificationData;
  read_at: string | null;
  created_at: string;
}

export interface NotificationListParams {
  page?: number;
  limit?: number;
  category?: NotificationCategory;
}

export type NotificationListResponse = PaginatedData<AppNotification> & {
  unread_count: number;
  unread_by_category: Record<NotificationCategory, number>;
};

export interface NotificationPreferences {
  events: Record<NotificationEvent, boolean>;
  show_toasts: boolean;
}

// PUT /notification/preferences: only the keys sent are changed.
export interface NotificationPreferencesUpdate {
  events?: Partial<Record<NotificationEvent, boolean>>;
  show_toasts?: boolean;
}
