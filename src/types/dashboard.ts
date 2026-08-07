export interface DashboardStats {
  totalInventoryValue: number; // dollars
  lowStockCount: number;
  outOfStockCount: number;
  pendingOrdersCount: number;
  pendingOrdersAvgAgeHours: number;
  syncStabilityPct: number;
  channelsOperational: number;
  channelsTotal: number;
}

export interface OrderVolumePoint {
  date: string; // yyyy-mm-dd
  orders: number;
  revenueCents: number;
  items: number;
}

export type OrderVolumeMetric = "orders" | "revenueCents" | "items";

// Only channels this app actually integrates with are ever returned —
// "not_connected" exists for a real channel with zero activity yet, never a
// platform (Amazon/Walmart/Shopify) that isn't built.
export type ChannelStatus = "operational" | "attention" | "not_connected";

export interface ChannelHealth {
  key: string;
  name: string;
  status: ChannelStatus;
  lastSyncedAt: string | null;
  detail?: string;
  listingsSynced?: number;
  listingsTotal?: number;
}

export type ActivityEventType = "order" | "stock";

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  title: string;
  description: string;
  // Only ever set on "stock" events — the product/variant SKU the
  // adjustment applies to, rendered on its own line under the description.
  sku?: string | null;
  timestamp: string;
  tags: string[];
}

export interface CriticalStockItem {
  inventoryId: string;
  productId: string;
  sku: string;
  name: string;
  category: string | null;
  stockCount: number;
}

export interface ActivityLogPage {
  items: ActivityEvent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ActivityAnalyticsPoint {
  date: string; // yyyy-mm-dd
  orders: number;
  stock: number;
}

export interface ActivityAnalytics {
  totalEvents: number;
  orderEvents: number;
  stockEvents: number;
  dailyTrend: ActivityAnalyticsPoint[];
}
