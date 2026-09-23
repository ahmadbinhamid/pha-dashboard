export interface DashboardStats {
  totalInventoryValue: number; // dollars
  // % change in inventory value over the last 7 days; null when there's no baseline to compare against.
  inventoryValueChangePct: number | null;
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
  // Keyed by whatever ORDER_CHANNEL values actually appear in this tenant's orders, not a fixed list.
  byChannel: Record<string, number>;
}

export interface OrderVolumeResponse {
  points: OrderVolumePoint[];
  // Total revenue for the same-length window immediately before `points`, a real computed baseline for "vs prior period".
  previousPeriodRevenueCents: number;
}

export type OrderVolumeMetric = "orders" | "revenueCents" | "items";

// Either a preset day count or an explicit from/to range (backend prefers from/to when both present) — the single date-range filter driving both dashboard charts.
export interface OrderVolumeParams {
  days?: number;
  from?: string;
  to?: string;
}

// Only channels this app integrates with are ever returned — "not_connected" is a real channel with zero activity, never an unbuilt platform.
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
  // Only set on "stock" events — the SKU the adjustment applies to, rendered on its own line under the description.
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
