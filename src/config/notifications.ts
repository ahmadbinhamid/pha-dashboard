import type { NotificationCategory, NotificationEvent, NotificationTab, NotificationType } from "@/types/notification";

export const NOTIFICATION_TABS: { value: NotificationTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "orders", label: "Orders" },
  { value: "invoices", label: "Invoices" },
];

export const NOTIFICATION_PAGE_SIZE = 10;

export const NOTIFICATION_EVENT_OPTIONS: { event: NotificationEvent; label: string; description: string }[] = [
  { event: "storefront_orders", label: "Storefront orders", description: "A website order has been paid." },
  { event: "ebay_orders", label: "eBay orders", description: "An eBay order has been imported." },
  { event: "in_store_orders", label: "In-store orders", description: "A teammate created an in-store order." },
  {
    event: "overdue_invoices",
    label: "Overdue invoices",
    description: "A business account invoice is past its due date and still owing.",
  },
];

// Mirrors server NOTIFICATION_CATEGORY_TYPES: which tab a type belongs to.
export const NOTIFICATION_TYPE_CATEGORY: Record<NotificationType, NotificationCategory> = {
  "order.new": "orders",
  "order.overdue": "invoices",
};

// Every server category, derived so a new tab needs no second list.
export const NOTIFICATION_CATEGORIES = [...new Set(Object.values(NOTIFICATION_TYPE_CATEGORY))];
